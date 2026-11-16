'use client';

import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

const VARIANTS = {
  primary:
    'bg-[var(--accent-primary)] text-white hover:brightness-110 shadow-[0_1px_12px_rgba(var(--accent-rgb),0.35)] border border-transparent',
  secondary:
    'bg-[var(--surface-2)] text-slate-100 hover:bg-[var(--surface-3)] border border-[var(--border-subtle)]',
  outline:
    'bg-transparent text-slate-200 hover:bg-white/5 border border-[var(--border-strong)]',
  ghost:
    'bg-transparent text-slate-300 hover:text-white hover:bg-white/5 border border-transparent',
  danger:
    'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-500/30',
  success:
    'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30',
  warning:
    'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30',
};

const SIZES = {
  sm: 'h-9 px-3 text-xs rounded-lg gap-1.5',
  md: 'h-10 px-4 text-sm rounded-xl gap-2',
  lg: 'h-11 px-5 text-sm rounded-xl gap-2',
  icon: 'h-10 w-10 p-0 rounded-xl justify-center',
  'icon-sm': 'h-9 w-9 p-0 rounded-lg justify-center',
};

export const Button = forwardRef(function Button(
  {
    className,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    type = 'button',
    children,
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-all duration-150 select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-glow)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]',
        'disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]',
        VARIANTS[variant] || VARIANTS.primary,
        SIZES[size] || SIZES.md,
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />}
      {children}
    </button>
  );
});
