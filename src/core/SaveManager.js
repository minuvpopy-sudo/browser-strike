export class SaveManager {
  constructor(prefix = 'browserStrike') { this.prefix = prefix; }
  get(key, fallback = null) {
    try { const value = localStorage.getItem(`${this.prefix}.${key}`); return value === null ? fallback : JSON.parse(value); }
    catch { return fallback; }
  }
  set(key, value) { localStorage.setItem(`${this.prefix}.${key}`, JSON.stringify(value)); }
  remove(key) { localStorage.removeItem(`${this.prefix}.${key}`); }
}
