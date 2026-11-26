/**
 * Utilitários puros para:
 * 1. Névoa de Guerra Manual por Salas (Fog of War — retângulos e pincel em coordenadas 0..100%)
 * 2. Desenho Livre / Marcações Táticas (simplificação Douglas-Peucker, curvas suaves SVG e hit-test da borracha)
 */

export const DEFAULT_FOG_OF_WAR = {
  enabled: false,
  defaultCovered: true, // true = mapa começa coberto e Mestre revela sala por sala
  masterOpacity: 0.52,  // Translucidez vista pelo Mestre (jogadores veem 100% opaco)
  ops: [],              // [{ id, action: 'reveal'|'hide', shape: 'rect'|'brush', x, y, w, h, r, points }]
};

export const MAX_FOG_OPS = 120;

export const DRAWING_COLORS = [
  { id: 'sky', label: 'Azul Tático', hex: '#38bdf8' },
  { id: 'amber', label: 'Âmbar / Rota', hex: '#fbbf24' },
  { id: 'rose', label: 'Carmesim / Perigo', hex: '#fb7185' },
  { id: 'emerald', label: 'Esmeralda / Seguro', hex: '#34d399' },
  { id: 'violet', label: 'Arcano', hex: '#a78bfa' },
  { id: 'white', label: 'Branco', hex: '#f8fafc' },
];

export const DRAWING_WIDTHS = [
  { id: 'thin', label: 'Fina', px: 2.5 },
  { id: 'medium', label: 'Média', px: 4.5 },
  { id: 'thick', label: 'Grossa', px: 8 },
];

function clampPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n * 100) / 100));
}

export function normalizeFogOp(raw, idx = 0) {
  if (!raw || typeof raw !== 'object') return null;
  const action = raw.action === 'hide' ? 'hide' : 'reveal';
  const shape = raw.shape === 'brush' ? 'brush' : 'rect';
  const id = String(raw.id || `fog_${idx}`).slice(0, 64);

  if (shape === 'rect') {
    const x = clampPct(raw.x);
    const y = clampPct(raw.y);
    const w = Math.max(0.2, Math.min(100 - x, Math.round((Number(raw.w) || 0) * 100) / 100));
    const h = Math.max(0.2, Math.min(100 - y, Math.round((Number(raw.h) || 0) * 100) / 100));
    return { id, action, shape: 'rect', x, y, w, h };
  }

  const rawPoints = Array.isArray(raw.points) ? raw.points : [];
  const points = rawPoints
    .slice(0, 140)
    .map((pt) => {
      if (Array.isArray(pt) && pt.length >= 2) {
        return { x: clampPct(pt[0]), y: clampPct(pt[1]) };
      }
      if (pt && typeof pt === 'object') {
        return { x: clampPct(pt.x), y: clampPct(pt.y) };
      }
      return null;
    })
    .filter(Boolean);

  if (points.length === 0) return null;
  const r = Math.max(1, Math.min(30, Math.round((Number(raw.r) || 6) * 10) / 10));
  return { id, action, shape: 'brush', r, points };
}

export function normalizeFogOfWar(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_FOG_OF_WAR, ops: [] };
  }
  const ops = Array.isArray(raw.ops)
    ? raw.ops
        .slice(-MAX_FOG_OPS)
        .map((op, i) => normalizeFogOp(op, i))
        .filter(Boolean)
    : [];

  const masterOpacityRaw = Number(raw.masterOpacity);
  const masterOpacity = Number.isFinite(masterOpacityRaw)
    ? Math.max(0.18, Math.min(0.85, Math.round(masterOpacityRaw * 100) / 100))
    : DEFAULT_FOG_OF_WAR.masterOpacity;

  return {
    enabled: Boolean(raw.enabled),
    defaultCovered: raw.defaultCovered === undefined ? true : Boolean(raw.defaultCovered),
    masterOpacity,
    ops,
  };
}

export function distancePointToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-8) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/**
 * Avalia matematicamente se o ponto (x%, y%) do mapa está coberto pela Névoa de Guerra Manual.
 * Usado para esconder tokens de monstros/NPCs em salas ainda não reveladas e filtrá-los da Ordem de Combate dos jogadores.
 */
export function isPointCoveredByFogOfWar(x, y, rawFog, mapAspectRatio = 1400 / 900) {
  const fog = normalizeFogOfWar(rawFog);
  if (!fog.enabled) return false;

  const px = clampPct(x);
  const py = clampPct(y);
  const ratio = Number.isFinite(mapAspectRatio) && mapAspectRatio > 0 ? mapAspectRatio : 1.5;

  let covered = fog.defaultCovered;

  for (const op of fog.ops) {
    if (op.shape === 'rect') {
      if (px >= op.x && px <= op.x + op.w && py >= op.y && py <= op.y + op.h) {
        covered = op.action === 'hide';
      }
      continue;
    }

    if (op.shape === 'brush' && op.points.length > 0) {
      // Raio em % da menor dimensão do mapa (mesma métrica usada no render do canvas)
      const rx = ratio >= 1 ? op.r / ratio : op.r;
      const ry = ratio >= 1 ? op.r : op.r * ratio;
      const safeRx = Math.max(0.2, rx);
      const safeRy = Math.max(0.2, ry);

      let hit = false;
      if (op.points.length === 1) {
        const pt = op.points[0];
        const nx = (px - pt.x) / safeRx;
        const ny = (py - pt.y) / safeRy;
        hit = nx * nx + ny * ny <= 1;
      } else {
        for (let i = 0; i < op.points.length - 1; i += 1) {
          const a = op.points[i];
          const b = op.points[i + 1];
          const d = distancePointToSegment(
            px / safeRx,
            py / safeRy,
            a.x / safeRx,
            a.y / safeRy,
            b.x / safeRx,
            b.y / safeRy
          );
          if (d <= 1) {
            hit = true;
            break;
          }
        }
      }
      if (hit) {
        covered = op.action === 'hide';
      }
    }
  }

  return covered;
}

/**
 * Simplificação Douglas-Peucker para manter traços suaves e leves no Firestore.
 */
export function simplifyPolyline(points, tolerance = 0.22, maxPoints = 180) {
  if (!Array.isArray(points) || points.length <= 2) {
    return (points || []).map((p) => ({ x: clampPct(p.x), y: clampPct(p.y) }));
  }

  const sqTol = tolerance * tolerance;

  const rdp = (pts, start, end, out) => {
    let maxDistSq = -1;
    let index = -1;
    const a = pts[start];
    const b = pts[end];

    for (let i = start + 1; i < end; i += 1) {
      const d = distancePointToSegment(pts[i].x, pts[i].y, a.x, a.y, b.x, b.y);
      const dSq = d * d;
      if (dSq > maxDistSq) {
        maxDistSq = dSq;
        index = i;
      }
    }

    if (maxDistSq > sqTol && index > start && index < end) {
      rdp(pts, start, index, out);
      out.push(pts[index]);
      rdp(pts, index, end, out);
    }
  };

  const result = [points[0]];
  rdp(points, 0, points.length - 1, result);
  result.push(points[points.length - 1]);

  let finalPts = result;
  if (finalPts.length > maxPoints) {
    const step = (finalPts.length - 1) / (maxPoints - 1);
    const downsampled = [];
    for (let i = 0; i < maxPoints; i += 1) {
      downsampled.push(finalPts[Math.min(finalPts.length - 1, Math.round(i * step))]);
    }
    finalPts = downsampled;
  }

  return finalPts.map((p) => ({ x: clampPct(p.x), y: clampPct(p.y) }));
}

/**
 * Converte lista de pontos {x, y} (0..100) em path SVG com curvas quadráticas suaves.
 */
export function buildSmoothSvgPath(points) {
  if (!Array.isArray(points) || points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x} ${p.y} L ${p.x + 0.01} ${p.y + 0.01}`;
  }
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const midX = Math.round(((points[i].x + points[i + 1].x) / 2) * 100) / 100;
    const midY = Math.round(((points[i].y + points[i + 1].y) / 2) * 100) / 100;
    d += ` Q ${points[i].x} ${points[i].y} ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

/**
 * Verifica se o cursor (x%, y%) está sobre um traço para apagá-lo com a Borracha.
 */
export function isPointNearStroke(x, y, points, thresholdPct = 1.6) {
  if (!Array.isArray(points) || points.length === 0) return false;
  if (points.length === 1) {
    return Math.hypot(x - points[0].x, y - points[0].y) <= thresholdPct;
  }
  for (let i = 0; i < points.length - 1; i += 1) {
    const d = distancePointToSegment(x, y, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    if (d <= thresholdPct) return true;
  }
  return false;
}
