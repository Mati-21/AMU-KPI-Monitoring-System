const { UserKPI, User, KPI, UserKPIResult, UserRole, OfficeReportSubmission } = require('../models');
const { Op } = require('sequelize');
const { getCurrentCycleYear, getPreviousCycleYear } = require('../utils/kpiCycle');
const { hasModulePermission } = require('../middleware/authMiddleware');
const { createNotification } = require('../services/notificationService');

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

const hasExtraMeasuresAccess = (req) => false;

const createUserKPI = async (req, res) => {
  try {
    const { KPIId, UserId, Remark, CycleYear, Baseline, AssignedTarget, IsTargetIndividual, IncludeCurrentOffice, AssignmentBatchId } =
      req.body;
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
      },
    });

    if (existingAssignment) {
      const canEditAny = hasModulePermission(req, 'KPI Allocation', 'edit');
      const canAssignAny = hasModulePermission(req, 'KPI Allocation', 'assign');
      const canCreateKpiAllocation = hasModulePermission(req, 'KPI Allocation', 'create');
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

      const previousIncludeCurrentOffice = Boolean(existingAssignment.IncludeCurrentOffice);

      await existingAssignment.update({
        Baseline: Baseline !== undefined ? parseNumericValue(Baseline) : existingAssignment.Baseline,
        AssignedTarget: AssignedTarget !== undefined ? parseNumericValue(AssignedTarget) : existingAssignment.AssignedTarget,
        IsTargetIndividual: IsTargetIndividual !== undefined ? Boolean(IsTargetIndividual) : existingAssignment.IsTargetIndividual,
        IncludeCurrentOffice: IncludeCurrentOffice !== undefined ? Boolean(IncludeCurrentOffice) : existingAssignment.IncludeCurrentOffice,
        AssignmentBatchId: AssignmentBatchId !== undefined ? assignmentBatchId : existingAssignment.AssignmentBatchId,
        Remark: Remark !== undefined ? Remark : existingAssignment.Remark,
      });

      try {
        const nextIncludeCurrentOffice = Boolean(existingAssignment.IncludeCurrentOffice);
        const includeChanged = IncludeCurrentOffice !== undefined && previousIncludeCurrentOffice !== nextIncludeCurrentOffice;

        await createNotification({
          recipientUserId: UserId,
          actorUserId: req.user?.Id || null,
          type: includeChanged && !nextIncludeCurrentOffice ? 'kpi_unallocated' : 'kpi_assigned',
          title: includeChanged ? (nextIncludeCurrentOffice ? 'KPI allocated' : 'KPI unallocated') : 'KPI assignment updated',
          message: includeChanged
            ? nextIncludeCurrentOffice
              ? `A KPI has been allocated to your home office for ${cycleYear}.`
              : `A KPI was unallocated from your home office for ${cycleYear}.`
            : `Your KPI assignment was updated for ${cycleYear}.`,
          priority: 'low',
          data: {
            UserKPIId: existingAssignment.Id,
            KPIId,
            CycleYear: cycleYear,
            ...(includeChanged ? { IncludeCurrentOffice: nextIncludeCurrentOffice } : {}),
          },
        });
      } catch (notifErr) {
        console.warn('Failed to create KPI update notification:', notifErr.message);
      }

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
        fallbackBaseline: kpi.DefaultBaseline,
      }));

    const userKPI = await UserKPI.create({
      KPIId,
      CycleYear: cycleYear,
      UserId,
      Baseline: computedBaseline,
      AssignedTarget: parseNumericValue(AssignedTarget),
      IsTargetIndividual: Boolean(IsTargetIndividual),
      AssignmentBatchId: assignmentBatchId,
      Remark,
      CreatedBy: req.user?.Id,
    });

    try {
      await createNotification({
        recipientUserId: UserId,
        actorUserId: req.user?.Id || null,
        type: 'kpi_assigned',
        title: 'New KPI assignment',
        message: `A KPI has been assigned to you for ${cycleYear}.`,
        priority: 'medium',
        data: {
          UserKPIId: userKPI.Id,
          KPIId,
          CycleYear: cycleYear,
        },
      });
    } catch (notifErr) {
      console.warn('Failed to create KPI assignment notification:', notifErr.message);
    }

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
      where.UserId = { [Op.ne]: req.user?.Id };
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
        {
          model: User,
          attributes: ['Id', 'FirstName', 'FatherName', 'GrandFatherName', 'UserName', 'Email'],
          include: [
            {
              model: require('../models').UserRole,
              attributes: ['RoleId'],
              where: { IsArchived: false },
              required: false,
              include: [{ model: require('../models').Role, attributes: ['Id', 'RoleName', 'ParentRoleId'] }],
            },
          ],
        },
        { model: KPI, attributes: ['Id', 'Description', 'DefaultBaseline'] },
        { model: require('../models').KPIYearPlan, attributes: ['Id', 'Baseline', 'Target'], required: false },
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
            attributes: ['Id', 'UserId', 'KPIId', 'UserKPIId', 'KPIResult', 'AdjustedResult', 'Status', 'Quarter', 'CreatedAt', 'Description', 'ApproverRemark', 'PerformanceTitle', 'EvidenceURL'],
            order: [['CreatedAt', 'DESC']],
          })
        : [];

    const currentRoleId = String(req.user?.currentRole?.Id || req.user?.roleId || '');
    const currentUserId = String(req.user?.Id || '');
    
    const allRoles = await require('../models').Role.findAll({
      where: { IsArchived: false },
      attributes: ['Id', 'ParentRoleId'],
    });
    
    const directChildRoleIds = allRoles
      .filter((r) => String(r.ParentRoleId || '') === currentRoleId)
      .map((r) => String(r.Id));

    const submissions = directChildRoleIds.length
      ? await require('../models').OfficeReportSubmission.findAll({
          where: {
            CycleYear: year || getCurrentCycleYear(),
            SourceRoleId: { [Op.in]: directChildRoleIds },
            ParentRoleId: currentRoleId,
            IsArchived: false,
          },
          attributes: ['SourceRoleId'],
        })
      : [];
    const submittedChildRoleIds = new Set(submissions.map((s) => String(s.SourceRoleId)));

    const userRoles = await require('../models').UserRole.findAll({
      where: { UserId: { [Op.in]: assignmentUserIds }, IsArchived: false },
      attributes: ['UserId', 'RoleId'],
    });
    const roleIdByUserId = new Map(userRoles.map((ur) => [String(ur.UserId), String(ur.RoleId)]));

    const assignmentCreatorMap = new Map(userKpis.map(a => [String(a.Id), String(a.CreatedBy || '')]));

    const filteredResults = quarterlyResults.filter((r) => {
      const resultRoleId = roleIdByUserId.get(String(r.UserId));
      if (!resultRoleId || resultRoleId === currentRoleId) return true;
      
      const isDirectChild = directChildRoleIds.includes(resultRoleId);
      
      if (isDirectChild) {
        return submittedChildRoleIds.has(resultRoleId);
      } else {
        const assignmentCreator = assignmentCreatorMap.get(String(r.UserKPIId));
        return assignmentCreator === currentUserId;
      }
    });

    const quarterlyResultsByAssignmentId = new Map();
    const quarterlyResultsByLegacyKey = new Map();

    filteredResults.forEach((result) => {
      const normalizedQuarter = String(result.Quarter || '').toUpperCase();
      const effectiveResult = result.Status === 'adjusted' && result.AdjustedResult !== null && result.AdjustedResult !== undefined
        ? result.AdjustedResult
        : result.KPIResult;

      const item = {
        id: result.Id,
        quarter: result.Quarter,
        result: effectiveResult,
        originalResult: result.KPIResult,
        adjustedResult: result.AdjustedResult,
        status: result.Status,
        createdAt: result.CreatedAt,
        remark: result.Description,
        approverRemark: result.ApproverRemark,
        performanceTitle: result.PerformanceTitle,
        evidenceURL: result.EvidenceURL,
      };

      if (result.UserKPIId) {
        const idKey = String(result.UserKPIId);
        if (!quarterlyResultsByAssignmentId.has(idKey)) {
          quarterlyResultsByAssignmentId.set(idKey, { q1: '-', q2: '-', q3: '-', q4: '-', quarterlyResults: [] });
        }
        const bucket = quarterlyResultsByAssignmentId.get(idKey);
        bucket.quarterlyResults.push(item);
        const resultVal = parseNumericValue(effectiveResult) || 0;
        const isPending = result.Status === 'pending';

        if (normalizedQuarter === 'Q1') {
          bucket.q1 = (bucket.q1 === '-' ? 0 : Number(bucket.q1)) + resultVal;
          if (isPending) bucket.q1Pending = true;
        }
        if (normalizedQuarter === 'Q2') {
          bucket.q2 = (bucket.q2 === '-' ? 0 : Number(bucket.q2)) + resultVal;
          if (isPending) bucket.q2Pending = true;
        }
        if (normalizedQuarter === 'Q3') {
          bucket.q3 = (bucket.q3 === '-' ? 0 : Number(bucket.q3)) + resultVal;
          if (isPending) bucket.q3Pending = true;
        }
        if (normalizedQuarter === 'Q4') {
          bucket.q4 = (bucket.q4 === '-' ? 0 : Number(bucket.q4)) + resultVal;
          if (isPending) bucket.q4Pending = true;
        }
      } else {
        const legacyKey = `${String(result.UserId || '')}::${String(result.KPIId || '')}`;
        if (!quarterlyResultsByLegacyKey.has(legacyKey)) {
          quarterlyResultsByLegacyKey.set(legacyKey, { q1: '-', q2: '-', q3: '-', q4: '-', quarterlyResults: [] });
        }
        const bucket = quarterlyResultsByLegacyKey.get(legacyKey);
        bucket.quarterlyResults.push(item);

        const resultVal = parseNumericValue(effectiveResult) || 0;
        const isPending = result.Status === 'pending';

        if (normalizedQuarter === 'Q1') {
          bucket.q1 = (bucket.q1 === '-' ? 0 : Number(bucket.q1)) + resultVal;
          if (isPending) bucket.q1Pending = true;
        }
        if (normalizedQuarter === 'Q2') {
          bucket.q2 = (bucket.q2 === '-' ? 0 : Number(bucket.q2)) + resultVal;
          if (isPending) bucket.q2Pending = true;
        }
        if (normalizedQuarter === 'Q3') {
          bucket.q3 = (bucket.q3 === '-' ? 0 : Number(bucket.q3)) + resultVal;
          if (isPending) bucket.q3Pending = true;
        }
        if (normalizedQuarter === 'Q4') {
          bucket.q4 = (bucket.q4 === '-' ? 0 : Number(bucket.q4)) + resultVal;
          if (isPending) bucket.q4Pending = true;
        }
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
        q1Pending: bucket?.q1Pending || false,
        q2Pending: bucket?.q2Pending || false,
        q3Pending: bucket?.q3Pending || false,
        q4Pending: bucket?.q4Pending || false,
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
        { model: User, attributes: ['Id', 'FirstName', 'FatherName', 'GrandFatherName', 'UserName', 'Email'] },
        { model: KPI, attributes: ['Id', 'Description', 'DefaultBaseline'] },
        { model: require('../models').KPIYearPlan, attributes: ['Id', 'Baseline', 'Target'], required: false },
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
    const { KPIId, UserId, Remark, Name, CycleYear, Baseline, AssignedTarget, IsTargetIndividual, IncludeCurrentOffice, AssignmentBatchId } =
      req.body;

    const userKPI = await UserKPI.findByPk(id);
    if (!userKPI) {
      return res.status(404).json({ message: 'User KPI not found' });
    }

    const previousIncludeCurrentOffice = Boolean(userKPI.IncludeCurrentOffice);

    const canEditAny =
      hasModulePermission(req, 'KPI Allocation', 'edit');
    const canCreateKpiAllocation =
      hasModulePermission(req, 'KPI Allocation', 'create');
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
      AssignmentBatchId: AssignmentBatchId !== undefined ? AssignmentBatchId || null : userKPI.AssignmentBatchId,
      CycleYear: CycleYear || userKPI.CycleYear,
      Name: Name !== undefined ? Name : userKPI.Name,
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
      hasModulePermission(req, 'KPI Allocation', 'delete');
    const canCreateKpiAllocation =
      hasModulePermission(req, 'KPI Allocation', 'create');
    const canUseExtraMeasures = hasExtraMeasuresAccess(req);
    const isCreator = String(userKPI.CreatedBy || '') === String(req.user?.Id || '');

    if (!canDeleteAny && !canUseExtraMeasures && !(canCreateKpiAllocation && isCreator)) {
      return res.status(403).json({ message: 'Not authorized to delete this KPI allocation item' });
    }

    await UserKPIResult.destroy({
      where: {
        UserKPIId: userKPI.Id,
      },
    });

    try {
      const kpi = userKPI.KPIId ? await KPI.findByPk(userKPI.KPIId, { attributes: ['Id', 'Description'] }) : null;
      const cycleYear = userKPI.CycleYear || getCurrentCycleYear();
      const desc = String(kpi?.Description || '').trim();

      await createNotification({
        recipientUserId: userKPI.UserId,
        actorUserId: req.user?.Id || null,
        type: 'kpi_unallocated',
        title: 'KPI unallocated',
        message: desc ? `A KPI assignment was unallocated: ${desc} (${cycleYear}).` : `A KPI assignment was unallocated for ${cycleYear}.`,
        priority: 'medium',
        data: {
          UserKPIId: userKPI.Id,
          KPIId: userKPI.KPIId,
          CycleYear: cycleYear,
        },
      });
    } catch (notifErr) {
      console.warn('Failed to create KPI unallocation notification:', notifErr.message);
    }

    const userRole = await UserRole.findOne({
      where: {
        UserId: userKPI.UserId,
        IsArchived: false,
      },
      attributes: ['RoleId'],
    });

    if (userRole) {
      await OfficeReportSubmission.destroy({
        where: {
          SourceRoleId: userRole.RoleId,
        },
      });
      console.log(`[DELETE_KPI] Cleared report submission for role: ${userRole.RoleId} (user: ${userKPI.UserId})`);
    }

    await userKPI.destroy();

    res.json({ success: true, message: 'User KPI and associated results deleted successfully' });
  } catch (error) {
    console.error('Delete user KPI error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const bulkDeleteUserKPIs = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ message: 'Invalid or empty IDs list provided.' });
    }

    const assignments = await UserKPI.findAll({
      where: {
        Id: { [Op.in]: ids },
      },
    });

    if (!assignments.length) {
      return res.status(404).json({ message: 'No assignments found for the provided IDs.' });
    }

    const canDeleteAny =
      hasModulePermission(req, 'KPI Allocation', 'delete');
    const canCreateKpiAllocation =
      hasModulePermission(req, 'KPI Allocation', 'create');
    const canUseExtraMeasures = hasExtraMeasuresAccess(req);
    const currentUserId = String(req.user?.Id || '');

    const authorizedAssignments = assignments.filter((a) => {
      const isCreator = String(a.CreatedBy || '') === currentUserId;
      return canDeleteAny || canUseExtraMeasures || (canCreateKpiAllocation && isCreator);
    });

    if (!authorizedAssignments.length) {
      return res.status(403).json({ message: 'Not authorized to delete any of the specified assignments.' });
    }

    const authorizedIds = authorizedAssignments.map((a) => a.Id);
    const affectedUserIds = [...new Set(authorizedAssignments.map((a) => a.UserId))];

    // 1. Delete results
    await UserKPIResult.destroy({
      where: {
        UserKPIId: { [Op.in]: authorizedIds },
      },
    });

    // 2. Clear report submissions for affected users' roles
    const userRoles = await UserRole.findAll({
      where: {
        UserId: { [Op.in]: affectedUserIds },
        IsArchived: false,
      },
    });
    const affectedRoleIds = [...new Set(userRoles.map((ur) => ur.RoleId))];

    if (affectedRoleIds.length) {
      await OfficeReportSubmission.destroy({
        where: {
          SourceRoleId: { [Op.in]: affectedRoleIds },
        },
      });
    }

    // 3. Delete assignments
    await UserKPI.destroy({
      where: {
        Id: { [Op.in]: authorizedIds },
      },
    });

    res.json({
      success: true,
      message: `Successfully unallocated ${authorizedIds.length} assignment(s).`,
      count: authorizedIds.length,
    });
  } catch (error) {
    console.error('Bulk delete user KPIs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createUserKPI,
  getUserKPIs,
  getUserKPIById,
  updateUserKPI,
  deleteUserKPI,
  bulkDeleteUserKPIs,
};
