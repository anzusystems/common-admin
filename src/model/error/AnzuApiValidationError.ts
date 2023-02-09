export class AnzuApiValidationError extends Error {
  private date: Date
  constructor() {
    super()
    this.name = this.constructor.name
    this.date = new Date()
  }
}
