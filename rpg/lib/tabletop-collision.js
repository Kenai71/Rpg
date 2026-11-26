/**
 * Motor geométrico de não-sobreposição entre o Mapa Tático e a Ficha Editável do Aventureiro.
 *
 * Todas as coordenadas são relativas ao container do viewport do mapa (`containerRef`),
 * com origem (0, 0) no canto superior esquerdo e dimensões (vpW, vpH).
 *
 * Invariantes garantidos:
 * 1. Arrastar a ficha nunca permite sobreposição com o retângulo do mapa (margem mínima BARRIER_GAP).
 * 2. Arrastar o mapa nunca permite mover o mapa para cima/baixo da ficha.
 * 3. Redimensionar a ficha nunca permite crescer para dentro do mapa.
 * 4. Ao arrastar a ficha decisivamente para o lado oposto da mesa, o mapa cede espaço suavemente
 *    para o lado livre sem jamais cruzar ou sobrepor a ficha (zero deadlock).
 * 5. Mesmo em zoom profundo (200%–600%), `buildSheetCutoutClipPath` recorta a camada do mapa
 *    fora da área protegida da ficha garantindo 0 pixels de sobreposição visual.
 */

export const BARRIER_GAP = 14;
export const EDGE_PAD = 12;
export const MIN_SHEET_WIDTH = 300;
export const MIN_SHEET_HEIGHT = 280;
export const MIN_MAP_RESERVE = 240;

export function getMapRect({ vpW, vpH, mapW, mapH, pan, zoom }) {
  const safeZoom = Math.max(0.01, Number(zoom) || 1);
  const scaledW = Math.max(1, (Number(mapW) || 1400) * safeZoom);
  const scaledH = Math.max(1, (Number(mapH) || 900) * safeZoom);
  const cx = vpW / 2 + (Number(pan?.x) || 0);
  const cy = vpH / 2 + (Number(pan?.y) || 0);

  return {
    left: cx - scaledW / 2,
    top: cy - scaledH / 2,
    right: cx + scaledW / 2,
    bottom: cy + scaledH / 2,
    width: scaledW,
    height: scaledH,
  };
}

export function toBox(rect) {
  if (!rect) return null;
  const left = Number(rect.x ?? rect.left) || 0;
  const top = Number(rect.y ?? rect.top) || 0;
  const width = Math.max(0, Number(rect.width) || 0);
  const height = Math.max(0, Number(rect.height) || 0);
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
  };
}

export function rectsOverlap(a, b, gap = BARRIER_GAP) {
  if (!a || !b) return false;
  return (
    a.left < b.right + gap - 0.5 &&
    a.right > b.left - gap + 0.5 &&
    a.top < b.bottom + gap - 0.5 &&
    a.bottom > b.top - gap + 0.5
  );
}

/**
 * Calcula as 4 regiões livres ao redor da ficha dentro do viewport (esquerda, direita, acima, abaixo).
 */
export function getFreeMapRegions(vpW, vpH, sheet, gap = BARRIER_GAP, pad = EDGE_PAD) {
  if (!sheet || vpW <= 0 || vpH <= 0) {
    return [
      {
        side: 'full',
        left: pad,
        top: pad,
        right: Math.max(pad, vpW - pad),
        bottom: Math.max(pad, vpH - pad),
        width: Math.max(0, vpW - pad * 2),
        height: Math.max(0, vpH - pad * 2),
      },
    ];
  }

  const s = toBox(sheet);
  const raw = [
    {
      side: 'left',
      left: pad,
      top: pad,
      right: Math.max(pad, s.left - gap),
      bottom: vpH - pad,
    },
    {
      side: 'right',
      left: Math.min(vpW - pad, s.right + gap),
      top: pad,
      right: vpW - pad,
      bottom: vpH - pad,
    },
    {
      side: 'top',
      left: pad,
      top: pad,
      right: vpW - pad,
      bottom: Math.max(pad, s.top - gap),
    },
    {
      side: 'bottom',
      left: pad,
      top: Math.min(vpH - pad, s.bottom + gap),
      right: vpW - pad,
      bottom: vpH - pad,
    },
  ];

  return raw
    .map((r) => ({
      ...r,
      width: Math.max(0, r.right - r.left),
      height: Math.max(0, r.bottom - r.top),
    }))
    .filter((r) => r.width >= 90 && r.height >= 90);
}

/**
 * Escolhe a maior região livre fora da ficha onde o mapa cabe com a melhor escala.
 */
export function pickBestMapRegion(vpW, vpH, mapW, mapH, sheet, gap = BARRIER_GAP, pad = EDGE_PAD) {
  const regions = getFreeMapRegions(vpW, vpH, sheet, gap, pad);
  if (regions.length === 0) {
    return {
      side: 'full',
      left: pad,
      top: pad,
      right: Math.max(pad + 120, vpW - pad),
      bottom: Math.max(pad + 120, vpH - pad),
      width: Math.max(120, vpW - pad * 2),
      height: Math.max(120, vpH - pad * 2),
    };
  }

  const safeMapW = Math.max(1, Number(mapW) || 1400);
  const safeMapH = Math.max(1, Number(mapH) || 900);

  let best = regions[0];
  let bestScore = -1;

  for (const r of regions) {
    const fitScale = Math.min(r.width / safeMapW, r.height / safeMapH);
    const areaBonus = (r.width * r.height) / Math.max(1, vpW * vpH) * 0.001;
    const score = fitScale + areaBonus;
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }

  return best;
}

/**
 * Calcula zoom e pan ideais para enquadrar o mapa inteiro centralizado dentro de `region`.
 */
export function computeMapFitInRegion({ vpW, vpH, mapW, mapH, region, minZoom = 0.05, maxZoom = 6.0 }) {
  const safeMapW = Math.max(1, Number(mapW) || 1400);
  const safeMapH = Math.max(1, Number(mapH) || 900);
  const usableW = Math.max(80, region.width - 8);
  const usableH = Math.max(80, region.height - 8);
  const rawFit = Math.min(usableW / safeMapW, usableH / safeMapH);
  const zoom = Math.max(minZoom, Math.min(maxZoom, Math.round(rawFit * 1000) / 1000));

  const regionCenterX = (region.left + region.right) / 2;
  const regionCenterY = (region.top + region.bottom) / 2;

  return {
    zoom,
    pan: {
      x: Math.round((regionCenterX - vpW / 2) * 100) / 100,
      y: Math.round((regionCenterY - vpH / 2) * 100) / 100,
    },
  };
}

/**
 * Layout inicial responsivo da Ficha Editável aberta ao lado (desktop) ou abaixo (telas estreitas) do mapa.
 */
export function computeInitialSheetLayout(vpW, vpH, dock = 'right') {
  const safeW = Math.max(320, vpW || 1000);
  const safeH = Math.max(360, vpH || 700);
  const isNarrow = safeW < 820;
  const effectiveDock = isNarrow ? 'bottom' : dock;

  if (effectiveDock === 'bottom') {
    const width = Math.max(MIN_SHEET_WIDTH, Math.min(760, safeW - EDGE_PAD * 2));
    const height = Math.max(230, Math.min(420, Math.round((safeH - EDGE_PAD * 2) * 0.44)));
    return {
      x: Math.round((safeW - width) / 2),
      y: Math.max(EDGE_PAD, safeH - height - EDGE_PAD),
      width,
      height,
    };
  }

  const maxAllowedW = Math.max(MIN_SHEET_WIDTH, safeW - MIN_MAP_RESERVE - BARRIER_GAP - EDGE_PAD * 2);
  const width = Math.min(maxAllowedW, Math.max(340, Math.min(480, Math.round(safeW * 0.35))));
  const height = Math.max(
    MIN_SHEET_HEIGHT,
    Math.min(safeH - EDGE_PAD * 2, Math.max(460, Math.round((safeH - EDGE_PAD * 2) * 0.92)))
  );
  const y = Math.max(EDGE_PAD, Math.round((safeH - height) / 2));

  if (effectiveDock === 'left') {
    return { x: EDGE_PAD, y, width, height };
  }

  return {
    x: Math.max(EDGE_PAD, safeW - width - EDGE_PAD),
    y,
    width,
    height,
  };
}

/**
 * Garante que a ficha permaneça 100% dentro dos limites visíveis do viewport.
 */
export function clampSheetToViewport(sheet, vpW, vpH, pad = EDGE_PAD) {
  if (!sheet || vpW <= 0 || vpH <= 0) return sheet;
  const maxW = Math.max(MIN_SHEET_WIDTH, vpW - pad * 2);
  const maxH = Math.max(220, vpH - pad * 2);
  const width = Math.max(Math.min(MIN_SHEET_WIDTH, maxW), Math.min(maxW, Math.round(sheet.width)));
  const height = Math.max(Math.min(220, maxH), Math.min(maxH, Math.round(sheet.height)));
  const x = Math.max(pad, Math.min(vpW - width - pad, Math.round(sheet.x)));
  const y = Math.max(pad, Math.min(vpH - height - pad, Math.round(sheet.y)));
  return { x, y, width, height };
}

/**
 * Impede o usuário de arrastar o mapa para cima ou para baixo da ficha.
 * - Quando o mapa cabe na região livre fora da ficha, aplica colisão física rígida (AABB) com deslizamento suave na borda.
 * - Quando o mapa está com zoom profundo maior que a região livre, mantém o mapa contido na sua zona livre
 *   (junto ao clip-path) para inspecionar todos os cantos sem jamais invadir o espaço da ficha.
 */
export function resolveMapPanAgainstSheet({
  prevPan,
  targetPan,
  zoom,
  vpW,
  vpH,
  mapW,
  mapH,
  sheet,
  gap = BARRIER_GAP,
  pad = EDGE_PAD,
}) {
  if (!sheet || vpW <= 0 || vpH <= 0) {
    return { pan: targetPan, collided: false, edge: null };
  }

  const s = toBox(sheet);
  const targetRect = getMapRect({ vpW, vpH, mapW, mapH, pan: targetPan, zoom });
  const prevRect = getMapRect({ vpW, vpH, mapW, mapH, pan: prevPan || targetPan, zoom });

  // Caso 1: Sem nenhuma colisão -> movimento livre!
  if (!rectsOverlap(targetRect, s, gap)) {
    return { pan: targetPan, collided: false, edge: null };
  }

  const halfW = targetRect.width / 2;
  const halfH = targetRect.height / 2;

  // Limites exatos para ficar encostado em cada um dos 4 lados da ficha
  const maxPanXLeftOfSheet = s.left - gap - halfW - vpW / 2;
  const minPanXRightOfSheet = s.right + gap + halfW - vpW / 2;
  const maxPanYAboveSheet = s.top - gap - halfH - vpH / 2;
  const minPanYBelowSheet = s.bottom + gap + halfH - vpH / 2;

  // Caso 2: O mapa estava fora da ficha antes deste passo -> colisão rígida na borda correspondente (desliza no outro eixo)
  if (!rectsOverlap(prevRect, s, gap - 1)) {
    let resolvedX = targetPan.x;
    let resolvedY = targetPan.y;
    let edge = null;

    if (prevRect.right <= s.left - gap + 1.5) {
      resolvedX = Math.min(targetPan.x, maxPanXLeftOfSheet);
      edge = 'left';
    } else if (prevRect.left >= s.right + gap - 1.5) {
      resolvedX = Math.max(targetPan.x, minPanXRightOfSheet);
      edge = 'right';
    } else if (prevRect.bottom <= s.top - gap + 1.5) {
      resolvedY = Math.min(targetPan.y, maxPanYAboveSheet);
      edge = 'top';
    } else if (prevRect.top >= s.bottom + gap - 1.5) {
      resolvedY = Math.max(targetPan.y, minPanYBelowSheet);
      edge = 'bottom';
    }

    const checkRect = getMapRect({
      vpW,
      vpH,
      mapW,
      mapH,
      pan: { x: resolvedX, y: resolvedY },
      zoom,
    });
    if (!rectsOverlap(checkRect, s, gap)) {
      return {
        pan: {
          x: Math.round(resolvedX * 100) / 100,
          y: Math.round(resolvedY * 100) / 100,
        },
        collided: true,
        edge,
      };
    }
  }

  // Caso 3: Mapa está em um dos 4 lados livres (ou retornando de zoom) — escolhe a projeção mais próxima sem sobreposição se o mapa couber
  const bestRegion = pickBestMapRegion(vpW, vpH, mapW, mapH, sheet, gap, pad);
  const fitsBestHorizontally = targetRect.width <= bestRegion.width + 1;
  const fitsBestVertically = targetRect.height <= bestRegion.height + 1;

  if (fitsBestHorizontally && fitsBestVertically) {
    const candidates = [
      {
        edge: 'left',
        x: Math.min(targetPan.x, maxPanXLeftOfSheet),
        y: targetPan.y,
        ok: s.left - gap - pad >= targetRect.width - 1,
      },
      {
        edge: 'right',
        x: Math.max(targetPan.x, minPanXRightOfSheet),
        y: targetPan.y,
        ok: vpW - pad - (s.right + gap) >= targetRect.width - 1,
      },
      {
        edge: 'top',
        x: targetPan.x,
        y: Math.min(targetPan.y, maxPanYAboveSheet),
        ok: s.top - gap - pad >= targetRect.height - 1,
      },
      {
        edge: 'bottom',
        x: targetPan.x,
        y: Math.max(targetPan.y, minPanYBelowSheet),
        ok: vpH - pad - (s.bottom + gap) >= targetRect.height - 1,
      },
    ].filter((c) => c.ok);

    if (candidates.length > 0) {
      let closest = candidates[0];
      let minDist = Infinity;
      for (const c of candidates) {
        const d = Math.hypot(c.x - targetPan.x, c.y - targetPan.y);
        if (d < minDist) {
          minDist = d;
          closest = c;
        }
      }
      return {
        pan: {
          x: Math.round(closest.x * 100) / 100,
          y: Math.round(closest.y * 100) / 100,
        },
        collided: true,
        edge: closest.edge,
      };
    }
  }

  // Caso 4: Zoom profundo (mapa maior que a região livre) — o clip-path já impede 100% de sobreposição visual,
  // e restringimos o pan para que o mapa permaneça navegável dentro da sua região livre sem escorregar para o lado da ficha.
  let panX = targetPan.x;
  let panY = targetPan.y;
  let collided = false;
  let edge = null;

  if (bestRegion.side === 'left') {
    const minLeft = bestRegion.right - targetRect.width;
    const maxLeft = bestRegion.left;
    const desiredLeft = targetRect.left;
    const clampedLeft =
      minLeft <= maxLeft
        ? Math.max(minLeft, Math.min(maxLeft, desiredLeft))
        : Math.min(bestRegion.right - targetRect.width, desiredLeft);
    if (Math.abs(clampedLeft - desiredLeft) > 0.5) {
      panX = clampedLeft + halfW - vpW / 2;
      collided = true;
      edge = 'left';
    }
  } else if (bestRegion.side === 'right') {
    const minLeft = bestRegion.right - targetRect.width;
    const maxLeft = bestRegion.left;
    const desiredLeft = targetRect.left;
    const clampedLeft =
      minLeft <= maxLeft
        ? Math.max(minLeft, Math.min(maxLeft, desiredLeft))
        : Math.max(bestRegion.left, desiredLeft);
    if (Math.abs(clampedLeft - desiredLeft) > 0.5) {
      panX = clampedLeft + halfW - vpW / 2;
      collided = true;
      edge = 'right';
    }
  } else if (bestRegion.side === 'top') {
    const minTop = bestRegion.bottom - targetRect.height;
    const maxTop = bestRegion.top;
    const desiredTop = targetRect.top;
    const clampedTop =
      minTop <= maxTop
        ? Math.max(minTop, Math.min(maxTop, desiredTop))
        : Math.min(bestRegion.bottom - targetRect.height, desiredTop);
    if (Math.abs(clampedTop - desiredTop) > 0.5) {
      panY = clampedTop + halfH - vpH / 2;
      collided = true;
      edge = 'top';
    }
  } else if (bestRegion.side === 'bottom') {
    const minTop = bestRegion.bottom - targetRect.height;
    const maxTop = bestRegion.top;
    const desiredTop = targetRect.top;
    const clampedTop =
      minTop <= maxTop
        ? Math.max(minTop, Math.min(maxTop, desiredTop))
        : Math.max(bestRegion.top, desiredTop);
    if (Math.abs(clampedTop - desiredTop) > 0.5) {
      panY = clampedTop + halfH - vpH / 2;
      collided = true;
      edge = 'bottom';
    }
  }

  return {
    pan: {
      x: Math.round(panX * 100) / 100,
      y: Math.round(panY * 100) / 100,
    },
    collided,
    edge,
  };
}

export function getEffectiveMapObstacle({
  vpW,
  vpH,
  mapW,
  mapH,
  pan,
  zoom,
  prevSheet,
  gap = BARRIER_GAP,
  pad = EDGE_PAD,
}) {
  const rawMapRect = getMapRect({ vpW, vpH, mapW, mapH, pan, zoom });
  if (!prevSheet) return rawMapRect;

  const prevBox = toBox(prevSheet);
  if (!rectsOverlap(rawMapRect, prevBox, gap - 1)) {
    return rawMapRect;
  }

  // Quando o mapa está com zoom profundo (visualmente recortado fora da ficha pelo clip-path),
  // o obstáculo real na tela é a interseção do mapa com a região livre atual fora da ficha.
  const freeRegion = pickBestMapRegion(vpW, vpH, mapW, mapH, prevSheet, gap, pad);
  const left = Math.max(rawMapRect.left, freeRegion.left);
  const top = Math.max(rawMapRect.top, freeRegion.top);
  const right = Math.min(rawMapRect.right, freeRegion.right);
  const bottom = Math.min(rawMapRect.bottom, freeRegion.bottom);

  if (right > left + 10 && bottom > top + 10) {
    return {
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top,
    };
  }

  return {
    left: freeRegion.left,
    top: freeRegion.top,
    right: freeRegion.right,
    bottom: freeRegion.bottom,
    width: freeRegion.width,
    height: freeRegion.height,
  };
}

/**
 * Resolve o arraste livre da ficha ao redor do mapa:
 * - Nunca permite sobreposição da ficha sobre o mapa.
 * - Desliza suavemente pelas 4 bordas do mapa.
 * - Se o usuário arrastar a ficha decisivamente até o lado oposto do viewport (evitando deadlock),
 *   retorna também o novo `{ pan, zoom }` do mapa acomodado no espaço livre oposto com 0% de sobreposição!
 */
export function resolveSheetDragAgainstMap({
  prevSheet,
  targetX,
  targetY,
  pointerX,
  pointerY,
  vpW,
  vpH,
  mapW,
  mapH,
  pan,
  zoom,
  minZoom = 0.05,
  maxZoom = 6.0,
  gap = BARRIER_GAP,
  pad = EDGE_PAD,
}) {
  const width = prevSheet.width;
  const height = prevSheet.height;
  const clampedX = Math.max(pad, Math.min(vpW - width - pad, Math.round(targetX)));
  const clampedY = Math.max(pad, Math.min(vpH - height - pad, Math.round(targetY)));

  const candidate = { x: clampedX, y: clampedY, width, height };
  const mapRect = getEffectiveMapObstacle({
    vpW,
    vpH,
    mapW,
    mapH,
    pan,
    zoom,
    prevSheet,
    gap,
    pad,
  });

  // Caso 1: Movimento livre sem tocar no mapa
  if (!rectsOverlap(toBox(candidate), mapRect, gap)) {
    return {
      sheet: candidate,
      nextMapView: null,
      collided: false,
      edge: null,
    };
  }

  // Caso 2: Verifica se o jogador puxou o cursor decisivamente para o lado oposto do viewport
  // (permite mover a ficha da direita -> esquerda, esquerda -> direita, topo <-> base sem deadlock e sem nunca sobrepor!)
  const mapCenterX = (mapRect.left + mapRect.right) / 2;
  const mapCenterY = (mapRect.top + mapRect.bottom) / 2;
  const prevCenterX = prevSheet.x + width / 2;
  const prevCenterY = prevSheet.y + height / 2;

  let swapSide = null;
  if (
    prevCenterX > mapCenterX &&
    pointerX < Math.min(vpW * 0.26, mapCenterX - Math.min(mapRect.width, vpW) * 0.22) &&
    vpW - width - gap - pad * 2 >= MIN_MAP_RESERVE
  ) {
    swapSide = 'left';
  } else if (
    prevCenterX < mapCenterX &&
    pointerX > Math.max(vpW * 0.74, mapCenterX + Math.min(mapRect.width, vpW) * 0.22) &&
    vpW - width - gap - pad * 2 >= MIN_MAP_RESERVE
  ) {
    swapSide = 'right';
  } else if (
    prevCenterY > mapCenterY &&
    pointerY < Math.min(vpH * 0.22, mapCenterY - Math.min(mapRect.height, vpH) * 0.22) &&
    vpH - height - gap - pad * 2 >= 200
  ) {
    swapSide = 'top';
  } else if (
    prevCenterY < mapCenterY &&
    pointerY > Math.max(vpH * 0.78, mapCenterY + Math.min(mapRect.height, vpH) * 0.22) &&
    vpH - height - gap - pad * 2 >= 200
  ) {
    swapSide = 'bottom';
  }

  if (swapSide) {
    const swappedSheet = {
      x:
        swapSide === 'left'
          ? pad
          : swapSide === 'right'
          ? Math.max(pad, vpW - width - pad)
          : clampedX,
      y:
        swapSide === 'top'
          ? pad
          : swapSide === 'bottom'
          ? Math.max(pad, vpH - height - pad)
          : clampedY,
      width,
      height,
    };

    const freeRegion = pickBestMapRegion(vpW, vpH, mapW, mapH, swappedSheet, gap, pad);
    const fitsAtCurrentZoom =
      mapW * zoom <= freeRegion.width && mapH * zoom <= freeRegion.height;

    let nextMapView;
    if (fitsAtCurrentZoom) {
      const regionCenterX = (freeRegion.left + freeRegion.right) / 2;
      const regionCenterY = (freeRegion.top + freeRegion.bottom) / 2;
      nextMapView = {
        zoom,
        pan: {
          x: Math.round((regionCenterX - vpW / 2) * 100) / 100,
          y: Math.round((regionCenterY - vpH / 2) * 100) / 100,
        },
      };
    } else {
      nextMapView = computeMapFitInRegion({
        vpW,
        vpH,
        mapW,
        mapH,
        region: freeRegion,
        minZoom,
        maxZoom,
      });
    }

    const verifyMapRect = getMapRect({
      vpW,
      vpH,
      mapW,
      mapH,
      pan: nextMapView.pan,
      zoom: nextMapView.zoom,
    });

    if (!rectsOverlap(toBox(swappedSheet), verifyMapRect, gap)) {
      return {
        sheet: swappedSheet,
        nextMapView,
        collided: false,
        edge: null,
      };
    }
  }

  // Caso 3: Colisão rígida nas 4 bordas do mapa (nunca entra sobre o mapa; desliza suavemente na borda)
  const tangents = [
    // Ficha à direita do mapa (borda esquerda da ficha encosta na borda direita do mapa)
    {
      edge: 'left',
      x: Math.ceil(mapRect.right + gap),
      y: clampedY,
    },
    // Ficha à esquerda do mapa (borda direita da ficha encosta na borda esquerda do mapa)
    {
      edge: 'right',
      x: Math.floor(mapRect.left - gap - width),
      y: clampedY,
    },
    // Ficha abaixo do mapa (borda superior da ficha encosta na borda inferior do mapa)
    {
      edge: 'top',
      x: clampedX,
      y: Math.ceil(mapRect.bottom + gap),
    },
    // Ficha acima do mapa (borda inferior da ficha encosta na borda superior do mapa)
    {
      edge: 'bottom',
      x: clampedX,
      y: Math.floor(mapRect.top - gap - height),
    },
  ].filter(
    (c) =>
      c.x >= pad - 0.5 &&
      c.x + width <= vpW - pad + 0.5 &&
      c.y >= pad - 0.5 &&
      c.y + height <= vpH - pad + 0.5 &&
      !rectsOverlap(toBox({ x: c.x, y: c.y, width, height }), mapRect, gap - 0.5)
  );

  if (tangents.length > 0) {
    let closest = tangents[0];
    let minDist = Infinity;
    for (const t of tangents) {
      const dist = Math.hypot(t.x - clampedX, t.y - clampedY);
      if (dist < minDist) {
        minDist = dist;
        closest = t;
      }
    }
    return {
      sheet: {
        x: Math.max(pad, Math.min(vpW - width - pad, closest.x)),
        y: Math.max(pad, Math.min(vpH - height - pad, closest.y)),
        width,
        height,
      },
      nextMapView: null,
      collided: true,
      edge: closest.edge,
    };
  }

  // Fallback seguro: mantém a ficha exatamente na posição anterior sem sobrepor (deslizando no eixo livre se possível)
  const slideY = { x: prevSheet.x, y: clampedY, width, height };
  if (!rectsOverlap(toBox(slideY), mapRect, gap)) {
    return {
      sheet: slideY,
      nextMapView: null,
      collided: true,
      edge: prevCenterX >= mapCenterX ? 'left' : 'right',
    };
  }
  const slideX = { x: clampedX, y: prevSheet.y, width, height };
  if (!rectsOverlap(toBox(slideX), mapRect, gap)) {
    return {
      sheet: slideX,
      nextMapView: null,
      collided: true,
      edge: prevCenterY >= mapCenterY ? 'top' : 'bottom',
    };
  }

  return {
    sheet: prevSheet,
    nextMapView: null,
    collided: true,
    edge:
      Math.abs(prevCenterX - mapCenterX) >= Math.abs(prevCenterY - mapCenterY)
        ? prevCenterX >= mapCenterX
          ? 'left'
          : 'right'
        : prevCenterY >= mapCenterY
        ? 'top'
        : 'bottom',
  };
}

/**
 * Resolve o redimensionamento da ficha pelas bordas/cantos garantindo que nunca cresça para dentro do mapa.
 */
export function resolveSheetResizeAgainstMap({
  prevSheet,
  handle,
  dx,
  dy,
  vpW,
  vpH,
  mapRect,
  gap = BARRIER_GAP,
  pad = EDGE_PAD,
}) {
  const maxWidth = Math.max(MIN_SHEET_WIDTH, Math.min(820, vpW - MIN_MAP_RESERVE - gap - pad * 2));
  const maxHeight = Math.max(MIN_SHEET_HEIGHT, vpH - pad * 2);

  let left = prevSheet.x;
  let right = prevSheet.x + prevSheet.width;
  let top = prevSheet.y;
  let bottom = prevSheet.y + prevSheet.height;
  let collided = false;
  let edge = null;

  if (handle.includes('w')) {
    left = Math.max(pad, Math.min(right - MIN_SHEET_WIDTH, prevSheet.x + dx));
    if (right - left > maxWidth) left = right - maxWidth;
  }
  if (handle.includes('e')) {
    right = Math.min(vpW - pad, Math.max(left + MIN_SHEET_WIDTH, prevSheet.x + prevSheet.width + dx));
    if (right - left > maxWidth) right = left + maxWidth;
  }
  if (handle.includes('n')) {
    top = Math.max(pad, Math.min(bottom - MIN_SHEET_HEIGHT, prevSheet.y + dy));
    if (bottom - top > maxHeight) top = bottom - maxHeight;
  }
  if (handle.includes('s')) {
    bottom = Math.min(vpH - pad, Math.max(top + MIN_SHEET_HEIGHT, prevSheet.y + prevSheet.height + dy));
    if (bottom - top > maxHeight) bottom = top + maxHeight;
  }

  const candidate = {
    x: Math.round(left),
    y: Math.round(top),
    width: Math.round(right - left),
    height: Math.round(bottom - top),
  };

  if (mapRect && rectsOverlap(toBox(candidate), mapRect, gap)) {
    // Clampa estritamente cada borda sendo redimensionada fora do retângulo do mapa
    const prevBox = toBox(prevSheet);
    if (handle.includes('w') && prevBox.left >= mapRect.right + gap - 2) {
      const safeLeft = Math.ceil(mapRect.right + gap);
      if (right - safeLeft >= MIN_SHEET_WIDTH) {
        left = Math.max(left, safeLeft);
        collided = true;
        edge = 'left';
      } else {
        return { sheet: prevSheet, collided: true, edge: 'left' };
      }
    }
    if (handle.includes('e') && prevBox.right <= mapRect.left - gap + 2) {
      const safeRight = Math.floor(mapRect.left - gap);
      if (safeRight - left >= MIN_SHEET_WIDTH) {
        right = Math.min(right, safeRight);
        collided = true;
        edge = 'right';
      } else {
        return { sheet: prevSheet, collided: true, edge: 'right' };
      }
    }
    if (handle.includes('n') && prevBox.top >= mapRect.bottom + gap - 2) {
      const safeTop = Math.ceil(mapRect.bottom + gap);
      if (bottom - safeTop >= MIN_SHEET_HEIGHT) {
        top = Math.max(top, safeTop);
        collided = true;
        edge = 'top';
      } else {
        return { sheet: prevSheet, collided: true, edge: 'top' };
      }
    }
    if (handle.includes('s') && prevBox.bottom <= mapRect.top - gap + 2) {
      const safeBottom = Math.floor(mapRect.top - gap);
      if (safeBottom - top >= MIN_SHEET_HEIGHT) {
        bottom = Math.min(bottom, safeBottom);
        collided = true;
        edge = 'bottom';
      } else {
        return { sheet: prevSheet, collided: true, edge: 'bottom' };
      }
    }

    const clamped = {
      x: Math.round(left),
      y: Math.round(top),
      width: Math.max(MIN_SHEET_WIDTH, Math.round(right - left)),
      height: Math.max(MIN_SHEET_HEIGHT, Math.round(bottom - top)),
    };

    if (rectsOverlap(toBox(clamped), mapRect, gap - 0.5)) {
      return { sheet: prevSheet, collided: true, edge: edge || 'left' };
    }
    return { sheet: clamped, collided, edge };
  }

  return { sheet: candidate, collided: false, edge: null };
}

/**
 * Gera um `clip-path: polygon(evenodd, ...)` para a camada do mapa recortando com precisão
 * toda a área ocupada pela ficha (com margem de respiro), garantindo 0 pixels de mapa
 * renderizados atrás ou por cima da ficha mesmo em zoom profundo (ex: 300%–600%).
 */
export function buildSheetCutoutClipPath(sheet, vpW, vpH, margin = 6) {
  if (!sheet || vpW <= 0 || vpH <= 0) return undefined;
  const x1 = Math.max(0, Math.floor(sheet.x - margin));
  const y1 = Math.max(0, Math.floor(sheet.y - margin));
  const x2 = Math.min(vpW, Math.ceil(sheet.x + sheet.width + margin));
  const y2 = Math.min(vpH, Math.ceil(sheet.y + sheet.height + margin));
  if (x2 <= x1 || y2 <= y1) return undefined;

  return `polygon(evenodd, 0px 0px, ${vpW}px 0px, ${vpW}px ${vpH}px, 0px ${vpH}px, 0px 0px, ${x1}px ${y1}px, ${x2}px ${y1}px, ${x2}px ${y2}px, ${x1}px ${y2}px, ${x1}px ${y1}px)`;
}
