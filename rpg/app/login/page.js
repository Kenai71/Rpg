"use client"
import { useState } from 'react';
import { supabase } from '../../lib/supabase'; // Caminho relativo para evitar erro de import
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
        alert("Herói registrado!");
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return alert("Erro: " + error.message);
      if (data.user) {
        const { data: prof } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
        router.push(prof.role === 'master' ? '/master' : '/player');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-black/20">
      <div className="rpg-panel">
        <h1 className="text-4xl text-amber-500 font-serif uppercase mb-2 tracking-tighter">Pórtico de Entrada</h1>
        <div className="w-24 h-1 bg-amber-700/50 mb-8"></div>

        <div className="w-full space-y-5 flex flex-col items-center">
          {isSignUp && (
            <div className="w-full space-y-4 flex flex-col items-center">
              <input className="rpg-input" placeholder="Nome do Personagem" onChange={e => setUsername(e.target.value)} />
              <select className="rpg-input cursor-pointer" onChange={e => setRole(e.target.value)}>
                <option value="player">Aventureiro (Jogador)</option>
                <option value="master">Guardião (Mestre)</option>
              </select>
            </div>
          )}
          
          <input className="rpg-input" type="email" placeholder="E-mail" onChange={e => setEmail(e.target.value)} />
          <input className="rpg-input" type="password" placeholder="Senha" onChange={e => setPassword(e.target.value)} />
          
          <button onClick={handleAuth} className="rpg-btn mt-4 py-4 text-base shadow-amber-900/40">
            {isSignUp ? "Forjar Destino" : "Entrar no Reino"}
          </button>

          <p className="text-stone-500 text-[10px] uppercase tracking-widest cursor-pointer hover:text-amber-500 transition-colors" 
             onClick={() => setIsSignUp(!isSignUp)}>
            {isSignUp ? "Já possuo registro" : "Desejo me alistar agora"}
          </p>
        </div>
      </div>
    </div>
  );
}