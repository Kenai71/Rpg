'use client';

/**
 * Vallen RPG Logo — D20 (Dado de 20 Lados)
 * Facetas isométricas em branco meio cinza (off-white / silver-gray)
 * com iluminação tridimensional, arestas metálicas e o numeral 20 na face frontal.
 * Zero ícones de estrela.
 */
export function D20Icon({ size = 42, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-transform duration-300 hover:scale-105 ${className}`}
      aria-hidden="true"
    >
      <defs>
        {/* Gradiente da Face Frontal Superior (Branco Puro / Off-white) */}
        <linearGradient id="d20-front-grad" x1="50%" y1="20%" x2="50%" y2="62%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>

        {/* Gradiente da Face Superior Esquerda (Cinza Claro / Silver) */}
        <linearGradient id="d20-top-left" x1="28%" y1="12%" x2="50%" y2="39%">
          <stop offset="0%" stopColor="#f1f5f9" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>

        {/* Gradiente da Face Superior Direita (Luz Especular Suave) */}
        <linearGradient id="d20-top-right" x1="68%" y1="18%" x2="50%" y2="39%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>

        {/* Gradiente da Face Inferior Esquerda (Sombra Média) */}
        <linearGradient id="d20-bottom-left" x1="28%" y1="39%" x2="29%" y2="83%">
          <stop offset="0%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>

        {/* Gradiente da Face Inferior Direita (Cinza Metálico) */}
        <linearGradient id="d20-bottom-right" x1="68%" y1="62%" x2="71%" y2="89%">
          <stop offset="0%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>

        {/* Gradiente da Face Central Inferior */}
        <linearGradient id="d20-bottom-center" x1="50%" y1="62%" x2="50%" y2="89%">
          <stop offset="0%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>

        {/* Brilho Sutil na Face Frontal */}
        <radialGradient id="d20-glow" cx="50%" cy="38%" r="45%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>

      {/* Sombra sutil sob o dado */}
      <ellipse cx="50" cy="94" rx="34" ry="5" fill="rgba(0,0,0,0.35)" filter="blur(2px)" />

      {/* 
        Facetas Geométricas do Icosaedro (D20)
        Projeção isométrica com 10 faces visíveis e contorno hexagonal perfeito
      */}

      {/* 1. Face Superior Externa Esquerda */}
      <path
        d="M 29.14 11.29 L 50.00 6.00 L 66.88 17.59 Z"
        fill="#e2e8f0"
        stroke="rgba(255,255,255,0.7)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* 2. Face Superior Externa Direita */}
      <path
        d="M 50.00 6.00 L 70.33 17.51 L 66.88 17.59 Z"
        fill="#cbd5e1"
        stroke="rgba(255,255,255,0.7)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* 3. Face Lateral Superior Direita */}
      <path
        d="M 70.33 17.51 L 93.85 48.61 L 66.88 17.59 Z"
        fill="#94a3b8"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* 4. Face Lateral Superior Esquerda */}
      <path
        d="M 27.21 38.53 L 6.15 51.39 L 29.14 11.29 Z"
        fill="#cbd5e1"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* 5. Face Lateral Inferior Esquerda */}
      <path
        d="M 29.67 82.49 L 6.15 51.39 L 27.21 38.53 Z"
        fill="url(#d20-bottom-left)"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* 6. Face Lateral Inferior Direita */}
      <path
        d="M 70.86 88.71 L 67.20 61.60 L 93.85 48.61 Z"
        fill="url(#d20-bottom-right)"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* 7. Face Superior Interna */}
      <path
        d="M 29.14 11.29 L 66.88 17.59 L 27.21 38.53 Z"
        fill="url(#d20-top-left)"
        stroke="rgba(255,255,255,0.8)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* 8. Face Central Direita */}
      <path
        d="M 66.88 17.59 L 93.85 48.61 L 67.20 61.60 Z"
        fill="url(#d20-top-right)"
        stroke="rgba(255,255,255,0.8)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* 9. Face Inferior Central */}
      <path
        d="M 29.67 82.49 L 67.20 61.60 L 70.86 88.71 Z"
        fill="url(#d20-bottom-center)"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* 10. Face Inferior Central-Esquerda */}
      <path
        d="M 29.67 82.49 L 27.21 38.53 L 67.20 61.60 Z"
        fill="#94a3b8"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      {/* 11. FACE PRINCIPAL FRONTAL (Hero Face) */}
      <path
        d="M 67.20 61.60 L 27.21 38.53 L 66.88 17.59 Z"
        fill="url(#d20-front-grad)"
        stroke="#ffffff"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />

      {/* Brilho radial na face frontal */}
      <path
        d="M 67.20 61.60 L 27.21 38.53 L 66.88 17.59 Z"
        fill="url(#d20-glow)"
        pointerEvents="none"
      />

      {/* Numeral "20" na face frontal */}
      <text
        x="53.8"
        y="43.5"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#0f172a"
        fontSize="17.5"
        fontWeight="800"
        fontFamily="system-ui, -apple-system, sans-serif"
        letterSpacing="-0.04em"
        style={{ userSelect: 'none' }}
      >
        20
      </text>

      {/* Sub-ponto clássico do D20 abaixo do número */}
      <circle cx="53.8" cy="48.5" r="1.3" fill="#334155" />
    </svg>
  );
}

export default function Logo({
  size = 40,
  showText = true,
  subtitle = 'Mundo RPG',
  className = '',
}) {
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <D20Icon size={size} />

      {showText && (
        <div className="flex flex-col leading-none">
          <span className="font-sans font-extrabold text-lg tracking-tight text-slate-50">
            VALLEN
          </span>
          <span className="font-mono text-[10px] tracking-[0.24em] text-slate-400 uppercase mt-1">
            {subtitle}
          </span>
        </div>
      )}
    </div>
  );
}
