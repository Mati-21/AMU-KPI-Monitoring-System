import express from 'express';

// Import all routes
import authRoutes from './auth/authRoutes.js';
import userRoutes from './user/userRoutes.js';
import roleCategoryRoutes from './user/roleCategoryRoutes.js';
import roleRoutes from './user/roleRoutes.js';
import userRoleRoutes from './user/userRoleRoutes.js';
import unitRoutes from './kpi/unitRoutes.js';
import kpiTypeRoutes from './kpi/kpiTypeRoutes.js';
import kpiRoutes from './kpi/kpiRoutes.js';
import kpiDocumentRoutes from './kpi/kpiDocumentRoutes.js';
import kpiYearPlanRoutes from './kpi/kpiYearPlanRoutes.js';
import userKpiRoutes from './performance/userKpiRoutes.js';
import userKpiResultRoutes from './performance/userKpiResultRoutes.js';
import notificationRoutes from './communication/notificationRoutes.js';
import messageRoutes from './communication/messageRoutes.js';
import contactRoutes from './communication/contactRoutes.js';
import adminDashboardRoutes from './system/adminDashboardRoutes.js';
import settingRoutes from './system/settingRoutes.js';

const router = express.Router();

// Auth Routes
router.use('/auth', authRoutes);

// User Routes
router.use('/users', userRoutes);
router.use('/role-categories', roleCategoryRoutes);
router.use('/roles', roleRoutes);
router.use('/user-roles', userRoleRoutes);

// KPI Routes
router.use('/units', unitRoutes);
router.use('/kpi-types', kpiTypeRoutes);
router.use('/kpis', kpiRoutes);
router.use('/kpi-documents', kpiDocumentRoutes);
router.use('/kpi-year-plans', kpiYearPlanRoutes);

// Performance Routes
router.use('/user-kpis', userKpiRoutes);
router.use('/user-kpi-results', userKpiResultRoutes);

// Communication Routes
router.use('/notifications', notificationRoutes);
router.use('/messages', messageRoutes);
router.use('/contact-messages', contactRoutes);

// System Routes
router.use('/admin-dashboard', adminDashboardRoutes);
router.use('/settings', settingRoutes);

export default router;