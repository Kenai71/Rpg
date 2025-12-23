"use client"
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function MasterPanel() {
  const router = useRouter();
  const [missions, setMissions] = useState([]);
  const [players, setPlayers] = useState([]);
  const [shopItems, setShopItems] = useState([]);
  const [form, setForm] = useState({ title: '', desc: '', rank: 'E', xp: 0, gold: 0 });
  const [shopForm, setShopForm] = useState({ seller: '', name: '', price: 0, desc: '' });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: m } = await supabase.from('missions').select('*');
    const { data: p } = await supabase.from('profiles').select('*').eq('role', 'player');
    const { data: s } = await supabase.from('shop_items').select('*');
    setMissions(m || []);
    setPlayers(p || []);
    setShopItems(s || []);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  async function createMission() {
    await supabase.from('missions').insert([{
      title: form.title, description: form.desc, rank: form.rank, 
      xp_reward: form.xp, gold_reward: form.gold, status: 'open'
    }]);
    setForm({ title: '', desc: '', rank: 'E', xp: 0, gold: 0 });
    fetchData();
  }

  async function addShopItem() {
    await supabase.from('shop_items').insert([{
      seller_name: shopForm.seller, item_name: shopForm.name,
      price: shopForm.price, description: shopForm.desc
    }]);
    setShopForm({ seller: '', name: '', price: 0, desc: '' });
    fetchData();
  }

  async function updateMission(id, status, playerId, xp, gold) {
    await supabase.from('missions').update({ status }).eq('id', id);
    if (status === 'completed' && playerId) {
      const player = players.find(p => p.id === playerId);
      await supabase.from('profiles').update({ 
        xp: (player?.xp || 0) + parseInt(xp), 
        gold: (player?.gold || 0) + parseInt(gold) 
      }).eq('id', playerId);
    }
    fetchData();
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-stone-950 min-h-screen">
      <div className="flex justify-between items-center border-b border-amber-900 pb-4">
        <h1 className="text-4xl text-amber-500 font-serif">Trono do Mestre</h1>
        <button onClick={handleLogout} className="rpg-btn bg-red-900 border-red-950 text-xs py-1 px-4">Sair do Reino</button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rpg-card">
          <h2 className="text-2xl mb-4 text-amber-200">Nova Missão</h2>
          <div className="flex flex-col gap-2">
            <input value={form.title} className="rpg-input" placeholder="Título" onChange={e => setForm({...form, title: e.target.value})} />
            <textarea value={form.desc} className="rpg-input" placeholder="Descrição" onChange={e => setForm({...form, desc: e.target.value})} />
            <div className="flex gap-2">
              <input value={form.xp} type="number" className="rpg-input w-1/2" placeholder="XP" onChange={e => setForm({...form, xp: e.target.value})} />
              <input value={form.gold} type="number" className="rpg-input w-1/2" placeholder="Ouro" onChange={e => setForm({...form, gold: e.target.value})} />
            </div>
            <button onClick={createMission} className="rpg-btn mt-2">Postar Missão</button>
          </div>
        </div>

        <div className="rpg-card">
          <h2 className="text-2xl mb-4 text-amber-200">Configurar Loja</h2>
          <div className="flex flex-col gap-2">
            <input value={shopForm.seller} className="rpg-input" placeholder="Nome do Vendedor" onChange={e => setShopForm({...shopForm, seller: e.target.value})} />
            <input value={shopForm.name} className="rpg-input" placeholder="Nome do Item" onChange={e => setShopForm({...shopForm, name: e.target.value})} />
            <input value={shopForm.price} type="number" className="rpg-input" placeholder="Preço" onChange={e => setShopForm({...shopForm, price: e.target.value})} />
            <button onClick={addShopItem} className="rpg-btn mt-2">Adicionar Item</button>
          </div>
        </div>

        <div className="rpg-card">
          <h2 className="text-2xl mb-4 text-amber-200">Aventureiros</h2>
          <div className="space-y-2 overflow-y-auto max-h-64">
            {players.map(p => (
              <div key={p.id} className="text-sm border-b border-stone-800 pb-1 flex justify-between">
                <span className="text-amber-500 font-bold">{p.username}</span>
                <span className="text-stone-300">💰{p.gold} | ✨{p.xp}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rpg-card">
        <h2 className="text-2xl mb-4 text-amber-200 font-serif">Contratos Ativos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {missions.filter(m => m.status === 'in_progress').map(m => (
            <div key={m.id} className="p-3 bg-stone-800/50 rounded border border-amber-900/30">
              <p className="font-bold text-amber-100">{m.title}</p>
              <p className="text-xs text-stone-400 mb-2">Por: {players.find(p => p.id === m.assigned_to)?.username}</p>
              <div className="flex gap-2">
                <button onClick={() => updateMission(m.id, 'completed', m.assigned_to, m.xp_reward, m.gold_reward)} className="bg-green-800 text-white text-[10px] px-3 py-1 rounded">COMPLETA</button>
                <button onClick={() => updateMission(m.id, 'failed', m.assigned_to, 0, 0)} className="bg-red-800 text-white text-[10px] px-3 py-1 rounded">FALHA</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}