'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Coins,
  Dices,
  Flame,
  Gem,
  Hexagon,
  RotateCcw,
  Shield,
  Sword,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { RARITIES } from '../../lib/constants';
import { Button } from '../ui/Button';

// Web Audio API Sound Synthesizer (Zero dependências externas de áudio)
function playTickSound(audioCtx, pitchMultiplier = 1) {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600 * pitchMultiplier, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(140, audioCtx.currentTime + 0.035);
    gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.035);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.04);
  } catch {
    // áudio bloqueado ou não inicializado
  }
}

function playWinSound(audioCtx, rarityIndex) {
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    const baseFreq = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99][rarityIndex] || 440;
    const chords = [baseFreq, baseFreq * 1.25, baseFreq * 1.5, baseFreq * 2];

    chords.forEach((freq, idx) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = rarityIndex >= 3 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.22, now + idx * 0.08 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.8);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.85);
    });
  } catch {
    // silencioso
  }
}

// Configuração das fatias da roleta (6 Raridades)
const WHEEL_SLICES = [
  { name: 'COMUM', label: 'Comum', color: '#94a3b8', bg: '#1e293b', border: '#475569', icon: Shield, chance: '50%' },
  { name: 'INCOMUM', label: 'Incomum', color: '#4ade80', bg: '#064e3b', border: '#10b981', icon: Zap, chance: '30%' },
  { name: 'RARO', label: 'Raro', color: '#60a5fa', bg: '#1e3a8a', border: '#3b82f6', icon: Sword, chance: '15%' },
  { name: 'ÉPICO', label: 'Épico', color: '#a78bfa', bg: '#4c1d95', border: '#8b5cf6', icon: Flame, chance: '4%' },
  { name: 'LENDÁRIO', label: 'Lendário', color: '#fbbf24', bg: '#78350f', border: '#f59e0b', icon: Gem, chance: '0.9%' },
  { name: 'MÍTICO', label: 'Mítico', color: '#f87171', bg: '#881337', border: '#f43f5e', icon: Hexagon, chance: '0.1%' },
];

export function RouletteModal({
  open,
  onClose,
  giftsCount = 0,
  onSpinWithGift,
  onRequestGift,
  requestingGift = false,
}) {
  const canvasRef = useRef(null);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const audioCtxRef = useRef(null);
  const currentAngleRef = useRef(0);
  const animationFrameRef = useRef(null);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current && typeof window !== 'undefined') {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtxRef.current = new AudioContext();
      }
    }
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // Desenha a roleta no Canvas
  const drawWheel = useCallback((angle) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const radius = center - 16;
    const numSlices = WHEEL_SLICES.length;
    const arc = (Math.PI * 2) / numSlices;

    ctx.clearRect(0, 0, size, size);

    // 1. Halo cósmico externo
    const glow = ctx.createRadialGradient(center, center, radius * 0.6, center, center, radius * 1.08);
    glow.addColorStop(0, 'rgba(139, 92, 246, 0.12)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(angle);

    // 2. Fatias da Roleta
    WHEEL_SLICES.forEach((slice, i) => {
      const startAngle = i * arc;
      const endAngle = startAngle + arc;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.closePath();

      // Gradiente suave da fatia
      const grad = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius);
      grad.addColorStop(0, slice.bg);
      grad.addColorStop(1, '#090d16');
      ctx.fillStyle = grad;
      ctx.fill();

      // Borda da fatia
      ctx.strokeStyle = slice.border;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Texto e detalhes da fatia
      ctx.save();
      ctx.rotate(startAngle + arc / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = slice.color;
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.shadowColor = slice.color;
      ctx.shadowBlur = 8;
      ctx.fillText(slice.label, radius - 24, 0);

      ctx.restore();
    });

    // 3. Pinos mecânicos na borda
    const numPins = numSlices * 3;
    const pinArc = (Math.PI * 2) / numPins;
    for (let p = 0; p < numPins; p++) {
      const pinAngle = p * pinArc;
      const px = Math.cos(pinAngle) * (radius - 4);
      const py = Math.sin(pinAngle) * (radius - 4);

      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
      ctx.shadowBlur = 4;
      ctx.fill();
    }

    // 4. Borda externa metálica
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // 5. Hub central
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();

    // 6. Ponteiro indicador superior (fixo às 12 horas)
    ctx.save();
    ctx.translate(center, 12);
    ctx.beginPath();
    ctx.moveTo(0, 20);
    ctx.lineTo(-10, 0);
    ctx.lineTo(10, 0);
    ctx.closePath();
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 5, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#78350f';
    ctx.fill();
    ctx.restore();
  }, []);

  useEffect(() => {
    if (open) {
      drawWheel(currentAngleRef.current);
    }
  }, [open, drawWheel]);

  // Executa o giro da roleta
  const handleSpin = async (isDemo = false) => {
    if (spinning) return;
    if (!isDemo && giftsCount <= 0) {
      toast.error('Você não tem nenhum Gacha Gift na mochila!');
      return;
    }

    setResult(null);
    setSpinning(true);
    const audioCtx = audioEnabled ? getAudioContext() : null;

    let targetRarity;
    try {
      if (!isDemo && onSpinWithGift) {
        targetRarity = await onSpinWithGift();
      } else {
        // Giro de demonstração: sorteio aleatório ponderado
        const rand = Math.random() * 100;
        let cumulative = 0;
        for (const r of RARITIES) {
          cumulative += r.chance;
          if (rand <= cumulative) {
            targetRarity = r;
            break;
          }
        }
      }
    } catch (err) {
      setSpinning(false);
      toast.error(err?.message || 'Falha ao sortear na roleta.');
      return;
    }

    const targetName = targetRarity?.name || 'COMUM';
    const targetSliceIndex = WHEEL_SLICES.findIndex((s) => s.name === targetName);
    const sliceIndex = targetSliceIndex >= 0 ? targetSliceIndex : 0;

    // Calcula o ângulo exato para a fatia parar no ponteiro do topo (3*PI/2)
    const arc = (Math.PI * 2) / WHEEL_SLICES.length;
    const targetSliceAngle = sliceIndex * arc + arc / 2;
    // O ponteiro fica no topo (3 * PI / 2 rad)
    const pointerAngle = (3 * Math.PI) / 2;
    const fullSpins = 6 * (Math.PI * 2); // 6 voltas completas
    const finalAngle = currentAngleRef.current + fullSpins + (pointerAngle - ((currentAngleRef.current + fullSpins + targetSliceAngle) % (Math.PI * 2)));

    const startTime = performance.now();
    const duration = 4800; // 4.8 segundos de giro com desaceleração emocionante
    const startAngle = currentAngleRef.current;
    let lastPinTick = -1;

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Curva de desaceleração suave e cinematográfica (Cubic-ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3.8);
      const currentAngle = startAngle + (finalAngle - startAngle) * easeOut;
      currentAngleRef.current = currentAngle;
      drawWheel(currentAngle);

      // Detecção de cliques mecânicos ao passar pelos pinos
      const numPins = WHEEL_SLICES.length * 3;
      const currentPin = Math.floor((currentAngle / ((Math.PI * 2) / numPins)) % numPins);
      if (currentPin !== lastPinTick) {
        lastPinTick = currentPin;
        if (audioEnabled) {
          playTickSound(audioCtx, 1 + progress * 0.4);
        }
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(12);
        }
      }

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setSpinning(false);
        setResult(targetRarity);
        if (audioEnabled) {
          playWinSound(audioCtx, sliceIndex);
        }
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([40, 80, 120]);
        }
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Roleta Arcana de Fortunas"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-white/15 bg-[var(--surface-1)] p-6 shadow-2xl shadow-black/80 space-y-5 overflow-hidden">
        {/* Brilho decorativo superior */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-60" />

        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-white/10 text-slate-300 flex items-center justify-center">
              <Dices className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Roleta de Runas Arcanas</h2>
              <p className="text-[11px] text-slate-400">Gire para sortear runas de poder para seus equipamentos</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setAudioEnabled(!audioEnabled)}
              className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              aria-label={audioEnabled ? 'Desativar som' : 'Ativar som'}
              title={audioEnabled ? 'Som ativado' : 'Som desativado'}
            >
              {audioEnabled ? <Volume2 className="h-4 w-4 text-emerald-400" /> : <VolumeX className="h-4 w-4 text-slate-500" />}
            </button>
            <button
              type="button"
              disabled={spinning}
              onClick={onClose}
              className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Roleta Central */}
        <div className="relative flex items-center justify-center py-2">
          <canvas
            ref={canvasRef}
            width={320}
            height={320}
            className="w-[280px] h-[280px] sm:w-[320px] sm:h-[320px] select-none"
          />
        </div>

        {/* Card de Resultado da Roleta */}
        {result && (
          <div className="p-4 rounded-xl border border-white/20 bg-white/5 backdrop-blur-md text-center space-y-2 animate-in zoom-in-95 duration-200">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: `${result.color}22`, color: result.color, border: `1px solid ${result.color}66` }}>
              <Hexagon className="h-3.5 w-3.5" />
              Runa {result.name}
            </div>
            <p className="text-sm font-semibold text-white">Parabéns, aventureiro!</p>
            <p className="text-xs text-slate-400">
              A runa foi enviada à sua mochila. Utilize-a na Loja para forjar ou aprimorar itens desta raridade!
            </p>
          </div>
        )}

        {/* Painel de Ações */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>Seus Gacha Gifts:</span>
            <span className="font-mono font-bold text-white flex items-center gap-1">
              <Dices className="h-3.5 w-3.5 text-amber-400" />
              {giftsCount} disponível(is)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              variant="primary"
              disabled={spinning || giftsCount <= 0}
              onClick={() => handleSpin(false)}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold border-amber-300 shadow-lg shadow-amber-500/20"
            >
              <Dices className="h-4 w-4" />
              <span>{spinning ? 'Girando...' : 'Girar com Gift'}</span>
            </Button>

            {giftsCount <= 0 ? (
              <Button
                variant="outline"
                disabled={spinning || requestingGift}
                loading={requestingGift}
                onClick={onRequestGift}
                className="w-full"
              >
                <span>Pedir Gift ao Mestre</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                disabled={spinning}
                onClick={() => handleSpin(true)}
                className="w-full"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Giro de Treino</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
