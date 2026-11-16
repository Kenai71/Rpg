'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Painel inspetor lateral (desktop) / bottom sheet (mobile) estilo vvd.world,
 * permitindo inspecionar e agir sobre um card sem perder o contexto do catálogo.
 */
export function DetailDrawer({
  open,
  onOpenChange,
  title,
  subtitle,
  badge,
  accentColor,
  footer,
  children,
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            'fixed z-50 bg-[var(--surface-1)] border-[var(--border-strong)] shadow-2xl flex flex-col focus:outline-none overflow-hidden',
            'inset-x-0 bottom-0 max-h-[88vh] rounded-t-3xl border-t',
            'md:inset-y-3 md:right-3 md:left-auto md:w-full md:max-w-md md:max-h-none md:rounded-2xl md:border'
          )}
          style={
            accentColor
              ? { boxShadow: `0 24px 60px rgba(0,0,0,0.8), 0 0 36px -14px ${accentColor}55` }
              : undefined
          }
        >
          {/* Specular top edge */}
          <div
            className="h-1 w-full shrink-0"
            style={{ backgroundColor: accentColor || 'rgba(255, 255, 255, 0.2)' }}
          />

          <div className="px-6 pt-5 pb-4 border-b border-[var(--border-subtle)] flex items-start justify-between gap-4 shrink-0">
            <div className="space-y-1.5 min-w-0">
              {badge && <div className="flex items-center gap-2 flex-wrap">{badge}</div>}
              {title && (
                <Dialog.Title className="text-lg font-extrabold text-white tracking-tight leading-snug">
                  {title}
                </Dialog.Title>
              )}
              {subtitle && (
                <Dialog.Description className="text-xs text-slate-400">
                  {subtitle}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Fechar detalhes"
                className="h-9 w-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">{children}</div>

          {footer && (
            <div className="px-6 py-4 border-t border-[var(--border-subtle)] bg-black/25 shrink-0">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
