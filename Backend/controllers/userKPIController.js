const { UserKPI, User, KPI, UserKPIResult, UserRole } = require('../models');
const { Op } = require('sequelize');
const { getCurrentCycleYear, getPreviousCycleYear } = require('../utils/kpiCycle');

const parseNumericValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const computeBaselineFromPreviousCycle = async ({ KPIId, UserId, cycleYear, fallbackBaseline }) => {
  const previousCycleYear = getPreviousCycleYear(cycleYear);
  if (!previousCycleYear) {
    return parseNumericValue(fallbackBaseline);
  }

  const previousResults = await UserKPIResult.findAll({
    where: {
      KPIId,
      UserId,
      CycleYear: previousCycleYear,
      IsArchived: false,
    },
    attributes: ['KPIResult'],
  });

  const numericResults = previousResults.map((result) => parseNumericValue(result.KPIResult)).filter((value) => value !== null);

  if (numericResults.length === 0) {
    return parseNumericValue(fallbackBaseline);
  }

  const average = numericResults.reduce((sum, value) => sum + value, 0) / numericResults.length;
  return Number(average.toFixed(2));
};

const createUserKPI = async (req, res) => {
  try {
    const { KPIId, UserId, Remark, CycleYear, Baseline } = req.body;
    const cycleYear = CycleYear || getCurrentCycleYear();

    const user = await User.findByPk(UserId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const kpi = await KPI.findByPk(KPIId);
    if (!kpi) {
      return res.status(404).json({ message: 'KPI not found' });
    }

    const existingAssignment = await UserKPI.findOne({
      where: {
        KPIId,
        UserId,
        CycleYear: cycleYear,
        IsArchived: false,
      },
    });

    if (existingAssignment) {
      return res.status(409).json({ message: 'This KPI is already assigned to the user for the selected cycle year.' });
    }

    const computedBaseline =
      parseNumericValue(Baseline) ??
      (await computeBaselineFromPreviousCycle({
        KPIId,
        UserId,
        cycleYear,
        fallbackBaseline: kpi.Baseline,
      }));

    const userKPI = await UserKPI.create({
      KPIId,
      CycleYear: cycleYear,
      UserId,
      Baseline: computedBaseline,
      Remark,
      CreatedBy: req.user?.Id,
    });

    res.status(201).json({ success: true, data: userKPI });
  } catch (error) {
    console.error('Create user KPI error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getUserKPIs = async (req, res) => {
  try {
    const { year, scope, fromParent } = req.query;
    const where = { IsArchived: false };

    if (year) {
      where.CycleYear = year;
    }

    if (scope === 'mine') {
      where.UserId = req.user?.Id;
    }

    if (String(fromParent).toLowerCase() === 'true') {
      const parentRoleId = req.user?.currentRole?.ParentRoleId;

      if (!parentRoleId) {
        return res.json({ success: true, data: [] });
      }

      const parentRoleUserAssignments = await UserRole.findAll({
        where: {
          RoleId: parentRoleId,
          IsArchived: false,
          [Op.or]: [{ ToDate: null }, { ToDate: { [Op.gte]: new Date() } }],
        },
        attributes: ['UserId'],
      });

      const parentUserIds = [...new Set(parentRoleUserAssignments.map((assignment) => assignment.UserId).filter(Boolean))];

      if (!parentUserIds.length) {
        return res.json({ success: true, data: [] });
      }

      where.CreatedBy = { [Op.in]: parentUserIds };
    }

    const userKpis = await UserKPI.findAll({
      where,
      include: [
        { model: User, attributes: ['Id', 'FirstName', 'UserName', 'Email'] },
        { model: KPI, attributes: ['Id', 'Baseline', 'Target', 'Description'] },
      ],
      order: [['CreatedAt', 'DESC']],
    });

    res.json({ success: true, data: userKpis });
  } catch (error) {
    console.error('Get user KPIs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getUserKPIById = async (req, res) => {
  try {
    const { id } = req.params;
    const userKPI = await UserKPI.findByPk(id, {
      include: [
        { model: User, attributes: ['Id', 'FirstName', 'UserName', 'Email'] },
        { model: KPI, attributes: ['Id', 'Baseline', 'Target', 'Description'] },
      ],
    });

    if (!userKPI) {
      return res.status(404).json({ message: 'User KPI not found' });
    }

    res.json({ success: true, data: userKPI });
  } catch (error) {
    console.error('Get user KPI error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateUserKPI = async (req, res) => {
  try {
    const { id } = req.params;
    const { KPIId, UserId, Remark, CycleYear, Baseline } = req.body;

    const userKPI = await UserKPI.findByPk(id);
    if (!userKPI) {
      return res.status(404).json({ message: 'User KPI not found' });
    }

    if (KPIId) {
      const kpi = await KPI.findByPk(KPIId);
      if (!kpi) {
        return res.status(404).json({ message: 'KPI not found' });
      }
    }

    if (UserId) {
      const user = await User.findByPk(UserId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
    }

    await userKPI.update({
      KPIId,
      UserId,
      Remark,
      Baseline: Baseline !== undefined ? parseNumericValue(Baseline) : userKPI.Baseline,
      CycleYear: CycleYear || userKPI.CycleYear,
    });

    res.json({ success: true, data: userKPI });
  } catch (error) {
    console.error('Update user KPI error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteUserKPI = async (req, res) => {
  try {
    const { id } = req.params;
    const userKPI = await UserKPI.findByPk(id);

    if (!userKPI) {
      return res.status(404).json({ message: 'User KPI not found' });
    }

    await userKPI.update({ IsArchived: true });

    res.json({ success: true, message: 'User KPI archived successfully' });
  } catch (error) {
    console.error('Delete user KPI error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createUserKPI,
  getUserKPIs,
  getUserKPIById,
  updateUserKPI,
  deleteUserKPI,
};
