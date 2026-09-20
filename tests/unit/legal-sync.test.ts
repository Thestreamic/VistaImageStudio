import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { EULA_TEXT, EULA_VERSION } from '@/lib/legal/eula'
import { NOTICES_TEXT } from '@/lib/legal/notices'
import { PRIVACY_SECTIONS, PRIVACY_SHORT } from '@/lib/legal/privacy'

const root = process.cwd()

function decodeHtml(text: string) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
}

function preText(html: string, id: string) {
  const match = html.match(new RegExp(`<pre id="${id}">([\\s\\S]*?)</pre>`))
  expect(match, `missing <pre id="${id}">`).toBeTruthy()
  return decodeHtml(match![1]).replace(/\r\n/g, '\n').trim()
}

describe('canonical legal files stay in sync', () => {
  it('keeps Ireland as governing law and exclusive courts', () => {
    const compact = EULA_TEXT.replace(/\s+/g, ' ')
    expect(compact).toContain(
      'This Agreement shall be governed by the laws of Ireland, without regard to its conflict of laws principles.',
    )
    expect(compact).toContain('The courts of Ireland shall have exclusive jurisdiction')
    expect(EULA_VERSION).toBe('2026-09-20')
  })

  it('ships THIRD-PARTY-LICENSES.txt from the notices module', () => {
    const shipped = readFileSync(path.join(root, 'public', 'THIRD-PARTY-LICENSES.txt'), 'utf8')
      .replace(/\r\n/g, '\n')
      .trim()
    expect(shipped).toBe(NOTICES_TEXT.replace(/\r\n/g, '\n').trim())
  })

  it('keeps docs/eula.html identical to EULA_TEXT', () => {
    const html = readFileSync(path.join(root, 'docs', 'eula.html'), 'utf8')
    expect(preText(html, 'eula-canonical')).toBe(EULA_TEXT.trim())
  })

  it('keeps docs/notices.html identical to NOTICES_TEXT', () => {
    const html = readFileSync(path.join(root, 'docs', 'notices.html'), 'utf8')
    expect(preText(html, 'notices-canonical')).toBe(NOTICES_TEXT.trim())
  })

  it('keeps docs/privacy.html aligned with the privacy module', () => {
    const html = readFileSync(path.join(root, 'docs', 'privacy.html'), 'utf8')
    expect(html).toContain(PRIVACY_SHORT)
    expect(html).toContain('thestreamic@gmail.com')
    for (const section of PRIVACY_SECTIONS) {
      expect(html).toContain(section.heading)
    }
  })

  it('does not invent extra model licenses', () => {
    expect(NOTICES_TEXT).toContain('License: MIT')
    expect(NOTICES_TEXT).toContain('License: Apache License 2.0')
    expect(NOTICES_TEXT).toContain('MODNet')
    expect(NOTICES_TEXT).toContain('LaMa')
    expect(NOTICES_TEXT).toContain('MiDaS')
    expect(NOTICES_TEXT).toContain('onnxruntime-web')
    expect(NOTICES_TEXT).not.toMatch(/GGUF|LLaMA|stable-diffusion/i)
  })
})
