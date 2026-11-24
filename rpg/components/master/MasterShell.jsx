'use client';

import { useState } from 'react';
import Link from 'next/link';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Compass,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import {
  GiScrollUnfurled,
  GiSwapBag,
  GiTreasureMap,
} from 'react-icons/gi';
import Logo from '../../app/components/Logo';
import { Button } from '../ui/Button';
import { ThemeSwitcher } from '../ui/ThemeSwitcher';
import { RoleBadge } from '../ui/Badge';
import { UserAvatar } from '../ui/UserAvatar';
import { TabletopMusicTriggerButton } from '../music/TabletopMusicWidget';
import { MasterNarrationToolbar } from '../tabletop/TabletopImmersionModals';
import { cn } from '../../lib/utils';

const NAV_ITEMS = [
  { id: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
  { id: 'maps', label: 'Mesa & Mapas', icon: GiTreasureMap },
  { id: 'missions', label: 'Missões & Contratos', icon: GiScrollUnfurled },
  { id: 'shop', label: 'Loja & Economia', icon: GiSwapBag },
  { id: 'players', label: 'Heróis & Grupos', icon: Users },
  { id: 'requests', label: 'Solicitações', icon: Inbox },
  { id: 'permissions', label: 'Permissões', icon: ShieldCheck },
];

export function MasterShell({
  profile,
  activeSection,
  onSelectSection,
  pendingRequestsCount = 0,
  activeContractsCount = 0,
  commandItems = [],
  onLogout,
  children,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentNav = NAV_ITEMS.find((n) => n.id === activeSection) || NAV_ITEMS[0];

  const renderSidebarBody = (onNavigate) => (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3.5 xl:px-5 xl:py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <Logo size={32} subtitle="Painel Mestre" />
      </div>

      <nav className="flex-1 px-2.5 py-3 xl:px-3 xl:py-4 space-y-1 overflow-y-auto" aria-label="Navegação Administrativa">
        <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
          Gestão do Reino
        </p>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeSection === item.id;
          const badgeCount =
            item.id === 'requests'
              ? pendingRequestsCount
              : item.id === 'missions'
              ? activeContractsCount
              : 0;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectSection(item.id);
                if (onNavigate) onNavigate();
              }}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative w-full flex items-center justify-between gap-2.5 px-3 py-2 xl:px-3.5 xl:py-2.5 rounded-xl text-xs xl:text-sm font-medium transition-all',
                active
                  ? 'bg-white/10 text-white border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] border border-transparent'
              )}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-white/80"
                />
              )}
              <span className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className="h-4 w-4 shrink-0 text-slate-300"
                  aria-hidden="true"
                />
                <span className="truncate">{item.label}</span>
              </span>
              {badgeCount > 0 && (
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold tabular-nums',
                    item.id === 'requests'
                      ? 'bg-white/20 text-white border border-white/15'
                      : 'bg-white/10 text-slate-200 border border-white/15'
                  )}
                >
                  {badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-3 xl:p-4 border-t border-[var(--border-subtle)] space-y-2.5">
        <Link
          href="/player"
          className="flex items-center justify-center gap-2 w-full h-9 rounded-xl border border-white/10 bg-white/[0.03] text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/[0.07] hover:border-white/20 transition-colors"
        >
          <Compass className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
          Visão do Aventureiro
        </Link>

        <div className="rounded-xl bg-[var(--surface-0)]/75 border border-white/10 p-2.5 xl:p-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <UserAvatar
              src={profile?.photoURL}
              name={profile?.username}
              className="h-8 w-8 text-xs shrink-0"
            />
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-100 truncate">{profile?.username}</p>
              <RoleBadge role={profile?.role} className="mt-0.5 text-[10px] px-2 py-0" />
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onLogout}
            title="Sair da conta"
            aria-label="Sair da conta"
            className="text-rose-300 hover:text-rose-200 hover:bg-rose-500/15 shrink-0"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen realm-backdrop flex">
      {/* Desktop / Notebook Sidebar */}
      <aside className="hidden lg:flex lg:w-56 xl:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-[var(--border-subtle)] bg-[var(--surface-1)]/95 backdrop-blur-xl z-30">
        {renderSidebarBody()}
      </aside>

      {/* Mobile Drawer Sidebar */}
      <Dialog.Root open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm lg:hidden" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-[var(--surface-1)] border-r border-[var(--border-subtle)] lg:hidden focus:outline-none">
            <Dialog.Title className="sr-only">Menu Administrativo</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Fechar menu"
                className="absolute top-4 right-4 h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
            {renderSidebarBody(() => setMobileMenuOpen(false))}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-56 xl:pl-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#080a11]/90 backdrop-blur-2xl shadow-[0_8px_32px_-12px_rgba(0,0,0,0.75)]">
          <div className="w-full max-w-none mx-auto px-3 sm:px-5 xl:px-8 h-14 xl:h-16 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="outline"
                size="icon-sm"
                className="lg:hidden shrink-0"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Abrir menu administrativo"
              >
                <Menu className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base xl:text-lg font-bold text-white truncate">
                  {currentNav.label}
                </h1>
                <p className="hidden xl:block text-xs text-slate-400 truncate">
                  Painel Administrativo do Reino e Campanhas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <MasterNarrationToolbar />
              <TabletopMusicTriggerButton />
              <ThemeSwitcher className="hidden sm:inline-flex" />
            </div>
          </div>
        </header>

        <main
          className={cn(
            'flex-1 w-full mx-auto px-3 sm:px-5 xl:px-8 py-4 xl:py-6 space-y-4 xl:space-y-6',
            activeSection === 'maps' ? 'max-w-none' : 'max-w-7xl'
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
