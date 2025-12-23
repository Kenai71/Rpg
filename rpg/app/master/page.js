"use client"
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function MasterPanel() {
  const [missions, setMissions] = useState([]);
  const [players, setPlayers] = useState([]);
  const [form, setForm] = useState({ title: '', desc: '', rank: 'E', xp: 0, gold: 0 });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: m } = await supabase.from('missions').select('*');
    const { data: p } = await supabase.from('profiles').select('*').eq('role', 'player');
    setMissions(m || []);
    setPlayers(p || []);
  }

  async function createMission() {
    await supabase.from('missions').insert([{
      title: form.title, description: form.desc, rank: form.rank, 
      xp_reward: form.xp, gold_reward: form.gold
    }]);
    fetchData();
  }

  async function updateMission(id, status, playerId, xp, gold) {
    await supabase.from('missions').update({ status }).eq('id', id);
    if (status === 'completed') {
      const player = players.find(p => p.id === playerId);
      await supabase.from('profiles').update({ 
        xp: player.xp + parseInt(xp), 
        gold: player.gold + parseInt(gold) 
      }).eq('id', playerId);
    }
    fetchData();
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-4xl text-amber-500 mb-8 font-serif">Trono do Mestre</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Criar Missão */}
        <div className="rpg-card">
          <h2 className="text-2xl mb-4 text-amber-200">Criar Nova Missão</h2>
          <div className="flex flex-col gap-2 text-black">
            <input className="rpg-input text-white" placeholder="Título" onChange={e => setForm({...form, title: e.target.value})} />
            <textarea className="rpg-input text-white" placeholder="Descrição" onChange={e => setForm({...form, desc: e.target.value})} />
            <div className="flex gap-2">
              <input type="number" className="rpg-input w-full text-white" placeholder="XP" onChange={e => setForm({...form, xp: e.target.value})} />
              <input type="number" className="rpg-input w-full text-white" placeholder="Ouro" onChange={e => setForm({...form, gold: e.target.value})} />
            </div>
            <button onClick={createMission} className="rpg-btn mt-2">Postar no Mural</button>
          </div>
        </div>

        {/* Gerenciar Missões Ativas */}
        <div className="rpg-card">
          <h2 className="text-2xl mb-4 text-amber-200">Missões em Andamento</h2>
          {missions.filter(m => m.status === 'in_progress').map(m => (
            <div key={m.id} className="border-b border-stone-700 py-2">
              <p className="font-bold">{m.title} (Para: {m.assigned_to})</p>
              <div className="flex gap-2 mt-2">
                <button onClick={() => updateMission(m.id, 'completed', m.assigned_to, m.xp_reward, m.gold_reward)} className="bg-green-700 text-xs px-2 py-1 rounded">Sucesso</button>
                <button onClick={() => updateMission(m.id, 'failed', m.assigned_to, 0, 0)} className="bg-red-700 text-xs px-2 py-1 rounded">Falha</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}