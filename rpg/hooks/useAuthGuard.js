'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth, isFirebaseConfigured } from '../lib/firebase';
import { ensureUserProfile, subscribeDoc } from '../lib/rpg-service';

/**
 * Gerencia sessão do Firebase Auth, sincronização em tempo real do perfil
 * no Firestore e proteção de rotas baseada em role ('master' | 'player').
 */
export function useAuthGuard({ requiredRole } = {}) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setError('Configuração do Firebase ausente. Verifique as variáveis .env.');
      setLoading(false);
      return undefined;
    }

    let unsubProfile = null;
    let active = true;

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (!firebaseUser) {
        if (!active) return;
        setUser(null);
        setProfile(null);
        setLoading(false);
        router.replace('/login');
        return;
      }

      setUser(firebaseUser);
      try {
        const ensured = await ensureUserProfile(firebaseUser);
        if (!active) return;
        setProfile(ensured);

        unsubProfile = subscribeDoc(
          'profiles',
          firebaseUser.uid,
          (liveProfile) => {
            if (!active) return;
            if (!liveProfile) return;
            setProfile(liveProfile);
            setLoading(false);

            if (requiredRole && liveProfile.role !== requiredRole) {
              router.replace(liveProfile.role === 'master' ? '/master' : '/player');
            }
          },
          (err) => {
            if (!active) return;
            console.error('Erro ao escutar perfil:', err);
            setError('Permissão negada ou erro de conexão com o Firestore.');
            setLoading(false);
          }
        );

        if (requiredRole && ensured.role !== requiredRole) {
          router.replace(ensured.role === 'master' ? '/master' : '/player');
        } else {
          setLoading(false);
        }
      } catch (err) {
        if (!active) return;
        console.error('Erro ao carregar perfil:', err);
        setError(err.message || 'Erro ao carregar perfil do usuário.');
        setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, [requiredRole, router]);

  const logout = async () => {
    if (auth) {
      await signOut(auth);
    }
    router.replace('/login');
  };

  return { user, profile, loading, error, logout };
}
