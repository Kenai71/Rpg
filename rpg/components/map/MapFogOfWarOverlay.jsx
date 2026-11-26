'use client';

import { useEffect, useRef } from 'react';
import { normalizeFogOfWar } from '../../lib/map-fog';

const MAX_FOG_CANVAS_SIDE = 1920;

/**
 * Camada de Névoa de Guerra Manual por Salas (Fog of War).
 *
 * - Para Jogadores (e Mestre em "Ver como Jogador"): áreas cobertas são 100% opacas,
 *   impedindo qualquer spoiler de salas ou monstros escondidos mesmo em mapas iluminados de dia.
 * - Para o Mestre: áreas cobertas aparecem translúcidas (controlável pelo slider) com sutil
 *   hachura tática, permitindo visualizar o mapa completo por baixo enquanto revela sala por sala.
 * - Suporta prévia ao vivo de retângulo ou pincel enquanto o Mestre arrasta.
 */
export function MapFogOfWarOverlay({
  fogOfWar,
  isMaster = false,
  previewAsPlayer = false,
  mapWidth = 1400,
  mapHeight = 900,
  draftOp = null,
}) {
  const canvasRef = useRef(null);
  const safeFog = normalizeFogOfWar(fogOfWar);
  const effectivePlayerView = !isMaster || previewAsPlayer;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !safeFog.enabled) return;

    const rawW = Math.max(64, Math.round(Number(mapWidth) || 1400));
    const rawH = Math.max(64, Math.round(Number(mapHeight) || 900));
    const scale = Math.min(1, MAX_FOG_CANVAS_SIDE / Math.max(rawW, rawH));
    const cw = Math.max(64, Math.round(rawW * scale));
    const ch = Math.max(64, Math.round(rawH * scale));

    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, cw, ch);

    const baseDim = Math.min(cw, ch);
    const allOps = draftOp ? [...safeFog.ops, draftOp] : safeFog.ops;

    // 1. Preenche a máscara binária de áreas cobertas usando compositing nativo (source-over / destination-out)
    ctx.globalCompositeOperation = 'source-over';
    if (safeFog.defaultCovered) {
      ctx.fillStyle = '#06080f';
      ctx.fillRect(0, 0, cw, ch);
    }

    const drawOp = (op) => {
      if (!op) return;
      ctx.globalCompositeOperation = op.action === 'reveal' ? 'destination-out' : 'source-over';
      ctx.fillStyle = '#06080f';
      ctx.strokeStyle = '#06080f';

      if (op.shape === 'rect') {
        const rx = (op.x / 100) * cw;
        const ry = (op.y / 100) * ch;
        const rw = (op.w / 100) * cw;
        const rh = (op.h / 100) * ch;
        ctx.fillRect(rx, ry, rw, rh);
        return;
      }

      if (op.shape === 'brush' && Array.isArray(op.points) && op.points.length > 0) {
        const radiusPx = Math.max(4, (op.r / 100) * baseDim);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = radiusPx * 2;

        if (op.points.length === 1) {
          const px = (op.points[0].x / 100) * cw;
          const py = (op.points[0].y / 100) * ch;
          ctx.beginPath();
          ctx.arc(px, py, radiusPx, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo((op.points[0].x / 100) * cw, (op.points[0].y / 100) * ch);
          for (let i = 1; i < op.points.length; i += 1) {
            ctx.lineTo((op.points[i].x / 100) * cw, (op.points[i].y / 100) * ch);
          }
          ctx.stroke();
        }
      }
    };

    for (const op of allOps) {
      drawOp(op);
    }

    // 2. Textura atmosférica sutil restrita APENAS às regiões cobertas (source-atop)
    ctx.globalCompositeOperation = 'source-atop';
    const grad = ctx.createLinearGradient(0, 0, cw, ch);
    if (effectivePlayerView) {
      grad.addColorStop(0, '#05070e');
      grad.addColorStop(0.5, '#090d18');
      grad.addColorStop(1, '#04060c');
    } else {
      grad.addColorStop(0, 'rgba(6, 9, 18, 0.96)');
      grad.addColorStop(1, 'rgba(11, 16, 30, 0.96)');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);

    // Hachura tática discreta na visão do Mestre para distinguir instantaneamente salas ocultas
    if (!effectivePlayerView) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
      ctx.lineWidth = Math.max(1, Math.round(cw / 900));
      const step = Math.max(18, Math.round(baseDim / 28));
      ctx.beginPath();
      for (let x = -ch; x < cw + ch; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x + ch, ch);
      }
      ctx.stroke();
    }

    ctx.globalCompositeOperation = 'source-over';
  }, [safeFog, effectivePlayerView, mapWidth, mapHeight, draftOp]);

  if (!safeFog.enabled) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-[31] rounded-lg overflow-hidden"
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block transition-opacity duration-200"
        style={{
          opacity: effectivePlayerView ? 1 : safeFog.masterOpacity,
        }}
      />

      {/* Contorno de prévia do retângulo enquanto o Mestre arrasta para revelar/esconder uma sala */}
      {!effectivePlayerView && draftOp?.shape === 'rect' && (
        <div
          className="absolute border-2 border-dashed rounded-sm"
          style={{
            left: `${draftOp.x}%`,
            top: `${draftOp.y}%`,
            width: `${draftOp.w}%`,
            height: `${draftOp.h}%`,
            borderColor: draftOp.action === 'reveal' ? '#34d399' : '#fb7185',
            backgroundColor:
              draftOp.action === 'reveal'
                ? 'rgba(52, 211, 153, 0.12)'
                : 'rgba(251, 113, 133, 0.14)',
          }}
        />
      )}
    </div>
  );
}
