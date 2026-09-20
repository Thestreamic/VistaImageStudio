import { describe, it, expect } from 'vitest'
import { parseCommand } from '@/features/editor/command-parser'

describe('parseCommand', () => {
  it('routes background-removal phrasings to the AI op', () => {
    for (const text of ['remove background', 'cut out the subject', 'make the background transparent']) {
      expect(parseCommand(text)).toEqual(
        expect.arrayContaining([{ kind: 'ai', op: 'removeBackground', label: 'background removal' }]),
      )
    }
  })

  it('treats a named look as a replacement and a plain tweak as a merge', () => {
    const [look] = parseCommand('give me the warm filter')
    expect(look).toMatchObject({ kind: 'adjust', mode: 'replace' })

    const [tweak] = parseCommand('a bit brighter please')
    expect(tweak).toMatchObject({ kind: 'adjust', mode: 'merge' })
    expect(tweak).toHaveProperty('patch.brightness')
  })

  it('maps warm and cool to opposite temperature shifts', () => {
    const warm = parseCommand('make it warmer').find((a) => a.kind === 'adjust')
    const cool = parseCommand('make it cooler').find((a) => a.kind === 'adjust')
    const warmTemp = warm?.kind === 'adjust' ? warm.patch.temperature! : 0
    const coolTemp = cool?.kind === 'adjust' ? cool.patch.temperature! : 0
    expect(warmTemp).toBeGreaterThan(0)
    expect(coolTemp).toBeLessThan(0)
  })

  it('recognises a camera style grade', () => {
    const actions = parseCommand('iPhone 17 Pro style grade and sharpness')
    expect(actions.some((a) => a.kind === 'adjust' && /color grade/.test(a.label))).toBe(true)
    expect(actions.some((a) => a.kind === 'adjust' && /micro-contrast/.test(a.label))).toBe(true)
  })

  it('reports unknown input instead of inventing an edit', () => {
    expect(parseCommand('what is the weather today')).toEqual([{ kind: 'unknown' }])
  })

  it('routes the five original enhance commands to pixel ops', () => {
    expect(parseCommand('this photo is too dark')).toEqual(
      expect.arrayContaining([{ kind: 'ai', op: 'lowLight', label: 'low-light enhance' }]),
    )
    expect(parseCommand('brighten this dark photo').some((a) => a.kind === 'ai' && a.op === 'lowLight')).toBe(true)
    expect(parseCommand('brighten this dark photo').some((a) => a.kind === 'adjust' && 'brightness' in a.patch)).toBe(false)

    expect(parseCommand('dehaze')).toEqual(
      expect.arrayContaining([{ kind: 'ai', op: 'dehaze', label: 'dehaze' }]),
    )
    expect(parseCommand('remove the haze')).toEqual(
      expect.arrayContaining([{ kind: 'ai', op: 'dehaze', label: 'dehaze' }]),
    )

    expect(parseCommand('more clarity')).toEqual(
      expect.arrayContaining([{ kind: 'ai', op: 'clarity', label: 'clarity' }]),
    )
    expect(parseCommand('pop the colors')).toEqual(
      expect.arrayContaining([{ kind: 'ai', op: 'vibrance', label: 'vibrance' }]),
    )
    expect(parseCommand('blur the background')).toEqual(
      expect.arrayContaining([{ kind: 'ai', op: 'portraitBlur', label: 'portrait blur' }]),
    )
  })

  it('routes portrait-mode and bokeh phrasing to portrait blur, not face enhance', () => {
    for (const text of ['portrait mode', 'add bokeh', 'depth blur', 'blur background']) {
      const actions = parseCommand(text)
      expect(actions).toEqual(expect.arrayContaining([{ kind: 'ai', op: 'portraitBlur', label: 'portrait blur' }]))
      expect(actions.some((a) => a.kind === 'ai' && a.op === 'faceEnhance')).toBe(false)
    }
  })

  it('does not treat a dark-photo complaint as "make it darker"', () => {
    const actions = parseCommand('too dark')
    expect(actions.some((a) => a.kind === 'adjust' && a.patch.brightness !== undefined && a.patch.brightness < 0)).toBe(false)
    expect(actions.some((a) => a.kind === 'ai' && a.op === 'lowLight')).toBe(true)
  })

  it('does not stack extra saturation onto natural color look', () => {
    const actions = parseCommand('natural color look')
    expect(actions.some((a) => a.kind === 'adjust' && a.mode === 'replace' && /Natural Color/.test(a.label))).toBe(true)
    expect(
      actions.some((a) => a.kind === 'adjust' && a.mode === 'merge' && a.patch.saturation !== undefined),
    ).toBe(false)
  })

  it('still treats colorful / more saturated as a saturation merge', () => {
    const colorful = parseCommand('make it colorful').find((a) => a.kind === 'adjust')
    expect(colorful).toMatchObject({ kind: 'adjust', mode: 'merge' })
    expect(colorful).toHaveProperty('patch.saturation')
  })
})
