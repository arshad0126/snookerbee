import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GameSetupConfig, GameMode } from '../engine/types';

export default function GameSetup() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [gameMode, setGameMode] = useState<GameMode>('1v1');
  const [teamSize, setTeamSize] = useState<2 | 3>(2); // for teams mode
  const [redsCount, setRedsCount] = useState<10 | 15>(15);
  const [bestOf, setBestOf] = useState<number>(3);
  const [playerNames, setPlayerNames] = useState<string[]>(['Player 1', 'Player 2']);
  const [breakingPlayerIndex, setBreakingPlayerIndex] = useState<number>(0);

  // Helper to sync player names array size when mode/teamSize changes
  const handleModeChange = (mode: GameMode, size: 2 | 3 = 2) => {
    setGameMode(mode);
    setTeamSize(size);
    let count = 2;
    if (mode === 'team') {
      count = size * 2;
    } else if (mode === 'freeForAll') {
      count = 3; // default for freeForAll
    }
    const newNames = Array.from({ length: count }, (_, i) => `Player ${i + 1}`);
    setPlayerNames(newNames);
    setBreakingPlayerIndex(0);
  };

  const handleTeamSizeChange = (size: 2 | 3) => {
    setTeamSize(size);
    const count = size * 2;
    const newNames = Array.from({ length: count }, (_, i) => `Player ${i + 1}`);
    setPlayerNames(newNames);
    setBreakingPlayerIndex(0);
  };

  const handleNameChange = (index: number, val: string) => {
    const updated = [...playerNames];
    updated[index] = val;
    setPlayerNames(updated);
  };

  const addFfaPlayer = () => {
    if (playerNames.length >= 8) return;
    const count = playerNames.length + 1;
    setPlayerNames([...playerNames, `Player ${count}`]);
  };

  const removeFfaPlayer = () => {
    if (playerNames.length <= 2) return;
    setPlayerNames(playerNames.slice(0, -1));
    if (breakingPlayerIndex >= playerNames.length - 1) {
      setBreakingPlayerIndex(0);
    }
  };

  const nextStep = () => {
    if (currentStep < 5) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Finalize and start match
      const config: GameSetupConfig = {
        mode: gameMode,
        redsCount,
        bestOf,
        players: playerNames.map(name => ({ name: name.trim() || 'Unnamed Player' })),
        breakingPlayerIndex,
      };

      if (gameMode === 'team') {
        if (teamSize === 2) {
          config.teamAssignments = {
            0: [0, 2], // Team A
            1: [1, 3], // Team B
          };
        } else {
          config.teamAssignments = {
            0: [0, 2, 4], // Team A
            1: [1, 3, 5], // Team B
          };
        }
      }

      navigate('/play', { state: { config } });
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    } else {
      navigate('/dashboard');
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="setup-step-container">
            <h3 className="setup-step-title">Select Game Mode</h3>
            <p className="setup-step-subtitle">How do you want to play?</p>
            <div className="setup-options">
              <div
                onClick={() => handleModeChange('1v1')}
                className={`setup-option ${gameMode === '1v1' ? 'selected' : ''}`}
              >
                <div className="setup-option-icon">🏓</div>
                <div>
                  <div className="setup-option-title">1 v 1</div>
                  <div className="setup-option-desc">Classic head-to-head match</div>
                </div>
              </div>

              <div
                onClick={() => handleModeChange('team', 2)}
                className={`setup-option ${gameMode === 'team' ? 'selected' : ''}`}
              >
                <div className="setup-option-icon">👥</div>
                <div>
                  <div className="setup-option-title">Teams</div>
                  <div className="setup-option-desc">2v2 or 3v3 team play</div>
                </div>
              </div>

              {gameMode === 'team' && (
                <div className="toggle-group" style={{ marginTop: 'var(--space-xs)' }}>
                  <div
                    onClick={() => handleTeamSizeChange(2)}
                    className={`toggle-option ${teamSize === 2 ? 'active' : ''}`}
                  >
                    2 vs 2
                  </div>
                  <div
                    onClick={() => handleTeamSizeChange(3)}
                    className={`toggle-option ${teamSize === 3 ? 'active' : ''}`}
                  >
                    3 vs 3
                  </div>
                </div>
              )}

              <div
                onClick={() => handleModeChange('freeForAll')}
                className={`setup-option ${gameMode === 'freeForAll' ? 'selected' : ''}`}
              >
                <div className="setup-option-icon">🎯</div>
                <div>
                  <div className="setup-option-title">Free for All</div>
                  <div className="setup-option-desc">2-8 players, solo scoring</div>
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="setup-step-container">
            <h3 className="setup-step-title">Choose Reds</h3>
            <p className="setup-step-subtitle">Select the number of red balls on the table.</p>
            <div className="toggle-group-large">
              <div
                onClick={() => setRedsCount(10)}
                className={`toggle-option-large ${redsCount === 10 ? 'active' : ''}`}
              >
                <div className="toggle-value">10 Reds</div>
                <div className="toggle-subtitle">Max break: 107</div>
              </div>
              <div
                onClick={() => setRedsCount(15)}
                className={`toggle-option-large ${redsCount === 15 ? 'active' : ''}`}
              >
                <div className="toggle-value">15 Reds</div>
                <div className="toggle-subtitle">Max break: 147 (Standard)</div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="setup-step-container">
            <h3 className="setup-step-title">Match Length</h3>
            <p className="setup-step-subtitle">Best-of frames to determine the winner.</p>
            <div className="setup-options-row">
              {[1, 3, 5, 7].map(num => (
                <div
                  key={num}
                  onClick={() => setBestOf(num)}
                  className={`setup-option-card ${bestOf === num ? 'selected' : ''}`}
                >
                  <span className="option-card-number">{num}</span>
                  <span className="option-card-label">{num === 1 ? 'Frame' : 'Frames'}</span>
                </div>
              ))}
            </div>
            <div className="setup-first-to-label">
              First to {Math.ceil((bestOf + 1) / 2)} wins the match
            </div>
          </div>
        );

      case 4:
        return (
          <div className="setup-step-container">
            <h3 className="setup-step-title">Player Names</h3>
            <p className="setup-step-subtitle">Enter names for the players.</p>

            <div className="setup-players-grid">
              {gameMode === 'team' ? (
                <>
                  <div className="team-group">
                    <h4 className="team-group-title">Team A</h4>
                    {Array.from({ length: teamSize }).map((_, idx) => {
                      const pIdx = idx * 2; // 0, 2, 4
                      return (
                        <div key={pIdx} className="setup-player-input-wrapper">
                          <span className="setup-player-number">A{idx + 1}</span>
                          <input
                            type="text"
                            value={playerNames[pIdx] || ''}
                            onChange={(e) => handleNameChange(pIdx, e.target.value)}
                            className="input"
                            placeholder={`Team A Player ${idx + 1}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="team-group">
                    <h4 className="team-group-title">Team B</h4>
                    {Array.from({ length: teamSize }).map((_, idx) => {
                      const pIdx = idx * 2 + 1; // 1, 3, 5
                      return (
                        <div key={pIdx} className="setup-player-input-wrapper">
                          <span className="setup-player-number text-lavender">B{idx + 1}</span>
                          <input
                            type="text"
                            value={playerNames[pIdx] || ''}
                            onChange={(e) => handleNameChange(pIdx, e.target.value)}
                            className="input"
                            placeholder={`Team B Player ${idx + 1}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  {playerNames.map((name, idx) => (
                    <div key={idx} className="setup-player-input-wrapper">
                      <span className="setup-player-number">{idx + 1}</span>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => handleNameChange(idx, e.target.value)}
                        className="input"
                        placeholder={`Player ${idx + 1}`}
                      />
                    </div>
                  ))}

                  {gameMode === 'freeForAll' && (
                    <div className="setup-ffa-actions" style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
                      <button
                        onClick={removeFfaPlayer}
                        disabled={playerNames.length <= 2}
                        className="btn btn-secondary"
                        style={{ flex: 1 }}
                      >
                        − Remove Player
                      </button>
                      <button
                        onClick={addFfaPlayer}
                        disabled={playerNames.length >= 8}
                        className="btn btn-secondary"
                        style={{ flex: 1 }}
                      >
                        + Add Player
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="setup-step-container">
            <h3 className="setup-step-title">Breaking Order</h3>
            <p className="setup-step-subtitle">Who will take the opening shot?</p>
            <div className="breaking-order-grid">
              {playerNames.map((name, idx) => (
                <div
                  key={idx}
                  onClick={() => setBreakingPlayerIndex(idx)}
                  className={`breaking-option ${breakingPlayerIndex === idx ? 'selected' : ''}`}
                >
                  <span className="breaking-option-name">{name}</span>
                  {breakingPlayerIndex === idx && (
                    <span className="breaking-option-badge">Breaks First</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const isNextDisabled = () => {
    if (currentStep === 4) {
      return playerNames.some(name => !name.trim());
    }
    return false;
  };

  return (
    <div className="setup-page page">
      <header className="setup-header">
        <button onClick={prevStep} className="setup-back-btn">
          ←
        </button>
        <div className="stepper">
          {[1, 2, 3, 4, 5].map(step => (
            <div
              key={step}
              className={`stepper-dot ${step === currentStep ? 'active' : ''} ${
                step < currentStep ? 'completed' : ''
              }`}
            />
          ))}
        </div>
      </header>

      <main key={currentStep} className="setup-content fadeInUp">
        {renderStepContent()}
      </main>

      <footer className="setup-footer">
        <button
          onClick={nextStep}
          disabled={isNextDisabled()}
          className="btn btn-primary btn-lg"
          style={{ width: '100%' }}
        >
          {currentStep === 5 ? 'Start Match 🎱' : 'Next'}
        </button>
      </footer>
    </div>
  );
}
