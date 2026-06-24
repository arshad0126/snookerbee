import { useState } from 'react';
import type { BallType, GameState } from '../engine/types';
import { BALL_VALUES, BALL_COLORS } from '../engine/constants';
import { calculateFoulPenalty } from '../engine/validators';

interface FoulDialogProps {
  isOpen: boolean;
  isInOff: boolean;
  gameState: GameState;
  onConfirm: (ball: BallType) => void;
  onCancel: () => void;
}

export default function FoulDialog({
  isOpen,
  isInOff,
  gameState,
  onConfirm,
  onCancel,
}: FoulDialogProps) {
  const [selectedBall, setSelectedBall] = useState<BallType>('red');

  if (!isOpen) return null;

  const penalty = calculateFoulPenalty(gameState, selectedBall);

  // Ball list for selection
  const balls: BallType[] = ['red', 'yellow', 'green', 'brown', 'blue', 'pink', 'black'];

  const getBallDisplayName = (ball: BallType) => {
    return ball.charAt(0).toUpperCase() + ball.slice(1);
  };

  return (
    <div className="modal-backdrop">
      <div className="foul-dialog card">
        <h3 className="modal-title">{isInOff ? 'Foul: In-Off' : 'Foul Committed'}</h3>
        <p className="modal-text">Select the ball involved in the foul:</p>

        <div className="foul-balls-grid">
          {balls.map(ball => (
            <button
              key={ball}
              type="button"
              onClick={() => setSelectedBall(ball)}
              className={`btn-foul-ball ball-${ball} ${selectedBall === ball ? 'selected' : ''}`}
              style={{
                backgroundColor: BALL_COLORS[ball],
                color: ball === 'yellow' ? '#2d2d2d' : '#ffffff',
              }}
            >
              <span className="foul-ball-dot" />
              {getBallDisplayName(ball)} (+{BALL_VALUES[ball]})
            </button>
          ))}
        </div>

        <div className="foul-penalty-preview">
          Penalty: <span className="penalty-value">+{penalty} points</span> to opponent(s)
        </div>

        <div className="modal-actions">
          <button onClick={onCancel} className="btn btn-ghost">
            Cancel
          </button>
          <button onClick={() => onConfirm(selectedBall)} className="btn btn-danger btn-lg">
            Confirm Foul
          </button>
        </div>
      </div>
    </div>
  );
}
