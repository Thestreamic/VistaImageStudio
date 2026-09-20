import { describe, it, expect } from 'vitest'
import { isImageFile, looksLikeHeic, fileFromDataTransfer, filesFromDataTransfer, IMAGE_FILE_ACCEPT } from '@/lib/image/canvas'

function fakeFile(name: string, type: string): File {
  return new File([new Uint8Array([0])], name, { type })
}

function heicHeader(brand: string): Uint8Array {
  const bytes = new Uint8Array(16)
  bytes.set([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70])
  for (let i = 0; i < 4; i++) bytes[8 + i] = brand.charCodeAt(i)
  return bytes
}

describe('HEIC / iPhone import detection', () => {
  it('treats iPhone filenames as images even with an empty MIME type', () => {
    expect(isImageFile(fakeFile('IMG_1234.HEIC', ''))).toBe(true)
    expect(isImageFile(fakeFile('IMG_1234.heif', ''))).toBe(true)
    expect(isImageFile(fakeFile('photo.hif', 'application/octet-stream'))).toBe(true)
  })

  it('recognises HEIC from name, MIME, and ftyp brand', () => {
    expect(looksLikeHeic({ name: 'IMG_0001.HEIC', type: '' })).toBe(true)
    expect(looksLikeHeic({ name: 'shot.jpg', type: 'image/heic' })).toBe(true)
    expect(looksLikeHeic({}, heicHeader('heic'))).toBe(true)
    expect(looksLikeHeic({}, heicHeader('mif1'))).toBe(true)
    expect(looksLikeHeic({ name: 'shot.jpg', type: 'image/jpeg' }, heicHeader('isom'))).toBe(false)
  })

  it('advertises HEIC on the file picker accept list', () => {
    expect(IMAGE_FILE_ACCEPT).toMatch(/heic/i)
    expect(IMAGE_FILE_ACCEPT).toMatch(/heif/i)
  })

  it('reads a dropped file from DataTransfer items or files', () => {
    const file = fakeFile('IMG_1234.HEIC', '')
    const fromItems = {
      items: [{ kind: 'file', getAsFile: () => file }],
      files: [] as unknown as FileList,
    } as unknown as DataTransfer
    const fromFiles = {
      items: [] as unknown as DataTransferItemList,
      files: [file] as unknown as FileList,
    } as unknown as DataTransfer
    expect(fileFromDataTransfer(fromItems)?.name).toBe('IMG_1234.HEIC')
    expect(fileFromDataTransfer(fromFiles)?.name).toBe('IMG_1234.HEIC')
    expect(fileFromDataTransfer(null)).toBeNull()
  })

  it('collects every file from a DataTransfer files list', async () => {
    const a = fakeFile('a.png', 'image/png')
    const b = fakeFile('b.jpg', 'image/jpeg')
    const dt = {
      items: [] as unknown as DataTransferItemList,
      files: [a, b] as unknown as FileList,
    } as unknown as DataTransfer
    const files = await filesFromDataTransfer(dt)
    expect(files.map((f) => f.name)).toEqual(['a.png', 'b.jpg'])
    expect(await filesFromDataTransfer(null)).toEqual([])
  })

  it('walks a dropped folder via webkitGetAsEntry', async () => {
    const nested = fakeFile('in-folder.png', 'image/png')
    const fileEntry = {
      isFile: true,
      isDirectory: false,
      file: (ok: (f: File) => void) => ok(nested),
    }
    const dirEntry = {
      isFile: false,
      isDirectory: true,
      createReader: () => {
        let sent = false
        return {
          readEntries: (ok: (entries: unknown[]) => void) => {
            if (sent) {
              ok([])
              return
            }
            sent = true
            ok([fileEntry])
          },
        }
      },
    }
    const dt = {
      items: [{
        kind: 'file',
        getAsFile: () => null,
        webkitGetAsEntry: () => dirEntry,
      }],
      files: [] as unknown as FileList,
    } as unknown as DataTransfer
    const files = await filesFromDataTransfer(dt)
    expect(files.map((f) => f.name)).toEqual(['in-folder.png'])
  })
})
