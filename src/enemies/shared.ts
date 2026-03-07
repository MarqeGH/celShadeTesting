import { EnemyContext } from './BaseEnemy';
import { AttackDataSchema } from './EnemyFactory';

/** Distance from enemy to player on ground plane. */
export function distToPlayer(ctx: EnemyContext): number {
  const pos = ctx.enemy.getPosition();
  const dx = pos.x - ctx.playerPosition.x;
  const dz = pos.z - ctx.playerPosition.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/** Pick a random attack from the given pool. */
export function pickAttack(attacks: AttackDataSchema[], pool: string[]): AttackDataSchema {
  const candidates = attacks.filter(a => pool.includes(a.id));
  return candidates[Math.floor(Math.random() * candidates.length)];
}
