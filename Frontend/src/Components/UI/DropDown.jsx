import React, { useState, useRef, useEffect } from 'react';
import { Check } from 'lucide-react';

export const DropdownMenu = ({ trigger, children }) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <div onClick={() => setOpen(!open)}>{trigger}</div>

      {open && (
        <div className="absolute right-0 mt-2 w-48 rounded-md bg-popover text-popover-foreground shadow-md z-50 border border-border overflow-hidden" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
};

export const DropdownMenuItem = ({ children, onClick, className = '' }) => {
  return (
    <div onClick={onClick} className={`px-3 py-2 text-sm cursor-pointer flex items-center gap-3 hover:bg-muted transition-colors ${className}`}>
      {children}
    </div>
  );
};

export const DropdownMenuSeparator = () => {
  return <div className="h-px bg-border my-1" />;
};

export const DropdownMenuLabel = ({ children, className = '' }) => {
  return <div className={`px-3 py-2 text-xs font-semibold text-muted-foreground ${className}`}>{children}</div>;
};

export const DropdownMenuCheckboxItem = ({ checked, children, onClick, className = '' }) => {
  return (
    <div onClick={onClick} className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted transition-colors ${className}`}>
      {checked && <Check className="w-4 h-4" />}
      {children}
    </div>
  );
};
