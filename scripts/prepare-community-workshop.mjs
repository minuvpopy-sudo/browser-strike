import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDirectory = path.join(root, 'community-maps');
const convertedDirectory = path.join(root, 'converted-maps');
const outputDirectory = path.join(root, 'dist', 'community-maps');
const catalogSource = path.join(sourceDirectory, 'index.json');
const catalog = JSON.parse(await readFile(catalogSource, 'utf8'));

if (catalog?.format !== 'browser-strike-community-catalog' || !Array.isArray(catalog.maps)) throw new Error('Invalid community workshop catalog');
await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, 'index.json'), `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
await cp(sourceDirectory, outputDirectory, { recursive: true, force: true, filter: (source) => !source.endsWith('README.md') });
await cp(convertedDirectory, path.join(root, 'dist', 'converted-maps'), { recursive: true, force: true });
