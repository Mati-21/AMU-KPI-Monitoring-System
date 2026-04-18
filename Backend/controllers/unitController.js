const { Op, fn, col, where: sequelizeWhere } = require('sequelize');
const { Unit } = require('../models');

const createUnit = async (req, res) => {
  try {
    const { Name, Code, Description } = req.body;

    const normalizedName = (Name || '').trim();
    const normalizedCode = (Code || '').trim();

    if (!normalizedName || !normalizedCode) {
      return res.status(400).json({ message: 'Unit name and code are required' });
    }

    const duplicate = await Unit.findOne({
      where: {
        [Op.or]: [
          sequelizeWhere(fn('lower', fn('trim', col('Name'))), normalizedName.toLowerCase()),
          sequelizeWhere(fn('lower', fn('trim', col('Code'))), normalizedCode.toLowerCase()),
        ],
      },
    });

    if (duplicate && !duplicate.IsArchived) {
      return res.status(409).json({ message: 'Unit already exists' });
    }

    const unit = await Unit.create({
      Name: normalizedName,
      Code: normalizedCode,
      Description,
      CreatedBy: req.user?.Id,
    });

    res.status(201).json({ success: true, data: unit });
  } catch (error) {
    console.error('Create unit error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getUnits = async (req, res) => {
  try {
    const units = await Unit.findAll({
      where: { IsArchived: false },
      order: [['CreatedAt', 'DESC']],
    });

    res.json({ success: true, data: units });
  } catch (error) {
    console.error('Get units error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getUnitById = async (req, res) => {
  try {
    const { id } = req.params;
    const unit = await Unit.findByPk(id);

    if (!unit) {
      return res.status(404).json({ message: 'Unit not found' });
    }

    res.json({ success: true, data: unit });
  } catch (error) {
    console.error('Get unit error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const { Name, Code, Description } = req.body;
    const normalizedName = (Name || '').trim();
    const normalizedCode = (Code || '').trim();

    const unit = await Unit.findByPk(id);
    if (!unit) {
      return res.status(404).json({ message: 'Unit not found' });
    }

    if (!normalizedName || !normalizedCode) {
      return res.status(400).json({ message: 'Unit name and code are required' });
    }

    const duplicate = await Unit.findOne({
      where: {
        Id: { [Op.ne]: id },
        [Op.or]: [
          sequelizeWhere(fn('lower', fn('trim', col('Name'))), normalizedName.toLowerCase()),
          sequelizeWhere(fn('lower', fn('trim', col('Code'))), normalizedCode.toLowerCase()),
        ],
      },
    });

    if (duplicate && !duplicate.IsArchived) {
      return res.status(409).json({ message: 'Unit already exists' });
    }

    await unit.update({ Name: normalizedName, Code: normalizedCode, Description });

    res.json({ success: true, data: unit });
  } catch (error) {
    console.error('Update unit error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const unit = await Unit.findByPk(id);
    if (!unit) {
      return res.status(404).json({ message: 'Unit not found' });
    }

    await unit.update({ IsArchived: true });

    res.json({ success: true, message: 'Unit archived successfully' });
  } catch (error) {
    console.error('Delete unit error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createUnit,
  getUnits,
  getUnitById,
  updateUnit,
  deleteUnit,
};
