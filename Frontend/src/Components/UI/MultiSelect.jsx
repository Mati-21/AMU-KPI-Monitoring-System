import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

const MultiSelect = ({ options, value = [], onChange, placeholder = 'Select options...', className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper functions to handle both string and object options
  const getOptionValue = (option) => (typeof option === 'object' ? option.id : option);
  const getOptionLabel = (option) => (typeof option === 'object' ? option.label : option);
  const getValueLabel = (val) => {
    const option = options.find((opt) => getOptionValue(opt) === val);
    return option ? getOptionLabel(option) : val;
  };

  const handleSelect = (option) => {
    const optionValue = getOptionValue(option);
    const newValue = value.includes(optionValue) ? value.filter((item) => item !== optionValue) : [...value, optionValue];
    onChange(newValue);
  };

  const handleSelectAll = () => {
    const allValues = options.map((opt) => getOptionValue(opt));
    onChange(value.length === options.length ? [] : allValues);
  };

  const removeItem = (item) => {
    onChange(value.filter((selected) => selected !== item));
  };

  const getDisplayText = () => {
    if (value.length === 0) return placeholder;
    if (value.length === 1) return getValueLabel(value[0]);
    return `${value.length} selected`;
  };

  return (
    <div className={cn('relative w-full', className)} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full min-h-10 px-3 py-2 text-left bg-card border border-border rounded-md flex items-center justify-between hover:border-primary/50 focus:border-primary focus:outline-none"
      >
        <div className="flex flex-wrap gap-1 flex-1">
          {value.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : value.length === 1 ? (
            <span className="text-sm">{value[0]}</span>
          ) : (
            <span className="text-sm text-primary font-medium">{value.length} selected</span>
          )}
        </div>
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full top-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-96 overflow-auto">
          {/* Select All Option */}
          <div className="sticky top-0 bg-card border-b border-border">
            <label className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted">
              <input type="checkbox" checked={value.length === options.length} onChange={handleSelectAll} className="w-4 h-4" />
              <span className="font-medium">Select All</span>
            </label>
          </div>

          {/* Options */}
          <div className="py-1">
            {options.map((option) => (
              <label key={getOptionValue(option)} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted">
                <input type="checkbox" checked={value.includes(getOptionValue(option))} onChange={() => handleSelect(option)} className="w-4 h-4" />
                <span>{getOptionLabel(option)}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiSelect;
