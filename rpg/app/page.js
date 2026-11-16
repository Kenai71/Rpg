'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { auth, isFirebaseConfigured } from '../lib/firebase';
import { ensureUserProfile } from '../lib/rpg-service';
import { PageLoadingSkeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';

export default function Home() {
  const router = useRouter();
  const [configError, setConfigError] = useState(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setConfigError('Firebase não configurado. Verifique as variáveis NEXT_PUBLIC_FIREBASE_* no .env.');
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace('/login');
        return;
      }

      try {
        const profile = await ensureUserProfile(user);
        router.replace(profile?.role === 'master' ? '/master' : '/player');
      } catch (err) {
        console.error('Erro ao carregar perfil:', err);
        setConfigError(
          err?.code === 'permission-denied'
            ? 'Permissão negada no Firestore. Atualize as Firestore Rules no Console do Firebase.'
            : 'Não foi possível conectar ao banco de dados do Reino.'
        );
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (configError) {
    return (
      <div className="min-h-screen realm-backdrop flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-rose-500/30 bg-[var(--surface-1)] p-6 space-y-4 text-center">
          <div className="h-12 w-12 rounded-2xl bg-rose-500/15 text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-bold text-white">Atenção na Configuração</h1>
          <p className="text-sm text-slate-300 leading-relaxed">{configError}</p>
          <Button onClick={() => router.replace('/login')} className="w-full">
            Ir para o Login
          </Button>
        </div>
      </div>
    );
  }

  return <PageLoadingSkeleton message="Entrando no Reino..." />;
}
