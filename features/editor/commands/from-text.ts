import { parseCommand } from '../command-parser'
import { CAMERA_PROFILES } from '../camera-profiles'
import { FILTER_PRESETS } from '../filter-presets'
import { CROP_PRESETS } from '../crop-presets'
import type { WatermarkCorner } from '../types'
import { validateCommand, type EditorCommand } from './schema'

function watermarkCorner(text: string): WatermarkCorner {
  if (/\btop[- ]left\b|\btl\b/.test(text)) return 'tl'
  if (/\btop[- ]right\b|\btr\b/.test(text)) return 'tr'
  if (/\bbottom[- ]left\b|\bbl\b/.test(text)) return 'bl'
  if (/\bcenter\b|\bmiddle\b/.test(text)) return 'center'
  return 'br'
}

function cropPresetFromText(text: string): string | null {
  if (/\b4\s*[x:]\s*5\b|\binstagram portrait\b|\bprepare instagram\b/.test(text)) return '4:5'
  if (/\b9\s*[x:]\s*16\b|\bstory\b|\breel\b|\btiktok\b/.test(text)) return '9:16'
  if (/\b16\s*[x:]\s*9\b|\bthumbnail\b|\byoutube\b/.test(text)) return '16:9'
  if (/\b1\s*[x:]\s*1\b|\bsquare\b|\binstagram post\b/.test(text)) return '1:1'
  if (/\bcrop\b/.test(text)) {
    const hit = CROP_PRESETS.find((p) => p.id !== 'free' && text.includes(p.id))
    return hit?.id ?? null
  }
  return null
}

function exportPresetFromText(text: string): string | null {
  if (!/\bexport\b|\bdownload\b|\bsave (as|for|to)\b/.test(text)) return null
  if (/\bstory\b|\breel\b/.test(text)) return 'ig-story'
  if (/\bportrait\b|\b4\s*[x:]\s*5\b/.test(text)) return 'ig-portrait'
  if (/\byoutube\b|\bthumb\b/.test(text)) return 'yt-thumb'
  if (/\bpinterest\b/.test(text)) return 'pinterest'
  if (/\binstagram\b|\bsquare\b/.test(text)) return 'ig-post'
  return 'original'
}

function lookFromText(text: string): { id: string; label: string } | null {
  // Camera profiles first so “auto optimize / natural color” wins over generic words.
  for (const profile of CAMERA_PROFILES) {
    if (profile.match.test(text)) {
      const auto = /\bauto[- ]?optim/i.test(text)
      return {
        id: profile.id,
        label: auto && profile.id === 'pro-phone' ? 'Optimize Image' : profile.label,
      }
    }
  }
  for (const preset of FILTER_PRESETS) {
    if (preset.id === 'original') continue
    const names = [preset.label, preset.id, ...(preset.aliases ?? [])]
    if (names.some((n) => text.includes(n.toLowerCase()))) return { id: preset.id, label: preset.label }
  }
  return null
}

/**
 * Parse free text into allowlisted editor commands. Unknown tokens never become ops.
 */
export function commandsFromText(input: string): EditorCommand[] {
  const text = input.toLowerCase()
  const planned: EditorCommand[] = []

  if (/\bundo\b/.test(text) && !/\bundo (all|everything)\b/.test(text)) {
    planned.push({ op: 'undo', label: 'Undo' })
  }
  if (/\bredo\b/.test(text)) planned.push({ op: 'redo', label: 'Redo' })

  const cropId = cropPresetFromText(text)
  if (cropId) planned.push({ op: 'crop', presetId: cropId, label: `Crop ${cropId}` })

  if (/\bwatermark\b|\blogo\b|\bhandle\b/.test(text)) {
    planned.push({
      op: 'watermark',
      corner: watermarkCorner(text),
      opacity: 0.85,
      label: `Watermark ${watermarkCorner(text).toUpperCase()}`,
    })
  }

  const exportId = exportPresetFromText(text)
  if (exportId) {
    planned.push({
      op: 'export',
      presetId: exportId,
      format: /\bpng\b/.test(text) ? 'png' : 'jpeg',
      quality: 90,
      label: `Export ${exportId}`,
    })
  }

  const look = lookFromText(text)
  if (look) planned.push({ op: 'look', id: look.id, intensity: 100, label: `${look.label} look` })

  const parsed = parseCommand(input)
  for (const action of parsed) {
    if (action.kind === 'unknown') continue
    if (action.kind === 'ai') {
      planned.push({ op: 'ai', name: action.op, label: action.label })
      continue
    }
    if (action.kind === 'adjust') {
      if (look && action.mode === 'replace') continue
      planned.push({
        op: 'adjust',
        patch: action.patch,
        mode: action.mode,
        label: action.label,
      })
    }
  }

  const unique: EditorCommand[] = []
  const seen = new Set<string>()
  for (const cmd of planned) {
    const key = JSON.stringify(cmd)
    if (seen.has(key)) continue
    seen.add(key)
    const validated = validateCommand(cmd)
    if (validated.op === 'unknown') continue
    unique.push(validated)
  }
  return unique
}

export function commandLabels(commands: EditorCommand[]): string[] {
  return commands.map((c) => c.label)
}
