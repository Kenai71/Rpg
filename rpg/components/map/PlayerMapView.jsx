'use client';

import { useMemo } from 'react';
import { Compass } from 'lucide-react';
import {
  broadcastMapPing,
  updateMapTokenPosition,
  updateMapTokenStats,
} from '../../lib/rpg-service';
import { Card } from '../ui/Card';
import { TacticalMapCanvas } from './TacticalMapCanvas';

export function PlayerMapView({
  maps = [],
  tokens = [],
  profile,
  pings = [],
}) {
  // O jogador visualiza o mapa principal ativo definido pelo Mestre
  const activeMap = useMemo(() => maps.find((m) => m.is_active) || null, [maps]);

  // Tokens pertencentes ao mapa ativo
  const activeTokens = useMemo(() => {
    if (!activeMap) return [];
    return tokens.filter((t) => t.map_id === activeMap.id);
  }, [tokens, activeMap]);

  const handlePing = async ({ x, y }) => {
    if (!activeMap || !profile) return;
    try {
      await broadcastMapPing({
        map_id: activeMap.id,
        user_id: profile.uid,
        user_name: profile.username || 'Aventureiro',
        x,
        y,
        color: '#38bdf8',
      });
    } catch {}
  };

  if (!activeMap) {
    return (
      <Card className="p-12 text-center space-y-4 max-w-xl mx-auto my-8">
        <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
          <Compass className="h-8 w-8 text-slate-300" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-white">Mesa Aguardando o Mestre</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            O Mestre da mesa ainda não ativou o mapa tático da sessão. Assim que um mapa for revelado,
            seu herói surgirá no campo de batalha para exploração e combate em tempo real.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-slate-300">
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          Sincronização Ativa com a Mesa
        </div>
      </Card>
    );
  }

  return (
    <div className="w-full">
      {/* CANVAS TÁTICO INTERATIVO PARA O JOGADOR (SEM BARRA REDUNDANTE) */}
      <TacticalMapCanvas
        map={activeMap}
        tokens={activeTokens}
        currentUserId={profile?.uid}
        isMaster={false}
        onUpdateTokenPosition={updateMapTokenPosition}
        onUpdateTokenStats={updateMapTokenStats}
        onPing={handlePing}
        pings={pings}
      />
    </div>
  );
}
