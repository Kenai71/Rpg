/* eslint-disable @next/next/no-img-element */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Compass,
  Crosshair,
  Dices,
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
  Minimize2,
  Minus,
  Move,
  Plus,
  RotateCcw,
  Ruler,
  Shield,
  ShieldAlert,
  Skull,
  Trash2,
  Unlock,
  User,
  X,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { FormField, Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { TacticalDice3D } from './TacticalDice3D';
import { TOKEN_CONDITIONS, TOKEN_SIZES } from '../../lib/map-presets';
import { cn } from '../../lib/utils';

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
  onUpdateTokenPosition,
  onUpdateTokenStats,
  onDeleteToken,
  onUpdateMap,
  onPing,
  pings = [],
  diceRolls = [],
  onDiceRoll,
}) {
  const containerRef = useRef(null);
  const mapImageRef = useRef(null);

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

  // Dimensões Naturais e Proporção da Imagem (Exibição por inteiro sem cortar bordas)
  const [naturalDimensions, setNaturalDimensions] = useState({ width: 1400, height: 900 });
  const [imageStatus, setImageStatus] = useState('loading'); // 'loading' | 'loaded' | 'error'

  useEffect(() => {
    if (map?.imageUrl) {
      setImageStatus('loading');
      const probe = new Image();
      probe.onload = () => {
        const w = probe.naturalWidth || 1400;
        const h = probe.naturalHeight || 900;
        setNaturalDimensions({ width: w, height: h });
        setImageStatus('loaded');
      };
      probe.onerror = () => {
        setImageStatus('error');
      };
      probe.src = map.imageUrl;
    } else {
      setImageStatus('loaded');
    }
  }, [map?.id, map?.imageUrl]);

  // Cálculo das dimensões reais preservando proporção natural da imagem
  const mapDisplaySize = useMemo(() => {
    const { width, height } = naturalDimensions;
    const ratio = width > 0 && height > 0 ? width / height : 1.5;
    let baseW = 1400;
    let baseH = Math.round(baseW / ratio);
    if (ratio < 0.75) {
      baseH = 1200;
      baseW = Math.round(baseH * ratio);
    }
    return { width: baseW, height: baseH };
  }, [naturalDimensions]);

  // Ajustar mapa à tela (Fit to screen)
  const handleFitToScreen = useCallback(() => {
    const container = containerRef.current;
    if (!container || !mapDisplaySize.width || !mapDisplaySize.height) return;
    const cWidth = container.clientWidth - 40;
    const cHeight = container.clientHeight - 40;
    const scaleW = cWidth / mapDisplaySize.width;
    const scaleH = cHeight / mapDisplaySize.height;
    const fitScale = Math.min(scaleW, scaleH);
    const rounded = Math.max(0.25, Math.min(2.5, Math.round(fitScale * 100) / 100));
    setZoom(rounded);
    setPan({ x: 0, y: 0 });
  }, [mapDisplaySize]);

  // Auto-ajuste na primeira carga se não houver escala customizada
  useEffect(() => {
    if (map?.scale) {
      setZoom(map.scale);
    } else if (map?.id) {
      handleFitToScreen();
    }
  }, [map?.id, map?.scale, handleFitToScreen]);

  // Zoom suave com Scroll do Mouse dentro do mapa sem rolar a página externa
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      // Impede a rolagem vertical/horizontal da página
      e.preventDefault();

      // deltaY < 0: scroll para cima (aumenta o zoom) | deltaY > 0: scroll para baixo (diminui o zoom)
      const zoomStep = e.deltaY < 0 ? 0.12 : -0.12;
      setZoom((z) => Math.min(3.5, Math.max(0.35, Math.round((z + zoomStep) * 100) / 100)));
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

  // Rolador Rápido de Dados Integrado & Histórico Lateral Sincronizado (Limite de 15 rolagens)
  const MAX_ROLL_HISTORY = 15;
  const [diceOpen, setDiceOpen] = useState(false);
  const [rollHistoryOpen, setRollHistoryOpen] = useState(true);
  const [recentRoll, setRecentRoll] = useState(null);
  const [active3DRoll, setActive3DRoll] = useState(null);
  const [sharedBannerRoll, setSharedBannerRoll] = useState(null);
  const [rollingSeedKey, setRollingSeedKey] = useState(null);
  const [settledLocalRolls, setSettledLocalRolls] = useState([]);
  const processedRollKeysRef = useRef(new Set());
  const initialHistorySeededRef = useRef(false);
  const bannerTimerRef = useRef(null);

  const showTopResultBanner = useCallback((rollObj) => {
    if (!rollObj) return;
    setSharedBannerRoll(rollObj);
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
    }
    bannerTimerRef.current = setTimeout(() => {
      setSharedBannerRoll((cur) => (cur?.seed === rollObj.seed ? null : cur));
    }, 4200);
  }, []);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, []);

  const getRollSeedKey = useCallback((r) => {
    if (!r) return '';
    return r.seed ? `${r.seed}_${r.sides}_${r.roll}` : String(r.id || '');
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

      // Transmite o resultado consolidado para todos os outros jogadores e Mestre exatamente quando o dado para
      if (onDiceRoll && map?.id) {
        try {
          await onDiceRoll({
            map_id: map.id,
            user_id: settledRoll.user_id || currentUserId,
            user_name: settledRoll.user_name || currentUserName || (isMaster ? 'Mestre' : 'Aventureiro'),
            user_role: settledRoll.user_role || (isMaster ? 'master' : 'player'),
            sides: settledRoll.sides,
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
    if (!remoteDiceRolls || remoteDiceRolls.length === 0) return;

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

  // Ordem de Combate / Iniciativa
  const [initiativeOpen, setInitiativeOpen] = useState(Boolean(map?.combat_active));

  useEffect(() => {
    setIsLocked(Boolean(map?.is_locked));
  }, [map?.is_locked]);

  // Limpa posições locais quando tokens externos mudam e não estamos arrastando
  useEffect(() => {
    if (!localDraggingId) {
      setLocalTokenPositions({});
    }
  }, [tokens, localDraggingId]);

  // Controle de Zoom
  const handleZoomIn = () => setZoom((z) => Math.min(3.5, Math.round((z + 0.15) * 100) / 100));
  const handleZoomOut = () => setZoom((z) => Math.max(0.35, Math.round((z - 0.15) * 100) / 100));
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
    if (e.target.closest('[data-token-element]')) return;

    if (activeTool === 'ruler') {
      const rect = mapImageRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setRulerStart({ x, y });
      setRulerCurrent({ x, y });
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
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
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
      setTimeout(() => {
        setRulerStart(null);
        setRulerCurrent(null);
      }, 4000);
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
      if (isMaster) return true;
      if (!token) return false;
      return token.owner_id === currentUserId || token.character_id === currentUserId;
    },
    [isMaster, currentUserId]
  );

  const handleTokenPointerDown = (token, e) => {
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

    draggingTokenRef.current = {
      tokenId: token.id,
      grabOffsetX,
      grabOffsetY,
      startX: e.clientX,
      startY: e.clientY,
      hasMoved: false,
    };
    setLocalDraggingId(token.id);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handleTokenPointerMove = (token, e) => {
    if (!draggingTokenRef.current || draggingTokenRef.current.tokenId !== token.id) return;
    e.stopPropagation();

    const rect = mapImageRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;

    const { grabOffsetX, grabOffsetY, startX, startY } = draggingTokenRef.current;
    if (Math.abs(e.clientX - startX) > 2 || Math.abs(e.clientY - startY) > 2) {
      draggingTokenRef.current.hasMoved = true;
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

    setLocalTokenPositions((prev) => ({
      ...prev,
      [token.id]: { x: newPctX, y: newPctY },
    }));
  };

  const handleTokenPointerUp = async (token, e) => {
    if (!draggingTokenRef.current || draggingTokenRef.current.tokenId !== token.id) return;
    e.stopPropagation();

    const hasMoved = draggingTokenRef.current.hasMoved;

    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {}

    const finalPos = localTokenPositions[token.id];
    draggingTokenRef.current = null;

    if (hasMoved && finalPos && onUpdateTokenPosition) {
      justDraggedRef.current = true;
      setTimeout(() => {
        justDraggedRef.current = false;
      }, 150);

      const exactX = Math.max(0, Math.min(100, Math.round(Number(finalPos.x) * 10000) / 10000));
      const exactY = Math.max(0, Math.min(100, Math.round(Number(finalPos.y) * 10000) / 10000));

      try {
        await onUpdateTokenPosition(token.id, {
          x: exactX,
          y: exactY,
        });
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

  // Clique no Token para abrir detalhes/edição
  const handleTokenClick = (token, e) => {
    e.stopPropagation();
    if (justDraggedRef.current) return;
    setSelectedTokenId(token.id);
    setInspectModalOpen(true);
  };

  // Rolador Rápido de Dados com Simulação 3D e Transmissão em Tempo Real
  const rollDice = async (sides) => {
    const validSides = [4, 6, 8, 10, 12, 20].includes(Number(sides)) ? Number(sides) : 20;
    // Probabilidade 100% matemática uniforme (1 a N)
    const roll = Math.floor(Math.random() * validSides) + 1;
    const isCrit = validSides === 20 && roll === 20;
    const isMax = roll === validSides;
    const isFumble = validSides === 20 && roll === 1;
    const seed = Math.random();

    const nowMs = Date.now();
    const localRoll = {
      id: `local-${nowMs}-${Math.random()}`,
      map_id: map?.id,
      user_id: currentUserId,
      user_name: currentUserName || (isMaster ? 'Mestre' : 'Aventureiro'),
      user_role: isMaster ? 'master' : 'player',
      sides: validSides,
      roll,
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

    const seedKey = `${seed}_${validSides}_${roll}`;
    processedRollKeysRef.current.add(localRoll.id);
    processedRollKeysRef.current.add(seedKey);
    // O dado 3D roda apenas para a pessoa que girou; o resultado e a transmissão para todos ocorrem em handleRollSettled
    setRollingSeedKey(seedKey);
    setActive3DRoll(localRoll);
  };

  // Tokens visíveis (Mestre vê todos; jogadores não veem tokens com hidden === true)
  const visibleTokens = tokens.filter((t) => (isMaster ? true : !t.hidden));

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
      ref={containerRef}
      className="relative w-full h-[78vh] min-h-[540px] rounded-2xl overflow-hidden border border-white/10 bg-[#070913] select-none shadow-2xl transition-all"
      style={{
        backgroundImage: 'radial-gradient(circle at 50% 50%, #0d121f 0%, #06080e 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 24px 60px -12px rgba(0, 0, 0, 0.85)',
      }}
    >
      {/* BARRA DE FERRAMENTAS SUPERIOR FLUTUANTE (ÍCONES LIMPOS, SEM TEXTOS) */}
      <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between gap-2 pointer-events-none">
        {/* Lado Esquerdo: Controles de Mapa & Ferramentas (Apenas Ícones) */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-black/75 backdrop-blur-xl border border-white/12 pointer-events-auto shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
          <Button
            size="sm"
            variant={activeTool === 'select' ? 'primary' : 'ghost'}
            onClick={() => setActiveTool('select')}
            title="Selecionar e mover bonequinhos"
            className="h-8 w-8 p-0 flex items-center justify-center rounded-lg"
            aria-label="Mover"
          >
            <Move className="h-4 w-4 text-slate-300" />
          </Button>

          <Button
            size="sm"
            variant={activeTool === 'ruler' ? 'primary' : 'ghost'}
            onClick={() => setActiveTool((t) => (t === 'ruler' ? 'select' : 'ruler'))}
            title="Medir distância em metros/pés"
            className="h-8 w-8 p-0 flex items-center justify-center rounded-lg"
            aria-label="Régua"
          >
            <Ruler className="h-4 w-4 text-slate-300" />
          </Button>

          <Button
            size="sm"
            variant={activeTool === 'ping' ? 'primary' : 'ghost'}
            onClick={() => setActiveTool((t) => (t === 'ping' ? 'select' : 'ping'))}
            title={`Sinalizar radar (${pingCharges}/3 disponíveis a cada 15s)`}
            className="h-8 w-8 p-0 flex items-center justify-center rounded-lg relative"
            aria-label="Sinalizar"
          >
            <Crosshair className="h-4 w-4 text-slate-300" />
            <span
              className={cn(
                'absolute -bottom-1 -right-1 text-[9px] font-mono font-bold px-1 rounded-full border leading-tight',
                pingCharges > 0
                  ? 'bg-black/90 border-white/20 text-slate-300'
                  : 'bg-rose-950 border-rose-500/40 text-rose-300'
              )}
            >
              {pingCharges}
            </span>
          </Button>

          <div className="h-4 w-px bg-white/10 mx-0.5" />

          {/* Botão Fixar / Destravar Mapa (Apenas Ícone) */}
          <Button
            size="sm"
            variant={isLocked ? 'primary' : 'ghost'}
            onClick={handleToggleLock}
            title={isLocked ? 'Mapa fixado: clique e arraste tokens facilmente' : 'Mapa destravado: arraste para mover a tela'}
            className={cn('h-8 w-8 p-0 flex items-center justify-center rounded-lg', isLocked && 'bg-white/20 border-white/20')}
            aria-label={isLocked ? 'Fixado' : 'Livre'}
          >
            {isLocked ? (
              <Lock className="h-4 w-4 text-amber-300" />
            ) : (
              <Unlock className="h-4 w-4 text-slate-300" />
            )}
          </Button>

          {/* Alternar Grade Tática */}
          <Button
            size="sm"
            variant={showGrid ? 'secondary' : 'ghost'}
            onClick={() => setShowGrid((g) => !g)}
            title="Alternar grade tática"
            className="h-8 w-8 p-0 flex items-center justify-center rounded-lg"
            aria-label="Grade"
          >
            <Grid className="h-4 w-4 text-slate-300" />
          </Button>

          {/* Ajustar Mapa à Tela (Exibir Mapa Inteiro sem Cortar Bordas) */}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleFitToScreen}
            title="Ajustar mapa à tela (mostrar inteiro)"
            className="h-8 w-8 p-0 flex items-center justify-center rounded-lg text-slate-300 hover:text-white"
            aria-label="Ajustar à Tela"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Lado Direito: Combate, Dados e Zoom */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-black/75 backdrop-blur-xl border border-white/12 pointer-events-auto shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
          {/* Tracker de Iniciativa Toggle */}
          <Button
            size="sm"
            variant={initiativeOpen ? 'secondary' : 'ghost'}
            onClick={() => setInitiativeOpen((o) => !o)}
            title="Ordem de Iniciativa do Combate"
            className="h-8 px-2 text-xs gap-1 rounded-lg"
            aria-label="Turnos"
          >
            <Shield className="h-4 w-4 text-slate-300" />
            {initiativeOrder.length > 0 && (
              <span className="h-4 px-1 rounded-full bg-white/15 text-[10px] font-mono">
                {initiativeOrder.length}
              </span>
            )}
          </Button>

          {/* Rolador Rápido de Dados */}
          <Button
            size="sm"
            variant={diceOpen ? 'primary' : 'ghost'}
            onClick={() => setDiceOpen((d) => !d)}
            title="Rolador rápido de dados D&D"
            className="h-8 w-8 p-0 flex items-center justify-center rounded-lg"
            aria-label="Dados"
          >
            <Dices className="h-4 w-4 text-slate-300" />
          </Button>

          <div className="h-4 w-px bg-white/10 mx-0.5" />

          {/* Zoom In, Out, Reset */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={handleZoomOut}
              aria-label="Diminuir zoom do mapa"
              title="Diminuir zoom"
              className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </button>
            <span className="font-mono text-[11px] text-slate-300 w-10 text-center font-bold">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              aria-label="Aumentar zoom do mapa"
              title="Aumentar zoom"
              className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetView}
              aria-label="Restaurar visão (100%)"
              title="Restaurar visão (100%)"
              className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Barra de Iniciativa / Ordem de Turnos (Topo) */}
      {initiativeOpen && initiativeOrder.length > 0 && (
        <div className="absolute top-16 left-3 right-3 z-20 flex items-center gap-2 p-2 rounded-xl bg-black/80 backdrop-blur-md border border-white/10 overflow-x-auto shadow-xl">
          <div className="flex items-center gap-1.5 shrink-0 pr-2 border-r border-white/10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Combate
            </span>
            {isMaster && (
              <Button size="sm" onClick={handleNextTurn} className="h-6 px-2 text-[11px] gap-1">
                Próximo
                <ChevronRight className="h-3 w-3" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto py-0.5">
            {initiativeOrder.map((tok) => {
              const isCurrentTurn = map?.current_turn_token_id === tok.id;
              return (
                <button
                  key={tok.id}
                  type="button"
                  onClick={() => {
                    setSelectedTokenId(tok.id);
                    setInspectModalOpen(true);
                  }}
                  className={cn(
                    'flex items-center gap-2 px-2.5 py-1 rounded-lg border transition-all shrink-0 text-left',
                    isCurrentTurn
                      ? 'bg-amber-500/20 border-amber-400/50 text-white shadow-sm ring-1 ring-amber-400/30'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  )}
                >
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: tok.color || '#60a5fa' }}
                  />
                  <span className="text-xs font-bold truncate max-w-[90px]">{tok.name}</span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {tok.hp}/{tok.max_hp}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Rolador Rápido de Dados Flutuante */}
      {diceOpen && (
        <div className="absolute bottom-4 right-4 z-30 p-3 rounded-2xl bg-black/85 backdrop-blur-xl border border-white/15 shadow-2xl space-y-3 w-72">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Dices className="h-3.5 w-3.5 text-slate-300" />
              Rolador D&D
            </span>
            <button
              type="button"
              onClick={() => setDiceOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {[4, 6, 8, 10, 12, 20].map((sides) => (
              <button
                key={sides}
                type="button"
                onClick={() => rollDice(sides)}
                className="py-1.5 px-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/15 text-xs font-mono font-bold text-white transition-all text-center"
              >
                d{sides}
              </button>
            ))}
          </div>

          {rollingSeedKey && active3DRoll ? (
            <div className="p-2.5 rounded-xl border border-white/15 bg-white/5 text-center animate-pulse">
              <div className="text-[10px] uppercase font-bold text-slate-400">
                Rolando d{active3DRoll.sides}...
              </div>
              <div className="text-lg font-bold font-mono text-slate-300">
                Aguardando dado parar...
              </div>
            </div>
          ) : (
            recentRoll && (
              <div
                key={recentRoll.id || recentRoll.seed}
                className={cn(
                  'p-2.5 rounded-xl border text-center transition-all animate-in fade-in zoom-in-95',
                  recentRoll.is_max || recentRoll.isMax || recentRoll.isCrit
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                    : recentRoll.is_fumble || recentRoll.isFumble
                    ? 'bg-rose-500/20 border-rose-400 text-rose-200'
                    : 'bg-white/10 border-white/15 text-white'
                )}
              >
                <div className="text-[10px] uppercase font-bold text-slate-400">
                  Resultado d{recentRoll.sides}
                </div>
                <div className="text-2xl font-black font-mono">
                  {recentRoll.roll}
                  {(recentRoll.is_max || recentRoll.isMax || recentRoll.isCrit) && ' (Máximo!)'}
                  {(recentRoll.is_fumble || recentRoll.isFumble) && ' (Falha Crítica!)'}
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* PAINEL LATERAL: HISTÓRICO DAS ÚLTIMAS 15 ROLAGENS DE DADOS */}
      <div
        className={cn(
          'absolute left-3 z-20 w-60 rounded-2xl bg-[#0c101b]/88 backdrop-blur-xl border border-white/15 shadow-2xl transition-all duration-200 pointer-events-auto',
          initiativeOpen && initiativeOrder.length > 0 ? 'top-28' : 'top-16'
        )}
      >
        <button
          type="button"
          onClick={() => setRollHistoryOpen((prev) => !prev)}
          className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/5 rounded-2xl transition-colors"
          title="Alternar histórico das últimas 15 rolagens"
        >
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-200">
            <Dices className="h-3.5 w-3.5 text-slate-300 shrink-0" />
            Histórico de Dados
          </span>
          <span className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded-full bg-white/10 border border-white/10 text-[10px] font-mono font-bold text-slate-300">
              {rollHistory.length}/{MAX_ROLL_HISTORY}
            </span>
            {rollHistoryOpen ? (
              <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            )}
          </span>
        </button>

        {rollHistoryOpen && (
          <div className="px-2.5 pb-2.5 pt-1 border-t border-white/10 space-y-1.5 max-h-[310px] overflow-y-auto">
            {rollingSeedKey && active3DRoll && (
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/15 animate-pulse">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-white truncate">
                    {active3DRoll.user_name || 'Aventureiro'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Rolando d{active3DRoll.sides}...
                  </div>
                </div>
                <div className="h-7 w-7 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center font-mono text-xs font-bold text-slate-300">
                  ?
                </div>
              </div>
            )}

            {rollHistory.length === 0 && !rollingSeedKey ? (
              <div className="py-3 text-center text-[11px] text-slate-400">
                Nenhuma rolagem registrada.
              </div>
            ) : (
              rollHistory.map((item, idx) => {
                const isMax = Boolean(item.is_max || item.isMax || item.isCrit || item.is_crit);
                const isFumble = Boolean(item.is_fumble || item.isFumble);
                const itemKey = getRollSeedKey(item) || item.id || idx;

                return (
                  <div
                    key={itemKey}
                    className={cn(
                      'flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border transition-all',
                      isMax
                        ? 'bg-amber-950/45 border-amber-400/40 text-amber-100'
                        : isFumble
                        ? 'bg-rose-950/45 border-rose-400/40 text-rose-100'
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
                      <div className="flex items-center gap-1.5 mt-0.5 pl-4">
                        <span className="text-[10px] font-mono font-semibold text-slate-400">
                          d{item.sides}
                        </span>
                        {item.user_role === 'master' && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-white/10 text-slate-300 font-semibold">
                            Mestre
                          </span>
                        )}
                        {isMax && (
                          <span className="text-[9px] font-bold text-amber-300">
                            Máximo!
                          </span>
                        )}
                        {isFumble && (
                          <span className="text-[9px] font-bold text-rose-400">
                            Falha!
                          </span>
                        )}
                      </div>
                    </div>

                    <div
                      className={cn(
                        'h-8 min-w-[2rem] px-1.5 rounded-lg flex items-center justify-center font-mono font-black text-sm shrink-0 border',
                        isMax
                          ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                          : isFumble
                          ? 'bg-rose-500/20 border-rose-400/50 text-rose-300'
                          : 'bg-white/10 border-white/15 text-white'
                      )}
                    >
                      {item.roll}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* BANNER SUPERIOR DE RESULTADO SINCRONIZADO PARA TODOS (EXIBIDO APENAS APÓS O DADO PARAR DE ROLAR) */}
      {sharedBannerRoll && (
        <div
          key={getRollSeedKey(sharedBannerRoll)}
          className={cn(
            'pointer-events-auto absolute top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-2xl border shadow-2xl backdrop-blur-2xl transition-all duration-300 animate-in fade-in zoom-in-95',
            sharedBannerRoll.is_max || sharedBannerRoll.isMax
              ? 'bg-amber-950/90 border-amber-400/70 text-amber-200 shadow-[0_0_35px_rgba(245,158,11,0.3)]'
              : sharedBannerRoll.is_fumble || sharedBannerRoll.isFumble
              ? 'bg-rose-950/90 border-rose-400/70 text-rose-200 shadow-[0_0_35px_rgba(244,63,94,0.3)]'
              : 'bg-[#0c101b]/92 border-white/20 text-white shadow-[0_0_30px_rgba(0,0,0,0.75)]'
          )}
        >
          <div
            className={cn(
              'h-11 w-11 rounded-xl flex items-center justify-center font-black font-mono text-xl shadow-inner shrink-0',
              sharedBannerRoll.is_max || sharedBannerRoll.isMax
                ? 'bg-amber-500/25 border border-amber-400/60 text-amber-300'
                : sharedBannerRoll.is_fumble || sharedBannerRoll.isFumble
                ? 'bg-rose-500/25 border border-rose-400/60 text-rose-300'
                : 'bg-white/10 border border-white/15 text-white'
            )}
          >
            {sharedBannerRoll.roll}
          </div>

          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="truncate max-w-[160px] font-bold text-white">
                {sharedBannerRoll.user_name || 'Aventureiro'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                (d{sharedBannerRoll.sides})
              </span>
            </div>

            <div className="text-sm font-black tracking-wide">
              {sharedBannerRoll.is_max || sharedBannerRoll.isMax ? (
                <span className="text-amber-300 flex items-center gap-1">
                  <Zap className="h-4 w-4" />
                  SUCESSO MÁXIMO! ({sharedBannerRoll.roll})
                </span>
              ) : sharedBannerRoll.is_fumble || sharedBannerRoll.isFumble ? (
                <span className="text-rose-400 font-bold">
                  FALHA CRÍTICA! (1)
                </span>
              ) : (
                <span className="text-slate-100">
                  Rolou {sharedBannerRoll.roll} no d{sharedBannerRoll.sides}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSharedBannerRoll(null)}
            className="ml-2 h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
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

      {/* ÁREA PRINCIPAL DO MAPA (VIEWPORT COM PAN & ZOOM) */}
      <div
        className="w-full h-full cursor-grab active:cursor-grabbing flex items-center justify-center overflow-hidden"
        onPointerDown={handleMapPointerDown}
        onPointerMove={handleMapPointerMove}
        onPointerUp={handleMapPointerUp}
      >
        <div
          ref={mapImageRef}
          className="relative transition-transform duration-75 will-change-transform"
          style={{
            width: `${mapDisplaySize.width}px`,
            height: `${mapDisplaySize.height}px`,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
          }}
        >
          {/* Imagem do Mapa: Exibição por inteiro com object-contain e maior qualidade */}
          {map?.imageUrl ? (
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
                  key={map.id + (map.imageUrl ? map.imageUrl.slice(0, 40) : '')}
                  src={map.imageUrl}
                  alt={map.title || 'Mapa Tático'}
                  draggable={false}
                  referrerPolicy="no-referrer"
                  onLoad={() => setImageStatus('loaded')}
                  onError={() => setImageStatus('error')}
                  className={cn(
                    'w-full h-full block pointer-events-none rounded-lg shadow-2xl object-fill transition-opacity duration-300',
                    imageStatus === 'loaded' ? 'opacity-100' : 'opacity-0'
                  )}
                  style={{
                    width: `${mapDisplaySize.width}px`,
                    height: `${mapDisplaySize.height}px`,
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

          {/* Linha da Régua Ativa */}
          {rulerStart && rulerCurrent && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-20"
              style={{ overflow: 'visible' }}
            >
              <line
                x1={`${rulerStart.x}%`}
                y1={`${rulerStart.y}%`}
                x2={`${rulerCurrent.x}%`}
                y2={`${rulerCurrent.y}%`}
                stroke="#38bdf8"
                strokeWidth="2.5"
                strokeDasharray="6 4"
              />
              <circle cx={`${rulerStart.x}%`} cy={`${rulerStart.y}%`} r="4" fill="#38bdf8" />
              <circle cx={`${rulerCurrent.x}%`} cy={`${rulerCurrent.y}%`} r="5" fill="#38bdf8" />
              <text
                x={`${(rulerStart.x + rulerCurrent.x) / 2}%`}
                y={`${(rulerStart.y + rulerCurrent.y) / 2}%`}
                fill="#ffffff"
                fontSize="12"
                fontWeight="bold"
                textAnchor="middle"
                dy="-8"
                className="font-mono bg-black"
              >
                {rulerDistance}m ({Math.round(rulerDistance * 3.28)} ft)
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
                className="absolute pointer-events-none z-30 flex flex-col items-center justify-center -translate-x-1/2 -translate-y-1/2 transition-opacity duration-200"
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  opacity: Math.max(0, Math.min(1, fadeRatio)),
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

          {/* CAMADA DE BONEQUINHOS / TOKENS */}
          {visibleTokens.map((token) => {
            const rawPos = localTokenPositions[token.id] || { x: token.x, y: token.y };
            const pos = {
              x: Number.isFinite(Number(rawPos.x)) ? Number(rawPos.x) : 50,
              y: Number.isFinite(Number(rawPos.y)) ? Number(rawPos.y) : 50,
            };
            const isMovable = canMoveToken(token);
            const isCurrentTurn = map?.current_turn_token_id === token.id;
            const sizeCfg = TOKEN_SIZES[token.size] || TOKEN_SIZES.M;
            const tokenPx = sizeCfg.px;

            const hpPct = Math.max(
              0,
              Math.min(100, Math.round(((token.hp || 0) / (token.max_hp || 1)) * 100))
            );

            return (
              <div
                key={token.id}
                data-token-element="true"
                onPointerDown={(e) => handleTokenPointerDown(token, e)}
                onPointerMove={(e) => handleTokenPointerMove(token, e)}
                onPointerUp={(e) => handleTokenPointerUp(token, e)}
                onClick={(e) => handleTokenClick(token, e)}
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  width: `${tokenPx}px`,
                  height: `${tokenPx}px`,
                  transition:
                    localDraggingId === token.id
                      ? 'none'
                      : 'left 0.2s cubic-bezier(0.2, 0, 0, 1), top 0.2s cubic-bezier(0.2, 0, 0, 1)',
                }}
                className={cn(
                  'absolute -translate-x-1/2 -translate-y-1/2 z-10 select-none group',
                  isMovable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                )}
              >
                {/* Condições de Status Ativas com Ícones (Dobro do Tamanho: 32x32px / h-8 w-8 com ícone 20x20px / h-5 w-5) */}
                {Array.isArray(token.conditions) && token.conditions.length > 0 && (
                  <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 flex items-center justify-center gap-1 z-20 pointer-events-none">
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
                      : `radial-gradient(circle at 32% 28%, ${token.color || '#3b82f6'}ff 0%, ${token.color || '#3b82f6'}cc 55%, #090d16 100%)`,
                    border: `2.5px solid ${token.color || '#60a5fa'}`,
                    boxShadow: `inset 0 2px 4px rgba(255, 255, 255, 0.35), inset 0 -3px 6px rgba(0, 0, 0, 0.75), 0 6px 16px rgba(0, 0, 0, 0.8), 0 0 16px ${token.color || '#60a5fa'}66`,
                  }}
                >
                  {/* Aro interno sutil de acabamento de peça de tabuleiro */}
                  <div className="absolute inset-0.5 rounded-full border border-white/25 pointer-events-none" />

                  {token.avatar ? (
                    <img
                      src={token.avatar}
                      alt={token.name}
                      className="w-full h-full rounded-full object-cover pointer-events-none"
                    />
                  ) : (
                    <span
                      className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] truncate px-1 tracking-tight"
                      style={{ fontSize: `${Math.max(11, Math.round(tokenPx * 0.34))}px` }}
                    >
                      {token.name?.slice(0, 2).toUpperCase()}
                    </span>
                  )}

                  {/* Ícone de Oculto se for Token Invisível aos jogadores */}
                  {token.hidden && (
                    <div className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-black/90 border border-amber-400/50 text-amber-300 shadow-lg">
                      <EyeOff className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>

                {/* Rótulo de Vida, Mana e Nome Flutuante (Abaixo do Círculo, sem afetar o centro geométrico Y do token) */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-1.5 flex flex-col items-center pointer-events-none z-10 w-40">
                  {/* Barra de Vida Aprimorada sob o Token */}
                  <div className="w-12 h-1.5 bg-black/90 rounded-full overflow-hidden border border-white/25 shadow-md">
                    <div
                      className={cn(
                        'h-full transition-all duration-200',
                        hpPct > 50 ? 'bg-emerald-400' : hpPct > 25 ? 'bg-amber-400' : 'bg-rose-500'
                      )}
                      style={{ width: `${hpPct}%` }}
                    />
                  </div>

                  {/* Placa de Nome e CA sob a Barra de Vida */}
                  <div className="text-center mt-1 flex items-center justify-center gap-1 max-w-[148px]">
                    <span className="px-2 py-0.5 rounded-md bg-[#0c101b]/95 backdrop-blur-md text-[10px] font-bold text-white border border-white/15 whitespace-nowrap shadow-[0_4px_12px_rgba(0,0,0,0.85)] flex items-center gap-1 truncate">
                      <span className="truncate">{token.name}</span>
                      <span className="text-[9px] font-mono text-slate-300 pl-1 border-l border-white/15 shrink-0">
                        {token.hp}/{token.max_hp}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
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
        title={isMaster ? `Mestrar: ${activeSelectedToken?.name}` : `Ficha de ${activeSelectedToken?.name}`}
        maxWidth="max-w-md"
      >
        {activeSelectedToken && (
          <div className="space-y-4 py-1">
            {/* Cabeçalho Aprimorado do Token */}
            <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-[#0c101b] border border-white/15 shadow-inner">
              <div
                className="h-16 w-16 rounded-full flex items-center justify-center font-black text-lg text-white shrink-0 relative"
                style={{
                  background: activeSelectedToken.avatar
                    ? '#0c101b'
                    : `radial-gradient(circle at 32% 28%, ${activeSelectedToken.color || '#3b82f6'}ff 0%, ${activeSelectedToken.color || '#3b82f6'}cc 55%, #090d16 100%)`,
                  border: `2.5px solid ${activeSelectedToken.color || '#60a5fa'}`,
                  boxShadow: `inset 0 2px 4px rgba(255, 255, 255, 0.35), 0 0 18px ${activeSelectedToken.color || '#60a5fa'}55`,
                }}
              >
                <div className="absolute inset-0.5 rounded-full border border-white/25 pointer-events-none" />
                {activeSelectedToken.avatar ? (
                  <img
                    src={activeSelectedToken.avatar}
                    alt={activeSelectedToken.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  activeSelectedToken.name?.slice(0, 2).toUpperCase()
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-extrabold text-white truncate">
                    {activeSelectedToken.name}
                  </h3>
                  <Badge className="bg-white/10 text-slate-300 border-white/15 text-[10px]">
                    {activeSelectedToken.type === 'monster'
                      ? 'Monstro'
                      : activeSelectedToken.type === 'npc'
                      ? 'NPC'
                      : 'Herói'}
                  </Badge>
                </div>
                {isMaster && (
                  <p className="text-xs text-slate-400">
                    Tamanho: {TOKEN_SIZES[activeSelectedToken.size]?.label || 'Médio (M)'}
                  </p>
                )}
              </div>
            </div>

            {/* Status Principais: Vida (HP), Armadura (AC), Mana */}
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

            {/* CONTROLES EXCLUSIVOS DO MESTRE: ALTERAR MÁXIMOS E TAMANHO */}
            {isMaster && (
              <div className="space-y-3 pt-2 border-t border-white/10">
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
        )}
      </Modal>
    </div>
  );
}
