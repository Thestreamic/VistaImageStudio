import type { Adjustments, WatermarkCorner } from '../types'
import type { CommandAiOp } from '../command-parser'

export type EditorCommand =
  | { op: 'adjust'; patch: Partial<Adjustments>; mode: 'merge' | 'replace'; label: string }
  | { op: 'look'; id: string; intensity: number; label: string }
  | { op: 'crop'; presetId: string; label: string }
  | { op: 'watermark'; corner: WatermarkCorner; opacity: number; label: string }
  | { op: 'ai'; name: CommandAiOp; label: string }
  | { op: 'export'; presetId: string; format: 'jpeg' | 'png' | 'webp'; quality?: number; label: string }
  | { op: 'undo'; label: string }
  | { op: 'redo'; label: string }

export const ALLOWED_OPS = [
  'adjust',
  'look',
  'crop',
  'watermark',
  'ai',
  'export',
  'undo',
  'redo',
] as const

export type AllowedOp = (typeof ALLOWED_OPS)[number]

const AI_OPS: CommandAiOp[] = [
  'removeBackground',
  'denoise',
  'upscale',
  'autoColor',
  'faceEnhance',
  'lowLight',
  'dehaze',
  'clarity',
  'vibrance',
  'backgroundBlur',
  'portraitBlur',
]

const CORNERS: WatermarkCorner[] = ['tl', 'tr', 'bl', 'br', 'center']

export function validateCommand(input: unknown): EditorCommand | { op: 'unknown'; label: string } {
  if (!input || typeof input !== 'object') return { op: 'unknown', label: 'I can only run local editor commands.' }
  const cmd = input as Record<string, unknown>
  if (typeof cmd.op !== 'string' || !ALLOWED_OPS.includes(cmd.op as AllowedOp)) {
    return { op: 'unknown', label: 'I can only run local editor commands.' }
  }
  switch (cmd.op) {
    case 'adjust':
      if (!cmd.patch || typeof cmd.patch !== 'object') return { op: 'unknown', label: 'I can only run local editor commands.' }
      return {
        op: 'adjust',
        patch: cmd.patch as Partial<Adjustments>,
        mode: cmd.mode === 'replace' ? 'replace' : 'merge',
        label: typeof cmd.label === 'string' ? cmd.label : 'adjustment',
      }
    case 'look':
      if (typeof cmd.id !== 'string') return { op: 'unknown', label: 'I can only run local editor commands.' }
      return {
        op: 'look',
        id: cmd.id,
        intensity: typeof cmd.intensity === 'number' ? cmd.intensity : 100,
        label: typeof cmd.label === 'string' ? cmd.label : 'look',
      }
    case 'crop':
      if (typeof cmd.presetId !== 'string') return { op: 'unknown', label: 'I can only run local editor commands.' }
      return { op: 'crop', presetId: cmd.presetId, label: typeof cmd.label === 'string' ? cmd.label : 'crop' }
    case 'watermark':
      if (typeof cmd.corner !== 'string' || !CORNERS.includes(cmd.corner as WatermarkCorner)) {
        return { op: 'unknown', label: 'I can only run local editor commands.' }
      }
      return {
        op: 'watermark',
        corner: cmd.corner as WatermarkCorner,
        opacity: typeof cmd.opacity === 'number' ? cmd.opacity : 0.85,
        label: typeof cmd.label === 'string' ? cmd.label : 'watermark',
      }
    case 'ai':
      if (typeof cmd.name !== 'string' || !AI_OPS.includes(cmd.name as CommandAiOp)) {
        return { op: 'unknown', label: 'I can only run local editor commands.' }
      }
      return { op: 'ai', name: cmd.name as CommandAiOp, label: typeof cmd.label === 'string' ? cmd.label : 'AI' }
    case 'export':
      if (typeof cmd.presetId !== 'string') return { op: 'unknown', label: 'I can only run local editor commands.' }
      return {
        op: 'export',
        presetId: cmd.presetId,
        format: cmd.format === 'png' || cmd.format === 'webp' ? cmd.format : 'jpeg',
        quality: typeof cmd.quality === 'number' ? cmd.quality : 90,
        label: typeof cmd.label === 'string' ? cmd.label : 'export',
      }
    case 'undo':
      return { op: 'undo', label: 'undo' }
    case 'redo':
      return { op: 'redo', label: 'redo' }
    default:
      return { op: 'unknown', label: 'I can only run local editor commands.' }
  }
}

export function validateCommands(list: unknown[]): Array<EditorCommand | { op: 'unknown'; label: string }> {
  return list.map(validateCommand)
}
