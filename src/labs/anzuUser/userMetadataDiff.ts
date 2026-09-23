import type { BaseUser } from '@/types/AnzuUser'

/**
 * The six fields the cross-system view compares.
 *
 * `email` is in the list and is also the reason the e-mail search runs twice: if a person is
 * `jozko@sme.sk` in weather and `j.mrkvicka@sme.sk` in blog, a search by e-mail finds weather and
 * blog answers nothing -- which looks exactly like "no account here". The second round, by the id
 * the first round found, is what turns that silence into the inconsistency it actually is.
 */
export const USER_METADATA_FIELDS = [
  'email',
  'person.firstName',
  'person.lastName',
  'person.fullName',
  'avatar.color',
  'avatar.text',
] as const

export type UserMetadataField = (typeof USER_METADATA_FIELDS)[number]

export const readMetadataField = (user: BaseUser, field: UserMetadataField): string => {
  switch (field) {
    case 'email':
      return user.email
    case 'person.firstName':
      return user.person.firstName
    case 'person.lastName':
      return user.person.lastName
    case 'person.fullName':
      return user.person.fullName
    case 'avatar.color':
      return user.avatar.color
    case 'avatar.text':
      return user.avatar.text
  }
}

export const writeMetadataField = (user: BaseUser, field: UserMetadataField, value: string): void => {
  switch (field) {
    case 'email':
      user.email = value
      break
    case 'person.firstName':
      user.person.firstName = value
      break
    case 'person.lastName':
      user.person.lastName = value
      break
    case 'person.fullName':
      user.person.fullName = value
      break
    case 'avatar.color':
      user.avatar.color = value
      break
    case 'avatar.text':
      user.avatar.text = value
      break
  }
}

export interface MetadataDifference {
  field: UserMetadataField
  /** System to the value it holds, for every system that answered with a record. */
  values: Map<string, string>
}

/**
 * Which of the six fields the systems disagree about.
 *
 * Blog is compared on `person.*` like everything else, and its own root `firstName`/`lastName`
 * columns are deliberately left out of this: those are the byline under an article, the blog's slug
 * and the public API, not back-office metadata. That blog's `person` is empty for most bloggers and
 * will therefore read as different is correct -- the back-office identity really is unset there,
 * and the first repair fills it in.
 */
export const findMetadataDifferences = (records: Map<string, BaseUser>): MetadataDifference[] => {
  const differences: MetadataDifference[] = []
  if (records.size < 2) return differences

  for (const field of USER_METADATA_FIELDS) {
    const values = new Map<string, string>()
    for (const [system, user] of records) {
      values.set(system, readMetadataField(user, field))
    }
    const distinct = new Set(values.values())
    if (distinct.size > 1) differences.push({ field, values })
  }

  return differences
}

/**
 * Which record the repair form is pre-filled from: the first system in the configured order that
 * has one.
 *
 * Never "whichever answered first" -- the fan-out is parallel, so that would be a different answer
 * on every run. The order is a default rather than a hidden rule: the dialog names the source and
 * lets it be changed.
 */
export const pickPrefillSource = (order: string[], records: Map<string, BaseUser>): string | null => {
  for (const system of order) {
    if (records.has(system)) return system
  }
  return null
}

/** Systems whose stored value differs from the one about to be written. Nothing else is touched. */
export const systemsNeedingWrite = (
  target: BaseUser,
  records: Map<string, BaseUser>,
  fields: readonly UserMetadataField[] = USER_METADATA_FIELDS
): string[] => {
  const systems: string[] = []
  for (const [system, user] of records) {
    const differs = fields.some((field) => readMetadataField(user, field) !== readMetadataField(target, field))
    if (differs) systems.push(system)
  }
  return systems
}
