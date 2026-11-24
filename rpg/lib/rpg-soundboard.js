'use client';

/**
 * Soundboard Híbrido Cinematográfico de Efeitos Sonoros de RPG (Samples de Estúdio + Web Audio API)
 *
 * Arquitetura de máxima fidelidade em tempo real:
 * - 9 efeitos de estúdio reais (MP3 locais em /public/sfx/, zero CORS/404, pré-carregados em RAM e
 *   decodificados em AudioBuffer para latência mínima): Trovão, Porta Rangendo, Espada, Rugido,
 *   Moedas, Magia Arcana, Flecha, Explosão e Uivo Sombrio.
 * - 3 efeitos preservados exatamente em síntese procedural acústica: Suspense/Pulso (heartbeat),
 *   Baú/Tesouro (chest_open) e Sino da Taverna (tavern_bell), além de Sussurro e Teste.
 * - Compressor dinâmico mestre (DynamicsCompressorNode) + Reverbs estéreo por convolução + fallback
 *   procedural automático caso um sample não possa ser carregado.
 * - Canal de volume independente da trilha musical.
 */

export const SOUNDBOARD_EFFECTS = [
  { id: 'thunder', label: 'Trovão & Relâmpago', shortLabel: 'Trovão', color: '#38bdf8', icon: 'thunder', category: 'Clima' },
  { id: 'creaky_door', label: 'Porta Rangendo', shortLabel: 'Porta', color: '#d97706', icon: 'door', category: 'Cenário' },
  { id: 'sword', label: 'Espada / Golpe', shortLabel: 'Espada', color: '#e2e8f0', icon: 'sword', category: 'Combate' },
  { id: 'roar', label: 'Rugido de Fera', shortLabel: 'Rugido', color: '#ef4444', icon: 'roar', category: 'Criatura' },
  { id: 'coins', label: 'Moedas de Ouro', shortLabel: 'Moedas', color: '#fbbf24', icon: 'coins', category: 'Tesouro' },
  { id: 'tavern_bell', label: 'Sino da Taverna', shortLabel: 'Sino', color: '#f59e0b', icon: 'bell', category: 'Cenário' },
  { id: 'magic', label: 'Magia Arcana', shortLabel: 'Magia', color: '#a855f7', icon: 'magic', category: 'Magia' },
  { id: 'arrow', label: 'Flecha Disparada', shortLabel: 'Flecha', color: '#34d399', icon: 'arrow', category: 'Combate' },
  { id: 'explosion', label: 'Explosão / Fogo', shortLabel: 'Explosão', color: '#f97316', icon: 'explosion', category: 'Combate' },
  { id: 'heartbeat', label: 'Suspense / Pulso', shortLabel: 'Pulso', color: '#f43f5e', icon: 'heartbeat', category: 'Tensão' },
  { id: 'wolf_howl', label: 'Uivo Sombrio', shortLabel: 'Uivo', color: '#60a5fa', icon: 'wolf', category: 'Criatura' },
  { id: 'chest_open', label: 'Baú / Tesouro', shortLabel: 'Tesouro', color: '#eab308', icon: 'chest', category: 'Tesouro' },
];

// Samples de estúdio locais (heartbeat/Pulso, chest_open/Tesouro e tavern_bell/Sino mantêm a síntese original intacta)
const SAMPLE_SFX_PATHS = {
  thunder: '/sfx/thunder.mp3',
  creaky_door: '/sfx/creaky_door.mp3',
  sword: '/sfx/sword.mp3',
  roar: '/sfx/roar.mp3',
  coins: '/sfx/coins.mp3',
  magic: '/sfx/magic.mp3',
  arrow: '/sfx/arrow.mp3',
  explosion: '/sfx/explosion.mp3',
  wolf_howl: '/sfx/wolf_howl.mp3',
};

// Calibração de ganho por sample para volume uniforme e impactante no Soundboard
const SAMPLE_SFX_GAINS = {
  thunder: 1.0,
  creaky_door: 1.08,
  sword: 0.94,
  roar: 1.0,
  coins: 1.05,
  magic: 1.0,
  arrow: 1.06,
  explosion: 0.94,
  wolf_howl: 1.02,
};

let sfxCtx = null;
let sfxGraph = null;
let cachedNoiseBuffers = null;
let preloadStarted = false;

const rawSampleBytesCache = new Map(); // sfxId -> ArrayBuffer
const rawSamplePromises = new Map(); // sfxId -> Promise<ArrayBuffer | null>
const decodedSampleCache = new Map(); // sfxId -> AudioBuffer
const decodeSamplePromises = new Map(); // sfxId -> Promise<AudioBuffer | null>

function fetchSampleBytes(sfxId) {
  const url = SAMPLE_SFX_PATHS[sfxId];
  if (!url || typeof window === 'undefined' || typeof fetch !== 'function') {
    return Promise.resolve(null);
  }
  if (rawSampleBytesCache.has(sfxId)) {
    return Promise.resolve(rawSampleBytesCache.get(sfxId));
  }
  if (rawSamplePromises.has(sfxId)) {
    return rawSamplePromises.get(sfxId);
  }

  const promise = fetch(url, { cache: 'force-cache' })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.arrayBuffer();
    })
    .then((buf) => {
      if (buf && buf.byteLength > 256) {
        rawSampleBytesCache.set(sfxId, buf);
        return buf;
      }
      return null;
    })
    .catch(() => null)
    .finally(() => {
      rawSamplePromises.delete(sfxId);
    });

  rawSamplePromises.set(sfxId, promise);
  return promise;
}

/**
 * Pré-carrega os arquivos de áudio do soundboard em memória em segundo plano
 * (sem inicializar AudioContext antes de um gesto do usuário).
 */
export function preloadSoundboardSamples() {
  if (preloadStarted || typeof window === 'undefined') return;
  preloadStarted = true;
  Object.keys(SAMPLE_SFX_PATHS).forEach((id) => {
    fetchSampleBytes(id).catch(() => {});
  });
}

function getDecodedSampleBuffer(ctx, sfxId) {
  if (!ctx || !SAMPLE_SFX_PATHS[sfxId]) return Promise.resolve(null);
  if (decodedSampleCache.has(sfxId)) {
    return Promise.resolve(decodedSampleCache.get(sfxId));
  }
  if (decodeSamplePromises.has(sfxId)) {
    return decodeSamplePromises.get(sfxId);
  }

  const promise = fetchSampleBytes(sfxId)
    .then((raw) => {
      if (!raw) return null;
      // Copia o ArrayBuffer para evitar detachment em decodificações paralelas/Safari
      return ctx.decodeAudioData(raw.slice(0));
    })
    .then((decoded) => {
      if (decoded) {
        decodedSampleCache.set(sfxId, decoded);
      }
      return decoded || null;
    })
    .catch(() => null)
    .finally(() => {
      decodeSamplePromises.delete(sfxId);
    });

  decodeSamplePromises.set(sfxId, promise);
  return promise;
}

function playDecodedSample(eng, buffer, sfxId, safeVol) {
  const { ctx, compressor } = eng;
  const now = ctx.currentTime + 0.005;
  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const gainNode = ctx.createGain();
  const trim = SAMPLE_SFX_GAINS[sfxId] ?? 1.0;
  const targetGain = Math.max(0.02, Math.min(1.25, safeVol * trim));

  // Micro ramp de 4ms para evitar estalos digitais na saída
  gainNode.gain.setValueAtTime(0.001, now);
  gainNode.gain.linearRampToValueAtTime(targetGain, now + 0.004);

  source.connect(gainNode);
  gainNode.connect(compressor);
  source.start(now);
}

function createStereoImpulse(ctx, durationSec, decayRate, lowpassHz = 6000) {
  const sr = ctx.sampleRate;
  const length = Math.floor(sr * durationSec);
  const impulse = ctx.createBuffer(2, length, sr);

  for (let ch = 0; ch < 2; ch += 1) {
    const data = impulse.getChannelData(ch);
    let lp = 0;
    const rc = 1 / (2 * Math.PI * lowpassHz);
    const dt = 1 / sr;
    const alpha = dt / (rc + dt);

    for (let i = 0; i < length; i += 1) {
      const t = i / length;
      const env = Math.pow(1 - t, decayRate);
      // Early reflections densas + cauda difusa estéreo
      const white = Math.random() * 2 - 1;
      lp += alpha * (white - lp);
      const earlyBoost = i < sr * 0.045 && i % Math.floor(sr * 0.009) < 12 ? 1.45 : 1.0;
      data[i] = lp * env * earlyBoost;
    }
  }
  return impulse;
}

function buildNoiseBuffers(ctx) {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * 3.5);

  const white = ctx.createBuffer(1, len, sr);
  const pink = ctx.createBuffer(1, len, sr);
  const brown = ctx.createBuffer(1, len, sr);

  const wData = white.getChannelData(0);
  const pData = pink.getChannelData(0);
  const bData = brown.getChannelData(0);

  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  let lastOut = 0;

  for (let i = 0; i < len; i += 1) {
    const w = Math.random() * 2 - 1;
    wData[i] = w;

    // Filtro Paul Kellet de ruído rosa (espectro acústico natural)
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.96900 * b2 + w * 0.1538520;
    b3 = 0.86650 * b3 + w * 0.3104856;
    b4 = 0.55000 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.0168980;
    pData[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.14));
    b6 = w * 0.115926;

    // Ruído marrom (energia subgrave profunda para trovões e explosões)
    lastOut = (lastOut + 0.025 * w) / 1.025;
    bData[i] = Math.max(-1, Math.min(1, lastOut * 3.4));
  }

  return { white, pink, brown };
}

function makeSaturationCurve(drive = 24) {
  const n = 512;
  const curve = new Float32Array(n);
  const k = Math.max(1, drive);
  for (let i = 0; i < n; i += 1) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

function getSfxAudioEngine() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;

  if (!sfxCtx) {
    sfxCtx = new AudioCtx();
  }
  if (sfxCtx.state === 'suspended') {
    sfxCtx.resume().catch(() => {});
  }

  if (!sfxGraph) {
    const compressor = sfxCtx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-14, sfxCtx.currentTime);
    compressor.knee.setValueAtTime(18, sfxCtx.currentTime);
    compressor.ratio.setValueAtTime(5.5, sfxCtx.currentTime);
    compressor.attack.setValueAtTime(0.003, sfxCtx.currentTime);
    compressor.release.setValueAtTime(0.22, sfxCtx.currentTime);
    compressor.connect(sfxCtx.destination);

    // Reverb amplo (caverna / céu aberto / catedral)
    const hallConvolver = sfxCtx.createConvolver();
    hallConvolver.buffer = createStereoImpulse(sfxCtx, 2.35, 2.5, 4800);
    const hallReturn = sfxCtx.createGain();
    hallReturn.gain.setValueAtTime(0.55, sfxCtx.currentTime);
    hallConvolver.connect(hallReturn);
    hallReturn.connect(compressor);

    // Reverb curto (taverna de madeira / corredor de pedra)
    const roomConvolver = sfxCtx.createConvolver();
    roomConvolver.buffer = createStereoImpulse(sfxCtx, 0.62, 3.2, 6500);
    const roomReturn = sfxCtx.createGain();
    roomReturn.gain.setValueAtTime(0.42, sfxCtx.currentTime);
    roomConvolver.connect(roomReturn);
    roomReturn.connect(compressor);

    cachedNoiseBuffers = buildNoiseBuffers(sfxCtx);

    sfxGraph = {
      ctx: sfxCtx,
      compressor,
      hallSend: hallConvolver,
      roomSend: roomConvolver,
      noise: cachedNoiseBuffers,
    };
  }

  return sfxGraph;
}

function createPanner(ctx, pan = 0) {
  if (typeof ctx.createStereoPanner === 'function') {
    const p = ctx.createStereoPanner();
    p.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), ctx.currentTime);
    return p;
  }
  return ctx.createGain();
}

function playNoiseBurst(ctx, buffer, startTime, duration, { filterType = 'bandpass', freqStart = 1000, freqEnd = null, q = 1, gainPeak = 0.5, attack = 0.01, pan = 0, out }) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(Math.max(20, freqStart), startTime);
  if (freqEnd !== null && freqEnd > 20) {
    filter.frequency.exponentialRampToValueAtTime(freqEnd, startTime + duration);
  }
  filter.Q.setValueAtTime(q, startTime);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, startTime);
  g.gain.linearRampToValueAtTime(gainPeak, startTime + Math.min(attack, duration * 0.4));
  g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  const panner = createPanner(ctx, pan);
  src.connect(filter);
  filter.connect(g);
  g.connect(panner);
  panner.connect(out);

  src.start(startTime, Math.random() * 0.8);
  src.stop(startTime + duration + 0.04);
}

export function playSoundboardEffect(sfxId, volume = 0.8, muted = false) {
  if (muted || volume <= 0.01) return false;

  try {
    const eng = getSfxAudioEngine();
    if (!eng) return false;

    const safeVol = Math.max(0.05, Math.min(1, Number(volume) || 0.8));

    // Para os 9 efeitos com sample real de estúdio, reproduz o AudioBuffer de alta fidelidade
    // (Pulso/heartbeat, Tesouro/chest_open e Sino/tavern_bell permanecem 100% na síntese original)
    if (SAMPLE_SFX_PATHS[sfxId]) {
      const cached = decodedSampleCache.get(sfxId);
      if (cached) {
        if (eng.ctx.state === 'suspended') {
          eng.ctx
            .resume()
            .then(() => playDecodedSample(eng, cached, sfxId, safeVol))
            .catch(() => {});
        } else {
          playDecodedSample(eng, cached, sfxId, safeVol);
        }
        return true;
      }

      const resumePromise =
        eng.ctx.state === 'suspended' ? eng.ctx.resume().catch(() => {}) : Promise.resolve();

      Promise.all([resumePromise, getDecodedSampleBuffer(eng.ctx, sfxId)])
        .then(([, decoded]) => {
          if (decoded) {
            playDecodedSample(eng, decoded, sfxId, safeVol);
          } else {
            playProceduralSoundboardEffect(eng, sfxId, safeVol);
          }
        })
        .catch(() => {
          playProceduralSoundboardEffect(eng, sfxId, safeVol);
        });

      return true;
    }

    return playProceduralSoundboardEffect(eng, sfxId, safeVol);
  } catch {
    return false;
  }
}

function playProceduralSoundboardEffect(eng, sfxId, safeVol) {
  try {
    const { ctx, compressor, hallSend, roomSend, noise } = eng;
    const now = ctx.currentTime + 0.01;

    // Bus dedicado da instância para mixagem Dry + Reverb com controle limpo de ganho
    const dryBus = ctx.createGain();
    dryBus.gain.setValueAtTime(safeVol * 0.92, now);
    dryBus.connect(compressor);

    const hallBus = ctx.createGain();
    hallBus.gain.setValueAtTime(0, now);
    hallBus.connect(hallSend);

    const roomBus = ctx.createGain();
    roomBus.gain.setValueAtTime(0, now);
    roomBus.connect(roomSend);

    const connectBus = (node, { dry = 1, hall = 0, room = 0 } = {}) => {
      if (dry > 0) {
        const g = ctx.createGain();
        g.gain.setValueAtTime(dry, now);
        node.connect(g);
        g.connect(dryBus);
      }
      if (hall > 0) {
        hallBus.gain.setValueAtTime(safeVol * 0.8, now);
        const g = ctx.createGain();
        g.gain.setValueAtTime(hall, now);
        node.connect(g);
        g.connect(hallBus);
      }
      if (room > 0) {
        roomBus.gain.setValueAtTime(safeVol * 0.75, now);
        const g = ctx.createGain();
        g.gain.setValueAtTime(room, now);
        node.connect(g);
        g.connect(roomBus);
      }
    };

    switch (sfxId) {
      case 'thunder': {
        // 1. Estalos elétricos iniciais (descarga do raio rasgando o ar em estéreo)
        const crackBus = ctx.createGain();
        connectBus(crackBus, { dry: 0.95, hall: 0.7 });

        [0, 0.028, 0.062].forEach((offset, i) => {
          playNoiseBurst(ctx, noise.white, now + offset, 0.11 + i * 0.04, {
            filterType: 'bandpass',
            freqStart: 2800 - i * 450,
            freqEnd: 700,
            q: 0.9,
            gainPeak: i === 1 ? 0.95 : 0.55,
            attack: 0.003,
            pan: i === 0 ? -0.45 : i === 1 ? 0.15 : 0.45,
            out: crackBus,
          });
        });

        // 2. Onda de choque subgrave principal (saturação suave + ruído marrom profundo)
        const rumbleBus = ctx.createGain();
        const shaper = ctx.createWaveShaper();
        shaper.curve = makeSaturationCurve(14);
        rumbleBus.connect(shaper);
        connectBus(shaper, { dry: 1.0, hall: 0.85 });

        const subBoom = ctx.createOscillator();
        const subGain = ctx.createGain();
        subBoom.type = 'sine';
        subBoom.frequency.setValueAtTime(82, now + 0.04);
        subBoom.frequency.exponentialRampToValueAtTime(28, now + 1.15);
        subGain.gain.setValueAtTime(0.001, now + 0.04);
        subGain.gain.linearRampToValueAtTime(0.85, now + 0.08);
        subGain.gain.exponentialRampToValueAtTime(0.0005, now + 1.45);
        subBoom.connect(subGain);
        subGain.connect(rumbleBus);
        subBoom.start(now + 0.04);
        subBoom.stop(now + 1.5);

        // 3. Trovão rolando pelas nuvens em 3 ondas sobrepostas com reverberação longa
        const waves = [
          { t: 0.04, dur: 2.8, f1: 360, f2: 58, peak: 1.0, pan: -0.2 },
          { t: 0.52, dur: 2.6, f1: 240, f2: 48, peak: 0.72, pan: 0.35 },
          { t: 1.18, dur: 2.3, f1: 180, f2: 42, peak: 0.48, pan: -0.35 },
        ];
        waves.forEach((w) => {
          playNoiseBurst(ctx, noise.brown, now + w.t, w.dur, {
            filterType: 'lowpass',
            freqStart: w.f1,
            freqEnd: w.f2,
            q: 1.2,
            gainPeak: w.peak,
            attack: 0.14,
            pan: w.pan,
            out: rumbleBus,
          });
        });
        break;
      }

      case 'creaky_door': {
        // Modelo físico de fricção stick-slip de dobradiça enferrujada + ressonância de porta de carvalho
        const doorBus = ctx.createGain();
        connectBus(doorBus, { dry: 0.9, room: 0.65 });

        // 3 formantes de madeira oca de porta pesada
        const bodyMix = ctx.createGain();
        const woodFormants = [
          { freq: 315, q: 5.5, gain: 0.45 },
          { freq: 760, q: 7.5, gain: 0.55 },
          { freq: 1580, q: 8.5, gain: 0.38 },
        ];
        woodFormants.forEach((fm) => {
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.setValueAtTime(fm.freq, now);
          bp.Q.setValueAtTime(fm.q, now);
          const g = ctx.createGain();
          g.gain.setValueAtTime(fm.gain, now);
          bodyMix.connect(bp);
          bp.connect(g);
          g.connect(doorBus);
        });

        // Sequência orgânica de "estalos" de atrito stick-slip (varia velocidade ao abrir a porta)
        let cursor = 0.02;
        const stages = [
          { count: 14, dtStart: 0.036, dtEnd: 0.017, pitchStart: 190, pitchEnd: 330, amp: 0.72 },
          { count: 18, dtStart: 0.016, dtEnd: 0.028, pitchStart: 340, pitchEnd: 245, amp: 0.85 },
          { count: 14, dtStart: 0.026, dtEnd: 0.048, pitchStart: 270, pitchEnd: 420, amp: 0.68 },
        ];

        stages.forEach((st) => {
          for (let i = 0; i < st.count; i += 1) {
            const frac = i / Math.max(1, st.count - 1);
            const dt = st.dtStart + (st.dtEnd - st.dtStart) * frac;
            const pitch = (st.pitchStart + (st.pitchEnd - st.pitchStart) * frac) * (0.96 + Math.random() * 0.08);
            const grainT = now + cursor;

            const osc = ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(pitch, grainT);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.72, grainT + dt * 1.15);

            const g = ctx.createGain();
            g.gain.setValueAtTime(0.0001, grainT);
            g.gain.linearRampToValueAtTime(st.amp * (0.75 + Math.random() * 0.35), grainT + 0.003);
            g.gain.exponentialRampToValueAtTime(0.0001, grainT + Math.max(0.018, dt * 1.3));

            osc.connect(g);
            g.connect(bodyMix);
            osc.start(grainT);
            osc.stop(grainT + Math.max(0.025, dt * 1.4));

            cursor += dt;
          }
          cursor += 0.06;
        });

        // Batida pesada da porta de carvalho + trinco de ferro no final
        const thudT = now + cursor + 0.03;
        const thudOsc = ctx.createOscillator();
        const thudG = ctx.createGain();
        thudOsc.type = 'triangle';
        thudOsc.frequency.setValueAtTime(118, thudT);
        thudOsc.frequency.exponentialRampToValueAtTime(34, thudT + 0.18);
        thudG.gain.setValueAtTime(0.95, thudT);
        thudG.gain.exponentialRampToValueAtTime(0.0005, thudT + 0.24);
        thudOsc.connect(thudG);
        thudG.connect(doorBus);
        thudOsc.start(thudT);
        thudOsc.stop(thudT + 0.26);

        playNoiseBurst(ctx, noise.pink, thudT, 0.18, {
          filterType: 'lowpass',
          freqStart: 420,
          freqEnd: 90,
          gainPeak: 0.65,
          attack: 0.004,
          out: doorBus,
        });

        // Clique metálico da tranca
        [1920, 3260].forEach((f) => {
          const latch = ctx.createOscillator();
          const lg = ctx.createGain();
          latch.type = 'sine';
          latch.frequency.setValueAtTime(f, thudT + 0.03);
          lg.gain.setValueAtTime(0.18, thudT + 0.03);
          lg.gain.exponentialRampToValueAtTime(0.0005, thudT + 0.11);
          latch.connect(lg);
          lg.connect(doorBus);
          latch.start(thudT + 0.03);
          latch.stop(thudT + 0.13);
        });
        break;
      }

      case 'sword': {
        // 1. Corte rápido da lâmina no ar (swish) + impacto metálico de aço temperado
        const swordBus = ctx.createGain();
        connectBus(swordBus, { dry: 0.92, room: 0.55 });

        playNoiseBurst(ctx, noise.pink, now, 0.13, {
          filterType: 'bandpass',
          freqStart: 900,
          freqEnd: 4600,
          q: 2.2,
          gainPeak: 0.52,
          attack: 0.04,
          pan: -0.35,
          out: swordBus,
        });

        // Impacto seco de aço contra aço (t + 0.07s)
        const hitT = now + 0.075;
        playNoiseBurst(ctx, noise.white, hitT, 0.14, {
          filterType: 'highpass',
          freqStart: 3200,
          freqEnd: 1800,
          gainPeak: 0.88,
          attack: 0.001,
          pan: 0.1,
          out: swordBus,
        });

        // Série inarmônica real de ressonância de lâmina de aço com batimento natural
        const bladeModes = [
          { f: 1145, amp: 0.28, dur: 0.88 },
          { f: 1152, amp: 0.16, dur: 0.72 },
          { f: 1875, amp: 0.24, dur: 0.76 },
          { f: 2690, amp: 0.22, dur: 0.65 },
          { f: 3640, amp: 0.18, dur: 0.52 },
          { f: 4820, amp: 0.15, dur: 0.42 },
          { f: 6250, amp: 0.11, dur: 0.3 },
          { f: 7940, amp: 0.08, dur: 0.2 },
        ];
        bladeModes.forEach((m, idx) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = idx % 3 === 0 ? 'triangle' : 'sine';
          osc.frequency.setValueAtTime(m.f, hitT);
          osc.frequency.exponentialRampToValueAtTime(m.f * 0.985, hitT + m.dur);
          g.gain.setValueAtTime(0.0001, hitT);
          g.gain.linearRampToValueAtTime(m.amp, hitT + 0.003);
          g.gain.exponentialRampToValueAtTime(0.0004, hitT + m.dur);
          osc.connect(g);
          g.connect(swordBus);
          osc.start(hitT);
          osc.stop(hitT + m.dur + 0.04);
        });
        break;
      }

      case 'roar': {
        // Rugido visceral de dragão / monstro gigante com trato vocal de 3 formantes + raspagem caótica
        const roarBus = ctx.createGain();
        const shaper = ctx.createWaveShaper();
        shaper.curve = makeSaturationCurve(22);
        roarBus.connect(shaper);
        connectBus(shaper, { dry: 0.92, hall: 0.8 });

        const vocalInput = ctx.createGain();
        vocalInput.gain.setValueAtTime(0.001, now);
        vocalInput.gain.linearRampToValueAtTime(0.95, now + 0.18);
        vocalInput.gain.setValueAtTime(0.88, now + 0.85);
        vocalInput.gain.exponentialRampToValueAtTime(0.0005, now + 2.25);

        // 3 formantes de garganta monstruosa que se abrem e depois fecham
        const formants = [
          { f1: 230, f2: 340, f3: 165, q: 3.0, gain: 0.75 },
          { f1: 620, f2: 880, f3: 390, q: 3.4, gain: 0.65 },
          { f1: 1280, f2: 1680, f3: 720, q: 2.8, gain: 0.38 },
        ];
        formants.forEach((fm) => {
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.setValueAtTime(fm.f1, now);
          bp.frequency.linearRampToValueAtTime(fm.f2, now + 0.38);
          bp.frequency.exponentialRampToValueAtTime(fm.f3, now + 2.15);
          bp.Q.setValueAtTime(fm.q, now);
          const g = ctx.createGain();
          g.gain.setValueAtTime(fm.gain, now);
          vocalInput.connect(bp);
          bp.connect(g);
          g.connect(roarBus);
        });

        // Cordas vocais graves duplas com modulação de aspereza (ruído filtrado modulando o pitch!)
        const raspSrc = ctx.createBufferSource();
        raspSrc.buffer = noise.brown;
        raspSrc.loop = true;
        const raspLp = ctx.createBiquadFilter();
        raspLp.type = 'lowpass';
        raspLp.frequency.setValueAtTime(55, now);
        const raspDepth = ctx.createGain();
        raspDepth.gain.setValueAtTime(48, now);
        raspSrc.connect(raspLp);
        raspLp.connect(raspDepth);

        [
          { type: 'sawtooth', fStart: 108, fPeak: 148, fEnd: 46, gain: 0.65 },
          { type: 'sawtooth', fStart: 72, fPeak: 96, fEnd: 33, gain: 0.58 },
          { type: 'triangle', fStart: 52, fPeak: 64, fEnd: 28, gain: 0.55 },
        ].forEach((v) => {
          const osc = ctx.createOscillator();
          osc.type = v.type;
          osc.frequency.setValueAtTime(v.fStart, now);
          osc.frequency.linearRampToValueAtTime(v.fPeak, now + 0.3);
          osc.frequency.exponentialRampToValueAtTime(v.fEnd, now + 2.2);
          raspDepth.connect(osc.frequency);
          const vg = ctx.createGain();
          vg.gain.setValueAtTime(v.gain, now);
          osc.connect(vg);
          vg.connect(vocalInput);
          osc.start(now);
          osc.stop(now + 2.3);
        });
        raspSrc.start(now);
        raspSrc.stop(now + 2.3);

        // Sopro gutural turbulento
        playNoiseBurst(ctx, noise.pink, now + 0.06, 2.0, {
          filterType: 'bandpass',
          freqStart: 780,
          freqEnd: 260,
          q: 1.4,
          gainPeak: 0.45,
          attack: 0.22,
          out: roarBus,
        });
        break;
      }

      case 'coins': {
        // Cascata realista de 14 moedas de ouro tilintando e quicando em estéreo sobre mesa de madeira
        const coinsBus = ctx.createGain();
        connectBus(coinsBus, { dry: 0.9, room: 0.45 });

        const hits = [
          { t: 0.0, f: 3120, pan: -0.45, amp: 0.24 },
          { t: 0.038, f: 3890, pan: 0.25, amp: 0.22 },
          { t: 0.072, f: 3440, pan: -0.15, amp: 0.25 },
          { t: 0.115, f: 4280, pan: 0.48, amp: 0.21 },
          { t: 0.148, f: 3650, pan: -0.32, amp: 0.23 },
          { t: 0.192, f: 4620, pan: 0.08, amp: 0.2 },
          { t: 0.235, f: 3290, pan: -0.52, amp: 0.19 },
          { t: 0.275, f: 4110, pan: 0.36, amp: 0.2 },
          { t: 0.322, f: 3780, pan: -0.1, amp: 0.18 },
          { t: 0.375, f: 4490, pan: 0.22, amp: 0.17 },
          { t: 0.435, f: 3560, pan: -0.28, amp: 0.15 },
          { t: 0.505, f: 4020, pan: 0.14, amp: 0.13 },
          { t: 0.59, f: 3810, pan: -0.08, amp: 0.11 },
          { t: 0.69, f: 4220, pan: 0.05, amp: 0.08 },
        ];

        hits.forEach(({ t, f, pan, amp }) => {
          const hitT = now + t;
          const panner = createPanner(ctx, pan);
          panner.connect(coinsBus);

          // 3 parciais metálicos de ouro (alta clareza e brilho)
          [1.0, 1.486, 2.24].forEach((ratio, idx) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f * ratio, hitT);
            const dur = 0.26 / (idx * 0.55 + 1);
            g.gain.setValueAtTime(0.0001, hitT);
            g.gain.linearRampToValueAtTime(amp / (idx * 0.7 + 1), hitT + 0.0025);
            g.gain.exponentialRampToValueAtTime(0.0003, hitT + dur);
            osc.connect(g);
            g.connect(panner);
            osc.start(hitT);
            osc.stop(hitT + dur + 0.02);
          });
        });
        break;
      }

      case 'tavern_bell': {
        // Sino de bronze fundido (série harmônica campanológica de terça menor + badalada)
        const bellBus = ctx.createGain();
        connectBus(bellBus, { dry: 0.85, hall: 0.85 });

        // Impacto seco do badalo no bronze
        playNoiseBurst(ctx, noise.white, now, 0.045, {
          filterType: 'bandpass',
          freqStart: 2400,
          freqEnd: 1200,
          q: 2.4,
          gainPeak: 0.55,
          attack: 0.001,
          out: bellBus,
        });

        const baseHz = 523.25; // C5
        const partials = [
          { ratio: 0.5, amp: 0.28, dur: 3.4, detune: 0 },      // Hum
          { ratio: 1.0, amp: 0.36, dur: 2.8, detune: 0 },      // Prime
          { ratio: 1.003, amp: 0.14, dur: 2.5, detune: 0 },    // Shimmer beat
          { ratio: 1.188, amp: 0.24, dur: 2.2, detune: 0 },    // Minor-third Tierce (som autêntico de sino!)
          { ratio: 1.506, amp: 0.18, dur: 1.8, detune: 0 },    // Quint
          { ratio: 2.0, amp: 0.22, dur: 1.5, detune: 0 },      // Nominal
          { ratio: 2.514, amp: 0.11, dur: 1.0, detune: 0 },    // Superquint
          { ratio: 3.011, amp: 0.08, dur: 0.7, detune: 0 },    // Octave Nominal
        ];
        partials.forEach((p) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(baseHz * p.ratio, now);
          g.gain.setValueAtTime(0.0001, now);
          g.gain.linearRampToValueAtTime(p.amp, now + 0.006);
          g.gain.exponentialRampToValueAtTime(0.0003, now + p.dur);
          osc.connect(g);
          g.connect(bellBus);
          osc.start(now);
          osc.stop(now + p.dur + 0.06);
        });
        break;
      }

      case 'magic': {
        // Conjuração arcana cristalina: espiral de éter + pad harmônico + cascata de sinos Lídios em estéreo
        const magicBus = ctx.createGain();
        connectBus(magicBus, { dry: 0.78, hall: 0.95 });

        // Espiral etérea varrendo de grave a agudo
        playNoiseBurst(ctx, noise.pink, now, 1.35, {
          filterType: 'bandpass',
          freqStart: 320,
          freqEnd: 3400,
          q: 5.5,
          gainPeak: 0.34,
          attack: 0.35,
          out: magicBus,
        });

        // Acorde de sustentação arcano quente
        [293.66, 440.0, 587.33].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now);
          osc.frequency.linearRampToValueAtTime(freq * 1.01, now + 1.4);
          g.gain.setValueAtTime(0.0001, now);
          g.gain.linearRampToValueAtTime(0.11 - i * 0.02, now + 0.25);
          g.gain.exponentialRampToValueAtTime(0.0003, now + 1.65);
          osc.connect(g);
          g.connect(magicBus);
          osc.start(now);
          osc.stop(now + 1.72);
        });

        // Cascata cristalina em estéreo ping-pong
        const chimes = [587.33, 739.99, 880.0, 1046.5, 1174.66, 1479.98, 1760.0, 2349.32];
        chimes.forEach((freq, idx) => {
          const t = now + 0.08 + idx * 0.068;
          const panner = createPanner(ctx, idx % 2 === 0 ? -0.55 : 0.55);
          panner.connect(magicBus);

          const o1 = ctx.createOscillator();
          const o2 = ctx.createOscillator();
          const g = ctx.createGain();
          o1.type = 'sine';
          o2.type = 'sine';
          o1.frequency.setValueAtTime(freq, t);
          o2.frequency.setValueAtTime(freq * 2.003, t);

          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.18, t + 0.015);
          g.gain.exponentialRampToValueAtTime(0.0003, t + 0.95);
          o1.connect(g);
          o2.connect(g);
          g.connect(panner);
          o1.start(t);
          o2.start(t);
          o1.stop(t + 1.0);
          o2.stop(t + 1.0);
        });
        break;
      }

      case 'arrow': {
        // 1. Estalo da corda do arco à esquerda -> 2. Sibilo Doppler cruzando para a direita -> 3. Impacto + vibração da haste
        const arrowBus = ctx.createGain();
        connectBus(arrowBus, { dry: 0.95, room: 0.4 });

        // Corda do arco
        const bowPan = createPanner(ctx, -0.65);
        bowPan.connect(arrowBus);
        const twang = ctx.createOscillator();
        const tg = ctx.createGain();
        twang.type = 'triangle';
        twang.frequency.setValueAtTime(210, now);
        twang.frequency.exponentialRampToValueAtTime(76, now + 0.13);
        tg.gain.setValueAtTime(0.45, now);
        tg.gain.exponentialRampToValueAtTime(0.0005, now + 0.15);
        twang.connect(tg);
        tg.connect(bowPan);
        twang.start(now);
        twang.stop(now + 0.17);

        // Voo da flecha com panorâmica dinâmica (-0.7 -> +0.7) e efeito Doppler
        const whooshSrc = ctx.createBufferSource();
        whooshSrc.buffer = noise.pink;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(3400, now + 0.02);
        bp.frequency.exponentialRampToValueAtTime(620, now + 0.34);
        bp.Q.setValueAtTime(3.2, now);
        const wg = ctx.createGain();
        wg.gain.setValueAtTime(0.0001, now + 0.02);
        wg.gain.linearRampToValueAtTime(0.62, now + 0.11);
        wg.gain.exponentialRampToValueAtTime(0.0005, now + 0.35);

        const flyPan = createPanner(ctx, -0.7);
        if (flyPan.pan) {
          flyPan.pan.linearRampToValueAtTime(0.7, now + 0.32);
        }
        whooshSrc.connect(bp);
        bp.connect(wg);
        wg.connect(flyPan);
        flyPan.connect(arrowBus);
        whooshSrc.start(now + 0.02, 0.2);
        whooshSrc.stop(now + 0.38);

        // Impacto seco no alvo ("THWACK!") + vibração rápida da haste de madeira
        const hitT = now + 0.31;
        const hitPan = createPanner(ctx, 0.65);
        hitPan.connect(arrowBus);

        const impact = ctx.createOscillator();
        const ig = ctx.createGain();
        impact.type = 'sine';
        impact.frequency.setValueAtTime(175, hitT);
        impact.frequency.exponentialRampToValueAtTime(42, hitT + 0.11);
        ig.gain.setValueAtTime(0.95, hitT);
        ig.gain.exponentialRampToValueAtTime(0.0005, hitT + 0.14);
        impact.connect(ig);
        ig.connect(hitPan);
        impact.start(hitT);
        impact.stop(hitT + 0.16);

        // Vibração "bzz-twang" da flecha cravada
        const rattle = ctx.createOscillator();
        const rg = ctx.createGain();
        rattle.type = 'sawtooth';
        rattle.frequency.setValueAtTime(142, hitT + 0.01);
        rattle.frequency.linearRampToValueAtTime(118, hitT + 0.22);
        const rLp = ctx.createBiquadFilter();
        rLp.type = 'lowpass';
        rLp.frequency.setValueAtTime(520, hitT);
        rg.gain.setValueAtTime(0.28, hitT + 0.01);
        rg.gain.exponentialRampToValueAtTime(0.0004, hitT + 0.24);
        rattle.connect(rLp);
        rLp.connect(rg);
        rg.connect(hitPan);
        rattle.start(hitT + 0.01);
        rattle.stop(hitT + 0.26);
        break;
      }

      case 'explosion': {
        // Bola de Fogo / Explosão Cinematográfica: ignição -> detonação subgrave saturada -> chamas + destroços
        const expBus = ctx.createGain();
        const shaper = ctx.createWaveShaper();
        shaper.curve = makeSaturationCurve(28);
        expBus.connect(shaper);
        connectBus(shaper, { dry: 0.96, hall: 0.85 });

        // Pré-ignição rápida (flare)
        playNoiseBurst(ctx, noise.pink, now, 0.11, {
          filterType: 'bandpass',
          freqStart: 400,
          freqEnd: 2200,
          q: 1.5,
          gainPeak: 0.48,
          attack: 0.05,
          out: expBus,
        });

        const boomT = now + 0.065;
        // Sub-impacto sísmico
        const sub = ctx.createOscillator();
        const sg = ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(145, boomT);
        sub.frequency.exponentialRampToValueAtTime(24, boomT + 0.95);
        sg.gain.setValueAtTime(1.0, boomT);
        sg.gain.exponentialRampToValueAtTime(0.0005, boomT + 1.35);
        sub.connect(sg);
        sg.connect(expBus);
        sub.start(boomT);
        sub.stop(boomT + 1.4);

        // Estouro inicial + rugido das chamas
        playNoiseBurst(ctx, noise.white, boomT, 0.28, {
          filterType: 'lowpass',
          freqStart: 3800,
          freqEnd: 420,
          gainPeak: 0.95,
          attack: 0.003,
          out: expBus,
        });

        playNoiseBurst(ctx, noise.brown, boomT + 0.02, 2.35, {
          filterType: 'lowpass',
          freqStart: 1350,
          freqEnd: 85,
          q: 1.1,
          gainPeak: 1.0,
          attack: 0.03,
          out: expBus,
        });

        // Estilhaços / pedras caindo em estéreo
        [0.42, 0.58, 0.77, 0.96, 1.18].forEach((offset, idx) => {
          playNoiseBurst(ctx, noise.white, boomT + offset, 0.055, {
            filterType: 'bandpass',
            freqStart: 1600 + idx * 240,
            freqEnd: 650,
            q: 2.6,
            gainPeak: 0.24 - idx * 0.03,
            attack: 0.002,
            pan: idx % 2 === 0 ? -0.55 : 0.55,
            out: expBus,
          });
        });
        break;
      }

      case 'heartbeat': {
        // Batimento cardíaco cinematográfico tenso (lub-DUB ... lub-DUB) + drone sutil de suspense
        const heartBus = ctx.createGain();
        connectBus(heartBus, { dry: 0.95, room: 0.35 });

        // Sub-drone atmosférico sutil
        const drone = ctx.createOscillator();
        const dg = ctx.createGain();
        drone.type = 'sine';
        drone.frequency.setValueAtTime(43.65, now); // F1
        dg.gain.setValueAtTime(0.0001, now);
        dg.gain.linearRampToValueAtTime(0.16, now + 0.3);
        dg.gain.exponentialRampToValueAtTime(0.0004, now + 2.35);
        drone.connect(dg);
        dg.connect(heartBus);
        drone.start(now);
        drone.stop(now + 2.4);

        const cycles = [
          { t: 0.0, strong: true },
          { t: 0.24, strong: false },
          { t: 0.96, strong: true },
          { t: 1.2, strong: false },
        ];
        cycles.forEach(({ t, strong }) => {
          const bt = now + t;
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.setValueAtTime(strong ? 115 : 95, bt);

          osc.type = 'sine';
          osc.frequency.setValueAtTime(strong ? 72 : 56, bt);
          osc.frequency.exponentialRampToValueAtTime(26, bt + 0.2);

          g.gain.setValueAtTime(0.0001, bt);
          g.gain.linearRampToValueAtTime(strong ? 0.98 : 0.72, bt + 0.018);
          g.gain.exponentialRampToValueAtTime(0.0005, bt + 0.24);

          osc.connect(lp);
          lp.connect(g);
          g.connect(heartBus);
          osc.start(bt);
          osc.stop(bt + 0.26);

          // Sopro abafado de sangue/peito
          playNoiseBurst(ctx, noise.brown, bt, 0.16, {
            filterType: 'lowpass',
            freqStart: 130,
            freqEnd: 55,
            gainPeak: strong ? 0.32 : 0.22,
            attack: 0.02,
            out: heartBus,
          });
        });
        break;
      }

      case 'wolf_howl': {
        // Uivo noturno autêntico na floresta/montanha com formantes vocais, vibrato natural e eco amplo
        const wolfBus = ctx.createGain();
        connectBus(wolfBus, { dry: 0.75, hall: 0.95 });

        const voiceIn = ctx.createGain();
        voiceIn.gain.setValueAtTime(0.0001, now);
        voiceIn.gain.linearRampToValueAtTime(0.75, now + 0.45);
        voiceIn.gain.setValueAtTime(0.68, now + 1.55);
        voiceIn.gain.exponentialRampToValueAtTime(0.0004, now + 2.65);

        // Formantes vocais caninos
        [
          { freq: 520, q: 3.4, gain: 0.65 },
          { freq: 1180, q: 4.0, gain: 0.35 },
        ].forEach((fm) => {
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.setValueAtTime(fm.freq, now);
          bp.frequency.linearRampToValueAtTime(fm.freq * 1.18, now + 0.7);
          bp.frequency.exponentialRampToValueAtTime(fm.freq * 0.82, now + 2.5);
          bp.Q.setValueAtTime(fm.q, now);
          const g = ctx.createGain();
          g.gain.setValueAtTime(fm.gain, now);
          voiceIn.connect(bp);
          bp.connect(g);
          g.connect(wolfBus);
        });

        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(215, now);
        osc.frequency.exponentialRampToValueAtTime(555, now + 0.65);
        osc.frequency.linearRampToValueAtTime(530, now + 1.45);
        osc.frequency.exponentialRampToValueAtTime(265, now + 2.55);

        // Vibrato orgânico suave na sustentação do uivo
        const vib = ctx.createOscillator();
        const vibGain = ctx.createGain();
        vib.type = 'sine';
        vib.frequency.setValueAtTime(5.3, now);
        vibGain.gain.setValueAtTime(0, now);
        vibGain.gain.linearRampToValueAtTime(11, now + 0.75);
        vibGain.gain.linearRampToValueAtTime(3, now + 2.4);
        vib.connect(vibGain);
        vibGain.connect(osc.frequency);

        const lpSoft = ctx.createBiquadFilter();
        lpSoft.type = 'lowpass';
        lpSoft.frequency.setValueAtTime(1350, now);
        osc.connect(lpSoft);
        lpSoft.connect(voiceIn);

        osc.start(now);
        vib.start(now);
        osc.stop(now + 2.7);
        vib.stop(now + 2.7);

        // Ar / sopro do uivo
        playNoiseBurst(ctx, noise.pink, now + 0.1, 2.2, {
          filterType: 'bandpass',
          freqStart: 900,
          freqEnd: 500,
          q: 3.5,
          gainPeak: 0.16,
          attack: 0.35,
          out: wolfBus,
        });
        break;
      }

      case 'chest_open': {
        // 1. Fechadura destravando -> 2. Tampa de madeira abrindo -> 3. Fanfarra calorosa de tesouro RPG
        const chestBus = ctx.createGain();
        connectBus(chestBus, { dry: 0.85, hall: 0.75, room: 0.35 });

        // Estalo metálico do cadeado
        [1480, 2640].forEach((f) => {
          const lock = ctx.createOscillator();
          const lg = ctx.createGain();
          lock.type = 'triangle';
          lock.frequency.setValueAtTime(f, now);
          lg.gain.setValueAtTime(0.24, now);
          lg.gain.exponentialRampToValueAtTime(0.0005, now + 0.08);
          lock.connect(lg);
          lg.connect(chestBus);
          lock.start(now);
          lock.stop(now + 0.1);
        });

        // Pequeno ranger curto da tampa (0.10s -> 0.38s)
        for (let i = 0; i < 8; i += 1) {
          const t = now + 0.1 + i * 0.032;
          const o = ctx.createOscillator();
          const bp = ctx.createBiquadFilter();
          const g = ctx.createGain();
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(210 + i * 24, t);
          bp.type = 'bandpass';
          bp.frequency.setValueAtTime(680, t);
          bp.Q.setValueAtTime(6, t);
          g.gain.setValueAtTime(0.22, t);
          g.gain.exponentialRampToValueAtTime(0.0005, t + 0.04);
          o.connect(bp);
          bp.connect(g);
          g.connect(chestBus);
          o.start(t);
          o.stop(t + 0.045);
        }

        // Acorde épico de tesouro descoberto (arpejo dourado em estéreo + brilho de moedas)
        const revealT = now + 0.34;
        const notes = [261.63, 392.0, 523.25, 659.25, 783.99, 987.77, 1046.5];
        notes.forEach((f, idx) => {
          const t = revealT + idx * 0.062;
          const pan = createPanner(ctx, -0.45 + (idx / (notes.length - 1)) * 0.9);
          pan.connect(chestBus);

          const o1 = ctx.createOscillator();
          const o2 = ctx.createOscillator();
          const g = ctx.createGain();
          o1.type = 'triangle';
          o2.type = 'sine';
          o1.frequency.setValueAtTime(f, t);
          o2.frequency.setValueAtTime(f * 2, t);

          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.22, t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0003, t + 1.15);

          o1.connect(g);
          o2.connect(g);
          g.connect(pan);
          o1.start(t);
          o2.start(t);
          o1.stop(t + 1.2);
          o2.stop(t + 1.2);
        });
        break;
      }

      case 'whisper': {
        // Sussurro privado etéreo e elegante (sopro suave + 2 notas vítreas discretas)
        const wspBus = ctx.createGain();
        connectBus(wspBus, { dry: 0.72, hall: 0.82 });

        playNoiseBurst(ctx, noise.pink, now, 0.85, {
          filterType: 'bandpass',
          freqStart: 1550,
          freqEnd: 720,
          q: 4.5,
          gainPeak: 0.16,
          attack: 0.18,
          pan: -0.25,
          out: wspBus,
        });

        [
          { t: 0.05, f: 659.25, pan: -0.3 },
          { t: 0.21, f: 987.77, pan: 0.3 },
        ].forEach(({ t, f, pan }) => {
          const p = createPanner(ctx, pan);
          p.connect(wspBus);
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now + t);
          g.gain.setValueAtTime(0.0001, now + t);
          g.gain.linearRampToValueAtTime(0.14, now + t + 0.03);
          g.gain.exponentialRampToValueAtTime(0.0003, now + t + 0.85);
          osc.connect(g);
          g.connect(p);
          osc.start(now + t);
          osc.stop(now + t + 0.9);
        });
        break;
      }

      case 'sfx_test': {
        // Preview limpo para testar o volume de Efeitos Sonoros localmente
        const testBus = ctx.createGain();
        connectBus(testBus, { dry: 0.85, room: 0.45 });

        [587.33, 880.0].forEach((f, idx) => {
          const t = now + idx * 0.09;
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, t);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.24, t + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0003, t + 0.38);
          osc.connect(g);
          g.connect(testBus);
          osc.start(t);
          osc.stop(t + 0.42);
        });
        break;
      }

      default:
        return false;
    }

    return true;
  } catch {
    return false;
  }
}
