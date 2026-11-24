'use client';

import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Bot, Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { GiCoinsPile, GiScrollUnfurled } from 'react-icons/gi';
import { toast } from 'sonner';
import { RANKS, getRankMeta } from '../../lib/constants';
import { MISSION_RANK_WEIGHTS } from '../../lib/dnd-rules';
import { createMission, deleteMission, updateMission } from '../../lib/rpg-service';
import { formatNumber } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ConfirmDialog, Modal } from '../ui/Modal';
import { DataTable } from '../ui/DataTable';
import { FormField, Input, Select, Textarea } from '../ui/Input';
import { MissionStatusBadge, RankBadge } from '../ui/Badge';

const missionSchema = z.object({
  title: z.string().trim().min(2, 'Informe um título com pelo menos 2 caracteres.').max(120),
  description: z.string().trim().max(2000, 'Máximo de 2000 caracteres.').optional().default(''),
  rank: z.enum(['F', 'E', 'D', 'C', 'B', 'A', 'S']),
  xp_reward: z.coerce.number().min(0, 'XP deve ser 0 ou maior.'),
  gold_reward: z.coerce.number().min(0, 'Ouro deve ser 0 ou maior.'),
});

const MISSION_AI_PRESETS = [3, 5, 10, 15, 20, 30];

export function MasterMissions({ missions, players, onResolveContract, onGenerateMissions }) {
  const [statusFilter, setStatusFilter] = useState('active'); // 'active' | 'open' | 'in_progress' | 'history' | 'all'
  const [rankFilter, setRankFilter] = useState('ALL');
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingMission, setEditingMission] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Modal de geração de missões aleatórias via IA (com raridade ponderada por Rank)
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiCount, setAiCount] = useState(5);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiProgress, setAiProgress] = useState(null);

  const handleRunMissionsAI = async (e) => {
    e.preventDefault();
    if (!onGenerateMissions) return;
    const qty = Math.max(1, Math.min(50, Math.floor(Number(aiCount) || 1)));
    setGeneratingAI(true);
    setAiProgress({ createdCount: 0, totalCount: qty, chunkIndex: 1, totalChunks: Math.ceil(qty / 10) });
    try {
      await onGenerateMissions(qty, (prog) => setAiProgress(prog));
      setAiModalOpen(false);
    } catch (err) {
      toast.error(err?.message || 'Erro ao gerar missões aleatórias via IA.');
    } finally {
      setGeneratingAI(false);
      setAiProgress(null);
    }
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(missionSchema),
    defaultValues: { title: '', description: '', rank: 'F', xp_reward: 100, gold_reward: 50 },
  });

  const openCreateModal = () => {
    setEditingMission(null);
    reset({ title: '', description: '', rank: 'F', xp_reward: 100, gold_reward: 50 });
    setFormModalOpen(true);
  };

  const openEditModal = useCallback(
    (mission) => {
      setEditingMission(mission);
      reset({
        title: mission.title || '',
        description: mission.description || '',
        rank: mission.rank || 'F',
        xp_reward: Number(mission.xp_reward || 0),
        gold_reward: Number(mission.gold_reward || 0),
      });
      setFormModalOpen(true);
    },
    [reset]
  );

  const onSubmitMission = async (values) => {
    try {
      if (editingMission) {
        await updateMission(editingMission.id, values);
        toast.success('Missão atualizada!');
      } else {
        await createMission(values);
        toast.success('Nova missão publicada no mural!');
      }
      setFormModalOpen(false);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar a missão.');
    }
  };

  const handleDeleteMission = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteMission(confirmDelete.id);
      toast.success('Missão removida.');
      setConfirmDelete(null);
    } catch (err) {
      toast.error(err?.message || 'Erro ao excluir missão.');
    } finally {
      setDeleting(false);
    }
  };

  const filteredMissions = useMemo(() => {
    return missions.filter((m) => {
      if (rankFilter !== 'ALL' && m.rank !== rankFilter) return false;
      if (statusFilter === 'active') return m.status === 'open' || m.status === 'in_progress';
      if (statusFilter === 'history') return m.status === 'completed' || m.status === 'failed';
      if (statusFilter !== 'all') return m.status === statusFilter;
      return true;
    });
  }, [missions, rankFilter, statusFilter]);

  const activeContracts = useMemo(
    () => missions.filter((m) => m.status === 'in_progress'),
    [missions]
  );

  const missionSummary = useMemo(
    () => ({
      open: missions.filter((m) => m.status === 'open').length,
      inProgress: missions.filter((m) => m.status === 'in_progress').length,
      completed: missions.filter((m) => m.status === 'completed').length,
    }),
    [missions]
  );

  const columns = useMemo(
    () => [
      {
        accessorKey: 'title',
        header: 'Missão',
        cell: ({ row }) => {
          const m = row.original;
          const rankMeta = getRankMeta(m.rank);
          const assignee = m.assigned_to ? players.find((p) => p.uid === m.assigned_to) : null;
          return (
            <div className="flex items-stretch gap-3 max-w-md">
              <span
                aria-hidden="true"
                className="w-1 rounded-full shrink-0 my-0.5"
                style={{ backgroundColor: rankMeta.color }}
              />
              <div className="min-w-0 space-y-1">
                <p className="font-semibold text-white">{m.title}</p>
                <p className="text-xs text-slate-400 line-clamp-2">{m.description || 'Sem descrição.'}</p>
                {assignee && (
                  <p className="text-xs text-slate-300">
                    Herói: <span className="font-semibold text-white">{assignee.username}</span>
                  </p>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'rank',
        header: 'Rank',
        cell: ({ row }) => <RankBadge rank={row.original.rank} />,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <MissionStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'xp_reward',
        header: 'Recompensas',
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5 font-mono text-xs tabular-nums">
            <span className="text-sky-300 font-semibold">
              {formatNumber(row.original.xp_reward)} XP
            </span>
            <span className="text-slate-100 inline-flex items-center gap-1.5 font-semibold">
              <GiCoinsPile className="h-3 w-3 text-amber-400" /> {formatNumber(row.original.gold_reward)}{' '}
              <span className="text-[11px] text-slate-400">G</span>
            </span>
          </div>
        ),
      },
      {
        id: 'actions',
        header: 'Ações',
        enableSorting: false,
        cell: ({ row }) => {
          const m = row.original;
          return (
            <div className="flex items-center gap-1.5">
              {m.status === 'in_progress' && (
                <>
                  <Button
                    variant="success"
                    size="icon-sm"
                    onClick={() => onResolveContract(m, 'completed')}
                    title="Concluir e entregar recompensas"
                    aria-label={`Concluir ${m.title}`}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="warning"
                    size="icon-sm"
                    onClick={() => onResolveContract(m, 'failed')}
                    title="Marcar como falha"
                    aria-label={`Falhar ${m.title}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => openEditModal(m)}
                title="Editar missão"
                aria-label={`Editar ${m.title}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="danger"
                size="icon-sm"
                onClick={() => setConfirmDelete(m)}
                title="Excluir missão"
                aria-label={`Excluir ${m.title}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        },
      },
    ],
    [onResolveContract, openEditModal, players]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Gerenciar Missões & Contratos</h2>
          <p className="text-xs text-slate-400">
            Publique contratos no mural, acompanhe heróis em andamento e valide conclusões.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {onGenerateMissions && (
            <Button
              variant="primary"
              onClick={() => {
                setAiCount(5);
                setAiModalOpen(true);
              }}
              title="Gerar uma quantidade personalizada de missões aleatórias com raridade por Rank"
            >
              <Bot className="h-4 w-4 text-slate-300" />
              Gerar Missões (IA)
            </Button>
          )}
          <Button variant="secondary" onClick={openCreateModal}>
            <Plus className="h-4 w-4" />
            Nova Missão
          </Button>
        </div>
      </div>

      {/* Resumo Rápido de Missões */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl surface-card px-4 py-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Abertas no Mural
          </span>
          <span className="text-lg font-extrabold font-mono text-white tabular-nums">
            {formatNumber(missionSummary.open)}
          </span>
        </div>
        <div className="rounded-2xl surface-card px-4 py-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Em Andamento
          </span>
          <span className="text-lg font-extrabold font-mono text-amber-300 tabular-nums">
            {formatNumber(missionSummary.inProgress)}
          </span>
        </div>
        <div className="rounded-2xl surface-card px-4 py-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Concluídas
          </span>
          <span className="text-lg font-extrabold font-mono text-emerald-300 tabular-nums">
            {formatNumber(missionSummary.completed)}
          </span>
        </div>
      </div>

      {activeContracts.length > 0 && (
        <Card className="relative overflow-hidden border-white/12 p-4 pt-5">
          <div aria-hidden="true" className="absolute top-0 inset-x-0 h-[3px] bg-amber-400" />
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Contratos Aguardando Validação
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-white/[0.06] text-slate-200 border border-white/15">
                {activeContracts.length}
              </span>
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeContracts.map((m) => {
              const assignee = players.find((p) => p.uid === m.assigned_to);
              const partyMembers = assignee?.party_id
                ? players.filter((p) => p.party_id === assignee.party_id)
                : [];
              return (
                <div
                  key={m.id}
                  className="rounded-xl border border-white/10 bg-[var(--surface-0)]/75 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <RankBadge rank={m.rank} />
                      <span className="text-sm font-bold text-white truncate">{m.title}</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Responsável:{' '}
                      <strong className="text-slate-200">
                        {assignee?.username || m.assigned_to_name || 'Herói'}
                      </strong>
                      {partyMembers.length > 1 && (
                        <span className="text-emerald-300">
                          {' '}
                          (Grupo: {partyMembers.length} membros dividirão o ouro)
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => onResolveContract(m, 'completed')}
                    >
                      <Check className="h-4 w-4" />
                      Concluir
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => onResolveContract(m, 'failed')}
                    >
                      <X className="h-4 w-4" />
                      Falhou
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <DataTable
        data={filteredMissions}
        columns={columns}
        searchPlaceholder="Buscar missão por título ou descrição..."
        emptyIcon={GiScrollUnfurled}
        emptyTitle="Nenhuma missão encontrada"
        emptyDescription="Crie uma nova missão ou ajuste os filtros de status e rank."
        filterSlot={
          <>
            <Select
              aria-label="Filtrar por status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-auto min-w-[150px] h-10"
            >
              <option value="active">Abertas & Ativas</option>
              <option value="open">Somente Abertas</option>
              <option value="in_progress">Em Andamento</option>
              <option value="history">Histórico Finalizadas</option>
              <option value="all">Todas</option>
            </Select>
            <Select
              aria-label="Filtrar por rank"
              value={rankFilter}
              onChange={(e) => setRankFilter(e.target.value)}
              className="w-auto min-w-[120px] h-10"
            >
              <option value="ALL">Todos Ranks</option>
              {RANKS.map((r) => (
                <option key={r} value={r}>
                  Rank {r}
                </option>
              ))}
            </Select>
          </>
        }
        renderMobileCard={(m) => {
          const assignee = m.assigned_to ? players.find((p) => p.uid === m.assigned_to) : null;
          const rankMeta = getRankMeta(m.rank);
          return (
            <Card className="relative overflow-hidden border-white/10">
              <div
                aria-hidden="true"
                className="h-[4px] w-full"
                style={{ backgroundColor: rankMeta.color }}
              />
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <RankBadge rank={m.rank} />
                      <MissionStatusBadge status={m.status} />
                    </div>
                    <h4 className="font-bold text-white text-sm">{m.title}</h4>
                  </div>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {m.description || 'Sem descrição.'}
                </p>
                {assignee && (
                  <p className="text-xs text-slate-300">
                    Em contrato com <strong className="text-white">{assignee.username}</strong>
                  </p>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span className="text-sky-300">{formatNumber(m.xp_reward)} XP</span>
                    <span className="text-slate-100 inline-flex items-center gap-1">
                      <GiCoinsPile className="h-3.5 w-3.5 text-amber-400" />
                      {formatNumber(m.gold_reward)} G
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {m.status === 'in_progress' && (
                      <>
                        <Button
                          variant="success"
                          size="icon-sm"
                          onClick={() => onResolveContract(m, 'completed')}
                          aria-label="Concluir missão"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="warning"
                          size="icon-sm"
                          onClick={() => onResolveContract(m, 'failed')}
                          aria-label="Falhar missão"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => openEditModal(m)}
                      aria-label="Editar missão"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="danger"
                      size="icon-sm"
                      onClick={() => setConfirmDelete(m)}
                      aria-label="Excluir missão"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        }}
      />

      {/* Create / Edit Modal */}
      <Modal
        open={formModalOpen}
        onOpenChange={setFormModalOpen}
        title={editingMission ? 'Editar Missão' : 'Nova Missão no Mural'}
        description="Defina o desafio, o rank mínimo recomendado e as recompensas."
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="mission-form" loading={isSubmitting}>
              {editingMission ? 'Salvar Alterações' : 'Publicar Missão'}
            </Button>
          </>
        }
      >
        <form id="mission-form" onSubmit={handleSubmit(onSubmitMission)} className="space-y-4">
          <FormField label="Título da Missão" htmlFor="m-title" required error={errors.title?.message}>
            <Input
              id="m-title"
              placeholder="Ex: Caçada na Floresta Sombria"
              error={errors.title?.message}
              {...register('title')}
            />
          </FormField>

          <FormField label="Descrição / Briefing" htmlFor="m-desc" error={errors.description?.message}>
            <Textarea
              id="m-desc"
              rows={4}
              placeholder="Detalhes do objetivo, local e perigos..."
              {...register('description')}
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Rank" htmlFor="m-rank" error={errors.rank?.message}>
              <Select id="m-rank" {...register('rank')}>
                {RANKS.map((r) => (
                  <option key={r} value={r}>
                    Rank {r}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="XP" htmlFor="m-xp" error={errors.xp_reward?.message}>
              <Input id="m-xp" type="number" min="0" {...register('xp_reward')} />
            </FormField>

            <FormField label="Ouro" htmlFor="m-gold" error={errors.gold_reward?.message}>
              <Input id="m-gold" type="number" min="0" {...register('gold_reward')} />
            </FormField>
          </div>
        </form>
      </Modal>

      {/* Modal de Geração Aleatória de Missões (IA com Probabilidade por Rank) */}
      <Modal
        open={aiModalOpen}
        onOpenChange={(open) => {
          if (!generatingAI) setAiModalOpen(open);
        }}
        title="Gerar Missões Aleatórias (IA)"
        description="Escolha quantas missões aleatórias deseja publicar no mural. Quanto maior o Rank da missão, mais rara ela é de surgir."
        maxWidth="max-w-md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setAiModalOpen(false)}
              disabled={generatingAI}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="missions-ai-generate-form"
              loading={generatingAI}
            >
              {!generatingAI && <Bot className="h-4 w-4 text-slate-300" />}
              {generatingAI
                ? `Gerando (${aiProgress?.createdCount || 0}/${aiProgress?.totalCount || aiCount})...`
                : `Gerar ${Math.max(1, Math.min(50, Math.floor(Number(aiCount) || 1)))} Missão(ões)`}
            </Button>
          </>
        }
      >
        <form id="missions-ai-generate-form" onSubmit={handleRunMissionsAI} className="space-y-4">
          <FormField
            label="Quantidade de Missões Aleatórias (1 a 50)"
            htmlFor="missions-ai-count"
            hint="Lotes maiores (ex: 30 missões) são criados em etapas automáticas com anti-repetição."
          >
            <Input
              id="missions-ai-count"
              type="number"
              min="1"
              max="50"
              disabled={generatingAI}
              value={aiCount}
              onChange={(e) => setAiCount(e.target.value)}
            />
          </FormField>

          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Atalhos de Quantidade
            </span>
            <div className="grid grid-cols-6 gap-1.5">
              {MISSION_AI_PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={generatingAI}
                  onClick={() => setAiCount(n)}
                  className={`py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
                    Number(aiCount) === n
                      ? 'bg-white/15 text-white border-white/30'
                      : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-[var(--surface-0)]/70 border border-[var(--border-subtle)] p-3 space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Probabilidade por Rank (quanto maior, mais difícil de acontecer)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {MISSION_RANK_WEIGHTS.map((entry) => (
                <div
                  key={entry.rank}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-[11px]"
                >
                  <RankBadge rank={entry.rank} className="text-[10px] px-1.5 py-0" />
                  <span className="font-mono text-slate-300">{entry.weight}%</span>
                </div>
              ))}
            </div>
          </div>

          {generatingAI && aiProgress && (
            <div className="rounded-xl bg-white/5 border border-white/15 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-200 font-semibold">
                  Lote {aiProgress.chunkIndex} de {aiProgress.totalChunks}
                </span>
                <span className="font-mono text-slate-300">
                  {aiProgress.createdCount}/{aiProgress.totalCount} missões
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-black/60 border border-white/10 overflow-hidden">
                <div
                  className="h-full bg-slate-200 transition-all duration-300"
                  style={{
                    width: `${Math.max(
                      8,
                      Math.round((aiProgress.createdCount / Math.max(1, aiProgress.totalCount)) * 100)
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title="Excluir missão"
        description={`Tem certeza que deseja remover "${confirmDelete?.title}" permanentemente?`}
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={handleDeleteMission}
      />
    </div>
  );
}
