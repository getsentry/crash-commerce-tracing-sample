/*
  Lightweight load test using Playwright's programmatic API.
  - Spawns BROWSERS browsers, each with PAGES_PER_BROWSER concurrent pages
  - Each page acts as a virtual user:
    * navigates to BASE_URL
    * randomly adds 1-5 products
    * opens cart and attempts checkout
    * randomly selects a payment method
    * handles expected success/failure and exits
*/

const { chromium } = require('playwright')

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'
const TOTAL_USERS = Number(process.env.TOTAL_USERS || 500)
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 5)
const INTER_BATCH_DELAY_MS = Number(process.env.INTER_BATCH_DELAY_MS || 250)
const HEADLESS = String(process.env.HEADLESS || 'false').toLowerCase() === 'true'
const DEBUG_FLOW = String(process.env.DEBUG_FLOW || 'false').toLowerCase() === 'true'

const PRODUCT_IDS = ['npe', 'typeerror', 'segfault', 'syntax', 'oom']
const PAYMENT_PROVIDERS = ['ZapPay', 'GlitchPay', 'LagPay']

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function runUserFlow(page) {
  const addCount = randomInt(1, 5)
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })

  // Ensure product buttons are visible
  await page.locator('text=Featured Errors').scrollIntoViewIfNeeded().catch(() => {})

  // Choose unique products to add
  const chosen = new Set()
  while (chosen.size < addCount) {
    const id = PRODUCT_IDS[randomInt(0, PRODUCT_IDS.length - 1)]
    chosen.add(id)
  }
  for (const id of chosen) {
    const locator = page.locator(`[data-testid="add-${id}"]`).first()
    await locator.scrollIntoViewIfNeeded().catch(() => {})
    await locator.click({ timeout: 15_000 })
    await page.waitForTimeout(randomInt(50, 200))
  }

  // Open cart
  await page.click('#cart-button', { timeout: 10_000 })

  // Choose random payment provider
  const provider = PAYMENT_PROVIDERS[randomInt(0, PAYMENT_PROVIDERS.length - 1)]
  await page.click(`[data-testid="payment-${provider}"]`, { timeout: 10_000 })

  // Attempt checkout and wait for backend response
  const start = Date.now()
  let status = 'unknown'
  try {
    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/checkout') && r.request().method() === 'POST',
        { timeout: 20_000 }
      ).catch(() => undefined),
      page.click('#checkout-button', { timeout: 10_000 })
    ])
    if (resp) {
      status = `${resp.status()} ${resp.ok() ? 'ok' : 'error'}`
    }
  } catch (e) {
    status = 'exception'
  } finally {
    const duration = Date.now() - start
    if (DEBUG_FLOW) {
      console.log(`Flow result: provider=${provider} status=${status} duration=${duration}ms`)
    }
    return { provider, duration, status }
  }
}

async function main() {
  console.log(
    `Simulating activity: ${TOTAL_USERS} users in batches of ${BATCH_SIZE} → ${BASE_URL} (headless=${HEADLESS})`
  )
  let completed = 0
  let errors = 0

  while (completed + errors < TOTAL_USERS) {
    const remaining = TOTAL_USERS - (completed + errors)
    const batchCount = Math.min(BATCH_SIZE, remaining)

    const jobs = Array.from({ length: batchCount }).map(async () => {
      const browser = await chromium.launch({ headless: HEADLESS })
      const context = await browser.newContext()
      const page = await context.newPage()
      try {
        const result = await runUserFlow(page)
        completed += 1
        if (completed % 25 === 0) {
          console.log(
            `Progress: ${completed}/${TOTAL_USERS} (provider=${result.provider}, duration=${result.duration}ms, status=${result.status})`
          )
        }
      } catch (e) {
        errors += 1
      } finally {
        await page.close().catch(() => {})
        await context.close().catch(() => {})
        await browser.close().catch(() => {})
      }
    })

    await Promise.all(jobs)

    if (completed + errors < TOTAL_USERS && INTER_BATCH_DELAY_MS > 0) {
      await new Promise((r) => setTimeout(r, INTER_BATCH_DELAY_MS))
    }
  }

  console.log(`Done. Completed: ${completed}, Errors: ${errors}, Total: ${completed + errors}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})


