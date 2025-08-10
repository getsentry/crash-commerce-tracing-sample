# Build a sample Ecommerce Checkout app with Sentry span metrics (React + Node)

Goal
- Create a beautiful and interactive sample which illustrates end-to-end tracing and span metrics for a checkout flow. Use tailwindcss, framer for animations. Make it stunning and feel like an engaging shopify store.
- Make the store a store for buying and selling common software errors and exceptions.
- This is a Sentry example so all technology choices should reflect Sentry's functionality.
- Use simple, single-span instrumentation patterns that users can copy/paste and customize.
- Avoid nested spans. Rely on auto-instrumentation for fetch/HTTP/DB where possible. Feature custom spans.

Tech stack
- Frontend: React (Vite or CRA) + Fetch API
- Backend: Node.js + Express
- Optional: In-memory “DB” and fake payment provider (simulated delay + failure rate)
- Sentry JavaScript SDK for React and Node

Functional requirements
- Product list page with “Add to Cart”
- Cart page with item count and total; “Checkout” button triggers `POST /api/checkout`
- Backend validates cart, calls a fake payment provider, “creates” an order (in memory), and returns `{ orderId, paymentProvider }`
- Simulate 10–20% payment failures and random latency

Sentry instrumentation requirements (single-span patterns)
- Frontend:
  - On checkout button click, start a single span:
    - name: "Checkout"
    - op: "ui.action"
    - attributes at start: `cart.item_count` (int), `cart.value_minor` (int, cents), `cart.currency` (string)
  - After successful response: set `order.id` and `payment.provider`
  - On error: mark span status error
  - Rely on auto-instrumentation for the `fetch` to `/api/checkout`
- Backend:
  - In the Express handler for `POST /api/checkout`, start a single span:
    - name: "Checkout (server)"
    - op: "http.server"
    - attributes set before returning:
      - `order.id` (string—internal ID), `payment.provider` (enum), `payment.status` (enum), `inventory.reserved` (bool)
  - Do not create child spans in the example. Rely on auto-instrumentation for any outgoing calls.

Attribute guidance
- Use low-cardinality keys (enums/booleans/numbers). No PII or raw payment details.
- Prefer internal IDs or hashed values when needed.

Deliverables
- A runnable project with `frontend/` and `backend/` folders and a top-level `README.md`.
- Frontend:
  - `src/App.tsx` or equivalent with product list, cart, and checkout click handler using the Sentry span as above.
  - Sentry init with traces sample rate set high in dev (`tracesSampleRate: 1.0`).
- Backend:
  - `src/server.ts` with an Express app implementing `/api/checkout`.
  - Fake payment provider function that sleeps and randomly fails (e.g., 10–20%).
  - Sentry init with tracing enabled.

Config and env
- `.env` files for frontend and backend with `SENTRY_DSN` (frontend uses public DSN, backend uses server DSN).
- In dev, set `tracesSampleRate = 1.0`. In production, note that sampling should be tuned.

User journey and data flow
1) User clicks Checkout in React
2) Frontend starts `ui.action` span and calls `POST /api/checkout` (auto-traced fetch)
3) Express continues the trace, starts `http.server` span
4) Backend validates cart, simulates payment, creates order, returns response
5) Frontend sets `order.id`, `payment.provider` on span and finishes

Success criteria (trace + span metrics)
- You can view a trace that starts at the React span and continues into the server span.
- Span attributes are visible on both spans and are low-cardinality.
- Example queries the user should be able to run:
  - p95 of Checkout UI action: filter `op:ui.action` and group by `cart.item_count`
  - Error rate of server `http.server` span grouped by `payment.provider`
  - Distribution of durations for successful checkouts vs failures

Non-functional requirements
- Keep code small, readable, and well-commented only where needed.
- No nested spans in code examples.
- No PII. Use mock data and internal IDs.
- Provide `npm run dev` scripts for both frontend and backend, and document ports.

Testing plan
- Run 10–20 successful checkouts and 3–5 failed ones to generate data.
- Confirm attributes appear on spans in Sentry.
- Validate the sample span-metrics queries above.

README checklist
- How to install and run (frontend and backend)
- How to set `SENTRY_DSN` and `tracesSampleRate`
- Where to find and modify the instrumentation lines
- How to force payment failures (e.g., env var for failure rate)

