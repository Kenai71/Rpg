'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';
import Logo from './components/Logo';
import { Button } from '../components/ui/Button';

export default function AppError({ error, reset }) {
  useEffect(() => {
    console.error('Erro capturado pelo boundary do Vallen RPG:', error);
  }, [error]);

  return (
    <main className="min-h-screen realm-backdrop flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full rounded-2xl surface-card border border-white/12 p-6 sm:p-8 text-center space-y-5 shadow-2xl">
        <div className="flex justify-center">
          <Logo size={38} />
        </div>
        <div className="mx-auto h-12 w-12 rounded-2xl bg-rose-500/12 border border-rose-500/25 flex items-center justify-center text-rose-300">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-lg sm:text-xl font-bold text-white">Algo inesperado aconteceu</h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Ocorreu uma instabilidade temporária ao renderizar esta tela. Seus dados continuam seguros no servidor.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
          <Button onClick={() => reset?.()} className="w-full sm:w-auto">
            <RotateCcw className="h-4 w-4 text-slate-300" />
            Tentar Novamente
          </Button>
          <Link href="/" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full">
              <Home className="h-4 w-4 text-slate-300" />
              Voltar ao Início
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
