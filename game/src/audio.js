// SKYLANE audio — every sound is synthesised with WebAudio, no audio files.
// Engine drone follows throttle, wind rush follows speed, plus chimes for rings,
// a thud for touchdown and a noise burst for a crash.
export function createAudio() {
  let ctx = null, master = null, engineOsc = null, engineOsc2 = null, engineGain = null;
  let windSrc = null, windGain = null, windFilter = null;
  let muted = false;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { return false; }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);

    // engine: two detuned saws through a lowpass
    engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
    engineOsc2 = ctx.createOscillator(); engineOsc2.type = 'sawtooth'; engineOsc2.frequency.value = 55 * 1.5;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    engineOsc.connect(lp); engineOsc2.connect(lp);
    lp.connect(engineGain); engineGain.connect(master);
    engineOsc.start(); engineOsc2.start();

    // wind: looped noise buffer through a bandpass
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    windSrc = ctx.createBufferSource(); windSrc.buffer = buf; windSrc.loop = true;
    windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 700; windFilter.Q.value = 0.6;
    windGain = ctx.createGain(); windGain.gain.value = 0;
    windSrc.connect(windFilter); windFilter.connect(windGain); windGain.connect(master);
    windSrc.start();
    return true;
  }

  function tone(freq, dur, type = 'sine', vol = 0.3, when = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function noiseBurst(dur, vol, freq = 800) {
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
  }

  return {
    unlock() { ensure(); },
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; },
    isMuted() { return muted; },
    update(throttle, speed, flying) {
      if (!ctx) return;
      const t = ctx.currentTime;
      engineGain.gain.setTargetAtTime(flying ? 0.05 + throttle * 0.09 : 0, t, 0.1);
      engineOsc.frequency.setTargetAtTime(48 + throttle * 75, t, 0.1);
      engineOsc2.frequency.setTargetAtTime((48 + throttle * 75) * 1.5, t, 0.1);
      windGain.gain.setTargetAtTime(flying ? Math.min(0.22, speed / 95 * 0.22) : 0, t, 0.15);
      windFilter.frequency.setTargetAtTime(400 + speed * 9, t, 0.15);
    },
    ring() { tone(880, 0.35, 'sine', 0.28); tone(1318, 0.5, 'sine', 0.22, 0.09); },
    land() { tone(180, 0.4, 'sine', 0.4); noiseBurst(0.25, 0.25, 500); },
    crash() { noiseBurst(0.9, 0.6, 900); tone(55, 0.9, 'sine', 0.5); },
    click() { tone(660, 0.08, 'square', 0.12); },
    win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.4, 'sine', 0.25, i * 0.12)); },
  };
}
