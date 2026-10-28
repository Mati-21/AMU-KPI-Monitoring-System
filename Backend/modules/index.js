import { Router } from 'express';

// Import Module Routes from Numbered Modules 01 to 10
import authRoutes from './01-identity-access/auth/auth.routes.js';
import userRoutes from './01-identity-access/user/user.routes.js';
import officeRoutes from './02-office-hierarchy/office.routes.js';
import roleRoutes from './03-access-control/role.routes.js';
import kpiRoutes from './04-kpi-catalog/kpi.routes.js';
import targetRoutes from './05-target-cascading/target.routes.js';
import cycleRoutes from './06-evaluation-cycles/cycle.routes.js';
import evaluationRoutes from './07-performance-scoring/evaluation.routes.js';
import evidenceRoutes from './08-evidence-documents/evidence.routes.js';
import notificationRoutes from './09-notifications/notification.routes.js';
import systemRoutes from './10-system-governance/system.routes.js';

const router = Router();

// Module 01: Identity & Access (Auth & User Directory)
router.use('/auth', authRoutes);
router.use('/users', userRoutes);

// Module 02: Office & Hierarchy
router.use('/offices', officeRoutes);

// Module 03: Scoped Access Control (Roles & Permissions)
router.use('/roles', roleRoutes);

// Module 04: Strategic KPI Catalog
router.use('/kpis', kpiRoutes);

// Module 05: Target Cascading & Allocation
router.use('/targets', targetRoutes);

// Module 06: Evaluation Cycles & Reports
router.use('/cycles', cycleRoutes);

// Module 07: Performance Scoring & Scorecards
router.use('/evaluations', evaluationRoutes);

// Module 08: Evidence Documents & Proof
router.use('/evidence', evidenceRoutes);

// Module 09: Targeted Notifications & Alerts
router.use('/notifications', notificationRoutes);

// Module 10: System Governance & Audit Trail
router.use('/system', systemRoutes);

export default router;
