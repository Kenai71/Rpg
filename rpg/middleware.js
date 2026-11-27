import { NextResponse } from 'next/server';

const MAX_API_BODY_BYTES = 64 * 1024; // 64 KB teto de borda para endpoints JSON

/**
 * Edge Security Middleware:
 * - Bloqueia payloads excessivos nas rotas /api/* antes de atingir a função serverless (anti-DoS)
 * - Impõe cabeçalhos estritos de cache e MIME sniffing em todas as respostas de API
 */
export function middleware(request) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    const contentLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_API_BODY_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Payload excede o limite de segurança.' },
        {
          status: 413,
          headers: {
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          },
        }
      );
    }

    const res = NextResponse.next();
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.headers.set('X-Content-Type-Options', 'nosniff');
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
