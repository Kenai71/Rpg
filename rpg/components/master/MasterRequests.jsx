'use client';

import { useMemo, useState } from 'react';
import { Check, Dices, Inbox, Package, X } from 'lucide-react';
import { formatDate } from '../../lib/utils';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { UserAvatar } from '../ui/UserAvatar';

export function MasterRequests({ requests, players, onResolveRequest }) {
  const [tab, setTab] = useState('pending'); // 'pending' | 'resolved'

  const pending = useMemo(
    () => requests.filter((r) => !r.status || r.status === 'pending'),
    [requests]
  );

  const resolved = useMemo(
    () => requests.filter((r) => r.status === 'approved' || r.status === 'rejected'),
    [requests]
  );

  const list = tab === 'pending' ? pending : resolved;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Solicitações dos Aventureiros</h2>
          <p className="text-xs text-slate-400">
            Aprove ou recuse pedidos de itens personalizados e giros na Roleta Gacha.
          </p>
        </div>

        <div
          role="tablist"
          className="inline-flex p-1 rounded-xl bg-[var(--surface-1)] border border-[var(--border-subtle)] w-fit"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'pending'}
            onClick={() => setTab('pending')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === 'pending'
                ? 'bg-white/10 text-white border border-white/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Pendentes ({pending.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'resolved'}
            onClick={() => setTab('resolved')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === 'resolved'
                ? 'bg-white/10 text-white border border-white/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Histórico ({resolved.length})
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={tab === 'pending' ? 'Nenhuma solicitação pendente' : 'Nenhum histórico registrado'}
          description={
            tab === 'pending'
              ? 'Pedidos enviados pelos jogadores aparecerão aqui em tempo real.'
              : 'As aprovações e recusas processadas aparecerão aqui.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {list.map((req) => {
            const isRoulette = req.item_name === 'SOLICITACAO_ROLETA';
            const player = players.find((p) => p.uid === req.player_id);
            const usedSlots = player?.inventory?.length || 0;
            const maxSlots = player?.slots || 10;
            const bagFull = usedSlots >= maxSlots;

            return (
              <Card
                key={req.id}
                interactive
                className="relative overflow-hidden border-white/10 hover:border-white/20 flex flex-col justify-between"
              >
                {tab === 'pending' && (
                  <div
                    aria-hidden="true"
                    className="h-[3px] w-full"
                    style={{ backgroundColor: isRoulette ? '#a78bfa' : '#38bdf8' }}
                  />
                )}
                <div className="p-4 flex flex-col justify-between gap-4 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-white/[0.05] border border-white/10 text-slate-300">
                        {isRoulette ? <Dices className="h-5 w-5" /> : <Package className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <h3 className="text-sm font-bold text-white truncate">
                          {isRoulette ? 'Roleta Gacha (Gacha Gift)' : `${req.quantity}x ${req.item_name}`}
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          <UserAvatar
                            src={player?.photoURL}
                            name={player?.username || req.player_name || 'Aventureiro'}
                            className="h-5 w-5 text-[9px] shrink-0"
                          />
                          <span className="text-xs font-semibold text-slate-200 truncate">
                            {player?.username || req.player_name || 'Aventureiro'}
                          </span>
                          {player && (
                            <span
                              className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono border ${
                                bagFull
                                  ? 'bg-rose-500/10 text-rose-300 border-rose-500/25'
                                  : 'bg-white/[0.04] text-slate-300 border-white/10'
                              }`}
                            >
                              Mochila {usedSlots}/{maxSlots}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Enviado em {formatDate(req.createdAt)}
                        </p>
                      </div>
                    </div>

                    {tab === 'resolved' && (
                      <Badge
                        className={
                          req.status === 'approved'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                        }
                      >
                        {req.status === 'approved' ? 'Aprovado' : 'Recusado'}
                      </Badge>
                    )}
                  </div>

                  {tab === 'pending' && (
                    <div className="flex items-center justify-between gap-3 pt-3 border-t border-[var(--border-subtle)]">
                      {bagFull ? (
                        <span className="text-[11px] font-semibold text-rose-300">
                          Mochila cheia (se não empilhar, falhará)
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Pronto para entrega</span>
                      )}

                      <div className="flex items-center gap-2 shrink-0">
                        <Button variant="danger" size="sm" onClick={() => onResolveRequest(req, false)}>
                          <X className="h-4 w-4" />
                          Recusar
                        </Button>
                        <Button variant="success" size="sm" onClick={() => onResolveRequest(req, true)}>
                          <Check className="h-4 w-4" />
                          Aprovar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
