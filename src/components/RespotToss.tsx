import { useEffect, useRef, useState } from 'react';
import type { Player } from '../engine/types';
import { Button, Icon } from './ui';

/**
 * RespotToss — who plays first at the re-spotted black (1v1 and free-for-all).
 *
 * At the table this is "which hand is the ball in". The app picks one of the
 * tied players at random, then hands the result to the engine (RESPOT_TOSS),
 * so it is saved with the match and a resume never tosses again.
 *
 * Two steps: the toss itself (nothing can be played until it's made), then the
 * result with an optional swap, for a winner who'd rather not go first.
 */

interface RespotTossProps {
  /** The players level at the top. Only they play the re-spotted black. */
  contenders: Player[];
  /** Player at the table once the toss is made; null while it's still to do. */
  striker: Player | null;
  /** Swap is offered straight after the toss, in a two-way tie. */
  canSwap: boolean;
  canUndo: boolean;
  onToss: (winnerId: string) => void;
  onSwap: () => void;
  onPlay: () => void;
  onUndo: () => void;
}

const SPIN_MS = 1100;
const STEP_MS = 90;

function randomIndex(n: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % n;
}

export default function RespotToss({
  contenders, striker, canSwap, canUndo, onToss, onSwap, onPlay, onUndo,
}: RespotTossProps) {
  const [spinning, setSpinning] = useState(false);
  const [highlight, setHighlight] = useState<number | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const handleToss = () => {
    if (spinning || contenders.length === 0) return;
    const pick = randomIndex(contenders.length);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      onToss(contenders[pick].id);
      return;
    }
    // Run the highlight round the names, slowing to a stop on the pick.
    setSpinning(true);
    const steps = Math.floor(SPIN_MS / STEP_MS);
    const start = (pick - steps) % contenders.length + contenders.length;
    for (let i = 0; i <= steps; i += 1) {
      const at = i * STEP_MS + (i * i * STEP_MS) / (steps * 3);
      timers.current.push(
        window.setTimeout(() => setHighlight((start + i) % contenders.length), at),
      );
    }
    const end = steps * STEP_MS + (steps * STEP_MS) / 3 + 250;
    timers.current.push(
      window.setTimeout(() => {
        setSpinning(false);
        setHighlight(null);
        onToss(contenders[pick].id);
      }, end),
    );
  };

  const other = striker ? contenders.find((p) => p.id !== striker.id) : undefined;

  return (
    <div className="modal-backdrop modal-centered">
      <div
        className="menu-overlay-card toss-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="toss-title"
      >
        <span className="toss-eyebrow">
          <span className="tiny-ball-sphere ball-black" aria-hidden="true" /> Re-spotted black
        </span>

        {striker ? (
          <>
            <h3 id="toss-title" className="toss-title">{striker.name} plays first</h3>
            <p className="toss-sub">Black is re-spotted. The next pot or foul wins the frame.</p>
            <div className="toss-actions">
              <Button size="lg" fullWidth onClick={onPlay}>Play</Button>
              {canSwap && other && (
                <Button variant="tinted" fullWidth onClick={onSwap}>
                  Let {other.name} play first
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <h3 id="toss-title" className="toss-title">Scores are level</h3>
            <p className="toss-sub">
              {contenders.length > 2 ? 'Only the tied players play the black. ' : ''}
              Toss to see who plays first.
            </p>
            <ul className="toss-names" aria-live="polite">
              {contenders.map((p, i) => (
                <li key={p.id} className={`toss-name ${highlight === i ? 'is-lit' : ''}`}>
                  {p.name}
                </li>
              ))}
            </ul>
            <div className="toss-actions">
              <Button size="lg" fullWidth onClick={handleToss} disabled={spinning}>
                <Icon name="shuffle" size={18} /> {spinning ? 'Tossing…' : 'Toss'}
              </Button>
              {canUndo && (
                <Button variant="plain" onClick={onUndo} disabled={spinning}>
                  Undo last shot
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
