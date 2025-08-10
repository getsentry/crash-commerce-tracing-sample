import './instrument'
import 'dotenv/config'
import express, { Request, Response } from 'express'
import * as Sentry from '@sentry/node'


const app = express()

// Sentry.setupExpressErrorHandler(app);

// Request logging middleware
app.use((req, res, next) => {
  console.log('\n--- Incoming Request ---')
  console.log(`${req.method} ${req.url}`)
  console.log('Headers:', JSON.stringify(req.headers, null, 2))
  if (req.method === 'POST' && req.body) {
    console.log('Body:', JSON.stringify(req.body, null, 2))
  }
  console.log('------------------------\n')
  next()
})

// Enable CORS for frontend
app.use((req, res, next) => {
  const origin = req.headers.origin || 'http://localhost:5173'
  res.header('Access-Control-Allow-Origin', origin)
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, sentry-trace, baggage')
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})

app.use(express.json())

// Log body after JSON parsing
app.use((req, res, next) => {
  if (req.method === 'POST' && req.body && Object.keys(req.body).length > 0) {
    console.log('Parsed Body:', JSON.stringify(req.body, null, 2))
  }
  next()
})

// In-memory product catalog
const PRODUCTS = [
  {
    id: 'npe',
    name: 'NullPointerException',
    description: 'Classic dereference gone wrong. Perfect for legacy Java stacks.',
    priceMinor: 1299,
    badge: 'Bestseller',
    color: 'from-purple-600 to-pink-600',
  },
  {
    id: 'typeerror',
    name: 'TypeError: undefined is not a function',
    description: 'Bring back 2014 vibes in your JS app.',
    priceMinor: 999,
    color: 'from-blue-600 to-cyan-600',
  },
  {
    id: 'segfault',
    name: 'Segmentation Fault',
    description: 'A low-level thrill for your C/C++ adventures.',
    priceMinor: 1999,
    badge: 'Premium',
    color: 'from-red-600 to-orange-600',
  },
  {
    id: 'syntax',
    name: 'SyntaxError: Unexpected token',
    description: 'Small typo, big adventure. Great for onboarding.',
    priceMinor: 599,
    color: 'from-green-600 to-emerald-600',
  },
  {
    id: 'oom',
    name: 'OutOfMemoryError',
    description: 'Stress-test your autoscaling like a pro.',
    priceMinor: 2499,
    color: 'from-indigo-600 to-purple-600',
  },
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
  // Log Sentry trace headers if present
  if (req.headers['sentry-trace'] || req.headers['baggage']) {
    console.log('🔍 Sentry Trace Headers:')
    console.log('  sentry-trace:', req.headers['sentry-trace'])
    console.log('  baggage:', req.headers['baggage'])
  }

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

app.get('/api/products', (_req: Request, res: Response) => {
  res.json(PRODUCTS)
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
