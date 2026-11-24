'use client';

/**
 * Motor Procedural de Trilhas Sonoras RPG (Web Audio API) + Utilitários de Playlist
 *
 * Fornece:
 * 1. 5 trilhas musicais atmosféricas nativas de D&D (Taverna, Masmorra, Combate, Floresta, Chefe)
 *    que funcionam 100% offline/online sem links quebrados, suportando seek exato (segundos),
 *    sincronização determinística por compasso/tempo e controle de volume suave.
 * 2. Parser de links do YouTube (watch, youtu.be, shorts, embed, music.youtube) e formatador de tempo.
 */

export const MUSIC_CATEGORIES = [
  { id: 'tavern', label: 'Taverna', color: '#f59e0b' },
  { id: 'exploration', label: 'Exploração', color: '#10b981' },
  { id: 'dungeon', label: 'Masmorra', color: '#64748b' },
  { id: 'combat', label: 'Combate', color: '#ef4444' },
  { id: 'boss', label: 'Chefe Final', color: '#dc2626' },
  { id: 'mystery', label: 'Mistério', color: '#38bdf8' },
  { id: 'epic', label: 'Épico', color: '#a855f7' },
];

export const DEFAULT_RPG_PLAYLIST = [
  {
    id: 'builtin-tavern',
    title: 'Taverna do Javali Saltitante',
    artist: 'Trilha Vallen • Ambiente',
    category: 'tavern',
    sourceType: 'synth',
    synthId: 'tavern',
    duration: 180,
    url: '',
    youtubeId: '',
  },
  {
    id: 'builtin-exploration',
    title: 'Clareira da Floresta Ancestral',
    artist: 'Trilha Vallen • Ambiente',
    category: 'exploration',
    sourceType: 'synth',
    synthId: 'exploration',
    duration: 200,
    url: '',
    youtubeId: '',
  },
  {
    id: 'builtin-dungeon',
    title: 'Catacumbas dos Reis Esquecidos',
    artist: 'Trilha Vallen • Ambiente',
    category: 'dungeon',
    sourceType: 'synth',
    synthId: 'dungeon',
    duration: 210,
    url: '',
    youtubeId: '',
  },
  {
    id: 'builtin-combat',
    title: 'Tambores de Guerra na Arena',
    artist: 'Trilha Vallen • Ação',
    category: 'combat',
    sourceType: 'synth',
    synthId: 'combat',
    duration: 160,
    url: '',
    youtubeId: '',
  },
  {
    id: 'builtin-boss',
    title: 'Trono de Obsidiana (Chefe)',
    artist: 'Trilha Vallen • Épico',
    category: 'boss',
    sourceType: 'synth',
    synthId: 'boss',
    duration: 180,
    url: '',
    youtubeId: '',
  },
];

export function formatAudioTime(seconds) {
  const safe = Number.isFinite(Number(seconds)) && Number(seconds) > 0 ? Math.floor(Number(seconds)) : 0;
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function extractYouTubeVideoId(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com' ||
      host === 'youtube-nocookie.com'
    ) {
      const vParam = url.searchParams.get('v');
      if (vParam && /^[A-Za-z0-9_-]{11}$/.test(vParam)) return vParam;

      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && ['embed', 'shorts', 'live', 'v'].includes(parts[0])) {
        const candidate = parts[1];
        if (/^[A-Za-z0-9_-]{11}$/.test(candidate)) return candidate;
      }
    }
  } catch {
    const match = trimmed.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
    if (match) return match[1];
  }

  return null;
}

/**
 * Busca título automático de um vídeo do YouTube via oEmbed (best-effort)
 */
export async function fetchYouTubeTitle(videoId) {
  if (!videoId) return null;
  try {
    const res = await fetch(
      `https://noembed.com/embed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data?.title === 'string' && data.title.trim()) {
      return {
        title: data.title.trim().slice(0, 100),
        artist: typeof data.author_name === 'string' ? data.author_name.trim().slice(0, 60) : 'YouTube',
      };
    }
  } catch {}
  return null;
}

// ============================================================================
// MOTOR DE SÍNTESE MUSICAL PROCEDURAL (TIME-ADDRESSED / SEEKABLE)
// ============================================================================

const SYNTH_PRESETS = {
  tavern: {
    stepSec: 0.375, // 160 eighth-notes/min -> calorosa balada medieval 6/8
    bassFreqs: [146.83, 146.83, 130.81, 130.81, 110.0, 110.0, 130.81, 146.83], // D3, C3, A2, C3, D3
    melodyNotes: [
      293.66, 349.23, 440.0, 523.25, 440.0, 349.23,
      261.63, 329.63, 392.0, 440.0, 392.0, 329.63,
      220.0, 293.66, 349.23, 440.0, 392.0, 329.63,
      261.63, 329.63, 392.0, 523.25, 440.0, 349.23,
    ],
    padType: 'triangle',
    leadType: 'triangle',
    filterHz: 1150,
    drumPattern: [1, 0, 0, 0.45, 0, 0],
    ambientNoiseGain: 0.015,
    ambientNoiseFreq: 420,
  },
  exploration: {
    stepSec: 0.5, // 120 BPM suave e etéreo
    bassFreqs: [130.81, 130.81, 146.83, 164.81, 110.0, 110.0, 123.47, 130.81],
    melodyNotes: [
      392.0, 0, 440.0, 523.25, 0, 659.25, 587.33, 523.25,
      440.0, 0, 392.0, 329.63, 0, 392.0, 440.0, 0,
    ],
    padType: 'sine',
    leadType: 'sine',
    filterHz: 1450,
    drumPattern: [0, 0, 0, 0],
    ambientNoiseGain: 0.022,
    ambientNoiseFreq: 680,
  },
  dungeon: {
    stepSec: 0.65, // Lento, sombrio e reverberante (D Phrygian)
    bassFreqs: [73.42, 73.42, 77.78, 73.42, 65.41, 65.41, 77.78, 73.42], // D2, Eb2, C2
    melodyNotes: [
      293.66, 0, 0, 311.13, 0, 293.66, 0, 220.0,
      0, 0, 261.63, 0, 311.13, 0, 0, 293.66,
    ],
    padType: 'sawtooth',
    leadType: 'sine',
    filterHz: 520,
    drumPattern: [0.65, 0, 0, 0, 0, 0, 0.35, 0],
    ambientNoiseGain: 0.025,
    ambientNoiseFreq: 240,
  },
  combat: {
    stepSec: 0.22, // Pulso enérgico de tambores de batalha
    bassFreqs: [110.0, 110.0, 116.54, 130.81, 146.83, 130.81, 116.54, 110.0], // A2, Bb2, C3, D3
    melodyNotes: [
      220.0, 261.63, 293.66, 220.0, 329.63, 293.66, 261.63, 220.0,
      233.08, 293.66, 349.23, 293.66, 329.63, 261.63, 246.94, 220.0,
    ],
    padType: 'sawtooth',
    leadType: 'sawtooth',
    filterHz: 950,
    drumPattern: [1, 0, 0.55, 0.35, 0.9, 0.3, 0.65, 0.45],
    ambientNoiseGain: 0.01,
    ambientNoiseFreq: 300,
  },
  boss: {
    stepSec: 0.25, // Tema épico e imponente de chefe final
    bassFreqs: [73.42, 73.42, 87.31, 82.41, 73.42, 98.0, 87.31, 77.78], // D2, F2, E2, G2, F2, Eb2
    melodyNotes: [
      293.66, 0, 349.23, 329.63, 293.66, 440.0, 415.3, 349.23,
      293.66, 0, 466.16, 440.0, 392.0, 349.23, 311.13, 293.66,
    ],
    padType: 'sawtooth',
    leadType: 'triangle',
    filterHz: 860,
    drumPattern: [1, 0.4, 0, 0.75, 1, 0.35, 0.6, 0.85],
    ambientNoiseGain: 0.018,
    ambientNoiseFreq: 210,
  },
};

export class RpgSynthEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.noiseNode = null;
    this.noiseGain = null;
    this.noiseFilter = null;
    this.timerId = null;
    this.presetId = 'tavern';
    this.isPlaying = false;
    this.volume = 0.6;
    this.muted = false;
    this.positionSec = 0;
    this.lastTickMs = 0;
    this.lastStepPlayed = -1;
    this.duration = 180;
    this.onEnded = null;
  }

  ensureContext() {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume * 0.42, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  async unlock() {
    const ctx = this.ensureContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return false;
      }
    }
    return ctx.state === 'running';
  }

  setVolume(vol, muted = false) {
    this.volume = Math.max(0, Math.min(1, Number(vol) || 0));
    this.muted = Boolean(muted);
    if (this.ctx && this.masterGain) {
      const target = this.muted ? 0 : this.volume * 0.42;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.04);
    }
  }

  startAmbientNoise(preset) {
    this.stopAmbientNoise();
    if (!this.ctx || !this.masterGain || !preset.ambientNoiseGain) return;

    try {
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i += 1) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = output[i];
        output[i] *= 2.8;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(preset.ambientNoiseFreq || 400, this.ctx.currentTime);
      filter.Q.setValueAtTime(1.1, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(preset.ambientNoiseGain, this.ctx.currentTime);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start();

      this.noiseNode = noise;
      this.noiseFilter = filter;
      this.noiseGain = gain;
    } catch {}
  }

  stopAmbientNoise() {
    if (this.noiseNode) {
      try {
        this.noiseNode.stop();
        this.noiseNode.disconnect();
      } catch {}
      this.noiseNode = null;
    }
    if (this.noiseFilter) {
      try {
        this.noiseFilter.disconnect();
      } catch {}
      this.noiseFilter = null;
    }
    if (this.noiseGain) {
      try {
        this.noiseGain.disconnect();
      } catch {}
      this.noiseGain = null;
    }
  }

  playStep(stepIndex, preset) {
    if (!this.ctx || !this.masterGain || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const stepDur = preset.stepSec;

    // 1. Nota de melodia / harpa / alaúde determinística para este compasso
    const melFreq = preset.melodyNotes[stepIndex % preset.melodyNotes.length];
    if (melFreq > 0) {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = preset.leadType || 'triangle';
      osc.frequency.setValueAtTime(melFreq, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(preset.filterHz || 1000, now);
      filter.frequency.exponentialRampToValueAtTime(Math.max(220, (preset.filterHz || 1000) * 0.45), now + stepDur * 1.4);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.24, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + stepDur * 1.65);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + stepDur * 1.75);
    }

    // 2. Acorde / Drone grave a cada 4 tempos
    if (stepIndex % 4 === 0) {
      const chordIndex = Math.floor(stepIndex / 4) % preset.bassFreqs.length;
      const rootFreq = preset.bassFreqs[chordIndex];
      const padDur = stepDur * 4.4;

      [rootFreq, rootFreq * 1.5].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = idx === 0 ? preset.padType || 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(Math.min(720, preset.filterHz || 600), now);

        const amp = idx === 0 ? 0.22 : 0.12;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(amp, now + stepDur * 0.55);
        gain.gain.exponentialRampToValueAtTime(0.001, now + padDur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + padDur + 0.05);
      });
    }

    // 3. Percussão / Tambores táticos
    const drumArr = preset.drumPattern || [];
    if (drumArr.length > 0) {
      const drumHit = drumArr[stepIndex % drumArr.length];
      if (drumHit > 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        const baseDrum = drumHit > 0.8 ? 92 : 124;
        osc.frequency.setValueAtTime(baseDrum, now);
        osc.frequency.exponentialRampToValueAtTime(34, now + 0.16);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.38 * drumHit, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.24);
      }
    }
  }

  async play(synthId = 'tavern', startSec = 0, duration = 180) {
    this.presetId = SYNTH_PRESETS[synthId] ? synthId : 'tavern';
    this.duration = Math.max(30, Number(duration) || 180);
    this.positionSec = Math.max(0, Number(startSec) || 0) % this.duration;

    const ctx = this.ensureContext();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return false;
      }
    }
    if (ctx.state !== 'running') return false;

    const preset = SYNTH_PRESETS[this.presetId];
    this.isPlaying = true;
    this.lastTickMs = performance.now();
    this.lastStepPlayed = Math.floor(this.positionSec / preset.stepSec) - 1;
    this.startAmbientNoise(preset);

    if (this.timerId) clearInterval(this.timerId);
    this.timerId = setInterval(() => {
      if (!this.isPlaying) return;
      const nowMs = performance.now();
      const dt = (nowMs - this.lastTickMs) / 1000;
      this.lastTickMs = nowMs;
      this.positionSec += dt;

      if (this.positionSec >= this.duration) {
        this.positionSec = 0;
        this.lastStepPlayed = -1;
        if (typeof this.onEnded === 'function') {
          this.onEnded();
        }
      }

      const activePreset = SYNTH_PRESETS[this.presetId] || SYNTH_PRESETS.tavern;
      const currentStep = Math.floor(this.positionSec / activePreset.stepSec);
      if (currentStep !== this.lastStepPlayed) {
        this.lastStepPlayed = currentStep;
        this.playStep(currentStep, activePreset);
      }
    }, 60);

    return true;
  }

  seek(sec) {
    const preset = SYNTH_PRESETS[this.presetId] || SYNTH_PRESETS.tavern;
    this.positionSec = Math.max(0, Math.min(this.duration, Number(sec) || 0));
    this.lastTickMs = performance.now();
    this.lastStepPlayed = Math.floor(this.positionSec / preset.stepSec) - 1;
  }

  getCurrentTime() {
    if (!this.isPlaying) return this.positionSec;
    const nowMs = performance.now();
    const elapsed = (nowMs - this.lastTickMs) / 1000;
    return Math.min(this.duration, this.positionSec + Math.max(0, elapsed));
  }

  pause() {
    this.positionSec = this.getCurrentTime();
    this.isPlaying = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.stopAmbientNoise();
  }

  dispose() {
    this.pause();
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch {}
      this.ctx = null;
      this.masterGain = null;
    }
  }
}
