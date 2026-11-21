import {
  add,
  DIRS,
  eq,
  inBounds,
  isPassable,
  livingUnits,
  pathDistance,
  reachableTiles,
  terrainAt,
  unitAt,
} from './grid';
import type { BattleEvent, BattleState, Intent, Outcome, Pos, Unit } from './types';

export const BUMP_DAMAGE = 1;
export const XP_NORMAL = 1;
export const XP_BOSS = 3;

export const xpToNext = (level: number) => level * 3;

export function getUnit(s: BattleState, id: string): Unit {
  const u = s.units.find((x) => x.id === id);
  if (!u) throw new Error(`unit not found: ${id}`);
  return u;
}

// ---------------------------------------------------------------------------
// Attack geometry
// ---------------------------------------------------------------------------

export interface AttackShape {
  /** tiles the attack visually travels across (for intent/preview drawing) */
  path: Pos[];
  /** tiles that actually receive damage */
  hits: Pos[];
}

/** Geometry of `unit` attacking in `dir` from `origin` (defaults to its position). */
export function attackShape(s: BattleState, unit: Unit, dir: Pos, origin: Pos = unit.pos): AttackShape {
  switch (unit.attack) {
    case 'melee':
    case 'push': {
      const t = add(origin, dir);
      return inBounds(s, t) ? { path: [t], hits: [t] } : { path: [], hits: [] };
    }
    case 'pierce': {
      const tiles = [add(origin, dir), add(add(origin, dir), dir)].filter((p) => inBounds(s, p));
      return { path: tiles, hits: tiles };
    }
    case 'ranged': {
      const path: Pos[] = [];
      let p = origin;
      for (let i = 0; i < unit.range; i++) {
        p = add(p, dir);
        if (!inBounds(s, p) || terrainAt(s, p) === 'mountain') break; // mountains block arrows
        path.push(p);
        const occ = unitAt(s, p);
        if (occ && occ !== unit) return { path, hits: [p] };
      }
      return { path, hits: [] };
    }
  }
}

/** Damage after terrain defense (forest -1, minimum 1). */
export function effectiveDamage(s: BattleState, target: Unit, raw: number) {
  return terrainAt(s, target.pos) === 'forest' ? Math.max(1, raw - 1) : raw;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

function applyDamage(s: BattleState, target: Unit, amount: number, source: Unit | null, ev: BattleEvent[]) {
  if (target.dead || amount <= 0) return;
  target.hp = Math.max(0, target.hp - amount);
  ev.push({ type: 'damage', unitId: target.id, amount, pos: { ...target.pos } });
  if (target.hp === 0) {
    target.dead = true;
    ev.push({ type: 'death', unitId: target.id, pos: { ...target.pos } });
    // Intents of dead enemies are cancelled
    s.intents = s.intents.filter((i) => i.unitId !== target.id);
    if (source && source.side === 'player' && target.side === 'enemy' && !source.dead) {
      gainXp(source, target.isBoss ? XP_BOSS : XP_NORMAL, ev);
    }
  }
}

export function gainXp(unit: Unit, amount: number, ev: BattleEvent[] = []) {
  unit.xp += amount;
  while (unit.xp >= xpToNext(unit.level)) {
    unit.xp -= xpToNext(unit.level);
    unit.level += 1;
    unit.maxHp += 1;
    unit.hp += 1;
    if (unit.level % 2 === 0) unit.power += 1;
    ev.push({ type: 'levelUp', unitId: unit.id, level: unit.level });
  }
  return ev;
}

/** Push `target` one tile in `dir`. Blocked pushes deal bump damage instead. */
export function pushUnit(s: BattleState, target: Unit, dir: Pos, ev: BattleEvent[]) {
  if (target.dead) return;
  const to = add(target.pos, dir);
  const blocker = inBounds(s, to) ? unitAt(s, to) : undefined;
  if (!inBounds(s, to) || !isPassable(terrainAt(s, to)) || blocker) {
    ev.push({ type: 'bump', unitId: target.id, pos: { ...target.pos } });
    applyDamage(s, target, BUMP_DAMAGE, null, ev);
    if (blocker) applyDamage(s, blocker, BUMP_DAMAGE, null, ev);
    return;
  }
  const from = { ...target.pos };
  target.pos = to;
  ev.push({ type: 'pushed', unitId: target.id, from, to: { ...to } });
}

/** Run an attack from `attacker` in `dir`. Shared by player actions and enemy intents. */
export function executeAttack(s: BattleState, attacker: Unit, dir: Pos): BattleEvent[] {
  const ev: BattleEvent[] = [];
  const { hits } = attackShape(s, attacker, dir);
  // Resolve targets first so pushes don't change who gets hit mid-attack
  const targets = hits.map((p) => unitAt(s, p)).filter((u): u is Unit => !!u && u !== attacker);
  for (const t of targets) {
    applyDamage(s, t, effectiveDamage(s, t, attacker.power), attacker, ev);
    if (attacker.attack === 'push') pushUnit(s, t, dir, ev);
  }
  return ev;
}

// ---------------------------------------------------------------------------
// Player actions
// ---------------------------------------------------------------------------

export function canMoveTo(s: BattleState, unit: Unit, to: Pos) {
  if (unit.moved || unit.acted || unit.dead) return false;
  return reachableTiles(s, unit).some((p) => eq(p, to));
}

export function moveUnit(s: BattleState, unit: Unit, to: Pos) {
  if (!canMoveTo(s, unit, to)) throw new Error(`illegal move for ${unit.id}`);
  unit.pos = { ...to };
  unit.moved = true;
}

/** Undo a move. Only allowed before the unit has acted. */
export function undoMove(unit: Unit, from: Pos) {
  if (unit.acted) throw new Error('cannot undo after acting');
  unit.pos = { ...from };
  unit.moved = false;
}

export function playerAttack(s: BattleState, unit: Unit, dir: Pos) {
  if (unit.acted || unit.dead) throw new Error(`${unit.id} cannot act`);
  unit.acted = true;
  unit.moved = true;
  return executeAttack(s, unit, dir);
}

export function waitUnit(unit: Unit) {
  unit.acted = true;
  unit.moved = true;
}

// ---------------------------------------------------------------------------
// Enemy phase
// ---------------------------------------------------------------------------

/** Resolve one declared intent (if its owner is still alive). */
export function resolveIntent(s: BattleState, intent: Intent): BattleEvent[] {
  const u = s.units.find((x) => x.id === intent.unitId);
  if (!u || u.dead) return [];
  return executeAttack(s, u, intent.dir);
}

function scoreAttack(s: BattleState, enemy: Unit, origin: Pos, dir: Pos) {
  // Evaluate as if the enemy stood on `origin`
  const saved = enemy.pos;
  enemy.pos = origin;
  const { hits } = attackShape(s, enemy, dir, origin);
  enemy.pos = saved;
  let score = 0;
  for (const p of hits) {
    const t = unitAt(s, p);
    if (!t || t === enemy) continue;
    if (t.side === 'player') {
      score += 10;
      if (t.isLord) score += 3;
      if (effectiveDamage(s, t, enemy.power) >= t.hp) score += 5;
    } else {
      score -= 6; // avoid friendly fire
    }
  }
  return score;
}

/** Each enemy moves and declares its next attack. Deterministic. */
export function planEnemyTurn(s: BattleState) {
  s.intents = [];
  const players = livingUnits(s, 'player');
  if (!players.length) return;
  for (const e of livingUnits(s, 'enemy')) {
    const candidates = reachableTiles(s, e);
    let best: { pos: Pos; dir: Pos; score: number } | null = null;
    for (const c of candidates) {
      for (const dir of DIRS) {
        const sc = scoreAttack(s, e, c, dir);
        if (sc > 0 && (!best || sc > best.score)) best = { pos: c, dir, score: sc };
      }
    }
    if (best) {
      e.pos = { ...best.pos };
      s.intents.push({ unitId: e.id, dir: best.dir });
      continue;
    }
    // No attack possible: advance toward the closest player unit
    let bestPos = e.pos;
    let bestDist = Infinity;
    for (const c of candidates) {
      const d = Math.min(...players.map((p) => pathDistance(s, c, p.pos)));
      if (d < bestDist) {
        bestDist = d;
        bestPos = c;
      }
    }
    e.pos = { ...bestPos };
  }
}

/** Spawn reinforcements scheduled for the current turn on the nearest free tile. */
export function spawnReinforcements(s: BattleState): Unit[] {
  const spawned: Unit[] = [];
  for (const r of s.reinforcements.filter((r) => r.turn === s.turn)) {
    const spot = nearestFreeTile(s, r.unit.pos);
    if (!spot) continue;
    const u = { ...r.unit, pos: spot };
    s.units.push(u);
    spawned.push(u);
  }
  return spawned;
}

function nearestFreeTile(s: BattleState, p: Pos): Pos | null {
  for (let r = 0; r < Math.max(s.width, s.height); r++) {
    for (let y = p.y - r; y <= p.y + r; y++) {
      for (let x = p.x - r; x <= p.x + r; x++) {
        const t = { x, y };
        if (inBounds(s, t) && isPassable(terrainAt(s, t)) && !unitAt(s, t)) return t;
      }
    }
  }
  return null;
}

export function startPlayerTurn(s: BattleState) {
  for (const u of livingUnits(s, 'player')) {
    u.moved = false;
    u.acted = false;
  }
}

export function checkOutcome(s: BattleState): Outcome {
  const players = livingUnits(s, 'player');
  if (!players.length || s.units.some((u) => u.isLord && u.dead)) return 'defeat';
  if (s.objective.type === 'defeatBoss') {
    return getUnit(s, s.objective.bossId).dead ? 'victory' : 'ongoing';
  }
  return s.turn > s.objective.turns ? 'victory' : 'ongoing';
}

/**
 * Full enemy phase, used by tests and as reference for the scene
 * (the scene runs the same steps one by one so it can animate them).
 */
export function runEnemyPhase(s: BattleState): { events: BattleEvent[]; outcome: Outcome } {
  const events: BattleEvent[] = [];
  for (const intent of [...s.intents]) {
    events.push(...resolveIntent(s, intent));
    const o = checkOutcome(s);
    if (o !== 'ongoing') return { events, outcome: o };
  }
  s.intents = [];
  s.turn += 1;
  const o = checkOutcome(s);
  if (o !== 'ongoing') return { events, outcome: o };
  planEnemyTurn(s);
  spawnReinforcements(s);
  startPlayerTurn(s);
  return { events, outcome: 'ongoing' };
}
