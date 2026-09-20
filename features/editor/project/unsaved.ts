/**
 * Shared unsaved-project prompt result. Callers (New, Open, Close, Exit, window X)
 * must go through one path so Save / Don't Save / Cancel never diverge.
 */
export type UnsavedChoice = 'save' | 'discard' | 'cancel'

export function needsUnsavedPrompt(dirty: boolean, hasDocument: boolean): boolean {
  return Boolean(dirty && hasDocument)
}

export async function resolveUnsavedChoice(
  choice: UnsavedChoice,
  save: () => Promise<boolean>,
): Promise<boolean> {
  if (choice === 'cancel') return false
  if (choice === 'save') return save()
  return true
}
