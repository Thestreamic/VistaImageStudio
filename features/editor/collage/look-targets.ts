/** Layers that should receive a look / Optimize Image pass. */
export function collageLookTargetIds<T extends { id: string; collageCell?: unknown; collageFilled?: boolean; visible?: boolean }>(
  layers: T[],
): string[] {
  return layers.filter((layer) => layer.collageCell && layer.collageFilled && layer.visible !== false).map((layer) => layer.id)
}

export function isCollageDocument<T extends { collageCell?: unknown }>(layers: T[]): boolean {
  return layers.some((layer) => layer.collageCell)
}
