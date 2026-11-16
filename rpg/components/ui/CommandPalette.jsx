'use client';

import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, CornerDownLeft, Search, Palette, X } from 'lucide-react';
import { useRealmTheme } from '../providers/AppProviders';
import { cn } from '../../lib/utils';

/**
 * Paleta de Comando rápida estilo workspace moderno (Ctrl+K / Cmd+K).
 * Permite navegar entre abas, localizar missões, itens, aliados e alternar temas.
 */
export function CommandPalette({ open, onOpenChange, items = [], placeholder = 'Buscar missões, itens, aliados ou comandos...' }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const { themes, theme, setTheme } = useRealmTheme();

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  const themeActions = useMemo(
    () =>
      themes.map((t) => ({
        id: `theme-${t.id}`,
        group: 'Temas do Reino',
        label: `Tema: ${t.label}`,
        meta: theme === t.id ? 'Ativo' : 'Aplicar',
        icon: Palette,
        color: t.color,
        onSelect: () => setTheme(t.id),
      })),
    [themes, theme, setTheme]
  );

  const combined = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = [...items, ...themeActions];
    if (!q) return all.slice(0, 14);
    return all
      .filter((entry) => {
        const hay = `${entry.label || ''} ${entry.meta || ''} ${entry.group || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 16);
  }, [items, themeActions, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const executeItem = (entry) => {
    if (!entry) return;
    onOpenChange(false);
    entry.onSelect?.();
  };

  const handleKeyDown = (e) => {
    if (!combined.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % combined.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + combined.length) % combined.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executeItem(combined[activeIndex]);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map();
    combined.forEach((entry, idx) => {
      const groupName = entry.group || 'Navegação';
      if (!map.has(groupName)) map.set(groupName, []);
      map.get(groupName).push({ ...entry, flatIndex: idx });
    });
    return Array.from(map.entries());
  }, [combined]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm" />
        <Dialog.Content
          onKeyDown={handleKeyDown}
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-2xl surface-card border border-[var(--border-strong)] shadow-2xl overflow-hidden focus:outline-none"
        >
          <Dialog.Title className="sr-only">Busca Rápida e Comandos</Dialog.Title>
          <Dialog.Description className="sr-only">
            Pesquise missões, equipamentos, aventureiros ou alterne módulos e temas.
          </Dialog.Description>

          <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--border-subtle)] bg-black/20">
            <Search className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              aria-label={placeholder}
              className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
            />
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Fechar busca rápida"
                className="h-7 px-2 rounded-lg text-[11px] font-mono text-slate-400 hover:text-white bg-white/5 border border-white/10 inline-flex items-center gap-1"
              >
                <span className="hidden sm:inline">ESC</span>
                <X className="h-3.5 w-3.5 sm:hidden" />
              </button>
            </Dialog.Close>
          </div>

          <div className="max-h-[55vh] overflow-y-auto p-2 space-y-3">
            {grouped.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                Nenhum resultado encontrado para &ldquo;{query}&rdquo;.
              </div>
            ) : (
              grouped.map(([groupName, entries]) => (
                <div key={groupName} className="space-y-1">
                  <p className="px-3 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                    {groupName}
                  </p>
                  {entries.map((entry) => {
                    const Icon = entry.icon || ArrowRight;
                    const isSelected = entry.flatIndex === activeIndex;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onMouseEnter={() => setActiveIndex(entry.flatIndex)}
                        onClick={() => executeItem(entry)}
                        className={cn(
                          'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition-colors',
                          isSelected
                            ? 'bg-white/10 text-white border border-white/20'
                            : 'text-slate-300 hover:bg-white/[0.04] border border-transparent'
                        )}
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <Icon
                            className="h-4 w-4 shrink-0"
                            style={entry.color ? { color: entry.color } : undefined}
                            aria-hidden="true"
                          />
                          <span className="truncate font-medium">{entry.label}</span>
                        </span>
                        <span className="flex items-center gap-2 shrink-0 text-[11px] font-mono text-slate-400">
                          {entry.meta && <span>{entry.meta}</span>}
                          {isSelected && <CornerDownLeft className="h-3.5 w-3.5 text-slate-300" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          <div className="px-4 py-2.5 border-t border-[var(--border-subtle)] bg-black/25 flex items-center justify-between text-[11px] text-slate-500">
            <span>Use ↑ ↓ para navegar e Enter para abrir</span>
            <span className="font-mono">Ctrl+K / ⌘K</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
