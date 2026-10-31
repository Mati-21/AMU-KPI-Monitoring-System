import React from 'react';
import { cn } from '../../lib/utils';

// Main Card
export const Card = ({ className = '', children, ...props }) => {
  return (
    <div className={cn('rounded-lg  bg-card text-card-foreground shadow-sm', className)} {...props}>
      {children}
    </div>
  );
};

// Header
export const CardHeader = ({ className = '', children, ...props }) => {
  return (
    <div className={cn('flex flex-col space-y-1.5 p-6', className)} {...props}>
      {children}
    </div>
  );
};

// Title
export const CardTitle = ({ className = '', children, ...props }) => {
  return (
    <h3 className={cn('text-2xl font-semibold leading-none tracking-tight', className)} {...props}>
      {children}
    </h3>
  );
};

// Description
export const CardDescription = ({ className = '', children, ...props }) => {
  return (
    <p className={cn('text-sm text-muted-foreground', className)} {...props}>
      {children}
    </p>
  );
};

// Content
export const CardContent = ({ className = '', children, ...props }) => {
  return (
    <div className={cn('p-6 pt-0', className)} {...props}>
      {children}
    </div>
  );
};

// Footer
export const CardFooter = ({ className = '', children, ...props }) => {
  return (
    <div className={cn('flex items-center p-6 pt-0', className)} {...props}>
      {children}
    </div>
  );
};
