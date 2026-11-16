'use client';

import { forwardRef, useId } from 'react';
import { cn } from '../../lib/utils';

const baseFieldClass =
  'w-full rounded-xl bg-[var(--surface-0)]/80 border border-[var(--border-subtle)] text-slate-100 placeholder:text-slate-500 text-sm transition-colors duration-150 ' +
  'hover:border-[var(--border-strong)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

export const Label = forwardRef(function Label({ className, required, children, ...props }, ref) {
  return (
    <label
      ref={ref}
      className={cn('block text-xs font-semibold uppercase tracking-wider text-slate-300', className)}
      {...props}
    >
      {children}
      {required && (
        <span className="text-rose-400 ml-1" aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
});

export const Input = forwardRef(function Input({ className, icon: Icon, error, ...props }, ref) {
  if (Icon) {
    return (
      <div className="relative flex items-center">
        <Icon
          className="h-4 w-4 text-slate-400 absolute left-3.5 pointer-events-none"
          aria-hidden="true"
        />
        <input
          ref={ref}
          aria-invalid={error ? 'true' : undefined}
          className={cn(
            baseFieldClass,
            'h-11 pl-10 pr-3.5',
            error && 'border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/20',
            className
          )}
          {...props}
        />
      </div>
    );
  }

  return (
    <input
      ref={ref}
      aria-invalid={error ? 'true' : undefined}
      className={cn(
        baseFieldClass,
        'h-11 px-3.5',
        error && 'border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/20',
        className
      )}
      {...props}
    />
  );
});

export const Textarea = forwardRef(function Textarea({ className, error, rows = 3, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={error ? 'true' : undefined}
      className={cn(
        baseFieldClass,
        'p-3.5 resize-y min-h-[88px]',
        error && 'border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/20',
        className
      )}
      {...props}
    />
  );
});

export const Select = forwardRef(function Select({ className, error, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      aria-invalid={error ? 'true' : undefined}
      className={cn(
        baseFieldClass,
        'h-11 px-3.5 bg-[#0e1017] cursor-pointer',
        error && 'border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/20',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});

export function FormField({ label, htmlFor, error, hint, required, className, children }) {
  const autoId = useId();
  const fieldId = htmlFor || autoId;

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <Label htmlFor={fieldId} required={required}>
          {label}
        </Label>
      )}
      {children}
      {error ? (
        <p role="alert" className="text-xs text-rose-400 font-medium">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}
