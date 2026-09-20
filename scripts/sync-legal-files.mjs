/**
 * Copy canonical legal strings from lib/legal/*.ts into public/ and docs/
 * so the static marketing pages cannot drift from the in-app module.
 *
 * Run: node scripts/sync-legal-files.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readExport(file, name) {
  const src = fs.readFileSync(path.join(root, file), 'utf8')
  const re = new RegExp(`export const ${name} = \`([\\s\\S]*?)\`\\s*(?:\\n|$)`)
  const m = src.match(re)
  if (!m) throw new Error(`Could not extract ${name} from ${file}`)
  return m[1]
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function legalHtml({ title, updated, preId, body, extraNav = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — Vista Image Studio</title>
<style>
  :root { --bg:#14161c; --bg-elev:#1b1e26; --border:#2c2f3a; --text:#e7e8ec; --text-dim:#9a9daa; --accent:#7c8cff; --accent-2:#a78bfa; }
  * { box-sizing: border-box; margin:0; padding:0; }
  body {
    background: radial-gradient(1000px 500px at 15% -10%, rgba(124,140,255,0.10), transparent 60%), var(--bg);
    color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
    line-height: 1.65; min-height: 100vh;
  }
  .wrap { max-width: 760px; margin: 0 auto; padding: 0 24px 80px; }
  nav { display: flex; align-items: center; gap: 10px; padding: 22px 0; font-weight: 600; font-size: 15px; }
  nav .dot { width: 10px; height: 10px; border-radius: 3px; background: linear-gradient(135deg, var(--accent), var(--accent-2)); }
  nav a { color: var(--text); text-decoration: none; }
  header { padding: 28px 0 8px; border-bottom: 1px solid var(--border); margin-bottom: 32px; }
  header h1 { font-size: 30px; font-weight: 700; letter-spacing: -0.01em; }
  header p { color: var(--text-dim); font-size: 13px; margin-top: 8px; }
  pre {
    background: var(--bg-elev); border: 1px solid var(--border); border-radius: 10px;
    padding: 18px; font-size: 13px; color: var(--text-dim); overflow-x: auto; white-space: pre-wrap;
    font-family: inherit; line-height: 1.65;
  }
  a.link { color: var(--accent); }
  .links { margin-top: 28px; font-size: 13px; color: var(--text-dim); }
  .back { display: inline-block; margin-top: 40px; font-size: 13px; color: var(--text-dim); text-decoration: none; border-bottom: 1px dashed var(--border); }
  .back:hover { color: var(--text); }
</style>
</head>
<body>
<div class="wrap">
  <nav><span class="dot"></span><a href="index.html">Vista Image Studio</a></nav>
  <header>
    <h1>${title}</h1>
    <p>Last updated: ${updated} · The Streamic</p>
  </header>
  <pre id="${preId}">${escapeHtml(body)}</pre>
  <p class="links">${extraNav}</p>
  <a class="back" href="index.html">← Back to home</a>
</div>
</body>
</html>
`
}

const eula = readExport('lib/legal/eula.ts', 'EULA_TEXT')
const notices = readExport('lib/legal/notices.ts', 'NOTICES_TEXT')

fs.writeFileSync(path.join(root, 'public', 'THIRD-PARTY-LICENSES.txt'), notices.endsWith('\n') ? notices : `${notices}\n`)
fs.writeFileSync(
  path.join(root, 'docs', 'eula.html'),
  legalHtml({
    title: 'End-User License Agreement',
    updated: 'September 20, 2026',
    preId: 'eula-canonical',
    body: eula,
    extraNav: '<a class="link" href="privacy.html">Privacy Policy</a> · <a class="link" href="notices.html">Third-party notices</a>',
  }),
)
fs.writeFileSync(
  path.join(root, 'docs', 'notices.html'),
  legalHtml({
    title: 'Third-party notices',
    updated: 'September 20, 2026',
    preId: 'notices-canonical',
    body: notices,
    extraNav: '<a class="link" href="eula.html">EULA</a> · <a class="link" href="privacy.html">Privacy Policy</a>',
  }),
)

console.log('[sync-legal-files] wrote public/THIRD-PARTY-LICENSES.txt, docs/eula.html, docs/notices.html')
