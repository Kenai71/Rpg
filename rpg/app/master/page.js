'use client';

import { useEffect, useMemo, useState } from 'react';
import { limit, orderBy } from 'firebase/firestore';
import { BookOpen, Compass, Inbox, LayoutDashboard, Scroll, ShieldCheck, ShoppingBag, Users } from 'lucide-react';
import { toast } from 'sonner';
import { auth, isFirebaseConfigured } from '../../lib/firebase';
import { formatNumber } from '../../lib/utils';
import {
  masterResolveItemRequestTx,
  persistGeneratedDailyContent,
  resolveMissionTx,
  subscribeCollection,
  subscribeNpcs,
} from '../../lib/rpg-service';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { PageLoadingSkeleton } from '../../components/ui/Skeleton';
import { ConfirmDialog } from '../../components/ui/Modal';
import { MasterShell } from '../../components/master/MasterShell';
import { MasterOverview } from '../../components/master/MasterOverview';
import { MasterMissions } from '../../components/master/MasterMissions';
import { MasterShop } from '../../components/master/MasterShop';
import { MasterPlayers } from '../../components/master/MasterPlayers';
import { MasterRequests } from '../../components/master/MasterRequests';
import { MasterPermissions } from '../../components/master/MasterPermissions';
import { MasterNpcs } from '../../components/master/MasterNpcs';
import { MasterMapManager } from '../../components/map/MasterMapManager';
import { TabletopMusicProvider } from '../../components/music/TabletopMusicProvider';
import { TabletopSessionProvider } from '../../components/tabletop/TabletopSessionProvider';

export default function MasterPage() {
  const { user, profile, loading, error, logout } = useAuthGuard({ requiredRole: 'master' });

  const [activeSection, setActiveSection] = useState('overview');
  const [missions, setMissions] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [parties, setParties] = useState([]);
  const [requests, setRequests] = useState([]);
  const [shopItems, setShopItems] = useState([]);
  const [maps, setMaps] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [pings, setPings] = useState([]);
  const [diceRolls, setDiceRolls] = useState([]);
  const [npcs, setNpcs] = useState([]);

  const [contractConfirm, setContractConfirm] = useState(null); // { mission, status }
  const [resolvingContract, setResolvingContract] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured || !user || profile?.role !== 'master') return undefined;

    const unsubs = [
      subscribeCollection('missions', [orderBy('createdAt', 'desc'), limit(150)], setMissions, (err) =>
        console.error('Erro ao ouvir missões:', err)
      ),
      subscribeCollection('profiles', [orderBy('username', 'asc'), limit(200)], setAllProfiles, (err) =>
        console.error('Erro ao ouvir perfis:', err)
      ),
      subscribeCollection('parties', [orderBy('name', 'asc'), limit(100)], setParties, (err) =>
        console.error('Erro ao ouvir grupos:', err)
      ),
      subscribeCollection('item_requests', [orderBy('createdAt', 'desc'), limit(150)], setRequests, (err) =>
        console.error('Erro ao ouvir pedidos:', err)
      ),
      subscribeCollection('shop_items', [orderBy('item_name', 'asc'), limit(250)], setShopItems, (err) =>
        console.error('Erro ao ouvir loja:', err)
      ),
      subscribeCollection('maps', [limit(60)], setMaps, (err) =>
        console.error('Erro ao ouvir mapas:', err)
      ),
      subscribeCollection('map_tokens', [limit(300)], setTokens, (err) =>
        console.error('Erro ao ouvir tokens:', err)
      ),
      subscribeCollection('map_pings', [orderBy('createdAt', 'desc'), limit(40)], setPings, (err) =>
        console.error('Erro ao ouvir pings:', err)
      ),
      subscribeCollection('map_rolls', [orderBy('createdAt', 'desc'), limit(35)], setDiceRolls, () => {}),
      subscribeNpcs(setNpcs, (err) => console.error('Erro ao ouvir NPCs:', err)),
    ];

    return () => {
      unsubs.forEach((unsub) => {
        if (typeof unsub === 'function') unsub();
      });
    };
  }, [user, profile?.role]);

  const players = useMemo(
    () => allProfiles.filter((p) => p.role !== 'master'),
    [allProfiles]
  );

  const pendingRequestsCount = useMemo(
    () => requests.filter((r) => !r.status || r.status === 'pending').length,
    [requests]
  );

  const activeContractsCount = useMemo(
    () => missions.filter((m) => m.status === 'in_progress').length,
    [missions]
  );

  const commandItems = useMemo(() => {
    const modules = [
      { id: 'nav-overview', group: 'Módulos Admin', label: 'Visão Geral', icon: LayoutDashboard, onSelect: () => setActiveSection('overview') },
      { id: 'nav-maps', group: 'Módulos Admin', label: 'Mesa & Mapas', icon: Compass, onSelect: () => setActiveSection('maps') },
      { id: 'nav-npcs', group: 'Módulos Admin', label: 'NPCs & História', icon: BookOpen, onSelect: () => setActiveSection('npcs') },
      { id: 'nav-missions', group: 'Módulos Admin', label: 'Missões & Contratos', icon: Scroll, onSelect: () => setActiveSection('missions') },
      { id: 'nav-shop', group: 'Módulos Admin', label: 'Loja & Economia', icon: ShoppingBag, onSelect: () => setActiveSection('shop') },
      { id: 'nav-players', group: 'Módulos Admin', label: 'Heróis & Grupos', icon: Users, onSelect: () => setActiveSection('players') },
      { id: 'nav-requests', group: 'Módulos Admin', label: 'Solicitações', icon: Inbox, onSelect: () => setActiveSection('requests') },
      { id: 'nav-permissions', group: 'Módulos Admin', label: 'Permissões', icon: ShieldCheck, onSelect: () => setActiveSection('permissions') },
    ];

    const heroEntries = allProfiles.slice(0, 6).map((p) => ({
      id: `hero-${p.uid}`,
      group: 'Heróis',
      label: p.username,
      meta: `Rank ${p.rank} • ${formatNumber(p.gold)}G`,
      icon: Users,
      onSelect: () => setActiveSection('players'),
    }));

    const missionEntries = missions.slice(0, 5).map((m) => ({
      id: `mis-${m.id}`,
      group: 'Missões',
      label: m.title,
      meta: `Rank ${m.rank}`,
      icon: Scroll,
      onSelect: () => setActiveSection('missions'),
    }));

    const shopEntries = shopItems.slice(0, 5).map((s) => ({
      id: `shp-${s.id}`,
      group: 'Loja',
      label: s.item_name,
      meta: `${formatNumber(s.price)}G`,
      icon: ShoppingBag,
      onSelect: () => setActiveSection('shop'),
    }));

    return [...modules, ...heroEntries, ...missionEntries, ...shopEntries];
  }, [allProfiles, missions, shopItems]);

  const runChunkedAIGeneration = async ({ mode, totalCount, onProgress }) => {
    if (!auth?.currentUser) {
      throw new Error('Autenticação necessária.');
    }

    const safeTotal = Math.max(1, Math.min(50, Math.floor(Number(totalCount) || 1)));
    const CHUNK_SIZE = 10;
    const chunks = [];
    let remaining = safeTotal;
    while (remaining > 0) {
      const size = Math.min(CHUNK_SIZE, remaining);
      chunks.push(size);
      remaining -= size;
    }

    const idToken = await auth.currentUser.getIdToken();
    const runningDescriptions = shopItems
      .filter((s) => s.description)
      .slice(0, 20)
      .map((s) => `${s.item_name || ''}: ${s.description}`);
    const runningMissions = missions
      .filter((m) => m.title)
      .slice(0, 20)
      .map((m) => `${m.title}: ${m.description || ''}`);

    let createdCount = 0;

    for (let i = 0; i < chunks.length; i += 1) {
      const chunkSize = chunks[i];
      onProgress?.({
        createdCount,
        totalCount: safeTotal,
        chunkIndex: i + 1,
        totalChunks: chunks.length,
      });

      const res = await fetch('/api/daily-generate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode,
          count: chunkSize,
          existingDescriptions: mode === 'shop' ? runningDescriptions.slice(-24) : [],
          existingMissionTitles: mode === 'missions' ? runningMissions.slice(-24) : [],
        }),
      });

      const rawText = await res.text();
      let data = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        const isHtml = rawText.trim().startsWith('<');
        throw new Error(
          isHtml
            ? `O servidor retornou HTML (HTTP ${res.status}) em vez de JSON. Verifique na Vercel se Root Directory = "rpg", se as variáveis de ambiente foram salvas e faça um Redeploy.`
            : `Resposta inválida do servidor (HTTP ${res.status}).`
        );
      }

      if (!res.ok || !data?.success) {
        if (createdCount > 0) {
          throw new Error(
            `${createdCount} de ${safeTotal} criado(s) antes do erro: ${
              data?.error || 'Erro ao gerar lote.'
            }`
          );
        }
        throw new Error(data?.error || 'Erro ao gerar conteúdo com a IA.');
      }

      if (!data.persisted) {
        await persistGeneratedDailyContent({
          missions: mode === 'missions' ? data.missions || [] : [],
          shop_items: mode === 'shop' ? data.shop_items || [] : [],
        });
      }

      if (mode === 'shop') {
        const addedItems = Array.isArray(data.shop_items) ? data.shop_items : [];
        addedItems.forEach((s) => {
          if (s?.description) {
            runningDescriptions.push(`${s.item_name || ''}: ${s.description}`);
          }
        });
        createdCount += Number(data.countItems ?? addedItems.length) || 0;
      } else {
        const addedMissions = Array.isArray(data.missions) ? data.missions : [];
        addedMissions.forEach((m) => {
          if (m?.title) {
            runningMissions.push(`${m.title}: ${m.description || ''}`);
          }
        });
        createdCount += Number(data.countMissions ?? addedMissions.length) || 0;
      }

      onProgress?.({
        createdCount,
        totalCount: safeTotal,
        chunkIndex: i + 1,
        totalChunks: chunks.length,
      });
    }

    return { createdCount, totalCount: safeTotal };
  };

  const handleGenerateShopItems = async (totalCount, onProgress) => {
    const result = await runChunkedAIGeneration({
      mode: 'shop',
      totalCount,
      onProgress,
    });
    toast.success(`${result.createdCount} item(ns) aleatório(s) adicionado(s) à loja!`);
    return result;
  };

  const handleGenerateMissions = async (totalCount, onProgress) => {
    const result = await runChunkedAIGeneration({
      mode: 'missions',
      totalCount,
      onProgress,
    });
    toast.success(`${result.createdCount} missão(ões) aleatória(s) publicada(s) no mural!`);
    return result;
  };

  const handleConfirmContract = async () => {
    if (!contractConfirm) return;
    setResolvingContract(true);
    try {
      const { mission, status } = contractConfirm;
      const result = await resolveMissionTx(mission, status, allProfiles);
      if (status === 'completed') {
        toast.success(
          result.rewardedCount > 1
            ? `Missão concluída! Recompensas entregues e ouro dividido entre ${result.rewardedCount} membros do grupo.`
            : 'Missão concluída e recompensas entregues!'
        );
      } else {
        toast.info('Missão marcada como falha.');
      }
      setContractConfirm(null);
    } catch (err) {
      toast.error(err?.message || 'Erro ao validar contrato.');
    } finally {
      setResolvingContract(false);
    }
  };

  const handleResolveRequest = async (req, approved) => {
    try {
      await masterResolveItemRequestTx(req, approved);
      toast.success(
        approved
          ? 'Solicitação aprovada e item entregue na mochila!'
          : 'Solicitação recusada.'
      );
    } catch (err) {
      toast.error(err?.message || 'Não foi possível processar a solicitação.');
    }
  };

  if (loading || !profile) {
    return <PageLoadingSkeleton message="Carregando Painel do Mestre..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen realm-backdrop flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-rose-500/30 bg-[var(--surface-1)] p-6 text-center space-y-3">
          <h1 className="text-lg font-bold text-white">Erro de Acesso</h1>
          <p className="text-sm text-slate-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <TabletopMusicProvider
      enabled={isFirebaseConfigured && Boolean(user)}
      isMaster={true}
      userId={profile?.uid}
      userName={profile?.username || 'Mestre'}
    >
      <TabletopSessionProvider
        enabled={isFirebaseConfigured && Boolean(user)}
        isMaster={true}
        userId={profile?.uid}
        userName={profile?.username || 'Mestre'}
        players={players}
        profile={profile}
      >
        <MasterShell
        profile={profile}
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        pendingRequestsCount={pendingRequestsCount}
        activeContractsCount={activeContractsCount}
        commandItems={commandItems}
        onLogout={logout}
      >
      {activeSection === 'overview' && (
        <MasterOverview
          missions={missions}
          players={players}
          shopItems={shopItems}
          requests={requests}
          npcs={npcs}
          maps={maps}
          onResolveContract={(mission, status) => setContractConfirm({ mission, status })}
          onResolveRequest={handleResolveRequest}
          onNavigate={setActiveSection}
        />
      )}

      {activeSection === 'maps' && (
        <MasterMapManager
          maps={maps}
          tokens={tokens}
          pings={pings}
          diceRolls={diceRolls}
          players={players}
          currentUserId={profile?.uid}
          currentUserName={profile?.username || 'Mestre'}
        />
      )}

      {activeSection === 'npcs' && (
        <MasterNpcs
          npcs={npcs}
          maps={maps}
          tokens={tokens}
          missions={missions}
          currentUserId={profile?.uid}
        />
      )}

      {activeSection === 'missions' && (
        <MasterMissions
          missions={missions}
          players={allProfiles}
          onResolveContract={(mission, status) => setContractConfirm({ mission, status })}
          onGenerateMissions={handleGenerateMissions}
        />
      )}

      {activeSection === 'shop' && (
        <MasterShop
          shopItems={shopItems}
          onGenerateShopItems={handleGenerateShopItems}
        />
      )}

      {activeSection === 'players' && (
        <MasterPlayers
          players={allProfiles}
          parties={parties}
          currentUserProfile={profile}
        />
      )}

      {activeSection === 'requests' && (
        <MasterRequests
          requests={requests}
          players={allProfiles}
          onResolveRequest={handleResolveRequest}
        />
      )}

      {activeSection === 'permissions' && (
        <MasterPermissions allProfiles={allProfiles} currentUid={profile.uid} />
      )}

      <ConfirmDialog
        open={Boolean(contractConfirm)}
        onOpenChange={(open) => !open && setContractConfirm(null)}
        title={
          contractConfirm?.status === 'completed'
            ? 'Concluir Missão'
            : 'Marcar Missão como Falha'
        }
        description={
          contractConfirm?.status === 'completed'
            ? `Confirmar conclusão de "${contractConfirm?.mission?.title}" e entregar ${contractConfirm?.mission?.xp_reward} XP e ${contractConfirm?.mission?.gold_reward} Ouro? (Se o herói estiver em grupo, o ouro será dividido igualmente.)`
            : `Marcar "${contractConfirm?.mission?.title}" como falha sem entregar recompensas?`
        }
        confirmLabel={contractConfirm?.status === 'completed' ? 'Concluir e Recompensar' : 'Confirmar Falha'}
        variant={contractConfirm?.status === 'completed' ? 'success' : 'danger'}
        loading={resolvingContract}
        onConfirm={handleConfirmContract}
      />
        </MasterShell>
      </TabletopSessionProvider>
    </TabletopMusicProvider>
  );
}
