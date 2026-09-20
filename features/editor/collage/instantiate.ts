import { uid } from '@/lib/image/canvas'
import type { DocumentState, Layer } from '../types'
import { defaultAdjustments, defaultTextData } from '../types'
import { renderTextLayer } from '../engine/text-render'
import { renderCollageMat, renderCollagePlaceholder } from '../engine/collage'
import { drawDecorShape } from './decor-draw'
import type { CollageTemplate, DecorElement, PhotoSlot } from './template-types'

export type CollageInstancePlan = {
  width: number
  height: number
  fileName: string
  backgroundColor: string
  slotCount: number
  textCount: number
  slots: Array<{
    id: string
    name: string
    x: number
    y: number
    width: number
    height: number
    zIndex: number
    collageSlot: NonNullable<Layer['collageSlot']>
  }>
  decorations: Array<{ type: DecorElement['type']; content?: string; zIndex: number }>
}

export function templateInstancePlan(
  template: CollageTemplate,
  width = template.canvasWidth,
  height = template.canvasHeight,
): CollageInstancePlan {
  const slots = [...template.slots].sort((a, b) => a.zIndex - b.zIndex)
  const decorations = [...template.decorations].sort((a, b) => a.zIndex - b.zIndex)
  return {
    width,
    height,
    fileName: `${template.name}.png`,
    backgroundColor: template.backgroundColor,
    slotCount: slots.length,
    textCount: decorations.filter((item) => item.type === 'text').length,
    slots: slots.map((slot, index) => slotPixels(slot, width, height, index)),
    decorations: decorations.map((item) => ({ type: item.type, content: item.content, zIndex: item.zIndex })),
  }
}

function slotPixels(slot: PhotoSlot, width: number, height: number, index: number) {
  return {
    id: slot.id,
    name: `Photo ${index + 1}`,
    x: Math.round(slot.x * width),
    y: Math.round(slot.y * height),
    width: Math.max(1, Math.round(slot.width * width)),
    height: Math.max(1, Math.round(slot.height * height)),
    zIndex: slot.zIndex,
    collageSlot: {
      shape: slot.shape,
      ...(slot.rotation ? { rotation: slot.rotation } : {}),
    } as NonNullable<Layer['collageSlot']>,
  }
}

function makeBaseLayer(source: HTMLCanvasElement, name: string, opts?: Partial<Layer>): Layer {
  return {
    id: uid('layer'),
    name,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'normal',
    source,
    x: 0,
    y: 0,
    adjustments: defaultAdjustments(),
    ...opts,
  }
}

function textLayerFromDecor(decor: DecorElement, canvasW: number, canvasH: number): Layer {
  const data = defaultTextData({
    content: decor.content ?? '',
    fontFamily: decor.fontFamily ?? 'Playfair Display',
    fontSize: decor.fontSize ?? 48,
    fontWeight: decor.fontWeight ?? 700,
    color: decor.color ?? '#333333',
    align: 'center',
  })
  const canvas = renderTextLayer(data)
  return makeBaseLayer(canvas, data.content.slice(0, 24) || 'Text', {
    kind: 'text',
    textData: data,
    x: Math.round(decor.x * canvasW - canvas.width / 2),
    y: Math.round(decor.y * canvasH - canvas.height / 2),
    locked: false,
  })
}

function shapeLayerFromDecor(decor: DecorElement, canvasW: number, canvasH: number): Layer {
  const w = Math.max(8, Math.round((decor.width ?? 0.08) * canvasW))
  const h = Math.max(8, Math.round((decor.height ?? 0.08) * canvasH))
  const canvas = drawDecorShape(decor.shape ?? 'heart', w, h, decor.color ?? '#c45c6a')
  return makeBaseLayer(canvas, decor.shape ?? 'Decor', {
    locked: true,
    x: Math.round(decor.x * canvasW),
    y: Math.round(decor.y * canvasH),
  })
}

export function instantiateTemplate(
  template: CollageTemplate,
  width = template.canvasWidth,
  height = template.canvasHeight,
): Pick<DocumentState, 'width' | 'height' | 'layers' | 'activeLayerId' | 'fileName'> {
  const plan = templateInstancePlan(template, width, height)
  const page = makeBaseLayer(renderCollageMat(width, height, template.backgroundColor, template.backgroundPattern), 'Page', {
    locked: true,
    collageMat: true,
  })

  const slotLayers: Layer[] = plan.slots.map((slot, index) =>
    makeBaseLayer(renderCollagePlaceholder(slot.width, slot.height, index + 1), slot.name, {
      x: slot.x,
      y: slot.y,
      collageCell: { width: slot.width, height: slot.height },
      collageFilled: false,
      collageSlot: slot.collageSlot,
    }),
  )

  const decorations = [...template.decorations].sort((a, b) => a.zIndex - b.zIndex)
  const decorLayers: Layer[] = decorations.map((decor) =>
    decor.type === 'text' ? textLayerFromDecor(decor, width, height) : shapeLayerFromDecor(decor, width, height),
  )

  const layers = [page, ...slotLayers, ...decorLayers]
  return {
    width,
    height,
    layers,
    activeLayerId: slotLayers[0]?.id ?? page.id,
    fileName: plan.fileName,
  }
}
