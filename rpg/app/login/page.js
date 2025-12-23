"use client"
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('player');
  const [isSignUp, setIsSignUp] = useState(false);
  const router = useRouter();

  const handleAuth = async () => {
    if (isSignUp) {
      const { data } = await supabase.auth.signUp({ email, password });
      if (data.user) {
        await supabase.from('profiles').insert([
          { id: data.user.id, username, role, gold: 100, xp: 0, inventory: [] }
        ]);
        alert("Personagem criado!");
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return alert("Erro no acesso: " + error.message);
      if (data.user) {
        const { data: prof } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
        router.push(prof.role === 'master' ? '/master' : '/player');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-black/40">
      <div className="rpg-panel w-full max-w-md border-amber-700/40">
        <div className="text-center mb-8">
          <h1 className="text-4xl text-amber-500 font-serif tracking-tighter uppercase">Pórtico de Entrada</h1>
          <div className="h-1 w-24 bg-gradient-to-r from-transparent via-amber-700 to-transparent mx-auto mt-2"></div>
        </div>

        <div className="space-y-5">
          {isSignUp && (
            <div className="animate-in fade-in duration-500">
              <label className="text-xs uppercase text-amber-700 font-bold ml-1">Nome do Herói</label>
              <input className="rpg-input" placeholder="Ex: Garen do Norte" onChange={e => setUsername(e.target.value)} />
              
              <label className="text-xs uppercase text-amber-700 font-bold ml-1 mt-4 block">Sua Vocação</label>
              <select className="rpg-input" onChange={e => setRole(e.target.value)}>
                <option value="player">🛡️ Jogador</option>
                <option value="master">🧙 Mestre</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-xs uppercase text-stone-500 font-bold ml-1">Correio Eletrônico</label>
            <input className="rpg-input" type="email" placeholder="seu@email.com" onChange={e => setEmail(e.target.value)} />
          </div>

          <div>
            <label className="text-xs uppercase text-stone-500 font-bold ml-1">Palavra-Passe</label>
            <input className="rpg-input" type="password" placeholder="********" onChange={e => setPassword(e.target.value)} />
          </div>

          <button onClick={handleAuth} className="rpg-btn w-full py-4 mt-4 shadow-amber-900/40">
            {isSignUp ? "Forjar Destino" : "Entrar no Reino"}
          </button>

          <p className="text-center text-[10px] text-stone-600 uppercase tracking-widest cursor-pointer hover:text-amber-500 transition-colors" 
             onClick={() => setIsSignUp(!isSignUp)}>
            {isSignUp ? "Já possuo um registro" : "Desejo me alistar no exército"}
          </p>
        </div>
      </div>
    </div>
  );
}