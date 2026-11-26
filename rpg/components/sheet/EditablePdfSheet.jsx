/* eslint-disable @next/next/no-img-element */
'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Check,
  Edit3,
  FileText,
  Loader2,
  Maximize2,
  Minus,
  Plus,
  Printer,
  RotateCcw,
  Shield,
  User,
  X,
  ZoomIn,
} from 'lucide-react';
import { toast } from 'sonner';
import fichaSchema from '../../lib/ficha-fields.json';
import {
  saveCharacterSheetFields,
  subscribeCharacterSheet,
} from '../../lib/rpg-service';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';

const PAGE_ASPECT_RATIO = 603 / 774;

/**
 * Classifica o estilo visual da marcação de checkbox conforme a arte oficial do Ficha.pdf:
 * - Círculos de salvaguarda e perícias na página 1 (colunas em left ≈ 3.15% e 20.90%)
 * - Losangos (diamantes) nas demais marcações (Testes de Morte, Armaduras, Espaços de Magia, C/R/M, Sintonização)
 */
function getCheckboxShape(pageNumber, field) {
  if (pageNumber === 1) {
    if (Math.abs(field.left - 3.151) < 0.6 || Math.abs(field.left - 20.896) < 0.6) {
      return 'circle';
    }
    if (field.name === 'checkbox_174cik') {
      return 'emblem';
    }
  }
  return 'diamond';
}

function getFieldFontSize(field, pageWidthPx, isPreview = false) {
  const pt = Number(field.fontSize) || 9;
  const effectivePt = isPreview
    ? field.type === 'textarea'
      ? Math.max(8.5, Math.min(18, pt))
      : Math.max(10.5, Math.min(18, pt))
    : Math.max(7.2, Math.min(18, pt));

  if (pageWidthPx > 0) {
    const px = (effectivePt / 603) * pageWidthPx;
    const minPx = isPreview ? (field.type === 'textarea' ? 5.5 : 6.8) : 6;
    return `${Math.max(minPx, px).toFixed(2)}px`;
  }
  return `${((effectivePt / 603) * 100).toFixed(3)}cqw`;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renderiza uma única página da Ficha.pdf (em modo preview reduzido ou modo interativo editável)
 */
export function SheetPageCanvas({
  pageData,
  fields,
  interactive = false,
  onFieldChange,
  onFieldFocus,
  onFieldBlur,
  remoteFlashMap = {},
}) {
  const pageContainerRef = useRef(null);
  const [renderedWidth, setRenderedWidth] = useState(0);

  useEffect(() => {
    const el = pageContainerRef.current;
    if (!el) return undefined;

    const updateWidth = () => {
      const w = el.clientWidth;
      if (w > 0) setRenderedWidth(w);
    };
    updateWidth();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(updateWidth);
      ro.observe(el);
      return () => ro.disconnect();
    }
    return undefined;
  }, []);

  return (
    <div
      ref={pageContainerRef}
      className="pdf-sheet-page relative w-full bg-white rounded-lg overflow-hidden shadow-[0_14px_45px_rgba(0,0,0,0.65)] ring-1 ring-white/15 select-none"
      style={{ aspectRatio: `${pageData.width} / ${pageData.height}` }}
    >
      <img
        src={pageData.image}
        alt={`Ficha D&D 2024 — Página ${pageData.page}`}
        draggable={false}
        className="w-full h-full block object-fill pointer-events-none select-none"
      />

      {/* Camada de Campos AcroForm alinhados 1:1 com Ficha.pdf */}
      <div className={cn('absolute inset-0 z-10', !interactive && 'pointer-events-none')}>
        {pageData.fields.map((field) => {
          const val = fields[field.name];
          const isFlashing = Boolean(remoteFlashMap[field.name]);

          if (field.type === 'checkbox') {
            const checked = Boolean(val);
            const shape = getCheckboxShape(pageData.page, field);
            const centerX = field.left + field.width / 2;
            const centerY = field.top + field.height / 2;
            const markSizePct = shape === 'emblem' ? 1.55 : shape === 'circle' ? 1.15 : 1.08;
            const markHeightPct = markSizePct * PAGE_ASPECT_RATIO;

            if (!interactive) {
              if (!checked) return null;
              return (
                <span
                  key={field.name}
                  className={cn(
                    'absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none',
                    isFlashing && 'pdf-remote-flash rounded-full'
                  )}
                  style={{
                    left: `${centerX}%`,
                    top: `${centerY}%`,
                    width: `${markSizePct}%`,
                    height: `${markHeightPct}%`,
                  }}
                >
                  <span
                    className={cn(
                      'block w-[82%] h-[82%] bg-[#090d16]',
                      shape === 'circle' ? 'rounded-full' : 'rotate-45 rounded-[1px]'
                    )}
                  />
                </span>
              );
            }

            return (
              <button
                key={field.name}
                type="button"
                role="checkbox"
                aria-checked={checked}
                aria-label={`Marcar campo ${field.name}`}
                onClick={() => onFieldChange?.(field.name, !checked, true)}
                className={cn(
                  'absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center cursor-pointer transition-all group',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/80 rounded-full',
                  isFlashing && 'pdf-remote-flash'
                )}
                style={{
                  left: `${centerX}%`,
                  top: `${centerY}%`,
                  width: `${Math.max(markSizePct * 1.45, 1.5)}%`,
                  height: `${Math.max(markHeightPct * 1.45, 1.2)}%`,
                }}
              >
                <span
                  className={cn(
                    'block transition-all duration-150',
                    shape === 'circle' ? 'rounded-full' : 'rotate-45 rounded-[1px]',
                    checked
                      ? 'w-[58%] h-[58%] bg-[#111827] shadow-[0_0_0_0.5px_rgba(17,24,39,0.5)] scale-100'
                      : 'w-[54%] h-[54%] bg-sky-500/0 group-hover:bg-sky-500/30 scale-90'
                  )}
                />
              </button>
            );
          }

          const strVal = typeof val === 'string' ? val : val ? String(val) : '';
          const fontSizeVal = getFieldFontSize(field, renderedWidth, !interactive);

          if (!interactive) {
            if (!strVal) return null;
            return (
              <div
                key={field.name}
                className={cn(
                  'absolute text-[#090d16] pointer-events-none',
                  field.type === 'textarea'
                    ? 'overflow-hidden font-semibold whitespace-pre-wrap break-words leading-[1.3] px-[0.7%] py-[0.5%]'
                    : 'overflow-visible font-bold flex items-center whitespace-nowrap leading-none px-[0.35%]',
                  isFlashing && 'pdf-remote-flash rounded-[2px]'
                )}
                style={{
                  left: `${field.left}%`,
                  top: `${field.top}%`,
                  width: `${field.width}%`,
                  height: `${field.height}%`,
                  fontSize: fontSizeVal,
                  textAlign: field.align || 'left',
                  justifyContent:
                    field.type !== 'textarea'
                      ? field.align === 'center'
                        ? 'center'
                        : field.align === 'right'
                        ? 'flex-end'
                        : 'flex-start'
                      : undefined,
                }}
              >
                {strVal}
              </div>
            );
          }

          if (field.type === 'textarea') {
            return (
              <textarea
                key={field.name}
                value={strVal}
                maxLength={field.maxLen || 6000}
                onFocus={() => onFieldFocus?.(field.name)}
                onBlur={() => onFieldBlur?.(field.name)}
                onChange={(e) => onFieldChange?.(field.name, e.target.value, false)}
                spellCheck={false}
                className={cn(
                  'pdf-sheet-field absolute resize-none overflow-y-auto font-medium leading-[1.34] px-[0.9%] py-[0.6%] rounded-[2px] transition-colors',
                  isFlashing && 'pdf-remote-flash'
                )}
                style={{
                  left: `${field.left}%`,
                  top: `${field.top}%`,
                  width: `${field.width}%`,
                  height: `${field.height}%`,
                  fontSize: fontSizeVal,
                  textAlign: field.align || 'left',
                }}
              />
            );
          }

          return (
            <input
              key={field.name}
              type="text"
              value={strVal}
              maxLength={field.maxLen || 240}
              onFocus={() => onFieldFocus?.(field.name)}
              onBlur={() => onFieldBlur?.(field.name)}
              onChange={(e) => onFieldChange?.(field.name, e.target.value, false)}
              spellCheck={false}
              autoComplete="off"
              className={cn(
                'pdf-sheet-field absolute font-medium leading-none px-[0.45%] py-0 rounded-[2px] transition-colors',
                isFlashing && 'pdf-remote-flash'
              )}
              style={{
                left: `${field.left}%`,
                top: `${field.top}%`,
                width: `${field.width}%`,
                height: `${field.height}%`,
                fontSize: fontSizeVal,
                textAlign: field.align || 'left',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * Hook compartilhado de sincronização em tempo real da Ficha.pdf (Jogador <-> Mestre)
 */
export function useRealtimeCharacterSheet(heroUid, editorProfile, enabled = true) {
  const [fields, setFields] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncMeta, setSyncMeta] = useState({
    updatedBy: null,
    updatedByName: null,
    updatedByRole: null,
    storageMode: 'collection',
  });
  const [remoteFlashMap, setRemoteFlashMap] = useState({});

  const sessionIdRef = useRef(
    `tab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  );
  const pendingPatchRef = useRef({});
  const inFlightPatchRef = useRef({});
  const debounceTimerRef = useRef(null);
  const maxWaitTimerRef = useRef(null);
  const focusedFieldRef = useRef(null);
  const lastRemoteFieldsRef = useRef({});
  const storageModeRef = useRef('collection');
  const docExistsRef = useRef(false);
  const initializedRef = useRef(false);
  const editorProfileRef = useRef(editorProfile);
  editorProfileRef.current = editorProfile;

  const flushPending = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (maxWaitTimerRef.current) {
      clearTimeout(maxWaitTimerRef.current);
      maxWaitTimerRef.current = null;
    }
    const patch = { ...pendingPatchRef.current };
    const keys = Object.keys(patch);
    if (!heroUid || keys.length === 0) return;

    pendingPatchRef.current = {};
    inFlightPatchRef.current = { ...inFlightPatchRef.current, ...patch };
    setSaving(true);
    try {
      const result = await saveCharacterSheetFields(
        heroUid,
        patch,
        editorProfileRef.current,
        {
          preferredStorage: storageModeRef.current,
          docExists: docExistsRef.current,
          sessionId: sessionIdRef.current,
        }
      );
      if (result?.storageMode) {
        storageModeRef.current = result.storageMode;
      }
      if (typeof result?.docExists === 'boolean') {
        docExistsRef.current = result.docExists;
      }
    } catch (err) {
      // Restaura campos não salvos para nova tentativa
      pendingPatchRef.current = { ...patch, ...pendingPatchRef.current };
      toast.error(err?.message || 'Erro ao sincronizar alterações da ficha.');
    } finally {
      keys.forEach((k) => {
        if (inFlightPatchRef.current[k] === patch[k]) {
          delete inFlightPatchRef.current[k];
        }
      });
      if (Object.keys(inFlightPatchRef.current).length === 0) {
        setSaving(false);
      }
    }
  }, [heroUid]);

  useEffect(() => {
    if (!enabled || !heroUid) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    initializedRef.current = false;
    pendingPatchRef.current = {};
    inFlightPatchRef.current = {};
    lastRemoteFieldsRef.current = {};
    docExistsRef.current = false;

    const unsub = subscribeCharacterSheet(
      heroUid,
      (sheetData) => {
        const incoming = sheetData?.fields || {};
        if (sheetData?.storageMode) {
          storageModeRef.current = sheetData.storageMode;
        }
        if (typeof sheetData?.docExists === 'boolean') {
          docExistsRef.current = sheetData.docExists;
        }

        const prevRemote = lastRemoteFieldsRef.current;
        const isFromOtherSession = sheetData?.updatedBySession
          ? sheetData.updatedBySession !== sessionIdRef.current
          : Boolean(sheetData?.updatedBy && sheetData.updatedBy !== editorProfileRef.current?.uid);
        const changedByOther = initializedRef.current && isFromOtherSession;

        const flashed = {};
        if (changedByOther) {
          const allKeys = new Set([...Object.keys(prevRemote), ...Object.keys(incoming)]);
          allKeys.forEach((k) => {
            if (
              prevRemote[k] !== incoming[k] &&
              !(k in pendingPatchRef.current) &&
              !(k in inFlightPatchRef.current)
            ) {
              flashed[k] = true;
            }
          });
        }

        lastRemoteFieldsRef.current = incoming;
        initializedRef.current = true;

        setFields((prevLocal) => {
          const next = { ...incoming };
          // Preserva digitação em voo e pendente local para evitar retrocesso de cursor
          Object.entries(inFlightPatchRef.current).forEach(([k, v]) => {
            next[k] = v;
          });
          Object.entries(pendingPatchRef.current).forEach(([k, v]) => {
            next[k] = v;
          });
          // Se o campo estiver focado mas não foi editado por outra sessão, mantém estado local
          const focusedKey = focusedFieldRef.current;
          if (focusedKey && !(focusedKey in flashed) && focusedKey in prevLocal) {
            next[focusedKey] = prevLocal[focusedKey];
          }
          return next;
        });

        setSyncMeta({
          updatedBy: sheetData?.updatedBy || null,
          updatedByName: sheetData?.updatedByName || null,
          updatedByRole: sheetData?.updatedByRole || null,
          storageMode: sheetData?.storageMode || 'collection',
        });
        setLoading(false);

        if (Object.keys(flashed).length > 0) {
          setRemoteFlashMap((prev) => ({ ...prev, ...flashed }));
          setTimeout(() => {
            setRemoteFlashMap((prev) => {
              const copy = { ...prev };
              Object.keys(flashed).forEach((k) => delete copy[k]);
              return copy;
            });
          }, 1500);
        }
      },
      (err) => {
        console.error('Erro ao ouvir ficha em tempo real:', err);
        setLoading(false);
      }
    );

    const handlePageHide = () => {
      flushPending();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushPending();
      }
    };
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      flushPending();
      if (typeof unsub === 'function') unsub();
    };
  }, [heroUid, enabled, flushPending]);

  const handleFieldChange = useCallback(
    (fieldName, value, immediate = false) => {
      setFields((prev) => ({ ...prev, [fieldName]: value }));
      pendingPatchRef.current[fieldName] = value;

      if (immediate) {
        flushPending();
        return;
      }

      // Envio ultra-rápido (120ms debounce + flush contínuo a cada 250ms durante digitação)
      // para Mestre e Jogador verem as alterações ao vivo enquanto escrevem!
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        flushPending();
      }, 120);

      if (!maxWaitTimerRef.current) {
        maxWaitTimerRef.current = setTimeout(() => {
          flushPending();
        }, 250);
      }
    },
    [flushPending]
  );

  const handleFieldFocus = useCallback((fieldName) => {
    focusedFieldRef.current = fieldName;
  }, []);

  const handleFieldBlur = useCallback(
    (fieldName) => {
      if (focusedFieldRef.current === fieldName) {
        focusedFieldRef.current = null;
      }
      if (fieldName in pendingPatchRef.current) {
        flushPending();
      }
    },
    [flushPending]
  );

  const filledCount = useMemo(() => {
    return Object.values(fields).filter((v) => {
      if (typeof v === 'boolean') return v;
      return typeof v === 'string' && v.trim().length > 0;
    }).length;
  }, [fields]);

  return {
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
  };
}

/**
 * Gera uma janela limpa de impressão / Salvar como PDF com as 2 páginas preenchidas da Ficha.pdf
 */
export function printFilledCharacterSheet(heroName, fields) {
  if (typeof window === 'undefined') return;
  const origin = window.location.origin;

  const pagesHtml = fichaSchema.pages
    .map((pageData) => {
      const overlays = pageData.fields
        .map((field) => {
          const val = fields[field.name];
          if (field.type === 'checkbox') {
            if (!val) return '';
            const shape = getCheckboxShape(pageData.page, field);
            const cx = field.left + field.width / 2;
            const cy = field.top + field.height / 2;
            const w = shape === 'emblem' ? 1.3 : shape === 'circle' ? 0.92 : 0.88;
            const h = w * PAGE_ASPECT_RATIO;
            const radius = shape === 'circle' ? '9999px' : '1px';
            const transform =
              shape === 'circle'
                ? 'translate(-50%,-50%)'
                : 'translate(-50%,-50%) rotate(45deg)';
            return `<div style="position:absolute;left:${cx}%;top:${cy}%;width:${w}%;height:${h}%;background:#111827;border-radius:${radius};transform:${transform};"></div>`;
          }
          const strVal = typeof val === 'string' ? val : val ? String(val) : '';
          if (!strVal) return '';
          const fontSizePt = Math.max(7.2, Math.min(18, Number(field.fontSize) || 9));
          const fontCqw = ((fontSizePt / 603) * 100).toFixed(3);
          const isArea = field.type === 'textarea';
          const align = field.align || 'left';
          const jc =
            align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
          return `<div style="position:absolute;left:${field.left}%;top:${field.top}%;width:${field.width}%;height:${field.height}%;font-size:${fontCqw}cqw;color:#111827;font-weight:500;text-align:${align};overflow:hidden;${
            isArea
              ? 'white-space:pre-wrap;word-break:break-word;line-height:1.34;padding:0.6% 0.9%;'
              : `display:flex;align-items:center;justify-content:${jc};white-space:nowrap;line-height:1;padding:0 0.45%;`
          }">${escapeHtml(strVal)}</div>`;
        })
        .join('');

      return `
        <section class="print-page">
          <img src="${origin}${pageData.image}" alt="Página ${pageData.page}" />
          <div class="overlay">${overlays}</div>
        </section>
      `;
    })
    .join('');

  const printWin = window.open('', '_blank', 'width=960,height=1100');
  if (!printWin) {
    toast.error('Permita pop-ups para imprimir ou salvar o PDF preenchido.');
    return;
  }

  printWin.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Ficha — ${escapeHtml(heroName || 'Personagem')}</title>
  <style>
    @page { size: letter portrait; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; background: #111827; font-family: Inter, system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 16px; }
    .print-page { position: relative; width: 210mm; aspect-ratio: 603 / 774; background: #fff; container-type: inline-size; page-break-after: always; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
    .print-page:last-child { page-break-after: auto; }
    .print-page img { width: 100%; height: 100%; display: block; object-fit: fill; }
    .overlay { position: absolute; inset: 0; }
    @media print {
      body { background: #fff; padding: 0; gap: 0; }
      .print-page { width: 100vw; box-shadow: none; }
    }
  </style>
</head>
<body>
  ${pagesHtml}
  <script>
    const imgs = Array.from(document.images);
    Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })))
      .then(() => setTimeout(() => window.print(), 250));
  </script>
</body>
</html>`);
  printWin.document.close();
}

/**
 * Hook de zoom ancorado no cursor e rolagem isolada exclusivos da Ficha.pdf:
 * - Intercepta Ctrl+Scroll e pinça no trackpad ({ passive: false }) impedindo que o navegador
 *   aplique zoom na página inteira — dá zoom APENAS na ficha exatamente onde o cursor está.
 * - Preserva rolagem vertical/horizontal fluida dentro da ficha (inclusive com zoom ativo)
 *   e suporta alternar modo "Zoom com Scroll" para usar a rodinha direto sem segurar Ctrl.
 */
export function useSheetZoomAndScroll({
  containerEl = null,
  containerRef = null,
  scrollerRef,
  minZoom = 0.6,
  maxZoom = 2.5,
  initialZoom = 1.0,
  wheelZoomWithoutCtrl = false,
  active = true,
}) {
  const [zoom, setZoom] = useState(initialZoom);
  const zoomRef = useRef(initialZoom);
  zoomRef.current = zoom;
  const wheelZoomModeRef = useRef(wheelZoomWithoutCtrl);
  wheelZoomModeRef.current = wheelZoomWithoutCtrl;
  const pendingAnchorRef = useRef(null);

  const captureAnchor = useCallback(
    (rawClientX, rawClientY) => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const scrollerRect = scroller.getBoundingClientRect();
      if (scrollerRect.width <= 0 || scrollerRect.height <= 0) return;

      const clientX = Math.max(scrollerRect.left, Math.min(scrollerRect.right, rawClientX));
      const clientY = Math.max(scrollerRect.top, Math.min(scrollerRect.bottom, rawClientY));
      const relVpX = clientX - scrollerRect.left;
      const relVpY = clientY - scrollerRect.top;

      const pages = Array.from(scroller.querySelectorAll('[data-sheet-page-wrap]'));
      let targetEl = pages[0] || scroller.firstElementChild;
      for (const pg of pages) {
        const r = pg.getBoundingClientRect();
        if (clientY >= r.top && clientY <= r.bottom) {
          targetEl = pg;
          break;
        }
        if (clientY < r.top) {
          targetEl = pg;
          break;
        }
        targetEl = pg;
      }
      if (!targetEl) return;

      const targetRect = targetEl.getBoundingClientRect();
      if (targetRect.width <= 0 || targetRect.height <= 0) return;

      pendingAnchorRef.current = {
        targetEl,
        fracX: (clientX - targetRect.left) / targetRect.width,
        fracY: (clientY - targetRect.top) / targetRect.height,
        relVpX,
        relVpY,
      };
    },
    [scrollerRef]
  );

  const applyZoomAtClientPoint = useCallback(
    (nextZoomRaw, clientX, clientY) => {
      const prevZoom = zoomRef.current;
      const nextZoom = Math.min(
        maxZoom,
        Math.max(minZoom, Math.round(nextZoomRaw * 1000) / 1000)
      );
      if (Math.abs(nextZoom - prevZoom) < 0.001) return;

      if (!pendingAnchorRef.current && Number.isFinite(clientX) && Number.isFinite(clientY)) {
        captureAnchor(clientX, clientY);
      }
      zoomRef.current = nextZoom;
      setZoom(nextZoom);
    },
    [captureAnchor, minZoom, maxZoom]
  );

  const applyZoomAtCenter = useCallback(
    (nextZoomRaw) => {
      const scroller = scrollerRef.current;
      if (scroller) {
        const rect = scroller.getBoundingClientRect();
        applyZoomAtClientPoint(
          nextZoomRaw,
          rect.left + rect.width / 2,
          rect.top + rect.height / 2
        );
      } else {
        applyZoomAtClientPoint(nextZoomRaw, NaN, NaN);
      }
    },
    [scrollerRef, applyZoomAtClientPoint]
  );

  // Ajusta scrollLeft/scrollTop antes da pintura para travar o ponto exato sob o cursor (0 tremor)
  useLayoutEffect(() => {
    const anchor = pendingAnchorRef.current;
    pendingAnchorRef.current = null;
    const scroller = scrollerRef.current;
    if (!anchor || !scroller || !anchor.targetEl?.isConnected) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const nextTargetRect = anchor.targetEl.getBoundingClientRect();
    if (nextTargetRect.width <= 0 || nextTargetRect.height <= 0) return;

    const newPointClientX = nextTargetRect.left + anchor.fracX * nextTargetRect.width;
    const newPointClientY = nextTargetRect.top + anchor.fracY * nextTargetRect.height;
    const desiredClientX = scrollerRect.left + anchor.relVpX;
    const desiredClientY = scrollerRect.top + anchor.relVpY;

    scroller.scrollLeft += newPointClientX - desiredClientX;
    scroller.scrollTop += newPointClientY - desiredClientY;
  }, [zoom, scrollerRef]);

  useEffect(() => {
    if (!active) return undefined;
    const root = containerEl || containerRef?.current;
    if (!root) return undefined;

    const handleWheel = (e) => {
      const wantsZoom = e.ctrlKey || e.metaKey || wheelZoomModeRef.current;
      if (!wantsZoom) {
        // Permite rolagem natural (vertical e Shift+Scroll horizontal) apenas dentro da ficha
        return;
      }

      // Impede completamente que o navegador dê zoom na página inteira
      e.preventDefault();
      e.stopPropagation();

      const normalizedDeltaY = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
      const rawFactor = Math.exp(-normalizedDeltaY * 0.0022);
      const factor = Math.max(0.78, Math.min(1.28, rawFactor));
      const nextZoom = zoomRef.current * factor;

      applyZoomAtClientPoint(nextZoom, e.clientX, e.clientY);
    };

    const handleGesture = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    root.addEventListener('wheel', handleWheel, { passive: false });
    root.addEventListener('gesturestart', handleGesture, { passive: false });
    root.addEventListener('gesturechange', handleGesture, { passive: false });

    return () => {
      root.removeEventListener('wheel', handleWheel);
      root.removeEventListener('gesturestart', handleGesture);
      root.removeEventListener('gesturechange', handleGesture);
    };
  }, [containerEl, containerRef, applyZoomAtClientPoint, active]);

  const zoomIn = useCallback(() => {
    applyZoomAtCenter(zoomRef.current + 0.15);
  }, [applyZoomAtCenter]);

  const zoomOut = useCallback(() => {
    applyZoomAtCenter(zoomRef.current - 0.15);
  }, [applyZoomAtCenter]);

  const zoomReset = useCallback(() => {
    applyZoomAtCenter(initialZoom);
  }, [applyZoomAtCenter, initialZoom]);

  return { zoom, setZoom, zoomIn, zoomOut, zoomReset };
}

/**
 * MODAL EDITÁVEL COMPLETO DA FICHA.PDF (Sincronizado em Tempo Real entre Jogador e Mestre)
 */
export function CharacterSheetModal({
  open,
  onOpenChange,
  heroUid,
  heroName,
  editorProfile,
  isMasterView = false,
  sheetController = null,
}) {
  const [modalContentEl, setModalContentEl] = useState(null);
  const modalScrollerRef = useRef(null);
  const [pageFilter, setPageFilter] = useState('all'); // 'all' | 1 | 2
  const [scrollZoomMode, setScrollZoomMode] = useState(false);

  const {
    zoom,
    zoomIn: handleZoomIn,
    zoomOut: handleZoomOut,
    zoomReset: handleZoomReset,
  } = useSheetZoomAndScroll({
    containerEl: modalContentEl,
    scrollerRef: modalScrollerRef,
    minZoom: 0.6,
    maxZoom: 2.5,
    initialZoom: 1.0,
    wheelZoomWithoutCtrl: scrollZoomMode,
    active: open,
  });

  // Quando usado dentro de CharacterSheetPreviewCard, reutiliza o mesmo estado em tempo real
  // para refletir todas as edições instantaneamente (0ms) na versão minimizada!
  const internalSheet = useRealtimeCharacterSheet(
    heroUid,
    editorProfile,
    Boolean(open && !sheetController)
  );
  const sheet = sheetController || internalSheet;

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
  } = sheet;

  const visiblePages = useMemo(() => {
    if (pageFilter === 'all') return fichaSchema.pages;
    return fichaSchema.pages.filter((p) => p.page === pageFilter);
  }, [pageFilter]);

  const handleOpenChange = async (nextOpen) => {
    if (!nextOpen) {
      await flushPending();
    }
    onOpenChange?.(nextOpen);
  };

  const pageWidthPx = Math.round(820 * zoom);

  const lastEditorLabel = useMemo(() => {
    if (!syncMeta?.updatedByName) return null;
    if (syncMeta.updatedBy === editorProfile?.uid) return 'Você';
    return syncMeta.updatedByRole === 'master'
      ? `Mestre (${syncMeta.updatedByName})`
      : syncMeta.updatedByName;
  }, [syncMeta, editorProfile?.uid]);

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md data-[state=open]:animate-in" />
        <Dialog.Content
          ref={setModalContentEl}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            'w-[calc(100vw-0.75rem)] sm:w-[96vw] max-w-[1440px] h-[94dvh]',
            'rounded-2xl bg-[#0b0e17] border border-white/15 shadow-[0_24px_80px_rgba(0,0,0,0.85)]',
            'flex flex-col overflow-hidden focus:outline-none'
          )}
        >
          {/* Barra Superior da Ficha Editável */}
          <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-white/10 bg-[#0d101b]/95 backdrop-blur-xl flex flex-wrap items-center justify-between gap-2.5 shrink-0">
            {/* Identidade da Ficha */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-white/8 border border-white/12 flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4 text-slate-300" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Dialog.Title className="text-sm sm:text-base font-bold text-white truncate">
                    Ficha de {heroName || 'Personagem'}
                  </Dialog.Title>
                  {isMasterView && (
                    <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-[10px]">
                      <Shield className="h-3 w-3" />
                      Modo Mestre
                    </Badge>
                  )}
                  <Badge className="hidden md:inline-flex bg-white/5 text-slate-300 border-white/10 font-mono text-[10px]">
                    Ficha.pdf • {filledCount} preenchido{filledCount === 1 ? '' : 's'}
                  </Badge>
                </div>
                <Dialog.Description className="text-[11px] text-slate-400 flex items-center gap-1.5 truncate">
                  {saving ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin text-slate-300 shrink-0" />
                      <span>Salvando e sincronizando...</span>
                    </>
                  ) : (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                      <span className="truncate">
                        Sincronizado em tempo real
                        {lastEditorLabel ? ` • Última edição: ${lastEditorLabel}` : ''}
                      </span>
                    </>
                  )}
                </Dialog.Description>
              </div>
            </div>

            {/* Controles Centrais: Páginas & Zoom */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Filtro de Páginas */}
              <div className="inline-flex items-center p-0.5 rounded-xl bg-white/5 border border-white/10">
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
                      'px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all',
                      pageFilter === opt.id
                        ? 'bg-white/15 text-white border border-white/20 shadow-sm'
                        : 'text-slate-400 hover:text-white border border-transparent'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Controle de Zoom (visível em desktop e mobile) */}
              <div className="inline-flex items-center gap-0.5 p-0.5 rounded-xl bg-white/5 border border-white/10">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  title="Diminuir zoom"
                  aria-label="Diminuir zoom da ficha"
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleZoomReset}
                  title="Restaurar zoom (100%) • Use Ctrl + Scroll para dar zoom apenas na ficha onde está o cursor"
                  className="px-1.5 text-[11px] font-mono font-bold text-slate-200 hover:text-white tabular-nums min-w-[42px] text-center"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  title="Aumentar zoom"
                  aria-label="Aumentar zoom da ficha"
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setScrollZoomMode((v) => !v)}
                  aria-pressed={scrollZoomMode}
                  title={
                    scrollZoomMode
                      ? 'Scroll do mouse em modo Zoom (clique para voltar a Rolar • Ctrl+Scroll sempre dá zoom)'
                      : 'Ativar zoom direto na rodinha do mouse (sem precisar segurar Ctrl)'
                  }
                  aria-label="Alternar modo zoom na rodinha do mouse"
                  className={cn(
                    'h-7 w-7 rounded-lg flex items-center justify-center transition-colors border',
                    scrollZoomMode
                      ? 'bg-white/15 text-white border-white/25'
                      : 'text-slate-400 hover:text-white hover:bg-white/10 border-transparent'
                  )}
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleZoomReset}
                  title="Resetar visualização"
                  aria-label="Resetar zoom da ficha"
                  className="hidden sm:flex h-7 w-7 rounded-lg items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              </div>

              {/* Imprimir / Salvar PDF */}
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  await flushPending();
                  printFilledCharacterSheet(heroName, fields);
                }}
                title="Imprimir ou Salvar como PDF preenchido"
                className="h-8 px-2.5 text-xs"
              >
                <Printer className="h-3.5 w-3.5 text-slate-300" />
                <span className="hidden md:inline">PDF / Imprimir</span>
              </Button>

              {/* Fechar */}
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                aria-label="Fechar ficha"
                className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 border border-white/10 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Área Editável do PDF (scroll isolado + zoom ancorado no cursor via Ctrl+Scroll) */}
          <div
            ref={modalScrollerRef}
            className="flex-1 min-h-0 overflow-auto overscroll-contain bg-[#070911] p-3 sm:p-6"
          >
            {loading ? (
              <div className="h-full min-h-[360px] flex flex-col items-center justify-center gap-3 text-slate-300">
                <Loader2 className="h-7 w-7 animate-spin text-slate-300" />
                <p className="text-xs font-mono text-slate-400">
                  Carregando ficha sincronizada de {heroName || 'Personagem'}...
                </p>
              </div>
            ) : (
              <div className="min-w-full w-fit flex flex-col items-center gap-6 pb-8">
                {visiblePages.map((pageData) => (
                  <div
                    key={pageData.page}
                    data-sheet-page-wrap="true"
                    style={{
                      width:
                        zoom <= 1
                          ? `min(calc(100vw - 2.5rem), ${pageWidthPx}px)`
                          : `${pageWidthPx}px`,
                    }}
                  >
                    <div className="flex items-center justify-between mb-1.5 px-1 gap-2">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 shrink-0">
                        Página {pageData.page} de {fichaSchema.numPages}
                      </span>
                      <span className="text-[11px] text-slate-500 truncate">
                        Clique em qualquer campo ou marcação para editar
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

          {/* Rodapé Informativo */}
          <div className="px-4 py-2 border-t border-white/10 bg-[#0d101b]/95 flex items-center justify-between gap-3 text-[11px] text-slate-400 shrink-0">
            <span className="inline-flex items-center gap-1.5 truncate">
              {isMasterView ? (
                <>
                  <Shield className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                  Alterações feitas pelo Mestre aparecem instantaneamente na ficha do jogador e vice-versa.
                </>
              ) : (
                <>
                  <User className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                  Todas as alterações são salvas automaticamente e sincronizadas em tempo real com o Mestre.
                </>
              )}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 font-mono text-emerald-400 shrink-0">
              <Check className="h-3.5 w-3.5" />
              Auto-save ativo
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * CARD DE PRÉ-VISUALIZAÇÃO REDUZIDA DA FICHA.PDF NA ABA PERSONAGEM DO JOGADOR
 * Mostra o PDF por inteiro (as 2 páginas completas reduzidas) com os dados preenchidos ao vivo;
 * ao clicar, abre o CharacterSheetModal completo para edição sincronizada.
 */
export function CharacterSheetPreviewCard({ profile }) {
  const [modalOpen, setModalOpen] = useState(false);

  // Estado único compartilhado entre a pré-visualização minimizada e o editor completo
  const sheetController = useRealtimeCharacterSheet(
    profile?.uid,
    profile,
    Boolean(profile?.uid)
  );

  const { fields, loading, filledCount, remoteFlashMap } = sheetController;

  const handlePreviewKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setModalOpen(true);
    }
  };

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--border-subtle)] pb-4 flex-wrap gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <FileText className="h-5 w-5 text-slate-300 shrink-0" />
              <span>Ficha do Personagem</span>
              <Badge className="bg-white/5 text-slate-300 border-white/10 font-mono text-[11px]">
                Ficha.pdf
              </Badge>
              {filledCount > 0 && (
                <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-mono text-[11px]">
                  {filledCount} campo{filledCount === 1 ? '' : 's'}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              Visualização completa reduzida da sua ficha oficial com as alterações aplicadas em tempo real. Clique na ficha para editar.
            </CardDescription>
          </div>

          <Button
            size="sm"
            variant="primary"
            onClick={() => setModalOpen(true)}
            className="shrink-0"
          >
            <Edit3 className="h-4 w-4 text-slate-300" />
            Abrir Ficha Editável
          </Button>
        </CardHeader>

        <CardContent className="pt-5">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setModalOpen(true)}
            onKeyDown={handlePreviewKeyDown}
            aria-label="Abrir ficha editável completa do personagem"
            className="group relative w-full rounded-2xl border border-white/10 hover:border-white/25 bg-[#070911]/90 p-3 sm:p-5 transition-all duration-200 cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 overflow-hidden"
          >
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-4xl mx-auto">
                {[1, 2].map((n) => (
                  <div
                    key={n}
                    className="w-full rounded-lg bg-white/5 animate-pulse border border-white/10"
                    style={{ aspectRatio: `${PAGE_ASPECT_RATIO}` }}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 max-w-4xl mx-auto">
                {fichaSchema.pages.map((pageData) => (
                  <div
                    key={pageData.page}
                    className="space-y-1.5 transition-transform duration-200 group-hover:scale-[1.01]"
                  >
                    <SheetPageCanvas
                      pageData={pageData}
                      fields={fields}
                      interactive={false}
                      remoteFlashMap={remoteFlashMap}
                    />
                    <div className="flex items-center justify-between px-1 text-[10px] font-mono text-slate-400">
                      <span>Página {pageData.page}</span>
                      <span>
                        {pageData.page === 1
                          ? 'Atributos, Combate & Características'
                          : 'Magias, História & Equipamento'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Overlay elegante ao passar o mouse */}
            <div className="absolute inset-0 z-20 bg-black/0 group-hover:bg-black/35 transition-colors duration-200 flex items-center justify-center pointer-events-none">
              <div className="opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200 px-4 py-2.5 rounded-xl bg-[#0c101b]/95 border border-white/20 shadow-2xl backdrop-blur-xl flex items-center gap-2 text-xs sm:text-sm font-bold text-white">
                <Maximize2 className="h-4 w-4 text-slate-300" />
                Clique para abrir e editar a ficha completa
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <CharacterSheetModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        heroUid={profile?.uid}
        heroName={profile?.username}
        editorProfile={profile}
        isMasterView={false}
        sheetController={sheetController}
      />
    </>
  );
}
