import { FILTER_PRESETS } from './filter-presets'
import { CAMERA_PROFILES } from './camera-profiles'
import type { Adjustments } from './types'

export type CommandAiOp =
  | 'removeBackground'
  | 'denoise'
  | 'upscale'
  | 'autoColor'
  | 'faceEnhance'
  | 'lowLight'
  | 'dehaze'
  | 'clarity'
  | 'vibrance'
  | 'backgroundBlur'
  | 'portraitBlur'

export type CommandAction =
  /**
   * `replace` swaps the layer's whole adjustment stack for this patch (a named
   * look is a complete recipe, so it must not inherit the previous one);
   * `merge` layers a tweak on top of whatever is already applied, which is
   * what "a bit brighter" means after you have chosen a look.
   */
  | { kind: 'adjust'; patch: Partial<Adjustments>; label: string; mode: 'replace' | 'merge' }
  | { kind: 'ai'; op: CommandAiOp; label: string }
  | { kind: 'unknown' }

/**
 * Local, offline, keyword-based command parser — no external API, no
 * network call, no per-request cost. Deliberately rule-based rather than
 * an LLM call: the vocabulary of photo-editing intents is small and fixed,
 * so a rule match is instant, free, 100% private, and never hallucinates
 * an edit the user didn't ask for.
 */
export function parseCommand(input: string): CommandAction[] {
  const text = input.toLowerCase()
  const actions: CommandAction[] = []

  // Camera color-grade profiles (checked first — most specific match)
  for (const profile of CAMERA_PROFILES) {
    if (profile.match.test(text)) {
      actions.push({ kind: 'adjust', patch: profile.adjustments, label: `${profile.label} color grade`, mode: 'replace' })
    }
  }

  // Named filter looks (Warm, B&W, Cool, ...)
  for (const preset of FILTER_PRESETS) {
    if (preset.id === 'original') continue
    const names = [preset.label, ...(preset.aliases ?? [])]
    if (names.some((n) => text.includes(n.toLowerCase()))) {
      actions.push({ kind: 'adjust', patch: preset.adjustments, label: `${preset.label} filter`, mode: 'replace' })
    }
  }

  // Sharpness — real local-contrast technique via a gentle S-curve.
  // "clarity" is a separate spatial op below, not this curve.
  if (/\bsharp(en|ness)?\b|\bcrisp(er|ness)?\b/.test(text)) {
    actions.push({
      kind: 'adjust',
      patch: { contrast: 16, curves: { rgb: [{ x: 0, y: 0 }, { x: 96, y: 82 }, { x: 160, y: 174 }, { x: 255, y: 255 }], r: [{ x: 0, y: 0 }, { x: 255, y: 255 }], g: [{ x: 0, y: 0 }, { x: 255, y: 255 }], b: [{ x: 0, y: 0 }, { x: 255, y: 255 }] } },
      label: 'sharper micro-contrast',
      mode: 'merge',
    })
  }

  // Pixel-level original ops (no pretrained model).
  if (
    /\blow[- ]?light\b|\bnight(?:[- ](?:mode|photo|shot|enhance))?\b|\bunderexposed\b|\btoo dark\b|\bdark (photo|image|pic|shot)\b|\bdim (photo|image)\b|\bbrighten .{0,24}(dark|night)\b/.test(text)
  ) {
    actions.push({ kind: 'ai', op: 'lowLight', label: 'low-light enhance' })
  }
  if (
    /\bdehaze\b|\bde-?fog\b|\bhazy\b|\bfoggy\b|\bmisty\b|\b(remove|cut|clear) (the )?(haze|fog|mist)\b/.test(text)
  ) {
    actions.push({ kind: 'ai', op: 'dehaze', label: 'dehaze' })
  }
  if (/\bclarity\b|\bstructure\b|\bmore detail\b|\blocal contrast\b|\bpunchy details\b/.test(text)) {
    actions.push({ kind: 'ai', op: 'clarity', label: 'clarity' })
  }
  if (/\bvibrance\b|\bpop (the )?colou?rs?\b|\bricher colou?rs?\b/.test(text)) {
    actions.push({ kind: 'ai', op: 'vibrance', label: 'vibrance' })
  }
  if (
    /\bportrait mode\b|\bblur(red)? (the )?background\b|\bbackground blur\b|\bbokeh\b|\bportrait (blur|depth)\b|\bshallow depth\b|\bdepth of field\b|\bdepth blur\b/.test(
      text,
    )
  ) {
    actions.push({ kind: 'ai', op: 'portraitBlur', label: 'portrait blur' })
  }

  const hasPixelLook = actions.some(
    (a) => a.kind === 'ai' && (a.op === 'lowLight' || a.op === 'vibrance' || a.op === 'dehaze' || a.op === 'clarity'),
  )

  // Generic brightness / color intents (only fire if no filter/profile
  // above already covers it, so "make it warmer" isn't double-applied).
  // Do not treat the word "color" in "natural color look" as "make it colorful".
  if (actions.length === 0 || /\bbright(en|ness)?\b|\bdark(en)?\b|\bcolorful\b|\bcolourful\b|\bvivid\b|\bwarm(er)?\b|\bcool(er)?\b|\bcontrast\b/.test(text)) {
    const patch: Partial<Adjustments> = {}
    // Comparatives ("brighter", "darker") are how people actually phrase this.
    if (/\bbright(en|ness|er|est)?\b|\blighter\b/.test(text) && !actions.some((a) => a.kind === 'ai' && a.op === 'lowLight')) {
      patch.brightness = 22
    }
    // "too dark" / "dark photo" is a low-light complaint, not "make it darker".
    if (
      (/\bdarken\b|\bdarker\b|\bdimmer\b|\bmake (it |this )?(more )?dark\b/.test(text)) &&
      !/\btoo dark\b/.test(text) &&
      !actions.some((a) => a.kind === 'ai' && a.op === 'lowLight')
    ) {
      patch.brightness = -22
    }
    if (
      (/\bcolorful\b|\bcolourful\b|\bvivid\b|\bsaturat|\bmore colou?rs?\b/.test(text)) &&
      !actions.some((a) => a.kind === 'ai' && a.op === 'vibrance')
    ) {
      patch.saturation = 24
    }
    if (/\bwarm(er|est|th)?\b/.test(text)) patch.temperature = 24
    if (/\bcool(er|est)?\b|\bcold(er)?\b/.test(text)) patch.temperature = -24
    if (/\bcontrast(y)?\b|\bpunch(y|ier)?\b/.test(text) && !hasPixelLook) patch.contrast = 20
    if (Object.keys(patch).length > 0) {
      actions.push({ kind: 'adjust', patch, label: 'brightness/color adjustment', mode: 'merge' })
    }
  }

  // Existing AI operations
  if (
    /\b(remove|removed|erase|delete|drop|kill|strip|clear)\s+(the\s+|its\s+)?background\b/.test(text) ||
    /\bbackground\s+(removal|transparent|gone|out)\b/.test(text) ||
    /\bno background\b|\bcut ?out\b|\btransparent background\b|\bisolate (the )?subject\b/.test(text)
  ) {
    actions.push({ kind: 'ai', op: 'removeBackground', label: 'background removal' })
  }
  if (/\bdenoise\b|\bremove noise\b|\bgrainy\b|\bnoise reduction\b/.test(text)) {
    actions.push({ kind: 'ai', op: 'denoise', label: 'denoise' })
  }
  if (/\bupscale\b|\bhigher resolution\b|\bincrease resolution\b|\bbigger\b/.test(text)) {
    actions.push({ kind: 'ai', op: 'upscale', label: 'AI upscale' })
  }
  if (
    /\bface enhance\b|\bskin\b/.test(text) &&
    !actions.some((a) => a.kind === 'ai' && (a.op === 'portraitBlur' || a.op === 'backgroundBlur'))
  ) {
    actions.push({ kind: 'ai', op: 'faceEnhance', label: 'face enhance' })
  }
  if (/\bauto ?color\b|\bwhite balance\b/.test(text)) {
    actions.push({ kind: 'ai', op: 'autoColor', label: 'auto color' })
  }
  if (/\bprofessional\b|\bpro[- ]?grade\b|\bpolish\b/.test(text) && !actions.some((a) => a.kind === 'ai' && a.op === 'autoColor')) {
    actions.push({ kind: 'ai', op: 'autoColor', label: 'auto color' })
    actions.push({ kind: 'adjust', patch: { contrast: 14, saturation: 8 }, label: 'professional polish', mode: 'merge' })
  }
  if (/\breset\b|\bundo (all|everything)\b|\boriginal\b/.test(text)) {
    actions.push({ kind: 'adjust', patch: {}, label: 'reset to original', mode: 'replace' })
  }

  return actions.length > 0 ? actions : [{ kind: 'unknown' }]
}
