/**
 * Audio Manager for Snooker Counter
 * Uses Web Audio API with OscillatorNode for zero-dependency sound effects
 *
 * Battery: a running AudioContext keeps the phone's audio hardware awake even
 * in silence. So the context is put on standby (suspend) after IDLE_MS with no
 * sound, and straight away when the app goes to the background. Every play
 * wakes it first (resume). Sounds are scheduled on the context's own clock,
 * which stands still while suspended, so a sound requested during wake-up
 * simply starts the moment the context is running again.
 */

/** Longest sound (victory fanfare) is under 2s; 10s leaves ample room. */
const IDLE_MS = 10_000;

class AudioManager {
  private context: AudioContext | null = null;
  private initialized = false;
  private _muted = false;
  private idleTimer: number | undefined;

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.standby();
      });
    }
  }

  get muted() {
    return this._muted;
  }

  /**
   * Initialize or resume AudioContext.
   * Must be called from a user gesture (tap/click) the first time.
   */
  async init(): Promise<void> {
    if (this.initialized && this.context) {
      // 'interrupted' is WebKit-only (calls, Siri, backgrounding) and not in the TS type.
      if ((this.context.state as string) !== 'running') {
        await this.context.resume();
      }
      this.armIdle();
      return;
    }

    try {
      this.context = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      if (this.context.state === 'suspended') {
        await this.context.resume();
      }
      this.initialized = true;
      this.armIdle();
    } catch (e) {
      console.warn('Web Audio API not available:', e);
    }
  }

  /**
   * Wake the context for a sound and restart the idle countdown.
   * Returns null when muted or not yet initialised (nothing should play).
   */
  private wake(): AudioContext | null {
    if (this._muted || !this.context) return null;
    if ((this.context.state as string) !== 'running') {
      this.context.resume().catch(() => {});
    }
    this.armIdle();
    return this.context;
  }

  private armIdle(): void {
    if (typeof window === 'undefined') return;
    window.clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => this.standby(), IDLE_MS);
  }

  /** Put the audio hardware to sleep; the next sound wakes it. */
  private standby(): void {
    if (typeof window !== 'undefined') window.clearTimeout(this.idleTimer);
    if (this.context && this.context.state === 'running') {
      this.context.suspend().catch(() => {});
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
   * Play a satisfying "pot" sound
   */
  playPot(): void {
    const ctx = this.wake();
    if (!ctx) return;
    const now = ctx.currentTime;

    const isLightMode = typeof document !== 'undefined' && document.body.classList.contains('light-theme');
    if (isLightMode) {
      // Brighter, glassier pastel chime-click
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1100, now);
      osc.frequency.exponentialRampToValueAtTime(700, now + 0.05);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.07);

      osc.start(now);
      osc.stop(now + 0.07);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1700, now + 0.01);
      osc2.frequency.exponentialRampToValueAtTime(1000, now + 0.06);

      gain2.gain.setValueAtTime(0.05, now + 0.01);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

      osc2.start(now + 0.01);
      osc2.stop(now + 0.06);
      return;
    }

    // Default Dark Mode Click
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
    const ctx = this.wake();
    if (!ctx) return;
    const now = ctx.currentTime;

    const isLightMode = typeof document !== 'undefined' && document.body.classList.contains('light-theme');
    if (isLightMode) {
      // Soft descending pastel double chime warning
      const playChime = (timeOffset: number, freq: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + timeOffset);
        gain.gain.setValueAtTime(0, now + timeOffset);
        gain.gain.linearRampToValueAtTime(0.12, now + timeOffset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, now + timeOffset + 0.18);

        osc.start(now + timeOffset);
        osc.stop(now + timeOffset + 0.18);
      };
      playChime(0, 392.00); // G4
      playChime(0.1, 311.13); // Eb4 (soothing, gentle warning)
      return;
    }

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
    const ctx = this.wake();
    if (!ctx) return;
    const now = ctx.currentTime;

    const isLightMode = typeof document !== 'undefined' && document.body.classList.contains('light-theme');
    if (isLightMode) {
      // Extended pentatonic soft arpeggio
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'triangle';
        osc.frequency.value = freq;

        const startTime = now + i * 0.1;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.12, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.22);

        osc.start(startTime);
        osc.stop(startTime + 0.22);
      });
      return;
    }

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
    const ctx = this.wake();
    if (!ctx) return;
    const now = ctx.currentTime;

    const isLightMode = typeof document !== 'undefined' && document.body.classList.contains('light-theme');
    if (isLightMode) {
      // Sparkling sweet pastel pentatonic victory fanfare
      const notes = [587.33, 659.25, 783.99, 880.00, 1174.66]; // D5, E5, G5, A5, D6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.value = freq;

        const startTime = now + i * 0.08;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.18, startTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.45);

        osc.start(startTime);
        osc.stop(startTime + 0.45);
      });
      return;
    }

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
    const ctx = this.wake();
    if (!ctx) return;
    const now = ctx.currentTime;

    const isLightMode = typeof document !== 'undefined' && document.body.classList.contains('light-theme');
    if (isLightMode) {
      // Extremely light high-frequency tick
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.value = 1800;

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);

      osc.start(now);
      osc.stop(now + 0.03);
      return;
    }

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
    const ctx = this.wake();
    if (!ctx) return;
    const now = ctx.currentTime;

    const isLightMode = typeof document !== 'undefined' && document.body.classList.contains('light-theme');
    if (isLightMode) {
      // Soft glassy descending whoosh
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.linearRampToValueAtTime(400, now + 0.18);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

      osc.start(now);
      osc.stop(now + 0.18);
      return;
    }

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
    const ctx = this.wake();
    if (!ctx) return;
    const now = ctx.currentTime;

    const isLightMode = typeof document !== 'undefined' && document.body.classList.contains('light-theme');
    if (isLightMode) {
      // Gentle soft water drop pop
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(380, now);
      osc.frequency.exponentialRampToValueAtTime(750, now + 0.05);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

      osc.start(now);
      osc.stop(now + 0.06);
      return;
    }

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
