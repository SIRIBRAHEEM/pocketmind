// End-to-end checks for PocketMind. Serves dist/ locally, drives every
// screen with Playwright, fails on any console error, and saves the 6
// documentation screenshots into docs/.
// Run after `npm run build`:  node scripts/e2e.mjs
// Note: with no Firebase config filled in, the app runs in demo mode, so
// these shots show demo-mode answers (labelled as such in the UI).
import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome'
const ROOT = new URL('..', import.meta.url).pathname
const DIST = join(ROOT, 'dist')
const DOCS = join(ROOT, 'docs')
await mkdir(DOCS, { recursive: true })

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

const server = createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  if (path === '/') path = '/index.html'
  try {
    const body = await readFile(join(DIST, normalize(path)))
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404)
    res.end('not found')
  }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}/`

let passed = 0
let failed = 0
function check(name, ok) {
  if (ok) passed += 1
  else failed += 1
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
}

const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } })
const consoleErrors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text())
})
page.on('pageerror', (err) => consoleErrors.push(String(err)))

try {
  await page.goto(base, { waitUntil: 'networkidle' })
  check('app title shows', (await page.locator('h1').innerText()).includes('PocketMind'))
  check('sample notes loaded', (await page.locator('text=Photosynthesis (Biology)').count()) >= 1)
  check('demo mode badge shows without config', (await page.locator('text=Demo mode').count()) >= 1)
  check('hybrid status panel shows', (await page.locator('text=Hybrid status').count()) >= 1)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: join(DOCS, '1-library.png') })

  console.log('Ask flow')
  await page.fill('input[placeholder="Ask about this note"]', 'What traps light?')
  await page.click('form button:has-text("Ask")')
  await page.waitForSelector('text=From your note', { timeout: 8000 })
  await page.waitForTimeout(400)
  check('answer appears', (await page.locator('text=Chlorophyll').count()) >= 1)
  check('answer carries a source badge', (await page.locator('text=Demo mode').count()) >= 2)
  await page.screenshot({ path: join(DOCS, '2-ask.png') })

  console.log('Summary flow')
  await page.click('button:has-text("Summary")')
  await page.click('button:has-text("Summarize note")')
  await page.waitForTimeout(600)
  check('summary appears', (await page.locator('text=Demo summary').count()) >= 1)
  await page.screenshot({ path: join(DOCS, '3-summary.png') })

  console.log('Flashcards flow')
  await page.click('button:has-text("Flashcards")')
  await page.click('button:has-text("Make flashcards")')
  await page.waitForTimeout(600)
  const cardCount = await page.locator('.flashcard').count()
  check(`flashcards generated (saw ${cardCount})`, cardCount >= 2)
  if (cardCount > 0) await page.locator('.flashcard').first().click()
  await page.waitForTimeout(600)
  await page.screenshot({ path: join(DOCS, '4-flashcards.png') })

  console.log('Routing mode + note editing')
  await page.selectOption('#mode', 'only_on_device')
  check('mode switched', (await page.inputValue('#mode')) === 'only_on_device')
  await page.fill('textarea', 'Updated note body for the screenshot check. The mitochondria is the powerhouse of the cell.')
  await page.waitForTimeout(300)
  await page.screenshot({ path: join(DOCS, '5-hybrid-panel.png') })

  console.log('Persistence across reload')
  await page.reload({ waitUntil: 'networkidle' })
  check('edited note survives reload', (await page.inputValue('textarea')).includes('mitochondria'))

  console.log('Mobile view')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(400)
  await page.screenshot({ path: join(DOCS, '6-mobile.png') })
  check('mobile header visible', await page.locator('h1').isVisible())

  console.log('Console errors')
  check(`zero console errors (saw ${consoleErrors.length})`, consoleErrors.length === 0)
  if (consoleErrors.length > 0) console.log(consoleErrors)
} finally {
  await browser.close()
  server.close()
}

console.log(`\nE2E result: ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
