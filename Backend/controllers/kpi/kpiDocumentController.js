import { prisma  } from '../../config/database.js';

const createKPIDocument = async (req, res) => {
  try {
    const { UserId, KPIId, DOCTitle, FileURL, Remark } = req.body;

    const user = await prisma.users.findUnique({ where: { Id: UserId } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const kpi = await prisma.kPIs.findUnique({ where: { Id: KPIId } });
    if (!kpi) {
      return res.status(404).json({ message: 'KPI not found' });
    }

    const document = await prisma.kPIDocuments.create({
      data: {
        UserId,
        KPIId,
        DOCTitle,
        FileURL,
        Remark,
        CreatedBy: req.user?.Id
      }
    });

    res.status(201).json({ success: true, data: document });
  } catch (error) {
    console.error('Create KPI document error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getKPIDocuments = async (req, res) => {
  try {
    const documents = await prisma.kPIDocuments.findMany({
      where: { IsArchived: false },
      include: {
        Users: { select: { Id: true, FirstName: true, UserName: true, Email: true } },
        KPIs: { select: { Id: true, Target: true, Description: true } }
      },
      orderBy: { CreatedAt: 'desc' }
    });

    const mapped = documents.map(d => ({
      ...d,
      User: d.Users,
      KPI: d.KPIs,
      Users: undefined,
      KPIs: undefined
    }));

    res.json({ success: true, data: mapped });
  } catch (error) {
    console.error('Get KPI documents error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getKPIDocumentById = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await prisma.kPIDocuments.findUnique({
      where: { Id: id },
      include: {
        Users: { select: { Id: true, FirstName: true, UserName: true, Email: true } },
        KPIs: { select: { Id: true, Target: true, Description: true } }
      }
    });

    if (!document) {
      return res.status(404).json({ message: 'KPI document not found' });
    }

    const mapped = {
      ...document,
      User: document.Users,
      KPI: document.KPIs,
      Users: undefined,
      KPIs: undefined
    };

    res.json({ success: true, data: mapped });
  } catch (error) {
    console.error('Get KPI document error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateKPIDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { UserId, KPIId, DOCTitle, FileURL, Remark } = req.body;

    const document = await prisma.kPIDocuments.findUnique({ where: { Id: id } });
    if (!document) {
      return res.status(404).json({ message: 'KPI document not found' });
    }

    if (UserId) {
      const user = await prisma.users.findUnique({ where: { Id: UserId } });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
    }

    if (KPIId) {
      const kpi = await prisma.kPIs.findUnique({ where: { Id: KPIId } });
      if (!kpi) {
        return res.status(404).json({ message: 'KPI not found' });
      }
    }

    const updated = await prisma.kPIDocuments.update({
      where: { Id: id },
      data: { UserId, KPIId, DOCTitle, FileURL, Remark }
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update KPI document error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteKPIDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await prisma.kPIDocuments.findUnique({ where: { Id: id } });

    if (!document) {
      return res.status(404).json({ message: 'KPI document not found' });
    }

    await prisma.kPIDocuments.update({
      where: { Id: id },
      data: { IsArchived: true }
    });

    res.json({ success: true, message: 'KPI document archived successfully' });
  } catch (error) {
    console.error('Delete KPI document error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export { 
  createKPIDocument,
  getKPIDocuments,
  getKPIDocumentById,
  updateKPIDocument,
  deleteKPIDocument
 };
