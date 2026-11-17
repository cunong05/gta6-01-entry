// Solmar Bay — synthesised sound. Every effect is built with WebAudio
// oscillators and filtered noise, so the game ships no audio files at all.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = null;
    this.noiseBuffer = null;
  }

  // Browsers only allow audio after a user gesture; call from the first click/key.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    // A shared white-noise buffer for gunshots, crashes and skids.
    const length = this.ctx.sampleRate;
    this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  // A short tone: frequency slides from `from` to `to` over `duration` seconds.
  blip(from, to, duration, type = 'sine', volume = 0.25, when = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, from), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + duration);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  // A burst of filtered noise.
  noise(duration, volume, filterFreq = 1200, type = 'lowpass', when = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  click() {
    this.blip(700, 500, 0.06, 'square', 0.12);
  }

  pickup() {
    this.blip(520, 520, 0.07, 'sine', 0.22);
    this.blip(780, 780, 0.09, 'sine', 0.22, 0.07);
    this.blip(1040, 1040, 0.12, 'sine', 0.2, 0.14);
  }

  cash() {
    this.blip(880, 880, 0.08, 'triangle', 0.22);
    this.blip(1174, 1174, 0.14, 'triangle', 0.22, 0.08);
  }

  gunshot() {
    this.noise(0.14, 0.5, 2800, 'highpass');
    this.blip(160, 60, 0.12, 'square', 0.3);
  }

  enemyShot() {
    this.noise(0.11, 0.28, 2000, 'highpass');
    this.blip(140, 70, 0.1, 'square', 0.18);
  }

  punch() {
    this.noise(0.08, 0.35, 300, 'lowpass');
    this.blip(120, 70, 0.09, 'sine', 0.3);
  }

  crash() {
    this.noise(0.3, 0.5, 500, 'lowpass');
    this.blip(90, 40, 0.25, 'sawtooth', 0.25);
  }

  skid() {
    this.noise(0.18, 0.12, 900, 'bandpass');
  }

  sirenStart() {
    if (!this.ctx || this.sirenOsc) return;
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'sine';
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0.0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    let high = true;
    this.sirenTimer = window.setInterval(() => {
      if (!this.sirenOsc) return;
      high = !high;
      this.sirenOsc.frequency.setTargetAtTime(high ? 880 : 660, this.ctx.currentTime, 0.05);
    }, 320);
    this.sirenGain.gain.setTargetAtTime(0.05, this.ctx.currentTime, 0.4);
  }

  sirenStop() {
    if (this.sirenTimer) window.clearInterval(this.sirenTimer);
    this.sirenTimer = null;
    if (this.sirenOsc) {
      try {
        this.sirenOsc.stop();
      } catch {
        /* already stopped */
      }
      this.sirenOsc = null;
    }
    this.sirenGain = null;
  }

  // Continuous engine hum while driving; call every frame with speed 0..1.
  engine(speed01, on) {
    if (!this.ctx) return;
    if (!on || speed01 <= 0.02) {
      if (this.engineOsc) {
        this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
        const osc = this.engineOsc;
        window.setTimeout(() => {
          try {
            osc.stop();
          } catch {
            /* already stopped */
          }
        }, 400);
        this.engineOsc = null;
        this.engineGain = null;
      }
      return;
    }
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 700;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    const freq = 55 + speed01 * 130;
    this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.06);
    this.engineGain.gain.setTargetAtTime(0.03 + speed01 * 0.05, this.ctx.currentTime, 0.1);
  }

  missionComplete() {
    this.blip(523, 523, 0.12, 'triangle', 0.25);
    this.blip(659, 659, 0.12, 'triangle', 0.25, 0.12);
    this.blip(784, 784, 0.2, 'triangle', 0.25, 0.24);
  }

  busted() {
    this.blip(392, 392, 0.2, 'sawtooth', 0.2);
    this.blip(311, 311, 0.3, 'sawtooth', 0.2, 0.2);
  }
}
