import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

// Input types that have a native browser picker (calendar / clock dialog).
const PICKER_TYPES = new Set(['date', 'time', 'datetime-local', 'month', 'week']);

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onClick, ...props }, ref) => {
    const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
      onClick?.(e);
      // Some Android browsers/PWAs don't reliably open the native picker on tap,
      // so open it explicitly. showPicker() throws if the picker is unavailable
      // (e.g. already open, no user activation) — the native behavior still applies then.
      const input = e.currentTarget;
      if (
        !e.defaultPrevented &&
        type &&
        PICKER_TYPES.has(type) &&
        !input.readOnly &&
        !input.disabled &&
        typeof input.showPicker === 'function'
      ) {
        try {
          input.showPicker();
        } catch {
          // Fall back to the browser's default handling.
        }
      }
    };

    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        onClick={handleClick}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
