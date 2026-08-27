import { prisma  } from '../../config/database.js';
import { getCurrentCycleYear  } from '../../utils/kpiCycle.js';

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

    const kpiType = await prisma.kPITypes.findUnique({ where: { Id: KPITypeId } });
    if (!kpiType) {
      return res.status(404).json({ message: 'KPI type not found' });
    }

    const unit = await prisma.units.findUnique({ where: { Id: UnitId } });
    if (!unit) {
      return res.status(404).json({ message: 'Unit not found' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const kpi = await tx.kPIs.create({
        data: {
          KPITypeId,
          UnitId,
          LifecycleType: 'RECURRING',
          Weight: parsedWeight,
          DefaultBaseline: 0,
          Description,
          IsEvedenceRequired: IsEvedenceRequired || false,
          Remark,
          CreatedBy: req.user?.Id,
        }
      });

      await tx.kPIYearPlans.create({
        data: {
          KPIId: kpi.Id,
          CycleYear: CycleYear || getCurrentCycleYear(),
          Baseline: parsedBaseline || 0,
          Target: parsedTarget,
          Status: 'ACTIVE',
          IsLocked: false,
        }
      });

      return kpi;
    });

    res.status(201).json({ success: true, data: result });
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

    const kpis = await prisma.kPIs.findMany({
      where: whereClause,
      include: {
        KPITypes: {
          select: {
            Id: true, KPIName: true, ParentKPIID: true,
            KPITypes: {
              select: {
                Id: true, KPIName: true, ParentKPIID: true,
                KPITypes: { select: { Id: true, KPIName: true } }
              }
            }
          }
        },
        Units: { select: { Id: true, Name: true, Code: true } },
        KPIYearPlans: {
          select: { Id: true, CycleYear: true, Baseline: true, Target: true, FinalPerformance: true, Status: true, IsLocked: true },
          orderBy: { CycleYear: 'desc' }
        }
      },
      orderBy: { CreatedAt: 'asc' }
    });

    const formattedKpis = kpis.map((kpi) => {
      const mapped = {
        ...kpi,
        KPIType: kpi.KPITypes ? {
          ...kpi.KPITypes,
          ParentKPI: kpi.KPITypes.KPITypes ? {
            ...kpi.KPITypes.KPITypes,
            ParentKPI: kpi.KPITypes.KPITypes.KPITypes
          } : null
        } : null,
        Unit: kpi.Units,
        KPITypes: undefined,
        Units: undefined
      };
      
      if (mapped.KPIType) {
        delete mapped.KPIType.KPITypes;
        if (mapped.KPIType.ParentKPI) {
          delete mapped.KPIType.ParentKPI.KPITypes;
        }
      }

      const planForSelectedYear = mapped.KPIYearPlans?.find((p) => p.CycleYear === selectedYear) || null;
      const fallbackPlan = selectedYear === activeYear ? mapped.KPIYearPlans?.[0] || null : null;
      const currentPlan = planForSelectedYear || fallbackPlan;
      
      mapped.Baseline = currentPlan?.Baseline ?? mapped.DefaultBaseline ?? 0;
      mapped.Target = currentPlan?.Target ?? 0;
      
      return mapped;
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
    
    const kpi = await prisma.kPIs.findUnique({
      where: { Id: id },
      include: {
        KPITypes: {
          select: {
            Id: true, KPIName: true, ParentKPIID: true,
            KPITypes: {
              select: {
                Id: true, KPIName: true, ParentKPIID: true,
                KPITypes: { select: { Id: true, KPIName: true } }
              }
            }
          }
        },
        Units: { select: { Id: true, Name: true, Code: true } },
        KPIYearPlans: {
          select: { Id: true, CycleYear: true, Baseline: true, Target: true, FinalPerformance: true, Status: true, IsLocked: true }
        }
      }
    });

    if (!kpi) {
      return res.status(404).json({ message: 'KPI not found' });
    }

    const mapped = {
      ...kpi,
      KPIType: kpi.KPITypes ? {
        ...kpi.KPITypes,
        ParentKPI: kpi.KPITypes.KPITypes ? {
          ...kpi.KPITypes.KPITypes,
          ParentKPI: kpi.KPITypes.KPITypes.KPITypes
        } : null
      } : null,
      Unit: kpi.Units,
      KPITypes: undefined,
      Units: undefined
    };
    
    if (mapped.KPIType) {
      delete mapped.KPIType.KPITypes;
      if (mapped.KPIType.ParentKPI) {
        delete mapped.KPIType.ParentKPI.KPITypes;
      }
    }

    const planForSelectedYear = mapped.KPIYearPlans?.find((p) => p.CycleYear === selectedYear) || null;
    const fallbackPlan = selectedYear === activeYear ? mapped.KPIYearPlans?.[0] || null : null;
    const currentPlan = planForSelectedYear || fallbackPlan;
    
    mapped.Baseline = currentPlan?.Baseline ?? mapped.DefaultBaseline ?? 0;
    mapped.Target = currentPlan?.Target ?? 0;

    res.json({ success: true, data: mapped });
  } catch (error) {
    console.error('Get KPI error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateKPI = async (req, res) => {
  try {
    const { id } = req.params;
    const { KPITypeId, UnitId, Weight, Baseline, Target, Description, IsEvedenceRequired, Remark, LifecycleType, DefaultBaseline } = req.body;
    const parsedWeight = parseNumericValue(Weight);
    const parsedBaseline = parseNumericValue(Baseline);
    const parsedTarget = parseNumericValue(Target);
    const parsedDefaultBaseline = parseNumericValue(DefaultBaseline);

    const kpi = await prisma.kPIs.findUnique({ where: { Id: id } });
    if (!kpi) {
      return res.status(404).json({ message: 'KPI not found' });
    }

    if (KPITypeId) {
      const kpiType = await prisma.kPITypes.findUnique({ where: { Id: KPITypeId } });
      if (!kpiType) {
        return res.status(404).json({ message: 'KPI type not found' });
      }
    }

    if (UnitId) {
      const unit = await prisma.units.findUnique({ where: { Id: UnitId } });
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

    const updatedKpi = await prisma.kPIs.update({
      where: { Id: id },
      data: {
        KPITypeId,
        UnitId,
        LifecycleType,
        Weight: parsedWeight,
        DefaultBaseline: parsedDefaultBaseline,
        Description,
        IsEvedenceRequired,
        Remark,
      }
    });

    if (parsedBaseline !== null || parsedTarget !== null) {
      const currentYear = getCurrentCycleYear();
      const plan = await prisma.kPIYearPlans.findFirst({
        where: { KPIId: id, CycleYear: currentYear },
      });

      if (plan && !plan.IsLocked) {
        await prisma.kPIYearPlans.update({
          where: { Id: plan.Id },
          data: {
            Baseline: parsedBaseline !== null ? parsedBaseline : plan.Baseline,
            Target: parsedTarget !== null ? parsedTarget : plan.Target,
          }
        });
      }
    }

    res.json({ success: true, data: updatedKpi });
  } catch (error) {
    console.error('Update KPI error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteKPI = async (req, res) => {
  try {
    const { id } = req.params;
    const kpi = await prisma.kPIs.findUnique({ where: { Id: id } });
    if (!kpi) {
      return res.status(404).json({ message: 'KPI not found' });
    }

    const { KPITypeId } = kpi;

    await prisma.$transaction(async (tx) => {
      await tx.userKPIResults.deleteMany({ where: { KPIId: id } });
      await tx.userKPIs.deleteMany({ where: { KPIId: id } });
      await tx.kPIYearPlans.deleteMany({ where: { KPIId: id } });
      await tx.kPIDocuments.deleteMany({ where: { KPIId: id } });
      await tx.kPIs.delete({ where: { Id: id } });

      if (KPITypeId) {
        await tx.kPITypes.deleteMany({ where: { Id: KPITypeId } });
      }
    });

    res.json({ success: true, message: 'KPI permanently deleted successfully' });
  } catch (error) {
    console.error('Delete KPI error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteAllKPIs = async (req, res) => {
  try {
    const allKpis = await prisma.kPIs.findMany({ select: { Id: true, KPITypeId: true } });
    const kpiIds = allKpis.map(k => k.Id);
    const kpiTypeIds = allKpis.map(k => k.KPITypeId).filter(Boolean);

    if (kpiIds.length === 0) {
      return res.status(404).json({ message: 'No KPIs found to delete.' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.userKPIResults.deleteMany({ where: { KPIId: { in: kpiIds } } });
      await tx.userKPIs.deleteMany({ where: { KPIId: { in: kpiIds } } });
      await tx.kPIYearPlans.deleteMany({ where: { KPIId: { in: kpiIds } } });
      await tx.kPIDocuments.deleteMany({ where: { KPIId: { in: kpiIds } } });
      await tx.kPIs.deleteMany({ where: { Id: { in: kpiIds } } });

      if (kpiTypeIds.length > 0) {
        await tx.kPITypes.deleteMany({ where: { Id: { in: kpiTypeIds } } });
      }
    });

    res.json({ success: true, message: `Successfully deleted ${kpiIds.length} KPIs and all associated records.`, count: kpiIds.length });
  } catch (error) {
    console.error('Delete all KPIs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const importKPIs = async (req, res) => {
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

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < kpis.length; i++) {
        const item = kpis[i];
        const rowNum = i + 1;

        try {
          const { kpiName, theme, subTheme, unit, weight, baseline, target, lifecycleType, defaultBaseline, description, remark, isEvidenceRequired } = item;

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

          let themeType = await tx.kPITypes.findFirst({
            where: { KPIName: { equals: String(theme).trim(), mode: 'insensitive' }, ParentKPIID: null }
          });
          if (!themeType) {
            themeType = await tx.kPITypes.create({ data: { KPIName: String(theme).trim(), ParentKPIID: null } });
          }

          let subThemeType = await tx.kPITypes.findFirst({
            where: {
              ParentKPIID: themeType.Id,
              KPIName: { equals: String(subTheme).trim(), mode: 'insensitive' }
            }
          });
          if (!subThemeType) {
            subThemeType = await tx.kPITypes.create({ data: { KPIName: String(subTheme).trim(), ParentKPIID: themeType.Id } });
          }

          let kpiType = await tx.kPITypes.findFirst({
            where: {
              ParentKPIID: subThemeType.Id,
              KPIName: { equals: String(kpiName).trim(), mode: 'insensitive' }
            }
          });
          if (!kpiType) {
            kpiType = await tx.kPITypes.create({ data: { KPIName: String(kpiName).trim(), ParentKPIID: subThemeType.Id } });
          }

          let unitObj = await tx.units.findFirst({
            where: {
              OR: [
                { Code: { equals: String(unit).trim(), mode: 'insensitive' } },
                { Name: { equals: String(unit).trim(), mode: 'insensitive' } }
              ]
            }
          });
          if (!unitObj) {
            unitObj = await tx.units.create({ data: { Name: String(unit).trim(), Code: String(unit).trim().toUpperCase() } });
          }

          const activeLifecycle = lifecycleType || 'RECURRING';
          let kpi = await tx.kPIs.findFirst({
            where: { KPITypeId: kpiType.Id, UnitId: unitObj.Id }
          });
          
          if (!kpi) {
            kpi = await tx.kPIs.create({
              data: {
                KPITypeId: kpiType.Id,
                UnitId: unitObj.Id,
                LifecycleType: activeLifecycle,
                Weight: parsedWeight,
                DefaultBaseline: parsedDefaultBaseline !== null ? parsedDefaultBaseline : (activeLifecycle === 'RECURRING' ? 0 : parsedBaseline),
                Description: description || null,
                Remark: remark || null,
                IsEvedenceRequired: isEvidenceRequired === true || isEvidenceRequired === 'true' || isEvidenceRequired === 'Yes' || isEvidenceRequired === 'yes',
                CreatedBy: req.user?.Id
              }
            });
          } else {
            kpi = await tx.kPIs.update({
              where: { Id: kpi.Id },
              data: {
                LifecycleType: activeLifecycle,
                Weight: parsedWeight,
                DefaultBaseline: parsedDefaultBaseline !== null ? parsedDefaultBaseline : kpi.DefaultBaseline,
                Description: description || kpi.Description,
                Remark: remark || kpi.Remark,
                IsEvedenceRequired: isEvidenceRequired !== undefined ? (isEvidenceRequired === true || isEvidenceRequired === 'true' || isEvidenceRequired === 'Yes' || isEvidenceRequired === 'yes') : kpi.IsEvedenceRequired
              }
            });
          }

          let plan = await tx.kPIYearPlans.findFirst({
            where: { KPIId: kpi.Id, CycleYear: currentYear }
          });
          
          if (!plan) {
            plan = await tx.kPIYearPlans.create({
              data: {
                KPIId: kpi.Id,
                CycleYear: currentYear,
                Baseline: parsedBaseline,
                Target: parsedTarget,
                Status: 'ACTIVE',
                IsLocked: false
              }
            });
          } else if (!plan.IsLocked) {
            await tx.kPIYearPlans.update({
              where: { Id: plan.Id },
              data: {
                Baseline: parsedBaseline !== null ? parsedBaseline : plan.Baseline,
                Target: parsedTarget !== null ? parsedTarget : plan.Target
              }
            });
          }

          report.imported++;
        } catch (err) {
          report.errors.push({ row: rowNum, message: err.message });
        }
      }

      if (report.errors.length > 0 && report.imported === 0) {
        const err = new Error('ALL_ERRORS');
        err.reportErrors = report.errors;
        throw err;
      }
    });

    res.json({ success: true, data: report });
  } catch (error) {
    console.error('Import KPIs error:', error);
    if (error.message === 'ALL_ERRORS') {
      return res.status(400).json({ success: false, message: 'All rows had errors. Import failed.', errors: error.reportErrors });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export { 
  createKPI,
  getKPIs,
  getKPIById,
  updateKPI,
  deleteKPI,
  deleteAllKPIs,
  importKPIs,
 };
