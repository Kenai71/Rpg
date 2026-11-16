import { cn } from '../../lib/utils';
import { MISSION_STATUS_META, getRankMeta, getRarityMeta } from '../../lib/constants';

export function Badge({ className, children, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap',
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function RankBadge({ rank = 'F', className }) {
  const meta = getRankMeta(rank);
  return (
    <Badge className={cn('font-mono tracking-wide', meta.badgeClass, className)}>
      Rank {meta.label}
    </Badge>
  );
}

export function RarityBadge({ rarity = 'COMUM', className }) {
  const meta = getRarityMeta(rarity);
  return (
    <Badge className={cn('uppercase tracking-wider text-[11px]', meta.badgeClass, className)}>
      {meta.name}
    </Badge>
  );
}

export function MissionStatusBadge({ status = 'open', className }) {
  const meta = MISSION_STATUS_META[status] || MISSION_STATUS_META.open;
  return <Badge className={cn(meta.badgeClass, className)}>{meta.label}</Badge>;
}

export function RoleBadge({ role = 'player', className }) {
  if (role === 'master') {
    return (
      <Badge className={cn('bg-amber-500/15 text-amber-300 border-amber-500/30', className)}>
        Mestre (Admin)
      </Badge>
    );
  }
  return (
    <Badge className={cn('bg-slate-500/15 text-slate-300 border-slate-500/30', className)}>
      Jogador
    </Badge>
  );
}
