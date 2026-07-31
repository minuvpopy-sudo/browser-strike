export function versionedPageUrl(href, version) {
  const url = new URL(href);
  url.searchParams.set('bs-version', version);
  return url.href;
}

export class AutoUpdater {
  constructor({ version, canReload = () => true, fetcher = globalThis.fetch, locationRef = globalThis.location, documentRef = globalThis.document, interval = 30000 }) {
    Object.assign(this, { version, canReload, fetcher, locationRef, documentRef, interval });
    this.pendingVersion = null;
    this.checking = false;
    this.timer = null;
    this.onFocus = () => this.check();
    this.onVisibility = () => { if (!this.documentRef.hidden) this.check(); };
  }

  async check() {
    if (this.checking || this.documentRef?.hidden) return false;
    this.checking = true;
    try {
      const manifestUrl = new URL('version.json', this.documentRef.baseURI);
      manifestUrl.searchParams.set('t', Date.now().toString());
      const response = await this.fetcher(manifestUrl.href, { cache: 'no-store' });
      if (!response.ok) return false;
      const manifest = await response.json();
      if (!manifest.version || manifest.version === this.version) return false;
      this.pendingVersion = String(manifest.version);
      return this.reloadIfReady();
    } catch {
      return false;
    } finally {
      this.checking = false;
    }
  }

  reloadIfReady() {
    if (!this.pendingVersion || !this.canReload()) return false;
    this.locationRef.replace(versionedPageUrl(this.locationRef.href, this.pendingVersion));
    return true;
  }

  start() {
    this.timer = setInterval(() => this.pendingVersion ? this.reloadIfReady() : this.check(), this.interval);
    globalThis.addEventListener?.('focus', this.onFocus);
    this.documentRef?.addEventListener?.('visibilitychange', this.onVisibility);
    this.check();
    return this;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    globalThis.removeEventListener?.('focus', this.onFocus);
    this.documentRef?.removeEventListener?.('visibilitychange', this.onVisibility);
  }
}
