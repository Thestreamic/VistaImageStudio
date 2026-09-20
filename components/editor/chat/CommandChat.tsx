'use client'
import { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, ChevronDown, ChevronUp } from 'lucide-react'
import { useEditorStore, selectPhotoLayer } from '@/features/editor/store/editor-store'
import type { CommandAiOp } from '@/features/editor/command-parser'
import { defaultAdjustments } from '@/features/editor/types'
import { aiClient } from '@/features/ai/ai-client'
import { imageDataOf, canvasFromImageData } from '@/lib/image/canvas'
import { cn } from '@/lib/utils'
import { commandsFromText, commandLabels } from '@/features/editor/commands/from-text'
import { aiSkipMessage } from '@/features/ai/algorithms/gated'
import type { EditorCommand } from '@/features/editor/commands/schema'
import { cropRectForPreset } from '@/features/editor/crop-presets'

interface ChatMsg { id: string; role: 'user' | 'assistant'; text: string }

type PixelSrc = { data: Uint8ClampedArray; width: number; height: number }
type Progress = (progress: number, detail?: string) => void
type PixelResult = Promise<{ result: ArrayBuffer; width: number; height: number; meta?: Record<string, unknown> }>

const PIXEL_OPS: Record<CommandAiOp, (src: PixelSrc, onProgress: Progress) => PixelResult> = {
  removeBackground: (src, onP) => aiClient.removeBackground(src, true, { onProgress: onP }),
  denoise: (src, onP) => aiClient.denoise(src, 18, { onProgress: onP }),
  upscale: (src, onP) => aiClient.upscale(src, 2, false, { onProgress: onP }),
  autoColor: (src, onP) => aiClient.autoColor(src, { onProgress: onP }),
  faceEnhance: (src, onP) => aiClient.faceEnhance(src, 18, 10, { onProgress: onP }),
  lowLight: (src, onP) => aiClient.lowLight(src, { onProgress: onP }),
  dehaze: (src, onP) => aiClient.dehaze(src, { onProgress: onP }),
  clarity: (src, onP) => aiClient.clarity(src, { onProgress: onP }),
  vibrance: (src, onP) => aiClient.vibrance(src, { onProgress: onP }),
  backgroundBlur: (src, onP) => aiClient.portraitBlur(src, true, { onProgress: onP }),
  portraitBlur: (src, onP) => aiClient.portraitBlur(src, true, { onProgress: onP }),
}

const SUGGESTIONS = [
  'auto optimize',
  'natural color look',
  'brighten this dark photo',
  'pop the colors',
  'prepare Instagram 4:5',
]

const HISTORY_KEY = 'vista-chat-history'

function loadHistory(): ChatMsg[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ChatMsg[]
    return Array.isArray(parsed) ? parsed.slice(-40) : []
  } catch {
    return []
  }
}

function saveHistory(messages: ChatMsg[]) {
  try {
    const slim = messages.slice(-40).map((m) => ({ id: m.id, role: m.role, text: m.text }))
    localStorage.setItem(HISTORY_KEY, JSON.stringify(slim))
  } catch { /* ignore */ }
}

const WELCOME: ChatMsg = {
  id: 'welcome',
  role: 'assistant',
  text: 'Try “auto optimize” for a flagship grade, or “natural color look” for a softer true-to-life grade. I show a plan first — Apply to run. Nothing leaves this device.',
}

export function CommandChat({
  onRequestExport,
  open: openProp,
  onOpenChange,
}: {
  onRequestExport?: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
} = {}) {
  const [openInternal, setOpenInternal] = useState(true)
  const open = openProp ?? openInternal
  const setOpen = onOpenChange ?? setOpenInternal
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMsg[]>([WELCOME])
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<EditorCommand[] | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const layer = useEditorStore(selectPhotoLayer)
  const doc = useEditorStore((s) => s.doc)
  const updateAdjustments = useEditorStore((s) => s.updateAdjustments)
  const applyLook = useEditorStore((s) => s.applyLook)
  const setLiveCrop = useEditorStore((s) => s.setLiveCrop)
  const addWatermarkLayer = useEditorStore((s) => s.addWatermarkLayer)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const beginTransaction = useEditorStore((s) => s.beginTransaction)
  const endTransaction = useEditorStore((s) => s.endTransaction)
  const setAiJob = useEditorStore((s) => s.setAiJob)
  const replaceLayerPixels = useEditorStore((s) => s.replaceLayerPixels)
  const resizeDocumentToLayer = useEditorStore((s) => s.resizeDocumentToLayer)

  useEffect(() => {
    const stored = loadHistory()
    if (stored.length) setMessages(stored)
  }, [])

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, pending])
  useEffect(() => { saveHistory(messages) }, [messages])

  const say = (role: ChatMsg['role'], text: string) =>
    setMessages((m) => [...m, { id: `${Date.now()}_${role}`, role, text }])

  const runAiOp = async (op: CommandAiOp, label: string): Promise<string | null> => {
    if (!layer) return null
    const jobId = `${Date.now()}`
    setAiJob({ id: jobId, label, progress: -1 })
    try {
      const img = imageDataOf(layer.source)
      const src = { data: img.data, width: img.width, height: img.height }
      const onProgress = (progress: number, detail?: string) =>
        setAiJob({ id: jobId, label, progress, detail })
      const { result, width, height, meta } = await PIXEL_OPS[op](src, onProgress)
      if (meta?.skipped) return aiSkipMessage(meta.reason)
      const canvas = canvasFromImageData(new ImageData(new Uint8ClampedArray(result), width, height))
      if (op === 'upscale') resizeDocumentToLayer(layer.id, canvas)
      else replaceLayerPixels(layer.id, canvas, label)
      const cleared = typeof meta?.clearedFraction === 'number' ? meta.clearedFraction : null
      if (cleared !== null && cleared < 0.01) {
        return "I couldn't find a clear backdrop to cut away - background removal works best when the background is reasonably even."
      }
      return null
    } finally {
      setAiJob(null)
    }
  }

  const applyCommands = async (commands: EditorCommand[]) => {
    if (!doc || !layer) {
      say('assistant', 'Open an image first, then I can apply that.')
      return
    }
    setBusy(true)
    beginTransaction()
    const applied: string[] = []
    try {
      for (const cmd of commands) {
        if (cmd.op === 'adjust') {
          updateAdjustments(layer.id, cmd.mode === 'replace' ? { ...defaultAdjustments(), ...cmd.patch } : cmd.patch, true)
        } else if (cmd.op === 'look') {
          applyLook(cmd.id, cmd.intensity, true)
        } else if (cmd.op === 'crop') {
          setLiveCrop(cropRectForPreset(doc.width, doc.height, cmd.presetId))
        } else if (cmd.op === 'watermark') {
          addWatermarkLayer({ corner: cmd.corner, opacity: cmd.opacity, kind: 'text', text: '@studio' })
        } else if (cmd.op === 'undo') undo()
        else if (cmd.op === 'redo') redo()
        else if (cmd.op === 'export') onRequestExport?.()
        else if (cmd.op === 'ai') {
          const note = await runAiOp(cmd.name, cmd.label)
          if (note) {
            say('assistant', note)
            if (note.includes('Already looks good')) continue
          }
        }
        applied.push(cmd.label)
      }
    } catch (err) {
      setBusy(false)
      endTransaction()
      say('assistant', `That failed: ${err instanceof Error ? err.message : String(err)}`)
      return
    }
    endTransaction()
    setBusy(false)
    setPending(null)
    if (applied.length) say('assistant', `Done - applied ${applied.join(', ')}. Ready to export.`)
  }

  const plan = (raw: string) => {
    const text = raw.trim()
    if (!text) return
    say('user', text)
    setInput('')
    if (!doc || !layer) {
      say('assistant', 'Open an image first, then I can apply that.')
      return
    }
    const commands = commandsFromText(text)
    if (commands.length === 0) {
      say('assistant', 'I can only run local editor commands.')
      return
    }
    setPending(commands)
    say('assistant', `Plan: ${commandLabels(commands).join(' · ')}. Apply to run, or Cancel.`)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Open command chat"
        aria-label="Open command chat"
        className="h-full w-full shrink-0 flex items-center gap-2 px-3 bg-card hover:bg-secondary"
      >
        <Sparkles size={14} className="text-primary shrink-0" />
        <span className="text-[13px] font-semibold tracking-tight">Command Chat</span>
        <ChevronUp size={12} className="ml-auto text-muted-foreground" />
      </button>
    )
  }

  return (
    <div className="h-full min-h-0 w-full flex flex-col bg-card">
      <div className="h-11 shrink-0 flex items-center gap-2 px-3 border-b border-border">
        <Sparkles size={14} className="text-primary" />
        <span className="text-[13px] font-semibold tracking-tight">Command Chat</span>
        <button type="button" onClick={() => setOpen(false)} aria-label="Collapse command chat" className="ml-auto text-muted-foreground hover:text-foreground">
          <ChevronDown size={14} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-3 space-y-2">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              'text-[13px] rounded-lg px-3 py-2 max-w-[92%] leading-relaxed',
              m.role === 'user' ? 'ml-auto brand-gradient-bg text-white' : 'bg-secondary text-foreground',
            )}
          >
            {m.text}
          </div>
        ))}
        {pending && (
          <div className="rounded-lg border border-border p-2 space-y-2" data-testid="command-plan">
            <div className="flex flex-wrap gap-1">
              {pending.map((c, i) => (
                <span key={`${c.op}-${i}`} className="text-[12px] px-2 py-0.5 rounded-full bg-accent">{c.label}</span>
              ))}
            </div>
            <div className="flex gap-1.5">
              <button type="button" disabled={busy} onClick={() => void applyCommands(pending)} className="px-2.5 py-1 text-[12px] font-medium rounded-md brand-gradient-bg text-white">Apply</button>
              <button type="button" disabled={busy} onClick={() => setPending(null)} className="px-2.5 py-1 text-[12px] rounded-md bg-secondary">Cancel</button>
            </div>
          </div>
        )}
        {busy && <div className="text-[12px] text-muted-foreground px-1">Applying...</div>}
      </div>

      <div className="p-2 border-t border-border shrink-0">
        <div className="flex flex-wrap gap-1 mb-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => plan(s)} className="text-[12px] px-2.5 py-1 rounded-full bg-secondary hover:bg-secondary/80 text-foreground/90">
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') plan(input) }}
            placeholder="e.g. brighten this dark photo"
            data-testid="command-chat-input"
            disabled={busy}
            className="flex-1 bg-input rounded-md px-2.5 py-2 text-[13px] border border-border disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => plan(input)}
            disabled={busy || !input.trim()}
            aria-label="Send command"
            className="w-8 h-8 shrink-0 rounded-md brand-gradient-bg text-white flex items-center justify-center disabled:opacity-40"
          >
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
