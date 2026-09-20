import Link from 'next/link'
import { ThemeHydrate } from './ThemeHydrate'

export function LegalPageShell({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <ThemeHydrate />
      <div className="max-w-3xl mx-auto px-6 pb-20">
        <nav className="flex items-center gap-2.5 py-6 text-[15px] font-semibold">
          <span className="w-2.5 h-2.5 rounded-[3px] brand-gradient-bg" aria-hidden />
          <Link href="/" className="hover:opacity-80">
            Vista Image Studio
          </Link>
        </nav>
        <header className="pb-6 mb-8 border-b border-border">
          <h1 className="text-[1.85rem] font-semibold tracking-[-0.02em]">{title}</h1>
          <p className="mt-2 text-[13px] text-muted-foreground">Last updated: {updated}</p>
        </header>
        {children}
        <nav className="mt-12 flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
          <Link className="text-primary hover:underline" href="/eula">
            EULA
          </Link>
          <Link className="text-primary hover:underline" href="/privacy">
            Privacy Policy
          </Link>
          <Link className="text-primary hover:underline" href="/notices">
            Third-party notices
          </Link>
          <Link className="text-muted-foreground hover:text-foreground" href="/">
            Editor
          </Link>
        </nav>
      </div>
    </div>
  )
}
