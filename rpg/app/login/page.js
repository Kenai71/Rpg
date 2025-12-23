"use client"
import { useState } from 'react';
import { supabase } from '../../lib/supabase'; // Caminho relativo ajustado
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
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (data.user) {
        await supabase.from('profiles').insert([
          { id: data.user.id, username, role, gold: 100, xp: 0, inventory: [] }
        ]);
        alert("Conta criada! Verifique seu email para confirmar.");
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
         alert("Erro: " + error.message);
         return;
      }
      if (data.user) {
        const { data: prof } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
        router.push(prof.role === 'master' ? '/master' : '/player');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-950 p-4">
      <div className="rpg-card w-full max-w-md">
        <h1 className="text-3xl text-amber-500 text-center mb-6 font-serif tracking-widest uppercase">Pórtico de Entrada</h1>
        <div className="space-y-4">
          {isSignUp && (
            <>
              <input className="rpg-input w-full" placeholder="Nome do Personagem" onChange={e => setUsername(e.target.value)} />
              <select className="rpg-input w-full bg-stone-800" onChange={e => setRole(e.target.value)}>
                <option value="player">Sou um Jogador</option>
                <option value="master">Sou o Mestre</option>
              </select>
            </>
          )}
          <input className="rpg-input w-full" type="email" placeholder="Email" onChange={e => setEmail(e.target.value)} />
          <input className="rpg-input w-full" type="password" placeholder="Senha" onChange={e => setPassword(e.target.value)} />
          <button onClick={handleAuth} className="rpg-btn w-full uppercase tracking-tighter">
            {isSignUp ? "Criar Personagem" : "Entrar no Reino"}
          </button>
          <p className="text-center text-[10px] text-stone-500 cursor-pointer hover:text-amber-500 transition-colors" onClick={() => setIsSignUp(!isSignUp)}>
            {isSignUp ? "Já possuo um herói cadastrado" : "Sou novo nestas terras (Novo Cadastro)"}
          </p>
        </div>
      </div>
    </div>
  );
}