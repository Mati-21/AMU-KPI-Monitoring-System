import { Router } from 'express';

import { maintenanceGuard } from '../middleware/maintenanceMiddleware.js';
import devRoutes, { isDevEnvironment } from './00-dev/dev.routes.js';
import authRoutes from './01-identity-access/auth/auth.routes.js';
import personRoutes from './01-identity-access/person/person.routes.js';
import officeRoutes from './02-office-hierarchy/office.routes.js';
import roleRoutes from './03-access-control/role.routes.js';
import kpiRoutes from './04-kpi-catalog/kpi.routes.js';
import targetRoutes from './05-target-cascading/target.routes.js';
import cycleRoutes from './06-evaluation-cycles/cycle.routes.js';
import evaluationRoutes from './07-performance-scoring/evaluation.routes.js';
import evidenceRoutes from './08-evidence-documents/evidence.routes.js';
import notificationRoutes from './09-notifications/notification.routes.js';
import systemRoutes from './10-system-governance/system.routes.js';

/**
 * API v1 router. Each module router declares its own resource paths exactly as listed in
 * MODULES_SPECIFICATION.html (e.g. /persons, /kpi-targets, /cycle-reports), so they are all mounted at the root.
 */
const router = Router();

// Development-only helpers (quick Super Admin login). Never mounted outside NODE_ENV=development.
if (isDevEnvironment()) {
  console.warn('⚠️  Dev routes enabled: POST /api/v1/dev/login (Super Admin without password/MFA)');
  router.use(devRoutes);
}

// Maintenance mode (setting system.maintenance_mode): 503 for everyone but university-wide settings managers
router.use(maintenanceGuard);

router.use(authRoutes); // 01 /auth/*
router.use(personRoutes); // 01 /persons, /users/:id/*
router.use(officeRoutes); // 02 /office-types, /offices
router.use(roleRoutes); // 03 /roles, /permissions, /office-persons, /office-person-roles, /auth/check-permission
router.use(kpiRoutes); // 04 /fiscal-years, /strategic-objectives, /kpi-themes, /measurement-units, /reporting-frequencies, /kpi-scales, /currencies, /exchange-rates, /kpis
router.use(targetRoutes); // 05 /kpi-targets
router.use(cycleRoutes); // 06 /eval-cycles, /cycle-reports
router.use(evaluationRoutes); // 07 /kpi-evaluations, /performance
router.use(evidenceRoutes); // 08 /files, /document-types, /documents, /evidence, /document-links
router.use(notificationRoutes); // 09 /notifications
router.use(systemRoutes); // 10 /settings, /audit-logs

export default router;
