import * as Sentry from '@sentry/node'

// Initialize Sentry for Node
Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
    debug: true,
  })
  