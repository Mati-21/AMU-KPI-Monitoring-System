import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils';

const Input = React.forwardRef((props, ref) => {
  const { className, type, ...rest } = props;
  const [showPassword, setShowPassword] = useState(false);
  const isPasswordField = type === 'password';
  const resolvedType = isPasswordField ? (showPassword ? 'text' : 'password') : type;

  if (isPasswordField) {
    return (
      <div className="relative w-full">
        <input
          type={resolvedType}
          ref={ref}
          className={cn(
            'flex h-10 w-full border border-border rounded bg-background px-3 py-2 pr-10 placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
            className
          )}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  }

  return (
    <input
      type={resolvedType}
      ref={ref}
      className={cn(
        'flex h-10 w-full border border-border rounded bg-background px-3 py-2  placeholder:text-muted-foreground focus-visible:outline-none  disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className
      )}
      {...rest}
    />
  );
});

Input.displayName = 'Input';

export { Input };
