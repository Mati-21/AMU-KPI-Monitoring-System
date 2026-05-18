const { KPI, KPIYearPlan, UserKPI, UserKPIResult, Role, UserRole, OfficeReportSubmission, sequelize } = require('../models');
const { getNextCycleYear, setActiveCycleYear } = require('../utils/kpiCycle');
const { Op } = require('sequelize');

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
   * Conditions:
   *   1. Every child role (recursive) has submitted an OfficeReportSubmission.
   *   2. Every UserKPIResult for the cycle is approved or adjusted (not pending).
   *
   * @param {string} cycleYear - The cycle year to check (e.g. "2018")
   * @returns {{ ready: boolean, pendingRoles: string[], pendingResultCount: number }}
   */
  async checkCycleReadiness(cycleYear) {
    // Get all roles in the system (non-archived)
    const allRoles = await Role.findAll({ where: { IsArchived: false }, attributes: ['Id', 'RoleName', 'ParentRoleId'] });

    // Find all unique user IDs that received KPIs for this cycle year
    const activeAssignments = await UserKPI.findAll({
      where: { CycleYear: cycleYear, IsArchived: false },
      attributes: ['UserId'],
    });
    const assignedUserIds = [...new Set(activeAssignments.map((a) => String(a.UserId)))];

    // Find all roles associated with these assigned users
    let assignedRoleIds = new Set();
    if (assignedUserIds.length > 0) {
      const userRoles = await UserRole.findAll({
        where: { UserId: { [Op.in]: assignedUserIds }, IsArchived: false },
        attributes: ['RoleId'],
      });
      userRoles.forEach((ur) => assignedRoleIds.add(String(ur.RoleId)));
    }

    // Get all submitted OfficeReportSubmissions for this cycle.
    // A role is considered "fully submitted" only if it has submitted ALL four quarters.
    const submissions = await OfficeReportSubmission.findAll({
      where: { CycleYear: cycleYear, IsArchived: false },
      attributes: ['SourceRoleId', 'ReportPayload', 'SubmittedAt'],
      order: [['SubmittedAt', 'DESC']],
    });

    const submittedQuartersByRoleId = new Map();
    submissions.forEach((s) => {
      const roleId = String(s.SourceRoleId);
      const quarter = safeParseQuarterFromSubmission(s);
      if (!quarter || !QUARTERS.includes(quarter)) return;
      if (!submittedQuartersByRoleId.has(roleId)) submittedQuartersByRoleId.set(roleId, new Set());
      submittedQuartersByRoleId.get(roleId).add(quarter);
    });

    // Only non-root roles that HAVE received a KPI are required to submit
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

    // Check for any pending KPI results this cycle
    const pendingResultCount = await UserKPIResult.count({
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
   * @param {string} cycleYear - The year to close (e.g. "2018")
   */
  async closeYear(cycleYear) {
    const nextCycleYear = getNextCycleYear(cycleYear);
    if (!nextCycleYear) throw new Error(`Invalid cycle year: ${cycleYear}`);

    const transaction = await sequelize.transaction();

    try {
      // 1. Finalize and lock the current cycle year plans (marks the cycle as "Closed").
      // NOTE: We intentionally do NOT archive/delete UserKPI, UserKPIResult, or OfficeReportSubmission
      // rows for the closing year so historical dashboards and reports remain accessible by year.
      const plans = await KPIYearPlan.findAll({
        where: { CycleYear: cycleYear },
        include: [{ model: KPI }],
        transaction,
      });

      const nextPlanByKpiId = new Map();

      for (const plan of plans) {
        // Skip already-locked plans to make this operation idempotent.
        if (plan.IsLocked || plan.Status === 'COMPLETED') {
          continue;
        }

        // Calculate Final Performance from approved/adjusted results (never from archived rows)
        const approvedResults = await UserKPIResult.findAll({
          where: {
            KPIId: plan.KPIId,
            CycleYear: cycleYear,
            IsArchived: false,
            Status: { [Op.in]: ['approved', 'adjusted'] },
          },
          attributes: ['KPIResult', 'AdjustedResult', 'Status'],
          transaction,
        });

        const finalValue = approvedResults.reduce((sum, r) => {
          const rawValue = r.Status === 'adjusted' && r.AdjustedResult !== null ? r.AdjustedResult : r.KPIResult;
          const numeric = parseNumeric(rawValue);
          return sum + (numeric === null ? 0 : numeric);
        }, 0);

        plan.FinalPerformance = finalValue;
        plan.IsLocked = true;
        plan.Status = 'COMPLETED';
        await plan.save({ transaction });

        // Apply KPI Lifecycle Rules to compute next year plan baseline/target
        const kpi = plan.KPI;
        if (!kpi) continue;

        // Expired KPIs (inactive) do not carry forward into the next active cycle.
        if (kpi.IsActive === false || kpi.IsArchived === true) {
          continue;
        }

        let nextBaseline = 0;
        let nextTarget = plan.Target;
        let shouldCarryForward = true;

        switch (kpi.LifecycleType) {
          case 'PROGRESSIVE':
            // Final performance becomes both baseline and target
            nextBaseline = finalValue;
            nextTarget = finalValue;
            break;

          case 'RECURRING':
            // Recurring: reset baseline to 0, reset target to the KPI's default (fallback to current plan)
            nextBaseline = 0;
            nextTarget = parseNumeric(kpi.DefaultBaseline) ?? parseNumeric(plan.Target) ?? 0;
            break;

          case 'ONE_TIME':
            // One-time: archive and do NOT carry forward
            kpi.IsArchived = true;
            await kpi.save({ transaction });
            shouldCarryForward = false;
            break;

          default:
            nextBaseline = 0;
            nextTarget = plan.Target;
        }

        if (!shouldCarryForward || kpi.IsArchived) {
          continue;
        }

        const existingNextPlan = await KPIYearPlan.findOne({
          where: { KPIId: kpi.Id, CycleYear: nextCycleYear },
          transaction,
        });

        const nextPlan =
          existingNextPlan ||
          (await KPIYearPlan.create(
            {
              KPIId: kpi.Id,
              CycleYear: nextCycleYear,
              Baseline: nextBaseline,
              Target: nextTarget,
              Status: 'ACTIVE',
              IsLocked: false,
            },
            { transaction }
          ));

        nextPlanByKpiId.set(String(kpi.Id), { nextBaseline, nextTarget, nextPlan });
      }

      // 2. Ensure the next cycle has KPIYearPlans for ALL active (non-archived) KPIs.
      // This covers newly registered KPIs and avoids gaps if a KPI had no plan in the closing year.
      const activeKpis = await KPI.findAll({
        where: { IsArchived: false, IsActive: true },
        attributes: ['Id', 'LifecycleType', 'DefaultBaseline'],
        transaction,
      });

      for (const kpi of activeKpis) {
        if (kpi.LifecycleType === 'ONE_TIME') continue;
        const kpiId = String(kpi.Id);
        if (nextPlanByKpiId.has(kpiId)) continue;

        const existing = await KPIYearPlan.findOne({
          where: { KPIId: kpi.Id, CycleYear: nextCycleYear },
          transaction,
        });
        if (existing) {
          nextPlanByKpiId.set(kpiId, { nextBaseline: existing.Baseline, nextTarget: existing.Target, nextPlan: existing });
          continue;
        }

        const lastPlan = await KPIYearPlan.findOne({
          where: { KPIId: kpi.Id },
          order: [['CycleYear', 'DESC']],
          transaction,
        });

        const baseline = 0;
        const target = parseNumeric(kpi.DefaultBaseline) ?? parseNumeric(lastPlan?.Target) ?? 0;

        const created = await KPIYearPlan.create(
          {
            KPIId: kpi.Id,
            CycleYear: nextCycleYear,
            Baseline: baseline,
            Target: target,
            Status: 'ACTIVE',
            IsLocked: false,
          },
          { transaction }
        );
        nextPlanByKpiId.set(kpiId, { nextBaseline: created.Baseline, nextTarget: created.Target, nextPlan: created });
      }

      // 3. Regenerate UserKPI assignments for the new cycle.
      // We base this on the closing cycle's existing assignments and apply lifecycle/expiry rules.
      await this.regenerateUserKPIAssignmentsForNewCycle(cycleYear, nextCycleYear, nextPlanByKpiId, transaction);

      await transaction.commit();
      // Update the active cycle year in DB + in-memory cache AFTER data is committed.
      await setActiveCycleYear(nextCycleYear);
      return { success: true, closedPlansCount: plans.length, nextCycleYear };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Migrate UserKPI assignments from old cycle to new cycle.
   * Skips ONE_TIME KPIs. Uses updated baseline/target from new KPIYearPlan.
   */
  async regenerateUserKPIAssignmentsForNewCycle(cycleYear, nextCycleYear, nextPlanByKpiId, transaction) {
    const oldAssignments = await UserKPI.findAll({
      where: { CycleYear: cycleYear, IsArchived: false },
      include: [{ model: KPI, attributes: ['Id', 'LifecycleType', 'IsArchived', 'IsActive'] }],
      transaction,
    });

    for (const assignment of oldAssignments) {
      const kpi = assignment.KPI;
      if (!kpi) continue;
      if (kpi.IsArchived || kpi.IsActive === false || kpi.LifecycleType === 'ONE_TIME') continue;

      const existing = await UserKPI.findOne({
        where: { UserId: assignment.UserId, KPIId: assignment.KPIId, CycleYear: nextCycleYear, IsArchived: false },
        transaction,
      });
      if (existing) continue;

      const planData = nextPlanByKpiId.get(String(assignment.KPIId));
      const newBaseline = planData ? planData.nextBaseline : 0;
      const newTarget = planData ? planData.nextTarget : assignment.AssignedTarget;
      const nextPlanId = planData?.nextPlan?.Id || null;

      await UserKPI.create(
        {
          UserId: assignment.UserId,
          KPIId: assignment.KPIId,
          KPIYearPlanId: nextPlanId,
          CycleYear: nextCycleYear,
          Baseline: newBaseline,
          AssignedTarget: newTarget,
          CreatedBy: assignment.CreatedBy,
          Name: assignment.Name,
          Remark: assignment.Remark,
          IsTargetIndividual: assignment.IsTargetIndividual,
          IncludeCurrentOffice: assignment.IncludeCurrentOffice,
          AssignmentBatchId: assignment.AssignmentBatchId || null,
          IsArchived: false,
        },
        { transaction }
      );
    }
  }

  /**
   * Manually calculate and update final performance for a plan.
   */
  async refreshFinalPerformance(planId) {
    const plan = await KPIYearPlan.findByPk(planId);
    if (!plan) throw new Error('Plan not found');

    const totalResult = await UserKPIResult.sum('KPIResult', {
      where: {
        KPIId: plan.KPIId,
        CycleYear: plan.CycleYear,
        IsArchived: false,
      },
    });

    plan.FinalPerformance = totalResult || 0;
    await plan.save();
    return plan;
  }
}

module.exports = new KPIClosureService();
