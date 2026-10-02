import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { isPlaceholderName } from '../lib/playerStats';

interface Props {
  name: string;
  /** Runs before navigating, e.g. to close a modal. */
  onBeforeNavigate?: () => void;
}

/**
 * A player's name that opens their stats. Lives inside cards that open
 * Match Analysis on click, so it stops the click from reaching the card.
 * Unnamed slots ("Player 2") stay plain text.
 */
export default function PlayerLink({ name, onBeforeNavigate }: Props) {
  const navigate = useNavigate();
  if (isPlaceholderName(name)) return <>{name}</>;

  const open = (e: MouseEvent) => {
    e.stopPropagation();
    onBeforeNavigate?.();
    navigate(`/players?name=${encodeURIComponent(name)}`);
  };

  return (
    <button type="button" className="player-link" onClick={open} aria-label={`${name}'s stats`}>
      {name}
    </button>
  );
}
