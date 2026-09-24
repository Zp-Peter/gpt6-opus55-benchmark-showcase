// 程序合成音效（无外部素材）：脚步闷响、低吼、坍塌、甩尾风声。默认静音，用户点击后才启用。
export class Audio {
  constructor() { this.ctx = null; this.muted = true; this.master = null; }
  ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.7;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let s = 1;
    for (let i = 0; i < len; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
  }
  setMuted(m) {
    this.muted = m;
    if (!m) { this.ensure(); this.ctx?.resume(); }
    if (this.master) this.master.gain.value = m ? 0 : 0.7;
  }
  suspend(p) { if (this.ctx) (p ? this.ctx.suspend() : this.ctx.resume()); }
  get ok() { return this.ctx && !this.muted; }
  noiseSrc() { const n = this.ctx.createBufferSource(); n.buffer = this.noise; n.loop = true; return n; }
  thud(strength = 1, pan = 0) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(32, t + 0.35);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55 * Math.min(1.5, strength), t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
    o.connect(g).connect(p).connect(this.master); o.start(t); o.stop(t + 0.55);
    const n = this.noiseSrc(); const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
    const ng = c.createGain(); ng.gain.setValueAtTime(0.25 * strength, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    n.connect(f).connect(ng).connect(p); n.start(t); n.stop(t + 0.3);
  }
  roar(len = 1.8, pitch = 1) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(90 * pitch, t); o.frequency.linearRampToValueAtTime(140 * pitch, t + 0.3); o.frequency.linearRampToValueAtTime(70 * pitch, t + len);
    const lfo = c.createOscillator(); lfo.frequency.value = 23; const lg = c.createGain(); lg.gain.value = 18; lfo.connect(lg).connect(o.frequency);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(900, t + 0.3); f.frequency.linearRampToValueAtTime(300, t + len);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.12); g.gain.setValueAtTime(0.35, t + len * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    const n = this.noiseSrc(); const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 700; nf.Q.value = 0.8;
    const ng = c.createGain(); ng.gain.value = 0.25;
    o.connect(f); n.connect(nf).connect(ng).connect(f); f.connect(g).connect(this.master);
    o.start(t); lfo.start(t); n.start(t); o.stop(t + len); lfo.stop(t + len); n.stop(t + len);
  }
  crash(size = 1) {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime;
    const n = this.noiseSrc(); const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(200, t + 0.8 * size);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4 * Math.min(1.4, size), t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9 * size + 0.2);
    n.connect(f).connect(g).connect(this.master); n.start(t); n.stop(t + 1.3 * size + 0.3);
  }
  whoosh() {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime;
    const n = this.noiseSrc(); const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(1400, t + 0.3); f.frequency.exponentialRampToValueAtTime(250, t + 0.6);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
    n.connect(f).connect(g).connect(this.master); n.start(t); n.stop(t + 0.7);
  }
}
