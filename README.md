# Crash Commerce — Sample Ecommerce Checkout (React + Node)

A end-to-end sample showing Sentry tracing and span metrics across a checkout flow.

- Frontend: React (Vite + TS), Tailwind CSS, Framer Motion, Fetch API
- Backend: Node.js (Express + TS), in-memory data store
- Sentry: JavaScript SDK for React and Node with single-span patterns

## Features
- Product list page with animated cards and "Add to Cart"
- Cart page with item count, total price, and Checkout button
- Checkout calls `POST /api/checkout` with simulated latency and 10–20% failures
- Order confirmation modal shows order ID, provider, and total on success
- Error toast notifications display specific failure messages
- In-memory order creation and selectable fake payment providers
- Three fictional payment providers with configurable performance via `backend/.env`:
  - ZapPay — fast, low failure (demo: low latency, 5% failure)
  - GlitchPay — variable and error-prone (demo: wide latency, 30% failure)
  - LagPay — slow, moderate failure (demo: high latency, 10% failure)
- Spans carry low-cardinality attributes suitable for span metrics

## Instrumentation design
- Frontend: A single span per click
  - name: `Checkout`, op: `ui.action`
  - attributes at start: `cart.item_count`, `cart.value_minor`, `cart.currency`
  - on success: sets `order.id`, `payment.provider`
  - on error: marks span status error
  - relies on auto-instrumentation for the fetch call
 - Backend: A single span in the `POST /api/checkout` handler, plus a payment child span
  - name: `Order Processing`, op: `commerce.order.server`
  - child span for payment: `Charge <Provider>`, op: `commerce.payment`
  - attributes: `order.id`, `payment.provider`, `payment.status`, `inventory.reserved`, and `payment.latency_ms`

## Setup

### Prereqs
- Node 18+

### Install
```bash
# Install all dependencies (both frontend and backend)
npm install
npx playwright install --with-deps
```
This will automatically install dependencies for both the frontend and backend applications, and install browsers for Playwright.

Alternatively, you can install them separately:
```bash
# Frontend only
npm run install:frontend

# Backend only
npm run install:backend
```

### Configure env
- Create `frontend/.env` with:
```
VITE_SENTRY_DSN=<your public DSN>
```
- Create `backend/.env` with (example values shown; all are optional since defaults exist):
```
SENTRY_DSN=<your server DSN>
PORT=5174

# ZapPay (fast & reliable)
PAYMENT_ZAPPAY_MIN_MS=50
PAYMENT_ZAPPAY_MAX_MS=150
PAYMENT_ZAPPAY_FAILURE_RATE=0.05

# GlitchPay (variable & error-prone)
PAYMENT_GLITCHPAY_MIN_MS=200
PAYMENT_GLITCHPAY_MAX_MS=1200
PAYMENT_GLITCHPAY_FAILURE_RATE=0.30

# LagPay (slow)
PAYMENT_LAGPAY_MIN_MS=1200
PAYMENT_LAGPAY_MAX_MS=3000
PAYMENT_LAGPAY_FAILURE_RATE=0.10
```
- In development, the SDKs use `tracesSampleRate: 1.0`. In production, tune sampling.

### Run

#### Option 1: Run both services with a single command (recommended)
```bash
npm run dev
```
This uses [concurrently](https://github.com/open-cli-tools/concurrently) to run both the frontend and backend in a single terminal.
- Frontend: http://localhost:5173
- Backend: http://localhost:5174

#### Option 2: Run services separately
If you prefer to run the services in separate terminals:
```bash
# Terminal 1: backend
npm run dev:backend
# -> http://localhost:5174

# Terminal 2: frontend  
npm run dev:frontend
# -> http://localhost:5173
```

The frontend dev server proxies `/api` to the backend.

### Build for production
```bash
# Build both frontend and backend
npm run build

# Or build separately
npm run build:frontend
npm run build:backend
```

## Where to find instrumentation
- Frontend span creation: `frontend/src/App.tsx` inside `onCheckoutClick()`
- Frontend Sentry init: `frontend/src/sentry.ts`
 - Backend spans: `backend/src/server.ts` in the `/api/checkout` handler using `startSpan` (distributed tracing is propagated automatically), plus a child span for payment

### Provider performance configuration endpoint
- `GET /api/payment-config` returns the effective per-provider configuration derived from environment variables. The UI fetches this on load and displays each provider’s latency range and failure rate next to the selector in the cart.

## Testing plan
- Perform 10–20 successful checkouts and 3–5 failed ones
- Confirm span attributes appear in Sentry
- Example span-metrics queries:
  - p95 of Checkout UI action: filter `op:ui.action`, group by `cart.item_count`
  - Error rate of server span grouped by `payment.provider`
  - Duration distribution for successful vs failed checkouts

## Sentry Trace Explorer: What to explore

### Critical ecommerce metrics (KPIs)
- **Checkout latency (UI)**: p50/p95/p99 for the `Checkout` span (`op:ui.action`).
  - Group by: `cart.item_count`, `cart.currency` to see how cart size or currency affects speed.
- **Checkout latency (Server)**: p50/p95/p99 for the `POST /api/checkout` span (`op:http.server`).
  - Group by: `payment.provider`, `inventory.reserved` to spot provider or inventory effects.
- **Error rate**: Percent of failed spans for UI and server paths.
  - Segment by: `payment.provider`, `cart.item_count` to find brittle paths.
- **Throughput (traffic)**: Spans per minute (SPM) for `Checkout` to understand demand and capacity needs.
- **Long-tail risk**: Count of spans over thresholds (e.g., >1s, >2s) to detect tail latency regressions.

### Example views and queries to try
- **UI checkout p95 by cart size**
  - Filter: `op:ui.action name:Checkout`
  - Columns: `p95(span.duration)`, `count()`
  - Group by: `cart.item_count`

- **Server latency by payment provider**
  - Filter: `op:http.server name:"POST /api/checkout"`
  - Columns: `p95(span.duration)`, `p99(span.duration)`, `count()`
  - Group by: `payment.provider`

- **Failure rate by provider**
  - Filter: `op:http.server name:"POST /api/checkout"`
  - Columns: `count()`, `count_if(span.status!=ok)` (or compare status facets)
  - Group by: `payment.provider`, optionally `inventory.reserved`

- **Tail latency (UI) health check**
  - Filter: `op:ui.action name:Checkout span.duration:>1000ms`
  - Columns: `count()` (track over time to watch the >1s tail)

- **Currency segmentation (UI)**
  - Filter: `op:ui.action name:Checkout`
  - Columns: `p95(span.duration)`, `count()`
  - Group by: `cart.currency`

### Suggested targets for a healthy checkout
- **UI p95**: < 1200 ms
- **Server p95**: < 800 ms
- **Error rate**: < 2% overall, and < 5% for any single `payment.provider`
- **Tail (>2s) share**: trending down and < 1% of checkouts

Tip: Start from the spans table in Trace Explorer, filter by `op`, add latency percentiles and a `group by` you care about, then pivot into traces from any outlier row to see concrete examples.

## Simulating user activity with Playwright

This repo includes two ways to simulate traffic:

- Batch simulator script (recommended for demos): runs users in small batches (default 5 at a time) until a target count is met. Each user randomly adds 1–5 products, selects a random payment method (ZapPay, GlitchPay, LagPay), opens the cart, and attempts checkout. Failures are expected based on provider rates and end that user's flow.
- Playwright Test suite: generates N independent tests, runs with multiple workers, and prints progress using reporters.

### Run the batch simulator
```
npm run dev   # start the app (in a separate terminal)
# simulate 500 users in batches of 5 (headful by default for visibility)
HEADLESS=false npm run loadtest

# smaller/local verification run
TOTAL_USERS=10 BATCH_SIZE=5 HEADLESS=false npm run loadtest
```

Environment variables for tuning:
- `BASE_URL` (default `http://localhost:5173`)
- `TOTAL_USERS` (default `500`) — total users to simulate
- `BATCH_SIZE` (default `5`) — browsers run at a time
- `INTER_BATCH_DELAY_MS` (default `250`)
- `HEADLESS` (`true|false`, default `false`)
- `DEBUG_FLOW` (`true|false`, default `false`)

Notes:
- The frontend now exposes stable selectors: `#cart-button`, `#checkout-button`, and `data-testid="add-<id>"` and `data-testid="payment-<Provider>"`.
- This is a lightweight traffic simulator, not a full benchmark harness.

### Run with Playwright Test (progress reporters)
```
# auto-starts dev server per playwright.config.ts
BASE_URL=http://localhost:5173 TOTAL_USERS=200 npx playwright test --workers=5 --reporter=list

# or via npm script
npm run test:e2e
```
The test suite generates `TOTAL_USERS` tests, each performing the same randomized checkout flow. Expected payment failures are logged but do not fail tests in this demo.