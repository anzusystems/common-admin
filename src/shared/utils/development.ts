/**
 * Not `import.meta.env.DEV`: it is replaced when the library is built, so it is always `false` in `dist`.
 * `process.env.NODE_ENV` is replaced by the admin's build and dev
 * server. Where nothing replaces it, `process` may not exist.
 */
export const isDevelopment = (): boolean => {
  try {
    return process.env.NODE_ENV !== 'production'
  } catch {
    return false
  }
}

const warned = new Set<string>()

/**
 * `console.warn` once per key, and only in development.
 */
export const warnOnceInDevelopment = (key: string, ...message: unknown[]): void => {
  if (!isDevelopment() || warned.has(key)) return
  warned.add(key)
  console.warn(...message)
}
