import { useEffect, useRef, useState } from 'react';

import { MONTHS, currentEthiopianYear, daysInMonth, formatEthiopianDate, fromEthiopian, toEthiopian } from '../../lib/ethiopianDate';

const SELECT = 'h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';

const partsOf = (value) => {
  const date = toEthiopian(value);
  return date ? { year: String(date.year), month: String(date.month), day: String(date.day) } : { year: '', month: '', day: '' };
};

/**
 * A date picked as an Ethiopian day, month and year. It takes and gives the Gregorian 'YYYY-MM-DD' the server stores,
 * so it replaces an <input type="date"> as it is. The value is empty until all three parts are chosen.
 */
const EthiopianDateInput = ({ value, onChange, required, min, max, disabled, label = 'Date', className = '' }) => {
  const [parts, setParts] = useState(() => partsOf(value));
  const dayRef = useRef(null);

  // Follow a value changed from outside, such as a form being reset
  useEffect(() => {
    const current = parts.year && parts.month && parts.day ? fromEthiopian(Number(parts.year), Number(parts.month), Number(parts.day)) : '';
    if ((value || '') !== current) setParts(partsOf(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const iso = parts.year && parts.month && parts.day ? fromEthiopian(Number(parts.year), Number(parts.month), Number(parts.day)) : '';
  const problem = iso && min && iso < min ? `Must be on or after ${formatEthiopianDate(min)}` : iso && max && iso > max ? `Must be on or before ${formatEthiopianDate(max)}` : '';

  // The form refuses to submit while the date is outside its range
  useEffect(() => {
    dayRef.current?.setCustomValidity(problem);
  }, [problem]);

  const change = (key) => (event) => {
    const next = { ...parts, [key]: event.target.value };
    if (next.year && next.month && Number(next.day) > daysInMonth(Number(next.year), Number(next.month))) next.day = '';
    setParts(next);
    onChange(next.year && next.month && next.day ? fromEthiopian(Number(next.year), Number(next.month), Number(next.day)) : '');
  };

  const thisYear = currentEthiopianYear();
  const years = [...new Set([...Array.from({ length: 16 }, (_, index) => thisYear - 10 + index), ...(parts.year ? [Number(parts.year)] : [])])].sort((a, b) => a - b);
  const days = daysInMonth(Number(parts.year) || 1, Number(parts.month) || 1);

  return (
    <div className={className}>
      <div className="flex gap-2">
        <select ref={dayRef} aria-label={`${label} day`} required={required} disabled={disabled} value={parts.day} onChange={change('day')} className={`${SELECT} w-20`}>
          <option value="">Day</option>
          {Array.from({ length: days }, (_, index) => (
            <option key={index + 1} value={index + 1}>
              {index + 1}
            </option>
          ))}
        </select>
        <select aria-label={`${label} month`} required={required} disabled={disabled} value={parts.month} onChange={change('month')} className={`${SELECT} min-w-0 flex-1`}>
          <option value="">Month</option>
          {MONTHS.map((name, index) => (
            <option key={name} value={index + 1}>
              {name}
            </option>
          ))}
        </select>
        <select aria-label={`${label} year`} required={required} disabled={disabled} value={parts.year} onChange={change('year')} className={`${SELECT} w-24`}>
          <option value="">Year</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>
      {problem && <p className="mt-1 text-xs text-red-500">{problem}</p>}
    </div>
  );
};

export default EthiopianDateInput;
