"use client"
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function PlayerPanel() {
  const [profile, setProfile] = useState(null);
  const [missions, setMissions] = useState([]);
  const [shop, setShop] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);
  const [tab, setTab] = useState('missions');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(prof);
    }
    
    const { data: m } = await supabase.from('missions').select('*').eq('status', 'open');
    const { data: s } = await supabase.from('shop_items').select('*');
    const { data: p } = await supabase.from('profiles').select('username, xp, gold').eq('role', 'player');
    
    setMissions(m || []);
    setShop(s || []);
    setAllPlayers(p || []);
  }

  async function acceptMission(id) {
    if (!profile) return;
    await supabase.from('missions').update({ status: 'in_progress', assigned_to: profile.id }).eq('id', id);
    loadData();
    alert("Contrato aceito! Que a sorte o acompanhe.");
  }

  async function buyItem(item) {
    if (profile.gold >= item.price) {
      const currentInventory = profile.inventory || [];
      if (currentInventory.length >= 10) {
        alert("Sua mochila está cheia!");
        return;
      }
      
      const newInv = [...currentInventory, item.item_name];
      await supabase.from('profiles').update({ 
        gold: profile.gold - item.price, 
        inventory: newInv 
      }).eq('id', profile.id);
      
      alert(`${item.item_name} foi colocado na sua mochila!`);
      loadData();
    } else {
      alert("Você não tem ouro suficiente para este item.");
    }
  }

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-6 bg-stone-950 min-h-screen">
      {/* HUD do Personagem */}
      {profile && (
        <div className="rpg-card flex justify-between items-center border-amber-600 border-2">
          <div>
            <h2 className="text-amber-500 text-xl font-bold font-serif">{profile.username}</h2>
            <p className="text-[10px] text-stone-500 uppercase tracking-widest">Nível: {Math.floor(profile.xp/1000) + 1}</p>
          </div>
          <div className="text-right font-serif">
            <span className="text-yellow-400 block">💰 {profile.gold} Ouro</span>
            <span className="text-blue-400 block">✨ {profile.xp} XP</span>
          </div>
        </div>
      )}

      {/* Menu de Abas */}
      <nav className="flex flex-wrap gap-2 justify-center">
        <button onClick={() => setTab('missions')} className={`rpg-btn ${tab === 'missions' && 'bg-amber-600 ring-2 ring-white'}`}>Mural de Missões</button>
        <button onClick={() => setTab('shop')} className={`rpg-btn ${tab === 'shop' && 'bg-amber-600 ring-2 ring-white'}`}>Vendedores</button>
        <button onClick={() => setTab('players')} className={`rpg-btn ${tab === 'players' && 'bg-amber-600 ring-2 ring-white'}`}>Aventureiros</button>
        <button onClick={() => setTab('inv')} className={`rpg-btn ${tab === 'inv' && 'bg-amber-600 ring-2 ring-white'}`}>Mochila</button>
      </nav>

      {/* Conteúdo das Abas */}
      <main className="mt-6">
        {tab === 'missions' && (
          <div className="grid gap-4">
            {missions.length > 0 ? missions.map(m => (
              <div key={m.id} className="rpg-card hover:border-amber-400 transition-colors border-l-4 border-l-amber-700">
                <div className="flex justify-between items-start">
                  <h3 className="text-xl text-amber-200 font-serif">{m.title}</h3>
                  <button onClick={() => acceptMission(m.id)} className="rpg-btn text-xs py-1">Aceitar</button>
                </div>
                <p className="text-stone-400 my-2 italic">"{m.description}"</p>
                <div className="flex justify-between text-[10px] text-amber-700 uppercase font-bold">
                  <span>Recompensa: {m.gold_reward}g | {m.xp_reward}xp</span>
                  <span>Rank: {m.rank}</span>
                </div>
              </div>
            )) : <p className="text-center text-stone-600 italic">O mural de contratos está vazio...</p>}
          </div>
        )}

        {tab === 'shop' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...new Set(shop.map(i => i.seller_name))].map(seller => (
              <div key={seller} className="rpg-card bg-stone-900/50">
                <h3 className="text-amber-500 font-bold mb-3 border-b border-amber-900 font-serif">Bazar de {seller}</h3>
                <div className="space-y-3">
                  {shop.filter(i => i.seller_name === seller).map(item => (
                    <div key={item.id} className="flex justify-between items-center p-2 bg-stone-800/80 rounded border border-stone-700">
                      <div className="max-w-[70%]">
                        <p className="text-sm font-bold text-stone-100">{item.item_name}</p>
                        <p className="text-[10px] text-stone-400 italic">{item.description}</p>
                      </div>
                      <button onClick={() => buyItem(item)} className="text-xs bg-amber-900 hover:bg-amber-800 px-3 py-1 rounded text-amber-100">💰 {item.price}</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'players' && (
          <div className="rpg-card">
            <h2 className="text-xl text-amber-200 mb-4 font-serif text-center">Companheiros de Taberna</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {allPlayers.map(p => (
                <div key={p.username} className="p-3 border border-amber-900/30 bg-stone-900 rounded text-center">
                  <p className="font-bold text-amber-500">{p.username}</p>
                  <div className="text-[10px] text-stone-500 mt-1">
                    <p>Experiência: {p.xp}</p>
                    <p>Ouro: {p.gold}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'inv' && (
          <div className="rpg-card max-w-md mx-auto">
            <h2 className="text-xl text-amber-200 mb-6 font-serif text-center">Sua Mochila</h2>
            <div className="grid grid-cols-5 gap-3 justify-center">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="aspect-square border-2 border-amber-900/40 bg-stone-950 rounded flex items-center justify-center p-1 text-center shadow-inner">
                  {profile?.inventory?.[i] ? (
                    <span className="text-[8px] text-amber-100 font-bold leading-tight">{profile.inventory[i]}</span>
                  ) : (
                    <span className="text-[8px] text-stone-800 uppercase">Vazio</span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-stone-600 mt-4 text-center italic">Capacidade máxima: 10 itens</p>
          </div>
        )}
      </main>
    </div>
  );
}