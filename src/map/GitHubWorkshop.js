import { WORKSHOP_IMPORT_MAX_BYTES, parseWorkshopMap, sanitizeWorkshopMap } from './WorkshopMap.js';

export const GITHUB_WORKSHOP_REPOSITORY = 'https://github.com/minuvpopy-sudo/browser-strike';
export const GITHUB_WORKSHOP_CATALOG_URL = 'https://raw.githubusercontent.com/minuvpopy-sudo/browser-strike/main/community-maps/index.json';
export const GITHUB_WORKSHOP_FORMAT = 'browser-strike-community-catalog';

const cleanText = (value, fallback, max = 80) => String(value || fallback).replace(/[<>]/g, '').trim().replace(/\s+/g, ' ').slice(0, max) || fallback;
const cleanId = (value = '') => String(value).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);

function safeUrl(value, baseUrl) {
  const url = new URL(String(value || ''), baseUrl);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Недопустимая ссылка на карту');
  return url.href;
}

export function normalizeCommunityCatalog(input, catalogUrl = GITHUB_WORKSHOP_CATALOG_URL) {
  if (!input || input.format !== GITHUB_WORKSHOP_FORMAT || !Array.isArray(input.maps)) throw new Error('Каталог GitHub повреждён');
  const seen = new Set();
  const maps = [];
  for (const item of input.maps.slice(0, 200)) {
    const id = cleanId(item?.id);
    if (!id || seen.has(id)) continue;
    try {
      const fileUrl = safeUrl(item.url || item.file, catalogUrl);
      seen.add(id);
      maps.push({
        id,
        name: cleanText(item.name, 'Безымянная карта', 48),
        author: cleanText(item.author, 'Игрок', 32),
        description: cleanText(item.description, 'Карта сообщества Browser Strike', 180),
        objects: Math.max(0, Math.floor(Number(item.objects) || 0)),
        width: Math.max(0, Math.floor(Number(item.width) || 0)),
        depth: Math.max(0, Math.floor(Number(item.depth) || 0)),
        featured: Boolean(item.featured),
        fileUrl
      });
    } catch { /* Пропускаем небезопасную или сломанную запись. */ }
  }
  return { format: GITHUB_WORKSHOP_FORMAT, version: Number(input.version) || 1, maps };
}

export function localCommunityCatalogUrl(baseHref = globalThis.document?.baseURI || 'http://localhost/') {
  return new URL('community-maps/index.json', baseHref).href;
}

export async function loadCommunityCatalog({ fetcher = globalThis.fetch, catalogUrls = [GITHUB_WORKSHOP_CATALOG_URL, localCommunityCatalogUrl()] } = {}) {
  if (typeof fetcher !== 'function') throw new Error('Загрузка GitHub недоступна');
  let lastError = null;
  for (const catalogUrl of catalogUrls) {
    try {
      const requestUrl = new URL(catalogUrl);requestUrl.searchParams.set('v', Date.now().toString(36));
      const response = await fetcher(requestUrl.href, { cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!response?.ok) throw new Error(`GitHub вернул ${response?.status || 'ошибку'}`);
      return normalizeCommunityCatalog(await response.json(), catalogUrl);
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error('Не удалось загрузить каталог GitHub');
}

export async function fetchCommunityMap(entry, { fetcher = globalThis.fetch } = {}) {
  if (!entry?.fileUrl || typeof fetcher !== 'function') throw new Error('У карты нет ссылки для скачивания');
  const response = await fetcher(entry.fileUrl, { cache: 'no-store', headers: { Accept: 'application/json' } });
  if (!response?.ok) throw new Error(`Не удалось скачать карту (${response?.status || 'GitHub'})`);
  const declaredSize = Number(response.headers?.get?.('content-length')) || 0;
  if (declaredSize > WORKSHOP_IMPORT_MAX_BYTES) throw new Error('Карта превышает лимит 20 МБ');
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > WORKSHOP_IMPORT_MAX_BYTES) throw new Error('Карта превышает лимит 20 МБ');
  return parseWorkshopMap(text);
}

export function githubMapSubmissionUrl(map) {
  const clean = sanitizeWorkshopMap(map);
  const url = new URL(`${GITHUB_WORKSHOP_REPOSITORY}/issues/new`);
  url.searchParams.set('template', 'community-map.yml');
  url.searchParams.set('title', `[КАРТА] ${clean.name}`);
  url.searchParams.set('map_name', clean.name);
  url.searchParams.set('author', clean.author);
  return url.href;
}
