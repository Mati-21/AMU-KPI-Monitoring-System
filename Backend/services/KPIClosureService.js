const { KPI, KPIYearPlan, UserKPI, UserKPIResult, Role, UserRole, OfficeReportSubmission, sequelize } = require('../models');
const { getNextCycleYear, setActiveCycleYear } = require('../utils/kpiCycle');
const { Op } = require('sequelize');

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

    // Get all submitted OfficeReportSubmissions for this cycle
    const submissions = await OfficeReportSubmission.findAll({
      where: { CycleYear: cycleYear, IsArchived: false },
      attributes: ['SourceRoleId'],
    });
    const submittedRoleIds = new Set(submissions.map(s => String(s.SourceRoleId)));

    // All non-root roles must have submitted
    const nonRootRoles = allRoles.filter(r => r.ParentRoleId);
    const pendingRoles = nonRootRoles
      .filter(r => !submittedRoleIds.has(String(r.Id)))
      .map(r => r.RoleName || String(r.Id));

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
      // 1. "Clean" the current cycle: Archive all assignments, results, and submissions
      // This ensures the dashboards and performance pages are cleared for the new cycle.
      await UserKPI.update({ IsArchived: true }, { where: { CycleYear: cycleYear }, transaction });
      await UserKPIResult.update({ IsArchived: true }, { where: { CycleYear: cycleYear }, transaction });
      await OfficeReportSubmission.update({ IsArchived: true }, { where: { CycleYear: cycleYear }, transaction });

      // 2. Fetch all plans for the cycle year to finalize them
      const plans = await KPIYearPlan.findAll({
        where: { CycleYear: cycleYear, IsLocked: false },
        include: [{ model: KPI }],
        transaction,
      });

      const nextPlanByKpiId = new Map();

      for (const plan of plans) {
        // 2. Calculate Final Performance from approved/adjusted results
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
          const val = r.Status === 'adjusted' && r.AdjustedResult !== null
            ? Number(r.AdjustedResult)
            : Number(r.KPIResult);
          return sum + (isNaN(val) ? 0 : val);
        }, 0);

        plan.FinalPerformance = finalValue;
        plan.IsLocked = true;
        plan.Status = 'COMPLETED';
        await plan.save({ transaction });

        // 3. Apply KPI Lifecycle Rules
        const kpi = plan.KPI;
        let nextBaseline = 0;
        let nextTarget = plan.Target;
        let shouldCreateNextPlan = true;

        switch (kpi.LifecycleType) {
          case 'PROGRESSIVE':
            // Final performance becomes both baseline and target
            nextBaseline = finalValue;
            nextTarget = finalValue;
            break;

          case 'RECURRING':
            // Recursive: reset baseline to 0, use admin-defined default target
            nextBaseline = 0;
            nextTarget = Number(kpi.DefaultBaseline) || Number(plan.Target) || 0;
            break;

          case 'ONE_TIME':
            // One-time: does NOT carry forward
            kpi.IsArchived = true;
            await kpi.save({ transaction });
            shouldCreateNextPlan = false;
            break;

          default:
            nextBaseline = 0;
            nextTarget = plan.Target;
        }

        if (shouldCreateNextPlan && !kpi.IsArchived) {
          const existingNextPlan = await KPIYearPlan.findOne({
            where: { KPIId: kpi.Id, CycleYear: nextCycleYear },
            transaction,
          });

          if (!existingNextPlan) {
            const newPlan = await KPIYearPlan.create(
              {
                KPIId: kpi.Id,
                CycleYear: nextCycleYear,
                Baseline: nextBaseline,
                Target: nextTarget,
                Status: 'ACTIVE',
                IsLocked: false,
              },
              { transaction }
            );
            nextPlanByKpiId.set(String(kpi.Id), { nextBaseline, nextTarget, nextPlan: newPlan });
          } else {
            nextPlanByKpiId.set(String(kpi.Id), { nextBaseline, nextTarget, nextPlan: existingNextPlan });
          }
        }
      }

      // 4. Migrate UserKPI assignments to the new cycle
      await this.migrateUserKPIAssignments(cycleYear, nextCycleYear, nextPlanByKpiId, transaction);

      // 5. Update the active cycle year in DB + in-memory cache
      await setActiveCycleYear(nextCycleYear);

      await transaction.commit();
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
  async migrateUserKPIAssignments(cycleYear, nextCycleYear, nextPlanByKpiId, transaction) {
    // We look for assignments in the cycleYear that we just archived (or were already active)
    const oldAssignments = await UserKPI.findAll({
      where: { CycleYear: cycleYear },
      include: [{ model: KPI, attributes: ['Id', 'LifecycleType', 'IsArchived'] }],
      transaction,
    });

    for (const assignment of oldAssignments) {
      const kpi = assignment.KPI;
      if (!kpi || kpi.LifecycleType === 'ONE_TIME' || kpi.IsArchived) continue;

      // Check if a new assignment already exists for this user + KPI in the next cycle
      const existing = await UserKPI.findOne({
        where: { UserId: assignment.UserId, KPIId: assignment.KPIId, CycleYear: nextCycleYear },
        transaction,
      });
      if (existing) continue;

      const planData = nextPlanByKpiId.get(String(assignment.KPIId));
      const newBaseline = planData ? planData.nextBaseline : 0;
      const newTarget = planData ? planData.nextTarget : assignment.AssignedTarget;

      await UserKPI.create(
        {
          UserId: assignment.UserId,
          KPIId: assignment.KPIId,
          CycleYear: nextCycleYear,
          Baseline: newBaseline,
          AssignedTarget: newTarget,
          CreatedBy: assignment.CreatedBy,
          Name: assignment.Name,
          Remark: assignment.Remark,
          IsTargetIndividual: assignment.IsTargetIndividual,
          IncludeCurrentOffice: assignment.IncludeCurrentOffice,
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
