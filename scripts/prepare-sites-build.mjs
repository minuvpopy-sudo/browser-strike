import { cp, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const client = path.join(dist, 'client');
const server = path.join(dist, 'server');

await mkdir(client, { recursive: true });
for (const entry of await readdir(dist, { withFileTypes: true })) {
  if (entry.name === 'client' || entry.name === 'server' || entry.name === '.openai') continue;
  await cp(path.join(dist, entry.name), path.join(client, entry.name), { recursive: true, force: true });
}
await mkdir(server, { recursive: true });
await cp(path.join(root, 'worker', 'sites-static.js'), path.join(server, 'index.js'), { force: true });
