export const SHOT_PROFILES = Object.freeze({
  glock: Object.freeze({
    crack: Object.freeze({ duration: .052, gain: .56, highpass: 520, lowpass: 7200, decay: 96 }),
    body: Object.freeze({ duration: .085, gain: .21, frequency: 185, endFrequency: 82, wave: 'triangle' }),
    slide: Object.freeze({ delay: .018, duration: .038, gain: .052, frequency: 2600, endFrequency: 840, wave: 'square' }),
    tail: Object.freeze({ delay: .026, duration: .17, gain: .105, highpass: 110, lowpass: 1850, decay: 18 })
  })
});

export const SHOT_SAMPLES = Object.freeze({
  glock: Object.freeze({ path: 'audio/glock-shot.mp3', offset: .055, duration: .56, gain: .82 })
});

export function shotProfile(weapon) {
  const id = typeof weapon === 'string' ? weapon : weapon?.id;
  return SHOT_PROFILES[id] || null;
}

export class AudioManager {
  constructor(settings) { this.settings = settings; this.context = null; this.master = null; this.unlocked = false; this.samples = new Map(); this.samplePromises = new Map(); }
  unlock() {
    if (!this.context) {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.context.createGain(); this.master.connect(this.context.destination);
    }
    this.master.gain.value = this.settings.values.masterVolume / 100;
    this.context.resume(); this.unlocked = true;
    for (const [id, sample] of Object.entries(SHOT_SAMPLES)) this.loadSample(id, sample.path);
  }
  loadSample(id, path) {
    if (!this.context || this.samples.has(id)) return Promise.resolve(this.samples.get(id) || null);
    if (this.samplePromises.has(id)) return this.samplePromises.get(id);
    const base = typeof import.meta.env?.BASE_URL === 'string' ? import.meta.env.BASE_URL : '/';
    const url = `${base}${path}`;
    const request = fetch(url).then((response) => {
      if (!response.ok) throw new Error(`Audio ${response.status}`);
      return response.arrayBuffer();
    }).then((data) => this.context.decodeAudioData(data)).then((buffer) => {
      this.samples.set(id, buffer);return buffer;
    }).catch(() => null).finally(() => this.samplePromises.delete(id));
    this.samplePromises.set(id, request);return request;
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
  shot(power = 1, weapon = null) {
    if (!this.unlocked || !this.context) return;
    const id = typeof weapon === 'string' ? weapon : weapon?.id;
    const sample = SHOT_SAMPLES[id];
    const sampleBuffer = this.samples.get(id);
    if (sample && sampleBuffer) {
      this.sampledShot(sampleBuffer, sample, power);
      return;
    }
    const profile = shotProfile(weapon);
    if (profile) {
      this.profiledShot(profile, power);
      return;
    }
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
  sampledShot(buffer, sample, power = 1) {
    const now = this.context.currentTime;
    const volume = (this.settings.values.shotsVolume ?? 80) / 100;
    const strength = Math.max(.65, Math.min(1.35, power));
    const offset = Math.min(sample.offset, Math.max(0, buffer.duration - .08));
    const duration = Math.min(sample.duration, Math.max(.08, buffer.duration - offset));
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    const compressor = this.context.createDynamicsCompressor();
    source.buffer = buffer;source.playbackRate.setValueAtTime(.992 + Math.random() * .016, now);
    gain.gain.setValueAtTime(sample.gain * volume * strength, now);
    gain.gain.setValueAtTime(sample.gain * volume * strength, now + Math.max(.01, duration - .09));
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    compressor.threshold.setValueAtTime(-14, now);compressor.knee.setValueAtTime(10, now);compressor.ratio.setValueAtTime(5, now);compressor.attack.setValueAtTime(.001, now);compressor.release.setValueAtTime(.1, now);
    source.connect(gain).connect(compressor).connect(this.master);source.start(now, offset, duration);source.stop(now + duration + .02);
  }
  profiledShot(profile, power = 1) {
    const now = this.context.currentTime;
    const volume = (this.settings.values.shotsVolume ?? 80) / 100;
    const strength = Math.max(.65, Math.min(1.35, power));
    const variation = .97 + Math.random() * .06;
    const bus = this.context.createGain();
    const compressor = this.context.createDynamicsCompressor();
    bus.gain.setValueAtTime(.46 * volume * strength, now);
    compressor.threshold.setValueAtTime(-18, now);
    compressor.knee.setValueAtTime(12, now);
    compressor.ratio.setValueAtTime(7, now);
    compressor.attack.setValueAtTime(.001, now);
    compressor.release.setValueAtTime(.09, now);
    bus.connect(compressor).connect(this.master);
    this.noiseLayer(bus, profile.crack, now, variation);
    this.oscillatorLayer(bus, profile.body, now, variation);
    this.oscillatorLayer(bus, profile.slide, now, variation);
    this.noiseLayer(bus, profile.tail, now, variation);
  }
  noiseLayer(destination, layer, now, variation = 1) {
    const start = now + (layer.delay || 0);
    const length = Math.ceil(this.context.sampleRate * layer.duration);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    let colored = 0;
    for (let i = 0; i < length; i++) {
      const time = i / this.context.sampleRate;
      const white = Math.random() * 2 - 1;
      colored = colored * .66 + white * .34;
      data[i] = (white * .68 + colored * .32) * Math.exp(-time * layer.decay);
    }
    const source = this.context.createBufferSource();
    const highpass = this.context.createBiquadFilter();
    const lowpass = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    highpass.type = 'highpass';highpass.frequency.setValueAtTime(layer.highpass * variation, start);
    lowpass.type = 'lowpass';lowpass.frequency.setValueAtTime(layer.lowpass * variation, start);
    gain.gain.setValueAtTime(layer.gain, start);gain.gain.exponentialRampToValueAtTime(.0001, start + layer.duration);
    source.buffer = buffer;source.connect(highpass).connect(lowpass).connect(gain).connect(destination);source.start(start);source.stop(start + layer.duration + .01);
  }
  oscillatorLayer(destination, layer, now, variation = 1) {
    const start = now + (layer.delay || 0);
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = layer.wave;oscillator.frequency.setValueAtTime(layer.frequency * variation, start);oscillator.frequency.exponentialRampToValueAtTime(layer.endFrequency * variation, start + layer.duration);
    gain.gain.setValueAtTime(layer.gain, start);gain.gain.exponentialRampToValueAtTime(.0001, start + layer.duration);
    oscillator.connect(gain).connect(destination);oscillator.start(start);oscillator.stop(start + layer.duration + .01);
  }
  click() { this.tone('ui', { frequency: 520, endFrequency: 300, gain: .035, duration: .045 }); }
  empty() { this.tone('ui', { frequency: 170, endFrequency: 120, gain: .045, duration: .04 }); }
  reload() { this.tone('ui', { frequency: 240, endFrequency: 100, gain: .045, duration: .12 }); }
  step() {}
  explosion() { this.tone('shot', { gain: .28, frequency: 70, endFrequency: 25, duration: .5 }); }
}
