import { prisma } from '../../../config/database.js';
import { auditAction } from '../../../utils/auditLogger.js';
import { notFound } from '../../../utils/httpError.js';
import { parseUuid } from '../../../utils/validation.js';
import { RULES } from './alert.rules.js';

/**
 * Alert lifecycle. A rule that is broken opens one alert and keeps updating it; it resolves by itself once the rule
 * has held for a few readings in a row, so a brief dip does not close it and a brief spike does not flood the list.
 * Acknowledging says "someone has seen this": the alert stays open until the problem is gone.
 */

// Readings in a row (ten seconds apart) the rule must hold before its alert resolves
const CLEAR_AFTER_READINGS = 3;
const ACTIVE = ['OPEN', 'ACKNOWLEDGED'];

const open = new Map(); // rule key -> alert row
const calm = new Map(); // rule key -> readings in a row without a problem

export const loadOpenAlerts = async () => {
  const rows = await prisma.systemAlert.findMany({ where: { status: { in: ACTIVE } } });
  open.clear();
  rows.forEach((row) => open.set(row.ruleKey, row));
};

const openAlert = async (rule, finding) => {
  const alert = await prisma.systemAlert.create({ data: { ruleKey: rule.key, severity: finding.severity, title: rule.title, message: finding.message, value: finding.value } });
  open.set(rule.key, alert);
};

// Keep an open alert current without writing on every reading: only when something a person would notice changed
const refreshAlert = async (rule, existing, finding) => {
  if (existing.severity === finding.severity && existing.message === finding.message) return;
  open.set(rule.key, await prisma.systemAlert.update({ where: { id: existing.id }, data: { severity: finding.severity, message: finding.message, value: finding.value } }));
};

const resolveAlert = async (key, existing) => {
  await prisma.systemAlert.update({ where: { id: existing.id }, data: { status: 'RESOLVED', resolvedAt: new Date() } });
  open.delete(key);
  calm.delete(key);
};

/**
 * Check every rule against the latest readings. Opens, updates and resolves alerts.
 */
export const evaluateAlerts = async (context) => {
  if (!context.thresholds.alerts_enabled) return;
  for (const rule of RULES) {
    const finding = rule.evaluate(context);
    const existing = open.get(rule.key);

    if (finding) {
      calm.delete(rule.key);
      if (existing) await refreshAlert(rule, existing, finding);
      else await openAlert(rule, finding);
    } else if (existing) {
      const readings = (calm.get(rule.key) ?? 0) + 1;
      if (readings >= CLEAR_AFTER_READINGS) await resolveAlert(rule.key, existing);
      else calm.set(rule.key, readings);
    }
  }
};

const ALERT_SELECT = {
  id: true,
  ruleKey: true,
  severity: true,
  title: true,
  message: true,
  value: true,
  status: true,
  openedAt: true,
  acknowledgedAt: true,
  resolvedAt: true,
  acknowledgedBy: { select: { id: true, firstName: true, lastName: true } },
};

/**
 * status: "active" (open or acknowledged, the default), "resolved" or "all". Most severe and newest first.
 */
export const listAlerts = ({ status = 'active', limit = 50 } = {}) => {
  const where = status === 'all' ? {} : status === 'resolved' ? { status: 'RESOLVED' } : { status: { in: ACTIVE } };
  return prisma.systemAlert.findMany({ where, orderBy: [{ severity: 'asc' }, { openedAt: 'desc' }], take: Math.min(Math.max(Number(limit) || 50, 1), 200), select: ALERT_SELECT });
};

export const acknowledgeAlert = async (id, actor) => {
  const alertId = parseUuid(id, 'id');
  const alert = await prisma.systemAlert.findUnique({ where: { id: alertId } });
  if (!alert) throw notFound('Alert not found');
  if (alert.status !== 'OPEN') return prisma.systemAlert.findUnique({ where: { id: alertId }, select: ALERT_SELECT });

  const updated = await prisma.systemAlert.update({ where: { id: alertId }, data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date(), acknowledgedByPersonId: actor.personId }, select: ALERT_SELECT });
  if (open.has(alert.ruleKey)) open.set(alert.ruleKey, { ...open.get(alert.ruleKey), status: 'ACKNOWLEDGED' });
  await auditAction(actor, { action: 'ALERT_ACKNOWLEDGED', entityType: 'system_alert', entityId: alertId, newValues: { ruleKey: alert.ruleKey, severity: alert.severity } });
  return updated;
};

export default { loadOpenAlerts, evaluateAlerts, listAlerts, acknowledgeAlert };
