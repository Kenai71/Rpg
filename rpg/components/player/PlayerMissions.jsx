'use client';

import { useMemo, useState } from 'react';
import { Check, Coins, Scroll, Search, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { RANKS, getRankMeta } from '../../lib/constants';
import { acceptMissionTx } from '../../lib/rpg-service';
import { formatNumber } from '../../lib/utils';
import { MissionStatusBadge, RankBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { Input } from '../ui/Input';
import { ConfirmDialog } from '../ui/Modal';

export function PlayerMissions({ missions, profile }) {
  const [viewMode, setViewMode] = useState('open'); // 'open' | 'mine' | 'history'
  const [search, setSearch] = useState('');
  const [rankFilter, setRankFilter] = useState('ALL');
  const [confirmMission, setConfirmMission] = useState(null);
  const [accepting, setAccepting] = useState(false);

  const myActiveCount = useMemo(
    () => missions.filter((m) => m.status === 'in_progress' && m.assigned_to === profile?.uid).length,
    [missions, profile?.uid]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return missions.filter((m) => {
      if (viewMode === 'open' && m.status !== 'open') return false;
      if (viewMode === 'mine' && !(m.status === 'in_progress' && m.assigned_to === profile?.uid)) {
        return false;
      }
      if (
        viewMode === 'history' &&
        !((m.status === 'completed' || m.status === 'failed') && m.assigned_to === profile?.uid)
      ) {
        return false;
      }
      if (rankFilter !== 'ALL' && m.rank !== rankFilter) return false;
      if (q) {
        const hay = `${m.title || ''} ${m.description || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [missions, viewMode, rankFilter, search, profile?.uid]);

  const handleAccept = async () => {
    if (!confirmMission || !profile) return;
    setAccepting(true);
    try {
      await acceptMissionTx(confirmMission.id, profile);
      toast.success(`Contrato aceito: "${confirmMission.title}"!`);
      setConfirmMission(null);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível aceitar esta missão.');
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div
          role="tablist"
          aria-label="Filtrar mural de missões"
          className="inline-flex p-1 rounded-xl bg-[var(--surface-1)] border border-[var(--border-subtle)] w-fit flex-wrap"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'open'}
            onClick={() => setViewMode('open')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'open'
                ? 'bg-[var(--accent-soft)] text-white border border-[var(--accent-primary)]/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Disponíveis
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'mine'}
            onClick={() => setViewMode('mine')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'mine'
                ? 'bg-[var(--accent-soft)] text-white border border-[var(--accent-primary)]/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Meus Contratos ({myActiveCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'history'}
            onClick={() => setViewMode('history')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'history'
                ? 'bg-[var(--accent-soft)] text-white border border-[var(--accent-primary)]/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Histórico
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="sm:w-64">
            <Input
              icon={Search}
              placeholder="Buscar missão..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar missão"
              className="h-10"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setRankFilter('ALL')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors shrink-0 ${
                rankFilter === 'ALL'
                  ? 'bg-[var(--accent-soft)] text-white border-[var(--accent-primary)]/40'
                  : 'bg-[var(--surface-1)] text-slate-400 border-[var(--border-subtle)] hover:text-white'
              }`}
            >
              Todos
            </button>
            {RANKS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRankFilter(r)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors shrink-0 ${
                  rankFilter === r
                    ? 'bg-[var(--accent-soft)] text-white border-[var(--accent-primary)]/40'
                    : 'bg-[var(--surface-1)] text-slate-400 border-[var(--border-subtle)] hover:text-white'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mission Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Scroll}
          title="Nenhuma missão encontrada"
          description={
            viewMode === 'open'
              ? 'O mural não possui contratos abertos com esses filtros no momento.'
              : 'Você ainda não possui contratos nesta categoria.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((m) => {
            const rankMeta = getRankMeta(m.rank);
            return (
              <Card
                key={m.id}
                className="flex flex-col justify-between overflow-hidden hover:border-[var(--border-strong)] transition-colors"
                style={{ borderLeftWidth: '4px', borderLeftColor: rankMeta.color }}
              >
                <div>
                  <CardHeader className="pb-2">
                    <div className="space-y-2 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <RankBadge rank={m.rank} />
                        {m.status !== 'open' && <MissionStatusBadge status={m.status} />}
                      </div>
                      <CardTitle className="text-base leading-snug">{m.title}</CardTitle>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 text-xs font-mono font-semibold text-sky-300">
                        <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                        {formatNumber(m.xp_reward)} XP
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-xs font-mono font-semibold text-amber-300">
                        <Coins className="h-3.5 w-3.5" aria-hidden="true" />
                        {formatNumber(m.gold_reward)} Ouro
                      </span>
                    </div>

                    <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                      {m.description || 'Nenhuma instrução adicional fornecida pelo Mestre.'}
                    </p>
                  </CardContent>
                </div>

                {m.status === 'open' && (
                  <CardFooter>
                    <Button
                      className="w-full"
                      onClick={() => setConfirmMission(m)}
                    >
                      <Check className="h-4 w-4" />
                      Aceitar Missão
                    </Button>
                  </CardFooter>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmMission)}
        onOpenChange={(open) => !open && setConfirmMission(null)}
        title="Aceitar Contrato"
        description={`Deseja assumir a missão "${confirmMission?.title}" (Rank ${confirmMission?.rank})? Ela ficará vinculada ao seu personagem até o Mestre validar o resultado.`}
        confirmLabel="Aceitar Contrato"
        variant="primary"
        loading={accepting}
        onConfirm={handleAccept}
      />
    </div>
  );
}
