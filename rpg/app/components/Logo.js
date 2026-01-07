import { Hexagon, Sparkles } from 'lucide-react';

export default function Logo({ size = 40, showText = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', userSelect: 'none' }}>
      
      {/* ÍCONE GRÁFICO */}
      <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Forma Base: Hexágono */}
        <Hexagon 
          size={size} 
          color="#f8fafc"       // Branco Gelo
          strokeWidth={1.5} 
          fill="rgba(255,255,255,0.05)" // Preenchimento leve
        />
        
        {/* Detalhe: Brilho Dourado Pulsante */}
        <Sparkles 
          size={size * 0.55} 
          color="#fbbf24"       // Dourado (Amber)
          fill="#fbbf24"
          strokeWidth={0}
          style={{ 
            position: 'absolute', 
            zIndex: 10,
            animation: 'pulseLogo 2s infinite ease-in-out' 
          }}
        />
      </div>

      {/* TEXTO DO LOGO (Opcional) */}
      {showText && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{ 
            fontFamily: 'var(--font-body)', 
            fontWeight: 800, 
            fontSize: '1.25rem', 
            color: '#f8fafc', 
            letterSpacing: '-0.03em' 
          }}>
            ASTRALIS
          </span>
          <span style={{ 
            fontFamily: 'monospace',
            fontSize: '0.6rem', 
            letterSpacing: '0.3em', 
            color: '#94a3b8', // Cinza azulado
            textTransform: 'uppercase',
            marginTop: '2px'
          }}>
            RPG System
          </span>
        </div>
      )}

      {/* Animação CSS embutida */}
      <style jsx>{`
        @keyframes pulseLogo {
          0%, 100% { transform: scale(1); opacity: 1; filter: drop-shadow(0 0 5px rgba(251, 191, 36, 0.5)); }
          50% { transform: scale(0.85); opacity: 0.8; filter: drop-shadow(0 0 0px rgba(251, 191, 36, 0)); }
        }
      `}</style>
    </div>
  );
}