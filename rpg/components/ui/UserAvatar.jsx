'use client';

import { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';

export function UserAvatar({ src, name = 'Aventureiro', className, borderColor }) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [src]);

  const initials = String(name || 'A')
    .trim()
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={cn(
        'rounded-full border border-white/15 bg-[var(--surface-2)] flex items-center justify-center font-bold text-white shrink-0 overflow-hidden select-none',
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
          className="h-full w-full object-cover rounded-full"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
