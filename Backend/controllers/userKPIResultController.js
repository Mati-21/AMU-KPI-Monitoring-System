const { UserKPIResult, User, KPI, KPIType, Unit, Role, UserRole, UserKPI, OfficeReportSubmission } = require('../models');
const { hasPermission, permissionKey } = require('../middleware/authMiddleware');
const { getCurrentCycleYear, getCurrentQuarter, normalizeQuarter, QUARTERS } = require('../utils/kpiCycle');
const { Op, Sequelize } = require('sequelize');

const parseNumericValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const formatNumericValue = (value) => {
  const numeric = parseNumericValue(value);
  if (numeric === null) {
    return '—';
  }

  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2);
};

const compareKpiNumbers = (leftValue, rightValue) => {
  const left = String(leftValue || '').trim();
  const right = String(rightValue || '').trim();

  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;

  const leftParts = left.split('.').map((part) => Number(part));
  const rightParts = right.split('.').map((part) => Number(part));
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index];
    const rightPart = rightParts[index];

    if (Number.isNaN(leftPart) || Number.isNaN(rightPart)) {
      return left.localeCompare(right);
    }

    if (leftPart !== rightPart) {
      return leftPart - rightPart;
    }
  }

  return 0;
};

const AFFILIATED_OFFICE_REPORT_PERMISSION_KEYS = [
  permissionKey('view', 'Affiliated Office Report'),
  permissionKey('view', 'KPI Reporting'),
  permissionKey('view', 'Other Affiliated Office Reports'),
  permissionKey('view', 'Other Role Reports'),
].filter(Boolean);

const buildKpiCodeIndex = (kpiTypes) => {
  const byId = new Map(kpiTypes.map((type) => [String(type.Id), type]));
  const childrenByParent = new Map();

  kpiTypes.forEach((type) => {
    const key = String(type.ParentKPIID || '__root__');
    if (!childrenByParent.has(key)) {
      childrenByParent.set(key, []);
    }

    childrenByParent.get(key).push(type);
  });

  childrenByParent.forEach((children) => {
    children.sort((left, right) => String(left.KPIName || '').localeCompare(String(right.KPIName || '')));
  });

  const buildCode = (kpiTypeId) => {
    const lineage = [];
    let current = byId.get(String(kpiTypeId));

    while (current) {
      lineage.unshift(current);
      current = current.ParentKPIID ? byId.get(String(current.ParentKPIID)) : null;
    }

    if (!lineage.length) {
      return '';
    }

    const parts = lineage.map((node) => {
      const siblings = childrenByParent.get(String(node.ParentKPIID || '__root__')) || [];
      return String(siblings.findIndex((sibling) => String(sibling.Id) === String(node.Id)) + 1);
    });

    return parts.join('.');
  };

  return { buildCode, byId };
};

const getTypeLineage = (typeId, byId) => {
  const lineage = [];
  let current = byId.get(String(typeId || '')) || null;

  while (current) {
    lineage.unshift(current);
    current = current.ParentKPIID ? byId.get(String(current.ParentKPIID)) : null;
  }

  return lineage;
};

const buildHierarchyNames = (leafType, byId) => {
  const lineage = leafType?.Id ? getTypeLineage(leafType.Id, byId) : [];
  const names = lineage.map((node) => String(node?.KPIName || '').trim()).filter(Boolean);

  const stableName = names[0] || 'Uncategorized Stable';
  const themeName = names[1] || (names[0] ? `${names[0]} Theme` : 'General Theme');
  const subThemeName = names[2] || (names[1] || names[0] ? `${names[names.length - 1] || 'General'} Sub Theme` : 'General Sub Theme');

  return {
    stableName,
    themeName,
    subThemeName,
  };
};

const createPlaceholderValues = (columns) => {
  const values = {};
  columns.forEach((column) => {
    values[String(column.id)] = '—';
  });

  return values;
};

const buildStructuredReportRows = ({ kpiRows, columns }) => {
  const grouped = new Map();

  const sortedRows = [...kpiRows].sort(
    (left, right) =>
      String(left.stableName || '').localeCompare(String(right.stableName || '')) ||
      String(left.themeName || '').localeCompare(String(right.themeName || '')) ||
      String(left.subThemeName || '').localeCompare(String(right.subThemeName || '')) ||
      compareKpiNumbers(left.no, right.no) ||
      String(left.kpi || '').localeCompare(String(right.kpi || ''))
  );

  // If we have ONLY derived KPIs (no 'no' field), we return them as a flat list without categories
  const onlyDerived = sortedRows.length > 0 && sortedRows.every((row) => !row.no || row.no === '');
  if (onlyDerived) {
    return sortedRows.map((row) => ({
      ...row,
      rowType: 'leaf',
      level: 0,
    }));
  }

  sortedRows.forEach((row) => {
    const stableKey = String(row.stableName || 'Uncategorized Stable');
    if (!grouped.has(stableKey)) {
      grouped.set(stableKey, new Map());
    }

    const themeMap = grouped.get(stableKey);
    const themeKey = String(row.themeName || 'General Theme');
    if (!themeMap.has(themeKey)) {
      themeMap.set(themeKey, new Map());
    }

    const subThemeMap = themeMap.get(themeKey);
    const subThemeKey = String(row.subThemeName || 'General Sub Theme');
    if (!subThemeMap.has(subThemeKey)) {
      subThemeMap.set(subThemeKey, []);
    }

    subThemeMap.get(subThemeKey).push(row);
  });

  const rows = [];
  let stableCounter = 0;

  grouped.forEach((themeMap, stableName) => {
    stableCounter += 1;
    const stableNo = String(stableCounter);
    let stableWeightTotal = 0;
    let themeCounter = 0;

    const stableRow = {
      id: `stable-${stableNo}`,
      rowType: 'stable',
      level: 0,
      no: stableNo,
      kpi: stableName,
      unit: '—',
      weight: '—',
      target: '—',
      baseline: '—',
      remark: '—',
      values: createPlaceholderValues(columns),
    };

    const stableBlock = [stableRow];

    themeMap.forEach((subThemeMap, themeName) => {
      themeCounter += 1;
      const themeNo = `${stableNo}.${themeCounter}`;
      let themeWeightTotal = 0;
      let subThemeCounter = 0;

      const themeBlock = [
        {
          id: `theme-${themeNo}`,
          rowType: 'theme',
          level: 1,
          no: themeNo,
          kpi: themeName,
          unit: '—',
          weight: '—',
          target: '—',
          baseline: '—',
          remark: '—',
          values: createPlaceholderValues(columns),
        },
      ];

      subThemeMap.forEach((subThemeRows, subThemeName) => {
        subThemeCounter += 1;
        const subThemeNo = `${themeNo}.${subThemeCounter}`;
        let subThemeWeightTotal = 0;

        // Redundancy Check: If a sub-theme contains only one KPI and has the exact same name, 
        // we suppress the header to avoid a "Double Row" effect.
        const isRedundantSubTheme = subThemeRows.length === 1 && String(subThemeRows[0].kpi || '').trim() === String(subThemeName || '').trim();

        if (!isRedundantSubTheme) {
          themeBlock.push({
            id: `subtheme-${subThemeNo}`,
            rowType: 'subTheme',
            level: 2,
            no: subThemeNo,
            kpi: subThemeName,
            unit: '—',
            weight: '—',
            target: '—',
            baseline: '—',
            remark: '—',
            values: createPlaceholderValues(columns),
          });
        }

        const kpiRowsForSubTheme = [...subThemeRows].sort(
          (left, right) =>
            String(left.no || '').localeCompare(String(right.no || '')) || String(left.kpi || '').localeCompare(String(right.kpi || ''))
        );

        kpiRowsForSubTheme.forEach((row, index) => {
          // If redundant, the KPI takes the sub-theme's numbering (e.g. 1.1.1 instead of 1.1.1.1)
          const kpiNo = isRedundantSubTheme ? subThemeNo : `${subThemeNo}.${index + 1}`;
          const rowWeight = parseNumericValue(row.weightNumeric) || 0;
          subThemeWeightTotal += rowWeight;
          themeWeightTotal += rowWeight;
          stableWeightTotal += rowWeight;

          themeBlock.push({
            ...row,
            rowType: 'kpi',
            level: isRedundantSubTheme ? 2 : 3, // Adjust indentation if merged
            no: kpiNo,
          });
        });

        // Only show Sub Total if there are multiple KPIs in the sub-theme
        if (subThemeRows.length > 1) {
          themeBlock.push({
            id: `subtotal-${subThemeNo}`,
            rowType: 'subTotal',
            level: 3,
            no: '',
            kpi: 'Sub Total',
            unit: '—',
            weight: formatNumericValue(subThemeWeightTotal),
            target: '—',
            baseline: '—',
            remark: `${subThemeName} Weight`,
            values: createPlaceholderValues(columns),
          });
        }
      });

      themeBlock[0].weight = formatNumericValue(themeWeightTotal);
      stableWeightTotal += 0;
      stableBlock.push(...themeBlock);
    });

    stableRow.weight = formatNumericValue(stableWeightTotal);
    rows.push(...stableBlock);
  });

  return rows;
};

const getDescendantRoleIds = (roles, rootRoleId) => {
  const childrenByParent = new Map();

  roles.forEach((role) => {
    const parentKey = String(role.ParentRoleId || '');
    if (!childrenByParent.has(parentKey)) {
      childrenByParent.set(parentKey, []);
    }

    childrenByParent.get(parentKey).push(String(role.Id));
  });

  const descendants = new Set();
  const queue = [...(childrenByParent.get(String(rootRoleId)) || [])];

  while (queue.length) {
    const roleId = queue.shift();
    if (!roleId || descendants.has(roleId)) {
      continue;
    }

    descendants.add(roleId);
    const children = childrenByParent.get(roleId) || [];
    children.forEach((childId) => queue.push(childId));
  }

  return descendants;
};

const sumUserKpiPerformance = (results) => {
  const groupedResults = new Map();

  results.forEach((result) => {
    const numeric = parseNumericValue(result.KPIResult);
    const quarter = normalizeQuarter(result.Quarter);

    if (numeric === null || !quarter) {
      return;
    }

    const key = result.UserKPIId ? String(result.UserKPIId) : `${String(result.UserId || '')}::${String(result.KPIId || '')}`;
    if (!groupedResults.has(key)) {
      groupedResults.set(key, []);
    }

    groupedResults.get(key).push({
      quarter,
      numeric,
      createdAt: result.CreatedAt ? new Date(result.CreatedAt) : null,
    });
  });

  const sums = new Map();

  groupedResults.forEach((items, key) => {
    const latestByQuarter = new Map();

    items.forEach((item) => {
      const existing = latestByQuarter.get(item.quarter);
      if (!existing) {
        latestByQuarter.set(item.quarter, item);
        return;
      }

      const existingTime = existing.createdAt ? existing.createdAt.getTime() : 0;
      const nextTime = item.createdAt ? item.createdAt.getTime() : 0;
      if (nextTime >= existingTime) {
        latestByQuarter.set(item.quarter, item);
      }
    });

    let previousQuarterValue = 0;
    let cumulativeTotal = 0;

    QUARTERS.forEach((quarter) => {
      const quarterItem = latestByQuarter.get(quarter);
      if (!quarterItem) {
        return;
      }

      const quarterDelta = quarterItem.numeric - previousQuarterValue;
      cumulativeTotal += Number.isFinite(quarterDelta) ? quarterDelta : 0;
      previousQuarterValue = quarterItem.numeric;
    });

    sums.set(key, cumulativeTotal);
  });

  return sums;
};

const buildRoleKpiAggregation = ({ assignments, userRoleByUserId, visibleRoleIds, userKpiSums }) => {
  const groupedAssignments = new Map();

  assignments.forEach((assignment) => {
    const userId = String(assignment.UserId || '');
    const roleId = String(userRoleByUserId.get(userId) || '');
    if (!userId || !roleId || !visibleRoleIds.has(roleId)) {
      return;
    }

    const kpiId = String(assignment.KPIId || '');
    if (!kpiId) {
      return;
    }

    const key = `${roleId}::${kpiId}`;
    if (!groupedAssignments.has(key)) {
      groupedAssignments.set(key, {
        isTargetIndividual: Boolean(assignment.IsTargetIndividual),
        assignedUsers: new Set(),
      });
    }

    const grouped = groupedAssignments.get(key);
    grouped.assignedUsers.add(userId);
  });

  const aggregation = new Map();

  groupedAssignments.forEach((grouped, key) => {
    const keyParts = key.split('::');
    const kpiId = keyParts[1] || '';
    let hasAnySubmission = false;

    const cumulativeValues = [...grouped.assignedUsers].map((userId) => {
      // Find the specific assignment ID for this user/kpi combo to ensure isolated performance tracking
      const specificAssignment = assignments.find((a) => String(a.UserId) === userId && String(a.KPIId) === kpiId);
      const userKpiKey = specificAssignment ? String(specificAssignment.Id) : `${String(userId)}::${kpiId}`;

      if (userKpiSums.has(userKpiKey)) {
        hasAnySubmission = true;
      }

      return userKpiSums.get(userKpiKey) || 0;
    });

    const cumulativeTotal = cumulativeValues.reduce((sum, value) => sum + value, 0);
    const receiverCount = cumulativeValues.length;
    const aggregatedPerformance = grouped.isTargetIndividual ? (receiverCount > 0 ? cumulativeTotal / receiverCount : 0) : cumulativeTotal;

    aggregation.set(key, {
      isTargetIndividual: grouped.isTargetIndividual,
      receiverCount,
      aggregatedPerformance,
      hasAnySubmission,
    });
  });

  return aggregation;
};

const buildAnnualSummary = (results) => {
  const grouped = new Map();

  results.forEach((result) => {
    const key = `${result.CycleYear}::${result.UserId}::${result.KPIId}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        cycleYear: result.CycleYear,
        userId: result.UserId,
        user: result.User,
        kpiId: result.KPIId,
        kpi: result.KPI,
        quarterlyResults: [],
      });
    }

    grouped.get(key).quarterlyResults.push({
      id: result.Id,
      quarter: result.Quarter,
      kpiResult: result.KPIResult,
      description: result.Description,
      createdAt: result.CreatedAt,
    });
  });

  return [...grouped.values()].map((item) => {
    const numericValues = item.quarterlyResults.map((quarterlyResult) => Number(quarterlyResult.kpiResult)).filter((value) => Number.isFinite(value));

    const annualAverage =
      numericValues.length === item.quarterlyResults.length && numericValues.length > 0
        ? Number((numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length).toFixed(2))
        : null;

    return {
      ...item,
      quartersReported: item.quarterlyResults.map((quarterlyResult) => quarterlyResult.quarter),
      annualAverage,
      annualNarrative: item.quarterlyResults.map((quarterlyResult) => `${quarterlyResult.quarter}: ${quarterlyResult.kpiResult}`).join(' | '),
    };
  });
};

const buildAffiliatedOfficeReportDataForScope = async ({ cycleYear, scopeRoleId, viewerUserId, reportType }) => {
  const roles = await Role.findAll({
    where: { IsArchived: false },
    attributes: ['Id', 'RoleName', 'ParentRoleId', 'IsDistributable'],
    order: [['RoleName', 'ASC']],
  });

  const roleById = new Map(roles.map((role) => [String(role.Id), role]));
  const selectedScopeRole = roleById.get(String(scopeRoleId)) || null;

  if (!selectedScopeRole) {
    const error = new Error('Selected role not found.');
    error.statusCode = 404;
    throw error;
  }

  const childRoles = roles
    .filter((role) => String(role.ParentRoleId || '') === String(selectedScopeRole.Id))
    .sort((left, right) => String(left.RoleName || '').localeCompare(String(right.RoleName || '')));

  const descendantsByChildRole = new Map();
  const roleToChildColumn = new Map();

  childRoles.forEach((childRole) => {
    const childRoleId = String(childRole.Id);
    const queue = [childRoleId];
    const descendants = new Set();

    while (queue.length) {
      const currentRoleId = queue.shift();
      if (!currentRoleId || descendants.has(currentRoleId)) {
        continue;
      }

      descendants.add(currentRoleId);
      roleToChildColumn.set(currentRoleId, childRoleId);

      roles.filter((role) => String(role.ParentRoleId || '') === currentRoleId).forEach((role) => queue.push(String(role.Id)));
    }

    descendantsByChildRole.set(childRoleId, descendants);
  });

  const visibleRoleIds = new Set([...roleToChildColumn.keys()]);

  const activeUserRoles = await UserRole.findAll({
    where: {
      IsArchived: false,
      [Op.or]: [{ ToDate: null }, { ToDate: { [Op.gte]: new Date() } }],
    },
    attributes: ['UserId', 'RoleId', 'CreatedAt'],
    include: [
      {
        model: User,
        attributes: ['Id', 'FirstName', 'FatherName', 'GrandFatherName', 'Email', 'UserName'],
      },
      {
        model: Role,
        attributes: ['Id', 'RoleName', 'ParentRoleId', 'IsDistributable'],
      },
    ],
    order: [['CreatedAt', 'DESC']],
  });

  const userRoleByUserId = new Map();
  activeUserRoles.forEach((assignment) => {
    const userId = String(assignment.UserId || '');
    const roleId = String(assignment.RoleId || assignment.Role?.Id || '');
    if (!userId || !roleId || userRoleByUserId.has(userId)) {
      return;
    }

    userRoleByUserId.set(userId, roleId);
  });

  const visibleUserIds = activeUserRoles
    .filter((assignment) => visibleRoleIds.has(String(assignment.RoleId || assignment.Role?.Id || '')))
    .map((assignment) => String(assignment.UserId || ''))
    .filter(Boolean);

  const uniqueVisibleUserIds = [...new Set(visibleUserIds)];
  const scopeOwnerUserIds = activeUserRoles
    .filter((assignment) => String(assignment.RoleId || assignment.Role?.Id || '') === String(selectedScopeRole.Id))
    .map((assignment) => String(assignment.UserId || ''))
    .filter(Boolean);

  // Also include the current user in the dispatcher list if they are viewing their own role's report
  // and ensure we include any historical users who made assignments to these children.
  const uniqueScopeOwnerUserIds = [...new Set([...scopeOwnerUserIds, viewerUserId])].filter(Boolean);

  // 1. Identify the parent role's users to filter for "Official" assignments only
  const parentRoleIdOfScope = selectedScopeRole?.ParentRoleId;
  let parentOfParentUserIds = [];
  if (parentRoleIdOfScope) {
    const pUserRoles = await UserRole.findAll({
      where: { RoleId: parentRoleIdOfScope, IsArchived: false },
      attributes: ['UserId'],
    });
    parentOfParentUserIds = pUserRoles.map((ur) => String(ur.UserId));
  }

  const kpiInclude = [
    {
      model: KPI,
      attributes: ['Id', 'KPITypeId', 'UnitId', 'Weight', 'Baseline', 'Target', 'Description', 'Remark'],
      include: [
        {
          model: KPIType,
          attributes: ['Id', 'KPIName', 'ParentKPIID'],
        },
        {
          model: Unit,
          attributes: ['Id', 'Code', 'Name'],
        },
      ],
    },
  ];

  // 2. Fetch KPIs assigned TO the scope role by their parent (Official Rows)
  const officialParentAssignments = await UserKPI.findAll({
    where: {
      IsArchived: false,
      CycleYear: cycleYear,
      UserId: { [Op.in]: uniqueScopeOwnerUserIds },
      ...(parentOfParentUserIds.length ? { CreatedBy: { [Op.in]: parentOfParentUserIds } } : {}),
    },
    include: kpiInclude,
    order: [['CreatedAt', 'ASC']],
  });

  // 3. Fetch KPIs assigned BY the scope role to their children (Column Data)
  const childAssignments = uniqueVisibleUserIds.length
    ? await UserKPI.findAll({
        where: {
          IsArchived: false,
          CycleYear: cycleYear,
          UserId: { [Op.in]: uniqueVisibleUserIds },
          CreatedBy: { [Op.in]: uniqueScopeOwnerUserIds },
        },
        include: kpiInclude,
        order: [['CreatedAt', 'ASC']],
      })
    : [];

  const allAssignments = officialParentAssignments;

  // Split into original vs derived
  const isDerivedAssignment = (a) => !!(a.Name || (a.Remark && String(a.Remark).toLowerCase() !== 'null' && String(a.Remark).trim() !== ''));
  const hasOriginal = allAssignments.some((a) => !isDerivedAssignment(a));
  const hasDerived = allAssignments.some((a) => isDerivedAssignment(a));

  // Filter based on reportType
  const assignments =
    reportType === 'derived'
      ? allAssignments.filter((a) => isDerivedAssignment(a))
      : reportType === 'original'
        ? allAssignments.filter((a) => !isDerivedAssignment(a))
        : allAssignments;

  const kpiById = new Map();
  assignments.forEach((assignment) => {
    if (assignment.KPI && !kpiById.has(String(assignment.KPIId))) {
      kpiById.set(String(assignment.KPIId), assignment.KPI);
    }
  });

  // Determine columns based on hierarchy: Roles with children get a Role column, leaf roles get User columns.
  const reportColumns = [];
  childRoles.forEach((role) => {
    const roleId = String(role.Id);
    // If IsDistributable is true, it is treated as a parent role (not a leaf), regardless of whether sub-roles exist.
    if (role.IsDistributable === true) {
      reportColumns.push({
        id: role.Id,
        name: role.RoleName,
        isUserColumn: false,
      });
    } else {
      // It's a leaf role - show users assigned to it
      const usersInRole = activeUserRoles.filter((ur) => String(ur.RoleId || ur.Role?.Id) === roleId);

      if (usersInRole.length > 0) {
        // Get unique users in this role
        const uniqueUsers = usersInRole.filter(
          (ur, index, self) => self.findIndex((entry) => String(entry.UserId) === String(ur.UserId)) === index
        );

        uniqueUsers.forEach((ur) => {
          reportColumns.push({
            id: ur.User.Id,
            name: `${ur.User.FirstName} ${ur.User.FatherName || ''}`.trim(),
            isUserColumn: true,
            roleId: ur.RoleId,
          });
        });
      } else {
        // Fallback: If no users assigned to leaf role, show Role name column so it's not missing from report
        reportColumns.push({
          id: role.Id,
          name: role.RoleName,
          isUserColumn: false,
        });
      }
    }
  });

  // Build a map for efficient individual performance lookup
  // Key: UserId::RowKey, Value: UserKPIId (assignment ID of the child)
  const userAssignmentMap = new Map();
  childAssignments.forEach((a) => {
    const leafType = a.KPI?.KPIType || null;
    const rowKey = `${String(a.KPIId)}::${(leafType?.KPIName || '').trim()}::${(a.Name || '').trim()}::${(a.Remark || '').trim()}`;
    userAssignmentMap.set(`${String(a.UserId)}::${rowKey}`, String(a.Id));
  });

  const kpiTypes = await KPIType.findAll({
    attributes: ['Id', 'KPIName', 'ParentKPIID'],
    order: [['KPIName', 'ASC']],
  });
  const { buildCode, byId } = buildKpiCodeIndex(kpiTypes);

  const kpiIds = [...kpiById.keys()];
  const results =
    uniqueVisibleUserIds.length && kpiIds.length
      ? await UserKPIResult.findAll({
          where: {
            IsArchived: false,
            CycleYear: cycleYear,
            UserId: { [Op.in]: uniqueVisibleUserIds },
            KPIId: { [Op.in]: kpiIds },
          },
          attributes: ['Id', 'UserId', 'KPIId', 'KPIResult', 'Quarter', 'CreatedAt'],
        })
      : [];

  const userChildColumnByUserId = new Map();
  userRoleByUserId.forEach((roleId, userId) => {
    if (!visibleRoleIds.has(String(roleId))) {
      return;
    }

    const columnRoleId = roleToChildColumn.get(String(roleId));
    if (columnRoleId) {
      userChildColumnByUserId.set(userId, columnRoleId);
    }
  });

  const aggregation = buildRoleKpiAggregation({
    assignments: childAssignments,
    userRoleByUserId: userChildColumnByUserId,
    visibleRoleIds: new Set(childRoles.map((role) => String(role.Id))),
    userKpiSums: sumUserKpiPerformance(results),
  });

  const reportRows = assignments.reduce((rows, assignment) => {
    const leafType = assignment.KPI?.KPIType || null;
    // Use a composite key for report rows to prevent squashing different derived versions of the same template KPI
    const rowKey = `${String(assignment.KPIId)}::${(leafType?.KPIName || '').trim()}::${(assignment.Name || '').trim()}::${(assignment.Remark || '').trim()}`;

    if (rows.has(rowKey)) {
      return rows;
    }

    const kpi = assignment.KPI;
    const hierarchy = buildHierarchyNames(leafType, byId);
    const isDerived = !!(assignment.Name || assignment.Remark);

    rows.set(rowKey, {
      id: rowKey,
      kpiId: String(assignment.KPIId),
      assignmentId: assignment.Id,
      no: isDerived ? '' : leafType?.Id ? buildCode(leafType.Id) : '',
      kpi: assignment.Name || leafType?.KPIName || kpi?.Description || '—',
      stableName: isDerived ? '—' : hierarchy.stableName || '—',
      themeName: isDerived ? '—' : hierarchy.themeName || '—',
      subThemeName: isDerived ? '—' : hierarchy.subThemeName || '—',
      unit: kpi?.Unit?.Code || kpi?.Unit?.Name || '—',
      weight: isDerived ? '' : formatNumericValue(kpi?.Weight),
      weightNumeric: isDerived ? 0 : (parseNumericValue(kpi?.Weight) ?? 0),
      baseline: formatNumericValue(assignment.Baseline ?? kpi?.Baseline),
      baselineNumeric: parseNumericValue(assignment.Baseline ?? kpi?.Baseline) ?? 0,
      target: formatNumericValue(assignment.AssignedTarget ?? kpi?.Target),
      remark: (String(assignment.Remark || '').trim().toLowerCase() === 'null' ? '' : assignment.Remark) || (isDerived ? '—' : (kpi?.Remark || kpi?.Description || '—')),
      values: {},
    });

    return rows;
  }, new Map());

  const userKpiSums = sumUserKpiPerformance(results);

  reportRows.forEach((row) => {
    reportColumns.forEach((column) => {
      if (column.isUserColumn) {
        const userKey = `${String(column.id)}::${String(row.id)}`;
        const assignmentId = userAssignmentMap.get(userKey);
        const performance = assignmentId ? userKpiSums.get(assignmentId) : undefined;

        if (!assignmentId) {
          row.values[String(column.id)] = 'N/A';
        } else if (performance === undefined) {
          row.values[String(column.id)] = '—';
        } else {
          row.values[String(column.id)] = formatNumericValue(performance);
        }
      } else {
        const metrics = aggregation.get(`${String(column.id)}::${String(row.kpiId)}`);
        if (!metrics) {
          row.values[String(column.id)] = 'N/A';
        } else if (!metrics.hasAnySubmission) {
          row.values[String(column.id)] = '—';
        } else {
          row.values[String(column.id)] = formatNumericValue(metrics.aggregatedPerformance);
        }
      }
    });

    // Cleanup internal IDs before sending to frontend
    delete row.kpiId;
    delete row.assignmentId;
    delete row.baselineNumeric;
  });

  const flatRows = [...reportRows.values()].sort(
    (left, right) => compareKpiNumbers(left.no, right.no) || String(left.kpi || '').localeCompare(String(right.kpi || ''))
  );

  return {
    year: cycleYear,
    scopeRole: {
      id: selectedScopeRole.Id,
      name: selectedScopeRole.RoleName,
    },
    columns: reportColumns,
    rows: buildStructuredReportRows({
      kpiRows: flatRows,
      columns: reportColumns,
    }),
    hasOriginal,
    hasDerived,
    reportType: reportType || 'all',
  };
};

const getAffiliatedOfficeReport = async (req, res) => {
  try {
    const { year, parentRoleId } = req.query;
    const cycleYear = year || getCurrentCycleYear();
    const currentRoleId = String(req.user?.currentRole?.Id || req.user?.roleId || '');
    const canSeeOtherAffiliatedOfficeReports = hasPermission(req.user?.currentRole?.Permissions, AFFILIATED_OFFICE_REPORT_PERMISSION_KEYS);

    if (!currentRoleId) {
      return res.status(400).json({ message: 'Current role is required to build the affiliated office report.' });
    }

    const requestedParentRoleId = String(parentRoleId || '').trim();
    const selectedParentRoleId = requestedParentRoleId || currentRoleId;

    if (selectedParentRoleId !== currentRoleId && !canSeeOtherAffiliatedOfficeReports) {
      return res.status(403).json({ message: 'Not authorized to view other affiliated office reports.' });
    }

    const roles = await Role.findAll({
      where: { IsArchived: false },
      attributes: ['Id', 'RoleName', 'ParentRoleId'],
      order: [['RoleName', 'ASC']],
    });

    const roleById = new Map(roles.map((role) => [String(role.Id), role]));
    const selectedScopeRole = roleById.get(String(selectedParentRoleId)) || roleById.get(String(currentRoleId)) || null;

    if (!selectedScopeRole) {
      return res.status(404).json({ message: 'Selected role not found.' });
    }

    const availableScopeRoles = canSeeOtherAffiliatedOfficeReports
      ? [selectedScopeRole, ...roles.filter((role) => roles.some((child) => String(child.ParentRoleId || '') === String(role.Id)))].filter(
          (role, index, items) => items.findIndex((entry) => String(entry.Id) === String(role.Id)) === index
        )
      : [selectedScopeRole];
    const selectedRoleHasChildren = await Role.findOne({
      where: { IsArchived: false, ParentRoleId: selectedScopeRole.Id },
      attributes: ['Id'],
    });

    const reportData = selectedRoleHasChildren
      ? await buildAffiliatedOfficeReportDataForScope({
          cycleYear,
          scopeRoleId: selectedScopeRole.Id,
          viewerUserId: req.user?.Id,
          reportType: req.query.reportType || undefined,
        })
      : await buildCurrentOfficeReportData({
          cycleYear,
          currentRoleId: selectedScopeRole.Id,
          reportType: req.query.reportType || undefined,
        });

    res.json({
      success: true,
      data: {
        ...reportData,
        canSeeOtherAffiliatedOfficeReports,
        availableScopeRoles: availableScopeRoles.map((role) => ({
          id: role.Id,
          name: role.RoleName,
        })),
      },
    });
  } catch (error) {
    console.error('Get affiliated office report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const buildCurrentOfficeReportData = async ({ cycleYear, currentRoleId, reportType }) => {
  if (!currentRoleId) {
    const error = new Error('Current role is required to build the report.');
    error.statusCode = 400;
    throw error;
  }

  const currentRole = await Role.findByPk(currentRoleId, {
    attributes: ['Id', 'RoleName', 'ParentRoleId'],
  });

  if (!currentRole) {
    const error = new Error('Current role not found.');
    error.statusCode = 404;
    throw error;
  }

  const parentRole = currentRole.ParentRoleId
    ? await Role.findByPk(currentRole.ParentRoleId, {
        attributes: ['Id', 'RoleName'],
      })
    : null;

  const parentAssignerUserIds = parentRole?.Id
    ? [
        ...new Set(
          (
            await UserRole.findAll({
              where: {
                IsArchived: false,
                RoleId: parentRole.Id,
              },
              attributes: ['UserId'],
            })
          )
            .map((assignment) => String(assignment.UserId || ''))
            .filter(Boolean)
        ),
      ]
    : [];

  const activeUserRoles = await UserRole.findAll({
    where: {
      IsArchived: false,
      RoleId: currentRoleId,
      [Op.or]: [{ ToDate: null }, { ToDate: { [Op.gte]: new Date() } }],
    },
    attributes: ['UserId', 'RoleId', 'CreatedAt'],
    include: [
      {
        model: User,
        attributes: ['Id', 'FirstName', 'FatherName', 'GrandFatherName', 'Email', 'UserName'],
      },
    ],
    order: [['CreatedAt', 'DESC']],
  });

  const userRoleByUserId = new Map();
  activeUserRoles.forEach((assignment) => {
    const userId = String(assignment.UserId || '');
    if (!userId || userRoleByUserId.has(userId)) {
      return;
    }

    userRoleByUserId.set(userId, String(currentRoleId));
  });

  const uniqueVisibleUserIds = [...new Set(activeUserRoles.map((assignment) => String(assignment.UserId || '')).filter(Boolean))];

  const allAssignments = uniqueVisibleUserIds.length
    ? await UserKPI.findAll({
        where: {
          IsArchived: false,
          CycleYear: cycleYear,
          UserId: { [Op.in]: uniqueVisibleUserIds },
        },
        include: [
          {
            model: KPI,
            attributes: ['Id', 'KPITypeId', 'UnitId', 'Weight', 'Baseline', 'Target', 'Description', 'Remark'],
            include: [
              {
                model: KPIType,
                attributes: ['Id', 'KPIName', 'ParentKPIID'],
              },
              {
                model: Unit,
                attributes: ['Id', 'Code', 'Name'],
              },
            ],
          },
        ],
        order: [['CreatedAt', 'ASC']],
      })
    : [];

  // Split into original vs derived
  const isDerivedAssignment = (a) => !!(a.Name || (a.Remark && String(a.Remark).toLowerCase() !== 'null' && String(a.Remark).trim() !== ''));
  const hasOriginal = allAssignments.some((a) => !isDerivedAssignment(a));
  const hasDerived = allAssignments.some((a) => isDerivedAssignment(a));

  // Filter based on reportType
  const assignments =
    reportType === 'derived'
      ? allAssignments.filter((a) => isDerivedAssignment(a))
      : reportType === 'original'
        ? allAssignments.filter((a) => !isDerivedAssignment(a))
        : allAssignments;

  const kpiById = new Map();
  assignments.forEach((assignment) => {
    if (assignment.KPI && !kpiById.has(String(assignment.KPIId))) {
      kpiById.set(String(assignment.KPIId), assignment.KPI);
    }
  });

  const kpiTypes = await KPIType.findAll({
    attributes: ['Id', 'KPIName', 'ParentKPIID'],
    order: [['KPIName', 'ASC']],
  });
  const { buildCode, byId } = buildKpiCodeIndex(kpiTypes);

  const kpiIds = [...kpiById.keys()];
  const results =
    uniqueVisibleUserIds.length && kpiIds.length
      ? await UserKPIResult.findAll({
          where: {
            IsArchived: false,
            CycleYear: cycleYear,
            UserId: { [Op.in]: uniqueVisibleUserIds },
            KPIId: { [Op.in]: kpiIds },
          },
          attributes: ['Id', 'UserId', 'KPIId', 'KPIResult', 'Quarter', 'CreatedAt'],
        })
      : [];

  const visibleRoleIds = new Set([String(currentRoleId)]);
  const userKpiSums = sumUserKpiPerformance(results);
  const aggregation = buildRoleKpiAggregation({
    assignments,
    userRoleByUserId,
    visibleRoleIds,
    userKpiSums,
  });

  const reportRows = assignments.reduce((rows, assignment) => {
    const leafType = assignment.KPI?.KPIType || null;
    // Use a composite key for report rows to prevent squashing different derived versions of the same template KPI
    const rowKey = `${String(assignment.KPIId)}::${(leafType?.KPIName || '').trim()}::${(assignment.Name || '').trim()}::${(assignment.Remark || '').trim()}`;

    if (rows.has(rowKey)) {
      return rows;
    }

    const kpi = assignment.KPI;
    const hierarchy = buildHierarchyNames(leafType, byId);
    const isDerived = !!(assignment.Name || assignment.Remark);

    rows.set(rowKey, {
      id: rowKey,
      kpiId: String(assignment.KPIId),
      assignmentId: assignment.Id,
      no: isDerived ? '' : leafType?.Id ? buildCode(leafType.Id) : '',
      kpi: assignment.Name || leafType?.KPIName || kpi?.Description || '—',
      stableName: isDerived ? '—' : hierarchy.stableName || '—',
      themeName: isDerived ? '—' : hierarchy.themeName || '—',
      subThemeName: isDerived ? '—' : hierarchy.subThemeName || '—',
      unit: kpi?.Unit?.Code || kpi?.Unit?.Name || '—',
      weight: isDerived ? '' : formatNumericValue(kpi?.Weight),
      weightNumeric: isDerived ? 0 : (parseNumericValue(kpi?.Weight) ?? 0),
      baseline: formatNumericValue(assignment.Baseline ?? kpi?.Baseline),
      baselineNumeric: parseNumericValue(assignment.Baseline ?? kpi?.Baseline) ?? 0,
      target: formatNumericValue(assignment.AssignedTarget ?? kpi?.Target),
      remark: assignment.Remark || kpi?.Remark || kpi?.Description || '—',
      values: {},
    });

    return rows;
  }, new Map());

  reportRows.forEach((row) => {
    const metrics = aggregation.get(`${String(currentRoleId)}::${String(row.kpiId)}`);
    if (!metrics) {
      row.values[String(currentRoleId)] = 'N/A';
    } else if (!metrics.hasAnySubmission) {
      row.values[String(currentRoleId)] = '—';
    } else {
      row.values[String(currentRoleId)] = formatNumericValue(metrics.aggregatedPerformance);
    }
    delete row.kpiId;
    delete row.assignmentId;
    delete row.baselineNumeric;
  });

  const flatRows = [...reportRows.values()].sort(
    (left, right) => compareKpiNumbers(left.no, right.no) || String(left.kpi || '').localeCompare(String(right.kpi || ''))
  );

  return {
    year: cycleYear,
    scopeRole: {
      id: currentRole.Id,
      name: currentRole.RoleName,
    },
    parentRole: parentRole
      ? {
          id: parentRole.Id,
          name: parentRole.RoleName,
        }
      : null,
    columns: [
      {
        id: currentRole.Id,
        name: currentRole.RoleName,
      },
    ],
    rows: buildStructuredReportRows({
      kpiRows: flatRows,
      columns: [
        {
          id: currentRole.Id,
          name: currentRole.RoleName,
        },
      ],
    }),
    hasOriginal,
    hasDerived,
    reportType: reportType || 'all',
  };
};

const getCurrentOfficeReport = async (req, res) => {
  try {
    const { year, roleId, reportType } = req.query;
    const cycleYear = year || getCurrentCycleYear();
    const requesterRoleId = String(req.user?.currentRole?.Id || req.user?.roleId || '');

    if (!requesterRoleId) {
      return res.status(400).json({ message: 'Current role is required to build the report.' });
    }

    const requesterRole = await Role.findByPk(requesterRoleId, {
      attributes: ['Id', 'RoleName', 'ParentRoleId'],
    });

    if (!requesterRole) {
      return res.status(404).json({ message: 'Current role not found.' });
    }

    let selectedRoleId = requesterRoleId;
    let availableScopeRoles = [];
    const requestedRoleId = String(roleId || '').trim();

    if (!requesterRole.ParentRoleId) {
      const roles = await Role.findAll({
        where: { IsArchived: false },
        attributes: ['Id', 'RoleName', 'ParentRoleId'],
        order: [['RoleName', 'ASC']],
      });

      const roleById = new Map(roles.map((role) => [String(role.Id), role]));
      const descendantRoleIds = getDescendantRoleIds(roles, requesterRoleId);

      availableScopeRoles = [requesterRole, ...[...descendantRoleIds].map((id) => roleById.get(id)).filter(Boolean)]
        .filter((role, index, items) => items.findIndex((entry) => String(entry.Id) === String(role.Id)) === index)
        .sort((left, right) => String(left.RoleName || '').localeCompare(String(right.RoleName || '')))
        .map((role) => ({
          id: role.Id,
          name: role.RoleName,
        }));

      if (requestedRoleId) {
        if (requestedRoleId !== requesterRoleId && !descendantRoleIds.has(requestedRoleId)) {
          return res.status(403).json({ message: 'Not authorized to view this office report scope.' });
        }

        selectedRoleId = requestedRoleId;
      }
    }

    const selectedRoleHasChildren = await Role.findOne({
      where: {
        IsArchived: false,
        ParentRoleId: selectedRoleId,
      },
      attributes: ['Id'],
    });

    const reportData = selectedRoleHasChildren
      ? await buildAffiliatedOfficeReportDataForScope({
          cycleYear,
          scopeRoleId: selectedRoleId,
          viewerUserId: req.user?.Id,
          reportType: reportType || undefined,
        })
      : await buildCurrentOfficeReportData({
          cycleYear,
          currentRoleId: selectedRoleId,
          reportType: reportType || undefined,
        });

    res.json({
      success: true,
      data: {
        ...reportData,
        availableScopeRoles,
        requestedByRole: {
          id: requesterRole.Id,
          name: requesterRole.RoleName,
        },
      },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    console.error('Get current office report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const submitCurrentOfficeReportToParent = async (req, res) => {
  try {
    const cycleYear = req.body?.year || req.query?.year || getCurrentCycleYear();
    const currentRoleId = String(req.user?.currentRole?.Id || req.user?.roleId || '');
    const reportData = await buildCurrentOfficeReportData({
      cycleYear,
      currentRoleId,
    });

    if (!reportData.parentRole?.id) {
      return res.status(400).json({ message: 'The current office does not have a parent role to submit to.' });
    }

    const summaryRows = reportData.rows
      .filter((row) => String(row.rowType || 'kpi') === 'kpi')
      .map((row) => ({
        id: row.id,
        no: row.no,
        kpi: row.kpi,
        value: row.values?.[String(reportData.scopeRole.id)] || '0',
      }));

    const submission = await OfficeReportSubmission.create({
      CycleYear: cycleYear,
      SourceRoleId: reportData.scopeRole.id,
      ParentRoleId: reportData.parentRole.id,
      ReportPayload: {
        scopeRole: reportData.scopeRole,
        parentRole: reportData.parentRole,
        columns: reportData.columns,
        rows: summaryRows,
      },
      SubmittedBy: req.user?.Id || null,
      SubmittedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      message: `Report submitted to ${reportData.parentRole.name}.`,
      data: {
        submissionId: submission.Id,
        year: cycleYear,
        sourceRole: reportData.scopeRole,
        parentRole: reportData.parentRole,
        submittedAt: submission.SubmittedAt,
        totalRows: summaryRows.length,
      },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    console.error('Submit current office report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const createUserKPIResult = async (req, res) => {
  try {
    const { KPIId, UserKPIId, CycleYear, Quarter, KPIResult, Description, PerformanceTitle } = req.body;

    const cycleYear = CycleYear || getCurrentCycleYear();
    const quarter = normalizeQuarter(Quarter) || getCurrentQuarter();
    const userId = req.user?.Id || req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'User context is required.' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const kpi = await KPI.findByPk(KPIId);
    if (!kpi) {
      return res.status(404).json({ message: 'KPI not found' });
    }

    const evidenceUrl = req.file ? `/uploads/performance-evidence/${req.file.filename}` : null;

    if (kpi.IsEvedenceRequired && !evidenceUrl) {
      return res.status(400).json({ message: 'Evidence file is required for this KPI.' });
    }

    const where = {
      UserId: userId,
      CycleYear: cycleYear,
      Quarter: quarter,
      IsArchived: false,
    };

    if (UserKPIId) {
      where.UserKPIId = UserKPIId;
    } else {
      where.KPIId = KPIId;
    }

    const existingResult = await UserKPIResult.findOne({ where });

    const payload = {
      KPIId,
      UserKPIId: UserKPIId || null,
      CycleYear: cycleYear,
      Quarter: quarter,
      UserId: userId,
      KPIResult,
      Description,
      PerformanceTitle: PerformanceTitle || kpi.Description || null,
      EvidenceURL: evidenceUrl || existingResult?.EvidenceURL || null,
      CreatedBy: req.user?.Id,
    };

    if (existingResult) {
      const updated = await existingResult.update(payload);
      return res.status(200).json({ success: true, data: updated, message: 'KPI result updated successfully.' });
    }

    const result = await UserKPIResult.create(payload);

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Create user KPI result error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getUserKPIResults = async (req, res) => {
  try {
    const { year, quarter } = req.query;
    const where = { IsArchived: false };

    if (year) {
      where.CycleYear = year;
    }

    if (quarter) {
      const normalizedQuarter = normalizeQuarter(quarter);
      if (!normalizedQuarter) {
        return res.status(400).json({ message: `Quarter must be one of ${QUARTERS.join(', ')}` });
      }

      where.Quarter = normalizedQuarter;
    }

    const results = await UserKPIResult.findAll({
      where,
      include: [
        { model: User, attributes: ['Id', 'FirstName', 'UserName', 'Email'] },
        { model: KPI, attributes: ['Id', 'Target', 'Description'] },
      ],
      order: [['CreatedAt', 'DESC']],
    });

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Get user KPI results error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getAnnualUserKPIReport = async (req, res) => {
  try {
    const { year } = req.query;
    const cycleYear = year || getCurrentCycleYear();

    const results = await UserKPIResult.findAll({
      where: {
        IsArchived: false,
        CycleYear: cycleYear,
      },
      include: [
        { model: User, attributes: ['Id', 'FirstName', 'UserName', 'Email'] },
        { model: KPI, attributes: ['Id', 'Target', 'Description'] },
      ],
      order: [['CreatedAt', 'ASC']],
    });

    const report = buildAnnualSummary(results);

    res.json({
      success: true,
      data: {
        year: cycleYear,
        totalResults: results.length,
        report,
      },
    });
  } catch (error) {
    console.error('Get annual KPI report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getUserKPIResultById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await UserKPIResult.findByPk(id, {
      include: [
        { model: User, attributes: ['Id', 'FirstName', 'UserName', 'Email'] },
        { model: KPI, attributes: ['Id', 'Target', 'Description'] },
      ],
    });

    if (!result) {
      return res.status(404).json({ message: 'User KPI result not found' });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get user KPI result error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateUserKPIResult = async (req, res) => {
  try {
    const { id } = req.params;
    const { KPIId, UserId, KPIResult, Description, Quarter, CycleYear, PerformanceTitle } = req.body;

    const result = await UserKPIResult.findByPk(id);
    if (!result) {
      return res.status(404).json({ message: 'User KPI result not found' });
    }

    if (KPIId) {
      const kpi = await KPI.findByPk(KPIId);
      if (!kpi) {
        return res.status(404).json({ message: 'KPI not found' });
      }
    }

    if (UserId) {
      const user = await User.findByPk(UserId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
    }

    const evidenceUrl = req.file ? `/uploads/performance-evidence/${req.file.filename}` : undefined;

    await result.update({
      KPIId,
      UserId,
      KPIResult,
      Description,
      Quarter: Quarter ? normalizeQuarter(Quarter) || result.Quarter : result.Quarter,
      CycleYear: CycleYear || result.CycleYear,
      PerformanceTitle: PerformanceTitle !== undefined ? PerformanceTitle : result.PerformanceTitle,
      EvidenceURL: evidenceUrl !== undefined ? evidenceUrl : result.EvidenceURL,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Update user KPI result error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteUserKPIResult = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await UserKPIResult.findByPk(id);

    if (!result) {
      return res.status(404).json({ message: 'User KPI result not found' });
    }

    await result.update({ IsArchived: true });

    res.json({ success: true, message: 'User KPI result archived successfully' });
  } catch (error) {
    console.error('Delete user KPI result error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createUserKPIResult,
  getUserKPIResults,
  getAnnualUserKPIReport,
  getAffiliatedOfficeReport,
  getCurrentOfficeReport,
  submitCurrentOfficeReportToParent,
  getRoleKpiReport: getAffiliatedOfficeReport,
  getUserKPIResultById,
  updateUserKPIResult,
  deleteUserKPIResult,
};
