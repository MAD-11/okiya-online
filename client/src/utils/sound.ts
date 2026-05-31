let audioCtx: AudioContext | null = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

export function initAudio() {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume().catch(e => console.warn('AudioContext resume failed', e));
  }
}

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3) {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = frequency;
    osc.type = type;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}

export function playMoveSound() {
  playTone(800, 0.1, 'sine', 0.3);
}

export function playWinSound() {
  playTone(523.25, 0.3, 'triangle', 0.3);
  setTimeout(() => playTone(659.25, 0.3, 'triangle', 0.3), 150);
  setTimeout(() => playTone(783.99, 0.3, 'triangle', 0.3), 300);
}

export function playLoseSound() {
  playTone(300, 0.4, 'sawtooth', 0.2);
}

export function playDrawSound() {
  playTone(440, 0.2, 'square', 0.15);
}

export function playJoinSound() {
  playTone(880, 0.2, 'sine', 0.2);
}