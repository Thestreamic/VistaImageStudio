'use client'
import { useEffect, useRef, useState } from 'react'
import { Type, AlignLeft, AlignCenter, AlignRight, Trash2, Check, X, ChevronDown } from 'lucide-react'
import { useEditorStore, selectActiveLayer } from '@/features/editor/store/editor-store'
import { TEXT_TEMPLATES } from '@/features/editor/text-templates'
import { FONT_FAMILIES } from '@/features/editor/types'
import type { TextAlign, FontWeight, TextLayerData } from '@/features/editor/types'
import { Slider } from './Slider'
import { cn } from '@/lib/utils'

const WEIGHT_OPTIONS: { value: FontWeight; label: string }[] = [
  { value: 400, label: 'Regular 400' },
  { value: 500, label: 'Medium 500' },
  { value: 600, label: 'Semibold 600' },
  { value: 700, label: 'Bold 700' },
  { value: 800, label: 'Extra Bold 800' },
]

export function TextPanel() {
  const layer = useEditorStore(selectActiveLayer)
  const addTextLayer = useEditorStore((s) => s.addTextLayer)
  const updateTextLayer = useEditorStore((s) => s.updateTextLayer)
  const removeLayer = useEditorStore((s) => s.removeLayer)
  const applyTextSession = useEditorStore((s) => s.applyTextSession)
  const cancelTextSession = useEditorStore((s) => s.cancelTextSession)
  const startTextSession = useEditorStore((s) => s.startTextSession)
  const textSession = useEditorStore((s) => s.textSession)
  const doc = useEditorStore((s) => s.doc)
  const brandKit = useEditorStore((s) => s.brandKit)
  const setBrandColor = useEditorStore((s) => s.setBrandColor)
  const setBrandFont = useEditorStore((s) => s.setBrandFont)

  const isTextLayer = !!layer?.textData

  useEffect(() => {
    if (layer?.textData) startTextSession(layer.id)
  }, [layer?.id, layer?.textData, startTextSession])

  return (
    <div className="p-3 space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <span className="panel-label">Title Templates</span>
          <Type size={12} className="text-muted-foreground" />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1 mb-2">Tap to add. Double-click any text box to edit the words, then click outside the box when you are done. Drag to move, or stretch a corner to resize.</p>
        <div className="grid grid-cols-2 gap-1.5">
          {TEXT_TEMPLATES.map((t) => (
            <button
              key={t.id}
              disabled={!doc}
              onClick={() => addTextLayer(t.data())}
              className="relative flex flex-col items-start gap-1 px-2.5 py-2.5 rounded-md bg-secondary hover:bg-secondary/80 disabled:opacity-40 disabled:pointer-events-none text-left transition-colors overflow-hidden"
            >
              <span className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: t.accent }} />
              <span
                className="truncate w-full"
                style={{
                  fontFamily: t.preview.fontFamily,
                  fontWeight: t.preview.fontWeight,
                  fontSize: t.preview.fontSize,
                  textTransform: t.preview.uppercase ? 'uppercase' : 'none',
                  color: t.accent,
                }}
              >
                Aa
              </span>
              <span className="text-[11px] text-muted-foreground">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {isTextLayer && layer && (
        <>
          <div className="h-px bg-border" />
          <TextEditControls
            layerId={layer.id}
            data={layer.textData!}
            brandKit={brandKit}
            onPatch={(patch, commit) => updateTextLayer(layer.id, patch, commit)}
            onDelete={() => removeLayer(layer.id)}
            onApply={applyTextSession}
            onCancel={cancelTextSession}
            canConfirm={textSession?.layerId === layer.id}
          />
        </>
      )}

      {!isTextLayer && layer && (
        <p className="text-[12px] text-muted-foreground">
          Select a text layer to edit its content and style, or add a new one above.
        </p>
      )}

      <div className="h-px bg-border" />
      <div>
        <span className="panel-label">Brand Kit</span>
        <p className="text-[11px] text-muted-foreground mt-1 mb-2">Your go-to colors and font — keeps every post on-brand.</p>
        <div className="flex items-center gap-1.5 mb-2">
          {brandKit.colors.map((c, i) => (
            <label key={i} className="relative w-7 h-7 rounded-full border border-border overflow-hidden cursor-pointer shrink-0" style={{ backgroundColor: c }}>
              <input
                type="color"
                value={c}
                onChange={(e) => setBrandColor(i, e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </label>
          ))}
        </div>
        <FontMenu
          value={brandKit.font}
          options={FONT_FAMILIES.map((f) => ({ value: f, label: f, fontFamily: f }))}
          onChange={setBrandFont}
        />
      </div>
    </div>
  )
}

function TextEditControls({
  data,
  brandKit,
  onPatch,
  onDelete,
  onApply,
  onCancel,
  canConfirm,
}: {
  layerId: string
  data: TextLayerData
  brandKit: { colors: string[]; font: string }
  onPatch: (patch: Partial<TextLayerData>, commit?: boolean) => void
  onDelete: () => void
  onApply: () => void
  onCancel: () => void
  canConfirm: boolean
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="panel-label">Edit Text</span>
        <button onClick={onDelete} className="text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>
      </div>

      <textarea
        value={data.content}
        onChange={(e) => onPatch({ content: e.target.value }, false)}
        onBlur={() => onPatch({}, true)}
        rows={2}
        className="w-full bg-secondary text-foreground rounded-md px-2.5 py-2 text-[14px] leading-snug border border-border resize-none placeholder:text-muted-foreground"
        placeholder="Your text…"
      />

      <div className="grid grid-cols-2 gap-2">
        <FontMenu
          value={data.fontFamily}
          options={FONT_FAMILIES.map((f) => ({ value: f, label: f, fontFamily: f }))}
          onChange={(fontFamily) => onPatch({ fontFamily }, true)}
        />
        <FontMenu
          value={String(data.fontWeight)}
          options={WEIGHT_OPTIONS.map((w) => ({ value: String(w.value), label: w.label }))}
          onChange={(v) => onPatch({ fontWeight: Number(v) as FontWeight }, true)}
        />
      </div>

      <Slider label="Size" value={data.fontSize} min={12} max={200}
        onChange={(fontSize) => onPatch({ fontSize }, false)} onCommit={() => onPatch({}, true)} />
      <Slider label="Letter Spacing" value={data.letterSpacing} min={-4} max={20}
        onChange={(letterSpacing) => onPatch({ letterSpacing }, false)} onCommit={() => onPatch({}, true)} />
      <Slider label="Line Height" value={Math.round(data.lineHeight * 100)} min={80} max={200}
        onChange={(v) => onPatch({ lineHeight: v / 100 }, false)} onCommit={() => onPatch({}, true)}
        formatValue={(v) => `${v}%`} />

      <div className="flex items-center justify-between">
        <span className="panel-label">Align</span>
        <div className="flex gap-0.5">
          {(['left', 'center', 'right'] as TextAlign[]).map((a) => {
            const Icon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight
            return (
              <button
                key={a}
                onClick={() => onPatch({ align: a }, true)}
                className={cn('w-7 h-6 flex items-center justify-center rounded', data.align === a ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50')}
              >
                <Icon size={12} />
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="panel-label">Color</span>
        <input type="color" value={data.color} onChange={(e) => onPatch({ color: e.target.value }, true)} className="w-8 h-6 rounded border border-border bg-transparent" />
      </div>
      <div className="flex items-center gap-1.5">
        {brandKit.colors.map((c, i) => (
          <button
            key={i}
            onClick={() => onPatch({ color: c }, true)}
            className="w-5 h-5 rounded-full border border-border shrink-0"
            style={{ backgroundColor: c }}
            title="Apply brand color"
          />
        ))}
        <button
          onClick={() => onPatch({ fontFamily: brandKit.font }, true)}
          className="ml-auto text-[12px] text-foreground hover:text-primary border-b border-dashed border-border"
        >
          Use brand font
        </button>
      </div>

      <label className="flex items-center justify-between">
        <span className="panel-label">Uppercase</span>
        <input type="checkbox" checked={data.uppercase} onChange={(e) => onPatch({ uppercase: e.target.checked }, true)} />
      </label>

      <label className="flex items-center justify-between">
        <span className="panel-label">Highlight background</span>
        <input
          type="checkbox"
          checked={!!data.backgroundColor}
          onChange={(e) => onPatch({ backgroundColor: e.target.checked ? '#ffe066' : null }, true)}
        />
      </label>
      {data.backgroundColor && (
        <input type="color" value={data.backgroundColor} onChange={(e) => onPatch({ backgroundColor: e.target.value }, true)} className="w-full h-6 rounded border border-border bg-transparent" />
      )}

      <label className="flex items-center justify-between">
        <span className="panel-label">Outline</span>
        <input
          type="checkbox"
          checked={!!data.strokeColor}
          onChange={(e) => onPatch({ strokeColor: e.target.checked ? '#000000' : null, strokeWidth: e.target.checked ? 4 : 0 }, true)}
        />
      </label>

      <div className="flex items-center gap-1.5 pt-1">
        <button
          type="button"
          disabled={!canConfirm}
          onClick={onApply}
          className="flex-1 h-9 rounded-md bg-emerald-500 text-white text-[13px] font-semibold flex items-center justify-center gap-1 disabled:opacity-40"
        >
          <Check size={14} /> OK
        </button>
        <button
          type="button"
          disabled={!canConfirm}
          onClick={onCancel}
          className="flex-1 h-9 rounded-md bg-secondary text-foreground text-[13px] font-semibold flex items-center justify-center gap-1 border border-border disabled:opacity-40"
        >
          <X size={14} /> Cancel
        </button>
      </div>
    </div>
  )
}

function FontMenu({
  value,
  options,
  onChange,
}: {
  value: string
  options: { value: string; label: string; fontFamily?: string }[]
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full h-9 px-2.5 rounded-md bg-secondary text-foreground text-[13px] font-medium border border-border flex items-center justify-between gap-1"
        style={current?.fontFamily ? { fontFamily: current.fontFamily } : undefined}
      >
        <span className="truncate">{current?.label ?? value}</span>
        <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-40 left-0 right-0 top-[calc(100%+4px)] max-h-56 overflow-auto rounded-md border border-border bg-popover shadow-xl">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={cn(
                'w-full text-left px-2.5 py-2 text-[14px] text-foreground hover:bg-accent',
                opt.value === value && 'bg-accent font-semibold',
              )}
              style={opt.fontFamily ? { fontFamily: opt.fontFamily } : undefined}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
