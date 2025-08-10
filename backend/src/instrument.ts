import * as Sentry from '@sentry/node'
// Initialize Sentry for Node
Sentry.init({
    dsn: 'https://8425f351dab486a8c2e467eaee4dd183@o4508130833793024.ingest.us.sentry.io/4509813737193472',
    tracesSampleRate: 1.0,
    debug: true,
  })
  