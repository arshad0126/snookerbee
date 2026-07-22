import { type CSSProperties } from 'react';
import { avatarTint } from '../../styles/tokens';

export interface AvatarProps {
  /** Stable id/seed for a deterministic tint when no photo is present. */
  seed: string;
  name: string;
  photoUrl?: string;
  size?: number;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function Avatar({ seed, name, photoUrl, size = 40 }: AvatarProps) {
  if (photoUrl) {
    return (
      <img
        className="ui-avatar"
        src={photoUrl}
        alt={name}
        width={size}
        height={size}
        style={{ width: size, height: size }}
      />
    );
  }

  const tint = avatarTint(seed);
  const style: CSSProperties = {
    width: size,
    height: size,
    background: tint.bg,
    color: tint.fg,
    fontSize: Math.round(size * 0.4),
  };

  return (
    <span className="ui-avatar" style={style} role="img" aria-label={name}>
      {initials(name)}
    </span>
  );
}
