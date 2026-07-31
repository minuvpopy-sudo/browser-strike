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
