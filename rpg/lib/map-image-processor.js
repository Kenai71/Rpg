'use client';

/**
 * Processador Resiliente de Imagens de Mapas Táticos (Suporte a Mapas Gigantes: 4K, 8K, 16K+ e 50MB+)
 *
 * Projetado para NUNCA travar o navegador, NUNCA gerar canvas vazio ("data:,") e SEMPRE preservar
 * a proporção exata e a máxima nitidez suportada pela GPU e pelo banco de dados:
 * - Usa URL.createObjectURL(file) em vez de FileReader.readAsDataURL inicial (evita duplicar dezenas de MB na RAM).
 * - Usa createImageBitmap com resize nativo (quando disponível) para decodificar mapas de 100+ megapixels
 *   sem estourar a memória da aba.
 * - Usa canvas.toBlob() assíncrono (fora da thread principal) com validação estrita de blob não-vazio e
 *   liberação imediata de memória de cada canvas temporário (width = height = 0).
 * - Garante matematicamente que o resultado caiba dentro do limite seguro de chunks do Firestore (<= 28 chunks, ~15 MB binários),
 *   gerando também prévia ultraleve instantânea e fallback garantido para 1 documento.
 */

const SINGLE_DOC_BINARY_BUDGET = 635 * 1024; // ~847 KB em base64 (seguro sob o limite de 885 KB)
const SINGLE_DOC_DATAURL_BUDGET = 865000;
const HD_CHUNK_BINARY_BUDGET = 14.5 * 1024 * 1024; // ~19.4 MB em base64 -> <= 27 chunks de 740 KB (regra permite até 32)
const PREVIEW_BINARY_BUDGET = 125 * 1024; // ~167 KB em base64 (carrossel e carregamento imediato)

// Limites seguros de decodificação/codificação de GPU para evitar crash ou canvas em branco
const MAX_ENCODE_SIDE_DESKTOP = 8192;
const MAX_ENCODE_PIXELS_DESKTOP = 36_000_000; // Ex: 8192x4394 ou 6000x6000 (ultra-nítido sem OOM)
const MAX_ENCODE_SIDE_MOBILE = 4096;
const MAX_ENCODE_PIXELS_MOBILE = 16_000_000; // Safari / iOS limita canvas a ~16.7 MP

const IMAGE_EXTENSION_RE = /\.(png|jpe?g|webp|avif|bmp|gif)$/i;

let cachedWebPSupport = null;

function isLikelyMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
}

function detectWebPSupport() {
  if (cachedWebPSupport !== null) return cachedWebPSupport;
  try {
    const test = document.createElement('canvas');
    test.width = 2;
    test.height = 2;
    const supported = test.toDataURL('image/webp', 0.8).startsWith('data:image/webp');
    test.width = 0;
    test.height = 0;
    cachedWebPSupport = supported;
    return supported;
  } catch {
    cachedWebPSupport = false;
    return false;
  }
}

export function formatBytesCompact(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result.length > 32) {
        resolve(reader.result);
      } else {
        reject(new Error('Falha ao converter imagem processada.'));
      }
    };
    reader.onerror = () => reject(new Error('Erro de leitura ao serializar imagem.'));
    reader.readAsDataURL(blob);
  });
}

function yieldToUi() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => setTimeout(resolve, 0));
    } else {
      setTimeout(resolve, 0);
    }
  });
}

function computeSafeDimensions(origW, origH, maxSide, maxPixels) {
  let w = Math.max(16, Math.round(origW));
  let h = Math.max(16, Math.round(origH));

  if (w > maxSide || h > maxSide) {
    const sideRatio = Math.min(maxSide / w, maxSide / h);
    w = Math.max(16, Math.round(w * sideRatio));
    h = Math.max(16, Math.round(h * sideRatio));
  }

  const area = w * h;
  if (area > maxPixels) {
    const areaRatio = Math.sqrt(maxPixels / area);
    w = Math.max(16, Math.round(w * areaRatio));
    h = Math.max(16, Math.round(h * areaRatio));
  }

  return { width: w, height: h };
}

/**
 * Lê dimensões reais (width × height) diretamente do cabeçalho binário (PNG, WebP ou JPEG)
 * sem decodificar a imagem inteira em RAM — essencial para mapas colossais (16K–30K+ px)
 * onde decodificar via <img> antes de redimensionar consumiria centenas de MB / GB de memória.
 */
async function readImageDimensionsFromHeader(file) {
  try {
    const headSlice = file.slice(0, Math.min(file.size, 262144));
    const buf = await headSlice.arrayBuffer();
    const v = new DataView(buf);
    const len = buf.byteLength;

    // PNG: assinatura 89 50 4E 47 0D 0A 1A 0A + IHDR width/height em bytes 16..23
    if (
      len >= 24 &&
      v.getUint32(0, false) === 0x89504e47 &&
      v.getUint32(4, false) === 0x0d0a1a0a
    ) {
      const w = v.getUint32(16, false);
      const h = v.getUint32(20, false);
      if (w > 0 && h > 0 && w <= 100000 && h <= 100000) return { width: w, height: h };
    }

    // WebP: RIFF....WEBP + VP8X / VP8L / VP8
    if (
      len >= 30 &&
      v.getUint32(0, false) === 0x52494646 &&
      v.getUint32(8, false) === 0x57454250
    ) {
      const chunkTag = v.getUint32(12, false);
      if (chunkTag === 0x56503858 && len >= 30) {
        // VP8X (extended)
        const w = 1 + (v.getUint8(24) | (v.getUint8(25) << 8) | (v.getUint8(26) << 16));
        const h = 1 + (v.getUint8(27) | (v.getUint8(28) << 8) | (v.getUint8(29) << 16));
        if (w > 0 && h > 0) return { width: w, height: h };
      } else if (chunkTag === 0x5650384c && len >= 25 && v.getUint8(20) === 0x2f) {
        // VP8L (lossless)
        const b0 = v.getUint8(21);
        const b1 = v.getUint8(22);
        const b2 = v.getUint8(23);
        const b3 = v.getUint8(24);
        const w = 1 + (((b1 & 0x3f) << 8) | b0);
        const h = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
        if (w > 0 && h > 0) return { width: w, height: h };
      } else if (chunkTag === 0x56503820 && len >= 30) {
        // VP8 (lossy)
        const w = v.getUint16(26, true) & 0x3fff;
        const h = v.getUint16(28, true) & 0x3fff;
        if (w > 0 && h > 0) return { width: w, height: h };
      }
    }

    // JPEG: FF D8 ... marcadores SOF0..SOF15 (exceto DHT C4, JPG C8, DAC CC)
    if (len >= 12 && v.getUint16(0, false) === 0xffd8) {
      let offset = 2;
      while (offset + 9 < len) {
        if (v.getUint8(offset) !== 0xff) {
          offset += 1;
          continue;
        }
        while (offset < len && v.getUint8(offset) === 0xff) offset += 1;
        if (offset >= len) break;
        const marker = v.getUint8(offset);
        offset += 1;

        if (marker === 0xd9 || marker === 0xda) break; // EOI / SOS
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
        if (offset + 2 > len) break;
        const segLen = v.getUint16(offset, false);
        if (segLen < 2 || offset + segLen > len) break;

        const isSof =
          marker >= 0xc0 &&
          marker <= 0xcf &&
          marker !== 0xc4 &&
          marker !== 0xc8 &&
          marker !== 0xcc;
        if (isSof && segLen >= 7) {
          const h = v.getUint16(offset + 3, false);
          const w = v.getUint16(offset + 5, false);
          if (w > 0 && h > 0) return { width: w, height: h };
        }
        offset += segLen;
      }
    }
  } catch {
    // Cai no probe padrão via <img>
  }
  return null;
}

function probeFileDimensions(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const width = img.naturalWidth || img.width || 0;
      const height = img.naturalHeight || img.height || 0;
      if (width > 0 && height > 0) {
        resolve({ img, objectUrl, width, height });
      } else {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Não foi possível detectar as dimensões da imagem.'));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Arquivo de imagem corrompido ou formato não suportado pelo navegador.'));
    };
    img.src = objectUrl;
  });
}

/**
 * Desenha uma fonte (ImageBitmap ou HTMLImageElement) em um canvas temporário,
 * converte para Blob assincronamente e libera o canvas imediatamente.
 * Retorna null se o navegador falhar por limite de memória/canvas.
 */
function encodeSourceToBlob(source, targetW, targetH, mime, quality) {
  return new Promise((resolve) => {
    let canvas = null;
    try {
      canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d', { alpha: mime === 'image/png' || mime === 'image/webp' });
      if (!ctx) {
        canvas.width = 0;
        canvas.height = 0;
        resolve(null);
        return;
      }

      if (mime === 'image/jpeg') {
        ctx.fillStyle = '#090c14';
        ctx.fillRect(0, 0, targetW, targetH);
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source, 0, 0, targetW, targetH);

      if (typeof canvas.toBlob === 'function') {
        canvas.toBlob(
          (blob) => {
            try {
              canvas.width = 0;
              canvas.height = 0;
            } catch {}
            if (blob && blob.size > 128) {
              resolve(blob);
            } else {
              resolve(null);
            }
          },
          mime,
          quality
        );
      } else {
        const dataUrl = canvas.toDataURL(mime, quality);
        canvas.width = 0;
        canvas.height = 0;
        if (!dataUrl || dataUrl.length < 64 || dataUrl === 'data:,') {
          resolve(null);
          return;
        }
        fetch(dataUrl)
          .then((r) => r.blob())
          .then((b) => resolve(b && b.size > 128 ? b : null))
          .catch(() => resolve(null));
      }
    } catch {
      try {
        if (canvas) {
          canvas.width = 0;
          canvas.height = 0;
        }
      } catch {}
      resolve(null);
    }
  });
}

/**
 * Busca binária assíncrona por qualidade usando canvas.toBlob() (sem congelar a interface).
 * Retorna { blob, quality } ou null se nem na qualidade mínima couber no orçamento.
 */
async function binarySearchBlobQuality(source, targetW, targetH, mime, minQ, maxQ, maxBytes, steps = 4) {
  const maxBlob = await encodeSourceToBlob(source, targetW, targetH, mime, maxQ);
  if (!maxBlob) return { failedCanvas: true };
  if (maxBlob.size <= maxBytes) {
    return { blob: maxBlob, quality: maxQ };
  }

  const minBlob = await encodeSourceToBlob(source, targetW, targetH, mime, minQ);
  if (!minBlob) return { failedCanvas: true };
  if (minBlob.size > maxBytes) {
    return null;
  }

  let lo = minQ;
  let hi = maxQ;
  let bestBlob = minBlob;
  let bestQ = minQ;

  for (let i = 0; i < steps; i += 1) {
    await yieldToUi();
    const mid = Math.round(((lo + hi) / 2) * 100) / 100;
    const candidate = await encodeSourceToBlob(source, targetW, targetH, mime, mid);
    if (!candidate) break;
    if (candidate.size <= maxBytes) {
      bestBlob = candidate;
      bestQ = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return { blob: bestBlob, quality: bestQ };
}

/**
 * Decodifica uma imagem gigantesca para uma resolução segura de trabalho usando
 * createImageBitmap com redimensionamento nativo (economiza centenas de MB de RAM),
 * com fallback automático para HTMLImageElement + redução progressiva se necessário.
 */
async function decodeWorkingSource(file, imgEl, origW, origH, targetW, targetH) {
  const needsResize = targetW < origW || targetH < origH;

  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = needsResize
        ? await createImageBitmap(file, {
            resizeWidth: targetW,
            resizeHeight: targetH,
            resizeQuality: 'high',
          })
        : await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width || targetW,
        height: bitmap.height || targetH,
        dispose: () => {
          try {
            bitmap.close?.();
          } catch {}
        },
      };
    } catch {
      // Alguns navegadores rejeitam resizeWidth em formatos específicos -> cai no fallback abaixo
    }
  }

  return {
    source: imgEl,
    width: targetW,
    height: targetH,
    dispose: () => {},
  };
}

/**
 * Garante sempre um blob válido que caiba em 1 documento Firestore (<= 635 KB binários)
 * para fallback resiliente ou preview do carrossel.
 */
async function buildBoundedBlob(source, baseW, baseH, mime, budgetBytes, minQ, maxQ, maxDimCap = null) {
  let startW = baseW;
  let startH = baseH;
  if (maxDimCap && (startW > maxDimCap || startH > maxDimCap)) {
    const r = Math.min(maxDimCap / startW, maxDimCap / startH);
    startW = Math.max(16, Math.round(startW * r));
    startH = Math.max(16, Math.round(startH * r));
  }

  const scales = [1.0, 0.82, 0.66, 0.52, 0.4, 0.3, 0.22, 0.15];
  for (const sc of scales) {
    const w = Math.max(32, Math.round(startW * sc));
    const h = Math.max(32, Math.round(startH * sc));
    const res = await binarySearchBlobQuality(source, w, h, mime, minQ, maxQ, budgetBytes, 3);
    if (res && res.blob) {
      return { blob: res.blob, width: w, height: h, quality: res.quality };
    }
    await yieldToUi();
  }

  // Último recurso absoluto (ex: 1280px JPEG 0.62) — impossível exceder o orçamento
  const ratio = Math.min(1, 1280 / Math.max(startW, startH));
  const safeW = Math.max(32, Math.round(startW * ratio));
  const safeH = Math.max(32, Math.round(startH * ratio));
  const lastBlob =
    (await encodeSourceToBlob(source, safeW, safeH, mime, 0.6)) ||
    (await encodeSourceToBlob(source, Math.min(safeW, 960), Math.min(safeH, 960), 'image/jpeg', 0.55));

  if (!lastBlob) {
    throw new Error('O navegador não conseguiu processar esta imagem por falta de memória.');
  }

  return { blob: lastBlob, width: safeW, height: safeH, quality: 0.6 };
}

/**
 * Processa qualquer imagem de mapa (desde pequenos ícones até mapas colossais de 16K+ e 50MB+).
 */
export async function processHugeMapImage(file, onProgress = null) {
  const report = (percent, label) => {
    if (typeof onProgress === 'function') {
      onProgress({ percent: Math.max(0, Math.min(100, Math.round(percent))), label });
    }
  };

  if (!file || (!file.type?.startsWith('image/') && !IMAGE_EXTENSION_RE.test(file.name || ''))) {
    throw new Error('Selecione um arquivo de imagem válido (PNG, JPG, WebP ou AVIF).');
  }

  const baseName = (file.name || 'Mapa Tático').replace(/\.[^/.]+$/, '');
  const bestMime = detectWebPSupport() ? 'image/webp' : 'image/jpeg';
  const mobile = isLikelyMobileDevice();
  const maxSide = mobile ? MAX_ENCODE_SIDE_MOBILE : MAX_ENCODE_SIDE_DESKTOP;
  const maxPixels = mobile ? MAX_ENCODE_PIXELS_MOBILE : MAX_ENCODE_PIXELS_DESKTOP;

  report(8, 'Lendo dimensões reais do mapa...');

  let objectUrl = null;
  let img = null;
  let origW = 0;
  let origH = 0;

  // 1. Tenta ler dimensões direto do cabeçalho binário (0 MB de RAM decodificada — ideal para mapas de 16K–30K+ px!)
  const headerDims = await readImageDimensionsFromHeader(file);
  if (headerDims) {
    origW = headerDims.width;
    origH = headerDims.height;
  } else {
    const probed = await probeFileDimensions(file);
    img = probed.img;
    objectUrl = probed.objectUrl;
    origW = probed.width;
    origH = probed.height;
  }

  let working = null;

  try {
    await yieldToUi();

    // CAMINHO 1: Arquivo original já cabe intacto em 1 único documento Firestore -> ZERO recompressão
    const isStandardWebFormat = ['image/png', 'image/jpeg', 'image/webp'].includes(file.type);
    if (isStandardWebFormat && file.size <= SINGLE_DOC_BINARY_BUDGET) {
      report(70, 'Preservando arquivo original sem perdas...');
      const rawDataUrl = await blobToDataUrl(file);
      if (rawDataUrl.length <= SINGLE_DOC_DATAURL_BUDGET) {
        report(100, 'Pronto em qualidade original!');
        return {
          previewUrl: rawDataUrl,
          imageUrl: rawDataUrl,
          hdBlob: null,
          hdDataUrl: null,
          fallbackImageUrl: rawDataUrl,
          width: origW,
          height: origH,
          encodedWidth: origW,
          encodedHeight: origH,
          fileSizeBytes: file.size,
          encodedSizeBytes: file.size,
          estimatedChunks: 0,
          wasDownscaled: false,
          qualityLabel: 'Original sem perdas',
          name: baseName,
        };
      }
    }

    // Calcula resolução segura para codificação HD na GPU (preservando 100% a proporção exata!)
    const safeDims = computeSafeDimensions(origW, origH, maxSide, maxPixels);
    const wasDownscaled = safeDims.width < origW || safeDims.height < origH;

    report(
      20,
      wasDownscaled
        ? `Otimizando mapa imenso (${origW}×${origH} px → ${safeDims.width}×${safeDims.height} px HD)...`
        : `Preparando imagem HD (${origW}×${origH} px)...`
    );

    working = await decodeWorkingSource(file, img, origW, origH, safeDims.width, safeDims.height);
    // Se não tínhamos <img> e createImageBitmap falhou, faz fallback para <img> agora
    if (!working.source) {
      const probed = await probeFileDimensions(file);
      img = probed.img;
      objectUrl = probed.objectUrl;
      origW = probed.width;
      origH = probed.height;
      working = {
        source: img,
        width: safeDims.width,
        height: safeDims.height,
        dispose: () => {},
      };
    }
    await yieldToUi();

    // CAMINHO 2: Tenta encaixar em 1 único documento em altíssima qualidade WebP (84% a 96%) mantendo pixels exatos
    report(36, 'Verificando compressão sem perdas visuais...');
    const exactSingle = await binarySearchBlobQuality(
      working.source,
      working.width,
      working.height,
      bestMime,
      0.84,
      0.96,
      SINGLE_DOC_BINARY_BUDGET,
      4
    );

    if (exactSingle && exactSingle.blob) {
      report(88, 'Finalizando mapa em alta definição...');
      const singleDataUrl = await blobToDataUrl(exactSingle.blob);
      if (singleDataUrl.length <= SINGLE_DOC_DATAURL_BUDGET) {
        report(100, 'Pronto!');
        return {
          previewUrl: singleDataUrl,
          imageUrl: singleDataUrl,
          hdBlob: null,
          hdDataUrl: null,
          fallbackImageUrl: singleDataUrl,
          width: origW,
          height: origH,
          encodedWidth: working.width,
          encodedHeight: working.height,
          fileSizeBytes: file.size,
          encodedSizeBytes: exactSingle.blob.size,
          estimatedChunks: 0,
          wasDownscaled,
          qualityLabel: wasDownscaled
            ? `Ultra HD Otimizado (${working.width}×${working.height})`
            : `Máxima (${Math.round(exactSingle.quality * 100)}% HD)`,
          name: baseName,
        };
      }
    }

    // CAMINHO 3 & 4: Mapa Ultra HD / Gigante -> Chunks HD (até 14.5 MB binários / <= 28 chunks)
    let hdBlob = null;
    let hdEncodedW = working.width;
    let hdEncodedH = working.height;
    let qualityLabel = 'Original Ultra HD';

    // Se o arquivo original já for WebP/JPG/PNG, <= 14.5 MB e dentro de limites renderizáveis (<= 8192px e <= 40MP),
    // sobe os bytes originais 100% intactos!
    const canKeepOriginalChunks =
      isStandardWebFormat &&
      file.size <= HD_CHUNK_BINARY_BUDGET &&
      origW <= MAX_ENCODE_SIDE_DESKTOP &&
      origH <= MAX_ENCODE_SIDE_DESKTOP &&
      origW * origH <= 40_000_000;

    if (canKeepOriginalChunks) {
      report(55, 'Preservando imagem original Ultra HD em blocos...');
      hdBlob = file;
      hdEncodedW = origW;
      hdEncodedH = origH;
      qualityLabel = 'Original Ultra HD (sem perdas)';
    } else {
      report(52, 'Codificando versão Ultra HD otimizada para a mesa...');
      // Tenta na resolução segura completa primeiro; se o dispositivo falhar por RAM ou passar de 14.5MB, reduz em degraus suaves
      const hdScales = [1.0, 0.85, 0.72, 0.58, 0.45, 0.35];
      for (const sc of hdScales) {
        const w = Math.max(64, Math.round(working.width * sc));
        const h = Math.max(64, Math.round(working.height * sc));
        const res = await binarySearchBlobQuality(
          working.source,
          w,
          h,
          bestMime,
          0.76,
          0.93,
          HD_CHUNK_BINARY_BUDGET,
          4
        );
        if (res && res.blob) {
          hdBlob = res.blob;
          hdEncodedW = w;
          hdEncodedH = h;
          const pct = Math.round(res.quality * 100);
          qualityLabel =
            w < origW || h < origH
              ? `Ultra HD ${w}×${h} (${pct}%)`
              : `Ultra HD (${pct}%)`;
          break;
        }
        await yieldToUi();
      }
    }

    // Gera prévia rápida leve (<= 125 KB binários) e fallback single-doc de alta qualidade (<= 635 KB binários)
    report(76, 'Gerando prévia rápida e camada de compatibilidade...');
    const previewRes = await buildBoundedBlob(
      working.source,
      working.width,
      working.height,
      bestMime,
      PREVIEW_BINARY_BUDGET,
      0.58,
      0.84,
      1100
    );
    const previewDataUrl = await blobToDataUrl(previewRes.blob);

    report(88, 'Preparando fallback de alta nitidez...');
    const fallbackRes = await buildBoundedBlob(
      working.source,
      working.width,
      working.height,
      bestMime,
      SINGLE_DOC_BINARY_BUDGET,
      0.66,
      0.92,
      Math.min(working.width, 3200)
    );
    const fallbackDataUrl = await blobToDataUrl(fallbackRes.blob);

    // Se mesmo o HD falhou completamente (caso extremo de dispositivo sem RAM), usa o fallback direto
    if (!hdBlob || hdBlob.size <= SINGLE_DOC_BINARY_BUDGET) {
      const singleUrl = hdBlob ? await blobToDataUrl(hdBlob) : fallbackDataUrl;
      const safeUrl = singleUrl.length <= SINGLE_DOC_DATAURL_BUDGET ? singleUrl : fallbackDataUrl;
      report(100, 'Mapa otimizado e pronto!');
      return {
        previewUrl: safeUrl,
        imageUrl: safeUrl,
        hdBlob: null,
        hdDataUrl: null,
        fallbackImageUrl: safeUrl,
        width: origW,
        height: origH,
        encodedWidth: hdBlob ? hdEncodedW : fallbackRes.width,
        encodedHeight: hdBlob ? hdEncodedH : fallbackRes.height,
        fileSizeBytes: file.size,
        encodedSizeBytes: hdBlob ? hdBlob.size : fallbackRes.blob.size,
        estimatedChunks: 0,
        wasDownscaled: hdEncodedW < origW || hdEncodedH < origH,
        qualityLabel: 'Alta Definição Otimizada',
        name: baseName,
      };
    }

    const estimatedBase64Len = Math.ceil((hdBlob.size * 4) / 3);
    const estimatedChunks = Math.max(1, Math.ceil(estimatedBase64Len / 740000));

    report(100, `Ultra HD pronto (${estimatedChunks} blocos)!`);

    return {
      previewUrl: previewDataUrl,
      imageUrl: previewDataUrl,
      hdBlob,
      hdDataUrl: null, // Será lido/fatiado direto do hdBlob em createMap sem duplicar string em state
      fallbackImageUrl: fallbackDataUrl,
      width: origW,
      height: origH,
      encodedWidth: hdEncodedW,
      encodedHeight: hdEncodedH,
      fileSizeBytes: file.size,
      encodedSizeBytes: hdBlob.size,
      estimatedChunks,
      wasDownscaled: hdEncodedW < origW || hdEncodedH < origH,
      qualityLabel,
      name: baseName,
    };
  } finally {
    if (working) working.dispose();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
