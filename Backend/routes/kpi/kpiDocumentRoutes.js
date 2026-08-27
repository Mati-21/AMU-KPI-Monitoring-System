import express from 'express';
import { protect, admin  } from '../../middleware/authMiddleware.js';
import { createKPIDocument,
  getKPIDocuments,
  getKPIDocumentById,
  updateKPIDocument,
  deleteKPIDocument
 } from '../../controllers/kpi/kpiDocumentController.js';

const router = express.Router();

router.route('/')
  .post(protect, admin, createKPIDocument)
  .get(protect, admin, getKPIDocuments);

router.route('/:id')
  .get(protect, admin, getKPIDocumentById)
  .put(protect, admin, updateKPIDocument)
  .delete(protect, admin, deleteKPIDocument);

export default router;
