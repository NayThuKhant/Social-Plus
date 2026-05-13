let audioCtx: AudioContext | null = null;
let ringTimer: ReturnType<typeof setTimeout> | null = null;
let ringing = false;
// Track all active oscillators so stopRing() can cancel them immediately
const activeOscillators: OscillatorNode[] = [];

function ctx() {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function tone(freq: number, startTime: number, duration: number, volume = 0.35) {
  const c = ctx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.frequency.value = freq;
  osc.type = "sine";
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
  gain.gain.setValueAtTime(volume, startTime + duration - 0.05);
  gain.gain.linearRampToValueAtTime(0, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration);
  activeOscillators.push(osc);
  osc.onended = () => {
    const idx = activeOscillators.indexOf(osc);
    if (idx !== -1) activeOscillators.splice(idx, 1);
  };
}

// Classic double-ring phone pattern, loops until stopRing()
export function playRing() {
  if (typeof window === "undefined") return;
  if (ringing) return;
  ringing = true;

  function ring() {
    if (!ringing) return;
    try {
      const c = ctx();
      [[440, 0], [480, 0.25], [440, 0.5], [480, 0.75]].forEach(([freq, delay]) => {
        tone(freq, c.currentTime + (delay as number), 0.22);
      });
    } catch { /* AudioContext blocked */ }
    ringTimer = setTimeout(ring, 2500);
  }

  ring();
}

export function stopRing() {
  ringing = false;
  if (ringTimer) { clearTimeout(ringTimer); ringTimer = null; }
  // Force-stop any oscillators that are still scheduled to play
  const now = audioCtx?.currentTime ?? 0;
  for (const osc of activeOscillators.splice(0)) {
    try { osc.stop(now); } catch { /* already stopped */ }
  }
}

// Two ascending tones — call connected / picked up
export function playCallConnected() {
  if (typeof window === "undefined") return;
  try {
    const c = ctx();
    tone(660, c.currentTime, 0.15, 0.25);
    tone(880, c.currentTime + 0.18, 0.2, 0.25);
  } catch { /* AudioContext blocked */ }
}

// Single short descending tone — call ended or declined
export function playCallEnded() {
  if (typeof window === "undefined") return;
  try {
    const c = ctx();
    tone(440, c.currentTime, 0.12, 0.25);
    tone(330, c.currentTime + 0.15, 0.2, 0.2);
  } catch { /* AudioContext blocked */ }
}
