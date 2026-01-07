import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

// Configurando a fonte principal (Estilo limpo/moderno)
const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

// Configurando uma fonte monoespaçada para números/stats (Estilo hacker/tech)
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata = {
  title: 'Reino de RPG - Mural de Missões',
  description: 'Sistema de RPG medieval para mestres e jogadores',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-br">
      <head>
        {/* Removemos os links manuais de fontes antigas */}
      </head>
      <body className={`${inter.variable} ${jetbrains.variable} bg-stone-950 text-stone-100 min-h-screen`}>
        {/* Mantive o background de textura mas com a nova fonte vai ficar um mix interessante */}
        <div className="fixed inset-0 pointer-events-none opacity-20 z-[-1]" 
             style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/dark-leather.png')" }}>
        </div>
        
        <main>
          {children}
        </main>
      </body>
    </html>
  )
}