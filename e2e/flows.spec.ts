import { expect, test, type Page } from '@playwright/test'

// Worked example 2 is "as of Nov 11, 2026".
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-11T09:00:00'))
  await page.goto('/')
})

const hero = (page: Page) => page.getByTestId('hero')
/** The sidebar button is hidden on mobile and the FAB on desktop: take whichever is visible. */
const addTimeButton = (page: Page) => page.getByRole('button', { name: 'Add time' }).filter({ visible: true }).first()

async function loadSample(page: Page) {
  await page.getByRole('button', { name: 'Load sample data' }).click()
  await expect(hero(page)).toContainText('$274.57')
}

async function goto(page: Page, hash: string) {
  await page.goto(`/#${hash}`)
}

test('AC1 + AC11: a tracker total derives the rate and starts the month', async ({ page }) => {
  await page.getByRole('button', { name: 'Enter tracker total' }).click()
  await page.getByLabel('Total time').fill('62:41:12')
  await page.getByLabel('Total earned').fill('274.57')
  const sheet = page.getByRole('dialog')
  await expect(sheet).toContainText('62.69')
  await expect(sheet).toContainText('$4.38/h')
  await sheet.getByRole('button', { name: 'Save tracker total' }).click()

  await expect(hero(page)).toContainText('$274.57')
  await expect(page.getByText('since Nov 1')).toBeVisible()

  // AC1 with the October numbers via the derive helper.
  await goto(page, '/rates')
  await page.getByLabel('Total time').fill('118:40:48')
  await page.getByLabel('Total earned').fill('519.82')
  await expect(page.getByText('$4.38/h').nth(1)).toBeVisible()
  await expect(page.getByText('Matches your saved rate of $4.38/h.')).toBeVisible()
})

test('AC2 + AC3: backfill skips weekends and October targets 176 h', async ({ page }) => {
  await page.getByRole('button', { name: 'Set hourly rate' }).click()
  await page.getByLabel('Hourly rate (USD)').fill('4.38')
  await page.getByRole('button', { name: 'Save rate' }).click()

  await goto(page, '/time')
  await page.getByRole('button', { name: 'Previous month' }).click()
  await page.getByRole('button', { name: 'Backfill' }).click()
  const sheet = page.getByRole('dialog')
  await sheet.getByLabel('From', { exact: true }).fill('2026-10-01')
  await sheet.getByLabel('To', { exact: true }).fill('2026-10-09')
  await expect(sheet).toContainText('56:00:00')
  await expect(sheet).toContainText('$245.28')
  await expect(sheet).toContainText('Skipping 2 days off: Oct 3, Oct 4')
  await sheet.getByRole('button', { name: 'Backfill 7 days' }).click()

  await expect(page.getByText('56:00:00 · $245.28 this month')).toBeVisible()
  await goto(page, '/')
  await expect(hero(page)).toContainText('/ 176 h')
})

test('AC4: a new rate from Nov 1 leaves October unchanged', async ({ page }) => {
  await loadSample(page)
  await goto(page, '/rates')
  await page.getByRole('button', { name: 'Change rate' }).click()
  await page.getByLabel('Hourly rate (USD)').fill('5')
  await page.getByLabel('Effective date').fill('2026-11-01')
  await page.getByRole('button', { name: 'Review change' }).click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toContainText('From Nov 1, 2026 onward')
  await expect(sheet).not.toContainText('October 2026')
  await sheet.getByRole('button', { name: 'Apply new rate' }).click()

  // November entries are valued at $5.00.
  await goto(page, '/')
  await addTimeButton(page).click()
  await page.getByRole('dialog').getByLabel('Date', { exact: true }).fill('2026-11-12')
  await expect(page.getByRole('dialog')).toContainText('$40.00 at $5.00/h')
  await page.keyboard.press('Escape')

  await goto(page, '/')
  await page.getByRole('button', { name: 'Previous month' }).click()
  await expect(hero(page)).toContainText('$765.10')
})

test('AC6: payments of $700 + $82 reconcile against October', async ({ page }) => {
  await loadSample(page)
  await goto(page, '/payments')
  await page.getByRole('button', { name: 'Previous month' }).click()
  await expect(page.getByText('Paid in full')).toBeVisible()
  await expect(page.getByText('$782.00').first()).toBeVisible()
  await expect(page.getByText('$16.90')).toBeVisible()
  await expect(page.getByText(/৳2,079 · 3\.86 h at \$4\.38\/h/)).toBeVisible()
  await expect(page.getByText(/Your payment matches \$4\.48\/h/)).toBeVisible()
})

test('AC7 + AC13: scenarios match worked example 2 and follow hours/day', async ({ page }) => {
  await loadSample(page)
  // The worked example counts Nov 11 as a remaining day.
  await page.getByRole('switch', { name: /Count today as worked/ }).click()
  await goto(page, '/what-if')
  const main = page.locator('main')
  await expect(main).toContainText('$274.57')
  await expect(main).toContainText('$309.61')
  await expect(main).toContainText('৳38,082')
  await expect(main).toContainText('$765.13')
  await expect(main).toContainText('৳94,111')
  await expect(main).toContainText('$735.84')
  await expect(main).toContainText('6.7 h ahead')

  // AC12
  await expect(main).toContainText('$87.60')
  await expect(main).toContainText('4 h ahead')

  // AC7: editing hours per day updates the projection instantly.
  await goto(page, '/')
  await page.getByRole('group', { name: 'Hours per remaining day' }).getByRole('button', { name: 'Fewer hours' }).click()
  await page.getByRole('group', { name: 'Hours per remaining day' }).getByRole('button', { name: 'Fewer hours' }).click()
  // 7 h × 14 days at $4.38 = $429.24, plus $274.57
  await expect(page.locator('main')).toContainText('$703.81')
})

test('AC14: a newer tracker reading replaces the old one', async ({ page }) => {
  await loadSample(page)
  await addTimeButton(page).click()
  await page.getByRole('tab', { name: 'Tracker total' }).click()
  const sheet = page.getByRole('dialog')
  await expect(sheet).toContainText('Replaces the reading as of Nov 11')
  await sheet.getByLabel('Total time').fill('70:41:12')
  await sheet.getByLabel('Total earned').fill('309.61')
  await sheet.getByRole('button', { name: 'Replace reading' }).click()
  await expect(hero(page)).toContainText('$309.61')
  await goto(page, '/time')
  await expect(page.locator('main').getByText(/· as of /)).toHaveCount(1)
  await expect(page.locator('main')).toContainText('70:41:12')
  await expect(page.locator('main')).not.toContainText('62:41:12')
})

test('deleting has undo, and data survives a reload (AC8)', async ({ page }) => {
  await loadSample(page)
  await addTimeButton(page).click()
  const sheet = page.getByRole('dialog')
  // Tracked time on Nov 11 is already inside the tracker total, so the app warns and won't count it twice.
  await expect(sheet).toContainText('is inside your tracker total')
  await sheet.getByRole('radio', { name: 'Backfill' }).click()
  await sheet.getByRole('button', { name: 'Add time' }).click()
  await expect(hero(page)).toContainText('$309.61') // + 8 h × $4.38

  await page.reload()
  await expect(hero(page)).toContainText('$309.61')

  await goto(page, '/time')
  await page.getByRole('button', { name: 'Delete entry' }).click()
  await page.getByRole('button', { name: 'Undo' }).click()
  await goto(page, '/')
  await expect(hero(page)).toContainText('$309.61')
})

test('AC9: no horizontal scrolling on any screen', async ({ page }) => {
  await loadSample(page)
  for (const route of ['/', '/time', '/payments', '/rates', '/what-if', '/share', '/settings', '/statement']) {
    await goto(page, route)
    await page.waitForTimeout(150)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, `overflow on ${route}`).toBeLessThanOrEqual(0)
  }
})
