/**
 * AXIOM // 2D Procedural Web Audio Synthesis Engine
 * Synthesizes dynamic marimba/glass collisions and sub-bass explosion thumps.
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.unlocked = false;

    // Rate-limiting: Max 12 collision voices per second (~83ms interval)
    this.lastCollisionTime = 0;
    this.minCollisionInterval = 83; // ms

    this._setupUnlockListeners();
  }

  /**
   * Automatically unlocks AudioContext on first user pointer or keyboard interaction.
   */
  _setupUnlockListeners() {
    if (typeof window === 'undefined') return;

    const unlock = () => {
      this.initContext();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };

    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }

  initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.unlocked = true;
  }

  setEnabled(val) {
    this.enabled = Boolean(val);
    if (this.enabled) {
      this.initContext();
    }
  }

  toggleEnabled() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  /**
   * Synthesizes a decaying sine+triangle marimba/glass tone on collision.
   * Frequency: 180Hz to 880Hz (inversely proportional to body area)
   * Gain: Scaled to impact speed
   * Rate-limited to max 12 voices/sec to prevent clipping during pileups.
   *
   * @param {Object} bodyA
   * @param {Object} bodyB
   * @param {number} impactSpeed
   */
  playCollision(bodyA, bodyB, impactSpeed = 4) {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    const now = performance.now();
    if (now - this.lastCollisionTime < this.minCollisionInterval) {
      return; // Rate limit reached
    }
    this.lastCollisionTime = now;

    const t = this.ctx.currentTime;

    // Estimate body area
    const areaA = bodyA.area || (bodyA.circleRadius ? Math.PI * bodyA.circleRadius * bodyA.circleRadius : 1200);
    const areaB = bodyB.area || (bodyB.circleRadius ? Math.PI * bodyB.circleRadius * bodyB.circleRadius : 1200);
    const avgArea = (areaA + areaB) / 2;

    // Inversely proportional: Larger bodies = 180Hz, smaller bodies = 880Hz
    // Typical area range: ~600px to ~3000px
    const norm = Math.max(0, Math.min(1, (avgArea - 600) / 2400));
    const baseFreq = 880 - norm * 700; // 180Hz to 880Hz

    // Gain scaled to impact speed (clamped 0.03 to 0.22)
    const gainVal = Math.max(0.03, Math.min(0.22, (impactSpeed || 3) * 0.02));

    // Master collision gain node
    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.001, t);
    gainNode.gain.linearRampToValueAtTime(gainVal, t + 0.004);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);

    // Filter to add glass/metallic resonance
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(baseFreq * 3.5, t);

    // Oscillator 1: Fundamental Sine wave
    const oscSine = this.ctx.createOscillator();
    oscSine.type = 'sine';
    oscSine.frequency.setValueAtTime(baseFreq, t);

    // Oscillator 2: Overtone Triangle wave (marimba / glass harmonics)
    const oscTri = this.ctx.createOscillator();
    oscTri.type = 'triangle';
    oscTri.frequency.setValueAtTime(baseFreq * 2.01, t);

    const triGain = this.ctx.createGain();
    triGain.gain.setValueAtTime(0.4, t);

    oscSine.connect(gainNode);
    oscTri.connect(triGain);
    triGain.connect(gainNode);

    gainNode.connect(filter);
    filter.connect(this.ctx.destination);

    oscSine.start(t);
    oscTri.start(t);
    oscSine.stop(t + 0.18);
    oscTri.stop(t + 0.18);
  }

  /**
   * Synthesizes a 90Hz -> 30Hz pitch-drop sub-bass thump plus filtered white-noise burst.
   */
  playExplosion() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // 1. Sub-Bass Thump (90Hz -> 30Hz pitch drop)
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(90, t);
    subOsc.frequency.exponentialRampToValueAtTime(30, t + 0.35);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.001, t);
    subGain.gain.linearRampToValueAtTime(0.4, t + 0.008);
    subGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);

    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);

    subOsc.start(t);
    subOsc.stop(t + 0.46);

    // 2. Filtered White-Noise Burst
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.3);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(750, t);
    noiseFilter.frequency.exponentialRampToValueAtTime(120, t + 0.28);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, t);
    noiseGain.gain.linearRampToValueAtTime(0.3, t + 0.006);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);

    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    whiteNoise.start(t);
    whiteNoise.stop(t + 0.32);
  }
}

export const soundEngine = new SoundEngine();
