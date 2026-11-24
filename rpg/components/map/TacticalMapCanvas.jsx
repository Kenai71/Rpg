/* eslint-disable @next/next/no-img-element */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  BookOpen,
  ChevronRight,
  CloudLightning,
  CloudRain,
  Compass,
  Crosshair,
  Dices,
  DoorOpen,
  Droplet,
  Eye,
  EyeOff,
  Flame,
  Footprints,
  Ghost,
  Grid,
  Heart,
  Lock,
  Maximize2,
  Minus,
  Move,
  Music,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RotateCcw,
  Ruler,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Skull,
  Swords,
  Trash2,
  Unlock,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react';
import {
  GiCampfire,
  GiCrossedSwords,
  GiDragonHead,
  GiDustCloud,
  GiFog,
  GiLightningStorm,
  GiSandstorm,
  GiSnowflake2,
  GiSun,
  GiTorch,
  GiWoodenDoor,
} from 'react-icons/gi';
import { toast } from 'sonner';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { FormField, Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { TacticalDice3D } from './TacticalDice3D';
import {
  DARKNESS_BLIND_THRESHOLD,
  MAP_EFFECT_PRESETS,
  MAP_WEATHER_OPTIONS,
  MapAtmosphereOverlay,
  TOKEN_LIGHT_COLORS,
  TOKEN_LIGHT_PRESETS,
  computeViewerLightingState,
  getTokenLightColorMeta,
  normalizeMapEffects,
} from './MapAtmosphereOverlay';
import { useTabletopMusic } from '../music/TabletopMusicProvider';
import { TOKEN_CONDITIONS, TOKEN_SIZES } from '../../lib/map-presets';
import { computeAutoGridSize, loadMapHdImageUrl } from '../../lib/rpg-service';
import { cn } from '../../lib/utils';

const DICE_QUICK_COUNTS = [1, 2, 3, 4, 6, 8];
const DICE_SIDES_LIST = [4, 6, 8, 10, 12, 20];

// Ícones geométricos minimalistas dos poliedros D&D (zero ícones de estrela)
function PolyhedronGlyph({ sides, className = 'h-4 w-4' }) {
  if (sides === 4) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" className={className}>
        <polygon points="12,3 21,19 3,19" />
        <line x1="12" y1="3" x2="12" y2="19" strokeOpacity="0.45" />
      </svg>
    );
  }
  if (sides === 6) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" className={className}>
        <rect x="4" y="4" width="16" height="16" rx="2.5" />
        <circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" />
        <circle cx="15" cy="15" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (sides === 8) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" className={className}>
        <polygon points="12,2.5 21,12 12,21.5 3,12" />
        <line x1="3" y1="12" x2="21" y2="12" strokeOpacity="0.45" />
      </svg>
    );
  }
  if (sides === 10) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" className={className}>
        <polygon points="12,2.5 20.5,10.5 12,21.5 3.5,10.5" />
        <polyline points="3.5,10.5 12,14 20.5,10.5" strokeOpacity="0.45" />
      </svg>
    );
  }
  if (sides === 12) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" className={className}>
        <polygon points="12,2.5 20.8,8.8 17.5,19.5 6.5,19.5 3.2,8.8" />
        <polygon points="12,6.8 16.5,10.1 14.8,15.5 9.2,15.5 7.5,10.1" strokeOpacity="0.4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" className={className}>
      <polygon points="12,2.5 20.2,7.2 20.2,16.8 12,21.5 3.8,16.8 3.8,7.2" />
      <polygon points="12,6.2 17.2,15.4 6.8,15.4" strokeOpacity="0.45" />
    </svg>
  );
}

// Normaliza metadados de qualquer rolagem (legada unitária ou múltipla, ex: 3d20)
function normalizeRollMeta(rollObj) {
  if (!rollObj) return null;
  const sides = Number(rollObj.sides) || 20;
  const results =
    Array.isArray(rollObj.results) && rollObj.results.length > 0
      ? rollObj.results.map((v) => Number(v))
      : [Number(rollObj.roll) || 0];
  const count = Number(rollObj.count) || results.length || 1;
  const total =
    Number.isFinite(Number(rollObj.total))
      ? Number(rollObj.total)
      : Number.isFinite(Number(rollObj.roll))
      ? Number(rollObj.roll)
      : results.reduce((acc, v) => acc + v, 0);
  const formula = rollObj.formula || (count > 1 ? `${count}d${sides}` : `d${sides}`);
  const allMax =
    rollObj.all_max !== undefined
      ? Boolean(rollObj.all_max)
      : results.every((v) => v === sides);
  const isMax = Boolean(rollObj.is_max || rollObj.isMax || rollObj.isCrit || rollObj.is_crit);
  const isFumble = Boolean(rollObj.is_fumble || rollObj.isFumble);
  const highest = results.length > 0 ? Math.max(...results) : total;
  const lowest = results.length > 0 ? Math.min(...results) : total;
  return {
    sides,
    count,
    results,
    total,
    formula,
    allMax,
    isMax,
    isFumble,
    highest,
    lowest,
  };
}

// Mapeamento visual estrito de ícones para as Condições de Status (D&D 5.5e / 5e)
const CONDITION_ICONS = {
  sangramento: Droplet,
  atordoado: Zap,
  caido: ArrowDown,
  queimando: Flame,
  lentidao: Footprints,
  cego: EyeOff,
  envenenado: Skull,
  amaldicoado: Ghost,
  abencoado: ShieldAlert,
  invisivel: Eye,
};

export function TacticalMapCanvas({
  map,
  tokens = [],
  currentUserId,
  currentUserName,
  isMaster = false,
  fullViewport = false,
  onUpdateTokenPosition,
  onUpdateTokenStats,
  onDeleteToken,
  onUpdateMap,
  onPing,
  pings = [],
  diceRolls = [],
  onDiceRoll,
  onClearDiceHistory,
  onInspectMonsterId,
}) {
  const containerRef = useRef(null);
  const mapImageRef = useRef(null);
  const tabletopMusic = useTabletopMusic();

  // Zoom e Pan
  const [zoom, setZoom] = useState(map?.scale || 1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Ferramentas ativas
  const [activeTool, setActiveTool] = useState('select'); // 'select' | 'ruler' | 'ping'
  const [isLocked, setIsLocked] = useState(Boolean(map?.is_locked));
  const [showGrid, setShowGrid] = useState(map?.gridType !== 'none');
  const [gridSize, setGridSize] = useState(map?.gridSize || 48);
  const [gridOpacity, setGridOpacity] = useState(map?.gridOpacity || 0.25);
  const [snapToGrid, setSnapToGrid] = useState(false);

  // Régua
  const [rulerStart, setRulerStart] = useState(null);
  const [rulerCurrent, setRulerCurrent] = useState(null);
  const rulerClearTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (rulerClearTimerRef.current) clearTimeout(rulerClearTimerRef.current);
    };
  }, []);

  // Token selecionado para edição / inspeção (ID para sincronização em TEMPO REAL)
  const [selectedTokenId, setSelectedTokenId] = useState(null);
  const [inspectModalOpen, setInspectModalOpen] = useState(false);

  // Derivação em TEMPO REAL do token a partir da prop tokens recebida do Firestore
  const activeSelectedToken = useMemo(() => {
    if (!selectedTokenId) return null;
    return tokens.find((t) => t.id === selectedTokenId) || null;
  }, [tokens, selectedTokenId]);

  // Drag de Token
  const draggingTokenRef = useRef(null);
  const [localDraggingId, setLocalDraggingId] = useState(null);
  const [localTokenPositions, setLocalTokenPositions] = useState({});
  const justDraggedRef = useRef(false);

  // Dimensões Naturais Exatas em Pixels Reais e Carregamento Progressivo HD
  const [naturalDimensions, setNaturalDimensions] = useState({
    width: Number(map?.naturalWidth) || 1400,
    height: Number(map?.naturalHeight) || 900,
  });
  const [resolvedImageUrl, setResolvedImageUrl] = useState(map?.imageUrl || '');
  const [loadingHd, setLoadingHd] = useState(false);
  const [imageStatus, setImageStatus] = useState('loading'); // 'loading' | 'loaded' | 'error'
  const zoomBoundsRef = useRef({ min: 0.1, max: 4.5 });

  // Sincroniza configurações de grade ao trocar de mapa
  useEffect(() => {
    setShowGrid(map?.gridType !== 'none');
    setGridOpacity(map?.gridOpacity ?? 0.25);
    if (map?.autoGrid) {
      setGridSize(computeAutoGridSize(naturalDimensions.width, naturalDimensions.height));
    } else if (Number.isFinite(Number(map?.gridSize)) && Number(map?.gridSize) >= 10) {
      setGridSize(Number(map.gridSize));
    } else {
      setGridSize(computeAutoGridSize(naturalDimensions.width, naturalDimensions.height));
    }
  }, [map?.id, map?.gridType, map?.gridSize, map?.gridOpacity, map?.autoGrid, naturalDimensions.width, naturalDimensions.height]);

  // Carrega imagem do mapa preservando dimensões exatas em pixels (com upgrade automático de chunks HD)
  useEffect(() => {
    let cancelled = false;
    const baseUrl = map?.imageUrl || '';
    const hasSavedDims =
      Number.isFinite(Number(map?.naturalWidth)) &&
      Number(map?.naturalWidth) > 0 &&
      Number.isFinite(Number(map?.naturalHeight)) &&
      Number(map?.naturalHeight) > 0;

    if (hasSavedDims) {
      setNaturalDimensions({
        width: Math.round(Number(map.naturalWidth)),
        height: Math.round(Number(map.naturalHeight)),
      });
    }

    setResolvedImageUrl(baseUrl);
    setLoadingHd(false);

    if (!baseUrl) {
      setImageStatus('loaded');
      return () => {
        cancelled = true;
      };
    }

    setImageStatus('loading');

    const probeUrl = (url, allowDimUpdate) => {
      const probe = new Image();
      probe.onload = () => {
        if (cancelled) return;
        const w = probe.naturalWidth || 1400;
        const h = probe.naturalHeight || 900;
        if (allowDimUpdate || !hasSavedDims) {
          setNaturalDimensions({ width: w, height: h });
        }
        setImageStatus('loaded');
      };
      probe.onerror = () => {
        if (!cancelled) setImageStatus('error');
      };
      probe.src = url;
    };

    const hasHdChunks = Number(map?.hd_chunk_count || 0) > 0;
    probeUrl(baseUrl, !hasHdChunks);

    if (hasHdChunks) {
      setLoadingHd(true);
      loadMapHdImageUrl({
        id: map?.id,
        imageUrl: baseUrl,
        hd_chunk_count: map?.hd_chunk_count,
        hd_mime_type: map?.hd_mime_type,
      })
        .then((hdUrl) => {
          if (cancelled) return;
          if (hdUrl && hdUrl !== baseUrl) {
            setResolvedImageUrl(hdUrl);
            probeUrl(hdUrl, true);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoadingHd(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [map?.id, map?.imageUrl, map?.hd_chunk_count, map?.hd_mime_type, map?.naturalWidth, map?.naturalHeight]);

  // Dimensões EXATAS em pixels reais da imagem (sem redução artificial para 1400px e sem distorcer proporções extremas)
  const mapDisplaySize = useMemo(() => {
    const w = Math.max(32, Math.round(Number(naturalDimensions.width) || 1400));
    const h = Math.max(32, Math.round(Number(naturalDimensions.height) || 900));
    return { width: w, height: h };
  }, [naturalDimensions]);

  // Fator proporcional para manter tokens, rótulos, pings e régua nítidos e proporcionais em mapas de qualquer resolução (600px a 8K)
  const mapScaleFactor = useMemo(() => {
    const w = mapDisplaySize.width || 1400;
    const h = mapDisplaySize.height || 900;
    const ratio = w / Math.max(1, h);
    const refFactor = ratio < 0.75 ? h / 1200 : w / 1400;
    return Math.max(0.55, Math.min(4.0, Math.round(refFactor * 1000) / 1000));
  }, [mapDisplaySize]);

  // Calcula limites de zoom dinâmicos compatíveis com resoluções exatas (ex: 4K/8K em telas menores)
  const computeFitAndBounds = useCallback(() => {
    const container = containerRef.current;
    if (!container || !mapDisplaySize.width || !mapDisplaySize.height) {
      return { fitScale: 1.0, minZoom: 0.1, maxZoom: 4.5 };
    }
    const cWidth = Math.max(240, container.clientWidth - 24);
    const cHeight = Math.max(200, container.clientHeight - 24);
    const scaleW = cWidth / mapDisplaySize.width;
    const scaleH = cHeight / mapDisplaySize.height;
    const rawFit = Math.min(scaleW, scaleH);
    const minZoom = Math.min(0.25, Math.max(0.04, Math.round(rawFit * 0.6 * 1000) / 1000));
    const maxZoom = Math.max(
      4.0,
      Math.min(8.0, Math.round(Math.max(1, 2400 / Math.max(mapDisplaySize.width, mapDisplaySize.height)) * 3.5 * 10) / 10)
    );
    const fitScale = Math.max(minZoom, Math.min(maxZoom, Math.round(rawFit * 1000) / 1000));
    zoomBoundsRef.current = { min: minZoom, max: maxZoom };
    return { fitScale, minZoom, maxZoom };
  }, [mapDisplaySize]);

  // Ajustar mapa à tela (Fit to screen — essencial para notebooks, telas menores e mapas 4K)
  const handleFitToScreen = useCallback(() => {
    const { fitScale } = computeFitAndBounds();
    setZoom(fitScale);
    setPan({ x: 0, y: 0 });
  }, [computeFitAndBounds]);

  // Auto-ajuste sempre que o mapa carregar ou mudar de dimensões naturais para caber inteiro na viewport
  useEffect(() => {
    if (map?.id && imageStatus === 'loaded') {
      const raf = requestAnimationFrame(() => {
        handleFitToScreen();
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [map?.id, imageStatus, fullViewport, handleFitToScreen]);

  // Atualiza limites de zoom sempre que a viewport do mapa mudar de tamanho (ex: resize da janela)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    computeFitAndBounds();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      computeFitAndBounds();
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [computeFitAndBounds]);

  // Zoom suave proporcional com Scroll do Mouse dentro do mapa sem rolar a página externa
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      // Permite rolagem natural dentro dos painéis laterais da sidebar (Histórico de Dados / Iniciativa)
      if (e.target?.closest?.('[data-map-overlay-scroll]')) return;

      // Impede a rolagem vertical/horizontal da página
      e.preventDefault();

      const { min, max } = zoomBoundsRef.current;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      setZoom((z) => Math.min(max, Math.max(min, Math.round(z * factor * 1000) / 1000)));
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Pings de radar, controle de expiração de 5s e limite de 3 pings a cada 15 segundos
  const PING_MAX_CHARGES = 3;
  const PING_WINDOW_MS = 15000;
  const [pingCharges, setPingCharges] = useState(PING_MAX_CHARGES);
  const [pingWindowStart, setPingWindowStart] = useState(Date.now());
  const [localPings, setLocalPings] = useState([]);
  const [now, setNow] = useState(Date.now());

  // Ticker de 500ms para expiração dos pings e recarga da janela de sinalização
  useEffect(() => {
    const interval = setInterval(() => {
      const nowMs = Date.now();
      setNow(nowMs);
      if (nowMs - pingWindowStart >= PING_WINDOW_MS) {
        setPingCharges(PING_MAX_CHARGES);
        setPingWindowStart(nowMs);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [pingWindowStart]);

  const getPingTime = (p) => {
    if (!p) return 0;
    if (typeof p.createdAtMs === 'number') return p.createdAtMs;
    if (p.createdAt?.toMillis) return p.createdAt.toMillis();
    if (p.createdAt?.seconds) return p.createdAt.seconds * 1000;
    if (p.createdAt instanceof Date) return p.createdAt.getTime();
    if (typeof p.createdAt === 'string') return new Date(p.createdAt).getTime();
    return 0;
  };

  // Pings visíveis com expiração de 5s e desduplicação espacial/temporal estrita (sem ondas duplicadas)
  const visiblePings = useMemo(() => {
    const cutoff = now - 5000; // Dura no máximo 5 segundos (5000ms)
    const combined = [...pings, ...localPings].filter((p) => {
      if (p.event_type === 'dice_roll' || p.roll !== undefined) return false;
      if (p.map_id && map?.id && p.map_id !== map.id) return false;
      const t = getPingTime(p);
      return t >= cutoff && t <= now + 10000;
    });

    const deduped = [];
    for (const p of combined) {
      const pTime = getPingTime(p);
      const isDuplicate = deduped.some((existing) => {
        const eTime = getPingTime(existing);
        const dist = Math.hypot(p.x - existing.x, p.y - existing.y);
        return dist < 3.0 && Math.abs(pTime - eTime) < 4500;
      });
      if (!isDuplicate) {
        deduped.push(p);
      }
    }
    return deduped;
  }, [pings, localPings, now, map?.id]);

  // Sidebar do Mapa: Painéis contextuais integrados ('dice' | 'initiative' | 'effects' | null) & collapse mobile
  const MAX_ROLL_HISTORY = 15;
  const [sidebarPanel, setSidebarPanel] = useState(map?.combat_active ? 'initiative' : null);
  const [mobileRailOpen, setMobileRailOpen] = useState(true);

  // Atmosfera & Visibilidade do Mapa (Clima, Névoa, Escuridão, Tocha, Blackout)
  const [localEffects, setLocalEffects] = useState(() => normalizeMapEffects(map?.effects));
  const [previewEffectsAsPlayer, setPreviewEffectsAsPlayer] = useState(false);
  const [previewHeroTokenId, setPreviewHeroTokenId] = useState(null);
  const effectsSaveTimerRef = useRef(null);

  useEffect(() => {
    setLocalEffects(normalizeMapEffects(map?.effects));
  }, [map?.id, map?.effects]);

  useEffect(() => {
    return () => {
      if (effectsSaveTimerRef.current) clearTimeout(effectsSaveTimerRef.current);
    };
  }, []);

  const hasAnyMapEffect =
    localEffects.weather !== 'none' ||
    localEffects.fog > 0 ||
    localEffects.darkness > 0 ||
    localEffects.blackout;

  const commitMapEffects = useCallback(
    (nextEffects, debounceMs = 0) => {
      const normalized = normalizeMapEffects(nextEffects);
      setLocalEffects(normalized);
      if (!isMaster || !onUpdateMap || !map?.id) return;

      if (effectsSaveTimerRef.current) {
        clearTimeout(effectsSaveTimerRef.current);
        effectsSaveTimerRef.current = null;
      }

      const persist = () => {
        onUpdateMap(map.id, { effects: normalized }).catch((err) => {
          toast.error(err?.message || 'Erro ao sincronizar efeitos do mapa.');
        });
      };

      if (debounceMs > 0) {
        effectsSaveTimerRef.current = setTimeout(persist, debounceMs);
      } else {
        persist();
      }
    },
    [isMaster, onUpdateMap, map?.id]
  );
  const [diceCount, setDiceCount] = useState(1);
  const [diceCountInput, setDiceCountInput] = useState('1');
  const [recentRoll, setRecentRoll] = useState(null);
  const [active3DRoll, setActive3DRoll] = useState(null);
  const [sharedBannerRoll, setSharedBannerRoll] = useState(null);
  const [rollingSeedKey, setRollingSeedKey] = useState(null);
  const [settledLocalRolls, setSettledLocalRolls] = useState([]);
  const [clearingHistory, setClearingHistory] = useState(false);
  const processedRollKeysRef = useRef(new Set());
  const prevRemoteRollCountRef = useRef(0);
  const initialHistorySeededRef = useRef(false);
  const bannerTimerRef = useRef(null);

  const updateDiceCount = (nextVal) => {
    const clamped = Math.max(1, Math.min(20, Math.floor(Number(nextVal) || 1)));
    setDiceCount(clamped);
    setDiceCountInput(String(clamped));
  };

  const toggleSidebarPanel = (panel) => {
    setSidebarPanel((prev) => (prev === panel ? null : panel));
  };

  const showTopResultBanner = useCallback((rollObj) => {
    if (!rollObj) return;
    setSharedBannerRoll(rollObj);
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
    }
    bannerTimerRef.current = setTimeout(() => {
      setSharedBannerRoll((cur) => (cur?.seed === rollObj.seed ? null : cur));
    }, 4800);
  }, []);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, []);

  const getRollSeedKey = useCallback((r) => {
    if (!r) return '';
    return r.seed ? `${r.seed}_${r.count || 1}d${r.sides}_${r.roll}` : String(r.id || '');
  }, []);

  const getRollTime = useCallback((r) => {
    if (!r) return 0;
    if (r.createdAt?.toMillis) return r.createdAt.toMillis();
    if (r.createdAt?.seconds) return r.createdAt.seconds * 1000;
    if (typeof r.createdAtMs === 'number') return r.createdAtMs;
    if (r.createdAt instanceof Date) return r.createdAt.getTime();
    if (typeof r.createdAt === 'string') return new Date(r.createdAt).getTime();
    return Date.now();
  }, []);

  // Consolida rolagens vindas do canal em tempo real (map_pings com event_type === 'dice_roll' + map_rolls)
  const remoteDiceRolls = useMemo(() => {
    const fromPings = (pings || []).filter(
      (p) => p.event_type === 'dice_roll' || (p.roll !== undefined && p.sides !== undefined)
    );
    const fromRolls = diceRolls || [];
    const merged = [...fromPings, ...fromRolls];
    merged.sort((a, b) => getRollTime(b) - getRollTime(a));
    return merged;
  }, [pings, diceRolls, getRollTime]);

  // Marca o carregamento inicial após 800ms caso a mesa comece com 0 rolagens
  useEffect(() => {
    const timer = setTimeout(() => {
      initialHistorySeededRef.current = true;
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // Chamado pelo TacticalDice3D exatamente quando o dado 3D da própria pessoa para de rolar
  const handleRollSettled = useCallback(
    async (settledRoll) => {
      if (!settledRoll) return;
      const key = getRollSeedKey(settledRoll);
      setRollingSeedKey((prev) => (prev === key ? null : prev));
      setRecentRoll(settledRoll);
      showTopResultBanner(settledRoll);
      setSettledLocalRolls((prev) => {
        const filtered = prev.filter((item) => getRollSeedKey(item) !== key);
        return [settledRoll, ...filtered].slice(0, MAX_ROLL_HISTORY);
      });
      try {
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate(
            settledRoll.is_max ? [40, 60, 100] : settledRoll.is_fumble ? [80, 40, 80] : 25
          );
        }
      } catch {}

      // Transmite o resultado consolidado para todos os outros jogadores e Mestre exatamente quando os dados param
      if (onDiceRoll && map?.id) {
        try {
          await onDiceRoll({
            map_id: map.id,
            user_id: settledRoll.user_id || currentUserId,
            user_name: settledRoll.user_name || currentUserName || (isMaster ? 'Mestre' : 'Aventureiro'),
            user_role: settledRoll.user_role || (isMaster ? 'master' : 'player'),
            sides: settledRoll.sides,
            count: settledRoll.count || 1,
            results: settledRoll.results || [settledRoll.roll],
            roll: settledRoll.roll,
            seed: settledRoll.seed,
          });
        } catch (err) {
          console.error('Erro ao sincronizar resultado de dado:', err);
        }
      }
    },
    [getRollSeedKey, showTopResultBanner, onDiceRoll, map?.id, currentUserId, currentUserName, isMaster]
  );

  // Ouve resultados em tempo real de outros jogadores ou Mestre (exibe banner no topo + histórico para todos, sem conflito de dado 3D)
  useEffect(() => {
    const currentLen = remoteDiceRolls ? remoteDiceRolls.length : 0;

    // Se o Mestre limpou todo o histórico no Firestore (transição de >0 para 0), zera também o estado local de todos
    if (currentLen === 0) {
      if (prevRemoteRollCountRef.current > 0) {
        setSettledLocalRolls([]);
        setRecentRoll(null);
        setSharedBannerRoll(null);
        processedRollKeysRef.current.clear();
      }
      prevRemoteRollCountRef.current = 0;
      return;
    }

    prevRemoteRollCountRef.current = currentLen;

    // No primeiro snapshot ao abrir a página, registra o histórico existente sem disparar banner antigo
    if (!initialHistorySeededRef.current) {
      initialHistorySeededRef.current = true;
      remoteDiceRolls.forEach((r) => {
        if (r.id) processedRollKeysRef.current.add(r.id);
        const k = getRollSeedKey(r);
        if (k) processedRollKeysRef.current.add(k);
      });
      return;
    }

    const latest = remoteDiceRolls[0];
    if (!latest) return;

    const seedKey = getRollSeedKey(latest);
    if (
      (latest.id && processedRollKeysRef.current.has(latest.id)) ||
      (seedKey && processedRollKeysRef.current.has(seedKey))
    ) {
      return;
    }

    if (latest.id) processedRollKeysRef.current.add(latest.id);
    if (seedKey) processedRollKeysRef.current.add(seedKey);

    // Exibe o banner de resultado na parte de cima para todos os outros participantes (o dado 3D só aparece para quem girou)
    showTopResultBanner(latest);
  }, [remoteDiceRolls, getRollSeedKey, showTopResultBanner]);

  // Histórico Lateral Sincronizado das últimas 15 rolagens de toda a mesa (exclui o dado que ainda está girando)
  const rollHistory = useMemo(() => {
    const combined = [...settledLocalRolls, ...remoteDiceRolls];
    const seenKeys = new Set();
    const deduped = [];

    for (const r of combined) {
      const key = getRollSeedKey(r);
      if (!key || seenKeys.has(key)) continue;
      // Oculta do histórico enquanto o dado ainda está rolando na mesa
      if (rollingSeedKey && key === rollingSeedKey) continue;
      seenKeys.add(key);
      deduped.push(r);
    }

    deduped.sort((a, b) => getRollTime(b) - getRollTime(a));
    // Limite estrito das últimas 15 rolagens: toda vez que entra uma nova, a 15ª mais antiga sai
    return deduped.slice(0, MAX_ROLL_HISTORY);
  }, [remoteDiceRolls, settledLocalRolls, rollingSeedKey, getRollSeedKey, getRollTime]);

  const handleClearDiceHistory = async () => {
    if (!isMaster || clearingHistory) return;
    if (rollHistory.length === 0 && !recentRoll) return;
    if (!confirm('Limpar todo o histórico de rolagens de dados da mesa para todos os jogadores?')) {
      return;
    }
    setClearingHistory(true);
    try {
      if (onClearDiceHistory) {
        await onClearDiceHistory();
      }
      setSettledLocalRolls([]);
      setRecentRoll(null);
      setSharedBannerRoll(null);
      processedRollKeysRef.current.clear();
    } catch {
      // Erro já notificado pelo handler do Mestre
    } finally {
      setClearingHistory(false);
    }
  };

  useEffect(() => {
    setIsLocked(Boolean(map?.is_locked));
  }, [map?.is_locked]);

  // Limpa posições locais quando tokens externos mudam e não estamos arrastando
  useEffect(() => {
    if (!localDraggingId) {
      setLocalTokenPositions({});
    }
  }, [tokens, localDraggingId]);

  // Detecta tokens movidos ao vivo por outros jogadores/Mestre para exibir halo suave de movimento em tempo real
  const [remoteMovingTokens, setRemoteMovingTokens] = useState({});
  const prevRemotePosRef = useRef(new Map());
  const remoteMoveTimersRef = useRef(new Map());

  useEffect(() => {
    const prevMap = prevRemotePosRef.current;
    const activeIds = new Set();

    tokens.forEach((t) => {
      activeIds.add(t.id);
      const nx = Number(t.x);
      const ny = Number(t.y);
      if (!Number.isFinite(nx) || !Number.isFinite(ny)) return;

      const prev = prevMap.get(t.id);
      if (
        prev &&
        localDraggingId !== t.id &&
        (Math.abs(nx - prev.x) >= 0.05 || Math.abs(ny - prev.y) >= 0.05)
      ) {
        setRemoteMovingTokens((cur) => (cur[t.id] ? cur : { ...cur, [t.id]: true }));
        const existingTimer = remoteMoveTimersRef.current.get(t.id);
        if (existingTimer) clearTimeout(existingTimer);
        const timer = setTimeout(() => {
          remoteMoveTimersRef.current.delete(t.id);
          setRemoteMovingTokens((cur) => {
            if (!cur[t.id]) return cur;
            const next = { ...cur };
            delete next[t.id];
            return next;
          });
        }, 420);
        remoteMoveTimersRef.current.set(t.id, timer);
      }
      prevMap.set(t.id, { x: nx, y: ny });
    });

    for (const id of Array.from(prevMap.keys())) {
      if (!activeIds.has(id)) prevMap.delete(id);
    }
  }, [tokens, localDraggingId]);

  useEffect(() => {
    const timersMap = remoteMoveTimersRef.current;
    return () => {
      if (draggingTokenRef.current?.trailingTimer) {
        clearTimeout(draggingTokenRef.current.trailingTimer);
      }
      timersMap.forEach((timer) => clearTimeout(timer));
      timersMap.clear();
    };
  }, []);

  // Controle de Zoom (suporta escalas exatas de imagens pequenas até mapas 4K/8K)
  const handleZoomIn = () => {
    const { min, max } = zoomBoundsRef.current;
    setZoom((z) => Math.min(max, Math.max(min, Math.round(z * 1.15 * 1000) / 1000)));
  };
  const handleZoomOut = () => {
    const { min, max } = zoomBoundsRef.current;
    setZoom((z) => Math.min(max, Math.max(min, Math.round((z / 1.15) * 1000) / 1000)));
  };
  const handleResetView = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // Travar / Destravar Mapa
  const handleToggleLock = async () => {
    const nextLocked = !isLocked;
    setIsLocked(nextLocked);
    if (isMaster && onUpdateMap && map?.id) {
      await onUpdateMap(map.id, { is_locked: nextLocked });
      toast.success(nextLocked ? 'Visualização do mapa fixada.' : 'Mapa destravado para movimentação.');
    }
  };

  // Pan do Mapa com o mouse (quando mapa não está travado)
  const handleMapPointerDown = (e) => {
    // Em modo Régua ou Ping, ignora cliques nos tokens para medir/sinalizar livremente mesmo em cima de heróis
    if (activeTool === 'ruler') {
      if (rulerClearTimerRef.current) {
        clearTimeout(rulerClearTimerRef.current);
        rulerClearTimerRef.current = null;
      }
      const rect = mapImageRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      setRulerStart({ x, y });
      setRulerCurrent({ x, y });
      e.currentTarget.setPointerCapture?.(e.pointerId);
      return;
    }

    if (activeTool === 'ping') {
      const rect = mapImageRef.current?.getBoundingClientRect();
      if (!rect) return;

      const nowMs = Date.now();
      let currentCharges = pingCharges;
      let windowStart = pingWindowStart;

      if (nowMs - windowStart >= PING_WINDOW_MS) {
        currentCharges = PING_MAX_CHARGES;
        windowStart = nowMs;
        setPingWindowStart(nowMs);
      }

      if (currentCharges <= 0) {
        const secondsLeft = Math.max(1, Math.ceil((PING_WINDOW_MS - (nowMs - windowStart)) / 1000));
        toast.warning(`Limite de 3 sinalizações atingido. Recarregando em ${secondsLeft}s.`);
        return;
      }

      setPingCharges(currentCharges - 1);

      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

      if (onPing) {
        onPing({ x, y });
        toast.info(`Sinalizador emitido (${currentCharges - 1} restantes nesta janela)!`);
      } else {
        const localPing = {
          id: 'local-' + Date.now() + '-' + Math.random(),
          map_id: map?.id,
          x,
          y,
          user_name: isMaster ? 'Mestre' : 'Aventureiro',
          color: isMaster ? '#f59e0b' : '#38bdf8',
          createdAtMs: Date.now(),
        };
        setLocalPings((prev) => [...prev, localPing]);
      }
      return;
    }

    if (e.target.closest('[data-token-element]')) return;

    if (!isLocked) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
  };

  const handleMapPointerMove = (e) => {
    if (activeTool === 'ruler' && rulerStart) {
      const rect = mapImageRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      setRulerCurrent({ x, y });
      return;
    }

    if (isPanning && !isLocked) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
    }
  };

  const handleMapPointerUp = (e) => {
    if (activeTool === 'ruler') {
      try {
        e.currentTarget.releasePointerCapture?.(e.pointerId);
      } catch {}
      if (rulerClearTimerRef.current) clearTimeout(rulerClearTimerRef.current);
      rulerClearTimerRef.current = setTimeout(() => {
        setRulerStart(null);
        setRulerCurrent(null);
      }, 4500);
    }
    if (isPanning) {
      setIsPanning(false);
      try {
        e.currentTarget.releasePointerCapture?.(e.pointerId);
      } catch {}
    }
  };

  // Drag and Drop de Tokens
  const canMoveToken = useCallback(
    (token) => {
      if (activeTool !== 'select') return false;
      if (isMaster) return true;
      if (!token) return false;
      return token.owner_id === currentUserId || token.character_id === currentUserId;
    },
    [activeTool, isMaster, currentUserId]
  );

  // Transmissão contínua ao vivo da posição do token enquanto o usuário segura e arrasta (sem precisar soltar o mouse)
  const LIVE_DRAG_INTERVAL_MS = 85;
  const LIVE_DRAG_MIN_DELTA_PCT = 0.08;

  const flushLiveTokenDrag = useCallback(
    (dragState) => {
      if (!dragState || dragState.cancelled || !onUpdateTokenPosition) return;

      const dx = Math.abs(dragState.latestX - dragState.lastSentX);
      const dy = Math.abs(dragState.latestY - dragState.lastSentY);
      if (dx < LIVE_DRAG_MIN_DELTA_PCT && dy < LIVE_DRAG_MIN_DELTA_PCT) return;

      if (dragState.inFlight) {
        if (!dragState.trailingTimer) {
          dragState.trailingTimer = setTimeout(() => {
            dragState.trailingTimer = null;
            flushLiveTokenDrag(dragState);
          }, LIVE_DRAG_INTERVAL_MS);
        }
        return;
      }

      const nowMs = Date.now();
      const elapsed = nowMs - dragState.lastSentAt;
      if (dragState.lastSentAt > 0 && elapsed < LIVE_DRAG_INTERVAL_MS) {
        if (!dragState.trailingTimer) {
          dragState.trailingTimer = setTimeout(() => {
            dragState.trailingTimer = null;
            flushLiveTokenDrag(dragState);
          }, LIVE_DRAG_INTERVAL_MS - elapsed);
        }
        return;
      }

      if (dragState.trailingTimer) {
        clearTimeout(dragState.trailingTimer);
        dragState.trailingTimer = null;
      }

      const sendX = dragState.latestX;
      const sendY = dragState.latestY;
      dragState.inFlight = true;
      dragState.lastSentAt = nowMs;
      dragState.lastSentX = sendX;
      dragState.lastSentY = sendY;

      Promise.resolve(
        onUpdateTokenPosition(dragState.tokenId, {
          x: sendX,
          y: sendY,
        })
      )
        .catch(() => {})
        .finally(() => {
          dragState.inFlight = false;
          if (
            !dragState.cancelled &&
            draggingTokenRef.current === dragState &&
            (Math.abs(dragState.latestX - dragState.lastSentX) >= LIVE_DRAG_MIN_DELTA_PCT ||
              Math.abs(dragState.latestY - dragState.lastSentY) >= LIVE_DRAG_MIN_DELTA_PCT)
          ) {
            flushLiveTokenDrag(dragState);
          }
        });
    },
    [onUpdateTokenPosition]
  );

  const handleTokenPointerDown = (token, e) => {
    // Proteção absoluta: em modo Régua ou Ping, nunca move nem captura o token
    if (activeTool !== 'select') return;
    e.stopPropagation();
    if (!canMoveToken(token)) {
      toast.error('Você só pode mover o seu próprio herói.');
      return;
    }

    const rect = mapImageRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;

    // Posição exata do clique em % do mapa (0 a 100%)
    const clickPctX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickPctY = ((e.clientY - rect.top) / rect.height) * 100;

    const curX = Number(localTokenPositions[token.id]?.x ?? token.x ?? 50);
    const curY = Number(localTokenPositions[token.id]?.y ?? token.y ?? 50);

    // Offset de pegada: preserva exatamente onde o mouse clicou dentro do token
    const grabOffsetX = clickPctX - curX;
    const grabOffsetY = clickPctY - curY;

    if (draggingTokenRef.current?.trailingTimer) {
      clearTimeout(draggingTokenRef.current.trailingTimer);
    }

    draggingTokenRef.current = {
      tokenId: token.id,
      grabOffsetX,
      grabOffsetY,
      startX: e.clientX,
      startY: e.clientY,
      hasMoved: false,
      latestX: curX,
      latestY: curY,
      lastSentX: curX,
      lastSentY: curY,
      lastSentAt: 0,
      inFlight: false,
      trailingTimer: null,
      cancelled: false,
    };
    setLocalDraggingId(token.id);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handleTokenPointerMove = (token, e) => {
    const dragState = draggingTokenRef.current;
    if (!dragState || dragState.tokenId !== token.id) return;
    e.stopPropagation();

    const rect = mapImageRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;

    const { grabOffsetX, grabOffsetY, startX, startY } = dragState;
    if (Math.abs(e.clientX - startX) > 2 || Math.abs(e.clientY - startY) > 2) {
      dragState.hasMoved = true;
    }

    // Posição atual do cursor em % real do mapa neste frame
    const pointerPctX = ((e.clientX - rect.left) / rect.width) * 100;
    const pointerPctY = ((e.clientY - rect.top) / rect.height) * 100;

    // Subtrai o offset de clique inicial para que o token acompanhe exatamente a pegada do mouse
    let newPctX = pointerPctX - grabOffsetX;
    let newPctY = pointerPctY - grabOffsetY;

    // Grid snap calibrado com o tamanho nativo do mapa (independente de zoom)
    if (snapToGrid && gridSize > 0 && mapDisplaySize.width > 0 && mapDisplaySize.height > 0) {
      const gridPctW = (gridSize / mapDisplaySize.width) * 100;
      const gridPctH = (gridSize / mapDisplaySize.height) * 100;
      newPctX = Math.round(newPctX / gridPctW) * gridPctW;
      newPctY = Math.round(newPctY / gridPctH) * gridPctH;
    }

    // Permite alcançar qualquer ponto e canto exato do mapa (0% a 100%) com 4 casas decimais de precisão
    newPctX = Math.max(0, Math.min(100, Math.round(newPctX * 10000) / 10000));
    newPctY = Math.max(0, Math.min(100, Math.round(newPctY * 10000) / 10000));

    dragState.latestX = newPctX;
    dragState.latestY = newPctY;

    setLocalTokenPositions((prev) => ({
      ...prev,
      [token.id]: { x: newPctX, y: newPctY },
    }));

    // Assim que começar a arrastar (mesmo sem soltar o mouse), transmite ao vivo para todos na mesa!
    if (dragState.hasMoved) {
      flushLiveTokenDrag(dragState);
    }
  };

  const handleTokenPointerUp = async (token, e) => {
    const dragState = draggingTokenRef.current;
    if (!dragState || dragState.tokenId !== token.id) return;
    e.stopPropagation();

    const hasMoved = dragState.hasMoved;
    if (dragState.trailingTimer) {
      clearTimeout(dragState.trailingTimer);
      dragState.trailingTimer = null;
    }
    dragState.cancelled = true;

    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {}

    const finalPos = {
      x: dragState.latestX,
      y: dragState.latestY,
    };
    const needsFinalSync =
      Math.abs(finalPos.x - dragState.lastSentX) > 0.0001 ||
      Math.abs(finalPos.y - dragState.lastSentY) > 0.0001 ||
      dragState.inFlight ||
      dragState.lastSentAt === 0;
    draggingTokenRef.current = null;

    if (hasMoved && onUpdateTokenPosition) {
      justDraggedRef.current = true;
      setTimeout(() => {
        justDraggedRef.current = false;
      }, 150);

      const exactX = Math.max(0, Math.min(100, Math.round(Number(finalPos.x) * 10000) / 10000));
      const exactY = Math.max(0, Math.min(100, Math.round(Number(finalPos.y) * 10000) / 10000));

      try {
        if (needsFinalSync) {
          await onUpdateTokenPosition(token.id, {
            x: exactX,
            y: exactY,
          });
        }
      } catch (err) {
        toast.error('Erro ao sincronizar movimento do token.');
      } finally {
        setLocalDraggingId(null);
      }
    } else {
      setLocalDraggingId(null);
      setLocalTokenPositions((prev) => {
        const next = { ...prev };
        delete next[token.id];
        return next;
      });
    }
  };

  // Clique no Token para abrir detalhes/edição (bloqueado no modo Régua/Ping para evitar cliques acidentais)
  const handleTokenClick = (token, e) => {
    if (activeTool !== 'select') return;
    e.stopPropagation();
    if (justDraggedRef.current) return;
    setSelectedTokenId(token.id);
    setInspectModalOpen(true);
  };

  // Rolador Rápido de Dados (1 a 20 dados simultâneos, ex: d20, 3d20, 4d4) com Simulação 3D e Transmissão em Tempo Real
  const rollDice = async (sides, explicitCount = null) => {
    const validSides = [4, 6, 8, 10, 12, 20].includes(Number(sides)) ? Number(sides) : 20;
    const safeCount = Math.max(
      1,
      Math.min(20, Math.floor(Number(explicitCount ?? diceCount) || 1))
    );

    // Probabilidade 100% matemática uniforme (1 a N) para cada dado
    const results = [];
    for (let i = 0; i < safeCount; i += 1) {
      results.push(Math.floor(Math.random() * validSides) + 1);
    }

    const total = results.reduce((acc, v) => acc + v, 0);
    const maxHits = results.filter((v) => v === validSides).length;
    const fumbleHits = validSides === 20 ? results.filter((v) => v === 1).length : 0;
    const allMax = results.every((v) => v === validSides);
    const allFumble = validSides === 20 && results.every((v) => v === 1);

    const isCrit = validSides === 20 && maxHits > 0;
    const isMax = safeCount === 1 ? results[0] === validSides : allMax || isCrit;
    const isFumble = validSides === 20 && allFumble;
    const formula = safeCount > 1 ? `${safeCount}d${validSides}` : `d${validSides}`;
    const seed = Math.random();

    const nowMs = Date.now();
    const localRoll = {
      id: `local-${nowMs}-${Math.random()}`,
      map_id: map?.id,
      user_id: currentUserId,
      user_name: currentUserName || (isMaster ? 'Mestre' : 'Aventureiro'),
      user_role: isMaster ? 'master' : 'player',
      sides: validSides,
      count: safeCount,
      results,
      roll: total,
      total,
      formula,
      max_hits: maxHits,
      fumble_hits: fumbleHits,
      all_max: allMax,
      seed,
      is_max: isMax,
      is_crit: isCrit,
      is_fumble: isFumble,
      isMax,
      isCrit,
      isFumble,
      createdAtMs: nowMs,
      createdAt: { toMillis: () => nowMs },
    };

    const seedKey = `${seed}_${safeCount}d${validSides}_${total}`;
    processedRollKeysRef.current.add(localRoll.id);
    processedRollKeysRef.current.add(seedKey);
    // Os dados 3D rodam para quem arremessou; o resultado consolidado e a transmissão para todos ocorrem em handleRollSettled
    setRollingSeedKey(seedKey);
    setActive3DRoll(localRoll);
  };

  // Regras de visibilidade em tempo real (Vida oculta p/ monstros não-aliados; Nome oculto até Mestre revelar)
  const canViewTokenHp = useCallback(
    (token) => {
      if (!token) return false;
      if (isMaster) return true;
      if (token.type === 'player') return true;
      return Boolean(token.is_ally);
    },
    [isMaster]
  );

  const isTokenNameHiddenForViewer = useCallback(
    (token) => {
      if (!token || isMaster) return false;
      return Boolean(token.name_hidden);
    },
    [isMaster]
  );

  const getVisibleTokenName = useCallback(
    (token, longFallback = false) => {
      if (!token) return '';
      if (isTokenNameHiddenForViewer(token)) {
        return longFallback ? 'Criatura Desconhecida' : '???';
      }
      return token.name;
    },
    [isTokenNameHiddenForViewer]
  );

  // Tokens visíveis (Mestre vê todos; jogadores não veem tokens com hidden === true)
  const visibleTokens = useMemo(
    () => tokens.filter((t) => (isMaster ? true : !t.hidden)),
    [tokens, isMaster]
  );

  // Tokens de herói no mapa (para o jogador identificar seu próprio token e para o Mestre testar a prévia por herói)
  const heroTokensOnMap = useMemo(
    () => visibleTokens.filter((t) => t.type === 'player'),
    [visibleTokens]
  );

  const activeViewerTokenId = useMemo(() => {
    if (!isMaster) {
      const own = visibleTokens.find(
        (t) => t.owner_id === currentUserId || t.character_id === currentUserId
      );
      return own?.id || null;
    }
    if (previewEffectsAsPlayer) {
      if (previewHeroTokenId && heroTokensOnMap.some((t) => t.id === previewHeroTokenId)) {
        return previewHeroTokenId;
      }
      return heroTokensOnMap[0]?.id || null;
    }
    return null;
  }, [isMaster, visibleTokens, currentUserId, previewEffectsAsPlayer, previewHeroTokenId, heroTokensOnMap]);

  // Motor geométrico unificado de Escuridão (>= 60% oculta players fora da luz) + Iluminação por Proximidade (parcial vs. juntos)
  const lightingState = useMemo(
    () =>
      computeViewerLightingState({
        tokens: visibleTokens,
        localTokenPositions,
        effects: localEffects,
        isMaster,
        previewAsPlayer: previewEffectsAsPlayer,
        viewerTokenId: activeViewerTokenId,
        mapWidth: mapDisplaySize.width,
        mapHeight: mapDisplaySize.height,
      }),
    [
      visibleTokens,
      localTokenPositions,
      localEffects,
      isMaster,
      previewEffectsAsPlayer,
      activeViewerTokenId,
      mapDisplaySize.width,
      mapDisplaySize.height,
    ]
  );

  const customLightTokensCount = useMemo(
    () =>
      visibleTokens.filter(
        (tok) => typeof tok.light_radius === 'number' && Number.isFinite(tok.light_radius)
      ).length,
    [visibleTokens]
  );

  // Ordenação de iniciativa para combate
  const initiativeOrder = [...visibleTokens].sort((a, b) => (b.initiative || 0) - (a.initiative || 0));

  const handleNextTurn = async () => {
    if (!isMaster || !onUpdateMap || initiativeOrder.length === 0) return;
    const currentIdx = initiativeOrder.findIndex((t) => t.id === map?.current_turn_token_id);
    const nextToken = initiativeOrder[(currentIdx + 1) % initiativeOrder.length];
    await onUpdateMap(map.id, { current_turn_token_id: nextToken?.id || null });
    toast.info(`Turno de: ${nextToken?.name || 'Próximo'}`);
  };

  // Distância da régua em metros/pés
  const rulerDistance = rulerStart && rulerCurrent
    ? Math.round(
        Math.sqrt(
          Math.pow(rulerCurrent.x - rulerStart.x, 2) + Math.pow(rulerCurrent.y - rulerStart.y, 2)
        ) * 0.3 * 10
      ) / 10
    : 0;

  return (
    <div
      className={cn(
        'relative flex w-full overflow-hidden bg-[#070913] select-none transition-all',
        fullViewport
          ? 'flex-1 h-full min-h-0'
          : 'h-[calc(100dvh-13rem)] min-h-[480px] xl:h-[76vh] xl:min-h-[540px] rounded-2xl border border-white/10 shadow-2xl'
      )}
      style={{
        backgroundImage: 'radial-gradient(circle at 50% 50%, #0d121f 0%, #06080e 100%)',
        boxShadow: fullViewport
          ? undefined
          : 'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 24px 60px -12px rgba(0, 0, 0, 0.85)',
      }}
    >
      {/* SIDEBAR LATERAL DE FERRAMENTAS TÁTICAS DO MAPA (HARMONIOSA, RESPONSIVA E NEUTRA) */}
      <aside
        aria-label="Ferramentas do Mapa"
        className={cn(
          'relative z-40 flex flex-col items-center justify-between shrink-0 border-r border-white/10 bg-[#0a0d16]/95 backdrop-blur-2xl transition-all duration-200',
          'shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)]',
          mobileRailOpen
            ? 'w-[52px] sm:w-[58px] xl:w-[62px] py-2.5 px-1.5 overflow-y-auto md:overflow-visible'
            : 'w-0 overflow-hidden border-r-0 p-0 md:w-[58px] xl:w-[62px] md:overflow-visible md:border-r md:py-2.5 md:px-1.5'
        )}
      >
        {/* Bloco Superior: Ferramentas, Mapa & Painéis */}
        <div className="flex flex-col items-center gap-1.5 w-full">
          {/* Recolher barra no mobile */}
          <button
            type="button"
            onClick={() => {
              setSidebarPanel(null);
              setMobileRailOpen(false);
            }}
            aria-label="Recolher barra lateral do mapa"
            title="Recolher ferramentas"
            className="md:hidden h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors mb-0.5"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>

          {/* Grupo 1: Ferramentas de Interação */}
          <div className="flex flex-col items-center gap-1 w-full">
            <div className="relative group flex justify-center w-full">
              <button
                type="button"
                onClick={() => setActiveTool('select')}
                aria-label="Mover bonequinhos"
                aria-pressed={activeTool === 'select'}
                title="Selecionar e mover bonequinhos"
                className={cn(
                  'h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center transition-all border',
                  activeTool === 'select'
                    ? 'bg-white/15 text-white border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                    : 'text-slate-300 hover:text-white hover:bg-white/10 border-transparent'
                )}
              >
                <Move className="h-4 w-4 text-slate-300" />
              </button>
              <span className="hidden md:block pointer-events-none opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-50 px-2.5 py-1 rounded-lg bg-[#0c101b]/95 border border-white/15 text-[11px] font-semibold text-white whitespace-nowrap shadow-xl backdrop-blur-xl">
                Mover Tokens
              </span>
            </div>

            <div className="relative group flex justify-center w-full">
              <button
                type="button"
                onClick={() => setActiveTool((t) => (t === 'ruler' ? 'select' : 'ruler'))}
                aria-label="Régua tática"
                aria-pressed={activeTool === 'ruler'}
                title="Medir distância em metros/pés"
                className={cn(
                  'h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center transition-all border',
                  activeTool === 'ruler'
                    ? 'bg-white/15 text-white border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                    : 'text-slate-300 hover:text-white hover:bg-white/10 border-transparent'
                )}
              >
                <Ruler className="h-4 w-4 text-slate-300" />
              </button>
              <span className="hidden md:block pointer-events-none opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-50 px-2.5 py-1 rounded-lg bg-[#0c101b]/95 border border-white/15 text-[11px] font-semibold text-white whitespace-nowrap shadow-xl backdrop-blur-xl">
                Régua de Distância
              </span>
            </div>

            <div className="relative group flex justify-center w-full">
              <button
                type="button"
                onClick={() => setActiveTool((t) => (t === 'ping' ? 'select' : 'ping'))}
                aria-label="Sinalizar radar"
                aria-pressed={activeTool === 'ping'}
                title={`Sinalizar radar (${pingCharges}/3 disponíveis a cada 15s)`}
                className={cn(
                  'relative h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center transition-all border',
                  activeTool === 'ping'
                    ? 'bg-white/15 text-white border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                    : 'text-slate-300 hover:text-white hover:bg-white/10 border-transparent'
                )}
              >
                <Crosshair className="h-4 w-4 text-slate-300" />
                <span
                  className={cn(
                    'absolute -bottom-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-mono font-bold border flex items-center justify-center leading-none',
                    pingCharges > 0
                      ? 'bg-[#0c101b] border-white/20 text-slate-200'
                      : 'bg-rose-950 border-rose-500/50 text-rose-300'
                  )}
                >
                  {pingCharges}
                </span>
              </button>
              <span className="hidden md:block pointer-events-none opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-50 px-2.5 py-1 rounded-lg bg-[#0c101b]/95 border border-white/15 text-[11px] font-semibold text-white whitespace-nowrap shadow-xl backdrop-blur-xl">
                Sinalizar ({pingCharges}/3)
              </span>
            </div>
          </div>

          <div className="w-7 h-px bg-white/10 my-0.5 shrink-0" />

          {/* Grupo 2: Controle do Mapa (Bloquear, Grade, Enquadrar) */}
          <div className="flex flex-col items-center gap-1 w-full">
            <div className="relative group flex justify-center w-full">
              <button
                type="button"
                onClick={handleToggleLock}
                aria-label={isLocked ? 'Destravar mapa' : 'Bloquear mapa'}
                aria-pressed={isLocked}
                title={
                  isLocked
                    ? 'Mapa bloqueado: arraste tokens sem mover o fundo'
                    : 'Mapa livre: clique para bloquear a posição do mapa'
                }
                className={cn(
                  'h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center transition-all border',
                  isLocked
                    ? 'bg-white/15 text-amber-300 border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                    : 'text-slate-300 hover:text-white hover:bg-white/10 border-transparent'
                )}
              >
                {isLocked ? (
                  <Lock className="h-4 w-4 text-amber-300" />
                ) : (
                  <Unlock className="h-4 w-4 text-slate-300" />
                )}
              </button>
              <span className="hidden md:block pointer-events-none opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-50 px-2.5 py-1 rounded-lg bg-[#0c101b]/95 border border-white/15 text-[11px] font-semibold text-white whitespace-nowrap shadow-xl backdrop-blur-xl">
                {isLocked ? 'Mapa Bloqueado' : 'Bloquear Mapa'}
              </span>
            </div>

            <div className="relative group flex justify-center w-full">
              <button
                type="button"
                onClick={() => setShowGrid((g) => !g)}
                aria-label="Alternar grade tática"
                aria-pressed={showGrid}
                title="Exibir ou ocultar grade tática"
                className={cn(
                  'h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center transition-all border',
                  showGrid
                    ? 'bg-white/15 text-white border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                    : 'text-slate-300 hover:text-white hover:bg-white/10 border-transparent'
                )}
              >
                <Grid className="h-4 w-4 text-slate-300" />
              </button>
              <span className="hidden md:block pointer-events-none opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-50 px-2.5 py-1 rounded-lg bg-[#0c101b]/95 border border-white/15 text-[11px] font-semibold text-white whitespace-nowrap shadow-xl backdrop-blur-xl">
                {showGrid ? 'Ocultar Grade' : 'Exibir Grade'}
              </span>
            </div>

            <div className="relative group flex justify-center w-full">
              <button
                type="button"
                onClick={handleFitToScreen}
                aria-label="Ajustar mapa à tela"
                title="Enquadrar mapa inteiro na tela"
                className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center transition-all border border-transparent text-slate-300 hover:text-white hover:bg-white/10"
              >
                <Maximize2 className="h-4 w-4 text-slate-300" />
              </button>
              <span className="hidden md:block pointer-events-none opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-50 px-2.5 py-1 rounded-lg bg-[#0c101b]/95 border border-white/15 text-[11px] font-semibold text-white whitespace-nowrap shadow-xl backdrop-blur-xl">
                Ajustar à Tela
              </span>
            </div>

            {isMaster && (
              <div className="relative group flex justify-center w-full">
                <button
                  type="button"
                  onClick={() => toggleSidebarPanel('effects')}
                  aria-label="Atmosfera, clima e visibilidade do mapa"
                  aria-expanded={sidebarPanel === 'effects'}
                  title="Efeitos do Mapa (Chuva, Tempestade, Névoa, Escuridão, Ocultar Mapa)"
                  className={cn(
                    'relative h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center transition-all border',
                    sidebarPanel === 'effects'
                      ? 'bg-white/15 text-white border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                      : 'text-slate-300 hover:text-white hover:bg-white/10 border-transparent'
                  )}
                >
                  <CloudRain className="h-4 w-4 text-slate-300" />
                  {hasAnyMapEffect && (
                    <span
                      className={cn(
                        'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0a0d16]',
                        localEffects.blackout ? 'bg-amber-400 animate-pulse' : 'bg-sky-400'
                      )}
                    />
                  )}
                </button>
                <span className="hidden md:block pointer-events-none opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-50 px-2.5 py-1 rounded-lg bg-[#0c101b]/95 border border-white/15 text-[11px] font-semibold text-white whitespace-nowrap shadow-xl backdrop-blur-xl">
                  Atmosfera &amp; Visibilidade
                </span>
              </div>
            )}
          </div>

          <div className="w-7 h-px bg-white/10 my-0.5 shrink-0" />

          {/* Grupo 3: Painéis da Mesa (Dados 3D + Histórico & Ordem de Combate) */}
          <div className="flex flex-col items-center gap-1 w-full">
            <div className="relative group flex justify-center w-full">
              <button
                type="button"
                onClick={() => toggleSidebarPanel('dice')}
                aria-label="Dados e histórico de rolagens"
                aria-expanded={sidebarPanel === 'dice'}
                title="Rolador de Dados 3D e Histórico da Mesa"
                className={cn(
                  'relative h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center transition-all border',
                  sidebarPanel === 'dice'
                    ? 'bg-white/15 text-white border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                    : 'text-slate-300 hover:text-white hover:bg-white/10 border-transparent'
                )}
              >
                <Dices className="h-4 w-4 text-slate-300" />
                {rollHistory.length > 0 && (
                  <span className="absolute -bottom-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#0c101b] border border-white/20 text-[9px] font-mono font-bold text-slate-200 flex items-center justify-center leading-none">
                    {rollHistory.length}
                  </span>
                )}
              </button>
              <span className="hidden md:block pointer-events-none opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-50 px-2.5 py-1 rounded-lg bg-[#0c101b]/95 border border-white/15 text-[11px] font-semibold text-white whitespace-nowrap shadow-xl backdrop-blur-xl">
                Dados &amp; Histórico
              </span>
            </div>

            <div className="relative group flex justify-center w-full">
              <button
                type="button"
                onClick={() => toggleSidebarPanel('initiative')}
                aria-label="Ordem de combate e iniciativa"
                aria-expanded={sidebarPanel === 'initiative'}
                title="Ordem de Iniciativa do Combate"
                className={cn(
                  'relative h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center transition-all border',
                  sidebarPanel === 'initiative'
                    ? 'bg-white/15 text-white border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                    : 'text-slate-300 hover:text-white hover:bg-white/10 border-transparent'
                )}
              >
                <Shield className="h-4 w-4 text-slate-300" />
                {initiativeOrder.length > 0 && (
                  <span className="absolute -bottom-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#0c101b] border border-white/20 text-[9px] font-mono font-bold text-slate-200 flex items-center justify-center leading-none">
                    {initiativeOrder.length}
                  </span>
                )}
              </button>
              <span className="hidden md:block pointer-events-none opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-50 px-2.5 py-1 rounded-lg bg-[#0c101b]/95 border border-white/15 text-[11px] font-semibold text-white whitespace-nowrap shadow-xl backdrop-blur-xl">
                Ordem de Combate ({initiativeOrder.length})
              </span>
            </div>

            {tabletopMusic && (
              <div className="relative group flex justify-center w-full">
                <button
                  type="button"
                  onClick={tabletopMusic.togglePanel}
                  aria-label={isMaster ? 'Abrir estúdio musical da mesa' : 'Abrir volume da música'}
                  aria-expanded={tabletopMusic.panelOpen}
                  title={isMaster ? 'Música & Playlist da Mesa' : 'Música & Volume'}
                  className={cn(
                    'relative h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center transition-all border',
                    tabletopMusic.panelOpen
                      ? 'bg-white/15 text-white border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                      : 'text-slate-300 hover:text-white hover:bg-white/10 border-transparent'
                  )}
                >
                  <Music className="h-4 w-4 text-slate-300" />
                  {tabletopMusic.isPlaying && (
                    <span
                      className={cn(
                        'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0a0d16]',
                        tabletopMusic.needsUnlock
                          ? 'bg-amber-400 animate-pulse'
                          : 'bg-emerald-400 animate-pulse'
                      )}
                    />
                  )}
                </button>
                <span className="hidden md:block pointer-events-none opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-50 px-2.5 py-1 rounded-lg bg-[#0c101b]/95 border border-white/15 text-[11px] font-semibold text-white whitespace-nowrap shadow-xl backdrop-blur-xl">
                  {isMaster ? 'Música & Playlist' : 'Música & Volume'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bloco Inferior: Controles Compactos de Zoom */}
        <div className="flex flex-col items-center gap-1 w-full pt-2 border-t border-white/10 shrink-0">
          <div className="relative group flex justify-center w-full">
            <button
              type="button"
              onClick={handleZoomIn}
              aria-label="Aumentar zoom do mapa"
              title="Aumentar zoom"
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <span className="hidden md:block pointer-events-none opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-50 px-2.5 py-1 rounded-lg bg-[#0c101b]/95 border border-white/15 text-[11px] font-semibold text-white whitespace-nowrap shadow-xl backdrop-blur-xl">
              Zoom +
            </span>
          </div>

          <button
            type="button"
            onClick={handleResetView}
            title="Restaurar zoom para 100%"
            aria-label="Zoom atual"
            className="w-full py-0.5 rounded-lg text-[10px] font-mono font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-colors text-center tabular-nums"
          >
            {Math.round(zoom * 100)}%
          </button>

          <div className="relative group flex justify-center w-full">
            <button
              type="button"
              onClick={handleZoomOut}
              aria-label="Diminuir zoom do mapa"
              title="Diminuir zoom"
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="hidden md:block pointer-events-none opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-50 px-2.5 py-1 rounded-lg bg-[#0c101b]/95 border border-white/15 text-[11px] font-semibold text-white whitespace-nowrap shadow-xl backdrop-blur-xl">
              Zoom -
            </span>
          </div>

          <div className="relative group flex justify-center w-full">
            <button
              type="button"
              onClick={handleResetView}
              aria-label="Restaurar visão (100%)"
              title="Restaurar visão (100%)"
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <span className="hidden md:block pointer-events-none opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-50 px-2.5 py-1 rounded-lg bg-[#0c101b]/95 border border-white/15 text-[11px] font-semibold text-white whitespace-nowrap shadow-xl backdrop-blur-xl">
              Restaurar (100%)
            </span>
          </div>
        </div>
      </aside>

      {/* VIEWPORT DO MAPA (OCUPA 100% DO ESPAÇO AO LADO DA SIDEBAR) */}
      <div ref={containerRef} className="relative flex-1 min-w-0 h-full overflow-hidden">
        {/* Botão Flutuante Mobile para reabrir a Sidebar quando recolhida */}
        {!mobileRailOpen && (
          <button
            type="button"
            onClick={() => setMobileRailOpen(true)}
            aria-label="Abrir barra lateral de ferramentas"
            title="Ferramentas do Mapa"
            className="md:hidden absolute top-3 left-3 z-30 h-10 w-10 rounded-xl bg-[#0c101b]/90 border border-white/15 text-slate-200 hover:text-white hover:bg-white/15 backdrop-blur-xl shadow-xl flex items-center justify-center"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}

        {/* PAINEL EXPANSÍVEL DA SIDEBAR: DADOS 3D & HISTÓRICO / ORDEM DE COMBATE */}
        {sidebarPanel && (
          <div
            data-map-overlay-scroll="true"
            className="absolute left-0 top-0 bottom-0 z-30 w-[264px] sm:w-[292px] max-w-[calc(100%-0.5rem)] bg-[#0a0d17]/94 backdrop-blur-2xl border-r border-white/12 shadow-[12px_0_40px_rgba(0,0,0,0.65)] flex flex-col overflow-hidden pointer-events-auto"
          >
            {sidebarPanel === 'dice' && (
              <>
                <div className="px-3.5 py-3 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Dices className="h-4 w-4 text-slate-300 shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-100 truncate">
                      Dados &amp; Histórico
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-1.5 py-0.5 rounded-full bg-white/10 border border-white/10 text-[10px] font-mono font-bold text-slate-300">
                      {rollHistory.length}/{MAX_ROLL_HISTORY}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSidebarPanel(null)}
                      aria-label="Fechar painel de dados"
                      className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Rolador Rápido 3D (1 dado em 1 clique ou múltiplos dados, ex: 3d20, 4d4) */}
                <div className="p-3.5 border-b border-white/10 space-y-3 shrink-0 bg-white/[0.02]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Rolador D&amp;D 3D
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-white/8 border border-white/12 text-[10px] font-mono font-bold text-slate-200">
                      {diceCount === 1 ? '1 dado' : `${diceCount} dados`}
                    </span>
                  </div>

                  {/* Seletor Intuitivo de Quantidade de Dados (1 a 20) */}
                  <div className="p-2 rounded-xl bg-[#0c101b] border border-white/12 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider pl-0.5">
                        Quantidade
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateDiceCount(diceCount - 1)}
                          disabled={diceCount <= 1}
                          aria-label="Diminuir quantidade de dados"
                          className="h-7 w-7 rounded-lg bg-white/8 border border-white/12 hover:bg-white/15 disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          inputMode="numeric"
                          aria-label="Quantidade de dados para rolar"
                          value={diceCountInput}
                          onChange={(e) => {
                            const raw = e.target.value;
                            setDiceCountInput(raw);
                            const parsed = parseInt(raw, 10);
                            if (Number.isFinite(parsed) && parsed >= 1) {
                              setDiceCount(Math.min(20, parsed));
                            }
                          }}
                          onBlur={() => updateDiceCount(diceCountInput)}
                          className="w-11 h-7 rounded-lg bg-[#0c101b] border border-white/15 text-center text-xs font-mono font-black text-white focus:outline-none focus:border-white/35 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => updateDiceCount(diceCount + 1)}
                          disabled={diceCount >= 20}
                          aria-label="Aumentar quantidade de dados"
                          className="h-7 w-7 rounded-lg bg-white/8 border border-white/12 hover:bg-white/15 disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Atalhos Rápidos de Quantidade (1x sempre em 1 toque) */}
                    <div className="grid grid-cols-6 gap-1">
                      {DICE_QUICK_COUNTS.map((qty) => {
                        const active = diceCount === qty;
                        return (
                          <button
                            key={qty}
                            type="button"
                            onClick={() => updateDiceCount(qty)}
                            title={qty === 1 ? 'Rolar 1 dado por vez' : `Rolar ${qty} dados de vez`}
                            className={cn(
                              'py-1 rounded-lg text-[10px] font-mono font-bold border transition-all text-center',
                              active
                                ? 'bg-white/18 border-white/35 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]'
                                : 'bg-white/[0.04] border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                            )}
                          >
                            {qty}x
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Grade de Poliedros (exibe d20 quando 1x, ou 3d20 / 4d4 quando múltiplos) */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {DICE_SIDES_LIST.map((sides) => {
                      const label = diceCount > 1 ? `${diceCount}d${sides}` : `d${sides}`;
                      return (
                        <button
                          key={sides}
                          type="button"
                          onClick={() => rollDice(sides)}
                          title={`Rolar ${label}`}
                          className="group py-2.5 px-2 rounded-xl bg-white/[0.06] border border-white/12 hover:bg-white/15 hover:border-white/25 active:scale-95 transition-all flex flex-col items-center justify-center gap-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                        >
                          <PolyhedronGlyph
                            sides={sides}
                            className="h-4 w-4 text-slate-300 group-hover:text-white transition-colors"
                          />
                          <span className="text-xs font-mono font-black text-white tracking-tight">
                            {diceCount > 1 ? (
                              <>
                                <span className="text-slate-300">{diceCount}</span>d{sides}
                              </>
                            ) : (
                              <>d{sides}</>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {rollingSeedKey && active3DRoll ? (
                    <div className="p-2.5 rounded-xl border border-white/15 bg-white/5 text-center animate-pulse">
                      <div className="text-[10px] uppercase font-bold text-slate-400">
                        Rolando {active3DRoll.formula || `d${active3DRoll.sides}`}...
                      </div>
                      <div className="text-xs font-bold font-mono text-slate-200 mt-0.5">
                        {(active3DRoll.count || 1) > 1
                          ? 'Aguardando dados pararem...'
                          : 'Aguardando dado parar...'}
                      </div>
                    </div>
                  ) : (
                    recentRoll && (() => {
                      const meta = normalizeRollMeta(recentRoll);
                      if (!meta) return null;
                      return (
                        <div
                          key={recentRoll.id || recentRoll.seed}
                          className={cn(
                            'p-2.5 rounded-xl border text-center transition-all animate-in fade-in zoom-in-95 space-y-1.5',
                            meta.isMax
                              ? 'bg-amber-500/15 border-amber-400/50 text-amber-200'
                              : meta.isFumble
                              ? 'bg-rose-500/15 border-rose-400/50 text-rose-200'
                              : 'bg-white/8 border-white/15 text-white'
                          )}
                        >
                          <div className="text-[10px] uppercase font-bold text-slate-400">
                            Último Resultado ({meta.formula})
                          </div>
                          <div className="text-2xl font-black font-mono leading-tight">
                            {meta.total}
                          </div>

                          {meta.results.length > 1 && (
                            <div className="flex flex-wrap items-center justify-center gap-1 pt-0.5">
                              {meta.results.map((val, i) => (
                                <span
                                  key={i}
                                  className={cn(
                                    'px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold border leading-none',
                                    val === meta.sides
                                      ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                                      : meta.sides === 20 && val === 1
                                      ? 'bg-rose-500/20 border-rose-400/50 text-rose-200'
                                      : 'bg-black/40 border-white/15 text-slate-200'
                                  )}
                                >
                                  {val}
                                </span>
                              ))}
                            </div>
                          )}

                          {meta.sides === 20 && meta.results.length > 1 && (
                            <div className="text-[10px] font-mono text-slate-300">
                              Maior: <span className="font-bold text-white">{meta.highest}</span> • Menor:{' '}
                              <span className="font-bold text-white">{meta.lowest}</span>
                            </div>
                          )}

                          {meta.isMax && (
                            <div className="text-[10px] font-bold text-amber-300">
                              {meta.count > 1 && !meta.allMax
                                ? 'Crítico Natural!'
                                : 'Sucesso Máximo!'}
                            </div>
                          )}
                          {meta.isFumble && (
                            <div className="text-[10px] font-bold text-rose-300">
                              Falha Crítica!
                            </div>
                          )}
                        </div>
                      );
                    })()
                  )}
                </div>

                {/* Histórico das últimas 15 rolagens */}
                <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 px-0.5 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Histórico da Mesa
                    </span>
                    {isMaster && (rollHistory.length > 0 || recentRoll) && (
                      <button
                        type="button"
                        onClick={handleClearDiceHistory}
                        disabled={clearingHistory}
                        title="Excluir todo o histórico de rolagens de dados da mesa"
                        aria-label="Limpar histórico de dados da mesa"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/[0.05] border border-white/12 hover:bg-rose-500/15 hover:border-rose-500/35 text-[10px] font-bold text-slate-300 hover:text-rose-300 disabled:opacity-40 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                        {clearingHistory ? 'Limpando...' : 'Limpar'}
                      </button>
                    )}
                  </div>

                  {rollingSeedKey && active3DRoll && (
                    <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-white/5 border border-white/15 animate-pulse">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">
                          {active3DRoll.user_name || 'Aventureiro'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Rolando {active3DRoll.formula || `d${active3DRoll.sides}`}...
                        </div>
                      </div>
                      <div className="h-7 w-7 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center font-mono text-xs font-bold text-slate-300">
                        ?
                      </div>
                    </div>
                  )}

                  {rollHistory.length === 0 && !rollingSeedKey ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      Nenhuma rolagem registrada ainda.
                    </div>
                  ) : (
                    rollHistory.map((item, idx) => {
                      const meta = normalizeRollMeta(item);
                      if (!meta) return null;
                      const itemKey = getRollSeedKey(item) || item.id || idx;

                      return (
                        <div
                          key={itemKey}
                          className={cn(
                            'flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl border transition-all',
                            meta.isMax
                              ? 'bg-amber-950/40 border-amber-400/40 text-amber-100'
                              : meta.isFumble
                              ? 'bg-rose-950/40 border-rose-400/40 text-rose-100'
                              : 'bg-white/[0.04] border-white/10 text-slate-200'
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-mono text-slate-500 shrink-0">
                                #{idx + 1}
                              </span>
                              <User className="h-3 w-3 text-slate-400 shrink-0" />
                              <span className="text-xs font-bold text-white truncate">
                                {item.user_name || 'Aventureiro'}
                              </span>
                            </div>
                            <div className="flex items-center flex-wrap gap-1.5 mt-0.5 pl-4">
                              <span className="text-[10px] font-mono font-bold text-slate-300">
                                {meta.formula}
                              </span>
                              {item.user_role === 'master' && (
                                <span className="text-[9px] px-1 rounded bg-white/10 text-slate-300 font-semibold">
                                  Mestre
                                </span>
                              )}
                              {meta.isMax && (
                                <span className="text-[9px] font-bold text-amber-300">
                                  {meta.count > 1 && !meta.allMax ? 'Crítico!' : 'Máximo!'}
                                </span>
                              )}
                              {meta.isFumble && (
                                <span className="text-[9px] font-bold text-rose-400">
                                  Falha!
                                </span>
                              )}
                            </div>

                            {meta.results.length > 1 && (
                              <div className="flex flex-wrap items-center gap-1 mt-1 pl-4">
                                {meta.results.map((val, rIdx) => (
                                  <span
                                    key={rIdx}
                                    className={cn(
                                      'px-1 py-0.2 rounded text-[9px] font-mono font-bold border leading-tight',
                                      val === meta.sides
                                        ? 'bg-amber-500/20 border-amber-400/45 text-amber-200'
                                        : meta.sides === 20 && val === 1
                                        ? 'bg-rose-500/20 border-rose-400/45 text-rose-200'
                                        : 'bg-black/35 border-white/10 text-slate-300'
                                    )}
                                  >
                                    {val}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div
                            className={cn(
                              'h-8 min-w-[2.25rem] px-2 rounded-lg flex items-center justify-center font-mono font-black text-sm shrink-0 border',
                              meta.isMax
                                ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                                : meta.isFumble
                                ? 'bg-rose-500/20 border-rose-400/50 text-rose-300'
                                : 'bg-white/10 border-white/15 text-white'
                            )}
                          >
                            {meta.total}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}

            {sidebarPanel === 'initiative' && (
              <>
                <div className="px-3.5 py-3 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Shield className="h-4 w-4 text-slate-300 shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-100 truncate">
                      Ordem de Combate
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-1.5 py-0.5 rounded-full bg-white/10 border border-white/10 text-[10px] font-mono font-bold text-slate-300">
                      {initiativeOrder.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSidebarPanel(null)}
                      aria-label="Fechar ordem de combate"
                      className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {isMaster && initiativeOrder.length > 0 && (
                  <div className="p-3 border-b border-white/10 shrink-0 bg-white/[0.02]">
                    <Button
                      size="sm"
                      onClick={handleNextTurn}
                      className="w-full h-9 text-xs gap-1.5"
                    >
                      Avançar Próximo Turno
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}

                <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
                  {initiativeOrder.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">
                      Nenhum token visível neste mapa.
                    </div>
                  ) : (
                    initiativeOrder.map((tok, index) => {
                      const isCurrentTurn = map?.current_turn_token_id === tok.id;
                      const showHp = canViewTokenHp(tok);
                      const displayName = getVisibleTokenName(tok, true);
                      const isAlliedNonPlayer = tok.type !== 'player' && Boolean(tok.is_ally);
                      const tokHpPct = Math.max(
                        0,
                        Math.min(100, Math.round(((tok.hp || 0) / (tok.max_hp || 1)) * 100))
                      );
                      return (
                        <button
                          key={tok.id}
                          type="button"
                          onClick={() => {
                            setSelectedTokenId(tok.id);
                            setInspectModalOpen(true);
                          }}
                          className={cn(
                            'w-full flex flex-col gap-1.5 p-2.5 rounded-xl border transition-all text-left',
                            isCurrentTurn
                              ? 'bg-amber-500/15 border-amber-400/50 text-white shadow-sm ring-1 ring-amber-400/25'
                              : 'bg-white/[0.04] border-white/10 text-slate-200 hover:bg-white/10'
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[10px] font-mono text-slate-500 shrink-0">
                                #{index + 1}
                              </span>
                              <span
                                className="h-2.5 w-2.5 rounded-full shrink-0"
                                style={{
                                  backgroundColor: isAlliedNonPlayer
                                    ? '#10b981'
                                    : tok.color || '#60a5fa',
                                }}
                              />
                              <span className="text-xs font-bold text-white truncate">
                                {displayName}
                              </span>
                              {isAlliedNonPlayer && (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 border border-emerald-400/35 text-[9px] font-bold text-emerald-300 shrink-0">
                                  Aliado
                                </span>
                              )}
                              {isMaster && tok.name_hidden && (
                                <EyeOff
                                  className="h-3 w-3 text-amber-300 shrink-0"
                                  title="Nome oculto para jogadores"
                                />
                              )}
                            </div>
                            {showHp ? (
                              <span className="font-mono text-[10px] text-slate-300 shrink-0">
                                {tok.hp}/{tok.max_hp} PV
                              </span>
                            ) : (
                              <span className="font-mono text-[10px] text-slate-500 shrink-0">
                                Vida oculta
                              </span>
                            )}
                          </div>
                          {showHp && (
                            <div className="w-full h-1.5 rounded-full bg-black/60 overflow-hidden border border-white/10">
                              <div
                                className={cn(
                                  'h-full transition-all duration-200',
                                  tokHpPct > 50
                                    ? 'bg-emerald-400'
                                    : tokHpPct > 25
                                    ? 'bg-amber-400'
                                    : 'bg-rose-500'
                                )}
                                style={{ width: `${tokHpPct}%` }}
                              />
                            </div>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}

            {sidebarPanel === 'effects' && isMaster && (
              <>
                <div className="px-3.5 py-3 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <CloudRain className="h-4 w-4 text-slate-300 shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-100 truncate">
                      Atmosfera &amp; Clima
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {hasAnyMapEffect && (
                      <button
                        type="button"
                        onClick={() =>
                          commitMapEffects({
                            weather: 'none',
                            fog: 0,
                            darkness: 0,
                            torchRadius: 0,
                            blackout: false,
                          })
                        }
                        title="Limpar todos os efeitos do mapa"
                        className="px-2 py-0.5 rounded-lg bg-white/[0.06] border border-white/12 hover:bg-white/15 text-[10px] font-bold text-slate-300 hover:text-white transition-colors"
                      >
                        Limpar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSidebarPanel(null)}
                      aria-label="Fechar painel de efeitos"
                      className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-4">
                  {/* Ações rápidas de Visibilidade / Cortina Secreta */}
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() =>
                        commitMapEffects({
                          ...localEffects,
                          blackout: !localEffects.blackout,
                        })
                      }
                      className={cn(
                        'w-full px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 transition-all',
                        localEffects.blackout
                          ? 'bg-amber-500/20 border-amber-400/55 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                          : 'bg-white/[0.05] border-white/15 text-slate-200 hover:bg-white/12 hover:text-white'
                      )}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        {localEffects.blackout ? (
                          <EyeOff className="h-4 w-4 text-amber-300 shrink-0" />
                        ) : (
                          <Eye className="h-4 w-4 text-slate-300 shrink-0" />
                        )}
                        <span className="truncate">
                          {localEffects.blackout ? 'Mapa Oculto (Revelar)' : 'Ocultar Mapa p/ Jogadores'}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'px-1.5 py-0.5 rounded-md text-[9px] font-mono uppercase shrink-0',
                          localEffects.blackout
                            ? 'bg-amber-400/25 text-amber-200'
                            : 'bg-white/10 text-slate-400'
                        )}
                      >
                        {localEffects.blackout ? 'ATIVO' : 'OFF'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPreviewEffectsAsPlayer((v) => !v)}
                      className={cn(
                        'w-full px-3 py-2 rounded-xl border text-[11px] font-semibold flex items-center justify-between gap-2 transition-all',
                        previewEffectsAsPlayer
                          ? 'bg-white/15 border-white/30 text-white'
                          : 'bg-[#0c101b] border-white/12 text-slate-300 hover:text-white hover:bg-white/10'
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-slate-300" />
                        Ver como Jogador
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {previewEffectsAsPlayer ? 'Prévia ON' : 'Visão Mestre'}
                      </span>
                    </button>

                    {/* Seletor de qual Herói pré-visualizar no modo Ver como Jogador */}
                    {previewEffectsAsPlayer && heroTokensOnMap.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-[#0c101b] border border-white/12 space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Testando campo de visão de:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {heroTokensOnMap.map((ht) => {
                            const selected = activeViewerTokenId === ht.id;
                            return (
                              <button
                                key={ht.id}
                                type="button"
                                onClick={() => setPreviewHeroTokenId(ht.id)}
                                className={cn(
                                  'px-2 py-1 rounded-lg border text-[10px] font-semibold truncate max-w-[120px] transition-all',
                                  selected
                                    ? 'bg-white/16 border-white/35 text-white'
                                    : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-white'
                                )}
                              >
                                {ht.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cenários Prontos em 1 clique */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Presets Rápidos
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {MAP_EFFECT_PRESETS.map((preset) => {
                        const isMatch =
                          localEffects.weather === preset.effects.weather &&
                          localEffects.fog === preset.effects.fog &&
                          localEffects.darkness === preset.effects.darkness &&
                          localEffects.torchRadius === preset.effects.torchRadius &&
                          localEffects.blackout === preset.effects.blackout;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => commitMapEffects(preset.effects)}
                            className={cn(
                              'px-2.5 py-2 rounded-xl border text-[11px] font-semibold text-left truncate transition-all',
                              isMatch
                                ? 'bg-white/16 border-white/35 text-white'
                                : 'bg-white/[0.04] border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                            )}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Clima */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Clima e Partículas
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {MAP_WEATHER_OPTIONS.map((opt) => {
                        const active = localEffects.weather === opt.id;
                        const WeatherIcon =
                          opt.id === 'rain'
                            ? CloudRain
                            : opt.id === 'storm'
                            ? GiLightningStorm
                            : opt.id === 'snow'
                            ? GiSnowflake2
                            : opt.id === 'embers'
                            ? GiCampfire
                            : opt.id === 'ash'
                            ? GiDustCloud
                            : opt.id === 'sandstorm'
                            ? GiSandstorm
                            : GiSun;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => commitMapEffects({ ...localEffects, weather: opt.id })}
                            className={cn(
                              'px-2.5 py-2 rounded-xl border text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5',
                              active
                                ? 'bg-white/16 border-white/35 text-white shadow-sm'
                                : 'bg-[#0c101b] border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                            )}
                          >
                            <WeatherIcon className="h-3.5 w-3.5 shrink-0" />
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sliders de Visibilidade (Névoa, Escuridão, Raio de Tocha Global) */}
                  <div className="p-3 rounded-xl bg-[#0c101b] border border-white/12 space-y-3.5">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                          <GiFog className="h-3.5 w-3.5 text-slate-300" />
                          Névoa / Neblina
                        </span>
                        <span className="font-mono font-bold text-slate-300 tabular-nums">
                          {localEffects.fog}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={localEffects.fog}
                        onChange={(e) =>
                          commitMapEffects({ ...localEffects, fog: Number(e.target.value) }, 180)
                        }
                        className="w-full h-1.5 rounded-full bg-white/15 accent-white cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-200">Escuridão / Penumbra</span>
                        <span className="font-mono font-bold text-slate-300 tabular-nums">
                          {localEffects.darkness}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={localEffects.darkness}
                        onChange={(e) =>
                          commitMapEffects({ ...localEffects, darkness: Number(e.target.value) }, 180)
                        }
                        className="w-full h-1.5 rounded-full bg-white/15 accent-white cursor-pointer"
                      />
                      {localEffects.darkness >= DARKNESS_BLIND_THRESHOLD && (
                        <div className="px-2 py-1 rounded-lg bg-violet-500/12 border border-violet-400/30 text-[10px] text-violet-200 leading-snug">
                          Escuridão ≥ {DARKNESS_BLIND_THRESHOLD}%: jogadores só enxergam a própria luz; veem luz alheia parcialmente se dentro do alcance, ou completa apenas andando juntos.
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                          <GiTorch className="h-3.5 w-3.5 text-amber-300" />
                          Tocha Global (Heróis)
                        </span>
                        <span className="font-mono font-bold text-slate-300 tabular-nums">
                          {localEffects.torchRadius > 0 ? `${localEffects.torchRadius}%` : 'Desligada'}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={60}
                        step={4}
                        value={localEffects.torchRadius}
                        onChange={(e) =>
                          commitMapEffects(
                            { ...localEffects, torchRadius: Number(e.target.value) },
                            180
                          )
                        }
                        className="w-full h-1.5 rounded-full bg-white/15 accent-white cursor-pointer"
                      />
                      <p className="text-[10px] text-slate-400 leading-snug">
                        Ilumina heróis sem tocha individual. Clique em qualquer token para definir luz própria sem ser sobrescrita.
                      </p>
                      {customLightTokensCount > 0 && (
                        <div className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-400/30 text-[10px] font-semibold text-amber-200 flex items-center gap-1.5">
                          <GiTorch className="h-3.5 w-3.5 text-amber-300 shrink-0" />
                          <span>
                            {customLightTokensCount} token(s) com iluminação individual protegida
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Atalho Rápido de Soundboard integrado ao clima */}
                  {tabletopMusic?.triggerSoundEffect && (
                    <div className="space-y-1.5 pt-1 border-t border-white/10">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Efeito Sonoro Rápido
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { id: 'thunder', label: 'Trovão', Icon: GiLightningStorm, color: '#38bdf8' },
                          { id: 'creaky_door', label: 'Porta', Icon: GiWoodenDoor, color: '#d97706' },
                          { id: 'sword', label: 'Espada', Icon: GiCrossedSwords, color: '#e2e8f0' },
                          { id: 'roar', label: 'Rugido', Icon: GiDragonHead, color: '#ef4444' },
                        ].map(({ id, label, Icon, color }) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => tabletopMusic.triggerSoundEffect(id)}
                            className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-white/[0.05] border border-white/12 hover:bg-white/15 text-[11px] font-semibold text-slate-200 hover:text-white active:scale-95 transition-all"
                          >
                            <Icon className="h-4 w-4 shrink-0" style={{ color }} />
                            <span>{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

      {/* BANNER SUPERIOR DE RESULTADO SINCRONIZADO PARA TODOS (EXIBIDO APENAS APÓS OS DADOS PARAREM DE ROLAR) */}
      {sharedBannerRoll && (() => {
        const meta = normalizeRollMeta(sharedBannerRoll);
        if (!meta) return null;
        return (
          <div
            key={getRollSeedKey(sharedBannerRoll)}
            className={cn(
              'pointer-events-auto absolute top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-2xl border shadow-2xl backdrop-blur-2xl transition-all duration-300 animate-in fade-in zoom-in-95 max-w-[min(92vw,460px)]',
              meta.isMax
                ? 'bg-amber-950/90 border-amber-400/70 text-amber-200 shadow-[0_0_35px_rgba(245,158,11,0.3)]'
                : meta.isFumble
                ? 'bg-rose-950/90 border-rose-400/70 text-rose-200 shadow-[0_0_35px_rgba(244,63,94,0.3)]'
                : 'bg-[#0c101b]/92 border-white/20 text-white shadow-[0_0_30px_rgba(0,0,0,0.75)]'
            )}
          >
            <div
              className={cn(
                'min-w-[2.75rem] h-11 px-2 rounded-xl flex items-center justify-center font-black font-mono text-xl shadow-inner shrink-0',
                meta.isMax
                  ? 'bg-amber-500/25 border border-amber-400/60 text-amber-300'
                  : meta.isFumble
                  ? 'bg-rose-500/25 border border-rose-400/60 text-rose-300'
                  : 'bg-white/10 border border-white/15 text-white'
              )}
            >
              {meta.total}
            </div>

            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="truncate max-w-[160px] font-bold text-white">
                  {sharedBannerRoll.user_name || 'Aventureiro'}
                </span>
                <span className="px-1.5 py-0.2 rounded bg-white/10 border border-white/15 text-[10px] text-slate-200 font-mono font-bold shrink-0">
                  {meta.formula}
                </span>
              </div>

              <div className="text-sm font-black tracking-wide">
                {meta.isMax ? (
                  <span className="text-amber-300 flex items-center gap-1">
                    <Zap className="h-4 w-4 shrink-0" />
                    {meta.count > 1 && !meta.allMax
                      ? `CRÍTICO NO ${meta.formula}! (Total ${meta.total})`
                      : `SUCESSO MÁXIMO! (${meta.total})`}
                  </span>
                ) : meta.isFumble ? (
                  <span className="text-rose-400 font-bold">
                    FALHA CRÍTICA! ({meta.total})
                  </span>
                ) : (
                  <span className="text-slate-100">
                    {meta.count > 1
                      ? `Rolou ${meta.formula} • Total ${meta.total}`
                      : `Rolou ${meta.total} no ${meta.formula}`}
                  </span>
                )}
              </div>

              {meta.results.length > 1 && (
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  {meta.results.map((val, i) => (
                    <span
                      key={i}
                      className={cn(
                        'px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold border leading-none',
                        val === meta.sides
                          ? 'bg-amber-500/25 border-amber-400/55 text-amber-200'
                          : meta.sides === 20 && val === 1
                          ? 'bg-rose-500/25 border-rose-400/55 text-rose-200'
                          : 'bg-white/10 border-white/15 text-slate-200'
                      )}
                    >
                      {val}
                    </span>
                  ))}
                  {meta.sides === 20 && (
                    <span className="text-[10px] font-mono text-slate-300 ml-1">
                      • Maior {meta.highest} / Menor {meta.lowest}
                    </span>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSharedBannerRoll(null)}
              className="ml-1 h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              title="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })()}

      {/* Indicador discreto durante upgrade progressivo de textura HD */}
      {loadingHd && (
        <div className="pointer-events-none absolute bottom-3 right-3 z-30 flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#0c101b]/90 border border-white/15 text-[10px] font-mono text-slate-300 backdrop-blur-xl shadow-lg">
          <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
          Aprimorando mapa para HD...
        </div>
      )}

      {/* ROLAGEM DE DADOS 3D NA TELA (EXCLUSIVA PARA A PESSOA QUE GIROU O DADO, SEM CONFLITO) */}
      <TacticalDice3D
        currentRoll={active3DRoll}
        onSettled={handleRollSettled}
        onDismiss={() => {
          setRollingSeedKey(null);
          setActive3DRoll(null);
        }}
      />

      {/* Indicador discreto de Modo Régua / Sinalizar ativo (Tokens protegidos contra arraste acidental) */}
      {activeTool === 'ruler' && (
        <div className="pointer-events-auto absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#0c101b]/95 border border-sky-400/45 text-xs font-semibold text-sky-100 backdrop-blur-xl shadow-[0_12px_32px_rgba(0,0,0,0.8)]">
          <Ruler className="h-3.5 w-3.5 text-sky-300 shrink-0" />
          <span className="whitespace-nowrap">Modo Régua — arraste para medir (tokens bloqueados)</span>
          <button
            type="button"
            onClick={() => {
              setActiveTool('select');
              setRulerStart(null);
              setRulerCurrent(null);
            }}
            className="px-2 py-0.5 rounded-full bg-white/12 hover:bg-white/20 border border-white/20 text-[10px] font-bold text-white transition-colors"
          >
            Sair
          </button>
        </div>
      )}

      {/* ÁREA PRINCIPAL DO MAPA (VIEWPORT COM PAN & ZOOM — ZERO ACHATAMENTO / PROPORÇÃO 1:1 EXATA) */}
      <div
        className={cn(
          'w-full h-full flex items-center justify-center overflow-hidden',
          activeTool === 'ruler' || activeTool === 'ping'
            ? 'cursor-crosshair'
            : isLocked
            ? 'cursor-default'
            : 'cursor-grab active:cursor-grabbing'
        )}
        onPointerDown={handleMapPointerDown}
        onPointerMove={handleMapPointerMove}
        onPointerUp={handleMapPointerUp}
      >
        <div
          ref={mapImageRef}
          className="relative shrink-0 transition-transform duration-75 will-change-transform"
          style={{
            width: `${mapDisplaySize.width}px`,
            height: `${mapDisplaySize.height}px`,
            minWidth: `${mapDisplaySize.width}px`,
            minHeight: `${mapDisplaySize.height}px`,
            maxWidth: 'none',
            maxHeight: 'none',
            flexShrink: 0,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
          }}
        >
          {/* Imagem do Mapa: Exibição 1:1 no tamanho exato em pixels sem achatar nem distorcer */}
          {resolvedImageUrl || map?.imageUrl ? (
            <>
              {imageStatus === 'loading' && (
                <div className="absolute inset-0 rounded-lg bg-slate-950/80 flex flex-col items-center justify-center gap-2.5 text-slate-300 font-mono text-xs z-10 backdrop-blur-sm pointer-events-none">
                  <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                  <span>Carregando cenário do mapa...</span>
                </div>
              )}

              {imageStatus === 'error' ? (
                <div
                  className="rounded-lg border border-amber-500/30 flex flex-col items-center justify-center text-center p-6 relative overflow-hidden shadow-2xl"
                  style={{
                    width: `${mapDisplaySize.width}px`,
                    height: `${mapDisplaySize.height}px`,
                    backgroundColor: '#111625',
                    backgroundImage: `
                      radial-gradient(circle at 50% 50%, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%),
                      linear-gradient(45deg, rgba(255, 255, 255, 0.03) 25%, transparent 25%),
                      linear-gradient(-45deg, rgba(255, 255, 255, 0.03) 25%, transparent 25%)
                    `,
                    backgroundSize: '100% 100%, 60px 60px, 60px 60px',
                  }}
                >
                  <div className="z-10 max-w-md space-y-2 p-4 rounded-2xl bg-black/75 border border-white/10 backdrop-blur-md">
                    <div className="text-amber-400 font-bold text-sm flex items-center justify-center gap-2">
                      <Compass className="h-4 w-4" />
                      Terreno Tático Ativo
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      A imagem remota não pôde ser carregada pelo navegador. O terreno alternativo está ativo para que os tokens e o combate continuem sem interrupção.
                    </p>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setImageStatus('loading')}
                      className="text-xs mt-1"
                    >
                      Tentar Recarregar Imagem
                    </Button>
                  </div>
                </div>
              ) : (
                <img
                  key={`${map.id}_${(resolvedImageUrl || map.imageUrl || '').slice(0, 48)}`}
                  src={resolvedImageUrl || map.imageUrl}
                  alt={map.title || 'Mapa Tático'}
                  draggable={false}
                  decoding="async"
                  loading="eager"
                  referrerPolicy="no-referrer"
                  onLoad={(e) => {
                    const nw = e.currentTarget?.naturalWidth;
                    const nh = e.currentTarget?.naturalHeight;
                    if (nw > 0 && nh > 0 && (!map?.hd_chunk_count || (resolvedImageUrl && resolvedImageUrl !== map.imageUrl))) {
                      setNaturalDimensions((prev) =>
                        prev.width === nw && prev.height === nh ? prev : { width: nw, height: nh }
                      );
                    }
                    setImageStatus('loaded');
                  }}
                  onError={() => setImageStatus('error')}
                  className={cn(
                    'block pointer-events-none rounded-lg shadow-2xl max-w-none max-h-none object-contain transition-opacity duration-300',
                    imageStatus === 'loaded' ? 'opacity-100' : 'opacity-0'
                  )}
                  style={{
                    width: `${mapDisplaySize.width}px`,
                    height: `${mapDisplaySize.height}px`,
                    maxWidth: 'none',
                    maxHeight: 'none',
                  }}
                />
              )}
            </>
          ) : (
            <div
              className="bg-slate-900 border border-white/10 rounded-lg flex items-center justify-center text-slate-400 font-mono text-sm"
              style={{
                width: `${mapDisplaySize.width}px`,
                height: `${mapDisplaySize.height}px`,
              }}
            >
              Nenhum mapa selecionado
            </div>
          )}

          {/* Camada de Grade Tática (Square Grid) cobrindo todo o mapa */}
          {showGrid && (
            <div
              className="absolute inset-0 pointer-events-none rounded-lg"
              style={{
                backgroundImage: `linear-gradient(to right, rgba(255, 255, 255, ${gridOpacity}) 1px, transparent 1px),
                                  linear-gradient(to bottom, rgba(255, 255, 255, ${gridOpacity}) 1px, transparent 1px)`,
                backgroundSize: `${gridSize}px ${gridSize}px`,
              }}
            />
          )}

          {/* Linha da Régua Ativa (com etiqueta nítida em metros, pés e quadrados) */}
          {rulerStart && rulerCurrent && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-30"
              style={{ overflow: 'visible' }}
            >
              <line
                x1={`${rulerStart.x}%`}
                y1={`${rulerStart.y}%`}
                x2={`${rulerCurrent.x}%`}
                y2={`${rulerCurrent.y}%`}
                stroke="rgba(56, 189, 248, 0.35)"
                strokeWidth={7 * mapScaleFactor}
                strokeLinecap="round"
              />
              <line
                x1={`${rulerStart.x}%`}
                y1={`${rulerStart.y}%`}
                x2={`${rulerCurrent.x}%`}
                y2={`${rulerCurrent.y}%`}
                stroke="#38bdf8"
                strokeWidth={2.5 * mapScaleFactor}
                strokeDasharray={`${7 * mapScaleFactor} ${4 * mapScaleFactor}`}
                strokeLinecap="round"
              />
              <circle cx={`${rulerStart.x}%`} cy={`${rulerStart.y}%`} r={4.5 * mapScaleFactor} fill="#38bdf8" stroke="#0c101b" strokeWidth={1.5 * mapScaleFactor} />
              <circle cx={`${rulerCurrent.x}%`} cy={`${rulerCurrent.y}%`} r={5.5 * mapScaleFactor} fill="#ffffff" stroke="#38bdf8" strokeWidth={2 * mapScaleFactor} />
              <text
                x={`${(rulerStart.x + rulerCurrent.x) / 2}%`}
                y={`${(rulerStart.y + rulerCurrent.y) / 2}%`}
                fill="#ffffff"
                stroke="#070913"
                strokeWidth={4 * mapScaleFactor}
                paintOrder="stroke"
                fontSize={13 * mapScaleFactor}
                fontWeight="bold"
                textAnchor="middle"
                dy={-10 * mapScaleFactor}
                className="font-mono"
              >
                {rulerDistance}m ({Math.round(rulerDistance * 3.28)} ft • {Math.max(0, Math.round((rulerDistance / 1.5) * 10) / 10)}q)
              </text>
            </svg>
          )}

          {/* Sinais / Pings de Radar (Duração Máxima: 5 segundos, sem duplicação) */}
          {visiblePings.map((p, idx) => {
            const time = getPingTime(p);
            const ageMs = Math.max(0, now - time);
            const remainingSec = Math.max(0, Math.ceil((5000 - ageMs) / 1000));
            const fadeRatio = ageMs > 4200 ? (5000 - ageMs) / 800 : 1;

            return (
              <div
                key={p.id || idx}
                className="absolute pointer-events-none z-30 flex flex-col items-center justify-center transition-opacity duration-200"
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  opacity: Math.max(0, Math.min(1, fadeRatio)),
                  transform: `translate(-50%, -50%) scale(${mapScaleFactor})`,
                }}
              >
                {/* Ondas concêntricas de radar */}
                <div
                  className="w-14 h-14 rounded-full border-2 animate-ping"
                  style={{ borderColor: p.color || '#38bdf8' }}
                />
                <div
                  className="w-6 h-6 rounded-full border-2 absolute flex items-center justify-center"
                  style={{
                    borderColor: p.color || '#38bdf8',
                    backgroundColor: `${p.color || '#38bdf8'}40`,
                  }}
                >
                  <div
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{ backgroundColor: p.color || '#38bdf8' }}
                  />
                </div>
                <span className="px-2 py-0.5 rounded-full bg-black/90 border border-white/20 text-[10px] text-white font-mono mt-1 whitespace-nowrap shadow-xl flex items-center gap-1.5 backdrop-blur-md">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: p.color || '#38bdf8' }}
                  />
                  {p.user_name || 'Atenção'} • {remainingSec}s
                </span>
              </div>
            );
          })}

          {/* CAMADA DE BONEQUINHOS / TOKENS (RESPEITA VISIBILIDADE NA ESCURIDÃO >= 60% & LUZ POR PROXIMIDADE) */}
          {visibleTokens.map((token) => {
            const visMeta = lightingState.tokenVisibility[token.id] || {
              visible: true,
              opacity: 1,
              isOwn: false,
            };
            // Em escuridão >= 60%, jogadores NÃO veem outros tokens fora da sua área iluminada / aliados próximos
            if (!visMeta.visible) return null;

            const rawPos = localTokenPositions[token.id] || { x: token.x, y: token.y };
            const pos = {
              x: Number.isFinite(Number(rawPos.x)) ? Number(rawPos.x) : 50,
              y: Number.isFinite(Number(rawPos.y)) ? Number(rawPos.y) : 50,
            };
            const isMovable = canMoveToken(token);
            const isCurrentTurn = map?.current_turn_token_id === token.id;
            const sizeCfg = TOKEN_SIZES[token.size] || TOKEN_SIZES.M;
            const tokenPx = Math.max(20, Math.round(sizeCfg.px * mapScaleFactor));
            const showHp = canViewTokenHp(token);
            const nameHidden = isTokenNameHiddenForViewer(token);
            const displayName = getVisibleTokenName(token, false);
            const isAlliedNonPlayer = token.type !== 'player' && Boolean(token.is_ally);
            const ringColor = isAlliedNonPlayer ? '#10b981' : token.color || '#60a5fa';

            const hpPct = Math.max(
              0,
              Math.min(100, Math.round(((token.hp || 0) / (token.max_hp || 1)) * 100))
            );

            const isRemoteMoving = Boolean(remoteMovingTokens[token.id]) && localDraggingId !== token.id;

            return (
              <div
                key={token.id}
                data-token-element="true"
                onPointerDown={(e) => handleTokenPointerDown(token, e)}
                onPointerMove={(e) => handleTokenPointerMove(token, e)}
                onPointerUp={(e) => handleTokenPointerUp(token, e)}
                onPointerCancel={(e) => handleTokenPointerUp(token, e)}
                onClick={(e) => handleTokenClick(token, e)}
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  width: `${tokenPx}px`,
                  height: `${tokenPx}px`,
                  opacity: visMeta.opacity,
                  transition:
                    localDraggingId === token.id
                      ? 'opacity 0.2s ease'
                      : 'left 0.11s linear, top 0.11s linear, opacity 0.22s ease',
                }}
                className={cn(
                  'absolute -translate-x-1/2 -translate-y-1/2 select-none group',
                  visMeta.isOwn ? 'z-[24]' : 'z-[22]',
                  activeTool !== 'select'
                    ? 'pointer-events-none'
                    : isMovable
                    ? 'cursor-grab active:cursor-grabbing'
                    : 'cursor-pointer'
                )}
              >
                {/* Halo visual suave indicando movimentação ao vivo de outro participante */}
                {isRemoteMoving && (
                  <div
                    className="absolute -inset-1.5 rounded-full border-2 pointer-events-none animate-pulse"
                    style={{
                      borderColor: `${ringColor}cc`,
                      boxShadow: `0 0 18px ${ringColor}88`,
                    }}
                  />
                )}
                {/* Condições de Status Ativas com Ícones (escaladas proporcionalmente à resolução exata do mapa) */}
                {Array.isArray(token.conditions) && token.conditions.length > 0 && (
                  <div
                    className="absolute bottom-full mb-1.5 left-1/2 flex items-center justify-center gap-1 z-20 pointer-events-none"
                    style={{
                      transform: `translateX(-50%) scale(${mapScaleFactor})`,
                      transformOrigin: 'bottom center',
                    }}
                  >
                    {token.conditions.slice(0, 5).map((condId) => {
                      const meta = TOKEN_CONDITIONS.find((c) => c.id === condId);
                      const CondIcon = CONDITION_ICONS[condId];
                      if (!CondIcon) return null;
                      return (
                        <span
                          key={condId}
                          title={meta?.label || condId}
                          className="h-8 w-8 rounded-full flex items-center justify-center border-2 border-white/45 backdrop-blur-md transition-transform"
                          style={{
                            backgroundColor: `${meta?.color || '#ef4444'}f2`,
                            boxShadow: `0 4px 12px rgba(0, 0, 0, 0.85), 0 0 12px ${meta?.color || '#ef4444'}99`,
                          }}
                        >
                          <CondIcon className="h-5 w-5 text-white drop-shadow" />
                        </span>
                      );
                    })}
                    {token.conditions.length > 5 && (
                      <span className="h-7 px-1.5 rounded-full bg-black/90 border border-white/30 text-[11px] font-mono font-black text-white flex items-center justify-center shadow-lg">
                        +{token.conditions.length - 5}
                      </span>
                    )}
                  </div>
                )}

                {/* Círculo Principal do Bonequinho (Miniatura Tática com Anel Metálico e Centralização Exata) */}
                <div
                  className={cn(
                    'w-full h-full rounded-full flex items-center justify-center font-black font-mono relative transition-transform duration-150',
                    'group-hover:scale-105 group-active:scale-95',
                    isCurrentTurn && 'ring-4 ring-amber-400 ring-offset-2 ring-offset-black animate-pulse',
                    token.hidden && 'opacity-60 border-dashed'
                  )}
                  style={{
                    background: token.avatar
                      ? '#0c101b'
                      : `radial-gradient(circle at 32% 28%, ${ringColor}ff 0%, ${ringColor}cc 55%, #090d16 100%)`,
                    border: `${Math.max(2, Math.round(2.5 * mapScaleFactor))}px solid ${ringColor}`,
                    boxShadow: `inset 0 2px 4px rgba(255, 255, 255, 0.35), inset 0 -3px 6px rgba(0, 0, 0, 0.75), 0 6px 16px rgba(0, 0, 0, 0.8), 0 0 16px ${ringColor}66`,
                  }}
                >
                  {/* Aro interno sutil de acabamento de peça de tabuleiro */}
                  <div className="absolute inset-0.5 rounded-full border border-white/25 pointer-events-none" />

                  {token.avatar ? (
                    <img
                      src={token.avatar}
                      alt={displayName}
                      className="w-full h-full rounded-full object-cover pointer-events-none"
                    />
                  ) : (
                    <span
                      className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] truncate px-1 tracking-tight"
                      style={{ fontSize: `${Math.max(11, Math.round(tokenPx * 0.34))}px` }}
                    >
                      {nameHidden ? '?' : token.name?.slice(0, 2).toUpperCase()}
                    </span>
                  )}

                  {/* Ícone de Oculto se for Token Invisível aos jogadores */}
                  {token.hidden && (
                    <div
                      className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-black/90 border border-amber-400/50 text-amber-300 shadow-lg"
                      style={{ transform: `scale(${Math.min(1.8, Math.max(0.85, mapScaleFactor))})` }}
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                    </div>
                  )}

                  {/* Selo de Aliado para monstros/NPCs aliados */}
                  {isAlliedNonPlayer && (
                    <div
                      title="Aliado dos jogadores"
                      className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-emerald-950/95 border border-emerald-400/70 text-emerald-300 shadow-lg"
                      style={{ transform: `scale(${Math.min(1.8, Math.max(0.85, mapScaleFactor))})` }}
                    >
                      <ShieldCheck className="h-3 w-3" />
                    </div>
                  )}

                  {/* Selo discreto de Tocha / Luz Individual acesa neste token */}
                  {typeof token.light_radius === 'number' && token.light_radius > 0 && (
                    <div
                      title={`Iluminação individual (${token.light_radius}%)`}
                      className="absolute -top-1.5 -left-1.5 p-0.5 rounded-full bg-[#0c101b]/95 border shadow-lg"
                      style={{
                        borderColor: getTokenLightColorMeta(token.light_color).hex,
                        color: getTokenLightColorMeta(token.light_color).hex,
                        transform: `scale(${Math.min(1.8, Math.max(0.85, mapScaleFactor))})`,
                      }}
                    >
                      <GiTorch className="h-3 w-3" />
                    </div>
                  )}
                </div>

                {/* Rótulo de Vida e Nome Flutuante (Abaixo do Círculo, sem afetar o centro geométrico Y do token) */}
                <div
                  className="absolute top-full left-1/2 pt-1.5 flex flex-col items-center pointer-events-none z-10 w-40"
                  style={{
                    transform: `translateX(-50%) scale(${mapScaleFactor})`,
                    transformOrigin: 'top center',
                  }}
                >
                  {/* Barra de Vida sob o Token (Oculta para jogadores em monstros não-aliados) */}
                  {showHp && (
                    <div className="w-12 h-1.5 bg-black/90 rounded-full overflow-hidden border border-white/25 shadow-md">
                      <div
                        className={cn(
                          'h-full transition-all duration-200',
                          hpPct > 50 ? 'bg-emerald-400' : hpPct > 25 ? 'bg-amber-400' : 'bg-rose-500'
                        )}
                        style={{ width: `${hpPct}%` }}
                      />
                    </div>
                  )}

                  {/* Placa de Nome (e HP apenas se permitido) */}
                  <div className={cn('text-center flex items-center justify-center gap-1 max-w-[156px]', showHp ? 'mt-1' : 'mt-0.5')}>
                    <span className="px-2 py-0.5 rounded-md bg-[#0c101b]/95 backdrop-blur-md text-[10px] font-bold text-white border border-white/15 whitespace-nowrap shadow-[0_4px_12px_rgba(0,0,0,0.85)] flex items-center gap-1 truncate">
                      {isMaster && token.name_hidden && (
                        <EyeOff className="h-2.5 w-2.5 text-amber-300 shrink-0" />
                      )}
                      <span className="truncate">{displayName}</span>
                      {showHp && (
                        <span className="text-[9px] font-mono text-slate-300 pl-1 border-l border-white/15 shrink-0">
                          {token.hp}/{token.max_hp}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* CAMADA ATMOSFÉRICA & VISIBILIDADE (ESCURIDÃO >= 60%, TOCHAS POR PROXIMIDADE, NÉVOA, CLIMA E OCULTAÇÃO) */}
          <MapAtmosphereOverlay
            effects={localEffects}
            isMaster={isMaster}
            previewAsPlayer={previewEffectsAsPlayer}
            lightingState={lightingState}
            draggingTokenId={localDraggingId}
            mapWidth={mapDisplaySize.width}
            mapHeight={mapDisplaySize.height}
            onRevealForMaster={() => commitMapEffects({ ...localEffects, blackout: false })}
          />
        </div>
      </div>

      {/* MODAL DE STATUS & EDIÇÃO DO TOKEN (SINCRONIZADO EM TEMPO REAL) */}
      <Modal
        open={inspectModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setInspectModalOpen(false);
            setSelectedTokenId(null);
          }
        }}
        title={
          isMaster
            ? `Mestrar: ${activeSelectedToken?.name || ''}`
            : `Ficha de ${getVisibleTokenName(activeSelectedToken, true)}`
        }
        maxWidth="max-w-md"
      >
        {activeSelectedToken && (() => {
          const selectedShowHp = canViewTokenHp(activeSelectedToken);
          const selectedNameHidden = isTokenNameHiddenForViewer(activeSelectedToken);
          const selectedDisplayName = getVisibleTokenName(activeSelectedToken, true);
          const selectedIsAlliedNonPlayer =
            activeSelectedToken.type !== 'player' && Boolean(activeSelectedToken.is_ally);
          const selectedRingColor = selectedIsAlliedNonPlayer
            ? '#10b981'
            : activeSelectedToken.color || '#60a5fa';

          return (
          <div className="space-y-4 py-1">
            {/* Cabeçalho Aprimorado do Token */}
            <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-[#0c101b] border border-white/15 shadow-inner">
              <div
                className="h-16 w-16 rounded-full flex items-center justify-center font-black text-lg text-white shrink-0 relative"
                style={{
                  background: activeSelectedToken.avatar
                    ? '#0c101b'
                    : `radial-gradient(circle at 32% 28%, ${selectedRingColor}ff 0%, ${selectedRingColor}cc 55%, #090d16 100%)`,
                  border: `2.5px solid ${selectedRingColor}`,
                  boxShadow: `inset 0 2px 4px rgba(255, 255, 255, 0.35), 0 0 18px ${selectedRingColor}55`,
                }}
              >
                <div className="absolute inset-0.5 rounded-full border border-white/25 pointer-events-none" />
                {activeSelectedToken.avatar ? (
                  <img
                    src={activeSelectedToken.avatar}
                    alt={selectedDisplayName}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  selectedNameHidden ? '?' : activeSelectedToken.name?.slice(0, 2).toUpperCase()
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-lg font-extrabold text-white truncate">
                    {selectedDisplayName}
                  </h3>
                  <Badge className="bg-white/10 text-slate-300 border-white/15 text-[10px]">
                    {activeSelectedToken.type === 'monster'
                      ? 'Monstro'
                      : activeSelectedToken.type === 'npc'
                      ? 'NPC'
                      : 'Herói'}
                  </Badge>
                  {selectedIsAlliedNonPlayer && (
                    <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-400/35 text-[10px]">
                      <ShieldCheck className="h-3 w-3" /> Aliado
                    </Badge>
                  )}
                  {isMaster && activeSelectedToken.name_hidden && (
                    <Badge className="bg-amber-500/15 text-amber-300 border-amber-400/35 text-[10px]">
                      <EyeOff className="h-3 w-3" /> Nome Oculto
                    </Badge>
                  )}
                </div>
                {isMaster && (
                  <p className="text-xs text-slate-400">
                    Tamanho: {TOKEN_SIZES[activeSelectedToken.size]?.label || 'Médio (M)'}
                  </p>
                )}
              </div>
            </div>

            {/* Status Principais: Vida (HP), Armadura (AC), Mana (Ocultos p/ jogadores em monstros inimigos) */}
            {selectedShowHp ? (
            <div className="grid grid-cols-3 gap-2">
              {/* VIDA (HP) */}
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-rose-300">
                  <span className="flex items-center gap-1">
                    <Heart className="h-3.5 w-3.5 text-rose-400" />
                    Vida
                  </span>
                  {isMaster && (
                    <span className="text-[10px] text-slate-400 font-mono">Máx {activeSelectedToken.max_hp}</span>
                  )}
                </div>
                <div className="text-xl font-black font-mono text-white">
                  {activeSelectedToken.hp} / {activeSelectedToken.max_hp}
                </div>
                <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-rose-500/30">
                  <div
                    className="h-full bg-rose-400 transition-all duration-200"
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(
                          100,
                          Math.round(
                            ((activeSelectedToken.hp || 0) / (activeSelectedToken.max_hp || 1)) * 100
                          )
                        )
                      )}%`,
                    }}
                  />
                </div>
                {isMaster && (
                  <div className="flex items-center gap-1 pt-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateTokenStats &&
                        onUpdateTokenStats(activeSelectedToken.id, {
                          hp: Math.max(0, (activeSelectedToken.hp || 0) - 1),
                        })
                      }
                      className="h-6 w-6 rounded bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs font-bold"
                      title="-1 HP"
                    >
                      -1
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateTokenStats &&
                        onUpdateTokenStats(activeSelectedToken.id, {
                          hp: Math.min(activeSelectedToken.max_hp, (activeSelectedToken.hp || 0) + 1),
                        })
                      }
                      className="h-6 w-6 rounded bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs font-bold"
                      title="+1 HP"
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateTokenStats &&
                        onUpdateTokenStats(activeSelectedToken.id, {
                          hp: Math.max(0, (activeSelectedToken.hp || 0) - 5),
                        })
                      }
                      className="h-6 px-1.5 rounded bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold"
                      title="-5 HP"
                    >
                      -5
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateTokenStats &&
                        onUpdateTokenStats(activeSelectedToken.id, {
                          hp: Math.min(activeSelectedToken.max_hp, (activeSelectedToken.hp || 0) + 5),
                        })
                      }
                      className="h-6 px-1.5 rounded bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold"
                      title="+5 HP"
                    >
                      +5
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateTokenStats &&
                        onUpdateTokenStats(activeSelectedToken.id, {
                          hp: activeSelectedToken.max_hp,
                        })
                      }
                      className="h-6 px-1.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 text-[10px] font-bold"
                      title="Curar Vida Total"
                    >
                      Total
                    </button>
                  </div>
                )}
              </div>

              {/* ARMADURA (AC) */}
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/25 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-blue-300">
                  <span className="flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5 text-blue-400" />
                    Armadura
                  </span>
                </div>
                <div className="text-xl font-black font-mono text-white">{activeSelectedToken.ac} CA</div>
                {isMaster && (
                  <div className="flex items-center gap-1 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateTokenStats &&
                        onUpdateTokenStats(activeSelectedToken.id, {
                          ac: Math.max(0, (activeSelectedToken.ac || 10) - 1),
                        })
                      }
                      className="h-6 w-6 rounded bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs font-bold"
                      title="-1 CA"
                    >
                      -1
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateTokenStats &&
                        onUpdateTokenStats(activeSelectedToken.id, {
                          ac: (activeSelectedToken.ac || 10) + 1,
                        })
                      }
                      className="h-6 w-6 rounded bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs font-bold"
                      title="+1 CA"
                    >
                      +1
                    </button>
                  </div>
                )}
              </div>

              {/* MANA / SLOTS */}
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/25 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-purple-300">
                  <span className="flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5 text-purple-400" />
                    Mana
                  </span>
                  {isMaster && (
                    <span className="text-[10px] text-slate-400 font-mono">Máx {activeSelectedToken.max_mana ?? 0}</span>
                  )}
                </div>
                <div className="text-xl font-black font-mono text-white">
                  {activeSelectedToken.mana ?? 0} / {activeSelectedToken.max_mana ?? 0}
                </div>
                <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-purple-500/30">
                  <div
                    className="h-full bg-purple-400 transition-all duration-200"
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(
                          100,
                          Math.round(
                            ((activeSelectedToken.mana || 0) /
                              Math.max(1, activeSelectedToken.max_mana || 1)) *
                              100
                          )
                        )
                      )}%`,
                    }}
                  />
                </div>
                {isMaster && (
                  <div className="flex items-center gap-1 pt-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateTokenStats &&
                        onUpdateTokenStats(activeSelectedToken.id, {
                          mana: Math.max(0, (activeSelectedToken.mana || 0) - 2),
                        })
                      }
                      className="h-6 px-1.5 rounded bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold"
                      title="-2 Mana"
                    >
                      -2
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateTokenStats &&
                        onUpdateTokenStats(activeSelectedToken.id, {
                          mana: Math.min(activeSelectedToken.max_mana || 10, (activeSelectedToken.mana || 0) + 2),
                        })
                      }
                      className="h-6 px-1.5 rounded bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold"
                      title="+2 Mana"
                    >
                      +2
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateTokenStats &&
                        onUpdateTokenStats(activeSelectedToken.id, {
                          mana: activeSelectedToken.max_mana || 0,
                        })
                      }
                      className="h-6 px-1.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/30 text-[10px] font-bold"
                      title="Restaurar Mana Total"
                    >
                      Total
                    </button>
                  </div>
                )}
              </div>
            </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 flex items-center gap-3 text-xs text-slate-300">
                <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-slate-400">
                  <EyeOff className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-white">Vitalidade Oculta</div>
                  <p className="text-[11px] text-slate-400">
                    Os pontos de vida de criaturas inimigas ficam ocultos até que o Mestre as marque como aliadas.
                  </p>
                </div>
              </div>
            )}

            {/* SE FOR JOGADOR: VISUALIZAÇÃO DOS EFEITOS DE STATUS ATIVOS (DOBRO DO TAMANHO: 64x64px / h-16 w-16 com ícone 32x32px / h-8 w-8) */}
            {!isMaster && (
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-slate-300" />
                    Efeitos de Status Ativos
                  </span>
                  {Array.isArray(activeSelectedToken.conditions) && activeSelectedToken.conditions.length > 0 && (
                    <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-white/10 text-white font-bold">
                      {activeSelectedToken.conditions.length} ativo{activeSelectedToken.conditions.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {Array.isArray(activeSelectedToken.conditions) && activeSelectedToken.conditions.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2.5">
                    {activeSelectedToken.conditions.map((condId) => {
                      const cond = TOKEN_CONDITIONS.find((c) => c.id === condId);
                      const CondIcon = CONDITION_ICONS[condId];
                      if (!cond) return null;
                      return (
                        <div
                          key={condId}
                          className="p-3 rounded-2xl border flex items-center gap-3.5 transition-all shadow-lg"
                          style={{
                            borderColor: `${cond.color}65`,
                            backgroundColor: `${cond.color}1a`,
                          }}
                        >
                          <span
                            className="h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 shadow-xl"
                            style={{
                              backgroundColor: `${cond.color}35`,
                              border: `2px solid ${cond.color}90`,
                              boxShadow: `0 0 18px ${cond.color}55`,
                            }}
                          >
                            {CondIcon && <CondIcon className="h-8 w-8" style={{ color: cond.color }} />}
                          </span>
                          <div className="min-w-0">
                            <div className="text-base font-extrabold text-white truncate">{cond.label}</div>
                            <div className="text-xs text-slate-300 font-mono">Condição de Status Ativa</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    Nenhum efeito de status ativo (Condição Normal)
                  </div>
                )}
              </div>
            )}

            {/* CONTROLES EXCLUSIVOS DO MESTRE: ALIADO / VISIBILIDADE DO NOME / LIVRO / MÁXIMOS / TAMANHO */}
            {isMaster && (
              <div className="space-y-3 pt-2 border-t border-white/10">
                {/* Controles em Tempo Real de Visibilidade p/ Jogadores (Aliado & Nome Oculto) */}
                {activeSelectedToken.type !== 'player' && (
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/12 space-y-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 block">
                      Visibilidade para Jogadores
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          const nextAlly = !activeSelectedToken.is_ally;
                          if (onUpdateTokenStats) {
                            await onUpdateTokenStats(activeSelectedToken.id, { is_ally: nextAlly });
                            toast.success(
                              nextAlly
                                ? `${activeSelectedToken.name} agora é Aliado (vida visível p/ jogadores).`
                                : `${activeSelectedToken.name} voltou a ser inimigo (vida oculta p/ jogadores).`
                            );
                          }
                        }}
                        className={cn(
                          'p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5',
                          activeSelectedToken.is_ally
                            ? 'bg-emerald-500/15 border-emerald-400/45 text-emerald-100'
                            : 'bg-white/5 border-white/15 text-slate-200 hover:bg-white/10'
                        )}
                      >
                        <span
                          className={cn(
                            'h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border',
                            activeSelectedToken.is_ally
                              ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                              : 'bg-white/5 border-white/10 text-slate-300'
                          )}
                        >
                          {activeSelectedToken.is_ally ? (
                            <ShieldCheck className="h-4 w-4" />
                          ) : (
                            <Users className="h-4 w-4" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold leading-tight truncate">
                            {activeSelectedToken.is_ally ? 'Remover Aliado' : 'Tornar Aliado'}
                          </div>
                          <div className="text-[10px] text-slate-400 leading-tight mt-0.5 truncate">
                            {activeSelectedToken.is_ally
                              ? 'Vida visível p/ jogadores'
                              : 'Vida oculta p/ jogadores'}
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          const nextNameHidden = !activeSelectedToken.name_hidden;
                          if (onUpdateTokenStats) {
                            await onUpdateTokenStats(activeSelectedToken.id, {
                              name_hidden: nextNameHidden,
                            });
                            toast.success(
                              nextNameHidden
                                ? `Nome de "${activeSelectedToken.name}" ocultado dos jogadores.`
                                : `Nome "${activeSelectedToken.name}" revelado para os jogadores!`
                            );
                          }
                        }}
                        className={cn(
                          'p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5',
                          !activeSelectedToken.name_hidden
                            ? 'bg-white/15 border-white/30 text-white'
                            : 'bg-amber-500/10 border-amber-400/35 text-amber-100 hover:bg-amber-500/15'
                        )}
                      >
                        <span
                          className={cn(
                            'h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border',
                            !activeSelectedToken.name_hidden
                              ? 'bg-white/10 border-white/20 text-slate-200'
                              : 'bg-amber-500/15 border-amber-400/35 text-amber-300'
                          )}
                        >
                          {activeSelectedToken.name_hidden ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold leading-tight truncate">
                            {activeSelectedToken.name_hidden ? 'Mostrar Nome' : 'Ocultar Nome'}
                          </div>
                          <div className="text-[10px] text-slate-400 leading-tight mt-0.5 truncate">
                            {activeSelectedToken.name_hidden
                              ? 'Jogadores veem "???"'
                              : 'Nome visível p/ jogadores'}
                          </div>
                        </div>
                      </button>
                    </div>

                    {activeSelectedToken.monster_id && onInspectMonsterId && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => onInspectMonsterId(activeSelectedToken.monster_id)}
                        className="w-full text-xs gap-1.5"
                      >
                        <BookOpen className="h-3.5 w-3.5 text-slate-300" />
                        Ver Estatísticas do Livro dos Monstros
                      </Button>
                    )}
                  </div>
                )}

                {/* Controle Individual de Iluminação / Tocha do Token (não sobrescrito pelo menu global do mapa!) */}
                {(() => {
                  const hasCustomLight =
                    typeof activeSelectedToken.light_radius === 'number' &&
                    Number.isFinite(activeSelectedToken.light_radius);
                  const effectiveLight = hasCustomLight
                    ? activeSelectedToken.light_radius
                    : activeSelectedToken.type === 'player'
                    ? localEffects.torchRadius
                    : 0;
                  const activeColorId = activeSelectedToken.light_color || 'warm';
                  const activeColorMeta = getTokenLightColorMeta(activeColorId);

                  return (
                    <div className="p-3.5 rounded-xl bg-[#0c101b] border border-white/12 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                          <GiTorch className="h-4 w-4 shrink-0" style={{ color: activeColorMeta.hex }} />
                          Iluminação / Tocha do Token
                        </span>
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border',
                            hasCustomLight
                              ? effectiveLight > 0
                                ? 'bg-amber-500/15 border-amber-400/45 text-amber-200'
                                : 'bg-white/8 border-white/20 text-slate-300'
                              : 'bg-sky-500/12 border-sky-400/35 text-sky-200'
                          )}
                        >
                          {hasCustomLight
                            ? effectiveLight > 0
                              ? `Individual ${effectiveLight}%`
                              : 'Apagada (Individual)'
                            : activeSelectedToken.type === 'player'
                            ? `Global (${localEffects.torchRadius}%)`
                            : 'Sem Luz'}
                        </span>
                      </div>

                      {/* Presets rápidos de alcance da luz */}
                      <div className="grid grid-cols-3 gap-1.5">
                        {TOKEN_LIGHT_PRESETS.map((preset) => {
                          const isSelected =
                            preset.radius === null
                              ? !hasCustomLight
                              : hasCustomLight && activeSelectedToken.light_radius === preset.radius;
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              title={preset.desc}
                              onClick={() =>
                                onUpdateTokenStats?.(activeSelectedToken.id, {
                                  light_radius: preset.radius,
                                })
                              }
                              className={cn(
                                'py-1.5 px-2 rounded-lg border text-[11px] font-semibold transition-all text-center',
                                isSelected
                                  ? 'bg-white/16 border-white/35 text-white'
                                  : 'bg-white/[0.04] border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                              )}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Ajuste fino do raio individual */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-300 font-semibold">Alcance da Luz</span>
                          <span className="font-mono font-bold text-white tabular-nums">
                            {effectiveLight}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={75}
                          step={2}
                          value={effectiveLight}
                          onChange={(e) =>
                            onUpdateTokenStats?.(activeSelectedToken.id, {
                              light_radius: Number(e.target.value),
                            })
                          }
                          className="w-full h-1.5 rounded-full bg-white/15 accent-white cursor-pointer"
                        />
                      </div>

                      {/* Cor / Temperatura da Iluminação */}
                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <span className="text-[11px] font-semibold text-slate-300">Cor da Luz:</span>
                        <div className="flex items-center gap-1.5">
                          {TOKEN_LIGHT_COLORS.map((col) => {
                            const selected = activeColorId === col.id;
                            return (
                              <button
                                key={col.id}
                                type="button"
                                title={col.label}
                                aria-label={col.label}
                                onClick={() =>
                                  onUpdateTokenStats?.(activeSelectedToken.id, {
                                    light_color: col.id,
                                  })
                                }
                                className={cn(
                                  'h-6 w-6 rounded-full border-2 transition-transform',
                                  selected
                                    ? 'scale-115 border-white shadow-[0_0_12px_rgba(255,255,255,0.45)]'
                                    : 'border-white/25 opacity-75 hover:opacity-100'
                                )}
                                style={{ backgroundColor: col.hex }}
                              />
                            );
                          })}
                        </div>
                      </div>

                      <p className="text-[10px] text-slate-400 leading-snug">
                        Iluminação individual tem prioridade e nunca é sobrescrita pela tocha global do menu de Atmosfera.
                      </p>
                    </div>
                  );
                })()}

                {/* Edição Direta de Vida Máxima e Mana Máxima (Exigência do Usuário) */}
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                    Ajuste Fino de Atributos & Máximos:
                  </span>
                  <div className="grid grid-cols-2 gap-2.5">
                    <FormField label="Vida Máxima (Max HP):">
                      <Input
                        type="number"
                        min="1"
                        value={activeSelectedToken.max_hp || 1}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value) || 1);
                          onUpdateTokenStats?.(activeSelectedToken.id, { max_hp: val });
                        }}
                      />
                    </FormField>

                    <FormField label="Mana Máxima (Max Mana):">
                      <Input
                        type="number"
                        min="0"
                        value={activeSelectedToken.max_mana ?? 0}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          onUpdateTokenStats?.(activeSelectedToken.id, { max_mana: val });
                        }}
                      />
                    </FormField>

                    <FormField label="Vida Atual (HP):">
                      <Input
                        type="number"
                        min="0"
                        value={activeSelectedToken.hp ?? 0}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          onUpdateTokenStats?.(activeSelectedToken.id, { hp: val });
                        }}
                      />
                    </FormField>

                    <FormField label="Mana Atual:">
                      <Input
                        type="number"
                        min="0"
                        value={activeSelectedToken.mana ?? 0}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          onUpdateTokenStats?.(activeSelectedToken.id, { mana: val });
                        }}
                      />
                    </FormField>
                  </div>
                </div>

                {/* Alterar Tamanho do Token (Escala D&D) */}
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1.5 block">
                    Tamanho do Bonequinho (Escala D&D):
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {Object.entries(TOKEN_SIZES).map(([key, s]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={async () => {
                          if (onUpdateTokenStats) {
                            await onUpdateTokenStats(activeSelectedToken.id, { size: key });
                            toast.success(`Tamanho alterado para ${s.label}`);
                          }
                        }}
                        className={cn(
                          'py-1.5 px-1 rounded-lg border text-xs font-mono font-bold transition-all text-center',
                          activeSelectedToken.size === key
                            ? 'bg-white/20 text-white border-white/30'
                            : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                        )}
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Condições de Status D&D com Ícones Representativos (DOBRO DO TAMANHO: 40x40px / h-10 w-10 com ícone 24x24px / h-6 w-6) */}
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-2 block">
                    Condições de Status Ativas:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {TOKEN_CONDITIONS.map((cond) => {
                      const active = activeSelectedToken.conditions?.includes(cond.id);
                      const CondIcon = CONDITION_ICONS[cond.id];
                      return (
                        <button
                          key={cond.id}
                          type="button"
                          onClick={async () => {
                            const cur = activeSelectedToken.conditions || [];
                            const next = active
                              ? cur.filter((c) => c !== cond.id)
                              : [...cur, cond.id];
                            if (onUpdateTokenStats) {
                              await onUpdateTokenStats(activeSelectedToken.id, { conditions: next });
                            }
                          }}
                          className={cn(
                            'p-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2.5 text-left',
                            active
                              ? 'bg-white/20 text-white border-white/40 shadow-lg ring-1 ring-white/25'
                              : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white'
                          )}
                          style={
                            active
                              ? {
                                  borderColor: `${cond.color}88`,
                                  backgroundColor: `${cond.color}22`,
                                }
                              : undefined
                          }
                        >
                          <span
                            className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-md"
                            style={{
                              backgroundColor: `${cond.color}30`,
                              border: `1.5px solid ${cond.color}75`,
                              boxShadow: active ? `0 0 12px ${cond.color}66` : undefined,
                            }}
                          >
                            {CondIcon && <CondIcon className="h-6 w-6" style={{ color: cond.color }} />}
                          </span>
                          <span className="truncate text-sm">{cond.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Ocultar / Excluir */}
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      const nextHidden = !activeSelectedToken.hidden;
                      if (onUpdateTokenStats) {
                        await onUpdateTokenStats(activeSelectedToken.id, { hidden: nextHidden });
                        toast.success(nextHidden ? 'Token ocultado dos jogadores.' : 'Token visível para todos.');
                      }
                    }}
                    className="text-xs gap-1.5"
                  >
                    {activeSelectedToken.hidden ? (
                      <>
                        <Eye className="h-3.5 w-3.5 text-slate-300" />
                        Tornar Visível
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3.5 w-3.5 text-slate-300" />
                        Ocultar dos Jogadores
                      </>
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant="danger"
                    onClick={async () => {
                      if (onDeleteToken && confirm('Remover este token da mesa?')) {
                        await onDeleteToken(activeSelectedToken.id);
                        setSelectedTokenId(null);
                        setInspectModalOpen(false);
                        toast.success('Token removido.');
                      }
                    }}
                    className="text-xs gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir Token
                  </Button>
                </div>
              </div>
            )}
          </div>
          );
        })()}
      </Modal>
      </div>
    </div>
  );
}
