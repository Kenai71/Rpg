'use client';

import { useState } from 'react';
import { cn } from '../../lib/utils';

export function UserAvatar({ src, name = 'Aventureiro', className, borderColor }) {
  const [imgError, setImgError] = useState(false);
  const initials = String(name || 'A')
    .trim()
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={cn(
        'rounded-xl border border-white/10 bg-[var(--surface-2)] flex items-center justify-center font-bold text-white shrink-0 overflow-hidden select-none',
        className
      )}
      style={borderColor ? { borderColor } : undefined}
    >
      {src && !imgError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`Avatar de ${name}`}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
