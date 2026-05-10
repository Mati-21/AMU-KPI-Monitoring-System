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

const closeCycleYear = async (req, res) => {
  try {
    const { cycleYear, nextCycleYear } = req.body;
    if (!cycleYear || !nextCycleYear) {
      return res.status(400).json({ message: 'Both current cycle year and next cycle year are required.' });
    }

    const result = await KPIClosureService.closeYear(cycleYear, nextCycleYear);
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
  closeCycleYear,
  refreshPlanPerformance
};
