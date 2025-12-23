"use client"
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function PlayerPanel() {
  const [profile, setProfile] = useState(null);
  const [missions, setMissions] = useState([]);
  const [shop, setShop] = useState([]);
  const [tab, setTab] = useState('missions');

  useEffect(() => {
    loadPlayerData();
    loadMissions();
    loadShop();
  }, []);

  async function loadPlayerData() {
    // Aqui usaremos um ID estático para teste, em produção use auth.user().id
    const { data } = await supabase.from('profiles').select('*').limit(1).single();
    setProfile(data);
  }

  async function loadMissions() {
    const { data } = await supabase.from('missions').select('*').eq('status', 'open');
    setMissions(data || []);
  }

  async function loadShop() {
    const { data } = await supabase.from('shop_items').select('*');
    setShop(data || []);
  }

  async function acceptMission(id) {
    await supabase.from('missions').update({ 
      status: 'in_progress', 
      assigned_to: profile.id 
    }).eq('id', id);
    loadMissions();
  }

  async function buyItem(item) {
    if (profile.gold >= item.price) {
      const newInventory = [...(profile.inventory || []), item.item_name];
      const newGold = profile.gold - item.price;
      
      await supabase.from('profiles').update({ 
        gold: newGold, 
        inventory: newInventory 
      }).eq('id', profile.id);
      
      alert("Item comprado!");
      loadPlayerData();
    } else {
      alert("Ouro insuficiente!");
    }
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Header Status */}
      {profile && (
        <div className="rpg-card flex justify-between mb-6 border-amber-500">
          <div><span className="text-amber-500">Guerreiro:</span> {profile.username}</div>
          <div><span className="text-yellow-400">💰 {profile.gold}</span> | <span className="text-blue-400">✨ XP: {profile.xp}</span></div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <button onClick={() => setTab('missions')} className={`rpg-btn ${tab === 'missions' ? 'bg-amber-600' : ''}`}>Mural</button>
        <button onClick={() => setTab('shop')} className={`rpg-btn ${tab === 'shop' ? 'bg-amber-600' : ''}`}>Vendedores</button>
        <button onClick={() => setTab('inv')} className={`rpg-btn ${tab === 'inv' ? 'bg-amber-600' : ''}`}>Inventário</button>
      </div>

      {/* Conteúdo Dinâmico */}
      {tab === 'missions' && (
        <div className="grid gap-4">
          {missions.map(m => (
            <div key={m.id} className="rpg-card">
              <h3 className="text-xl font-bold text-amber-200">{m.title} <span className="text-sm text-stone-500">Rank {m.rank}</span></h3>
              <p className="my-2 text-stone-300">{m.description}</p>
              <div className="flex justify-between items-center">
                <span className="text-sm">Recompensa: {m.gold_reward}g / {m.xp_reward}xp</span>
                <button onClick={() => acceptMission(m.id)} className="rpg-btn text-xs">Aceitar Contrato</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'shop' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shop.map(item => (
            <div key={item.id} className="rpg-card">
              <p className="text-xs text-amber-600">{item.seller_name} vende:</p>
              <h3 className="text-lg font-bold">{item.item_name}</h3>
              <p className="text-sm text-stone-400 mb-4">{item.description}</p>
              <button onClick={() => buyItem(item)} className="rpg-btn w-full">Comprar por {item.price}g</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'inv' && (
        <div className="rpg-card">
          <h2 className="text-xl mb-4">Mochila (10 Slots)</h2>
          <div className="grid grid-cols-5 gap-2">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-16 border border-stone-700 bg-stone-800 rounded flex items-center justify-center">
                {profile?.inventory[i] && <span className="text-[10px] text-center">{profile.inventory[i]}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}