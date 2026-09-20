/** @type {import('next').NextConfig} */
const isElectron = !!process.env.ELECTRON_BUILD
const isWebExport = !!process.env.WEB_EXPORT
// Desktop and the custom-domain site both live at /. A leftover /RepoName
// prefix 404s every CSS file on vistaimagestudio.thestreamic.in.
const basePath = isElectron || isWebExport ? '' : (process.env.BASE_PATH || '').replace(/\/$/, '')

const nextConfig = {
  // Electron loads the built app as static files (file://). The browser /
  // GitHub Pages build is the same kind of export, just a different folder.
  output: isElectron || isWebExport ? 'export' : undefined,
  distDir: isElectron ? 'out' : isWebExport ? 'out-web' : '.next',
  // GitHub Pages serves directories, not .html files, so trailing slashes
  // keep /_next and nested routes resolving after a refresh.
  trailingSlash: isWebExport ? true : undefined,
  basePath: basePath || undefined,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Inlined into the AI worker so /models/*.onnx resolve under GitHub project Pages.
  env: {
    NEXT_PUBLIC_BASE_PATH: isElectron || isWebExport ? '' : process.env.NEXT_PUBLIC_BASE_PATH || basePath || '',
  },
  // Next.js 16 defaults to Turbopack; declaring this (even empty) opts in
  // explicitly instead of erroring on the absence of Turbopack-specific
  // config. onnxruntime-web's wasm loader guards its own `fs`/`path` use
  // for non-Node environments, so no fallback shims are needed here.
  turbopack: {},
}

export default nextConfig
