const express = require('express');
const { protect, requireModulePermission, hasModulePermission } = require('../middleware/authMiddleware');
const { createUserKPI, getUserKPIs, getUserKPIById, updateUserKPI, deleteUserKPI } = require('../controllers/userKPIController');

const router = express.Router();

router
  .route('/')
  .post(
    protect,
    (req, res, next) => {
      const canCreateAssignedKpi = hasModulePermission(req, 'Assigned KPI', 'create');
      const canCreateLegacyAssign = hasModulePermission(req, 'Assign KPI', 'create');
      const canCreateLegacyManagement = hasModulePermission(req, 'KPI Management', 'create');

      if (canCreateAssignedKpi || canCreateLegacyAssign || canCreateLegacyManagement) {
        next();
        return;
      }

      res.status(403).json({ message: 'Not authorized for create access on Assigned KPI' });
    },
    createUserKPI
  )
  .get(
    protect,
    (req, res, next) => {
      const canViewPerformance = hasModulePermission(req, 'Performance', 'view');
      const canViewAssignedKpi = hasModulePermission(req, 'Assigned KPI', 'view');
      const canViewKpiManagement = hasModulePermission(req, 'KPI Management', 'view');
      const canAllocateKpi = hasModulePermission(req, 'Assign KPI', 'create');
      const canViewKpiAllocation = hasModulePermission(req, 'KPI Allocation', 'view');

      if (canViewPerformance || canViewAssignedKpi || canViewKpiManagement || canAllocateKpi || canViewKpiAllocation) {
        next();
        return;
      }

      res.status(403).json({ message: 'Not authorized to view KPI allocations' });
    },
    getUserKPIs
  );

router
  .route('/:id')
  .get(protect, requireModulePermission('KPI Management', 'view'), getUserKPIById)
  .put(protect, requireModulePermission('KPI Management', 'edit'), updateUserKPI)
  .delete(protect, requireModulePermission('KPI Management', 'delete'), deleteUserKPI);

module.exports = router;
