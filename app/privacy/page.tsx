import type { Metadata } from 'next'
import { LegalPageShell } from '@/components/legal/LegalPageShell'
import { PRIVACY_LAST_UPDATED, PRIVACY_SECTIONS, PRIVACY_SHORT, PRIVACY_TITLE } from '@/lib/legal/privacy'

export const metadata: Metadata = {
  title: 'Privacy Policy — Vista Image Studio',
  description: 'Privacy Policy for Vista Image Studio. Photos stay on your device. No account, no telemetry by default.',
}

export default function PrivacyPage() {
  return (
    <LegalPageShell title={PRIVACY_TITLE} updated={PRIVACY_LAST_UPDATED}>
      <div className="rounded-xl border border-border bg-card px-4 py-3 text-[13px] leading-relaxed mb-8">
        <strong className="text-foreground">Short version:</strong>{' '}
        <span className="text-muted-foreground">{PRIVACY_SHORT}</span>
      </div>
      <div className="space-y-8">
        {PRIVACY_SECTIONS.map((section) => (
          <section key={section.heading}>
            <h2 className="text-base font-semibold mb-2">{section.heading}</h2>
            {section.paragraphs.map((p) => (
              <p key={p.slice(0, 48)} className="text-[14px] leading-relaxed text-muted-foreground mb-2">
                {p}
              </p>
            ))}
            {section.bullets && (
              <ul className="list-disc pl-5 text-[14px] text-muted-foreground space-y-1">
                {section.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </LegalPageShell>
  )
}
