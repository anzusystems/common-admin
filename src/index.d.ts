declare module 'js-sha1' {
  interface Hasher {
    update: (data: string) => this
    hex: () => string
  }

  declare function create(): Hasher
}
