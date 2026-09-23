export const isAnzuError = (error: unknown): error is AnzuError => {
  return error instanceof AnzuError
}

/**
 * The base every Anzu error extends.
 *
 * It exists so the api helpers can ask "has this already been mapped?" without testing the error's
 * name: a string prefix answers true for anyone else's class called `Anzu…`, and answers false the
 * moment a class forgets to set `name`. One `instanceof` says exactly what is meant.
 */
export class AnzuError extends Error {
  constructor(message: string, cause: unknown = undefined) {
    super(message)
    this.name = 'AnzuError'
    this.cause = cause
  }
}
