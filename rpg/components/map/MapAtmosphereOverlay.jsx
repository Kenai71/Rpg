'use client';

import { useEffect, useRef, useState } from 'react';
import { EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils';

export const DEFAULT_MAP_EFFECTS = {
  weather: 'none', // 'none' | 'rain' | 'storm' | 'snow' | 'embers' | 'ash' | 'sandstorm'
  fog: 0, // 0..100
  darkness: 0, // 0..100
  torchRadius: 0, // 0 (off) ou 12..60 (% da menor dimensão como halo de visão ao redor do herói)
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
    effects: { weather: 'ash', fog: 25, darkness: 90, torchRadius: 24, blackout: false },
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
 * Camada de Efeitos Atmosféricos e Visibilidade sobre o Mapa Tático (60fps GPU-otimizado).
 *
 * - Partículas climáticas (chuva, tempestade com relâmpagos, neve, brasas, cinzas, areia)
 *   em um único <canvas> que só anima quando há clima ativo.
 * - Névoa volumétrica em camadas suaves reduzindo visibilidade.
 * - Escuridão / Baixa visibilidade com suporte a halo de Tocha centralizado no token do herói.
 * - Cortina de Ocultação Total (Blackout) para esconder o cenário dos jogadores enquanto o Mestre prepara.
 */
export function MapAtmosphereOverlay({
  effects,
  isMaster = false,
  previewAsPlayer = false,
  heroFocusPct = null, // { x: 0..100, y: 0..100 }
  onRevealForMaster,
}) {
  const safe = normalizeMapEffects(effects);
  const canvasRef = useRef(null);
  const [lightningOpacity, setLightningOpacity] = useState(0);

  const effectivePlayerView = !isMaster || previewAsPlayer;
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
      width = Math.max(320, parent.clientWidth);
      height = Math.max(240, parent.clientHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
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

  // Cálculos de opacidade para Visão do Jogador vs Visão do Mestre (Mestre sempre enxerga para mestrar, a menos que ative pré-visualização)
  const fogOpacity =
    safe.fog <= 0
      ? 0
      : effectivePlayerView
      ? (safe.fog / 100) * 0.92
      : (safe.fog / 100) * 0.42;

  const darkOpacity =
    safe.darkness <= 0
      ? 0
      : effectivePlayerView
      ? (safe.darkness / 100) * 0.97
      : (safe.darkness / 100) * 0.46;

  const focusX = Number.isFinite(Number(heroFocusPct?.x)) ? Number(heroFocusPct.x) : 50;
  const focusY = Number.isFinite(Number(heroFocusPct?.y)) ? Number(heroFocusPct.y) : 50;

  const hasTorchCutout = safe.torchRadius > 0 && darkOpacity > 0;
  const torchInner = Math.max(4, safe.torchRadius * 0.52);
  const torchOuter = Math.max(12, safe.torchRadius * 1.45);

  const darknessBackground = hasTorchCutout
    ? `radial-gradient(circle at ${focusX}% ${focusY}%, rgba(3, 6, 14, 0.04) 0%, rgba(3, 6, 14, ${(darkOpacity * 0.35).toFixed(3)}) ${torchInner}%, rgba(3, 6, 14, ${darkOpacity.toFixed(3)}) ${torchOuter}%)`
    : `rgba(3, 6, 14, ${darkOpacity.toFixed(3)})`;

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
      {/* Camadas atmosféricas acopladas diretamente sobre o mapa (escala/pan sincronizados) */}
      <div className="absolute inset-0 pointer-events-none z-20 rounded-lg overflow-hidden">
        {/* Tinta atmosférica sutil do clima */}
        {weatherTint !== 'transparent' && (
          <div className="absolute inset-0 transition-colors duration-500" style={{ backgroundColor: weatherTint }} />
        )}

        {/* Névoa volumétrica em movimento (reduz visibilidade gradualmente) */}
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

        {/* Escuridão / Penumbra com recorte opcional de Tocha no token do herói */}
        {darkOpacity > 0 && (
          <div
            className="absolute inset-0 transition-all duration-300"
            style={{ background: darknessBackground }}
          />
        )}

        {/* Relâmpago da Tempestade */}
        {lightningOpacity > 0 && (
          <div
            className="absolute inset-0 bg-sky-100 transition-opacity duration-75"
            style={{ opacity: lightningOpacity }}
          />
        )}

        {/* Canvas leve de partículas climáticas */}
        {hasWeather && (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full block pointer-events-none"
          />
        )}
      </div>

      {/* Cortina de Ocultação Total do Mapa (Blackout) */}
      {safe.blackout && (
        effectivePlayerView ? (
          <div className="absolute inset-0 z-30 rounded-lg bg-[#05070d]/98 backdrop-blur-2xl border border-white/10 flex flex-col items-center justify-center p-6 text-center select-none">
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
          <div className="absolute inset-0 z-30 pointer-events-none rounded-lg border-2 border-dashed border-amber-400/55 bg-black/35">
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
