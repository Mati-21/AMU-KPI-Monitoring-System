import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

const Checkbox = ({ checked = false, onCheckedChange, className }) => {
  return (
    <span className={cn('inline-flex items-center justify-center', className)}>
      <input type="checkbox" checked={checked} onChange={(event) => onCheckedChange?.(event.target.checked)} className="peer sr-only" />
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex h-5 w-5 items-center justify-center rounded border border-input bg-background text-primary transition-colors peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
          checked && 'border-primary bg-primary text-primary-foreground'
        )}
      >
        {checked ? <Check className="h-3.5 w-3.5" /> : null}
      </span>
    </span>
  );
};

export default Checkbox;
