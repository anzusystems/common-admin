export const isAnzuError = (error: unknown): error is AnzuError => {
  return error instanceof AnzuError
}

/**
 * Base class of every Anzu error.
 * The api helpers use `instanceof` to check whether an error is already mapped. A name
 * prefix check matches foreign `Anzu…` classes and misses classes that do not set `name`.
 */
export class AnzuError extends Error {
  constructor(message: string, cause: unknown = undefined) {
    super(message)
    this.name = 'AnzuError'
    this.cause = cause
  }
}
