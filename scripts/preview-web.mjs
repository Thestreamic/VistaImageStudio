/**
 * Serves the static web export at http://127.0.0.1:4173 so you can check
 * the GitHub Pages artifact in a browser before deploying anything.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { exec, execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.resolve(root, 'out-web')
const preferredPort = Number(process.env.PORT || 4173)
const basePath = (process.env.BASE_PATH || '').replace(/\/$/, '')
const host = '127.0.0.1'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

function safeJoin(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0])
  const stripped = basePath && decoded.startsWith(basePath)
    ? decoded.slice(basePath.length) || '/'
    : decoded
  const rel = stripped.replace(/^\/+/, '')
  const abs = path.resolve(dir, rel)
  if (!abs.startsWith(dir)) return null
  return abs
}

function pickFile(abs) {
  if (!abs) return null
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs
  if (fs.existsSync(abs + '.html') && fs.statSync(abs + '.html').isFile()) return abs + '.html'
  const asIndex = path.join(abs, 'index.html')
  if (fs.existsSync(asIndex) && fs.statSync(asIndex).isFile()) return asIndex
  return null
}

function pidListening(port) {
  try {
    const out = execSync('netstat -ano -p tcp', { encoding: 'utf8' })
    const re = new RegExp(`127\\.0\\.0\\.1:${port}\\s+\\S+\\s+LISTENING\\s+(\\d+)`, 'i')
    const match = out.match(re)
    return match ? Number(match[1]) : null
  } catch {
    return null
  }
}

function isNodePid(pid) {
  try {
    const out = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, { encoding: 'utf8' })
    return /node\.exe/i.test(out)
  } catch {
    return false
  }
}

function stopPid(pid) {
  try {
    execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' })
  } catch { /* already gone */ }
}

function sleep(ms) {
  const lock = new Int32Array(new SharedArrayBuffer(4))
  Atomics.wait(lock, 0, 0, ms)
}

function freePortOrThrow(port) {
  const pid = pidListening(port)
  if (!pid || pid === process.pid) return
  if (!isNodePid(pid)) {
    throw new Error(
      `Port ${port} is in use by another program (pid ${pid}), not this preview. Close that program or set PORT to a free port.`,
    )
  }
  console.log(`Port ${port} was still held by a previous preview (pid ${pid}). Replacing it with this build.`)
  stopPid(pid)
  sleep(400)
}

function openBrowser(url) {
  if (process.platform === 'win32') exec(`cmd /c start "" "${url}"`)
}

if (!fs.existsSync(path.join(dir, 'index.html'))) {
  console.error('No web build at out-web/. Run:  npm run build:web')
  process.exit(1)
}

const server = http.createServer((req, res) => {
  const urlPath = req.url || '/'
  if (basePath && (urlPath === '/' || urlPath === '')) {
    res.writeHead(302, { Location: basePath + '/' })
    res.end()
    return
  }

  let file = pickFile(safeJoin(urlPath))
  if (!file && urlPath.endsWith('/')) file = pickFile(safeJoin(urlPath + 'index.html'))
  if (!file) {
    const fallback = path.join(dir, '404.html')
    file = fs.existsSync(fallback) ? fallback : null
    if (!file) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Not found')
      return
    }
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
    fs.createReadStream(file).pipe(res)
    return
  }

  const ext = path.extname(file).toLowerCase()
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
  fs.createReadStream(file).pipe(res)
})

function listen(port) {
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      server.off('listening', onListening)
      reject(err)
    }
    const onListening = () => {
      server.off('error', onError)
      resolve()
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port, host)
  })
}

try {
  try {
    await listen(preferredPort)
  } catch (err) {
    if (err && err.code === 'EADDRINUSE') {
      freePortOrThrow(preferredPort)
      await listen(preferredPort)
    } else {
      throw err
    }
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
}

const url = `http://${host}:${preferredPort}${basePath || ''}/`
console.log(`Web preview (GitHub Pages artifact)  ${url}`)
console.log('Close this window when you are done. Nothing is uploaded.')
openBrowser(url)
