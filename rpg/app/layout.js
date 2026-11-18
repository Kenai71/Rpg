import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AppProviders } from '../components/providers/AppProviders';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata = {
  title: 'Vallen RPG — Mural de Missões & Gestão do Reino',
  description: 'Plataforma de RPG medieval para mestres e aventureiros em tempo real.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" data-theme="purple" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen bg-[var(--surface-0)] text-slate-100 font-sans">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
