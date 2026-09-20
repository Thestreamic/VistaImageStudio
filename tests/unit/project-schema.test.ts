import { describe, it, expect } from 'vitest'
import { migrateProject } from '@/features/editor/project/migrate'
import { assertSafeProjectShape, parseProjectJson, ProjectValidationError } from '@/features/editor/project/validate'
import { PROJECT_SCHEMA_VERSION } from '@/features/editor/project/schema'

describe('vista project schema', () => {
  it('rejects http asset URLs', () => {
    const raw = {
      kind: 'lumen-project',
      schemaVersion: 1,
      assets: {
        a1: { id: 'a1', mime: 'image/png', dataUrl: 'https://evil.example/x.png' },
      },
      layers: [{ id: 'l1', assetId: 'a1' }],
    }
    expect(() => assertSafeProjectShape(raw)).toThrow(ProjectValidationError)
  })

  it('rejects javascript: assets', () => {
    const raw = {
      kind: 'lumen-project',
      schemaVersion: 1,
      assets: {
        a1: { id: 'a1', mime: 'image/png', dataUrl: 'javascript:alert(1)' },
      },
      layers: [],
    }
    expect(() => assertSafeProjectShape(raw)).toThrow(ProjectValidationError)
  })

  it('migrates a version-less object to schema 1', () => {
    const project = migrateProject({
      fileName: 'old.png',
      width: 10,
      height: 8,
      layers: [],
      assets: {},
    })
    expect(project.schemaVersion).toBe(PROJECT_SCHEMA_VERSION)
    expect(project.canvas).toEqual({ width: 10, height: 8 })
  })

  it('parses JSON and rejects garbage', () => {
    expect(() => parseProjectJson('{nope')).toThrow(ProjectValidationError)
  })
})
