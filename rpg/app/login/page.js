"use client"
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import styles from './login.module.css'; // Importando o CSS individual

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('player');
  const [isSignUp, setIsSignUp] = useState(false);
  const router = useRouter();

  const handleAuth = async () => {
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user) {
          await supabase.from('profiles').insert([
            { id: data.user.id, username, role, gold: 100, xp: 0, inventory: [] }
          ]);
          alert("Herói registrado com sucesso!");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) {
          const { data: prof } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
          router.push(prof.role === 'master' ? '/master' : '/player');
        }
      }
    } catch (error) {
      alert("Erro na jornada: " + error.message);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.panel}>
        <h1 className={styles.title}>Pórtico de Entrada</h1>
        <div className={styles.divider}></div>

        <div className={styles.form}>
          {isSignUp && (
            <>
              <input 
                className={styles.inputField} 
                placeholder="Nome do Personagem" 
                onChange={e => setUsername(e.target.value)} 
              />
              <select 
                className={styles.inputField} 
                onChange={e => setRole(e.target.value)}
              >
                <option value="player">Sou um Jogador</option>
                <option value="master">Sou o Mestre</option>
              </select>
            </>
          )}
          
          <input 
            className={styles.inputField} 
            type="email" 
            placeholder="Seu E-mail" 
            onChange={e => setEmail(e.target.value)} 
          />
          <input 
            className={styles.inputField} 
            type="password" 
            placeholder="Sua Senha" 
            onChange={e => setPassword(e.target.value)} 
          />
          
          <button onClick={handleAuth} className={styles.button}>
            {isSignUp ? "Criar Personagem" : "Entrar no Reino"}
          </button>

          <p className={styles.toggleText} onClick={() => setIsSignUp(!isSignUp)}>
            {isSignUp ? "Já possuo registro" : "Desejo me alistar"}
          </p>
        </div>
      </div>
    </div>
  );
}