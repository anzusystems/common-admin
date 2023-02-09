export class AnzuFatalError extends Error {
  private date: Date
  constructor(message = '') {
    super()
    this.name = this.constructor.name
    this.message = message
    this.date = new Date()
  }
}
