import type * as SentryType from '@sentry/vue'

declare global {
  interface Window {
    Sentry?: {
      captureException(error: Error, context?: Record<string, any>): void
      captureMessage(message: string, context?: Record<string, any>): void
      setTag(key: string, value: string): void
      setUser(user: { id: string; email?: string; username?: string }): void
      [key: string]: any
    }
  }
}

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

  const logError = (error: Error, context?: SentryContext): void => {
    console.error(consoleLabel, error)

    if (window.Sentry) {
      try {
        window.Sentry.captureException(error, {
          ...context,
          tags: {
            ...context?.tags,
            component,
          },
        })
        return
      } catch (e) {
        console.debug('Window Sentry logging failed', e)
      }
    }

    getSentry().then((sentry) => {
      if (sentry) {
        try {
          sentry.captureException(error, {
            ...context,
            tags: {
              ...context?.tags,
              component,
            },
          })
        } catch (e) {
          console.debug('Imported Sentry logging failed', e)
        }
      }
    })
  }

  const logMessage = (
    message: string,
    level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
    context?: SentryContext,
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

    if (window.Sentry) {
      try {
        window.Sentry.captureMessage(message, {
          level,
          ...context,
          tags: {
            ...context?.tags,
            component,
          },
        })
        return
      } catch (e) {
        console.debug('Window Sentry logging failed', e)
      }
    }

    getSentry().then((sentry) => {
      if (sentry) {
        try {
          sentry.captureMessage(message, {
            level,
            ...context,
            tags: {
              ...context?.tags,
              component,
            },
          })
        } catch (e) {
          console.debug('Imported Sentry logging failed', e)
        }
      }
    })
  }

  const setTag = (key: string, value: string): void => {
    if (window.Sentry) {
      try {
        window.Sentry.setTag(key, value)
        return
      } catch (e) {
        // Fail silently
      }
    }

    getSentry().then((sentry) => {
      if (sentry) {
        try {
          sentry.setTag(key, value)
        } catch (e) {
          // Fail silently
        }
      }
    })
  }

  const setUser = (user: { id: string; email?: string; username?: string }): void => {
    if (window.Sentry) {
      try {
        window.Sentry.setUser(user)
        return
      } catch (e) {
        // Fail silently
      }
    }

    getSentry().then((sentry) => {
      if (sentry) {
        try {
          sentry.setUser(user)
        } catch (e) {
          // Fail silently
        }
      }
    })
  }

  return {
    logError,
    logMessage,
    setTag,
    setUser,
  }
}
