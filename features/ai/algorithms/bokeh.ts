import { unsharpMask } from './filters'

/**
 * Depth-based disc bokeh (not a flat Gaussian).
 *
 * Pipeline:
 *   1. Optional highlight boost (bright points become orbs after the blur)
 *   2. Variable-radius disc sampling from a depth map (1 = near / subject)
 *   3. Occlusion weights so the sharp subject does not smear into the background
 *   4. Paste the subject back in focus, with a light 10% unsharp on those pixels only
 *
 * WebGL is used when a context is available; otherwise a CPU disc kernel
 * runs at a working resolution so 12MP stills stay interactive.
 */
export interface BokehParams {
  maxBlurRadius: number
  /** Depth at/above this stays fully sharp (1 = nearest). */
  subjectThreshold: number
  /** >1 keeps mid-ground (architecture) more readable than the far lights. */
  depthGamma: number
  highlightThreshold: number
  highlightGain: number
  samples: number
}

export const DEFAULT_BOKEH: BokehParams = {
  maxBlurRadius: 16,
  subjectThreshold: 0.58,
  depthGamma: 1.45,
  highlightThreshold: 0.78,
  highlightGain: 1.35,
  samples: 28,
}

/**
 * Locked 25 September 2026. Circle of confusion as a fraction of the short
 * side, opened 24%, then 20%, then 5%. Do not change these three values.
 * The old absolute cap (~15px) stayed sharp on a real photo.
 */
export const BACKGROUND_DISC = 1.24 * 1.2 * 1.05
export const PORTRAIT_DISC = 0.018 * BACKGROUND_DISC
/** Camera-style sharpness on the in-focus subject only. Locked. */
export const SUBJECT_SHARPNESS = 0.1
/** Default strength inside phoneBlurRadius. Locked look. */
export const LOCKED_BLUR_STRENGTH = 0.84
/**
 * Manual Background control, centred on the lock.
 * 0 is a bit more focus (disc × 0.75, shown as f/4).
 * 50 is the locked look (disc × 1, shown as f/2).
 * 100 is a bit more blur (disc × 1.25, shown as f/1.4).
 */
export const LOCKED_DISC_FOCUS = 50
export const DISC_SCALE_MIN = 0.75
export const DISC_SCALE_MAX = 1.25

const GOLDEN_ANGLE = 2.399963229728653
const GPU_WORK_EDGE = 1440
const CPU_WORK_EDGE = 800
const GPU_MIN_PIXELS = 96 * 96

let gpuAvailable: boolean | null = null

/** Locked portrait disc. `strength` 0.84 is the approved look. */
export function phoneBlurRadius(minEdge: number, strength = LOCKED_BLUR_STRENGTH): number {
  const s = Math.max(0, Math.min(1, strength))
  const edge = Math.max(64, minEdge)
  return clampBokehRadius(edge * PORTRAIT_DISC * (0.82 + 0.18 * s), edge, edge)
}

/** Maps the Background slider onto a disc scale. 50 returns 1. */
export function discScaleFromFocus(focus: number): number {
  const t = Math.max(0, Math.min(100, focus))
  if (t <= LOCKED_DISC_FOCUS) {
    const u = t / LOCKED_DISC_FOCUS
    return DISC_SCALE_MIN + (1 - DISC_SCALE_MIN) * u
  }
  const u = (t - LOCKED_DISC_FOCUS) / (100 - LOCKED_DISC_FOCUS)
  return 1 + (DISC_SCALE_MAX - 1) * u
}

/**
 * Locked radius at focus 50. Below 50 the background is a bit more in focus.
 * Above 50 the disc opens a bit, up to DISC_SCALE_MAX.
 */
export function blurRadiusForDisc(minEdge: number, focus = LOCKED_DISC_FOCUS): number {
  const locked = phoneBlurRadius(minEdge, LOCKED_BLUR_STRENGTH)
  const scale = discScaleFromFocus(focus)
  const edge = Math.max(64, minEdge)
  const cap = Math.max(6, Math.round(edge * PORTRAIT_DISC * DISC_SCALE_MAX))
  return Math.max(2, Math.min(Math.round(locked * scale), cap))
}

/** f-stop label for the Background slider. Centre is the locked look. */
export function discFocusLabel(focus: number): string {
  const f = Math.max(0, Math.min(100, Math.round(focus)))
  if (f === LOCKED_DISC_FOCUS) return 'f/2 locked'
  const aperture =
    f < LOCKED_DISC_FOCUS
      ? 2 + ((LOCKED_DISC_FOCUS - f) / LOCKED_DISC_FOCUS) * 2
      : 2 - ((f - LOCKED_DISC_FOCUS) / (100 - LOCKED_DISC_FOCUS)) * 0.6
  return `f/${aperture.toFixed(1)}`
}

/**
 * Ceiling is the manual maximum (locked disc × 1.25), so the Background
 * slider can open the disc a bit. The locked call still returns the
 * approved radius, which sits under this cap.
 */
export function clampBokehRadius(radius: number, width: number, height: number): number {
  const edge = Math.max(1, Math.min(width, height))
  const cap = Math.max(6, Math.round(edge * PORTRAIT_DISC * DISC_SCALE_MAX))
  const asked = Number.isFinite(radius) ? radius : Math.round(edge * PORTRAIT_DISC)
  return Math.max(2, Math.min(Math.round(asked), cap))
}

export function blurRadiusForDepth(depth: number, params: BokehParams): number {
  const threshold = Number.isFinite(params.subjectThreshold) ? params.subjectThreshold : DEFAULT_BOKEH.subjectThreshold
  const gamma = Number.isFinite(params.depthGamma) ? params.depthGamma : DEFAULT_BOKEH.depthGamma
  const maxR = Number.isFinite(params.maxBlurRadius) ? params.maxBlurRadius : DEFAULT_BOKEH.maxBlurRadius
  if (depth >= threshold) return 0
  const t = 1 - depth / Math.max(1e-6, threshold)
  return Math.pow(Math.max(0, Math.min(1, t)), gamma) * maxR
}

export function boostHighlights(
  data: Uint8ClampedArray,
  threshold = DEFAULT_BOKEH.highlightThreshold,
  gain = DEFAULT_BOKEH.highlightGain,
): Float32Array {
  const out = new Float32Array(data.length)
  const t0 = threshold * 255
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const luma = 0.299 * r + 0.587 * g + 0.114 * b
    let scale = 1
    if (luma > t0) {
      const t = (luma - t0) / Math.max(1, 255 - t0)
      scale = 1 + t * t * gain
    }
    out[i] = r * scale
    out[i + 1] = g * scale
    out[i + 2] = b * scale
    out[i + 3] = data[i + 3]
  }
  return out
}

/** 0..1 per pixel. Text strokes and hard graphics sit at the high end; sky
 *  speculars sit at the low end — used to kill highlight-orb boost on glyphs. */
export function lumaGradientMap(data: Uint8ClampedArray, width: number, height: number): Float32Array {
  const out = new Float32Array(width * height)
  const L = (x: number, y: number) => {
    const i = (y * width + x) * 4
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  for (let y = 0; y < height; y++) {
    const yu = y > 0 ? y - 1 : y
    const yd = y + 1 < height ? y + 1 : y
    for (let x = 0; x < width; x++) {
      const xl = x > 0 ? x - 1 : x
      const xr = x + 1 < width ? x + 1 : x
      const gx = L(xr, y) - L(xl, y)
      const gy = L(x, yd) - L(x, yu)
      out[y * width + x] = Math.min(1, Math.hypot(gx, gy) / 255)
    }
  }
  return out
}

/** Highlight orbs on smooth bright points; no extra gain on high-gradient edges. */
export function highlightBoostFactor(
  luma01: number,
  edge01: number,
  threshold = DEFAULT_BOKEH.highlightThreshold,
  gain = DEFAULT_BOKEH.highlightGain,
): number {
  if (luma01 <= threshold) return 1
  const t = (luma01 - threshold) / Math.max(1e-6, 1 - threshold)
  const raw = 1 + t * t * gain
  const atten = 1 - smoothstep(0.12, 0.48, edge01)
  return 1 + (raw - 1) * atten
}

/** 0..1 keep map → graduated depth so mid-ground stays partly sharp.
 *  Distance is from the subject silhouette (not the centroid), so nearby
 *  structure (rail, cliff) stays more readable than sky/hills behind it. */
export function syntheticDepthMap(keep: Float32Array, width: number, height: number): Float32Array {
  const depth = backgroundDepthMap(keep, width, height)
  for (let i = 0; i < keep.length; i++) {
    if (keep[i] > 0.5) depth[i] = Math.max(depth[i], 0.86 + 0.14 * keep[i])
  }
  return depth
}

/** Background-only falloff. Subject pixels are not stamped to 1 here so a later
 *  box-feather cannot bleed "near" into the matte fringe. */
export function backgroundDepthMap(keep: Float32Array, width: number, height: number): Float32Array {
  const dist = distanceToKeep(keep, width, height)
  const depth = new Float32Array(width * height)
  const ih = 1 / Math.max(1, height - 1)
  for (let y = 0; y < height; y++) {
    const yFar = smoothstep(0.12, 0.88, 1 - y * ih)
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const bgFar = smoothstep(0.04, 0.75, dist[i])
      // Just behind the subject is only slightly soft. The far field reaches
      // a modest disc — shapes stay visible, they are not wiped out.
      const far = 0.64 + 0.26 * bgFar + 0.06 * yFar
      depth[i] = 1 - Math.min(0.9, far)
    }
  }
  return depth
}

/** 0 at keep, 1 at the farthest background pixel (normalized by diagonal). */
export function distanceToKeep(keep: Float32Array, width: number, height: number): Float32Array {
  const INF = 1e6
  const dist = new Float32Array(width * height)
  let seeded = false
  for (let i = 0; i < dist.length; i++) {
    if (keep[i] > 0.5) {
      dist[i] = 0
      seeded = true
    } else dist[i] = INF
  }
  if (!seeded) {
    dist.fill(1)
    return dist
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      if (x > 0) dist[i] = Math.min(dist[i], dist[i - 1] + 1)
      if (y > 0) dist[i] = Math.min(dist[i], dist[i - width] + 1)
      if (x > 0 && y > 0) dist[i] = Math.min(dist[i], dist[i - width - 1] + 1.41421356)
      if (x + 1 < width && y > 0) dist[i] = Math.min(dist[i], dist[i - width + 1] + 1.41421356)
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x
      if (x + 1 < width) dist[i] = Math.min(dist[i], dist[i + 1] + 1)
      if (y + 1 < height) dist[i] = Math.min(dist[i], dist[i + width] + 1)
      if (x + 1 < width && y + 1 < height) dist[i] = Math.min(dist[i], dist[i + width + 1] + 1.41421356)
      if (x > 0 && y + 1 < height) dist[i] = Math.min(dist[i], dist[i + width - 1] + 1.41421356)
    }
  }
  const norm = Math.hypot(width, height)
  for (let i = 0; i < dist.length; i++) dist[i] = Math.min(1, dist[i] / norm)
  return dist
}

/** Min-filter; eats a 1–2px matte fringe so sky-tinted edge pixels are not treated as subject. */
export function dilateMap(src: Float32Array, width: number, height: number, radius: number): Float32Array {
  const r = Math.max(0, Math.round(radius))
  if (r <= 0) return src.slice()
  const tmp = new Float32Array(src.length)
  const out = new Float32Array(src.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let m = 0
      for (let dx = -r; dx <= r; dx++) m = Math.max(m, src[y * width + clampi(x + dx, 0, width - 1)])
      tmp[y * width + x] = m
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let m = 0
      for (let dy = -r; dy <= r; dy++) m = Math.max(m, tmp[clampi(y + dy, 0, height - 1) * width + x])
      out[y * width + x] = m
    }
  }
  return out
}

export function erodeMap(src: Float32Array, width: number, height: number, radius: number): Float32Array {
  const r = Math.max(0, Math.round(radius))
  if (r <= 0) return src.slice()
  const tmp = new Float32Array(src.length)
  const out = new Float32Array(src.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let m = 1
      for (let dx = -r; dx <= r; dx++) m = Math.min(m, src[y * width + clampi(x + dx, 0, width - 1)])
      tmp[y * width + x] = m
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let m = 1
      for (let dy = -r; dy <= r; dy++) m = Math.min(m, tmp[clampi(y + dy, 0, height - 1) * width + x])
      out[y * width + x] = m
    }
  }
  return out
}

export function featherDepth(depth: Float32Array, width: number, height: number, radius = 3): Float32Array {
  const r = Math.max(1, Math.round(radius))
  const tmp = new Float32Array(depth.length)
  const out = new Float32Array(depth.length)
  const norm = 1 / (r * 2 + 1)
  for (let y = 0; y < height; y++) {
    let acc = 0
    for (let x = -r; x <= r; x++) acc += depth[y * width + clampi(x, 0, width - 1)]
    for (let x = 0; x < width; x++) {
      tmp[y * width + x] = acc * norm
      acc += depth[y * width + clampi(x + r + 1, 0, width - 1)] - depth[y * width + clampi(x - r, 0, width - 1)]
    }
  }
  for (let x = 0; x < width; x++) {
    let acc = 0
    for (let y = -r; y <= r; y++) acc += tmp[clampi(y, 0, height - 1) * width + x]
    for (let y = 0; y < height; y++) {
      out[y * width + x] = acc * norm
      acc += tmp[clampi(y + r + 1, 0, height - 1) * width + x] - tmp[clampi(y - r, 0, height - 1) * width + x]
    }
  }
  return out
}

export function applyBokeh(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  depthMap: Float32Array,
  params: BokehParams = DEFAULT_BOKEH,
  subjectAlpha?: Float32Array,
): Uint8ClampedArray {
  const fitted = { ...params, maxBlurRadius: clampBokehRadius(params.maxBlurRadius, width, height) }
  const gpu =
    width * height >= GPU_MIN_PIXELS && canCreateWebgl()
      ? applyBokehWebgl(data, width, height, depthMap, fitted)
      : null
  if (gpu) return compositeSubject(data, gpu, depthMap, width, height, fitted.subjectThreshold, subjectAlpha)
  const cpu = applyDiscBokehCpu(data, width, height, depthMap, fitted)
  return compositeSubject(data, cpu, depthMap, width, height, fitted.subjectThreshold, subjectAlpha)
}

export function applyBokehFit(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  depthMap: Float32Array,
  params: BokehParams = DEFAULT_BOKEH,
  subjectAlpha?: Float32Array,
): Uint8ClampedArray {
  const preferGpu = width * height >= GPU_MIN_PIXELS && canCreateWebgl()
  const edge = preferGpu ? GPU_WORK_EDGE : CPU_WORK_EDGE
  const scale = Math.min(1, edge / Math.max(width, height))
  if (scale >= 0.999) return applyBokeh(data, width, height, depthMap, params, subjectAlpha)

  const dw = Math.max(8, Math.round(width * scale))
  const dh = Math.max(8, Math.round(height * scale))
  const small = downsampleRgba(data, width, height, dw, dh)
  const smallDepth = downsampleDepth(depthMap, width, height, dw, dh)
  const scaled: BokehParams = {
    ...params,
    maxBlurRadius: clampBokehRadius(Math.round(params.maxBlurRadius * scale), dw, dh),
  }
  const blurredSmall = preferGpu
    ? applyBokehWebgl(small, dw, dh, smallDepth, scaled) ?? applyDiscBokehCpu(small, dw, dh, smallDepth, scaled)
    : applyDiscBokehCpu(small, dw, dh, smallDepth, scaled)
  const up = upsampleRgba(blurredSmall, dw, dh, width, height)
  return compositeSubject(data, up, depthMap, width, height, params.subjectThreshold, subjectAlpha)
}

export function applyDiscBokehCpu(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  depthMap: Float32Array,
  params: BokehParams,
): Uint8ClampedArray {
  const edge = lumaGradientMap(data, width, height)
  const samples = Math.max(16, Math.min(64, params.samples | 0))
  const out = new Uint8ClampedArray(data.length)
  const rings = Math.max(3, Math.round(Math.sqrt(samples / 6)))

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const px = i * 4
      const depth = depthMap[i] ?? 0
      const radius = blurRadiusForDepth(depth, params)
      if (radius < 0.55) {
        out[px] = data[px]
        out[px + 1] = data[px + 1]
        out[px + 2] = data[px + 2]
        out[px + 3] = data[px + 3]
        continue
      }

      // Centre tap unboosted. Edges blur less than flats, but still mix the ring.
      const centerW = 1 + 4 * smoothstep(0.16, 0.5, edge[i] ?? 0)
      const ringScale = 1 - 0.6 * smoothstep(0.18, 0.52, edge[i] ?? 0)
      let sr = data[px] * centerW
      let sg = data[px + 1] * centerW
      let sb = data[px + 2] * centerW
      let sw = centerW
      let sampleIndex = 0
      for (let ring = 1; ring <= rings; ring++) {
        const ringR = radius * (ring / rings)
        const count = Math.max(6, Math.round((samples * ring) / ((rings * (rings + 1)) / 2)))
        for (let s = 0; s < count; s++) {
          const angle = (s + ring * 0.37) * GOLDEN_ANGLE
          const sx = Math.round(x + Math.cos(angle) * ringR)
          const sy = Math.round(y + Math.sin(angle) * ringR)
          if (!Number.isFinite(sx) || !Number.isFinite(sy)) continue
          if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue
          const si = sy * width + sx
          const sp = si * 4
          const sampleDepth = depthMap[si] ?? 0
          const luma = (0.299 * data[sp] + 0.587 * data[sp + 1] + 0.114 * data[sp + 2]) / 255
          const boost = highlightBoostFactor(
            luma,
            edge[si] ?? 0,
            params.highlightThreshold,
            params.highlightGain,
          )
          let weight = (1 + smoothstep(0.82, 1, luma) * 0.85) * ringScale * boost
          if (sampleDepth > depth + 0.14) weight *= 0.08
          sr += data[sp] * weight
          sg += data[sp + 1] * weight
          sb += data[sp + 2] * weight
          sw += weight
          sampleIndex++
          if (sampleIndex >= samples * 2) break
        }
      }
      const inv = sw > 1e-6 ? 1 / sw : 1
      out[px] = sr * inv
      out[px + 1] = sg * inv
      out[px + 2] = sb * inv
      out[px + 3] = data[px + 3]
    }
  }
  return out
}

const VERT = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = vec2(a_position.x * 0.5 + 0.5, a_position.y * 0.5 + 0.5);
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

const FRAG = `
precision highp float;
uniform sampler2D u_image;
uniform sampler2D u_depthMap;
uniform sampler2D u_edgeMap;
uniform vec2 u_resolution;
uniform float u_maxBlurRadius;
uniform float u_subjectThreshold;
uniform float u_depthGamma;
uniform float u_highlightThreshold;
uniform float u_highlightGain;
varying vec2 v_uv;

const int SAMPLES = 32;
const float GOLDEN = 2.399963229728653;

float lumaOf(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
  float depth = texture2D(u_depthMap, uv).r;
  vec4 original = texture2D(u_image, uv);
  float centerEdge = texture2D(u_edgeMap, uv).r;
  float centerW = 1.0 + 4.0 * smoothstep(0.16, 0.5, centerEdge);
  float ringScale = 1.0 - 0.6 * smoothstep(0.18, 0.52, centerEdge);

  float t = 1.0 - depth / max(0.0001, u_subjectThreshold);
  t = clamp(t, 0.0, 1.0);
  float blurPx = 0.0;
  if (depth < u_subjectThreshold) {
    blurPx = pow(t, u_depthGamma) * u_maxBlurRadius;
  }

  if (blurPx < 0.5) {
    gl_FragColor = original;
    return;
  }

  vec4 colorSum = original * centerW;
  float weightSum = centerW;
  for (int i = 0; i < SAMPLES; i++) {
    float fi = float(i);
    float angle = fi * GOLDEN;
    float radius = blurPx * sqrt((fi + 0.5) / float(SAMPLES));
    vec2 offset = vec2(cos(angle), sin(angle)) * radius / u_resolution;
    vec2 suv = uv + offset;
    float inside = step(0.0, suv.x) * step(suv.x, 1.0) * step(0.0, suv.y) * step(suv.y, 1.0);
    vec4 sampleColor = texture2D(u_image, suv);
    float sampleDepth = texture2D(u_depthMap, suv).r;
    float edge = texture2D(u_edgeMap, suv).r;
    float luma = lumaOf(sampleColor.rgb);
    float tBoost = clamp((luma - u_highlightThreshold) / max(0.0001, 1.0 - u_highlightThreshold), 0.0, 1.0);
    float edgeAtten = 1.0 - smoothstep(0.12, 0.48, edge);
    float boost = 1.0 + tBoost * tBoost * u_highlightGain * edgeAtten;
    float weight = (1.0 + smoothstep(0.82, 1.0, luma) * 0.85) * inside * ringScale * boost;
    if (sampleDepth > depth + 0.14) weight *= 0.08;
    colorSum += sampleColor * weight;
    weightSum += weight;
  }
  gl_FragColor = colorSum / max(weightSum, 0.0001);
  gl_FragColor.a = original.a;
}
`

function applyBokehWebgl(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  depthMap: Float32Array,
  params: BokehParams,
): Uint8ClampedArray | null {
  const gl = createGl(width, height)
  if (!gl) return null
  try {
    const program = compileProgram(gl, VERT, FRAG)
    if (!program) return null
    gl.useProgram(program)
    gl.viewport(0, 0, width, height)
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.BLEND)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const pos = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(pos)
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0)

    const imageTex = uploadRgba(gl, data, width, height, 0)
    const depthTex = uploadDepth(gl, depthMap, width, height, 1)
    const edgeTex = uploadDepth(gl, lumaGradientMap(data, width, height), width, height, 2)
    if (!imageTex || !depthTex || !edgeTex) return null

    gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0)
    gl.uniform1i(gl.getUniformLocation(program, 'u_depthMap'), 1)
    gl.uniform1i(gl.getUniformLocation(program, 'u_edgeMap'), 2)
    gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), width, height)
    gl.uniform1f(gl.getUniformLocation(program, 'u_maxBlurRadius'), params.maxBlurRadius)
    gl.uniform1f(gl.getUniformLocation(program, 'u_subjectThreshold'), params.subjectThreshold)
    gl.uniform1f(gl.getUniformLocation(program, 'u_depthGamma'), params.depthGamma)
    gl.uniform1f(gl.getUniformLocation(program, 'u_highlightThreshold'), params.highlightThreshold)
    gl.uniform1f(gl.getUniformLocation(program, 'u_highlightGain'), params.highlightGain)

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    const pixels = new Uint8Array(width * height * 4)
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    let outDark = 0
    let srcDark = 0
    let samples = 0
    for (let i = 0; i < pixels.length; i += 16) {
      samples++
      if (pixels[i] + pixels[i + 1] + pixels[i + 2] < 12) outDark++
      if (i + 2 < data.length && data[i] + data[i + 1] + data[i + 2] < 12) srcDark++
    }
    if (samples === 0 || outDark === samples) return null
    if (outDark / samples > 0.4 && srcDark / samples < 0.2) return null
    flipY(pixels, width, height)
    return new Uint8ClampedArray(pixels)
  } catch (err) {
    console.warn('[bokeh] WebGL path failed, using CPU disc blur', err)
    return null
  }
}

function canCreateWebgl(): boolean {
  if (gpuAvailable !== null) return gpuAvailable
  const gl = createGl(8, 8)
  gpuAvailable = !!gl
  cachedGl = null
  return gpuAvailable
}

let cachedGl: { gl: WebGLRenderingContext; width: number; height: number } | null = null

function createGl(width: number, height: number): WebGLRenderingContext | null {
  try {
    if (cachedGl && cachedGl.width === width && cachedGl.height === height) return cachedGl.gl
    const attrs: WebGLContextAttributes = {
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
      antialias: false,
      depth: false,
      stencil: false,
    }
    let canvas: OffscreenCanvas | HTMLCanvasElement | null = null
    if (typeof OffscreenCanvas !== 'undefined') canvas = new OffscreenCanvas(width, height)
    else if (typeof document !== 'undefined') {
      const el = document.createElement('canvas')
      el.width = width
      el.height = height
      canvas = el
    }
    if (!canvas) return null
    const gl = canvas.getContext('webgl', attrs) as WebGLRenderingContext | null
    if (!gl) return null
    const max = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
    if (width > max || height > max) return null
    cachedGl = { gl, width, height }
    return gl
  } catch {
    return null
  }
}

function compileProgram(gl: WebGLRenderingContext, vertSrc: string, fragSrc: string): WebGLProgram | null {
  const compile = (type: number, src: string) => {
    const shader = gl.createShader(type)
    if (!shader) return null
    gl.shaderSource(shader, src)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn('[bokeh] shader', gl.getShaderInfoLog(shader))
      gl.deleteShader(shader)
      return null
    }
    return shader
  }
  const vert = compile(gl.VERTEX_SHADER, vertSrc)
  const frag = compile(gl.FRAGMENT_SHADER, fragSrc)
  if (!vert || !frag) return null
  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, vert)
  gl.attachShader(program, frag)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('[bokeh] program', gl.getProgramInfoLog(program))
    return null
  }
  return program
}

function uploadRgba(
  gl: WebGLRenderingContext,
  data: Uint8ClampedArray,
  width: number,
  height: number,
  unit: number,
): WebGLTexture | null {
  const tex = gl.createTexture()
  if (!tex) return null
  gl.activeTexture(gl.TEXTURE0 + unit)
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
  return tex
}

function uploadDepth(
  gl: WebGLRenderingContext,
  depth: Float32Array,
  width: number,
  height: number,
  unit: number,
): WebGLTexture | null {
  const packed = new Uint8ClampedArray(width * height * 4)
  const n = Math.min(depth.length, width * height)
  for (let i = 0; i < n; i++) {
    const v = Math.max(0, Math.min(255, Math.round(depth[i] * 255)))
    const p = i * 4
    packed[p] = v
    packed[p + 1] = v
    packed[p + 2] = v
    packed[p + 3] = 255
  }
  return uploadRgba(gl, packed, width, height, unit)
}

function compositeSubject(
  original: Uint8ClampedArray,
  blurred: Uint8ClampedArray,
  depth: Float32Array,
  width: number,
  height: number,
  subjectThreshold: number,
  subjectAlpha?: Float32Array,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(blurred)
  const crisp = unsharpMask(original, width, height, 1, SUBJECT_SHARPNESS, 2)
  const n = width * height
  // Depth-only fallback (tests / callers without a matte): a wide symmetric
  // band. A crisp MODNet matte needs that width — a narrow hi-side (old
  // +0.04) leaves a 1px mixed rim that reads as a halo.
  const lo = subjectThreshold - 0.15
  const hi = subjectThreshold + 0.15
  for (let i = 0; i < n; i++) {
    const s = subjectAlpha
      ? Math.max(0, Math.min(1, subjectAlpha[i] ?? 0))
      : smoothstep(lo, hi, depth[i] ?? 0)
    if (s <= 0.001) continue
    const px = i * 4
    if (s >= 0.999) {
      out[px] = crisp[px]
      out[px + 1] = crisp[px + 1]
      out[px + 2] = crisp[px + 2]
      continue
    }
    const inv = 1 - s
    out[px] = blurred[px] * inv + crisp[px] * s
    out[px + 1] = blurred[px + 1] * inv + crisp[px + 1] * s
    out[px + 2] = blurred[px + 2] * inv + crisp[px + 2] * s
  }
  return out
}

export function downsampleRgba(
  src: Uint8ClampedArray,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(dw * dh * 4)
  for (let y = 0; y < dh; y++) {
    const y0 = Math.floor((y * sh) / dh)
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * sh) / dh))
    for (let x = 0; x < dw; x++) {
      const x0 = Math.floor((x * sw) / dw)
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * sw) / dw))
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let count = 0
      for (let sy = y0; sy < y1 && sy < sh; sy++) {
        for (let sx = x0; sx < x1 && sx < sw; sx++) {
          const si = (sy * sw + sx) * 4
          r += src[si]
          g += src[si + 1]
          b += src[si + 2]
          a += src[si + 3]
          count++
        }
      }
      const di = (y * dw + x) * 4
      const inv = 1 / Math.max(1, count)
      out[di] = r * inv
      out[di + 1] = g * inv
      out[di + 2] = b * inv
      out[di + 3] = a * inv
    }
  }
  return out
}

export function downsampleDepth(src: Float32Array, sw: number, sh: number, dw: number, dh: number): Float32Array {
  const out = new Float32Array(dw * dh)
  for (let y = 0; y < dh; y++) {
    const y0 = Math.floor((y * sh) / dh)
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * sh) / dh))
    for (let x = 0; x < dw; x++) {
      const x0 = Math.floor((x * sw) / dw)
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * sw) / dw))
      let acc = 0
      let count = 0
      for (let sy = y0; sy < y1 && sy < sh; sy++) {
        for (let sx = x0; sx < x1 && sx < sw; sx++) {
          acc += src[sy * sw + sx]
          count++
        }
      }
      out[y * dw + x] = acc / Math.max(1, count)
    }
  }
  return out
}

function upsampleRgba(
  src: Uint8ClampedArray,
  sw: number,
  sh: number,
  width: number,
  height: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4)
  const xScale = (sw - 1) / Math.max(1, width - 1)
  const yScale = (sh - 1) / Math.max(1, height - 1)
  for (let y = 0; y < height; y++) {
    const fy = y * yScale
    const y0 = Math.floor(fy)
    const y1 = Math.min(sh - 1, y0 + 1)
    const ty = fy - y0
    for (let x = 0; x < width; x++) {
      const fx = x * xScale
      const x0 = Math.floor(fx)
      const x1 = Math.min(sw - 1, x0 + 1)
      const tx = fx - x0
      const di = (y * width + x) * 4
      for (let c = 0; c < 4; c++) {
        const s00 = src[(y0 * sw + x0) * 4 + c]
        const s10 = src[(y0 * sw + x1) * 4 + c]
        const s01 = src[(y1 * sw + x0) * 4 + c]
        const s11 = src[(y1 * sw + x1) * 4 + c]
        out[di + c] = s00 * (1 - tx) * (1 - ty) + s10 * tx * (1 - ty) + s01 * (1 - tx) * ty + s11 * tx * ty
      }
    }
  }
  return out
}

function flipY(pixels: Uint8Array, width: number, height: number) {
  const row = width * 4
  const tmp = new Uint8Array(row)
  for (let y = 0; y < height / 2; y++) {
    const a = y * row
    const b = (height - 1 - y) * row
    tmp.set(pixels.subarray(a, a + row))
    pixels.copyWithin(a, b, b + row)
    pixels.set(tmp, b)
  }
}

function clampi(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 <= edge0) return x >= edge1 ? 1 : 0
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}
