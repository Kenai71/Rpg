"use client"
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

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

  async function acceptMission(id) {
    await supabase.from('missions').update({ status: 'in_progress', assigned_to: profile.id }).eq('id', id);
    alert("Contrato assinado!");
    loadData();
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 min-h-screen">
      {/* HUD de Jogador */}
      {profile && (
        <div className="rpg-panel border-amber-600/50 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-tr from-amber-900 to-amber-700 rounded-full border-2 border-amber-500 shadow-[0_0_15px_rgba(212,175,55,0.3)] flex items-center justify-center text-3xl">👤</div>
            <div>
              <h2 className="text-3xl text-amber-500 font-serif leading-none tracking-tighter uppercase">{profile.username}</h2>
              <p className="text-[10px] text-stone-500 uppercase tracking-widest mt-1">Aventureiro Errante</p>
            </div>
          </div>
          <div className="flex gap-10">
            <div className="text-center">
              <p className="text-yellow-500 text-2xl font-bold drop-shadow-md">💰 {profile.gold}</p>
              <p className="text-[9px] text-stone-600 uppercase font-serif">Moedas de Ouro</p>
            </div>
            <div className="text-center">
              <p className="text-blue-400 text-2xl font-bold drop-shadow-md">✨ {profile.xp}</p>
              <p className="text-[9px] text-stone-600 uppercase font-serif">Experiência</p>
            </div>
            <button onClick={handleLogout} className="text-stone-700 hover:text-red-900 transition-colors self-center">🚪</button>
          </div>
        </div>
      )}

      {/* Tabs Ornamentadas */}
      <nav className="flex justify-center gap-4 border-b border-amber-900/20 pb-4">
        {['missions', 'inv'].map((t) => (
          <button key={t} onClick={() => setTab(t)} 
            className={`px-8 py-2 font-serif uppercase tracking-widest text-sm transition-all
            ${tab === t ? 'text-amber-500 border-b-2 border-amber-500' : 'text-stone-600 hover:text-stone-300'}`}>
            {t === 'missions' ? '📜 Mural' : '🎒 Mochila'}
          </button>
        ))}
      </nav>

      <main className="animate-in fade-in slide-in-from-bottom-2 duration-700">
        {tab === 'missions' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {missions.map(m => (
              <div key={m.id} className="rpg-panel border-l-8 border-l-amber-900 hover:border-amber-700 transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-2xl text-amber-200 font-serif group-hover:text-amber-400 transition-colors uppercase tracking-tighter">{m.title}</h3>
                  <span className="text-[10px] bg-stone-950 px-2 py-1 rounded text-amber-700 border border-amber-900">RANK {m.rank}</span>
                </div>
                <p className="text-stone-400 italic mb-6 leading-relaxed">"{m.description}"</p>
                <div className="flex justify-between items-center bg-black/20 p-4 rounded-lg">
                  <div className="flex gap-4">
                    <span className="text-yellow-500 font-bold text-sm">💰 {m.gold_reward}</span>
                    <span className="text-blue-400 font-bold text-sm">✨ {m.xp_reward}</span>
                  </div>
                  <button onClick={() => acceptMission(m.id)} className="rpg-btn text-[10px] py-2">Assinar Contrato</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'inv' && (
          <div className="rpg-panel max-w-lg mx-auto border-t-4 border-t-amber-900 shadow-inner">
            <h2 className="text-xl text-amber-500 font-serif mb-8 text-center uppercase">Seus Pertences</h2>
            <div className="grid grid-cols-5 gap-3">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="aspect-square border-2 border-stone-800 bg-stone-950/50 rounded flex items-center justify-center p-1 text-center shadow-inner group hover:border-amber-900 transition-colors">
                  {profile?.inventory?.[i] ? (
                    <span className="text-[9px] text-amber-100 font-bold leading-tight uppercase">{profile.inventory[i]}</span>
                  ) : (
                    <div className="w-1 h-1 bg-stone-900 rounded-full"></div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-stone-700 mt-6 text-center italic tracking-wider">Limite de 10 slots atingido</p>
          </div>
        )}
      </main>
    </div>
  );
}