// Records the PocketMind demo flow at 1920x1080 with an injected cursor
// and click ripple. Logs scene boundary times to scenes.json.
import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome'
const ROOT = '/home/hatch/workspace/hackathons/firebase-hybrid-ai/pocketmind'
const DIST = join(ROOT, 'dist')
const OUT = join(ROOT, 'video/work/clips')
await mkdir(OUT, { recursive: true })

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm',
}
const server = createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  if (path === '/') path = '/index.html'
  try {
    const body = await readFile(join(DIST, normalize(path)))
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' })
    res.end(body)
  } catch { res.writeHead(404); res.end('not found') }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}/`
console.log('serving', base)

const CURSOR_JS = `
(() => {
  const attach = () => {
    if (!document.body) { setTimeout(attach, 30); return }
    if (document.getElementById('__cursor')) return
    const c = document.createElement('div')
    c.id = '__cursor'
    c.innerHTML = '<svg width="36" height="36" viewBox="0 0 24 24"><path d="M4 2 L20 12 L12.5 13.5 L15.5 21 L12.8 22.2 L9.8 14.8 L4 19 Z" fill="#101828" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/></svg>'
    c.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px);filter:drop-shadow(0 2px 5px rgba(0,0,0,.4))'
    document.body.appendChild(c)
    document.addEventListener('mousemove', (e) => { c.style.transform = 'translate(' + (e.clientX - 3) + 'px,' + (e.clientY - 3) + 'px)' }, true)
    document.addEventListener('mousedown', (e) => {
      const r = document.createElement('div')
      r.style.cssText = 'position:fixed;left:' + (e.clientX - 26) + 'px;top:' + (e.clientY - 26) + 'px;width:52px;height:52px;border:4px solid #22d3ee;border-radius:50%;z-index:2147483646;pointer-events:none;opacity:.95;transition:transform .45s ease-out,opacity .45s ease-out;transform:scale(.35)'
      document.body.appendChild(r)
      requestAnimationFrame(() => { r.style.transform = 'scale(1.2)'; r.style.opacity = '0' })
      setTimeout(() => r.remove(), 520)
    }, true)
  }
  attach()
})()
`

const browser = await chromium.launch({ executablePath: CHROME })
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } },
})
await context.addInitScript(CURSOR_JS)
const page = await context.newPage()
page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()) })
const t0 = Date.now()
const marks = {}
const mark = (name) => { marks[name] = (Date.now() - t0) / 1000; console.log('mark', name, marks[name].toFixed(2)) }
const wait = (ms) => page.waitForTimeout(ms)

async function moveTo(locator, steps = 26) {
  const box = await locator.boundingBox()
  if (!box) throw new Error('no bounding box for locator')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps })
  await wait(280)
  return box
}
async function clickAt(locator, steps = 24) {
  await locator.scrollIntoViewIfNeeded().catch(() => {})
  await wait(250)
  const box = await locator.boundingBox()
  if (!box) throw new Error('no bounding box')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps })
  await wait(200)
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
}
async function smoothScrollTo(y) {
  await page.evaluate((yy) => window.scrollTo({ top: yy, behavior: 'smooth' }), y)
  await wait(900)
}

await page.goto(base, { waitUntil: 'networkidle' })
await page.waitForSelector('text=Photosynthesis (Biology)', { timeout: 30000 })
await wait(1200)
await page.mouse.move(960, 500, { steps: 10 })

// Scene 1 tail: header + hybrid status panel
mark('home_start')
await wait(2600)
await moveTo(page.locator('text=Hybrid status').first(), 24).catch(() => {})
await wait(2400)
await page.mouse.move(1100, 420, { steps: 24 })
await wait(2200)
mark('home_end')

// Scene 2: notes library
mark('library_start')
await smoothScrollTo(0)
await moveTo(page.locator('text=Photosynthesis (Biology)').first(), 24).catch(() => {})
await wait(2600)
await page.mouse.move(500, 700, { steps: 24 })
await wait(2400)
mark('library_end')

// Scene 3: ask a question
mark('ask_start')
await clickAt(page.locator('input[placeholder="Ask about this note"]'))
await page.keyboard.type('What traps light?', { delay: 55 })
await wait(700)
await clickAt(page.locator('form button:has-text("Ask")'))
await page.waitForSelector('text=From your note', { timeout: 10000 })
await wait(2600)
await moveTo(page.locator('text=Chlorophyll').first(), 22).catch(() => {})
await wait(2800)
mark('ask_end')

// Scene 4: summary + flashcards
mark('study_start')
await clickAt(page.locator('button:has-text("Summary")').first())
await wait(900)
await clickAt(page.locator('button:has-text("Summarize note")').first())
await wait(3000)
await clickAt(page.locator('button:has-text("Flashcards")').first())
await wait(900)
await clickAt(page.locator('button:has-text("Make flashcards")').first())
await wait(2400)
await clickAt(page.locator('.flashcard').first())
await wait(2800)
mark('study_end')

// Scene 5: routing mode picker
mark('routing_start')
await smoothScrollTo(0)
await moveTo(page.locator('#mode'), 24).catch(() => {})
await wait(1400)
await page.selectOption('#mode', 'only_in_cloud')
await wait(2600)
await page.selectOption('#mode', 'prefer_on_device')
await wait(2400)
mark('routing_end')

// Scene 6: closing shot, library + answer
mark('closing_start')
await smoothScrollTo(0)
await page.mouse.move(960, 540, { steps: 20 })
await wait(3200)
mark('closing_end')

const video = page.video()
await context.close()
await browser.close()
server.close()
const rawPath = await video.path()
await writeFile(join(OUT, 'scenes.json'), JSON.stringify({ raw: rawPath, marks }, null, 2))
console.log('RAW VIDEO:', rawPath)
console.log(JSON.stringify(marks, null, 2))
