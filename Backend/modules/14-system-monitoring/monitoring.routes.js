import { Router } from 'express';
import * as monitoringController from './monitoring.controller.js';
import { protect, requireSuperAdmin } from '../../middleware/authMiddleware.js';

const router = Router();
const superAdminOnly = [protect, requireSuperAdmin];

/**
 * @swagger
 * tags:
 *   name: Monitoring
 *   description: Module 14 — System Monitoring for the Super Admin. How the server, traffic, database and security are doing, and the alerts raised.
 * /api/v1/monitoring/overview:
 *   get:
 *     summary: Overall health, each part's status, open alerts, and the running release
 *     tags: [Monitoring]
 *     responses:
 *       200: { description: "{ health: { overall, subsystems }, alerts, release, system }" }
 *       403: { description: Not the Super Admin }
 * /api/v1/monitoring/host:
 *   get:
 *     summary: Processor, memory, swap, disks, network and uptime of the machine
 *     tags: [Monitoring]
 *     responses:
 *       200: { description: Latest reading with the last ten minutes of load }
 * /api/v1/monitoring/traffic:
 *   get:
 *     summary: Requests per second, response time percentiles, error shares, slowest endpoints, and the Node process
 *     tags: [Monitoring]
 *     responses:
 *       200: { description: "{ traffic, process, recent }" }
 * /api/v1/monitoring/database:
 *   get:
 *     summary: Connection pool, response time, locks, deadlocks, cache hit share, replication and the slowest queries
 *     tags: [Monitoring]
 *     responses:
 *       200: { description: Database health }
 * /api/v1/monitoring/security:
 *   get:
 *     summary: Failed sign-ins, rate-limit blocks, open admin sessions, critical actions and certificate expiry
 *     tags: [Monitoring]
 *     responses:
 *       200: { description: Security overview }
 * /api/v1/monitoring/history:
 *   get:
 *     summary: Saved one-minute history for the trend charts
 *     tags: [Monitoring]
 *     parameters:
 *       - { in: query, name: range, schema: { type: string, enum: [hour, day, week], default: hour } }
 *     responses:
 *       200: { description: "{ range, groupMinutes, points }" }
 * /api/v1/monitoring/alerts:
 *   get:
 *     summary: Alerts, most severe and newest first
 *     tags: [Monitoring]
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [active, resolved, all], default: active } }
 *       - { in: query, name: limit, schema: { type: integer, default: 50, maximum: 200 } }
 *     responses:
 *       200: { description: Alerts }
 * /api/v1/monitoring/alerts/{id}/acknowledge:
 *   patch:
 *     summary: Say an alert has been seen. It stays open until the problem is gone
 *     tags: [Monitoring]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: The alert }
 */
router.get('/monitoring/overview', ...superAdminOnly, monitoringController.getOverview);
router.get('/monitoring/host', ...superAdminOnly, monitoringController.getHost);
router.get('/monitoring/traffic', ...superAdminOnly, monitoringController.getTraffic);
router.get('/monitoring/database', ...superAdminOnly, monitoringController.getDatabase);
router.get('/monitoring/security', ...superAdminOnly, monitoringController.getSecurity);
router.get('/monitoring/history', ...superAdminOnly, monitoringController.getHistory);
router.get('/monitoring/alerts', ...superAdminOnly, monitoringController.listAlerts);
router.patch('/monitoring/alerts/:id/acknowledge', ...superAdminOnly, monitoringController.acknowledgeAlert);

export default router;
