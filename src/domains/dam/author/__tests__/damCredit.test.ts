import { describe, expect, it } from 'vitest'
import { damCredit } from '@/domains/dam/author/composables/damCredit'

const config = {
  creditFormat: '{sources}/{authors}',
  creditSourcesSeparator: '/',
  creditAuthorsSeparator: ', ',
}
const named = (...names: string[]) => names.map((name) => ({ name, hiddenInCredit: false }))

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
    const hidden = { name: 'Acme', hiddenInCredit: true }
    expect(damCredit([hidden], named('Jane Doe'), config)).toBe('Jane Doe')
    expect(damCredit([hidden], [{ name: 'Jane Doe', hiddenInCredit: true }], config)).toBe('')
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
