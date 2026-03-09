import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
        secondary: 'border-transparent bg-gray-100 text-gray-700 dark:bg-zinc-700/50 dark:text-zinc-300',
        destructive: 'border-transparent bg-red-50 text-red-700 dark:bg-red-500/20 dark:text-red-400',
        outline: 'text-gray-700 border-gray-300 dark:text-zinc-300 dark:border-zinc-600',
        success: 'border-transparent bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
        warning: 'border-transparent bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
        info: 'border-transparent bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
