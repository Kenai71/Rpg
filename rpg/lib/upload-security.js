/**
 * Módulo de Segurança para Uploads de Arquivos e URLs de Mídia
 *
 * Proteções implementadas:
 * 1. Inspeção de Magic Bytes (assinatura binária real): bloqueia Zip Bombs (PK\x03\x04),
 *    GZIP/BZIP2/7z/RAR, SVG/XML (Billion Laughs & XSS), HTML disfarçado e executáveis (PE/ELF/Mach-O).
 * 2. Proteção contra Image Decompression Bomb (Pixel Flood): teto de dimensões (<= 16384px),
 *    teto total de pixels (<= 100 MP) e detecção de razão de compressão anômala antes de decodificar em RAM.
 * 3. Sanitização de URLs de mídia: bloqueia `javascript:`, `vbscript:`, `file:`,
 *    `data:text/html` e `data:image/svg+xml`.
 */

export const MAX_MAP_UPLOAD_BYTES = 40 * 1024 * 1024; // 40 MB máx. para mapas Ultra HD
export const MAX_AVATAR_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB máx. para avatares/tokens/handouts
export const MAX_AUDIO_UPLOAD_BYTES = 8.2 * 1024 * 1024; // ~8 MB máx. para faixas de áudio
export const MAX_IMAGE_SIDE_PX = 16384; // Teto absoluto anti-pixel-flood (16K)
export const MAX_IMAGE_TOTAL_PIXELS = 100_000_000; // 100 MP máx. (evita OOM/decompression bomb)

function matchBytes(bytes, signature, offset = 0) {
  if (!bytes || bytes.length < offset + signature.length) return false;
  for (let i = 0; i < signature.length; i += 1) {
    if (bytes[offset + i] !== signature[i]) return false;
  }
  return true;
}

function asciiAt(bytes, offset, length) {
  if (!bytes || bytes.length < offset + length) return '';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += String.fromCharCode(bytes[offset + i]);
  }
  return out;
}

/**
 * Classifica um buffer de cabeçalho (primeiros 64 bytes) quanto a assinaturas perigosas
 * ou formatos legítimos de imagem/áudio. Função pura (testável em Node e Browser).
 */
export function inspectMagicBytesBuffer(uint8) {
  if (!(uint8 instanceof Uint8Array) || uint8.length < 4) {
    return { kind: 'unknown', safe: false, reason: 'Arquivo vazio ou corrompido.' };
  }

  // 1. Bloqueio explícito de arquivos compactados / Zip Bombs / Executáveis / Scripts
  if (
    matchBytes(uint8, [0x50, 0x4b, 0x03, 0x04]) || // ZIP / JAR / DOCX
    matchBytes(uint8, [0x50, 0x4b, 0x05, 0x06]) || // Empty ZIP
    matchBytes(uint8, [0x50, 0x4b, 0x07, 0x08])    // Spanned ZIP
  ) {
    return { kind: 'archive-zip', safe: false, reason: 'Arquivos compactados (ZIP) não são permitidos.' };
  }
  if (
    matchBytes(uint8, [0x1f, 0x8b]) ||             // GZIP
    matchBytes(uint8, [0x42, 0x5a, 0x68]) ||       // BZIP2
    matchBytes(uint8, [0x37, 0x7a, 0xbc, 0xaf]) || // 7-Zip
    matchBytes(uint8, [0x52, 0x61, 0x72, 0x21]) || // RAR
    matchBytes(uint8, [0x28, 0xb5, 0x2f, 0xfd])    // ZSTD
  ) {
    return { kind: 'archive', safe: false, reason: 'Arquivos comprimidos não são permitidos.' };
  }
  if (
    matchBytes(uint8, [0x4d, 0x5a]) ||             // Windows PE/EXE/DLL
    matchBytes(uint8, [0x7f, 0x45, 0x4c, 0x46]) || // Linux ELF
    matchBytes(uint8, [0xcf, 0xfa, 0xed, 0xfe]) || // macOS Mach-O
    matchBytes(uint8, [0x25, 0x50, 0x44, 0x46])    // PDF disfarçado
  ) {
    return { kind: 'executable-or-doc', safe: false, reason: 'Tipo de arquivo bloqueado por segurança.' };
  }

  // Bloqueio explícito de SVG, XML e HTML (previne XSS e Billion Laughs XML bomb)
  const headText = asciiAt(uint8, 0, Math.min(uint8.length, 64))
    .replace(/^\uFEFF/, '')
    .trimStart()
    .toLowerCase();
  if (
    headText.startsWith('<svg') ||
    headText.startsWith('<?xml') ||
    headText.startsWith('<!doctype') ||
    headText.startsWith('<html') ||
    headText.startsWith('<script')
  ) {
    return {
      kind: 'markup-svg-html',
      safe: false,
      reason: 'Arquivos SVG, XML ou HTML não são aceitos por segurança. Envie PNG, JPG ou WebP.',
    };
  }

  // 2. Assinaturas válidas de IMAGEM RASTER
  if (matchBytes(uint8, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { kind: 'image', format: 'image/png', safe: true };
  }
  if (matchBytes(uint8, [0xff, 0xd8, 0xff])) {
    return { kind: 'image', format: 'image/jpeg', safe: true };
  }
  if (
    uint8.length >= 12 &&
    asciiAt(uint8, 0, 4) === 'RIFF' &&
    asciiAt(uint8, 8, 4) === 'WEBP'
  ) {
    return { kind: 'image', format: 'image/webp', safe: true };
  }
  if (asciiAt(uint8, 0, 6) === 'GIF87a' || asciiAt(uint8, 0, 6) === 'GIF89a') {
    return { kind: 'image', format: 'image/gif', safe: true };
  }
  if (matchBytes(uint8, [0x42, 0x4d])) {
    return { kind: 'image', format: 'image/bmp', safe: true };
  }
  if (uint8.length >= 12 && asciiAt(uint8, 4, 4) === 'ftyp') {
    const brand = asciiAt(uint8, 8, 4);
    if (['avif', 'avis', 'mif1', 'msf1', 'heic', 'heix'].includes(brand)) {
      return { kind: 'image', format: 'image/avif', safe: true };
    }
    if (['M4A ', 'mp42', 'isom', 'qt  ', 'M4B ', '3gp4'].includes(brand)) {
      return { kind: 'audio', format: 'audio/mp4', safe: true };
    }
  }

  // 3. Assinaturas válidas de ÁUDIO
  if (
    asciiAt(uint8, 0, 3) === 'ID3' ||
    (uint8[0] === 0xff && (uint8[1] & 0xe0) === 0xe0)
  ) {
    return { kind: 'audio', format: 'audio/mpeg', safe: true };
  }
  if (asciiAt(uint8, 0, 4) === 'OggS') {
    return { kind: 'audio', format: 'audio/ogg', safe: true };
  }
  if (
    uint8.length >= 12 &&
    asciiAt(uint8, 0, 4) === 'RIFF' &&
    asciiAt(uint8, 8, 4) === 'WAVE'
  ) {
    return { kind: 'audio', format: 'audio/wav', safe: true };
  }
  if (matchBytes(uint8, [0x1a, 0x45, 0xdf, 0xa3])) {
    return { kind: 'audio', format: 'audio/webm', safe: true };
  }
  if (asciiAt(uint8, 0, 4) === 'fLaC') {
    return { kind: 'audio', format: 'audio/flac', safe: true };
  }

  return { kind: 'unknown', safe: false, reason: 'Assinatura de arquivo não reconhecida.' };
}

/**
 * Valida dimensões declaradas contra ataques de Image Decompression Bomb (Pixel Flood).
 */
export function validateSafeImageDimensions(width, height, fileSizeBytes = 0) {
  const w = Math.floor(Number(width) || 0);
  const h = Math.floor(Number(height) || 0);
  if (w <= 0 || h <= 0) {
    return { ok: false, reason: 'Dimensões da imagem inválidas.' };
  }
  if (w > MAX_IMAGE_SIDE_PX || h > MAX_IMAGE_SIDE_PX) {
    return {
      ok: false,
      reason: `Imagem excede o limite de segurança de ${MAX_IMAGE_SIDE_PX}px por lado (${w}×${h}px).`,
    };
  }
  const pixels = w * h;
  if (pixels > MAX_IMAGE_TOTAL_PIXELS) {
    return {
      ok: false,
      reason: `Imagem excede o teto de segurança de ${Math.round(
        MAX_IMAGE_TOTAL_PIXELS / 1_000_000
      )} megapixels (${Math.round(pixels / 1_000_000)} MP).`,
    };
  }
  // Heurística anti-PNG/JPEG bomb: arquivo minúsculo expandindo > 400x em RAM (RGBA)
  if (fileSizeBytes > 0 && fileSizeBytes < 256 * 1024 && pixels > 25_000_000) {
    const rawRgbaBytes = pixels * 4;
    if (rawRgbaBytes / fileSizeBytes > 400) {
      return {
        ok: false,
        reason: 'Arquivo bloqueado por suspeita de bomba de descompressão de pixels.',
      };
    }
  }
  return { ok: true, width: w, height: h, pixels };
}

async function readHeadBytes(file, maxLen = 64) {
  const slice = file.slice(0, Math.min(file.size, maxLen));
  const buf = await slice.arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Valida upload de imagem no cliente (tamanho, MIME sem SVG e assinatura binária real).
 */
export async function validateSafeImageFile(file, { maxBytes = MAX_AVATAR_UPLOAD_BYTES } = {}) {
  if (!file || typeof file.size !== 'number') {
    throw new Error('Selecione um arquivo de imagem válido.');
  }
  if (file.size <= 0) {
    throw new Error('O arquivo selecionado está vazio.');
  }
  if (file.size > maxBytes) {
    const maxMb = (maxBytes / (1024 * 1024)).toFixed(0);
    throw new Error(`Arquivo excede o limite máximo de ${maxMb} MB.`);
  }
  if (/svg|xml|html/i.test(file.type || '') || /\.svgz?$/i.test(file.name || '')) {
    throw new Error('Arquivos SVG não são permitidos por segurança. Use PNG, JPG ou WebP.');
  }

  const head = await readHeadBytes(file, 64);
  const magic = inspectMagicBytesBuffer(head);
  if (!magic.safe || magic.kind !== 'image') {
    throw new Error(magic.reason || 'Arquivo inválido. Envie uma imagem real (PNG, JPG, WebP ou GIF).');
  }
  return magic;
}

/**
 * Valida upload de áudio no cliente (tamanho e assinatura binária real).
 */
export async function validateSafeAudioFile(file, { maxBytes = MAX_AUDIO_UPLOAD_BYTES } = {}) {
  if (!file || typeof file.size !== 'number') {
    throw new Error('Selecione um arquivo de áudio válido.');
  }
  if (file.size <= 0) {
    throw new Error('O arquivo de áudio está vazio.');
  }
  if (file.size > maxBytes) {
    throw new Error('Arquivo excede 8 MB. Para trilhas longas, cole o link do YouTube ou URL direta.');
  }

  const head = await readHeadBytes(file, 64);
  const magic = inspectMagicBytesBuffer(head);
  if (!magic.safe || magic.kind !== 'audio') {
    throw new Error(magic.reason || 'Arquivo não é um áudio válido (MP3, OGG, WAV, WebM, M4A ou FLAC).');
  }
  return magic;
}

/**
 * Sanitiza URLs de imagens/avatares/mapas antes de persistir ou renderizar.
 * Bloqueia `javascript:`, `vbscript:`, `data:text/html`, `data:image/svg+xml` e protocolos locais.
 */
export function sanitizeMediaUrl(rawUrl, { allowDataImage = true, allowRelative = true } = {}) {
  if (typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  if (/^(javascript|vbscript|file|blob):/i.test(trimmed)) {
    return '';
  }

  if (trimmed.startsWith('data:')) {
    if (!allowDataImage) return '';
    if (/^data:image\/(png|jpeg|jpg|webp|gif|avif);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
      return trimmed;
    }
    return '';
  }

  if (allowRelative && trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:') {
      return parsed.toString();
    }
    if (parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
}
