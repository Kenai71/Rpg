import { Hexagon, Gem } from 'lucide-react';

export default function Logo({ size = 40, showText = true, subtitle = 'RPG System' }) {
  return (
    <div className="flex items-center gap-3 select-none">
      <div
        className="relative flex items-center justify-center shrink-0"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <Hexagon
          size={size}
          className="text-slate-100/90"
          strokeWidth={1.5}
          fill="rgba(255, 255, 255, 0.04)"
        />
        <Gem
          size={Math.round(size * 0.46)}
          className="absolute text-[var(--accent-glow)] drop-shadow-[0_0_8px_var(--accent-primary)]"
          strokeWidth={1.9}
        />
      </div>

      {showText && (
        <div className="flex flex-col leading-none">
          <span className="font-sans font-extrabold text-lg tracking-tight text-slate-50">
            ASTRALIS
          </span>
          <span className="font-mono text-[10px] tracking-[0.26em] text-slate-400 uppercase mt-1">
            {subtitle}
          </span>
        </div>
      )}
    </div>
  );
}
