'use client';

import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Coins, Minus, Pencil, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  ITEM_TYPES,
  RARITIES,
  cleanDescription,
  formatDescriptionWithRarity,
  getItemType,
  getItemTypeLabel,
  getRarityFromItem,
} from '../../lib/constants';
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

export function MasterShop({ shopItems }) {
  const [rarityFilter, setRarityFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
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
      const payload = {
        item_name: values.item_name,
        description: formatDescriptionWithRarity(values.rarity, values.description),
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

  const columns = useMemo(
    () => [
      {
        accessorKey: 'item_name',
        header: 'Item',
        cell: ({ row }) => {
          const item = row.original;
          const rarity = getRarityFromItem(item);
          return (
            <div className="max-w-sm space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-white">{item.item_name}</span>
                <RarityBadge rarity={rarity} />
              </div>
              <p className="text-xs text-slate-400 line-clamp-2">
                {cleanDescription(item.description)}
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: 'type',
        header: 'Tipo',
        cell: ({ row }) => (
          <Badge className="bg-white/5 text-slate-300 border-white/10">
            {getItemTypeLabel(getItemType(row.original))}
          </Badge>
        ),
      },
      {
        accessorKey: 'price',
        header: 'Preço',
        cell: ({ row }) => (
          <span className="font-mono font-bold text-amber-300 inline-flex items-center gap-1 tabular-nums">
            <Coins className="h-3.5 w-3.5" />
            {formatNumber(row.original.price)} G
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
        <Button onClick={openCreateModal} className="shrink-0">
          <Plus className="h-4 w-4" />
          Adicionar Item
        </Button>
      </div>

      <DataTable
        data={filteredItems}
        columns={columns}
        searchPlaceholder="Buscar item por nome ou efeito..."
        emptyIcon={ShoppingBag}
        emptyTitle="Nenhum item na loja"
        emptyDescription="Adicione itens manualmente ou use 'Gerar Diária (IA)'."
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
          return (
            <Card className="p-4 space-y-3">
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
                <span className="font-mono text-xs font-bold text-amber-300 shrink-0">
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

          <FormField label="Descrição e Efeitos Passivos" htmlFor="s-desc" error={errors.description?.message}>
            <Textarea
              id="s-desc"
              rows={3}
              placeholder="Ex: Passiva: Concede +2 de agilidade durante combates noturnos."
              {...register('description')}
            />
          </FormField>
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
