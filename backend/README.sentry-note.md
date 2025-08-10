The backend uses `@sentry/node` with `tracesSampleRate: 1.0` in dev. The handler for `POST /api/checkout` uses a parent span (order processing) and a child span for payment via `startSpan`. Incoming trace headers (`sentry-trace` and `baggage`) are continued with `continueTrace`.

Environment variables to control simulated payment providers (optional):

- `PAYMENT_ZAPPAY_MIN_MS`, `PAYMENT_ZAPPAY_MAX_MS`, `PAYMENT_ZAPPAY_FAILURE_RATE`
- `PAYMENT_GLITCHPAY_MIN_MS`, `PAYMENT_GLITCHPAY_MAX_MS`, `PAYMENT_GLITCHPAY_FAILURE_RATE`
- `PAYMENT_LAGPAY_MIN_MS`, `PAYMENT_LAGPAY_MAX_MS`, `PAYMENT_LAGPAY_FAILURE_RATE`
