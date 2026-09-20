export const DEFAULT_HOLD_SEC = 2.5
export const DEFAULT_FADE_IN = 0.8
export const DEFAULT_FADE_OUT = 1.5

export type SlideshowExportPlan = {
  concatFile: string
  outFile: string
  videoDuration: number
  musicFile?: string | null
  musicDuration?: number
  fadeIn?: number
  fadeOut?: number
  width: number
  height: number
}

/** Concat demuxer lines. Last still is listed twice so the final duration sticks. */
export function concatListForStills(files: string[], holdSec: number): string {
  if (!files.length) return ''
  const lines: string[] = []
  for (const file of files) {
    const safe = file.replace(/\\/g, '/')
    lines.push(`file '${safe.replace(/'/g, "'\\''")}'`)
    lines.push(`duration ${holdSec}`)
  }
  const last = files[files.length - 1].replace(/\\/g, '/')
  lines.push(`file '${last.replace(/'/g, "'\\''")}'`)
  return lines.join('\n') + '\n'
}

export function slideshowDuration(stillCount: number, holdSec = DEFAULT_HOLD_SEC): number {
  return Math.max(0, stillCount) * Math.max(0.2, holdSec)
}

export function musicShouldLoop(videoDuration: number, musicDuration?: number | null): boolean {
  if (!musicDuration || musicDuration <= 0) return false
  return musicDuration + 0.05 < videoDuration
}

export function buildSlideshowFfmpegArgs(plan: SlideshowExportPlan): string[] {
  const fadeIn = plan.fadeIn ?? DEFAULT_FADE_IN
  const fadeOut = plan.fadeOut ?? DEFAULT_FADE_OUT
  const w = Math.max(2, Math.floor(plan.width / 2) * 2)
  const h = Math.max(2, Math.floor(plan.height / 2) * 2)
  const vf = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`
  const args = ['-y', '-f', 'concat', '-safe', '0', '-i', plan.concatFile]
  const dur = Math.max(0.2, plan.videoDuration)
  const music = plan.musicFile
  if (music) {
    if (musicShouldLoop(dur, plan.musicDuration)) args.push('-stream_loop', '-1')
    args.push('-i', music)
    const fadeOutStart = Math.max(0, dur - fadeOut)
    args.push(
      '-t',
      String(dur),
      '-vf',
      vf,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-af',
      `afade=t=in:st=0:d=${fadeIn},afade=t=out:st=${fadeOutStart}:d=${fadeOut}`,
      '-shortest',
      plan.outFile,
    )
  } else {
    args.push('-t', String(dur), '-vf', vf, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', plan.outFile)
  }
  return args
}
