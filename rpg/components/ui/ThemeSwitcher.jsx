'use client';

import { useRealmTheme } from '../providers/AppProviders';
import { cn } from '../../lib/utils';

export function ThemeSwitcher({ className }) {
  const { theme, setTheme, themes } = useRealmTheme();

  return (
    <div
      role="group"
      aria-label="Selecionar tema visual do reino"
      className={cn(
        'inline-flex items-center gap-2 rounded-full bg-[var(--surface-1)]/90 border border-[var(--border-subtle)] px-3 py-1.5 backdrop-blur-md',
        className
      )}
    >
      {themes.map((t) => {
        const active = theme === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setTheme(t.id)}
            title={t.label}
            aria-label={`Tema ${t.label}`}
            aria-pressed={active}
            className={cn(
              'h-4 w-4 rounded-full transition-all duration-150 border',
              active
                ? 'scale-125 border-white ring-2 ring-white/25'
                : 'border-white/20 opacity-65 hover:opacity-100 hover:scale-110'
            )}
            style={{ backgroundColor: t.color }}
          />
        );
      })}
    </div>
  );
}
