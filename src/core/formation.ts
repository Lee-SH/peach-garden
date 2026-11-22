/**
 * 2D formation grid: 3 columns (depth) × 3 rows (lanes).
 * The column decides the role — col 0 = 선봉 (front, nearest the enemy), 1 = 중군, 2 = 후군.
 * Rows only change where a general stands on screen.
 */
export interface Cell {
  col: number;
  row: number;
}

/** general id → cell */
export type Positions = Record<string, Cell>;

export const GRID_COLS = 3;
export const GRID_ROWS = 3;

/** Default rows when converting an ordered list (legacy saves, tests): front centre, middle top, rear bottom. */
const ORDER_ROWS = [1, 0, 2];

export const DEFAULT_POSITIONS: Positions = fromOrder(['guanyu', 'liubei', 'zhangfei']);

/** [선봉, 중군, 후군] order → one general per column. */
export function fromOrder(order: string[]): Positions {
  const p: Positions = {};
  order.forEach((id, i) => (p[id] = { col: Math.min(i, GRID_COLS - 1), row: ORDER_ROWS[i] ?? 1 }));
  return p;
}

export const sameCell = (a: Cell, b: Cell) => a.col === b.col && a.row === b.row;

const inGrid = (c: Cell) => c.col >= 0 && c.col < GRID_COLS && c.row >= 0 && c.row < GRID_ROWS;

/** Who stands on a cell (undefined = empty). */
export function occupant(p: Positions, cell: Cell): string | undefined {
  return Object.keys(p).find((id) => sameCell(p[id], cell));
}

/**
 * Valid positions for exactly `ids`: keeps saved cells that are in the grid and not taken,
 * and puts anyone else on the first free cell (front column first, centre row first).
 */
export function normalizePositions(saved: Positions | undefined, ids: string[]): Positions {
  const p: Positions = {};
  const rest: string[] = [];
  for (const id of ids) {
    const c = saved?.[id];
    if (c && inGrid(c) && !occupant(p, c)) p[id] = { col: c.col, row: c.row };
    else rest.push(id);
  }
  for (const id of rest) {
    const free = allCells().find((c) => !occupant(p, c));
    if (free) p[id] = free;
  }
  return p;
}

/** Drag `id` onto `cell`: an empty cell → move there; another general's cell → swap. Pure. */
export function moveTo(p: Positions, id: string, cell: Cell): Positions {
  if (!p[id] || !inGrid(cell)) return p;
  const next: Positions = { ...p };
  const other = occupant(p, cell);
  if (other && other !== id) next[other] = p[id];
  next[id] = { ...cell };
  return next;
}

/** Cells ordered front column first, centre row first. */
function allCells(): Cell[] {
  const rows = [1, 0, 2];
  const cells: Cell[] = [];
  for (let col = 0; col < GRID_COLS; col++) for (const row of rows) cells.push({ col, row });
  return cells;
}

/** Screen position of a cell (shared by the formation and battle screens). */
export const CELL_X = [152, 98, 44];
export const CELL_Y = [232, 294, 356];
export const cellSpot = (c: Cell) => ({ x: CELL_X[c.col], y: CELL_Y[c.row] });
