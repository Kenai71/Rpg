'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertCircle,
  Compass,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  Mail,
  Scroll,
  Shield,
  ShoppingBag,
  User,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { auth, googleProvider, isFirebaseConfigured } from '../../lib/firebase';
import { ensureUserProfile } from '../../lib/rpg-service';
import Logo from '../components/Logo';
import { Button } from '../../components/ui/Button';
import { FormField, Input } from '../../components/ui/Input';
import { ThemeSwitcher } from '../../components/ui/ThemeSwitcher';

const loginSchema = z.object({
  email: z.string().email('Informe um e-mail válido.'),
  password: z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres.'),
});

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, 'O nome do personagem precisa ter pelo menos 2 caracteres.')
    .max(40, 'Máximo de 40 caracteres.'),
  email: z.string().email('Informe um e-mail válido.'),
  password: z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres.'),
});

function mapFirebaseAuthError(err) {
  const code = err?.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'E-mail ou senha incorretos.';
    case 'auth/email-already-in-use':
      return 'Este e-mail já está cadastrado. Faça login para continuar.';
    case 'auth/weak-password':
      return 'Senha muito fraca. Use pelo menos 6 caracteres.';
    case 'auth/popup-closed-by-user':
      return 'O pop-up de login do Google foi fechado antes de concluir.';
    case 'auth/cancelled-popup-request':
      return 'Já existe uma janela de login em andamento.';
    case 'auth/unauthorized-domain':
      return 'Este domínio ainda não está autorizado no Firebase Authentication (Settings > Authorized domains).';
    case 'auth/operation-not-allowed':
      return 'Este provedor de login não está habilitado no Firebase Authentication.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas seguidas. Aguarde alguns instantes e tente novamente.';
    default:
      return err?.message || 'Não foi possível autenticar. Tente novamente.';
  }
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z"
      />
      <path
        fill="#34A853"
        d="M3.6 7.4l3.2 2.3C7.7 7.6 9.7 6 12 6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.5 12 2.5 8.3 2.5 5.1 4.6 3.6 7.4z"
      />
      <path
        fill="#FBBC05"
        d="M12 21.5c2.5 0 4.6-.8 6.2-2.3l-2.9-2.4c-.8.6-1.8 1-3.3 1-3.8 0-5.1-2.5-5.4-3.8l-3.2 2.5c1.5 2.9 4.7 5 8.6 5z"
      />
      <path
        fill="#4285F4"
        d="M21.1 12.2c0-.6-.1-1.1-.2-1.6H12v3.9h5.4c-.3 1.3-1.1 2.4-2.1 3.1l2.9 2.4c1.7-1.6 2.9-4 2.9-7.8z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const isLogin = mode === 'login';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(isLogin ? loginSchema : registerSchema),
    defaultValues: { username: '', email: '', password: '' },
  });

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return undefined;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace('/');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setAuthError('');
    reset({ username: '', email: '', password: '' });
  };

  const handleGoogleSignIn = async () => {
    if (!isFirebaseConfigured || !auth) {
      setAuthError('Conexão com o Firebase não configurada.');
      return;
    }
    setAuthError('');
    setGoogleLoading(true);
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      await ensureUserProfile(credential.user);
      toast.success('Autenticação com Google realizada!');
      router.replace('/');
    } catch (err) {
      const message = mapFirebaseAuthError(err);
      setAuthError(message);
      toast.error(message);
    } finally {
      setGoogleLoading(false);
    }
  };

  const onSubmit = async (values) => {
    if (!isFirebaseConfigured || !auth) {
      setAuthError('Conexão com o Firebase não configurada.');
      return;
    }
    setAuthError('');
    try {
      if (isLogin) {
        const cred = await signInWithEmailAndPassword(auth, values.email, values.password);
        await ensureUserProfile(cred.user);
        toast.success('Bem-vindo(a) de volta ao Reino!');
        router.replace('/');
      } else {
        const cred = await createUserWithEmailAndPassword(auth, values.email, values.password);
        await updateProfile(cred.user, { displayName: values.username.trim() });
        await ensureUserProfile(cred.user, values.username.trim());
        toast.success('Personagem criado! Entrando na taverna...');
        router.replace('/');
      }
    } catch (err) {
      const message = mapFirebaseAuthError(err);
      setAuthError(message);
    }
  };

  return (
    <div className="min-h-screen realm-backdrop flex flex-col justify-between p-4 sm:p-6 lg:p-10 relative">
      {/* Top Bar */}
      <header className="w-full max-w-6xl mx-auto flex items-center justify-between gap-4">
        <Logo size={38} />
        <ThemeSwitcher />
      </header>

      {/* Main Content */}
      <div className="w-full max-w-6xl mx-auto my-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Realm Highlights (Desktop Left / Mobile Top summary) */}
        <section className="lg:col-span-6 space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface-1)]/80 px-3.5 py-1.5 text-xs font-semibold text-[var(--accent-glow)]">
            <Compass className="h-3.5 w-3.5" aria-hidden="true" />
            Crônicas & Contratos em Tempo Real
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.12]">
            Gerencie sua guilda, missões e tesouros em um só lugar.
          </h1>

          <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto lg:mx-0 leading-relaxed">
            Acesse o Mural de Missões como aventureiro ou comande a economia, grupos e recompensas
            como Mestre do Reino com sincronização instantânea.
          </p>

          <div className="hidden sm:grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-left">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)]/70 p-4 space-y-2">
              <div className="h-8 w-8 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-glow)] flex items-center justify-center">
                <Scroll className="h-4 w-4" aria-hidden="true" />
              </div>
              <p className="text-xs font-bold text-slate-100">Mural de Missões</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Contratos por Rank com divisão automática para grupos.
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)]/70 p-4 space-y-2">
              <div className="h-8 w-8 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-glow)] flex items-center justify-center">
                <ShoppingBag className="h-4 w-4" aria-hidden="true" />
              </div>
              <p className="text-xs font-bold text-slate-100">Loja & Runas</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Equipamentos por raridade compráveis com ouro ou runas.
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)]/70 p-4 space-y-2">
              <div className="h-8 w-8 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-glow)] flex items-center justify-center">
                <Shield className="h-4 w-4" aria-hidden="true" />
              </div>
              <p className="text-xs font-bold text-slate-100">Ficha & Mochila</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Equipamento interativo por slots e trocas entre aliados.
              </p>
            </div>
          </div>
        </section>

        {/* Auth Card */}
        <section className="lg:col-span-6 w-full max-w-md mx-auto lg:ml-auto lg:mr-0">
          <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-1)]/95 backdrop-blur-xl p-6 sm:p-8 shadow-2xl space-y-6">
            {/* Mode Tabs */}
            <div
              role="tablist"
              aria-label="Modo de autenticação"
              className="grid grid-cols-2 p-1 rounded-xl bg-[var(--surface-0)] border border-[var(--border-subtle)]"
            >
              <button
                type="button"
                role="tab"
                aria-selected={isLogin}
                onClick={() => switchMode('login')}
                className={`h-10 rounded-lg text-sm font-semibold transition-all ${
                  isLogin
                    ? 'bg-[var(--surface-2)] text-white shadow-sm border border-[var(--border-subtle)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={!isLogin}
                onClick={() => switchMode('register')}
                className={`h-10 rounded-lg text-sm font-semibold transition-all ${
                  !isLogin
                    ? 'bg-[var(--surface-2)] text-white shadow-sm border border-[var(--border-subtle)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Criar Conta
              </button>
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white tracking-tight">
                {isLogin ? 'Acesse sua conta' : 'Crie seu personagem'}
              </h2>
              <p className="text-xs text-slate-400">
                {isLogin
                  ? 'Entre com Google ou e-mail para continuar sua jornada.'
                  : 'Registre-se gratuitamente para começar no Rank F.'}
              </p>
            </div>

            {/* Google Sign-In */}
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="w-full bg-white text-slate-900 hover:bg-slate-100 border-slate-200"
              loading={googleLoading}
              disabled={isSubmitting}
              onClick={handleGoogleSignIn}
            >
              {!googleLoading && <GoogleIcon />}
              <span>Continuar com Google</span>
            </Button>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-[var(--border-subtle)] w-full" />
              <span className="px-3 text-[11px] uppercase tracking-wider text-slate-500 bg-[var(--surface-1)] whitespace-nowrap">
                ou com e-mail
              </span>
              <div className="border-t border-[var(--border-subtle)] w-full" />
            </div>

            {authError && (
              <div
                role="alert"
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300 flex items-start gap-2.5"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" aria-hidden="true" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              {!isLogin && (
                <FormField
                  label="Nome do Personagem"
                  htmlFor="username"
                  required
                  error={errors.username?.message}
                >
                  <Input
                    id="username"
                    type="text"
                    icon={User}
                    placeholder="Ex: Kaelen, o Guardião"
                    autoComplete="nickname"
                    error={errors.username?.message}
                    {...register('username')}
                  />
                </FormField>
              )}

              <FormField label="E-mail" htmlFor="email" required error={errors.email?.message}>
                <Input
                  id="email"
                  type="email"
                  icon={Mail}
                  placeholder="heroi@reino.com"
                  autoComplete="email"
                  error={errors.email?.message}
                  {...register('email')}
                />
              </FormField>

              <FormField label="Senha" htmlFor="password" required error={errors.password?.message}>
                <div className="relative flex items-center">
                  <Lock
                    className="h-4 w-4 text-slate-400 absolute left-3.5 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    aria-invalid={errors.password ? 'true' : undefined}
                    className={`w-full h-11 pl-10 pr-11 rounded-xl bg-[var(--surface-0)]/80 border text-slate-100 placeholder:text-slate-500 text-sm transition-colors focus:outline-none focus:ring-2 ${
                      errors.password
                        ? 'border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/20'
                        : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)] focus:border-[var(--accent-primary)] focus:ring-[var(--accent-soft)]'
                    }`}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute right-2.5 h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FormField>

              <Button
                type="submit"
                size="lg"
                className="w-full mt-2"
                loading={isSubmitting}
                disabled={googleLoading}
              >
                {!isSubmitting &&
                  (isLogin ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />)}
                <span>{isLogin ? 'Entrar no Reino' : 'Criar Personagem'}</span>
              </Button>
            </form>
          </div>
        </section>
      </div>

      <footer className="w-full max-w-6xl mx-auto text-center lg:text-left text-xs text-slate-500">
        Astralis RPG System • Alimentado por Firebase Authentication & Cloud Firestore
      </footer>
    </div>
  );
}
