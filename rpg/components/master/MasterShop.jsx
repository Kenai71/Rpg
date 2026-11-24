'use client';

import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Bot, Minus, Pencil, Plus, Trash2, Zap } from 'lucide-react';
import { GiCoinsPile, GiSwapBag } from 'react-icons/gi';
import { toast } from 'sonner';
import {
  ITEM_TYPES,
  RARITIES,
  cleanDescription,
  formatDescriptionWithRarity,
  getItemType,
  getItemTypeLabel,
  getRarityFromItem,
  getRarityMeta,
} from '../../lib/constants';
import {
  SHOP_RARITY_WEIGHTS,
  classifyWeaponScaleType,
  computeCosineSimilarity,
  synthesizeUniqueWeaponDescription,
} from '../../lib/dnd-rules';
import { createShopItem, deleteShopItem, updateShopItem } from '../../lib/rpg-service';
import { formatNumber } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ConfirmDialog, Modal } from '../ui/Modal';
import { DataTable } from '../ui/DataTable';
import { FormField, Input, Select, Textarea } from '../ui/Input';
import { Badge, RarityBadge } from '../ui/Badge';

const shopItemSchema = z.object({
  item_name: z.string().trim().min(2, 'Informe o nome do item.').max(80),
  rarity: z.enum(['COMUM', 'INCOMUM', 'RARO', 'ÉPICO', 'LENDÁRIO', 'MÍTICO']),
  type: z.enum([
    'weapon',
    'shield',
    'head',
    'face',
    'neck',
    'body',
    'hands',
    'waist',
    'feet',
    'ring',
    'consumable',
  ]),
  price: z.coerce.number().min(1, 'Preço mínimo de 1 ouro.'),
  quantity: z.coerce.number().min(0, 'Quantidade não pode ser negativa.'),
  description: z.string().trim().max(900).optional().default(''),
});

const SHOP_AI_PRESETS = [5, 10, 15, 20, 30, 50];

export function MasterShop({ shopItems, onGenerateShopItems }) {
  const [rarityFilter, setRarityFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [diversifying, setDiversifying] = useState(false);

  // Modal de geração de itens aleatórios via IA apenas para a loja
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiCount, setAiCount] = useState(10);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiProgress, setAiProgress] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(shopItemSchema),
    defaultValues: {
      item_name: '',
      rarity: 'COMUM',
      type: 'weapon',
      price: 100,
      quantity: 1,
      description: '',
    },
  });

  const watchedRarity = watch('rarity');
  const watchedType = watch('type');
  const watchedName = watch('item_name');

  const synthesizeWeaponText = useCallback(
    (itemName, rarity, comparisonList) => {
      const safeName = String(itemName || 'Arma Forjada').trim();
      const scaleType = classifyWeaponScaleType(safeName);

      return synthesizeUniqueWeaponDescription({
        name: safeName,
        rarity: String(rarity || 'COMUM').toUpperCase(),
        scaleType,
        comparisonDescriptions: comparisonList,
      });
    },
    []
  );

  const handleSynthesizeInModal = () => {
    const existingWeaponDescs = shopItems
      .filter((s) => getItemType(s) === 'weapon' && s.id !== editingItem?.id)
      .map((s) => cleanDescription(s.description));

    const generated = synthesizeWeaponText(
      watchedName || 'Lâmina Arcana',
      watchedRarity,
      existingWeaponDescs
    );
    setValue('description', generated, { shouldDirty: true });
    toast.success(`Descrição única (${watchedRarity}) sintetizada por ML!`);
  };

  const handleDiversifyAllWeaponsML = async () => {
    const weapons = shopItems.filter((s) => getItemType(s) === 'weapon');
    if (weapons.length === 0) {
      toast.info('Nenhuma arma cadastrada na loja para diversificar.');
      return;
    }

    setDiversifying(true);
    try {
      const acceptedCorpus = [];
      let updatedCount = 0;

      for (const w of weapons) {
        const rarity = getRarityFromItem(w);
        const scaleType = classifyWeaponScaleType(w.item_name);
        const currentClean = cleanDescription(w.description);
        const isGeneric =
          currentClean.length < 50 ||
          /\[.*?\]:/.test(currentClean) ||
          /\(Vex\)|\(Nick\)|\(Topple\)|\(Sap\)|\(Push\)|\(Graze\)|\(Slow\)|\(Cleave\)/i.test(currentClean) ||
          /Corte Dimensional:\s*ignora armadura/i.test(currentClean) ||
          /Forjada nas chamas da forja an/i.test(currentClean) ||
          (rarity === 'COMUM' && /maestria/i.test(currentClean)) ||
          (scaleType === 'staff' && /\b(lâmina|lamina|espada|desembainhada|aço|aco|cortante)\b/i.test(currentClean)) ||
          (rarity === 'ÉPICO' && currentClean.length < 110) ||
          (rarity === 'LENDÁRIO' && currentClean.length < 145) ||
          (rarity === 'MÍTICO' && currentClean.length < 175);

        const isTooSimilar = acceptedCorpus.some(
          (prev) => computeCosineSimilarity(currentClean, prev) > 0.3
        );

        if (isGeneric || isTooSimilar) {
          const newBody = synthesizeWeaponText(w.item_name, rarity, acceptedCorpus);
          const fullDesc = formatDescriptionWithRarity(rarity, newBody);
          await updateShopItem(w.id, { description: fullDesc });
          acceptedCorpus.push(newBody);
          updatedCount += 1;
        } else {
          acceptedCorpus.push(currentClean);
        }
      }

      if (updatedCount > 0) {
        toast.success(
          `${updatedCount} arma(s) parecida(s) foram reescritas com descrições únicas por raridade!`
        );
      } else {
        toast.success('Todas as armas da loja já possuem alta unicidade semântica!');
      }
    } catch (err) {
      toast.error(err?.message || 'Erro ao diversificar descrições das armas.');
    } finally {
      setDiversifying(false);
    }
  };

  const handleRunShopAI = async (e) => {
    e.preventDefault();
    if (!onGenerateShopItems) return;
    const qty = Math.max(1, Math.min(50, Math.floor(Number(aiCount) || 1)));
    setGeneratingAI(true);
    setAiProgress({ createdCount: 0, totalCount: qty, chunkIndex: 1, totalChunks: Math.ceil(qty / 10) });
    try {
      await onGenerateShopItems(qty, (prog) => setAiProgress(prog));
      setAiModalOpen(false);
    } catch (err) {
      toast.error(err?.message || 'Erro ao gerar itens aleatórios via IA.');
    } finally {
      setGeneratingAI(false);
      setAiProgress(null);
    }
  };

  const openCreateModal = () => {
    setEditingItem(null);
    reset({
      item_name: '',
      rarity: 'COMUM',
      type: 'weapon',
      price: 100,
      quantity: 1,
      description: '',
    });
    setModalOpen(true);
  };

  const openEditModal = useCallback(
    (item) => {
      setEditingItem(item);
      reset({
        item_name: item.item_name || '',
        rarity: getRarityFromItem(item),
        type: getItemType(item),
        price: Number(item.price || 100),
        quantity: Number(item.quantity ?? 1),
        description:
          cleanDescription(item.description) === 'Sem descrição adicional.'
            ? ''
            : cleanDescription(item.description),
      });
      setModalOpen(true);
    },
    [reset]
  );

  const onSubmitItem = async (values) => {
    try {
      let rawDesc = String(values.description || '').trim();
      if (values.type === 'weapon' && !rawDesc) {
        const existingWeaponDescs = shopItems
          .filter((s) => getItemType(s) === 'weapon' && s.id !== editingItem?.id)
          .map((s) => cleanDescription(s.description));
        rawDesc = synthesizeWeaponText(values.item_name, values.rarity, existingWeaponDescs);
      }

      const payload = {
        item_name: values.item_name,
        description: formatDescriptionWithRarity(values.rarity, rawDesc),
        price: Number(values.price),
        quantity: Number(values.quantity),
        type: values.type,
      };
      if (editingItem) {
        await updateShopItem(editingItem.id, payload);
        toast.success('Item da loja atualizado!');
      } else {
        await createShopItem(payload);
        toast.success('Item adicionado ao catálogo da loja!');
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(err?.message || 'Erro ao salvar item.');
    }
  };

  const adjustStock = async (item, delta) => {
    const nextQty = Math.max(0, Number(item.quantity || 0) + delta);
    try {
      await updateShopItem(item.id, { quantity: nextQty });
    } catch (err) {
      toast.error('Erro ao ajustar estoque.');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteShopItem(confirmDelete.id);
      toast.success('Item removido da loja.');
      setConfirmDelete(null);
    } catch (err) {
      toast.error(err?.message || 'Erro ao remover item.');
    } finally {
      setDeleting(false);
    }
  };

  const filteredItems = useMemo(() => {
    return shopItems.filter((item) => {
      if (rarityFilter !== 'ALL' && getRarityFromItem(item) !== rarityFilter) return false;
      if (typeFilter !== 'ALL' && getItemType(item) !== typeFilter) return false;
      return true;
    });
  }, [shopItems, rarityFilter, typeFilter]);

  const shopSummary = useMemo(() => {
    const totalUnits = shopItems.reduce((acc, item) => acc + Math.max(0, Number(item.quantity || 0)), 0);
    const outOfStock = shopItems.filter((item) => Number(item.quantity || 0) <= 0).length;
    return {
      totalCatalog: shopItems.length,
      totalUnits,
      outOfStock,
    };
  }, [shopItems]);

  const columns = useMemo(
    () => [
      {
        accessorKey: 'item_name',
        header: 'Item',
        cell: ({ row }) => {
          const item = row.original;
          const rarity = getRarityFromItem(item);
          const rarityMeta = getRarityMeta(rarity);
          return (
            <div className="flex items-stretch gap-3 max-w-sm">
              <span
                aria-hidden="true"
                className="w-1 rounded-full shrink-0 my-0.5"
                style={{ backgroundColor: rarityMeta.color }}
              />
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-white">{item.item_name}</span>
                  <RarityBadge rarity={rarity} className="text-[10px] px-2 py-0" />
                </div>
                <p className="text-xs text-slate-400 line-clamp-2">
                  {cleanDescription(item.description)}
                </p>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'type',
        header: 'Tipo',
        cell: ({ row }) => (
          <Badge className="bg-white/[0.05] text-slate-300 border-white/10">
            {getItemTypeLabel(getItemType(row.original))}
          </Badge>
        ),
      },
      {
        accessorKey: 'price',
        header: 'Preço',
        cell: ({ row }) => (
          <span className="font-mono font-bold text-slate-100 inline-flex items-center gap-1.5 tabular-nums">
            <GiCoinsPile className="h-3.5 w-3.5 text-amber-400" />
            {formatNumber(row.original.price)}
            <span className="text-[11px] font-semibold text-slate-400">G</span>
          </span>
        ),
      },
      {
        accessorKey: 'quantity',
        header: 'Estoque',
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="inline-flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon-sm"
                className="h-7 w-7"
                onClick={() => adjustStock(item, -1)}
                aria-label={`Diminuir estoque de ${item.item_name}`}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span
                className={`w-8 text-center font-mono text-xs font-bold tabular-nums ${
                  item.quantity === 0 ? 'text-rose-400' : 'text-slate-100'
                }`}
              >
                {item.quantity}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                className="h-7 w-7"
                onClick={() => adjustStock(item, 1)}
                aria-label={`Aumentar estoque de ${item.item_name}`}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: 'Ações',
        enableSorting: false,
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => openEditModal(item)}
                title="Editar item"
                aria-label={`Editar ${item.item_name}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="danger"
                size="icon-sm"
                onClick={() => setConfirmDelete(item)}
                title="Remover item"
                aria-label={`Remover ${item.item_name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        },
      },
    ],
    [openEditModal]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">Catálogo da Loja</h2>
          <p className="text-xs text-slate-400">
            Cadastre armas, armaduras e consumíveis com raridades compatíveis com as Runas.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {onGenerateShopItems && (
            <Button
              variant="primary"
              onClick={() => {
                setAiCount(10);
                setAiModalOpen(true);
              }}
              title="Gerar uma quantidade personalizada de itens e armas aleatórias apenas para a loja"
            >
              <Bot className="h-4 w-4 text-slate-300" />
              Gerar Itens (IA)
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={handleDiversifyAllWeaponsML}
            loading={diversifying}
            title="Reescreve automaticamente armas e cajados parecidos ou fracos usando ML"
          >
            <Zap className="h-4 w-4 text-slate-300" />
            Diversificar Armas (ML)
          </Button>
          <Button variant="secondary" onClick={openCreateModal}>
            <Plus className="h-4 w-4" />
            Adicionar Item
          </Button>
        </div>
      </div>

      {/* Resumo Rápido do Catálogo */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl surface-card px-4 py-3 flex items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Itens Cadastrados
            </span>
            <span className="text-lg font-extrabold font-mono text-white tabular-nums">
              {formatNumber(shopSummary.totalCatalog)}
            </span>
          </div>
          <GiSwapBag className="h-5 w-5 text-slate-400 shrink-0 hidden sm:block" aria-hidden="true" />
        </div>
        <div className="rounded-2xl surface-card px-4 py-3 flex items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Unidades em Estoque
            </span>
            <span className="text-lg font-extrabold font-mono text-white tabular-nums">
              {formatNumber(shopSummary.totalUnits)}
            </span>
          </div>
          <GiCoinsPile className="h-5 w-5 text-slate-400 shrink-0 hidden sm:block" aria-hidden="true" />
        </div>
        <div className="rounded-2xl surface-card px-4 py-3 flex items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Esgotados
            </span>
            <span
              className={`text-lg font-extrabold font-mono tabular-nums ${
                shopSummary.outOfStock > 0 ? 'text-rose-400' : 'text-emerald-300'
              }`}
            >
              {formatNumber(shopSummary.outOfStock)}
            </span>
          </div>
        </div>
      </div>

      <DataTable
        data={filteredItems}
        columns={columns}
        searchPlaceholder="Buscar item por nome ou efeito..."
        emptyIcon={GiSwapBag}
        emptyTitle="Nenhum item na loja"
        emptyDescription="Adicione itens manualmente ou use 'Gerar Itens (IA)'."
        filterSlot={
          <>
            <Select
              aria-label="Filtrar por raridade"
              value={rarityFilter}
              onChange={(e) => setRarityFilter(e.target.value)}
              className="w-auto min-w-[140px] h-10"
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
              className="w-auto min-w-[140px] h-10"
            >
              <option value="ALL">Todos Tipos</option>
              {ITEM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </>
        }
        renderMobileCard={(item) => {
          const rarity = getRarityFromItem(item);
          const rarityMeta = getRarityMeta(rarity);
          return (
            <Card className="relative overflow-hidden border-white/10">
              <div
                aria-hidden="true"
                className="h-[4px] w-full"
                style={{ backgroundColor: rarityMeta.color }}
              />
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <RarityBadge rarity={rarity} />
                      <Badge className="bg-white/5 text-slate-300 border-white/10">
                        {getItemTypeLabel(getItemType(item))}
                      </Badge>
                    </div>
                    <h4 className="font-bold text-white text-sm">{item.item_name}</h4>
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-100 inline-flex items-center gap-1 shrink-0 tabular-nums">
                    <GiCoinsPile className="h-3.5 w-3.5 text-amber-400" />
                    {formatNumber(item.price)} G
                  </span>
                </div>
                <p className="text-xs text-slate-400">{cleanDescription(item.description)}</p>
                <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
                  <div className="inline-flex items-center gap-1.5">
                    <Button variant="outline" size="icon-sm" className="h-8 w-8" onClick={() => adjustStock(item, -1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center font-mono text-xs font-bold">{item.quantity}</span>
                    <Button variant="outline" size="icon-sm" className="h-8 w-8" onClick={() => adjustStock(item, 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="icon-sm" onClick={() => openEditModal(item)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="danger" size="icon-sm" onClick={() => setConfirmDelete(item)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        }}
      />

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editingItem ? 'Editar Item da Loja' : 'Novo Item na Loja'}
        description="Itens com raridade definida podem ser trocados por Runas correspondentes."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="shop-item-form" loading={isSubmitting}>
              {editingItem ? 'Salvar Item' : 'Adicionar à Loja'}
            </Button>
          </>
        }
      >
        <form id="shop-item-form" onSubmit={handleSubmit(onSubmitItem)} className="space-y-4">
          <div className="flex items-center justify-between gap-2 rounded-xl bg-[var(--surface-0)]/70 border border-[var(--border-subtle)] px-3.5 py-2.5">
            <span className="text-xs text-slate-400">Prévia da Raridade:</span>
            <RarityBadge rarity={watchedRarity} />
          </div>

          <FormField label="Nome do Item" htmlFor="s-name" required error={errors.item_name?.message}>
            <Input
              id="s-name"
              placeholder="Ex: Lâmina do Crepúsculo"
              error={errors.item_name?.message}
              {...register('item_name')}
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Raridade" htmlFor="s-rarity" error={errors.rarity?.message}>
              <Select id="s-rarity" {...register('rarity')}>
                {RARITIES.map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Tipo / Slot" htmlFor="s-type" error={errors.type?.message}>
              <Select id="s-type" {...register('type')}>
                {ITEM_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Preço (Ouro)" htmlFor="s-price" required error={errors.price?.message}>
              <Input id="s-price" type="number" min="1" {...register('price')} />
            </FormField>
            <FormField label="Quantidade" htmlFor="s-qty" required error={errors.quantity?.message}>
              <Input id="s-qty" type="number" min="0" {...register('quantity')} />
            </FormField>
          </div>

          <div className="space-y-1.5">
            {watchedType === 'weapon' && (
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleSynthesizeInModal}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-[11px] font-bold text-slate-200 transition-colors"
                >
                  <Zap className="h-3 w-3 text-slate-300" />
                  Gerar Descrição Única ({watchedRarity}) via ML
                </button>
              </div>
            )}
            <FormField label="Descrição e Efeitos Passivos" htmlFor="s-desc" error={errors.description?.message}>
              <Textarea
                id="s-desc"
                rows={4}
                placeholder="Ex: Deixe em branco ou clique em 'Gerar Descrição Única via ML' para sintetizar passiva e lore exclusivos pela raridade."
                {...register('description')}
              />
            </FormField>
          </div>
        </form>
      </Modal>

      {/* Modal de Geração Aleatória de Itens da Loja (IA) */}
      <Modal
        open={aiModalOpen}
        onOpenChange={(open) => {
          if (!generatingAI) setAiModalOpen(open);
        }}
        title="Gerar Itens Aleatórios para a Loja (IA)"
        description="Escolha quantos itens aleatórios (armas variadas incluindo cajados, armaduras, escudos, acessórios e consumíveis) deseja criar apenas na loja."
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
              form="shop-ai-generate-form"
              loading={generatingAI}
            >
              {!generatingAI && <Bot className="h-4 w-4 text-slate-300" />}
              {generatingAI
                ? `Gerando (${aiProgress?.createdCount || 0}/${aiProgress?.totalCount || aiCount})...`
                : `Gerar ${Math.max(1, Math.min(50, Math.floor(Number(aiCount) || 1)))} Item(ns)`}
            </Button>
          </>
        }
      >
        <form id="shop-ai-generate-form" onSubmit={handleRunShopAI} className="space-y-4">
          <FormField
            label="Quantidade de Itens Aleatórios (1 a 50)"
            htmlFor="shop-ai-count"
            hint="Lotes maiores (ex: 30 itens) são gerados automaticamente em etapas para evitar repetições e falhas."
          >
            <Input
              id="shop-ai-count"
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
              {SHOP_AI_PRESETS.map((n) => (
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
              Probabilidade por Raridade
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SHOP_RARITY_WEIGHTS.map((entry) => (
                <div
                  key={entry.rarity}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-[11px]"
                >
                  <RarityBadge rarity={entry.rarity} className="text-[10px] px-1.5 py-0" />
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
                  {aiProgress.createdCount}/{aiProgress.totalCount} itens
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
        title="Remover item da loja"
        description={`Deseja remover "${confirmDelete?.item_name}" do catálogo da loja?`}
        confirmLabel="Remover"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
