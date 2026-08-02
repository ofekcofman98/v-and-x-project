/**
 * Button Component (shadcn/ui style)
 * Basic button primitive for the voice interface
 */

import * as React from 'react';
import { cn } from '@/lib/shared/utils/cn';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-xl text-sm font-bold transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#13501B]',
          'disabled:pointer-events-none disabled:opacity-50',

          {
            'bg-[#13501B] text-white shadow-md hover:bg-[#0d3b14] hover:shadow-lg hover:-translate-y-px':
              variant === 'default',
            'bg-red-600 text-white hover:bg-red-700': variant === 'destructive',
            'border-2 border-[#13501B] bg-transparent text-[#13501B] hover:bg-[#f2f8f2]':
              variant === 'outline',
            'text-gray-700 hover:bg-gray-100 hover:text-[#13501B]': variant === 'ghost',
          },
          
          {
            'h-10 px-4 py-2': size === 'default',
            'h-9 rounded-md px-3': size === 'sm',
            'h-11 rounded-md px-8': size === 'lg',
            'h-10 w-10': size === 'icon',
          },
          
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
