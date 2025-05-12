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

/**
 * Checks if Sentry is available and properly initialized
 */
export function isSentryAvailable(): boolean {
  try {
    return typeof window !== 'undefined' &&
      window.Sentry !== undefined &&
      typeof window.Sentry.captureException === 'function'
  } catch (e) {
    return false
  }
}

/**
 * Logs an error to Sentry if available
 * @param error The error to log
 * @param context Additional context for the error
 */
export function logError(error: Error, context?: SentryContext): void {
  console.error('[Common Admin]', error)

  if (isSentryAvailable()) {
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
}

/**
 * Logs a message to Sentry if available
 * @param message The message to log
 * @param level The severity level
 * @param context Additional context for the message
 */
export function logMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  context?: SentryContext
): void {
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

  if (isSentryAvailable()) {
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
}

/**
 * Sets a custom tag for Sentry events if Sentry is available
 * @param key The tag key
 * @param value The tag value
 */
export function setTag(key: string, value: string): void {
  if (isSentryAvailable()) {
    try {
      window.Sentry?.setTag(key, value)
    } catch (e) {
      // Fail silently
    }
  }
}

/**
 * Sets user information for Sentry events if Sentry is available
 * @param user User information
 */
export function setUser(user: { id: string, email?: string, username?: string }): void {
  if (isSentryAvailable()) {
    try {
      window.Sentry?.setUser(user)
    } catch (e) {
      // Fail silently
    }
  }
}
