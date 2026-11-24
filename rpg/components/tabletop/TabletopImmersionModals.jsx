/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Backpack,
  Check,
  CheckCheck,
  Coins,
  Dices,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  Link2,
  Lock,
  Mail,
  Maximize2,
  PackageOpen,
  Plus,
  RefreshCw,
  ScrollText,
  Send,
  Shield,
  Trash2,
  Unlock,
  Upload,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ITEM_TYPES,
  RARITIES,
  cleanDescription,
  getItemTypeLabel,
  getRarityFromItem,
  getRarityMeta,
} from '../../lib/constants';
import { cn, formatNumber } from '../../lib/utils';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { FormField, Input, Select, Textarea } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { UserAvatar } from '../ui/UserAvatar';
import { useTabletopSession } from './TabletopSessionProvider';

const WHISPER_CATEGORIES = [
  { id: 'secret', label: 'Segredo', color: '#a855f7', badge: 'bg-violet-500/15 text-violet-200 border-violet-400/35' },
  { id: 'perception', label: 'Percepção', color: '#38bdf8', badge: 'bg-sky-500/15 text-sky-200 border-sky-400/35' },
  { id: 'lore', label: 'Conhecimento', color: '#10b981', badge: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/35' },
  { id: 'warning', label: 'Presságio', color: '#f59e0b', badge: 'bg-amber-500/15 text-amber-200 border-amber-400/35' },
];

const WHISPER_QUICK_SNIPPETS = [
  'Você ouve passos pesados logo atrás da porta trancada...',
  'Apenas você nota um símbolo oculto gravado discretamente na pedra.',
  'O comerciante desvia o olhar rapidamente quando mencionam o rei.',
  'Um arrepio gélido percorre sua espinha: algo está observando do teto.',
];

const LOOT_THEME_PRESETS = [
  'Saque de Goblins',
  'Covil de Aranhas',
  'Baú de Masmorra',
  'Acampamento Bandido',
  'Ruínas Arcanas',
  'Tesouro de Chefe',
];

function getWhisperCategoryMeta(catId) {
  return WHISPER_CATEGORIES.find((c) => c.id === catId) || WHISPER_CATEGORIES[0];
}

// Comprime imagem do Handout para WebP HD (<= 620 KB) mantendo altíssima nitidez para cartas e mapas do tesouro
function compressHandoutImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Selecione uma imagem válida (PNG, JPG ou WebP).'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const originalUrl = ev.target?.result;
      if (typeof originalUrl === 'string' && originalUrl.length <= 620000) {
        resolve(originalUrl);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const maxSide = 1600;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (w > maxSide || h > maxSide) {
          const ratio = Math.min(maxSide / w, maxSide / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        let quality = 0.88;
        let dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        while (dataUrl.length > 620000 && quality > 0.35) {
          quality -= 0.08;
          dataUrl = dataUrl.startsWith('data:image/webp')
            ? canvas.toDataURL('image/webp', quality)
            : canvas.toDataURL('image/jpeg', quality);
        }
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Não foi possível processar esta imagem.'));
      img.src = originalUrl;
    };
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}

// =========================================================================
// BOTÕES COMPACTOS DO CABEÇALHO — MESTRE & JOGADOR
// =========================================================================

export function MasterNarrationToolbar() {
  const session = useTabletopSession();
  if (!session || !session.isMaster) return null;

  const { activeHandout, openChests, openStudio, studioTab } = session;

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => openStudio('handouts')}
        title="Handouts: Mostrar Imagem, Mapa do Tesouro ou Carta em tela cheia aos jogadores"
        aria-label="Abrir Handouts da mesa"
        className={cn(
          'relative inline-flex items-center gap-1.5 h-8 sm:h-9 px-2 sm:px-2.5 rounded-xl border text-xs font-semibold transition-all select-none',
          studioTab === 'handouts'
            ? 'bg-white/15 border-white/30 text-white'
            : 'bg-white/[0.06] border-white/15 text-slate-200 hover:text-white hover:bg-white/12 hover:border-white/25'
        )}
      >
        <ScrollText className="h-4 w-4 text-slate-300 shrink-0" />
        <span className="hidden xl:inline text-[11px]">Handouts</span>
        {activeHandout && (
          <span
            className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#07080c] animate-pulse"
            title={`Exibindo agora: ${activeHandout.title}`}
          />
        )}
      </button>

      <button
        type="button"
        onClick={() => openStudio('whispers')}
        title="Sussurros Privados: Enviar pista secreta para 1 jogador específico"
        aria-label="Abrir Sussurros Privados"
        className={cn(
          'relative inline-flex items-center gap-1.5 h-8 sm:h-9 px-2 sm:px-2.5 rounded-xl border text-xs font-semibold transition-all select-none',
          studioTab === 'whispers'
            ? 'bg-white/15 border-white/30 text-white'
            : 'bg-white/[0.06] border-white/15 text-slate-200 hover:text-white hover:bg-white/12 hover:border-white/25'
        )}
      >
        <Mail className="h-4 w-4 text-slate-300 shrink-0" />
        <span className="hidden xl:inline text-[11px]">Sussurros</span>
      </button>

      <button
        type="button"
        onClick={() => openStudio('loot')}
        title="Baú de Loot IA: Gerar saque aleatório pós-combate e selecionar quem vê aberto"
        aria-label="Abrir Baú de Loot"
        className={cn(
          'relative inline-flex items-center gap-1.5 h-8 sm:h-9 px-2 sm:px-2.5 rounded-xl border text-xs font-semibold transition-all select-none',
          studioTab === 'loot'
            ? 'bg-white/15 border-white/30 text-white'
            : 'bg-white/[0.06] border-white/15 text-slate-200 hover:text-white hover:bg-white/12 hover:border-white/25'
        )}
      >
        <PackageOpen className="h-4 w-4 text-slate-300 shrink-0" />
        <span className="hidden xl:inline text-[11px]">Baú Loot</span>
        {openChests.length > 0 && (
          <span className="px-1.5 py-0.2 rounded-full bg-amber-500/25 border border-amber-400/50 text-[10px] font-mono font-bold text-amber-200 leading-tight">
            {openChests.length}
          </span>
        )}
      </button>
    </div>
  );
}

export function PlayerImmersionBar() {
  const session = useTabletopSession();
  if (!session || session.isMaster) return null;

  const {
    activeHandout,
    reopenActiveHandout,
    unreadWhispersCount,
    whispers,
    setPlayerWhisperModalOpen,
    openChests,
    availableLootCount,
    openPlayerChest,
  } = session;

  return (
    <div className="flex items-center gap-1.5">
      {openChests.length > 0 && (
        <button
          type="button"
          onClick={() => openPlayerChest(openChests[0].id)}
          title="Abrir Baú de Loot compartilhado"
          aria-label="Abrir Baú de Loot"
          className="relative inline-flex items-center gap-1.5 h-8 sm:h-9 px-2.5 rounded-xl border border-amber-400/45 bg-amber-500/15 hover:bg-amber-500/25 text-amber-100 text-xs font-bold transition-all shadow-[0_0_20px_rgba(245,158,11,0.18)]"
        >
          <PackageOpen className="h-4 w-4 text-amber-300 shrink-0" />
          <span className="hidden sm:inline text-[11px]">Baú de Loot</span>
          {availableLootCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-[#07080c] text-[10px] font-mono font-black leading-tight">
              {availableLootCount}
            </span>
          )}
        </button>
      )}

      {activeHandout && (
        <button
          type="button"
          onClick={reopenActiveHandout}
          title={`Abrir Handout do Mestre: ${activeHandout.title}`}
          aria-label="Abrir Handout ativo"
          className="relative inline-flex items-center gap-1.5 h-8 sm:h-9 px-2 sm:px-2.5 rounded-xl border border-white/25 bg-white/10 hover:bg-white/18 text-white text-xs font-semibold transition-all"
        >
          <ScrollText className="h-4 w-4 text-slate-200 shrink-0" />
          <span className="hidden lg:inline text-[11px] max-w-[110px] truncate">
            {activeHandout.title}
          </span>
          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#07080c] animate-pulse" />
        </button>
      )}

      <button
        type="button"
        onClick={() => setPlayerWhisperModalOpen(true)}
        title={
          unreadWhispersCount > 0
            ? `${unreadWhispersCount} sussurro(s) secreto(s) não lido(s)`
            : 'Sussurros privados do Mestre'
        }
        aria-label="Abrir Sussurros Privados"
        className={cn(
          'relative inline-flex items-center gap-1.5 h-8 sm:h-9 px-2 sm:px-2.5 rounded-xl border text-xs font-semibold transition-all',
          unreadWhispersCount > 0
            ? 'bg-violet-500/20 border-violet-400/50 text-violet-100 hover:bg-violet-500/30'
            : 'bg-white/[0.06] border-white/15 text-slate-200 hover:text-white hover:bg-white/12'
        )}
      >
        <Mail className="h-4 w-4 text-slate-300 shrink-0" />
        {whispers.length > 0 && unreadWhispersCount === 0 && (
          <span className="hidden xl:inline text-[11px] text-slate-300">Sussurros</span>
        )}
        {unreadWhispersCount > 0 && (
          <span className="px-1.5 py-0.2 rounded-full bg-violet-400 text-[#07080c] text-[10px] font-mono font-black leading-tight animate-pulse">
            {unreadWhispersCount}
          </span>
        )}
      </button>
    </div>
  );
}

// =========================================================================
// SELETOR REUTILIZÁVEL DE VISIBILIDADE (TODOS OU JOGADORES ESPECÍFICOS)
// =========================================================================

function VisibilitySelector({ players = [], value = ['all'], onChange, label = 'Quem pode ver:' }) {
  const isAll = Array.isArray(value) && value.includes('all');

  const toggleAll = () => {
    onChange(['all']);
  };

  const togglePlayer = (uid) => {
    if (!uid) return;
    if (isAll) {
      onChange([uid]);
      return;
    }
    const exists = value.includes(uid);
    const next = exists ? value.filter((id) => id !== uid) : [...value, uid];
    onChange(next.length > 0 ? next : ['all']);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
          {label}
        </span>
        <span className="text-[10px] font-mono text-slate-400">
          {isAll ? 'Todos os jogadores' : `${value.length} selecionado(s)`}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={toggleAll}
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all',
            isAll
              ? 'bg-white/16 border-white/35 text-white'
              : 'bg-[#0c101b] border-white/12 text-slate-400 hover:text-white hover:bg-white/10'
          )}
        >
          <Users className="h-3.5 w-3.5 text-slate-300" />
          Todos
        </button>

        {players.map((p) => {
          const selected = !isAll && value.includes(p.uid);
          return (
            <button
              key={p.uid}
              type="button"
              onClick={() => togglePlayer(p.uid)}
              className={cn(
                'inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-xl border text-xs font-semibold transition-all',
                selected
                  ? 'bg-white/16 border-white/35 text-white'
                  : 'bg-[#0c101b] border-white/12 text-slate-400 hover:text-white hover:bg-white/10'
              )}
            >
              <UserAvatar src={p.photoURL} name={p.username} className="h-5 w-5 rounded-full text-[9px]" />
              <span className="max-w-[110px] truncate">{p.username}</span>
              {selected && <Check className="h-3 w-3 text-emerald-300 shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// =========================================================================
// ESTÚDIO DE IMERSÃO DO MESTRE (HANDOUTS + SUSSURROS + BAÚ DE LOOT IA)
// =========================================================================

function MasterImmersionStudio() {
  const session = useTabletopSession();
  const {
    studioTab,
    openStudio,
    closeStudio,
    players,
    handouts,
    createHandout,
    toggleHandoutActive,
    removeHandout,
    whispers,
    sendWhisper,
    removeWhisper,
    lootChests,
    generateAiLoot,
    createChest,
    updateChest,
    removeChest,
  } = session;

  // --- Estado Handouts ---
  const [hTitle, setHTitle] = useState('');
  const [hSubtitle, setHSubtitle] = useState('');
  const [hContent, setHContent] = useState('');
  const [hImageUrl, setHImageUrl] = useState('');
  const [hStyle, setHStyle] = useState('combined');
  const [hVisibleTo, setHVisibleTo] = useState(['all']);
  const [hUploadingImg, setHUploadingImg] = useState(false);
  const [hSaving, setHSaving] = useState(false);
  const handoutFileRef = useRef(null);

  // --- Estado Sussurros ---
  const [wTargetUid, setWTargetUid] = useState('');
  const [wCategory, setWCategory] = useState('secret');
  const [wMessage, setWMessage] = useState('');
  const [wSending, setWSending] = useState(false);

  // --- Estado Baú de Loot IA ---
  const [lTheme, setLTheme] = useState('Baú de Masmorra');
  const [lCount, setLCount] = useState(6);
  const [lTier, setLTier] = useState('mixed');
  const [lIncludeJunk, setLIncludeJunk] = useState(true);
  const [lGenerating, setLGenerating] = useState(false);

  const [draftTitle, setDraftTitle] = useState('Baú de Saque Pós-Combate');
  const [draftGold, setDraftGold] = useState(45);
  const [draftVisibleTo, setDraftVisibleTo] = useState(['all']);
  const [draftItems, setDraftItems] = useState([]);
  const [draftPlaySound, setDraftPlaySound] = useState(true);
  const [creatingChest, setCreatingChest] = useState(false);

  // Mini-formulário manual de item no rascunho
  const [showManualItem, setShowManualItem] = useState(false);
  const [mName, setMName] = useState('');
  const [mType, setMType] = useState('misc');
  const [mRarity, setMRarity] = useState('COMUM');
  const [mQty, setMQty] = useState(1);
  const [mDesc, setMDesc] = useState('');

  // Garante primeiro jogador selecionado por padrão nos Sussurros
  useEffect(() => {
    if (!wTargetUid && players.length > 0) {
      setWTargetUid(players[0].uid);
    }
  }, [players, wTargetUid]);

  const handleHandoutFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setHUploadingImg(true);
    try {
      const dataUrl = await compressHandoutImage(file);
      setHImageUrl(dataUrl);
      if (!hTitle.trim()) {
        setHTitle(file.name.replace(/\.[^/.]+$/, '').slice(0, 80));
      }
      toast.success('Imagem do Handout carregada!');
    } catch (err) {
      toast.error(err?.message || 'Erro ao carregar imagem.');
    } finally {
      setHUploadingImg(false);
      if (handoutFileRef.current) handoutFileRef.current.value = '';
    }
  };

  const handleCreateHandout = async (showImmediately) => {
    if (!hTitle.trim()) {
      toast.error('Dê um título ao Handout (ex: Bilhete do Taberneiro).');
      return;
    }
    if (!hContent.trim() && !hImageUrl.trim()) {
      toast.error('Adicione uma imagem ou texto/carta para exibir aos jogadores.');
      return;
    }
    setHSaving(true);
    try {
      await createHandout({
        title: hTitle,
        subtitle: hSubtitle,
        content: hContent,
        imageUrl: hImageUrl,
        style: hStyle,
        visible_to: hVisibleTo,
        is_active: showImmediately,
      });
      setHTitle('');
      setHSubtitle('');
      setHContent('');
      setHImageUrl('');
    } catch (err) {
      toast.error(err?.message || 'Erro ao salvar Handout.');
    } finally {
      setHSaving(false);
    }
  };

  const handleSendWhisper = async (e) => {
    e.preventDefault();
    const target = players.find((p) => p.uid === wTargetUid);
    if (!target) {
      toast.error('Selecione qual jogador receberá o sussurro privado.');
      return;
    }
    if (!wMessage.trim()) {
      toast.error('Escreva a pista ou mensagem secreta.');
      return;
    }
    setWSending(true);
    try {
      await sendWhisper({
        target_uid: target.uid,
        target_name: target.username || 'Aventureiro',
        message: wMessage,
        category: wCategory,
      });
      setWMessage('');
    } catch (err) {
      toast.error(err?.message || 'Erro ao enviar sussurro.');
    } finally {
      setWSending(false);
    }
  };

  const handleGenerateLoot = async () => {
    setLGenerating(true);
    try {
      const res = await generateAiLoot({
        theme: lTheme,
        count: lCount,
        rarityTier: lTier,
        includeJunk: lIncludeJunk,
      });
      setDraftTitle(lTheme.trim() ? `Baú: ${lTheme.trim()}` : 'Baú de Saque');
      setDraftGold(res.gold);
      setDraftItems(
        res.items.map((it, idx) => ({
          ...it,
          id: `draft-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        }))
      );
      toast.success(
        `${res.items.length} itens e ${formatNumber(res.gold)}G gerados! Revise e clique em Abrir Baú.`
      );
    } catch (err) {
      toast.error(err?.message || 'Erro ao gerar saque com IA.');
    } finally {
      setLGenerating(false);
    }
  };

  const handleAddManualDraftItem = (e) => {
    e.preventDefault();
    if (!mName.trim()) {
      toast.error('Informe o nome do item.');
      return;
    }
    const cleanDesc = mDesc.trim() || 'Item encontrado durante a exploração.';
    setDraftItems((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        name: mName.trim().slice(0, 90),
        type: mType,
        rarity: mRarity,
        qty: Math.max(1, Math.min(99, Math.floor(Number(mQty) || 1))),
        description: `<${mRarity}> ${cleanDesc}`,
      },
    ]);
    setMName('');
    setMDesc('');
    setMQty(1);
    setShowManualItem(false);
  };

  const handleOpenDraftChest = async () => {
    if (draftItems.length === 0 && Number(draftGold) <= 0) {
      toast.error('Gere itens com a IA ou adicione pelo menos 1 item ou ouro ao baú.');
      return;
    }
    setCreatingChest(true);
    try {
      await createChest({
        title: draftTitle || 'Baú de Saque',
        theme: lTheme,
        gold: Number(draftGold) || 0,
        visible_to: draftVisibleTo,
        items: draftItems,
        status: 'open',
        playSound: draftPlaySound,
      });
      setDraftItems([]);
      setDraftGold(0);
    } catch (err) {
      toast.error(err?.message || 'Erro ao abrir baú de loot.');
    } finally {
      setCreatingChest(false);
    }
  };

  const formatVisibilityNames = (visList) => {
    if (!Array.isArray(visList) || visList.includes('all')) return 'Todos os Jogadores';
    const names = visList
      .map((uid) => players.find((p) => p.uid === uid)?.username || 'Jogador')
      .filter(Boolean);
    return names.length > 0 ? names.join(', ') : 'Nenhum';
  };

  return (
    <Modal
      open={Boolean(studioTab)}
      onOpenChange={(open) => !open && closeStudio()}
      title="Mesa Narrativa do Mestre"
      description="Sincronize Handouts em tela cheia, envie Sussurros Privados e gere Baús de Loot com IA em tempo real."
      maxWidth="max-w-3xl"
    >
      {/* ABAS PRINCIPAIS DO ESTÚDIO */}
      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#0c101b] border border-white/12 mb-4">
        {[
          { id: 'handouts', label: 'Handouts', Icon: ScrollText },
          { id: 'whispers', label: 'Sussurros', Icon: Mail },
          { id: 'loot', label: 'Baú de Loot IA', Icon: PackageOpen },
        ].map(({ id, label, Icon }) => {
          const active = studioTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => openStudio(id)}
              className={cn(
                'py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all',
                active
                  ? 'bg-white/15 text-white border border-white/20 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
              )}
            >
              <Icon className="h-4 w-4 text-slate-300 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </div>

      {/* ================= ABA 1: HANDOUTS ================= */}
      {studioTab === 'handouts' && (
        <div className="space-y-5">
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/12 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
                Criar Novo Handout (Carta / Imagem / Enigma)
              </h3>
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#0c101b] border border-white/12">
                {[
                  { id: 'combined', label: 'Combinado', Icon: FileText },
                  { id: 'image', label: 'Imagem', Icon: ImageIcon },
                  { id: 'parchment', label: 'Pergaminho', Icon: ScrollText },
                ].map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setHStyle(id)}
                    className={cn(
                      'px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-all',
                      hStyle === id ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Título do Handout" required>
                <Input
                  placeholder="Ex: Mapa da Cripta / Bilhete Selado"
                  value={hTitle}
                  onChange={(e) => setHTitle(e.target.value)}
                />
              </FormField>
              <FormField label="Subtítulo ou Remetente (Opcional)">
                <Input
                  placeholder="Ex: Encontrado no corpo do espião"
                  value={hSubtitle}
                  onChange={(e) => setHSubtitle(e.target.value)}
                />
              </FormField>
            </div>

            {hStyle !== 'parchment' && (
              <div className="space-y-2">
                <input
                  ref={handoutFileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleHandoutFileChange}
                  className="hidden"
                />
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    loading={hUploadingImg}
                    onClick={() => handoutFileRef.current?.click()}
                    className="shrink-0 text-xs"
                  >
                    <Upload className="h-3.5 w-3.5 text-slate-300" />
                    Subir Imagem
                  </Button>
                  <Input
                    placeholder="Ou cole a URL da imagem (retrato, mapa do tesouro, brasão...)"
                    value={hImageUrl.startsWith('data:') ? '' : hImageUrl}
                    onChange={(e) => setHImageUrl(e.target.value)}
                    icon={Link2}
                    className="h-9 text-xs"
                  />
                  {hImageUrl && (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => setHImageUrl('')}
                      title="Remover imagem"
                      className="text-rose-300 hover:bg-rose-500/15 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {hImageUrl && (
                  <div className="rounded-xl border border-white/15 bg-black/50 p-2 flex items-center justify-center max-h-44 overflow-hidden">
                    <img
                      src={hImageUrl}
                      alt="Prévia do Handout"
                      className="max-h-40 w-auto object-contain rounded-lg"
                    />
                  </div>
                )}
              </div>
            )}

            {hStyle !== 'image' && (
              <FormField label="Texto da Carta, Bilhete ou Enigma">
                <Textarea
                  rows={4}
                  placeholder="Escreva o conteúdo que os jogadores lerão juntos na tela..."
                  value={hContent}
                  onChange={(e) => setHContent(e.target.value)}
                />
              </FormField>
            )}

            <VisibilitySelector
              players={players}
              value={hVisibleTo}
              onChange={setHVisibleTo}
              label="Destinatários do Handout:"
            />

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={hSaving}
                onClick={() => handleCreateHandout(false)}
              >
                Salvar na Biblioteca
              </Button>
              <Button
                type="button"
                size="sm"
                loading={hSaving}
                onClick={() => handleCreateHandout(true)}
              >
                <Eye className="h-4 w-4 text-slate-300" />
                Mostrar Agora em Tela Cheia
              </Button>
            </div>
          </div>

          {/* Biblioteca de Handouts Salvos */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Biblioteca de Handouts ({handouts.length})
              </h4>
            </div>

            {handouts.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 rounded-xl border border-dashed border-white/12">
                Nenhum handout criado ainda. Suba um mapa do tesouro, retrato ou escreva uma carta acima.
              </div>
            ) : (
              <div className="space-y-2">
                {handouts.map((h) => (
                  <div
                    key={h.id}
                    className={cn(
                      'p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all',
                      h.is_active
                        ? 'bg-emerald-500/10 border-emerald-400/45'
                        : 'bg-white/[0.03] border-white/10'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {h.imageUrl ? (
                        <img
                          src={h.imageUrl}
                          alt={h.title}
                          className="h-12 w-12 rounded-lg object-cover border border-white/15 shrink-0 bg-black/50"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-white/8 border border-white/12 flex items-center justify-center shrink-0">
                          <ScrollText className="h-5 w-5 text-slate-300" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white truncate">{h.title}</span>
                          {h.is_active && (
                            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/40 text-[10px]">
                              Em Tela Cheia
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          Para: {formatVisibilityNames(h.visible_to)}
                          {h.content ? ` • ${h.content.slice(0, 60)}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant={h.is_active ? 'secondary' : 'primary'}
                        onClick={() => toggleHandoutActive(h.id, !h.is_active)}
                        className="text-xs h-8"
                      >
                        {h.is_active ? (
                          <>
                            <EyeOff className="h-3.5 w-3.5 text-slate-300" />
                            Recolher
                          </>
                        ) : (
                          <>
                            <Eye className="h-3.5 w-3.5 text-slate-300" />
                            Exibir
                          </>
                        )}
                      </Button>
                      <button
                        type="button"
                        onClick={() => removeHandout(h.id)}
                        title="Excluir Handout"
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= ABA 2: SUSSURROS PRIVADOS ================= */}
      {studioTab === 'whispers' && (
        <div className="space-y-5">
          <form
            onSubmit={handleSendWhisper}
            className="p-4 rounded-2xl bg-white/[0.03] border border-white/12 space-y-3.5"
          >
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block">
                Enviar Sussurro Exclusivamente Para (1 Jogador):
              </span>
              {players.length === 0 ? (
                <div className="p-3 rounded-xl bg-[#0c101b] border border-white/10 text-xs text-slate-400">
                  Nenhum jogador cadastrado na campanha ainda.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {players.map((p) => {
                    const selected = wTargetUid === p.uid;
                    return (
                      <button
                        key={p.uid}
                        type="button"
                        onClick={() => setWTargetUid(p.uid)}
                        className={cn(
                          'inline-flex items-center gap-1.5 pl-1.5 pr-3 py-1.5 rounded-xl border text-xs font-semibold transition-all',
                          selected
                            ? 'bg-white/18 border-white/40 text-white shadow-sm'
                            : 'bg-[#0c101b] border-white/12 text-slate-400 hover:text-white hover:bg-white/10'
                        )}
                      >
                        <UserAvatar
                          src={p.photoURL}
                          name={p.username}
                          className="h-5 w-5 rounded-full text-[9px]"
                        />
                        <span>{p.username}</span>
                        {selected && <Lock className="h-3 w-3 text-violet-300" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block">
                Tom do Sussurro:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {WHISPER_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setWCategory(cat.id)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all',
                      wCategory === cat.id
                        ? 'bg-white/16 border-white/35 text-white'
                        : 'bg-[#0c101b] border-white/12 text-slate-400 hover:text-white'
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <FormField label="Mensagem / Pista Secreta" required>
              <Textarea
                rows={3}
                placeholder='Ex: "Você ouve passos abafados atrás da porta..."'
                value={wMessage}
                onChange={(e) => setWMessage(e.target.value)}
              />
            </FormField>

            <div className="flex flex-wrap gap-1.5">
              {WHISPER_QUICK_SNIPPETS.map((snippet, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setWMessage(snippet)}
                  className="px-2 py-1 rounded-lg bg-white/[0.04] border border-white/10 hover:bg-white/10 text-[10px] text-slate-300 hover:text-white truncate max-w-full transition-colors"
                >
                  &ldquo;{snippet.slice(0, 42)}...&rdquo;
                </button>
              ))}
            </div>

            <div className="flex justify-end">
              <Button type="submit" size="sm" loading={wSending} disabled={players.length === 0}>
                <Send className="h-3.5 w-3.5 text-slate-300" />
                Enviar Sussurro Privado
              </Button>
            </div>
          </form>

          {/* Histórico de Sussurros Enviados */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Sussurros Enviados ({whispers.length})
            </h4>
            {whispers.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 rounded-xl border border-dashed border-white/12">
                Nenhum sussurro enviado ainda. Somente o jogador escolhido recebe a mensagem.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {whispers.map((w) => {
                  const catMeta = getWhisperCategoryMeta(w.category);
                  return (
                    <div
                      key={w.id}
                      className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-white flex items-center gap-1">
                            <User className="h-3 w-3 text-slate-400" />
                            Para: {w.target_name || 'Jogador'}
                          </span>
                          <span
                            className={cn(
                              'px-1.5 py-0.2 rounded-md border text-[10px] font-semibold',
                              catMeta.badge
                            )}
                          >
                            {catMeta.label}
                          </span>
                          <span
                            className={cn(
                              'inline-flex items-center gap-0.5 text-[10px] font-mono',
                              w.read ? 'text-emerald-400' : 'text-slate-400'
                            )}
                          >
                            {w.read ? (
                              <>
                                <CheckCheck className="h-3 w-3" /> Lido
                              </>
                            ) : (
                              <>
                                <Check className="h-3 w-3" /> Enviado
                              </>
                            )}
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                          {w.message}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeWhisper(w.id)}
                        title="Excluir sussurro"
                        className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= ABA 3: BAÚ DE LOOT IA ================= */}
      {studioTab === 'loot' && (
        <div className="space-y-5">
          {/* Painel de Geração por IA */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/12 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Dices className="h-4 w-4 text-slate-300" />
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
                  Gerador de Saque com IA (Raridades + Objetos Diversos)
                </h3>
              </div>
            </div>

            {/* Chips de Tema Rápido */}
            <div className="flex flex-wrap gap-1.5">
              {LOOT_THEME_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setLTheme(preset)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all',
                    lTheme === preset
                      ? 'bg-white/16 border-white/35 text-white'
                      : 'bg-[#0c101b] border-white/10 text-slate-400 hover:text-white'
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <FormField label="Tema / Local do Baú">
                <Input
                  placeholder="Ex: Caverna de Aranhas"
                  value={lTheme}
                  onChange={(e) => setLTheme(e.target.value)}
                  className="h-9 text-xs"
                />
              </FormField>

              <FormField label="Nível de Raridade">
                <Select
                  value={lTier}
                  onChange={(e) => setLTier(e.target.value)}
                  className="h-9 text-xs"
                >
                  <option value="mixed">Aleatório Padrão (Comum → Mítico)</option>
                  <option value="low">Simples (Comum / Incomum)</option>
                  <option value="mid">Intermediário (Até Épico)</option>
                  <option value="high">Tesouro Nobre (Raro → Mítico)</option>
                </Select>
              </FormField>

              <FormField label="Qtd. de Itens (2 a 12)">
                <Input
                  type="number"
                  min={2}
                  max={12}
                  value={lCount}
                  onChange={(e) => setLCount(Math.max(2, Math.min(12, Number(e.target.value) || 6)))}
                  className="h-9 text-xs font-mono"
                />
              </FormField>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={lIncludeJunk}
                  onChange={(e) => setLIncludeJunk(e.target.checked)}
                  className="h-4 w-4 rounded accent-white cursor-pointer"
                />
                <span>Incluir bugigangas &amp; materiais (teia de aranha, graveto, pedra, ossos...)</span>
              </label>

              <Button
                type="button"
                size="sm"
                loading={lGenerating}
                onClick={handleGenerateLoot}
              >
                <RefreshCw className={cn('h-3.5 w-3.5 text-slate-300', lGenerating && 'animate-spin')} />
                Gerar Baú com IA
              </Button>
            </div>
          </div>

          {/* Rascunho do Baú pronto para personalizar e abrir */}
          <div className="p-4 rounded-2xl bg-[#0c101b]/90 border border-white/15 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-white">
                Configurar &amp; Abrir Baú ({draftItems.length} itens)
              </h4>
              <button
                type="button"
                onClick={() => setShowManualItem((v) => !v)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/8 border border-white/15 hover:bg-white/15 text-[11px] font-bold text-slate-200 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                {showManualItem ? 'Fechar Manual' : 'Adicionar Item Manual'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <FormField label="Nome do Baú">
                  <Input
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    placeholder="Ex: Baú do Chefe Goblin"
                    className="h-9 text-xs"
                  />
                </FormField>
              </div>
              <FormField label="Ouro no Baú (G)">
                <Input
                  type="number"
                  min={0}
                  value={draftGold}
                  onChange={(e) => setDraftGold(Math.max(0, Number(e.target.value) || 0))}
                  icon={Coins}
                  className="h-9 text-xs font-mono"
                />
              </FormField>
            </div>

            {/* Quem pode ver este baú aberto */}
            <VisibilitySelector
              players={players}
              value={draftVisibleTo}
              onChange={setDraftVisibleTo}
              label="Quem pode ver este baú aberto:"
            />

            {/* Mini-formulário manual de item */}
            {showManualItem && (
              <form
                onSubmit={handleAddManualDraftItem}
                className="p-3 rounded-xl bg-white/[0.04] border border-white/12 space-y-2.5"
              >
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div className="sm:col-span-2">
                    <Input
                      placeholder="Nome (ex: Teia de Aranha, Pedra Rúnica...)"
                      value={mName}
                      onChange={(e) => setMName(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <Select
                    value={mType}
                    onChange={(e) => setMType(e.target.value)}
                    className="h-8 text-xs"
                  >
                    {ITEM_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={mRarity}
                    onChange={(e) => setMRarity(e.target.value)}
                    className="h-8 text-xs"
                  >
                    {RARITIES.map((r) => (
                      <option key={r.name} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={99}
                    value={mQty}
                    onChange={(e) => setMQty(e.target.value)}
                    placeholder="Qtd"
                    className="w-20 h-8 text-xs font-mono"
                  />
                  <Input
                    placeholder="Descrição curta do item..."
                    value={mDesc}
                    onChange={(e) => setMDesc(e.target.value)}
                    className="flex-1 h-8 text-xs"
                  />
                  <Button type="submit" size="sm" className="h-8 text-xs shrink-0">
                    Incluir
                  </Button>
                </div>
              </form>
            )}

            {/* Prévia dos Itens com Borda de Raridade */}
            {draftItems.length === 0 ? (
              <div className="py-5 text-center text-xs text-slate-400 rounded-xl border border-dashed border-white/12">
                Clique em &ldquo;Gerar Baú com IA&rdquo; acima para sortear itens aleatórios (equipamentos + objetos/materiais como teia, graveto, pedra) ou adicione manualmente.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                {draftItems.map((it) => {
                  const rarityMeta = getRarityMeta(getRarityFromItem(it));
                  return (
                    <div
                      key={it.id}
                      className="p-2.5 rounded-xl bg-white/[0.03] border flex items-start justify-between gap-2"
                      style={{
                        borderColor: `${rarityMeta.color}88`,
                        boxShadow: `0 0 12px ${rarityMeta.color}1c`,
                      }}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge className="bg-white/8 text-slate-200 border-white/15 text-[10px]">
                            {getItemTypeLabel(it.type)}
                          </Badge>
                          {Number(it.qty) > 1 && (
                            <span className="text-[10px] font-mono font-bold text-slate-300">
                              x{it.qty}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-white truncate">{it.name}</p>
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-snug">
                          {cleanDescription(it.description)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDraftItems((prev) => prev.filter((x) => x.id !== it.id))}
                        title="Remover item do rascunho"
                        className="h-6 w-6 rounded-md flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-white/10">
              <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={draftPlaySound}
                  onChange={(e) => setDraftPlaySound(e.target.checked)}
                  className="h-4 w-4 rounded accent-white cursor-pointer"
                />
                <span>Tocar som de Baú / Tesouro ao abrir</span>
              </label>

              <Button
                type="button"
                size="sm"
                loading={creatingChest}
                onClick={handleOpenDraftChest}
                disabled={draftItems.length === 0 && Number(draftGold) <= 0}
              >
                <PackageOpen className="h-4 w-4 text-slate-300" />
                Abrir Baú para os Selecionados
              </Button>
            </div>
          </div>

          {/* Baús Criados & Monitoramento em Tempo Real */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Baús na Mesa ({lootChests.length})
            </h4>

            {lootChests.length === 0 ? (
              <div className="py-5 text-center text-xs text-slate-400 rounded-xl border border-dashed border-white/12">
                Nenhum baú criado ainda.
              </div>
            ) : (
              <div className="space-y-3">
                {lootChests.map((chest) => {
                  const items = Array.isArray(chest.items) ? chest.items : [];
                  const availCount = items.filter((i) => i.status === 'available').length;
                  const logs = Array.isArray(chest.logs) ? chest.logs : [];
                  const isOpen = chest.status === 'open';

                  return (
                    <div
                      key={chest.id}
                      className={cn(
                        'p-3.5 rounded-2xl border space-y-3',
                        isOpen
                          ? 'bg-white/[0.04] border-amber-400/35'
                          : 'bg-white/[0.02] border-white/10 opacity-80'
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-extrabold text-white">{chest.title}</span>
                            <Badge
                              className={cn(
                                'text-[10px]',
                                isOpen
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                                  : 'bg-slate-500/20 text-slate-300 border-slate-400/30'
                              )}
                            >
                              {isOpen ? 'Aberto' : 'Fechado'}
                            </Badge>
                            <span className="text-xs font-mono font-bold text-amber-300 flex items-center gap-1">
                              <Coins className="h-3.5 w-3.5" />
                              {formatNumber(chest.gold || 0)}G
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              • {availCount}/{items.length} restantes
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Visível para: {formatVisibilityNames(chest.visible_to)}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              updateChest(chest.id, { status: isOpen ? 'closed' : 'open' })
                            }
                            className="h-8 text-xs"
                          >
                            {isOpen ? (
                              <>
                                <Lock className="h-3.5 w-3.5 text-slate-300" />
                                Fechar
                              </>
                            ) : (
                              <>
                                <Unlock className="h-3.5 w-3.5 text-slate-300" />
                                Reabrir
                              </>
                            )}
                          </Button>
                          <button
                            type="button"
                            onClick={() => removeChest(chest.id)}
                            title="Excluir baú"
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/15"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Alteração instantânea de quem vê o baú aberto */}
                      <VisibilitySelector
                        players={players}
                        value={Array.isArray(chest.visible_to) ? chest.visible_to : ['all']}
                        onChange={(nextVis) => updateChest(chest.id, { visible_to: nextVis })}
                        label="Alterar acesso ao vivo:"
                      />

                      {/* Status dos itens no baú */}
                      <div className="flex flex-wrap gap-1.5">
                        {items.map((it) => {
                          const rMeta = getRarityMeta(getRarityFromItem(it));
                          return (
                            <span
                              key={it.id}
                              className={cn(
                                'px-2 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1.5',
                                it.status === 'available'
                                  ? 'bg-[#0c101b] text-white'
                                  : it.status === 'claimed'
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                                  : 'bg-white/[0.03] border-white/10 text-slate-500 line-through'
                              )}
                              style={
                                it.status === 'available'
                                  ? { borderColor: `${rMeta.color}80` }
                                  : undefined
                              }
                            >
                              <span>
                                {it.qty > 1 ? `${it.qty}x ` : ''}
                                {it.name}
                              </span>
                              {it.status === 'claimed' && (
                                <span className="text-[10px] font-mono text-emerald-300">
                                  ({it.claimedByName})
                                </span>
                              )}
                              {it.status === 'discarded' && (
                                <span className="text-[10px] font-mono text-slate-400 no-underline">
                                  (descartado)
                                </span>
                              )}
                            </span>
                          );
                        })}
                      </div>

                      {logs.length > 0 && (
                        <div className="pt-2 border-t border-white/10 space-y-1 max-h-24 overflow-y-auto">
                          {logs.slice(0, 6).map((log, i) => (
                            <p key={i} className="text-[11px] text-slate-400 font-mono">
                              • {log.text}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

// =========================================================================
// OVERLAYS EM TEMPO REAL PARA JOGADORES (HANDOUT, SUSSURRO, BAÚ DE LOOT)
// =========================================================================

function PlayerHandoutFullscreenOverlay() {
  const session = useTabletopSession();
  const [zoomed, setZoomed] = useState(false);

  const { isMaster, activeHandout, activeHandoutKey, dismissedHandoutKey, dismissActiveHandout } =
    session;

  const isVisible = !isMaster && Boolean(activeHandout) && dismissedHandoutKey !== activeHandoutKey;

  useEffect(() => {
    if (!isVisible) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') dismissActiveHandout();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isVisible, dismissActiveHandout]);

  if (!isVisible || !activeHandout) return null;

  const hasImage = Boolean(activeHandout.imageUrl) && activeHandout.style !== 'parchment';
  const hasText = Boolean(activeHandout.content) && activeHandout.style !== 'image';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Handout: ${activeHandout.title}`}
      className="fixed inset-0 z-[60] bg-black/88 backdrop-blur-lg flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={dismissActiveHandout}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[92dvh] rounded-2xl border border-white/18 bg-[#0b0e18]/98 shadow-[0_32px_90px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden"
      >
        {/* Cabeçalho */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-white/10 flex items-center justify-between gap-3 shrink-0 bg-white/[0.02]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-white/8 border border-white/15 flex items-center justify-center shrink-0">
              <ScrollText className="h-4 w-4 text-slate-200" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-extrabold text-white truncate">
                {activeHandout.title}
              </h2>
              {activeHandout.subtitle && (
                <p className="text-xs text-slate-400 truncate">{activeHandout.subtitle}</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={dismissActiveHandout}
            aria-label="Fechar handout"
            className="h-8 w-8 rounded-xl bg-white/8 border border-white/15 hover:bg-white/15 text-slate-300 hover:text-white flex items-center justify-center shrink-0 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Conteúdo: Imagem + Pergaminho */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
          <div
            className={cn(
              'grid gap-5 items-start',
              hasImage && hasText ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
            )}
          >
            {hasImage && (
              <div className="relative rounded-2xl border border-white/12 bg-black/60 p-2 flex items-center justify-center overflow-hidden group">
                <img
                  src={activeHandout.imageUrl}
                  alt={activeHandout.title}
                  onClick={() => setZoomed((z) => !z)}
                  className={cn(
                    'rounded-xl transition-transform duration-200 cursor-zoom-in select-none',
                    zoomed ? 'w-full h-auto scale-105 cursor-zoom-out' : 'max-h-[65dvh] w-auto object-contain'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setZoomed((z) => !z)}
                  title="Alternar zoom na imagem"
                  className="absolute bottom-3 right-3 h-8 px-2.5 rounded-lg bg-black/80 border border-white/20 text-[11px] font-semibold text-white flex items-center gap-1 opacity-85 hover:opacity-100"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  {zoomed ? 'Ajustar' : 'Ampliar'}
                </button>
              </div>
            )}

            {hasText && (
              <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-b from-[#17130d] to-[#0e0c0a] p-5 sm:p-6 shadow-inner space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-amber-300/80 border-b border-amber-500/15 pb-2">
                  <ScrollText className="h-3.5 w-3.5" />
                  Documento Revelado pelo Mestre
                </div>
                <p className="text-sm sm:text-base text-amber-50/95 leading-relaxed whitespace-pre-wrap font-serif">
                  {activeHandout.content}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div className="px-4 sm:px-6 py-3 border-t border-white/10 bg-white/[0.02] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <span className="text-[11px] text-slate-400">
            Você pode reabrir este handout no topo da tela enquanto o Mestre mantiver ativo.
          </span>
          <Button size="sm" variant="secondary" onClick={dismissActiveHandout}>
            Fechar Handout
          </Button>
        </div>
      </div>
    </div>
  );
}

function PlayerWhisperExperience() {
  const session = useTabletopSession();
  const {
    isMaster,
    whispers,
    popupWhisper,
    setPopupWhisper,
    playerWhisperModalOpen,
    setPlayerWhisperModalOpen,
    markWhisperRead,
  } = session;

  // Ao abrir a caixa de sussurros, marca automaticamente todos os não lidos como lidos
  useEffect(() => {
    if (isMaster || !playerWhisperModalOpen) return;
    whispers
      .filter((w) => !w.read)
      .forEach((w) => {
        markWhisperRead(w.id).catch(() => {});
      });
  }, [isMaster, playerWhisperModalOpen, whispers, markWhisperRead]);

  if (isMaster) return null;

  const popupCat = popupWhisper ? getWhisperCategoryMeta(popupWhisper.category) : null;

  return (
    <>
      {/* Notificação Secreta Flutuante (Só este jogador vê!) */}
      {popupWhisper && (
        <div className="fixed bottom-20 md:bottom-5 right-3 sm:right-5 z-[55] w-[min(370px,calc(100vw-1.5rem))] rounded-2xl border border-violet-400/45 bg-[#0c0d18]/96 backdrop-blur-2xl shadow-[0_24px_64px_rgba(0,0,0,0.9)] p-4 space-y-3 animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 rounded-xl bg-violet-500/20 border border-violet-400/45 flex items-center justify-center shrink-0">
                <Lock className="h-4 w-4 text-violet-300" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-violet-300">
                  Sussurro Privado do Mestre
                </div>
                <div className="text-[10px] text-slate-400">
                  Apenas você consegue ver esta mensagem
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                markWhisperRead(popupWhisper.id).catch(() => {});
                setPopupWhisper(null);
              }}
              aria-label="Fechar sussurro"
              className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {popupCat && (
            <span
              className={cn(
                'inline-block px-2 py-0.5 rounded-md border text-[10px] font-bold',
                popupCat.badge
              )}
            >
              {popupCat.label}
            </span>
          )}

          <p className="text-sm text-white leading-relaxed whitespace-pre-wrap bg-white/[0.04] border border-white/10 rounded-xl p-3">
            {popupWhisper.message}
          </p>

          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                markWhisperRead(popupWhisper.id).catch(() => {});
                setPopupWhisper(null);
                setPlayerWhisperModalOpen(true);
              }}
              className="text-xs h-8"
            >
              Ver Histórico
            </Button>
            <Button
              size="sm"
              onClick={() => {
                markWhisperRead(popupWhisper.id).catch(() => {});
                setPopupWhisper(null);
              }}
              className="text-xs h-8"
            >
              <Check className="h-3.5 w-3.5" />
              Entendido
            </Button>
          </div>
        </div>
      )}

      {/* Modal de Histórico de Sussurros Privados do Jogador */}
      <Modal
        open={playerWhisperModalOpen}
        onOpenChange={setPlayerWhisperModalOpen}
        title="Sussurros Privados do Mestre"
        description="Pistas e observações secretas enviadas exclusivamente para o seu personagem."
        maxWidth="max-w-lg"
      >
        {whispers.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <div className="h-12 w-12 rounded-2xl bg-white/5 border border-white/12 flex items-center justify-center mx-auto">
              <Mail className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-200">Nenhum sussurro recebido</p>
            <p className="text-xs text-slate-400">
              Quando o Mestre enviar uma pista secreta só para você, ela aparecerá aqui imediatamente.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[60dvh] overflow-y-auto pr-1">
            {whispers.map((w) => {
              const cat = getWhisperCategoryMeta(w.category);
              return (
                <div
                  key={w.id}
                  className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/12 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-md border text-[10px] font-bold',
                        cat.badge
                      )}
                    >
                      {cat.label}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                      <Lock className="h-3 w-3 text-violet-300" />
                      {w.sender_name || 'Mestre'}
                    </span>
                  </div>
                  <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">
                    {w.message}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </>
  );
}

function PlayerLootChestExperience() {
  const session = useTabletopSession();
  const {
    isMaster,
    profile,
    openChests,
    playerLootModalOpen,
    setPlayerLootModalOpen,
    selectedChestId,
    setSelectedChestId,
    newChestBanner,
    setNewChestBanner,
    openPlayerChest,
    claimChestItems,
    discardChestItems,
    claimChestGold,
  } = session;

  const [selectedIds, setSelectedIds] = useState([]);
  const [busyKey, setBusyKey] = useState(null);
  const [goldSplitInput, setGoldSplitInput] = useState('');

  const activeChest = useMemo(() => {
    if (openChests.length === 0) return null;
    if (selectedChestId) {
      const found = openChests.find((c) => c.id === selectedChestId);
      if (found) return found;
    }
    return openChests[0];
  }, [openChests, selectedChestId]);

  // Limpa seleções de itens que já foram coletados/descartados por outro membro da party em tempo real
  useEffect(() => {
    if (!activeChest) {
      setSelectedIds([]);
      return;
    }
    const availSet = new Set(
      (Array.isArray(activeChest.items) ? activeChest.items : [])
        .filter((i) => i.status === 'available')
        .map((i) => i.id)
    );
    setSelectedIds((prev) => prev.filter((id) => availSet.has(id)));
  }, [activeChest]);

  if (isMaster) return null;

  const items = Array.isArray(activeChest?.items) ? activeChest.items : [];
  const availableItems = items.filter((i) => i.status === 'available');
  const logs = Array.isArray(activeChest?.logs) ? activeChest.logs : [];
  const bagUsed = Array.isArray(profile?.inventory) ? profile.inventory.length : 0;
  const bagSlots = Number(profile?.slots) || 10;

  const toggleSelectItem = (itemId) => {
    setSelectedIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const handleClaim = async (itemIds) => {
    if (!activeChest || itemIds.length === 0) return;
    setBusyKey(itemIds.length === 1 ? `claim-${itemIds[0]}` : 'claim-batch');
    try {
      await claimChestItems(activeChest.id, itemIds);
      setSelectedIds((prev) => prev.filter((id) => !itemIds.includes(id)));
    } catch (err) {
      toast.error(err?.message || 'Não foi possível guardar na mochila.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleDiscard = async (itemIds) => {
    if (!activeChest || itemIds.length === 0) return;
    setBusyKey(itemIds.length === 1 ? `discard-${itemIds[0]}` : 'discard-batch');
    try {
      await discardChestItems(activeChest.id, itemIds);
      setSelectedIds((prev) => prev.filter((id) => !itemIds.includes(id)));
    } catch (err) {
      toast.error(err?.message || 'Não foi possível jogar fora.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleTakeGold = async (amount = null) => {
    if (!activeChest || Number(activeChest.gold) <= 0) return;
    setBusyKey('gold');
    try {
      await claimChestGold(activeChest.id, amount);
      setGoldSplitInput('');
    } catch (err) {
      toast.error(err?.message || 'Erro ao coletar ouro.');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <>
      {/* Banner discreto quando um novo Baú de Loot se abre para este jogador */}
      {newChestBanner && !playerLootModalOpen && (
        <div className="fixed bottom-20 md:bottom-5 left-3 sm:left-5 z-[55] max-w-[min(360px,calc(100vw-1.5rem))] rounded-2xl border border-amber-400/50 bg-[#0d1019]/96 backdrop-blur-2xl shadow-[0_24px_60px_rgba(0,0,0,0.9)] p-3.5 flex items-center gap-3 animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-400/45 flex items-center justify-center shrink-0">
            <PackageOpen className="h-5 w-5 text-amber-300" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300">
              Baú de Loot Aberto!
            </div>
            <p className="text-xs font-bold text-white truncate">{newChestBanner.title}</p>
          </div>
          <Button
            size="sm"
            onClick={() => openPlayerChest(newChestBanner.id)}
            className="h-8 text-xs shrink-0"
          >
            Abrir
          </Button>
          <button
            type="button"
            onClick={() => setNewChestBanner(null)}
            aria-label="Fechar aviso"
            className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Modal do Baú de Loot Compartilhado */}
      <Modal
        open={playerLootModalOpen}
        onOpenChange={setPlayerLootModalOpen}
        title={activeChest?.title || 'Baú de Loot'}
        description="Selecione o que deseja guardar na sua mochila ou jogue fora o que não precisa. Tudo sincroniza em tempo real com o grupo."
        maxWidth="max-w-3xl"
      >
        {!activeChest ? (
          <div className="py-10 text-center space-y-2">
            <PackageOpen className="h-8 w-8 text-slate-500 mx-auto" />
            <p className="text-sm font-semibold text-slate-200">Nenhum baú aberto no momento</p>
            <p className="text-xs text-slate-400">
              Quando o Mestre liberar um baú de saque para você, ele aparecerá aqui automaticamente.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Seletor caso existam vários baús abertos */}
            {openChests.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {openChests.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedChestId(c.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-xl border text-xs font-bold transition-all',
                      activeChest.id === c.id
                        ? 'bg-white/16 border-white/35 text-white'
                        : 'bg-[#0c101b] border-white/12 text-slate-400 hover:text-white'
                    )}
                  >
                    {c.title}
                  </button>
                ))}
              </div>
            )}

            {/* Barra de Ouro + Capacidade da Mochila */}
            <div className="p-3.5 rounded-2xl bg-[#0c101b] border border-white/12 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/12 border border-amber-400/35">
                  <Coins className="h-4 w-4 text-amber-300 shrink-0" />
                  <span className="text-sm font-mono font-black text-amber-200 tabular-nums">
                    {formatNumber(activeChest.gold || 0)}G
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono">
                  <Backpack className="h-4 w-4 text-slate-400" />
                  <span>
                    Mochila: <strong className="text-white">{bagUsed}</strong>/{bagSlots} slots
                  </span>
                </div>
              </div>

              {Number(activeChest.gold) > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Input
                    type="number"
                    min={1}
                    max={Number(activeChest.gold)}
                    placeholder="Qtd..."
                    value={goldSplitInput}
                    onChange={(e) => setGoldSplitInput(e.target.value)}
                    className="w-24 h-8 text-xs font-mono"
                  />
                  {goldSplitInput && Number(goldSplitInput) > 0 && (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={busyKey === 'gold'}
                      onClick={() => handleTakeGold(Number(goldSplitInput))}
                      className="h-8 text-xs"
                    >
                      Pegar {Math.min(Number(activeChest.gold), Math.floor(Number(goldSplitInput)))}G
                    </Button>
                  )}
                  <Button
                    size="sm"
                    loading={busyKey === 'gold'}
                    onClick={() => handleTakeGold(null)}
                    className="h-8 text-xs"
                  >
                    <Coins className="h-3.5 w-3.5 text-amber-300" />
                    Pegar Todo Ouro
                  </Button>
                </div>
              )}
            </div>

            {/* Barra de Seleção em Lote */}
            {availableItems.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedIds(
                        selectedIds.length === availableItems.length
                          ? []
                          : availableItems.map((i) => i.id)
                      )
                    }
                    className="text-xs font-semibold text-slate-300 hover:text-white underline underline-offset-4"
                  >
                    {selectedIds.length === availableItems.length
                      ? 'Desmarcar todos'
                      : `Selecionar disponíveis (${availableItems.length})`}
                  </button>
                </div>

                {selectedIds.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      loading={busyKey === 'claim-batch'}
                      onClick={() => handleClaim(selectedIds)}
                      className="h-8 text-xs"
                    >
                      <Backpack className="h-3.5 w-3.5 text-slate-300" />
                      Guardar ({selectedIds.length})
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      loading={busyKey === 'discard-batch'}
                      onClick={() => handleDiscard(selectedIds)}
                      className="h-8 text-xs"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Jogar Fora ({selectedIds.length})
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Grade de Itens do Baú (Borda com cor da Raridade, estilo PlayerShop) */}
            {items.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 rounded-xl border border-dashed border-white/12">
                Este baú contém apenas moedas de ouro.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {items.map((it) => {
                  const rarityName = getRarityFromItem(it);
                  const rarityMeta = getRarityMeta(rarityName);
                  const isAvailable = it.status === 'available';
                  const isClaimed = it.status === 'claimed';
                  const isDiscarded = it.status === 'discarded';
                  const isChecked = selectedIds.includes(it.id);

                  return (
                    <div
                      key={it.id}
                      onClick={() => isAvailable && toggleSelectItem(it.id)}
                      className={cn(
                        'p-3.5 rounded-2xl border flex flex-col justify-between gap-3 transition-all',
                        isAvailable
                          ? 'bg-white/[0.04] hover:bg-white/[0.07] cursor-pointer'
                          : 'bg-white/[0.015] opacity-65 cursor-default',
                        isChecked && 'ring-2 ring-white/45'
                      )}
                      style={{
                        borderColor: isAvailable ? `${rarityMeta.color}99` : 'rgba(255,255,255,0.1)',
                        boxShadow: isAvailable ? `0 0 18px ${rarityMeta.color}22` : undefined,
                      }}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge className="bg-white/8 text-slate-200 border-white/15 text-[10px]">
                              {getItemTypeLabel(it.type)}
                            </Badge>
                            {Number(it.qty) > 1 && (
                              <span className="px-1.5 py-0.5 rounded-md bg-white/10 border border-white/15 text-[10px] font-mono font-bold text-white">
                                x{it.qty}
                              </span>
                            )}
                          </div>

                          {isAvailable && (
                            <span
                              className={cn(
                                'h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors',
                                isChecked
                                  ? 'bg-white border-white text-[#07080c]'
                                  : 'bg-[#0c101b] border-white/25 text-transparent'
                              )}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>

                        <div>
                          <h4
                            className={cn(
                              'text-sm font-bold text-white',
                              isDiscarded && 'line-through text-slate-400'
                            )}
                          >
                            {it.name}
                          </h4>
                          <p className="text-xs text-slate-300/90 mt-1 leading-relaxed">
                            {cleanDescription(it.description)}
                          </p>
                        </div>
                      </div>

                      {isAvailable ? (
                        <div
                          className="flex items-center gap-2 pt-2 border-t border-white/10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            type="button"
                            size="sm"
                            loading={busyKey === `claim-${it.id}`}
                            onClick={() => handleClaim([it.id])}
                            className="flex-1 h-8 text-xs"
                          >
                            <Backpack className="h-3.5 w-3.5 text-slate-300" />
                            Guardar na Mochila
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            loading={busyKey === `discard-${it.id}`}
                            onClick={() => handleDiscard([it.id])}
                            title="Jogar este item fora"
                            className="h-8 px-2.5 text-xs text-rose-300 hover:text-rose-200 hover:bg-rose-500/15"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Jogar Fora
                          </Button>
                        </div>
                      ) : isClaimed ? (
                        <div className="pt-2 border-t border-white/10 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300">
                          <CheckCheck className="h-3.5 w-3.5 shrink-0" />
                          Guardado na mochila de {it.claimedByName || 'Aventureiro'}
                        </div>
                      ) : (
                        <div className="pt-2 border-t border-white/10 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                          <Trash2 className="h-3.5 w-3.5 shrink-0" />
                          Jogado fora por {it.discardedByName || 'Aventureiro'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Feed em tempo real do saque */}
            {logs.length > 0 && (
              <div className="p-3 rounded-xl bg-[#0c101b] border border-white/10 space-y-1 max-h-32 overflow-y-auto">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Atividade do Grupo
                </div>
                {logs.slice(0, 10).map((entry, idx) => (
                  <p key={idx} className="text-[11px] font-mono text-slate-300">
                    • {entry.text}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

// =========================================================================
// CONTAINER UNIFICADO DE OVERLAYS (MONTADO NO TabletopSessionProvider)
// =========================================================================

export function TabletopImmersionOverlays() {
  const session = useTabletopSession();
  if (!session || !session.enabled) return null;

  return (
    <>
      {session.isMaster ? (
        <MasterImmersionStudio />
      ) : (
        <>
          <PlayerHandoutFullscreenOverlay />
          <PlayerWhisperExperience />
          <PlayerLootChestExperience />
        </>
      )}
    </>
  );
}
