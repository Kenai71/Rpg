"use client"
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(true); // Para evitar piscar o form
  const router = useRouter();

  // --- NOVO: Verifica se já está logado ao abrir essa página ---
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Se já tem sessão, busca o perfil para saber para onde mandar
        const { data: prof } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
        if (prof) {
          router.push(prof.role === 'master' ? '/master' : '/player');
        }
      } else {
        setLoading(false); // Libera o form se não tiver usuário
      }
    };
    checkUser();
  }, [router]);

  const handleAuth = async (e) => {
    if (e) e.preventDefault();

    try {
      if (isSignUp) {
        if (password !== confirmPassword) {
          return alert("As senhas não coincidem!");
        }

        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        if (data.user) {
          const { error: profileError } = await supabase.from('profiles').insert([
            { 
              id: data.user.id, 
              username, 
              role: 'player',
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

  // Enquanto verifica o login, mostra um carregando simples ou nada
  if (loading) return null; 

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