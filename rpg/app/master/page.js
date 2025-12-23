"use client"
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import styles from './master.module.css';

export default function MasterPanel() {
  const router = useRouter();
  const [missions, setMissions] = useState([]);
  const [players, setPlayers] = useState([]);
  const [form, setForm] = useState({ title: '', desc: '', rank: 'E', xp: 0, gold: 0 });

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    const { data: m } = await supabase.from('missions').select('*').order('created_at', { ascending: false });
    const { data: p } = await supabase.from('profiles').select('*').eq('role', 'player').order('xp', { ascending: false });
    setMissions(m || []);
    setPlayers(p || []);
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  async function createMission() {
    if (!form.title) return alert("Defina um título!");
    await supabase.from('missions').insert([{ ...form, status: 'open' }]);
    setForm({ title: '', desc: '', rank: 'E', xp: 0, gold: 0 });
    fetchData();
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Sala do Mestre</h1>
        <button onClick={handleLogout} className="rpg-btn !w-auto">Sair</button>
      </header>

      <div className={styles.grid}>
        <section className={styles.panel}>
          <h2 className="text-xl text-amber-200 font-serif mb-4 uppercase">📜 Novo Decreto</h2>
          <div className={styles.form}>
            <input className={styles.inputField} placeholder="Título" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
            <textarea className={styles.inputField} placeholder="Descrição" value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} />
            <div className="flex gap-2 w-full">
              <input className={styles.inputField} type="number" placeholder="XP" value={form.xp} onChange={e => setForm({...form, xp: e.target.value})} />
              <input className={styles.inputField} type="number" placeholder="Ouro" value={form.gold} onChange={e => setForm({...form, gold: e.target.value})} />
            </div>
            <button onClick={createMission} className="rpg-btn">Publicar</button>
          </div>
        </section>

        <section className={styles.panel}>
          <h2 className="text-xl text-amber-200 font-serif mb-4 uppercase">🏆 Ranking</h2>
          <div className={styles.playerList}>
            {players.map(p => (
              <div key={p.id} className={styles.playerItem}>
                <span className="font-bold text-stone-200">{p.username}</span>
                <span className="text-yellow-500 font-bold">💰 {p.gold}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}