import { prisma  } from '../../config/database.js';
import { getCurrentCycleYear, getPreviousCycleYear  } from '../../utils/kpiCycle.js';
import { hasModulePermission  } from '../../middleware/authMiddleware.js';
import { createNotification  } from '../../services/notificationService.js';

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

  const previousResults = await prisma.userKPIResults.findMany({
    where: {
      KPIId,
      UserId,
      CycleYear: previousCycleYear,
      IsArchived: false,
    },
    select: { KPIResult: true },
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

  const membership = await prisma.userRoles.findFirst({
    where: {
      UserId: userId,
      RoleId: roleId,
      IsArchived: false,
      OR: [{ ToDate: null }, { ToDate: { gte: new Date() } }],
    },
    select: { Id: true },
  });

  return Boolean(membership);
};

const getActiveRoleUserIds = async (roleId) => {
  if (!roleId) return [];

  const assignments = await prisma.userRoles.findMany({
    where: {
      RoleId: roleId,
      IsArchived: false,
      OR: [{ ToDate: null }, { ToDate: { gte: new Date() } }],
    },
    select: { UserId: true },
  });

  return [...new Set(assignments.map((assignment) => assignment.UserId).filter(Boolean))];
};

const hasExtraMeasuresAccess = (req) => false;

const createUserKPI = async (req, res) => {
  try {
    const { KPIId, UserId, Remark, CycleYear, Baseline, AssignedTarget, IsTargetIndividual, IncludeCurrentOffice, AssignmentBatchId } = req.body;
    const cycleYear = CycleYear || getCurrentCycleYear();
    const activeCycleYear = getCurrentCycleYear();
    if (String(cycleYear) !== String(activeCycleYear)) {
      return res.status(400).json({
        message: `Cycle ${cycleYear} is closed. KPI allocations can only be created/updated for the active cycle (${activeCycleYear}).`,
      });
    }
    const assignmentBatchId = parseUuidValue(AssignmentBatchId);

    const user = await prisma.users.findUnique({ where: { Id: UserId } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const kpi = await prisma.kPIs.findUnique({ where: { Id: KPIId } });
    if (!kpi) {
      return res.status(404).json({ message: 'KPI not found' });
    }

    const existingAssignment = await prisma.userKPIs.findFirst({
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

      const updatedAssignment = await prisma.userKPIs.update({
        where: { Id: existingAssignment.Id },
        data: {
          Baseline: Baseline !== undefined ? parseNumericValue(Baseline) : existingAssignment.Baseline,
          AssignedTarget: AssignedTarget !== undefined ? parseNumericValue(AssignedTarget) : existingAssignment.AssignedTarget,
          IsTargetIndividual: IsTargetIndividual !== undefined ? Boolean(IsTargetIndividual) : existingAssignment.IsTargetIndividual,
          IncludeCurrentOffice: IncludeCurrentOffice !== undefined ? Boolean(IncludeCurrentOffice) : existingAssignment.IncludeCurrentOffice,
          AssignmentBatchId: AssignmentBatchId !== undefined ? assignmentBatchId : existingAssignment.AssignmentBatchId,
          Remark: Remark !== undefined ? Remark : existingAssignment.Remark,
        }
      });

      try {
        const nextIncludeCurrentOffice = Boolean(updatedAssignment.IncludeCurrentOffice);
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
        data: updatedAssignment,
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

    const userKPI = await prisma.userKPIs.create({
      data: {
        KPIId,
        CycleYear: cycleYear,
        UserId,
        Baseline: computedBaseline,
        AssignedTarget: parseNumericValue(AssignedTarget),
        IsTargetIndividual: Boolean(IsTargetIndividual),
        AssignmentBatchId: assignmentBatchId,
        Remark,
        CreatedBy: req.user?.Id,
      }
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
    const { year, cycleYear, scope, fromParent } = req.query;
    const resolvedYear = year || cycleYear || getCurrentCycleYear();
    const where = { IsArchived: false, CycleYear: resolvedYear };

    if (scope === 'mine') {
      where.UserId = req.user?.Id;
    } else if (scope === 'sent') {
      where.CreatedBy = req.user?.Id;
      where.UserId = { not: req.user?.Id };
    }

    if (String(fromParent).toLowerCase() === 'true') {
      const parentRoleId = req.user?.currentRole?.ParentRoleId;

      if (parentRoleId) {
        const parentRoleUserAssignments = await prisma.userRoles.findMany({
          where: {
            RoleId: parentRoleId,
            ...(resolvedYear === getCurrentCycleYear() ? { IsArchived: false } : {}),
          },
          select: { UserId: true },
        });

        const parentUserIds = [...new Set(parentRoleUserAssignments.map((assignment) => assignment.UserId).filter(Boolean))];

        if (!parentUserIds.length) {
          return res.json({ success: true, data: [] });
        }

        where.CreatedBy = { in: parentUserIds };
      }
    }

    const userKpis = await prisma.userKPIs.findMany({
      where,
      include: {
        Users: {
          select: {
            Id: true, FirstName: true, FatherName: true, GrandFatherName: true, UserName: true, Email: true,
            UserRoles: {
              where: { IsArchived: false },
              select: {
                RoleId: true,
                Roles: { select: { Id: true, RoleName: true, ParentRoleId: true } }
              }
            }
          }
        },
        KPIs: { select: { Id: true, Description: true, DefaultBaseline: true } },
        KPIYearPlans: { select: { Id: true, Baseline: true, Target: true } }
      },
      orderBy: { CreatedAt: 'desc' },
    });

    const assignmentUserIds = [...new Set(userKpis.map((assignment) => String(assignment.UserId || '')).filter(Boolean))];
    const assignmentKpiIds = [...new Set(userKpis.map((assignment) => String(assignment.KPIId || '')).filter(Boolean))];

    const quarterlyResults =
      assignmentUserIds.length && assignmentKpiIds.length
        ? await prisma.userKPIResults.findMany({
            where: {
              IsArchived: false,
              CycleYear: resolvedYear,
              UserId: { in: assignmentUserIds },
              KPIId: { in: assignmentKpiIds },
            },
            select: {
              Id: true, UserId: true, KPIId: true, UserKPIId: true, KPIResult: true, AdjustedResult: true,
              Status: true, Quarter: true, CreatedAt: true, Description: true, ApproverRemark: true, PerformanceTitle: true, EvidenceURL: true,
            },
            orderBy: { CreatedAt: 'desc' },
          })
        : [];

    const currentRoleId = String(req.user?.currentRole?.Id || req.user?.roleId || '');
    const currentUserId = String(req.user?.Id || '');

    const allRoles = await prisma.roles.findMany({
      where: { IsArchived: false },
      select: { Id: true, ParentRoleId: true },
    });

    const directChildRoleIds = allRoles.filter((r) => String(r.ParentRoleId || '') === currentRoleId).map((r) => String(r.Id));

    const submissions = directChildRoleIds.length
      ? await prisma.officeReportSubmissions.findMany({
          where: {
            CycleYear: resolvedYear,
            SourceRoleId: { in: directChildRoleIds },
            ParentRoleId: currentRoleId,
            IsArchived: false,
          },
          select: { SourceRoleId: true },
        })
      : [];
    const submittedChildRoleIds = new Set(submissions.map((s) => String(s.SourceRoleId)));

    const userRoles = await prisma.userRoles.findMany({
      where: {
        UserId: { in: assignmentUserIds },
        ...(resolvedYear === getCurrentCycleYear() ? { IsArchived: false } : {}),
      },
      select: { UserId: true, RoleId: true },
    });
    const roleIdByUserId = new Map(userRoles.map((ur) => [String(ur.UserId), String(ur.RoleId)]));

    const assignmentCreatorMap = new Map(userKpis.map((a) => [String(a.Id), String(a.CreatedBy || '')]));

    const filteredResults = quarterlyResults.filter((r) => {
      const resultRoleId = roleIdByUserId.get(String(r.UserId));
      if (!resultRoleId || resultRoleId === currentRoleId) return true;

      const isDirectChild = directChildRoleIds.includes(resultRoleId);

      if (isDirectChild) {
        if (resolvedYear !== getCurrentCycleYear()) {
          return true;
        }
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
      const effectiveResult =
        result.Status === 'adjusted' && result.AdjustedResult !== null && result.AdjustedResult !== undefined
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

      const mappedAssignment = {
        ...assignment,
        User: assignment.Users ? {
          ...assignment.Users,
          UserRoles: assignment.Users.UserRoles?.map(ur => ({
            ...ur,
            Role: ur.Roles,
            Roles: undefined
          }))
        } : null,
        KPI: assignment.KPIs,
        KPIYearPlan: assignment.KPIYearPlans,
        Users: undefined,
        KPIs: undefined,
        KPIYearPlans: undefined,
      };

      return {
        ...mappedAssignment,
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
    const userKPI = await prisma.userKPIs.findUnique({
      where: { Id: id },
      include: {
        Users: { select: { Id: true, FirstName: true, FatherName: true, GrandFatherName: true, UserName: true, Email: true } },
        KPIs: { select: { Id: true, Description: true, DefaultBaseline: true } },
        KPIYearPlans: { select: { Id: true, Baseline: true, Target: true } },
      },
    });

    if (!userKPI) {
      return res.status(404).json({ message: 'User KPI not found' });
    }

    const mapped = {
      ...userKPI,
      User: userKPI.Users,
      KPI: userKPI.KPIs,
      KPIYearPlan: userKPI.KPIYearPlans,
      Users: undefined,
      KPIs: undefined,
      KPIYearPlans: undefined
    };

    res.json({ success: true, data: mapped });
  } catch (error) {
    console.error('Get user KPI error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateUserKPI = async (req, res) => {
  try {
    const { id } = req.params;
    const { KPIId, UserId, Remark, Name, CycleYear, Baseline, AssignedTarget, IsTargetIndividual, IncludeCurrentOffice, AssignmentBatchId } = req.body;

    const userKPI = await prisma.userKPIs.findUnique({ where: { Id: id } });
    if (!userKPI) {
      return res.status(404).json({ message: 'User KPI not found' });
    }

    const activeCycleYear = getCurrentCycleYear();
    if (String(userKPI.CycleYear) !== String(activeCycleYear)) {
      return res.status(400).json({
        message: `Cycle ${userKPI.CycleYear} is closed. KPI allocations can only be updated for the active cycle (${activeCycleYear}).`,
      });
    }

    if (CycleYear && String(CycleYear) !== String(activeCycleYear)) {
      return res.status(400).json({
        message: `Cannot change KPI allocation CycleYear to ${CycleYear}. Only the active cycle (${activeCycleYear}) is writable.`,
      });
    }

    const previousIncludeCurrentOffice = Boolean(userKPI.IncludeCurrentOffice);

    const canEditAny = hasModulePermission(req, 'KPI Allocation', 'edit');
    const canCreateKpiAllocation = hasModulePermission(req, 'KPI Allocation', 'create');
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
      const kpi = await prisma.kPIs.findUnique({ where: { Id: KPIId } });
      if (!kpi) {
        return res.status(404).json({ message: 'KPI not found' });
      }
    }

    if (UserId) {
      const user = await prisma.users.findUnique({ where: { Id: UserId } });
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

    const updated = await prisma.userKPIs.update({
      where: { Id: id },
      data: {
        KPIId,
        UserId,
        Remark,
        Baseline: Baseline !== undefined ? parseNumericValue(Baseline) : userKPI.Baseline,
        AssignedTarget: AssignedTarget !== undefined ? parseNumericValue(AssignedTarget) : userKPI.AssignedTarget,
        IsTargetIndividual: IsTargetIndividual !== undefined ? Boolean(IsTargetIndividual) : userKPI.IsTargetIndividual,
        AssignmentBatchId: AssignmentBatchId !== undefined ? AssignmentBatchId || null : userKPI.AssignmentBatchId,
        CycleYear: CycleYear || userKPI.CycleYear,
        Name: Name !== undefined ? Name : userKPI.Name,
        CreatedBy: nextCreatedBy,
      }
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update user KPI error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteUserKPI = async (req, res) => {
  try {
    const { id } = req.params;
    const userKPI = await prisma.userKPIs.findUnique({ where: { Id: id } });

    if (!userKPI) {
      return res.status(404).json({ message: 'User KPI not found' });
    }

    const canDeleteAny = hasModulePermission(req, 'KPI Allocation', 'delete');
    const canCreateKpiAllocation = hasModulePermission(req, 'KPI Allocation', 'create');
    const canUseExtraMeasures = hasExtraMeasuresAccess(req);
    const isCreator = String(userKPI.CreatedBy || '') === String(req.user?.Id || '');

    if (!canDeleteAny && !canUseExtraMeasures && !(canCreateKpiAllocation && isCreator)) {
      return res.status(403).json({ message: 'Not authorized to delete this KPI allocation item' });
    }

    await prisma.userKPIResults.deleteMany({
      where: { UserKPIId: userKPI.Id },
    });

    try {
      const kpi = userKPI.KPIId ? await prisma.kPIs.findUnique({ where: { Id: userKPI.KPIId }, select: { Id: true, Description: true } }) : null;
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

    const userRole = await prisma.userRoles.findFirst({
      where: {
        UserId: userKPI.UserId,
        IsArchived: false,
      },
      select: { RoleId: true },
    });

    if (userRole) {
      await prisma.officeReportSubmissions.deleteMany({
        where: { SourceRoleId: userRole.RoleId },
      });
      console.log(`[DELETE_KPI] Cleared report submission for role: ${userRole.RoleId} (user: ${userKPI.UserId})`);
    }

    await prisma.userKPIs.delete({ where: { Id: id } });

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

    const assignments = await prisma.userKPIs.findMany({
      where: { Id: { in: ids } },
    });

    if (!assignments.length) {
      return res.status(404).json({ message: 'No assignments found for the provided IDs.' });
    }

    const canDeleteAny = hasModulePermission(req, 'KPI Allocation', 'delete');
    const canCreateKpiAllocation = hasModulePermission(req, 'KPI Allocation', 'create');
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

    await prisma.userKPIResults.deleteMany({
      where: { UserKPIId: { in: authorizedIds } },
    });

    const userRoles = await prisma.userRoles.findMany({
      where: {
        UserId: { in: affectedUserIds },
        IsArchived: false,
      },
    });
    const affectedRoleIds = [...new Set(userRoles.map((ur) => ur.RoleId))];

    if (affectedRoleIds.length) {
      await prisma.officeReportSubmissions.deleteMany({
        where: { SourceRoleId: { in: affectedRoleIds } },
      });
    }

    await prisma.userKPIs.deleteMany({
      where: { Id: { in: authorizedIds } },
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

const bulkAssignUserKPIs = async (req, res) => {
  try {
    const { assignments } = req.body;
    if (!Array.isArray(assignments) || !assignments.length) {
      return res.status(400).json({ message: 'Invalid or empty assignments list.' });
    }

    const activeCycleYear = getCurrentCycleYear();
    const createdBy = req.user?.Id;

    const assignmentsByUser = new Map();
    for (const item of assignments) {
      const uId = item.UserId;
      if (!uId) continue;
      if (!assignmentsByUser.has(uId)) {
        assignmentsByUser.set(uId, []);
      }
      assignmentsByUser.get(uId).push(item);
    }

    const results = [];
    const notificationsToCreate = [];

    for (const [userId, userItems] of assignmentsByUser.entries()) {
      const user = await prisma.users.findUnique({ where: { Id: userId } });
      if (!user) continue;

      let newCount = 0;
      let updateCount = 0;
      const userKPIIds = [];
      const kpiIds = [];

      for (const item of userItems) {
        const { KPIId, Remark, Baseline, AssignedTarget, IsTargetIndividual, IncludeCurrentOffice, AssignmentBatchId } = item;
        const kpi = await prisma.kPIs.findUnique({ where: { Id: KPIId } });
        if (!kpi) continue;

        const assignmentBatchId = parseUuidValue(AssignmentBatchId);

        const existingAssignment = await prisma.userKPIs.findFirst({
          where: {
            KPIId,
            UserId: userId,
            CycleYear: activeCycleYear,
            IsArchived: false,
          },
        });

        if (existingAssignment) {
          const updated = await prisma.userKPIs.update({
            where: { Id: existingAssignment.Id },
            data: {
              Baseline: Baseline !== undefined ? parseNumericValue(Baseline) : existingAssignment.Baseline,
              AssignedTarget: AssignedTarget !== undefined ? parseNumericValue(AssignedTarget) : existingAssignment.AssignedTarget,
              IsTargetIndividual: IsTargetIndividual !== undefined ? Boolean(IsTargetIndividual) : existingAssignment.IsTargetIndividual,
              IncludeCurrentOffice: IncludeCurrentOffice !== undefined ? Boolean(IncludeCurrentOffice) : existingAssignment.IncludeCurrentOffice,
              AssignmentBatchId: assignmentBatchId !== undefined ? assignmentBatchId : existingAssignment.AssignmentBatchId,
              Remark: Remark !== undefined ? Remark : existingAssignment.Remark,
            }
          });

          updateCount++;
          userKPIIds.push(existingAssignment.Id);
          kpiIds.push(KPIId);
          results.push(updated);
        } else {
          const computedBaseline =
            parseNumericValue(Baseline) ??
            (await computeBaselineFromPreviousCycle({
              KPIId,
              UserId: userId,
              cycleYear: activeCycleYear,
              fallbackBaseline: kpi.DefaultBaseline,
            }));

          const userKPI = await prisma.userKPIs.create({
            data: {
              KPIId,
              CycleYear: activeCycleYear,
              UserId: userId,
              Baseline: computedBaseline,
              AssignedTarget: parseNumericValue(AssignedTarget),
              IsTargetIndividual: Boolean(IsTargetIndividual),
              AssignmentBatchId: assignmentBatchId,
              Remark,
              CreatedBy: createdBy,
            }
          });

          newCount++;
          userKPIIds.push(userKPI.Id);
          kpiIds.push(KPIId);
          results.push(userKPI);
        }
      }

      if (newCount > 0 || updateCount > 0) {
        let messageText = '';
        let titleText = 'KPI Assignment Update';

        if (newCount > 0 && updateCount > 0) {
          titleText = 'New and updated KPI assignments';
          messageText = `${newCount} new KPI(s) assigned and ${updateCount} KPI assignment(s) updated for ${activeCycleYear}.`;
        } else if (newCount > 0) {
          titleText = newCount === 1 ? 'New KPI assignment' : 'New KPI assignments';
          messageText = newCount === 1 
            ? `A KPI has been assigned to you for ${activeCycleYear}.`
            : `${newCount} KPIs have been assigned to you for ${activeCycleYear}.`;
        } else if (updateCount > 0) {
          titleText = updateCount === 1 ? 'KPI assignment updated' : 'KPI assignments updated';
          messageText = updateCount === 1
            ? `Your KPI assignment was updated for ${activeCycleYear}.`
            : `${updateCount} KPI assignments were updated for ${activeCycleYear}.`;
        }

        notificationsToCreate.push({
          recipientUserId: userId,
          actorUserId: createdBy || null,
          type: 'kpi_assigned',
          title: titleText,
          message: messageText,
          priority: 'medium',
          data: {
            UserKPIIds: userKPIIds,
            KPIIds: kpiIds,
            CycleYear: activeCycleYear,
            AssignmentBatchId: userItems[0]?.AssignmentBatchId || null,
          },
        });
      }
    }

    for (const notif of notificationsToCreate) {
      try {
        await createNotification(notif);
      } catch (notifErr) {
        console.warn('Failed to create grouped KPI assignment notification:', notifErr.message);
      }
    }

    res.status(201).json({ success: true, count: results.length, data: results });
  } catch (error) {
    console.error('Bulk assign user KPIs error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export { 
  createUserKPI,
  getUserKPIs,
  getUserKPIById,
  updateUserKPI,
  deleteUserKPI,
  bulkDeleteUserKPIs,
  bulkAssignUserKPIs,
 };
