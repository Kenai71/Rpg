"use client"
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import styles from './player.module.css';

export default function PlayerPanel() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [missions, setMissions] = useState([]);
  const [tab, setTab] = useState('missions');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(prof);
    }
    const { data: m } = await supabase.from('missions').select('*').eq('status', 'open');
    setMissions(m || []);
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className={styles.container}>
      {profile && (
        <div className={styles.hud}>
          <div>
            <h2 className="text-2xl text-amber-500 font-serif uppercase">{profile.username}</h2>
            <p className="text-xs text-stone-500">Aventureiro do Reino</p>
          </div>
          <div className={styles.stats}>
            <div className="text-center">
              <span className="block text-yellow-500 font-bold">💰 {profile.gold}</span>
              <span className="text-[9px] uppercase">Ouro</span>
            </div>
            <div className="text-center">
              <span className="block text-blue-400 font-bold">✨ {profile.xp}</span>
              <span className="text-[9px] uppercase">XP</span>
            </div>
            <button onClick={handleLogout} className="opacity-50 hover:opacity-100 transition-opacity">🚪</button>
          </div>
        </div>
      )}

      <nav className={styles.nav}>
        <button onClick={() => setTab('missions')} className={`${styles.tabBtn} ${tab === 'missions' ? styles.tabBtnActive : ''}`}>Mural</button>
        <button onClick={() => setTab('inv')} className={`${styles.tabBtn} ${tab === 'inv' ? styles.tabBtnActive : ''}`}>Mochila</button>
      </nav>

      <main className={styles.content}>
        {tab === 'missions' && (
          <div className={styles.missionGrid}>
            {missions.map(m => (
              <div key={m.id} className="rpg-panel !max-w-none text-left items-start">
                <h3 className="text-xl text-amber-200 font-serif mb-2">{m.title}</h3>
                <p className="text-stone-400 italic text-sm mb-4">"{m.description}"</p>
                <div className="flex justify-between w-full items-center mt-auto">
                  <span className="text-xs font-bold text-amber-700">💰 {m.gold_reward} | ✨ {m.xp_reward}</span>
                  <button className="rpg-btn !w-auto !py-1 !px-3 text-[10px]">Aceitar</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'inv' && (
          <div className="rpg-panel">
            <h2 className="text-xl text-amber-500 font-serif mb-6">Pertences</h2>
            <div className="grid grid-cols-5 gap-3">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="w-12 h-12 border-2 border-stone-800 rounded bg-stone-950 flex items-center justify-center">
                  <span className="text-[8px] text-stone-800">VAZIO</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}