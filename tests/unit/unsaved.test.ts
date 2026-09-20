import { describe, it, expect } from 'vitest'
import { needsUnsavedPrompt, resolveUnsavedChoice } from '@/features/editor/project/unsaved'

describe('unsaved changes guard', () => {
  it('prompts only when a dirty document is open', () => {
    expect(needsUnsavedPrompt(true, true)).toBe(true)
    expect(needsUnsavedPrompt(false, true)).toBe(false)
    expect(needsUnsavedPrompt(true, false)).toBe(false)
    expect(needsUnsavedPrompt(false, false)).toBe(false)
  })

  it('save proceeds only if the write succeeds', async () => {
    expect(await resolveUnsavedChoice('cancel', async () => true)).toBe(false)
    expect(await resolveUnsavedChoice('discard', async () => true)).toBe(true)
    expect(await resolveUnsavedChoice('save', async () => true)).toBe(true)
    expect(await resolveUnsavedChoice('save', async () => false)).toBe(false)
  })
})
