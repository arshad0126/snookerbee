import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GameSetupConfig, GameMode } from '../engine/types';
import { useTheme } from '../hooks/useTheme';

export default function GameSetup() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
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
                            maxLength={20}
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
                            maxLength={20}
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
                        maxLength={20}
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
            <h3 className="setup-step-title">Set Rotation Order</h3>
            <p className="setup-step-subtitle">Order of turns from first shot to last.</p>
            <div className="breaking-order-grid">
              {playerNames.map((name, idx) => (
                <div
                  key={idx}
                  className={`breaking-option-row ${breakingPlayerIndex === idx ? 'selected' : ''}`}
                >
                  {/* Turn order in team mode is fixed by team interleaving, so
                      reordering is only offered for 1v1 / free-for-all. */}
                  {gameMode !== 'team' && (
                    <div className="rotation-controls">
                      <button
                        onClick={() => movePlayer(idx, 'up')}
                        disabled={idx === 0}
                        className="rotation-arrow-btn"
                        title="Move Up"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => movePlayer(idx, 'down')}
                        disabled={idx === playerNames.length - 1}
                        className="rotation-arrow-btn"
                        title="Move Down"
                      >
                        ▼
                      </button>
                    </div>
                  )}
                  <span className="breaking-option-name">
                    {idx + 1}. {name}
                    {gameMode === 'team' && (
                      <span style={{ color: 'var(--text-muted)' }}> · Team {idx % 2 === 0 ? 'A' : 'B'}</span>
                    )}
                  </span>
                  {breakingPlayerIndex === idx && (
                    <span className="breaking-option-badge">Breaks Off</span>
                  )}
                  <button
                    onClick={() => setBreakingPlayerIndex(idx)}
                    className={`btn-breaker ${breakingPlayerIndex === idx ? 'active' : ''}`}
                  >
                    {breakingPlayerIndex === idx ? 'Breaker' : 'Breaker'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const movePlayer = (index: number, direction: 'up' | 'down') => {
    const newNames = [...playerNames];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newNames.length) return;
    
    // Swap names
    const temp = newNames[index];
    newNames[index] = newNames[targetIndex];
    newNames[targetIndex] = temp;
    setPlayerNames(newNames);

    // Sync breaking player index
    if (breakingPlayerIndex === index) {
      setBreakingPlayerIndex(targetIndex);
    } else if (breakingPlayerIndex === targetIndex) {
      setBreakingPlayerIndex(index);
    }
  };

  const isNextDisabled = () => {
    if (currentStep === 4) {
      return playerNames.some(name => !name.trim());
    }
    return false;
  };

  return (
    <div className="setup-page page page-centered">
      <button onClick={toggleTheme} className="theme-toggle-floating" aria-label="Toggle theme">
        {theme === 'dark' ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        )}
      </button>
      <div className="setup-card">
        <header className="setup-card-header">
          <h2 className="setup-card-title">Match Configuration</h2>
          <span className="setup-step-badge">Step {currentStep} of 5</span>
        </header>

        <main key={currentStep} className="setup-card-content fadeInUp">
          {renderStepContent()}
        </main>

        <footer className="setup-card-footer">
          <button onClick={prevStep} className="btn btn-setup-back">
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </button>
          <button
            onClick={nextStep}
            disabled={isNextDisabled()}
            className="btn btn-setup-next"
          >
            {currentStep === 5 ? 'Start Match' : 'Next Step'}
          </button>
        </footer>
      </div>
    </div>
  );
}

