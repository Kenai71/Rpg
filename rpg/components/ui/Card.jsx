import { cn } from '../../lib/utils';

export function Card({ className, children, ...props }) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-[var(--surface-1)] border border-[var(--border-subtle)] shadow-[0_8px_30px_rgba(0,0,0,0.35)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }) {
  return (
    <div className={cn('px-5 pt-5 pb-3 flex items-start justify-between gap-3', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }) {
  return (
    <h3 className={cn('text-base font-bold text-slate-100 tracking-tight', className)} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className, children, ...props }) {
  return (
    <p className={cn('text-xs text-slate-400 leading-relaxed', className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ className, children, ...props }) {
  return (
    <div className={cn('px-5 pb-5', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...props }) {
  return (
    <div
      className={cn('px-5 py-3.5 border-t border-[var(--border-subtle)] flex items-center gap-2', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function StatCard({ label, value, helper, icon: Icon, accentColor }) {
  return (
    <Card className="p-5 flex items-start justify-between gap-4 hover:border-[var(--border-strong)] transition-colors">
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 truncate">
          {label}
        </p>
        <p className="text-2xl font-extrabold text-slate-50 font-mono tabular-nums tracking-tight">
          {value}
        </p>
        {helper && <p className="text-xs text-slate-400 truncate">{helper}</p>}
      </div>
      {Icon && (
        <div
          className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 border border-white/10"
          style={{
            backgroundColor: accentColor ? `${accentColor}1a` : 'var(--accent-soft)',
            color: accentColor || 'var(--accent-glow)',
          }}
          aria-hidden="true"
        >
          <Icon className="h-5 w-5" />
        </div>
      )}
    </Card>
  );
}
