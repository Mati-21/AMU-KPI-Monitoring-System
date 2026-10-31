import React from 'react';
import { cn } from '../../lib/utils';

const Progress = ({ className, value = 0 }) => {
  const safeValue = Math.min(Math.max(value, 0), 100);

  return (
    <div className={cn('relative h-4 w-full overflow-hidden rounded-full bg-secondary', className)}>
      <div className="h-full bg-primary transition-all duration-300 ease-in-out" style={{ width: `${safeValue}%` }} />
    </div>
  );
};

export { Progress };
