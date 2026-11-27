import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp, rateLimitErrorResponse } from '../../../lib/api-security';

export const dynamic = 'force-dynamic';

/**
 * Retorna o relógio UTC autoritativo do servidor em milissegundos
 * para calibrar a sincronização de música em tempo real entre Mestre e Jogadores.
 */
export async function GET(request) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`time:ip:${ip}`, { limit: 120, windowMs: 60_000 });
  if (!rl.allowed) return rateLimitErrorResponse(rl);

  return NextResponse.json(
    { now: Date.now() },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
