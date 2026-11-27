import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from './firebase-admin';

/**
 * Camada centralizada de segurança para rotas de API (Anti-DDoS, Rate Limiting,
 * Limite de Payload anti-DoS, RBAC verdadeiro de Mestre e Sanitização).
 */

const MAX_RATE_BUCKETS = 10_000;
const rateLimitStore = new Map();

function pruneRateLimitStore(now) {
  if (rateLimitStore.size <= MAX_RATE_BUCKETS) return;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
  // Evicção FIFO caso ainda exceda o teto (impede OOM por flood de IPs aleatórios)
  while (rateLimitStore.size > MAX_RATE_BUCKETS) {
    const oldestKey = rateLimitStore.keys().next().value;
    if (oldestKey === undefined) break;
    rateLimitStore.delete(oldestKey);
  }
}

export function getClientIp(request) {
  const forwarded = request?.headers?.get?.('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const realIp = request?.headers?.get?.('x-real-ip')?.trim();
  if (realIp) return realIp.slice(0, 64);
  const cfIp = request?.headers?.get?.('cf-connecting-ip')?.trim();
  if (cfIp) return cfIp.slice(0, 64);
  return 'unknown';
}

/**
 * Rate Limiter em janela fixa/deslizante com mapa limitado (anti-OOM).
 */
export function checkRateLimit(bucketKey, { limit = 20, windowMs = 60_000 } = {}) {
  const now = Date.now();
  pruneRateLimitStore(now);

  const safeKey = String(bucketKey || 'default').slice(0, 160);
  const current = rateLimitStore.get(safeKey);

  if (!current || current.resetAt <= now) {
    const next = { count: 1, resetAt: now + windowMs };
    rateLimitStore.set(safeKey, next);
    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - 1),
      resetAt: next.resetAt,
      retryAfterSec: Math.ceil(windowMs / 1000),
    };
  }

  if (current.count >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAt: current.resetAt,
      retryAfterSec,
    };
  }

  current.count += 1;
  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt,
    retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}

export function rateLimitErrorResponse(rl) {
  return NextResponse.json(
    {
      success: false,
      error: `Muitas requisições em sequência. Aguarde ${rl.retryAfterSec}s e tente novamente.`,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(rl.retryAfterSec),
        'X-RateLimit-Limit': String(rl.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(rl.resetAt / 1000)),
        'Cache-Control': 'no-store',
      },
    }
  );
}

/**
 * Lê corpo JSON com teto estrito de bytes (protege contra payloads gigantes e chunked JSON bombs).
 */
export async function readSafeJsonBody(request, maxBytes = 32 * 1024) {
  const declaredLen = Number(request?.headers?.get?.('content-length'));
  if (Number.isFinite(declaredLen) && declaredLen > maxBytes) {
    return { ok: false, status: 413, error: 'Payload excede o tamanho máximo permitido.' };
  }

  try {
    const rawText = await request.text();
    if (!rawText || !rawText.trim()) {
      return { ok: true, data: {} };
    }
    const byteLen = Buffer.byteLength(rawText, 'utf8');
    if (byteLen > maxBytes) {
      return { ok: false, status: 413, error: 'Payload excede o tamanho máximo permitido.' };
    }
    const parsed = JSON.parse(rawText);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, status: 400, error: 'Corpo JSON inválido.' };
    }
    return { ok: true, data: parsed };
  } catch {
    return { ok: false, status: 400, error: 'JSON malformado na requisição.' };
  }
}

function timingSafeSecretMatch(provided, expected) {
  if (!provided || !expected) return false;
  const a = Buffer.from(String(provided), 'utf8');
  const b = Buffer.from(String(expected), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Verificação de autenticação + papel real de Mestre (NUNCA assume isMaster: true em fallback).
 * 1. Aceita CRON_SECRET com comparação em tempo constante (quando allowCron = true).
 * 2. Verifica ID Token via Firebase Admin SDK + leitura do perfil no Firestore.
 * 3. Caso Admin SDK não esteja configurado, valida ID Token na API oficial do Firebase Auth
 *    e consulta o próprio documento `profiles/{uid}` na REST API do Firestore para confirmar `role == 'master'`.
 */
export async function verifyApiBearerAuth(authHeader, { allowCron = false } = {}) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const idToken = authHeader.slice(7).trim();
  if (!idToken || idToken.length > 8192) return null;

  if (allowCron && process.env.CRON_SECRET && timingSafeSecretMatch(idToken, process.env.CRON_SECRET)) {
    return { uid: 'cron', isMaster: true, isCron: true };
  }

  try {
    const admin = await getFirebaseAdmin();
    if (admin) {
      try {
        const decoded = await admin.adminAuth.verifyIdToken(idToken);
        const profileSnap = await admin.adminDb.collection('profiles').doc(decoded.uid).get();
        const role = profileSnap.exists ? profileSnap.data()?.role : 'player';
        return { uid: decoded.uid, isMaster: role === 'master', isCron: false };
      } catch (adminErr) {
        console.warn('verifyIdToken via Admin SDK falhou:', adminErr?.message);
      }
    }
  } catch (err) {
    console.warn('Erro ao inicializar Admin SDK:', err?.message);
  }

  // Fallback seguro sem Admin SDK: valida token + verifica papel real no Firestore REST
  const webApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  if (!webApiKey || !projectId) return null;

  try {
    const authRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(webApiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        cache: 'no-store',
      }
    );
    if (!authRes.ok) return null;
    const authData = await authRes.json();
    const uid = authData?.users?.[0]?.localId;
    if (!uid) return null;

    // Consulta autoritativa no Firestore REST usando o próprio Bearer ID Token do usuário
    const profileUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      projectId
    )}/databases/(default)/documents/profiles/${encodeURIComponent(uid)}`;
    const profRes = await fetch(profileUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${idToken}` },
      cache: 'no-store',
    });
    if (!profRes.ok) {
      return { uid, isMaster: false, isCron: false };
    }
    const profDoc = await profRes.json();
    const role = profDoc?.fields?.role?.stringValue || 'player';
    return { uid, isMaster: role === 'master', isCron: false };
  } catch {
    return null;
  }
}

/**
 * Sanitiza texto enviado pelo usuário antes de incluir em prompts de IA
 * (remove caracteres de controle e símbolos de estrela proibidos).
 */
export function sanitizePromptInput(value, maxLen = 500) {
  return String(value || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[\u2605\u2606\u2B50\u2728]|\uD83C\uDF1F/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}
