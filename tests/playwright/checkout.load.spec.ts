import { test, expect } from '@playwright/test'

const PRODUCT_IDS = ['npe', 'typeerror', 'segfault', 'syntax', 'oom'] as const
const PROVIDERS = ['ZapPay', 'GlitchPay', 'LagPay'] as const

const TOTAL_RUNS = Number(process.env.TOTAL_USERS || 500)
const MIN_ITEMS = 1
const MAX_ITEMS = 5

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(arr: readonly T[]): T {
  return arr[randomInt(0, arr.length - 1)]
}

async function addRandomItems(page: any, count: number) {
  const chosen = new Set<string>()
  while (chosen.size < count) {
    chosen.add(pick(PRODUCT_IDS))
  }
  // Ensure product section is visible
  await page.locator('text=Featured Errors').scrollIntoViewIfNeeded().catch(() => {})
  for (const id of chosen) {
    const locator = page.locator(`[data-testid="add-${id}"]`).first()
    await locator.scrollIntoViewIfNeeded().catch(() => {})
    await locator.click()
    await page.waitForTimeout(randomInt(50, 200))
  }
  return Array.from(chosen)
}

async function runFlow(page: any) {
  await page.goto('/')
  await page.waitForSelector('#cart-button', { timeout: 20000 })
  await page.waitForSelector('[data-testid="add-npe"]', { timeout: 20000 })
  const itemCount = randomInt(MIN_ITEMS, MAX_ITEMS)
  const items = await addRandomItems(page, itemCount)

  await page.click('#cart-button')
  const provider = pick(PROVIDERS)
  await page.click(`[data-testid="payment-${provider}"]`)

  const start = Date.now()
  let ok = false
  try {
    const [resp] = await Promise.all([
      page.waitForResponse((r: any) => r.url().includes('/api/checkout') && r.request().method() === 'POST', { timeout: 20_000 }).catch(() => undefined),
      page.click('#checkout-button'),
    ])
    ok = !!resp && resp.ok()
  } catch {
    ok = false
  }
  const duration = Date.now() - start
  return { ok, provider, items, duration }
}

test.describe.configure({ mode: 'parallel' })

for (let i = 1; i <= TOTAL_RUNS; i++) {
  test(`Checkout flow ${i}/${TOTAL_RUNS}`, async ({ page }) => {
    const result = await runFlow(page)
    if (result.ok) {
      console.log(`✅ ${i}: ${result.provider} | ${result.items.length} items | ${result.duration}ms`)
    } else {
      console.log(`⚠️ ${i}: ${result.provider} | ${result.items.length} items | failed (${result.duration}ms)`) 
    }
    // We do not fail the test on purpose; failures are expected in this demo.
    expect(true).toBeTruthy()
  })
}


