const { Op, col, fn, where: sequelizeWhere } = require('sequelize');
const { Role, RoleCategory } = require('../models');

const createRole = async (req, res) => {
  try {
    const { RoleCategoryId, RoleName, ParentRoleId, Description, HasExtraMeasures, Permissions } = req.body;
    const normalizedRoleName = (RoleName || '').trim();

    if (!normalizedRoleName) {
      return res.status(400).json({ message: 'Role name is required' });
    }

    const duplicate = await Role.findOne({
      where: {
        [Op.and]: [sequelizeWhere(fn('lower', fn('trim', col('RoleName'))), normalizedRoleName.toLowerCase())],
      },
    });

    if (duplicate && !duplicate.IsArchived) {
      return res.status(409).json({ message: 'Role already exists' });
    }

    if (RoleCategoryId) {
      const category = await RoleCategory.findByPk(RoleCategoryId);
      if (!category) {
        return res.status(404).json({ message: 'Role category not found' });
      }
    }

    if (ParentRoleId) {
      const parentRole = await Role.findByPk(ParentRoleId);
      if (!parentRole) {
        return res.status(404).json({ message: 'Parent role not found' });
      }
    }

    const role = await Role.create({
      RoleCategoryId: RoleCategoryId || null,
      RoleName: normalizedRoleName,
      ParentRoleId,
      Description,
      HasExtraMeasures: HasExtraMeasures || false,
      Permissions: Array.isArray(Permissions) ? Permissions : null,
      CreatedBy: req.user?.Id,
    });

    res.status(201).json({
      success: true,
      data: role,
    });
  } catch (error) {
    console.error('Create role error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getRoles = async (req, res) => {
  try {
    const roles = await Role.findAll({
      where: { IsArchived: false },
      include: [
        {
          model: RoleCategory,
          attributes: ['Id', 'CategoryName'],
        },
        {
          model: Role,
          as: 'ParentRole',
          attributes: ['Id', 'RoleName'],
        },
      ],
      order: [['CreatedAt', 'DESC']],
    });

    res.json({
      success: true,
      data: roles,
    });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getRoleById = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await Role.findByPk(id, {
      include: [
        {
          model: RoleCategory,
          attributes: ['Id', 'CategoryName'],
        },
        {
          model: Role,
          as: 'ParentRole',
          attributes: ['Id', 'RoleName'],
        },
        {
          model: Role,
          as: 'ChildRoles',
          attributes: ['Id', 'RoleName'],
        },
      ],
    });

    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    res.json({
      success: true,
      data: role,
    });
  } catch (error) {
    console.error('Get role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { RoleCategoryId, RoleName, ParentRoleId, Description, HasExtraMeasures, Permissions } = req.body;
    const normalizedRoleName = (RoleName || '').trim();

    const role = await Role.findByPk(id);

    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    if (!normalizedRoleName) {
      return res.status(400).json({ message: 'Role name is required' });
    }

    if (ParentRoleId === id) {
      return res.status(400).json({ message: 'Role cannot be its own parent' });
    }

    const duplicate = await Role.findOne({
      where: {
        Id: { [Op.ne]: id },
        [Op.and]: [sequelizeWhere(fn('lower', fn('trim', col('RoleName'))), normalizedRoleName.toLowerCase())],
      },
    });

    if (duplicate && !duplicate.IsArchived) {
      return res.status(409).json({ message: 'Role already exists' });
    }

    if (RoleCategoryId) {
      const category = await RoleCategory.findByPk(RoleCategoryId);
      if (!category) {
        return res.status(404).json({ message: 'Role category not found' });
      }
    }

    await role.update({
      RoleCategoryId: RoleCategoryId || null,
      RoleName: normalizedRoleName,
      ParentRoleId,
      Description,
      HasExtraMeasures,
      ...(Array.isArray(Permissions) ? { Permissions } : {}),
    });

    res.json({
      success: true,
      data: role,
    });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await Role.findByPk(id);

    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    // Keep hierarchy intact by moving direct children one level up.
    // If the deleted role has no parent, children become top-level roles.
    const [reparentedChildren] = await Role.update({ ParentRoleId: role.ParentRoleId || null }, { where: { ParentRoleId: id, IsArchived: false } });

    await role.update({ IsArchived: true });

    res.json({
      success: true,
      message: 'Role archived successfully',
      reparentedChildren,
    });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createRole,
  getRoles,
  getRoleById,
  updateRole,
  deleteRole,
};
