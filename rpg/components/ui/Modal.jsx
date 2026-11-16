'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  maxWidth = 'max-w-lg',
  hideClose = false,
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm data-[state=open]:animate-in" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2',
            'rounded-2xl bg-[var(--surface-1)] border border-[var(--border-strong)] shadow-2xl',
            'max-h-[90vh] flex flex-col overflow-hidden focus:outline-none',
            maxWidth
          )}
        >
          {(title || !hideClose) && (
            <div className="px-6 pt-5 pb-4 border-b border-[var(--border-subtle)] flex items-start justify-between gap-4 shrink-0">
              <div className="space-y-1 min-w-0">
                {title && (
                  <Dialog.Title className="text-lg font-bold text-slate-50 tracking-tight">
                    {title}
                  </Dialog.Title>
                )}
                {description && (
                  <Dialog.Description className="text-xs text-slate-400 leading-relaxed">
                    {description}
                  </Dialog.Description>
                )}
              </div>
              {!hideClose && (
                <Dialog.Close asChild>
                  <button
                    type="button"
                    aria-label="Fechar janela"
                    className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </Dialog.Close>
              )}
            </div>
          )}

          <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>

          {footer && (
            <div className="px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--surface-0)]/50 flex flex-wrap items-center justify-end gap-2.5 shrink-0">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  loading = false,
  onConfirm,
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      maxWidth="max-w-md"
      title={
        <span className="flex items-center gap-2.5">
          <span
            className={cn(
              'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
              variant === 'danger'
                ? 'bg-rose-500/15 text-rose-400'
                : 'bg-amber-500/15 text-amber-400'
            )}
          >
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          </span>
          <span>{title}</span>
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-300 leading-relaxed">{description}</p>
    </Modal>
  );
}
