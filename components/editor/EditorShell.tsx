'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { TitleBar } from './chrome/TitleBar'
import { TopBar } from './chrome/TopBar'
import { ThemeProvider } from './chrome/ThemeProvider'
import { Toolbar } from './toolbar/Toolbar'
import { EditorStage } from './canvas/EditorStage'
import { CompareView } from './compare/CompareView'
import { RightPanel } from './chrome/RightPanel'
import { ImportedImagesBin, type BinImportProgress } from './chrome/ImportedImagesBin'
import { StatusToast } from './chrome/StatusToast'
import { LaunchSplash, shouldSkipLaunchSplash } from './chrome/LaunchSplash'
import { AiProgressOverlay } from './chrome/AiProgressOverlay'
import { ImportProgressOverlay, type ImportProgress } from './chrome/ImportProgressOverlay'
import { MobileBottomNav, MobileTopBar, type MobileSheetId } from './chrome/MobileChrome'
import { MobileBottomSheet } from './chrome/MobileBottomSheet'
import { MobileOverflowMenu } from './chrome/MobileOverflowMenu'
import { NewDesignDialog } from './dialogs/NewDesignDialog'
import { EDITOR_PANELS } from './panels/registry'
import { useMobileLayout } from '@/lib/hooks/use-mobile-layout'
import { cn } from '@/lib/utils'
import { ExportDialog } from './dialogs/ExportDialog'
import { PhotoVideoDialog } from './dialogs/PhotoVideoDialog'
import { PrivacyCentre } from './dialogs/PrivacyCentre'
import { FirstRunDialog, isOnboarded } from './dialogs/FirstRunDialog'
import { EulaGateDialog, EulaLoadingScreen } from './dialogs/EulaGateDialog'
import { AboutDialog } from './dialogs/AboutDialog'
import { LegalViewerDialog, type LegalDocId } from './dialogs/LegalViewerDialog'
import { RecipesDialog } from './dialogs/RecipesDialog'
import { BatchDialog } from './dialogs/BatchDialog'
import { bumpLocalStreak } from './dialogs/PrivacyCentre'
import { useEditorStore, selectPhotoLayer, RECENT_IMPORTS_CAP, type RecentImport } from '@/features/editor/store/editor-store'
import { getBridge, isElectron } from '@/lib/platform/bridge'
import { hasAcceptedCurrentEula } from '@/lib/legal/acceptance'
import { declineEulaAndExit, hydrateEulaAcceptance } from '@/lib/legal/persist-eula'
import { canvasFromBlob, canvasFromRecentImport, canvasToOpenFromImport, filesFromDataTransfer, isImageFile, looksLikeHeic, IMAGE_FILE_ACCEPT, thumbnailDataUrl, workingCanvasFromSource } from '@/lib/image/canvas'
import { isCellDrag, isVistaInternalDrag } from '@/features/editor/media-drag'
import { isCollageDocument } from '@/features/editor/collage/look-targets'
import { printComposite } from '@/features/editor/print'
import { importOpensDocument, type ImportIntent } from '@/features/editor/media-import'
import { useProjectPersistence } from '@/features/editor/project/use-persistence'
import { useUnsavedChanges } from './hooks/use-unsaved-changes'
import { aiClient } from '@/features/ai/ai-client'
import { aiSkipMessage } from '@/features/ai/algorithms/gated'
import { imageDataOf, canvasFromImageData } from '@/lib/image/canvas'

function transferLooksLikeFiles(transfer: DataTransfer | null | undefined): boolean {
  if (!transfer) return false
  if (transfer.files && transfer.files.length > 0) return true
  return Array.from(transfer.types ?? []).some(
    (type) => type === 'Files' || type === 'application/x-moz-file',
  )
}

type EulaGate = 'loading' | 'needed' | 'accepted'

function initialEulaGate(): EulaGate {
  if (typeof window === 'undefined') return 'loading'
  if (hasAcceptedCurrentEula()) return 'accepted'
  if (window.lumen) return 'loading'
  return 'needed'
}

export function EditorShell() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const doc = useEditorStore((s) => s.doc)
  const dirty = useEditorStore((s) => s.dirty)
  const openImage = useEditorStore((s) => s.openImage)
  const addRecentImport = useEditorStore((s) => s.addRecentImport)
  const hydrateMediaLibrary = useEditorStore((s) => s.hydrateMediaLibrary)
  const rotate90 = useEditorStore((s) => s.rotate90)
  const flip = useEditorStore((s) => s.flip)
  const setViewport = useEditorStore((s) => s.setViewport)
  const fitToScreen = useEditorStore((s) => s.fitToScreen)
  const zoomBy = useEditorStore((s) => s.zoomBy)
  const notify = useEditorStore((s) => s.notify)
  const compareMode = useEditorStore((s) => s.compareMode)
  const replaceLayerPixels = useEditorStore((s) => s.replaceLayerPixels)
  const resizeDocumentToLayer = useEditorStore((s) => s.resizeDocumentToLayer)
  const setAiJob = useEditorStore((s) => s.setAiJob)
  const placeMediaOnCanvas = useEditorStore((s) => s.placeMediaOnCanvas)
  const setActiveImportId = useEditorStore((s) => s.setActiveImportId)
  const { saveProject, openProject, openRecent, ingestProjectJson } = useProjectPersistence()
  const { runGuarded, unsavedDialog } = useUnsavedChanges(saveProject)
  const runGuardedRef = useRef(runGuarded)
  runGuardedRef.current = runGuarded
  const quitInflight = useRef(false)

  const [ready, setReady] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [showVideoDialog, setShowVideoDialog] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [showRecipes, setShowRecipes] = useState(false)
  const [showBatch, setShowBatch] = useState(false)
  const [showFirstRun, setShowFirstRun] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [legalDoc, setLegalDoc] = useState<LegalDocId | null>(null)
  const [eulaGate, setEulaGate] = useState<EulaGate>(initialEulaGate)
  const eulaAcceptedRef = useRef(eulaGate === 'accepted')
  eulaAcceptedRef.current = eulaGate === 'accepted'
  const [importJob, setImportJob] = useState<ImportProgress | null>(null)
  const [bootSplash, setBootSplash] = useState(false)
  const [bootComplete, setBootComplete] = useState(true)
  const [binImport, setBinImport] = useState<BinImportProgress | null>(null)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [mobileSheet, setMobileSheet] = useState<MobileSheetId | null>(null)
  const [showNewDialog, setShowNewDialog] = useState(false)
  const mobile = useMobileLayout()

  useEffect(() => {
    let cancelled = false
    void hydrateEulaAcceptance().then((ok) => {
      if (!cancelled) setEulaGate(ok ? 'accepted' : 'needed')
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setReady(true)
    bumpLocalStreak()
    getBridge().notifyUiReady?.()
    // Electron already showed the native splash. Don't wait on fonts/load —
    // that deadlock parked the bar at 84% with a fake media-streams label.
    if (shouldSkipLaunchSplash() || isElectron()) {
      setBootSplash(false)
      setBootComplete(true)
      return
    }
    setBootComplete(true)
  }, [])

  useEffect(() => {
    if (eulaGate === 'accepted' && !isOnboarded()) setShowFirstRun(true)
  }, [eulaGate])

  const mediaRestoreOnce = useRef(false)

  const importGen = useRef(0)
  const ingestGen = useRef(0)
  const binCancel = useRef(false)

  const cancelImport = useCallback(() => {
    importGen.current += 1
    ingestGen.current += 1
    binCancel.current = true
    setImportJob(null)
    setBinImport(null)
    notify('info', 'Import cancelled')
  }, [notify])

  const loadImage = useCallback(async (file: Blob, fileName: string, importId?: string, intent: ImportIntent = 'open') => {
    const gen = ++importGen.current
    const started = Date.now()
    const heic = looksLikeHeic({ name: fileName, type: file instanceof File ? file.type : '' })
    const openDoc = importOpensDocument(useEditorStore.getState().doc, intent)
    setDragActive(false)
    setImportJob({
      name: fileName,
      progress: 0.08,
      detail: heic ? 'Reading HEIC…' : 'Reading photo…',
    })
    const tick = window.setInterval(() => {
      if (importGen.current !== gen) return
      setImportJob((cur) => {
        if (!cur) return cur
        const cap = heic ? 0.92 : 0.86
        if (cur.progress >= cap) return cur
        const step = heic ? 0.025 : 0.06
        return { ...cur, progress: Math.min(cap, cur.progress + step) }
      })
    }, 90)
    try {
      if (heic) {
        setImportJob((cur) => cur ? { ...cur, detail: 'Decoding HEIC (this can take a few seconds)…' } : cur)
      } else {
        setImportJob((cur) => cur ? { ...cur, progress: Math.max(cur.progress, 0.28), detail: 'Decoding…' } : cur)
      }
      const canvas = await canvasFromBlob(file, fileName)
      if (importGen.current !== gen) return
      setImportJob({ name: fileName, progress: 1, detail: openDoc ? 'Opening…' : 'Adding to Media…' })
      const working = workingCanvasFromSource(canvas)
      addRecentImport({
        id: importId,
        name: fileName,
        blob: file,
        thumbnailDataUrl: thumbnailDataUrl(working),
        workingCanvas: working,
      })
      if (openDoc) openImage(canvas, fileName)
      else notify('success', `Added ${fileName} to Media`)
    } catch (error) {
      if (importGen.current !== gen) return
      console.error('Failed to import image', error)
      notify('error', `Could not import ${fileName}. Try PNG, JPEG, WebP, HEIC, GIF, BMP, AVIF, or TIFF.`)
    } finally {
      window.clearInterval(tick)
      const wait = Math.max(180, 320 - (Date.now() - started))
      window.setTimeout(() => {
        if (importGen.current === gen) setImportJob(null)
      }, wait)
    }
  }, [addRecentImport, notify, openImage])

  const lastIngestAt = useRef(0)
  const lastIngestSig = useRef('')
  const ingestFile = useCallback((file: File | null | undefined) => {
    if (!eulaAcceptedRef.current) return
    if (!file) return
    const now = Date.now()
    const sig = `${file.name}:${file.size}:${file.lastModified}`
    if (sig === lastIngestSig.current && now - lastIngestAt.current < 400) return
    lastIngestAt.current = now
    lastIngestSig.current = sig
    if (/\.lumen$/i.test(file.name)) {
      void file.text().then((json) => ingestProjectJson(json, null, file.name))
      return
    }
    if (!isImageFile(file)) {
      notify('error', `${file.name || 'That file'} is not a supported image. Use PNG, JPEG, WebP, HEIC, GIF, BMP, AVIF, or TIFF.`)
      return
    }
    void loadImage(file, file.name, undefined, 'drop')
  }, [ingestProjectJson, loadImage, notify])

  const ingestFiles = useCallback(async (files: File[]) => {
    if (!eulaAcceptedRef.current) return
    if (!files.length) return
    const now = Date.now()
    const sig = files.map((f) => `${f.name}:${f.size}:${f.lastModified}`).join('|')
    if (sig === lastIngestSig.current && now - lastIngestAt.current < 400) return
    lastIngestAt.current = now
    lastIngestSig.current = sig
    const lumen = files.find((f) => /\.lumen$/i.test(f.name))
    const images = files.filter((f) => isImageFile(f))
    if (lumen && images.length === 0) {
      void lumen.text().then((json) => ingestProjectJson(json, null, lumen.name))
      return
    }
    if (images.length === 0) {
      const name = files[0]?.name
      notify('error', `${name || 'That file'} is not a supported image. Use PNG, JPEG, WebP, HEIC, GIF, BMP, AVIF, or TIFF.`)
      return
    }
    if (images.length === 1) {
      void loadImage(images[0], images[0].name, undefined, 'folder')
      return
    }
    const truncated = images.length > RECENT_IMPORTS_CAP
    const batch = images.slice(0, RECENT_IMPORTS_CAP)
    const batchGen = ++ingestGen.current
    binCancel.current = false
    setBinImport({ done: 0, total: batch.length, name: batch[0].name })
    const stale = () => binCancel.current || ingestGen.current !== batchGen
    let failed = 0
    try {
      for (let i = 0; i < batch.length; i++) {
        if (stale()) break
        const file = batch[i]
        setBinImport({ done: i, total: batch.length, name: file.name })
        try {
          const canvas = await canvasFromBlob(file, file.name)
          if (stale()) break
          const working = workingCanvasFromSource(canvas)
          addRecentImport({
            name: file.name,
            blob: file,
            thumbnailDataUrl: thumbnailDataUrl(working),
            workingCanvas: working,
          }, { activate: i === 0 })
          if (i === 0 && importOpensDocument(useEditorStore.getState().doc, 'folder')) {
            openImage(canvas, file.name)
          }
        } catch {
          failed += 1
        }
        if (stale()) break
        setBinImport({ done: i + 1, total: batch.length, name: file.name })
      }
      if (!stale() && truncated) {
        notify('info', `Imported ${RECENT_IMPORTS_CAP} photos (folder had ${images.length}).`)
      } else if (!stale() && failed) {
        notify('info', `Imported ${batch.length - failed} photos · ${failed} skipped`)
      } else if (!stale()) {
        notify('success', `Imported ${batch.length} photos to Media`)
      }
    } finally {
      if (ingestGen.current === batchGen) setBinImport(null)
    }
  }, [addRecentImport, ingestProjectJson, loadImage, notify, openImage])

  const handleNativeOpen = useCallback(async () => {
    try {
      const file = await getBridge().openImage()
      if (file) await loadImage(file.blob, file.name)
    } catch (error) {
      console.error('Native file picker failed', error)
      notify('error', 'The system file picker failed. Use the Open button or drag a photo into the window.')
    }
  }, [loadImage, notify])

  const handleOpen = useCallback(() => {
    if (isElectron()) {
      void handleNativeOpen()
      return
    }
    const input = fileInputRef.current
    if (!input) return
    input.value = ''
    input.click()
  }, [handleNativeOpen])

  const handleSave = useCallback(async (saveAs = false) => {
    if (!useEditorStore.getState().doc) {
      notify('info', 'Nothing to save — open or create a project first.')
      return false
    }
    return saveProject(saveAs)
  }, [notify, saveProject])

  const handlePrint = useCallback(() => {
    const current = useEditorStore.getState().doc
    if (!current) {
      notify('info', 'Open a photo or collage first.')
      return
    }
    if (!printComposite(current)) notify('error', 'Print failed.')
  }, [notify])

  const openImportedOnCanvas = useCallback(async (item: RecentImport) => {
    setActiveImportId(item.id)
    try {
      const canvas = await canvasToOpenFromImport(item)
      openImage(canvas, item.name)
    } catch (error) {
      console.error('Failed to open imported photo', error)
      notify('error', `Could not open ${item.name}. Import that file again.`)
    }
  }, [notify, openImage, setActiveImportId])

  useEffect(() => {
    let cancelled = false
    void hydrateMediaLibrary().then(() => {
      if (cancelled || mediaRestoreOnce.current) return
      const state = useEditorStore.getState()
      if (state.doc) return
      const last = state.recentImports.find((row) => row.id === state.activeImportId) ?? state.recentImports[0]
      if (!last) return
      mediaRestoreOnce.current = true
      void openImportedOnCanvas(last)
    })
    return () => {
      cancelled = true
    }
  }, [hydrateMediaLibrary, openImportedOnCanvas])

  const handlePlaceImport = useCallback(async (item: RecentImport) => {
    setActiveImportId(item.id)
    const layers = useEditorStore.getState().doc?.layers ?? []
    if (!isCollageDocument(layers)) {
      await openImportedOnCanvas(item)
      return
    }
    try {
      const photo = await canvasFromRecentImport(item)
      placeMediaOnCanvas(photo, item.name)
    } catch (error) {
      console.error('Failed to place imported photo', error)
      notify('error', `Could not place ${item.name}. Import that file again.`)
    }
  }, [notify, openImportedOnCanvas, placeMediaOnCanvas, setActiveImportId])

  const startNewProject = useCallback(async () => {
    await runGuarded(async () => {
      useEditorStore.getState().newDocument(1080, 1350)
      void getBridge().clearAutosave()
      notify('success', 'New project')
    })
  }, [notify, runGuarded])

  const closeProject = useCallback(async () => {
    if (!useEditorStore.getState().doc) return
    await runGuarded(async () => {
      useEditorStore.getState().closeDocument()
      void getBridge().clearAutosave()
      notify('info', 'Project closed')
    })
  }, [notify, runGuarded])

  const closeCenteredPhoto = useCallback(async () => {
    const { doc } = useEditorStore.getState()
    if (!doc) return
    if (doc.projectPath) {
      await closeProject()
      return
    }
    useEditorStore.getState().closeDocument()
    void getBridge().clearAutosave()
  }, [closeProject])

  const handleOpenProject = useCallback(async () => {
    await runGuarded(async () => { await openProject() })
  }, [openProject, runGuarded])

  const handleOpenRecent = useCallback(async (path: string) => {
    await runGuarded(async () => { await openRecent(path) })
  }, [openRecent, runGuarded])

  const requestQuit = useCallback(async () => {
    if (quitInflight.current) return
    quitInflight.current = true
    try {
      const ok = await runGuardedRef.current(async () => {})
      const decide = getBridge().decideClose
      if (decide) await decide(ok ? 'allow' : 'cancel')
      else if (ok) await getBridge().allowQuit()
    } finally {
      quitInflight.current = false
    }
  }, [])

  const runAiMenu = useCallback(async (kind: 'auto' | 'bg' | 'denoise' | 'upscale') => {
    const layer = selectPhotoLayer(useEditorStore.getState())
    const current = useEditorStore.getState().doc
    if (!layer || !current) return
    const label = kind === 'auto' ? 'Auto Color' : kind === 'bg' ? 'Remove Background' : kind === 'denoise' ? 'Denoise' : 'Upscale'
    const jobId = `${Date.now()}`
    setAiJob({ id: jobId, label, progress: -1 })
    try {
      const img = imageDataOf(layer.source)
      const src = { data: img.data, width: img.width, height: img.height }
      const onProgress = (progress: number, detail?: string) => setAiJob({ id: jobId, label, progress, detail })
      const result =
        kind === 'auto' ? await aiClient.autoColor(src, { onProgress })
        : kind === 'bg' ? await aiClient.removeBackground(src, true, { onProgress })
        : kind === 'denoise' ? await aiClient.denoise(src, 18, { onProgress })
        : await aiClient.upscale(src, 2, false, { onProgress })
      if (result.meta?.skipped) {
        notify('info', aiSkipMessage(result.meta.reason))
        return
      }
      const canvas = canvasFromImageData(new ImageData(new Uint8ClampedArray(result.result), result.width, result.height))
      if (kind === 'upscale') resizeDocumentToLayer(layer.id, canvas)
      else replaceLayerPixels(layer.id, canvas, label)
    } catch (err) {
      notify('error', `${label} failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setAiJob(null)
    }
  }, [notify, replaceLayerPixels, resizeDocumentToLayer, setAiJob])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      else if (mod && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); redo() }
      else if (mod && e.key.toLowerCase() === 'o') {
        if (isElectron()) return
        e.preventDefault()
        if (e.shiftKey) void handleOpenProject()
        else handleOpen()
      }
      else if (mod && e.key.toLowerCase() === 's') {
        if (isElectron()) return
        e.preventDefault()
        void handleSave(e.shiftKey)
      }
      else if (mod && e.key.toLowerCase() === 'n') {
        if (isElectron()) return
        e.preventDefault()
        void startNewProject()
      }
      else if (mod && e.key.toLowerCase() === 'w') {
        if (isElectron()) return
        e.preventDefault()
        void closeProject()
      }
      else if (mod && e.key.toLowerCase() === 'e') { e.preventDefault(); if (doc) setShowExportDialog(true) }
      else if (mod && e.key.toLowerCase() === 'p') {
        if (isElectron()) return
        e.preventDefault()
        handlePrint()
      }
      else if (!mod && !e.altKey) {
        const tag = (e.target as HTMLElement | null)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement | null)?.isContentEditable) return
        if (e.key === 'Escape') {
          useEditorStore.getState().clearSelection()
          return
        }
        const k = e.key.toLowerCase()
        if (k === 'v') useEditorStore.getState().setTool('move')
        else if (k === 'c') useEditorStore.getState().setTool('crop')
        else if (k === 'm') useEditorStore.getState().setTool('select-rect')
        else if (k === 'w') useEditorStore.getState().setTool('select-wand')
        else if (k === 'h') useEditorStore.getState().setTool('hand')
        else if (e.key === 'Delete' || e.key === 'Backspace') {
          const state = useEditorStore.getState()
          if (state.textSession) return
          const layer = state.doc?.layers.find((l) => l.id === state.doc?.activeLayerId)
          if (!layer?.collageCell || layer.collageMat) return
          e.preventDefault()
          state.deleteCollageFrame(layer.id)
        }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          const state = useEditorStore.getState()
          if (state.tool === 'crop' || state.cropDraft || state.textSession) return
          const layer = state.doc?.layers.find((l) => l.id === state.doc?.activeLayerId)
          if (!layer?.collageCell || layer.collageMat || layer.locked) return
          e.preventDefault()
          const step = e.shiftKey ? 10 : 1
          const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
          const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
          state.offsetLayer(layer.id, dx, dy, true)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo, doc, handleOpen, handleOpenProject, handleSave, handlePrint, startNewProject, closeProject])

  useEffect(() => {
    if (!doc) {
      document.title = 'Vista Image Studio'
      return
    }
    document.title = `${doc.fileName}${dirty ? ' *' : ''} — Vista Image Studio`
  }, [doc, doc?.fileName, dirty])

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty || !doc) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty, doc])

  useEffect(() => {
    const bridge = getBridge()
    const unsubs = [
      bridge.on('menu:open', () => void handleNativeOpen()),
      bridge.on('menu:new-project', () => void startNewProject()),
      bridge.on('menu:open-project', () => void handleOpenProject()),
      bridge.on('menu:save', () => void handleSave(false)),
      bridge.on('menu:save-as', () => void handleSave(true)),
      bridge.on('menu:close-project', () => void closeProject()),
      bridge.on('menu:print', () => handlePrint()),
      bridge.on('menu:export', () => setShowExportDialog(true)),
      bridge.on('menu:make-video', () => setShowVideoDialog(true)),
      bridge.on('menu:undo', () => undo()),
      bridge.on('menu:redo', () => redo()),
      bridge.on('menu:rotate-cw', () => rotate90(1)),
      bridge.on('menu:rotate-ccw', () => rotate90(-1)),
      bridge.on('menu:flip-h', () => flip('horizontal')),
      bridge.on('menu:flip-v', () => flip('vertical')),
      bridge.on('menu:zoom-in', () => zoomBy(1.2)),
      bridge.on('menu:zoom-out', () => zoomBy(1 / 1.2)),
      bridge.on('menu:zoom-100', () => setViewport({ zoom: 1, panX: 0, panY: 0 })),
      bridge.on('menu:fit', () => {
        const stage = document.querySelector('[data-testid="editor-stage"]') as HTMLElement | null
        if (stage) fitToScreen(stage.clientWidth, stage.clientHeight)
      }),
      bridge.on('menu:auto-enhance', () => void runAiMenu('auto')),
      bridge.on('menu:bg-remove', () => void runAiMenu('bg')),
      bridge.on('menu:denoise', () => void runAiMenu('denoise')),
      bridge.on('menu:upscale', () => void runAiMenu('upscale')),
      bridge.on('menu:resize', () => notify('info', 'Use the Transform panel to resize.')),
      bridge.on('menu:about', () => setShowAbout(true)),
      bridge.on('menu:eula', () => setLegalDoc('eula')),
      bridge.on('menu:privacy-policy', () => setLegalDoc('privacy')),
      bridge.on('menu:notices', () => setLegalDoc('notices')),
      bridge.on('app:before-quit', () => void requestQuit()),
      bridge.on('app:confirm-close', () => void requestQuit()),
    ]
    return () => unsubs.forEach((u) => u())
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const allowDrop = (e: DragEvent) => {
      if (isVistaInternalDrag(e.dataTransfer)) {
        e.preventDefault()
        if (e.dataTransfer) e.dataTransfer.dropEffect = isCellDrag(e.dataTransfer) ? 'move' : 'copy'
        return
      }
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
      if (transferLooksLikeFiles(e.dataTransfer)) setDragActive(true)
    }
    const onDragLeave = (e: DragEvent) => {
      if (e.relatedTarget == null) setDragActive(false)
    }
    const onDrop = (e: DragEvent) => {
      if (isVistaInternalDrag(e.dataTransfer)) return
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)
      void filesFromDataTransfer(e.dataTransfer).then((files) => ingestFiles(files))
    }
    window.addEventListener('dragenter', allowDrop, true)
    window.addEventListener('dragover', allowDrop, true)
    window.addEventListener('dragleave', onDragLeave, true)
    window.addEventListener('drop', onDrop, true)
    document.addEventListener('dragover', allowDrop, true)
    document.addEventListener('drop', onDrop, true)
    return () => {
      window.removeEventListener('dragenter', allowDrop, true)
      window.removeEventListener('dragover', allowDrop, true)
      window.removeEventListener('dragleave', onDragLeave, true)
      window.removeEventListener('drop', onDrop, true)
      document.removeEventListener('dragover', allowDrop, true)
      document.removeEventListener('drop', onDrop, true)
    }
  }, [ingestFiles])

  if (eulaGate !== 'accepted') {
    return (
      <div
        data-testid="editor-shell"
        data-ready={ready}
        data-eula-accepted="false"
        className={cn(
          'w-screen flex flex-col overflow-hidden bg-background text-foreground',
          mobile ? 'h-dvh' : 'h-screen',
        )}
      >
        <ThemeProvider />
        {!mobile && (
          <TitleBar
            onMinimize={() => getBridge().minimize?.()}
            onMaximize={() => getBridge().maximize?.()}
            onClose={() => void declineEulaAndExit()}
          />
        )}
        {eulaGate === 'loading' ? (
          <EulaLoadingScreen />
        ) : (
          <EulaGateDialog onAccepted={() => setEulaGate('accepted')} />
        )}
      </div>
    )
  }

  return (
    <div
      data-testid="editor-shell"
      data-ready={ready}
      data-eula-accepted="true"
      className={cn(
        'w-screen flex flex-col overflow-hidden bg-background text-foreground',
        mobile ? 'h-dvh' : 'h-screen',
      )}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={(e) => {
        e.preventDefault()
        void filesFromDataTransfer(e.dataTransfer).then((files) => ingestFiles(files))
      }}
    >
      <ThemeProvider />
      <input
        ref={fileInputRef}
        type="file"
        accept={IMAGE_FILE_ACCEPT}
        data-testid="file-open-input"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.currentTarget.files?.[0]
          e.currentTarget.value = ''
          if (file) void loadImage(file, file.name)
        }}
      />
      {!mobile && (
        <TitleBar
          onMinimize={() => getBridge().minimize?.()}
          onMaximize={() => getBridge().maximize?.()}
          onClose={() => void requestQuit()}
        />
      )}
      {mobile ? (
        <MobileTopBar
          menuOpen={mobileMenu}
          onMenu={() => setMobileMenu((v) => !v)}
          onExportClick={() => setShowExportDialog(true)}
        />
      ) : (
        <TopBar
          menu={{
            onNewProject: () => void startNewProject(),
            onOpenImage: handleOpen,
            onOpenProject: () => void handleOpenProject(),
            onSave: () => void handleSave(false),
            onSaveAs: () => void handleSave(true),
            onCloseProject: () => void closeProject(),
            onExport: () => setShowExportDialog(true),
            onMakeVideo: () => setShowVideoDialog(true),
            onExit: () => void requestQuit(),
            onUndo: undo,
            onRedo: redo,
            onPrint: handlePrint,
            onAbout: () => setShowAbout(true),
          }}
          onOpenClick={handleOpen}
          onExportClick={() => setShowExportDialog(true)}
          onSaveClick={() => void handleSave(false)}
          onSaveAsClick={() => void handleSave(true)}
          onOpenProjectClick={() => void handleOpenProject()}
          onOpenRecent={(path) => void handleOpenRecent(path)}
          onPrivacyClick={() => setShowPrivacy(true)}
          onRecipesClick={() => setShowRecipes(true)}
          onBatchClick={() => setShowBatch(true)}
        />
      )}
      <div className="flex-1 flex min-h-0 relative">
        <Toolbar variant={mobile ? 'overlay' : 'dock'} />
        {!mobile && (
          <ImportedImagesBin
            onOpenImport={(item) => void openImportedOnCanvas(item)}
            onPlaceImport={(item) => void handlePlaceImport(item)}
            onImportFolder={(files) => void ingestFiles(files)}
            progress={binImport}
            onCancelImport={cancelImport}
          />
        )}
        {compareMode && doc ? <CompareView /> : <EditorStage onOpenClick={handleOpen} onDropFile={ingestFile} onClose={() => void closeCenteredPhoto()} />}
        {!mobile && (
          <aside
            data-testid="right-sidebar"
            className="w-72 shrink-0 flex flex-col min-h-0 bg-sidebar border-l border-sidebar-border"
          >
            <div className="min-h-0 flex-1 flex flex-col">
              <RightPanel />
            </div>
          </aside>
        )}
      </div>
      {mobile && (
        <MobileBottomNav
          active={mobileSheet}
          onSelect={(id) => setMobileSheet((cur) => (cur === id ? null : id))}
        />
      )}
      {mobile && mobileSheet && (
        <MobileBottomSheet
          title={mobileSheet === 'media' ? 'Media' : (EDITOR_PANELS.find((p) => p.id === mobileSheet)?.label ?? 'Tools')}
          onClose={() => setMobileSheet(null)}
        >
          {mobileSheet === 'media' ? (
            <ImportedImagesBin
              className="w-full h-full min-h-[16rem] border-0 bg-transparent"
              onOpenImport={(item) => void openImportedOnCanvas(item)}
              onPlaceImport={(item) => void handlePlaceImport(item)}
              onImportFolder={(files) => void ingestFiles(files)}
              progress={binImport}
              onCancelImport={cancelImport}
            />
          ) : (
            (() => {
              const Panel = EDITOR_PANELS.find((p) => p.id === mobileSheet)?.Panel
              return Panel ? <Panel /> : null
            })()
          )}
        </MobileBottomSheet>
      )}
      {mobile && (
        <MobileOverflowMenu
          open={mobileMenu}
          onClose={() => setMobileMenu(false)}
          menu={{
            onNewProject: () => void startNewProject(),
            onOpenImage: handleOpen,
            onOpenProject: () => void handleOpenProject(),
            onSave: () => void handleSave(false),
            onSaveAs: () => void handleSave(true),
            onCloseProject: () => void closeProject(),
            onExport: () => setShowExportDialog(true),
            onMakeVideo: () => setShowVideoDialog(true),
            onExit: () => void requestQuit(),
            onUndo: undo,
            onRedo: redo,
            onPrint: handlePrint,
            onAbout: () => setShowAbout(true),
          }}
          onOpenClick={handleOpen}
          onExportClick={() => setShowExportDialog(true)}
          onMakeVideoClick={() => setShowVideoDialog(true)}
          onSaveClick={() => void handleSave(false)}
          onSaveAsClick={() => void handleSave(true)}
          onOpenProjectClick={() => void handleOpenProject()}
          onOpenRecent={(path) => void handleOpenRecent(path)}
          onPrivacyClick={() => setShowPrivacy(true)}
          onAboutClick={() => setShowAbout(true)}
          onRecipesClick={() => setShowRecipes(true)}
          onBatchClick={() => setShowBatch(true)}
          onTemplatesClick={() => setShowNewDialog(true)}
          onMediaClick={() => setMobileSheet('media')}
        />
      )}
      {showNewDialog && <NewDesignDialog onClose={() => setShowNewDialog(false)} />}
      <StatusToast />
      <AiProgressOverlay />
      {importJob && <ImportProgressOverlay job={importJob} onCancel={cancelImport} />}
      {bootSplash && (
        <LaunchSplash
          complete={bootComplete}
          onDone={() => setBootSplash(false)}
        />
      )}
      {showExportDialog && (
        <ExportDialog
          onClose={() => setShowExportDialog(false)}
          onMakeVideo={() => setShowVideoDialog(true)}
        />
      )}
      {showVideoDialog && <PhotoVideoDialog onClose={() => setShowVideoDialog(false)} />}
      {showPrivacy && <PrivacyCentre onClose={() => setShowPrivacy(false)} />}
      {showAbout && (
        <AboutDialog
          onClose={() => setShowAbout(false)}
          onOpenLegal={(doc) => setLegalDoc(doc)}
        />
      )}
      {legalDoc && <LegalViewerDialog doc={legalDoc} onClose={() => setLegalDoc(null)} />}
      {showRecipes && <RecipesDialog onClose={() => setShowRecipes(false)} />}
      {showBatch && <BatchDialog onClose={() => setShowBatch(false)} />}
      {showFirstRun && !bootSplash && <FirstRunDialog onClose={() => setShowFirstRun(false)} />}
      {unsavedDialog}
      {dragActive && !importJob && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-[2px] pointer-events-none">
          <div className="brand-dropzone rounded-xl px-12 py-9 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-secondary text-foreground flex items-center justify-center ring-1 ring-border">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
                <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-foreground">Drop to open as a new image</p>
          </div>
        </div>
      )}
    </div>
  )
}
