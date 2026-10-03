import { useState } from 'react';
import type { Player } from '../engine/types';
import { Icon } from './ui';

/**
 * Next frame setup — who breaks, and the playing order after them.
 *
 * The breaker is always the top row. Tapping another player makes them the
 * breaker: the order turns around the table so everyone keeps their place
 * relative to each other (in teams, sides still alternate). With three or
 * more players in free-for-all, the rows under the breaker can also be moved
 * up or down with full-size buttons.
 *
 * Cancel closes it without touching anything — the frame summary is still
 * there and Next Frame opens this again.
 */

interface Props {
  frameNumber: number;
  /** Playing order with the suggested breaker first. */
  initialOrder: Player[];
  /** Free-for-all with 3+ players: the order after the breaker can change. */
  canReorder: boolean;
  onStart: (order: Player[]) => void;
  onCancel: () => void;
}

/** Turn the order around the table so `index` comes first. */
const rotateTo = <T,>(list: T[], index: number): T[] => [...list.slice(index), ...list.slice(0, index)];

export default function NextFrameSetup({ frameNumber, initialOrder, canReorder, onStart, onCancel }: Props) {
  const [order, setOrder] = useState<Player[]>(initialOrder);

  const move = (from: number, to: number) => {
    // Position 0 is the breaker; reordering only happens below it.
    if (to < 1 || to >= order.length) return;
    const next = [...order];
    [next[from], next[to]] = [next[to], next[from]];
    setOrder(next);
  };

  return (
    <div className="modal-backdrop modal-centered nf-backdrop" onClick={onCancel}>
      <div
        className="nf-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nf-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="nf-head">
          <div>
            <h3 id="nf-title" className="nf-title">Frame {frameNumber} setup</h3>
            <p className="nf-sub">Tap a player to make them the breaker.</p>
          </div>
          <button type="button" className="nf-close" onClick={onCancel} aria-label="Cancel and go back">
            <Icon name="close" size={20} />
          </button>
        </header>

        <ol className="nf-list">
          {order.map((player, idx) => {
            const isBreaker = idx === 0;
            return (
              <li key={player.id} className={`nf-row${isBreaker ? ' is-breaker' : ''}`}>
                <button
                  type="button"
                  className="nf-pick"
                  onClick={() => !isBreaker && setOrder(rotateTo(order, idx))}
                  aria-pressed={isBreaker}
                  aria-label={isBreaker ? `${player.name} breaks` : `Make ${player.name} the breaker`}
                >
                  <span className="nf-pos">{idx + 1}</span>
                  <span className="nf-name">{player.name}</span>
                  {isBreaker
                    ? <span className="nf-badge"><Icon name="ball" size={14} /> Breaks</span>
                    : <span className="nf-hint">Make breaker</span>}
                </button>

                {canReorder && !isBreaker && (
                  <span className="nf-moves">
                    <button
                      type="button"
                      className="nf-move"
                      onClick={() => move(idx, idx - 1)}
                      disabled={idx === 1}
                      aria-label={`Move ${player.name} earlier`}
                    >
                      <Icon name="chevron-up" size={22} />
                    </button>
                    <button
                      type="button"
                      className="nf-move"
                      onClick={() => move(idx, idx + 1)}
                      disabled={idx === order.length - 1}
                      aria-label={`Move ${player.name} later`}
                    >
                      <Icon name="chevron-down" size={22} />
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        <div className="nf-actions">
          <button type="button" className="btn btn-secondary nf-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary nf-start" onClick={() => onStart(order)}>
            Start frame {frameNumber} <Icon name="ball" size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
