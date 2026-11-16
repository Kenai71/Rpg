'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Backpack,
  Coins,
  Crown,
  Dices,
  LogOut,
  Pencil,
  Scroll,
  Shield,
  ShoppingBag,
  Users,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import Logo from '../../app/components/Logo';
import { getRankMeta, getXpProgress } from '../../lib/constants';
import { updateHeroUsername } from '../../lib/rpg-service';
import { cn, formatNumber } from '../../lib/utils';
import { Badge, RankBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { FormField, Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { ThemeSwitcher } from '../ui/ThemeSwitcher';
import { UserAvatar } from '../ui/UserAvatar';

const TABS = [
  { id: 'missions', label: 'Mural', icon: Scroll },
  { id: 'shop', label: 'Loja', icon: ShoppingBag },
  { id: 'players', label: 'Aliados', icon: Users },
  { id: 'inv', label: 'Personagem', icon: Backpack },
];

export function PlayerShell({
  profile,
  myParty,
  activeTab,
  onSelectTab,
  pendingTradesCount = 0,
  commandItems = [],
  onRequestSpin,
  requestingSpin = false,
  onOpenRoulette,
  onLogout,
  children,
}) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState(false);

  const xpData = getXpProgress(profile?.level, profile?.xp);
  const rankMeta = getRankMeta(profile?.rank);
  const isPartyLeader = Boolean(myParty && myParty.leader_id === profile?.uid);

  const openRenameModal = () => {
    setNewName(profile?.username || '');
    setRenameOpen(true);
  };

  const handleRename = async (e) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error('Informe um nome válido.');
      return;
    }
    setRenaming(true);
    try {
      await updateHeroUsername(profile.uid, newName);
      toast.success('Nome do personagem atualizado!');
      setRenameOpen(false);
    } catch (err) {
      toast.error(err?.message || 'Erro ao atualizar nome.');
    } finally {
      setRenaming(false);
    }
  };

  return (
    <div className="min-h-screen realm-backdrop flex flex-col pb-20 md:pb-8">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--surface-0)]/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-5 min-w-0">
            <Logo size={36} subtitle="Guilda" />

            {/* Desktop Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1" aria-label="Navegação Principal">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = activeTab === t.id;
                const showBadge = t.id === 'players' && pendingTradesCount > 0;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelectTab(t.id)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all relative',
                      active
                        ? 'bg-white/10 text-white border border-white/20 shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
                    )}
                  >
                    <Icon
                      className="h-4 w-4 text-slate-300"
                      aria-hidden="true"
                    />
                    <span>{t.label}</span>
                    {showBadge && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500 text-slate-950">
                        {pendingTradesCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ThemeSwitcher className="hidden sm:inline-flex" />

            {profile?.role === 'master' && (
              <Link href="/master">
                <Button variant="outline" size="sm">
                  <Shield className="h-3.5 w-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Painel Mestre</span>
                </Button>
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onLogout}
              title="Sair da conta"
              aria-label="Sair da conta"
              className="text-rose-300 hover:text-rose-200 hover:bg-rose-500/15"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Status HUD */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        <section
          aria-label="Resumo do personagem"
          className="rounded-2xl surface-card p-4 sm:p-5 relative overflow-hidden"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            {/* Identity */}
            <div className="flex items-center gap-4 min-w-0">
              <UserAvatar
                src={profile?.photoURL}
                name={profile?.username}
                className="h-14 w-14 rounded-2xl text-lg"
                borderColor={`${rankMeta.color}66`}
              />

              <div className="min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight truncate">
                    {profile?.username}
                  </h1>
                  <button
                    type="button"
                    onClick={openRenameModal}
                    aria-label="Editar nome do personagem"
                    title="Alterar nome do personagem"
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {isPartyLeader && (
                    <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30">
                      <Crown className="h-3 w-3" /> Líder
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <RankBadge rank={profile?.rank || 'F'} />
                  <Badge className="bg-white/5 text-slate-200 border-white/10 font-mono">
                    LVL {profile?.level || 1}
                  </Badge>
                  {myParty && (
                    <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                      {myParty.name}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Stats & Quick Action */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 lg:gap-6">
              <div className="flex items-center gap-5">
                <div className="space-y-0.5">
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
                    Ouro
                  </span>
                  <div className="flex items-center gap-1.5 text-lg font-extrabold font-mono text-amber-300 tabular-nums">
                    <Coins className="h-4 w-4 text-amber-400" aria-hidden="true" />
                    {formatNumber(profile?.gold || 0)}
                  </div>
                </div>

                <div className="flex-1 sm:w-52 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-semibold inline-flex items-center gap-1">
                      <Zap className="h-3 w-3 text-slate-300" aria-hidden="true" />
                      Experiência
                    </span>
                    <span className="font-mono text-slate-300 tabular-nums">{xpData.text}</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuenow={Math.round(xpData.percent)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Progresso de experiência"
                    className="h-2.5 w-full rounded-full bg-[var(--surface-0)] border border-[var(--border-subtle)] overflow-hidden"
                  >
                    <div
                      className="h-full rounded-full bg-slate-200 transition-all duration-500"
                      style={{ width: `${xpData.percent}%` }}
                    />
                  </div>
                </div>
              </div>

              <Button
                variant="secondary"
                onClick={onOpenRoulette || onRequestSpin}
                className="border-white/15 hover:border-white/30 hover:bg-white/5"
                title="Girar a Roleta de Runas Arcanas"
              >
                <Dices className="h-4 w-4 text-slate-300" aria-hidden="true" />
                Roleta Arcana
              </Button>
            </div>
          </div>
        </section>

        {/* Active Tab Content */}
        <main>{children}</main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Navegação Mobile"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-[var(--border-subtle)] bg-[var(--surface-1)]/95 backdrop-blur-xl px-2 py-1.5 grid grid-cols-4 gap-1"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          const showBadge = t.id === 'players' && pendingTradesCount > 0;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTab(t.id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-semibold transition-colors relative',
                active ? 'text-white bg-white/10' : 'text-slate-400'
              )}
            >
              <Icon
                className="h-4 w-4 text-slate-300"
                aria-hidden="true"
              />
              <span>{t.label}</span>
              {showBadge && (
                <span className="absolute top-1 right-4 h-2 w-2 rounded-full bg-emerald-400" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Rename Modal */}
      <Modal
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="Nome do Personagem"
        description="Escolha como outros aventureiros e o Mestre verão você."
        maxWidth="max-w-sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="rename-hero-form" loading={renaming}>
              Salvar Nome
            </Button>
          </>
        }
      >
        <form id="rename-hero-form" onSubmit={handleRename}>
          <FormField label="Nome do Herói" htmlFor="hero-rename" required>
            <Input
              id="hero-rename"
              maxLength={40}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </FormField>
        </form>
      </Modal>
    </div>
  );
}
