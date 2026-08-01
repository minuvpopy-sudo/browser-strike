import fs from 'node:fs';
import path from 'node:path';

const FORMAT = 'browser-strike-map';
const VERSION = 2;
const MAX_OBJECTS = 480;
const SKIP_PATTERN = /(?:^Empty$|^Fluid_|^Plant_|^Deco_|Torch|SpiderWeb|Leaves|Trunk|Flower|Grass|Moss|Vine|Camel)/i;
const TERRAIN_PATTERN = /^(?:Soil_|Rock_(?:Sand|Gravel|Dirt))/i;

function usage() {
  console.log('Usage: node scripts/convert-voxel-prefab.mjs <input.prefab.json> [output.json]');
}
function materialFor(name) {
  if (/Crate|Bookshelf|Barrel|Wood|Table|Chair|Bed/i.test(name)) return 'wood';
  if (/Metal|Iron|Door|Window|Gate|Fence/i.test(name)) return 'metal';
  if (/Brick_Ornate|Brick_Decorative/i.test(name)) return 'masonry';
  if (/Brick_Smooth|Sandstone_White$/i.test(name)) return 'plaster';
  if (/Sandstone_White_Brick/i.test(name)) return 'whiteBrick';
  if (/Sandstone|Sand/i.test(name)) return 'sandstone';
  if (/Clay|Terracotta|Red/i.test(name)) return 'brick';
  if (/Stone|Rock|Cobble/i.test(name)) return 'masonry';
  return 'concrete';
}

function typeFor(name) {
  return /Crate|Barrel/i.test(name) ? 'crate' : 'wall';
}

const columnKey = (x, z) => `${x},${z}`;
const cellKey = (material, type, height) => `${material}|${type}|${height}`;

function mode(values, fallback = 0) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  let winner = fallback;
  let best = -1;
  for (const [value, count] of counts) {
    if (count > best) {
      winner = value;
      best = count;
    }
  }
  return winner;
}

function quantizeHeight(value) {
  if (value <= 2) return Math.max(1, value);
  return Math.min(40, Math.max(2, Math.round(value / 2) * 2));
}

function getColumns(blocks) {
  const columns = new Map();
  for (const block of blocks) {
    if (!Number.isFinite(block?.x) || !Number.isFinite(block?.y) || !Number.isFinite(block?.z)) continue;
    const key = columnKey(block.x, block.z);
    let column = columns.get(key);
    if (!column) {
      column = { x: block.x, z: block.z, blocks: [] };
      columns.set(key, column);
    }
    column.blocks.push(block);
  }
  return columns;
}

function architectureGrid(columns) {
  const cells = new Map();
  let skippedDecoration = 0;
  for (const column of columns.values()) {
    const terrain = column.blocks.filter((block) => TERRAIN_PATTERN.test(block.name));
    const terrainTop = terrain.length ? Math.max(...terrain.map((block) => block.y)) : -1;
    const structure = column.blocks.filter((block) => !TERRAIN_PATTERN.test(block.name) && !SKIP_PATTERN.test(block.name));
    skippedDecoration += column.blocks.length - terrain.length - structure.length;
    if (!structure.length) continue;

    const byType = new Map();
    for (const block of structure) {
      const type = typeFor(block.name);
      let list = byType.get(type);
      if (!list) {
        list = [];
        byType.set(type, list);
      }
      list.push(block);
    }

    // A crate/prop wins over a wall in the same projected cell. Thin isolated roof
    // tiles are omitted because the workshop format has no elevated geometry.
    const type = byType.has('crate') ? 'crate' : 'wall';
    const selected = byType.get(type);
    const minY = Math.min(...selected.map((block) => block.y));
    const maxY = Math.max(...selected.map((block) => block.y));
    const touchesTerrain = minY <= terrainTop + 2;
    if (type === 'wall' && selected.length === 1 && !touchesTerrain) continue;

    const material = mode(selected.map((block) => materialFor(block.name)), type === 'crate' ? 'wood' : 'sandstone');
    const rawHeight = type === 'crate'
      ? Math.max(2, maxY - minY + 1)
      : Math.max(2, maxY - Math.max(minY, terrainTop + 1) + 1);
    const height = quantizeHeight(rawHeight);
    cells.set(columnKey(column.x, column.z), { x: column.x, z: column.z, material, type, height });
  }
  return { cells, skippedDecoration };
}

function greedyRectangles(cells, bounds) {
  const used = new Set();
  const rectangles = [];
  for (let z = bounds.minZ; z <= bounds.maxZ; z += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      const originKey = columnKey(x, z);
      const origin = cells.get(originKey);
      if (!origin || used.has(originKey)) continue;
      const signature = cellKey(origin.material, origin.type, origin.height);
      let width = 1;
      while (x + width <= bounds.maxX) {
        const key = columnKey(x + width, z);
        const cell = cells.get(key);
        if (!cell || used.has(key) || cellKey(cell.material, cell.type, cell.height) !== signature) break;
        width += 1;
      }
      let depth = 1;
      depthLoop: while (z + depth <= bounds.maxZ) {
        for (let dx = 0; dx < width; dx += 1) {
          const key = columnKey(x + dx, z + depth);
          const cell = cells.get(key);
          if (!cell || used.has(key) || cellKey(cell.material, cell.type, cell.height) !== signature) break depthLoop;
        }
        depth += 1;
      }
      for (let dz = 0; dz < depth; dz += 1) {
        for (let dx = 0; dx < width; dx += 1) used.add(columnKey(x + dx, z + dz));
      }
      rectangles.push({
        type: origin.type,
        material: origin.material,
        sourceX: x + (width - 1) / 2,
        sourceZ: z + (depth - 1) / 2,
        w: width,
        d: depth,
        h: origin.height,
        score: width * depth * origin.height + (origin.type === 'crate' ? 4 : 0)
      });
    }
  }
  return rectangles;
}

function blocked(point, objects, radius = 1.6) {
  return objects.some((object) => point.x + radius > object.x - object.w / 2
    && point.x - radius < object.x + object.w / 2
    && point.z + radius > object.z - object.d / 2
    && point.z - radius < object.z + object.d / 2);
}

function nearestOpen(target, objects, size) {
  const maxRadius = Math.ceil(Math.max(size.width, size.depth) / 2);
  for (let radius = 0; radius <= maxRadius; radius += 2) {
    const samples = Math.max(1, Math.ceil(2 * Math.PI * Math.max(radius, 1) / 2));
    for (let index = 0; index < samples; index += 1) {
      const angle = (index / samples) * Math.PI * 2;
      const point = {
        x: Math.max(-size.width / 2 + 4, Math.min(size.width / 2 - 4, target.x + Math.cos(angle) * radius)),
        z: Math.max(-size.depth / 2 + 4, Math.min(size.depth / 2 - 4, target.z + Math.sin(angle) * radius))
      };
      if (!blocked(point, objects)) return { x: Math.round(point.x * 10) / 10, z: Math.round(point.z * 10) / 10 };
    }
  }
  return { x: 0, z: 0 };
}

function convert(prefab, inputName) {
  if (!prefab || !Array.isArray(prefab.blocks) || !prefab.blocks.length) {
    throw new Error('The source JSON has no voxel blocks.');
  }
  const valid = prefab.blocks.filter((block) => Number.isFinite(block?.x) && Number.isFinite(block?.y) && Number.isFinite(block?.z));
  const bounds = {
    minX: Math.min(...valid.map((block) => block.x)), maxX: Math.max(...valid.map((block) => block.x)),
    minZ: Math.min(...valid.map((block) => block.z)), maxZ: Math.max(...valid.map((block) => block.z))
  };
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const size = {
    width: Math.max(40, Math.ceil(bounds.maxX - bounds.minX + 1 + 10)),
    depth: Math.max(40, Math.ceil(bounds.maxZ - bounds.minZ + 1 + 10))
  };
  const columns = getColumns(valid);
  const { cells, skippedDecoration } = architectureGrid(columns);
  const rectangles = greedyRectangles(cells, bounds);
  const borderReserve = 4;
  const kept = rectangles
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_OBJECTS - borderReserve)
    .sort((a, b) => a.sourceZ - b.sourceZ || a.sourceX - b.sourceX);
  const objects = kept.map((rectangle, index) => ({
    id: `prefab-${index + 1}`,
    type: rectangle.type,
    material: rectangle.material,
    x: Math.round((rectangle.sourceX - centerX) * 10) / 10,
    z: Math.round((rectangle.sourceZ - centerZ) * 10) / 10,
    w: rectangle.w,
    d: rectangle.d,
    h: rectangle.h
  }));
  objects.push(
    { id: 'border-north', type: 'wall', material: 'sandstone', x: 0, z: -size.depth / 2 + 1, w: size.width, d: 2, h: 7 },
    { id: 'border-south', type: 'wall', material: 'sandstone', x: 0, z: size.depth / 2 - 1, w: size.width, d: 2, h: 7 },
    { id: 'border-west', type: 'wall', material: 'sandstone', x: -size.width / 2 + 1, z: 0, w: 2, d: size.depth, h: 7 },
    { id: 'border-east', type: 'wall', material: 'sandstone', x: size.width / 2 - 1, z: 0, w: 2, d: size.depth, h: 7 }
  );

  const targets = [
    { x: -size.width * 0.34, z: size.depth * 0.34 },
    { x: size.width * 0.34, z: -size.depth * 0.34 },
    { x: size.width * 0.27, z: size.depth * 0.25 },
    { x: -size.width * 0.27, z: -size.depth * 0.25 }
  ];
  const [attackerSpawn, defenderSpawn, siteA, siteB] = targets.map((target) => nearestOpen(target, objects, size));
  const baseName = path.basename(inputName).replace(/\.prefab\.json$/i, '').replace(/\.json$/i, '');
  const map = {
    format: FORMAT,
    version: VERSION,
    id: `${baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 38) || 'converted-prefab'}-converted`,
    name: `${baseName} (converted)`.slice(0, 40),
    author: 'Voxel prefab converter',
    size,
    floorMaterial: 'dust',
    attackerSpawn,
    defenderSpawn,
    bombSites: [
      { id: 'A', ...siteA, radius: 7 },
      { id: 'B', ...siteB, radius: 7 }
    ],
    objects,
    updatedAt: Date.now()
  };
  return {
    map,
    stats: {
      sourceBlocks: valid.length,
      sourceColumns: columns.size,
      architectureCells: cells.size,
      rectanglesBeforeLimit: rectangles.length,
      outputObjects: objects.length,
      skippedDecoration,
      discardedRectangles: Math.max(0, rectangles.length - kept.length)
    }
  };
}

const [, , inputArg, outputArg] = process.argv;
if (!inputArg) {
  usage();
  process.exitCode = 1;
} else {
  const inputPath = path.resolve(inputArg);
  const outputPath = path.resolve(outputArg || path.join(process.cwd(), 'converted-maps', `${path.basename(inputPath).replace(/\.prefab\.json$/i, '').replace(/\.json$/i, '')}-browser-strike.json`));
  const source = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const { map, stats } = convert(source, inputPath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(map, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ input: inputPath, output: outputPath, ...stats }, null, 2));
}
