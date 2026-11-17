// All sound is synthesised with WebAudio: no audio files, no network. The engine is
// a low oscillator whose pitch follows speed, the siren is a two-tone wail, gunshots
// and crashes are filtered noise bursts, and pickups and missions are short blips.
// Everything is a no-op until unlock() runs from a user gesture, and until then the
// game stays silent instead of throwing.
//
// Revision notes (this session): the siren now fades with distance (its third
// argument), traffic can honk with a new honk() blip, and the mute choice is kept in
// localStorage so it survives a reload.

const MUTE_KEY = 'solmar-bay.muted.v1';

function makeNoiseBuffer(context) {
  const length = context.sampleRate * 0.5;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export function createAudio() {
  let context = null;
  let master = null;
  let noise = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let muted = false;
  let unlocked = false;

  try {
    muted = window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    muted = false;
  }

  function ensure() {
    if (context) return true;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      noise = makeNoiseBuffer(context);
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  /** Short tone: frequency, seconds, wave type, volume. */
  function blip(freq, dur, type, volume, slideTo = 0) {
    if (!context || muted) return;
    try {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, context.currentTime);
      if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, context.currentTime + dur);
      gain.gain.setValueAtTime(volume, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(context.currentTime + dur);
    } catch {
      // A stray audio error never stops the game.
    }
  }

  /** Filtered noise burst: duration, filter frequency, volume. */
  function burst(dur, freq, volume) {
    if (!context || muted) return;
    try {
      const source = context.createBufferSource();
      source.buffer = noise;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq;
      const gain = context.createGain();
      gain.gain.setValueAtTime(volume, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + dur);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start();
      source.stop(context.currentTime + dur);
    } catch {
      // Ignore.
    }
  }

  return {
    /** Call from a key or pointer gesture; starts the context so sound can play. */
    unlock() {
      if (unlocked) return;
      unlocked = true;
      if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
    },
    /** Engine hum follows the player's car speed (0 = silent). */
    setEngine(speedRatio) {
      if (!context || muted) return;
      engineGain.gain.value = speedRatio * 0.10;
      engineOsc.frequency.value = 55 + speedRatio * 130;
    },
    /** Two-tone police wail; call every frame with wanted >= 1 and police near.
     * `distance` (px, optional) fades the wail: close police are loud, far ones faint. */
    siren(on, dt, distance = 0) {
      if (!context) return;
      if (!on || muted) {
        sirenGain.gain.value = 0;
        return;
      }
      sirenTimer += dt;
      const up = Math.floor(sirenTimer / 0.45) % 2 === 0;
      sirenOsc.frequency.value = up ? 720 : 540;
      const fade = Math.max(0.25, 1 - distance / 1400);
      sirenGain.gain.value = 0.045 * fade;
    },
    /** A short traffic horn: two quick square blips. */
    honk() { blip(340, 0.09, 'square', 0.12); setTimeout(() => blip(340, 0.12, 'square', 0.12), 110); },
    shoot() { blip(220, 0.12, 'square', 0.22, 60); burst(0.09, 2400, 0.25); },
    punch() { burst(0.08, 500, 0.3); blip(90, 0.08, 'sine', 0.25, 50); },
    crash() { burst(0.25, 900, 0.4); },
    pickup() { blip(660, 0.09, 'sine', 0.25); blip(990, 0.12, 'sine', 0.2); },
    coin() { blip(880, 0.07, 'triangle', 0.22); blip(1320, 0.1, 'triangle', 0.18); },
    denied() { blip(160, 0.15, 'square', 0.18, 110); },
    missionStart() { blip(523, 0.12, 'triangle', 0.22); blip(659, 0.12, 'triangle', 0.22); },
    missionDone() {
      blip(523, 0.12, 'triangle', 0.25);
      setTimeout(() => blip(659, 0.12, 'triangle', 0.25), 110);
      setTimeout(() => blip(784, 0.2, 'triangle', 0.25), 220);
    },
    click() { blip(440, 0.05, 'sine', 0.15); },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
      try {
        window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
      } catch {
        // Mute still applies for this visit when storage is off.
      }
    },
    isMuted() { return muted; },
  };
}
