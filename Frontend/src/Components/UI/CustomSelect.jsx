import { useMemo, useState } from 'react';

const isOptionObject = (opt) => opt && typeof opt === 'object' && ('value' in opt || 'label' in opt);

const getOptionValue = (opt) => {
  if (isOptionObject(opt)) return String(opt.value ?? opt.label ?? '');
  return String(opt);
};

const getOptionLabel = (opt) => {
  if (isOptionObject(opt)) return String(opt.label ?? opt.value ?? '');
  return String(opt);
};

function CustomSelect({ options, value, onChange, placeholder, compact = false, menuPlacement = 'bottom' }) {
  const [open, setOpen] = useState(false);
  const buttonClassName = compact
    ? 'w-full h-9 px-3 text-left text-xs min-w-40 bg-card border border-border rounded-md flex justify-between items-center'
    : 'w-full h-full px-4 py-2 text-left text-xs min-w-40 bg-card border border-border rounded-md flex justify-between items-center';

  const optionClassName = compact
    ? 'cursor-pointer px-3 py-1.5 text-xs hover:bg-muted flex justify-between items-center'
    : 'cursor-pointer px-4 py-2 hover:bg-muted flex justify-between items-center';

  const menuClassName = useMemo(() => {
    const placementClass = menuPlacement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1';
    return `absolute z-10 w-full bg-card border border-border rounded-md shadow-md max-h-60 overflow-y-auto overflow-x-hidden ${placementClass}`;
  }, [menuPlacement]);

  const displayValue = useMemo(() => {
    if (value === null || value === undefined || value === '') return '';
    const stringValue = String(value);
    const match = (Array.isArray(options) ? options : []).find((opt) => getOptionValue(opt) === stringValue);
    return match ? getOptionLabel(match) : stringValue;
  }, [options, value]);

  return (
    <div className="relative w-full">
      <button type="button" onClick={() => setOpen(!open)} className={buttonClassName}>
        <span className="flex-1 block truncate text-left">{displayValue || placeholder}</span>
        <svg
          className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <ul className={menuClassName}>
          {options.map((opt) => {
            const optValue = getOptionValue(opt);
            const optLabel = getOptionLabel(opt);
            const isSelected = String(value ?? '') === optValue;
            return (
              <li
                key={optValue}
                onClick={() => {
                  onChange(optValue);
                  setOpen(false);
                }}
                className={optionClassName}
              >
                {optLabel}
                {isSelected && (
                  <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default CustomSelect;
