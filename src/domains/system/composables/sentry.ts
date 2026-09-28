import type * as SentryType from '@sentry/vue'

interface SentryContext {
  extra?: Record<string, any>
  tags?: Record<string, string>
  level?: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug'
  [key: string]: any
}

let sentryPromise: Promise<typeof SentryType | null> | null = null

const getSentry = (): Promise<typeof SentryType | null> => {
  if (!sentryPromise) {
    sentryPromise = import('@sentry/vue').then((module) => module).catch(() => null)
  }
  return sentryPromise
}

export function useSentry(component = 'common-admin') {
  const consoleLabel = `[${component}]`

  /**
   * Sentry is imported lazily, so nothing here is synchronous and nothing here may throw: a failed
   * report must never take down the code that was only trying to report something.
   */
  const report = (send: (sentry: typeof SentryType) => void): void => {
    getSentry().then((sentry) => {
      if (!sentry) {
        return
      }
      try {
        send(sentry)
      } catch (e) {
        console.debug('Sentry logging failed', e)
      }
    })
  }

  const taggedContext = (context?: SentryContext): SentryContext => ({
    ...context,
    tags: {
      ...context?.tags,
      component,
    },
  })

  const logError = (error: Error, context?: SentryContext): void => {
    console.error(consoleLabel, error)

    report((sentry) => sentry.captureException(error, taggedContext(context)))
  }

  const logMessage = (
    message: string,
    level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
    context?: SentryContext
  ): void => {
    switch (level) {
      case 'fatal':
      case 'error':
        console.error(consoleLabel, message)
        break
      case 'warning':
        console.warn(consoleLabel, message)
        break
      case 'info':
        console.info(consoleLabel, message)
        break
      case 'debug':
        console.debug(consoleLabel, message)
        break
      default:
        console.log(consoleLabel, message)
    }

    report((sentry) => sentry.captureMessage(message, { level, ...taggedContext(context) }))
  }

  const setTag = (key: string, value: string): void => {
    report((sentry) => sentry.setTag(key, value))
  }

  const setUser = (user: { id: string; email?: string; username?: string }): void => {
    report((sentry) => sentry.setUser(user))
  }

  return {
    logError,
    logMessage,
    setTag,
    setUser,
  }
}
