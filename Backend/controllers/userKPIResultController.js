const { UserKPIResult, User, KPI, KPIType, Unit, Role, UserRole, UserKPI, OfficeReportSubmission, KPIYearPlan } = require('../models');
const { logActivity } = require('../utils/auditLogger');
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
    const numeric = parseNumericValue(result.AdjustedResult ?? result.KPIResult);
    const quarter = normalizeQuarter(result.Quarter);

    if (numeric === null || !quarter) {
      return;
    }

    const assignmentKey = result.UserKPIId ? String(result.UserKPIId) : null;
    const userKpiKey = `${String(result.UserId || '')}::${String(result.KPIId || '')}`;

    if (assignmentKey) {
      if (!groupedResults.has(assignmentKey)) groupedResults.set(assignmentKey, []);
      groupedResults
        .get(assignmentKey)
        .push({ quarter, numeric, status: result.Status || 'pending', createdAt: result.CreatedAt ? new Date(result.CreatedAt) : null });
    }

    if (!groupedResults.has(userKpiKey)) groupedResults.set(userKpiKey, []);
    groupedResults
      .get(userKpiKey)
      .push({ quarter, numeric, status: result.Status || 'pending', createdAt: result.CreatedAt ? new Date(result.CreatedAt) : null });
  });

  const resultDetails = new Map();

  groupedResults.forEach((items, key) => {
    const latestByQuarter = new Map();
    items.forEach((item) => {
      // Normalize quarter name: e.g., "Quarter 1" -> "Q1"
      let q = String(item.quarter || '').toUpperCase();
      if (q.includes('1')) q = 'Q1';
      else if (q.includes('2')) q = 'Q2';
      else if (q.includes('3')) q = 'Q3';
      else if (q.includes('4')) q = 'Q4';

      const existing = latestByQuarter.get(q);
      const isApproved = String(item.status || '').toLowerCase() === 'approved';
      const existingIsApproved = existing ? String(existing.status || '').toLowerCase() === 'approved' : false;

      if (!existing || (isApproved && !existingIsApproved) || (isApproved === existingIsApproved && item.createdAt > existing.createdAt)) {
        latestByQuarter.set(q, { ...item, normalizedQuarter: q });
      }
    });

    const sortedQuarters = Array.from(latestByQuarter.values()).sort(
      (a, b) => QUARTERS.indexOf(a.normalizedQuarter) - QUARTERS.indexOf(b.normalizedQuarter)
    );

    if (key.includes('3f9585e1') || key.includes('c635ff93')) {
      console.log(`[SUM_TRACE] Key: ${key}, Found Items: ${items.length}, Grouped Quarters: ${latestByQuarter.size}`);
      items.forEach((it) => console.log(`  - Item: Q=${it.quarter}, Val=${it.numeric}, Status=${it.status}`));
    }

    let cumulativeTotal = 0;
    let isAllApproved = true;

    sortedQuarters.forEach((quarterItem) => {
      const status = String(quarterItem.status || 'pending').toLowerCase();
      if (status === 'pending' || status === 'submitted' || status === 'review') {
        isAllApproved = false;
      }
      // Simple incremental sum: Treat each quarter as a new addition to the total
      cumulativeTotal += Number.isFinite(quarterItem.numeric) ? quarterItem.numeric : 0;
    });

    if (key.includes('3f9585e1') || key.includes('c635ff93') || key.includes('15ded5f3')) {
      console.log(`[DEEP_STATUS_TRACE] Key: ${key}, Total: ${cumulativeTotal}, AllApproved: ${isAllApproved}, Quarters: ${sortedQuarters.length}`);
      sortedQuarters.forEach((q) => {
        console.log(`  -> Quarter: ${q.normalizedQuarter}, Value: ${q.numeric}, Status: ${q.status}`);
      });
    }

    resultDetails.set(key, {
      performance: cumulativeTotal,
      isApproved: isAllApproved && sortedQuarters.length > 0,
      hasPending: !isAllApproved,
    });
  });

  return resultDetails;
};

const buildRoleKpiAggregation = ({ assignments, userRoleByUserId, visibleRoleIds, userKpiSums, scopeRoleId }) => {
  const groupedAssignments = new Map();

  assignments.forEach((assignment) => {
    const userId = String(assignment.UserId || '');
    const roleId = String(userRoleByUserId.get(userId) || '');
    if (!userId || !roleId || !visibleRoleIds.has(roleId)) {
      return;
    }

    // "Only if the KPI is assigned to the current role by itself"
    // If we are looking at the parent/scope role's column, we only count it if they opted in
    if (scopeRoleId && roleId === String(scopeRoleId) && assignment.IncludeCurrentOffice !== true) {
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
        isEvidenceRequired: !!(assignment.KPI?.IsEvedenceRequired || assignment.KPI?.IsEvidenceRequired || assignment.KPI?.isEvidenceRequired),
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
      const assignmentKey = specificAssignment ? String(specificAssignment.Id) : null;
      const userKpiKey = `${String(userId)}::${kpiId}`;

      const userMetrics = (assignmentKey ? userKpiSums.get(assignmentKey) : null) || userKpiSums.get(userKpiKey);
      if (userMetrics) {
        hasAnySubmission = true;
      }

      return userMetrics || { performance: 0, isApproved: false };
    });

    const cumulativeTotal = cumulativeValues.reduce((sum, v) => {
      const isApproved = v.isApproved;
      const isEvidenceReq = grouped.isEvidenceRequired;

      if (!isEvidenceReq || isApproved) {
        return sum + v.performance;
      }
      return sum;
    }, 0);
    const allApproved = cumulativeValues.length > 0 && cumulativeValues.every((v) => v.isApproved);
    const receiverCount = cumulativeValues.length;
    const aggregatedPerformance = grouped.isTargetIndividual ? (receiverCount > 0 ? cumulativeTotal / receiverCount : 0) : cumulativeTotal;

    aggregation.set(key, {
      isTargetIndividual: grouped.isTargetIndividual,
      receiverCount,
      aggregatedPerformance,
      hasAnySubmission,
      isApproved: allApproved,
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

const buildAffiliatedOfficeReportDataForScope = async ({
  cycleYear,
  scopeRoleId,
  viewerUserId,
  viewerRoleId,
  reportType,
  reportMode = 'individual',
}) => {
  const roles = await Role.findAll({
    where: { IsArchived: false },
    attributes: ['Id', 'RoleName', 'ParentRoleId', 'IsDistributable', 'HasExtraMeasures'],
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

  const visibleRoleIds = new Set([String(selectedScopeRole.Id), ...roleToChildColumn.keys()]);

  const activeUserRoles = await UserRole.findAll({
    where: {
      IsArchived: false,
      RoleId: { [Op.in]: Array.from(visibleRoleIds) },
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
      attributes: ['Id', 'KPITypeId', 'UnitId', 'Weight', 'Description', 'Remark', 'IsEvedenceRequired'],
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
    {
      model: require('../models').KPIYearPlan,
      attributes: ['Id', 'Baseline', 'Target'],
      required: false,
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

  const allAssignments = [];
  const seenAssignmentKeys = new Set();

  [...officialParentAssignments, ...childAssignments].forEach((assignment) => {
    const leafType = assignment.KPI?.KPIType || null;
    const assignmentKey = `${String(assignment.KPIId)}::${(leafType?.KPIName || '').trim()}::${(assignment.Name || '').trim()}::${(assignment.Remark || '').trim()}`;
    if (seenAssignmentKeys.has(assignmentKey)) {
      return;
    }

    seenAssignmentKeys.add(assignmentKey);
    allAssignments.push(assignment);
  });

  const isTopLevelFallback = officialParentAssignments.length === 0;

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

  // 4. Check for official report submissions (to handle the "Submit Report" gate)
  const [childSubmissions, ownSubmissions] = await Promise.all([
    OfficeReportSubmission.findAll({
      where: { CycleYear: cycleYear, ParentRoleId: scopeRoleId, IsArchived: false },
      attributes: ['SourceRoleId', 'ParentRoleId', 'ReportPayload', 'SubmittedAt'],
      order: [['SubmittedAt', 'DESC']],
    }),
    OfficeReportSubmission.findAll({
      where: { CycleYear: cycleYear, SourceRoleId: scopeRoleId, IsArchived: false },
      attributes: ['SourceRoleId', 'ParentRoleId', 'SubmittedAt'],
      order: [['SubmittedAt', 'DESC']],
    }),
  ]);

  const submittedRoleIds = new Set(childSubmissions.map((s) => String(s.SourceRoleId)));
  const parentHasSubmitted = ownSubmissions.length > 0;

  const relevantAssignmentIds = assignments.map((a) => a.Id).filter(Boolean);
  const kpiIds = [...new Set(assignments.map((a) => String(a.KPIId)).filter(Boolean))];

  const results =
    uniqueVisibleUserIds.length && kpiIds.length
      ? await UserKPIResult.findAll({
          where: {
            IsArchived: false,
            CycleYear: { [Op.like]: `%${cycleYear.substring(0, 4)}%` },
            UserId: { [Op.in]: uniqueVisibleUserIds },
            KPIId: { [Op.in]: kpiIds },
          },
          attributes: ['Id', 'UserId', 'KPIId', 'UserKPIId', 'KPIResult', 'AdjustedResult', 'Status', 'Quarter', 'CreatedAt'],
        })
      : [];

  // Determine columns based on hierarchy
  let reportColumns = [];
  if (reportMode === 'combined') {
    reportColumns.push({
      id: 'combined',
      name: `${selectedScopeRole.RoleName} (Combined)`,
      isUserColumn: false,
      isCombined: true,
    });
  } else {
    reportColumns.push({
      id: selectedScopeRole.Id,
      name: `${selectedScopeRole.RoleName} (Current Office)`,
      isUserColumn: false,
      isSubmitted: true, // Parent office report view is "current"
    });

    childRoles.forEach((role) => {
      const roleId = String(role.Id);
      const isSubmitted = submittedRoleIds.has(roleId);

      if (role.IsDistributable === true) {
        reportColumns.push({
          id: role.Id,
          name: role.RoleName,
          isUserColumn: false,
          isSubmitted,
        });
      } else {
        const usersInRole = activeUserRoles.filter((ur) => String(ur.RoleId || ur.Role?.Id) === roleId);

        if (usersInRole.length > 0) {
          const uniqueUsers = usersInRole.filter(
            (ur, index, self) => self.findIndex((entry) => String(entry.UserId) === String(ur.UserId)) === index
          );

          uniqueUsers.forEach((ur) => {
            reportColumns.push({
              id: ur.User.Id,
              name: `${ur.User.FirstName} ${ur.User.FatherName || ''}`.trim(),
              isUserColumn: true,
              roleId: ur.RoleId,
              isSubmitted,
            });
          });
        } else {
          reportColumns.push({
            id: role.Id,
            name: role.RoleName,
            isUserColumn: false,
            isSubmitted,
          });
        }
      }
    });
  }

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

  const resultsWithAssignmentIds = results
    .filter((r) => {
      // Find the specific assignment for this result to know which role it belongs to
      const assignment = assignments.find((a) => String(a.Id) === String(r.UserKPIId));
      if (!assignment) return false;

      // UserKPI has UserId, not RoleId — look up the role from the user-role map
      const roleId = userRoleByUserId.get(String(assignment.UserId));
      if (!roleId) return false;

      // Always show own data to the viewer (current office column)
      if (viewerRoleId && String(roleId) === String(viewerRoleId)) return true;

      // For child columns, strictly only show if that child role has submitted their office report
      const targetColumnId = roleToChildColumn.get(String(roleId));
      if (!targetColumnId) return false;

      const isSubmitted = submittedRoleIds.has(String(targetColumnId));
      return isSubmitted;
    })
    .map((r) => {
      const raw = r.toJSON ? r.toJSON() : r;
      return {
        ...raw,
        UserKPIId: raw.UserKPIId || null,
      };
    });

  const userChildColumnByUserId = new Map();
  userRoleByUserId.forEach((roleId, userId) => {
    if (!visibleRoleIds.has(String(roleId))) {
      return;
    }

    const columnRoleId = String(roleId) === String(selectedScopeRole.Id) ? String(selectedScopeRole.Id) : roleToChildColumn.get(String(roleId));
    if (columnRoleId) {
      userChildColumnByUserId.set(userId, columnRoleId);
    }
  });

  const aggregation = buildRoleKpiAggregation({
    assignments: [...officialParentAssignments, ...childAssignments],
    userRoleByUserId: userChildColumnByUserId,
    visibleRoleIds: new Set([String(selectedScopeRole.Id), ...childRoles.map((role) => String(role.Id))]),
    userKpiSums: sumUserKpiPerformance(resultsWithAssignmentIds),
    scopeRoleId: selectedScopeRole.Id,
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
      baseline: formatNumericValue(
        isTopLevelFallback ? (assignment.KPIYearPlan?.Baseline ?? assignment.Baseline) : (assignment.Baseline ?? assignment.KPIYearPlan?.Baseline)
      ),
      baselineNumeric:
        parseNumericValue(
          isTopLevelFallback ? (assignment.KPIYearPlan?.Baseline ?? assignment.Baseline) : (assignment.Baseline ?? assignment.KPIYearPlan?.Baseline)
        ) ?? 0,
      target: formatNumericValue(
        isTopLevelFallback
          ? (assignment.KPIYearPlan?.Target ?? assignment.AssignedTarget)
          : (assignment.AssignedTarget ?? assignment.KPIYearPlan?.Target)
      ),
      remark:
        (String(assignment.Remark || '')
          .trim()
          .toLowerCase() === 'null'
          ? ''
          : assignment.Remark) || (isDerived ? '—' : kpi?.Remark || kpi?.Description || '—'),
      isEvidenceRequired: !!(kpi?.isEvidenceRequired || kpi?.IsEvidenceRequired || kpi?.IsEvedenceRequired),
      values: {},
    });

    return rows;
  }, new Map());

  const userKpiSums = sumUserKpiPerformance(resultsWithAssignmentIds);

  // First pass: populate values from live aggregation (works for the scope role's own data)
  reportRows.forEach((row) => {
    reportColumns.forEach((column) => {
      if (column.isCombined) {
        // Combined mode values will be recalculated after overlay
        row.values[String(column.id)] = '—';
      } else if (column.isUserColumn) {
        const userKey = `${String(column.id)}::${String(row.id)}`;
        const assignmentId = userAssignmentMap.get(userKey);
        const details = assignmentId ? userKpiSums.get(assignmentId) : undefined;

        if (column.isCurrentOffice) {
          // For the parent's own column, use the aggregated total from all children
          const metrics = aggregation.get(`${String(column.id)}::${String(row.kpiId)}`);
          row.values[String(column.id)] = metrics && metrics.hasAnySubmission ? formatNumericValue(metrics.aggregatedPerformance) : '—';
        } else if (details === undefined) {
          row.values[String(column.id)] = '—';
        } else {
          // Check both User and Role column logic for pending status
          const isPending = row.isEvidenceRequired && !details.isApproved;
          row.values[String(column.id)] = {
            value: isPending ? '—' : formatNumericValue(details.performance),
            isApproved: details.isApproved,
          };

          if (column.name && column.name.includes('Engineering')) {
            console.log(`[USER_COL_TRACE] KPI: ${row.kpi}, Value: ${row.values[String(column.id)].value}, Approved: ${details.isApproved}`);
          }
        }
      } else {
        // For child role columns, check live aggregation first
        const metrics = aggregation.get(`${String(column.id)}::${String(row.kpiId)}`);
        if (!metrics) {
          row.values[String(column.id)] = 'N/A';
        } else if (!metrics.hasAnySubmission) {
          row.values[String(column.id)] = '—';
        } else {
          const isPending = row.isEvidenceRequired && !metrics.isApproved;

          row.values[String(column.id)] = {
            value: isPending ? '—' : formatNumericValue(metrics.aggregatedPerformance),
            isApproved: metrics.isApproved,
          };

          if (column.name && column.name.includes('Engineering')) {
            console.log(`[ROLE_COL_TRACE] KPI: ${row.kpi}, Value: ${row.values[String(column.id)].value}, Approved: ${metrics.isApproved}`);
          }
        }
      }
    });
  });

  // Second pass: Overlay submitted payload values for child columns
  if (childSubmissions.length > 0) {
    // Group by SourceRoleId and keep only the latest submission per child
    const latestByChild = new Map();
    childSubmissions.forEach((sub) => {
      const srcId = String(sub.SourceRoleId);
      if (!latestByChild.has(srcId)) {
        latestByChild.set(srcId, sub);
      }
    });

    // For each submitted child, overlay their payload values onto the report rows
    latestByChild.forEach((submission, childRoleId) => {
      const payload = submission.ReportPayload;
      const childColumnIds = reportColumns
        .filter((column) => String(column.id) === String(childRoleId) || String(column.roleId || '') === String(childRoleId))
        .map((column) => String(column.id));

      // Build lookups using both KPI identifiers and display names.
      const submittedValuesByKpi = new Map();
      if (payload && payload.rows && Array.isArray(payload.rows)) {
        payload.rows.forEach((payloadRow) => {
          if (payloadRow.value === undefined) {
            return;
          }

          const lookupKeys = [payloadRow.kpiId, payloadRow.assignmentId, payloadRow.no, payloadRow.kpi, payloadRow.label]
            .filter((value) => value !== null && value !== undefined && String(value).trim() !== '')
            .map((value) => String(value).trim());

          lookupKeys.forEach((key) => {
            if (!submittedValuesByKpi.has(key)) {
              submittedValuesByKpi.set(key, payloadRow.value);
            }
          });
        });
      }

      // Match against report rows and overlay
      reportRows.forEach((row) => {
        const lookupKeys = [row.kpiId, row.assignmentId, row.no, row.kpi]
          .filter((value) => value !== null && value !== undefined && String(value).trim() !== '')
          .map((value) => String(value).trim());

        const matchedValue = lookupKeys.find((key) => submittedValuesByKpi.has(key));
        if (matchedValue) {
          const submittedValue = submittedValuesByKpi.get(matchedValue);
          console.log(`[OVERLAY_MATCH] Child: ${childRoleId}, KPI: ${row.kpi}, Matched Key: ${matchedValue}, Value: ${submittedValue}`);
          childColumnIds.forEach((childColId) => {
            // Preserve object structure if the initial value was an object, otherwise just store the value
            if (typeof row.values[childColId] === 'object' && row.values[childColId] !== null && !Array.isArray(row.values[childColId])) {
              row.values[childColId].value = submittedValue;
              // Non-evidence KPIs should display immediately in the parent report.
              // Evidence-required KPIs stay pending until the parent approves them.
              row.values[childColId].isApproved = !row.isEvidenceRequired;
            } else {
              row.values[childColId] = row.isEvidenceRequired ? { value: submittedValue, isApproved: false } : submittedValue;
            }
          });
        } else {
          console.log(
            `[OVERLAY_NOMATCH] Child: ${childRoleId}, KPI: ${row.kpi}, Available Keys: ${Array.from(submittedValuesByKpi.keys()).join('|')}, Row Keys: ${lookupKeys.join('|')}`
          );
          // Keep the live aggregation for non-evidence KPIs so they remain visible even if the
          // submitted payload key does not match perfectly. Evidence-required KPIs still show pending.
          childColumnIds.forEach((childColId) => {
            if (row.isEvidenceRequired) {
              if (typeof row.values[childColId] === 'object' && row.values[childColId] !== null && !Array.isArray(row.values[childColId])) {
                row.values[childColId].value = '—';
                row.values[childColId].isApproved = false;
              } else {
                row.values[childColId] = { value: '—', isApproved: false };
              }
            }
          });
        }
      });
    });

    // Recalculate combined column if present
    if (reportMode === 'combined') {
      reportRows.forEach((row) => {
        const combinedCol = reportColumns.find((c) => c.isCombined);
        if (!combinedCol) return;

        let total = 0;
        let count = 0;

        // Sum values from all child columns and scope role
        childRoles.forEach((child) => {
          const val = row.values[String(child.Id)];
          const num = parseFloat(val);
          if (!isNaN(num) && val !== 'N/A' && val !== '—' && val !== '-') {
            total += num;
            count += 1;
          }
        });

        // Also include the scope role's own value if it has one
        const scopeVal = row.values[String(selectedScopeRole.Id)];
        const scopeNum = parseFloat(scopeVal);
        if (!isNaN(scopeNum) && scopeVal !== 'N/A' && scopeVal !== '—' && scopeVal !== '-') {
          total += scopeNum;
          count += 1;
        }

        row.values[String(combinedCol.id)] = count > 0 ? formatNumericValue(total / count) : '—';
      });
    }
  }

  // Cleanup internal IDs before sending to frontend
  reportRows.forEach((row) => {
    delete row.kpiId;
    delete row.assignmentId;
    delete row.baselineNumeric;
  });

  const flatRows = [...reportRows.values()].sort(
    (left, right) => compareKpiNumbers(left.no, right.no) || String(left.kpi || '').localeCompare(String(right.kpi || ''))
  );

  const parentScopeRole = selectedScopeRole.ParentRoleId ? roleById.get(String(selectedScopeRole.ParentRoleId)) || null : null;

  console.log('[GLOBAL_REPORT_TRACE] Sample Rows:', JSON.stringify(flatRows.slice(0, 5), null, 2));

  return {
    year: cycleYear,
    scopeRole: {
      id: selectedScopeRole.Id,
      name: selectedScopeRole.RoleName,
    },
    parentRole: parentScopeRole ? { id: parentScopeRole.Id, name: parentScopeRole.RoleName } : null,
    columns: reportColumns,
    rows: buildStructuredReportRows({
      kpiRows: flatRows,
      columns: reportColumns,
    }),
    hasOriginal,
    hasDerived,
    reportType: reportType || 'all',
    reportMode: reportMode || 'individual',
    scopeRoleHasExtraMeasures: !!selectedScopeRole.HasExtraMeasures,
    scopeRoleIsDistributable: !!selectedScopeRole.IsDistributable,
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
      attributes: ['Id', 'RoleName', 'ParentRoleId', 'IsDistributable', 'HasExtraMeasures'],
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
          reportMode: req.query.reportMode || 'individual',
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
    attributes: ['Id', 'RoleName', 'ParentRoleId', 'IsDistributable', 'HasExtraMeasures'],
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
            attributes: ['Id', 'KPITypeId', 'UnitId', 'Weight', 'Description', 'Remark', 'IsEvedenceRequired'],
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
          {
            model: require('../models').KPIYearPlan,
            attributes: ['Id', 'Baseline', 'Target'],
            required: false,
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

  const relevantAssignmentIds = assignments.map((a) => a.Id).filter(Boolean);

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
    uniqueVisibleUserIds.length && relevantAssignmentIds.length
      ? await UserKPIResult.findAll({
          where: {
            IsArchived: false,
            CycleYear: cycleYear,
            UserKPIId: { [Op.in]: relevantAssignmentIds },
          },
          attributes: ['Id', 'UserId', 'KPIId', 'UserKPIId', 'KPIResult', 'AdjustedResult', 'Status', 'Quarter', 'CreatedAt'],
        })
      : [];

  const visibleRoleIds = new Set([String(currentRoleId)]);
  const userKpiSums = sumUserKpiPerformance(results);
  const aggregation = buildRoleKpiAggregation({
    assignments,
    userRoleByUserId,
    visibleRoleIds,
    userKpiSums,
    scopeRoleId: currentRoleId,
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
      baseline: formatNumericValue(assignment.Baseline ?? assignment.KPIYearPlan?.Baseline),
      baselineNumeric: parseNumericValue(assignment.Baseline ?? assignment.KPIYearPlan?.Baseline) ?? 0,
      target: formatNumericValue(assignment.AssignedTarget ?? assignment.KPIYearPlan?.Target),
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
      row.values[String(currentRoleId)] = {
        value: formatNumericValue(metrics.aggregatedPerformance),
        isApproved: metrics.isApproved,
      };
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
    scopeRoleHasExtraMeasures: !!currentRole.HasExtraMeasures,
    scopeRoleIsDistributable: !!currentRole.IsDistributable,
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
          viewerRoleId: requesterRole.Id,
          reportType: reportType || undefined,
          reportMode: req.query.reportMode || 'individual',
        })
      : await buildCurrentOfficeReportData({
          cycleYear,
          currentRoleId: selectedRoleId,
          reportType: reportType || undefined,
        });

    // Ensure parentRole is always present in response
    if (!reportData.parentRole && requesterRole.ParentRoleId) {
      const parentRole = await Role.findByPk(requesterRole.ParentRoleId, {
        attributes: ['Id', 'RoleName'],
      });
      if (parentRole) {
        reportData.parentRole = { id: parentRole.Id, name: parentRole.RoleName };
      }
    }

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
    const currentRole = await Role.findByPk(currentRoleId, {
      attributes: ['Id', 'RoleName', 'ParentRoleId'],
    });

    if (!currentRole) {
      return res.status(404).json({ message: 'Current role not found.' });
    }

    const parentRole = currentRole.ParentRoleId
      ? await Role.findByPk(currentRole.ParentRoleId, {
          attributes: ['Id', 'RoleName'],
        })
      : null;

    if (!parentRole) {
      return res.status(400).json({ message: 'The current office does not have a parent role to submit to.' });
    }

    const childRoles = await Role.findAll({
      where: { ParentRoleId: currentRoleId, IsArchived: false },
      attributes: ['Id', 'RoleName'],
    });

    const hasChildren = childRoles.length > 0;

    const reportData = hasChildren
      ? await buildAffiliatedOfficeReportDataForScope({
          cycleYear,
          scopeRoleId: currentRoleId,
          viewerUserId: req.user?.Id,
          viewerRoleId: currentRoleId,
          reportMode: 'combined',
        })
      : await buildCurrentOfficeReportData({
          cycleYear,
          currentRoleId,
        });

    // Ensure parentRole is in reportData for the rest of the logic
    reportData.parentRole = {
      id: parentRole.Id,
      name: parentRole.RoleName,
    };

    // Dependency Validation: Parent cannot submit until all children have submitted
    if (childRoles.length > 0) {
      const submissions = await OfficeReportSubmission.findAll({
        where: {
          CycleYear: cycleYear,
          ParentRoleId: currentRoleId,
          IsArchived: false,
        },
        attributes: ['SourceRoleId'],
      });

      const reportKpiIds = [...new Set(reportData.rows.filter((r) => String(r.rowType || 'kpi') === 'kpi' && r.kpiId).map((r) => String(r.kpiId)))];

      const submittedRoleIds = new Set(submissions.map((s) => String(s.SourceRoleId)));
      const potentialMissingRoles = childRoles.filter((role) => !submittedRoleIds.has(String(role.Id)));

      let missingRoles = [];
      if (potentialMissingRoles.length > 0 && reportKpiIds.length > 0) {
        // Only block if the missing role actually has KPIs assigned to it that are part of this report
        for (const role of potentialMissingRoles) {
          const roleId = String(role.Id);

          const userRoles = await UserRole.findAll({
            where: { RoleId: roleId, IsArchived: false },
            attributes: ['UserId'],
          });
          const userIds = userRoles.map((ur) => ur.UserId);

          if (userIds.length > 0) {
            const assignmentCount = await UserKPI.count({
              where: {
                CycleYear: cycleYear,
                IsArchived: false,
                UserId: { [Op.in]: userIds },
                KPIId: { [Op.in]: reportKpiIds },
              },
            });

            if (assignmentCount > 0) {
              missingRoles.push(role);
            }
          }
        }
      }

      if (missingRoles.length > 0) {
        const missingNames = missingRoles.map((r) => r.RoleName).join(', ');
        return res.status(400).json({
          message: `Submission blocked. The following child units have not submitted their reports yet: ${missingNames}`,
          missingRoles: missingRoles.map((r) => ({ id: r.Id, name: r.RoleName })),
        });
      }
    }

    const summaryRows = reportData.rows
      .filter((row) => String(row.rowType || 'kpi') === 'kpi')
      .map((row) => {
        // In combined mode, the value is in the 'combined' column.
        // In individual mode (current office only), the value is in the office's own ID column.
        const columnId = hasChildren ? 'combined' : String(reportData.scopeRole.id);
        const cellValue = row.values?.[columnId];
        const finalRow = {
          id: row.id,
          assignmentId: row.assignmentId || null,
          kpiId: row.kpiId || null,
          no: row.no,
          kpi: row.kpi,
          value: cellValue && typeof cellValue === 'object' ? cellValue.value : cellValue || '0',
          isEvidenceRequired: Boolean(row.isEvidenceRequired),
        };
        console.log(`[SUBMIT_PAYLOAD] Role: ${reportData.scopeRole.id}, KPI: ${row.kpi}, KPIId: ${row.kpiId}, Value: ${finalRow.value}`);
        return finalRow;
      });

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

    await logActivity({
      userId: req.user.Id,
      action: 'SUBMIT_OFFICE_REPORT',
      resource: 'OfficeReportSubmission',
      description: `Submitted office report for ${reportData.scopeRole.name} to ${reportData.parentRole.name} (${cycleYear})`,
      ipAddress: req.ip
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
      Status: kpi.IsEvedenceRequired ? 'pending' : 'approved',
    };

    if (existingResult) {
      const updated = await existingResult.update(payload);
      return res.status(200).json({ success: true, data: updated, message: 'KPI result updated successfully.' });
    }

    const result = await UserKPIResult.create(payload);

    await logActivity({
      userId: userId,
      action: 'KPI_REPORTING',
      resource: 'UserKPIResult',
      description: `Reported KPI performance: ${PerformanceTitle || kpi.Description}`,
      ipAddress: req.ip
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Create user KPI result error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getKPIApprovals = async (req, res) => {
  try {
    const userRoleId = req.user?.currentRole?.Id;

    if (!userRoleId) {
      return res.status(403).json({ message: 'User role context not found.' });
    }

    const allRoles = await Role.findAll({ where: { IsArchived: false } });
    const childRoleIds = [];
    const queue = [userRoleId];

    while (queue.length) {
      const parentId = queue.shift();
      const children = allRoles.filter((r) => String(r.ParentRoleId) === String(parentId));
      children.forEach((c) => {
        childRoleIds.push(c.Id);
        queue.push(c.Id);
      });
    }

    if (!childRoleIds.length) {
      return res.json({ success: true, data: [] });
    }

    const childUserRoles = await UserRole.findAll({
      where: {
        RoleId: { [Op.in]: childRoleIds },
        IsArchived: false,
        [Op.or]: [{ ToDate: null }, { ToDate: { [Op.gte]: new Date() } }],
      },
      attributes: ['UserId', 'RoleId'],
      include: [{ model: Role, attributes: ['RoleName'] }],
    });

    const userToRoleName = new Map();
    childUserRoles.forEach((ur) => {
      userToRoleName.set(String(ur.UserId), ur.Role?.RoleName || 'Unknown Unit');
    });

    const childUserIds = Array.from(userToRoleName.keys());

    if (!childUserIds.length) {
      return res.json({ success: true, data: [] });
    }

    // 2. Fetch official submissions to identify which offices have actually submitted their reports
    const officialSubmissions = await require('../models').OfficeReportSubmission.findAll({
      where: {
        ParentRoleId: userRoleId,
        IsArchived: false,
      },
    });
    const submittedSourceRoleIds = new Set(officialSubmissions.map((s) => String(s.SourceRoleId)));

    // Map child users to their role IDs for submission filtering
    const userToRoleMap = new Map();
    childUserRoles.forEach((ur) => {
      userToRoleMap.set(String(ur.UserId), String(ur.RoleId));
    });

    const results = await UserKPIResult.findAll({
      where: {
        UserId: { [Op.in]: childUserIds },
        IsArchived: false,
        Status: { [Op.in]: ['pending', 'adjusted', 'approved'] },
      },
      include: [
        { model: User, attributes: ['FirstName', 'FatherName', 'GrandFatherName'] },
        {
          model: KPI,
          required: true,
          where: { IsEvedenceRequired: true },
          include: [{ model: KPIType }, { model: Unit }, { model: KPIYearPlan }],
        },
        {
          model: UserKPI,
          as: 'Assignment',
          include: [{ model: KPIYearPlan }],
        },
      ],
      order: [['CreatedAt', 'DESC']],
    });

    // 3. Filter results: only show those whose office has submitted
    const filteredResults = results.filter((r) => {
      const roleId = userToRoleMap.get(String(r.UserId));
      return roleId && submittedSourceRoleIds.has(roleId);
    });

    const kpiTypes = await KPIType.findAll({ where: { IsArchived: false } });
    const typeById = new Map(kpiTypes.map((t) => [String(t.Id), t]));

    const mappedResults = filteredResults.map((r) => {
      const leafType = r.KPI?.KPIType;
      const lineage = leafType ? getTypeLineage(leafType.Id, typeById) : [];
      const category = lineage
        .slice(0, -1)
        .map((t) => t.KPIName)
        .join(' · ');

      const assignment = r.Assignment;
      const kpiRecord = r.KPI;

      const baseline = assignment?.Baseline ?? kpiRecord?.KPIYearPlans?.[0]?.Baseline ?? kpiRecord?.DefaultBaseline ?? 0;
      const target = assignment?.AssignedTarget ?? kpiRecord?.KPIYearPlans?.[0]?.Target ?? kpiRecord?.Target ?? 0;

      return {
        id: r.Id,
        category: category || 'General',
        title: r.PerformanceTitle || kpiRecord?.Description || leafType?.KPIName || 'Untitled KPI',
        submitter: `${r.User?.FirstName} ${r.User?.FatherName || ''}`.trim(),
        unit: userToRoleName.get(String(r.UserId)) || 'Unknown Unit',
        period: r.Quarter ? `${r.Quarter} ${r.CycleYear}` : r.CycleYear,
        submittedAt: new Date(r.CreatedAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        baseline,
        target,
        reported: parseNumericValue(r.KPIResult),
        adjustedReported: parseNumericValue(r.AdjustedResult),
        status: r.Status,
        cycleYear: r.CycleYear,
        note: r.Description || 'No description provided.',
        evidence: r.EvidenceURL
          ? [
              {
                name: r.EvidenceURL.split('/').pop(),
                size: 'Unknown',
                url: r.EvidenceURL,
              },
            ]
          : [],
        evidenceRequired: !!kpiRecord?.IsEvedenceRequired,
      };
    });

    res.json({ success: true, data: mappedResults });
  } catch (error) {
    console.error('Get KPI approvals error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const approveKPIResult = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await UserKPIResult.findByPk(id);

    if (!result) {
      return res.status(404).json({ message: 'KPI result not found.' });
    }

    await result.update({ Status: 'approved', AdjustedResult: null });

    await logActivity({
      userId: req.user.Id,
      action: 'APPROVE_KPI',
      resource: 'UserKPIResult',
      description: `Approved KPI result for user ID: ${result.UserId}`,
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'KPI result approved successfully.' });
  } catch (error) {
    console.error('Approve KPI result error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const adjustKPIResult = async (req, res) => {
  try {
    const { id } = req.params;
    const { adjustedValue } = req.body;

    const result = await UserKPIResult.findByPk(id);

    if (!result) {
      return res.status(404).json({ message: 'KPI result not found.' });
    }

    await result.update({ Status: 'adjusted', AdjustedResult: String(adjustedValue) });

    await logActivity({
      userId: req.user.Id,
      action: 'ADJUST_KPI',
      resource: 'UserKPIResult',
      description: `Adjusted KPI result for user ID: ${result.UserId} to ${adjustedValue}`,
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'KPI result adjusted and approved.' });
  } catch (error) {
    console.error('Adjust KPI result error:', error);
    res.status(500).json({ message: 'Server error' });
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
        { model: User, attributes: ['Id', 'FirstName', 'FatherName', 'GrandFatherName', 'UserName', 'Email'] },
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
        { model: User, attributes: ['Id', 'FirstName', 'FatherName', 'GrandFatherName', 'UserName', 'Email'] },
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
        { model: User, attributes: ['Id', 'FirstName', 'FatherName', 'GrandFatherName', 'UserName', 'Email'] },
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
      Status: result.Status === 'pending' || !result.Status ? 'pending' : result.Status,
    });

    // If it's a new update and we know the KPI, we can check evidence requirement
    if (result.KPIId || KPIId) {
      const kpi = await KPI.findByPk(KPIId || result.KPIId);
      if (kpi && !kpi.IsEvedenceRequired) {
        await result.update({ Status: 'approved' });
      }
    }

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
  getKPIApprovals,
  approveKPIResult,
  adjustKPIResult,
};
