'use client';

import { useMemo, useState } from 'react';
import { Coins, Hexagon, Search, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import {
  ITEM_TYPES,
  RARITIES,
  cleanDescription,
  getItemType,
  getItemTypeLabel,
  getRarityFromItem,
  getRarityMeta,
} from '../../lib/constants';
import { buyShopItemTx } from '../../lib/rpg-service';
import { formatNumber } from '../../lib/utils';
import { Badge, RarityBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { Input, Select } from '../ui/Input';
import { Modal } from '../ui/Modal';

export function PlayerShop({ shopItems, profile }) {
  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('name');
  const [selectedItem, setSelectedItem] = useState(null);
  const [buying, setBuying] = useState(false);

  const availableItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = shopItems.filter((item) => {
      if (Number(item.quantity || 0) <= 0) return false;
      if (rarityFilter !== 'ALL' && getRarityFromItem(item) !== rarityFilter) return false;
      if (typeFilter !== 'ALL' && getItemType(item) !== typeFilter) return false;
      if (q) {
        const hay = `${item.item_name || ''} ${item.description || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'price_asc') return Number(a.price) - Number(b.price);
      if (sortBy === 'price_desc') return Number(b.price) - Number(a.price);
      return String(a.item_name || '').localeCompare(String(b.item_name || ''));
    });
  }, [shopItems, search, rarityFilter, typeFilter, sortBy]);

  const selectedRarity = selectedItem ? getRarityFromItem(selectedItem) : 'COMUM';
  const selectedRarityMeta = getRarityMeta(selectedRarity);
  const runeName = `Runa ${selectedRarity}`;
  const hasMatchingRune = Boolean(
    profile?.inventory?.some((i) => i.name === runeName && i.qty > 0)
  );
  const hasEnoughGold = (profile?.gold || 0) >= Number(selectedItem?.price || 0);

  const handleConfirmBuy = async (useRune) => {
    if (!selectedItem || !profile) return;
    setBuying(true);
    try {
      await buyShopItemTx(profile.uid, selectedItem.id, useRune);
      toast.success(
        useRune
          ? `"${selectedItem.item_name}" obtido usando ${runeName}!`
          : `"${selectedItem.item_name}" comprado por ${formatNumber(selectedItem.price)} Ouro!`
      );
      setSelectedItem(null);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível concluir a compra.');
    } finally {
      setBuying(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="w-full md:max-w-xs">
          <Input
            icon={Search}
            placeholder="Buscar equipamento ou efeito..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar item na loja"
            className="h-10"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Filtrar por raridade"
            value={rarityFilter}
            onChange={(e) => setRarityFilter(e.target.value)}
            className="w-auto min-w-[135px] h-10"
          >
            <option value="ALL">Todas Raridades</option>
            {RARITIES.map((r) => (
              <option key={r.name} value={r.name}>
                {r.name}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Filtrar por tipo"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-auto min-w-[130px] h-10"
          >
            <option value="ALL">Todos Tipos</option>
            {ITEM_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Ordenar loja"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-auto min-w-[135px] h-10"
          >
            <option value="name">Ordem Alfabética</option>
            <option value="price_asc">Menor Preço</option>
            <option value="price_desc">Maior Preço</option>
          </Select>
        </div>
      </div>

      {/* Items Grid */}
      {availableItems.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Nenhum item disponível"
          description="Nenhum equipamento corresponde aos filtros atuais ou o estoque esgotou."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {availableItems.map((item) => {
            const rarity = getRarityFromItem(item);
            const rarityMeta = getRarityMeta(rarity);
            const itemTypeLabel = getItemTypeLabel(getItemType(item));
            const hasRune = profile?.inventory?.some(
              (i) => i.name === `Runa ${rarity}` && i.qty > 0
            );

            return (
              <Card
                key={item.id}
                className="flex flex-col justify-between hover:border-[var(--border-strong)] transition-colors"
                style={{ borderTopWidth: '3px', borderTopColor: rarityMeta.color }}
              >
                <div>
                  <CardHeader className="pb-2">
                    <div className="space-y-2 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <RarityBadge rarity={rarity} />
                        <Badge className="bg-white/5 text-slate-300 border-white/10">
                          {itemTypeLabel}
                        </Badge>
                        {hasRune && (
                          <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                            Você tem a Runa
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-base" style={{ color: rarityMeta.color }}>
                        {item.item_name}
                      </CardTitle>
                    </div>
                    <Badge className="bg-[var(--surface-0)] text-slate-300 border-[var(--border-subtle)] font-mono shrink-0">
                      x{item.quantity}
                    </Badge>
                  </CardHeader>

                  <CardContent>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {cleanDescription(item.description)}
                    </p>
                  </CardContent>
                </div>

                <CardFooter className="justify-between">
                  <span className="inline-flex items-center gap-1.5 font-mono text-sm font-bold text-amber-300 tabular-nums">
                    <Coins className="h-4 w-4 text-amber-400" aria-hidden="true" />
                    {formatNumber(item.price)} G
                  </span>
                  <Button size="sm" onClick={() => setSelectedItem(item)}>
                    Comprar
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Buy Modal */}
      <Modal
        open={Boolean(selectedItem)}
        onOpenChange={(open) => !open && setSelectedItem(null)}
        title={
          <span style={{ color: selectedRarityMeta.color }}>{selectedItem?.item_name}</span>
        }
        description={`${getItemTypeLabel(getItemType(selectedItem))} • Raridade ${selectedRarity}`}
        maxWidth="max-w-md"
      >
        {selectedItem && (
          <div className="space-y-5">
            <div className="rounded-xl bg-[var(--surface-0)]/70 border border-[var(--border-subtle)] p-4 text-sm text-slate-300 leading-relaxed">
              {cleanDescription(selectedItem.description)}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Escolha a forma de pagamento
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={!hasEnoughGold || buying}
                  onClick={() => handleConfirmBuy(false)}
                  className={`rounded-2xl border p-4 text-left transition-all flex flex-col gap-2 ${
                    hasEnoughGold
                      ? 'border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 cursor-pointer'
                      : 'border-white/10 bg-white/[0.02] opacity-50 cursor-not-allowed'
                  }`}
                >
                  <Coins className="h-5 w-5 text-amber-400" />
                  <div>
                    <span className="block font-mono text-lg font-extrabold text-amber-300">
                      {formatNumber(selectedItem.price)} G
                    </span>
                    <span className="text-xs text-slate-300">
                      {hasEnoughGold ? 'Pagar com Ouro' : 'Ouro insuficiente'}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={!hasMatchingRune || buying}
                  onClick={() => handleConfirmBuy(true)}
                  className={`rounded-2xl border p-4 text-left transition-all flex flex-col gap-2 ${
                    hasMatchingRune
                      ? 'bg-white/[0.04] hover:bg-white/[0.09] cursor-pointer'
                      : 'border-white/10 bg-white/[0.02] opacity-50 cursor-not-allowed'
                  }`}
                  style={
                    hasMatchingRune ? { borderColor: `${selectedRarityMeta.color}80` } : undefined
                  }
                >
                  <Hexagon className="h-5 w-5" style={{ color: selectedRarityMeta.color }} />
                  <div>
                    <span className="block text-sm font-bold text-white">{runeName}</span>
                    <span
                      className={`text-xs font-semibold ${
                        hasMatchingRune ? 'text-emerald-300' : 'text-rose-400'
                      }`}
                    >
                      {hasMatchingRune ? 'Trocar 1 Runa' : 'Você não possui'}
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
