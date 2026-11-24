'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  Disc3,
  GripVertical,
  Headphones,
  HeartPulse,
  Link2,
  ListMusic,
  Minus,
  Music,
  Pause,
  Pencil,
  Play,
  Plus,
  Radio,
  Repeat,
  Repeat1,
  RotateCcw,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Upload,
  Volume1,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import {
  GiArrowFlights,
  GiCampfire,
  GiCoinsPile,
  GiCrossedSwords,
  GiCrown,
  GiDragonHead,
  GiDungeonGate,
  GiExplosionRays,
  GiLightningStorm,
  GiMagicSwirl,
  GiMusicalNotes,
  GiOpenTreasureChest,
  GiRingingBell,
  GiSpeaker,
  GiWolfHowl,
  GiWoodenDoor,
} from 'react-icons/gi';
import { toast } from 'sonner';
import {
  MUSIC_CATEGORIES,
  extractYouTubeVideoId,
  fetchYouTubeTitle,
  formatAudioTime,
} from '../../lib/rpg-music-synth';
import { SOUNDBOARD_EFFECTS } from '../../lib/rpg-soundboard';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { FormField, Input, Select } from '../ui/Input';
import { useTabletopMusic } from './TabletopMusicProvider';

const SOUNDBOARD_ICON_MAP = {
  thunder: GiLightningStorm,
  door: GiWoodenDoor,
  sword: GiCrossedSwords,
  roar: GiDragonHead,
  coins: GiCoinsPile,
  bell: GiRingingBell,
  magic: GiMagicSwirl,
  arrow: GiArrowFlights,
  explosion: GiExplosionRays,
  heartbeat: HeartPulse,
  wolf: GiWolfHowl,
  chest: GiOpenTreasureChest,
};

// Ícone RPG temático por categoria musical (zero ícones de estrela)
function getCategoryVisual(categoryId) {
  switch (categoryId) {
    case 'tavern':
      return { Icon: GiCampfire, label: 'Taverna', color: '#f59e0b' };
    case 'exploration':
      return { Icon: Compass, label: 'Exploração', color: '#10b981' };
    case 'dungeon':
      return { Icon: GiDungeonGate, label: 'Masmorra', color: '#94a3b8' };
    case 'combat':
      return { Icon: GiCrossedSwords, label: 'Combate', color: '#ef4444' };
    case 'boss':
      return { Icon: GiDragonHead, label: 'Chefe Final', color: '#f43f5e' };
    case 'mystery':
      return { Icon: GiMagicSwirl, label: 'Mistério', color: '#38bdf8' };
    case 'epic':
      return { Icon: GiCrown, label: 'Épico', color: '#a855f7' };
    default:
      return { Icon: GiMusicalNotes, label: 'Trilha', color: '#cbd5e1' };
  }
}

function getSourceBadgeLabel(sourceType) {
  if (sourceType === 'youtube') return 'YouTube';
  if (sourceType === 'url') return 'Áudio Web';
  if (sourceType === 'upload') return 'Arquivo';
  return 'Trilha Vallen';
}

function EqualizerBars({ active = false, className = '' }) {
  return (
    <span aria-hidden="true" className={cn('inline-flex items-end gap-[2px] h-3.5', className)}>
      <span
        className={cn(
          'w-[2.5px] rounded-full bg-emerald-400 transition-all',
          active ? 'h-full music-eq-bar' : 'h-1 bg-slate-500'
        )}
        style={active ? { animationDelay: '0ms', animationDuration: '0.78s' } : undefined}
      />
      <span
        className={cn(
          'w-[2.5px] rounded-full bg-emerald-400 transition-all',
          active ? 'h-full music-eq-bar' : 'h-1.5 bg-slate-500'
        )}
        style={active ? { animationDelay: '180ms', animationDuration: '0.62s' } : undefined}
      />
      <span
        className={cn(
          'w-[2.5px] rounded-full bg-emerald-400 transition-all',
          active ? 'h-full music-eq-bar' : 'h-1 bg-slate-500'
        )}
        style={active ? { animationDelay: '340ms', animationDuration: '0.88s' } : undefined}
      />
    </span>
  );
}

/**
 * Slider tátil customizado (mouse + toque + teclado) com acabamento premium
 */
function InteractiveTrackSlider({
  value = 0,
  max = 100,
  disabled = false,
  onChange,
  onCommit,
  ariaLabel = 'Controle deslizante',
  fillClassName = 'bg-white',
}) {
  const trackRef = useRef(null);
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const safeMax = Math.max(0.0001, Number(max) || 100);
  const clampedVal = Math.max(0, Math.min(safeMax, Number(value) || 0));
  const pct = Math.max(0, Math.min(100, (clampedVal / safeMax) * 100));

  const calcValueFromClientX = useCallback(
    (clientX) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) return clampedVal;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return ratio * safeMax;
    },
    [clampedVal, safeMax]
  );

  const handlePointerDown = (e) => {
    if (disabled) return;
    e.preventDefault();
    draggingRef.current = true;
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const nextVal = calcValueFromClientX(e.clientX);
    onChange?.(nextVal);
  };

  const handlePointerMove = (e) => {
    if (!draggingRef.current || disabled) return;
    const nextVal = calcValueFromClientX(e.clientX);
    onChange?.(nextVal);
  };

  const handlePointerUp = (e) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {}
    const nextVal = calcValueFromClientX(e.clientX);
    onCommit?.(nextVal);
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    const step = safeMax * 0.05;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(safeMax, clampedVal + step);
      onChange?.(next);
      onCommit?.(next);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.max(0, clampedVal - step);
      onChange?.(next);
      onCommit?.(next);
    }
  };

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={Math.round(safeMax)}
      aria-valuenow={Math.round(clampedVal)}
      aria-disabled={disabled}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onKeyDown={handleKeyDown}
      className={cn(
        'group relative w-full h-5 flex items-center select-none touch-none',
        disabled ? 'cursor-default opacity-85' : 'cursor-pointer'
      )}
    >
      <div className="w-full h-1.5 rounded-full bg-white/12 overflow-hidden border border-white/10">
        <div
          className={cn('h-full rounded-full transition-[width] duration-75', fillClassName)}
          style={{ width: `${pct}%` }}
        />
      </div>

      {!disabled && (
        <span
          className={cn(
            'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3.5 w-3.5 rounded-full bg-white border border-black/30 shadow-[0_0_12px_rgba(255,255,255,0.55)] transition-transform',
            dragging ? 'scale-125' : 'scale-95 group-hover:scale-115'
          )}
          style={{ left: `${pct}%` }}
        />
      )}
    </div>
  );
}

/**
 * Canal Individual de Mixer (usado separadamente para Música e para Efeitos Sonoros)
 */
function AudioChannelRow({
  label,
  sublabel,
  Icon,
  volume,
  muted,
  onChangeVolume,
  onToggleMute,
  onTestSound,
  fillClassName = 'bg-slate-200',
}) {
  const pct = Math.round((muted ? 0 : volume) * 100);
  const VolStateIcon = muted || volume <= 0.01 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-6 w-6 rounded-lg bg-white/8 border border-white/12 flex items-center justify-center shrink-0 text-slate-300">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-200 block truncate">
              {label}
            </span>
            {sublabel && (
              <span className="text-[10px] text-slate-400 block truncate">{sublabel}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onTestSound && (
            <button
              type="button"
              onClick={onTestSound}
              title="Testar volume de efeitos sonoros apenas no seu dispositivo"
              className="px-2 py-0.5 rounded-lg bg-white/[0.06] border border-white/12 hover:bg-white/15 text-[10px] font-semibold text-slate-300 hover:text-white transition-colors"
            >
              Testar
            </button>
          )}
          <span className="px-2 py-0.5 rounded-full bg-[#0c101b] border border-white/12 text-[11px] font-mono font-black text-white tabular-nums min-w-[42px] text-center">
            {pct}%
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onToggleMute}
          title={muted ? `Ativar ${label}` : `Silenciar ${label}`}
          aria-label={muted ? `Ativar ${label}` : `Silenciar ${label}`}
          className={cn(
            'h-8 w-8 rounded-xl border flex items-center justify-center shrink-0 transition-colors',
            muted || volume === 0
              ? 'bg-rose-500/15 border-rose-500/35 text-rose-300'
              : 'bg-white/8 border-white/15 text-slate-200 hover:text-white hover:bg-white/15'
          )}
        >
          <VolStateIcon className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onChangeVolume(Math.max(0, (muted ? 0 : volume) - 0.1))}
          title={`Abaixar ${label} (-10%)`}
          aria-label={`Abaixar ${label}`}
          className="h-8 w-7 rounded-xl bg-white/[0.05] border border-white/10 hover:bg-white/14 flex items-center justify-center text-slate-200 hover:text-white shrink-0 transition-colors"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>

        <div className="flex-1 min-w-0 px-1">
          <InteractiveTrackSlider
            value={muted ? 0 : volume * 100}
            max={100}
            ariaLabel={`Volume de ${label}`}
            fillClassName={fillClassName}
            onChange={(val) => onChangeVolume(val / 100)}
            onCommit={(val) => onChangeVolume(val / 100)}
          />
        </div>

        <button
          type="button"
          onClick={() => onChangeVolume(Math.min(1, (muted ? 0 : volume) + 0.1))}
          title={`Aumentar ${label} (+10%)`}
          aria-label={`Aumentar ${label}`}
          className="h-8 w-7 rounded-xl bg-white/[0.05] border border-white/10 hover:bg-white/14 flex items-center justify-center text-slate-200 hover:text-white shrink-0 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/**
 * Botão de Ícone de Áudio/Música para o cabeçalho do Mestre e do Jogador
 */
export function TabletopMusicTriggerButton({ className = '' }) {
  const music = useTabletopMusic();
  if (!music) return null;

  const {
    isPlaying,
    panelOpen,
    togglePanel,
    isMuted,
    volume,
    sfxMuted,
    sfxVolume,
    needsUnlock,
    currentTrack,
    isMaster,
  } = music;

  const isAudiblePlaying = isPlaying && !isMuted && volume > 0;
  const bothMuted = (isMuted || volume === 0) && (sfxMuted || sfxVolume === 0);

  return (
    <button
      type="button"
      onClick={togglePanel}
      aria-label={isMaster ? 'Abrir estúdio musical e soundboard da mesa' : 'Abrir mixer de música e efeitos'}
      aria-expanded={panelOpen}
      title={
        currentTrack
          ? `${isPlaying ? 'Tocando' : 'Pausado'}: ${currentTrack.title}`
          : 'Áudio & Música da Mesa'
      }
      className={cn(
        'relative inline-flex items-center gap-2 h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl border text-xs font-semibold transition-all select-none',
        panelOpen
          ? 'bg-white/15 border-white/30 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]'
          : 'bg-white/[0.06] border-white/15 text-slate-200 hover:text-white hover:bg-white/12 hover:border-white/25',
        className
      )}
    >
      <span className="relative flex items-center justify-center">
        {bothMuted ? (
          <VolumeX className="h-4 w-4 text-slate-400" />
        ) : (
          <Music className="h-4 w-4 text-slate-300" />
        )}
      </span>

      {isAudiblePlaying && <EqualizerBars active={true} className="h-3" />}

      <span className="hidden md:inline max-w-[125px] truncate text-[11px] font-semibold text-slate-200">
        {isPlaying && currentTrack ? currentTrack.title : 'Áudio'}
      </span>

      {needsUnlock && isPlaying && (
        <span
          className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-[#07080c] animate-pulse"
          title="Clique para ativar o áudio sincronizado"
        />
      )}
    </button>
  );
}

/**
 * Painel Flutuante de Áudio Sincronizado (Estúdio Musical + Mixer Independente Música/SFX + Soundboard)
 */
export function TabletopMusicPanel() {
  const music = useTabletopMusic();

  // Estados de scrubbing na barra de tempo (Mestre)
  const [scrubValue, setScrubValue] = useState(null);

  // Estados do gerenciador de playlist (Mestre)
  const [showAddForm, setShowAddForm] = useState(false);
  const [addTab, setAddTab] = useState('youtube'); // 'youtube' | 'url' | 'upload'
  const [addUrl, setAddUrl] = useState('');
  const [addTitle, setAddTitle] = useState('');
  const [addArtist, setAddArtist] = useState('');
  const [addCategory, setAddCategory] = useState('tavern');
  const [fetchingYtMeta, setFetchingYtMeta] = useState(false);
  const [submittingTrack, setSubmittingTrack] = useState(false);
  const [pendingAudioFile, setPendingAudioFile] = useState(null);
  const audioFileInputRef = useRef(null);

  // Edição inline de faixa na playlist
  const [editingTrackId, setEditingTrackId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('tavern');

  // Drag-and-drop na playlist
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Soundboard de efeitos rápidos sincronizados (Mestre)
  const [soundboardOpen, setSoundboardOpen] = useState(true);
  const [flashingSfxId, setFlashingSfxId] = useState(null);
  const sfxFlashTimerRef = useRef(null);

  // Auto-detecta título quando Mestre cola link do YouTube
  useEffect(() => {
    if (!showAddForm || addTab !== 'youtube') return;
    const videoId = extractYouTubeVideoId(addUrl);
    if (!videoId) return;

    let cancelled = false;
    setFetchingYtMeta(true);
    fetchYouTubeTitle(videoId)
      .then((meta) => {
        if (cancelled || !meta) return;
        setAddTitle((prev) => (prev.trim() ? prev : meta.title));
        setAddArtist((prev) => (prev.trim() ? prev : meta.artist));
      })
      .finally(() => {
        if (!cancelled) setFetchingYtMeta(false);
      });

    return () => {
      cancelled = true;
    };
  }, [addUrl, addTab, showAddForm]);

  useEffect(() => {
    return () => {
      if (sfxFlashTimerRef.current) clearTimeout(sfxFlashTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!music?.panelOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        music.setPanelOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [music]);

  if (!music || !music.panelOpen) return null;

  const {
    isMaster,
    setPanelOpen,
    playlist,
    currentTrack,
    currentIndex,
    isPlaying,
    currentTime,
    duration,
    loopMode,
    shuffle,
    // Canal Música
    volume,
    isMuted,
    setVolume,
    toggleMute,
    // Canal Efeitos Sonoros (independente)
    sfxVolume,
    sfxMuted,
    setSfxVolume,
    toggleSfxMute,
    previewSfxVolume,
    needsUnlock,
    unlockAudio,
    loadingTrack,
    playbackError,
    togglePlayPause,
    playTrackAt,
    nextTrack,
    prevTrack,
    seekTo,
    skipRelative,
    cycleLoopMode,
    toggleShuffle,
    addTrack,
    updateTrackMeta,
    removeTrack,
    reorderPlaylist,
    restoreDefaultTracks,
    triggerSoundEffect,
  } = music;

  const handleFireSfx = (sfxId) => {
    if (!triggerSoundEffect) return;
    setFlashingSfxId(sfxId);
    if (sfxFlashTimerRef.current) clearTimeout(sfxFlashTimerRef.current);
    sfxFlashTimerRef.current = setTimeout(() => setFlashingSfxId(null), 650);
    triggerSoundEffect(sfxId);
  };

  const displayedTime = scrubValue !== null ? scrubValue : currentTime;
  const safeDuration = Math.max(1, duration || currentTrack?.duration || 1);
  const visual = getCategoryVisual(currentTrack?.category);
  const CategoryIcon = visual.Icon;

  const handleSelectAudioFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      toast.error('Selecione um arquivo de áudio válido (MP3, OGG, WAV, WebM, M4A).');
      return;
    }
    if (file.size > 8.2 * 1024 * 1024) {
      toast.error('Arquivo excede 8 MB. Para trilhas longas, cole o link do YouTube ou URL direta.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result;
      if (typeof dataUrl !== 'string') return;
      const baseName = file.name.replace(/\.[^/.]+$/, '');

      const probe = new Audio();
      probe.preload = 'metadata';
      probe.onloadedmetadata = () => {
        const dur = Number.isFinite(probe.duration) ? Math.round(probe.duration) : 0;
        setPendingAudioFile({
          name: file.name,
          dataUrl,
          mimeType: file.type || 'audio/mpeg',
          duration: dur,
        });
        if (!addTitle.trim()) setAddTitle(baseName);
      };
      probe.onerror = () => {
        setPendingAudioFile({
          name: file.name,
          dataUrl,
          mimeType: file.type || 'audio/mpeg',
          duration: 0,
        });
        if (!addTitle.trim()) setAddTitle(baseName);
      };
      probe.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleAddTrackSubmit = async (e) => {
    e.preventDefault();
    setSubmittingTrack(true);
    try {
      const ok = await addTrack({
        sourceType: addTab,
        title: addTitle,
        artist: addArtist,
        category: addCategory,
        url: addUrl,
        fileDataUrl: pendingAudioFile?.dataUrl || null,
        mimeType: pendingAudioFile?.mimeType || '',
        duration: pendingAudioFile?.duration || 0,
      });
      if (ok) {
        setAddUrl('');
        setAddTitle('');
        setAddArtist('');
        setPendingAudioFile(null);
        if (audioFileInputRef.current) audioFileInputRef.current.value = '';
        setShowAddForm(false);
      }
    } catch (err) {
      toast.error(err?.message || 'Erro ao adicionar música.');
    } finally {
      setSubmittingTrack(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-label={isMaster ? 'Estúdio de Áudio da Mesa' : 'Mixer de Áudio da Mesa'}
      className={cn(
        'fixed z-50 right-3 sm:right-5 top-[4.25rem] xl:top-[4.75rem] flex flex-col rounded-2xl border border-white/15 bg-[#090c14]/97 backdrop-blur-2xl shadow-[0_28px_72px_rgba(0,0,0,0.92)] overflow-hidden animate-in fade-in zoom-in-95 duration-150',
        isMaster
          ? 'w-[min(450px,calc(100vw-1.5rem))] max-h-[calc(100dvh-5.75rem)]'
          : 'w-[min(370px,calc(100vw-1.5rem))] max-h-[calc(100dvh-5.75rem)]'
      )}
      style={{
        boxShadow:
          'inset 0 1px 0 rgba(255, 255, 255, 0.09), 0 28px 72px -12px rgba(0, 0, 0, 0.92)',
      }}
    >
      {/* CABEÇALHO DO ESTÚDIO DE ÁUDIO */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-2 shrink-0 bg-gradient-to-r from-white/[0.04] via-white/[0.02] to-transparent">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-white/8 border border-white/15 flex items-center justify-center shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
            <Headphones className="h-4 w-4 text-slate-200" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-white truncate">
              {isMaster ? 'Estúdio de Áudio & Soundboard' : 'Mixer de Áudio da Mesa'}
            </h2>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full shrink-0',
                  isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                )}
              />
              <span className="truncate">
                {isPlaying
                  ? isMaster
                    ? 'Sincronizado ao vivo para todos'
                    : 'Trilha sincronizada com a mesa'
                  : 'Trilha pausada pelo Mestre'}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPanelOpen(false)}
          aria-label="Fechar painel de áudio"
          className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* CORPO COM SCROLL SUAVE */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {/* ALERTA DE DESBLOQUEIO DE AUTOPLAY */}
        {needsUnlock && isPlaying && (
          <button
            type="button"
            onClick={unlockAudio}
            className="w-full p-3 rounded-xl bg-amber-500/15 border border-amber-400/45 hover:bg-amber-500/22 text-left flex items-center gap-3 transition-all"
          >
            <div className="h-9 w-9 rounded-xl bg-amber-500/25 border border-amber-400/50 flex items-center justify-center shrink-0 text-amber-300">
              <Volume2 className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-amber-100">
                Clique para ativar o áudio da mesa
              </div>
              <div className="text-[11px] text-amber-200/80">
                O navegador pausou o início automático. Toque para entrar na trilha sincronizada.
              </div>
            </div>
          </button>
        )}

        {/* CARD DA FAIXA ATUAL (NOW PLAYING) */}
        <div
          className="p-3.5 rounded-2xl border border-white/12 space-y-3 relative overflow-hidden"
          style={{
            background: `linear-gradient(145deg, ${visual.color}14 0%, rgba(12, 16, 27, 0.92) 55%, rgba(9, 12, 20, 0.96) 100%)`,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 border relative"
              style={{
                backgroundColor: `${visual.color}1f`,
                borderColor: `${visual.color}55`,
                boxShadow: isPlaying ? `0 0 24px ${visual.color}38` : undefined,
              }}
            >
              <CategoryIcon className="h-6 w-6" style={{ color: visual.color }} />
              {loadingTrack && (
                <span className="absolute inset-0 rounded-xl bg-black/60 flex items-center justify-center">
                  <span className="h-4 w-4 rounded-full border-2 border-white/25 border-t-white animate-spin" />
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-extrabold text-white truncate">
                  {currentTrack?.title || 'Nenhuma faixa selecionada'}
                </p>
                {isPlaying && !loadingTrack && <EqualizerBars active={true} className="shrink-0" />}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                <span className="text-[11px] text-slate-300/80 truncate max-w-[165px]">
                  {currentTrack?.artist || visual.label}
                </span>
                {currentTrack && (
                  <span className="px-1.5 py-0.2 rounded-md bg-white/10 border border-white/12 text-[9px] font-mono font-bold text-slate-200">
                    {getSourceBadgeLabel(currentTrack.sourceType)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {playbackError && (
            <div className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/35 text-[11px] text-rose-200">
              {playbackError}
            </div>
          )}

          {/* BARRA DO TEMPO DA MÚSICA */}
          <div className="space-y-1">
            <InteractiveTrackSlider
              value={displayedTime}
              max={safeDuration}
              disabled={!isMaster || !currentTrack}
              ariaLabel="Progresso da música"
              fillClassName={isMaster ? 'bg-white' : 'bg-slate-300'}
              onChange={(val) => setScrubValue(val)}
              onCommit={(val) => {
                setScrubValue(null);
                seekTo(val);
              }}
            />
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 tabular-nums">
              <span>{formatAudioTime(displayedTime)}</span>
              <span>{duration > 0 ? formatAudioTime(duration) : '--:--'}</span>
            </div>
          </div>

          {/* CONTROLES DE TRANSPORTE EXCLUSIVOS DO MESTRE */}
          {isMaster && (
            <div className="flex items-center justify-between gap-1 pt-1">
              <button
                type="button"
                onClick={toggleShuffle}
                title={shuffle ? 'Ordem aleatória ativada' : 'Ativar ordem aleatória'}
                aria-pressed={shuffle}
                className={cn(
                  'h-8 w-8 rounded-xl flex items-center justify-center border transition-all',
                  shuffle
                    ? 'bg-white/15 border-white/30 text-white'
                    : 'border-transparent text-slate-400 hover:text-white hover:bg-white/10'
                )}
              >
                <Shuffle className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => skipRelative(-15)}
                disabled={!currentTrack}
                title="Voltar 15 segundos"
                className="h-8 px-1.5 rounded-xl text-[10px] font-mono font-bold text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-35 transition-colors"
              >
                -15s
              </button>

              <button
                type="button"
                onClick={prevTrack}
                disabled={playlist.length === 0}
                title="Retroceder para música anterior"
                aria-label="Música anterior"
                className="h-9 w-9 rounded-xl bg-white/[0.06] border border-white/12 hover:bg-white/15 hover:border-white/25 disabled:opacity-35 flex items-center justify-center text-white transition-all active:scale-95"
              >
                <SkipBack className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={togglePlayPause}
                disabled={playlist.length === 0}
                title={isPlaying ? 'Pausar música para todos' : 'Tocar música para todos'}
                aria-label={isPlaying ? 'Pausar' : 'Tocar'}
                className="h-11 w-11 rounded-full bg-white text-[#07080c] hover:bg-slate-200 disabled:opacity-40 flex items-center justify-center shadow-[0_0_24px_rgba(255,255,255,0.3)] transition-all active:scale-95"
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5 fill-current" />
                ) : (
                  <Play className="h-5 w-5 fill-current ml-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={nextTrack}
                disabled={playlist.length === 0}
                title="Pular para próxima música"
                aria-label="Próxima música"
                className="h-9 w-9 rounded-xl bg-white/[0.06] border border-white/12 hover:bg-white/15 hover:border-white/25 disabled:opacity-35 flex items-center justify-center text-white transition-all active:scale-95"
              >
                <SkipForward className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => skipRelative(15)}
                disabled={!currentTrack}
                title="Adiantar 15 segundos"
                className="h-8 px-1.5 rounded-xl text-[10px] font-mono font-bold text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-35 transition-colors"
              >
                +15s
              </button>

              <button
                type="button"
                onClick={cycleLoopMode}
                title={loopMode === 'one' ? 'Repetindo faixa atual' : 'Repetindo playlist'}
                aria-pressed={loopMode === 'one'}
                className={cn(
                  'h-8 w-8 rounded-xl flex items-center justify-center border transition-all',
                  loopMode === 'one'
                    ? 'bg-white/15 border-white/30 text-white'
                    : 'border-transparent text-slate-400 hover:text-white hover:bg-white/10'
                )}
              >
                {loopMode === 'one' ? (
                  <Repeat1 className="h-3.5 w-3.5" />
                ) : (
                  <Repeat className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          )}
        </div>

        {/* MIXER INDEPENDENTE: CANAL DE MÚSICA + CANAL DE EFEITOS SONOROS (JOGADOR & MESTRE) */}
        <div className="p-3 rounded-2xl bg-[#0c101b] border border-white/12 space-y-2.5">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Mixer de Volume (Seu Dispositivo)
            </span>
            <span className="text-[10px] font-mono text-slate-500">Canais separados</span>
          </div>

          <AudioChannelRow
            label="Música da Mesa"
            sublabel="Trilha sonora sincronizada"
            Icon={GiMusicalNotes}
            volume={volume}
            muted={isMuted}
            onChangeVolume={setVolume}
            onToggleMute={toggleMute}
            fillClassName="bg-slate-200"
          />

          <AudioChannelRow
            label="Efeitos Sonoros"
            sublabel="Soundboard, sussurros e baús"
            Icon={GiSpeaker}
            volume={sfxVolume}
            muted={sfxMuted}
            onChangeVolume={setSfxVolume}
            onToggleMute={toggleSfxMute}
            onTestSound={previewSfxVolume}
            fillClassName="bg-amber-300"
          />
        </div>

        {/* NOTA DISCRETA PARA JOGADORES */}
        {!isMaster && (
          <p className="text-[11px] text-slate-400 text-center leading-relaxed px-1">
            Música e efeitos sonoros têm controles independentes salvos apenas no seu dispositivo.
          </p>
        )}

        {/* SOUNDBOARD DE EFEITOS RÁPIDOS SINCRONIZADOS (EXCLUSIVO DO MESTRE) */}
        {isMaster && (
          <div className="rounded-2xl bg-[#0c101b] border border-white/12 overflow-hidden">
            <button
              type="button"
              onClick={() => setSoundboardOpen((v) => !v)}
              className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-white/[0.04] transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <GiSpeaker className="h-4 w-4 text-amber-300 shrink-0" />
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-100 truncate">
                  Soundboard Rápido
                </span>
                <span className="px-1.5 py-0.2 rounded-full bg-white/8 border border-white/12 text-[9px] font-mono text-slate-300">
                  12 SFX HD
                </span>
              </div>
              {soundboardOpen ? (
                <ChevronUp className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              )}
            </button>

            {soundboardOpen && (
              <div className="px-3 pb-3 pt-2 border-t border-white/10">
                <div className="grid grid-cols-3 gap-1.5">
                  {SOUNDBOARD_EFFECTS.map((sfx) => {
                    const SfxIcon = SOUNDBOARD_ICON_MAP[sfx.icon] || Zap;
                    const isFlashing = flashingSfxId === sfx.id;
                    return (
                      <button
                        key={sfx.id}
                        type="button"
                        onClick={() => handleFireSfx(sfx.id)}
                        title={`Disparar "${sfx.label}" para toda a mesa`}
                        className={cn(
                          'group relative flex flex-col items-center justify-center gap-1 py-2.5 px-1.5 rounded-xl border text-center transition-all active:scale-95 overflow-hidden',
                          isFlashing
                            ? 'bg-white/20 border-white/50 text-white'
                            : 'bg-white/[0.03] border-white/10 text-slate-200 hover:bg-white/[0.09] hover:border-white/25 hover:text-white'
                        )}
                        style={
                          isFlashing
                            ? {
                                borderColor: `${sfx.color}cc`,
                                boxShadow: `0 0 20px ${sfx.color}44, inset 0 1px 0 rgba(255,255,255,0.2)`,
                              }
                            : undefined
                        }
                      >
                        <SfxIcon
                          className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110"
                          style={{ color: sfx.color }}
                        />
                        <span className="text-[11px] font-bold leading-tight truncate max-w-full">
                          {sfx.shortLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* GERENCIADOR COMPLETO DA PLAYLIST (EXCLUSIVO DO MESTRE) */}
        {isMaster && (
          <div className="space-y-2.5 pt-1 border-t border-white/10">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-200">
                <ListMusic className="h-4 w-4 text-slate-300" />
                <span>Playlist da Mesa</span>
                <span className="px-1.5 py-0.2 rounded-full bg-white/10 border border-white/10 text-[10px] font-mono text-slate-300">
                  {playlist.length}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={restoreDefaultTracks}
                  title="Adicionar trilhas RPG padrão faltantes"
                  className="h-7 px-2 rounded-lg bg-white/[0.05] border border-white/12 hover:bg-white/12 text-[10px] font-semibold text-slate-300 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                  Padrão
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm((v) => !v)}
                  className={cn(
                    'h-7 px-2.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition-all',
                    showAddForm
                      ? 'bg-white/18 border-white/35 text-white'
                      : 'bg-white/10 border-white/20 text-white hover:bg-white/15'
                  )}
                >
                  {showAddForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  {showAddForm ? 'Fechar' : 'Adicionar'}
                </button>
              </div>
            </div>

            {showAddForm && (
              <form
                onSubmit={handleAddTrackSubmit}
                className="p-3 rounded-2xl bg-[#0c101b] border border-white/15 space-y-3 animate-in fade-in duration-150"
              >
                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-black/45 border border-white/10">
                  {[
                    { id: 'youtube', label: 'YouTube', Icon: Radio },
                    { id: 'url', label: 'Link Áudio', Icon: Link2 },
                    { id: 'upload', label: 'Arquivo', Icon: Upload },
                  ].map((tab) => {
                    const TabIcon = tab.Icon;
                    const active = addTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setAddTab(tab.id)}
                        className={cn(
                          'py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all',
                          active ? 'bg-white/15 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                        )}
                      >
                        <TabIcon className="h-3 w-3" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {addTab === 'youtube' && (
                  <div className="space-y-1">
                    <FormField label="Link do YouTube:">
                      <Input
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={addUrl}
                        onChange={(e) => setAddUrl(e.target.value)}
                      />
                    </FormField>
                    {extractYouTubeVideoId(addUrl) && (
                      <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 px-0.5">
                        <Check className="h-3 w-3 shrink-0" />
                        {fetchingYtMeta
                          ? 'Buscando título do vídeo...'
                          : `Vídeo YouTube pronto (${extractYouTubeVideoId(addUrl)})`}
                      </div>
                    )}
                  </div>
                )}

                {addTab === 'url' && (
                  <FormField label="URL direta (.mp3, .ogg, .wav, .webm):">
                    <Input
                      placeholder="https://exemplo.com/trilha-combate.mp3"
                      value={addUrl}
                      onChange={(e) => setAddUrl(e.target.value)}
                    />
                  </FormField>
                )}

                {addTab === 'upload' && (
                  <div className="space-y-1.5">
                    <input
                      ref={audioFileInputRef}
                      type="file"
                      accept="audio/*"
                      onChange={handleSelectAudioFile}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => audioFileInputRef.current?.click()}
                      className="w-full p-3 rounded-xl border border-dashed border-white/20 hover:border-white/40 bg-white/[0.03] hover:bg-white/[0.07] text-center transition-all flex items-center justify-center gap-2 text-xs font-semibold text-slate-200"
                    >
                      <Upload className="h-4 w-4 text-slate-300" />
                      {pendingAudioFile
                        ? `${pendingAudioFile.name} (${formatAudioTime(pendingAudioFile.duration)})`
                        : 'Escolher MP3 / OGG / WAV (até 8 MB)'}
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <FormField label="Nome da Música:">
                    <Input
                      placeholder="Ex: Combate Épico"
                      value={addTitle}
                      onChange={(e) => setAddTitle(e.target.value)}
                    />
                  </FormField>

                  <FormField label="Tema / Clima:">
                    <Select value={addCategory} onChange={(e) => setAddCategory(e.target.value)}>
                      {MUSIC_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>

                <Button type="submit" size="sm" loading={submittingTrack} className="w-full text-xs">
                  Adicionar à Playlist
                </Button>
              </form>
            )}

            {playlist.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 rounded-xl border border-dashed border-white/12">
                Playlist vazia. Adicione um link do YouTube, áudio ou restaure as trilhas padrão.
              </div>
            ) : (
              <div className="space-y-1.5">
                {playlist.map((track, idx) => {
                  const isCurrent = currentTrack?.id === track.id;
                  const isEditing = editingTrackId === track.id;
                  const cat = getCategoryVisual(track.category);
                  const CatIcon = cat.Icon;

                  return (
                    <div
                      key={track.id}
                      draggable={!isEditing}
                      onDragStart={() => setDragIndex(idx)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverIndex !== idx) setDragOverIndex(idx);
                      }}
                      onDragLeave={() => {
                        if (dragOverIndex === idx) setDragOverIndex(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragIndex !== null && dragIndex !== idx) {
                          reorderPlaylist(dragIndex, idx);
                        }
                        setDragIndex(null);
                        setDragOverIndex(null);
                      }}
                      onDragEnd={() => {
                        setDragIndex(null);
                        setDragOverIndex(null);
                      }}
                      className={cn(
                        'rounded-xl border p-2 transition-all',
                        isCurrent
                          ? 'bg-white/12 border-white/30 shadow-sm'
                          : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.07] hover:border-white/20',
                        dragOverIndex === idx && dragIndex !== idx && 'border-white/60 bg-white/15'
                      )}
                    >
                      {isEditing ? (
                        <div className="space-y-2">
                          <Input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            placeholder="Nome da faixa"
                            className="h-8 text-xs"
                          />
                          <div className="flex items-center gap-1.5">
                            <Select
                              value={editCategory}
                              onChange={(e) => setEditCategory(e.target.value)}
                              className="h-8 text-xs flex-1"
                            >
                              {MUSIC_CATEGORIES.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.label}
                                </option>
                              ))}
                            </Select>
                            <button
                              type="button"
                              onClick={async () => {
                                await updateTrackMeta(track.id, {
                                  title: editTitle,
                                  category: editCategory,
                                });
                                setEditingTrackId(null);
                              }}
                              title="Salvar alterações"
                              className="h-8 w-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/30 flex items-center justify-center shrink-0"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingTrackId(null)}
                              title="Cancelar"
                              className="h-8 w-8 rounded-lg bg-white/8 border border-white/15 text-slate-300 hover:text-white flex items-center justify-center shrink-0"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span
                            className="text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing shrink-0"
                            title="Arraste para reordenar"
                          >
                            <GripVertical className="h-3.5 w-3.5" />
                          </span>

                          <button
                            type="button"
                            onClick={() => playTrackAt(idx)}
                            className="flex items-center gap-2.5 min-w-0 flex-1 text-left group"
                            title={`Tocar "${track.title}" para todos`}
                          >
                            <span
                              className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 border"
                              style={{
                                backgroundColor: `${cat.color}18`,
                                borderColor: `${cat.color}45`,
                              }}
                            >
                              {isCurrent && isPlaying ? (
                                <EqualizerBars active={true} className="h-3" />
                              ) : (
                                <CatIcon className="h-4 w-4" style={{ color: cat.color }} />
                              )}
                            </span>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-mono text-slate-500 shrink-0">
                                  {idx + 1}.
                                </span>
                                <span
                                  className={cn(
                                    'text-xs font-bold truncate',
                                    isCurrent ? 'text-white' : 'text-slate-200 group-hover:text-white'
                                  )}
                                >
                                  {track.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                <span>{cat.label}</span>
                                <span>•</span>
                                <span className="font-mono">{getSourceBadgeLabel(track.sourceType)}</span>
                                {track.duration > 0 && (
                                  <>
                                    <span>•</span>
                                    <span className="font-mono">{formatAudioTime(track.duration)}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </button>

                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => reorderPlaylist(idx, idx - 1)}
                              disabled={idx === 0}
                              title="Mover para cima"
                              className="h-6 w-6 rounded-md text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-25 flex items-center justify-center transition-colors"
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => reorderPlaylist(idx, idx + 1)}
                              disabled={idx === playlist.length - 1}
                              title="Mover para baixo"
                              className="h-6 w-6 rounded-md text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-25 flex items-center justify-center transition-colors"
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTrackId(track.id);
                                setEditTitle(track.title);
                                setEditCategory(track.category || 'tavern');
                              }}
                              title="Editar nome/tema"
                              className="h-6 w-6 rounded-md text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeTrack(track.id)}
                              title="Remover da playlist"
                              className="h-6 w-6 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {currentIndex >= 0 && playlist.length > 1 && (
              <p className="text-[10px] text-slate-500 text-center">
                Dica: arraste as faixas pelo ícone lateral ou use as setas para organizar a ordem da playlist.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
