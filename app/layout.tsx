import Script from 'next/script'
import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Mono, Source_Sans_3 } from 'next/font/google'
import './globals.css'

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-source-sans',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-plex-mono',
})

export const metadata: Metadata = {
  title: 'Vista Image Studio - Local AI Photo Editor',
  description:
    'Vista Image Studio — a social photo editor with layers, curves, crop, and AI tools such as background removal, denoise and upscaling. No account required.',
  generator: 'v0.app',
  applicationName: 'Vista Image Studio',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark light',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#efe6d8' },
    { media: '(prefers-color-scheme: dark)', color: '#2a2d33' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

const STRIP_PROJECT_PAGES_PREFIX = `(function(){try{var p=location.pathname||"/";document.querySelectorAll("link[href],script[src]").forEach(function(el){var a=el.tagName==="LINK"?"href":"src";var v=el.getAttribute(a);if(!v||v.charAt(0)!=="/")return;var i=v.indexOf("/_next/");if(i<=0)return;var pre=v.slice(0,i);if(p===pre||p.indexOf(pre+"/")===0)return;el.setAttribute(a,v.slice(i));});}catch(e){}})();`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${sourceSans.variable} ${plexMono.variable} bg-background`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: STRIP_PROJECT_PAGES_PREFIX }} />
      </head>
      {!process.env.ELECTRON_BUILD && (
  <Script src="/analytics.js" strategy="afterInteractive" />
)}
      <body>{children}</body>
    </html>
  )
}
