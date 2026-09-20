'use client'

import { useCallback, useRef, useState } from 'react'
import { ConfirmDialog } from '@/components/editor/dialogs/ConfirmDialog'
import { useEditorStore } from '@/features/editor/store/editor-store'
import { needsUnsavedPrompt, resolveUnsavedChoice, type UnsavedChoice } from '@/features/editor/project/unsaved'

type Waiter = (choice: UnsavedChoice) => void

export function useUnsavedChanges(saveProject: (saveAs?: boolean) => Promise<boolean>) {
  const [open, setOpen] = useState(false)
  const pending = useRef<Waiter[]>([])

  const confirmUnsavedChanges = useCallback((): Promise<UnsavedChoice> => {
    const { dirty, doc } = useEditorStore.getState()
    if (!needsUnsavedPrompt(dirty, !!doc)) return Promise.resolve('discard')
    return new Promise((resolve) => {
      pending.current.push(resolve)
      setOpen(true)
    })
  }, [])

  const settle = useCallback((choice: UnsavedChoice) => {
    setOpen(false)
    const waiters = pending.current
    pending.current = []
    for (const resolve of waiters) resolve(choice)
  }, [])

  const runGuarded = useCallback(
    async (action: () => void | Promise<void>): Promise<boolean> => {
      const choice = await confirmUnsavedChanges()
      const proceed = await resolveUnsavedChoice(choice, () => saveProject(false))
      if (!proceed) return false
      await action()
      return true
    },
    [confirmUnsavedChanges, saveProject],
  )

  const unsavedDialog = open ? (
    <ConfirmDialog
      title="Unsaved project"
      body="Save your .lumen project? Unsaved edits will be lost if you continue."
      confirmLabel="Save"
      extraLabel="Don't Save"
      cancelLabel="Cancel"
      onConfirm={() => settle('save')}
      onExtra={() => settle('discard')}
      onCancel={() => settle('cancel')}
    />
  ) : null

  return { confirmUnsavedChanges, runGuarded, unsavedDialog }
}
