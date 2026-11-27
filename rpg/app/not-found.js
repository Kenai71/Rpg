import Link from 'next/link';
import { Compass } from 'lucide-react';
import Logo from './components/Logo';

export default function NotFound() {
  return (
    <main className="min-h-screen realm-backdrop flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full rounded-2xl surface-card border border-white/12 p-6 sm:p-8 text-center space-y-5 shadow-2xl">
        <div className="flex justify-center">
          <Logo size={40} />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-mono font-bold uppercase tracking-[0.22em] text-slate-400">
            Erro 404
          </p>
          <h1 className="text-xl font-bold text-white">Território Desconhecido</h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            A página que você tentou acessar não existe neste reino ou foi movida.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 px-5 h-10 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-sm font-semibold text-white transition-colors"
        >
          <Compass className="h-4 w-4 text-slate-300" />
          Retornar à Mesa
        </Link>
      </div>
    </main>
  );
}
