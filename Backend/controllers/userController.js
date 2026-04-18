const { Op } = require('sequelize');
const { User, UserRole, Role, RoleCategory } = require('../models');

const getUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      where: { IsArchived: false },
      attributes: ['Id', 'FirstName', 'FatherName', 'GrandFatherName', 'Email', 'UserName', 'Phone', 'CreatedAt'],
      include: [
        {
          model: UserRole,
          where: {
            IsArchived: false,
            [Op.or]: [{ ToDate: null }, { ToDate: { [Op.gte]: new Date() } }],
          },
          required: false,
          include: [
            {
              model: Role,
              where: { IsArchived: false },
              required: false,
              attributes: ['Id', 'RoleName', 'RoleCategoryId'],
              include: [
                {
                  model: RoleCategory,
                  attributes: ['Id', 'CategoryName'],
                  required: false,
                },
              ],
            },
          ],
          order: [['CreatedAt', 'DESC']],
        },
      ],
      order: [['CreatedAt', 'DESC']],
    });

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id, {
      attributes: ['Id', 'FirstName', 'FatherName', 'GrandFatherName', 'Email', 'UserName', 'Phone', 'CreatedAt', 'IsArchived'],
      include: [
        {
          model: UserRole,
          where: {
            IsArchived: false,
            [Op.or]: [{ ToDate: null }, { ToDate: { [Op.gte]: new Date() } }],
          },
          required: false,
          include: [
            {
              model: Role,
              where: { IsArchived: false },
              required: false,
              attributes: ['Id', 'RoleName', 'RoleCategoryId'],
              include: [
                {
                  model: RoleCategory,
                  attributes: ['Id', 'CategoryName'],
                  required: false,
                },
              ],
            },
          ],
          order: [['CreatedAt', 'DESC']],
        },
      ],
    });

    if (!user || user.IsArchived) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Get user by id error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (String(req.user?.Id) === String(id)) {
      return res.status(400).json({ message: 'You cannot archive your own account.' });
    }

    const user = await User.findByPk(id);

    if (!user || user.IsArchived) {
      return res.status(404).json({ message: 'User not found' });
    }

    await user.update({ IsArchived: true });

    await UserRole.update(
      {
        IsArchived: true,
        ToDate: new Date(),
      },
      {
        where: {
          UserId: id,
          IsArchived: false,
        },
      }
    );

    res.json({
      success: true,
      message: 'User archived successfully',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password, newPassword } = req.body;

    const nextPassword = String(newPassword || password || '').trim();
    if (!nextPassword || nextPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const user = await User.findByPk(id);
    if (!user || user.IsArchived) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.password = nextPassword;
    await user.save();

    res.json({
      success: true,
      message: 'User password reset successfully.',
    });
  } catch (error) {
    console.error('Reset user password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getUsers,
  getUserById,
  deleteUser,
  resetUserPassword,
};
