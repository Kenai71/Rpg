import { cn } from '../../lib/utils';

export function Skeleton({ className }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-xl bg-white/[0.06]', className)}
    />
  );
}

export function PageLoadingSkeleton({ message = 'Carregando Reino...' }) {
  return (
    <div className="min-h-screen realm-backdrop flex flex-col items-center justify-center p-6 gap-6">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <Skeleton className="h-24 w-full" />
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-center text-slate-400">
          {message}
        </p>
      </div>
    </div>
  );
}
