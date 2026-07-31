import * as THREE from 'three';

export class AssetManager {
  constructor() { this.config = {}; this.textureLoader = new THREE.TextureLoader(); }
  async loadUserConfig() {
    try { const response = await fetch('./user-assets.json'); if (response.ok) this.config = await response.json(); }
    catch { this.config = {}; }
    return this.config;
  }
  async texture(key, fallback = null) {
    const url = this.config.textures?.[key];
    if (!url) return fallback;
    try { return await this.textureLoader.loadAsync(url); } catch { return fallback; }
  }
}
