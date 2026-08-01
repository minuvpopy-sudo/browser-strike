export const ADMIN_PROMO_CODES = Object.freeze(['DUST-ADMIN-2026', 'COLOSSEUM-ROOT']);

export const normalizePromoCode = (value) => String(value || '').trim().toUpperCase().replace(/\s+/g, '');

export class PromoAdminMenu {
  constructor({ save, game, audio }) {
    this.save = save;this.game = game;this.audio = audio;this.unlocked = Boolean(save.get('adminUnlocked', false));
    this.input = document.getElementById('promo-code-input');this.promoStatus = document.getElementById('promo-status');this.adminStatus = document.getElementById('admin-status');
    document.querySelectorAll('[data-promo-tab]').forEach((button) => button.addEventListener('click', () => this.openTab(button.dataset.promoTab)));
    document.getElementById('promo-redeem').addEventListener('click', () => this.redeem());
    this.input.addEventListener('keydown', (event) => { if (event.code === 'Enter') this.redeem(); });
    document.querySelectorAll('[data-admin-action]').forEach((button) => button.addEventListener('click', () => this.run(button)));
    this.renderAccess();
  }

  openTab(tab) {
    document.querySelectorAll('[data-promo-tab]').forEach((button) => button.classList.toggle('selected', button.dataset.promoTab === tab));
    document.querySelectorAll('[data-promo-page]').forEach((page) => page.classList.toggle('active', page.dataset.promoPage === tab));
  }

  redeem() {
    const code = normalizePromoCode(this.input.value);
    if (!ADMIN_PROMO_CODES.includes(code)) { this.setPromoStatus('Промокод не найден. Проверьте символы и дефисы.', 'error');this.audio?.empty?.();return false; }
    this.unlocked = true;this.save.set('adminUnlocked', true);this.input.value = '';this.setPromoStatus('Админ-меню разблокировано на этом устройстве.', 'success');this.audio?.tone?.('ui', { frequency: 740, endFrequency: 1120, gain: .045, duration: .18 });this.renderAccess();this.openTab('admin');return true;
  }

  renderAccess() {
    document.getElementById('promo-label').textContent = this.unlocked ? 'ADMIN ОТКРЫТ' : 'ВВЕСТИ КОД';
    document.getElementById('admin-lock-mark').textContent = this.unlocked ? '✓' : '🔒';
    document.getElementById('admin-locked').hidden = this.unlocked;
    document.getElementById('admin-controls').hidden = !this.unlocked;
  }

  run(button) {
    if (!this.unlocked) return;
    const result = this.game.applyAdminCommand(button.dataset.adminAction);
    this.adminStatus.textContent = result.message;this.adminStatus.className = `status-line ${result.ok ? 'success' : 'error'}`;
    if (button.hasAttribute('data-admin-toggle') && result.ok) { button.classList.toggle('active', result.active);button.querySelector('small').textContent = result.active ? 'ВКЛ' : 'ВЫКЛ'; }
  }

  resetSession() {
    document.querySelectorAll('[data-admin-toggle]').forEach((button) => { button.classList.remove('active');button.querySelector('small').textContent = 'ВЫКЛ'; });
    this.adminStatus.textContent = 'Админ-команды готовы для одиночного матча.';this.adminStatus.className = 'status-line';
  }

  setPromoStatus(text, type = '') { this.promoStatus.textContent = text;this.promoStatus.className = `status-line${type ? ` ${type}` : ''}`; }
}
