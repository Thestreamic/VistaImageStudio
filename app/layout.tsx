import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Vista Image Studio - Local AI Photo Editor',
  description:
    'A privacy-first photo editor. Layers, curves, crop, and AI tools such as background removal, denoise and upscaling run entirely on your device. No cloud, no telemetry.',
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
  colorScheme: 'dark',
  themeColor: '#2a2d33',
  width: 'device-width',
  initialScale: 1,
  userScalable: false,
}

const STRIP_PROJECT_PAGES_PREFIX = `(function(){try{var p=location.pathname||"/";document.querySelectorAll("link[href],script[src]").forEach(function(el){var a=el.tagName==="LINK"?"href":"src";var v=el.getAttribute(a);if(!v||v.charAt(0)!=="/")return;var i=v.indexOf("/_next/");if(i<=0)return;var pre=v.slice(0,i);if(p===pre||p.indexOf(pre+"/")===0)return;el.setAttribute(a,v.slice(i));});}catch(e){}})();`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background">
      <head>
        <script dangerouslySetInnerHTML={{ __html: STRIP_PROJECT_PAGES_PREFIX }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
