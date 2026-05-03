const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { protect, admin, requireModulePermission, requirePermission, permissionKey, hasModulePermission } = require('../middleware/authMiddleware');
const {
  createUserKPIResult,
  getUserKPIResults,
  getAnnualUserKPIReport,
  getAffiliatedOfficeReport,
  getCurrentOfficeReport,
  submitCurrentOfficeReportToParent,
  getUserKPIResultById,
  updateUserKPIResult,
  deleteUserKPIResult,
} = require('../controllers/userKPIResultController');

const router = express.Router();

const AFFILIATED_OFFICE_REPORT_PERMISSION_KEYS = [
  permissionKey('view', 'Affiliated Office Report'),
  permissionKey('view', 'KPI Reporting'),
  permissionKey('view', 'Other Affiliated Office Reports'),
  permissionKey('view', 'Other Role Reports'),
].filter(Boolean);

const evidenceUploadDir = path.join(__dirname, '..', 'uploads', 'performance-evidence');
fs.mkdirSync(evidenceUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, evidenceUploadDir),
  filename: (_req, file, callback) => {
    const safeName = String(file.originalname || 'evidence').replace(/[^a-z0-9_.-]/gi, '_');
    callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
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

router
  .route('/:id')
  .get(protect, admin, getUserKPIResultById)
  .put(protect, canSubmitPerformanceResult, upload.single('EvidenceFile'), updateUserKPIResult)
  .delete(protect, admin, deleteUserKPIResult);

module.exports = router;
