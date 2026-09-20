'use client'

export function LegalText({ text, testId }: { text: string; testId?: string }) {
  return (
    <pre
      data-testid={testId}
      className="whitespace-pre-wrap break-words font-sans text-[13px] leading-[1.65] text-foreground/90"
    >
      {text}
    </pre>
  )
}
