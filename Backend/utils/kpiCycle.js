/**
 * KPI Evaluation Cycle Helper Utilities
 */
export const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
export const FALLBACK_CYCLE_YEAR = '2026';

let _cachedCycleYear = FALLBACK_CYCLE_YEAR;

export const getCurrentCycleYear = () => _cachedCycleYear;

export const setActiveCycleYear = async (newYear) => {
  _cachedCycleYear = String(newYear);
  return _cachedCycleYear;
};

export const loadCycleYearFromDB = async () => {
  // Skeleton: Can be connected to prisma.fiscalYear or prisma.systemSetting
  return _cachedCycleYear;
};

export const getCurrentQuarter = (date = new Date()) => {
  const month = date.getMonth() + 1;
  if (month >= 8 && month <= 10) return 'Q1';
  if (month >= 11 || month <= 1) return 'Q2';
  if (month >= 2 && month <= 4) return 'Q3';
  return 'Q4';
};

export const normalizeQuarter = (value) => {
  if (!value) return null;
  const normalized = String(value).trim().toUpperCase();
  return QUARTERS.includes(normalized) ? normalized : null;
};

export default {
  QUARTERS,
  FALLBACK_CYCLE_YEAR,
  getCurrentCycleYear,
  setActiveCycleYear,
  loadCycleYearFromDB,
  getCurrentQuarter,
  normalizeQuarter,
};
