/**
 * Spatial hash for fast radius queries over units. Rebuilt every tick —
 * with a few hundred units this is cheaper and simpler than incremental
 * maintenance, and it keeps the sim allocation-light.
 */
const CELL = 3; // tiles per cell

export class SpatialGrid {
  private cells = new Map<number, number[]>();
  private readonly cols: number;

  constructor(widthTiles: number) {
    this.cols = Math.ceil(widthTiles / CELL) + 2;
  }

  clear(): void {
    this.cells.clear();
  }

  private key(x: number, y: number): number {
    return Math.floor(y / CELL) * this.cols + Math.floor(x / CELL);
  }

  insert(id: number, x: number, y: number): void {
    const k = this.key(x, y);
    const arr = this.cells.get(k);
    if (arr) arr.push(id);
    else this.cells.set(k, [id]);
  }

  /** Collect candidate ids within radius r of (x, y). May contain false positives. */
  query(x: number, y: number, r: number, out: number[]): number[] {
    out.length = 0;
    const c0x = Math.floor((x - r) / CELL);
    const c1x = Math.floor((x + r) / CELL);
    const c0y = Math.floor((y - r) / CELL);
    const c1y = Math.floor((y + r) / CELL);
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const arr = this.cells.get(cy * this.cols + cx);
        if (arr) for (const id of arr) out.push(id);
      }
    }
    return out;
  }
}
