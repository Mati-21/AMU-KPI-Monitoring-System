import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { protect, admin, requireModulePermission, requirePermission, permissionKey, hasModulePermission  } from '../../middleware/authMiddleware.js';
import { createUserKPIResult,
  getUserKPIResults,
  getAnnualUserKPIReport,
  getAffiliatedOfficeReport,
  getCurrentOfficeReport,
  submitCurrentOfficeReportToParent,
  getUserKPIResultById,
  updateUserKPIResult,
  deleteUserKPIResult,
  getKPIApprovals,
  approveKPIResult,
  adjustKPIResult,
 } from '../../controllers/performance/userKPIResultController.js';

const router = express.Router();

const AFFILIATED_OFFICE_REPORT_PERMISSION_KEYS = [
  permissionKey('view', 'Affiliated Office Report'),
  permissionKey('view', 'KPI Reporting'),
  permissionKey('view', 'Other Affiliated Office Reports'),
  permissionKey('view', 'Other Role Reports'),
].filter(Boolean);

import { evidenceStorage  } from '../../services/uploadService.js';

const upload = multer({
  storage: evidenceStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Please upload a PDF, Word, Excel, or image file.`), false);
    }
  },
});

const canSubmitPerformanceResult = (req, res, next) => {
  const canViewAssignedKpi = hasModulePermission(req, 'Assigned KPI', 'view');
  const canCreateEvaluation = hasModulePermission(req, 'KPI Evaluation', 'create');
  const canViewEvaluation = hasModulePermission(req, 'KPI Evaluation', 'view');

  if (canViewAssignedKpi || canCreateEvaluation || canViewEvaluation) {
    next();
    return;
  }

  res.status(403).json({ message: 'Not authorized to submit KPI performance results' });
};

router
  .route('/')
  .post(protect, canSubmitPerformanceResult, upload.single('EvidenceFile'), createUserKPIResult)
  .get(protect, admin, getUserKPIResults);

router.route('/annual').get(protect, requireModulePermission('KPI Management', 'view'), getAnnualUserKPIReport);

router.route('/report').get(protect, requirePermission(AFFILIATED_OFFICE_REPORT_PERMISSION_KEYS), getCurrentOfficeReport);

router.route('/report/submit').post(protect, requirePermission(AFFILIATED_OFFICE_REPORT_PERMISSION_KEYS), submitCurrentOfficeReportToParent);

router.route('/affiliated-office-report').get(protect, requirePermission(AFFILIATED_OFFICE_REPORT_PERMISSION_KEYS), getAffiliatedOfficeReport);

router.route('/role-report').get(protect, requirePermission(AFFILIATED_OFFICE_REPORT_PERMISSION_KEYS), getAffiliatedOfficeReport);

router.route('/approvals').get(protect, getKPIApprovals);
router.route('/:id/approve').patch(protect, approveKPIResult);
router.route('/:id/adjust').patch(protect, adjustKPIResult);

router
  .route('/:id')
  .get(protect, admin, getUserKPIResultById)
  .put(protect, canSubmitPerformanceResult, upload.single('EvidenceFile'), updateUserKPIResult)
  .delete(protect, admin, deleteUserKPIResult);

export default router;
