import { prisma } from '../../config/database.js';
import { conflict } from '../../utils/httpError.js';

/**
 * Module 04 — KPIs are known by their names, which come from the ministry without codes. Two active KPIs cannot share
 * a name once capitals, punctuation and spacing are ignored, and names sharing most of their words are worth a look.
 */

const SMALL_WORDS = new Set(['a', 'an', 'the', 'of', 'in', 'on', 'for', 'to', 'and', 'or', 'by', 'at', 'with', 'per', 'from']);

// Two names count as the same KPI when this is equal: "Student Graduation Rate." and "student  graduation rate"
export const nameKey = (name) =>
  String(name ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const meaningfulWords = (name) => new Set(nameKey(name).split(' ').filter((word) => word && !SMALL_WORDS.has(word)));

/**
 * Share of meaningful words two names have in common, from 0 to 1. Word order does not matter.
 */
export const nameSimilarity = (first, second) => {
  const a = meaningfulWords(first);
  const b = meaningfulWords(second);
  if (a.size === 0 || b.size === 0) return 0;
  const shared = [...a].filter((word) => b.has(word)).length;
  return shared / new Set([...a, ...b]).size;
};

// "Number of graduated students" and "Number of students graduated" share all their words
const SIMILAR = 0.6;

export const activeKpiNames = (db = prisma) => db.kpi.findMany({ where: { isActive: true }, select: { id: true, name: true } });

export const sameNameIn = (kpis, name, exceptIds = []) => kpis.find((kpi) => !exceptIds.includes(kpi.id) && nameKey(kpi.name) === nameKey(name));

export const similarNamesIn = (kpis, name) => kpis.filter((kpi) => nameKey(kpi.name) !== nameKey(name) && nameSimilarity(kpi.name, name) >= SIMILAR);

/**
 * Refuse a name an active KPI already uses. exceptIds leaves out the KPI being edited or replaced.
 */
export const assertNameFree = async (name, exceptIds = []) => {
  const same = sameNameIn(await activeKpiNames(), name, exceptIds);
  if (same) throw conflict(`A KPI with this name already exists: "${same.name}"`, { existingKpiId: same.id });
};

export default { nameKey, nameSimilarity, activeKpiNames, sameNameIn, similarNamesIn, assertNameFree };
