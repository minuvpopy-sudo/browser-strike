export const WORKSHOP_MAP_FORMAT = 'browser-strike-map';
export const WORKSHOP_MAP_VERSION = 2;
export const WORKSHOP_MAP_MAX_SIZE = 480;
export const WORKSHOP_IMPORT_MAX_BYTES = 20 * 1024 * 1024;
export const MAP_MATERIALS = Object.freeze({
  sandstone: 'Песчаник', brick: 'Кирпич', concrete: 'Бетон', metal: 'Металл',
  wood: 'Дерево', tech: 'Техно-панель', grass: 'Мятные блоки', ice: 'Светлая плитка',
  darkConcrete: 'Тёмный бетон', plaster: 'Старая штукатурка', whiteBrick: 'Белый кирпич', redBand: 'Красная полоса',
  blueMetal: 'Синий профнастил', masonry: 'Старая кладка', asphalt: 'Асфальт', tile: 'Белая плитка', dust: 'Пыльная земля'
});

const clamp = (value, min, max, fallback = min) => Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : fallback));
const cleanText = (value, fallback, max = 40) => String(value || fallback).replace(/[<>]/g, '').trim().replace(/\s+/g, ' ').slice(0, max) || fallback;
const cleanId = (value = '') => String(value).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
const uid = () => globalThis.crypto?.randomUUID?.() || `map-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function sanitizePoint(point, size, fallback) {
  const margin = 3;
  return {
    x: clamp(point?.x, -size.width / 2 + margin, size.width / 2 - margin, fallback.x),
    z: clamp(point?.z, -size.depth / 2 + margin, size.depth / 2 - margin, fallback.z)
  };
}

function sanitizeObject(object, index, size) {
  const type = ['wall', 'crate', 'ramp'].includes(object?.type) ? object.type : 'wall';
  const requestedMaterial=object?.material||object?.texture||object?.textureId;
  const material = MAP_MATERIALS[requestedMaterial] ? requestedMaterial : type === 'crate' ? 'wood' : type === 'ramp' ? 'concrete' : 'sandstone';
  const maxWidth = Math.max(2, size.width - 4), maxDepth = Math.max(2, size.depth - 4);
  const w = clamp(object?.w, .8, Math.min(120, maxWidth), type === 'crate' ? 3 : type === 'ramp' ? 7 : 8);
  const d = clamp(object?.d, .8, Math.min(120, maxDepth), type === 'crate' ? 3 : type === 'ramp' ? 14 : 2);
  const h = clamp(object?.h, .5, 40, type === 'crate' ? 3 : type === 'ramp' ? 6 : 5);
  const direction = ['north', 'south', 'east', 'west'].includes(object?.direction) ? object.direction : 'north';
  return {
    id: cleanId(object?.id) || `object-${index + 1}`,
    type, material, ...(type === 'ramp' ? { direction } : {}),
    x: clamp(object?.x, -size.width / 2 + w / 2, size.width / 2 - w / 2, 0),
    z: clamp(object?.z, -size.depth / 2 + d / 2, size.depth / 2 - d / 2, 0),
    w, d, h
  };
}

export function createWorkshopMap({ name = 'Новая карта', author = 'Игрок', width = 96, depth = 96 } = {}) {
  const size = { width: clamp(width, 40, WORKSHOP_MAP_MAX_SIZE, 96), depth: clamp(depth, 40, WORKSHOP_MAP_MAX_SIZE, 96) };
  const halfW = size.width / 2, halfD = size.depth / 2;
  return sanitizeWorkshopMap({
    format: WORKSHOP_MAP_FORMAT, version: WORKSHOP_MAP_VERSION, id: uid(), name, author, size, floorMaterial: 'concrete',
    attackerSpawn: { x: -halfW + 10, z: halfD - 10 }, defenderSpawn: { x: halfW - 10, z: -halfD + 10 },
    bombSites: [{ id: 'A', x: halfW - 14, z: halfD - 14, radius: 7 }, { id: 'B', x: -halfW + 14, z: -halfD + 14, radius: 7 }],
    objects: [
      { id: 'border-north', type: 'wall', x: 0, z: -halfD + 1, w: size.width, d: 2, h: 7, material: 'concrete' },
      { id: 'border-south', type: 'wall', x: 0, z: halfD - 1, w: size.width, d: 2, h: 7, material: 'concrete' },
      { id: 'border-west', type: 'wall', x: -halfW + 1, z: 0, w: 2, d: size.depth, h: 7, material: 'concrete' },
      { id: 'border-east', type: 'wall', x: halfW - 1, z: 0, w: 2, d: size.depth, h: 7, material: 'concrete' },
      { id: 'cover-center-a', type: 'wall', x: -9, z: 0, w: 16, d: 2, h: 5, material: 'brick' },
      { id: 'cover-center-b', type: 'wall', x: 9, z: 0, w: 16, d: 2, h: 5, material: 'metal' },
      { id: 'crate-a', type: 'crate', x: -16, z: 14, w: 4, d: 4, h: 4, material: 'wood' },
      { id: 'crate-b', type: 'crate', x: 16, z: -14, w: 4, d: 4, h: 4, material: 'tech' }
    ]
  });
}

export function sanitizeWorkshopMap(input) {
  if (!input || typeof input !== 'object') throw new Error('Файл карты повреждён');
  const size = { width: clamp(input.size?.width, 40, WORKSHOP_MAP_MAX_SIZE, 96), depth: clamp(input.size?.depth, 40, WORKSHOP_MAP_MAX_SIZE, 96) };
  const attackerFallback = { x: -size.width / 2 + 10, z: size.depth / 2 - 10 };
  const defenderFallback = { x: size.width / 2 - 10, z: -size.depth / 2 + 10 };
  const sites = Array.isArray(input.bombSites) ? input.bombSites : [];
  const siteFallbacks = [{ x: size.width / 2 - 14, z: size.depth / 2 - 14 }, { x: -size.width / 2 + 14, z: -size.depth / 2 + 14 }];
  return {
    format: WORKSHOP_MAP_FORMAT, version: WORKSHOP_MAP_VERSION,
    id: cleanId(input.id) || uid(), name: cleanText(input.name, 'Безымянная карта'), author: cleanText(input.author, 'Игрок', 24),
    size, floorMaterial: MAP_MATERIALS[input.floorMaterial] ? input.floorMaterial : 'concrete',
    attackerSpawn: sanitizePoint(input.attackerSpawn, size, attackerFallback),
    defenderSpawn: sanitizePoint(input.defenderSpawn, size, defenderFallback),
    bombSites: ['A', 'B'].map((id, index) => ({ id, ...sanitizePoint(sites.find((site) => site?.id === id) || sites[index], size, siteFallbacks[index]), radius: clamp((sites.find((site) => site?.id === id) || sites[index])?.radius, 4, 14, 7) })),
    objects: (Array.isArray(input.objects) ? input.objects : []).slice(0, 500).map((object, index) => sanitizeObject(object, index, size)),
    updatedAt: clamp(input.updatedAt, 0, Number.MAX_SAFE_INTEGER, Date.now()) || Date.now()
  };
}

const pointBlocked = (point, boxes, radius = 1) => boxes.some((box) => point.x + radius > box.x - box.w / 2 && point.x - radius < box.x + box.w / 2 && point.z + radius > box.z - box.d / 2 && point.z - radius < box.z + box.d / 2);
const segmentBlocked = (a, b, boxes) => {
  const distance = Math.hypot(b.x - a.x, b.z - a.z), steps = Math.max(2, Math.ceil(distance / 2));
  for (let index = 1; index < steps; index++) {
    const t = index / steps;
    if (pointBlocked({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, boxes, .7)) return true;
  }
  return false;
};

function navigationFor(map, boxes) {
  const nodes = [];
  const spacing = Math.max(12, Math.ceil(Math.max(map.size.width, map.size.depth) / 22));
  let index = 0;
  for (let z = -map.size.depth / 2 + 5; z <= map.size.depth / 2 - 5; z += spacing) {
    for (let x = -map.size.width / 2 + 5; x <= map.size.width / 2 - 5; x += spacing) {
      if (!pointBlocked({ x, z }, boxes, 1.1)) nodes.push({ id: `nav-${index++}`, x, z });
    }
  }
  const special = [map.attackerSpawn, map.defenderSpawn, ...map.bombSites].map((point, specialIndex) => ({ id: ['tSpawn', 'ctSpawn', 'siteA', 'siteB'][specialIndex], x: point.x, z: point.z }));
  for (const node of special) if (!pointBlocked(node, boxes, .8)) nodes.push(node);
  const links = [];
  for (const node of nodes) {
    const nearest = nodes.filter((other) => other !== node && Math.hypot(other.x - node.x, other.z - node.z) <= spacing * 1.55 && !segmentBlocked(node, other, boxes));
    for (const other of nearest) {
      const link = [node.id, other.id];
      if (!links.some(([a, b]) => (a === link[0] && b === link[1]) || (a === link[1] && b === link[0]))) links.push(link);
    }
  }
  return { nodes, links };
}

const spawnCluster = (point, size) => Array.from({ length: 10 }, (_, index) => ({
  x: clamp(point.x + ((index % 3) - 1) * 1.7, -size.width / 2 + 2, size.width / 2 - 2, point.x),
  z: clamp(point.z + (Math.floor(index / 3) - 1) * 1.7, -size.depth / 2 + 2, size.depth / 2 - 2, point.z)
}));

export function workshopMapToConfig(input) {
  const map = sanitizeWorkshopMap(input);
  const walls = map.objects.filter((object) => object.type === 'wall').map((object) => ({ ...object, y: object.h / 2 }));
  const crates = map.objects.filter((object) => object.type === 'crate').map((object) => ({ ...object, y: object.h / 2 }));
  const ramps = map.objects.filter((object) => object.type === 'ramp').map((object) => ({ ...object, y: object.h / 2 }));
  const { nodes, links } = navigationFor(map, [...walls, ...crates]);
  return {
    custom: true, sourceMapId: map.id, name: map.name, author: map.author, scale: 1, floorY: 0,
    floorMaterial: map.floorMaterial, size: { ...map.size }, walls, crates, ramps,
    attackerSpawns: spawnCluster(map.attackerSpawn, map.size), defenderSpawns: spawnCluster(map.defenderSpawn, map.size),
    buyZones: [{ team: 'attackers', ...map.attackerSpawn, radius: 12 }, { team: 'defenders', ...map.defenderSpawn, radius: 12 }],
    bombSites: map.bombSites.map((site) => ({ ...site })), nodes, links
  };
}

export function serializeWorkshopMap(map) { return JSON.stringify(sanitizeWorkshopMap(map), null, 2); }

export function parseWorkshopMap(text) {
  let parsed;
  try { parsed = JSON.parse(String(text)); } catch { throw new Error('Это не JSON-файл карты'); }
  if (parsed?.format !== WORKSHOP_MAP_FORMAT) throw new Error('Файл создан не в мастерской Browser Strike');
  return sanitizeWorkshopMap(parsed);
}

export class WorkshopStore {
  constructor(storage = globalThis.localStorage, key = 'browserStrike.workshop.maps.v1') { this.storage = storage; this.key = key; }
  list() {
    try { const data = JSON.parse(this.storage?.getItem?.(this.key) || '[]');return Array.isArray(data) ? data.map(sanitizeWorkshopMap) : []; }
    catch { return []; }
  }
  save(map) {
    const clean = sanitizeWorkshopMap({ ...map, updatedAt: Date.now() });const maps = this.list();const index = maps.findIndex((item) => item.id === clean.id);
    if (index >= 0) maps[index] = clean; else maps.unshift(clean);this.storage?.setItem?.(this.key, JSON.stringify(maps.slice(0, 40)));return clean;
  }
  remove(id) { const maps = this.list().filter((map) => map.id !== id);this.storage?.setItem?.(this.key, JSON.stringify(maps)); }
  get(id) { return this.list().find((map) => map.id === id) || null; }
}
