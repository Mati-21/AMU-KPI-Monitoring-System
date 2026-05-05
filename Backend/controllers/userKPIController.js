const { UserKPI, User, KPI, UserKPIResult, UserRole } = require('../models');
const { Op } = require('sequelize');
const { getCurrentCycleYear, getPreviousCycleYear } = require('../utils/kpiCycle');
const { hasModulePermission } = require('../middleware/authMiddleware');

const parseNumericValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const parseUuidValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(trimmed) ? trimmed : null;
};

const computeBaselineFromPreviousCycle = async ({ KPIId, UserId, cycleYear, fallbackBaseline }) => {
  const previousCycleYear = getPreviousCycleYear(cycleYear);
  if (!previousCycleYear) {
    return parseNumericValue(fallbackBaseline);
  }

  const previousResults = await UserKPIResult.findAll({
    where: {
      KPIId,
      UserId,
      CycleYear: previousCycleYear,
      IsArchived: false,
    },
    attributes: ['KPIResult'],
  });

  const numericResults = previousResults.map((result) => parseNumericValue(result.KPIResult)).filter((value) => value !== null);

  if (numericResults.length === 0) {
    return parseNumericValue(fallbackBaseline);
  }

  const average = numericResults.reduce((sum, value) => sum + value, 0) / numericResults.length;
  return Number(average.toFixed(2));
};

const hasActiveRoleMembership = async (userId, roleId) => {
  if (!userId || !roleId) return false;

  const membership = await UserRole.findOne({
    where: {
      UserId: userId,
      RoleId: roleId,
      IsArchived: false,
      [Op.or]: [{ ToDate: null }, { ToDate: { [Op.gte]: new Date() } }],
    },
    attributes: ['Id'],
  });

  return Boolean(membership);
};

const getActiveRoleUserIds = async (roleId) => {
  if (!roleId) return [];

  const assignments = await UserRole.findAll({
    where: {
      RoleId: roleId,
      IsArchived: false,
      [Op.or]: [{ ToDate: null }, { ToDate: { [Op.gte]: new Date() } }],
    },
    attributes: ['UserId'],
  });

  return [...new Set(assignments.map((assignment) => assignment.UserId).filter(Boolean))];
};

const hasExtraMeasuresAccess = (req) =>
  Boolean(
    req.user?.currentRole?.HasExtraMeasures || req.user?.currentRole?.hasExtraMeasures || req.user?.hasExtraMeasures || req.user?.HasExtraMeasures
  );

const createUserKPI = async (req, res) => {
  try {
    const { KPIId, UserId, Remark, Name, CycleYear, Baseline, AssignedTarget, IsTargetIndividual, IncludeCurrentOffice, AssignmentBatchId } = req.body;
    const cycleYear = CycleYear || getCurrentCycleYear();
    const assignmentBatchId = parseUuidValue(AssignmentBatchId);

    const user = await User.findByPk(UserId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const kpi = await KPI.findByPk(KPIId);
    if (!kpi) {
      return res.status(404).json({ message: 'KPI not found' });
    }

    const existingAssignment = await UserKPI.findOne({
      where: {
        KPIId,
        UserId,
        CycleYear: cycleYear,
        IsArchived: false,
        Remark: Remark || null,
        Name: Name || null, // Check for exact same name as well
      },
    });

    if (existingAssignment) {
      const canEditAny =
        hasModulePermission(req, 'KPI Allocation', 'edit') ||
        hasModulePermission(req, 'Drived KPI', 'edit') ||
        hasModulePermission(req, 'Drived KPI Allocation', 'edit');
      const canAssignAny =
        hasModulePermission(req, 'KPI Allocation', 'assign') ||
        hasModulePermission(req, 'Drived KPI', 'assign') ||
        hasModulePermission(req, 'Drived KPI Allocation', 'assign');
      const canCreateKpiAllocation =
        hasModulePermission(req, 'KPI Allocation', 'create') ||
        hasModulePermission(req, 'Drived KPI', 'create') ||
        hasModulePermission(req, 'Drived KPI Allocation', 'create');
      const canUseExtraMeasures = hasExtraMeasuresAccess(req);
      const isCreator = String(existingAssignment.CreatedBy || '') === String(req.user?.Id || '');
      const includeCurrentOffice = Boolean(IncludeCurrentOffice);
      const requesterRoleId = req.user?.currentRole?.Id || null;
      const targetUserIsInRequesterRole = includeCurrentOffice ? await hasActiveRoleMembership(existingAssignment.UserId, requesterRoleId) : false;

      const canActivateForCurrentOffice =
        includeCurrentOffice && (canCreateKpiAllocation || canAssignAny || canUseExtraMeasures) && targetUserIsInRequesterRole;

      if (!canEditAny && !canAssignAny && !canCreateKpiAllocation && !canUseExtraMeasures && !isCreator && !canActivateForCurrentOffice) {
        return res.status(409).json({ message: 'This specific KPI assignment already exists.' });
      }

      await existingAssignment.update({
        Baseline: Baseline !== undefined ? parseNumericValue(Baseline) : existingAssignment.Baseline,
        AssignedTarget: AssignedTarget !== undefined ? parseNumericValue(AssignedTarget) : existingAssignment.AssignedTarget,
        IsTargetIndividual: IsTargetIndividual !== undefined ? Boolean(IsTargetIndividual) : existingAssignment.IsTargetIndividual,
        IncludeCurrentOffice: IncludeCurrentOffice !== undefined ? Boolean(IncludeCurrentOffice) : existingAssignment.IncludeCurrentOffice,
        AssignmentBatchId: AssignmentBatchId !== undefined ? assignmentBatchId : existingAssignment.AssignmentBatchId,
        Remark: Remark !== undefined ? Remark : existingAssignment.Remark,
      });

      return res.status(200).json({
        success: true,
        data: existingAssignment,
        message: 'KPI assignment updated.',
      });
    }

    const computedBaseline =
      parseNumericValue(Baseline) ??
      (await computeBaselineFromPreviousCycle({
        KPIId,
        UserId,
        cycleYear,
        fallbackBaseline: kpi.Baseline,
      }));

    const userKPI = await UserKPI.create({
      KPIId,
      CycleYear: cycleYear,
      UserId,
      Baseline: computedBaseline,
      AssignedTarget: parseNumericValue(AssignedTarget),
      IsTargetIndividual: Boolean(IsTargetIndividual),
      IncludeCurrentOffice: Boolean(IncludeCurrentOffice),
      AssignmentBatchId: assignmentBatchId,
      Remark,
      Name,
      CreatedBy: req.user?.Id,
    });

    res.status(201).json({ success: true, data: userKPI });
  } catch (error) {
    console.error('Create user KPI error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getUserKPIs = async (req, res) => {
  try {
    const { year, scope, fromParent } = req.query;
    const where = { IsArchived: false };

    if (year) {
      where.CycleYear = year;
    }

    if (scope === 'mine') {
      where.UserId = req.user?.Id;
    } else if (scope === 'sent') {
      where.CreatedBy = req.user?.Id;
      // Filter out self-assignments so the parent's source isn't accidentally deleted from the sent tracker
      where.UserId = { [Op.ne]: req.user?.Id };
    }

    const { isDerived } = req.query;
    if (isDerived !== undefined) {
      if (String(isDerived).toLowerCase() === 'true') {
        // Derived: Has either a local Name or a local Remark
        where[Op.or] = [
          { Remark: { [Op.not]: null }, [Op.and]: [{ Remark: { [Op.ne]: '' } }] },
          { Name: { [Op.not]: null }, [Op.and]: [{ Name: { [Op.ne]: '' } }] },
        ];
      } else if (String(isDerived).toLowerCase() === 'false') {
        // Original: Has neither a local Name nor a local Remark
        where.Remark = { [Op.or]: [null, ''] };
        where.Name = { [Op.or]: [null, ''] };
      }
    }

    if (String(fromParent).toLowerCase() === 'true') {
      const parentRoleId = req.user?.currentRole?.ParentRoleId;

      if (!parentRoleId) {
        return res.json({ success: true, data: [] });
      }

      const parentRoleUserAssignments = await UserRole.findAll({
        where: {
          RoleId: parentRoleId,
          IsArchived: false,
          [Op.or]: [{ ToDate: null }, { ToDate: { [Op.gte]: new Date() } }],
        },
        attributes: ['UserId'],
      });

      const parentUserIds = [...new Set(parentRoleUserAssignments.map((assignment) => assignment.UserId).filter(Boolean))];

      if (!parentUserIds.length) {
        return res.json({ success: true, data: [] });
      }

      where.CreatedBy = { [Op.in]: parentUserIds };
    }

    const userKpis = await UserKPI.findAll({
      where,
      include: [
        { model: User, attributes: ['Id', 'FirstName', 'UserName', 'Email'] },
        { model: KPI, attributes: ['Id', 'Baseline', 'Target', 'Description'] },
      ],
      order: [['CreatedAt', 'DESC']],
    });

    const assignmentUserIds = [...new Set(userKpis.map((assignment) => String(assignment.UserId || '')).filter(Boolean))];
    const assignmentKpiIds = [...new Set(userKpis.map((assignment) => String(assignment.KPIId || '')).filter(Boolean))];

    const quarterlyResults =
      assignmentUserIds.length && assignmentKpiIds.length
        ? await UserKPIResult.findAll({
            where: {
              IsArchived: false,
              CycleYear: year || getCurrentCycleYear(),
              UserId: { [Op.in]: assignmentUserIds },
              KPIId: { [Op.in]: assignmentKpiIds },
            },
            attributes: ['Id', 'UserId', 'KPIId', 'UserKPIId', 'KPIResult', 'Quarter', 'CreatedAt'],
            order: [['CreatedAt', 'DESC']],
          })
        : [];

    const quarterlyResultsByAssignmentId = new Map();
    const quarterlyResultsByLegacyKey = new Map();

    quarterlyResults.forEach((result) => {
      const normalizedQuarter = String(result.Quarter || '').toUpperCase();
      const item = {
        id: result.Id,
        quarter: result.Quarter,
        result: result.KPIResult,
        createdAt: result.CreatedAt,
      };

      if (result.UserKPIId) {
        const idKey = String(result.UserKPIId);
        if (!quarterlyResultsByAssignmentId.has(idKey)) {
          quarterlyResultsByAssignmentId.set(idKey, { q1: '-', q2: '-', q3: '-', q4: '-', quarterlyResults: [] });
        }
        const bucket = quarterlyResultsByAssignmentId.get(idKey);
        bucket.quarterlyResults.push(item);
        const resultVal = parseNumericValue(result.KPIResult) || 0;
        if (normalizedQuarter === 'Q1') bucket.q1 = (bucket.q1 === '-' ? 0 : Number(bucket.q1)) + resultVal;
        if (normalizedQuarter === 'Q2') bucket.q2 = (bucket.q2 === '-' ? 0 : Number(bucket.q2)) + resultVal;
        if (normalizedQuarter === 'Q3') bucket.q3 = (bucket.q3 === '-' ? 0 : Number(bucket.q3)) + resultVal;
        if (normalizedQuarter === 'Q4') bucket.q4 = (bucket.q4 === '-' ? 0 : Number(bucket.q4)) + resultVal;
      } else {
        const legacyKey = `${String(result.UserId || '')}::${String(result.KPIId || '')}`;
        if (!quarterlyResultsByLegacyKey.has(legacyKey)) {
          quarterlyResultsByLegacyKey.set(legacyKey, { q1: '-', q2: '-', q3: '-', q4: '-', quarterlyResults: [] });
        }
        const bucket = quarterlyResultsByLegacyKey.get(legacyKey);
        bucket.quarterlyResults.push(item);
        
        const resultVal = parseNumericValue(result.KPIResult) || 0;
        if (normalizedQuarter === 'Q1') bucket.q1 = (bucket.q1 === '-' ? 0 : Number(bucket.q1)) + resultVal;
        if (normalizedQuarter === 'Q2') bucket.q2 = (bucket.q2 === '-' ? 0 : Number(bucket.q2)) + resultVal;
        if (normalizedQuarter === 'Q3') bucket.q3 = (bucket.q3 === '-' ? 0 : Number(bucket.q3)) + resultVal;
        if (normalizedQuarter === 'Q4') bucket.q4 = (bucket.q4 === '-' ? 0 : Number(bucket.q4)) + resultVal;
      }
    });

    const userKpisWithQuarterlyResults = userKpis.map((assignment) => {
      const assignmentIdKey = String(assignment.Id);
      const legacyKey = `${String(assignment.UserId || '')}::${String(assignment.KPIId || '')}`;
      
      const bucket = quarterlyResultsByAssignmentId.get(assignmentIdKey) || quarterlyResultsByLegacyKey.get(legacyKey);

      return {
        ...assignment.toJSON(),
        quarterlyResults: bucket?.quarterlyResults || [],
        q1: bucket?.q1 || '-',
        q2: bucket?.q2 || '-',
        q3: bucket?.q3 || '-',
        q4: bucket?.q4 || '-',
      };
    });

    res.json({ success: true, data: userKpisWithQuarterlyResults });
  } catch (error) {
    console.error('Get user KPIs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getUserKPIById = async (req, res) => {
  try {
    const { id } = req.params;
    const userKPI = await UserKPI.findByPk(id, {
      include: [
        { model: User, attributes: ['Id', 'FirstName', 'UserName', 'Email'] },
        { model: KPI, attributes: ['Id', 'Baseline', 'Target', 'Description'] },
      ],
    });

    if (!userKPI) {
      return res.status(404).json({ message: 'User KPI not found' });
    }

    res.json({ success: true, data: userKPI });
  } catch (error) {
    console.error('Get user KPI error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateUserKPI = async (req, res) => {
  try {
    const { id } = req.params;
    const { KPIId, UserId, Remark, Name, CycleYear, Baseline, AssignedTarget, IsTargetIndividual, IncludeCurrentOffice, AssignmentBatchId } = req.body;

    const userKPI = await UserKPI.findByPk(id);
    if (!userKPI) {
      return res.status(404).json({ message: 'User KPI not found' });
    }

    const canEditAny =
      hasModulePermission(req, 'KPI Allocation', 'edit') ||
      hasModulePermission(req, 'Drived KPI', 'edit') ||
      hasModulePermission(req, 'Drived KPI Allocation', 'edit');
    const canCreateKpiAllocation =
      hasModulePermission(req, 'KPI Allocation', 'create') ||
      hasModulePermission(req, 'Drived KPI', 'create') ||
      hasModulePermission(req, 'Drived KPI Allocation', 'create');
    const canUseExtraMeasures = hasExtraMeasuresAccess(req);
    const isCreator = String(userKPI.CreatedBy || '') === String(req.user?.Id || '');

    const requesterRoleId = req.user?.currentRole?.Id || null;
    const canToggleHomeOfficeActivation =
      (canCreateKpiAllocation || canUseExtraMeasures) &&
      IncludeCurrentOffice !== undefined &&
      (await hasActiveRoleMembership(userKPI.UserId, requesterRoleId));

    if (!canEditAny && !canUseExtraMeasures && !(canCreateKpiAllocation && isCreator) && !canToggleHomeOfficeActivation) {
      return res.status(403).json({ message: 'Not authorized to edit this KPI allocation item' });
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

    const includeCurrentOfficeBoolean = IncludeCurrentOffice !== undefined ? Boolean(IncludeCurrentOffice) : userKPI.IncludeCurrentOffice;
    let nextCreatedBy = userKPI.CreatedBy;

    // When unallocating from home office, restore parent ownership so it becomes visible in Assigned KPI.
    if (IncludeCurrentOffice !== undefined && includeCurrentOfficeBoolean === false && userKPI.IncludeCurrentOffice === true) {
      const parentRoleId = req.user?.currentRole?.ParentRoleId || null;
      const parentUserIds = await getActiveRoleUserIds(parentRoleId);
      const requesterId = String(req.user?.Id || '');

      if (parentUserIds.length && String(userKPI.CreatedBy || '') === requesterId) {
        nextCreatedBy = parentUserIds[0];
      }
    }

    await userKPI.update({
      KPIId,
      UserId,
      Remark,
      Baseline: Baseline !== undefined ? parseNumericValue(Baseline) : userKPI.Baseline,
      AssignedTarget: AssignedTarget !== undefined ? parseNumericValue(AssignedTarget) : userKPI.AssignedTarget,
      IsTargetIndividual: IsTargetIndividual !== undefined ? Boolean(IsTargetIndividual) : userKPI.IsTargetIndividual,
      IncludeCurrentOffice: includeCurrentOfficeBoolean,
      AssignmentBatchId: AssignmentBatchId !== undefined ? AssignmentBatchId || null : userKPI.AssignmentBatchId,
      CycleYear: CycleYear || userKPI.CycleYear,
      Name: Name !== undefined ? Name : userKPI.Name,
      CreatedBy: nextCreatedBy,
    });

    res.json({ success: true, data: userKPI });
  } catch (error) {
    console.error('Update user KPI error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteUserKPI = async (req, res) => {
  try {
    const { id } = req.params;
    const userKPI = await UserKPI.findByPk(id);

    if (!userKPI) {
      return res.status(404).json({ message: 'User KPI not found' });
    }

    const canDeleteAny =
      hasModulePermission(req, 'KPI Allocation', 'delete') ||
      hasModulePermission(req, 'Drived KPI', 'delete') ||
      hasModulePermission(req, 'Drived KPI Allocation', 'delete');
    const canCreateKpiAllocation =
      hasModulePermission(req, 'KPI Allocation', 'create') ||
      hasModulePermission(req, 'Drived KPI', 'create') ||
      hasModulePermission(req, 'Drived KPI Allocation', 'create');
    const canUseExtraMeasures = hasExtraMeasuresAccess(req);
    const isCreator = String(userKPI.CreatedBy || '') === String(req.user?.Id || '');

    if (!canDeleteAny && !canUseExtraMeasures && !(canCreateKpiAllocation && isCreator)) {
      return res.status(403).json({ message: 'Not authorized to delete this KPI allocation item' });
    }

    await userKPI.update({ IsArchived: true });

    // Reset/Archive performance results associated with this specific assignment ID
    await UserKPIResult.update(
      { IsArchived: true },
      {
        where: {
          UserKPIId: userKPI.Id,
          IsArchived: false,
        },
      }
    );

    res.json({ success: true, message: 'User KPI archived successfully' });
  } catch (error) {
    console.error('Delete user KPI error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createUserKPI,
  getUserKPIs,
  getUserKPIById,
  updateUserKPI,
  deleteUserKPI,
};
