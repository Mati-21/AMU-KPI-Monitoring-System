import { prisma  } from '../../config/database.js';
import KPIClosureService from '../../services/KPIClosureService.js';
import { getCurrentCycleYear  } from '../../utils/kpiCycle.js';

const getCycleYears = async (req, res) => {
  try {
    const activeCycleYear = getCurrentCycleYear();

    const plans = await prisma.kPIYearPlans.findMany({
      select: { CycleYear: true, IsLocked: true, Status: true },
      orderBy: { CycleYear: 'desc' },
    });

    const statsByYear = new Map();
    plans.forEach((plan) => {
      const year = String(plan.CycleYear || '').trim();
      if (!year) return;
      const entry = statsByYear.get(year) || { total: 0, locked: 0, completed: 0 };
      entry.total += 1;
      if (plan.IsLocked) entry.locked += 1;
      if (plan.Status === 'COMPLETED') entry.completed += 1;
      statsByYear.set(year, entry);
    });

    const isClosedYear = (year) => {
      const entry = statsByYear.get(year);
      if (!entry || entry.total <= 0) return false;
      return entry.locked === entry.total || entry.completed === entry.total;
    };

    const years = [...new Set([...statsByYear.keys(), activeCycleYear])]
      .filter((year) => year === activeCycleYear || isClosedYear(year))
      .sort((a, b) => String(b).localeCompare(String(a)));

    res.json({ success: true, data: { activeCycleYear, years } });
  } catch (error) {
    console.error('Get Cycle Years error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getYearPlans = async (req, res) => {
  try {
    const { year } = req.query;
    const filter = year ? { CycleYear: year } : {};

    const plans = await prisma.kPIYearPlans.findMany({
      where: filter,
      include: {
        KPIs: {
          include: {
            KPITypes: { select: { KPIName: true } },
            Units: { select: { Code: true } },
          },
        },
      },
      orderBy: { CycleYear: 'desc' },
    });

    const mappedPlans = plans.map(p => {
      const mapped = { ...p };
      if (p.KPIs) {
        mapped.KPI = { ...p.KPIs };
        if (mapped.KPI.KPITypes) {
          mapped.KPI.KPIType = mapped.KPI.KPITypes;
          delete mapped.KPI.KPITypes;
        }
        if (mapped.KPI.Units) {
          mapped.KPI.Unit = mapped.KPI.Units;
          delete mapped.KPI.Units;
        }
        delete mapped.KPIs;
      }
      return mapped;
    });

    res.json({ success: true, data: mappedPlans });
  } catch (error) {
    console.error('Get Year Plans error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

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

const closeCycleYear = async (req, res) => {
  try {
    const cycleYear = req.body?.cycleYear || getCurrentCycleYear();

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

export { 
  getYearPlans,
  getCycleYears,
  getCycleReadiness,
  closeCycleYear,
  refreshPlanPerformance,
 };
