import { Inbox } from 'lucide-react';
import { cn } from '../../lib/utils';

export function EmptyState({ icon: Icon = Inbox, title, description, action, className }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-1)]/50 px-6 py-10 text-center flex flex-col items-center justify-center gap-3',
        className
      )}
    >
      <div className="h-12 w-12 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)] flex items-center justify-center text-slate-400">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="space-y-1 max-w-sm">
        <h4 className="text-sm font-bold text-slate-200">{title}</h4>
        {description && <p className="text-xs text-slate-400 leading-relaxed">{description}</p>}
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
