/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Clock,
  Dices,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  Link2,
  Lock,
  Maximize2,
  Minus,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Unlock,
  Upload,
  User,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  GiBackpack,
  GiChestArmor,
  GiCoins,
  GiCoinsPile,
  GiCrossedSwords,
  GiCrown,
  GiCrownedSkull,
  GiDungeonGate,
  GiGemPendant,
  GiHealthPotion,
  GiHoodedFigure,
  GiKey,
  GiLockedChest,
  GiMagicSwirl,
  GiOpenTreasureChest,
  GiQuillInk,
  GiScrollUnfurled,
  GiShield,
  GiSpiderWeb,
  GiStonePile,
  GiTreasureMap,
} from 'react-icons/gi';
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
  'Um arrepio gélido percorre sua espinha: algo observa do alto das vigas.',
];

const LOOT_THEME_PRESETS = [
  { id: 'Saque de Goblins', label: 'Saque de Goblins', tag: 'Emboscada', Icon: GiCrownedSkull },
  { id: 'Covil de Aranhas', label: 'Covil de Aranhas', tag: 'Caverna', Icon: GiSpiderWeb },
  { id: 'Baú de Masmorra', label: 'Baú de Masmorra', tag: 'Subterrâneo', Icon: GiDungeonGate },
  { id: 'Acampamento Bandido', label: 'Acampamento Bandido', tag: 'Estrada', Icon: GiCrossedSwords },
  { id: 'Ruínas Arcanas', label: 'Ruínas Arcanas', tag: 'Místico', Icon: GiMagicSwirl },
  { id: 'Tesouro de Chefe', label: 'Tesouro de Chefe', tag: 'Relíquia', Icon: GiCrown },
];

const LOOT_RARITY_TIERS = [
  {
    id: 'mixed',
    label: 'Aleatório',
    sub: 'Comum → Mítico',
    dots: ['#94a3b8', '#22c55e', '#38bdf8', '#a855f7', '#f59e0b'],
  },
  {
    id: 'low',
    label: 'Simples',
    sub: 'Comum / Incomum',
    dots: ['#94a3b8', '#22c55e'],
  },
  {
    id: 'mid',
    label: 'Intermediário',
    sub: 'Até Épico',
    dots: ['#22c55e', '#38bdf8', '#a855f7'],
  },
  {
    id: 'high',
    label: 'Tesouro Nobre',
    sub: 'Raro → Mítico',
    dots: ['#38bdf8', '#a855f7', '#f59e0b', '#f43f5e'],
  },
];

function getWhisperCategoryMeta(catId) {
  return WHISPER_CATEGORIES.find((c) => c.id === catId) || WHISPER_CATEGORIES[0];
}

function getLootTypeIcon(type) {
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
      return GiGemPendant;
    case 'consumable':
      return GiHealthPotion;
    default:
      return GiBackpack;
  }
}

// Comprime imagem do Handout para WebP HD (<= 620 KB) com validação contra Zip Bomb, SVG/XSS e Pixel Flood
async function compressHandoutImage(file) {
  const { MAX_AVATAR_UPLOAD_BYTES, validateSafeImageDimensions, validateSafeImageFile } = await import(
    '../../lib/upload-security'
  );
  await validateSafeImageFile(file, { maxBytes: MAX_AVATAR_UPLOAD_BYTES });
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const maxSide = 1600;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        const dimCheck = validateSafeImageDimensions(w, h, file.size);
        if (!dimCheck.ok) {
          reject(new Error(dimCheck.reason));
          return;
        }
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
        canvas.width = 0;
        canvas.height = 0;
        resolve(dataUrl);
      } catch {
        reject(new Error('Não foi possível processar esta imagem.'));
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Não foi possível processar esta imagem.'));
    };
    img.src = objectUrl;
  });
}

// =========================================================================
// BARRAS COMPACTAS DO CABEÇALHO — MESTRE & JOGADOR
// =========================================================================

export function MasterNarrationToolbar() {
  const session = useTabletopSession();
  if (!session || !session.isMaster) return null;

  const { activeHandout, openChests, openStudio, studioTab } = session;

  return (
    <div
      className="inline-flex items-center gap-0.5 p-0.5 rounded-xl bg-[#0c101b]/90 border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
      role="toolbar"
      aria-label="Ferramentas Narrativas do Mestre"
    >
      <button
        type="button"
        onClick={() => openStudio('handouts')}
        title="Handouts: Mostrar Imagem, Mapa do Tesouro ou Carta em tela cheia"
        aria-label="Abrir Handouts da mesa"
        className={cn(
          'relative inline-flex items-center gap-1.5 h-7 sm:h-8 px-2 sm:px-2.5 rounded-[10px] text-xs font-semibold transition-all select-none',
          studioTab === 'handouts'
            ? 'bg-white/15 text-white shadow-sm'
            : 'text-slate-300 hover:text-white hover:bg-white/[0.08]'
        )}
      >
        <GiScrollUnfurled className="h-4 w-4 text-slate-300 shrink-0" />
        <span className="hidden xl:inline text-[11px]">Handouts</span>
        {activeHandout && (
          <span
            className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0"
            title={`Exibindo agora: ${activeHandout.title}`}
          />
        )}
      </button>

      <div className="w-px h-4 bg-white/10" aria-hidden="true" />

      <button
        type="button"
        onClick={() => openStudio('whispers')}
        title="Sussurros Privados: Enviar pista secreta apenas para 1 jogador"
        aria-label="Abrir Sussurros Privados"
        className={cn(
          'relative inline-flex items-center gap-1.5 h-7 sm:h-8 px-2 sm:px-2.5 rounded-[10px] text-xs font-semibold transition-all select-none',
          studioTab === 'whispers'
            ? 'bg-white/15 text-white shadow-sm'
            : 'text-slate-300 hover:text-white hover:bg-white/[0.08]'
        )}
      >
        <GiHoodedFigure className="h-4 w-4 text-slate-300 shrink-0" />
        <span className="hidden xl:inline text-[11px]">Sussurros</span>
      </button>

      <div className="w-px h-4 bg-white/10" aria-hidden="true" />

      <button
        type="button"
        onClick={() => openStudio('loot')}
        title="Baú de Loot IA: Gerar saque aleatório pós-combate com visibilidade seletiva"
        aria-label="Abrir Baú de Loot"
        className={cn(
          'relative inline-flex items-center gap-1.5 h-7 sm:h-8 px-2 sm:px-2.5 rounded-[10px] text-xs font-semibold transition-all select-none',
          studioTab === 'loot'
            ? 'bg-white/15 text-white shadow-sm'
            : 'text-slate-300 hover:text-white hover:bg-white/[0.08]'
        )}
      >
        <GiOpenTreasureChest className="h-4 w-4 text-slate-300 shrink-0" />
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
          className="relative inline-flex items-center gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl border border-amber-400/50 bg-gradient-to-r from-amber-500/20 to-amber-600/12 hover:from-amber-500/28 hover:to-amber-500/18 text-amber-100 text-xs font-bold transition-all shadow-[0_0_24px_rgba(245,158,11,0.2)]"
        >
          <GiOpenTreasureChest className="h-4 w-4 text-amber-300 shrink-0" />
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
          <GiScrollUnfurled className="h-4 w-4 text-slate-200 shrink-0" />
          <span className="hidden lg:inline text-[11px] max-w-[115px] truncate">
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
            ? 'bg-violet-500/20 border-violet-400/50 text-violet-100 hover:bg-violet-500/30 shadow-[0_0_20px_rgba(139,92,246,0.22)]'
            : 'bg-white/[0.06] border-white/15 text-slate-200 hover:text-white hover:bg-white/12'
        )}
      >
        <GiHoodedFigure className="h-4 w-4 text-slate-300 shrink-0" />
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

  const toggleAll = () => onChange(['all']);

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
        <span className="px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-[10px] font-mono text-slate-300">
          {isAll ? 'Todos os jogadores' : `${value.length} selecionado(s)`}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={toggleAll}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all',
            isAll
              ? 'bg-white/16 border-white/35 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]'
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
                  ? 'bg-white/16 border-white/35 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]'
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

  // Sub-aba da interface visual do Baú de Loot (Forja vs Cofre ao Vivo)
  const [lootSubTab, setLootSubTab] = useState('forge');
  const [expandedAccessChestId, setExpandedAccessChestId] = useState(null);

  const draftRarityBreakdown = useMemo(() => {
    const counts = new Map();
    draftItems.forEach((it) => {
      const rName = getRarityFromItem(it);
      counts.set(rName, (counts.get(rName) || 0) + 1);
    });
    return RARITIES.filter((r) => counts.has(r.name)).map((r) => ({
      name: r.name,
      color: r.color,
      count: counts.get(r.name),
    }));
  }, [draftItems]);

  const tableLootStats = useMemo(() => {
    let openChests = 0;
    let availableItems = 0;
    let totalOpenGold = 0;
    lootChests.forEach((c) => {
      if (c.status === 'open') {
        openChests += 1;
        totalOpenGold += Number(c.gold) || 0;
        const arr = Array.isArray(c.items) ? c.items : [];
        availableItems += arr.filter((i) => i.status === 'available').length;
      }
    });
    return { openChests, availableItems, totalOpenGold };
  }, [lootChests]);

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
      setLootSubTab('vault');
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
      description="Projete cartas e mapas em tela cheia, envie pistas secretas 1-para-1 e gere saques pós-combate com IA."
      maxWidth={studioTab === 'loot' ? 'max-w-5xl' : 'max-w-3xl'}
    >
      {/* ABAS PRINCIPAIS DO ESTÚDIO */}
      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[#0c101b] border border-white/12 mb-5">
        {[
          { id: 'handouts', label: 'Handouts', count: handouts.filter((h) => h.is_active).length, Icon: GiScrollUnfurled },
          { id: 'whispers', label: 'Sussurros', count: whispers.length, Icon: GiHoodedFigure },
          { id: 'loot', label: 'Baú de Loot IA', count: lootChests.filter((c) => c.status === 'open').length, Icon: GiOpenTreasureChest },
        ].map(({ id, label, count, Icon }) => {
          const active = studioTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => openStudio(id)}
              className={cn(
                'py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all',
                active
                  ? 'bg-white/15 text-white border border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
              )}
            >
              <Icon className="h-4 w-4 text-slate-300 shrink-0" />
              <span className="truncate">{label}</span>
              {count > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-white/10 text-[10px] font-mono text-slate-200">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ================= ABA 1: HANDOUTS ================= */}
      {studioTab === 'handouts' && (
        <div className="space-y-5">
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-white/[0.045] to-white/[0.02] border border-white/12 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-amber-500/12 border border-amber-400/30 flex items-center justify-center shrink-0">
                  <GiTreasureMap className="h-5 w-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
                    Novo Handout da Mesa
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Retratos, mapas do tesouro, cartas de NPC ou enigmas em tela cheia
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0c101b] border border-white/12">
                {[
                  { id: 'combined', label: 'Combinado', Icon: FileText },
                  { id: 'image', label: 'Imagem', Icon: ImageIcon },
                  { id: 'parchment', label: 'Pergaminho', Icon: GiQuillInk },
                ].map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setHStyle(id)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all',
                      hStyle === id ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
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

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-white/10">
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
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 px-0.5">
              Biblioteca de Handouts ({handouts.length})
            </h4>

            {handouts.length === 0 ? (
              <div className="py-7 text-center text-xs text-slate-400 rounded-2xl border border-dashed border-white/12 bg-white/[0.015]">
                Nenhum handout salvo. Suba um mapa do tesouro, retrato ou escreva uma carta acima.
              </div>
            ) : (
              <div className="space-y-2">
                {handouts.map((h) => (
                  <div
                    key={h.id}
                    className={cn(
                      'p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all',
                      h.is_active
                        ? 'bg-emerald-500/10 border-emerald-400/45 shadow-[0_0_24px_rgba(16,185,129,0.12)]'
                        : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {h.imageUrl ? (
                        <img
                          src={h.imageUrl}
                          alt={h.title}
                          className="h-12 w-12 rounded-xl object-cover border border-white/15 shrink-0 bg-black/50"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-400/25 flex items-center justify-center shrink-0">
                          <GiScrollUnfurled className="h-5 w-5 text-amber-300" />
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
                        className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 transition-colors"
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
            className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-violet-500/[0.06] via-white/[0.025] to-white/[0.015] border border-white/12 space-y-4"
          >
            <div className="flex items-center gap-2.5 pb-3 border-b border-white/10">
              <div className="h-9 w-9 rounded-xl bg-violet-500/15 border border-violet-400/35 flex items-center justify-center shrink-0">
                <GiHoodedFigure className="h-5 w-5 text-violet-300" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
                  Canal Secreto 1-para-1
                </h3>
                <p className="text-[11px] text-slate-400">
                  A mensagem chega instantaneamente apenas para o jogador escolhido — invisível para o resto do grupo
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block">
                Destinatário Exclusivo:
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
                            ? 'bg-white/18 border-white/40 text-white shadow-[0_0_16px_rgba(139,92,246,0.2)]'
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
                Tom da Pista:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {WHISPER_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setWCategory(cat.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5',
                      wCategory === cat.id
                        ? 'bg-white/16 border-white/35 text-white'
                        : 'bg-[#0c101b] border-white/12 text-slate-400 hover:text-white'
                    )}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: cat.color }}
                      aria-hidden="true"
                    />
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
                  className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/10 hover:bg-white/10 text-[10px] text-slate-300 hover:text-white truncate max-w-full transition-colors"
                >
                  &ldquo;{snippet.slice(0, 44)}...&rdquo;
                </button>
              ))}
            </div>

            <div className="flex justify-end pt-1">
              <Button type="submit" size="sm" loading={wSending} disabled={players.length === 0}>
                <Send className="h-3.5 w-3.5 text-slate-300" />
                Enviar Sussurro Privado
              </Button>
            </div>
          </form>

          {/* Histórico de Sussurros Enviados */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 px-0.5">
              Sussurros Enviados ({whispers.length})
            </h4>
            {whispers.length === 0 ? (
              <div className="py-7 text-center text-xs text-slate-400 rounded-2xl border border-dashed border-white/12 bg-white/[0.015]">
                Nenhum sussurro enviado ainda. Somente o jogador selecionado recebe a mensagem.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {whispers.map((w) => {
                  const catMeta = getWhisperCategoryMeta(w.category);
                  return (
                    <div
                      key={w.id}
                      className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-1.5">
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
        <div className="space-y-4">
          {/* Sub-barra de Navegação do Cofre + Indicadores Ao Vivo */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-2xl bg-[#0c101b]/95 border border-white/12">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setLootSubTab('forge')}
                className={cn(
                  'px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border',
                  lootSubTab === 'forge'
                    ? 'bg-white/15 border-white/25 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]'
                    : 'bg-transparent border-transparent text-slate-400 hover:text-white hover:bg-white/[0.06]'
                )}
              >
                <GiOpenTreasureChest className="h-4 w-4 text-slate-300" />
                <span>Forjar Novo Baú</span>
                {draftItems.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-white/15 text-[10px] font-mono text-white">
                    {draftItems.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setLootSubTab('vault')}
                className={cn(
                  'px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border',
                  lootSubTab === 'vault'
                    ? 'bg-white/15 border-white/25 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]'
                    : 'bg-transparent border-transparent text-slate-400 hover:text-white hover:bg-white/[0.06]'
                )}
              >
                <GiLockedChest className="h-4 w-4 text-slate-300" />
                <span>Baús na Mesa</span>
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded-full text-[10px] font-mono',
                    tableLootStats.openChests > 0
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/35'
                      : 'bg-white/10 text-slate-300'
                  )}
                >
                  {lootChests.length}
                </span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 px-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.04] border border-white/10 text-[11px] font-mono text-slate-300">
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    tableLootStats.openChests > 0 ? 'bg-emerald-400' : 'bg-slate-500'
                  )}
                />
                <span>{tableLootStats.openChests} aberto(s)</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.04] border border-white/10 text-[11px] font-mono text-slate-300">
                <GiBackpack className="h-3.5 w-3.5 text-slate-400" />
                <span>{tableLootStats.availableItems} livre(s)</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-400/25 text-[11px] font-mono font-bold text-amber-200">
                <GiCoins className="h-3.5 w-3.5 text-amber-300" />
                <span>{formatNumber(tableLootStats.totalOpenGold)}G</span>
              </div>
            </div>
          </div>

          {/* ================= SUB-ABA 1: FORJAR NOVO BAÚ (2 COLUNAS) ================= */}
          {lootSubTab === 'forge' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* COLUNA ESQUERDA: FORJA DE SAQUE IA */}
              <div className="lg:col-span-5 rounded-2xl bg-gradient-to-b from-amber-500/[0.06] via-[#0c101b]/95 to-[#090c14] border border-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] p-4 space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-400/35 shadow-[0_0_20px_rgba(245,158,11,0.16)] flex items-center justify-center shrink-0">
                    <GiOpenTreasureChest className="h-5 w-5 text-amber-300" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
                      Forja de Saque IA
                    </h3>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Escolha o ambiente, raridade e quantidade para gerar tesouros e bugigangas
                    </p>
                  </div>
                </div>

                {/* Presets de Ambiente em Grade Visual 2x3 */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Ambiente / Origem do Saque
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {LOOT_THEME_PRESETS.map(({ id, label, tag, Icon }) => {
                      const active = lTheme === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setLTheme(id)}
                          className={cn(
                            'group p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5',
                            active
                              ? 'bg-white/14 border-white/35 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]'
                              : 'bg-[#0c101b] border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20 hover:text-white'
                          )}
                        >
                          <span
                            className={cn(
                              'h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 transition-colors',
                              active
                                ? 'bg-amber-500/18 border-amber-400/40 text-amber-200'
                                : 'bg-white/[0.04] border-white/10 text-slate-300 group-hover:text-white'
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="text-[11px] font-bold block leading-tight truncate">
                              {label}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate">
                              {tag}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tema Personalizado */}
                <FormField label="Tema ou Local Personalizado">
                  <Input
                    placeholder="Ex: Tumba do Lich, Navio Pirata, Torre do Mago..."
                    value={lTheme}
                    onChange={(e) => setLTheme(e.target.value)}
                    className="h-9 text-xs"
                  />
                </FormField>

                {/* Seletor Visual de Nível de Raridade (4 Cartões) */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Curva de Raridade
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {LOOT_RARITY_TIERS.map((tier) => {
                      const active = lTier === tier.id;
                      return (
                        <button
                          key={tier.id}
                          type="button"
                          onClick={() => setLTier(tier.id)}
                          className={cn(
                            'px-2.5 py-2 rounded-xl border text-left transition-all space-y-1',
                            active
                              ? 'bg-white/14 border-white/35 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                              : 'bg-[#0c101b] border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                          )}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[11px] font-bold text-white truncate">
                              {tier.label}
                            </span>
                            <span className="flex items-center gap-0.5 shrink-0">
                              {tier.dots.map((dotColor, i) => (
                                <span
                                  key={i}
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{ backgroundColor: dotColor }}
                                />
                              ))}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 block truncate">
                            {tier.sub}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Controle Tátil de Quantidade */}
                <div className="p-3 rounded-xl bg-[#0c101b] border border-white/12 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-bold text-white block">
                      Quantidade de Itens
                    </span>
                    <span className="text-[10px] text-slate-400">Entre 2 e 12 itens por baú</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setLCount((c) => Math.max(2, c - 1))}
                      disabled={lCount <= 2}
                      aria-label="Diminuir quantidade"
                      className="h-8 w-8 rounded-lg bg-white/8 border border-white/15 hover:bg-white/15 disabled:opacity-35 flex items-center justify-center text-white transition-colors"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-10 text-center text-sm font-mono font-extrabold text-white tabular-nums">
                      {lCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLCount((c) => Math.min(12, c + 1))}
                      disabled={lCount >= 12}
                      aria-label="Aumentar quantidade"
                      className="h-8 w-8 rounded-lg bg-white/8 border border-white/15 hover:bg-white/15 disabled:opacity-35 flex items-center justify-center text-white transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Toggle Estilizado de Bugigangas & Materiais */}
                <button
                  type="button"
                  onClick={() => setLIncludeJunk((v) => !v)}
                  className={cn(
                    'w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-3',
                    lIncludeJunk
                      ? 'bg-white/10 border-white/25 text-white'
                      : 'bg-[#0c101b] border-white/10 text-slate-400 hover:bg-white/[0.06]'
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={cn(
                        'h-8 w-8 rounded-lg border flex items-center justify-center shrink-0',
                        lIncludeJunk
                          ? 'bg-amber-500/15 border-amber-400/35 text-amber-200'
                          : 'bg-white/[0.04] border-white/10 text-slate-400'
                      )}
                    >
                      <GiStonePile className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <span className="text-[11px] font-bold text-white block">
                        Bugigangas &amp; Materiais
                      </span>
                      <span className="text-[10px] text-slate-400 block truncate">
                        Teia de aranha, graveto, pedra, ossos...
                      </span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 flex items-center',
                      lIncludeJunk ? 'bg-emerald-500/80 justify-end' : 'bg-white/15 justify-start'
                    )}
                  >
                    <span className="h-4 w-4 rounded-full bg-white shadow-sm" />
                  </span>
                </button>

                {/* Botão Principal de Geração IA */}
                <Button
                  type="button"
                  size="md"
                  loading={lGenerating}
                  onClick={handleGenerateLoot}
                  className="w-full h-10 text-xs font-extrabold tracking-wide"
                >
                  {lGenerating ? (
                    <RefreshCw className="h-4 w-4 text-slate-200 animate-spin" />
                  ) : (
                    <Dices className="h-4 w-4 text-slate-200" />
                  )}
                  {draftItems.length > 0 ? 'Sortear Novo Saque com IA' : 'Gerar Baú com IA'}
                </Button>
              </div>

              {/* COLUNA DIREITA: COFRE DO BAÚ (PRÉVIA VISUAL & LANÇAMENTO) */}
              <div className="lg:col-span-7 rounded-2xl bg-gradient-to-b from-amber-500/[0.06] via-[#0b0e18] to-[#080b12] border border-white/15 shadow-[0_18px_48px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)] overflow-hidden flex flex-col">
                {/* Cabeçalho do Cofre: Nome do Baú + Ouro */}
                <div className="p-4 border-b border-white/10 bg-white/[0.02] space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                    <div className="sm:col-span-7">
                      <FormField label="Título do Baú">
                        <Input
                          value={draftTitle}
                          onChange={(e) => setDraftTitle(e.target.value)}
                          placeholder="Ex: Baú do Chefe Goblin"
                          className="h-9 text-xs font-semibold"
                        />
                      </FormField>
                    </div>
                    <div className="sm:col-span-5">
                      <FormField label="Ouro no Baú (G)">
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1">
                            <Input
                              type="number"
                              min={0}
                              value={draftGold}
                              onChange={(e) => setDraftGold(Math.max(0, Number(e.target.value) || 0))}
                              icon={GiCoins}
                              className="h-9 text-xs font-mono font-bold text-amber-200"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setDraftGold((g) => (Number(g) || 0) + 50)}
                            title="Adicionar +50G"
                            className="h-9 px-2 rounded-xl bg-white/8 border border-white/15 hover:bg-white/15 text-[10px] font-mono font-bold text-amber-200 shrink-0 transition-colors"
                          >
                            +50
                          </button>
                          <button
                            type="button"
                            onClick={() => setDraftGold((g) => (Number(g) || 0) + 200)}
                            title="Adicionar +200G"
                            className="h-9 px-2 rounded-xl bg-white/8 border border-white/15 hover:bg-white/15 text-[10px] font-mono font-bold text-amber-200 shrink-0 transition-colors"
                          >
                            +200
                          </button>
                        </div>
                      </FormField>
                    </div>
                  </div>

                  {/* Barra de Resumo de Raridades + Botão Item Manual */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                        <GiCoinsPile className="h-3.5 w-3.5 text-amber-300" />
                        <span>{draftItems.length} item(ns)</span>
                      </span>
                      {draftRarityBreakdown.map((entry) => (
                        <span
                          key={entry.name}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#0c101b] border text-[10px] font-semibold text-slate-200"
                          style={{ borderColor: `${entry.color}66` }}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span>
                            {entry.count} {entry.name.charAt(0) + entry.name.slice(1).toLowerCase()}
                          </span>
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {draftItems.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setDraftItems([])}
                          className="px-2 py-1 rounded-lg bg-white/[0.04] border border-white/10 hover:bg-rose-500/15 hover:border-rose-400/35 hover:text-rose-200 text-[10px] font-semibold text-slate-400 transition-colors"
                        >
                          Limpar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowManualItem((v) => !v)}
                        className={cn(
                          'inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-bold transition-colors',
                          showManualItem
                            ? 'bg-white/16 border-white/30 text-white'
                            : 'bg-white/8 border-white/15 hover:bg-white/15 text-slate-200'
                        )}
                      >
                        {showManualItem ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                        {showManualItem ? 'Fechar Manual' : 'Item Manual'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Gaveta Colapsável: Adicionar Item Manual */}
                {showManualItem && (
                  <form
                    onSubmit={handleAddManualDraftItem}
                    className="mx-4 mt-3.5 p-3.5 rounded-xl bg-[#0c101b] border border-white/15 space-y-2.5 shadow-inner"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-200">
                        Forjar Item Personalizado
                      </span>
                      <span className="text-[10px] text-slate-400">Adiciona direto na prévia abaixo</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-6">
                        <Input
                          placeholder="Nome (ex: Teia de Aranha, Adaga Rúnica...)"
                          value={mName}
                          onChange={(e) => setMName(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="sm:col-span-3">
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
                      </div>
                      <div className="sm:col-span-3">
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
                        placeholder="Descrição curta, efeito ou detalhe narrativo..."
                        value={mDesc}
                        onChange={(e) => setMDesc(e.target.value)}
                        className="flex-1 h-8 text-xs"
                      />
                      <Button type="submit" size="sm" className="h-8 text-xs shrink-0">
                        <Plus className="h-3.5 w-3.5" />
                        Incluir
                      </Button>
                    </div>
                  </form>
                )}

                {/* Grade Visual dos Itens do Rascunho */}
                <div className="p-4 flex-1">
                  {draftItems.length === 0 ? (
                    <div className="min-h-[220px] rounded-2xl border border-dashed border-white/15 bg-[#090c14]/75 flex flex-col items-center justify-center text-center p-6 gap-3">
                      <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-400/25 flex items-center justify-center shadow-[0_0_28px_rgba(245,158,11,0.12)]">
                        <GiLockedChest className="h-7 w-7 text-amber-300/85" />
                      </div>
                      <div className="max-w-xs space-y-1">
                        <p className="text-xs font-bold text-slate-200">
                          O cofre ainda está vazio
                        </p>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Clique em <strong className="text-slate-200">Gerar Baú com IA</strong> para sortear tesouros e bugigangas temáticas ou adicione itens manualmente.
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        loading={lGenerating}
                        onClick={handleGenerateLoot}
                        className="h-8 text-xs"
                      >
                        <Dices className="h-3.5 w-3.5 text-slate-300" />
                        Sortear Agora
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[340px] overflow-y-auto pr-1">
                      {draftItems.map((it) => {
                        const rName = getRarityFromItem(it);
                        const rarityMeta = getRarityMeta(rName);
                        const TypeIcon = getLootTypeIcon(it.type);
                        return (
                          <div
                            key={it.id}
                            className="group relative p-3 rounded-xl border transition-all flex items-start justify-between gap-2.5 overflow-hidden"
                            style={{
                              borderColor: `${rarityMeta.color}88`,
                              background: `linear-gradient(135deg, ${rarityMeta.color}15 0%, rgba(12,16,27,0.92) 55%)`,
                              boxShadow: `0 0 18px ${rarityMeta.color}18, inset 0 1px 0 rgba(255,255,255,0.06)`,
                            }}
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div
                                className="h-9 w-9 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 bg-[#0a0d16]/85"
                                style={{ borderColor: `${rarityMeta.color}55` }}
                              >
                                <TypeIcon
                                  className="h-[18px] w-[18px]"
                                  style={{ color: rarityMeta.color }}
                                />
                              </div>
                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="px-1.5 py-0.5 rounded-md bg-white/[0.07] border border-white/12 text-[9px] font-bold uppercase tracking-wider text-slate-200">
                                    {getItemTypeLabel(it.type)}
                                  </span>
                                  <span
                                    className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider"
                                    style={{ color: rarityMeta.color }}
                                  >
                                    <span
                                      className="h-1.5 w-1.5 rounded-full"
                                      style={{ backgroundColor: rarityMeta.color }}
                                    />
                                    {rName}
                                  </span>
                                  {Number(it.qty) > 1 && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-white/12 text-[10px] font-mono font-bold text-white">
                                      x{it.qty}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs font-extrabold text-white leading-snug truncate">
                                  {it.name}
                                </p>
                                <p className="text-[11px] text-slate-400 line-clamp-2 leading-snug">
                                  {cleanDescription(it.description)}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                setDraftItems((prev) => prev.filter((x) => x.id !== it.id))
                              }
                              title="Remover item do rascunho"
                              className="h-6 w-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-300 hover:bg-rose-500/20 shrink-0 transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Rodapé de Visibilidade & Lançamento */}
                <div className="p-4 border-t border-white/10 bg-[#090c14]/90 space-y-3.5">
                  <VisibilitySelector
                    players={players}
                    value={draftVisibleTo}
                    onChange={setDraftVisibleTo}
                    label="Quem pode ver este baú aberto:"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setDraftPlaySound((v) => !v)}
                      className={cn(
                        'inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] font-semibold transition-all',
                        draftPlaySound
                          ? 'bg-white/10 border-white/25 text-white'
                          : 'bg-[#0c101b] border-white/10 text-slate-400 hover:text-white'
                      )}
                    >
                      {draftPlaySound ? (
                        <Volume2 className="h-3.5 w-3.5 text-emerald-300" />
                      ) : (
                        <VolumeX className="h-3.5 w-3.5 text-slate-500" />
                      )}
                      <span>{draftPlaySound ? 'Som de Baú Ativado' : 'Abrir em Silêncio'}</span>
                    </button>

                    <Button
                      type="button"
                      size="md"
                      loading={creatingChest}
                      onClick={handleOpenDraftChest}
                      disabled={draftItems.length === 0 && Number(draftGold) <= 0}
                      className="h-10 px-4 text-xs font-extrabold"
                    >
                      <GiOpenTreasureChest className="h-4 w-4 text-amber-300" />
                      Abrir Baú para os Selecionados
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= SUB-ABA 2: BAÚS NA MESA (MONITOR AO VIVO) ================= */}
          {lootSubTab === 'vault' && (
            <div className="space-y-4">
              {lootChests.length === 0 ? (
                <div className="py-12 px-6 text-center rounded-2xl border border-dashed border-white/15 bg-[#0b0e18]/80 flex flex-col items-center gap-3">
                  <div className="h-14 w-14 rounded-2xl bg-white/[0.04] border border-white/12 flex items-center justify-center">
                    <GiLockedChest className="h-7 w-7 text-slate-400" />
                  </div>
                  <div className="space-y-1 max-w-sm">
                    <h4 className="text-sm font-bold text-white">Nenhum baú aberto na mesa</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Forje um saque pós-combate com IA ou monte um baú personalizado para os jogadores escolherem o que guardar na mochila ou descartar.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setLootSubTab('forge')}
                    className="mt-1"
                  >
                    <GiOpenTreasureChest className="h-4 w-4 text-amber-300" />
                    Ir para a Forja de Baús
                  </Button>
                </div>
              ) : (
                <>
                  {/* Cabeçalho de Ação Rápida do Monitor */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-slate-400">
                      Acompanhe em tempo real o que cada aventureiro guarda na mochila ou joga fora, e ajuste quem pode enxergar cada baú.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setLootSubTab('forge')}
                      className="h-8 text-xs shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5 text-slate-300" />
                      Forjar Novo Baú
                    </Button>
                  </div>

                  {/* Lista de Cartões de Cofre */}
                  <div className="space-y-3.5">
                    {lootChests.map((chest) => {
                      const items = Array.isArray(chest.items) ? chest.items : [];
                      const availCount = items.filter((i) => i.status === 'available').length;
                      const claimedCount = items.filter((i) => i.status === 'claimed').length;
                      const discardedCount = items.filter((i) => i.status === 'discarded').length;
                      const resolvedCount = claimedCount + discardedCount;
                      const totalCount = items.length;
                      const claimedPct = totalCount > 0 ? Math.round((claimedCount / totalCount) * 100) : 0;
                      const discardedPct = totalCount > 0 ? Math.round((discardedCount / totalCount) * 100) : 0;
                      const logs = Array.isArray(chest.logs) ? chest.logs : [];
                      const isOpen = chest.status === 'open';
                      const accessOpen = expandedAccessChestId === chest.id;
                      const ChestIcon = isOpen ? GiOpenTreasureChest : GiLockedChest;

                      return (
                        <div
                          key={chest.id}
                          className={cn(
                            'rounded-2xl border overflow-hidden transition-all',
                            isOpen
                              ? 'bg-gradient-to-b from-amber-500/[0.06] via-[#0c101b]/95 to-[#090c14] border-amber-400/35 shadow-[0_14px_38px_rgba(0,0,0,0.45),0_0_24px_rgba(245,158,11,0.08)]'
                              : 'bg-[#0b0e17]/80 border-white/10 opacity-85'
                          )}
                        >
                          {/* Faixa Superior de Destaque */}
                          <div
                            className={cn(
                              'h-1 w-full',
                              isOpen
                                ? 'bg-gradient-to-r from-amber-400/80 via-amber-300/40 to-transparent'
                                : 'bg-white/10'
                            )}
                          />

                          <div className="p-4 space-y-3.5">
                            {/* Cabeçalho do Baú */}
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex items-start gap-3 min-w-0">
                                <div
                                  className={cn(
                                    'h-11 w-11 rounded-xl border flex items-center justify-center shrink-0',
                                    isOpen
                                      ? 'bg-amber-500/15 border-amber-400/40 text-amber-300 shadow-[0_0_18px_rgba(245,158,11,0.18)]'
                                      : 'bg-white/[0.04] border-white/12 text-slate-400'
                                  )}
                                >
                                  <ChestIcon className="h-[22px] w-[22px]" />
                                </div>
                                <div className="min-w-0 space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-sm font-extrabold text-white tracking-tight">
                                      {chest.title}
                                    </h4>
                                    <Badge
                                      className={cn(
                                        'text-[10px]',
                                        isOpen
                                          ? 'bg-emerald-500/18 text-emerald-300 border-emerald-400/40'
                                          : 'bg-slate-500/18 text-slate-300 border-slate-400/30'
                                      )}
                                    >
                                      {isOpen ? 'Aberto na Mesa' : 'Fechado'}
                                    </Badge>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/12 border border-amber-400/30 text-xs font-mono font-bold text-amber-200">
                                      <GiCoins className="h-3.5 w-3.5 text-amber-300" />
                                      {formatNumber(chest.gold || 0)}G
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-400">
                                    <span className="inline-flex items-center gap-1">
                                      <Eye className="h-3 w-3 text-slate-400" />
                                      <span>Visível para:</span>
                                      <strong className="text-slate-200 font-semibold">
                                        {formatVisibilityNames(chest.visible_to)}
                                      </strong>
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Ações do Mestre */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedAccessChestId((cur) =>
                                      cur === chest.id ? null : chest.id
                                    )
                                  }
                                  className={cn(
                                    'h-8 px-2.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-all',
                                    accessOpen
                                      ? 'bg-white/16 border-white/30 text-white'
                                      : 'bg-white/[0.06] border-white/12 text-slate-300 hover:bg-white/12 hover:text-white'
                                  )}
                                >
                                  <GiKey className="h-3.5 w-3.5 text-slate-300" />
                                  <span>Acesso</span>
                                  {accessOpen ? (
                                    <ChevronUp className="h-3 w-3 text-slate-300" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3 text-slate-300" />
                                  )}
                                </button>

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
                                  className="h-8 w-8 rounded-xl border border-white/10 bg-white/[0.04] flex items-center justify-center text-slate-400 hover:text-rose-300 hover:bg-rose-500/18 hover:border-rose-400/35 transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Barra de Progresso do Saque */}
                            {totalCount > 0 && (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[10px] font-mono">
                                  <span className="text-slate-400">
                                    Progresso do saque: <strong className="text-slate-200">{resolvedCount}/{totalCount}</strong> resolvidos
                                  </span>
                                  <div className="flex items-center gap-3">
                                    <span className="text-slate-300">{availCount} livre(s)</span>
                                    <span className="text-emerald-300">{claimedCount} mochila</span>
                                    {discardedCount > 0 && (
                                      <span className="text-slate-500">{discardedCount} descartado(s)</span>
                                    )}
                                  </div>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden flex">
                                  {claimedPct > 0 && (
                                    <div
                                      className="h-full bg-emerald-400/85 transition-all duration-300"
                                      style={{ width: `${claimedPct}%` }}
                                    />
                                  )}
                                  {discardedPct > 0 && (
                                    <div
                                      className="h-full bg-slate-500/75 transition-all duration-300"
                                      style={{ width: `${discardedPct}%` }}
                                    />
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Editor de Acesso ao Vivo (Colapsável) */}
                            {accessOpen && (
                              <div className="p-3 rounded-xl bg-[#090c14] border border-white/12">
                                <VisibilitySelector
                                  players={players}
                                  value={Array.isArray(chest.visible_to) ? chest.visible_to : ['all']}
                                  onChange={(nextVis) =>
                                    updateChest(chest.id, { visible_to: nextVis })
                                  }
                                  label="Alterar acesso ao vivo (sincronização instantânea):"
                                />
                              </div>
                            )}

                            {/* Grade Estruturada de Itens (2 colunas) */}
                            {items.length > 0 && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {items.map((it) => {
                                  const rName = getRarityFromItem(it);
                                  const rMeta = getRarityMeta(rName);
                                  const TypeIcon = getLootTypeIcon(it.type);
                                  const isAvailable = it.status === 'available';
                                  const isClaimed = it.status === 'claimed';

                                  return (
                                    <div
                                      key={it.id}
                                      className={cn(
                                        'px-3 py-2 rounded-xl border flex items-center justify-between gap-2 transition-colors',
                                        isAvailable
                                          ? 'bg-[#0b0f1a]'
                                          : isClaimed
                                          ? 'bg-emerald-500/[0.07] border-emerald-500/25'
                                          : 'bg-white/[0.02] border-white/8 opacity-65'
                                      )}
                                      style={
                                        isAvailable
                                          ? {
                                              borderColor: `${rMeta.color}70`,
                                              boxShadow: `inset 3px 0 0 ${rMeta.color}`,
                                            }
                                          : undefined
                                      }
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <TypeIcon
                                          className="h-4 w-4 shrink-0"
                                          style={{
                                            color: isAvailable
                                              ? rMeta.color
                                              : isClaimed
                                              ? '#6ee7b7'
                                              : '#64748b',
                                          }}
                                        />
                                        <div className="min-w-0">
                                          <p
                                            className={cn(
                                              'text-xs font-bold truncate',
                                              isAvailable
                                                ? 'text-white'
                                                : isClaimed
                                                ? 'text-emerald-100'
                                                : 'text-slate-400 line-through'
                                            )}
                                          >
                                            {Number(it.qty) > 1 ? `${it.qty}x ` : ''}
                                            {it.name}
                                          </p>
                                          <p className="text-[10px] text-slate-400 truncate">
                                            {getItemTypeLabel(it.type)} • {rName.charAt(0) + rName.slice(1).toLowerCase()}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="shrink-0">
                                        {isAvailable && (
                                          <span className="px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/12 text-[10px] font-semibold text-slate-200">
                                            Livre
                                          </span>
                                        )}
                                        {isClaimed && (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/18 border border-emerald-400/35 text-[10px] font-bold text-emerald-200 max-w-[125px] truncate">
                                            <GiBackpack className="h-3 w-3 shrink-0" />
                                            <span className="truncate">{it.claimedByName}</span>
                                          </span>
                                        )}
                                        {!isAvailable && !isClaimed && (
                                          <span className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/10 text-[10px] font-medium text-slate-400">
                                            Descartado
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Registro de Atividade (Timeline) */}
                            {logs.length > 0 && (
                              <div className="rounded-xl bg-[#090c14]/90 border border-white/10 p-3 space-y-1.5">
                                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  <Clock className="h-3 w-3" />
                                  <span>Registro do Saque</span>
                                </div>
                                <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                                  {logs.slice(0, 8).map((log, i) => (
                                    <p
                                      key={i}
                                      className="text-[11px] text-slate-300 font-mono leading-snug flex items-start gap-1.5"
                                    >
                                      <span className="text-amber-400/70 select-none">›</span>
                                      <span>{log.text}</span>
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
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
      className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-xl flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={dismissActiveHandout}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[92dvh] rounded-2xl border border-white/18 bg-[#090c14]/98 shadow-[0_32px_96px_rgba(0,0,0,0.96),inset_0_1px_0_rgba(255,255,255,0.1)] flex flex-col overflow-hidden"
      >
        <div className="px-4 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between gap-3 shrink-0 bg-gradient-to-r from-amber-500/[0.08] via-white/[0.02] to-transparent">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-400/35 flex items-center justify-center shrink-0">
              <GiScrollUnfurled className="h-5 w-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold text-white truncate">
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

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
          <div
            className={cn(
              'grid gap-5 items-start',
              hasImage && hasText ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
            )}
          >
            {hasImage && (
              <div className="relative rounded-2xl border border-white/12 bg-black/65 p-2.5 flex items-center justify-center overflow-hidden group">
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
                  className="absolute bottom-3.5 right-3.5 h-8 px-2.5 rounded-lg bg-black/85 border border-white/20 text-[11px] font-semibold text-white flex items-center gap-1 opacity-85 hover:opacity-100"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  {zoomed ? 'Ajustar' : 'Ampliar'}
                </button>
              </div>
            )}

            {hasText && (
              <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-[#1a150e] via-[#13100c] to-[#0e0c0a] p-5 sm:p-7 shadow-[inset_0_1px_0_rgba(251,191,36,0.14)] space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] text-amber-300/85 border-b border-amber-500/20 pb-2.5">
                  <GiQuillInk className="h-4 w-4 shrink-0" />
                  Documento Revelado pelo Mestre
                </div>
                <p className="text-sm sm:text-base text-amber-50/95 leading-relaxed whitespace-pre-wrap font-serif">
                  {activeHandout.content}
                </p>
              </div>
            )}
          </div>
        </div>

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
      {popupWhisper && (
        <div className="fixed bottom-20 md:bottom-5 right-3 sm:right-5 z-[55] w-[min(380px,calc(100vw-1.5rem))] rounded-2xl border border-violet-400/50 bg-[#0b0c17]/97 backdrop-blur-2xl shadow-[0_28px_72px_rgba(0,0,0,0.92),0_0_32px_rgba(139,92,246,0.18)] p-4 space-y-3 animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-violet-500/20 border border-violet-400/45 flex items-center justify-center shrink-0">
                <GiHoodedFigure className="h-5 w-5 text-violet-300" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-violet-200">
                  Sussurro Privado do Mestre
                </div>
                <div className="text-[10px] text-slate-400">
                  Apenas você consegue ver esta pista
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

          <p className="text-sm text-white leading-relaxed whitespace-pre-wrap bg-white/[0.04] border border-white/10 rounded-xl p-3.5">
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

      <Modal
        open={playerWhisperModalOpen}
        onOpenChange={setPlayerWhisperModalOpen}
        title="Sussurros Privados do Mestre"
        description="Pistas e observações secretas enviadas exclusivamente para o seu personagem."
        maxWidth="max-w-lg"
      >
        {whispers.length === 0 ? (
          <div className="py-10 text-center space-y-2.5">
            <div className="h-12 w-12 rounded-2xl bg-violet-500/10 border border-violet-400/25 flex items-center justify-center mx-auto">
              <GiHoodedFigure className="h-6 w-6 text-violet-300" />
            </div>
            <p className="text-sm font-semibold text-slate-200">Nenhum sussurro recebido</p>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
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
                  className="p-4 rounded-2xl bg-white/[0.04] border border-white/12 space-y-2"
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
  const bagRatio = Math.min(100, Math.round((bagUsed / Math.max(1, bagSlots)) * 100));

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
      {newChestBanner && !playerLootModalOpen && (
        <div className="fixed bottom-20 md:bottom-5 left-3 sm:left-5 z-[55] max-w-[min(370px,calc(100vw-1.5rem))] rounded-2xl border border-amber-400/55 bg-[#0c1018]/97 backdrop-blur-2xl shadow-[0_24px_64px_rgba(0,0,0,0.92),0_0_28px_rgba(245,158,11,0.2)] p-3.5 flex items-center gap-3 animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-400/45 flex items-center justify-center shrink-0">
            <GiOpenTreasureChest className="h-5 w-5 text-amber-300" />
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

      <Modal
        open={playerLootModalOpen}
        onOpenChange={setPlayerLootModalOpen}
        title={
          <span className="flex items-center gap-2.5">
            <span className="h-8 w-8 rounded-xl bg-amber-500/15 border border-amber-400/35 flex items-center justify-center shrink-0">
              <GiOpenTreasureChest className="h-5 w-5 text-amber-300" />
            </span>
            <span className="truncate">{activeChest?.title || 'Baú de Loot'}</span>
          </span>
        }
        description="Escolha o que deseja guardar na mochila ou jogue fora o que não precisa. Sincronizado ao vivo com o grupo."
        maxWidth="max-w-3xl"
      >
        {!activeChest ? (
          <div className="py-10 text-center space-y-2.5">
            <GiLockedChest className="h-10 w-10 text-slate-500 mx-auto" />
            <p className="text-sm font-semibold text-slate-200">Nenhum baú aberto no momento</p>
            <p className="text-xs text-slate-400">
              Quando o Mestre liberar um baú de saque para você, ele aparecerá aqui automaticamente.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
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

            {/* Painel de Ouro & Capacidade da Mochila */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/[0.08] via-[#0c101b] to-[#0c101b] border border-white/12 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-400/40">
                    <GiCoinsPile className="h-4 w-4 text-amber-300 shrink-0" />
                    <span className="text-base font-mono font-black text-amber-200 tabular-nums">
                      {formatNumber(activeChest.gold || 0)}G
                    </span>
                  </div>

                  <div className="space-y-1 min-w-[140px]">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-300">
                      <span className="flex items-center gap-1">
                        <GiBackpack className="h-3.5 w-3.5 text-slate-400" />
                        Mochila
                      </span>
                      <span className={cn('font-bold', bagUsed >= bagSlots ? 'text-rose-400' : 'text-white')}>
                        {bagUsed}/{bagSlots}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-black/60 border border-white/10 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-300',
                          bagRatio >= 100
                            ? 'bg-rose-500'
                            : bagRatio >= 80
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                        )}
                        style={{ width: `${bagRatio}%` }}
                      />
                    </div>
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
                      className="w-20 h-8 text-xs font-mono"
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
                    {Number(activeChest.gold) >= 2 && (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={busyKey === 'gold'}
                        onClick={() => handleTakeGold(Math.floor(Number(activeChest.gold) / 2))}
                        title="Pegar metade do ouro para dividir"
                        className="h-8 text-xs"
                      >
                        Metade ({Math.floor(Number(activeChest.gold) / 2)}G)
                      </Button>
                    )}
                    <Button
                      size="sm"
                      loading={busyKey === 'gold'}
                      onClick={() => handleTakeGold(null)}
                      className="h-8 text-xs"
                    >
                      <GiCoins className="h-3.5 w-3.5 text-amber-300" />
                      Pegar Tudo
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {availableItems.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
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

                {selectedIds.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      loading={busyKey === 'claim-batch'}
                      onClick={() => handleClaim(selectedIds)}
                      className="h-8 text-xs"
                    >
                      <GiBackpack className="h-3.5 w-3.5 text-slate-200" />
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

            {items.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 rounded-xl border border-dashed border-white/12">
                Este baú contém apenas moedas de ouro.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {items.map((it) => {
                  const rarityName = getRarityFromItem(it);
                  const rarityMeta = getRarityMeta(rarityName);
                  const TypeIcon = getLootTypeIcon(it.type);
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
                        boxShadow: isAvailable ? `0 0 18px ${rarityMeta.color}24` : undefined,
                      }}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge className="bg-white/8 text-slate-200 border-white/15 text-[10px]">
                              <TypeIcon className="h-3 w-3 text-slate-300" />
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
                            <GiBackpack className="h-3.5 w-3.5 text-slate-200" />
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
