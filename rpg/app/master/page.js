"use client"
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function MasterPanel() {
  const router = useRouter();
  const [missions, setMissions] = useState([]);
  const [players, setPlayers] = useState([]);
  const [form, setForm] = useState({ title: '', desc: '', rank: 'E', xp: 0, gold: 0 });

  useEffect(() => {
    fetchData();
  }, []);

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
    await supabase.from('missions').insert([{ ...form, status: 'open' }]);
    setForm({ title: '', desc: '', rank: 'E', xp: 0, gold: 0 });
    fetchData();
  }

  async function updateMission(id, status, playerId, xp, gold) {
    await supabase.from('missions').update({ status }).eq('id', id);
    if (status === 'completed' && playerId) {
      const p = players.find(x => x.id === playerId);
      await supabase.from('profiles').update({ xp: p.xp + Number(xp), gold: p.gold + Number(gold) }).eq('id', playerId);
    }
    fetchData();
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 min-h-screen">
      <header className="flex justify-between items-center bg-stone-900/40 p-6 rounded-xl border border-amber-900/30">
        <div>
          <h1 className="text-4xl text-amber-500 font-serif uppercase tracking-tighter">Sala do Trono</h1>
          <p className="text-stone-500 text-xs italic">Gerencie os heróis e os desafios do reino</p>
        </div>
        <button onClick={handleLogout} className="rpg-btn bg-stone-950 border-stone-800 text-[10px]">Abandonar Posto</button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulário */}
        <section className="rpg-panel border-l-4 border-l-amber-600">
          <h2 className="text-xl text-amber-200 font-serif mb-6 uppercase">📜 Novo Decreto</h2>
          <div className="space-y-4">
            <input className="rpg-input" placeholder="Título do Contrato" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
            <textarea className="rpg-input h-24" placeholder="Descrição da tarefa..." value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} />
            <div className="grid grid-cols-2 gap-2">
              <input className="rpg-input" type="number" placeholder="XP" value={form.xp} onChange={e => setForm({...form, xp: e.target.value})} />
              <input className="rpg-input" type="number" placeholder="Ouro" value={form.gold} onChange={e => setForm({...form, gold: e.target.value})} />
            </div>
            <button onClick={createMission} className="rpg-btn w-full py-3">Publicar Missão</button>
          </div>
        </section>

        {/* Jogadores */}
        <section className="rpg-panel lg:col-span-2">
          <h2 className="text-xl text-amber-200 font-serif mb-6 uppercase">🏆 Ranking de Aventureiros</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2">
            {players.map(p => (
              <div key={p.id} className="bg-black/40 p-4 rounded-lg border border-stone-800 flex justify-between items-center">
                <div>
                  <p className="font-bold text-stone-200">{p.username}</p>
                  <p className="text-[10px] text-amber-700 uppercase">Nível {Math.floor(p.xp/1000) + 1}</p>
                </div>
                <div className="text-right">
                  <p className="text-yellow-500 font-bold">💰 {p.gold}</p>
                  <p className="text-blue-400 text-xs">✨ {p.xp} XP</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Gerenciar Missões */}
      <section className="rpg-panel border-t-4 border-t-amber-900">
        <h2 className="text-xl text-amber-200 font-serif mb-6 uppercase text-center">⚔️ Contratos em Andamento</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {missions.filter(m => m.status === 'in_progress').map(m => (
            <div key={m.id} className="bg-stone-950/60 p-5 rounded-lg border border-amber-900/20">
              <h4 className="font-bold text-amber-100 mb-1">{m.title}</h4>
              <p className="text-[10px] text-stone-500 mb-4 italic">Herói: {players.find(x => x.id === m.assigned_to)?.username}</p>
              <div className="flex gap-2">
                <button onClick={() => updateMission(m.id, 'completed', m.assigned_to, m.xp_reward, m.gold_reward)} 
                        className="flex-1 bg-green-900/30 hover:bg-green-800/50 text-green-500 border border-green-900 text-[10px] py-2 rounded">SUCESSO</button>
                <button onClick={() => updateMission(m.id, 'failed', m.assigned_to, 0, 0)} 
                        className="flex-1 bg-red-900/30 hover:bg-red-800/50 text-red-500 border border-red-900 text-[10px] py-2 rounded">FALHA</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}