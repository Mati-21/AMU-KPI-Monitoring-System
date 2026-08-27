import { prisma  } from '../config/database.js';
import { getNextCycleYear, setActiveCycleYear  } from '../utils/kpiCycle.js';

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

const safeParseQuarterFromSubmission = (submission) => {
  if (!submission) return null;
  const payload = submission.ReportPayload || {};
  if (payload.quarter) {
    return String(payload.quarter).trim().toUpperCase();
  }
  const rows = payload.rows || [];
  for (const r of rows) {
    const qList = r.allQuarterlyResults || r.quarterlyResults || [];
    if (qList.length > 0 && qList[0].Quarter) {
      return String(qList[0].Quarter).trim().toUpperCase();
    }
  }
  return null;
};

const parseNumeric = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(String(value).trim());
  return Number.isFinite(numeric) ? numeric : null;
};

class KPIClosureService {
  /**
   * Check whether the current cycle is ready to close.
   */
  async checkCycleReadiness(cycleYear) {
    const allRoles = await prisma.roles.findMany({
      where: { IsArchived: false },
      select: { Id: true, RoleName: true, ParentRoleId: true }
    });

    const activeAssignments = await prisma.userKPIs.findMany({
      where: { CycleYear: cycleYear, IsArchived: false },
      select: { UserId: true },
    });
    const assignedUserIds = [...new Set(activeAssignments.map((a) => String(a.UserId)))];

    let assignedRoleIds = new Set();
    if (assignedUserIds.length > 0) {
      const userRoles = await prisma.userRoles.findMany({
        where: { UserId: { in: assignedUserIds }, IsArchived: false },
        select: { RoleId: true },
      });
      userRoles.forEach((ur) => assignedRoleIds.add(String(ur.RoleId)));
    }

    const submissions = await prisma.officeReportSubmissions.findMany({
      where: { CycleYear: cycleYear, IsArchived: false },
      select: { SourceRoleId: true, ReportPayload: true, SubmittedAt: true },
      orderBy: { SubmittedAt: 'desc' },
    });

    const submittedQuartersByRoleId = new Map();
    submissions.forEach((s) => {
      const roleId = String(s.SourceRoleId);
      const quarter = safeParseQuarterFromSubmission(s);
      if (!quarter || !QUARTERS.includes(quarter)) return;
      if (!submittedQuartersByRoleId.has(roleId)) submittedQuartersByRoleId.set(roleId, new Set());
      submittedQuartersByRoleId.get(roleId).add(quarter);
    });

    const nonRootRoles = allRoles.filter((r) => r.ParentRoleId);
    const pendingRoles = nonRootRoles
      .filter((r) => {
        const roleId = String(r.Id);
        if (!assignedRoleIds.has(roleId)) return false;
        const qSet = submittedQuartersByRoleId.get(roleId) || new Set();
        return QUARTERS.some((q) => !qSet.has(q));
      })
      .map((r) => {
        const roleId = String(r.Id);
        const qSet = submittedQuartersByRoleId.get(roleId) || new Set();
        const missing = QUARTERS.filter((q) => !qSet.has(q));
        const label = r.RoleName || roleId;
        return missing.length ? `${label} (missing: ${missing.join(', ')})` : label;
      });

    const pendingResultCount = await prisma.userKPIResults.count({
      where: {
        CycleYear: cycleYear,
        IsArchived: false,
        Status: 'pending',
      },
    });

    return {
      ready: pendingRoles.length === 0 && pendingResultCount === 0,
      pendingRoles,
      pendingResultCount,
    };
  }

  /**
   * Closes a cycle year and prepares the next one.
   */
  async closeYear(cycleYear) {
    const nextCycleYear = getNextCycleYear(cycleYear);
    if (!nextCycleYear) throw new Error(`Invalid cycle year: ${cycleYear}`);

    return await prisma.$transaction(async (tx) => {
      const plans = await tx.kPIYearPlans.findMany({
        where: { CycleYear: cycleYear },
        include: { KPIs: true },
      });

      for (const plan of plans) {
        if (plan.IsLocked || plan.Status === 'COMPLETED') {
          continue;
        }

        const approvedResults = await tx.userKPIResults.findMany({
          where: {
            KPIId: plan.KPIId,
            CycleYear: cycleYear,
            IsArchived: false,
            Status: { in: ['approved', 'adjusted'] },
          },
          select: { KPIResult: true, AdjustedResult: true, Status: true },
        });

        const finalValue = approvedResults.reduce((sum, r) => {
          const rawValue = r.Status === 'adjusted' && r.AdjustedResult !== null ? r.AdjustedResult : r.KPIResult;
          const numeric = parseNumeric(rawValue);
          return sum + (numeric === null ? 0 : numeric);
        }, 0);

        await tx.kPIYearPlans.update({
          where: { Id: plan.Id },
          data: {
            FinalPerformance: finalValue,
            IsLocked: true,
            Status: 'COMPLETED'
          }
        });

        const kpi = plan.KPIs;
        if (kpi && kpi.LifecycleType === 'ONE_TIME') {
          await tx.kPIs.update({
            where: { Id: kpi.Id },
            data: { IsArchived: true }
          });
        }
      }

      await tx.userKPIs.updateMany({
        where: { CycleYear: cycleYear },
        data: { IsArchived: true }
      });

      await setActiveCycleYear(nextCycleYear);
      return { success: true, closedPlansCount: plans.length, nextCycleYear };
    });
  }

  /**
   * Manually calculate and update final performance for a plan.
   */
  async refreshFinalPerformance(planId) {
    const plan = await prisma.kPIYearPlans.findUnique({ where: { Id: planId } });
    if (!plan) throw new Error('Plan not found');

    const aggregate = await prisma.userKPIResults.aggregate({
      _sum: { KPIResult: true },
      where: {
        KPIId: plan.KPIId,
        CycleYear: plan.CycleYear,
        IsArchived: false,
      },
    });

    const totalResult = aggregate._sum.KPIResult;

    const updatedPlan = await prisma.kPIYearPlans.update({
      where: { Id: planId },
      data: { FinalPerformance: totalResult || 0 }
    });
    return updatedPlan;
  }
}

export default new KPIClosureService();
