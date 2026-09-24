/**
 * Single-camera focus lock, in the same family as iPhone 16e Portrait
 * (ML depth from one lens) and Samsung / Xiaomi object Live Focus.
 * MODNet is people-first; this finds a product, pet, or other object when
 * the portrait matte is empty, full-frame, or missing.
 */
import { clusterBorderColors } from './background-removal'
import { growSubjectKeep } from './local-enhance'

export function isUsableSubjectMatte(matte: Uint8ClampedArray, width: number, height: number): boolean {
  if (matte.length < width * height) return false
  let subject = 0
  let border = 0
  let borderN = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const on = matte[y * width + x] > 127
      if (on) subject++
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        borderN++
        if (on) border++
      }
    }
  }
  const frac = subject / Math.max(1, width * height)
  if (frac < 0.045 || frac > 0.82) return false
  // A matte that paints most of the frame border is "everything is subject".
  if (border / Math.max(1, borderN) > 0.72 && frac > 0.55) return false
  return true
}

export function keepToMatte(keep: Float32Array): Uint8ClampedArray {
  const matte = new Uint8ClampedArray(keep.length)
  for (let i = 0; i < keep.length; i++) matte[i] = keep[i] > 0.5 ? 255 : Math.round(Math.max(0, Math.min(1, keep[i])) * 255)
  return matte
}

/**
 * Focus object from one RGB frame: colour unlike the border, mid-frame prior,
 * local contrast. Same cues a single-camera phone uses before it has a depth map.
 */
export function objectFocusKeep(data: Uint8ClampedArray, width: number, height: number): Float32Array | null {
  const n = width * height
  if (data.length < n * 4) return null
  const clusters = clusterBorderColors(data, width, height)
  const score = new Float32Array(n)
  const cx = (width - 1) * 0.5
  const cy = (height - 1) * 0.52
  const rx = Math.max(8, width * 0.46)
  const ry = Math.max(8, height * 0.5)

  for (let y = 0; y < height; y++) {
    const yu = y > 0 ? y - 1 : y
    const yd = y + 1 < height ? y + 1 : y
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const p = i * 4
      const r = data[p]
      const g = data[p + 1]
      const b = data[p + 2]
      let uniq = 255
      for (const c of clusters) {
        const d = Math.hypot(r - c[0], g - c[1], b - c[2])
        if (d < uniq) uniq = d
      }
      const xl = x > 0 ? x - 1 : x
      const xr = x + 1 < width ? x + 1 : x
      const L = (xx: number, yy: number) => {
        const q = (yy * width + xx) * 4
        return 0.299 * data[q] + 0.587 * data[q + 1] + 0.114 * data[q + 2]
      }
      const contrast = Math.min(48, Math.hypot(L(xr, y) - L(xl, y), L(x, yd) - L(x, yu)))
      const center = Math.max(0, 1 - Math.hypot((x - cx) / rx, (y - cy) / ry))
      let s = (uniq / 180) * 0.5 + (contrast / 48) * 0.18 + center * 0.32
      if (b > r + 8 && b > g + 4 && b > 80) s *= 0.22
      if (g > r + 12 && g > b + 8 && g > 50) s *= 0.38
      score[i] = s
    }
  }

  const keep = thresholdLargestComponent(score, width, height)
  if (!keep) return null
  return growSubjectKeep(data, width, height, keep)
}

function thresholdLargestComponent(score: Float32Array, width: number, height: number): Float32Array | null {
  const n = width * height
  const copy = Array.from(score).sort((a, b) => a - b)
  const cut = Math.max(0.34, copy[Math.min(n - 1, Math.floor(n * 0.62))] ?? 0.34)
  const seed = new Uint8Array(n)
  let seeded = 0
  for (let i = 0; i < n; i++) {
    if (score[i] >= cut) {
      seed[i] = 1
      seeded++
    }
  }
  if (seeded < n * 0.03) return null

  const label = new Int32Array(n)
  const stack = new Int32Array(n)
  let best = 0
  let bestCount = 0
  let next = 1
  for (let i = 0; i < n; i++) {
    if (!seed[i] || label[i]) continue
    let top = 0
    stack[top++] = i
    label[i] = next
    let count = 0
    while (top > 0) {
      const p = stack[--top]
      count++
      const x = p % width
      const y = (p / width) | 0
      const tryPush = (np: number) => {
        if (np < 0 || np >= n || !seed[np] || label[np]) return
        label[np] = next
        stack[top++] = np
      }
      if (x > 0) tryPush(p - 1)
      if (x + 1 < width) tryPush(p + 1)
      if (y > 0) tryPush(p - width)
      if (y + 1 < height) tryPush(p + width)
    }
    if (count > bestCount) {
      bestCount = count
      best = next
    }
    next++
  }
  if (best === 0 || bestCount < n * 0.03 || bestCount > n * 0.82) return null

  const keep = new Float32Array(n)
  for (let i = 0; i < n; i++) if (label[i] === best) keep[i] = 1
  fillInteriorHoles(keep, width, height)
  return keep
}

function fillInteriorHoles(keep: Float32Array, width: number, height: number) {
  const n = width * height
  const outside = new Uint8Array(n)
  const stack = new Int32Array(n)
  let top = 0
  const push = (i: number) => {
    if (i < 0 || i >= n || outside[i] || keep[i] > 0.5) return
    outside[i] = 1
    stack[top++] = i
  }
  for (let x = 0; x < width; x++) {
    push(x)
    push((height - 1) * width + x)
  }
  for (let y = 0; y < height; y++) {
    push(y * width)
    push(y * width + width - 1)
  }
  while (top > 0) {
    const p = stack[--top]
    const x = p % width
    const y = (p / width) | 0
    if (x > 0) push(p - 1)
    if (x + 1 < width) push(p + 1)
    if (y > 0) push(p - width)
    if (y + 1 < height) push(p + width)
  }
  for (let i = 0; i < n; i++) {
    if (keep[i] <= 0.5 && !outside[i]) keep[i] = 1
  }
}
