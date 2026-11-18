'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
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
  Eye,
  EyeOff,
  HelpCircle,
  Lock,
  LogIn,
  Mail,
  User,
  UserPlus,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { auth, googleProvider, isFirebaseConfigured } from '../../lib/firebase';
import { ensureUserProfile } from '../../lib/rpg-service';
import Logo from '../components/Logo';
import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';

const InteractiveD20Scene = dynamic(() => import('../components/InteractiveD20Scene'), {
  ssr: false,
});

// Esquemas de validação Zod
const loginSchema = z.object({
  email: z.string().email('Informe um e-mail válido.'),
  password: z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres.'),
});

const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(2, 'O nome do personagem precisa ter pelo menos 2 caracteres.')
      .max(40, 'Máximo de 40 caracteres.'),
    email: z.string().email('Informe um e-mail válido.'),
    password: z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres.'),
    confirmPassword: z.string().min(1, 'Confirme sua senha.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
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
      return 'Senha fraca. Use pelo menos 6 caracteres.';
    case 'auth/popup-closed-by-user':
      return 'O pop-up de login do Google foi fechado antes de concluir.';
    case 'auth/cancelled-popup-request':
      return 'Já existe uma solicitação de login em andamento.';
    case 'auth/unauthorized-domain':
      return 'Domínio não autorizado no Firebase Authentication (Adicione o domínio no console do Firebase).';
    case 'auth/operation-not-allowed':
      return 'Provedor Google ou Email/Senha não habilitado no console do Firebase.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Aguarde instantes e tente novamente.';
    default:
      return err?.message || 'Falha na autenticação. Tente novamente.';
  }
}

function GoogleLogoSvg() {
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
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  const isLogin = mode === 'login';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(isLogin ? loginSchema : registerSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
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
    setShowEmailForm(nextMode === 'register');
    setAuthError('');
    reset({
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    });
  };

  const handleGoogleSignIn = async () => {
    if (!isFirebaseConfigured || !auth) {
      setAuthError('Firebase não configurado no arquivo .env.');
      return;
    }
    setAuthError('');
    setGoogleLoading(true);
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      await ensureUserProfile(credential.user);
      toast.success('Entrando no Vallen...');
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
      setAuthError('Firebase não configurado.');
      return;
    }
    setAuthError('');
    try {
      if (isLogin) {
        const cred = await signInWithEmailAndPassword(auth, values.email, values.password);
        await ensureUserProfile(cred.user);
        toast.success('Bem-vindo(a) de volta!');
        router.replace('/');
      } else {
        const cred = await createUserWithEmailAndPassword(auth, values.email, values.password);
        const displayName = values.username.trim();
        await updateProfile(cred.user, { displayName });
        await ensureUserProfile(cred.user, displayName);
        toast.success(`Personagem ${displayName} criado! Entrando no reino...`);
        router.replace('/');
      }
    } catch (err) {
      const message = mapFirebaseAuthError(err);
      setAuthError(message);
    }
  };

  return (
    <main className="relative min-h-screen w-full overflow-hidden select-none">
      {/* =========================================================================
          ATMOSFERA CÓSMICA: Malha de Gradientes Radiais + Bolinhas Finas e Espaçadas (26px)
         ========================================================================= */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        {/* Gradiente Cósmico Multi-Stop */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(90% 70% at 75% 20%, rgba(139, 92, 246, 0.22), transparent 60%), radial-gradient(80% 80% at 20% 25%, rgba(56, 189, 248, 0.20), transparent 55%), radial-gradient(100% 80% at 65% 85%, rgba(244, 63, 94, 0.12), transparent 55%), linear-gradient(160deg, #07080c 0%, #0d0f15 100%)',
          }}
        />
        {/* Véu escurecido sutil */}
        <div className="absolute inset-0 bg-black/35" />
        {/* Micro-grade geométrica: bolinhas fininhas (0.8px) e mais espaçadas (26px) */}
        <div
          className="absolute inset-0 opacity-75"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(255, 255, 255, 0.065) 0.8px, transparent 0.8px)',
            backgroundSize: '26px 26px',
            backgroundPosition: '0 0, 13px 13px',
          }}
        />
      </div>

      {/* =========================================================================
          LAYOUT SPLIT-SCREEN (Cena Interativa 3D + Coluna de Login)
         ========================================================================= */}
      <div className="relative z-10 flex min-h-screen flex-col md:landscape:flex-row">
        {/* LADO VISUAL: Cena Interativa 3D do Dado de 20 Lados (D20) */}
        <section
          className="w-full md:landscape:w-[50%] lg:w-[54%] xl:w-[58%] flex items-center justify-center p-3 lg:p-6 xl:p-8 relative min-h-[320px] md:landscape:min-h-screen"
          aria-label="Cena Interativa do Vallen RPG"
        >
          <InteractiveD20Scene className="w-full h-full max-w-2xl mx-auto" />
        </section>

        {/* LADO DE AUTENTICAÇÃO: Posicionado um pouco mais para a esquerda na coluna */}
        <section
          className="relative flex min-h-screen w-full flex-col justify-between p-4 sm:p-6 xl:p-10 md:landscape:w-[50%] lg:w-[46%] xl:w-[42%] overflow-y-auto"
          aria-label="Formulário de Entrada"
        >
          {/* Top Header: Logo do Dado de 20 Lados (Branco Meio Cinza) */}
          <header className="pt-2 pb-1 w-full max-w-[400px] mx-auto md:landscape:ml-6 lg:landscape:ml-10 xl:landscape:ml-12 md:landscape:mr-auto">
            <a
              href="/"
              className="inline-block transition-transform duration-200 hover:scale-[1.02] focus:outline-none"
              aria-label="Vallen RPG Início"
            >
              <Logo size={38} showText={true} subtitle="Mundo RPG" />
            </a>
          </header>

          {/* Card de Autenticação: Ajustado para caber perfeitamente em telas de notebook */}
          <div className="flex flex-1 items-center justify-center md:landscape:justify-start my-auto w-full py-2">
            <div className="w-full max-w-[400px] md:landscape:ml-6 lg:landscape:ml-10 xl:landscape:ml-12 md:landscape:mr-auto rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-5 sm:p-6 xl:p-8 shadow-2xl shadow-black/60 space-y-4">
              {/* Heading */}
              <div className="text-center md:landscape:text-left space-y-1.5">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white leading-tight">
                  {isLogin ? 'Entre na Criação' : 'Forje sua Lenda'}
                </h1>
                <p className="text-xs text-slate-400">
                  {isLogin
                    ? 'Retome sua campanha e gerencie suas conquistas.'
                    : 'Crie seu aventureiro para começar no Rank F.'}
                </p>
              </div>

              {/* Mode Tabs (Entrar / Criar Personagem) */}
              <div
                role="tablist"
                aria-label="Modo de acesso"
                className="grid grid-cols-2 p-1 rounded-xl border border-white/10 bg-black/30 backdrop-blur-sm"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={isLogin}
                  onClick={() => switchMode('login')}
                  className={`h-9 rounded-lg text-xs font-medium transition-all ${
                    isLogin
                      ? 'bg-white/15 text-white shadow-sm border border-white/15'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={!isLogin}
                  onClick={() => switchMode('register')}
                  className={`h-9 rounded-lg text-xs font-medium transition-all ${
                    !isLogin
                      ? 'bg-white/15 text-white shadow-sm border border-white/15'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Criar Personagem
                </button>
              </div>

              {/* Error Banner */}
              {authError && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-start gap-2.5 backdrop-blur-sm animate-in fade-in"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                  <span className="leading-relaxed">{authError}</span>
                </div>
              )}

              {/* Botão Oficial do Google OAuth */}
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={googleLoading || isSubmitting}
                  onClick={handleGoogleSignIn}
                  className="flex min-h-11 w-full touch-manipulation items-center justify-center gap-2.5 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/20 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {googleLoading ? (
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  ) : (
                    <GoogleLogoSvg />
                  )}
                  <span>Continuar com Google</span>
                </button>

                {!showEmailForm && isLogin && (
                  <button
                    type="button"
                    onClick={() => setShowEmailForm(true)}
                    className="flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 backdrop-blur-sm transition-all duration-200 hover:bg-white/10 hover:text-white active:scale-[0.985]"
                  >
                    <Mail className="h-4 w-4 text-slate-400" />
                    <span>Continuar com E-mail</span>
                  </button>
                )}
              </div>

              {/* Formulário de E-mail & Senha */}
              {(showEmailForm || !isLogin) && (
                <form
                  onSubmit={handleSubmit(onSubmit)}
                  className="space-y-3.5 pt-1 animate-in fade-in duration-200"
                  noValidate
                >
                  {!isLogin && (
                    <FormField
                      label="Nome do Personagem"
                      htmlFor="username"
                      required
                      error={errors.username?.message}
                    >
                      <div className="relative flex items-center">
                        <User className="h-4 w-4 text-slate-500 absolute left-3.5 pointer-events-none" />
                        <input
                          id="username"
                          type="text"
                          placeholder="Ex: Alden, o Guardião"
                          autoComplete="nickname"
                          className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-white/15 bg-black/30 text-white placeholder:text-slate-500 text-sm backdrop-blur-sm transition-colors focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/30"
                          {...register('username')}
                        />
                      </div>
                    </FormField>
                  )}

                  <FormField label="E-mail" htmlFor="email" required error={errors.email?.message}>
                    <div className="relative flex items-center">
                      <Mail className="h-4 w-4 text-slate-500 absolute left-3.5 pointer-events-none" />
                      <input
                        id="email"
                        type="email"
                        placeholder="heroi@vallen.com"
                        autoComplete="email"
                        className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-white/15 bg-black/30 text-white placeholder:text-slate-500 text-sm backdrop-blur-sm transition-colors focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/30"
                        {...register('email')}
                      />
                    </div>
                  </FormField>

                  <FormField
                    label="Senha"
                    htmlFor="password"
                    required
                    error={errors.password?.message}
                  >
                    <div className="relative flex items-center">
                      <Lock className="h-4 w-4 text-slate-500 absolute left-3.5 pointer-events-none" />
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Mínimo 6 caracteres"
                        autoComplete={isLogin ? 'current-password' : 'new-password'}
                        className="w-full h-11 pl-10 pr-11 rounded-xl border border-white/15 bg-black/30 text-white placeholder:text-slate-500 text-sm backdrop-blur-sm transition-colors focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/30"
                        {...register('password')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                        className="absolute right-2.5 h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormField>

                  {!isLogin && (
                    <FormField
                      label="Confirmar Senha"
                      htmlFor="confirmPassword"
                      required
                      error={errors.confirmPassword?.message}
                    >
                      <div className="relative flex items-center">
                        <Lock className="h-4 w-4 text-slate-500 absolute left-3.5 pointer-events-none" />
                        <input
                          id="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="Repita sua senha"
                          autoComplete="new-password"
                          className="w-full h-11 pl-10 pr-11 rounded-xl border border-white/15 bg-black/30 text-white placeholder:text-slate-500 text-sm backdrop-blur-sm transition-colors focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/30"
                          {...register('confirmPassword')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          aria-label={showConfirmPassword ? 'Ocultar confirmação de senha' : 'Exibir confirmação de senha'}
                          className="absolute right-2.5 h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormField>
                  )}

                  <Button
                    type="submit"
                    loading={isSubmitting}
                    disabled={googleLoading}
                    className="w-full min-h-11 rounded-xl bg-white text-slate-900 font-semibold text-sm hover:bg-slate-100 transition-all duration-200 shadow-lg active:scale-[0.985] mt-2"
                  >
                    {!isSubmitting &&
                      (isLogin ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />)}
                    <span>{isLogin ? 'Entrar no Reino' : 'Criar Personagem'}</span>
                  </Button>
                </form>
              )}

              {/* Alternador de Modo */}
              <div className="text-center md:landscape:text-left text-xs text-slate-400 pt-1">
                {isLogin ? (
                  <span>
                    Novo no Vallen?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('register')}
                      className="text-white hover:underline font-medium ml-1"
                    >
                      Criar Conta
                    </button>
                  </span>
                ) : (
                  <span>
                    Já possui uma conta?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="text-white hover:underline font-medium ml-1"
                    >
                      Fazer Login
                    </button>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Footer: Limpo e Discreto */}
          <footer className="w-full max-w-[400px] mx-auto md:landscape:ml-6 lg:landscape:ml-12 md:landscape:mr-auto flex items-center justify-center md:landscape:justify-start gap-3 pt-4 pb-2 text-xs text-slate-500">
            <button
              type="button"
              onClick={() => setHelpModalOpen(true)}
              className="transition-colors hover:text-slate-300 flex items-center gap-1"
            >
              <HelpCircle className="h-3 w-3" /> Ajuda
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setHelpModalOpen(true)}
              className="transition-colors hover:text-slate-300"
            >
              Regras
            </button>
          </footer>
        </section>
      </div>

      {/* Modal de Ajuda & Guia Rápido */}
      <Modal
        open={helpModalOpen}
        onOpenChange={setHelpModalOpen}
        title="Guia do Vallen RPG"
        description="Informações essenciais para Mestres e Jogadores."
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
          <div className="p-3 rounded-xl border border-white/10 bg-white/5 space-y-1.5">
            <p className="font-semibold text-white flex items-center gap-1.5">
              <GoogleLogoSvg /> Autenticação Segura
            </p>
            <p className="text-slate-400">
              Você pode entrar diretamente com sua conta Google com um clique ou criar uma conta com
              e-mail e senha.
            </p>
          </div>

          <div className="p-3 rounded-xl border border-white/10 bg-white/5 space-y-1.5">
            <p className="font-semibold text-white flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-sky-400" /> Sincronização Instantânea
            </p>
            <p className="text-slate-400">
              Todas as missões criadas pelo Mestre e itens comprados no mercado são sincronizados
              instantaneamente via Cloud Firestore.
            </p>
          </div>
        </div>
      </Modal>
    </main>
  );
}
