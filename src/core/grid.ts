import type { BattleState, Pos, Side, Terrain, Unit } from './types';

export const DIRS: Pos[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

export const add = (a: Pos, b: Pos): Pos => ({ x: a.x + b.x, y: a.y + b.y });
export const eq = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y;
export const manhattan = (a: Pos, b: Pos) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const key = (p: Pos) => `${p.x},${p.y}`;

export function inBounds(s: BattleState, p: Pos) {
  return p.x >= 0 && p.y >= 0 && p.x < s.width && p.y < s.height;
}

export function terrainAt(s: BattleState, p: Pos): Terrain {
  return s.terrain[p.y][p.x];
}

export function isPassable(t: Terrain) {
  return t !== 'mountain' && t !== 'river';
}

export function unitAt(s: BattleState, p: Pos): Unit | undefined {
  return s.units.find((u) => !u.dead && eq(u.pos, p));
}

export function livingUnits(s: BattleState, side?: Side) {
  return s.units.filter((u) => !u.dead && (!side || u.side === side));
}

/**
 * Tiles a unit can end its move on (BFS). Units may pass through allies
 * but not through opponents, and cannot end on an occupied tile.
 * Includes the unit's current tile.
 */
export function reachableTiles(s: BattleState, unit: Unit, range = unit.move): Pos[] {
  const seen = new Map<string, number>([[key(unit.pos), 0]]);
  const queue: Pos[] = [unit.pos];
  const result: Pos[] = [unit.pos];
  while (queue.length) {
    const cur = queue.shift()!;
    const d = seen.get(key(cur))!;
    if (d === range) continue;
    for (const dir of DIRS) {
      const next = add(cur, dir);
      if (!inBounds(s, next) || seen.has(key(next))) continue;
      if (!isPassable(terrainAt(s, next))) continue;
      const occ = unitAt(s, next);
      if (occ && occ.side !== unit.side) continue;
      seen.set(key(next), d + 1);
      queue.push(next);
      if (!occ) result.push(next);
    }
  }
  return result;
}

/** BFS distance ignoring units (for AI "move closer"). Infinity if unreachable. */
export function pathDistance(s: BattleState, from: Pos, to: Pos): number {
  const seen = new Set([key(from)]);
  let frontier = [from];
  for (let d = 0; frontier.length; d++) {
    const next: Pos[] = [];
    for (const p of frontier) {
      if (eq(p, to)) return d;
      for (const dir of DIRS) {
        const n = add(p, dir);
        if (!inBounds(s, n) || seen.has(key(n))) continue;
        if (!isPassable(terrainAt(s, n)) && !eq(n, to)) continue;
        seen.add(key(n));
        next.push(n);
      }
    }
    frontier = next;
  }
  return Infinity;
}
