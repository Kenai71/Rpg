'use client';

/**
 * Sintetizador Procedural de Efeitos Sonoros para Dados 3D (Web Audio API)
 *
 * Totalmente autônomo: sem arquivos de áudio externos, sem requisições HTTP adicionais,
 * 100% de compatibilidade entre navegadores, livre de erros 404 e latência zero.
 *
 * Suporta:
 * 1. playDiceBounceSound: estalos/impactos percussivos táteis ao quicar e rolar na mesa
 * 2. playCriticalSuccessSound: arpejo triunfante e cristalino ao tirar valor máximo (20 no d20, 12 no d12, etc.)
 * 3. playCriticalFumbleSound: acorde dramático e descendente ao tirar 1 no d20 (falha crítica)
 * 4. playDiceSettleSound: repouso final sólido na mesa
 */

let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtxClass) return null;

  if (!audioCtx) {
    audioCtx = new AudioCtxClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Som percussivo de quique do dado na mesa
 */
export function playDiceBounceSound(intensity = 1) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    // Filtro passa-banda para som amadeirado/acrílico
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600 + Math.random() * 400, t);
    filter.Q.setValueAtTime(3.5, t);

    // Frequência rápida descendente
    const baseFreq = 160 + Math.random() * 120;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.06);

    const safeIntensity = Math.max(0.15, Math.min(1.0, intensity));
    gain.gain.setValueAtTime(0.35 * safeIntensity, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.08);
  } catch {}
}

/**
 * Som agradável de Sucesso Máximo / Crítico
 * Frequências: C5, E5, G5, B5, C6 (Arpejo pentatônico maior brilhante)
 */
export function playCriticalSuccessSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 987.77, 1046.5]; // C5, E5, G5, B5, C6

    notes.forEach((freq, idx) => {
      const noteTime = t + idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0, noteTime);
      gain.gain.linearRampToValueAtTime(0.25, noteTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.65);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteTime);
      osc.stop(noteTime + 0.7);
    });

    // Brilho harmônico sutil (campainha celestial)
    const shimmer = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    shimmer.type = 'triangle';
    shimmer.frequency.setValueAtTime(2093.0, t + 0.35); // C7
    shimmerGain.gain.setValueAtTime(0.12, t + 0.35);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, t + 1.1);

    shimmer.connect(shimmerGain);
    shimmerGain.connect(ctx.destination);

    shimmer.start(t + 0.35);
    shimmer.stop(t + 1.15);
  } catch {}
}

/**
 * Som dramático de Falha Crítica (1 no d20)
 * Acorde descendente dissonante com trítone e decaimento sombrio
 */
export function playCriticalFumbleSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    // Intervalo de trítono tenso e decrescente: Eb3 -> C3 -> Gb2
    const notes = [
      { freq: 155.56, time: t + 0.00, dur: 0.4 }, // Eb3
      { freq: 130.81, time: t + 0.12, dur: 0.5 }, // C3
      { freq: 92.50,  time: t + 0.25, dur: 0.9 }, // Gb2 (trítono dramático)
    ];

    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, time);
      filter.frequency.exponentialRampToValueAtTime(120, time + dur);

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.85, time + dur);

      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.28, time + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(time);
      osc.stop(time + dur + 0.05);
    });
  } catch {}
}

/**
 * Som de repouso final do dado
 */
export function playDiceSettleSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, t);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.09);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.11);
  } catch {}
}
