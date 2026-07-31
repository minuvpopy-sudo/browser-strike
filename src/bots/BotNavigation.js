import * as THREE from 'three';

export class BotNavigation {
  constructor(graph, collision) {
    this.graph = graph;
    this.collision = collision;
    this.path = [];
    this.index = 0;
    this.target = null;
    this.repath = 0;
    this.lastPosition = new THREE.Vector3();
    this.stuck = 0;
    this.gridStep = 2;
  }

  setTarget(bot, target, force = false) {
    if (!target) return false;
    const nextTarget = new THREE.Vector3(target.x, 0, target.z);
    if (!force && this.target && this.target.distanceToSquared(nextTarget) < 2.25 && this.repath > 0 && this.index < this.path.length) {
      return false;
    }
    this.target = nextTarget;
    this.path = this.gridPath(bot.position, nextTarget);
    if (!this.path.length) this.path = this.graph.path(bot.position, nextTarget).map((node) => new THREE.Vector3(node.x, 0, node.z));
    this.index = 0;
    this.repath = 1.1;
    this.lastPosition.copy(bot.position);
    this.stuck = 0;
    return true;
  }

  update(bot, dt, speed = 4.1) {
    if (!this.target) return false;
    this.repath -= dt;
    while (this.index < this.path.length && bot.position.distanceToSquared(this.path[this.index]) < 1.35 * 1.35) this.index++;
    const goal = this.path[this.index] || this.target;
    const direction = goal.clone().sub(bot.position).setY(0);
    if (direction.lengthSq() < 0.35 * 0.35 && this.index >= this.path.length) {
      bot.velocity.set(0, 0, 0);
      return true;
    }

    direction.normalize();
    const separation = new THREE.Vector3(
      Math.sin(bot.index * 7.7 + performance.now() * 0.001) * 0.08,
      0,
      Math.cos(bot.index * 3.1) * 0.08
    );
    direction.add(separation).normalize();
    const previousX = bot.position.x;
    const previousZ = bot.position.z;
    const moved = this.collision.moveCircle(bot.position, { x: direction.x * speed * dt, z: direction.z * speed * dt }, 0.55);
    bot.position.x = moved.x;
    bot.position.z = moved.z;
    bot.velocity.set((moved.x - previousX) / dt, 0, (moved.z - previousZ) / dt);

    if (bot.position.distanceToSquared(this.lastPosition) < 0.025) this.stuck += dt;
    else {
      this.stuck = 0;
      this.lastPosition.copy(bot.position);
    }
    if ((moved.blocked && this.repath <= 0) || this.stuck > 0.9) {
      this.setTarget(bot, this.target, true);
    }
    return false;
  }

  gridPath(startPosition, endPosition) {
    const step = this.gridStep;
    const bounds = this.collision.bounds;
    const width = Math.floor((bounds.maxX - bounds.minX) / step) + 1;
    const depth = Math.floor((bounds.maxZ - bounds.minZ) / step) + 1;
    const toCell = (position) => ({
      x: Math.max(0, Math.min(width - 1, Math.round((position.x - bounds.minX) / step))),
      z: Math.max(0, Math.min(depth - 1, Math.round((position.z - bounds.minZ) / step)))
    });
    const toWorld = (cell) => new THREE.Vector3(bounds.minX + cell.x * step, 0, bounds.minZ + cell.z * step);
    const key = (cell) => `${cell.x},${cell.z}`;
    const isOpen = (cell) => {
      if (cell.x < 0 || cell.x >= width || cell.z < 0 || cell.z >= depth) return false;
      const point = toWorld(cell);
      return !this.collision.intersects(point.x, point.z, 0.62);
    };
    const nearestOpen = (origin) => {
      if (isOpen(origin)) return origin;
      for (let radius = 1; radius <= 5; radius++) {
        for (let x = -radius; x <= radius; x++) {
          for (let z = -radius; z <= radius; z++) {
            if (Math.abs(x) !== radius && Math.abs(z) !== radius) continue;
            const candidate = { x: origin.x + x, z: origin.z + z };
            if (isOpen(candidate)) return candidate;
          }
        }
      }
      return null;
    };

    const start = nearestOpen(toCell(startPosition));
    const goal = nearestOpen(toCell(endPosition));
    if (!start || !goal) return [];
    const startKey = key(start);
    const goalKey = key(goal);
    const open = new Set([startKey]);
    const cells = new Map([[startKey, start], [goalKey, goal]]);
    const cameFrom = new Map();
    const gScore = new Map([[startKey, 0]]);
    const fScore = new Map([[startKey, Math.hypot(goal.x - start.x, goal.z - start.z)]]);
    const directions = [
      [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
      [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]
    ];
    let iterations = 0;
    while (open.size && iterations++ < 6000) {
      let currentKey = null;
      let best = Infinity;
      for (const candidate of open) {
        const score = fScore.get(candidate) ?? Infinity;
        if (score < best) { best = score; currentKey = candidate; }
      }
      if (currentKey === goalKey) {
        const raw = [];
        let cursor = currentKey;
        while (cursor) {
          raw.unshift(toWorld(cells.get(cursor)));
          cursor = cameFrom.get(cursor);
        }
        raw[0] = new THREE.Vector3(startPosition.x, 0, startPosition.z);
        if (!this.collision.segmentBlocked(raw.at(-1), endPosition)) raw.push(new THREE.Vector3(endPosition.x, 0, endPosition.z));
        return this.simplify(raw);
      }
      open.delete(currentKey);
      const current = cells.get(currentKey);
      for (const [dx, dz, cost] of directions) {
        const neighbor = { x: current.x + dx, z: current.z + dz };
        if (!isOpen(neighbor)) continue;
        if (dx && dz && (!isOpen({ x: current.x + dx, z: current.z }) || !isOpen({ x: current.x, z: current.z + dz }))) continue;
        const neighborKey = key(neighbor);
        cells.set(neighborKey, neighbor);
        const tentative = (gScore.get(currentKey) ?? Infinity) + cost;
        if (tentative >= (gScore.get(neighborKey) ?? Infinity)) continue;
        cameFrom.set(neighborKey, currentKey);
        gScore.set(neighborKey, tentative);
        fScore.set(neighborKey, tentative + Math.hypot(goal.x - neighbor.x, goal.z - neighbor.z));
        open.add(neighborKey);
      }
    }
    return [];
  }

  simplify(path) {
    if (path.length < 3) return path;
    const result = [path[0]];
    let anchor = 0;
    while (anchor < path.length - 1) {
      let next = anchor + 1;
      for (let candidate = path.length - 1; candidate > anchor + 1; candidate--) {
        if (!this.collision.segmentBlocked(path[anchor], path[candidate])) { next = candidate; break; }
      }
      result.push(path[next]);
      anchor = next;
    }
    return result;
  }
}
