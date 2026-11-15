// Regenerate the README screenshots from the sample data.
// Start the dev server first (npm run dev), then: npm run screenshots
import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'

const base = process.argv[2] ?? 'http://localhost:5173/'
const out = 'docs/screenshots'
mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome' })

async function open({ width, height, dark = false, scale = 1 }) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: dark ? 'dark' : 'light', deviceScaleFactor: scale })
  const page = await ctx.newPage()
  // The sample data is "as of Nov 11, 2026" (PRD worked example 2).
  await page.clock.setFixedTime(new Date('2026-11-11T09:00:00'))
  await page.goto(base)
  await page.getByRole('button', { name: 'Load sample data' }).click()
  await page.getByTestId('hero').waitFor()
  return { ctx, page }
}

async function shot(page, route, file, before) {
  await page.goto(base + '#' + route)
  await page.reload() // the selected month is in-memory UI state; start each shot on the current month
  if (before) await before(page)
  await page.waitForTimeout(900) // let number animations settle
  await page.screenshot({ path: `${out}/${file}.png` })
  console.log(`${out}/${file}.png`)
}

const prevMonth = (p) => p.getByRole('button', { name: 'Previous month' }).click()

for (const dark of [false, true]) {
  const { ctx, page } = await open({ width: 1280, height: 800, dark })
  const suffix = dark ? '-dark' : ''
  await shot(page, '/', `dashboard${suffix}`)
  if (!dark) {
    await shot(page, '/payments', 'payments', prevMonth)
    await shot(page, '/what-if', 'what-if')
    await shot(page, '/history', 'history')
  }
  await ctx.close()
}

{
  const { ctx, page } = await open({ width: 390, height: 844, scale: 2 })
  await shot(page, '/', 'mobile-dashboard')
  await shot(page, '/time', 'mobile-time', prevMonth)
  await shot(page, '/payments', 'mobile-payments', prevMonth)
  await ctx.close()
}

await browser.close()
