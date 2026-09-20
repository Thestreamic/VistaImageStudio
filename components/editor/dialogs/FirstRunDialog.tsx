'use client'

const KEY = 'vista-onboarded'

export function isOnboarded() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return true
  }
}

export function markOnboarded() {
  try {
    localStorage.setItem(KEY, '1')
  } catch { /* ignore */ }
}

export function FirstRunDialog({ onClose }: { onClose: () => void }) {
  const finish = () => {
    markOnboarded()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/60">
      <div className="w-[420px] rounded-xl bg-popover border border-border shadow-2xl p-5" role="dialog" aria-labelledby="first-run-title">
        <h2 id="first-run-title" className="text-base font-semibold">Welcome to Vista Image Studio</h2>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          A privacy-first editor for social posts. Everything runs on this computer — no cloud, no account.
        </p>
        <ol className="mt-4 space-y-2 text-xs list-decimal list-inside text-foreground">
          <li>Open a photo or drop it into the window.</li>
          <li>Crop to 4:5 / 9:16, apply a look, add a logo or handle.</li>
          <li>Save a <span className="font-mono">.lumen</span> project, then export an Instagram pack.</li>
        </ol>
        <p className="text-[10px] text-muted-foreground mt-3">
          Command chat is a local keyword assistant, not an LLM. You can skip this anytime.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={finish} className="px-3 py-1.5 text-xs rounded-md bg-secondary">Skip</button>
          <button type="button" onClick={finish} className="px-3 py-1.5 text-xs rounded-md brand-gradient-bg text-white">Get started</button>
        </div>
      </div>
    </div>
  )
}
