'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function GlobalError({ reset }) {
  return (
    <html lang="pt-BR" data-theme="purple">
      <body className="min-h-screen bg-[#07080c] text-slate-100 flex items-center justify-center p-6 font-sans antialiased">
        <div className="max-w-md w-full rounded-2xl border border-white/15 bg-[#0d0f15] p-6 sm:p-8 text-center space-y-5 shadow-2xl">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-300">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg font-bold text-white">Sessão interrompida</h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Não foi possível carregar a aplicação. Recarregue para restabelecer sua conexão com a mesa.
            </p>
          </div>
          <button
            type="button"
            onClick={() => reset?.()}
            className="inline-flex items-center justify-center gap-2 px-5 h-10 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-sm font-semibold text-white transition-colors"
          >
            <RotateCcw className="h-4 w-4 text-slate-300" />
            Recarregar Vallen RPG
          </button>
        </div>
      </body>
    </html>
  );
}
