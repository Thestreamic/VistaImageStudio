import { describe, expect, it } from 'vitest'
import { isMobileLayoutWidth, MOBILE_LAYOUT_MAX_PX } from '@/lib/hooks/use-mobile-layout'

describe('isMobileLayoutWidth', () => {
  it('treats phones as mobile and desktops as the full editor', () => {
    expect(isMobileLayoutWidth(360)).toBe(true)
    expect(isMobileLayoutWidth(390)).toBe(true)
    expect(isMobileLayoutWidth(428)).toBe(true)
    expect(isMobileLayoutWidth(MOBILE_LAYOUT_MAX_PX)).toBe(true)
    expect(isMobileLayoutWidth(768)).toBe(false)
    expect(isMobileLayoutWidth(1280)).toBe(false)
  })
})
