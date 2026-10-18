/**
 * Feature switches per build. The Android app (MOBILE_BUILD, Tier 1) ships
 * without ONNX models, so model-backed tools are hidden rather than shown
 * broken. Turning a flag on later (Tier 2/3) is the extension point.
 */
const isMobileBuild = process.env.NEXT_PUBLIC_VISTA_MOBILE === '1'

export const CAPABILITIES = {
  /** MODNet / LaMa / MiDaS tools: Remove Background, Magic Eraser, Portrait Bokeh. */
  subjectAi: !isMobileBuild,
  /** Upscale 2× (ESRGAN path) — Tier 3 on mobile. */
  upscale: !isMobileBuild,
  /** Face Enhance — out of Tier 1 scope on mobile. */
  faceEnhance: !isMobileBuild,
  /** Photo-video MP4 export (WebCodecs) — not yet verified on Android WebView. */
  videoExport: !isMobileBuild,
  /** Paid tier switch; no paywall exists yet. */
  pro: false,
} as const
