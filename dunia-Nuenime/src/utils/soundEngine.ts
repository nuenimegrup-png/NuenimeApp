import { CityId } from '../types/nuenime';

/**
 * Engine Audio Fantasi RPG berbasis Web Audio API murni (tanpa file eksternal berat).
 * Menghasilkan efek suara interaksi kristal/metalik, pertempuran Bos Kota,
 * peluncuran kapal udara, serta ambient harmoni sesuai elemen 7 kota Nuenime.
 */
class FantasySoundEngine {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  private ambientInterval: number | null = null;
  private currentTheme: CityId | 'world' = 'world';

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.stopAmbient();
    } else {
      this.playButtonClick();
      this.startAmbient(this.currentTheme);
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume: number = 0.08,
    delay: number = 0,
    endFreq?: number
  ) {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (endFreq) {
        osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
      }

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(volume, now + Math.min(0.03, duration * 0.25));
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch {
      // Ignore audio context autoplay errors
    }
  }

  /** Suara ketukan tombol UI RPG yang lembut */
  public playButtonClick() {
    this.playTone(587.33, 0.09, 'triangle', 0.055, 0, 783.99);
  }

  public playTap() {
    this.playButtonClick();
  }

  /** Suara kristal saat memilih Marker Kota atau Markas Klan */
  public playMarkerSelect() {
    this.playTone(523.25, 0.18, 'sine', 0.065, 0);
    this.playTone(659.25, 0.22, 'triangle', 0.055, 0.05);
    this.playTone(1046.5, 0.32, 'sine', 0.05, 0.1);
  }

  /** Suara peluncuran Kapal Udara / Rute Ekspedisi Antar Kota */
  public playAirshipLaunch() {
    this.playTone(220, 0.35, 'sine', 0.07, 0, 440);
    this.playTone(329.63, 0.4, 'triangle', 0.055, 0.08, 659.25);
    this.playTone(880, 0.45, 'sine', 0.04, 0.16);
  }

  public playRouteDepart() {
    this.playAirshipLaunch();
  }

  /** Suara serangan ke Bos Kota */
  public playBossAttack() {
    this.playTone(180, 0.16, 'sawtooth', 0.075, 0, 75);
    this.playTone(440, 0.14, 'triangle', 0.065, 0.03, 880);
    this.playTone(659.25, 0.22, 'sine', 0.05, 0.07);
  }

  public playBossStrike() {
    this.playBossAttack();
  }

  /** Suara klaim Misi Klan / Kemenangan / Gabung Klan */
  public playQuestComplete() {
    this.playTone(523.25, 0.16, 'triangle', 0.065, 0);
    this.playTone(659.25, 0.18, 'triangle', 0.065, 0.08);
    this.playTone(783.99, 0.22, 'triangle', 0.065, 0.16);
    this.playTone(1046.5, 0.45, 'sine', 0.075, 0.24);
  }

  public playClanJoinFanfare() {
    this.playQuestComplete();
  }

  /** Suara penguatan Distrik Kota atau Upgrade Artefak */
  public playConquestPulse() {
    this.playTone(392.0, 0.18, 'triangle', 0.065, 0);
    this.playTone(587.33, 0.25, 'sine', 0.065, 0.07);
    this.playTone(783.99, 0.35, 'sine', 0.06, 0.14);
  }

  /** Ambient harmonik lembut sesuai tema kota yang sedang dijelajahi */
  public startAmbient(theme: CityId | 'world') {
    this.currentTheme = theme;
    this.stopAmbient();
    if (!this.enabled || typeof window === 'undefined') return;

    const scales: Record<CityId | 'world', number[]> = {
      world: [261.63, 329.63, 392.0, 493.88, 523.25],
      aetheria: [523.25, 659.25, 783.99, 987.77, 1046.5],
      lunaris: [293.66, 369.99, 440.0, 554.37, 587.33],
      velmora: [329.63, 392.0, 493.88, 587.33, 659.25],
      eldoria: [261.63, 329.63, 392.0, 523.25, 659.25],
      drakonia: [146.83, 220.0, 293.66, 349.23, 440.0],
      nivara: [293.66, 311.13, 369.99, 440.0, 587.33],
      astralis: [440.0, 554.37, 659.25, 830.61, 880.0],
    };

    const playAmbientNote = () => {
      if (!this.enabled) return;
      const notes = scales[this.currentTheme] || scales.world;
      const n1 = notes[Math.floor(Math.random() * notes.length)];
      const n2 = notes[Math.floor(Math.random() * notes.length)];
      this.playTone(n1, 1.8, 'sine', 0.018, 0);
      if (n2 !== n1) {
        this.playTone(n2, 1.6, 'triangle', 0.012, 0.35);
      }
    };

    playAmbientNote();
    this.ambientInterval = window.setInterval(playAmbientNote, 4500);
  }

  public setAmbientCity(theme: CityId | 'world') {
    this.startAmbient(theme);
  }

  public stopAmbient() {
    if (this.ambientInterval !== null) {
      clearInterval(this.ambientInterval);
      this.ambientInterval = null;
    }
  }
}

export const fantasySoundEngine = new FantasySoundEngine();
