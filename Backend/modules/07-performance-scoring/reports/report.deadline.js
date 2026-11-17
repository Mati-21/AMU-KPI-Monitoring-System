import { startOfTodayUtc } from '../../../utils/dates.js';
import { conflict } from '../../../utils/httpError.js';
import { addDays } from '../../06-reporting-periods/period.rules.js';
import { getSetting } from '../../10-system-governance/system.service.js';

/**
 * Where a report stands against its period's deadline today. A submission now is late once the deadline has passed.
 * It is locked, when the lock after deadline setting is on, once late submissions are not allowed or the grace period is over, unless the Super Admin allowed
 * this office to submit until a later day. A locked report can no longer be changed or submitted.
 */
export const deadlineState = async (period, report, today = startOfTodayUtc()) => {
  if (!period.submissionDeadline || today <= period.submissionDeadline) return { isLate: false, isLocked: false, lockedSince: null };

  const [allowLate, graceDays, autoLock] = await Promise.all([
    getSetting('reporting', 'allow_late_submission'),
    getSetting('reporting', 'late_submission_grace_days'),
    getSetting('reporting', 'auto_lock_after_deadline'),
  ]);
  const graceEnds = addDays(period.submissionDeadline, graceDays);
  // With the lock off nothing is ever locked, a late report is only flagged late
  const pastAllowed = autoLock && (!allowLate || today > graceEnds);
  const unlocked = Boolean(report?.lateAllowedUntil) && today <= report.lateAllowedUntil;
  return { isLate: true, isLocked: pastAllowed && !unlocked, lockedSince: pastAllowed ? (allowLate ? graceEnds : period.submissionDeadline) : null };
};

/**
 * Refuse a change to a report that the deadline has locked: results and evidence can no longer be saved, and only the
 * Super Admin can open it again for a late submission.
 */
export const assertNotLockedByDeadline = async (period, report) => {
  if ((await deadlineState(period, report)).isLocked) {
    throw conflict('The submission deadline and grace period have passed, so this report can no longer be changed. Only the Super Admin can allow a late submission');
  }
};
