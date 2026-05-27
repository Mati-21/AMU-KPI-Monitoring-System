const { KPI, KPIType, Unit, KPIYearPlan, sequelize } = require('../models');
const { Op } = require('sequelize');
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
    const { KPITypeId, UnitId, Weight, Baseline, Target, Description, IsEvedenceRequired, Remark, CycleYear } = req.body;
    const parsedWeight = parseNumericValue(Weight);
    const parsedBaseline = parseNumericValue(Baseline);
    const parsedTarget = parseNumericValue(Target);

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
      LifecycleType: 'RECURRING',
      Weight: parsedWeight,
      DefaultBaseline: 0,
      Description,
      IsEvedenceRequired: IsEvedenceRequired || false,
      Remark,
      CreatedBy: req.user?.Id,
    });

    // Automatically create the first Year Plan for the specified Cycle Year
    await KPIYearPlan.create({
      KPIId: kpi.Id,
      CycleYear: CycleYear || getCurrentCycleYear(),
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
    const includeArchived = req.query?.includeArchived === 'true';

    const whereClause = {};
    if (!includeArchived) {
      whereClause.IsArchived = false;
    }

    const kpis = await KPI.findAll({
      where: whereClause,
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

    const { KPITypeId } = kpi;

    // Delete associated records first to avoid foreign key violations
    const { UserKPI, UserKPIResult, KPIYearPlan, KPIDocument, KPIType } = require('../models');

    await UserKPIResult.destroy({ where: { KPIId: id } });
    await UserKPI.destroy({ where: { KPIId: id } });
    await KPIYearPlan.destroy({ where: { KPIId: id } });
    await KPIDocument.destroy({ where: { KPIId: id } });

    await kpi.destroy();

    if (KPITypeId) {
      await KPIType.destroy({ where: { Id: KPITypeId } });
    }

    res.json({ success: true, message: 'KPI permanently deleted successfully' });
  } catch (error) {
    console.error('Delete KPI error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteAllKPIs = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { UserKPI, UserKPIResult, KPIYearPlan, KPIDocument } = require('../models');

    // Get all KPI ids and their KPITypeIds
    const allKpis = await KPI.findAll({ attributes: ['Id', 'KPITypeId'], transaction });
    const kpiIds = allKpis.map(k => k.Id);
    const kpiTypeIds = allKpis.map(k => k.KPITypeId).filter(Boolean);

    if (kpiIds.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'No KPIs found to delete.' });
    }

    // Delete all associated records
    await UserKPIResult.destroy({ where: { KPIId: { [Op.in]: kpiIds } }, transaction });
    await UserKPI.destroy({ where: { KPIId: { [Op.in]: kpiIds } }, transaction });
    await KPIYearPlan.destroy({ where: { KPIId: { [Op.in]: kpiIds } }, transaction });
    await KPIDocument.destroy({ where: { KPIId: { [Op.in]: kpiIds } }, transaction });

    // Delete all KPIs
    await KPI.destroy({ where: { Id: { [Op.in]: kpiIds } }, transaction });

    // Delete orphaned KPITypes that were linked to these KPIs
    if (kpiTypeIds.length > 0) {
      await KPIType.destroy({ where: { Id: { [Op.in]: kpiTypeIds } }, transaction });
    }

    await transaction.commit();
    res.json({ success: true, message: `Successfully deleted ${kpiIds.length} KPIs and all associated records.`, count: kpiIds.length });
  } catch (error) {
    await transaction.rollback();
    console.error('Delete all KPIs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const importKPIs = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { kpis } = req.body;
    if (!kpis || !Array.isArray(kpis)) {
      return res.status(400).json({ message: 'Request body must contain an array of KPIs under "kpis" key.' });
    }

    const report = {
      total: kpis.length,
      imported: 0,
      errors: []
    };

    const currentYear = getCurrentCycleYear();

    for (let i = 0; i < kpis.length; i++) {
      const item = kpis[i];
      const rowNum = i + 1;

      try {
        const {
          kpiName,
          theme,
          subTheme,
          unit,
          weight,
          baseline,
          target,
          lifecycleType,
          defaultBaseline,
          description,
          remark,
          isEvidenceRequired
        } = item;

        if (!kpiName || !String(kpiName).trim()) throw new Error(`KPI Name is required.`);
        if (!theme || !String(theme).trim()) throw new Error(`Theme is required.`);
        if (!subTheme || !String(subTheme).trim()) throw new Error(`Sub-Theme is required.`);
        if (!unit || !String(unit).trim()) throw new Error(`Unit is required.`);

        const parsedWeight = parseNumericValue(weight);
        const parsedTarget = parseNumericValue(target);
        const parsedBaseline = parseNumericValue(baseline) ?? 0;
        const parsedDefaultBaseline = parseNumericValue(defaultBaseline);

        if (parsedWeight === null || parsedTarget === null) {
          throw new Error(`Weight and Target must be valid numbers.`);
        }

        if (parsedWeight < 0 || parsedWeight > 100) {
          throw new Error(`Weight must be between 0 and 100.`);
        }

        // 1. Theme
        let themeType = await KPIType.findOne({
          where: sequelize.where(
            sequelize.fn('lower', sequelize.col('KPIName')),
            String(theme).trim().toLowerCase()
          ),
          transaction
        });
        if (!themeType) {
          themeType = await KPIType.create({ KPIName: String(theme).trim(), ParentKPIID: null }, { transaction });
        }

        // 2. Sub-Theme
        let subThemeType = await KPIType.findOne({
          where: {
            ParentKPIID: themeType.Id,
            [Op.and]: sequelize.where(
              sequelize.fn('lower', sequelize.col('KPIName')),
              String(subTheme).trim().toLowerCase()
            )
          },
          transaction
        });
        if (!subThemeType) {
          subThemeType = await KPIType.create({ KPIName: String(subTheme).trim(), ParentKPIID: themeType.Id }, { transaction });
        }

        // 3. KPI Category
        let kpiType = await KPIType.findOne({
          where: {
            ParentKPIID: subThemeType.Id,
            [Op.and]: sequelize.where(
              sequelize.fn('lower', sequelize.col('KPIName')),
              String(kpiName).trim().toLowerCase()
            )
          },
          transaction
        });
        if (!kpiType) {
          kpiType = await KPIType.create({ KPIName: String(kpiName).trim(), ParentKPIID: subThemeType.Id }, { transaction });
        }

        // 4. Unit
        let unitObj = await Unit.findOne({
          where: {
            [Op.or]: [
              sequelize.where(sequelize.fn('lower', sequelize.col('Code')), String(unit).trim().toLowerCase()),
              sequelize.where(sequelize.fn('lower', sequelize.col('Name')), String(unit).trim().toLowerCase())
            ]
          },
          transaction
        });
        if (!unitObj) {
          unitObj = await Unit.create({ Name: String(unit).trim(), Code: String(unit).trim().toUpperCase() }, { transaction });
        }

        // 5. KPI Catalog
        const activeLifecycle = lifecycleType || 'RECURRING';
        let kpi = await KPI.findOne({
          where: { KPITypeId: kpiType.Id, UnitId: unitObj.Id },
          transaction
        });
        if (!kpi) {
          kpi = await KPI.create({
            KPITypeId: kpiType.Id,
            UnitId: unitObj.Id,
            LifecycleType: activeLifecycle,
            Weight: parsedWeight,
            DefaultBaseline: parsedDefaultBaseline !== null ? parsedDefaultBaseline : (activeLifecycle === 'RECURRING' ? 0 : parsedBaseline),
            Description: description || null,
            Remark: remark || null,
            IsEvedenceRequired: isEvidenceRequired === true || isEvidenceRequired === 'true' || isEvidenceRequired === 'Yes' || isEvidenceRequired === 'yes',
            CreatedBy: req.user?.Id
          }, { transaction });
        } else {
          await kpi.update({
            LifecycleType: activeLifecycle,
            Weight: parsedWeight,
            DefaultBaseline: parsedDefaultBaseline !== null ? parsedDefaultBaseline : kpi.DefaultBaseline,
            Description: description || kpi.Description,
            Remark: remark || kpi.Remark,
            IsEvedenceRequired: isEvidenceRequired !== undefined ? (isEvidenceRequired === true || isEvidenceRequired === 'true' || isEvidenceRequired === 'Yes' || isEvidenceRequired === 'yes') : kpi.IsEvedenceRequired
          }, { transaction });
        }

        // 6. Year Plan
        let plan = await KPIYearPlan.findOne({
          where: { KPIId: kpi.Id, CycleYear: currentYear },
          transaction
        });
        if (!plan) {
          plan = await KPIYearPlan.create({
            KPIId: kpi.Id,
            CycleYear: currentYear,
            Baseline: parsedBaseline,
            Target: parsedTarget,
            Status: 'ACTIVE',
            IsLocked: false
          }, { transaction });
        } else if (!plan.IsLocked) {
          await plan.update({
            Baseline: parsedBaseline !== null ? parsedBaseline : plan.Baseline,
            Target: parsedTarget !== null ? parsedTarget : plan.Target
          }, { transaction });
        }

        report.imported++;
      } catch (err) {
        report.errors.push({ row: rowNum, message: err.message });
      }
    }

    if (report.errors.length > 0 && report.imported === 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'All rows had errors. Import failed.', errors: report.errors });
    }

    await transaction.commit();
    res.json({ success: true, data: report });
  } catch (error) {
    await transaction.rollback();
    console.error('Import KPIs error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  createKPI,
  getKPIs,
  getKPIById,
  updateKPI,
  deleteKPI,
  deleteAllKPIs,
  importKPIs,
};
