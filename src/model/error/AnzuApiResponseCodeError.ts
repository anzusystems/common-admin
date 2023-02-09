export class AnzuApiResponseCodeError extends Error {
  private date: Date
  constructor() {
    super()
    this.name = this.constructor.name
    this.date = new Date()
  }
}
