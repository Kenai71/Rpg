"use client"
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';

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
        // Criar Conta
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        if (data.user) {
          // Cria o perfil com os valores padrão corretos (Level 1, Slots 10)
          await supabase.from('profiles').insert([
            { 
              id: data.user.id, 
              username, 
              role, 
              gold: 100, 
              xp: 0, 
              level: 1, 
              slots: 10,
              inventory: [] 
            }
          ]);
          alert("Herói registrado! Verifique seu email para confirmar.");
        }
      } else {
        // Login
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        if (data.user) {
          const { data: prof } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
          router.push(prof.role === 'master' ? '/master' : '/player');
        }
      }
    } catch (error) {
      alert("Erro na autenticação: " + error.message);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div>
          <h1 className={styles.title}>Reino RPG</h1>
          <p className={styles.subtitle}>Portal dos Aventureiros</p>
        </div>

        <div className={styles.inputGroup}>
          {isSignUp && (
            <>
              <input 
                className={styles.input} 
                placeholder="Nome do Personagem" 
                onChange={e => setUsername(e.target.value)} 
              />
              <select 
                className={`${styles.input} ${styles.select}`} 
                onChange={e => setRole(e.target.value)}
                value={role}
              >
                <option value="player">Sou um Jogador</option>
                <option value="master">Sou o Mestre</option>
              </select>
            </>
          )}
          
          <input 
            className={styles.input} 
            type="email" 
            placeholder="Seu E-mail" 
            onChange={e => setEmail(e.target.value)} 
          />
          <input 
            className={styles.input} 
            type="password" 
            placeholder="Sua Senha" 
            onChange={e => setPassword(e.target.value)} 
          />
        </div>

        <button onClick={handleAuth} className={styles.button}>
          {isSignUp ? "Criar Lenda" : "Entrar no Reino"}
        </button>

        <p className={styles.toggle} onClick={() => setIsSignUp(!isSignUp)}>
          {isSignUp ? "Já possuo um registro" : "Desejo criar uma nova conta"}
        </p>
      </div>
    </div>
  );
}