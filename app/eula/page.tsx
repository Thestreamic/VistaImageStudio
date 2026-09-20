import type { Metadata } from 'next'
import { LegalPageShell } from '@/components/legal/LegalPageShell'
import { LegalText } from '@/components/legal/LegalText'
import { EULA_LAST_UPDATED, EULA_TEXT, EULA_TITLE } from '@/lib/legal/eula'

export const metadata: Metadata = {
  title: 'End-User License Agreement — Vista Image Studio',
  description: 'End-User License Agreement for Vista Image Studio, published by The Streamic.',
}

export default function EulaPage() {
  return (
    <LegalPageShell title={EULA_TITLE} updated={EULA_LAST_UPDATED}>
      <LegalText text={EULA_TEXT} testId="eula-page-text" />
    </LegalPageShell>
  )
}
