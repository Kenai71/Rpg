'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { orderBy, where } from 'firebase/firestore';
import { Award, Backpack, Compass, Scroll, ShoppingBag, Users } from 'lucide-react';
import { toast } from 'sonner';
import { isFirebaseConfigured } from '../../lib/firebase';
import { openGachaGiftTx, requestRouletteGift, subscribeCollection } from '../../lib/rpg-service';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { formatNumber } from '../../lib/utils';
import { PageLoadingSkeleton } from '../../components/ui/Skeleton';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { PlayerShell } from '../../components/player/PlayerShell';
import { PlayerMissions } from '../../components/player/PlayerMissions';
import { PlayerShop } from '../../components/player/PlayerShop';
import { PlayerAllies } from '../../components/player/PlayerAllies';
import { PlayerCharacter } from '../../components/player/PlayerCharacter';
import { RouletteModal } from '../../components/player/RouletteModal';
import { PlayerMapView } from '../../components/map/PlayerMapView';
import { TabletopMusicProvider } from '../../components/music/TabletopMusicProvider';
import { TabletopSessionProvider } from '../../components/tabletop/TabletopSessionProvider';

export default function PlayerPage() {
  const { user, profile, loading, error, logout } = useAuthGuard();

  const [tab, setTab] = useState('map');
  const [missions, setMissions] = useState([]);
  const [shopItems, setShopItems] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [parties, setParties] = useState([]);
  const [maps, setMaps] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [pings, setPings] = useState([]);
  const [diceRolls, setDiceRolls] = useState([]);
  const [incomingTrades, setIncomingTrades] = useState([]);
  const [outgoingTrades, setOutgoingTrades] = useState([]);
  const [requestingSpin, setRequestingSpin] = useState(false);
  const [rouletteOpen, setRouletteOpen] = useState(false);

  const [levelUpTo, setLevelUpTo] = useState(null);
  const prevLevelRef = useRef(null);
  const profileLevel = profile?.level;

  useEffect(() => {
    if (profileLevel === undefined || profileLevel === null) return;
    if (prevLevelRef.current === null) {
      prevLevelRef.current = profileLevel || 1;
    } else if ((profileLevel || 1) > prevLevelRef.current) {
      setLevelUpTo(profileLevel);
      prevLevelRef.current = profileLevel;
    } else {
      prevLevelRef.current = profileLevel || 1;
    }
  }, [profileLevel]);

  useEffect(() => {
    if (!isFirebaseConfigured || !user) return undefined;

    const unsubs = [
      subscribeCollection('missions', [orderBy('createdAt', 'desc')], setMissions, (err) =>
        console.error('Erro ao ouvir missões:', err)
      ),
      subscribeCollection('shop_items', [orderBy('item_name', 'asc')], setShopItems, (err) =>
        console.error('Erro ao ouvir loja:', err)
      ),
      subscribeCollection('profiles', [orderBy('username', 'asc')], setAllProfiles, (err) =>
        console.error('Erro ao ouvir aventureiros:', err)
      ),
      subscribeCollection('parties', [orderBy('name', 'asc')], setParties, (err) =>
        console.error('Erro ao ouvir grupos:', err)
      ),
      subscribeCollection('maps', [], setMaps, (err) =>
        console.error('Erro ao ouvir mapas:', err)
      ),
      subscribeCollection('map_tokens', [], setTokens, (err) =>
        console.error('Erro ao ouvir tokens:', err)
      ),
      subscribeCollection('map_pings', [orderBy('createdAt', 'desc')], setPings, (err) =>
        console.error('Erro ao ouvir pings:', err)
      ),
      subscribeCollection('map_rolls', [orderBy('createdAt', 'desc')], setDiceRolls, () => {}),
      subscribeCollection(
        'trade_requests',
        [where('receiver_id', '==', user.uid)],
        setIncomingTrades,
        (err) => console.error('Erro ao ouvir ofertas recebidas:', err)
      ),
      subscribeCollection(
        'trade_requests',
        [where('sender_id', '==', user.uid)],
        setOutgoingTrades,
        (err) => console.error('Erro ao ouvir ofertas enviadas:', err)
      ),
    ];

    return () => {
      unsubs.forEach((unsub) => {
        if (typeof unsub === 'function') unsub();
      });
    };
  }, [user]);

  const myParty = useMemo(
    () => parties.find((p) => p.id === profile?.party_id) || null,
    [parties, profile?.party_id]
  );

  const playerAllies = useMemo(
    () => allProfiles.filter((p) => p.role !== 'master' || p.uid === profile?.uid),
    [allProfiles, profile?.uid]
  );

  const pendingTradesCount = useMemo(
    () => incomingTrades.filter((t) => t.status === 'pending').length,
    [incomingTrades]
  );

  const commandItems = useMemo(() => {
    const navEntries = [
      { id: 'tab-map', group: 'Navegação', label: 'Ir para Mesa & Mapa', icon: Compass, onSelect: () => setTab('map') },
      { id: 'tab-missions', group: 'Navegação', label: 'Ir para Mural de Missões', icon: Scroll, onSelect: () => setTab('missions') },
      { id: 'tab-shop', group: 'Navegação', label: 'Ir para Loja do Reino', icon: ShoppingBag, onSelect: () => setTab('shop') },
      { id: 'tab-players', group: 'Navegação', label: 'Ir para Aliados & Trocas', icon: Users, onSelect: () => setTab('players') },
      { id: 'tab-inv', group: 'Navegação', label: 'Ir para Ficha & Mochila', icon: Backpack, onSelect: () => setTab('inv') },
    ];

    const missionEntries = missions
      .filter((m) => m.status === 'open')
      .slice(0, 6)
      .map((m) => ({
        id: `m-${m.id}`,
        group: 'Missões Abertas',
        label: m.title,
        meta: `Rank ${m.rank} • ${formatNumber(m.gold_reward)}G`,
        icon: Scroll,
        onSelect: () => setTab('missions'),
      }));

    const shopEntries = shopItems
      .filter((s) => Number(s.quantity || 0) > 0)
      .slice(0, 6)
      .map((s) => ({
        id: `s-${s.id}`,
        group: 'Catálogo da Loja',
        label: s.item_name,
        meta: `${formatNumber(s.price)}G`,
        icon: ShoppingBag,
        onSelect: () => setTab('shop'),
      }));

    const allyEntries = playerAllies.slice(0, 6).map((a) => ({
      id: `a-${a.uid}`,
      group: 'Aliados',
      label: a.username,
      meta: `Rank ${a.rank} • LVL ${a.level}`,
      icon: Users,
      onSelect: () => setTab('players'),
    }));

    return [...navEntries, ...missionEntries, ...shopEntries, ...allyEntries];
  }, [missions, shopItems, playerAllies]);

  const gachaGiftsCount = useMemo(() => {
    if (!profile?.inventory) return 0;
    return profile.inventory
      .filter((i) => i.name === 'Gacha Gift')
      .reduce((acc, i) => acc + (Number(i.qty) || 1), 0);
  }, [profile?.inventory]);

  const handleSpinWithGift = async () => {
    if (!profile) throw new Error('Perfil não encontrado.');
    const giftIndex = profile.inventory?.findIndex((i) => i.name === 'Gacha Gift');
    if (giftIndex === -1 || giftIndex === undefined) {
      throw new Error('Você não possui nenhum Gacha Gift na mochila!');
    }
    return await openGachaGiftTx(profile.uid, giftIndex);
  };

  const handleRequestSpin = async () => {
    if (!profile) return;
    setRequestingSpin(true);
    try {
      await requestRouletteGift(profile);
      toast.success('Solicitação de Roleta Gacha enviada ao Mestre!');
    } catch (err) {
      toast.error(err?.message || 'Erro ao solicitar gift.');
    } finally {
      setRequestingSpin(false);
    }
  };

  if (loading || !profile) {
    return <PageLoadingSkeleton message="Carregando Ficha do Herói..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen realm-backdrop flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-rose-500/30 bg-[var(--surface-1)] p-6 text-center space-y-3">
          <h1 className="text-lg font-bold text-white">Erro ao carregar</h1>
          <p className="text-sm text-slate-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <TabletopMusicProvider
      enabled={isFirebaseConfigured && Boolean(user)}
      isMaster={false}
      userId={profile?.uid}
      userName={profile?.username || 'Aventureiro'}
    >
      <TabletopSessionProvider
        enabled={isFirebaseConfigured && Boolean(user)}
        isMaster={false}
        userId={profile?.uid}
        userName={profile?.username || 'Aventureiro'}
        players={playerAllies}
        profile={profile}
      >
        <PlayerShell
        profile={profile}
        myParty={myParty}
        activeTab={tab}
        onSelectTab={setTab}
        pendingTradesCount={pendingTradesCount}
        commandItems={commandItems}
        onRequestSpin={handleRequestSpin}
        requestingSpin={requestingSpin}
        onOpenRoulette={() => setRouletteOpen(true)}
        onLogout={logout}
      >
      {tab === 'map' && (
        <PlayerMapView
          maps={maps}
          tokens={tokens}
          profile={profile}
          pings={pings}
          diceRolls={diceRolls}
        />
      )}

      {tab === 'missions' && (
        <PlayerMissions missions={missions} profile={profile} hasParty={Boolean(myParty)} />
      )}

      {tab === 'shop' && <PlayerShop shopItems={shopItems} profile={profile} />}

      {tab === 'players' && (
        <PlayerAllies
          allPlayers={playerAllies}
          parties={parties}
          profile={profile}
          incomingTrades={incomingTrades}
          outgoingTrades={outgoingTrades}
        />
      )}

      {tab === 'inv' && (
        <PlayerCharacter profile={profile} onOpenRoulette={() => setRouletteOpen(true)} />
      )}

      {/* Roleta Rúnica Centralizada */}
      <RouletteModal
        open={rouletteOpen}
        onClose={() => setRouletteOpen(false)}
        giftsCount={gachaGiftsCount}
        onSpinWithGift={handleSpinWithGift}
        onRequestGift={handleRequestSpin}
        requestingGift={requestingSpin}
      />

      <Modal
        open={Boolean(levelUpTo)}
        onOpenChange={(open) => !open && setLevelUpTo(null)}
        maxWidth="max-w-sm"
      >
        <div className="py-4 text-center space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center mx-auto">
            <Award className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-300">
              Subiu de Nível!
            </p>
            <h2 className="text-3xl font-black text-white font-mono">NÍVEL {levelUpTo}</h2>
            <p className="text-sm text-slate-400">
              Sua experiência cresceu e seu nome ecoa pelo Reino.
            </p>
          </div>
          <Button className="w-full" onClick={() => setLevelUpTo(null)}>
            Continuar Jornada
          </Button>
        </div>
      </Modal>
        </PlayerShell>
      </TabletopSessionProvider>
    </TabletopMusicProvider>
  );
}
