const express = require('express');
const { protect, hasModulePermission } = require('../middleware/authMiddleware');
const { createUserKPI, getUserKPIs, getUserKPIById, updateUserKPI, deleteUserKPI, bulkDeleteUserKPIs } = require('../controllers/userKPIController');

const router = express.Router();

const hasAnyModulePermission = (req, checks) => checks.some(([moduleName, action]) => hasModulePermission(req, moduleName, action));
const hasExtraMeasuresAccess = (req) => false;

router
  .route('/')
  .post(
    protect,
    (req, res, next) => {
      const canCreateKpiAllocation = hasModulePermission(req, 'KPI Allocation', 'create');
      const canAssignKpiAllocation = hasModulePermission(req, 'KPI Allocation', 'assign');

      if (canCreateKpiAllocation || canAssignKpiAllocation) {
        next();
        return;
      }

      res.status(403).json({ message: 'Not authorized for create access on KPI Allocation' });
    },
    createUserKPI
  )
  .get(
    protect,
    (req, res, next) => {
      const canViewAssignedKpi = hasModulePermission(req, 'Assigned KPI', 'view');
      const canViewKpiAllocation = hasModulePermission(req, 'KPI Allocation', 'view');
      const canCreateKpiAllocation = hasModulePermission(req, 'KPI Allocation', 'create');

      if (canViewAssignedKpi || canViewKpiAllocation || canCreateKpiAllocation) {
        next();
        return;
      }

      res.status(403).json({ message: 'Not authorized to view KPI allocations' });
    },
    getUserKPIs
  );

router.post(
  '/bulk-delete',
  protect,
  (req, res, next) => {
    const canDeleteKpiAllocation = hasModulePermission(req, 'KPI Allocation', 'delete');
    const canCreateKpiAllocation = hasModulePermission(req, 'KPI Allocation', 'create');

    if (canDeleteKpiAllocation || canCreateKpiAllocation) {
      next();
      return;
    }

    res.status(403).json({ message: 'Not authorized for bulk delete access' });
  },
  bulkDeleteUserKPIs
);

router
  .route('/:id')
  .get(
    protect,
    (req, res, next) => {
      const canViewAssignedKpi = hasModulePermission(req, 'Assigned KPI', 'view');
      const canViewDrivedKpiAllocation = hasAnyModulePermission(req, [
        ['Drived KPI Allocation', 'view'],
        ['Drived KPI', 'view'],
      ]);
      const canViewKpiAllocation = hasModulePermission(req, 'KPI Allocation', 'view');

      if (canViewAssignedKpi || canViewDrivedKpiAllocation || canViewKpiAllocation || hasExtraMeasuresAccess(req)) {
        next();
        return;
      }

      res.status(403).json({ message: 'Not authorized to view assigned KPI item' });
    },
    getUserKPIById
  )
  .put(
    protect,
    (req, res, next) => {
      const canEditDrivedKpiAllocation = hasAnyModulePermission(req, [
        ['Drived KPI Allocation', 'edit'],
        ['Drived KPI', 'edit'],
      ]);
      const canEditKpiAllocation = hasModulePermission(req, 'KPI Allocation', 'edit');
      const canCreateKpiAllocation = hasModulePermission(req, 'KPI Allocation', 'create');

      if (canEditDrivedKpiAllocation || canEditKpiAllocation || canCreateKpiAllocation || hasExtraMeasuresAccess(req)) {
        next();
        return;
      }

      res.status(403).json({ message: 'Not authorized to edit KPI allocation item' });
    },
    updateUserKPI
  )
  .delete(
    protect,
    (req, res, next) => {
      const canDeleteKpiAllocation = hasModulePermission(req, 'KPI Allocation', 'delete');
      const canCreateKpiAllocation = hasModulePermission(req, 'KPI Allocation', 'create');

      if (canDeleteKpiAllocation || canCreateKpiAllocation) {
        next();
        return;
      }

      res.status(403).json({ message: 'Not authorized to delete KPI allocation item' });
    },
    deleteUserKPI
  );

module.exports = router;
