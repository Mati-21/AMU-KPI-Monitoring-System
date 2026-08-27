import { prisma  } from '../../config/database.js';

const createRoleCategory = async (req, res) => {
  try {
    const { CategoryName, Description } = req.body;
    const normalizedName = (CategoryName || '').trim();

    if (!normalizedName) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    const duplicate = await prisma.roleCategories.findFirst({
      where: {
        CategoryName: { equals: normalizedName, mode: 'insensitive' }
      }
    });

    if (duplicate && !duplicate.IsArchived) {
      return res.status(409).json({ message: 'Role category already exists' });
    }

    if (duplicate && duplicate.IsArchived) {
      const restored = await prisma.roleCategories.update({
        where: { Id: duplicate.Id },
        data: {
          CategoryName: normalizedName,
          Description,
          IsArchived: false,
        }
      });

      return res.status(200).json({
        success: true,
        data: restored,
        message: 'Role category restored successfully.',
      });
    }

    const category = await prisma.roleCategories.create({
      data: {
        CategoryName: normalizedName,
        Description,
        CreatedBy: req.user?.Id,
      }
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
    const categories = await prisma.roleCategories.findMany({
      where: { IsArchived: false },
      orderBy: { CreatedAt: 'desc' },
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

    const category = await prisma.roleCategories.findUnique({ where: { Id: id } });

    if (!category) {
      return res.status(404).json({ message: 'Role category not found' });
    }

    const duplicate = await prisma.roleCategories.findFirst({
      where: {
        Id: { not: id },
        CategoryName: { equals: normalizedName, mode: 'insensitive' }
      }
    });

    if (duplicate && !duplicate.IsArchived) {
      return res.status(409).json({ message: 'Role category already exists' });
    }

    if (duplicate && duplicate.IsArchived) {
      return res.status(409).json({
        message: 'A matching archived role category already exists. Restore or rename it first.',
      });
    }

    const updated = await prisma.roleCategories.update({
      where: { Id: id },
      data: {
        CategoryName: normalizedName,
        Description,
      }
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Update role category error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteRoleCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await prisma.roleCategories.findUnique({ where: { Id: id } });

    if (!category) {
      return res.status(404).json({ message: 'Role category not found' });
    }

    await prisma.roleCategories.update({
      where: { Id: id },
      data: { IsArchived: true }
    });

    res.json({
      success: true,
      message: 'Role category archived successfully',
    });
  } catch (error) {
    console.error('Delete role category error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export { 
  createRoleCategory,
  getRoleCategories,
  updateRoleCategory,
  deleteRoleCategory,
 };
