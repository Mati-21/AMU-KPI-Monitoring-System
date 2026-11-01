import { formatDate, todayIso } from '../../02-offices/lib/officeTree';

const startsLater = (assignment) => assignment.validFrom.slice(0, 10) > todayIso();

export const scopeLabel = (assignment) => (assignment.scopeOffice ? assignment.scopeOffice.name : 'Whole university');

/**
 * Role names, without repeats. A role that has not started yet says when it will.
 */
export const roleNames = (assignments = []) =>
  [...new Set(assignments.map((assignment) => (startsLater(assignment) ? `${assignment.role.name} (from ${formatDate(assignment.validFrom)})` : assignment.role.name)))].join(', ') || 'No role yet';

export const assignmentPeriod = (assignment) => `From ${formatDate(assignment.validFrom)}${assignment.validTo ? ` to ${formatDate(assignment.validTo)}` : ''}`;
