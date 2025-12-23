"use client"
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase'; // Import relativo corrigido
import { useRouter } from 'next/navigation';

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
    if (!form.title) return alert("A missão precisa de um título!");
    await supabase.from('missions').insert([{ ...form, status: 'open' }]);
    setForm({ title: '', desc: '', rank: 'E', xp: 0, gold: 0 });
    fetchData();
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-10 min-h-screen">
      <header className="flex justify-between items-center border-b border-amber-900/30 pb-6">
        <h1 className="text-4xl text-amber-500 font-serif uppercase tracking-widest">Sala do Mestre</h1>
        <button onClick={handleLogout} className="rpg-btn !py-2 !px-6 text-[10px] w-auto">Abandonar Posto</button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Formulário Centralizado */}
        <div className="rpg-panel">
          <h2 className="text-2xl text-amber-200 mb-8 font-serif uppercase">📜 Novo Decreto</h2>
          <div className="w-full space-y-4 flex flex-col items-center">
            <input className="rpg-input" placeholder="Título do Contrato" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
            <textarea className="rpg-input h-32" placeholder="Descreva a tarefa aos heróis..." value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} />
            <div className="flex gap-3 w-full">
              <input className="rpg-input flex-1" type="number" placeholder="XP" value={form.xp} onChange={e => setForm({...form, xp: e.target.value})} />
              <input className="rpg-input flex-1" type="number" placeholder="Ouro" value={form.gold} onChange={e => setForm({...form, gold: e.target.value})} />
            </div>
            <button onClick={createMission} className="rpg-btn mt-2">Publicar no Mural</button>
          </div>
        </div>

        {/* Lista de Aventureiros */}
        <div className="rpg-panel">
          <h2 className="text-2xl text-amber-200 mb-8 font-serif uppercase">🏆 Ranking</h2>
          <div className="w-full space-y-4 max-h-[450px] overflow-y-auto px-2">
            {players.map(p => (
              <div key={p.id} className="bg-stone-950/50 p-4 rounded-lg border border-amber-900/20 flex justify-between items-center">
                <span className="font-bold text-stone-200">{p.username}</span>
                <div className="text-right">
                  <p className="text-yellow-500 font-bold">💰 {p.gold}g</p>
                  <p className="text-blue-400 text-[10px] uppercase">✨ {p.xp} xp</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}