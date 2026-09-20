/**
 * Custom domains serve the Pages artifact at /. Project-Pages HTML still
 * asks for /RepoName/_next/... which 404s. Hardlink those folders under
 * the repo name and strip the prefix from exported HTML.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'out-web')
const ALIAS = (process.env.PAGES_ALIAS || 'VistaImageStudio').replace(/^\/+|\/+$/g, '')

function hardlinkCopy(src, dest) {
  const st = fs.statSync(src)
  if (st.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true })
    for (const name of fs.readdirSync(src)) {
      hardlinkCopy(path.join(src, name), path.join(dest, name))
    }
    return
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  try {
    if (fs.existsSync(dest)) fs.unlinkSync(dest)
    fs.linkSync(src, dest)
  } catch {
    fs.copyFileSync(src, dest)
  }
}

if (!fs.existsSync(out)) {
  console.log('[alias-github-pages] no out-web, skip')
  process.exit(0)
}

const aliasRoot = path.join(out, ALIAS)
for (const dir of ['_next', 'models', 'ort', 'music']) {
  const src = path.join(out, dir)
  if (!fs.existsSync(src)) continue
  hardlinkCopy(src, path.join(aliasRoot, dir))
  console.log(`[alias-github-pages] aliased /${ALIAS}/${dir}`)
}

const prefix = `/${ALIAS}`
function rewriteHtml(file) {
  const raw = fs.readFileSync(file, 'utf8')
  const next = raw.split(`${prefix}/`).join('/').split(`"${prefix}"`).join('"/"')
  if (next !== raw) {
    fs.writeFileSync(file, next)
    console.log(`[alias-github-pages] rewrote ${path.relative(out, file)}`)
  }
}

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      if (ent.name === ALIAS || ent.name === '_next') continue
      walk(p)
    } else if (ent.name.endsWith('.html')) {
      rewriteHtml(p)
    }
  }
}
walk(out)
