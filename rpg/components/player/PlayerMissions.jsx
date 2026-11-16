'use client';

import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Coins,
  LayoutGrid,
  List,
  Scroll,
  Search,
  Users,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { RANKS, getRankMeta } from '../../lib/constants';
import { acceptMissionTx } from '../../lib/rpg-service';
import { formatDate, formatNumber } from '../../lib/utils';
import { MissionStatusBadge, RankBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/Card';
import { DetailDrawer } from '../ui/DetailDrawer';
import { EmptyState } from '../ui/EmptyState';
import { Input } from '../ui/Input';

export function PlayerMissions({ missions, profile, hasParty = false }) {
  const [viewMode, setViewMode] = useState('open'); // 'open' | 'mine' | 'history'
  const [displayLayout, setDisplayLayout] = useState('grid'); // 'grid' | 'list'
  const [search, setSearch] = useState('');
  const [rankFilter, setRankFilter] = useState('ALL');
  const [inspectedMission, setInspectedMission] = useState(null);
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

  const handleAccept = async (missionToAccept) => {
    if (!missionToAccept || !profile) return;
    setAccepting(true);
    try {
      await acceptMissionTx(missionToAccept.id, profile);
      toast.success(`Contrato aceito: "${missionToAccept.title}"!`);
      setInspectedMission(null);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível aceitar esta missão.');
    } finally {
      setAccepting(false);
    }
  };

  const inspectedRankMeta = inspectedMission ? getRankMeta(inspectedMission.rank) : null;

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
                ? 'bg-white/10 text-white border border-white/20'
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
                ? 'bg-white/10 text-white border border-white/20'
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
                ? 'bg-white/10 text-white border border-white/20'
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
                  ? 'bg-white/10 text-white border-white/20'
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
                    ? 'bg-white/10 text-white border-white/20'
                    : 'bg-[var(--surface-1)] text-slate-400 border-[var(--border-subtle)] hover:text-white'
                }`}
              >
                {r}
              </button>
            ))}

            <div className="hidden sm:inline-flex items-center p-0.5 rounded-xl bg-[var(--surface-1)] border border-[var(--border-subtle)] ml-1 shrink-0">
              <button
                type="button"
                onClick={() => setDisplayLayout('grid')}
                aria-label="Visualizar em grade"
                aria-pressed={displayLayout === 'grid'}
                className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
                  displayLayout === 'grid' ? 'bg-[var(--surface-2)] text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setDisplayLayout('list')}
                aria-label="Visualizar em lista"
                aria-pressed={displayLayout === 'list'}
                className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
                  displayLayout === 'list' ? 'bg-[var(--surface-2)] text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mission Catalog */}
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
      ) : displayLayout === 'list' ? (
        <div className="space-y-2.5">
          {filtered.map((m) => {
            const rankMeta = getRankMeta(m.rank);
            return (
              <Card
                key={m.id}
                interactive
                onClick={() => setInspectedMission(m)}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
                style={{ borderLeftWidth: '3px', borderLeftColor: rankMeta.color }}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <RankBadge rank={m.rank} />
                    {m.status !== 'open' && <MissionStatusBadge status={m.status} />}
                    <h3 className="text-sm font-bold text-white truncate">{m.title}</h3>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-1">
                    {m.description || 'Nenhuma instrução adicional.'}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0 justify-between sm:justify-end">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="text-sky-300">{formatNumber(m.xp_reward)} XP</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-amber-300">{formatNumber(m.gold_reward)} G</span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setInspectedMission(m);
                    }}
                  >
                    Abrir Card
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((m) => {
            const rankMeta = getRankMeta(m.rank);
            return (
              <Card
                key={m.id}
                interactive
                onClick={() => setInspectedMission(m)}
                className="flex flex-col justify-between overflow-hidden cursor-pointer group"
                style={{ borderLeftWidth: '4px', borderLeftColor: rankMeta.color }}
              >
                <div>
                  <CardHeader className="pb-2">
                    <div className="space-y-2 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <RankBadge rank={m.rank} />
                        {m.status !== 'open' && <MissionStatusBadge status={m.status} />}
                      </div>
                      <CardTitle className="text-base leading-snug group-hover:text-slate-100 transition-colors">
                        {m.title}
                      </CardTitle>
                    </div>
                    <ArrowUpRight
                      className="h-4 w-4 text-slate-500 group-hover:text-white transition-colors shrink-0"
                      aria-hidden="true"
                    />
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 text-xs font-mono font-semibold text-sky-300">
                        <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                        {formatNumber(m.xp_reward)} XP
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-xs font-mono font-semibold text-amber-300">
                        <Coins className="h-3.5 w-3.5" aria-hidden="true" />
                        {formatNumber(m.gold_reward)} Ouro
                      </span>
                    </div>

                    <p className="text-sm text-slate-300 leading-relaxed line-clamp-3 whitespace-pre-line">
                      {m.description || 'Nenhuma instrução adicional fornecida pelo Mestre.'}
                    </p>
                  </CardContent>
                </div>

                <CardFooter className="justify-between">
                  <span className="text-[11px] font-mono text-slate-500">
                    {formatDate(m.createdAt)}
                  </span>
                  {m.status === 'open' ? (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectedMission(m);
                      }}
                    >
                      <Check className="h-4 w-4" />
                      Ver & Aceitar
                    </Button>
                  ) : (
                    <span className="text-xs font-semibold text-slate-400">Ver detalhes</span>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Split Inspector Drawer */}
      <DetailDrawer
        open={Boolean(inspectedMission)}
        onOpenChange={(open) => !open && setInspectedMission(null)}
        title={inspectedMission?.title}
        subtitle={
          inspectedMission?.createdAt
            ? `Publicado em ${formatDate(inspectedMission.createdAt)}`
            : 'Contrato oficial do Mural da Guilda'
        }
        accentColor={inspectedRankMeta?.color}
        badge={
          inspectedMission && (
            <>
              <RankBadge rank={inspectedMission.rank} />
              <MissionStatusBadge status={inspectedMission.status} />
            </>
          )
        }
        footer={
          inspectedMission?.status === 'open' ? (
            <div className="flex items-center gap-2.5">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setInspectedMission(null)}
              >
                Voltar
              </Button>
              <Button
                className="flex-[2]"
                loading={accepting}
                onClick={() => handleAccept(inspectedMission)}
              >
                <Check className="h-4 w-4" />
                Aceitar Contrato
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setInspectedMission(null)}
            >
              Fechar
            </Button>
          )
        }
      >
        {inspectedMission && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[var(--surface-0)]/80 border border-[var(--border-subtle)] p-3.5 space-y-1">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
                  Recompensa XP
                </span>
                <span className="text-lg font-extrabold font-mono text-sky-300 inline-flex items-center gap-1.5">
                  <Zap className="h-4 w-4" /> {formatNumber(inspectedMission.xp_reward)}
                </span>
              </div>
              <div className="rounded-xl bg-[var(--surface-0)]/80 border border-[var(--border-subtle)] p-3.5 space-y-1">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
                  Recompensa Ouro
                </span>
                <span className="text-lg font-extrabold font-mono text-amber-300 inline-flex items-center gap-1.5">
                  <Coins className="h-4 w-4" /> {formatNumber(inspectedMission.gold_reward)} G
                </span>
              </div>
            </div>

            {hasParty && (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3.5 text-xs text-emerald-200 flex items-start gap-2.5">
                <Users className="h-4 w-4 shrink-0 mt-0.5 text-emerald-300" />
                <span>
                  Você pertence a um grupo: ao concluir esta missão, o XP vai para todos e o ouro é
                  dividido igualmente entre os membros.
                </span>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Briefing da Missão
              </h4>
              <div className="rounded-xl bg-[var(--surface-0)]/60 border border-[var(--border-subtle)] p-4 text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                {inspectedMission.description ||
                  'Nenhuma instrução adicional fornecida pelo Mestre.'}
              </div>
            </div>
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
