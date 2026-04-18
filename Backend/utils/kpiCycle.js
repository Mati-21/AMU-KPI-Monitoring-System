const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

const getCurrentCycleYear = (date = new Date()) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  return month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
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
  const [startText, endText] = value.split('-');
  const startYear = Number(startText);
  const endYear = Number(endText);

  if (!Number.isInteger(startYear) || !Number.isInteger(endYear)) {
    return null;
  }

  return `${startYear - 1}-${endYear - 1}`;
};

module.exports = {
  QUARTERS,
  getCurrentCycleYear,
  getCurrentQuarter,
  normalizeQuarter,
  getPreviousCycleYear,
};
