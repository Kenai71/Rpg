import './globals.css'

export const metadata = {
  title: 'Reino de RPG - Mural de Missões',
  description: 'Sistema de RPG medieval para mestres e jogadores',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-br">
      <head>
        {/* Importação das fontes medievais direto do Google Fonts */}
        <link 
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=MedievalSharp&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body className="bg-stone-950 text-stone-100 min-h-screen">
        {/* Overlay para textura de pergaminho/couro global (opcional) */}
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