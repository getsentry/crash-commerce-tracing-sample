import * as Sentry from '@sentry/react'

Sentry.init({

  // Import your Sentry DSN from your project
  dsn: import.meta.env.VITE_SENTRY_DSN,

  // Set the sample rate for traces to 100%
  tracesSampleRate: 1.0,

  // Set the trace propagation targets to all URLs
  tracePropagationTargets: ['localhost:5174'],

  // Add the browser tracing integration
  integrations: [Sentry.browserTracingIntegration()],

  // Add the logger integration
  enableLogs: true
})
