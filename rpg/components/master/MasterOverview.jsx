'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowUpRight,
  Check,
  Dices,
  Inbox,
  Users,
  X,
} from 'lucide-react';
import {
  GiCoinsPile,
  GiHoodedFigure,
  GiOpenTreasureChest,
  GiScrollUnfurled,
  GiTreasureMap,
} from 'react-icons/gi';
import { RANKS, RANK_META, MISSION_STATUS_META } from '../../lib/constants';
import { formatNumber } from '../../lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, StatCard } from '../ui/Card';
import { Button } from '../ui/Button';
import { RankBadge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { useTabletopSession } from '../tabletop/TabletopSessionProvider';

function CustomChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface-1)] px-3 py-2 shadow-xl text-xs">
      <p className="font-bold text-white mb-1">{label}</p>
      <p className="text-slate-300 font-mono tabular-nums">
        Total: <span className="font-bold text-slate-200">{payload[0].value}</span>
      </p>
    </div>
  );
}

export function MasterOverview({
  missions,
  players,
  shopItems,
  requests,
  onResolveContract,
  onResolveRequest,
  onNavigate,
}) {
  const tabletopSession = useTabletopSession();
  const openMissions = missions.filter((m) => m.status === 'open').length;
  const activeContracts = missions.filter((m) => m.status === 'in_progress');
  const pendingRequests = requests.filter((r) => !r.status || r.status === 'pending');

  const avgLevel = useMemo(() => {
    if (!players.length) return '1.0';
    const sum = players.reduce((acc, p) => acc + (p.level || 1), 0);
    return (sum / players.length).toFixed(1);
  }, [players]);

  const totalGold = useMemo(
    () => players.reduce((acc, p) => acc + (p.gold || 0), 0),
    [players]
  );

  const totalShopStock = useMemo(
    () => shopItems.reduce((acc, item) => acc + Number(item.quantity || 0), 0),
    [shopItems]
  );

  const rankChartData = useMemo(
    () =>
      RANKS.map((rank) => ({
        name: `Rank ${rank}`,
        total: players.filter((p) => (p.rank || 'F') === rank).length,
        color: RANK_META[rank].color,
      })),
    [players]
  );

  const missionChartData = useMemo(
    () => [
      {
        name: MISSION_STATUS_META.open.label,
        total: missions.filter((m) => m.status === 'open').length,
        color: '#38bdf8',
      },
      {
        name: MISSION_STATUS_META.in_progress.label,
        total: missions.filter((m) => m.status === 'in_progress').length,
        color: '#fbbf24',
      },
      {
        name: MISSION_STATUS_META.completed.label,
        total: missions.filter((m) => m.status === 'completed').length,
        color: '#34d399',
      },
      {
        name: MISSION_STATUS_META.failed.label,
        total: missions.filter((m) => m.status === 'failed').length,
        color: '#f87171',
      },
    ],
    [missions]
  );

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-label="Indicadores principais">
        <StatCard
          label="Missões no Mural"
          value={formatNumber(openMissions)}
          helper={`${activeContracts.length} contrato(s) em andamento`}
          icon={GiScrollUnfurled}
          accentColor="#38bdf8"
        />
        <StatCard
          label="Heróis Ativos"
          value={formatNumber(players.length)}
          helper={`Nível médio: ${avgLevel}`}
          icon={Users}
          accentColor="#a78bfa"
        />
        <StatCard
          label="Pedidos Pendentes"
          value={formatNumber(pendingRequests.length)}
          helper="Itens & Roleta Gacha"
          icon={Inbox}
          accentColor="#f59e0b"
        />
        <StatCard
          label="Estoque da Loja"
          value={formatNumber(totalShopStock)}
          helper={`${formatNumber(totalGold)} ouro em circulação`}
          icon={GiCoinsPile}
          accentColor="#34d399"
        />
      </section>

      {/* Atalhos Rápidos da Mesa Narrativa */}
      <section aria-label="Ações rápidas da sessão" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Abrir Mesa Tática',
            desc: 'Mapas, clima, tochas e combate',
            Icon: GiTreasureMap,
            color: '#38bdf8',
            onClick: () => onNavigate('maps'),
          },
          {
            label: 'Projetar Handout',
            desc: 'Cartas, retratos e mapas em tela cheia',
            Icon: GiScrollUnfurled,
            color: '#fbbf24',
            onClick: () => tabletopSession?.openStudio('handouts'),
          },
          {
            label: 'Sussurro Privado',
            desc: 'Pista secreta para 1 jogador',
            Icon: GiHoodedFigure,
            color: '#a78bfa',
            onClick: () => tabletopSession?.openStudio('whispers'),
          },
          {
            label: 'Gerar Baú de Loot',
            desc: 'Saque aleatório com IA por raridade',
            Icon: GiOpenTreasureChest,
            color: '#34d399',
            onClick: () => tabletopSession?.openStudio('loot'),
          },
        ].map(({ label, desc, Icon, color, onClick }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className="group relative overflow-hidden rounded-2xl surface-card surface-card-interactive hover:-translate-y-0.5 text-left transition-all border-white/10 hover:border-white/20"
          >
            <span
              aria-hidden="true"
              className="block h-[3px] w-full opacity-85 group-hover:opacity-100 transition-opacity"
              style={{ backgroundColor: color }}
            />
            <div className="p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-white/[0.05] border border-white/10 text-slate-300 group-hover:text-white transition-all duration-200 group-hover:scale-105">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs sm:text-sm font-bold text-white truncate">{label}</span>
                  <span className="block text-[11px] text-slate-400 truncate mt-0.5">{desc}</span>
                </span>
              </div>
              <ArrowUpRight className="h-4 w-4 text-slate-500 group-hover:text-white shrink-0 transition-colors" aria-hidden="true" />
            </div>
          </button>
        ))}
      </section>

      {/* Analytics Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Distribuição de Heróis por Rank</CardTitle>
              <CardDescription>Progresso atual dos aventureiros da guilda</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rankChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="total" radius={[8, 8, 0, 0]} maxBarSize={42}>
                    {rankChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Status das Missões</CardTitle>
              <CardDescription>Balanço entre contratos abertos, ativos e finalizados</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={missionChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="total" radius={[8, 8, 0, 0]} maxBarSize={50}>
                    {missionChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Action Queues */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Contratos em Andamento</CardTitle>
              <CardDescription>Valide missões aceitas pelos jogadores</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('missions')}>
              Ver todas
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeContracts.length === 0 ? (
              <EmptyState
                icon={GiScrollUnfurled}
                title="Nenhum contrato ativo"
                description="Quando um jogador aceitar uma missão do mural, ela aparecerá aqui para validação."
              />
            ) : (
              activeContracts.slice(0, 5).map((m) => {
                const assignee = players.find((p) => p.uid === m.assigned_to);
                return (
                  <div
                    key={m.id}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-0)]/60 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <RankBadge rank={m.rank} />
                        <p className="text-sm font-bold text-white truncate">{m.title}</p>
                      </div>
                      <p className="text-xs text-slate-400">
                        Herói: <span className="text-slate-200 font-semibold">{assignee?.username || m.assigned_to_name || 'Desconhecido'}</span>
                        {' • '}
                        <span className="text-amber-300 font-mono">{m.gold_reward}G</span>
                        {' / '}
                        <span className="text-sky-300 font-mono">{m.xp_reward} XP</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => onResolveContract(m, 'completed')}
                        title="Aprovar missão e entregar recompensas"
                      >
                        <Check className="h-4 w-4" />
                        Concluir
                      </Button>
                      <Button
                        variant="danger"
                        size="icon-sm"
                        onClick={() => onResolveContract(m, 'failed')}
                        title="Marcar missão como falha"
                        aria-label={`Marcar ${m.title} como falha`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Solicitações Pendentes</CardTitle>
              <CardDescription>Pedidos de itens e giros na Roleta Gacha</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('requests')}>
              Gerenciar fila
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingRequests.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="Fila de pedidos limpa"
                description="Nenhum pedido de item ou roleta aguardando aprovação."
              />
            ) : (
              pendingRequests.slice(0, 5).map((req) => {
                const isRoulette = req.item_name === 'SOLICITACAO_ROLETA';
                const requester = players.find((p) => p.uid === req.player_id);
                return (
                  <div
                    key={req.id}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-0)]/60 p-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-bold text-white flex items-center gap-2 truncate">
                        {isRoulette ? (
                          <>
                            <Dices className="h-4 w-4 text-slate-300 shrink-0" />
                            <span>Roleta Gacha (Gift)</span>
                          </>
                        ) : (
                          <span>
                            {req.quantity}x {req.item_name}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400">
                        Solicitado por{' '}
                        <span className="text-slate-200 font-semibold">
                          {requester?.username || req.player_name || 'Aventureiro'}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="success"
                        size="icon-sm"
                        onClick={() => onResolveRequest(req, true)}
                        aria-label="Aprovar solicitação"
                        title="Aprovar"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="danger"
                        size="icon-sm"
                        onClick={() => onResolveRequest(req, false)}
                        aria-label="Recusar solicitação"
                        title="Recusar"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
