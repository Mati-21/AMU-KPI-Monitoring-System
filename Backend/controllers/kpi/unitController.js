import { prisma  } from '../../config/database.js';

const createUnit = async (req, res) => {
  try {
    const { Name, Code, Description } = req.body;

    const normalizedName = (Name || '').trim();
    const normalizedCode = (Code || '').trim();

    if (!normalizedName || !normalizedCode) {
      return res.status(400).json({ message: 'Unit name and code are required' });
    }

    const duplicate = await prisma.units.findFirst({
      where: {
        OR: [
          { Name: { equals: normalizedName, mode: 'insensitive' } },
          { Code: { equals: normalizedCode, mode: 'insensitive' } },
        ]
      },
    });

    if (duplicate && !duplicate.IsArchived) {
      return res.status(409).json({ message: 'Unit already exists' });
    }

    let unit;
    if (duplicate && duplicate.IsArchived) {
       unit = await prisma.units.update({
         where: { Id: duplicate.Id },
         data: { Name: normalizedName, Code: normalizedCode, Description, IsArchived: false }
       });
    } else {
       unit = await prisma.units.create({
         data: {
           Name: normalizedName,
           Code: normalizedCode,
           Description,
           CreatedBy: req.user?.Id,
         }
       });
    }

    res.status(201).json({ success: true, data: unit });
  } catch (error) {
    console.error('Create unit error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getUnits = async (req, res) => {
  try {
    const units = await prisma.units.findMany({
      where: { IsArchived: false },
      orderBy: { CreatedAt: 'desc' },
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
    const unit = await prisma.units.findUnique({ where: { Id: id } });

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

    const unit = await prisma.units.findUnique({ where: { Id: id } });
    if (!unit) {
      return res.status(404).json({ message: 'Unit not found' });
    }

    if (!normalizedName || !normalizedCode) {
      return res.status(400).json({ message: 'Unit name and code are required' });
    }

    const duplicate = await prisma.units.findFirst({
      where: {
        Id: { not: id },
        OR: [
          { Name: { equals: normalizedName, mode: 'insensitive' } },
          { Code: { equals: normalizedCode, mode: 'insensitive' } },
        ],
      },
    });

    if (duplicate && !duplicate.IsArchived) {
      return res.status(409).json({ message: 'Unit already exists' });
    }

    const updated = await prisma.units.update({
      where: { Id: id },
      data: { Name: normalizedName, Code: normalizedCode, Description }
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update unit error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const unit = await prisma.units.findUnique({ where: { Id: id } });
    if (!unit) {
      return res.status(404).json({ message: 'Unit not found' });
    }

    await prisma.units.update({
      where: { Id: id },
      data: { IsArchived: true }
    });

    res.json({ success: true, message: 'Unit archived successfully' });
  } catch (error) {
    console.error('Delete unit error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export { 
  createUnit,
  getUnits,
  getUnitById,
  updateUnit,
  deleteUnit,
 };
