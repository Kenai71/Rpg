'use client';

import { useState } from 'react';
import {
  Backpack,
  Circle,
  Crown,
  Dices,
  Footprints,
  Gem,
  Glasses,
  Hand,
  Hexagon,
  Plus,
  RectangleHorizontal,
  Search,
  Shield,
  Shirt,
  Sword,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  RARITIES,
  cleanDescription,
  getItemType,
  getItemTypeLabel,
  getRarityFromItem,
  getRarityMeta,
} from '../../lib/constants';
import {
  discardInventoryItemTx,
  equipInventoryItemTx,
  openGachaGiftTx,
  requestItem,
  unequipSlotTx,
} from '../../lib/rpg-service';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { DetailDrawer } from '../ui/DetailDrawer';
import { ConfirmDialog, Modal } from '../ui/Modal';
import { FormField, Input } from '../ui/Input';
import { Badge, RarityBadge } from '../ui/Badge';
import { CharacterSheetPreviewCard } from '../sheet/EditablePdfSheet';

const SLOT_ICONS = {
  head: { icon: Crown, label: 'Cabeça', gridArea: 'head' },
  face: { icon: Glasses, label: 'Rosto', gridArea: 'face' },
  body: { icon: Shirt, label: 'Armadura', gridArea: 'body' },
  neck: { icon: Circle, label: 'Pescoço', gridArea: 'neck' },
  weapon: { icon: Sword, label: 'Arma', gridArea: 'weapon' },
  hands: { icon: Hand, label: 'Mãos', gridArea: 'hands' },
  shield: { icon: Shield, label: 'Escudo', gridArea: 'shield' },
  waist: { icon: RectangleHorizontal, label: 'Cinto', gridArea: 'waist' },
  feet: { icon: Footprints, label: 'Pés', gridArea: 'feet' },
  ring1: { icon: Gem, label: 'Anel 1', gridArea: 'ring1' },
  ring2: { icon: Gem, label: 'Anel 2', gridArea: 'ring2' },
};

export function PlayerCharacter({ profile, onOpenRoulette }) {
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [bagSearch, setBagSearch] = useState('');
  const [busy, setBusy] = useState(false);

  // Split DetailDrawer inspectors
  const [inspectedInvIdx, setInspectedInvIdx] = useState(null);
  const [inspectedEquipSlot, setInspectedEquipSlot] = useState(null);
  const [confirmDiscard, setConfirmDiscard] = useState(null);

  // Request item modal
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [reqItemName, setReqItemName] = useState('');
  const [reqItemQty, setReqItemQty] = useState(1);
  const [sendingRequest, setSendingRequest] = useState(false);

  const inventory = profile?.inventory || [];
  const equipment = profile?.equipment || {};
  const maxSlots = profile?.slots || 10;
  const equippedCount = Object.values(equipment).filter(Boolean).length;

  const inspectedItem = inspectedInvIdx !== null ? inventory[inspectedInvIdx] : null;
  const inspectedEquippedItem = inspectedEquipSlot ? equipment[inspectedEquipSlot] : null;

  const handleEquip = async (invIdx, targetSlot) => {
    setBusy(true);
    try {
      await equipInventoryItemTx(profile.uid, invIdx, targetSlot);
      toast.success('Item equipado!');
      setInspectedInvIdx(null);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível equipar este item.');
    } finally {
      setBusy(false);
    }
  };

  const handleUnequip = async (slotName) => {
    setBusy(true);
    try {
      await unequipSlotTx(profile.uid, slotName);
      toast.success('Item guardado na mochila.');
      setInspectedEquipSlot(null);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível desequipar.');
    } finally {
      setBusy(false);
    }
  };

  const handleDiscard = async () => {
    if (!confirmDiscard) return;
    setBusy(true);
    try {
      await discardInventoryItemTx(profile.uid, confirmDiscard.idx, confirmDiscard.all);
      toast.info('Item descartado da mochila.');
      setConfirmDiscard(null);
      setInspectedInvIdx(null);
    } catch (err) {
      toast.error(err?.message || 'Erro ao descartar item.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    if (!reqItemName.trim()) {
      toast.error('Informe o nome do item desejado.');
      return;
    }
    setSendingRequest(true);
    try {
      await requestItem(profile, reqItemName, reqItemQty);
      toast.success('Solicitação enviada ao Mestre!');
      setReqItemName('');
      setReqItemQty(1);
      setRequestModalOpen(false);
    } catch (err) {
      toast.error(err?.message || 'Erro ao enviar solicitação.');
    } finally {
      setSendingRequest(false);
    }
  };

  const renderEquipSlot = (slotKey) => {
    const meta = SLOT_ICONS[slotKey];
    const Icon = meta.icon;
    const item = equipment[slotKey];
    const rarityMeta = item ? getRarityMeta(getRarityFromItem(item)) : null;

    return (
      <button
        key={slotKey}
        type="button"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (draggedIdx !== null) {
            handleEquip(draggedIdx, slotKey);
            setDraggedIdx(null);
          }
        }}
        onClick={() => item && setInspectedEquipSlot(slotKey)}
        aria-label={item ? `${meta.label}: ${item.name}` : `Slot ${meta.label} vazio`}
        className={`h-20 w-full rounded-xl border flex flex-col items-center justify-center gap-1 p-2 transition-all ${
          item
            ? 'bg-[var(--surface-0)]/90 hover:scale-[1.03] cursor-pointer shadow-inner'
            : 'border-dashed border-white/10 bg-white/[0.02] opacity-70 hover:opacity-100 hover:border-white/25'
        }`}
        style={
          item
            ? {
                borderColor: rarityMeta.color,
                boxShadow: `inset 0 0 16px ${rarityMeta.color}1a`,
              }
            : undefined
        }
      >
        <Icon
          className="h-5 w-5 shrink-0"
          style={{ color: item ? rarityMeta.color : '#64748b' }}
          aria-hidden="true"
        />
        <span
          className="text-[11px] font-semibold w-full truncate text-center"
          style={{ color: item ? rarityMeta.color : '#64748b' }}
        >
          {item ? item.name : meta.label}
        </span>
      </button>
    );
  };

  const renderEquipButtonOptions = (item, idx) => {
    const type = getItemType(item);
    const isBlocked = item.name.includes('Runa') || item.name === 'Gacha Gift';
    if (isBlocked || type === 'consumable') return null;

    if (type === 'ring') {
      return (
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => handleEquip(idx, 'ring1')} loading={busy}>
            Equipar (Anel 1)
          </Button>
          <Button onClick={() => handleEquip(idx, 'ring2')} loading={busy}>
            Equipar (Anel 2)
          </Button>
        </div>
      );
    }

    const targetMeta = SLOT_ICONS[type];
    if (!targetMeta) return null;

    return (
      <Button className="w-full" onClick={() => handleEquip(idx, type)} loading={busy}>
        Equipar em {targetMeta.label}
      </Button>
    );
  };

  const bagFilterTerm = bagSearch.trim().toLowerCase();

  return (
    <div className="space-y-6">
      {/* Ficha Oficial Editável (Ficha.pdf) em Pré-Visualização Completa Reduzida */}
      <CharacterSheetPreviewCard profile={profile} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Paper Doll Equipment */}
      <Card className="lg:col-span-5">
        <CardHeader className="border-b border-[var(--border-subtle)] pb-4">
          <div className="w-full flex items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-slate-300" />
                Equipamento
              </CardTitle>
              <CardDescription className="mt-1">
                Arraste um item ou toque em qualquer card para equipar/desequipar.
              </CardDescription>
            </div>
            <Badge className="bg-white/5 text-slate-200 border-white/10 font-mono shrink-0">
              {equippedCount} / 11
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto">
            <div />
            {renderEquipSlot('head')}
            <div />

            {renderEquipSlot('face')}
            {renderEquipSlot('body')}
            {renderEquipSlot('neck')}

            {renderEquipSlot('weapon')}
            {renderEquipSlot('hands')}
            {renderEquipSlot('shield')}

            {renderEquipSlot('ring1')}
            {renderEquipSlot('waist')}
            {renderEquipSlot('ring2')}

            <div />
            {renderEquipSlot('feet')}
            <div />
          </div>
        </CardContent>
      </Card>

      {/* Backpack / Inventory */}
      <Card className="lg:col-span-7">
        <CardHeader className="border-b border-[var(--border-subtle)] pb-4 flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Backpack className="h-5 w-5 text-slate-300" />
              Mochila
              <Badge className="bg-white/5 text-slate-200 border-white/10 font-mono">
                {inventory.length} / {maxSlots}
              </Badge>
            </CardTitle>
            <CardDescription className="mt-1">
              Selecione qualquer slot para inspecionar, equipar, usar ou descartar.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            {inventory.length > 0 && (
              <div className="w-full sm:w-44">
                <Input
                  icon={Search}
                  placeholder="Filtrar mochila..."
                  value={bagSearch}
                  onChange={(e) => setBagSearch(e.target.value)}
                  aria-label="Filtrar itens da mochila"
                  className="h-9 text-xs"
                />
              </div>
            )}
            <Button variant="secondary" size="sm" onClick={() => setRequestModalOpen(true)}>
              <Plus className="h-4 w-4" />
              Solicitar Item
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {[...Array(maxSlots)].map((_, i) => {
              const item = inventory[i];
              if (
                bagFilterTerm &&
                (!item || !String(item.name || '').toLowerCase().includes(bagFilterTerm))
              ) {
                return null;
              }

              const isNonEquippable =
                item && (item.name.includes('Runa') || item.name === 'Gacha Gift');
              const rarity = item ? getRarityFromItem(item) : 'COMUM';
              const rarityMeta = getRarityMeta(rarity);
              const isGacha = item?.name === 'Gacha Gift';

              if (!item) {
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setRequestModalOpen(true)}
                    aria-label={`Slot ${i + 1} vazio — solicitar item`}
                    className="aspect-square rounded-xl border border-dashed border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.04] flex flex-col items-center justify-center gap-1 text-slate-600 hover:text-slate-300 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="text-[10px] font-medium">Vazio</span>
                  </button>
                );
              }

              return (
                <button
                  key={`${item.name}-${i}`}
                  type="button"
                  draggable={!isNonEquippable}
                  onDragStart={(e) => {
                    if (isNonEquippable) {
                      e.preventDefault();
                      return;
                    }
                    setDraggedIdx(i);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onClick={() => setInspectedInvIdx(i)}
                  className="aspect-square rounded-xl border bg-[var(--surface-0)]/80 hover:bg-[var(--surface-2)] hover:-translate-y-0.5 p-2.5 flex flex-col justify-between text-left transition-all relative cursor-pointer"
                  style={{
                    borderColor: `${rarityMeta.color}66`,
                    boxShadow: `inset 0 0 14px ${rarityMeta.color}14`,
                  }}
                >
                  <div className="flex items-center justify-between w-full gap-1">
                    <span className="px-1.5 py-0.5 rounded bg-black/50 text-[10px] font-mono font-bold text-slate-200">
                      x{item.qty}
                    </span>
                    {isGacha && (
                      <span className="px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-bold text-white">
                        ABRIR
                      </span>
                    )}
                  </div>

                  <p
                    className="text-xs font-bold leading-snug line-clamp-2 w-full"
                    style={{ color: rarityMeta.color }}
                  >
                    {item.name}
                  </p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Inspect Inventory Item Drawer */}
      <DetailDrawer
        open={Boolean(inspectedItem)}
        onOpenChange={(open) => !open && setInspectedInvIdx(null)}
        title={
          <span style={{ color: getRarityMeta(getRarityFromItem(inspectedItem)).color }}>
            {inspectedItem?.name}
          </span>
        }
        subtitle={
          inspectedItem
            ? `${getItemTypeLabel(getItemType(inspectedItem))} • Quantidade na mochila: ${inspectedItem.qty}`
            : ''
        }
        accentColor={getRarityMeta(getRarityFromItem(inspectedItem)).color}
        badge={
          inspectedItem && (
            <>
              <RarityBadge rarity={getRarityFromItem(inspectedItem)} />
              <Badge className="bg-white/5 text-slate-300 border-white/10">
                {getItemTypeLabel(getItemType(inspectedItem))}
              </Badge>
            </>
          )
        }
        footer={
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setInspectedInvIdx(null)}
          >
            Fechar
          </Button>
        }
      >
        {inspectedItem && (
          <div className="space-y-4">
            <div className="rounded-xl bg-[var(--surface-0)]/70 border border-[var(--border-subtle)] p-4 text-sm text-slate-200 leading-relaxed">
              {cleanDescription(inspectedItem.description)}
            </div>

            <div className="space-y-2.5 pt-1">
              {inspectedItem.name === 'Gacha Gift' && (
                <Button
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold border-amber-300 shadow-lg shadow-amber-500/20"
                  onClick={() => {
                    setInspectedInvIdx(null);
                    if (onOpenRoulette) onOpenRoulette();
                  }}
                  loading={busy}
                >
                  <Dices className="h-4 w-4" />
                  Abrir Roleta Rúnica
                </Button>
              )}

              {renderEquipButtonOptions(inspectedItem, inspectedInvIdx)}

              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[var(--border-subtle)]">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() =>
                    setConfirmDiscard({ idx: inspectedInvIdx, item: inspectedItem, all: false })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Descartar 1
                </Button>
                {inspectedItem.qty > 1 && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() =>
                      setConfirmDiscard({ idx: inspectedInvIdx, item: inspectedItem, all: true })
                    }
                  >
                    Descartar Tudo ({inspectedItem.qty})
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </DetailDrawer>

      {/* Inspect Equipped Item Drawer */}
      <DetailDrawer
        open={Boolean(inspectedEquippedItem)}
        onOpenChange={(open) => !open && setInspectedEquipSlot(null)}
        title={
          <span style={{ color: getRarityMeta(getRarityFromItem(inspectedEquippedItem)).color }}>
            {inspectedEquippedItem?.name}
          </span>
        }
        subtitle={
          inspectedEquipSlot ? `Equipado no slot: ${SLOT_ICONS[inspectedEquipSlot]?.label}` : ''
        }
        accentColor={getRarityMeta(getRarityFromItem(inspectedEquippedItem)).color}
        badge={
          inspectedEquippedItem && <RarityBadge rarity={getRarityFromItem(inspectedEquippedItem)} />
        }
        footer={
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => setInspectedEquipSlot(null)}
            >
              Fechar
            </Button>
            <Button
              variant="secondary"
              className="flex-[2]"
              loading={busy}
              onClick={() => handleUnequip(inspectedEquipSlot)}
            >
              Desequipar para Mochila
            </Button>
          </div>
        }
      >
        {inspectedEquippedItem && (
          <div className="rounded-xl bg-[var(--surface-0)]/70 border border-[var(--border-subtle)] p-4 text-sm text-slate-200 leading-relaxed">
            {cleanDescription(inspectedEquippedItem.description)}
          </div>
        )}
      </DetailDrawer>

      {/* Request Custom Item Modal */}
      <Modal
        open={requestModalOpen}
        onOpenChange={setRequestModalOpen}
        title="Solicitar Item ao Mestre"
        description="Envie um pedido de item para o Mestre aprovar e entregar na sua mochila."
        maxWidth="max-w-sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRequestModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="request-item-form" loading={sendingRequest}>
              Enviar Pedido
            </Button>
          </>
        }
      >
        <form id="request-item-form" onSubmit={handleSubmitRequest} className="space-y-4">
          <FormField label="Nome do Item" htmlFor="req-name" required>
            <Input
              id="req-name"
              placeholder="Ex: Poção de Cura Menor"
              value={reqItemName}
              onChange={(e) => setReqItemName(e.target.value)}
            />
          </FormField>
          <FormField label="Quantidade" htmlFor="req-qty" required>
            <Input
              id="req-qty"
              type="number"
              min="1"
              max="99"
              value={reqItemQty}
              onChange={(e) => setReqItemQty(e.target.value)}
            />
          </FormField>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDiscard)}
        onOpenChange={(open) => !open && setConfirmDiscard(null)}
        title="Descartar Item"
        description={
          confirmDiscard?.all
            ? `Tem certeza que deseja jogar fora todas as ${confirmDiscard?.item?.qty} unidades de "${confirmDiscard?.item?.name}"?`
            : `Deseja jogar fora 1 unidade de "${confirmDiscard?.item?.name}"?`
        }
        confirmLabel="Descartar"
        loading={busy}
        onConfirm={handleDiscard}
      />
      </div>
    </div>
  );
}
