declare global {
  interface Window {
    Sentry?: {
      captureException(error: Error, context?: Record<string, any>): void;
      captureMessage(message: string, level?: string, context?: Record<string, any>): void;
      setTag(key: string, value: string): void;
      setUser(user: { id: string, email?: string, username?: string }): void;
      [key: string]: any;
    };
  }
}

interface SentryContext {
  extra?: Record<string, any>;
  tags?: Record<string, string>;
  level?: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';
  [key: string]: any;
}

export function useSentry() {
  /**
   * Logs an error to Sentry if available
   *
   * @param error The error to log
   * @param context Additional context for the error
   */
  const logError = (error: Error, context?: SentryContext): void => {
    console.error('[Common Admin]', error)

    try {
      window.Sentry?.captureException(error, {
        ...context,
        tags: {
          ...context?.tags,
          component: 'common-admin',
        }
      })
    } catch (e) {
      console.debug('Sentry logging failed', e)
    }
  }

  /**
   * Logs a message to Sentry if available
   *
   * @param message The message to log
   * @param level The severity level
   * @param context Additional context for the message
   */
  const logMessage = (
    message: string,
    level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
    context?: SentryContext
  ): void => {
    // Always log to console based on level
    switch (level) {
      case 'fatal':
      case 'error':
        console.error('[Common Admin]', message)
        break
      case 'warning':
        console.warn('[Common Admin]', message)
        break
      case 'info':
        console.info('[Common Admin]', message)
        break
      case 'debug':
        console.debug('[Common Admin]', message)
        break
      default:
        console.log('[Common Admin]', message)
    }

    try {
      window.Sentry?.captureMessage(message, level, {
        ...context,
        tags: {
          ...context?.tags,
          component: 'common-admin',
        }
      })
    } catch (e) {
      console.debug('Sentry logging failed', e)
    }
  }

  /**
   * Sets a custom tag for Sentry events if Sentry is available
   *
   * @param key The tag key
   * @param value The tag value
   */
  const setTag = (key: string, value: string): void => {
    try {
      window.Sentry?.setTag(key, value)
    } catch (e) {
      // Fail silently
    }
  }

  /**
   * Sets user information for Sentry events if Sentry is available
   *
   * @param user User information
   */
  const setUser = (user: { id: string, email?: string, username?: string }): void => {
    try {
      window.Sentry?.setUser(user)
    } catch (e) {
      // Fail silently
    }
  }

  return {
    logError,
    logMessage,
    setTag,
    setUser
  }
}
