import * as THREE from 'three';

export function selectMeleeTarget({ origin, direction, targets, range, isBlocked = () => false }) {
  const forward = direction.clone().normalize();
  let best = null;
  let bestScore = Infinity;

  for (const target of targets) {
    if (!target?.alive || !target.position) continue;
    const aimPoint = target.position.clone().add(new THREE.Vector3(0, 1.05, 0));
    const offset = aimPoint.clone().sub(origin);
    const along = offset.dot(forward);
    if (along < 0 || along > range + .55) continue;

    const perpendicular = Math.sqrt(Math.max(0, offset.lengthSq() - along * along));
    if (perpendicular > .9 || isBlocked(origin, aimPoint)) continue;

    const score = along + perpendicular * .35;
    if (score < bestScore) {
      best = target;
      bestScore = score;
    }
  }
  return best;
}

const RANGED_ZONES = Object.freeze([
  Object.freeze({ zone: 'head', y: 1.7, radius: .29 }),
  Object.freeze({ zone: 'chest', y: 1.18, radius: .43 }),
  Object.freeze({ zone: 'stomach', y: .78, radius: .36 }),
  Object.freeze({ zone: 'legs', y: .36, radius: .34 })
]);

export function selectRangedHit({ origin, direction, targets, maxDistance, blockerDistance = Infinity, tolerance = .055 }) {
  const forward = direction.clone().normalize();
  const limit = Math.min(maxDistance, blockerDistance + .015);
  let best = null;
  let bestDistance = limit;

  for (const entity of targets) {
    if (!entity?.alive || !entity.position) continue;
    const crouchOffset = entity.crouched ? -.28 : 0;
    for (const hitZone of RANGED_ZONES) {
      const centerX = entity.position.x;
      const centerY = entity.position.y + hitZone.y + crouchOffset;
      const centerZ = entity.position.z;
      const toX = centerX - origin.x;
      const toY = centerY - origin.y;
      const toZ = centerZ - origin.z;
      const projected = toX * forward.x + toY * forward.y + toZ * forward.z;
      if (projected < 0 || projected > bestDistance) continue;
      const radius = hitZone.radius + tolerance;
      const perpendicularSq = toX * toX + toY * toY + toZ * toZ - projected * projected;
      if (perpendicularSq > radius * radius) continue;
      const entry = Math.max(0, projected - Math.sqrt(Math.max(0, radius * radius - perpendicularSq)));
      if (entry > bestDistance) continue;
      bestDistance = entry;
      best = { entity, zone: hitZone.zone, distance: entry, point: origin.clone().addScaledVector(forward, entry) };
    }
  }
  return best;
}

export function applyDamageSafely(entity, amount, source, onError = console.error) {
  if (!entity || entity.alive === false || typeof entity.takeDamage !== 'function' || !Number.isFinite(amount) || amount <= 0) {
    return { applied: false, died: false };
  }
  try {
    return { applied: true, died: Boolean(entity.takeDamage(amount, source)) };
  } catch (error) {
    onError?.('Не удалось обработать урон', error);
    return { applied: false, died: false };
  }
}
