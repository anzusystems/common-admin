import { describe, expect, it } from 'vitest'
import { damCredit } from '@/domains/dam/author/composables/damCredit'

const config = {
  creditFormat: '{sources}/{authors}',
  creditSourcesSeparator: '/',
  creditAuthorsSeparator: ', ',
}
const named = (...names: string[]) => names.map((name) => ({ name, hiddenInCredit: false, priority: 0 }))

describe('damCredit', () => {
  it('composes sources and authors by the format', () => {
    expect(damCredit(named('TASR', 'SITA'), named('Jozef Jakubčo', 'Janko Mrkvička'), config)).toBe(
      'TASR/SITA/Jozef Jakubčo, Janko Mrkvička'
    )
  })

  it('returns one side alone when the other is empty', () => {
    expect(damCredit(named('Acme'), [], config)).toBe('Acme')
    expect(damCredit([], named('Jane Doe'), config)).toBe('Jane Doe')
  })

  it('skips names hidden in credit and returns empty when all are hidden', () => {
    const hidden = { name: 'Acme', hiddenInCredit: true, priority: 1000 }
    expect(damCredit([hidden], named('Jane Doe'), config)).toBe('Jane Doe')
    expect(damCredit([hidden], [{ ...hidden, name: 'Jane Doe' }], config)).toBe('')
  })

  it('puts a higher priority first and keeps the order of equal ones', () => {
    const sources = [
      { name: 'TASR', hiddenInCredit: false, priority: 0 },
      { name: 'SITA', hiddenInCredit: false, priority: 0 },
      { name: 'AP', hiddenInCredit: false, priority: 100 },
    ]
    const authors = [
      { name: 'Claudio Furlan', hiddenInCredit: false, priority: 0 },
      { name: 'LaPresse', hiddenInCredit: false, priority: 200 },
    ]
    expect(damCredit(sources, authors, config)).toBe('AP/TASR/SITA/LaPresse, Claudio Furlan')
    expect(sources.map((source) => source.name)).toEqual(['TASR', 'SITA', 'AP'])
  })

  it('keeps replacement patterns in names literally', () => {
    expect(damCredit(named('A$&B'), named("C$'D"), config)).toBe("A$&B/C$'D")
  })

  it('follows a custom format and separators', () => {
    const custom = {
      creditFormat: '{authors} / {sources}',
      creditSourcesSeparator: ' | ',
      creditAuthorsSeparator: '; ',
    }
    expect(damCredit(named('Acme', 'Globex'), named('Jane Doe', 'John Roe'), custom)).toBe(
      'Jane Doe; John Roe / Acme | Globex'
    )
  })
})
