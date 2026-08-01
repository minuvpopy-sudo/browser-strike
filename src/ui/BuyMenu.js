import { WEAPONS, EQUIPMENT, GRENADES, BUY_CATEGORIES } from '../weapons/WeaponDefinitions.js';
import { canBuy } from '../config/MatchRules.js';

const availabilityKey = (context) => [
  context.player.money,
  context.player.team,
  context.inBuyZone,
  context.buyTime > 0
].join('|');

export class BuyMenu extends EventTarget {
  constructor() {
    super();
    this.root = document.getElementById('buy-menu');
    this.categories = document.getElementById('buy-categories');
    this.items = document.getElementById('buy-items');
    this.category = 'pistols';
    this.context = null;
    this.itemsKey = '';
    this.buildCategories();
  }

  buildCategories() {
    for (const [id, label] of BUY_CATEGORIES) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.dataset.category = id;
      button.addEventListener('click', () => {
        this.category = id;
        this.itemsKey = '';
        this.render();
      });
      this.categories.append(button);
    }
  }

  open(context) {
    this.context = context;
    this.itemsKey = '';
    this.root.classList.add('visible');
    this.render();
  }

  close() { this.root.classList.remove('visible'); }
  toggle(context) { this.visible ? this.close() : this.open(context); }
  get visible() { return this.root.classList.contains('visible'); }

  render() {
    if (!this.context) return;
    this.categories.querySelectorAll('button').forEach((button) => {
      button.classList.toggle('selected', button.dataset.category === this.category);
    });
    this.updateStatus();
    this.renderItems();
  }

  updateStatus() {
    document.getElementById('buy-money').textContent = `$${this.context.player.money}`;
    document.getElementById('buy-time').textContent = `ОСТАЛОСЬ ${Math.max(0, Math.ceil(this.context.buyTime))} СЕК.`;
  }

  renderItems() {
    const key = `${this.category}|${availabilityKey(this.context)}`;
    if (this.itemsKey === key) return;
    this.itemsKey = key;

    const all = { ...WEAPONS, ...EQUIPMENT, ...GRENADES };
    const entries = Object.values(all).filter((item) => item.category === this.category);
    this.items.replaceChildren();

    for (const item of entries) {
      if (item.id === 'knife') continue;
      const available = !item.side || item.side === 'both' || item.side === this.context.player.team;
      const allowed = canBuy({
        money: this.context.player.money,
        cost: item.cost,
        inBuyZone: this.context.inBuyZone,
        buyTimeLeft: this.context.buyTime,
        available
      });
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `buy-item${allowed ? '' : ' disabled'}`;
      const grenadeDetails={he:'Урон по площади',flash:'Ослепляет игроков и ботов',smoke:'Создаёт плотную дымовую завесу',decoy:'Имитирует очередь выстрелов'};
      const details=item.category==='grenades'?(grenadeDetails[item.id]||'Одноразовое снаряжение'):item.damage?`Урон ${item.damage} · Магазин ${item.mag}`:'Защита и боезапас';
      button.innerHTML = `<strong>${item.name}</strong><small>${details}</small><span class="price">$${item.cost}</span>${!available ? '<small>Недоступно стороне</small>' : this.context.player.money < item.cost ? '<small>Недостаточно денег</small>' : ''}`;
      button.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        this.activate(item, allowed);
      });
      button.addEventListener('click', (event) => {
        if (event.detail === 0) this.activate(item, allowed);
      });
      this.items.append(button);
    }
  }

  activate(item, allowed) {
    this.dispatchEvent(new CustomEvent(allowed ? 'buy' : 'denied', { detail: item }));
  }

  update(context) {
    this.context = context;
    if (!this.visible) return;
    this.updateStatus();
    this.renderItems();
  }
}
