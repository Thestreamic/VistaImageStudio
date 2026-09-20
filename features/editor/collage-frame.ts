/** Canva-style frame colours — one swatch per collage box, then they cycle. */
export type CollageFrameSwatch = {
  stroke: string
  fill: string
  glow: string
  canvasBg: string
  ink: string
}

export const COLLAGE_FRAME_COLORS: CollageFrameSwatch[] = [
  { stroke: '#ff5ea6', fill: 'rgba(255, 94, 166, 0.20)', glow: 'rgba(255, 94, 166, 0.48)', canvasBg: '#ffe6f2', ink: '#8a1850' },
  { stroke: '#7c5cff', fill: 'rgba(124, 92, 255, 0.20)', glow: 'rgba(124, 92, 255, 0.48)', canvasBg: '#ece6ff', ink: '#3d2a9e' },
  { stroke: '#4f9dff', fill: 'rgba(79, 157, 255, 0.20)', glow: 'rgba(79, 157, 255, 0.48)', canvasBg: '#e5f1ff', ink: '#1a4f96' },
  { stroke: '#22c49a', fill: 'rgba(34, 196, 154, 0.20)', glow: 'rgba(34, 196, 154, 0.48)', canvasBg: '#ddfaf0', ink: '#0b6b52' },
  { stroke: '#ffb020', fill: 'rgba(255, 176, 32, 0.22)', glow: 'rgba(255, 176, 32, 0.50)', canvasBg: '#fff3d6', ink: '#8a5a00' },
  { stroke: '#ff7a45', fill: 'rgba(255, 122, 69, 0.20)', glow: 'rgba(255, 122, 69, 0.48)', canvasBg: '#ffe6db', ink: '#9a3412' },
]

export function collageFrameColor(index: number): CollageFrameSwatch {
  const n = COLLAGE_FRAME_COLORS.length
  return COLLAGE_FRAME_COLORS[((index % n) + n) % n]
}
