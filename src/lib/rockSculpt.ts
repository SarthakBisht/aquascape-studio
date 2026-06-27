// Direct 3D rock sculpting — the "Blender" path. A rock starts as a deterministic
// parametric mesh (see proceduralRock.ts); once the user sculpts it we keep a
// per-vertex vec3 *displacement* from that welded base. The clay brushes (Grab /
// Flatten / Pinch) move verts in arbitrary directions, so a scalar "along normal"
// offset isn't enough — the buffer is a full vec3 per welded vertex.
//
// On load: rebuild the welded base (deterministic) → add this displacement →
// computeVertexNormals. So we persist only the small offset buffer, not a mesh.
//
// Everything here is pure array math (no three, no DOM beyond base64) so it has a
// node-runnable self-check, like terrain.ts / autoScape.ts. Each brush mutates
// `disp` (the persisted accumulator) AND `positions` (the live geometry) in
// lockstep so positions stays == base + disp without re-deriving the base.

/** Quantization range in base-space units (the base mesh is ~unit-radius). A
 *  sculpt offset beyond ±RANGE clamps; int16 over this gives sub-mm precision. */
export const RANGE = 2;

// ---- base64 (works in browser and node) ----
function toB64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function fromB64(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(b64, "base64"));
  const s = atob(b64);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

/** Quantize a vec3 displacement buffer to int16 (±RANGE) → base64. */
export function encodeDisp(disp: Float32Array): string {
  const q = new Int16Array(disp.length);
  for (let i = 0; i < disp.length; i++) {
    const v = Math.max(-1, Math.min(1, disp[i] / RANGE));
    q[i] = Math.round(v * 32767);
  }
  return toB64(new Uint8Array(q.buffer));
}

/** Decode a base64 int16 buffer back to a vec3 displacement Float32Array.
 *  Returns a zero buffer if the length doesn't match the expected vert count
 *  (e.g. a param-lock mismatch) — the caller treats that as "un-sculpted". */
export function decodeDisp(b64: string, vcount: number): Float32Array {
  const out = new Float32Array(vcount * 3);
  try {
    const bytes = fromB64(b64);
    const q = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength >> 1);
    if (q.length !== out.length) return out;
    for (let i = 0; i < q.length; i++) out[i] = (q[i] / 32767) * RANGE;
  } catch {
    /* malformed → un-sculpted */
  }
  return out;
}

export interface Affected {
  idx: number[];
  fall: number[];
}

/** Verts within `radius` of a local point, with a gaussian-ish falloff (mirrors
 *  terrain.ts sculptField). `positions` is the live local-space vertex buffer. */
export function affected(
  positions: Float32Array,
  cx: number,
  cy: number,
  cz: number,
  radius: number,
): Affected {
  const r2 = radius * radius;
  const idx: number[] = [];
  const fall: number[] = [];
  const n = positions.length / 3;
  for (let i = 0; i < n; i++) {
    const dx = positions[i * 3] - cx;
    const dy = positions[i * 3 + 1] - cy;
    const dz = positions[i * 3 + 2] - cz;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > r2) continue;
    idx.push(i);
    fall.push(Math.exp((-d2 / r2) * 2.2));
  }
  return { idx, fall };
}

function add(disp: Float32Array, positions: Float32Array, i: number, dx: number, dy: number, dz: number) {
  disp[i * 3] += dx;
  disp[i * 3 + 1] += dy;
  disp[i * 3 + 2] += dz;
  positions[i * 3] += dx;
  positions[i * 3 + 1] += dy;
  positions[i * 3 + 2] += dz;
}

/** Averaged, normalized normal over the affected region. Push/pull uses ONE
 *  coherent direction (like grab) instead of each vertex's own normal — per-vertex
 *  normals on a bumpy surface diverge and tear the mesh into spikes/holes. */
export function regionNormal(normals: Float32Array, aff: Affected) {
  let x = 0, y = 0, z = 0;
  for (const i of aff.idx) {
    x += normals[i * 3];
    y += normals[i * 3 + 1];
    z += normals[i * 3 + 2];
  }
  const l = Math.hypot(x, y, z) || 1;
  return { x: x / l, y: y / l, z: z / l };
}

/** Draw: push out (dir>0) / carve in (dir<0) along the vertex normal. */
export function draw(
  disp: Float32Array,
  positions: Float32Array,
  normals: Float32Array,
  aff: Affected,
  amount: number, // strength * dir, signed
) {
  for (let k = 0; k < aff.idx.length; k++) {
    const i = aff.idx[k];
    const a = amount * aff.fall[k];
    add(disp, positions, i, normals[i * 3] * a, normals[i * 3 + 1] * a, normals[i * 3 + 2] * a);
  }
}

/** Grab: translate the affected region by a local-space delta (the component
 *  derives the delta from the camera-facing drag). */
export function grab(
  disp: Float32Array,
  positions: Float32Array,
  aff: Affected,
  gx: number,
  gy: number,
  gz: number,
) {
  for (let k = 0; k < aff.idx.length; k++) {
    const i = aff.idx[k];
    const f = aff.fall[k];
    add(disp, positions, i, gx * f, gy * f, gz * f);
  }
}

/** Per-vertex neighbour list from an indexed (welded) geometry — needed for a
 *  real Laplacian smooth so brushing can't tear the surface into shards. */
export function buildAdjacency(index: ArrayLike<number>, vcount: number): number[][] {
  const sets: Set<number>[] = Array.from({ length: vcount }, () => new Set<number>());
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i], b = index[i + 1], c = index[i + 2];
    sets[a].add(b); sets[a].add(c);
    sets[b].add(a); sets[b].add(c);
    sets[c].add(a); sets[c].add(b);
  }
  return sets.map((s) => Array.from(s));
}

/** Smooth: Laplacian relax — move each affected vertex toward the average of its
 *  mesh neighbours. This is what keeps sculpting manifold-smooth instead of
 *  spiking into shards; also used as a light auto-smooth after the draw brush. */
export function smooth(
  disp: Float32Array,
  positions: Float32Array,
  adj: number[][],
  aff: Affected,
  amount: number,
) {
  for (let k = 0; k < aff.idx.length; k++) {
    const i = aff.idx[k];
    const nb = adj[i];
    if (!nb.length) continue;
    let ax = 0, ay = 0, az = 0;
    for (const j of nb) {
      ax += positions[j * 3];
      ay += positions[j * 3 + 1];
      az += positions[j * 3 + 2];
    }
    ax /= nb.length; ay /= nb.length; az /= nb.length;
    const t = amount * aff.fall[k];
    add(
      disp, positions, i,
      (ax - positions[i * 3]) * t,
      (ay - positions[i * 3 + 1]) * t,
      (az - positions[i * 3 + 2]) * t,
    );
  }
}

/** Clamp each affected vertex's displacement length to maxLen (prevents
 *  punch-through / runaway spikes), re-syncing positions = base + disp. */
export function clampLen(
  disp: Float32Array,
  positions: Float32Array,
  base: Float32Array,
  aff: Affected,
  maxLen: number,
) {
  const m2 = maxLen * maxLen;
  for (const i of aff.idx) {
    let x = disp[i * 3], y = disp[i * 3 + 1], z = disp[i * 3 + 2];
    const d2 = x * x + y * y + z * z;
    if (d2 > m2) {
      const s = maxLen / Math.sqrt(d2);
      x *= s; y *= s; z *= s;
      disp[i * 3] = x; disp[i * 3 + 1] = y; disp[i * 3 + 2] = z;
    }
    positions[i * 3] = base[i * 3] + x;
    positions[i * 3 + 1] = base[i * 3 + 1] + y;
    positions[i * 3 + 2] = base[i * 3 + 2] + z;
  }
}

/** Flatten: press the affected verts toward their average plane (centroid +
 *  mean normal). `amount` 0..1. */
export function flatten(
  disp: Float32Array,
  positions: Float32Array,
  normals: Float32Array,
  aff: Affected,
  amount: number,
) {
  let px = 0, py = 0, pz = 0, nx = 0, ny = 0, nz = 0;
  for (const i of aff.idx) {
    px += positions[i * 3]; py += positions[i * 3 + 1]; pz += positions[i * 3 + 2];
    nx += normals[i * 3]; ny += normals[i * 3 + 1]; nz += normals[i * 3 + 2];
  }
  const n = aff.idx.length || 1;
  px /= n; py /= n; pz /= n;
  const nl = Math.hypot(nx, ny, nz) || 1;
  nx /= nl; ny /= nl; nz /= nl;
  for (let k = 0; k < aff.idx.length; k++) {
    const i = aff.idx[k];
    const d =
      (positions[i * 3] - px) * nx +
      (positions[i * 3 + 1] - py) * ny +
      (positions[i * 3 + 2] - pz) * nz;
    const m = -d * amount * aff.fall[k];
    add(disp, positions, i, nx * m, ny * m, nz * m);
  }
}

/** Pinch: draw the affected verts toward the brush center → sharpens ridges. */
export function pinch(
  disp: Float32Array,
  positions: Float32Array,
  aff: Affected,
  cx: number,
  cy: number,
  cz: number,
  amount: number,
) {
  for (let k = 0; k < aff.idx.length; k++) {
    const i = aff.idx[k];
    const t = amount * aff.fall[k];
    add(
      disp, positions, i,
      (cx - positions[i * 3]) * t,
      (cy - positions[i * 3 + 1]) * t,
      (cz - positions[i * 3 + 2]) * t,
    );
  }
}

// ponytail: one runnable check — encode/decode round-trips, draw obeys falloff,
// smooth reduces variance. Run: node --experimental-strip-types src/lib/rockSculpt.ts
function demo() {
  // encode/decode round-trip within quantization tolerance
  const src = new Float32Array([0, 0.5, -1.2, 1.9, -0.001, 0.75]);
  const back = decodeDisp(encodeDisp(src), 2);
  const tol = (RANGE / 32767) * 2;
  for (let i = 0; i < src.length; i++) {
    if (Math.abs(src[i] - back[i]) > tol) throw new Error("encode/decode drift");
  }
  // a longer length mismatch decodes to zeros (un-sculpted guard)
  if (decodeDisp(encodeDisp(src), 99).some((v) => v !== 0)) throw new Error("mismatch not zeroed");

  // flat grid on the y=0 plane, normals +y. draw center → center rises more than edge.
  const N = 11;
  const pos = new Float32Array(N * N * 3);
  const nrm = new Float32Array(N * N * 3);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const k = j * N + i;
      pos[k * 3] = i - 5;
      pos[k * 3 + 2] = j - 5;
      nrm[k * 3 + 1] = 1;
    }
  const disp = new Float32Array(pos.length);
  draw(disp, pos, nrm, affected(pos, 0, 0, 0, 4), 1);
  const center = disp[(5 * N + 5) * 3 + 1];
  const edge = disp[(5 * N + 8) * 3 + 1];
  if (!(center > edge && edge > 0)) throw new Error("draw falloff wrong");

  // 4-neighbour adjacency for the grid
  const adj: number[][] = Array.from({ length: N * N }, () => [] as number[]);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const k = j * N + i;
      if (i > 0) adj[k].push(k - 1);
      if (i < N - 1) adj[k].push(k + 1);
      if (j > 0) adj[k].push(k - N);
      if (j < N - 1) adj[k].push(k + N);
    }

  // a spike's height above its neighbours shrinks after a Laplacian smooth
  const c = 5 * N + 5;
  const nbAvg = () => adj[c].reduce((s, j) => s + pos[j * 3 + 1], 0) / adj[c].length;
  const before = Math.abs(pos[c * 3 + 1] - nbAvg());
  smooth(disp, pos, adj, affected(pos, 0, 0, 0, 4), 0.8);
  if (!(Math.abs(pos[c * 3 + 1] - nbAvg()) < before))
    throw new Error("smooth did not relax the spike");

  // clampLen bounds the displacement length and keeps positions = base + disp
  const base = new Float32Array(pos.length); // flat plane base (y already in pos)
  for (let i = 0; i < base.length; i++) base[i] = pos[i] - disp[i];
  disp[c * 3 + 1] = 99;
  clampLen(disp, pos, base, { idx: [c], fall: [1] }, 2);
  const len = Math.hypot(disp[c * 3], disp[c * 3 + 1], disp[c * 3 + 2]);
  if (len > 2 + 1e-6) throw new Error("clampLen did not bound length");
  if (Math.abs(pos[c * 3 + 1] - (base[c * 3 + 1] + disp[c * 3 + 1])) > 1e-6)
    throw new Error("clampLen did not resync positions");

  // regionNormal of all-+y normals is +y
  const rn = regionNormal(nrm, affected(pos, 0, 0, 0, 4));
  if (Math.abs(rn.y - 1) > 1e-6 || Math.abs(rn.x) > 1e-6)
    throw new Error("regionNormal wrong");

  console.log("rockSculpt demo OK");
}

if (
  typeof process !== "undefined" &&
  process.argv?.[1] &&
  process.argv[1].includes("rockSculpt")
) {
  demo();
}
