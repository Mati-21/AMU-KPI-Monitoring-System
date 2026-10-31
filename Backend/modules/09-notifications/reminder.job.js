import { prisma } from '../../config/database.js';
import { PERMISSIONS } from '../../config/permissions.js';
import { startOfTodayUtc } from '../../utils/dates.js';
import { getSetting } from '../10-system-governance/system.service.js';
import { sendNotification } from './dispatch.service.js';

/**
 * Module 09 — Deadline reminders (SRS 15). Runs at startup and every few hours; a reminder already sent is never
 * repeated, so restarts and several server instances are safe.
 */

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const STILL_OPEN_REPORT = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'];

/**
 * What to send today for a deadline, if anything. Pure, so it can be tested on its own.
 */
export const reminderFor = (deadline, today, reminderDays) => {
  const daysLeft = Math.round((deadline.getTime() - today.getTime()) / DAY_MS);
  if (daysLeft < 0) return { notificationType: 'DEADLINE_MISSED', title: 'Reporting deadline missed' };
  if (reminderDays.includes(daysLeft)) return { notificationType: `DEADLINE_IN_${daysLeft}_DAYS`, title: 'Reporting deadline approaching', daysLeft };
  return null;
};

const messageFor = (period, reminder) =>
  reminder.daysLeft === undefined ? `The ${period.name} report deadline has passed and your report is not submitted.` : `Your ${period.name} report is due in ${reminder.daysLeft} day(s).`;

const alreadySent = (period, officeId, notificationType) =>
  prisma.notification.count({ where: { notificationType, entityType: 'reporting_period', entityId: period.id, targetOfficeId: officeId } });

/**
 * Offices with KPIs due in the period that have not submitted yet.
 */
const officesStillOwing = async (period) => {
  const contracts = await prisma.performanceContract.findMany({
    where: {
      fiscalYearId: period.fiscalYearId,
      status: { in: ['APPROVED', 'SIGNED'] },
      assignments: { some: { status: { in: ['APPROVED', 'ACKNOWLEDGED'] }, ...(period.isYearEnd ? {} : { reportingFrequencyId: period.frequencyId }) } },
      reports: { none: { reportingPeriodId: period.id, status: { in: STILL_OPEN_REPORT } } },
    },
    select: { officeId: true },
  });
  return contracts.map((contract) => contract.officeId);
};

export const sendDeadlineReminders = async (today = startOfTodayUtc()) => {
  const reminderDays = await getSetting('reporting', 'reminder_days_before_deadline');
  const periods = await prisma.reportingPeriod.findMany({
    where: { isClosed: false, submissionDeadline: { not: null }, fiscalYear: { status: 'ACTIVE' } },
  });

  let sent = 0;
  for (const period of periods) {
    const reminder = reminderFor(period.submissionDeadline, today, reminderDays);
    if (!reminder) continue;
    for (const officeId of await officesStillOwing(period)) {
      if ((await alreadySent(period, officeId, reminder.notificationType)) > 0) continue;
      const notification = await sendNotification({
        title: reminder.title,
        message: messageFor(period, reminder),
        notificationType: reminder.notificationType,
        entityType: 'reporting_period',
        entityId: period.id,
        targetOfficeId: officeId,
        requiredPermissionCode: PERMISSIONS.REPORT_SUBMIT,
      });
      if (notification) sent += 1;
    }
  }
  return sent;
};

export const startReminderJob = () => {
  const run = () => sendDeadlineReminders().catch((error) => console.warn('[Reminders] Could not run:', error.message));
  run();
  setInterval(run, CHECK_EVERY_MS).unref();
};

export default { reminderFor, sendDeadlineReminders, startReminderJob };
