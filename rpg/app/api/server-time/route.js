import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Retorna o relógio UTC autoritativo do servidor em milissegundos
 * para calibrar a sincronização de música em tempo real entre Mestre e Jogadores.
 */
export async function GET() {
  return NextResponse.json(
    { now: Date.now() },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
