import { Router } from 'express';

import { maintenanceGuard } from '../middleware/maintenanceMiddleware.js';
import devRoutes, { isDevEnvironment } from './00-dev/dev.routes.js';
import authRoutes from './01-identity-access/auth/auth.routes.js';
import personRoutes from './01-identity-access/person/person.routes.js';
import profileRoutes from './01-identity-access/profile/profile.routes.js';
import officeRoutes from './02-office-hierarchy/office.routes.js';
import roleRoutes from './03-access-control/role.routes.js';
import kpiRoutes from './04-kpi-catalog/kpi.routes.js';
import contractRoutes from './05-contract-cascading/contract.routes.js';
import periodRoutes from './06-reporting-periods/period.routes.js';
import performanceRoutes from './07-performance-scoring/performance.routes.js';
import evidenceRoutes from './08-evidence-documents/evidence.routes.js';
import notificationRoutes from './09-notifications/notification.routes.js';
import systemRoutes from './10-system-governance/system.routes.js';
import dashboardRoutes from './11-dashboards/dashboard.routes.js';
import supportRoutes from './12-support/support.routes.js';
import messageRoutes from './13-messaging/message.routes.js';
import monitoringRoutes from './14-system-monitoring/monitoring.routes.js';

/**
 * API v1 router. Each module router declares its own resource paths exactly as listed in
 * MODULES_SPECIFICATION.html (e.g. /persons, /contracts, /reporting-periods), so they are all mounted at the root.
 */
const router = Router();

// Development-only helpers (quick Super Admin login). Never mounted outside NODE_ENV=development.
if (isDevEnvironment()) {
  console.warn('⚠️  Dev routes enabled: POST /api/v1/dev/login (Super Admin without password/MFA)');
  console.warn('⚠️  Development mode: the Super Admin signs in without two-factor authentication');
  router.use(devRoutes);
}

// Maintenance mode (setting system.maintenance_mode): 503 for everyone but university-wide settings managers
router.use(maintenanceGuard);

router.use(authRoutes); // 01 /auth/*
router.use(profileRoutes); // 01 /auth/me (changes), /persons/:id/profile-picture
router.use(personRoutes); // 01 /persons, /users/:id/*
router.use(officeRoutes); // 02 /office-types, /offices
router.use(roleRoutes); // 03 /roles, /permissions, /office-persons, /office-person-roles, /auth/check-permission
router.use(kpiRoutes); // 04 /fiscal-years, /kpi-themes, /measurement-units, /reporting-frequencies, /kpi-scales, /currencies, /exchange-rates, /kpis
router.use(contractRoutes); // 05 /contracts, /assignments, /change-requests
router.use(periodRoutes); // 06 /reporting-periods
router.use(performanceRoutes); // 07 /reports, /scorecards, /performance-thresholds
router.use(evidenceRoutes); // 08 /files, /document-types, /documents, /performance-values, /performance-evidence
router.use(notificationRoutes); // 09 /notifications
router.use(systemRoutes); // 10 /settings, /audit-logs
router.use(dashboardRoutes); // 11 /dashboards
router.use(supportRoutes); // 12 /support-requests
router.use(messageRoutes); // 13 /messages
router.use(monitoringRoutes); // 14 /monitoring

export default router;
