"use client"
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); // NOVO: Estado para confirmação
  const [username, setUsername] = useState('');
  // O estado 'role' foi removido pois agora é fixo
  const [isSignUp, setIsSignUp] = useState(false);
  const router = useRouter();

  const handleAuth = async (e) => {
    if (e) e.preventDefault(); // Evita recarregar a página ao dar Enter

    try {
      if (isSignUp) {
        // --- VALIDAÇÃO DE SENHA ---
        if (password !== confirmPassword) {
          return alert("As senhas não coincidem!");
        }

        // --- CADASTRO ---
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        if (data.user) {
          // Cria o perfil sempre como 'player'
          const { error: profileError } = await supabase.from('profiles').insert([
            { 
              id: data.user.id, 
              username, 
              role: 'player', // Fixo
              gold: 100, 
              xp: 0, 
              level: 1, 
              slots: 10,
              inventory: [] 
            }
          ]);

          if (profileError) throw profileError;

          alert("Herói registrado! Verifique seu email para confirmar.");
          setIsSignUp(false);
        }
      } else {
        // --- LOGIN ---
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        if (data.user) {
          const { data: prof, error: profError } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
          
          if (profError || !prof) {
            alert("Erro: Perfil não encontrado. Contate o administrador.");
            return;
          }

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
          <h1 className={styles.title}>Astralis</h1>
          <p className={styles.subtitle}>Portal dos Aventureiros</p>
        </div>

        <form onSubmit={handleAuth} className={styles.inputGroup}>
          {isSignUp && (
            <input 
              className={styles.input} 
              placeholder="Nome do Personagem" 
              value={username}
              onChange={e => setUsername(e.target.value)}
              required={isSignUp}
            />
          )}
          
          <input 
            className={styles.input} 
            type="email" 
            placeholder="Seu E-mail" 
            value={email}
            onChange={e => setEmail(e.target.value)}
            required 
          />
          <input 
            className={styles.input} 
            type="password" 
            placeholder="Sua Senha" 
            value={password}
            onChange={e => setPassword(e.target.value)}
            required 
          />

          {/* Campo de Confirmar Senha (Aparece apenas no cadastro) */}
          {isSignUp && (
            <input 
              className={styles.input} 
              type="password" 
              placeholder="Confirme a Senha" 
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required 
            />
          )}

          <button type="submit" className={styles.button}>
            {isSignUp ? "Criar Lenda" : "Entrar no Reino"}
          </button>
        </form>

        <p className={styles.toggle} onClick={() => setIsSignUp(!isSignUp)}>
          {isSignUp ? "Já possuo um registro" : "Desejo criar uma nova conta"}
        </p>
      </div>
    </div>
  );
}