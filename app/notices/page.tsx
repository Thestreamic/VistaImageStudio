import type { Metadata } from 'next'
import { LegalPageShell } from '@/components/legal/LegalPageShell'
import { LegalText } from '@/components/legal/LegalText'
import { NOTICES_LAST_UPDATED, NOTICES_TEXT, NOTICES_TITLE } from '@/lib/legal/notices'

export const metadata: Metadata = {
  title: 'Third-party notices — Vista Image Studio',
  description: 'Third-party software and model licenses bundled with Vista Image Studio.',
}

export default function NoticesPage() {
  return (
    <LegalPageShell title={NOTICES_TITLE} updated={NOTICES_LAST_UPDATED}>
      <LegalText text={NOTICES_TEXT} testId="notices-page-text" />
    </LegalPageShell>
  )
}
