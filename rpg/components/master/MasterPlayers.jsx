'use client';

import { useMemo, useState } from 'react';
import {
  Backpack,
  Coins,
  Crown,
  FileText,
  Minus,
  Plus,
  SlidersHorizontal,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ITEM_TYPES,
  RANKS,
  RARITIES,
  calculateLevel,
  formatDescriptionWithRarity,
  getRarityFromItem,
  getRarityMeta,
} from '../../lib/constants';
import {
  assignPlayerToParty,
  createParty,
  deleteParty,
  masterAddInventoryItemTx,
  masterIncreaseSlotsTx,
  masterRemoveInventoryItemTx,
  modifyPlayerStatsTx,
  setPartyLeader,
} from '../../lib/rpg-service';
import { formatNumber } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { ConfirmDialog, Modal } from '../ui/Modal';
import { DataTable } from '../ui/DataTable';
import { FormField, Input, Select, Textarea } from '../ui/Input';
import { Badge, RankBadge, RoleBadge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { UserAvatar } from '../ui/UserAvatar';
import { CharacterSheetModal } from '../sheet/EditablePdfSheet';

export function MasterPlayers({ players, parties, currentUserProfile }) {
  const [subTab, setSubTab] = useState('heroes'); // 'heroes' | 'parties'
  const [rankFilter, setRankFilter] = useState('ALL');
  const [partyFilter, setPartyFilter] = useState('ALL');

  // Character sheet (Ficha.pdf) real-time modal target
  const [sheetTargetUid, setSheetTargetUid] = useState(null);

  // Party creation
  const [partyName, setPartyName] = useState('');
  const [creatingParty, setCreatingParty] = useState(false);
  const [confirmDeleteParty, setConfirmDeleteParty] = useState(null);
  const [deletingParty, setDeletingParty] = useState(false);

  // Resource modifier modal (Gold & XP)
  const [resourceTarget, setResourceTarget] = useState(null);
  const [goldDelta, setGoldDelta] = useState('');
  const [xpDelta, setXpDelta] = useState('');
  const [savingResources, setSavingResources] = useState(false);

  // Inventory manager modal
  const [invTargetUid, setInvTargetUid] = useState(null);
  const [slotAddQty, setSlotAddQty] = useState(1);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemRarity, setNewItemRarity] = useState('COMUM');
  const [newItemType, setNewItemType] = useState('consumable');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [invBusy, setInvBusy] = useState(false);

  const selectedPlayerForInv = useMemo(
    () => players.find((p) => p.uid === invTargetUid) || null,
    [players, invTargetUid]
  );

  const selectedPlayerForSheet = useMemo(
    () => players.find((p) => p.uid === sheetTargetUid) || null,
    [players, sheetTargetUid]
  );

  const filteredPlayers = useMemo(() => {
    return players.filter((p) => {
      if (rankFilter !== 'ALL' && (p.rank || 'F') !== rankFilter) return false;
      if (partyFilter === 'NONE' && p.party_id) return false;
      if (partyFilter !== 'ALL' && partyFilter !== 'NONE' && p.party_id !== partyFilter) return false;
      return true;
    });
  }, [players, rankFilter, partyFilter]);

  const handleRankChange = async (player, nextRank) => {
    try {
      await modifyPlayerStatsTx(player.uid, { rank: nextRank });
      toast.success(`Rank de ${player.username} alterado para ${nextRank}.`);
    } catch (err) {
      toast.error(err?.message || 'Erro ao alterar rank.');
    }
  };

  const handlePartyAssign = async (player, nextPartyId) => {
    try {
      await assignPlayerToParty(player.uid, nextPartyId || null);
      toast.success(`Grupo de ${player.username} atualizado.`);
    } catch (err) {
      toast.error(err?.message || 'Erro ao atualizar grupo.');
    }
  };

  const applyResourceDelta = async (mode) => {
    if (!resourceTarget) return;
    const g = Number(goldDelta) || 0;
    const x = Number(xpDelta) || 0;
    const signedGold = mode === 'subtract' ? -Math.abs(g) : Math.abs(g);
    const signedXp = mode === 'subtract' ? -Math.abs(x) : Math.abs(x);

    if (signedGold === 0 && signedXp === 0) {
      toast.error('Informe um valor para Ouro ou XP.');
      return;
    }

    setSavingResources(true);
    try {
      await modifyPlayerStatsTx(resourceTarget.uid, {
        deltaGold: signedGold,
        deltaXp: signedXp,
      });
      toast.success(`Recursos de ${resourceTarget.username} atualizados!`);
      setResourceTarget(null);
      setGoldDelta('');
      setXpDelta('');
    } catch (err) {
      toast.error(err?.message || 'Erro ao atualizar recursos.');
    } finally {
      setSavingResources(false);
    }
  };

  const handleCreateParty = async (e) => {
    e.preventDefault();
    if (!partyName.trim()) {
      toast.error('Informe o nome do grupo.');
      return;
    }
    setCreatingParty(true);
    try {
      await createParty(partyName);
      setPartyName('');
      toast.success('Grupo criado com sucesso!');
    } catch (err) {
      toast.error(err?.message || 'Erro ao criar grupo.');
    } finally {
      setCreatingParty(false);
    }
  };

  const handleDeleteParty = async () => {
    if (!confirmDeleteParty) return;
    setDeletingParty(true);
    try {
      await deleteParty(confirmDeleteParty.id);
      toast.success('Grupo removido.');
      setConfirmDeleteParty(null);
    } catch (err) {
      toast.error(err?.message || 'Erro ao excluir grupo.');
    } finally {
      setDeletingParty(false);
    }
  };

  const handleMakeLeader = async (partyId, player) => {
    try {
      await setPartyLeader(partyId, player.uid);
      toast.success(`${player.username} agora é líder do grupo!`);
    } catch (err) {
      toast.error(err?.message || 'Erro ao definir líder.');
    }
  };

  const handleIncreaseSlots = async () => {
    if (!selectedPlayerForInv) return;
    setInvBusy(true);
    try {
      await masterIncreaseSlotsTx(selectedPlayerForInv.uid, slotAddQty);
      toast.success(`+${slotAddQty} slot(s) adicionados à mochila de ${selectedPlayerForInv.username}.`);
    } catch (err) {
      toast.error(err?.message || 'Erro ao aumentar slots.');
    } finally {
      setInvBusy(false);
    }
  };

  const handleAddItemToInv = async (e) => {
    e.preventDefault();
    if (!selectedPlayerForInv || !newItemName.trim()) return;
    setInvBusy(true);
    try {
      await masterAddInventoryItemTx(selectedPlayerForInv.uid, {
        name: newItemName,
        qty: newItemQty,
        description: newItemDesc ? formatDescriptionWithRarity(newItemRarity, newItemDesc) : `<${newItemRarity}>`,
        type: newItemType,
      });
      toast.success('Item entregue ao inventário do herói!');
      setNewItemName('');
      setNewItemQty(1);
      setNewItemDesc('');
    } catch (err) {
      toast.error(err?.message || 'Erro ao adicionar item.');
    } finally {
      setInvBusy(false);
    }
  };

  const handleRemoveInvItem = async (index) => {
    if (!selectedPlayerForInv) return;
    setInvBusy(true);
    try {
      await masterRemoveInventoryItemTx(selectedPlayerForInv.uid, index);
      toast.success('Item decrementado/removido.');
    } catch (err) {
      toast.error(err?.message || 'Erro ao remover item.');
    } finally {
      setInvBusy(false);
    }
  };

  const liveInvPlayer = selectedPlayerForInv;
  const liveResourceTarget = resourceTarget
    ? players.find((p) => p.uid === resourceTarget.uid) || resourceTarget
    : null;

  const columns = useMemo(
    () => [
      {
        accessorKey: 'username',
        header: 'Herói',
        cell: ({ row }) => {
          const p = row.original;
          const currentParty = parties.find((g) => g.id === p.party_id);
          const isLeader = currentParty?.leader_id === p.uid;
          return (
            <div className="flex items-center gap-2.5 min-w-0">
              <UserAvatar
                src={p.photoURL}
                name={p.username}
                className="h-9 w-9 text-xs shrink-0"
              />
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-white truncate">{p.username}</span>
                  {p.role === 'master' && <RoleBadge role="master" className="text-[10px] px-2 py-0" />}
                  {isLeader && (
                    <span title="Líder do Grupo" className="text-amber-400">
                      <Crown className="h-3.5 w-3.5 inline" />
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-400">
                  Nível {p.level} • {p.inventory?.length || 0}/{p.slots || 10} slots
                </span>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'rank',
        header: 'Rank',
        cell: ({ row }) => {
          const p = row.original;
          return (
            <Select
              aria-label={`Rank de ${p.username}`}
              value={p.rank || 'F'}
              onChange={(e) => handleRankChange(p, e.target.value)}
              className="w-24 h-9 text-xs font-bold"
            >
              {RANKS.map((r) => (
                <option key={r} value={r}>
                  Rank {r}
                </option>
              ))}
            </Select>
          );
        },
      },
      {
        accessorKey: 'party_id',
        header: 'Grupo',
        cell: ({ row }) => {
          const p = row.original;
          return (
            <Select
              aria-label={`Grupo de ${p.username}`}
              value={p.party_id || ''}
              onChange={(e) => handlePartyAssign(p, e.target.value)}
              className="w-40 h-9 text-xs"
            >
              <option value="">Sem Grupo</option>
              {parties.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          );
        },
      },
      {
        accessorKey: 'gold',
        header: 'Ouro & XP',
        cell: ({ row }) => {
          const p = row.original;
          return (
            <div className="flex flex-col gap-0.5 font-mono text-xs tabular-nums">
              <span className="text-amber-300 inline-flex items-center gap-1">
                <Coins className="h-3.5 w-3.5" /> {formatNumber(p.gold)} G
              </span>
              <span className="text-sky-300 inline-flex items-center gap-1">
                <Zap className="h-3.5 w-3.5" /> {formatNumber(p.xp)} XP
              </span>
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: 'Ações',
        enableSorting: false,
        cell: ({ row }) => {
          const p = row.original;
          return (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setSheetTargetUid(p.uid)}
              >
                <FileText className="h-3.5 w-3.5 text-slate-300" />
                Abrir Ficha
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setResourceTarget(p);
                  setGoldDelta('');
                  setXpDelta('');
                }}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Ouro / XP
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setInvTargetUid(p.uid);
                  setSlotAddQty(1);
                }}
              >
                <Backpack className="h-3.5 w-3.5" />
                Mochila
              </Button>
            </div>
          );
        },
      },
    ],
    [parties]
  );

  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div
          role="tablist"
          aria-label="Gerenciamento de heróis e grupos"
          className="inline-flex p-1 rounded-xl bg-[var(--surface-1)] border border-[var(--border-subtle)] w-fit"
        >
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'heroes'}
            onClick={() => setSubTab('heroes')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              subTab === 'heroes'
                ? 'bg-white/10 text-white border border-white/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Heróis ({players.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'parties'}
            onClick={() => setSubTab('parties')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              subTab === 'parties'
                ? 'bg-white/10 text-white border border-white/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Grupos ({parties.length})
          </button>
        </div>
      </div>

      {subTab === 'heroes' ? (
        <DataTable
          data={filteredPlayers}
          columns={columns}
          searchPlaceholder="Buscar herói por nome..."
          emptyIcon={Users}
          emptyTitle="Nenhum herói encontrado"
          emptyDescription="Quando novos jogadores criarem conta, aparecerão aqui."
          filterSlot={
            <>
              <Select
                aria-label="Filtrar por rank"
                value={rankFilter}
                onChange={(e) => setRankFilter(e.target.value)}
                className="w-auto min-w-[125px] h-10"
              >
                <option value="ALL">Todos Ranks</option>
                {RANKS.map((r) => (
                  <option key={r} value={r}>
                    Rank {r}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Filtrar por grupo"
                value={partyFilter}
                onChange={(e) => setPartyFilter(e.target.value)}
                className="w-auto min-w-[140px] h-10"
              >
                <option value="ALL">Todos Grupos</option>
                <option value="NONE">Sem Grupo</option>
                {parties.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </>
          }
          renderMobileCard={(p) => {
            const currentParty = parties.find((g) => g.id === p.party_id);
            const isLeader = currentParty?.leader_id === p.uid;
            return (
              <Card className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <UserAvatar
                      src={p.photoURL}
                      name={p.username}
                      className="h-10 w-10 text-xs shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white truncate">{p.username}</span>
                        {p.role === 'master' && <RoleBadge role="master" className="text-[10px] px-2 py-0" />}
                        {isLeader && <Crown className="h-4 w-4 text-amber-400" />}
                      </div>
                      <p className="text-xs text-slate-400">
                        LVL {p.level} • {p.inventory?.length || 0}/{p.slots || 10} slots
                      </p>
                    </div>
                  </div>
                  <RankBadge rank={p.rank} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Select
                    aria-label={`Rank de ${p.username}`}
                    value={p.rank || 'F'}
                    onChange={(e) => handleRankChange(p, e.target.value)}
                    className="h-9 text-xs"
                  >
                    {RANKS.map((r) => (
                      <option key={r} value={r}>
                        Rank {r}
                      </option>
                    ))}
                  </Select>
                  <Select
                    aria-label={`Grupo de ${p.username}`}
                    value={p.party_id || ''}
                    onChange={(e) => handlePartyAssign(p, e.target.value)}
                    className="h-9 text-xs"
                  >
                    <option value="">Sem Grupo</option>
                    {parties.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)] text-xs font-mono">
                  <span className="text-amber-300">{formatNumber(p.gold)} G</span>
                  <span className="text-sky-300">{formatNumber(p.xp)} XP</span>
                </div>

                <div className="space-y-2">
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full"
                    onClick={() => setSheetTargetUid(p.uid)}
                  >
                    <FileText className="h-3.5 w-3.5 text-slate-300" />
                    Abrir Ficha
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setResourceTarget(p);
                        setGoldDelta('');
                        setXpDelta('');
                      }}
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      Ouro / XP
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setInvTargetUid(p.uid);
                        setSlotAddQty(1);
                      }}
                    >
                      <Backpack className="h-3.5 w-3.5" />
                      Mochila
                    </Button>
                  </div>
                </div>
              </Card>
            );
          }}
        />
      ) : (
        <div className="space-y-6">
          <Card className="p-5">
            <form onSubmit={handleCreateParty} className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1">
                <FormField label="Criar Novo Grupo (Party)" htmlFor="party-name">
                  <Input
                    id="party-name"
                    placeholder="Ex: Ordem da Aurora"
                    value={partyName}
                    onChange={(e) => setPartyName(e.target.value)}
                  />
                </FormField>
              </div>
              <Button type="submit" loading={creatingParty} className="h-11">
                <Plus className="h-4 w-4" />
                Criar Grupo
              </Button>
            </form>
          </Card>

          {parties.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum grupo formado"
              description="Grupos dividem ouro de missões automaticamente entre todos os integrantes."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {parties.map((party) => {
                const members = players.filter((p) => p.party_id === party.id);
                return (
                  <Card key={party.id}>
                    <CardHeader className="border-b border-[var(--border-subtle)] pb-3">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <span>{party.name}</span>
                          <Badge className="bg-white/5 text-slate-300 border-white/10">
                            {members.length} membro(s)
                          </Badge>
                        </CardTitle>
                      </div>
                      <Button
                        variant="danger"
                        size="icon-sm"
                        onClick={() => setConfirmDeleteParty(party)}
                        aria-label={`Excluir grupo ${party.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-2.5">
                      {members.length === 0 ? (
                        <p className="text-xs text-slate-400">
                          Sem membros atribuídos. Selecione o grupo na aba Heróis.
                        </p>
                      ) : (
                        members.map((member) => {
                          const isLeader = party.leader_id === member.uid;
                          return (
                            <div
                              key={member.uid}
                              className="flex items-center justify-between gap-2 rounded-xl bg-[var(--surface-0)]/60 border border-[var(--border-subtle)] px-3 py-2"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {isLeader && (
                                  <Crown className="h-4 w-4 text-amber-400 shrink-0" />
                                )}
                                <span className="text-sm font-semibold text-white truncate">
                                  {member.username}
                                </span>
                                <RankBadge rank={member.rank} className="text-[10px] px-2 py-0" />
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => setSheetTargetUid(member.uid)}
                                  className="h-8 px-2.5 text-xs"
                                >
                                  <FileText className="h-3.5 w-3.5 text-slate-300" />
                                  Abrir Ficha
                                </Button>
                                {!isLeader && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleMakeLeader(party.id, member)}
                                    className="h-8 px-2 text-xs"
                                  >
                                    <Crown className="h-3.5 w-3.5 text-amber-400" />
                                    <span className="hidden sm:inline">Tornar Líder</span>
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Adjust Gold & XP Modal */}
      <Modal
        open={Boolean(liveResourceTarget)}
        onOpenChange={(open) => !open && setResourceTarget(null)}
        title={`Recursos: ${liveResourceTarget?.username || ''}`}
        description="Adicione ou remova Ouro e XP. O nível do personagem é recalculado automaticamente."
        maxWidth="max-w-md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setResourceTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={savingResources}
              onClick={() => applyResourceDelta('subtract')}
            >
              <Minus className="h-4 w-4" />
              Remover
            </Button>
            <Button
              variant="success"
              loading={savingResources}
              onClick={() => applyResourceDelta('add')}
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          </>
        }
      >
        {liveResourceTarget && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-[var(--surface-0)]/70 border border-[var(--border-subtle)] p-3.5 text-xs">
              <div>
                <span className="text-slate-400 block">Ouro Atual</span>
                <strong className="text-base font-mono text-amber-300">
                  {formatNumber(liveResourceTarget.gold)} G
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block">XP Atual (Nível {liveResourceTarget.level})</span>
                <strong className="text-base font-mono text-sky-300">
                  {formatNumber(liveResourceTarget.xp)} XP
                </strong>
              </div>
            </div>

            <FormField label="Quantidade de Ouro" htmlFor="mod-gold">
              <Input
                id="mod-gold"
                type="number"
                min="0"
                placeholder="Ex: 500"
                value={goldDelta}
                onChange={(e) => setGoldDelta(e.target.value)}
              />
            </FormField>

            <FormField
              label="Quantidade de XP"
              htmlFor="mod-xp"
              hint={
                xpDelta
                  ? `Nível se adicionar: ${calculateLevel(
                      liveResourceTarget.xp + Math.abs(Number(xpDelta) || 0)
                    )}`
                  : undefined
              }
            >
              <Input
                id="mod-xp"
                type="number"
                min="0"
                placeholder="Ex: 300"
                value={xpDelta}
                onChange={(e) => setXpDelta(e.target.value)}
              />
            </FormField>
          </div>
        )}
      </Modal>

      {/* Inventory Manager Modal */}
      <Modal
        open={Boolean(liveInvPlayer)}
        onOpenChange={(open) => !open && setInvTargetUid(null)}
        title={`Mochila de ${liveInvPlayer?.username || ''}`}
        description="Gerencie a capacidade da mochila, adicione recompensas ou remova itens."
        maxWidth="max-w-2xl"
        footer={
          <Button variant="secondary" onClick={() => setInvTargetUid(null)}>
            Fechar
          </Button>
        }
      >
        {liveInvPlayer && (
          <div className="space-y-5">
            {/* Capacity */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-[var(--surface-0)]/70 border border-[var(--border-subtle)] p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Capacidade da Mochila
                </p>
                <p className="text-sm font-bold text-white mt-0.5 font-mono">
                  {liveInvPlayer.inventory?.length || 0} / {liveInvPlayer.slots || 10} slots usados
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  max="50"
                  aria-label="Slots para adicionar"
                  value={slotAddQty}
                  onChange={(e) => setSlotAddQty(e.target.value)}
                  className="w-20 h-9 text-center"
                />
                <Button size="sm" onClick={handleIncreaseSlots} loading={invBusy}>
                  <Plus className="h-4 w-4" />
                  Expandir Slots
                </Button>
              </div>
            </div>

            {/* Add Item Form */}
            <form
              onSubmit={handleAddItemToInv}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-0)]/40 p-4 space-y-3"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Entregar Item Diretamente
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <Input
                  placeholder="Nome do item"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="sm:col-span-2 h-10"
                />
                <Input
                  type="number"
                  min="1"
                  placeholder="Qtd"
                  value={newItemQty}
                  onChange={(e) => setNewItemQty(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Select
                  aria-label="Raridade do item"
                  value={newItemRarity}
                  onChange={(e) => setNewItemRarity(e.target.value)}
                  className="h-10"
                >
                  {RARITIES.map((r) => (
                    <option key={r.name} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </Select>
                <Select
                  aria-label="Tipo do item"
                  value={newItemType}
                  onChange={(e) => setNewItemType(e.target.value)}
                  className="h-10"
                >
                  {ITEM_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </div>
              <Textarea
                rows={2}
                placeholder="Descrição opcional..."
                value={newItemDesc}
                onChange={(e) => setNewItemDesc(e.target.value)}
              />
              <Button type="submit" size="sm" loading={invBusy}>
                <Plus className="h-4 w-4" />
                Adicionar à Mochila
              </Button>
            </form>

            {/* Slots Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-64 overflow-y-auto pr-1">
              {[...Array(liveInvPlayer.slots || 10)].map((_, i) => {
                const item = liveInvPlayer.inventory?.[i];
                const rarityMeta = item ? getRarityMeta(getRarityFromItem(item)) : null;
                return (
                  <div
                    key={i}
                    className={`rounded-xl p-2.5 min-h-[76px] flex flex-col justify-between border relative ${
                      item
                        ? 'bg-[var(--surface-0)]/80'
                        : 'border-dashed border-white/10 bg-white/[0.02] items-center justify-center'
                    }`}
                    style={item ? { borderColor: `${rarityMeta.color}55` } : undefined}
                  >
                    {item ? (
                      <>
                        <div className="flex items-start justify-between gap-1">
                          <span className="text-[11px] font-mono font-bold text-slate-300">
                            x{item.qty}
                          </span>
                          <button
                            type="button"
                            disabled={invBusy}
                            onClick={() => handleRemoveInvItem(i)}
                            title="Remover 1 unidade"
                            aria-label={`Remover 1 ${item.name}`}
                            className="h-5 w-5 rounded-md bg-rose-500/20 text-rose-300 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-colors"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                        </div>
                        <p
                          className="text-xs font-semibold line-clamp-2 mt-1"
                          style={{ color: rarityMeta.color }}
                        >
                          {item.name}
                        </p>
                      </>
                    ) : (
                      <span className="text-[11px] text-slate-600">Vazio</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDeleteParty)}
        onOpenChange={(open) => !open && setConfirmDeleteParty(null)}
        title="Excluir grupo"
        description={`Remover o grupo "${confirmDeleteParty?.name}"? Os membros continuarão no sistema sem grupo atribuído.`}
        confirmLabel="Excluir Grupo"
        loading={deletingParty}
        onConfirm={handleDeleteParty}
      />

      {/* Ficha Editável (Ficha.pdf) sincronizada em tempo real com o Jogador */}
      <CharacterSheetModal
        open={Boolean(selectedPlayerForSheet)}
        onOpenChange={(open) => !open && setSheetTargetUid(null)}
        heroUid={selectedPlayerForSheet?.uid}
        heroName={selectedPlayerForSheet?.username}
        editorProfile={currentUserProfile}
        isMasterView={true}
      />
    </div>
  );
}
