'use client'

export function CheckerPattern() {
  return (
    <div
      className="absolute inset-0 opacity-[0.15] pointer-events-none"
      style={{
        backgroundImage:
          'linear-gradient(45deg, #808080 25%, transparent 25%), linear-gradient(-45deg, #808080 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #808080 75%), linear-gradient(-45deg, transparent 75%, #808080 75%)',
        backgroundSize: '16px 16px',
        backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
      }}
    />
  )
}
