'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import {
  DEFAULT_RPG_PLAYLIST,
  RpgSynthEngine,
  extractYouTubeVideoId,
} from '../../lib/rpg-music-synth';
import { playSoundboardEffect } from '../../lib/rpg-soundboard';
import {
  deleteTableAudioTrackChunks,
  loadTableAudioTrackUrl,
  saveTableAudioState,
  subscribeTableAudio,
  uploadTableAudioTrackFile,
} from '../../lib/rpg-service';
import { TabletopMusicPanel } from './TabletopMusicWidget';

const TabletopMusicContext = createContext(null);

const VOLUME_STORAGE_KEY = 'vallen_rpg_music_volume';
const MUTED_STORAGE_KEY = 'vallen_rpg_music_muted';
const SFX_VOLUME_STORAGE_KEY = 'vallen_rpg_sfx_volume';
const SFX_MUTED_STORAGE_KEY = 'vallen_rpg_sfx_muted';

// Carregador singleton da YouTube IFrame Player API
let ytApiPromise = null;
function loadYouTubeIframeApi() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve) => {
    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prevReady === 'function') {
        try {
          prevReady();
        } catch {}
      }
      resolve(window.YT || null);
    };

    const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      tag.onerror = () => resolve(null);
      document.head.appendChild(tag);
    }

    // Timeout de segurança caso bloqueador de scripts impeça o carregamento
    setTimeout(() => {
      if (window.YT && window.YT.Player) {
        resolve(window.YT);
      } else {
        resolve(null);
      }
    }, 10000);
  });

  return ytApiPromise;
}

export function useTabletopMusic() {
  return useContext(TabletopMusicContext);
}

export function TabletopMusicProvider({
  enabled = true,
  isMaster = false,
  userId = null,
  userName = '',
  children,
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [storageMode, setStorageMode] = useState('collection');
  const storageModeRef = useRef('collection');

  // Estado sincronizado da mesa (Firestore)
  const [audioState, setAudioState] = useState(() => ({
    playlist: DEFAULT_RPG_PLAYLIST,
    currentTrackId: DEFAULT_RPG_PLAYLIST[0].id,
    currentIndex: 0,
    isPlaying: false,
    basePositionSec: 0,
    anchorClientMs: null,
    serverUpdatedAtMs: null,
    loopMode: 'playlist', // 'playlist' | 'one'
    shuffle: false,
    syncVersion: 0,
    lastSfx: null,
    updatedBy: null,
    updatedByName: null,
  }));
  const audioStateRef = useRef(audioState);
  audioStateRef.current = audioState;

  // Preferências locais independentes de Música e Efeitos Sonoros (persistem em localStorage)
  const [volume, setVolumeState] = useState(0.65);
  const [isMuted, setIsMutedState] = useState(false);
  const volumeRef = useRef(0.65);
  const isMutedRef = useRef(false);

  const [sfxVolume, setSfxVolumeState] = useState(0.8);
  const [sfxMuted, setSfxMutedState] = useState(false);
  const sfxVolumeRef = useRef(0.8);
  const sfxMutedRef = useRef(false);

  // Estado local do player em tempo real
  const [currentTime, setCurrentTime] = useState(0);
  const [liveDuration, setLiveDuration] = useState(DEFAULT_RPG_PLAYLIST[0].duration || 180);
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [loadingTrack, setLoadingTrack] = useState(false);
  const [playbackError, setPlaybackError] = useState(null);

  // Calibração de relógio com o servidor para sincronização precisa entre PCs diferentes
  const clockOffsetRef = useRef(0);

  // Referências dos 3 motores de reprodução (Synth, HTML5 Audio, YouTube IFrame)
  const synthRef = useRef(null);
  const htmlAudioRef = useRef(null);
  const ytContainerRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const ytReadyRef = useRef(false);
  const ytInitPromiseRef = useRef(null);
  const ytLoadedVideoIdRef = useRef(null);
  const loadedHtmlTrackKeyRef = useRef(null);
  const lastAppliedSyncKeyRef = useRef('');
  const advancingTrackRef = useRef(false);
  const lastPlayedSfxIdRef = useRef(null);
  const sfxInitialSeededRef = useRef(false);
  const isMasterRef = useRef(isMaster);
  isMasterRef.current = isMaster;

  // Carrega volumes independentes (Música e Efeitos Sonoros) do localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedVol = Number(window.localStorage.getItem(VOLUME_STORAGE_KEY));
      if (Number.isFinite(savedVol) && savedVol >= 0 && savedVol <= 1) {
        setVolumeState(savedVol);
        volumeRef.current = savedVol;
      }
      const savedMuted = window.localStorage.getItem(MUTED_STORAGE_KEY);
      if (savedMuted === 'true') {
        setIsMutedState(true);
        isMutedRef.current = true;
      }
      const savedSfxVol = Number(window.localStorage.getItem(SFX_VOLUME_STORAGE_KEY));
      if (Number.isFinite(savedSfxVol) && savedSfxVol >= 0 && savedSfxVol <= 1) {
        setSfxVolumeState(savedSfxVol);
        sfxVolumeRef.current = savedSfxVol;
      }
      const savedSfxMuted = window.localStorage.getItem(SFX_MUTED_STORAGE_KEY);
      if (savedSfxMuted === 'true') {
        setSfxMutedState(true);
        sfxMutedRef.current = true;
      }
    } catch {}
  }, []);

  // Calibra offset de relógio com `/api/server-time` ao montar
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    let cancelled = false;
    const calibrate = async () => {
      try {
        const t0 = Date.now();
        const res = await fetch('/api/server-time', { cache: 'no-store' });
        const t1 = Date.now();
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (Number.isFinite(Number(data?.now))) {
          const mid = (t0 + t1) / 2;
          clockOffsetRef.current = Number(data.now) - mid;
        }
      } catch {}
    };
    calibrate();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // Faixa ativa derivada da playlist
  const currentTrack = useMemo(() => {
    const list = audioState.playlist || [];
    if (list.length === 0) return null;
    if (audioState.currentTrackId) {
      const found = list.find((t) => t.id === audioState.currentTrackId);
      if (found) return found;
    }
    const idx = Math.max(0, Math.min(list.length - 1, Number(audioState.currentIndex) || 0));
    return list[idx] || list[0];
  }, [audioState.playlist, audioState.currentTrackId, audioState.currentIndex]);

  const currentTrackRef = useRef(currentTrack);
  currentTrackRef.current = currentTrack;

  const currentIndex = useMemo(() => {
    const list = audioState.playlist || [];
    if (!currentTrack || list.length === 0) return -1;
    const idx = list.findIndex((t) => t.id === currentTrack.id);
    return idx >= 0 ? idx : 0;
  }, [audioState.playlist, currentTrack]);

  // Calcula o segundo exato sincronizado no relógio global da mesa
  const computeTargetPositionSec = useCallback((st = audioStateRef.current, track = currentTrackRef.current) => {
    if (!st) return 0;
    const base = Math.max(0, Number(st.basePositionSec) || 0);
    if (!st.isPlaying) return base;

    const nowSyncedMs = Date.now() + clockOffsetRef.current;
    const anchorMs = st.serverUpdatedAtMs || st.anchorClientMs || nowSyncedMs;
    const elapsedSec = Math.max(0, (nowSyncedMs - anchorMs) / 1000);
    let target = base + elapsedSec;

    const dur = Number(track?.duration) || 0;
    if (dur > 0 && target >= dur) {
      if (st.loopMode === 'one') {
        target = target % dur;
      } else {
        target = Math.min(dur, target);
      }
    }
    return target;
  }, []);

  // Aplica volume local em todos os motores ativos
  const applyLocalVolumeToEngines = useCallback((vol, muted) => {
    const safeVol = Math.max(0, Math.min(1, Number(vol) || 0));
    const effective = muted ? 0 : safeVol;

    if (synthRef.current) {
      synthRef.current.setVolume(safeVol, muted);
    }
    if (htmlAudioRef.current) {
      htmlAudioRef.current.volume = effective;
      htmlAudioRef.current.muted = Boolean(muted);
    }
    if (ytPlayerRef.current && ytReadyRef.current) {
      try {
        if (muted || safeVol <= 0.001) {
          ytPlayerRef.current.mute?.();
          ytPlayerRef.current.setVolume?.(0);
        } else {
          ytPlayerRef.current.unMute?.();
          ytPlayerRef.current.setVolume?.(Math.round(safeVol * 100));
        }
      } catch {}
    }
  }, []);

  const setVolume = useCallback(
    (nextVol) => {
      const clamped = Math.max(0, Math.min(1, Math.round(Number(nextVol) * 100) / 100));
      setVolumeState(clamped);
      volumeRef.current = clamped;
      if (clamped > 0 && isMutedRef.current) {
        setIsMutedState(false);
        isMutedRef.current = false;
        try {
          window.localStorage.setItem(MUTED_STORAGE_KEY, 'false');
        } catch {}
      }
      try {
        window.localStorage.setItem(VOLUME_STORAGE_KEY, String(clamped));
      } catch {}
      applyLocalVolumeToEngines(clamped, clamped === 0 ? true : false);
    },
    [applyLocalVolumeToEngines]
  );

  const toggleMute = useCallback(() => {
    const nextMuted = !isMutedRef.current;
    setIsMutedState(nextMuted);
    isMutedRef.current = nextMuted;
    try {
      window.localStorage.setItem(MUTED_STORAGE_KEY, String(nextMuted));
    } catch {}
    applyLocalVolumeToEngines(volumeRef.current, nextMuted);
  }, [applyLocalVolumeToEngines]);

  // Canal independente de volume para Efeitos Sonoros (Soundboard, Sussurros, Baús)
  const setSfxVolume = useCallback((nextVol) => {
    const clamped = Math.max(0, Math.min(1, Math.round(Number(nextVol) * 100) / 100));
    setSfxVolumeState(clamped);
    sfxVolumeRef.current = clamped;
    if (clamped > 0 && sfxMutedRef.current) {
      setSfxMutedState(false);
      sfxMutedRef.current = false;
      try {
        window.localStorage.setItem(SFX_MUTED_STORAGE_KEY, 'false');
      } catch {}
    }
    try {
      window.localStorage.setItem(SFX_VOLUME_STORAGE_KEY, String(clamped));
    } catch {}
  }, []);

  const toggleSfxMute = useCallback(() => {
    const nextMuted = !sfxMutedRef.current;
    setSfxMutedState(nextMuted);
    sfxMutedRef.current = nextMuted;
    try {
      window.localStorage.setItem(SFX_MUTED_STORAGE_KEY, String(nextMuted));
    } catch {}
  }, []);

  const previewSfxVolume = useCallback(() => {
    playSoundboardEffect('sfx_test', sfxVolumeRef.current, sfxMutedRef.current);
  }, []);

  // Para todos os motores que não estão sendo usados pela faixa atual
  const stopInactiveEngines = useCallback((activeType) => {
    if (activeType !== 'synth' && synthRef.current) {
      synthRef.current.pause();
    }
    if (activeType !== 'html' && htmlAudioRef.current) {
      try {
        htmlAudioRef.current.pause();
      } catch {}
    }
    if (activeType !== 'youtube' && ytPlayerRef.current && ytReadyRef.current) {
      try {
        ytPlayerRef.current.pauseVideo?.();
      } catch {}
    }
  }, []);

  // Persiste alterações do Mestre no Firestore
  const commitMasterState = useCallback(
    async (patch, bumpSync = true) => {
      if (!isMasterRef.current) return;
      const cur = audioStateRef.current;
      const nextSyncVersion = bumpSync ? (cur.syncVersion || 0) + 1 : cur.syncVersion || 0;
      const nowSyncedMs = Date.now() + clockOffsetRef.current;

      const fullPatch = {
        ...patch,
        updatedBy: userId || null,
        updatedByName: userName || 'Mestre',
      };
      if (bumpSync) {
        fullPatch.syncVersion = nextSyncVersion;
        fullPatch.anchorClientMs = nowSyncedMs;
      }

      // Atualização otimista local para resposta instantânea ao clique do Mestre
      setAudioState((prev) => ({
        ...prev,
        ...fullPatch,
        serverUpdatedAtMs: bumpSync ? nowSyncedMs : prev.serverUpdatedAtMs,
      }));

      try {
        const res = await saveTableAudioState(fullPatch, storageModeRef.current);
        if (res?.storageMode && res.storageMode !== storageModeRef.current) {
          storageModeRef.current = res.storageMode;
          setStorageMode(res.storageMode);
        }
      } catch (err) {
        toast.error(err?.message || 'Erro ao sincronizar trilha sonora da mesa.');
      }
    },
    [userId, userName]
  );

  // Avança automaticamente quando uma música termina (executado pelo Mestre para manter todos juntos)
  const handleTrackNaturallyEnded = useCallback(() => {
    if (!isMasterRef.current || advancingTrackRef.current) return;
    const st = audioStateRef.current;
    const list = st.playlist || [];
    if (list.length === 0) return;

    advancingTrackRef.current = true;
    setTimeout(() => {
      advancingTrackRef.current = false;
    }, 1200);

    const curIdx = Math.max(
      0,
      list.findIndex((t) => t.id === st.currentTrackId)
    );

    if (st.loopMode === 'one') {
      commitMasterState(
        {
          currentTrackId: list[curIdx].id,
          currentIndex: curIdx,
          isPlaying: true,
          basePositionSec: 0,
        },
        true
      );
      return;
    }

    let nextIdx = (curIdx + 1) % list.length;
    if (st.shuffle && list.length > 1) {
      const candidates = list.map((_, i) => i).filter((i) => i !== curIdx);
      nextIdx = candidates[Math.floor(Math.random() * candidates.length)];
    }

    commitMasterState(
      {
        currentTrackId: list[nextIdx].id,
        currentIndex: nextIdx,
        isPlaying: true,
        basePositionSec: 0,
      },
      true
    );
  }, [commitMasterState]);

  const handleTrackEndedRef = useRef(handleTrackNaturallyEnded);
  handleTrackEndedRef.current = handleTrackNaturallyEnded;

  // Atualiza duração descoberta de uma faixa do YouTube ou URL no estado da playlist (Mestre)
  const persistDiscoveredDuration = useCallback(
    (trackId, discoveredSec) => {
      if (!trackId || !Number.isFinite(discoveredSec) || discoveredSec < 5) return;
      const rounded = Math.round(discoveredSec);
      setLiveDuration(rounded);
      if (!isMasterRef.current) return;

      const st = audioStateRef.current;
      const list = st.playlist || [];
      const target = list.find((t) => t.id === trackId);
      if (!target) return;
      if (Math.abs((Number(target.duration) || 0) - rounded) < 2) return;

      const nextList = list.map((t) => (t.id === trackId ? { ...t, duration: rounded } : t));
      commitMasterState({ playlist: nextList }, false);
    },
    [commitMasterState]
  );

  // Garante a criação da instância do YouTube Player sem corrida entre chamadas concorrentes
  const ensureYouTubePlayer = useCallback(async () => {
    if (ytPlayerRef.current && ytReadyRef.current) return ytPlayerRef.current;
    if (ytInitPromiseRef.current) return ytInitPromiseRef.current;

    ytInitPromiseRef.current = (async () => {
      const YT = await loadYouTubeIframeApi();
      if (!YT || !YT.Player || !ytContainerRef.current) {
        ytInitPromiseRef.current = null;
        return null;
      }

      return new Promise((resolve) => {
        let settled = false;
        const finish = (playerInstance) => {
          if (settled) return;
          settled = true;
          if (!playerInstance) {
            ytInitPromiseRef.current = null;
          }
          resolve(playerInstance);
        };

        try {
          const player = new YT.Player(ytContainerRef.current, {
            height: '120',
            width: '120',
            playerVars: {
              autoplay: 0,
              controls: 0,
              disablekb: 1,
              fs: 0,
              iv_load_policy: 3,
              modestbranding: 1,
              playsinline: 1,
              rel: 0,
              origin: typeof window !== 'undefined' ? window.location.origin : undefined,
            },
            events: {
              onReady: (ev) => {
                ytPlayerRef.current = ev.target;
                ytReadyRef.current = true;
                applyLocalVolumeToEngines(volumeRef.current, isMutedRef.current);
                finish(ev.target);
              },
              onStateChange: (ev) => {
                const stateCode = ev.data;
                if (stateCode === 1) {
                  // PLAYING
                  setNeedsUnlock(false);
                  setPlaybackError(null);
                  setLoadingTrack(false);
                  try {
                    const d = ev.target.getDuration?.();
                    if (d > 0 && currentTrackRef.current?.sourceType === 'youtube') {
                      persistDiscoveredDuration(currentTrackRef.current.id, d);
                    }
                  } catch {}
                } else if (stateCode === 0) {
                  // ENDED
                  handleTrackEndedRef.current?.();
                }
              },
              onError: (ev) => {
                setLoadingTrack(false);
                const code = ev?.data;
                const msg =
                  code === 101 || code === 150
                    ? 'Este vídeo do YouTube bloqueia reprodução incorporada. Tente outro vídeo.'
                    : 'Não foi possível reproduzir este vídeo do YouTube.';
                setPlaybackError(msg);
                if (isMasterRef.current) {
                  toast.error(msg);
                }
              },
            },
          });
          ytPlayerRef.current = player;
          setTimeout(() => {
            if (!ytReadyRef.current) finish(null);
          }, 10000);
        } catch {
          finish(null);
        }
      });
    })();

    return ytInitPromiseRef.current;
  }, [applyLocalVolumeToEngines, persistDiscoveredDuration]);

  // Sincroniza o motor de áudio com o estado atual da mesa (chamado em mudanças ou unlock)
  const syncEnginesWithState = useCallback(
    async (forceSeek = false) => {
      const st = audioStateRef.current;
      const track = currentTrackRef.current;
      if (!track) {
        stopInactiveEngines('none');
        setCurrentTime(0);
        setLiveDuration(0);
        return;
      }

      const targetSec = computeTargetPositionSec(st, track);
      setPlaybackError(null);
      if (track.duration > 0) {
        setLiveDuration(track.duration);
      }

      // 1. TRILHA PROCEDURAL NATIVA (Web Audio API)
      if (track.sourceType === 'synth') {
        stopInactiveEngines('synth');
        if (!synthRef.current) {
          synthRef.current = new RpgSynthEngine();
          synthRef.current.onEnded = () => handleTrackEndedRef.current?.();
        }
        const synth = synthRef.current;
        synth.setVolume(volumeRef.current, isMutedRef.current);
        const dur = track.duration || 180;
        setLiveDuration(dur);

        if (st.isPlaying) {
          setLoadingTrack(false);
          const started = await synth.play(track.synthId || 'tavern', targetSec, dur);
          if (!started) {
            setNeedsUnlock(true);
          } else {
            setNeedsUnlock(false);
          }
          setCurrentTime(targetSec);
        } else {
          synth.pause();
          synth.seek(targetSec);
          setCurrentTime(targetSec);
          setNeedsUnlock(false);
        }
        return;
      }

      // 2. YOUTUBE IFRAME PLAYER
      if (track.sourceType === 'youtube' && track.youtubeId) {
        stopInactiveEngines('youtube');
        setLoadingTrack(true);
        const player = await ensureYouTubePlayer();
        if (!player) {
          setLoadingTrack(false);
          setPlaybackError('API do YouTube indisponível neste navegador.');
          return;
        }

        applyLocalVolumeToEngines(volumeRef.current, isMutedRef.current);
        const isNewVideo = ytLoadedVideoIdRef.current !== track.youtubeId;
        ytLoadedVideoIdRef.current = track.youtubeId;

        try {
          if (st.isPlaying) {
            if (isNewVideo) {
              player.loadVideoById({ videoId: track.youtubeId, startSeconds: Math.floor(targetSec) });
            } else {
              if (forceSeek) {
                player.seekTo(targetSec, true);
              }
              player.playVideo();
            }
            setCurrentTime(targetSec);
            // Verifica após 900ms se o navegador bloqueou autoplay do YouTube
            setTimeout(() => {
              if (!audioStateRef.current?.isPlaying) return;
              if (currentTrackRef.current?.id !== track.id) return;
              try {
                const ytSt = player.getPlayerState?.();
                // -1 = unstarted, 2 = paused, 5 = cued
                if (ytSt === -1 || ytSt === 2 || ytSt === 5) {
                  setNeedsUnlock(true);
                }
              } catch {}
            }, 1100);
          } else {
            if (isNewVideo) {
              player.cueVideoById({ videoId: track.youtubeId, startSeconds: Math.floor(targetSec) });
            } else {
              player.pauseVideo();
              if (forceSeek) player.seekTo(targetSec, true);
            }
            setLoadingTrack(false);
            setCurrentTime(targetSec);
            setNeedsUnlock(false);
          }
        } catch {
          setLoadingTrack(false);
        }
        return;
      }

      // 3. ÁUDIO HTML5 (URL DIRETA OU UPLOAD DE ARQUIVO)
      if (track.sourceType === 'url' || track.sourceType === 'upload') {
        stopInactiveEngines('html');
        const audio = htmlAudioRef.current;
        if (!audio) return;

        applyLocalVolumeToEngines(volumeRef.current, isMutedRef.current);
        const trackKey = `${track.id}_${track.url || track.chunkCount || 'inline'}`;

        if (loadedHtmlTrackKeyRef.current !== trackKey) {
          setLoadingTrack(true);
          const resolvedUrl = await loadTableAudioTrackUrl(track);
          if (currentTrackRef.current?.id !== track.id) return;
          if (!resolvedUrl) {
            setLoadingTrack(false);
            setPlaybackError('Não foi possível carregar o arquivo de áudio.');
            return;
          }
          loadedHtmlTrackKeyRef.current = trackKey;
          audio.src = resolvedUrl;
          audio.load();
        }

        const applySeekAndPlay = async () => {
          try {
            if (Number.isFinite(audio.duration) && audio.duration > 0) {
              setLiveDuration(audio.duration);
              persistDiscoveredDuration(track.id, audio.duration);
            }
            const safeSeek =
              Number.isFinite(audio.duration) && audio.duration > 0
                ? Math.min(Math.max(0, targetSec), Math.max(0, audio.duration - 0.25))
                : Math.max(0, targetSec);

            if (forceSeek || Math.abs((audio.currentTime || 0) - safeSeek) > 1.2) {
              try {
                audio.currentTime = safeSeek;
              } catch {}
            }

            if (st.isPlaying) {
              try {
                await audio.play();
                setNeedsUnlock(false);
                setPlaybackError(null);
              } catch (playErr) {
                if (playErr?.name === 'NotAllowedError' || String(playErr?.message || '').toLowerCase().includes('interact')) {
                  setNeedsUnlock(true);
                } else {
                  setPlaybackError('Não foi possível reproduzir este link de áudio.');
                }
              }
            } else {
              audio.pause();
              setNeedsUnlock(false);
            }
          } finally {
            setLoadingTrack(false);
            setCurrentTime(targetSec);
          }
        };

        if (audio.readyState >= 1) {
          await applySeekAndPlay();
        } else {
          const onReady = () => {
            audio.removeEventListener('loadedmetadata', onReady);
            applySeekAndPlay();
          };
          audio.addEventListener('loadedmetadata', onReady);
        }
      }
    },
    [
      applyLocalVolumeToEngines,
      computeTargetPositionSec,
      ensureYouTubePlayer,
      persistDiscoveredDuration,
      stopInactiveEngines,
    ]
  );

  // Marca carregamento inicial do soundboard após 1.2s caso o documento ainda não exista
  useEffect(() => {
    if (!enabled) return undefined;
    const timer = setTimeout(() => {
      sfxInitialSeededRef.current = true;
    }, 1200);
    return () => clearTimeout(timer);
  }, [enabled]);

  // Subscrição em tempo real ao estado da mesa no Firestore
  useEffect(() => {
    if (!enabled) return undefined;

    const unsub = subscribeTableAudio(
      ({ exists, storageMode: nextMode, data }) => {
        if (nextMode) {
          storageModeRef.current = nextMode;
          setStorageMode(nextMode);
        }
        if (!exists || !data) {
          sfxInitialSeededRef.current = true;
          return;
        }

        // Disparo sincronizado de efeitos sonoros pontuais (Soundboard) sem interromper a trilha
        const incomingSfx = data.lastSfx;
        if (!sfxInitialSeededRef.current) {
          sfxInitialSeededRef.current = true;
          if (incomingSfx?.id) {
            lastPlayedSfxIdRef.current = incomingSfx.id;
          }
        } else if (incomingSfx?.id && incomingSfx.id !== lastPlayedSfxIdRef.current) {
          lastPlayedSfxIdRef.current = incomingSfx.id;
          const nowSyncedMs = Date.now() + clockOffsetRef.current;
          const triggeredAtMs = Number(incomingSfx.triggeredAtMs) || nowSyncedMs;
          if (Math.abs(nowSyncedMs - triggeredAtMs) <= 15000) {
            playSoundboardEffect(incomingSfx.sfxId, sfxVolumeRef.current, sfxMutedRef.current);
          }
        }

        setAudioState((prev) => {
          const nextPlaylist =
            Array.isArray(data.playlist) && data.playlist.length > 0
              ? data.playlist
              : prev.playlist;
          const nextTrackId =
            data.currentTrackId && nextPlaylist.some((t) => t.id === data.currentTrackId)
              ? data.currentTrackId
              : nextPlaylist[Math.max(0, Math.min(nextPlaylist.length - 1, data.currentIndex || 0))]?.id || null;

          return {
            ...prev,
            ...data,
            playlist: nextPlaylist,
            currentTrackId: nextTrackId,
          };
        });
      },
      (err) => {
        console.warn('Erro ao sincronizar áudio da mesa:', err?.message || err);
      }
    );

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [enabled]);

  // Reage às mudanças sincronizadas de faixa / play / pause / seek (`syncVersion`)
  useEffect(() => {
    if (!enabled) return;
    const syncKey = `${audioState.syncVersion}_${audioState.currentTrackId || 'none'}_${audioState.isPlaying ? '1' : '0'}_${audioState.basePositionSec}`;
    if (syncKey === lastAppliedSyncKeyRef.current) return;
    lastAppliedSyncKeyRef.current = syncKey;
    syncEnginesWithState(true);
  }, [
    enabled,
    audioState.syncVersion,
    audioState.currentTrackId,
    audioState.isPlaying,
    audioState.basePositionSec,
    syncEnginesWithState,
  ]);

  // Ticker de 250ms para barra de progresso suave + correção automática de drift a cada ~2s
  useEffect(() => {
    if (!enabled) return undefined;
    let tickCount = 0;

    const interval = setInterval(() => {
      const st = audioStateRef.current;
      const track = currentTrackRef.current;
      if (!track) return;

      if (!st.isPlaying) {
        setCurrentTime(Math.max(0, Number(st.basePositionSec) || 0));
        return;
      }

      const targetSec = computeTargetPositionSec(st, track);
      let actualSec = targetSec;

      if (track.sourceType === 'synth' && synthRef.current?.isPlaying) {
        actualSec = synthRef.current.getCurrentTime();
      } else if (
        (track.sourceType === 'url' || track.sourceType === 'upload') &&
        htmlAudioRef.current &&
        !htmlAudioRef.current.paused
      ) {
        actualSec = htmlAudioRef.current.currentTime || 0;
        if (Number.isFinite(htmlAudioRef.current.duration) && htmlAudioRef.current.duration > 0) {
          setLiveDuration(htmlAudioRef.current.duration);
        }
      } else if (
        track.sourceType === 'youtube' &&
        ytPlayerRef.current &&
        ytReadyRef.current
      ) {
        try {
          const ytTime = ytPlayerRef.current.getCurrentTime?.();
          const ytDur = ytPlayerRef.current.getDuration?.();
          if (Number.isFinite(ytTime) && ytTime >= 0) actualSec = ytTime;
          if (Number.isFinite(ytDur) && ytDur > 0) setLiveDuration(ytDur);
        } catch {}
      }

      setCurrentTime(actualSec);

      // Correção suave de drift a cada 2 segundos para manter Mestre e Jogadores 100% juntos
      tickCount += 1;
      if (tickCount % 8 === 0 && !needsUnlock) {
        const drift = Math.abs(actualSec - targetSec);
        if (drift > 1.45) {
          if (track.sourceType === 'synth' && synthRef.current?.isPlaying) {
            synthRef.current.seek(targetSec);
          } else if (
            (track.sourceType === 'url' || track.sourceType === 'upload') &&
            htmlAudioRef.current &&
            !htmlAudioRef.current.paused
          ) {
            try {
              htmlAudioRef.current.currentTime = targetSec;
            } catch {}
          } else if (
            track.sourceType === 'youtube' &&
            ytPlayerRef.current &&
            ytReadyRef.current
          ) {
            try {
              if (ytPlayerRef.current.getPlayerState?.() === 1) {
                ytPlayerRef.current.seekTo(targetSec, true);
              }
            } catch {}
          }
        }
      }
    }, 250);

    return () => clearInterval(interval);
  }, [enabled, computeTargetPositionSec, needsUnlock]);

  // Desbloqueio automático de áudio na primeira interação do usuário quando música já está tocando
  const unlockAudio = useCallback(async () => {
    setNeedsUnlock(false);
    if (synthRef.current) {
      await synthRef.current.unlock();
    }
    await syncEnginesWithState(true);
  }, [syncEnginesWithState]);

  useEffect(() => {
    if (!needsUnlock || !audioState.isPlaying) return undefined;
    const onFirstGesture = () => {
      unlockAudio();
    };
    window.addEventListener('pointerdown', onFirstGesture, { once: true });
    window.addEventListener('keydown', onFirstGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', onFirstGesture);
      window.removeEventListener('keydown', onFirstGesture);
    };
  }, [needsUnlock, audioState.isPlaying, unlockAudio]);

  // Limpeza ao desmontar provider
  useEffect(() => {
    const audioEl = htmlAudioRef.current;
    return () => {
      if (synthRef.current) {
        synthRef.current.dispose();
        synthRef.current = null;
      }
      if (audioEl) {
        try {
          audioEl.pause();
        } catch {}
      }
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.destroy?.();
        } catch {}
        ytPlayerRef.current = null;
        ytReadyRef.current = false;
        ytInitPromiseRef.current = null;
      }
    };
  }, []);

  // ======================== AÇÕES DO MESTRE ========================

  const togglePlayPause = useCallback(async () => {
    if (!isMasterRef.current) return;
    const st = audioStateRef.current;
    const list = st.playlist || [];
    if (list.length === 0) {
      toast.info('Adicione pelo menos uma música à playlist.');
      return;
    }

    const activeTrack = currentTrackRef.current || list[0];
    const activeIdx = Math.max(0, list.findIndex((t) => t.id === activeTrack.id));

    if (st.isPlaying) {
      const pausePos = computeTargetPositionSec(st, activeTrack);
      await commitMasterState(
        {
          playlist: list,
          currentTrackId: activeTrack.id,
          currentIndex: activeIdx,
          isPlaying: false,
          basePositionSec: pausePos,
        },
        true
      );
    } else {
      // Pré-desbloqueia Web Audio diretamente no gesto do clique do Mestre
      if (activeTrack.sourceType === 'synth') {
        if (!synthRef.current) {
          synthRef.current = new RpgSynthEngine();
          synthRef.current.onEnded = () => handleTrackEndedRef.current?.();
        }
        await synthRef.current.unlock();
      }
      const resumePos = Number(st.basePositionSec) || 0;
      const dur = Number(activeTrack.duration) || 0;
      const safeStart = dur > 0 && resumePos >= dur - 0.5 ? 0 : resumePos;
      await commitMasterState(
        {
          playlist: list,
          currentTrackId: activeTrack.id,
          currentIndex: activeIdx,
          isPlaying: true,
          basePositionSec: safeStart,
        },
        true
      );
    }
  }, [commitMasterState, computeTargetPositionSec]);

  const playTrackAt = useCallback(
    async (index) => {
      if (!isMasterRef.current) return;
      const list = audioStateRef.current.playlist || [];
      if (list.length === 0) return;
      const safeIdx = ((index % list.length) + list.length) % list.length;
      const target = list[safeIdx];
      if (!target) return;

      if (target.sourceType === 'synth') {
        if (!synthRef.current) {
          synthRef.current = new RpgSynthEngine();
          synthRef.current.onEnded = () => handleTrackEndedRef.current?.();
        }
        await synthRef.current.unlock();
      }

      await commitMasterState(
        {
          playlist: list,
          currentTrackId: target.id,
          currentIndex: safeIdx,
          isPlaying: true,
          basePositionSec: 0,
        },
        true
      );
    },
    [commitMasterState]
  );

  const nextTrack = useCallback(async () => {
    if (!isMasterRef.current) return;
    const st = audioStateRef.current;
    const list = st.playlist || [];
    if (list.length === 0) return;
    const curIdx = Math.max(0, list.findIndex((t) => t.id === st.currentTrackId));
    let targetIdx = (curIdx + 1) % list.length;
    if (st.shuffle && list.length > 1) {
      const candidates = list.map((_, i) => i).filter((i) => i !== curIdx);
      targetIdx = candidates[Math.floor(Math.random() * candidates.length)];
    }
    await playTrackAt(targetIdx);
  }, [playTrackAt]);

  const prevTrack = useCallback(async () => {
    if (!isMasterRef.current) return;
    const st = audioStateRef.current;
    const list = st.playlist || [];
    if (list.length === 0) return;
    const curIdx = Math.max(0, list.findIndex((t) => t.id === st.currentTrackId));
    const targetIdx = (curIdx - 1 + list.length) % list.length;
    await playTrackAt(targetIdx);
  }, [playTrackAt]);

  const seekTo = useCallback(
    async (nextSeconds) => {
      if (!isMasterRef.current) return;
      const st = audioStateRef.current;
      const track = currentTrackRef.current;
      if (!track) return;
      const maxDur = Math.max(liveDuration || 0, Number(track.duration) || 0, 1);
      const clamped = Math.max(0, Math.min(maxDur, Number(nextSeconds) || 0));
      setCurrentTime(clamped);

      await commitMasterState(
        {
          currentTrackId: track.id,
          basePositionSec: clamped,
          isPlaying: st.isPlaying,
        },
        true
      );
    },
    [commitMasterState, liveDuration]
  );

  const skipRelative = useCallback(
    async (deltaSec) => {
      if (!isMasterRef.current) return;
      const base = computeTargetPositionSec();
      await seekTo(base + deltaSec);
    },
    [computeTargetPositionSec, seekTo]
  );

  const cycleLoopMode = useCallback(async () => {
    if (!isMasterRef.current) return;
    const nextMode = audioStateRef.current.loopMode === 'one' ? 'playlist' : 'one';
    await commitMasterState({ loopMode: nextMode }, false);
  }, [commitMasterState]);

  const toggleShuffle = useCallback(async () => {
    if (!isMasterRef.current) return;
    await commitMasterState({ shuffle: !audioStateRef.current.shuffle }, false);
  }, [commitMasterState]);

  const addTrack = useCallback(
    async ({ sourceType, title, artist = '', category = 'tavern', url = '', fileDataUrl = null, mimeType = '', duration = 0 }) => {
      if (!isMasterRef.current) return false;
      const list = [...(audioStateRef.current.playlist || [])];
      if (list.length >= 100) {
        toast.error('Limite máximo de 100 faixas na playlist atingido.');
        return false;
      }

      const id = `track-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      let newTrack = null;

      if (sourceType === 'youtube') {
        const videoId = extractYouTubeVideoId(url);
        if (!videoId) {
          toast.error('Cole um link válido do YouTube (ex: youtube.com/watch?v=... ou youtu.be/...).');
          return false;
        }
        newTrack = {
          id,
          title: (title || '').trim() || `Faixa YouTube (${videoId})`,
          artist: (artist || '').trim() || 'YouTube',
          category,
          sourceType: 'youtube',
          youtubeId: videoId,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          duration: Number(duration) || 0,
        };
      } else if (sourceType === 'url') {
        const cleanUrl = (url || '').trim();
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
          toast.error('Informe uma URL direta válida de áudio (http:// ou https://).');
          return false;
        }
        newTrack = {
          id,
          title: (title || '').trim() || 'Faixa Externa',
          artist: (artist || '').trim() || 'Áudio Web',
          category,
          sourceType: 'url',
          url: cleanUrl,
          duration: Number(duration) || 0,
        };
      } else if (sourceType === 'upload') {
        if (!fileDataUrl) {
          toast.error('Selecione um arquivo de áudio válido.');
          return false;
        }
        const uploadMeta = await uploadTableAudioTrackFile(id, fileDataUrl, mimeType || 'audio/mpeg');
        newTrack = {
          id,
          title: (title || '').trim() || 'Áudio Local',
          artist: (artist || '').trim() || 'Upload da Mesa',
          category,
          sourceType: 'upload',
          chunkCount: uploadMeta.chunkCount || 0,
          mimeType: uploadMeta.mimeType || mimeType || 'audio/mpeg',
          inlineDataUrl: uploadMeta.inlineDataUrl || undefined,
          duration: Number(duration) || 0,
        };
      } else {
        return false;
      }

      const nextList = [...list, newTrack];
      const patch = { playlist: nextList };
      if (!audioStateRef.current.currentTrackId) {
        patch.currentTrackId = newTrack.id;
        patch.currentIndex = 0;
      }
      await commitMasterState(patch, false);
      toast.success(`"${newTrack.title}" adicionada à playlist!`);
      return true;
    },
    [commitMasterState]
  );

  const updateTrackMeta = useCallback(
    async (trackId, { title, artist, category }) => {
      if (!isMasterRef.current || !trackId) return;
      const list = audioStateRef.current.playlist || [];
      const nextList = list.map((t) =>
        t.id === trackId
          ? {
              ...t,
              title: (title ?? t.title).trim().slice(0, 120) || t.title,
              artist: artist !== undefined ? artist.trim().slice(0, 80) : t.artist,
              category: category || t.category,
            }
          : t
      );
      await commitMasterState({ playlist: nextList }, false);
      toast.success('Faixa atualizada na playlist!');
    },
    [commitMasterState]
  );

  const removeTrack = useCallback(
    async (trackId) => {
      if (!isMasterRef.current || !trackId) return;
      const st = audioStateRef.current;
      const list = st.playlist || [];
      const target = list.find((t) => t.id === trackId);
      const nextList = list.filter((t) => t.id !== trackId);

      if (target?.sourceType === 'upload') {
        deleteTableAudioTrackChunks(trackId).catch(() => {});
      }

      const removingActive = st.currentTrackId === trackId;
      if (removingActive) {
        const nextTrack = nextList[0] || null;
        await commitMasterState(
          {
            playlist: nextList,
            currentTrackId: nextTrack?.id || null,
            currentIndex: nextTrack ? 0 : -1,
            isPlaying: false,
            basePositionSec: 0,
          },
          true
        );
      } else {
        const newCurIdx = nextList.findIndex((t) => t.id === st.currentTrackId);
        await commitMasterState(
          {
            playlist: nextList,
            currentIndex: newCurIdx >= 0 ? newCurIdx : 0,
          },
          false
        );
      }
      toast.success('Faixa removida da playlist.');
    },
    [commitMasterState]
  );

  const reorderPlaylist = useCallback(
    async (fromIdx, toIdx) => {
      if (!isMasterRef.current) return;
      const st = audioStateRef.current;
      const list = [...(st.playlist || [])];
      if (
        fromIdx < 0 ||
        toIdx < 0 ||
        fromIdx >= list.length ||
        toIdx >= list.length ||
        fromIdx === toIdx
      ) {
        return;
      }
      const [moved] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, moved);

      const newCurIdx = list.findIndex((t) => t.id === st.currentTrackId);
      await commitMasterState(
        {
          playlist: list,
          currentIndex: newCurIdx >= 0 ? newCurIdx : 0,
        },
        false
      );
    },
    [commitMasterState]
  );

  const restoreDefaultTracks = useCallback(async () => {
    if (!isMasterRef.current) return;
    const curList = audioStateRef.current.playlist || [];
    const existingIds = new Set(curList.map((t) => t.id));
    const missing = DEFAULT_RPG_PLAYLIST.filter((t) => !existingIds.has(t.id));
    if (missing.length === 0) {
      toast.info('Todas as trilhas RPG padrão já estão na playlist.');
      return;
    }
    const nextList = [...curList, ...missing];
    const patch = { playlist: nextList };
    if (!audioStateRef.current.currentTrackId && nextList.length > 0) {
      patch.currentTrackId = nextList[0].id;
      patch.currentIndex = 0;
    }
    await commitMasterState(patch, false);
    toast.success(`${missing.length} trilha(s) RPG restaurada(s) na playlist!`);
  }, [commitMasterState]);

  // Dispara efeito sonoro pontual sincronizado (Soundboard) para todos na mesa sem interromper a música
  const triggerSoundEffect = useCallback(
    async (sfxId) => {
      if (!isMasterRef.current || !sfxId) return;
      const id = `sfx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const nowSyncedMs = Date.now() + clockOffsetRef.current;
      lastPlayedSfxIdRef.current = id;
      sfxInitialSeededRef.current = true;
      playSoundboardEffect(sfxId, sfxVolumeRef.current, sfxMutedRef.current);

      await commitMasterState(
        {
          lastSfx: {
            id,
            sfxId: String(sfxId).slice(0, 40),
            triggeredAtMs: nowSyncedMs,
            triggeredByName: userName || 'Mestre',
          },
        },
        false
      );
    },
    [commitMasterState, userName]
  );

  const contextValue = useMemo(
    () => ({
      enabled,
      isMaster,
      panelOpen,
      setPanelOpen,
      togglePanel: () => setPanelOpen((o) => !o),
      playlist: audioState.playlist || [],
      currentTrack,
      currentIndex,
      isPlaying: audioState.isPlaying,
      currentTime,
      duration: Math.max(liveDuration || 0, Number(currentTrack?.duration) || 0),
      loopMode: audioState.loopMode,
      shuffle: audioState.shuffle,
      lastSfx: audioState.lastSfx || null,
      storageMode,
      // Canal 1: Música
      volume,
      isMuted,
      setVolume,
      toggleMute,
      // Canal 2: Efeitos Sonoros (independente da música)
      sfxVolume,
      sfxMuted,
      setSfxVolume,
      toggleSfxMute,
      previewSfxVolume,
      needsUnlock,
      unlockAudio,
      loadingTrack,
      playbackError,
      // Ações exclusivas do Mestre
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
    }),
    [
      enabled,
      isMaster,
      panelOpen,
      audioState.playlist,
      audioState.isPlaying,
      audioState.loopMode,
      audioState.shuffle,
      audioState.lastSfx,
      currentTrack,
      currentIndex,
      currentTime,
      liveDuration,
      storageMode,
      volume,
      isMuted,
      setVolume,
      toggleMute,
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
    ]
  );

  return (
    <TabletopMusicContext.Provider value={contextValue}>
      {children}

      {/* Elementos de áudio persistentes (não sofrem corte ao alternar entre Mapa, Ficha, Loja e Missões) */}
      <audio
        ref={htmlAudioRef}
        preload="auto"
        onEnded={() => handleTrackEndedRef.current?.()}
        onError={() => {
          loadedHtmlTrackKeyRef.current = null;
          setLoadingTrack(false);
          setPlaybackError('Não foi possível reproduzir este áudio.');
        }}
        className="hidden"
      />

      {/* Container YouTube IFrame invisível (sem display:none para o navegador manter reprodução ativa) */}
      <div
        aria-hidden="true"
        className="fixed -left-[9999px] -top-[9999px] w-[120px] h-[120px] opacity-0 pointer-events-none overflow-hidden"
      >
        <div ref={ytContainerRef} />
      </div>

      {/* Painel Flutuante de Controle Musical (Visão Jogador: Volume | Visão Mestre: Estúdio & Playlist) */}
      <TabletopMusicPanel />
    </TabletopMusicContext.Provider>
  );
}
