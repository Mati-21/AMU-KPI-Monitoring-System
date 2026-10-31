import { cn } from '../../lib/utils';
import { getTabTriggerClass } from './Tabs';

const TabButton = ({ label, value, activeValue, onChange, className = '' }) => {
  const isActive = activeValue === value;

  return (
    <button type="button" onClick={() => onChange(value)} className={cn(getTabTriggerClass(isActive), className)}>
      {label}
    </button>
  );
};

export default TabButton;
