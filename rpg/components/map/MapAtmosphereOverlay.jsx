'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils';

export const DARKNESS_BLIND_THRESHOLD = 60;

export const DEFAULT_MAP_EFFECTS = {
  weather: 'none', // 'none' | 'rain' | 'storm' | 'snow' | 'embers' | 'ash' | 'sandstorm'
  fog: 0, // 0..100
  darkness: 0, // 0..100 (>= 60% isola a visão dos jogadores no escuro)
  torchRadius: 0, // 0 (off) ou 12..65 (% da menor dimensão como padrão global para heróis sem luz individual)
  blackout: false, // Oculta completamente o mapa para os jogadores
};

export const MAP_WEATHER_OPTIONS = [
  { id: 'none', label: 'Sem Clima' },
  { id: 'rain', label: 'Chuva' },
  { id: 'storm', label: 'Tempestade' },
  { id: 'snow', label: 'Neve' },
  { id: 'embers', label: 'Brasas' },
  { id: 'ash', label: 'Cinzas' },
  { id: 'sandstorm', label: 'Areia' },
];

export const TOKEN_LIGHT_COLORS = [
  { id: 'warm', label: 'Tocha Âmbar', hex: '#fbbf24', glow: 'rgba(251, 191, 36, 0.24)', ring: 'rgba(251, 191, 36, 0.62)' },
  { id: 'holy', label: 'Luz Sagrada', hex: '#fef08a', glow: 'rgba(254, 240, 138, 0.22)', ring: 'rgba(254, 240, 138, 0.58)' },
  { id: 'arcane', label: 'Arcano Azul', hex: '#60a5fa', glow: 'rgba(96, 165, 250, 0.24)', ring: 'rgba(96, 165, 250, 0.62)' },
  { id: 'emerald', label: 'Esmeralda', hex: '#34d399', glow: 'rgba(52, 211, 153, 0.22)', ring: 'rgba(52, 211, 153, 0.58)' },
  { id: 'crimson', label: 'Rubro / Brasa', hex: '#fb7185', glow: 'rgba(251, 113, 133, 0.22)', ring: 'rgba(251, 113, 133, 0.58)' },
];

export const TOKEN_LIGHT_PRESETS = [
  { label: 'Seguir Mapa', radius: null, desc: 'Usa a tocha global do mapa' },
  { label: 'Apagada', radius: 0, desc: 'Sem iluminação própria' },
  { label: 'Vela', radius: 14, desc: 'Luz curta (14%)' },
  { label: 'Tocha', radius: 26, desc: 'Luz padrão (26%)' },
  { label: 'Lanterna', radius: 42, desc: 'Alcance amplo (42%)' },
  { label: 'Farol', radius: 62, desc: 'Iluminação massiva (62%)' },
];

export function getTokenLightColorMeta(colorId) {
  return TOKEN_LIGHT_COLORS.find((c) => c.id === colorId) || TOKEN_LIGHT_COLORS[0];
}

export const MAP_EFFECT_PRESETS = [
  {
    id: 'clear',
    label: 'Céu Limpo',
    effects: { weather: 'none', fog: 0, darkness: 0, torchRadius: 0, blackout: false },
  },
  {
    id: 'rainy',
    label: 'Chuva',
    effects: { weather: 'rain', fog: 25, darkness: 25, torchRadius: 0, blackout: false },
  },
  {
    id: 'storm',
    label: 'Tempestade',
    effects: { weather: 'storm', fog: 40, darkness: 48, torchRadius: 0, blackout: false },
  },
  {
    id: 'dense_fog',
    label: 'Névoa Densa',
    effects: { weather: 'none', fog: 82, darkness: 30, torchRadius: 28, blackout: false },
  },
  {
    id: 'dungeon_torch',
    label: 'Masmorra (Tocha)',
    effects: { weather: 'ash', fog: 25, darkness: 90, torchRadius: 26, blackout: false },
  },
  {
    id: 'pitch_dark',
    label: 'Escuridão Total',
    effects: { weather: 'none', fog: 15, darkness: 98, torchRadius: 0, blackout: false },
  },
  {
    id: 'volcano',
    label: 'Vulcão / Brasas',
    effects: { weather: 'embers', fog: 30, darkness: 22, torchRadius: 0, blackout: false },
  },
  {
    id: 'blizzard',
    label: 'Nevasca',
    effects: { weather: 'snow', fog: 55, darkness: 20, torchRadius: 0, blackout: false },
  },
  {
    id: 'blackout',
    label: 'Ocultar Mapa',
    effects: { weather: 'none', fog: 0, darkness: 100, torchRadius: 0, blackout: true },
  },
];

export function normalizeMapEffects(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_MAP_EFFECTS };
  const validWeathers = ['none', 'rain', 'storm', 'snow', 'embers', 'ash', 'sandstorm'];
  return {
    weather: validWeathers.includes(raw.weather) ? raw.weather : 'none',
    fog: Math.max(0, Math.min(100, Math.round(Number(raw.fog) || 0))),
    darkness: Math.max(0, Math.min(100, Math.round(Number(raw.darkness) || 0))),
    torchRadius: Math.max(0, Math.min(65, Math.round(Number(raw.torchRadius) || 0))),
    blackout: Boolean(raw.blackout),
  };
}

/**
 * Motor geométrico único de Visão & Iluminação por Proximidade (escala 1:1 em pixels do mapa).
 *
 * Regras táticas:
 * 1. Escuridão >= 60%: jogadores deixam de se enxergar fora de áreas iluminadas (manto quase opaco + ocultação de tokens).
 * 2. Iluminação de outros tokens:
 *    - Longe (fora do campo de visão da sua iluminação): 0% visível (o jogador NÃO vê a luz nem o token do outro).
 *    - No campo de visão da sua iluminação (mas não andando lado a lado): visão PARCIAL do que o outro ilumina
 *      (raio reduzido 36%–72% e penumbra parcial 42%–76% — nunca 100%).
 *    - Andando JUNTOS (proximidade de grupo): compartilham 100% da iluminação um do outro.
 * 3. Mestre (fora do modo prévia): enxerga sempre todos os tokens e 100% da iluminação dos heróis.
 */
export function computeViewerLightingState({
  tokens = [],
  localTokenPositions = {},
  effects = DEFAULT_MAP_EFFECTS,
  isMaster = false,
  previewAsPlayer = false,
  viewerTokenId = null,
  mapWidth = 1400,
  mapHeight = 900,
}) {
  const safe = normalizeMapEffects(effects);
  const effectivePlayerView = !isMaster || previewAsPlayer;
  const safeW = Math.max(64, Number(mapWidth) || 1400);
  const safeH = Math.max(64, Number(mapHeight) || 900);
  const baseDim = Math.min(safeW, safeH);
  const globalTorch = Number(safe.torchRadius) || 0;
  const isDeepDarkness = safe.darkness >= DARKNESS_BLIND_THRESHOLD;

  const enriched = (Array.isArray(tokens) ? tokens : []).map((tok) => {
    const rawPos = localTokenPositions[tok.id] || { x: tok.x, y: tok.y };
    const x = Number.isFinite(Number(rawPos.x)) ? Number(rawPos.x) : 50;
    const y = Number.isFinite(Number(rawPos.y)) ? Number(rawPos.y) : 50;
    const px = (x / 100) * safeW;
    const py = (y / 100) * safeH;

    const hasIndividual =
      typeof tok.light_radius === 'number' && Number.isFinite(tok.light_radius);
    const radiusPct = hasIndividual
      ? Math.max(0, Math.min(80, tok.light_radius))
      : tok.type === 'player'
      ? globalTorch
      : 0;
    const radiusPx = (radiusPct / 100) * baseDim;

    return {
      tok,
      id: tok.id,
      name: tok.name,
      x,
      y,
      px,
      py,
      radiusPct,
      radiusPx,
      color: tok.light_color || 'warm',
      isHero: tok.type === 'player',
      isIndividual: hasIndividual,
    };
  });

  // 1. VISÃO DO MESTRE (vê sempre tudo e toda a iluminação dos tokens de herói/luz própria)
  if (!effectivePlayerView) {
    const darkOpacity =
      safe.darkness <= 0 ? 0 : Math.min(0.6, (safe.darkness / 100) * 0.6);

    const visibleLights = enriched
      .filter((e) => e.radiusPx > 0)
      .map((e) => ({
        id: e.id,
        name: e.name,
        x: e.x,
        y: e.y,
        px: e.px,
        py: e.py,
        radiusPct: e.radiusPct,
        effectiveRadiusPx: e.radiusPx,
        cutoutOpacity: 1.0,
        glowScale: 1.0,
        color: e.color,
        isHero: e.isHero,
        isIndividual: e.isIndividual,
        visibilityMode: 'master',
      }));

    const tokenVisibility = {};
    enriched.forEach((e) => {
      tokenVisibility[e.id] = { visible: true, opacity: 1, isOwn: false };
    });

    return {
      effectivePlayerView: false,
      isDeepDarkness,
      darkOpacity,
      visibleLights,
      tokenVisibility,
    };
  }

  // 2. VISÃO DO JOGADOR (ou Mestre no modo "Ver como Jogador")
  // Curva de opacidade: 0–59% penumbra gradual; >= 60% escuridão profunda onde não se enxergam fora da luz
  let darkOpacity = 0;
  if (safe.darkness > 0) {
    if (isDeepDarkness) {
      const t = (safe.darkness - DARKNESS_BLIND_THRESHOLD) / (100 - DARKNESS_BLIND_THRESHOLD);
      darkOpacity = 0.968 + t * 0.03; // 0.968 em 60% -> 0.998 em 100%
    } else {
      darkOpacity = (safe.darkness / (DARKNESS_BLIND_THRESHOLD - 1)) * 0.56;
    }
  }

  const viewer = viewerTokenId ? enriched.find((e) => e.id === viewerTokenId) || null : null;
  const visibleLights = [];

  if (viewer) {
    const myRadiusPx = viewer.radiusPx;

    // Própria iluminação do jogador: sempre 100% visível
    if (myRadiusPx > 0) {
      visibleLights.push({
        id: viewer.id,
        name: viewer.name,
        x: viewer.x,
        y: viewer.y,
        px: viewer.px,
        py: viewer.py,
        radiusPct: viewer.radiusPct,
        effectiveRadiusPx: myRadiusPx,
        cutoutOpacity: 1.0,
        glowScale: 1.0,
        color: viewer.color,
        isHero: viewer.isHero,
        isIndividual: viewer.isIndividual,
        visibilityMode: 'self',
      });
    }

    // Iluminação de OUTROS tokens: só visível se estiverem JUNTOS (100%) ou dentro do campo de visão da sua luz (PARCIAL)
    enriched.forEach((other) => {
      if (other.id === viewer.id || other.radiusPx <= 0) return;

      const dist = Math.hypot(other.px - viewer.px, other.py - viewer.py);

      // Distância de "andando juntos" (lado a lado / grupo colado)
      const refLight = myRadiusPx > 0 ? Math.min(myRadiusPx, other.radiusPx) : other.radiusPx;
      const togetherDistPx = Math.max(baseDim * 0.085, refLight * 0.44);

      if (dist <= togetherDistPx) {
        // ANDANDO JUNTOS: compartilham a iluminação completa um do outro!
        visibleLights.push({
          id: other.id,
          name: other.name,
          x: other.x,
          y: other.y,
          px: other.px,
          py: other.py,
          radiusPct: other.radiusPct,
          effectiveRadiusPx: other.radiusPx,
          cutoutOpacity: 0.98,
          glowScale: 0.96,
          color: other.color,
          isHero: other.isHero,
          isIndividual: other.isIndividual,
          visibilityMode: 'together',
        });
        return;
      }

      // CAMPO DE VISÃO DA ILUMINAÇÃO (sem estar andando juntos): visão PARCIAL do que o outro ilumina
      const inMyLightField = myRadiusPx > 0 && dist <= myRadiusPx * 0.98;
      const insideOtherEdge = myRadiusPx <= 0 && dist <= other.radiusPx * 0.88;

      if (inMyLightField || insideOtherEdge) {
        const maxPartialDist = inMyLightField ? myRadiusPx * 0.98 : other.radiusPx * 0.88;
        const span = Math.max(1, maxPartialDist - togetherDistPx);
        const closeness = Math.max(0, Math.min(1, 1 - (dist - togetherDistPx) / span));

        // Raio visível parcial (36% a 72% da luz do outro) e clareza parcial (42% a 76% — nunca 100%)
        const partialRadiusScale = 0.36 + closeness * 0.36;
        const partialCutoutOpacity = 0.42 + closeness * 0.34;

        visibleLights.push({
          id: other.id,
          name: other.name,
          x: other.x,
          y: other.y,
          px: other.px,
          py: other.py,
          radiusPct: other.radiusPct * partialRadiusScale,
          effectiveRadiusPx: other.radiusPx * partialRadiusScale,
          cutoutOpacity: partialCutoutOpacity,
          glowScale: 0.42 + closeness * 0.35,
          color: other.color,
          isHero: other.isHero,
          isIndividual: other.isIndividual,
          visibilityMode: 'partial',
        });
      }
      // Fora disso: NÃO adiciona à lista (o jogador não vê a iluminação do outro token!)
    });
  }

  // Visibilidade de cada token na mesa quando escuridão >= 60%
  const tokenVisibility = {};
  enriched.forEach((e) => {
    const isOwn = Boolean(viewer && e.id === viewer.id);
    if (!isDeepDarkness) {
      tokenVisibility[e.id] = { visible: true, opacity: 1, isOwn };
      return;
    }

    if (isOwn) {
      tokenVisibility[e.id] = { visible: true, opacity: 1, isOwn: true };
      return;
    }

    let bestCoverage = 0;
    for (let i = 0; i < visibleLights.length; i += 1) {
      const L = visibleLights[i];
      const distToL = Math.hypot(e.px - L.px, e.py - L.py);
      const reach = L.effectiveRadiusPx * 1.02;
      if (distToL <= reach) {
        const inner = reach * 0.6;
        const radialFalloff =
          distToL <= inner
            ? 1.0
            : Math.max(0, 1 - (distToL - inner) / Math.max(1, reach - inner));
        const coverage = radialFalloff * L.cutoutOpacity;
        if (coverage > bestCoverage) bestCoverage = coverage;
      }
    }

    if (bestCoverage >= 0.16) {
      tokenVisibility[e.id] = {
        visible: true,
        opacity: Math.max(0.32, Math.min(1, bestCoverage * 1.15)),
        isOwn: false,
      };
    } else {
      tokenVisibility[e.id] = { visible: false, opacity: 0, isOwn: false };
    }
  });

  return {
    effectivePlayerView: true,
    isDeepDarkness,
    darkOpacity,
    visibleLights,
    tokenVisibility,
  };
}

/**
 * Camada de Escuridão + Iluminação Dinâmica Multi-Fonte (z-20, sob tokens visíveis)
 * + Camada de Névoa, Clima & Partículas (z-[25], sobre o cenário e tokens)
 * + Cortina de Ocultação Total Blackout (z-[35]).
 */
export function MapAtmosphereOverlay({
  effects,
  isMaster = false,
  previewAsPlayer = false,
  lightingState = null,
  draggingTokenId = null,
  mapWidth = 1400,
  mapHeight = 900,
  onRevealForMaster,
}) {
  const safe = normalizeMapEffects(effects);
  const canvasRef = useRef(null);
  const [lightningOpacity, setLightningOpacity] = useState(0);
  const maskId = useId().replace(/:/g, '');

  const effectivePlayerView = lightingState
    ? lightingState.effectivePlayerView
    : !isMaster || previewAsPlayer;
  const hasWeather = safe.weather !== 'none';

  // Motor de partículas otimizado (só executa rAF quando há clima ativo e não está em blackout de jogador)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasWeather || (safe.blackout && effectivePlayerView)) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let animId = null;
    let width = 0;
    let height = 0;
    let particles = [];

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rawW = Math.max(320, parent.clientWidth);
      const rawH = Math.max(240, parent.clientHeight);
      // Limita o buffer interno de partículas a 1920px no maior lado (CSS estica 100% mantendo proporção e zero estouro de VRAM em mapas 4K–16K+)
      const MAX_FX_SIDE = 1920;
      const fxScale = Math.min(1, MAX_FX_SIDE / Math.max(rawW, rawH));
      width = Math.max(320, Math.round(rawW * fxScale));
      height = Math.max(240, Math.round(rawH * fxScale));
      const dpr = fxScale < 1 ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();

    const makeParticles = () => {
      const countMap = {
        rain: 140,
        storm: 210,
        snow: 110,
        embers: 75,
        ash: 85,
        sandstorm: 130,
      };
      const count = countMap[safe.weather] || 100;
      const list = [];
      for (let i = 0; i < count; i += 1) {
        list.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx:
            safe.weather === 'storm'
              ? -5.5 - Math.random() * 3.5
              : safe.weather === 'rain'
              ? -2.2 - Math.random() * 1.4
              : safe.weather === 'sandstorm'
              ? 8 + Math.random() * 7
              : (Math.random() - 0.5) * 1.4,
          vy:
            safe.weather === 'storm'
              ? 18 + Math.random() * 10
              : safe.weather === 'rain'
              ? 13 + Math.random() * 7
              : safe.weather === 'embers'
              ? -1.2 - Math.random() * 2.1
              : safe.weather === 'sandstorm'
              ? 1.5 + Math.random() * 2
              : 0.7 + Math.random() * 1.6,
          size:
            safe.weather === 'rain' || safe.weather === 'storm'
              ? 14 + Math.random() * 14
              : safe.weather === 'sandstorm'
              ? 18 + Math.random() * 32
              : 1.5 + Math.random() * 3.2,
          alpha: 0.25 + Math.random() * 0.65,
          phase: Math.random() * Math.PI * 2,
        });
      }
      return list;
    };

    particles = makeParticles();
    let nextLightningAt = performance.now() + 2600 + Math.random() * 4800;

    const tick = (now) => {
      ctx.clearRect(0, 0, width, height);

      if (safe.weather === 'storm' && now >= nextLightningAt) {
        setLightningOpacity(0.55);
        setTimeout(() => setLightningOpacity(0.15), 85);
        setTimeout(() => setLightningOpacity(0.45), 145);
        setTimeout(() => setLightningOpacity(0), 320);
        nextLightningAt = now + 3800 + Math.random() * 6800;
      }

      if (safe.weather === 'rain' || safe.weather === 'storm') {
        ctx.lineCap = 'round';
        ctx.lineWidth = safe.weather === 'storm' ? 1.5 : 1.15;
        for (let i = 0; i < particles.length; i += 1) {
          const p = particles[i];
          ctx.strokeStyle =
            safe.weather === 'storm'
              ? `rgba(186, 230, 253, ${p.alpha * 0.62})`
              : `rgba(186, 230, 253, ${p.alpha * 0.5})`;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * 1.15, p.y + p.size);
          ctx.stroke();

          p.x += p.vx;
          p.y += p.vy;
          if (p.y > height + 30) {
            p.y = -25;
            p.x = Math.random() * (width + 160);
          }
          if (p.x < -40) p.x = width + 40;
        }
      } else if (safe.weather === 'snow') {
        for (let i = 0; i < particles.length; i += 1) {
          const p = particles[i];
          const sway = Math.sin(now * 0.0014 + p.phase) * 0.9;
          ctx.fillStyle = `rgba(241, 245, 249, ${p.alpha * 0.85})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.72, 0, Math.PI * 2);
          ctx.fill();

          p.x += p.vx + sway;
          p.y += p.vy;
          if (p.y > height + 10) {
            p.y = -10;
            p.x = Math.random() * width;
          }
          if (p.x > width + 10) p.x = -10;
          if (p.x < -10) p.x = width + 10;
        }
      } else if (safe.weather === 'embers') {
        for (let i = 0; i < particles.length; i += 1) {
          const p = particles[i];
          const sway = Math.sin(now * 0.0028 + p.phase) * 1.1;
          const glow = 0.6 + 0.4 * Math.sin(now * 0.008 + p.phase);
          ctx.fillStyle =
            i % 3 === 0
              ? `rgba(254, 240, 138, ${p.alpha * glow})`
              : `rgba(249, 115, 22, ${p.alpha * glow})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.75, 0, Math.PI * 2);
          ctx.fill();

          p.x += p.vx + sway;
          p.y += p.vy;
          if (p.y < -12) {
            p.y = height + 12;
            p.x = Math.random() * width;
          }
          if (p.x < -12) p.x = width + 12;
          if (p.x > width + 12) p.x = -12;
        }
      } else if (safe.weather === 'ash') {
        for (let i = 0; i < particles.length; i += 1) {
          const p = particles[i];
          const sway = Math.cos(now * 0.0012 + p.phase) * 0.7;
          ctx.fillStyle = `rgba(148, 163, 184, ${p.alpha * 0.55})`;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.size * 0.9, p.size * 0.45, p.phase, 0, Math.PI * 2);
          ctx.fill();

          p.x += p.vx + sway;
          p.y += p.vy * 0.65;
          if (p.y > height + 12) {
            p.y = -12;
            p.x = Math.random() * width;
          }
          if (p.x < -12) p.x = width + 12;
          if (p.x > width + 12) p.x = -12;
        }
      } else if (safe.weather === 'sandstorm') {
        ctx.lineCap = 'round';
        ctx.lineWidth = 2.2;
        for (let i = 0; i < particles.length; i += 1) {
          const p = particles[i];
          ctx.strokeStyle = `rgba(217, 164, 96, ${p.alpha * 0.36})`;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.size, p.y + p.vy * 2.2);
          ctx.stroke();

          p.x += p.vx;
          p.y += p.vy;
          if (p.x > width + 40) {
            p.x = -40;
            p.y = Math.random() * height;
          }
          if (p.y > height + 20) p.y = -20;
        }
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);

    let ro = null;
    if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
      ro = new ResizeObserver(resize);
      ro.observe(canvas.parentElement);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (ro) ro.disconnect();
      setLightningOpacity(0);
    };
  }, [hasWeather, safe.weather, safe.blackout, effectivePlayerView]);

  const fogOpacity =
    safe.fog <= 0
      ? 0
      : effectivePlayerView
      ? (safe.fog / 100) * 0.9
      : (safe.fog / 100) * 0.4;

  const darkOpacity = lightingState ? lightingState.darkOpacity : 0;
  const activeLights = lightingState?.visibleLights || [];

  const safeW = Math.max(64, Number(mapWidth) || 1400);
  const safeH = Math.max(64, Number(mapHeight) || 900);
  const baseDim = Math.min(safeW, safeH);

  const weatherTint =
    safe.weather === 'storm'
      ? 'rgba(12, 24, 46, 0.24)'
      : safe.weather === 'rain'
      ? 'rgba(14, 30, 54, 0.16)'
      : safe.weather === 'snow'
      ? 'rgba(186, 230, 253, 0.1)'
      : safe.weather === 'embers'
      ? 'rgba(124, 45, 18, 0.18)'
      : safe.weather === 'sandstorm'
      ? 'rgba(146, 98, 42, 0.26)'
      : 'transparent';

  return (
    <>
      {/* CAMADA 1 (z-20): Escuridão + Iluminação Dinâmica Multi-Fonte (sob tokens visíveis, sobre o terreno) */}
      {(darkOpacity > 0 || activeLights.length > 0) && (
        <div className="absolute inset-0 pointer-events-none z-20 rounded-lg overflow-hidden">
          <svg
            viewBox={`0 0 ${safeW} ${safeH}`}
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none"
          >
            <defs>
              {activeLights.map((src, idx) => {
                const colMeta = getTokenLightColorMeta(src.color);
                const cut = Math.max(0.1, Math.min(1, Number(src.cutoutOpacity) || 1));
                const gScale = Math.max(0.2, Math.min(1, Number(src.glowScale) || 1));
                return (
                  <g key={src.id || idx}>
                    <radialGradient id={`${maskId}-cut-${idx}`}>
                      <stop offset="0%" stopColor="#000000" stopOpacity={cut.toFixed(3)} />
                      <stop offset="48%" stopColor="#000000" stopOpacity={(cut * 0.92).toFixed(3)} />
                      <stop offset="76%" stopColor="#000000" stopOpacity={(cut * 0.42).toFixed(3)} />
                      <stop offset="100%" stopColor="#000000" stopOpacity="0" />
                    </radialGradient>
                    <radialGradient id={`${maskId}-glow-${idx}`}>
                      <stop
                        offset="0%"
                        stopColor={colMeta.hex}
                        stopOpacity={((darkOpacity > 0 ? 0.26 : 0.17) * gScale).toFixed(3)}
                      />
                      <stop
                        offset="55%"
                        stopColor={colMeta.hex}
                        stopOpacity={((darkOpacity > 0 ? 0.1 : 0.065) * gScale).toFixed(3)}
                      />
                      <stop offset="100%" stopColor={colMeta.hex} stopOpacity="0" />
                    </radialGradient>
                  </g>
                );
              })}

              <mask id={`${maskId}-dark`}>
                <rect x="0" y="0" width={safeW} height={safeH} fill="#ffffff" />
                {activeLights.map((src, idx) => {
                  const radiusPx = Math.max(1, Number(src.effectiveRadiusPx) || 1) * 1.12;
                  const isLocallyDragged = Boolean(draggingTokenId && src.id === draggingTokenId);
                  return (
                    <circle
                      key={`cut-${src.id || idx}`}
                      cx={src.px}
                      cy={src.py}
                      r={radiusPx}
                      fill={`url(#${maskId}-cut-${idx})`}
                      style={
                        isLocallyDragged
                          ? undefined
                          : { transition: 'cx 0.11s linear, cy 0.11s linear, r 0.14s ease' }
                      }
                    />
                  );
                })}
              </mask>
            </defs>

            {/* Manto de escuridão recortado apenas pela sua luz e pela luz parcial/completa de aliados próximos */}
            {darkOpacity > 0 && (
              <rect
                x="0"
                y="0"
                width={safeW}
                height={safeH}
                fill={`rgba(2, 4, 10, ${darkOpacity.toFixed(3)})`}
                mask={`url(#${maskId}-dark)`}
              />
            )}

            {/* Brilho quente/colorido das luzes visíveis + anéis de alcance para o Mestre */}
            {activeLights.map((src, idx) => {
              const showGlow = darkOpacity > 0 || !effectivePlayerView;
              if (!showGlow) return null;
              const radiusPx = Math.max(1, Number(src.effectiveRadiusPx) || 1);
              const colMeta = getTokenLightColorMeta(src.color);
              const strokeW = Math.max(1.5, baseDim * 0.0022);
              const dashLen = Math.max(6, baseDim * 0.01);
              const isLocallyDragged = Boolean(draggingTokenId && src.id === draggingTokenId);
              const lightGlideStyle = isLocallyDragged
                ? undefined
                : { transition: 'cx 0.11s linear, cy 0.11s linear, r 0.14s ease' };

              return (
                <g key={`vis-${src.id || idx}`}>
                  <circle
                    cx={src.px}
                    cy={src.py}
                    r={radiusPx * 1.05}
                    fill={`url(#${maskId}-glow-${idx})`}
                    style={lightGlideStyle}
                  />
                  {!effectivePlayerView && (
                    <circle
                      cx={src.px}
                      cy={src.py}
                      r={radiusPx}
                      fill="none"
                      stroke={colMeta.ring}
                      strokeWidth={strokeW}
                      strokeDasharray={src.isIndividual ? undefined : `${dashLen} ${dashLen * 0.7}`}
                      strokeOpacity={darkOpacity > 0 ? 0.72 : 0.5}
                      style={lightGlideStyle}
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {/* CAMADA 2 (z-[25]): Névoa Volumétrica, Clima, Relâmpagos e Partículas (sobre mapa e tokens) */}
      {(weatherTint !== 'transparent' || fogOpacity > 0 || lightningOpacity > 0 || hasWeather) && (
        <div className="absolute inset-0 pointer-events-none z-[25] rounded-lg overflow-hidden">
          {weatherTint !== 'transparent' && (
            <div className="absolute inset-0 transition-colors duration-500" style={{ backgroundColor: weatherTint }} />
          )}

          {fogOpacity > 0 && (
            <>
              <div
                className="absolute -inset-[25%] map-fog-drift-slow transition-opacity duration-500"
                style={{
                  opacity: fogOpacity,
                  backgroundImage:
                    'radial-gradient(ellipse 46% 38% at 22% 30%, rgba(203, 213, 225, 0.78), transparent 72%), radial-gradient(ellipse 52% 44% at 75% 68%, rgba(148, 163, 184, 0.74), transparent 74%), radial-gradient(ellipse 42% 42% at 50% 48%, rgba(226, 232, 240, 0.62), transparent 76%)',
                }}
              />
              <div
                className="absolute -inset-[25%] map-fog-drift-fast transition-opacity duration-500"
                style={{
                  opacity: fogOpacity * 0.85,
                  backgroundImage:
                    'radial-gradient(ellipse 48% 36% at 72% 24%, rgba(203, 213, 225, 0.72), transparent 70%), radial-gradient(ellipse 54% 40% at 28% 76%, rgba(148, 163, 184, 0.68), transparent 72%)',
                  backgroundColor: `rgba(148, 163, 184, ${(fogOpacity * 0.42).toFixed(3)})`,
                }}
              />
            </>
          )}

          {lightningOpacity > 0 && (
            <div
              className="absolute inset-0 bg-sky-100 transition-opacity duration-75"
              style={{ opacity: lightningOpacity }}
            />
          )}

          {hasWeather && (
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full block pointer-events-none"
            />
          )}
        </div>
      )}

      {/* CAMADA 3 (z-[35]): Cortina de Ocultação Total do Mapa (Blackout) */}
      {safe.blackout && (
        effectivePlayerView ? (
          <div className="absolute inset-0 z-[35] rounded-lg bg-[#04060c]/99 backdrop-blur-2xl border border-white/10 flex flex-col items-center justify-center p-6 text-center select-none">
            <div className="h-14 w-14 rounded-2xl bg-white/5 border border-white/15 flex items-center justify-center mb-3 text-slate-300 shadow-2xl">
              <EyeOff className="h-7 w-7 text-slate-300" />
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
              Cenário Oculto nas Sombras
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-sm mt-1 leading-relaxed">
              O Mestre ocultou temporariamente a visão deste mapa. Aguarde a revelação da cena.
            </p>
          </div>
        ) : (
          <div className="absolute inset-0 z-[35] pointer-events-none rounded-lg border-2 border-dashed border-amber-400/55 bg-black/35">
            <div className="pointer-events-auto absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0c101b]/95 border border-amber-400/50 text-xs font-bold text-amber-200 shadow-2xl backdrop-blur-xl">
              <EyeOff className="h-3.5 w-3.5 text-amber-300 shrink-0" />
              <span>Mapa oculto para os jogadores</span>
              {onRevealForMaster && (
                <button
                  type="button"
                  onClick={onRevealForMaster}
                  className={cn(
                    'ml-1 px-2 py-0.5 rounded-full bg-amber-500/25 hover:bg-amber-500/40 border border-amber-400/50 text-[10px] font-bold text-amber-100 transition-colors'
                  )}
                >
                  Revelar
                </button>
              )}
            </div>
          </div>
        )
      )}
    </>
  );
}
