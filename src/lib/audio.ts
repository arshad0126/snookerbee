/**
 * Audio Manager for Snooker Counter
 * Uses Web Audio API with OscillatorNode for zero-dependency sound effects
 */

class AudioManager {
  private context: AudioContext | null = null;
  private initialized = false;
  private _muted = false;

  get muted() {
    return this._muted;
  }

  /**
   * Initialize or resume AudioContext.
   * Must be called from a user gesture (tap/click) the first time.
   */
  async init(): Promise<void> {
    if (this.initialized && this.context) {
      if (this.context.state === 'suspended') {
        await this.context.resume();
      }
      return;
    }

    try {
      this.context = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      if (this.context.state === 'suspended') {
        await this.context.resume();
      }
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio API not available:', e);
    }
  }

  /**
   * Toggle mute
   */
  toggleMute(): boolean {
    this._muted = !this._muted;
    return this._muted;
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
  }

  /**
   * Play a satisfying "pot" sound — short click with descending pitch
   */
  playPot(): void {
    if (this._muted || !this.context) return;

    const ctx = this.context;
    const now = ctx.currentTime;

    // Main click
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.08);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.start(now);
    osc.stop(now + 0.12);

    // Subtle secondary tone
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1200, now + 0.02);
    osc2.frequency.exponentialRampToValueAtTime(600, now + 0.1);

    gain2.gain.setValueAtTime(0.08, now + 0.02);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    osc2.start(now + 0.02);
    osc2.stop(now + 0.1);
  }

  /**
   * Play a foul/warning buzz
   */
  playFoul(): void {
    if (this._muted || !this.context) return;

    const ctx = this.context;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.setValueAtTime(180, now + 0.1);
    osc.frequency.setValueAtTime(200, now + 0.2);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  /**
   * Play an ascending chime for break milestones
   */
  playBreakMilestone(): void {
    if (this._muted || !this.context) return;

    const ctx = this.context;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.value = freq;

      const startTime = now + i * 0.12;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

      osc.start(startTime);
      osc.stop(startTime + 0.3);
    });
  }

  /**
   * Play a victory fanfare for frame/match wins
   */
  playVictory(): void {
    if (this._muted || !this.context) return;

    const ctx = this.context;
    const now = ctx.currentTime;
    // C5, E5, G5, C6
    const notes = [523.25, 659.25, 783.99, 1046.5];

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.value = freq;

      const startTime = now + i * 0.15;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.25, startTime + 0.04);
      gain.gain.setValueAtTime(0.25, startTime + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);

      osc.start(startTime);
      osc.stop(startTime + 0.5);
    });
  }

  /**
   * Play a subtle button tap sound
   */
  playTap(): void {
    if (this._muted || !this.context) return;

    const ctx = this.context;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.value = 1000;

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * Play undo sound — descending notes
   */
  playUndo(): void {
    if (this._muted || !this.context) return;

    const ctx = this.context;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.15);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  /**
   * Play miss sound — soft thud
   */
  playMiss(): void {
    if (this._muted || !this.context) return;

    const ctx = this.context;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.15);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.start(now);
    osc.stop(now + 0.2);
  }
}

// Singleton instance
export const audio = new AudioManager();
