'use client'
import { useCallback, useEffect, useRef } from 'react'
import { getBridge, isElectron } from '@/lib/platform/bridge'
import { useEditorStore } from '@/features/editor/store/editor-store'
import { deserializeProject, projectFitsAutosave, serializeProject, stringifyProject, suggestedProjectName } from '@/features/editor/project/serialize'
import { addRecent } from '@/lib/platform/recents'

export function useProjectPersistence() {
  const doc = useEditorStore((s) => s.doc)
  const brandKit = useEditorStore((s) => s.brandKit)
  const dirty = useEditorStore((s) => s.dirty)
  const loadProjectDocument = useEditorStore((s) => s.loadProjectDocument)
  const markSaved = useEditorStore((s) => s.markSaved)
  const notify = useEditorStore((s) => s.notify)
  const timer = useRef<number | null>(null)

  const ingestProjectJson = useCallback(async (json: string, path: string | null, name?: string) => {
    try {
      const result = await deserializeProject(json, path)
      loadProjectDocument(result.doc, result.brandKit, { dirty: false, readOnly: result.readOnly })
      if (path) addRecent(name || result.doc.fileName, path)
      if (result.warning) notify('info', result.warning)
      else notify('success', `Opened ${name || result.doc.fileName}`)
      void getBridge().clearAutosave()
    } catch (err) {
      notify('error', `Could not open project: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [loadProjectDocument, notify])

  const saveProject = useCallback(async (saveAs = false) => {
    const state = useEditorStore.getState()
    if (!state.doc) return false
    if (state.readOnly && !saveAs) {
      notify('info', 'This project is read-only. Use Save As to write a new copy.')
      return false
    }
    try {
      const project = serializeProject(state.doc, { brandKit: state.brandKit })
      const json = stringifyProject(project)
      const suggested = suggestedProjectName(state.doc.fileName)
      const existing = saveAs ? null : state.doc.projectPath
      const result = await getBridge().saveProject(json, suggested, existing)
      if (!result.ok || result.canceled) return false
      markSaved(result.path)
      if (result.path) addRecent(state.doc.fileName, result.path)
      notify('success', 'Project saved')
      void getBridge().clearAutosave()
      return true
    } catch (err) {
      notify('error', `Save failed: ${err instanceof Error ? err.message : String(err)}`)
      return false
    }
  }, [markSaved, notify])

  const openProject = useCallback(async () => {
    const file = await getBridge().openProject()
    if (file) await ingestProjectJson(file.json, file.path, file.name)
  }, [ingestProjectJson])

  const openRecent = useCallback(async (path: string) => {
    const opener = getBridge().openProjectPath
    if (!opener) {
      notify('info', 'Re-open from Recents works in the desktop app.')
      return
    }
    const file = await opener(path)
    if (file) await ingestProjectJson(file.json, file.path, file.name)
  }, [ingestProjectJson, notify])

  useEffect(() => {
    if (!doc || !dirty) return
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      try {
        const project = serializeProject(doc, { brandKit })
        const json = stringifyProject(project)
        if (!projectFitsAutosave(json)) return
        void getBridge().writeAutosave(json)
      } catch { /* ignore */ }
    }, 2000)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [doc, brandKit, dirty])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const json = await getBridge().readAutosave()
      if (!json || cancelled || useEditorStore.getState().doc) return
      if (typeof window !== 'undefined' && sessionStorage.getItem('vista-autosave-prompted') === '1') return
      sessionStorage.setItem('vista-autosave-prompted', '1')
      const restore = window.confirm('Restore the last autosave?')
      if (restore) await ingestProjectJson(json, null, 'Autosave.lumen')
    })()
    return () => { cancelled = true }
  }, [ingestProjectJson])

  return { saveProject, openProject, openRecent, ingestProjectJson, isElectron: isElectron() }
}
