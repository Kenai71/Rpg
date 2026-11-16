'use client';

import { useMemo, useState } from 'react';
import { Check, Coins, Crown, Gift, Package, Search, Send, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  acceptTradeTx,
  claimRefundOrCancelTradeTx,
  createTradeTransferTx,
  rejectTrade,
} from '../../lib/rpg-service';
import { formatNumber } from '../../lib/utils';
import { Badge, RankBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/Card';
import { DetailDrawer } from '../ui/DetailDrawer';
import { EmptyState } from '../ui/EmptyState';
import { FormField, Input, Select } from '../ui/Input';
import { UserAvatar } from '../ui/UserAvatar';

export function PlayerAllies({
  allPlayers,
  parties,
  profile,
  incomingTrades,
  outgoingTrades,
}) {
  const [search, setSearch] = useState('');
  const [onlyMyParty, setOnlyMyParty] = useState(false);

  // Transfer modal
  const [targetAlly, setTargetAlly] = useState(null);
  const [transferType, setTransferType] = useState('gold'); // 'gold' | 'item'
  const [goldAmount, setGoldAmount] = useState('');
  const [selectedItemIdx, setSelectedItemIdx] = useState(0);
  const [itemQty, setItemQty] = useState(1);
  const [sending, setSending] = useState(false);
  const [busyTradeId, setBusyTradeId] = useState(null);

  const allies = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allPlayers.filter((p) => {
      if (onlyMyParty && profile?.party_id && p.party_id !== profile.party_id) return false;
      if (q && !String(p.username || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allPlayers, onlyMyParty, profile?.party_id, search]);

  const pendingIncoming = useMemo(
    () => incomingTrades.filter((t) => t.status === 'pending'),
    [incomingTrades]
  );

  const activeOutgoing = useMemo(
    () => outgoingTrades.filter((t) => t.status === 'pending' || t.status === 'rejected'),
    [outgoingTrades]
  );

  const openTransferModal = (ally) => {
    setTargetAlly(ally);
    setTransferType('gold');
    setGoldAmount('');
    setSelectedItemIdx(0);
    setItemQty(1);
  };

  const handleSendTransfer = async (e) => {
    e.preventDefault();
    if (!targetAlly || !profile) return;
    setSending(true);
    try {
      await createTradeTransferTx(profile, targetAlly, {
        type: transferType,
        amount: goldAmount,
        itemIndex: selectedItemIdx,
        itemQty,
      });
      toast.success(
        `Oferta enviada para ${targetAlly.username}! Aguardando aceitação.`
      );
      setTargetAlly(null);
    } catch (err) {
      toast.error(err?.message || 'Erro ao enviar transferência.');
    } finally {
      setSending(false);
    }
  };

  const handleAcceptTrade = async (trade) => {
    setBusyTradeId(trade.id);
    try {
      await acceptTradeTx(trade.id, profile.uid);
      toast.success(
        trade.type === 'gold'
          ? `Você recebeu ${formatNumber(trade.amount)} Ouro de ${trade.sender_name}!`
          : `Você recebeu ${trade.item?.qty}x ${trade.item?.name}!`
      );
    } catch (err) {
      toast.error(err?.message || 'Não foi possível aceitar a oferta.');
    } finally {
      setBusyTradeId(null);
    }
  };

  const handleRejectTrade = async (trade) => {
    setBusyTradeId(trade.id);
    try {
      await rejectTrade(trade.id);
      toast.info('Oferta recusada. O remetente poderá resgatar o item/ouro.');
    } catch (err) {
      toast.error(err?.message || 'Erro ao recusar oferta.');
    } finally {
      setBusyTradeId(null);
    }
  };

  const handleClaimOrCancel = async (trade) => {
    setBusyTradeId(trade.id);
    try {
      await claimRefundOrCancelTradeTx(trade.id, profile.uid);
      toast.success(
        trade.status === 'pending'
          ? 'Envio cancelado e devolvido para você!'
          : 'Devolução resgatada com sucesso!'
      );
    } catch (err) {
      toast.error(err?.message || 'Não foi possível resgatar a devolução.');
    } finally {
      setBusyTradeId(null);
    }
  };

  const myInventory = profile?.inventory || [];

  return (
    <div className="space-y-6">
      {/* Incoming & Outgoing Trades */}
      {(pendingIncoming.length > 0 || activeOutgoing.length > 0) && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {pendingIncoming.length > 0 && (
            <Card className="p-4 border-emerald-500/30 bg-emerald-500/[0.04] space-y-3">
              <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                <Gift className="h-4 w-4" />
                Ofertas Recebidas ({pendingIncoming.length})
              </h3>
              <div className="space-y-2.5">
                {pendingIncoming.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-sm font-bold text-white truncate">
                        {t.type === 'gold'
                          ? `${formatNumber(t.amount)} Ouro`
                          : `${t.item?.qty}x ${t.item?.name}`}
                      </p>
                      <p className="text-xs text-slate-400">
                        Enviado por <strong className="text-slate-200">{t.sender_name}</strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={busyTradeId === t.id}
                        onClick={() => handleRejectTrade(t)}
                      >
                        <X className="h-4 w-4" />
                        Recusar
                      </Button>
                      <Button
                        variant="success"
                        size="sm"
                        loading={busyTradeId === t.id}
                        onClick={() => handleAcceptTrade(t)}
                      >
                        <Check className="h-4 w-4" />
                        Aceitar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {activeOutgoing.length > 0 && (
            <Card className="p-4 border-amber-500/25 bg-amber-500/[0.03] space-y-3">
              <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                <Send className="h-4 w-4" />
                Suas Transferências Enviadas ({activeOutgoing.length})
              </h3>
              <div className="space-y-2.5">
                {activeOutgoing.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-sm font-bold text-white truncate">
                        {t.type === 'gold'
                          ? `${formatNumber(t.amount)} Ouro`
                          : `${t.item?.qty}x ${t.item?.name}`}{' '}
                        <span className="text-xs font-normal text-slate-400">
                          → {t.receiver_name}
                        </span>
                      </p>
                      <p className="text-xs text-slate-400">
                        {t.status === 'rejected'
                          ? 'Recusado pelo destinatário — pronto para resgate'
                          : 'Aguardando resposta do destinatário'}
                      </p>
                    </div>
                    <Button
                      variant={t.status === 'rejected' ? 'primary' : 'outline'}
                      size="sm"
                      loading={busyTradeId === t.id}
                      onClick={() => handleClaimOrCancel(t)}
                    >
                      {t.status === 'rejected' ? 'Resgatar' : 'Cancelar'}
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </section>
      )}

      {/* Search & Party Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="w-full sm:max-w-xs">
          <Input
            icon={Search}
            placeholder="Buscar aventureiro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar aventureiro"
            className="h-10"
          />
        </div>
        {profile?.party_id && (
          <Button
            variant={onlyMyParty ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setOnlyMyParty((prev) => !prev)}
          >
            <Users className="h-4 w-4" />
            {onlyMyParty ? 'Mostrando Meu Grupo' : 'Filtrar Meu Grupo'}
          </Button>
        )}
      </div>

      {/* Allies Grid */}
      {allies.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum aliado encontrado"
          description="Nenhum aventureiro corresponde à sua busca."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {allies.map((ally) => {
            const isSelf = ally.uid === profile?.uid;
            const party = parties.find((g) => g.id === ally.party_id);
            const isLeader = Boolean(party && party.leader_id === ally.uid);
            const sameParty = Boolean(profile?.party_id && ally.party_id === profile.party_id);

            return (
              <Card
                key={ally.uid}
                interactive
                className={`flex flex-col justify-between ${
                  isSelf
                    ? 'border-white/25'
                    : sameParty
                    ? 'border-emerald-500/30'
                    : ''
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar
                      src={ally.photoURL}
                      name={ally.username}
                      className="h-11 w-11 text-sm"
                    />
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="text-sm flex items-center gap-1.5 truncate">
                        <span className="truncate">{ally.username}</span>
                        {isLeader && <Crown className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                      </CardTitle>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <RankBadge rank={ally.rank} className="text-[10px] px-2 py-0" />
                        <span className="text-xs font-mono text-slate-400">LVL {ally.level}</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-2 space-y-2">
                  {party ? (
                    <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/25">
                      Grupo: {party.name}
                    </Badge>
                  ) : (
                    <span className="text-xs text-slate-500">Aventureiro independente</span>
                  )}
                </CardContent>

                <CardFooter>
                  {isSelf ? (
                    <span className="text-xs font-semibold text-slate-300 w-full text-center py-1">
                      Seu Personagem
                    </span>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => openTransferModal(ally)}
                    >
                      <Gift className="h-4 w-4 text-slate-300" />
                      Enviar Ouro / Item
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Transfer Inspector Drawer */}
      <DetailDrawer
        open={Boolean(targetAlly)}
        onOpenChange={(open) => !open && setTargetAlly(null)}
        title={`Enviar para ${targetAlly?.username || ''}`}
        subtitle="O destinatário receberá uma oferta segura para aceitar ou recusar."
        badge={targetAlly && <RankBadge rank={targetAlly.rank} />}
        footer={
          <div className="flex items-center gap-2.5">
            <Button variant="ghost" className="flex-1" onClick={() => setTargetAlly(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="transfer-form" className="flex-[2]" loading={sending}>
              <Send className="h-4 w-4" />
              Enviar Oferta
            </Button>
          </div>
        }
      >
        <form id="transfer-form" onSubmit={handleSendTransfer} className="space-y-4">
          <div className="grid grid-cols-2 p-1 rounded-xl bg-[var(--surface-0)] border border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => setTransferType('gold')}
              className={`h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                transferType === 'gold'
                  ? 'bg-[var(--surface-2)] text-amber-300 border border-[var(--border-subtle)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Coins className="h-3.5 w-3.5" /> Ouro
            </button>
            <button
              type="button"
              onClick={() => setTransferType('item')}
              className={`h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                transferType === 'item'
                  ? 'bg-[var(--surface-2)] text-white border border-[var(--border-subtle)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Package className="h-3.5 w-3.5" /> Item da Mochila
            </button>
          </div>

          {transferType === 'gold' ? (
            <FormField
              label="Quantidade de Ouro"
              htmlFor="transfer-gold"
              hint={`Seu saldo atual: ${formatNumber(profile?.gold || 0)} Ouro`}
              required
            >
              <Input
                id="transfer-gold"
                type="number"
                min="1"
                max={profile?.gold || 0}
                placeholder="Ex: 100"
                value={goldAmount}
                onChange={(e) => setGoldAmount(e.target.value)}
              />
            </FormField>
          ) : myInventory.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">
              Sua mochila está vazia. Não há itens para enviar.
            </p>
          ) : (
            <div className="space-y-3">
              <FormField label="Item para Enviar" htmlFor="transfer-item">
                <Select
                  id="transfer-item"
                  value={selectedItemIdx}
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    setSelectedItemIdx(idx);
                    setItemQty(1);
                  }}
                >
                  {myInventory.map((item, idx) => (
                    <option key={`${item.name}-${idx}`} value={idx}>
                      {item.name} (x{item.qty})
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Quantidade" htmlFor="transfer-item-qty">
                <Input
                  id="transfer-item-qty"
                  type="number"
                  min="1"
                  max={myInventory[selectedItemIdx]?.qty || 1}
                  value={itemQty}
                  onChange={(e) => setItemQty(e.target.value)}
                />
              </FormField>
            </div>
          )}
        </form>
      </DetailDrawer>
    </div>
  );
}
