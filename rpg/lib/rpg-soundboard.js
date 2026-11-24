'use client';

/**
 * Soundboard Procedural de Efeitos Sonoros Rápidos de RPG (Web Audio API)
 *
 * 100% autônomo: síntese em tempo real com osciladores, filtros ressonantes,
 * ruído colorido e envelopes dinâmicos (zero arquivos MP3 externos, zero 404, latência zero).
 * Respeita o volume local e o estado de mudo do dispositivo do usuário.
 */

export const SOUNDBOARD_EFFECTS = [
  { id: 'thunder', label: 'Trovão', shortLabel: 'Trovão', color: '#38bdf8', icon: 'CloudLightning' },
  { id: 'creaky_door', label: 'Porta Rangendo', shortLabel: 'Porta', color: '#d97706', icon: 'DoorOpen' },
  { id: 'sword', label: 'Espada / Golpe', shortLabel: 'Espada', color: '#cbd5e1', icon: 'Swords' },
  { id: 'roar', label: 'Rugido de Fera', shortLabel: 'Rugido', color: '#ef4444', icon: 'Skull' },
  { id: 'coins', label: 'Moedas de Ouro', shortLabel: 'Moedas', color: '#fbbf24', icon: 'Coins' },
  { id: 'tavern_bell', label: 'Sino da Taverna', shortLabel: 'Sino', color: '#f59e0b', icon: 'Bell' },
  { id: 'magic', label: 'Magia Arcana', shortLabel: 'Magia', color: '#a855f7', icon: 'Zap' },
  { id: 'arrow', label: 'Flecha Disparada', shortLabel: 'Flecha', color: '#34d399', icon: 'Wind' },
  { id: 'explosion', label: 'Explosão / Fogo', shortLabel: 'Explosão', color: '#f97316', icon: 'Flame' },
  { id: 'heartbeat', label: 'Suspense / Pulso', shortLabel: 'Pulso', color: '#f43f5e', icon: 'HeartPulse' },
  { id: 'wolf_howl', label: 'Uivo Sombrio', shortLabel: 'Uivo', color: '#60a5fa', icon: 'Ghost' },
  { id: 'chest_open', label: 'Baú / Tesouro', shortLabel: 'Tesouro', color: '#eab308', icon: 'Gift' },
];

let sfxCtx = null;

function getSfxContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sfxCtx) sfxCtx = new AudioCtx();
  if (sfxCtx.state === 'suspended') {
    sfxCtx.resume().catch(() => {});
  }
  return sfxCtx;
}

function createNoiseBuffer(ctx, durationSec = 2.0) {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export function playSoundboardEffect(sfxId, volume = 0.75, muted = false) {
  if (muted || volume <= 0.01) return false;
  try {
    const ctx = getSfxContext();
    if (!ctx) return false;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    const safeVol = Math.max(0.05, Math.min(1, Number(volume) || 0.75));
    master.gain.setValueAtTime(safeVol * 0.85, now);
    master.connect(ctx.destination);

    switch (sfxId) {
      case 'thunder': {
        // Estalo agudo inicial do raio + trovão grave prolongado com modulação
        const crackNoise = ctx.createBufferSource();
        crackNoise.buffer = createNoiseBuffer(ctx, 0.35);
        const crackFilter = ctx.createBiquadFilter();
        crackFilter.type = 'bandpass';
        crackFilter.frequency.setValueAtTime(1800, now);
        crackFilter.Q.setValueAtTime(0.8, now);
        const crackGain = ctx.createGain();
        crackGain.gain.setValueAtTime(0.75, now);
        crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        crackNoise.connect(crackFilter);
        crackFilter.connect(crackGain);
        crackGain.connect(master);
        crackNoise.start(now);
        crackNoise.stop(now + 0.34);

        const rumble = ctx.createBufferSource();
        rumble.buffer = createNoiseBuffer(ctx, 2.8);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(260, now);
        lp.frequency.exponentialRampToValueAtTime(65, now + 2.5);
        const rGain = ctx.createGain();
        rGain.gain.setValueAtTime(0.01, now);
        rGain.gain.linearRampToValueAtTime(0.95, now + 0.14);
        rGain.gain.setValueAtTime(0.65, now + 0.65);
        rGain.gain.linearRampToValueAtTime(0.8, now + 0.95);
        rGain.gain.exponentialRampToValueAtTime(0.001, now + 2.7);
        rumble.connect(lp);
        lp.connect(rGain);
        rGain.connect(master);
        rumble.start(now + 0.04);
        rumble.stop(now + 2.75);
        break;
      }

      case 'creaky_door': {
        // Rangido de dobradiça de madeira/ferro + batida seca no final
        const osc = ctx.createOscillator();
        const mod = ctx.createOscillator();
        const modGain = ctx.createGain();
        const bp = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(195, now);
        osc.frequency.linearRampToValueAtTime(340, now + 0.45);
        osc.frequency.linearRampToValueAtTime(245, now + 0.95);
        osc.frequency.linearRampToValueAtTime(410, now + 1.35);

        mod.type = 'sine';
        mod.frequency.setValueAtTime(28, now);
        mod.frequency.linearRampToValueAtTime(14, now + 1.3);
        modGain.gain.setValueAtTime(42, now);
        mod.connect(modGain);
        modGain.connect(osc.frequency);

        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(920, now);
        bp.Q.setValueAtTime(6.5, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.45, now + 0.15);
        gain.gain.linearRampToValueAtTime(0.28, now + 0.7);
        gain.gain.linearRampToValueAtTime(0.4, now + 1.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.45);

        osc.connect(bp);
        bp.connect(gain);
        gain.connect(master);
        osc.start(now);
        mod.start(now);
        osc.stop(now + 1.5);
        mod.stop(now + 1.5);

        // Batida de madeira pesada fechando
        const thud = ctx.createOscillator();
        const thudGain = ctx.createGain();
        thud.type = 'triangle';
        thud.frequency.setValueAtTime(110, now + 1.38);
        thud.frequency.exponentialRampToValueAtTime(38, now + 1.58);
        thudGain.gain.setValueAtTime(0.6, now + 1.38);
        thudGain.gain.exponentialRampToValueAtTime(0.001, now + 1.62);
        thud.connect(thudGain);
        thudGain.connect(master);
        thud.start(now + 1.38);
        thud.stop(now + 1.65);
        break;
      }

      case 'sword': {
        // Impacto metálico de aço + ressonância brilhante de lâmina
        const partials = [1180, 1890, 2740, 3920, 5210];
        partials.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
          osc.frequency.setValueAtTime(freq, now);
          osc.frequency.exponentialRampToValueAtTime(freq * 0.96, now + 0.55);
          g.gain.setValueAtTime(0.28 / (idx * 0.5 + 1), now);
          g.gain.exponentialRampToValueAtTime(0.0008, now + 0.45 + idx * 0.08);
          osc.connect(g);
          g.connect(master);
          osc.start(now);
          osc.stop(now + 0.9);
        });

        const clash = ctx.createBufferSource();
        clash.buffer = createNoiseBuffer(ctx, 0.22);
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(2400, now);
        const cGain = ctx.createGain();
        cGain.gain.setValueAtTime(0.65, now);
        cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        clash.connect(hp);
        hp.connect(cGain);
        cGain.connect(master);
        clash.start(now);
        clash.stop(now + 0.2);
        break;
      }

      case 'roar': {
        // Rugido gutural de dragão/monstro (sub-sawtooth + formante bandpass + ruído áspero)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(118, now);
        osc1.frequency.linearRampToValueAtTime(155, now + 0.28);
        osc1.frequency.exponentialRampToValueAtTime(52, now + 1.85);

        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(84, now);
        osc2.frequency.linearRampToValueAtTime(108, now + 0.3);
        osc2.frequency.exponentialRampToValueAtTime(38, now + 1.85);

        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(26, now);
        lfoGain.gain.setValueAtTime(22, now);
        lfo.connect(lfoGain);
        lfoGain.connect(osc1.frequency);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(480, now);
        filter.frequency.linearRampToValueAtTime(760, now + 0.35);
        filter.frequency.exponentialRampToValueAtTime(190, now + 1.85);
        filter.Q.setValueAtTime(1.8, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.75, now + 0.18);
        gain.gain.setValueAtTime(0.68, now + 0.8);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.9);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(master);

        const breath = ctx.createBufferSource();
        breath.buffer = createNoiseBuffer(ctx, 1.8);
        const bFilter = ctx.createBiquadFilter();
        bFilter.type = 'bandpass';
        bFilter.frequency.setValueAtTime(620, now);
        const bGain = ctx.createGain();
        bGain.gain.setValueAtTime(0.001, now);
        bGain.gain.linearRampToValueAtTime(0.32, now + 0.25);
        bGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
        breath.connect(bFilter);
        bFilter.connect(bGain);
        bGain.connect(master);

        osc1.start(now);
        osc2.start(now);
        lfo.start(now);
        breath.start(now);
        osc1.stop(now + 1.95);
        osc2.stop(now + 1.95);
        lfo.stop(now + 1.95);
        breath.stop(now + 1.85);
        break;
      }

      case 'coins': {
        // Cascata de moedas de ouro tilintando
        const clinks = [
          { t: 0.0, f: 2680 },
          { t: 0.055, f: 3420 },
          { t: 0.11, f: 2950 },
          { t: 0.175, f: 3890 },
          { t: 0.24, f: 3180 },
          { t: 0.31, f: 4120 },
          { t: 0.39, f: 3560 },
        ];
        clinks.forEach(({ t, f }) => {
          const o1 = ctx.createOscillator();
          const o2 = ctx.createOscillator();
          const g = ctx.createGain();
          o1.type = 'sine';
          o2.type = 'triangle';
          o1.frequency.setValueAtTime(f, now + t);
          o2.frequency.setValueAtTime(f * 1.48, now + t);
          g.gain.setValueAtTime(0.001, now + t);
          g.gain.linearRampToValueAtTime(0.24, now + t + 0.006);
          g.gain.exponentialRampToValueAtTime(0.0008, now + t + 0.28);
          o1.connect(g);
          o2.connect(g);
          g.connect(master);
          o1.start(now + t);
          o2.start(now + t);
          o1.stop(now + t + 0.3);
          o2.stop(now + t + 0.3);
        });
        break;
      }

      case 'tavern_bell': {
        // Sino de bronze de taverna com harmônicos ricos e cauda longa
        const bellPartials = [
          { freq: 587.33, amp: 0.38, dur: 2.2 },
          { freq: 1174.66, amp: 0.22, dur: 1.7 },
          { freq: 1480.0, amp: 0.15, dur: 1.3 },
          { freq: 2349.32, amp: 0.1, dur: 0.9 },
          { freq: 3120.0, amp: 0.07, dur: 0.55 },
        ];
        bellPartials.forEach(({ freq, amp, dur }) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);
          g.gain.setValueAtTime(0.001, now);
          g.gain.linearRampToValueAtTime(amp, now + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0008, now + dur);
          osc.connect(g);
          g.connect(master);
          osc.start(now);
          osc.stop(now + dur + 0.05);
        });
        break;
      }

      case 'magic': {
        // Onda arcana ascendente com cintilação harmônica
        const notes = [392, 493.88, 587.33, 783.99, 987.77, 1174.66, 1567.98];
        notes.forEach((freq, idx) => {
          const t = now + idx * 0.06;
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
          osc.frequency.setValueAtTime(freq, t);
          osc.frequency.exponentialRampToValueAtTime(freq * 1.04, t + 0.55);
          g.gain.setValueAtTime(0.001, t);
          g.gain.linearRampToValueAtTime(0.22, t + 0.03);
          g.gain.exponentialRampToValueAtTime(0.0008, t + 0.65);
          osc.connect(g);
          g.connect(master);
          osc.start(t);
          osc.stop(t + 0.7);
        });
        break;
      }

      case 'arrow': {
        // Corda do arco + sibilo no ar + impacto seco
        const twang = ctx.createOscillator();
        const tGain = ctx.createGain();
        twang.type = 'triangle';
        twang.frequency.setValueAtTime(240, now);
        twang.frequency.exponentialRampToValueAtTime(95, now + 0.11);
        tGain.gain.setValueAtTime(0.35, now);
        tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        twang.connect(tGain);
        tGain.connect(master);
        twang.start(now);
        twang.stop(now + 0.14);

        const whoosh = ctx.createBufferSource();
        whoosh.buffer = createNoiseBuffer(ctx, 0.35);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(2800, now + 0.03);
        bp.frequency.exponentialRampToValueAtTime(650, now + 0.3);
        bp.Q.setValueAtTime(2.5, now);
        const wGain = ctx.createGain();
        wGain.gain.setValueAtTime(0.001, now + 0.03);
        wGain.gain.linearRampToValueAtTime(0.48, now + 0.1);
        wGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        whoosh.connect(bp);
        bp.connect(wGain);
        wGain.connect(master);
        whoosh.start(now + 0.03);
        whoosh.stop(now + 0.34);

        const hit = ctx.createOscillator();
        const hGain = ctx.createGain();
        hit.type = 'sine';
        hit.frequency.setValueAtTime(160, now + 0.28);
        hit.frequency.exponentialRampToValueAtTime(52, now + 0.38);
        hGain.gain.setValueAtTime(0.55, now + 0.28);
        hGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        hit.connect(hGain);
        hGain.connect(master);
        hit.start(now + 0.28);
        hit.stop(now + 0.42);
        break;
      }

      case 'explosion': {
        // Impacto grave de Bola de Fogo + onda de choque
        const sub = ctx.createOscillator();
        const subGain = ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(130, now);
        sub.frequency.exponentialRampToValueAtTime(28, now + 0.9);
        subGain.gain.setValueAtTime(0.95, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
        sub.connect(subGain);
        subGain.connect(master);
        sub.start(now);
        sub.stop(now + 1.15);

        const blast = ctx.createBufferSource();
        blast.buffer = createNoiseBuffer(ctx, 1.8);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(1200, now);
        lp.frequency.exponentialRampToValueAtTime(110, now + 1.65);
        const bGain = ctx.createGain();
        bGain.gain.setValueAtTime(0.9, now);
        bGain.gain.exponentialRampToValueAtTime(0.001, now + 1.75);
        blast.connect(lp);
        lp.connect(bGain);
        bGain.connect(master);
        blast.start(now);
        blast.stop(now + 1.8);
        break;
      }

      case 'heartbeat': {
        // Batimento duplo tenso (lub-dub ... lub-dub)
        const beats = [0.0, 0.22, 0.95, 1.17];
        beats.forEach((offset, idx) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          const peak = idx % 2 === 0 ? 74 : 58;
          osc.frequency.setValueAtTime(peak, now + offset);
          osc.frequency.exponentialRampToValueAtTime(30, now + offset + 0.18);
          g.gain.setValueAtTime(0.001, now + offset);
          g.gain.linearRampToValueAtTime(idx % 2 === 0 ? 0.85 : 0.6, now + offset + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.22);
          osc.connect(g);
          g.connect(master);
          osc.start(now + offset);
          osc.stop(now + offset + 0.25);
        });
        break;
      }

      case 'wolf_howl': {
        // Uivo fantasmagórico longo na noite
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(290, now);
        osc.frequency.exponentialRampToValueAtTime(540, now + 0.55);
        osc.frequency.linearRampToValueAtTime(495, now + 1.15);
        osc.frequency.exponentialRampToValueAtTime(245, now + 2.1);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(620, now);
        filter.Q.setValueAtTime(3.2, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.55, now + 0.4);
        gain.gain.setValueAtTime(0.48, now + 1.2);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        osc.start(now);
        osc.stop(now + 2.25);
        break;
      }

      case 'chest_open': {
        // Ranger curto da tampa + acorde cintilante de tesouro descoberto
        const notes = [440, 554.37, 659.25, 880, 1108.73];
        notes.forEach((f, idx) => {
          const t = now + idx * 0.075;
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, t);
          g.gain.setValueAtTime(0.001, t);
          g.gain.linearRampToValueAtTime(0.24, t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0008, t + 0.72);
          osc.connect(g);
          g.connect(master);
          osc.start(t);
          osc.stop(t + 0.78);
        });
        break;
      }

      case 'whisper': {
        // Sopro etéreo discreto para sussurros privados do Mestre
        const noise = ctx.createBufferSource();
        noise.buffer = createNoiseBuffer(ctx, 0.9);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(1400, now);
        bp.frequency.exponentialRampToValueAtTime(750, now + 0.85);
        bp.Q.setValueAtTime(4.0, now);
        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(0.001, now);
        nGain.gain.linearRampToValueAtTime(0.18, now + 0.18);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.88);
        noise.connect(bp);
        bp.connect(nGain);
        nGain.connect(master);
        noise.start(now);
        noise.stop(now + 0.9);

        const chime = ctx.createOscillator();
        const cGain = ctx.createGain();
        chime.type = 'sine';
        chime.frequency.setValueAtTime(659.25, now + 0.05);
        chime.frequency.exponentialRampToValueAtTime(987.77, now + 0.45);
        cGain.gain.setValueAtTime(0.001, now + 0.05);
        cGain.gain.linearRampToValueAtTime(0.14, now + 0.12);
        cGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.75);
        chime.connect(cGain);
        cGain.connect(master);
        chime.start(now + 0.05);
        chime.stop(now + 0.8);
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
