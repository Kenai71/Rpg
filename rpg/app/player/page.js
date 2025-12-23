"use client"
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase'; // Caminho relativo ajustado
import { useRouter } from 'next/navigation';

export default function PlayerPanel() {
  const router = useRouter();
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

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  async function acceptMission(id) {
    if (!profile) return;
    await supabase.from('missions').update({ status: 'in_progress', assigned_to: profile.id }).eq('id', id);
    loadData();
    alert("Contrato aceito! Que os deuses o protejam.");
  }

  async function buyItem(item) {
    if (profile.gold >= item.price) {
      const newInv = [...(profile.inventory || []), item.item_name];
      await supabase.from('profiles').update({ gold: profile.gold - item.price, inventory: newInv }).eq('id', profile.id);
      alert(`${item.item_name} guardado na mochila!`);
      loadData();
    } else {
      alert("Ouro insuficiente para esta compra!");
    }
  }

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-6 bg-stone-950 min-h-screen text-stone-100">
      {profile && (
        <div className="rpg-card flex justify-between items-center border-amber-600 border-2">
          <div>
            <h2 className="text-amber-500 text-xl font-bold font-serif">{profile.username}</h2>
            <p className="text-[10px] text-stone-500 uppercase tracking-widest">Aventureiro</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right font-serif">
              <span className="text-yellow-400 block">💰 {profile.gold} Ouro</span>
              <span className="text-blue-400 block">✨ {profile.xp} XP</span>
            </div>
            <button onClick={handleLogout} className="rpg-btn bg-red-900 border-red-950 text-[10px] px-3 py-1">
              Sair
            </button>
          </div>
        </div>
      )}

      <nav className="flex flex-wrap gap-2 justify-center">
        <button onClick={() => setTab('missions')} className={`rpg-btn ${tab === 'missions' && 'bg-amber-600 ring-2 ring-white'}`}>Mural</button>
        <button onClick={() => setTab('shop')} className={`rpg-btn ${tab === 'shop' && 'bg-amber-600 ring-2 ring-white'}`}>Lojas</button>
        <button onClick={() => setTab('players')} className={`rpg-btn ${tab === 'players' && 'bg-amber-600 ring-2 ring-white'}`}>Aventureiros</button>
        <button onClick={() => setTab('inv')} className={`rpg-btn ${tab === 'inv' && 'bg-amber-600 ring-2 ring-white'}`}>Mochila</button>
      </nav>

      <main>
        {tab === 'missions' && (
          <div className="grid gap-4 text-center">
            {missions.length > 0 ? missions.map(m => (
              <div key={m.id} className="rpg-card border-l-4 border-l-amber-700">
                <h3 className="text-xl text-amber-200 font-serif">{m.title}</h3>
                <p className="text-stone-400 my-2 italic">"{m.description}"</p>
                <div className="flex justify-between items-center mt-4">
                   <span className="text-[10px] text-amber-700 font-bold uppercase">Premiação: {m.gold_reward}g | {m.xp_reward}xp</span>
                   <button onClick={() => acceptMission(m.id)} className="rpg-btn text-xs py-1">Aceitar</button>
                </div>
              </div>
            )) : <p className="italic text-stone-600">Nenhum contrato disponível no momento...</p>}
          </div>
        )}

        {tab === 'shop' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {shop.map(item => (
              <div key={item.id} className="rpg-card">
                <p className="text-[10px] text-amber-600 font-bold uppercase">{item.seller_name} vende:</p>
                <h3 className="text-lg font-bold">{item.item_name}</h3>
                <p className="text-xs text-stone-400 mb-4">{item.description}</p>
                <button onClick={() => buyItem(item)} className="rpg-btn w-full mt-2 py-1 text-sm font-serif">Comprar por {item.price}g</button>
              </div>
            ))}
          </div>
        )}

        {tab === 'players' && (
          <div className="rpg-card">
            <h2 className="text-xl text-amber-200 mb-4 font-serif text-center uppercase tracking-widest">Mural de Heróis</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {allPlayers.map(p => (
                <div key={p.username} className="p-2 border border-amber-900/30 bg-stone-900 rounded text-center">
                  <p className="font-bold text-amber-500 text-sm">{p.username}</p>
                  <p className="text-[9px] text-stone-500 tracking-tighter uppercase">✨{p.xp} XP | 💰{p.gold} G</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'inv' && (
          <div className="rpg-card">
            <h2 className="text-xl text-amber-200 mb-6 font-serif text-center uppercase tracking-widest">Sua Mochila</h2>
            <div className="grid grid-cols-5 gap-3 max-w-sm mx-auto">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="aspect-square border-2 border-amber-900/40 bg-stone-950 rounded flex items-center justify-center p-1 text-center shadow-inner">
                  {profile?.inventory?.[i] ? (
                    <span className="text-[8px] text-amber-100 font-bold leading-tight">{profile.inventory[i]}</span>
                  ) : (
                    <span className="text-[8px] text-stone-900 uppercase">Vazio</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}