const { Op, fn, col, where: sequelizeWhere } = require('sequelize');
const { KPIType } = require('../models');

const createKPIType = async (req, res) => {
  try {
    const { KPIName, ParentKPIID, Description } = req.body;

    const normalizedName = (KPIName || '').trim();

    if (!normalizedName) {
      return res.status(400).json({ message: 'KPI category name is required' });
    }

    const duplicate = await KPIType.findOne({
      where: {
        [Op.and]: [sequelizeWhere(fn('lower', fn('trim', col('KPIName'))), normalizedName.toLowerCase())],
        ParentKPIID: ParentKPIID || null,
      },
    });

    if (duplicate && !duplicate.IsArchived) {
      return res.status(409).json({ message: 'KPI category already exists under this parent' });
    }

    if (ParentKPIID) {
      const parent = await KPIType.findByPk(ParentKPIID);
      if (!parent) {
        return res.status(404).json({ message: 'Parent KPI type not found' });
      }
    }

    const type = await KPIType.create({
      KPIName: normalizedName,
      ParentKPIID,
      Description,
      CreatedBy: req.user?.Id,
    });

    res.status(201).json({ success: true, data: type });
  } catch (error) {
    console.error('Create KPI type error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getKPITypes = async (req, res) => {
  try {
    const types = await KPIType.findAll({
      where: { IsArchived: false },
      order: [['CreatedAt', 'ASC']],
    });

    res.json({ success: true, data: types });
  } catch (error) {
    console.error('Get KPI types error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getKPITypeById = async (req, res) => {
  try {
    const { id } = req.params;
    const type = await KPIType.findByPk(id);

    if (!type) {
      return res.status(404).json({ message: 'KPI type not found' });
    }

    res.json({ success: true, data: type });
  } catch (error) {
    console.error('Get KPI type error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateKPIType = async (req, res) => {
  try {
    const { id } = req.params;
    const { KPIName, ParentKPIID, Description } = req.body;
    const normalizedName = (KPIName || '').trim();

    if (!normalizedName) {
      return res.status(400).json({ message: 'KPI category name is required' });
    }

    const type = await KPIType.findByPk(id);
    if (!type) {
      return res.status(404).json({ message: 'KPI type not found' });
    }

    if (ParentKPIID && ParentKPIID !== id) {
      const parent = await KPIType.findByPk(ParentKPIID);
      if (!parent) {
        return res.status(404).json({ message: 'Parent KPI type not found' });
      }
    }

    const duplicate = await KPIType.findOne({
      where: {
        Id: { [Op.ne]: id },
        [Op.and]: [sequelizeWhere(fn('lower', fn('trim', col('KPIName'))), normalizedName.toLowerCase())],
        ParentKPIID: ParentKPIID || null,
      },
    });

    if (duplicate && !duplicate.IsArchived) {
      return res.status(409).json({ message: 'KPI category already exists under this parent' });
    }

    await type.update({ KPIName: normalizedName, ParentKPIID, Description });

    res.json({ success: true, data: type });
  } catch (error) {
    console.error('Update KPI type error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteKPIType = async (req, res) => {
  try {
    const { id } = req.params;
    const type = await KPIType.findByPk(id);
    if (!type) {
      return res.status(404).json({ message: 'KPI type not found' });
    }

    await type.update({ IsArchived: true });

    res.json({ success: true, message: 'KPI type archived successfully' });
  } catch (error) {
    console.error('Delete KPI type error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createKPIType,
  getKPITypes,
  getKPITypeById,
  updateKPIType,
  deleteKPIType,
};
