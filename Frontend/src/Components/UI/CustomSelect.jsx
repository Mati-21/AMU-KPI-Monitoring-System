import { useMemo, useState } from 'react';

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

  return (
    <div className="relative w-full">
      <button type="button" onClick={() => setOpen(!open)} className={buttonClassName}>
        {value || placeholder}
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
          {options.map((opt) => (
            <li
              key={opt}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={optionClassName}
            >
              {opt}
              {value === opt && (
                <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default CustomSelect;
