import { useState, useEffect } from 'react';
import type { BallType, GameState } from '../engine/types';
import { calculateFoulPenalty } from '../engine/validators';

interface FoulDialogProps {
  isOpen: boolean;
  isInOff: boolean;
  gameState: GameState;
  onConfirm: (ball: BallType, customPenalty: number, redPottedOnFoul: boolean) => void;
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
  const [customPenalty, setCustomPenalty] = useState<number>(4);
  const [redPottedOnFoul, setRedPottedOnFoul] = useState<boolean>(false);

  // Sync states when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedBall('red');
      const std = calculateFoulPenalty(gameState, 'red');
      setCustomPenalty(std);
      setRedPottedOnFoul(isInOff); // auto-check if In-Off is clicked
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isInOff]);

  if (!isOpen) return null;

  const balls: BallType[] = ['red', 'yellow', 'green', 'brown', 'blue', 'pink', 'black'];
  const penaltyValues = [4, 5, 6, 7];

  const handleSelectBall = (ball: BallType) => {
    setSelectedBall(ball);
    const standardPenalty = calculateFoulPenalty(gameState, ball);
    setCustomPenalty(standardPenalty);
  };

  const getBallLabel = (ball: BallType) => {
    switch (ball) {
      case 'red': return 'RED';
      case 'yellow': return 'YEL';
      case 'green': return 'GRN';
      case 'brown': return 'BRN';
      case 'blue': return 'BLU';
      case 'pink': return 'PNK';
      case 'black': return 'BLK';
    }
  };

  return (
    <div className="modal-backdrop modal-centered" onClick={onCancel}>
      <div className="foul-dialog-card" onClick={e => e.stopPropagation()}>
        <header className="foul-dialog-header">
          <h3 className="foul-dialog-title">Record Foul Shot</h3>
          <button className="foul-dialog-close-btn" onClick={onCancel}>
            ✕
          </button>
        </header>

        <div className="foul-dialog-content">
          <div className="foul-dialog-section">
            <h4 className="foul-dialog-section-label">FOUL BALL INVOLVED</h4>
            <div className="foul-balls-row">
              {balls.map(ball => {
                const stdPenalty = calculateFoulPenalty(gameState, ball);
                const isSelected = selectedBall === ball;
                return (
                  <button
                    key={ball}
                    type="button"
                    onClick={() => handleSelectBall(ball)}
                    className={`foul-ball-btn ball-${ball} ${isSelected ? 'selected' : ''}`}
                  >
                    <span className="ball-btn-name">{getBallLabel(ball)}</span>
                    <span className="ball-btn-points">+{stdPenalty}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="foul-dialog-section">
            <h4 className="foul-dialog-section-label">CUSTOM PENALTY VALUE</h4>
            <div className="foul-penalties-row">
              {penaltyValues.map(val => {
                const isSelected = customPenalty === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setCustomPenalty(val)}
                    className={`foul-penalty-btn ${isSelected ? 'selected' : ''}`}
                  >
                    {val} pts
                  </button>
                );
              })}
            </div>
          </div>

          <div className="foul-dialog-section">
            <label className="foul-checkbox-label">
              <input
                type="checkbox"
                checked={redPottedOnFoul}
                onChange={e => setRedPottedOnFoul(e.target.checked)}
                className="foul-checkbox"
              />
              <span className="foul-checkbox-text">
                A Red ball was pocketed (in-off / potted on foul)
              </span>
            </label>
          </div>
        </div>

        <footer className="foul-dialog-footer">
          <button onClick={onCancel} className="btn-foul-cancel">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selectedBall, customPenalty, redPottedOnFoul)}
            className="btn-foul-confirm"
          >
            ⚠️ Confirm Foul
          </button>
        </footer>
      </div>
    </div>
  );
}
