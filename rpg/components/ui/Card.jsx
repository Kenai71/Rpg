import { cn } from '../../lib/utils';

export function Card({ className, interactive = false, children, ...props }) {
  return (
    <div
      className={cn(
        'rounded-2xl surface-card backdrop-blur-md',
        interactive && 'surface-card-interactive hover:-translate-y-0.5',
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
    <h3 className={cn('text-base font-bold text-slate-50 tracking-tight', className)} {...props}>
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
      className={cn(
        'px-5 py-3.5 border-t border-[var(--border-subtle)] bg-black/15 flex items-center gap-2',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function StatCard({ label, value, helper, icon: Icon, accentColor }) {
  return (
    <Card interactive className="relative overflow-hidden group border-white/10 hover:border-white/20">
      {accentColor && (
        <>
          <div
            aria-hidden="true"
            className="h-[3px] w-full"
            style={{ backgroundColor: accentColor }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full opacity-[0.09] blur-2xl transition-opacity duration-300 group-hover:opacity-[0.16]"
            style={{ backgroundColor: accentColor }}
          />
        </>
      )}
      <div className="p-5 flex items-start justify-between gap-4 relative z-10">
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">
            {label}
          </p>
          <p className="text-2xl font-extrabold text-slate-50 font-mono tabular-nums tracking-tight">
            {value}
          </p>
          {helper && <p className="text-xs text-slate-400 truncate">{helper}</p>}
        </div>
        {Icon && (
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 bg-white/[0.05] border border-white/10 text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-transform duration-200 group-hover:scale-105"
            aria-hidden="true"
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </Card>
  );
}
