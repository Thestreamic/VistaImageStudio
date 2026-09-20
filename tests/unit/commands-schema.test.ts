import { describe, it, expect } from 'vitest'
import { validateCommand } from '@/features/editor/commands/schema'
import { commandsFromText } from '@/features/editor/commands/from-text'

describe('command allowlist', () => {
  it('rejects unknown ops', () => {
    expect(validateCommand({ op: 'rm -rf', label: 'nope' })).toMatchObject({ op: 'unknown' })
    expect(validateCommand({ op: 'ai', name: 'exfiltrate' })).toMatchObject({ op: 'unknown' })
  })

  it('accepts crop / look / watermark / export', () => {
    expect(validateCommand({ op: 'crop', presetId: '4:5', label: 'Crop 4:5' }).op).toBe('crop')
    expect(validateCommand({ op: 'look', id: 'warm', intensity: 80, label: 'Warm' }).op).toBe('look')
    expect(validateCommand({ op: 'watermark', corner: 'br', opacity: 0.5, label: 'wm' }).op).toBe('watermark')
    expect(validateCommand({ op: 'export', presetId: 'ig-post', format: 'jpeg', label: 'ex' }).op).toBe('export')
  })

  it('parses social crop and watermark phrasing', () => {
    const cmds = commandsFromText('prepare Instagram 4:5 and add logo BR')
    expect(cmds.some((c) => c.op === 'crop' && c.presetId === '4:5')).toBe(true)
    expect(cmds.some((c) => c.op === 'watermark' && c.corner === 'br')).toBe(true)
  })

  it('maps auto optimize / iPhone Pro phrasing to the Pro Phone look', () => {
    for (const text of ['auto optimize', 'iPhone 18 Pro look', 'make it look like an iPhone']) {
      const cmds = commandsFromText(text)
      expect(cmds.some((c) => c.op === 'look' && c.id === 'pro-phone')).toBe(true)
    }
  })

  it('does not invent commands for unrelated text', () => {
    expect(commandsFromText('what is the weather today')).toEqual([])
  })

  it('maps natural color look without a bonus saturation merge', () => {
    const cmds = commandsFromText('natural color look')
    expect(cmds.some((c) => c.op === 'look' && c.id === 'natural-mobile')).toBe(true)
    expect(cmds.some((c) => c.op === 'adjust' && Boolean(c.patch.saturation))).toBe(false)
  })
})
