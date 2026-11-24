'use client';

import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Hexagon,
  LayoutGrid,
  List,
  Search,
} from 'lucide-react';
import {
  GiBackpack,
  GiChestArmor,
  GiCoinsPile,
  GiCrossedSwords,
  GiMagicSwirl,
  GiShield,
  GiSwapBag,
} from 'react-icons/gi';
import { toast } from 'sonner';

function getShopTypeIcon(type) {
  switch (type) {
    case 'weapon':
      return GiCrossedSwords;
    case 'shield':
      return GiShield;
    case 'body':
    case 'head':
    case 'hands':
    case 'feet':
    case 'waist':
      return GiChestArmor;
    case 'ring':
    case 'neck':
    case 'face':
      return GiMagicSwirl;
    case 'misc':
      return GiBackpack;
    default:
      return GiSwapBag;
  }
}
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
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/Card';
import { DetailDrawer } from '../ui/DetailDrawer';
import { EmptyState } from '../ui/EmptyState';
import { Input, Select } from '../ui/Input';

export function PlayerShop({ shopItems, profile }) {
  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('name');
  const [displayLayout, setDisplayLayout] = useState('grid'); // 'grid' | 'list'
  const [selectedItem, setSelectedItem] = useState(null);
  const [buyQty, setBuyQty] = useState(1);
  const [buying, setBuying] = useState(false);

  const handleOpenItem = (item) => {
    setBuyQty(1);
    setSelectedItem(item);
  };

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
  const runeItem = profile?.inventory?.find((i) => i.name === runeName);
  const runeCount = runeItem?.qty || 0;
  const hasMatchingRune = runeCount >= buyQty;
  const totalPrice = Number(selectedItem?.price || 0) * buyQty;
  const hasEnoughGold = (profile?.gold || 0) >= totalPrice;
  const stock = Math.max(1, Number(selectedItem?.quantity || 1));

  const usedSlots = profile?.inventory?.length || 0;
  const maxSlots = profile?.slots || 10;
  const canStackSelected = Boolean(
    selectedItem && profile?.inventory?.some((i) => i.name === selectedItem.item_name)
  );
  const bagHasSpace = canStackSelected || usedSlots < maxSlots;

  const handleConfirmBuy = async (useRune) => {
    if (!selectedItem || !profile) return;
    setBuying(true);
    try {
      await buyShopItemTx(profile.uid, selectedItem.id, useRune, buyQty);
      const totalCost = Number(selectedItem.price || 0) * buyQty;
      toast.success(
        useRune
          ? `"${selectedItem.item_name}" (${buyQty}x) obtido usando ${buyQty}x ${runeName}!`
          : `"${selectedItem.item_name}" (${buyQty}x) comprado por ${formatNumber(totalCost)} Ouro!`
      );
      setSelectedItem(null);
      setBuyQty(1);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível concluir a compra.');
    } finally {
      setBuying(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Filters & Rarity Chips */}
      <div className="space-y-3">
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
              className="w-auto min-w-[140px] h-10"
            >
              <option value="name">Ordem Alfabética</option>
              <option value="price_asc">Menor Preço</option>
              <option value="price_desc">Maior Preço</option>
            </Select>

            <div className="hidden sm:inline-flex items-center p-0.5 rounded-xl bg-[var(--surface-1)] border border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setDisplayLayout('grid')}
                aria-label="Visualizar catálogo em grade"
                aria-pressed={displayLayout === 'grid'}
                className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
                  displayLayout === 'grid'
                    ? 'bg-[var(--surface-2)] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setDisplayLayout('list')}
                aria-label="Visualizar catálogo em lista"
                aria-pressed={displayLayout === 'list'}
                className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
                  displayLayout === 'list'
                    ? 'bg-[var(--surface-2)] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Rarity filter chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setRarityFilter('ALL')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors shrink-0 ${
              rarityFilter === 'ALL'
                ? 'bg-white/10 text-white border-white/20'
                : 'bg-[var(--surface-1)] text-slate-400 border-[var(--border-subtle)] hover:text-white'
            }`}
          >
            Todas Raridades
          </button>
          {RARITIES.map((r) => {
            const active = rarityFilter === r.name;
            return (
              <button
                key={r.name}
                type="button"
                onClick={() => setRarityFilter(r.name)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors shrink-0 ${
                  active
                    ? 'bg-[var(--surface-2)] text-white border-white/25'
                    : 'bg-[var(--surface-1)] text-slate-400 border-[var(--border-subtle)] hover:text-white'
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: r.color }}
                  aria-hidden="true"
                />
                {r.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Catalog Items */}
      {availableItems.length === 0 ? (
        <EmptyState
          icon={GiSwapBag}
          title="Nenhum item disponível"
          description="Nenhum equipamento corresponde aos filtros atuais ou o estoque esgotou."
        />
      ) : displayLayout === 'list' ? (
        <div className="space-y-2.5">
          {availableItems.map((item) => {
            const rarity = getRarityFromItem(item);
            const rarityMeta = getRarityMeta(rarity);
            const itemType = getItemType(item);
            const itemTypeLabel = getItemTypeLabel(itemType);
            const TypeIcon = getShopTypeIcon(itemType);
            return (
              <Card
                key={item.id}
                interactive
                onClick={() => handleOpenItem(item)}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
                style={{
                  borderColor: rarityMeta.color,
                  boxShadow: `0 0 14px -4px ${rarityMeta.color}33`,
                }}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-white/5 text-slate-300 border-white/10">
                      <TypeIcon className="h-3 w-3 text-slate-300" />
                      {itemTypeLabel}
                    </Badge>
                    <h3 className="text-sm font-bold truncate text-white">
                      {item.item_name}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-1">
                    {cleanDescription(item.description)}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0 justify-between sm:justify-end">
                  <span className="font-mono text-xs text-slate-400">Est: {item.quantity}</span>
                  <span className="font-mono text-sm font-bold text-amber-300 inline-flex items-center gap-1">
                    <GiCoinsPile className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                    {formatNumber(item.price)} G
                  </span>
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenItem(item);
                    }}
                  >
                    Inspecionar
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {availableItems.map((item) => {
            const rarity = getRarityFromItem(item);
            const rarityMeta = getRarityMeta(rarity);
            const itemType = getItemType(item);
            const itemTypeLabel = getItemTypeLabel(itemType);
            const TypeIcon = getShopTypeIcon(itemType);

            return (
              <Card
                key={item.id}
                interactive
                onClick={() => handleOpenItem(item)}
                className="flex flex-col justify-between cursor-pointer group overflow-hidden"
                style={{
                  borderColor: rarityMeta.color,
                  boxShadow: `0 0 16px -4px ${rarityMeta.color}33`,
                }}
              >
                <div>
                  <CardHeader className="pb-2">
                    <div className="space-y-2 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-white/5 text-slate-300 border-white/10">
                          <TypeIcon className="h-3 w-3 text-slate-300" />
                          {itemTypeLabel}
                        </Badge>
                      </div>
                      <CardTitle className="text-base group-hover:text-slate-100 transition-colors text-white">
                        {item.item_name}
                      </CardTitle>
                    </div>
                    <Badge className="bg-[var(--surface-0)] text-slate-300 border-[var(--border-subtle)] font-mono shrink-0">
                      x{item.quantity}
                    </Badge>
                  </CardHeader>

                  <CardContent>
                    <p className="text-sm text-slate-300 leading-relaxed line-clamp-3">
                      {cleanDescription(item.description)}
                    </p>
                  </CardContent>
                </div>

                <CardFooter className="justify-between">
                  <span className="inline-flex items-center gap-1.5 font-mono text-sm font-bold text-amber-300 tabular-nums">
                    <GiCoinsPile className="h-4 w-4 text-amber-400" aria-hidden="true" />
                    {formatNumber(item.price)} G
                  </span>
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenItem(item);
                    }}
                  >
                    Inspecionar
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Checkout & Inspector Drawer */}
      <DetailDrawer
        open={Boolean(selectedItem)}
        onOpenChange={(open) => !open && setSelectedItem(null)}
        title={
          <span className="text-white">{selectedItem?.item_name}</span>
        }
        subtitle={
          selectedItem
            ? `${getItemTypeLabel(getItemType(selectedItem))} • ${selectedItem.quantity} em estoque`
            : ''
        }
        accentColor={selectedRarityMeta.color}
        badge={
          selectedItem && (
            <Badge className="bg-white/5 text-slate-300 border-white/10">
              {getItemTypeLabel(getItemType(selectedItem))}
            </Badge>
          )
        }
        footer={
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setSelectedItem(null)}
          >
            Fechar Inspetor
          </Button>
        }
      >
        {selectedItem && (
          <>
            <div className="rounded-xl bg-[var(--surface-0)]/70 border border-[var(--border-subtle)] p-4 text-sm text-slate-200 leading-relaxed">
              {cleanDescription(selectedItem.description)}
            </div>

            <div className="rounded-xl bg-[var(--surface-0)]/50 border border-[var(--border-subtle)] p-3.5 flex items-center justify-between text-xs">
              <span className="text-slate-400 inline-flex items-center gap-1.5">
                <GiBackpack className="h-4 w-4" /> Mochila
              </span>
              <span className={`font-mono font-bold ${bagHasSpace ? 'text-emerald-300' : 'text-rose-400'}`}>
                {bagHasSpace
                  ? canStackSelected
                    ? 'Empilha em item existente'
                    : `Espaço disponível (${usedSlots}/${maxSlots})`
                  : `Mochila cheia (${usedSlots}/${maxSlots})`}
              </span>
            </div>

            {/* Seletor de Quantidade */}
            <div className="rounded-xl bg-[var(--surface-0)]/50 border border-[var(--border-subtle)] p-3.5 flex items-center justify-between text-xs">
              <span className="text-slate-300 font-semibold">Quantidade:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={buyQty <= 1 || buying}
                  onClick={() => setBuyQty((q) => Math.max(1, q - 1))}
                  className="h-8 w-8 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold flex items-center justify-center disabled:opacity-40 transition-colors"
                  aria-label="Diminuir quantidade"
                >
                  -
                </button>
                <span className="font-mono font-bold text-white text-sm px-2 min-w-[28px] text-center">
                  {buyQty}
                </span>
                <button
                  type="button"
                  disabled={buyQty >= stock || buying}
                  onClick={() => setBuyQty((q) => Math.min(stock, q + 1))}
                  className="h-8 w-8 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold flex items-center justify-center disabled:opacity-40 transition-colors"
                  aria-label="Aumentar quantidade"
                >
                  +
                </button>
                <span className="text-[11px] text-slate-400 font-mono ml-1">
                  (máx: {stock})
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Escolha a forma de pagamento
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={!hasEnoughGold || !bagHasSpace || buying}
                  onClick={() => handleConfirmBuy(false)}
                  className={`rounded-2xl border p-4 text-left transition-all flex flex-col gap-2 ${
                    hasEnoughGold && bagHasSpace
                      ? 'border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 cursor-pointer'
                      : 'border-white/10 bg-white/[0.02] opacity-50 cursor-not-allowed'
                  }`}
                >
                  <GiCoinsPile className="h-5 w-5 text-amber-400" />
                  <div>
                    <span className="block font-mono text-lg font-extrabold text-amber-300">
                      {formatNumber(totalPrice)} G
                    </span>
                    <span className="text-xs text-slate-300">
                      {!bagHasSpace
                        ? 'Sem espaço na mochila'
                        : hasEnoughGold
                        ? `Comprar ${buyQty}x com Ouro`
                        : `Ouro insuficiente (${formatNumber(totalPrice)} G)`}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={!hasMatchingRune || !bagHasSpace || buying}
                  onClick={() => handleConfirmBuy(true)}
                  className={`rounded-2xl border p-4 text-left transition-all flex flex-col gap-2 ${
                    hasMatchingRune && bagHasSpace
                      ? 'bg-white/[0.04] hover:bg-white/[0.09] cursor-pointer'
                      : 'border-white/10 bg-white/[0.02] opacity-50 cursor-not-allowed'
                  }`}
                  style={
                    hasMatchingRune && bagHasSpace
                      ? { borderColor: `${selectedRarityMeta.color}80` }
                      : undefined
                  }
                >
                  <Hexagon className="h-5 w-5" style={{ color: selectedRarityMeta.color }} />
                  <div>
                    <span className="block text-sm font-bold text-white">
                      {buyQty > 1 ? `${buyQty}x ${runeName}` : runeName}
                    </span>
                    <span
                      className={`text-xs font-semibold ${
                        hasMatchingRune && bagHasSpace ? 'text-emerald-300' : 'text-rose-400'
                      }`}
                    >
                      {!bagHasSpace
                        ? 'Sem espaço na mochila'
                        : hasMatchingRune
                        ? `Trocar ${buyQty}x Runa(s)`
                        : `Você tem ${runeCount}/${buyQty}`}
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </>
        )}
      </DetailDrawer>
    </div>
  );
}
