const { KPIYearPlan, KPI, KPIType, Unit } = require('../models');
const KPIClosureService = require('../services/KPIClosureService');
const { getCurrentCycleYear } = require('../utils/kpiCycle');

const getYearPlans = async (req, res) => {
  try {
    const { year } = req.query;
    const filter = year ? { CycleYear: year } : {};

    const plans = await KPIYearPlan.findAll({
      where: filter,
      include: [
        {
          model: KPI,
          include: [
            { model: KPIType, attributes: ['KPIName'] },
            { model: Unit, attributes: ['Code'] }
          ]
        }
      ],
      order: [['CycleYear', 'DESC']]
    });

    res.json({ success: true, data: plans });
  } catch (error) {
    console.error('Get Year Plans error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /kpi-year-plans/cycle-readiness
 * Returns whether all reports are submitted and all results approved for the current cycle.
 */
const getCycleReadiness = async (req, res) => {
  try {
    const cycleYear = req.query.cycleYear || getCurrentCycleYear();
    const readiness = await KPIClosureService.checkCycleReadiness(cycleYear);
    res.json({ success: true, data: { cycleYear, ...readiness } });
  } catch (error) {
    console.error('Cycle Readiness error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * POST /kpi-year-plans/close-year
 * Close the current cycle and create the next one.
 * Body: { cycleYear? } — defaults to current active cycle year.
 */
const closeCycleYear = async (req, res) => {
  try {
    const cycleYear = req.body?.cycleYear || getCurrentCycleYear();

    // Enforce readiness check before closing
    const readiness = await KPIClosureService.checkCycleReadiness(cycleYear);
    if (!readiness.ready) {
      return res.status(400).json({
        message: 'Cycle cannot be closed. All reports must be submitted and all KPI results must be approved.',
        data: readiness,
      });
    }

    const result = await KPIClosureService.closeYear(cycleYear);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Close Cycle Year error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const refreshPlanPerformance = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await KPIClosureService.refreshFinalPerformance(id);
    res.json({ success: true, data: plan });
  } catch (error) {
    console.error('Refresh Plan Performance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getYearPlans,
  getCycleReadiness,
  closeCycleYear,
  refreshPlanPerformance
};
