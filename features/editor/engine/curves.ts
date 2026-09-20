import type { CurvePoint } from '../types'

/**
 * Monotone cubic (Fritsch–Carlson) interpolation of control points into a
 * 256-entry lookup table. Monotone interpolation avoids the overshoot that
 * natural cubic splines produce, which would cause banding at the extremes.
 */
export function curveToLut(points: CurvePoint[]): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256)
  const pts = [...points].sort((a, b) => a.x - b.x)
  if (pts.length === 0) {
    for (let i = 0; i < 256; i++) lut[i] = i
    return lut
  }
  if (pts.length === 1) {
    lut.fill(pts[0].y)
    return lut
  }

  const n = pts.length
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const dx: number[] = []
  const dy: number[] = []
  const m: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx.push(xs[i + 1] - xs[i] || 1e-6)
    dy.push(ys[i + 1] - ys[i])
    m.push(dy[i] / dx[i])
  }
  const tangents: number[] = new Array(n).fill(0)
  tangents[0] = m[0]
  tangents[n - 1] = m[n - 2]
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) {
      tangents[i] = 0
    } else {
      const w1 = 2 * dx[i] + dx[i - 1]
      const w2 = dx[i] + 2 * dx[i - 1]
      tangents[i] = (w1 + w2) / (w1 / m[i - 1] + w2 / m[i])
    }
  }

  let seg = 0
  for (let x = 0; x < 256; x++) {
    if (x <= xs[0]) {
      lut[x] = ys[0]
      continue
    }
    if (x >= xs[n - 1]) {
      lut[x] = ys[n - 1]
      continue
    }
    while (seg < n - 2 && x > xs[seg + 1]) seg++
    const h = dx[seg]
    const t = (x - xs[seg]) / h
    const t2 = t * t
    const t3 = t2 * t
    const h00 = 2 * t3 - 3 * t2 + 1
    const h10 = t3 - 2 * t2 + t
    const h01 = -2 * t3 + 3 * t2
    const h11 = t3 - t2
    const y =
      h00 * ys[seg] +
      h10 * h * tangents[seg] +
      h01 * ys[seg + 1] +
      h11 * h * tangents[seg + 1]
    lut[x] = y
  }
  return lut
}

export function isIdentityCurve(points: CurvePoint[]): boolean {
  return (
    points.length === 2 &&
    points[0].x === 0 &&
    points[0].y === 0 &&
    points[1].x === 255 &&
    points[1].y === 255
  )
}
