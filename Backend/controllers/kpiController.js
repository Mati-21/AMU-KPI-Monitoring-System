const { KPI, KPIType, Unit, KPIYearPlan } = require('../models');
const { getCurrentCycleYear } = require('../utils/kpiCycle');

const parseNumericValue = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalized = String(value).trim().replace(/,/g, '').replace(/%/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const createKPI = async (req, res) => {
  try {
    const { KPITypeId, UnitId, Weight, Baseline, Target, Description, IsEvedenceRequired, Remark, LifecycleType, DefaultBaseline } = req.body;
    const parsedWeight = parseNumericValue(Weight);
    const parsedBaseline = parseNumericValue(Baseline);
    const parsedTarget = parseNumericValue(Target);
    const parsedDefaultBaseline = parseNumericValue(DefaultBaseline);

    if (parsedWeight === null || parsedTarget === null) {
      return res.status(400).json({ message: 'Weight and Target must be valid numbers.' });
    }

    if (parsedWeight < 0 || parsedWeight > 100) {
      return res.status(400).json({ message: 'Weight must be between 0 and 100.' });
    }

    const kpiType = await KPIType.findByPk(KPITypeId);
    if (!kpiType) {
      return res.status(404).json({ message: 'KPI type not found' });
    }

    const unit = await Unit.findByPk(UnitId);
    if (!unit) {
      return res.status(404).json({ message: 'Unit not found' });
    }

    const kpi = await KPI.create({
      KPITypeId,
      UnitId,
      LifecycleType: LifecycleType || 'RECURRING',
      Weight: parsedWeight,
      DefaultBaseline: parsedDefaultBaseline !== null ? parsedDefaultBaseline : LifecycleType === 'RECURRING' ? 0 : parsedBaseline,
      Description,
      IsEvedenceRequired: IsEvedenceRequired || false,
      Remark,
      CreatedBy: req.user?.Id,
    });

    // Automatically create the first Year Plan
    await KPIYearPlan.create({
      KPIId: kpi.Id,
      CycleYear: getCurrentCycleYear(),
      Baseline: parsedBaseline || 0,
      Target: parsedTarget,
      Status: 'ACTIVE',
      IsLocked: false,
    });

    res.status(201).json({ success: true, data: kpi });
  } catch (error) {
    console.error('Create KPI error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getKPIs = async (req, res) => {
  try {
    const activeYear = getCurrentCycleYear();
    const selectedYear = req.query?.year || req.query?.cycleYear || activeYear;
    const kpis = await KPI.findAll({
      where: { IsArchived: false },
      include: [
        {
          model: KPIType,
          attributes: ['Id', 'KPIName', 'ParentKPIID'],
          include: [
            {
              model: KPIType,
              as: 'ParentKPI',
              attributes: ['Id', 'KPIName', 'ParentKPIID'],
              include: [
                {
                  model: KPIType,
                  as: 'ParentKPI',
                  attributes: ['Id', 'KPIName'],
                },
              ],
            },
          ],
        },
        { model: Unit, attributes: ['Id', 'Name', 'Code'] },
        {
          model: KPIYearPlan,
          attributes: ['Id', 'CycleYear', 'Baseline', 'Target', 'FinalPerformance', 'Status', 'IsLocked'],
          order: [['CycleYear', 'DESC']],
        },
      ],
      order: [['CreatedAt', 'ASC']],
    });

    const formattedKpis = kpis.map((kpi) => {
      const kpiJson = kpi.toJSON();
      const planForSelectedYear = kpiJson.KPIYearPlans?.find((p) => p.CycleYear === selectedYear) || null;
      const fallbackPlan = selectedYear === activeYear ? kpiJson.KPIYearPlans?.[0] || null : null;
      const currentPlan = planForSelectedYear || fallbackPlan;
      kpiJson.Baseline = currentPlan?.Baseline ?? kpiJson.DefaultBaseline ?? 0;
      kpiJson.Target = currentPlan?.Target ?? 0;
      return kpiJson;
    });

    res.json({ success: true, data: formattedKpis });
  } catch (error) {
    console.error('Get KPIs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getKPIById = async (req, res) => {
  try {
    const { id } = req.params;
    const activeYear = getCurrentCycleYear();
    const selectedYear = req.query?.year || req.query?.cycleYear || activeYear;
    const kpi = await KPI.findByPk(id, {
      include: [
        {
          model: KPIType,
          attributes: ['Id', 'KPIName', 'ParentKPIID'],
          include: [
            {
              model: KPIType,
              as: 'ParentKPI',
              attributes: ['Id', 'KPIName', 'ParentKPIID'],
              include: [
                {
                  model: KPIType,
                  as: 'ParentKPI',
                  attributes: ['Id', 'KPIName'],
                },
              ],
            },
          ],
        },
        { model: Unit, attributes: ['Id', 'Name', 'Code'] },
        {
          model: KPIYearPlan,
          attributes: ['Id', 'CycleYear', 'Baseline', 'Target', 'FinalPerformance', 'Status', 'IsLocked'],
        },
      ],
    });

    if (!kpi) {
      return res.status(404).json({ message: 'KPI not found' });
    }

    const kpiJson = kpi.toJSON();
    const planForSelectedYear = kpiJson.KPIYearPlans?.find((p) => p.CycleYear === selectedYear) || null;
    const fallbackPlan = selectedYear === activeYear ? kpiJson.KPIYearPlans?.[0] || null : null;
    const currentPlan = planForSelectedYear || fallbackPlan;
    kpiJson.Baseline = currentPlan?.Baseline ?? kpiJson.DefaultBaseline ?? 0;
    kpiJson.Target = currentPlan?.Target ?? 0;

    res.json({ success: true, data: kpiJson });
  } catch (error) {
    console.error('Get KPI error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateKPI = async (req, res) => {
  try {
    const { KPITypeId, UnitId, Weight, Baseline, Target, Description, IsEvedenceRequired, Remark, LifecycleType, DefaultBaseline } = req.body;
    const parsedWeight = parseNumericValue(Weight);
    const parsedBaseline = parseNumericValue(Baseline);
    const parsedTarget = parseNumericValue(Target);
    const parsedDefaultBaseline = parseNumericValue(DefaultBaseline);

    const kpi = await KPI.findByPk(id);
    if (!kpi) {
      return res.status(404).json({ message: 'KPI not found' });
    }

    if (KPITypeId) {
      const kpiType = await KPIType.findByPk(KPITypeId);
      if (!kpiType) {
        return res.status(404).json({ message: 'KPI type not found' });
      }
    }

    if (UnitId) {
      const unit = await Unit.findByPk(UnitId);
      if (!unit) {
        return res.status(404).json({ message: 'Unit not found' });
      }
    }

    if (parsedWeight === null) {
      return res.status(400).json({ message: 'Weight must be a valid number.' });
    }

    if (parsedWeight < 0 || parsedWeight > 100) {
      return res.status(400).json({ message: 'Weight must be between 0 and 100.' });
    }

    await kpi.update({
      KPITypeId,
      UnitId,
      LifecycleType,
      Weight: parsedWeight,
      DefaultBaseline: parsedDefaultBaseline,
      Description,
      IsEvedenceRequired,
      Remark,
    });

    // Update the current year plan if baseline/target provided
    if (parsedBaseline !== null || parsedTarget !== null) {
      const currentYear = getCurrentCycleYear();
      const plan = await KPIYearPlan.findOne({
        where: { KPIId: id, CycleYear: currentYear },
      });

      if (plan && !plan.IsLocked) {
        await plan.update({
          Baseline: parsedBaseline !== null ? parsedBaseline : plan.Baseline,
          Target: parsedTarget !== null ? parsedTarget : plan.Target,
        });
      }
    }

    res.json({ success: true, data: kpi });
  } catch (error) {
    console.error('Update KPI error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteKPI = async (req, res) => {
  try {
    const { id } = req.params;
    const kpi = await KPI.findByPk(id);
    if (!kpi) {
      return res.status(404).json({ message: 'KPI not found' });
    }

    await kpi.update({ IsArchived: true });

    res.json({ success: true, message: 'KPI archived successfully' });
  } catch (error) {
    console.error('Delete KPI error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createKPI,
  getKPIs,
  getKPIById,
  updateKPI,
  deleteKPI,
};
