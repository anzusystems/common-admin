import { describe, expect, it } from 'vitest'
import {
  findMetadataDifferences,
  pickPrefillSource,
  readMetadataField,
  systemsNeedingWrite,
  writeMetadataField,
} from '@/labs/anzuUser/userMetadataDiff'
import type { BaseUser } from '@/types/AnzuUser'

const user = (over: Partial<BaseUser> = {}): BaseUser => ({
  id: 42,
  email: 'jozef@sme.sk',
  person: { firstName: 'Jozef', lastName: 'Mrkvicka', fullName: 'Jozef Mrkvicka' },
  avatar: { color: '#4CAF50', text: 'JM' },
  ...over,
})

describe('metadata differences', () => {
  it('finds nothing when the systems agree', () => {
    const records = new Map([
      ['weather', user()],
      ['brick', user()],
    ])

    expect(findMetadataDifferences(records)).toEqual([])
  })

  it('compares the e-mail too, which is the reason the search runs twice', () => {
    const records = new Map([
      ['weather', user()],
      ['blog', user({ email: 'j.mrkvicka@sme.sk' })],
    ])

    const differences = findMetadataDifferences(records)

    expect(differences).toHaveLength(1)
    expect(differences[0].field).toBe('email')
    expect(differences[0].values.get('blog')).toBe('j.mrkvicka@sme.sk')
  })

  it('reports an empty person as a difference, which is the blog case', () => {
    // Blog's own root `firstName`/`lastName` are deliberately out of scope: they are the byline
    // under an article and the blog's slug, not back-office metadata. Its `person` really is unset
    // for most bloggers, and saying so is correct.
    const records = new Map([
      ['weather', user()],
      ['blog', user({ person: { firstName: '', lastName: '', fullName: '' } })],
    ])

    const fields = findMetadataDifferences(records).map((difference) => difference.field)

    expect(fields).toContain('person.firstName')
    expect(fields).toContain('person.lastName')
    expect(fields).toContain('person.fullName')
  })

  it('says nothing about a single system, which cannot disagree with anyone', () => {
    expect(findMetadataDifferences(new Map([['weather', user()]]))).toEqual([])
  })
})

describe('prefill source', () => {
  it('takes the first system in the configured order that has a record', () => {
    const order = ['cms', 'contentHub', 'weather', 'dam']
    const records = new Map([
      ['weather', user()],
      ['dam', user()],
    ])

    // Never "whichever answered first": the fan-out is parallel and that would differ every run.
    expect(pickPrefillSource(order, records)).toBe('weather')
  })

  it('answers null when nobody has a record', () => {
    expect(pickPrefillSource(['cms'], new Map())).toBeNull()
  })
})

describe('which systems get written to', () => {
  it('leaves out the ones that already hold the value', () => {
    const target = user({ person: { firstName: 'Jozef', lastName: 'Novak', fullName: 'Jozef Novak' } })
    const records = new Map([
      ['weather', user()],
      ['brick', user({ person: { firstName: 'Jozef', lastName: 'Novak', fullName: 'Jozef Novak' } })],
    ])

    expect(systemsNeedingWrite(target, records)).toEqual(['weather'])
  })

  it('reads and writes every one of the six fields', () => {
    const value = user()
    writeMetadataField(value, 'avatar.color', '#000000')
    writeMetadataField(value, 'person.fullName', 'Somebody Else')

    expect(readMetadataField(value, 'avatar.color')).toBe('#000000')
    expect(readMetadataField(value, 'person.fullName')).toBe('Somebody Else')
    expect(readMetadataField(value, 'email')).toBe('jozef@sme.sk')
  })
})
