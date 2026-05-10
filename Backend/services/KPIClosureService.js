const { KPI, KPIYearPlan, UserKPI, UserKPIResult, sequelize } = require('../models');
const { getPreviousCycleYear, getCurrentCycleYear } = require('../utils/kpiCycle');
const { Op } = require('sequelize');

class KPIClosureService {
  /**
   * Closes a cycle year and prepares the next one.
   * @param {string} cycleYear - The year to close (e.g., "2024-2025")
   * @param {string} nextCycleYear - The next year to initialize
   */
  async closeYear(cycleYear, nextCycleYear) {
    const transaction = await sequelize.transaction();

    try {
      // 1. Fetch all active plans for the cycle year
      const plans = await KPIYearPlan.findAll({
        where: { CycleYear: cycleYear, IsLocked: false },
        include: [{ model: KPI }],
        transaction,
      });

      for (const plan of plans) {
        // 2. Calculate Final Performance
        // Sum of all quarterly results for this KPI in this year
        const totalResult = await UserKPIResult.sum('KPIResult', {
          where: {
            KPIId: plan.KPIId,
            CycleYear: cycleYear,
            IsArchived: false,
          },
          transaction,
        });

        const finalValue = totalResult || 0;
        plan.FinalPerformance = finalValue;
        plan.IsLocked = true;
        plan.Status = 'COMPLETED';
        await plan.save({ transaction });

        // 3. Apply Lifecycle Logic for Next Year
        const kpi = plan.KPI;
        let nextBaseline = 0;
        let shouldCreateNextPlan = true;

        switch (kpi.LifecycleType) {
          case 'RECURRING':
            nextBaseline = kpi.DefaultBaseline || 0;
            break;
          case 'PROGRESSIVE':
            nextBaseline = finalValue;
            break;
          case 'ONE_TIME':
            if (finalValue >= plan.Target) {
              kpi.IsActive = false;
              await kpi.save({ transaction });
              shouldCreateNextPlan = false;
            } else {
              nextBaseline = plan.Baseline; // Continue with same baseline
            }
            break;
          default:
            nextBaseline = 0;
        }

        if (shouldCreateNextPlan && kpi.IsActive) {
          // Check if next plan already exists to avoid duplicates
          const existingNextPlan = await KPIYearPlan.findOne({
            where: { KPIId: kpi.Id, CycleYear: nextCycleYear },
            transaction,
          });

          if (!existingNextPlan) {
            await KPIYearPlan.create(
              {
                KPIId: kpi.Id,
                CycleYear: nextCycleYear,
                Baseline: nextBaseline,
                Target: plan.Target, // Default to same target, admin can adjust later
                Status: 'ACTIVE',
                IsLocked: false,
              },
              { transaction }
            );
          }
        }

      }

      await transaction.commit();
      return { success: true, closedPlansCount: plans.length };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Manually calculate and update final performance for a plan
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
