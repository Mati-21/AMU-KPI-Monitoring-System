const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

const FALLBACK_CYCLE_YEAR = '2018';
const ACTIVE_CYCLE_YEAR_KEY = 'active_cycle_year';

// In-memory cache so every call doesn't hit the DB
let _cachedCycleYear = null;

const getCurrentCycleYear = () => {
  return _cachedCycleYear || FALLBACK_CYCLE_YEAR;
};

/**
 * Load the active cycle year from the DB once at startup.
 * Call this in server.js after DB is ready.
 */
const loadCycleYearFromDB = async () => {
  try {
    const { SystemSetting } = require('../models');
    const setting = await SystemSetting.findOne({ where: { Key: ACTIVE_CYCLE_YEAR_KEY } });
    if (setting?.Value) {
      _cachedCycleYear = setting.Value;
    } else {
      // Seed default if not exists
      await SystemSetting.findOrCreate({
        where: { Key: ACTIVE_CYCLE_YEAR_KEY },
        defaults: { Value: FALLBACK_CYCLE_YEAR, Type: 'string' },
      });
      _cachedCycleYear = FALLBACK_CYCLE_YEAR;
    }
  } catch (err) {
    console.warn('[kpiCycle] Could not load cycle year from DB, using fallback:', err.message);
    _cachedCycleYear = FALLBACK_CYCLE_YEAR;
  }
};

/**
 * Update the active cycle year in both the in-memory cache and the DB.
 */
const setActiveCycleYear = async (newYear) => {
  const { SystemSetting } = require('../models');
  const [setting] = await SystemSetting.findOrCreate({
    where: { Key: ACTIVE_CYCLE_YEAR_KEY },
    defaults: { Value: newYear, Type: 'string' },
  });
  if (setting.Value !== newYear) {
    setting.Value = newYear;
    await setting.save();
  }
  _cachedCycleYear = newYear;
};

const getCurrentQuarter = (date = new Date()) => {
  const month = date.getMonth() + 1;
  if (month >= 8 && month <= 10) return 'Q1';
  if (month >= 11 || month <= 1) return 'Q2';
  if (month >= 2 && month <= 4) return 'Q3';
  return 'Q4';
};

const normalizeQuarter = (value) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().toUpperCase();
  return QUARTERS.includes(normalized) ? normalized : null;
};

const getPreviousCycleYear = (cycleYear) => {
  const value = String(cycleYear || '').trim();
  const year = Number(value);
  if (!Number.isInteger(year) || year <= 0) return null;
  return String(year - 1);
};

const getNextCycleYear = (cycleYear) => {
  const value = String(cycleYear || '').trim();
  const year = Number(value);
  if (!Number.isInteger(year) || year <= 0) return null;
  return String(year + 1);
};

module.exports = {
  QUARTERS,
  FALLBACK_CYCLE_YEAR,
  ACTIVE_CYCLE_YEAR_KEY,
  getCurrentCycleYear,
  loadCycleYearFromDB,
  setActiveCycleYear,
  getCurrentQuarter,
  normalizeQuarter,
  getPreviousCycleYear,
  getNextCycleYear,
};
