const { Op, col, fn, where: sequelizeWhere } = require('sequelize');
const { RoleCategory } = require('../models');

const createRoleCategory = async (req, res) => {
  try {
    const { CategoryName, Description } = req.body;
    const normalizedName = (CategoryName || '').trim();

    if (!normalizedName) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    const duplicate = await RoleCategory.findOne({
      where: {
        [Op.and]: [sequelizeWhere(fn('lower', col('CategoryName')), normalizedName.toLowerCase())],
      },
    });

    if (duplicate && !duplicate.IsArchived) {
      return res.status(409).json({ message: 'Role category already exists' });
    }

    if (duplicate && duplicate.IsArchived) {
      await duplicate.update({
        CategoryName: normalizedName,
        Description,
        IsArchived: false,
      });

      return res.status(200).json({
        success: true,
        data: duplicate,
        message: 'Role category restored successfully.',
      });
    }

    const category = await RoleCategory.create({
      CategoryName: normalizedName,
      Description,
      CreatedBy: req.user?.Id,
    });

    res.status(201).json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error('Create role category error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getRoleCategories = async (req, res) => {
  try {
    const categories = await RoleCategory.findAll({
      where: { IsArchived: false },
      order: [['CreatedAt', 'DESC']],
    });

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('Get role categories error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateRoleCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { CategoryName, Description } = req.body;
    const normalizedName = (CategoryName || '').trim();

    if (!normalizedName) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    const category = await RoleCategory.findByPk(id);

    if (!category) {
      return res.status(404).json({ message: 'Role category not found' });
    }

    const duplicate = await RoleCategory.findOne({
      where: {
        Id: { [Op.ne]: id },
        [Op.and]: [sequelizeWhere(fn('lower', col('CategoryName')), normalizedName.toLowerCase())],
      },
    });

    if (duplicate && !duplicate.IsArchived) {
      return res.status(409).json({ message: 'Role category already exists' });
    }

    if (duplicate && duplicate.IsArchived) {
      return res.status(409).json({
        message: 'A matching archived role category already exists. Restore or rename it first.',
      });
    }

    await category.update({
      CategoryName: normalizedName,
      Description,
    });

    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error('Update role category error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteRoleCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await RoleCategory.findByPk(id);

    if (!category) {
      return res.status(404).json({ message: 'Role category not found' });
    }

    await category.update({ IsArchived: true });

    res.json({
      success: true,
      message: 'Role category archived successfully',
    });
  } catch (error) {
    console.error('Delete role category error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createRoleCategory,
  getRoleCategories,
  updateRoleCategory,
  deleteRoleCategory,
};
