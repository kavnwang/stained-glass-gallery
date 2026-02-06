/**
 * Voronoi tessellation for stained glass effect.
 * Uses Delaunator to compute Delaunay triangulation,
 * then derives Voronoi cells (irregular polygons) from circumcenters.
 */

import Delaunator from "delaunator";

export interface Point {
  x: number;
  y: number;
}

export interface VoronoiCell {
  id: number;
  seed: Point;
  vertices: Point[];
}

/* ── helpers ─────────────────────────────────────────────── */

function circumcenter(
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number
): Point {
  const dx = bx - ax, dy = by - ay;
  const ex = cx - ax, ey = cy - ay;
  const bl = dx * dx + dy * dy;
  const cl = ex * ex + ey * ey;
  const det = dx * ey - dy * ex;

  // Degenerate triangle – fall back to centroid
  if (Math.abs(det) < 1e-10) {
    return { x: (ax + bx + cx) / 3, y: (ay + by + cy) / 3 };
  }

  const d = 0.5 / det;
  return {
    x: ax + (ey * bl - dy * cl) * d,
    y: ay + (dx * cl - ex * bl) * d,
  };
}

function prevHalfedge(e: number): number {
  return e % 3 === 0 ? e + 2 : e - 1;
}

/* ── Sutherland-Hodgman polygon clipping ─────────────────── */

function clipPolygon(
  polygon: Point[],
  width: number,
  height: number
): Point[] {
  let output = polygon;

  const clips: Array<{
    inside: (p: Point) => boolean;
    intersect: (a: Point, b: Point) => Point;
  }> = [
    {
      inside: (p) => p.x >= 0,
      intersect: (a, b) => {
        const t = -a.x / (b.x - a.x);
        return { x: 0, y: a.y + t * (b.y - a.y) };
      },
    },
    {
      inside: (p) => p.x <= width,
      intersect: (a, b) => {
        const t = (width - a.x) / (b.x - a.x);
        return { x: width, y: a.y + t * (b.y - a.y) };
      },
    },
    {
      inside: (p) => p.y >= 0,
      intersect: (a, b) => {
        const t = -a.y / (b.y - a.y);
        return { x: a.x + t * (b.x - a.x), y: 0 };
      },
    },
    {
      inside: (p) => p.y <= height,
      intersect: (a, b) => {
        const t = (height - a.y) / (b.y - a.y);
        return { x: a.x + t * (b.x - a.x), y: height };
      },
    },
  ];

  for (const { inside, intersect } of clips) {
    const input = output;
    output = [];
    if (input.length === 0) break;

    let prev = input[input.length - 1];
    for (const curr of input) {
      if (inside(curr)) {
        if (!inside(prev)) output.push(intersect(prev, curr));
        output.push(curr);
      } else if (inside(prev)) {
        output.push(intersect(prev, curr));
      }
      prev = curr;
    }
  }

  return output;
}

/* ── seeded PRNG (mulberry32) ─────────────────────────────── */

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── main API ────────────────────────────────────────────── */

/**
 * Generate `numCells` Voronoi cells that tile the given rectangle.
 * Each cell is an irregular polygon – perfect for a stained-glass look.
 *
 * When `seed` is provided the layout is deterministic – the same seed
 * always produces the same tessellation.
 */
export function generateVoronoiCells(
  width: number,
  height: number,
  numCells: number = 120,
  seed?: string
): VoronoiCell[] {
  const rand = seed !== undefined
    ? mulberry32(hashString(seed))
    : Math.random;

  /* 1. Jittered-grid seed points -------------------------------- */
  const seeds: Point[] = [];
  const aspect = width / height;
  const cols = Math.round(Math.sqrt(numCells * aspect));
  const rows = Math.round(numCells / cols);
  const cellW = width / cols;
  const cellH = height / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (seeds.length >= numCells) break;
      seeds.push({
        x: Math.max(1, Math.min(width - 1, (c + 0.5) * cellW + (rand() - 0.5) * cellW * 0.7)),
        y: Math.max(1, Math.min(height - 1, (r + 0.5) * cellH + (rand() - 0.5) * cellH * 0.7)),
      });
    }
  }
  while (seeds.length < numCells) {
    seeds.push({
      x: rand() * (width - 2) + 1,
      y: rand() * (height - 2) + 1,
    });
  }
  seeds.length = numCells;

  /* 2. Padding points (ensure all real points are interior) ----- */
  const pad = Math.max(width, height) * 3;
  const padding: Point[] = [
    { x: -pad, y: -pad },
    { x: width / 2, y: -pad },
    { x: width + pad, y: -pad },
    { x: width + pad, y: height / 2 },
    { x: width + pad, y: height + pad },
    { x: width / 2, y: height + pad },
    { x: -pad, y: height + pad },
    { x: -pad, y: height / 2 },
  ];

  const allPoints = [...seeds, ...padding];
  const n = allPoints.length;
  const coords = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) {
    coords[2 * i] = allPoints[i].x;
    coords[2 * i + 1] = allPoints[i].y;
  }

  /* 3. Delaunay triangulation ----------------------------------- */
  const del = new Delaunator(coords);
  const { triangles, halfedges } = del;

  /* 4. Circumcenters (= Voronoi vertices) ----------------------- */
  const triCount = triangles.length / 3;
  const cc: Point[] = new Array(triCount);
  for (let t = 0; t < triCount; t++) {
    const i0 = triangles[3 * t],
      i1 = triangles[3 * t + 1],
      i2 = triangles[3 * t + 2];
    cc[t] = circumcenter(
      coords[2 * i0], coords[2 * i0 + 1],
      coords[2 * i1], coords[2 * i1 + 1],
      coords[2 * i2], coords[2 * i2 + 1]
    );
  }

  /* 5. Point → any incident halfedge map ------------------------ */
  const pointEdge = new Int32Array(n).fill(-1);
  for (let e = 0; e < triangles.length; e++) {
    const p = triangles[e];
    // Prefer hull edges so walk starts properly
    if (pointEdge[p] === -1 || halfedges[e] === -1) {
      pointEdge[p] = e;
    }
  }

  /* 6. Walk around each seed to collect Voronoi cell vertices --- */
  const cells: VoronoiCell[] = [];

  for (let i = 0; i < numCells; i++) {
    const e0 = pointEdge[i];
    if (e0 === -1) continue;

    const vertices: Point[] = [];
    let e = e0;
    let safety = 0;
    do {
      vertices.push(cc[Math.floor(e / 3)]);
      const opp = halfedges[prevHalfedge(e)];
      if (opp === -1) break; // should not happen for padded interior points
      e = opp;
      if (++safety > 200) break;
    } while (e !== e0);

    if (vertices.length < 3) continue;

    const clipped = clipPolygon(vertices, width, height);
    if (clipped.length < 3) continue;

    cells.push({ id: i, seed: seeds[i], vertices: clipped });
  }

  return cells;
}
