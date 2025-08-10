import 'dotenv/config'
import express, { Request, Response } from 'express'
import * as Sentry from '@sentry/node'

// Initialize Sentry for Node
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
})

const app = express()
app.use(express.json())

// In-memory product catalog
const PRODUCTS = [
  { id: 'npe', priceMinor: 1299 },
  { id: 'typeerror', priceMinor: 999 },
  { id: 'segfault', priceMinor: 1999 },
  { id: 'syntax', priceMinor: 599 },
  { id: 'oom', priceMinor: 2499 },
]

// In-memory orders store
const ORDERS: { id: string; totalMinor: number; items: { productId: string; quantity: number }[] }[] = []

function randomId(prefix: string = 'ord'): string {
  const rand = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${rand}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type PaymentProvider = 'ZapPay' | 'GlitchPay' | 'LagPay'

const PAYMENT_PROVIDERS: PaymentProvider[] = ['ZapPay', 'GlitchPay', 'LagPay']

function pickPaymentProvider(): PaymentProvider {
  const idx = Math.floor(Math.random() * PAYMENT_PROVIDERS.length)
  return PAYMENT_PROVIDERS[idx]
}

type ProviderConfig = {
  minMs: number
  maxMs: number
  failureRate: number
}

function getDefaultConfig(provider: PaymentProvider): ProviderConfig {
  // Sensible defaults for demo purposes; can be overridden via env
  switch (provider) {
    case 'ZapPay':
      return { minMs: 50, maxMs: 150, failureRate: 0.05 }
    case 'GlitchPay':
      return { minMs: 200, maxMs: 1200, failureRate: 0.3 }
    case 'LagPay':
      return { minMs: 1200, maxMs: 3000, failureRate: 0.1 }
  }
}

function getProviderConfig(provider: PaymentProvider): ProviderConfig {
  const keyBase = provider.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const defaults = getDefaultConfig(provider)
  const min = Number(process.env[`PAYMENT_${keyBase}_MIN_MS` as keyof NodeJS.ProcessEnv] ?? defaults.minMs)
  const max = Number(process.env[`PAYMENT_${keyBase}_MAX_MS` as keyof NodeJS.ProcessEnv] ?? defaults.maxMs)
  const failureRate = Number(
    process.env[`PAYMENT_${keyBase}_FAILURE_RATE` as keyof NodeJS.ProcessEnv] ?? defaults.failureRate
  )
  return { minMs: min, maxMs: max, failureRate }
}

function getAllProviderConfigs(): Record<PaymentProvider, ProviderConfig> {
  return {
    ZapPay: getProviderConfig('ZapPay'),
    GlitchPay: getProviderConfig('GlitchPay'),
    LagPay: getProviderConfig('LagPay'),
  }
}

async function fakeCharge(
  amountMinor: number,
  provider: PaymentProvider
): Promise<{ provider: PaymentProvider; status: 'success' | 'failed'; latencyMs: number }> {
  const cfg = getProviderConfig(provider)
  const min = Math.max(0, cfg.minMs)
  const max = Math.max(min, cfg.maxMs)
  const latency = Math.floor(Math.random() * (max - min + 1)) + min

  const start = Date.now()
  await sleep(latency)
  const measured = Date.now() - start

  const failureRate = Math.min(Math.max(cfg.failureRate, 0), 1)
  const failed = Math.random() < failureRate
  return { provider, status: failed ? 'failed' : 'success', latencyMs: measured }
}

app.post('/api/checkout', async (req: Request, res: Response) => {
  // Start a server span; distributed tracing will be handled automatically via propagation
  await Sentry.startSpan(
    {
      name: 'Order Processing',
      op: 'commerce.order.server',
    },
    async (span) => {
      try {
        const items = (req.body?.items as { productId: string; quantity: number }[]) || []
        const requestedProviderRaw = (req.body?.paymentProvider as string | undefined) ?? undefined
        const requestedProvider = PAYMENT_PROVIDERS.find((p) => p === requestedProviderRaw) ?? pickPaymentProvider()

        // Validate cart
        if (!Array.isArray(items) || items.length === 0) {
          span.setAttribute('payment.status', 'failed')
          span.setAttribute('inventory.reserved', false)
          res.status(400).json({ error: 'Cart is empty' })
          return
        }

        let totalMinor = 0
        for (const line of items) {
          const product = PRODUCTS.find((p) => p.id === line.productId)
          if (!product || line.quantity <= 0) {
            span.setAttribute('payment.status', 'failed')
            span.setAttribute('inventory.reserved', false)
            res.status(400).json({ error: 'Invalid cart item' })
            return
          }
          totalMinor += product.priceMinor * line.quantity
        }

        // Simulate reserving inventory (80% chance true)
        const reserved = Math.random() < 0.8

        // Simulate payment
        const charge = await Sentry.startSpan(
          {
            name: `Charge ${requestedProvider}`,
            op: 'commerce.payment',
            attributes: {
              'payment.provider': requestedProvider,
            },
          },
          async (paymentSpan) => {
            const result = await fakeCharge(totalMinor, requestedProvider)
            const cfg = getProviderConfig(requestedProvider)
            paymentSpan.setAttribute('payment.latency_ms', result.latencyMs)
            paymentSpan.setAttribute('payment.config.min_ms', cfg.minMs)
            paymentSpan.setAttribute('payment.config.max_ms', cfg.maxMs)
            paymentSpan.setAttribute('payment.config.failure_rate', cfg.failureRate)
            paymentSpan.setAttribute('payment.status', result.status)
            return result
          }
        )

        if (charge.status === 'failed' || !reserved) {
          span.setAttribute('payment.provider', charge.provider)
          span.setAttribute('payment.status', 'failed')
          span.setAttribute('inventory.reserved', reserved)
          res.status(402).json({ error: 'Payment failed' })
          return
        }

        const orderId = randomId()
        ORDERS.push({ id: orderId, totalMinor, items })

        // Set attributes before returning
        span.setAttribute('order.id', orderId)
        span.setAttribute('payment.provider', charge.provider)
        span.setAttribute('payment.status', 'success')
        span.setAttribute('inventory.reserved', reserved)

        res.json({ orderId, paymentProvider: charge.provider })
      } catch (err) {
        Sentry.captureException(err)
        res.status(500).json({ error: 'Internal error' })
      }
    }
  )
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/payment-config', (_req: Request, res: Response) => {
  const cfg = getAllProviderConfigs()
  res.json(cfg)
})

const port = Number(process.env.PORT ?? 5174)
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${port}`)
})
