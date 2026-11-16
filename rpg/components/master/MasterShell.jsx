'use client';

import { useState } from 'react';
import Link from 'next/link';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Bot,
  Compass,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Scroll,
  ShieldCheck,
  ShoppingBag,
  Users,
  X,
} from 'lucide-react';
import Logo from '../../app/components/Logo';
import { Button } from '../ui/Button';
import { ThemeSwitcher } from '../ui/ThemeSwitcher';
import { RoleBadge } from '../ui/Badge';
import { cn } from '../../lib/utils';

const NAV_ITEMS = [
  { id: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
  { id: 'missions', label: 'Missões & Contratos', icon: Scroll },
  { id: 'shop', label: 'Loja & Economia', icon: ShoppingBag },
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
  isGenerating = false,
  onGenerateDaily,
  onLogout,
  children,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentNav = NAV_ITEMS.find((n) => n.id === activeSection) || NAV_ITEMS[0];

  const renderSidebarBody = (onNavigate) => (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <Logo size={36} subtitle="Painel Mestre" />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Navegação Administrativa">
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
                'w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all',
                active
                  ? 'bg-[var(--accent-soft)] text-white border border-[var(--accent-primary)]/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] border border-transparent'
              )}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon
                  className={cn('h-4 w-4 shrink-0', active ? 'text-[var(--accent-glow)]' : '')}
                  aria-hidden="true"
                />
                <span className="truncate">{item.label}</span>
              </span>
              {badgeCount > 0 && (
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-[11px] font-mono font-bold tabular-nums',
                    item.id === 'requests'
                      ? 'bg-[var(--accent-primary)] text-white'
                      : 'bg-amber-500/20 text-amber-300'
                  )}
                >
                  {badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[var(--border-subtle)] space-y-3">
        <Link
          href="/player"
          className="flex items-center justify-center gap-2 w-full h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-0)]/60 text-xs font-semibold text-slate-300 hover:text-white hover:border-[var(--border-strong)] transition-colors"
        >
          <Compass className="h-3.5 w-3.5 text-[var(--accent-glow)]" aria-hidden="true" />
          Visão do Aventureiro
        </Link>

        <div className="rounded-xl bg-[var(--surface-0)]/70 border border-[var(--border-subtle)] p-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-100 truncate">{profile?.username}</p>
            <RoleBadge role={profile?.role} className="mt-1 text-[10px] px-2 py-0" />
          </div>
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
    </div>
  );

  return (
    <div className="min-h-screen realm-backdrop flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-[var(--border-subtle)] bg-[var(--surface-1)]/95 backdrop-blur-xl z-30">
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
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 border-b border-[var(--border-subtle)] bg-[var(--surface-0)]/85 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
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
                <h1 className="text-base sm:text-lg font-bold text-white truncate">
                  {currentNav.label}
                </h1>
                <p className="hidden sm:block text-xs text-slate-400 truncate">
                  Controle em tempo real do mundo, economia e aventureiros
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <ThemeSwitcher className="hidden sm:inline-flex" />
              <Button
                variant="primary"
                size="sm"
                onClick={onGenerateDaily}
                loading={isGenerating}
                className="whitespace-nowrap"
              >
                {!isGenerating && <Bot className="h-4 w-4" aria-hidden="true" />}
                <span className="hidden sm:inline">
                  {isGenerating ? 'Gerando...' : 'Gerar Diária (IA)'}
                </span>
                <span className="sm:hidden">{isGenerating ? '...' : 'IA'}</span>
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
