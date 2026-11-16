'use client';

import { useEffect, useMemo, useState } from 'react';
import { orderBy } from 'firebase/firestore';
import { toast } from 'sonner';
import { auth, isFirebaseConfigured } from '../../lib/firebase';
import {
  masterResolveItemRequestTx,
  persistGeneratedDailyContent,
  resolveMissionTx,
  subscribeCollection,
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

export default function MasterPage() {
  const { user, profile, loading, error, logout } = useAuthGuard({ requiredRole: 'master' });

  const [activeSection, setActiveSection] = useState('overview');
  const [missions, setMissions] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [parties, setParties] = useState([]);
  const [requests, setRequests] = useState([]);
  const [shopItems, setShopItems] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const [contractConfirm, setContractConfirm] = useState(null); // { mission, status }
  const [resolvingContract, setResolvingContract] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured || !user || profile?.role !== 'master') return undefined;

    const unsubs = [
      subscribeCollection('missions', [orderBy('createdAt', 'desc')], setMissions, (err) =>
        console.error('Erro ao ouvir missões:', err)
      ),
      subscribeCollection('profiles', [orderBy('username', 'asc')], setAllProfiles, (err) =>
        console.error('Erro ao ouvir perfis:', err)
      ),
      subscribeCollection('parties', [orderBy('name', 'asc')], setParties, (err) =>
        console.error('Erro ao ouvir grupos:', err)
      ),
      subscribeCollection('item_requests', [orderBy('createdAt', 'asc')], setRequests, (err) =>
        console.error('Erro ao ouvir pedidos:', err)
      ),
      subscribeCollection('shop_items', [orderBy('item_name', 'asc')], setShopItems, (err) =>
        console.error('Erro ao ouvir loja:', err)
      ),
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

  const handleGenerateDaily = async () => {
    if (!auth?.currentUser) return;
    setIsGenerating(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch('/api/daily-generate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao gerar conteúdo diário.');
      }

      if (!data.persisted) {
        await persistGeneratedDailyContent({
          missions: data.missions || [],
          shop_items: data.shop_items || [],
        });
      }

      toast.success(
        `Conteúdo diário gerado: ${data.countMissions} missões e ${data.countItems} itens adicionados!`
      );
    } catch (err) {
      toast.error(err?.message || 'Erro ao conectar com o gerador de IA.');
    } finally {
      setIsGenerating(false);
    }
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
    <MasterShell
      profile={profile}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
      pendingRequestsCount={pendingRequestsCount}
      activeContractsCount={activeContractsCount}
      isGenerating={isGenerating}
      onGenerateDaily={handleGenerateDaily}
      onLogout={logout}
    >
      {activeSection === 'overview' && (
        <MasterOverview
          missions={missions}
          players={players}
          shopItems={shopItems}
          requests={requests}
          onResolveContract={(mission, status) => setContractConfirm({ mission, status })}
          onResolveRequest={handleResolveRequest}
          onNavigate={setActiveSection}
        />
      )}

      {activeSection === 'missions' && (
        <MasterMissions
          missions={missions}
          players={allProfiles}
          onResolveContract={(mission, status) => setContractConfirm({ mission, status })}
        />
      )}

      {activeSection === 'shop' && <MasterShop shopItems={shopItems} />}

      {activeSection === 'players' && (
        <MasterPlayers players={allProfiles} parties={parties} />
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
  );
}
