export class AudioManager {
  constructor(settings) { this.settings = settings; this.context = null; this.master = null; this.unlocked = false; }
  unlock() {
    if (!this.context) {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.context.createGain(); this.master.connect(this.context.destination);
    }
    this.master.gain.value = this.settings.values.masterVolume / 100;
    this.context.resume(); this.unlocked = true;
  }
  tone(type = 'ui', options = {}) {
    if (!this.unlocked || !this.context) return;
    const now = this.context.currentTime;
    const osc = this.context.createOscillator(); const gain = this.context.createGain();
    const volumes = { shot: 'shotsVolume', step: 'stepsVolume', ui: 'uiVolume', voice: 'voiceVolume' };
    const volume = (this.settings.values[volumes[type] || 'uiVolume'] ?? 60) / 100;
    osc.type = options.wave || (type === 'shot' ? 'sawtooth' : 'square');
    osc.frequency.setValueAtTime(options.frequency || (type === 'shot' ? 95 : 320), now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(25, options.endFrequency || 45), now + (options.duration || .08));
    gain.gain.setValueAtTime((options.gain || .16) * volume, now);
    gain.gain.exponentialRampToValueAtTime(.0001, now + (options.duration || .08));
    osc.connect(gain).connect(this.master); osc.start(now); osc.stop(now + (options.duration || .08) + .02);
    if (type === 'shot') this.noise(options.gain || .13, options.duration || .09);
  }
  noise(gainValue = .1, duration = .1) {
    const length = Math.ceil(this.context.sampleRate * duration); const buffer = this.context.createBuffer(1, length, this.context.sampleRate); const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const source = this.context.createBufferSource(); const filter = this.context.createBiquadFilter(); const gain = this.context.createGain();
    filter.type = 'bandpass'; filter.frequency.value = 850; gain.gain.setValueAtTime(gainValue, this.context.currentTime); gain.gain.exponentialRampToValueAtTime(.0001, this.context.currentTime + duration);
    source.buffer = buffer; source.connect(filter).connect(gain).connect(this.master); source.start();
  }
  shot(power = 1) {
    if (!this.unlocked || !this.context) return;
    const now = this.context.currentTime;
    const volume = (this.settings.values.shotsVolume ?? 80) / 100;
    const strength = Math.max(.65, Math.min(1.35, power));
    const duration = .075 + strength * .012;
    const length = Math.ceil(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    let coloredNoise = 0;
    for (let i = 0; i < length; i++) {
      const time = i / this.context.sampleRate;
      const whiteNoise = Math.random() * 2 - 1;
      coloredNoise = coloredNoise * .58 + whiteNoise * .42;
      const crack = Math.exp(-time * 72);
      const body = Math.exp(-time * 24) * .22;
      data[i] = (whiteNoise * .72 + coloredNoise * .28) * (crack + body);
    }
    const crack = this.context.createBufferSource();
    const highpass = this.context.createBiquadFilter();
    const lowpass = this.context.createBiquadFilter();
    const crackGain = this.context.createGain();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(150, now);
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(3200 + strength * 850, now);
    crackGain.gain.setValueAtTime(.18 * strength * volume, now);
    crackGain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    crack.buffer = buffer;
    crack.connect(highpass).connect(lowpass).connect(crackGain).connect(this.master);
    crack.start(now);
    crack.stop(now + duration);
  }
  click() { this.tone('ui', { frequency: 520, endFrequency: 300, gain: .035, duration: .045 }); }
  empty() { this.tone('ui', { frequency: 170, endFrequency: 120, gain: .045, duration: .04 }); }
  reload() { this.tone('ui', { frequency: 240, endFrequency: 100, gain: .045, duration: .12 }); }
  step() {}
  explosion() { this.tone('shot', { gain: .28, frequency: 70, endFrequency: 25, duration: .5 }); }
}
