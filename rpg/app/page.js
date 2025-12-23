"use client"
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      // Busca a sessão atual do navegador
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // Se houver sessão, busca o papel (role) no perfil
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (profile?.role === 'master') {
          router.push('/master');
        } else {
          router.push('/player');
        }
      } else {
        // Se não houver sessão, manda para o login
        router.push('/login');
      }
    };

    checkUser();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-950">
      <div className="text-amber-500 animate-pulse font-serif text-2xl">
        Carregando Reino...
      </div>
    </div>
  );
}