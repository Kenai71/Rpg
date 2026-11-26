/* eslint-disable @next/next/no-img-element */
'use client';

import { useMemo, useRef, useState } from 'react';
import {
  FileText,
  GripHorizontal,
  Loader2,
  Maximize2,
  Minus,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Plus,
  Printer,
  X,
  ZoomIn,
} from 'lucide-react';
import fichaSchema from '../../lib/ficha-fields.json';
import { cn } from '../../lib/utils';
import {
  CharacterSheetModal,
  SheetPageCanvas,
  printFilledCharacterSheet,
  useRealtimeCharacterSheet,
  useSheetZoomAndScroll,
} from './EditablePdfSheet';

const INTERACTIVE_SELECTOR =
  'input, textarea, select, button, a, [role="checkbox"], [data-sheet-no-drag], [data-sheet-resize]';

/**
 * Ficha Editável (Ficha.pdf) em aberto na Mesa Tática do Aventureiro.
 *
 * - Edição direta em tempo real sincronizada com a aba Personagem e com a visão do Mestre
 *   via `useRealtimeCharacterSheet` (`character_sheets/{uid}`).
 * - Arrastável livremente pelo cabeçalho ou por qualquer área neutra/margem da ficha,
 *   com proteção rígida contra sobreposição sobre o mapa.
 * - Redimensionável pelas bordas/cantos sem jamais invadir a área do mapa.
 */
export function MapFloatingCharacterSheet({
  profile,
  sheetRect,
  isDragging = false,
  isResizing = false,
  collidedEdge = null,
  onStartDrag,
  onStartResize,
  onQuickDock,
  onClose,
}) {
  const sheetRootRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [pageFilter, setPageFilter] = useState('all'); // 'all' | 1 | 2
  const [scrollZoomMode, setScrollZoomMode] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  const {
    zoom: sheetZoom,
    zoomIn: handleZoomIn,
    zoomOut: handleZoomOut,
    zoomReset: handleZoomReset,
  } = useSheetZoomAndScroll({
    containerRef: sheetRootRef,
    scrollerRef: scrollContainerRef,
    minZoom: 0.65,
    maxZoom: 2.5,
    initialZoom: 1.0,
    wheelZoomWithoutCtrl: scrollZoomMode,
    active: Boolean(profile?.uid && sheetRect),
  });

  const sheetController = useRealtimeCharacterSheet(
    profile?.uid,
    profile,
    Boolean(profile?.uid)
  );

  const {
    fields,
    loading,
    saving,
    syncMeta,
    remoteFlashMap,
    filledCount,
    handleFieldChange,
    handleFieldFocus,
    handleFieldBlur,
    flushPending,
  } = sheetController;

  const visiblePages = useMemo(() => {
    if (pageFilter === 'all') return fichaSchema.pages;
    return fichaSchema.pages.filter((p) => p.page === pageFilter);
  }, [pageFilter]);

  const lastEditorLabel = useMemo(() => {
    if (!syncMeta?.updatedByName) return null;
    if (syncMeta.updatedBy === profile?.uid) return null;
    return syncMeta.updatedByRole === 'master'
      ? `Editado pelo Mestre (${syncMeta.updatedByName})`
      : `Editado por ${syncMeta.updatedByName}`;
  }, [syncMeta, profile?.uid]);

  if (!profile?.uid || !sheetRect) return null;

  const innerContentWidth = Math.max(240, sheetRect.width - 28);
  const renderedPageWidthPx = Math.round(innerContentWidth * sheetZoom);

  const handleHeaderPointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.target?.closest?.(INTERACTIVE_SELECTOR)) return;
    e.stopPropagation();
    onStartDrag?.(e, { fromHeader: true });
  };

  const handleBodyPointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.target?.closest?.(INTERACTIVE_SELECTOR)) return;

    // Permite arrastar a barra de rolagem nativa normalmente sem capturar drag da ficha
    const scroller = scrollContainerRef.current;
    if (scroller) {
      const rect = scroller.getBoundingClientRect();
      const hasVerticalScrollbar = scroller.scrollHeight > scroller.clientHeight + 2;
      const hasHorizontalScrollbar = scroller.scrollWidth > scroller.clientWidth + 2;
      if (hasVerticalScrollbar && e.clientX >= rect.right - 14) return;
      if (hasHorizontalScrollbar && e.clientY >= rect.bottom - 14) return;
    }

    e.stopPropagation();
    onStartDrag?.(e, { fromHeader: false });
  };

  return (
    <>
      <section
        ref={sheetRootRef}
        aria-label="Ficha editável do personagem na mesa"
        data-map-sheet-panel="true"
        data-map-overlay-scroll="true"
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          'absolute rounded-2xl bg-[#0a0d17]/96 backdrop-blur-2xl border flex flex-col overflow-hidden pointer-events-auto',
          isDragging || isResizing
            ? 'z-[34] border-white/30 shadow-[0_28px_75px_-12px_rgba(0,0,0,0.95)] ring-1 ring-white/15 select-none'
            : 'z-[28] border-white/15 shadow-[0_22px_56px_-14px_rgba(0,0,0,0.88)]',
          collidedEdge && 'border-sky-400/45'
        )}
        style={{
          left: `${sheetRect.x}px`,
          top: `${sheetRect.y}px`,
          width: `${sheetRect.width}px`,
          height: `${sheetRect.height}px`,
        }}
      >
        {/* Indicador luminoso de barreira física quando a ficha ou o mapa encosta no limite sem sobrepor */}
        {collidedEdge === 'left' && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.85)] z-40"
          />
        )}
        {collidedEdge === 'right' && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-2 right-0 w-[3px] rounded-l-full bg-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.85)] z-40"
          />
        )}
        {collidedEdge === 'top' && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-2 top-0 h-[3px] rounded-b-full bg-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.85)] z-40"
          />
        )}
        {collidedEdge === 'bottom' && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-2 bottom-0 h-[3px] rounded-t-full bg-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.85)] z-40"
          />
        )}

        {/* Cabeçalho Arrastável da Ficha */}
        <div
          onPointerDown={handleHeaderPointerDown}
          title="Clique e arraste para mover a ficha pela mesa (sem sobrepor o mapa)"
          className={cn(
            'px-3 py-2 border-b border-white/10 bg-[#0d111d]/95 flex items-center justify-between gap-2 shrink-0 select-none',
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <GripHorizontal className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
            <div className="h-7 w-7 rounded-lg bg-white/[0.06] border border-white/12 flex items-center justify-center shrink-0">
              <FileText className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs font-bold text-white truncate">
                  Ficha • {profile.username || 'Herói'}
                </span>
                {saving ? (
                  <Loader2
                    className="h-3 w-3 animate-spin text-slate-300 shrink-0"
                    title="Salvando e sincronizando..."
                  />
                ) : (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0"
                    title="Sincronizada em tempo real com a aba Personagem e com o Mestre"
                  />
                )}
              </div>
              <p className="text-[10px] text-slate-400 truncate leading-tight">
                {collidedEdge
                  ? 'Barreira do mapa — arraste ao redor sem sobrepor'
                  : lastEditorLabel
                  ? lastEditorLabel
                  : `Sincronizada • ${filledCount} campo${filledCount === 1 ? '' : 's'}`}
              </p>
            </div>
          </div>

          <div
            data-sheet-no-drag="true"
            className="flex items-center gap-1 shrink-0"
          >
            {/* Atalhos rápidos de posicionamento (Esquerda / Direita / Base) */}
            {onQuickDock && (
              <div className="hidden sm:inline-flex items-center p-0.5 rounded-lg bg-white/[0.04] border border-white/10">
                <button
                  type="button"
                  onClick={() => onQuickDock('left')}
                  title="Mover ficha para a esquerda do mapa"
                  aria-label="Mover ficha para a esquerda"
                  className="h-6 w-6 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <PanelLeft className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onQuickDock('bottom')}
                  title="Mover ficha para baixo do mapa"
                  aria-label="Mover ficha para baixo"
                  className="h-6 w-6 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <PanelBottom className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onQuickDock('right')}
                  title="Mover ficha para a direita do mapa"
                  aria-label="Mover ficha para a direita"
                  className="h-6 w-6 rounded-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <PanelRight className="h-3 w-3" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setFullscreenOpen(true)}
              title="Abrir ficha em tela cheia"
              aria-label="Abrir ficha em tela cheia"
              className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/15 transition-colors"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={async () => {
                await flushPending();
                onClose?.();
              }}
              title="Recolher ficha (reabra pela barra lateral)"
              aria-label="Recolher ficha"
              className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/15 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Sub-barra compacta: Páginas + Zoom independente da Ficha + Impressão */}
        <div
          data-sheet-no-drag="true"
          className="px-3 py-1.5 border-b border-white/[0.08] bg-[#0b0e18]/90 flex items-center justify-between gap-2 shrink-0 flex-wrap"
        >
          {/* Seletor de Páginas */}
          <div className="inline-flex items-center p-0.5 rounded-lg bg-white/[0.04] border border-white/10">
            {[
              { id: 'all', label: 'Todas' },
              { id: 1, label: 'Pág. 1' },
              { id: 2, label: 'Pág. 2' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPageFilter(opt.id)}
                className={cn(
                  'px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all',
                  pageFilter === opt.id
                    ? 'bg-white/15 text-white border border-white/20'
                    : 'text-slate-400 hover:text-white border border-transparent'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Controle de Zoom independente da Ficha */}
            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-white/[0.04] border border-white/10">
              <button
                type="button"
                onClick={handleZoomOut}
                title="Diminuir zoom da ficha"
                aria-label="Diminuir zoom da ficha"
                className="h-6 w-6 rounded-md flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Minus className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={handleZoomReset}
                title="Ajustar largura (100%) • Ctrl + Scroll dá zoom apenas na ficha onde está o cursor"
                className="px-1.5 text-[10px] font-mono font-bold text-slate-200 hover:text-white tabular-nums min-w-[38px] text-center"
              >
                {Math.round(sheetZoom * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                title="Aumentar zoom da ficha"
                aria-label="Aumentar zoom da ficha"
                className="h-6 w-6 rounded-md flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Plus className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => setScrollZoomMode((v) => !v)}
                aria-pressed={scrollZoomMode}
                title={
                  scrollZoomMode
                    ? 'Scroll do mouse dando Zoom na ficha (clique para voltar a Rolar • Ctrl+Scroll sempre dá zoom)'
                    : 'Ativar Zoom direto no scroll do mouse (ou segure Ctrl + Scroll a qualquer momento)'
                }
                aria-label="Alternar zoom direto no scroll da ficha"
                className={cn(
                  'h-6 w-6 rounded-md flex items-center justify-center transition-colors border',
                  scrollZoomMode
                    ? 'bg-white/15 text-white border-white/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/10 border-transparent'
                )}
              >
                <ZoomIn className="h-3 w-3" />
              </button>
            </div>

            <button
              type="button"
              onClick={async () => {
                await flushPending();
                printFilledCharacterSheet(profile.username, fields);
              }}
              title="Imprimir ou Salvar como PDF preenchido"
              aria-label="Imprimir ficha"
              className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/10 border border-white/10 transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Área Editável da Ficha (scroll isolado + zoom ancorado no cursor via Ctrl+Scroll) */}
        <div
          ref={scrollContainerRef}
          onPointerDown={handleBodyPointerDown}
          className={cn(
            'flex-1 min-h-0 overflow-auto overscroll-contain bg-[#070911] p-2.5 sm:p-3',
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          )}
        >
          {loading ? (
            <div className="h-full min-h-[240px] flex flex-col items-center justify-center gap-2.5 text-slate-300">
              <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
              <p className="text-[11px] font-mono text-slate-400">
                Carregando ficha sincronizada...
              </p>
            </div>
          ) : (
            <div className="min-w-full w-fit flex flex-col items-center gap-3.5 pb-4">
              {visiblePages.map((pageData) => (
                <div
                  key={pageData.page}
                  data-sheet-page-wrap="true"
                  style={{
                    width: `${Math.max(240, renderedPageWidthPx)}px`,
                  }}
                >
                  <div className="flex items-center justify-between mb-1 px-0.5 gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 shrink-0">
                      Página {pageData.page} de {fichaSchema.numPages}
                    </span>
                    <span className="text-[10px] text-slate-500 truncate">
                      Edite os campos ou arraste para mover
                    </span>
                  </div>

                  <SheetPageCanvas
                    pageData={pageData}
                    fields={fields}
                    interactive={true}
                    onFieldChange={handleFieldChange}
                    onFieldFocus={handleFieldFocus}
                    onFieldBlur={handleFieldBlur}
                    remoteFlashMap={remoteFlashMap}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alças de Redimensionamento (Bordas e Cantos — respeitam colisão rígida com o mapa) */}
        <div
          data-sheet-resize="true"
          onPointerDown={(e) => {
            e.stopPropagation();
            onStartResize?.(e, 'w');
          }}
          aria-hidden="true"
          className="absolute inset-y-3 left-0 w-1.5 cursor-ew-resize z-30 hover:bg-white/15 transition-colors"
        />
        <div
          data-sheet-resize="true"
          onPointerDown={(e) => {
            e.stopPropagation();
            onStartResize?.(e, 'e');
          }}
          aria-hidden="true"
          className="absolute inset-y-3 right-0 w-1.5 cursor-ew-resize z-30 hover:bg-white/15 transition-colors"
        />
        <div
          data-sheet-resize="true"
          onPointerDown={(e) => {
            e.stopPropagation();
            onStartResize?.(e, 'n');
          }}
          aria-hidden="true"
          className="absolute inset-x-3 top-0 h-1.5 cursor-ns-resize z-30 hover:bg-white/15 transition-colors"
        />
        <div
          data-sheet-resize="true"
          onPointerDown={(e) => {
            e.stopPropagation();
            onStartResize?.(e, 's');
          }}
          aria-hidden="true"
          className="absolute inset-x-3 bottom-0 h-1.5 cursor-ns-resize z-30 hover:bg-white/15 transition-colors"
        />
        <div
          data-sheet-resize="true"
          onPointerDown={(e) => {
            e.stopPropagation();
            onStartResize?.(e, 'nw');
          }}
          aria-hidden="true"
          className="absolute top-0 left-0 h-3 w-3 cursor-nwse-resize z-30"
        />
        <div
          data-sheet-resize="true"
          onPointerDown={(e) => {
            e.stopPropagation();
            onStartResize?.(e, 'ne');
          }}
          aria-hidden="true"
          className="absolute top-0 right-0 h-3 w-3 cursor-nesw-resize z-30"
        />
        <div
          data-sheet-resize="true"
          onPointerDown={(e) => {
            e.stopPropagation();
            onStartResize?.(e, 'sw');
          }}
          aria-hidden="true"
          className="absolute bottom-0 left-0 h-3.5 w-3.5 cursor-nesw-resize z-30 flex items-end justify-start p-0.5"
        >
          <span className="h-1.5 w-1.5 rounded-bl border-l border-b border-white/30" />
        </div>
        <div
          data-sheet-resize="true"
          onPointerDown={(e) => {
            e.stopPropagation();
            onStartResize?.(e, 'se');
          }}
          aria-hidden="true"
          className="absolute bottom-0 right-0 h-3.5 w-3.5 cursor-nwse-resize z-30 flex items-end justify-end p-0.5"
        >
          <span className="h-1.5 w-1.5 rounded-br border-r border-b border-white/30" />
        </div>
      </section>

      {/* Modal Tela Cheia compartilhando o MESMO sheetController (sincronização 0ms) */}
      <CharacterSheetModal
        open={fullscreenOpen}
        onOpenChange={setFullscreenOpen}
        heroUid={profile.uid}
        heroName={profile.username}
        editorProfile={profile}
        isMasterView={false}
        sheetController={sheetController}
      />
    </>
  );
}
