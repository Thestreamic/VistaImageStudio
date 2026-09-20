import { dialog, type BrowserWindow } from 'electron'
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildSlideshowFfmpegArgs, concatListForStills, DEFAULT_HOLD_SEC, slideshowDuration } from './ffmpeg-args'

export type VideoExportRequest = {
  frames: { name: string; buffer: ArrayBuffer }[]
  holdSec?: number
  musicId?: string | null
  suggestedName?: string
  width?: number
  height?: number
}

function ffmpegBinary(): string | null {
  const name = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  const packed = path.join(process.resourcesPath, 'ffmpeg', name)
  const local = path.join(process.cwd(), 'resources', 'ffmpeg', name)
  if (existsSync(packed)) return packed
  if (existsSync(local)) return local
  return name
}

function musicRoot(): string {
  const packed = path.join(process.resourcesPath, 'music')
  const local = path.join(process.cwd(), 'public', 'music')
  if (existsSync(path.join(packed, 'manifest.json'))) return packed
  return local
}

async function resolveMusicFile(id: string | null | undefined): Promise<{ file: string; durationMs: number } | null> {
  if (!id || typeof id !== 'string' || id.includes('..') || id.includes('/') || id.includes('\\')) return null
  const root = musicRoot()
  const manifestPath = path.join(root, 'manifest.json')
  if (!existsSync(manifestPath)) return null
  try {
    const raw = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as { tracks?: Array<{ id: string; file: string; duration_ms?: number }> }
    const track = (raw.tracks ?? []).find((t) => t.id === id)
    if (!track?.file) return null
    const file = path.join(root, track.file.replace(/\//g, path.sep))
    if (!existsSync(file)) return null
    return { file, durationMs: track.duration_ms ?? 0 }
  } catch {
    return null
  }
}

function runFfmpeg(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true })
    let err = ''
    child.stderr.on('data', (chunk) => {
      err += String(chunk)
      if (err.length > 8000) err = err.slice(-4000)
    })
    child.on('error', (e) => reject(e))
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(err.trim().slice(-800) || `ffmpeg exited ${code}`))
    })
  })
}

export async function exportSlideshowMp4(win: BrowserWindow | null, req: VideoExportRequest): Promise<{ ok: boolean; canceled?: boolean; error?: string }> {
  if (!win) return { ok: false, error: 'No window' }
  const frames = Array.isArray(req.frames) ? req.frames : []
  if (!frames.length) return { ok: false, error: 'No stills' }
  const hold = typeof req.holdSec === 'number' && req.holdSec > 0 ? req.holdSec : DEFAULT_HOLD_SEC
  const bin = ffmpegBinary()
  if (!bin) return { ok: false, error: 'FFmpeg is not available. Video export needs the desktop build.' }

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vista-video-'))
  try {
    const stillPaths: string[] = []
    for (let i = 0; i < frames.length; i++) {
      const name = `slide-${String(i).padStart(3, '0')}.jpg`
      const dest = path.join(tmp, name)
      await fs.writeFile(dest, Buffer.from(frames[i].buffer))
      stillPaths.push(dest)
    }
    const concatFile = path.join(tmp, 'list.txt')
    await fs.writeFile(concatFile, concatListForStills(stillPaths, hold), 'utf8')
    const music = await resolveMusicFile(req.musicId)
    const outTmp = path.join(tmp, 'out.mp4')
    const width = Math.max(2, req.width ?? 1080)
    const height = Math.max(2, req.height ?? 1080)
    const args = buildSlideshowFfmpegArgs({
      concatFile,
      outFile: outTmp,
      videoDuration: slideshowDuration(stillPaths.length, hold),
      musicFile: music?.file ?? null,
      musicDuration: music ? music.durationMs / 1000 : undefined,
      width,
      height,
    })
    try {
      await runFfmpeg(bin, args)
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'FFmpeg failed' }
    }
    const { filePath, canceled } = await dialog.showSaveDialog(win, {
      title: 'Save video',
      defaultPath: req.suggestedName || 'slideshow.mp4',
      filters: [{ name: 'MP4 video', extensions: ['mp4'] }],
    })
    if (canceled || !filePath) return { ok: false, canceled: true }
    await fs.copyFile(outTmp, filePath)
    return { ok: true }
  } finally {
    await fs.rm(tmp, { recursive: true, force: true }).catch(() => {})
  }
}
