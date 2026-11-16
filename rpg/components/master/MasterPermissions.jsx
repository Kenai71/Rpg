'use client';

import { useState } from 'react';
import { Check, ShieldCheck, UserCog, X } from 'lucide-react';
import { toast } from 'sonner';
import { modifyPlayerStatsTx } from '../../lib/rpg-service';
import { RoleBadge, RankBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { ConfirmDialog } from '../ui/Modal';

const PERMISSION_MATRIX = [
  { capability: 'Aceitar missões do mural', player: true, master: true },
  { capability: 'Comprar itens na loja com Ouro ou Runas', player: true, master: true },
  { capability: 'Equipar itens e trocar com aliados', player: true, master: true },
  { capability: 'Criar, editar, validar e excluir missões', player: false, master: true },
  { capability: 'Gerenciar estoque e preços da loja', player: false, master: true },
  { capability: 'Alterar Ouro, XP, Rank e Mochila de jogadores', player: false, master: true },
  { capability: 'Aprovar pedidos de itens e Roleta Gacha', player: false, master: true },
  { capability: 'Gerar missões e itens via Inteligência Artificial', player: false, master: true },
  { capability: 'Promover ou rebaixar permissões de usuários', player: false, master: true },
];

export function MasterPermissions({ allProfiles, currentUid }) {
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [updating, setUpdating] = useState(false);

  const mastersCount = allProfiles.filter((p) => p.role === 'master').length;

  const handleToggleRole = async () => {
    if (!confirmTarget) return;
    const nextRole = confirmTarget.role === 'master' ? 'player' : 'master';

    if (confirmTarget.uid === currentUid && nextRole === 'player' && mastersCount <= 1) {
      toast.error('Você é o único Mestre ativo. Promova outro usuário antes de alterar seu próprio cargo.');
      setConfirmTarget(null);
      return;
    }

    setUpdating(true);
    try {
      await modifyPlayerStatsTx(confirmTarget.uid, { role: nextRole });
      toast.success(
        `${confirmTarget.username} agora possui acesso de ${
          nextRole === 'master' ? 'Mestre (Admin)' : 'Jogador'
        }.`
      );
      setConfirmTarget(null);
    } catch (err) {
      toast.error(err?.message || 'Erro ao alterar permissão.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[var(--accent-glow)]" />
              Matriz de Permissões
            </CardTitle>
            <CardDescription>
              Regras de acesso aplicadas na interface e protegidas no Cloud Firestore.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--surface-2)]/70 border-b border-[var(--border-subtle)] text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">Funcionalidade</th>
                  <th className="px-4 py-3 text-center">Jogador</th>
                  <th className="px-4 py-3 text-center">Mestre (Admin)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {PERMISSION_MATRIX.map((row) => (
                  <tr key={row.capability} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-slate-200">{row.capability}</td>
                    <td className="px-4 py-3 text-center">
                      {row.player ? (
                        <Check className="h-4 w-4 text-emerald-400 inline" aria-label="Permitido" />
                      ) : (
                        <X className="h-4 w-4 text-slate-600 inline" aria-label="Bloqueado" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.master ? (
                        <Check className="h-4 w-4 text-emerald-400 inline" aria-label="Permitido" />
                      ) : (
                        <X className="h-4 w-4 text-slate-600 inline" aria-label="Bloqueado" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-[var(--accent-glow)]" />
              Contas & Níveis de Acesso ({allProfiles.length})
            </CardTitle>
            <CardDescription>
              Gerencie quem tem acesso administrativo ao Painel do Mestre.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {allProfiles.map((userProf) => {
            const isSelf = userProf.uid === currentUid;
            const isMaster = userProf.role === 'master';
            return (
              <div
                key={userProf.uid}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-0)]/60 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white">{userProf.username}</span>
                    {isSelf && (
                      <span className="text-[11px] font-semibold text-[var(--accent-glow)]">
                        (Você)
                      </span>
                    )}
                    <RoleBadge role={userProf.role} />
                    <RankBadge rank={userProf.rank} />
                  </div>
                  <p className="text-xs font-mono text-slate-500 truncate">UID: {userProf.uid}</p>
                </div>

                <Button
                  variant={isMaster ? 'outline' : 'primary'}
                  size="sm"
                  onClick={() => setConfirmTarget(userProf)}
                  disabled={isSelf && mastersCount <= 1}
                >
                  {isMaster ? 'Alterar para Jogador' : 'Promover a Mestre'}
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title="Alterar nível de acesso"
        description={
          confirmTarget?.role === 'master'
            ? `Remover privilégios administrativos de "${confirmTarget?.username}" e torná-lo Jogador?`
            : `Conceder acesso completo de Mestre (Admin) para "${confirmTarget?.username}"?`
        }
        confirmLabel="Confirmar Alteração"
        variant={confirmTarget?.role === 'master' ? 'warning' : 'primary'}
        loading={updating}
        onConfirm={handleToggleRole}
      />
    </div>
  );
}
