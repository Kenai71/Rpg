"use client"
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';
import Logo from '../components/Logo';
import { Mail, Lock, LogIn, UserPlus, AlertCircle, User } from 'lucide-react';

const themes = [
    { id: 'purple', color: '#8b5cf6', label: 'Nebula Violet' },
    { id: 'green',  color: '#10b981', label: 'Toxic Emerald' },
    { id: 'blue',   color: '#0ea5e9', label: 'Cyber Sky' },
    { id: 'red',    color: '#ef4444', label: 'Crimson Core' },
];

export default function Login() {
  const router = useRouter();
  const [currentTheme, setCurrentTheme] = useState('purple');
  const [isLogin, setIsLogin] = useState(true);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabase) return;
    // Se já estiver logado, manda direto pro painel correspondente
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push('/'); 
    });
  }, [router]);

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!supabase) return setError("Conexão com o banco falhou.");
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        // --- LOGIN ---
        const { error } = await supabase.auth.signInWithPassword({ 
            email, 
            password 
        });
        if (error) throw error;
        
        router.push('/'); // Redireciona e a Home decide pra onde vai (Master/Player)
      } else {
        // --- REGISTRO ---
        if (!username.trim()) throw new Error("O nome de usuário é obrigatório.");
        
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { 
                username: username, 
                role: 'player' // Todo mundo que registra é player por padrão
            }
          }
        });
        if (error) throw error;
        
        alert('Conta criada com sucesso! Faça o login para entrar.');
        setIsLogin(true); // Volta pra tela de login
      }
    } catch (err) {
      setError(err.message === "Invalid login credentials" ? "Email ou senha incorretos." : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrapper} data-theme={currentTheme}>
      {/* Botões de Troca de Tema (No Canto Superior Direito) */}
      <div className={styles.themeSwitcher}>
          {themes.map(t => (
              <button 
                  key={t.id} 
                  className={`${styles.themeDot} ${currentTheme === t.id ? styles.activeDot : ''}`}
                  style={{ backgroundColor: t.color }} 
                  onClick={() => setCurrentTheme(t.id)} 
                  title={t.label} 
              />
          ))}
      </div>

      <div className={styles.loginCard}>
        <div className={styles.logoContainer}>
            <Logo size={60} showText={false} />
        </div>

        <div className={styles.headerGroup}>
            <h1 className={styles.title}>{isLogin ? 'Bem-vindo(a) de volta' : 'Crie sua Lenda'}</h1>
            <p className={styles.subtitle}>{isLogin ? 'Entre na sua conta para continuar' : 'Registre-se para iniciar a jornada'}</p>
        </div>

        {error && (
            <div className={styles.errorBox}>
                <AlertCircle size={18} />
                <span>{error}</span>
            </div>
        )}

        <form onSubmit={handleAuth} className={styles.formGroup}>
          {!isLogin && (
            <div className={styles.inputWrapper}>
              <User size={20} className={styles.inputIcon} />
              <input 
                type="text" 
                placeholder="Nome do Personagem" 
                className={styles.input} 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                required 
              />
            </div>
          )}

          <div className={styles.inputWrapper}>
            <Mail size={20} className={styles.inputIcon} />
            <input 
              type="email" 
              placeholder="E-mail" 
              className={styles.input} 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </div>

          <div className={styles.inputWrapper}>
            <Lock size={20} className={styles.inputIcon} />
            <input 
              type="password" 
              placeholder="Senha secreta" 
              className={styles.input} 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>

          <button type="submit" className={styles.btnAction} disabled={loading}>
            {loading ? <RefreshCw className="animate-spin" size={20} /> : (isLogin ? <LogIn size={20} /> : <UserPlus size={20} />)}
            {loading ? 'Aguarde...' : (isLogin ? 'ENTRAR' : 'REGISTRAR')}
          </button>
        </form>

        <p className={styles.toggleText}>
          {isLogin ? "Ainda não tem uma conta?" : "Já possui um personagem?"}
          <button type="button" onClick={() => { setIsLogin(!isLogin); setError(''); }} className={styles.toggleLink}>
            {isLogin ? 'Criar conta' : 'Fazer login'}
          </button>
        </p>
      </div>
    </div>
  );
}