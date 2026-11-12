// Tiny synthesised sound effects (no audio files). Off until the first click, as browsers require.

const KEY = 'hashforge-sound';
let ctx = null;
let enabled = (() => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } })();

export const soundOn = () => enabled;
export function setSound(on) {
  enabled = on;
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* storage unavailable */ }
}

function audio() {
  if (!enabled) return null;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch { return null; }
}

function tone(freq, start, dur, { type = 'sine', vol = 0.08, slide = 0 } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + start;
  const osc = a.createOscillator(); const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t); osc.stop(t + dur + 0.02);
}

export const sfx = {
  click: () => tone(660, 0, 0.05, { type: 'triangle', vol: 0.03 }),
  coin: () => { tone(988, 0, 0.08, { type: 'square', vol: 0.035 }); tone(1319, 0.07, 0.18, { type: 'square', vol: 0.035 }); },
  buy: () => { tone(523, 0, 0.07, { type: 'triangle', vol: 0.05 }); tone(784, 0.06, 0.12, { type: 'triangle', vol: 0.05 }); },
  bad: () => { tone(220, 0, 0.18, { type: 'sawtooth', vol: 0.04, slide: 0.7 }); },
  alert: () => { tone(880, 0, 0.1, { type: 'sine', vol: 0.06 }); tone(1175, 0.12, 0.16, { type: 'sine', vol: 0.06 }); },
  badge: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.07, 0.22, { type: 'triangle', vol: 0.05 })),
  level: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.09, 0.35, { type: 'square', vol: 0.035 })),
};
