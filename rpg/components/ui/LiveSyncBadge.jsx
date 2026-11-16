import { cn } from '../../lib/utils';

export function LiveSyncBadge({ className, label = 'Tempo Real' }) {
  return (
    <span
      title="Sincronizado em tempo real com o Cloud Firestore"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 select-none',
        className
      )}
    >
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
      </span>
      <span className="hidden xl:inline">{label}</span>
    </span>
  );
}
