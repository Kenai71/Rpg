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
import { auth } from '../../lib/firebase';
import { playSoundboardEffect } from '../../lib/rpg-soundboard';
import {
  claimLootChestGoldTx,
  claimLootChestItemsTx,
  createLootChest,
  createTableHandout,
  deleteLootChest,
  deleteTableHandout,
  deleteTableWhisper,
  discardLootChestItemsTx,
  markTableWhisperRead,
  sendTableWhisper,
  setTableHandoutActive,
  subscribeLootChests,
  subscribeTableHandouts,
  subscribeTableWhispers,
  updateLootChest,
} from '../../lib/rpg-service';
import { useTabletopMusic } from '../music/TabletopMusicProvider';
import { TabletopImmersionOverlays } from './TabletopImmersionModals';

const TabletopSessionContext = createContext(null);

export function useTabletopSession() {
  return useContext(TabletopSessionContext);
}

function getTimestampMs(obj, field = 'shownAt') {
  if (!obj) return 0;
  const val = obj[field];
  if (val?.toMillis) return val.toMillis();
  if (val?.seconds) return val.seconds * 1000;
  if (typeof obj[`${field}Ms`] === 'number') return obj[`${field}Ms`];
  if (typeof obj.createdAtMs === 'number') return obj.createdAtMs;
  if (obj.createdAt?.toMillis) return obj.createdAt.toMillis();
  if (obj.createdAt?.seconds) return obj.createdAt.seconds * 1000;
  return 0;
}

export function TabletopSessionProvider({
  enabled = true,
  isMaster = false,
  userId = null,
  userName = '',
  players = [],
  profile = null,
  children,
}) {
  const music = useTabletopMusic();

  // Estado sincronizado em tempo real
  const [handouts, setHandouts] = useState([]);
  const [whispers, setWhispers] = useState([]);
  const [lootChests, setLootChests] = useState([]);

  const handoutStorageRef = useRef('collection');
  const whisperStorageRef = useRef('collection');
  const lootStorageRef = useRef('collection');

  // Estados de interface (modais / overlays)
  const [studioTab, setStudioTab] = useState(null); // null | 'handouts' | 'whispers' | 'loot' (Mestre)
  const [dismissedHandoutKey, setDismissedHandoutKey] = useState(null);
  const [playerWhisperModalOpen, setPlayerWhisperModalOpen] = useState(false);
  const [popupWhisper, setPopupWhisper] = useState(null);
  const [playerLootModalOpen, setPlayerLootModalOpen] = useState(false);
  const [selectedChestId, setSelectedChestId] = useState(null);
  const [newChestBanner, setNewChestBanner] = useState(null);

  // Refs para evitar alertas repetidos no primeiro carregamento
  const whisperSeededRef = useRef(false);
  const seenWhisperIdsRef = useRef(new Set());
  const lootSeededRef = useRef(false);
  const seenChestIdsRef = useRef(new Set());

  const volumeRef = useRef(0.8);
  const mutedRef = useRef(false);
  volumeRef.current = music?.sfxVolume ?? 0.8;
  mutedRef.current = Boolean(music?.sfxMuted);

  // 1. Subscrição em tempo real aos Handouts
  useEffect(() => {
    if (!enabled) return undefined;
    const unsub = subscribeTableHandouts(
      isMaster,
      userId,
      ({ items, storageMode }) => {
        if (storageMode) handoutStorageRef.current = storageMode;
        setHandouts(Array.isArray(items) ? items : []);
      },
      (err) => console.warn('Erro ao sincronizar handouts:', err?.message || err)
    );
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [enabled, isMaster, userId]);

  // 2. Subscrição em tempo real aos Sussurros Privados
  useEffect(() => {
    if (!enabled) return undefined;
    whisperSeededRef.current = false;
    seenWhisperIdsRef.current = new Set();

    const seedTimer = setTimeout(() => {
      whisperSeededRef.current = true;
    }, 1200);

    const unsub = subscribeTableWhispers(
      isMaster,
      userId,
      ({ items, storageMode }) => {
        if (storageMode) whisperStorageRef.current = storageMode;
        const safeItems = Array.isArray(items) ? items : [];
        setWhispers(safeItems);

        if (!isMaster) {
          if (!whisperSeededRef.current) {
            whisperSeededRef.current = true;
            safeItems.forEach((w) => {
              if (w?.id) seenWhisperIdsRef.current.add(w.id);
            });
            return;
          }

          const newestUnread = safeItems.find(
            (w) => w?.id && !w.read && !seenWhisperIdsRef.current.has(w.id)
          );
          safeItems.forEach((w) => {
            if (w?.id) seenWhisperIdsRef.current.add(w.id);
          });

          if (newestUnread) {
            setPopupWhisper(newestUnread);
            playSoundboardEffect('whisper', volumeRef.current, mutedRef.current);
            try {
              if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                navigator.vibrate([30, 40, 30]);
              }
            } catch {}
          }
        }
      },
      (err) => console.warn('Erro ao sincronizar sussurros:', err?.message || err)
    );

    return () => {
      clearTimeout(seedTimer);
      if (typeof unsub === 'function') unsub();
    };
  }, [enabled, isMaster, userId]);

  // 3. Subscrição em tempo real aos Baús de Loot
  useEffect(() => {
    if (!enabled) return undefined;
    lootSeededRef.current = false;
    seenChestIdsRef.current = new Set();

    const seedTimer = setTimeout(() => {
      lootSeededRef.current = true;
    }, 1200);

    const unsub = subscribeLootChests(
      isMaster,
      userId,
      ({ items, storageMode }) => {
        if (storageMode) lootStorageRef.current = storageMode;
        const safeChests = Array.isArray(items) ? items : [];
        setLootChests(safeChests);

        if (!isMaster) {
          const openOnes = safeChests.filter((c) => c.status === 'open');
          if (!lootSeededRef.current) {
            lootSeededRef.current = true;
            openOnes.forEach((c) => {
              if (c?.id) seenChestIdsRef.current.add(c.id);
            });
            return;
          }

          const brandNewChest = openOnes.find(
            (c) => c?.id && !seenChestIdsRef.current.has(c.id)
          );
          openOnes.forEach((c) => {
            if (c?.id) seenChestIdsRef.current.add(c.id);
          });

          if (brandNewChest) {
            setNewChestBanner(brandNewChest);
            setSelectedChestId(brandNewChest.id);
          }
        }
      },
      (err) => console.warn('Erro ao sincronizar baús de loot:', err?.message || err)
    );

    return () => {
      clearTimeout(seedTimer);
      if (typeof unsub === 'function') unsub();
    };
  }, [enabled, isMaster, userId]);

  // Derivados úteis
  const activeHandout = useMemo(
    () => handouts.find((h) => Boolean(h.is_active)) || null,
    [handouts]
  );

  const activeHandoutKey = useMemo(() => {
    if (!activeHandout) return null;
    return `${activeHandout.id}_${getTimestampMs(activeHandout, 'shownAt')}`;
  }, [activeHandout]);

  const unreadWhispersCount = useMemo(
    () => (isMaster ? 0 : whispers.filter((w) => !w.read).length),
    [isMaster, whispers]
  );

  const openChests = useMemo(
    () => lootChests.filter((c) => c.status === 'open'),
    [lootChests]
  );

  const availableLootCount = useMemo(() => {
    return openChests.reduce((sum, chest) => {
      const availItems = (Array.isArray(chest.items) ? chest.items : []).filter(
        (it) => it.status === 'available'
      ).length;
      return sum + availItems + (Number(chest.gold) > 0 ? 1 : 0);
    }, 0);
  }, [openChests]);

  // ======================== AÇÕES DE HANDOUTS ========================

  const createHandout = useCallback(
    async (payload) => {
      const res = await createTableHandout(
        { ...payload, created_by: userId || null },
        handoutStorageRef.current
      );
      if (res?.storageMode) handoutStorageRef.current = res.storageMode;
      toast.success(
        payload.is_active
          ? 'Handout exibido em tela cheia para os jogadores!'
          : 'Handout salvo na biblioteca da mesa.'
      );
      return res;
    },
    [userId]
  );

  const toggleHandoutActive = useCallback(async (handoutId, nextActive, visible_to = null) => {
    await setTableHandoutActive(handoutId, nextActive, visible_to, handoutStorageRef.current);
    toast.success(
      nextActive
        ? 'Handout projetado em tela cheia para os jogadores!'
        : 'Handout recolhido da tela dos jogadores.'
    );
  }, []);

  const removeHandout = useCallback(async (handoutId) => {
    await deleteTableHandout(handoutId, handoutStorageRef.current);
    toast.success('Handout removido.');
  }, []);

  const dismissActiveHandout = useCallback(() => {
    if (activeHandoutKey) setDismissedHandoutKey(activeHandoutKey);
  }, [activeHandoutKey]);

  const reopenActiveHandout = useCallback(() => {
    setDismissedHandoutKey(null);
  }, []);

  // ======================== AÇÕES DE SUSSURROS ========================

  const sendWhisper = useCallback(
    async ({ target_uid, target_name, message, category = 'secret' }) => {
      const res = await sendTableWhisper(
        {
          target_uid,
          target_name,
          sender_uid: userId || null,
          sender_name: userName || 'Mestre',
          message,
          category,
        },
        whisperStorageRef.current
      );
      if (res?.storageMode) whisperStorageRef.current = res.storageMode;
      toast.success(`Sussurro privado enviado para ${target_name || 'o jogador'}!`);
      return res;
    },
    [userId, userName]
  );

  const markWhisperRead = useCallback(async (whisperId) => {
    if (!whisperId) return;
    await markTableWhisperRead(whisperId, whisperStorageRef.current);
    setPopupWhisper((cur) => (cur?.id === whisperId ? null : cur));
  }, []);

  const removeWhisper = useCallback(async (whisperId) => {
    await deleteTableWhisper(whisperId, whisperStorageRef.current);
    toast.success('Sussurro removido.');
  }, []);

  // ======================== AÇÕES DE BAÚ DE LOOT ========================

  const generateAiLoot = useCallback(async ({ theme, count = 6, rarityTier = 'mixed', includeJunk = true }) => {
    if (!auth?.currentUser) {
      throw new Error('Autenticação necessária para gerar saque com IA.');
    }
    const idToken = await auth.currentUser.getIdToken();
    const res = await fetch('/api/loot-generate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ theme, count, rarityTier, includeJunk }),
    });
    const data = await res.json();
    if (!res.ok || !data?.success) {
      throw new Error(data?.error || 'Falha ao gerar itens do baú com IA.');
    }
    return {
      gold: Number(data.gold) || 0,
      items: Array.isArray(data.items) ? data.items : [],
      source: data.source || 'gemini',
    };
  }, []);

  const createChest = useCallback(
    async ({ title, theme, gold, visible_to, items, status = 'open', playSound = true }) => {
      const res = await createLootChest(
        {
          title,
          theme,
          gold,
          visible_to,
          items,
          status,
          created_by: userId || null,
        },
        lootStorageRef.current
      );
      if (res?.storageMode) lootStorageRef.current = res.storageMode;
      if (playSound && status === 'open' && music?.triggerSoundEffect) {
        music.triggerSoundEffect('chest_open');
      }
      toast.success(
        status === 'open'
          ? 'Baú de Loot aberto e sincronizado para os jogadores selecionados!'
          : 'Baú salvo como fechado.'
      );
      return res;
    },
    [userId, music]
  );

  const updateChest = useCallback(async (chestId, patch) => {
    await updateLootChest(chestId, patch, lootStorageRef.current);
  }, []);

  const removeChest = useCallback(async (chestId) => {
    await deleteLootChest(chestId, lootStorageRef.current);
    toast.success('Baú removido.');
  }, []);

  const claimChestItems = useCallback(
    async (chestId, itemIds) => {
      if (!userId) return { claimedCount: 0 };
      const res = await claimLootChestItemsTx(
        chestId,
        userId,
        userName || profile?.username || 'Aventureiro',
        itemIds,
        lootStorageRef.current
      );
      if (res.claimedCount > 0) {
        playSoundboardEffect('coins', volumeRef.current, mutedRef.current);
        toast.success(
          res.claimedCount === 1
            ? 'Item guardado na sua mochila!'
            : `${res.claimedCount} itens guardados na sua mochila!`
        );
      }
      return res;
    },
    [userId, userName, profile?.username]
  );

  const discardChestItems = useCallback(
    async (chestId, itemIds) => {
      if (!userId) return { discardedCount: 0 };
      const res = await discardLootChestItemsTx(
        chestId,
        userId,
        userName || profile?.username || 'Aventureiro',
        itemIds,
        lootStorageRef.current
      );
      if (res.discardedCount > 0) {
        toast.info(
          res.discardedCount === 1
            ? 'Item jogado fora do baú.'
            : `${res.discardedCount} itens jogados fora do baú.`
        );
      }
      return res;
    },
    [userId, userName, profile?.username]
  );

  const claimChestGold = useCallback(
    async (chestId, requestedAmount = null) => {
      if (!userId) return { collected: 0 };
      const res = await claimLootChestGoldTx(
        chestId,
        userId,
        userName || profile?.username || 'Aventureiro',
        requestedAmount,
        lootStorageRef.current
      );
      if (res.collected > 0) {
        playSoundboardEffect('coins', volumeRef.current, mutedRef.current);
        toast.success(`+${res.collected}G adicionado à sua bolsa!`);
      }
      return res;
    },
    [userId, userName, profile?.username]
  );

  const openPlayerChest = useCallback((chestId = null) => {
    if (chestId) setSelectedChestId(chestId);
    setNewChestBanner(null);
    setPlayerLootModalOpen(true);
  }, []);

  const contextValue = useMemo(
    () => ({
      enabled,
      isMaster,
      userId,
      userName,
      players,
      profile,
      // Handouts
      handouts,
      activeHandout,
      activeHandoutKey,
      dismissedHandoutKey,
      createHandout,
      toggleHandoutActive,
      removeHandout,
      dismissActiveHandout,
      reopenActiveHandout,
      // Whispers
      whispers,
      unreadWhispersCount,
      popupWhisper,
      setPopupWhisper,
      playerWhisperModalOpen,
      setPlayerWhisperModalOpen,
      sendWhisper,
      markWhisperRead,
      removeWhisper,
      // Loot Chests
      lootChests,
      openChests,
      availableLootCount,
      playerLootModalOpen,
      setPlayerLootModalOpen,
      selectedChestId,
      setSelectedChestId,
      newChestBanner,
      setNewChestBanner,
      openPlayerChest,
      generateAiLoot,
      createChest,
      updateChest,
      removeChest,
      claimChestItems,
      discardChestItems,
      claimChestGold,
      // Master Studio Tabs
      studioTab,
      openStudio: (tab) => setStudioTab(tab),
      closeStudio: () => setStudioTab(null),
    }),
    [
      enabled,
      isMaster,
      userId,
      userName,
      players,
      profile,
      handouts,
      activeHandout,
      activeHandoutKey,
      dismissedHandoutKey,
      createHandout,
      toggleHandoutActive,
      removeHandout,
      dismissActiveHandout,
      reopenActiveHandout,
      whispers,
      unreadWhispersCount,
      popupWhisper,
      playerWhisperModalOpen,
      sendWhisper,
      markWhisperRead,
      removeWhisper,
      lootChests,
      openChests,
      availableLootCount,
      playerLootModalOpen,
      selectedChestId,
      newChestBanner,
      openPlayerChest,
      generateAiLoot,
      createChest,
      updateChest,
      removeChest,
      claimChestItems,
      discardChestItems,
      claimChestGold,
      studioTab,
    ]
  );

  return (
    <TabletopSessionContext.Provider value={contextValue}>
      {children}
      <TabletopImmersionOverlays />
    </TabletopSessionContext.Provider>
  );
}
