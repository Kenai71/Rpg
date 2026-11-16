'use client';

import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

const VARIANTS = {
  primary:
    'bg-white/10 text-white hover:bg-white/15 active:bg-white/20 border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_16px_-4px_rgba(0,0,0,0.5)]',
  secondary:
    'bg-[var(--surface-2)] text-slate-100 hover:bg-[var(--surface-3)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
  outline:
    'bg-transparent text-slate-200 hover:bg-white/[0.04] border border-[var(--border-strong)]',
  ghost:
    'bg-transparent text-slate-300 hover:text-white hover:bg-white/[0.05] border border-transparent',
  danger:
    'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-500/30',
  success:
    'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30',
  warning:
    'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30',
};

const SIZES = {
  sm: 'h-9 px-3 text-xs rounded-xl gap-1.5',
  md: 'h-10 px-4 text-sm rounded-xl gap-2',
  lg: 'h-11 px-5 text-sm rounded-xl gap-2',
  icon: 'h-10 w-10 p-0 rounded-xl justify-center',
  'icon-sm': 'h-9 w-9 p-0 rounded-xl justify-center',
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
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-0)]',
        'disabled:opacity-50 disabled:pointer-events-none active:scale-[0.985]',
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
