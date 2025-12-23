"use client"
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
        router.push(profile?.role === 'master' ? '/master' : '/player');
      } else {
        router.push('/login');
      }
    };
    checkUser();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-950">
      <div className="text-amber-500 animate-pulse font-serif text-2xl uppercase tracking-[0.3em]">
        Carregando Reino...
      </div>
    </div>
  );
}