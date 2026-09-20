/** One shared HTMLAudioElement — starting a track stops the previous. */

let audio: HTMLAudioElement | null = null
let currentId: string | null = null

function el(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio()
    audio.preload = 'auto'
  }
  return audio
}

export function previewTrack(url: string, id: string) {
  const node = el()
  if (currentId !== id) {
    node.src = url
    currentId = id
  }
  void node.play().catch(() => {})
}

export function pausePreview() {
  audio?.pause()
}

export function stopPreview() {
  if (!audio) return
  audio.pause()
  audio.removeAttribute('src')
  audio.load()
  currentId = null
}

export function seekPreview(seconds: number) {
  if (!audio) return
  audio.currentTime = Math.max(0, seconds)
}

export function previewCurrentId(): string | null {
  return currentId
}

export function previewPaused(): boolean {
  return !audio || audio.paused
}
