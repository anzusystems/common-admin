import type { BaseUser } from '@/shared/types/AnzuUser'

/**
 * The six compared fields.
 * `email` is why e-mail search runs twice: a system with a different
 * address answers nothing. The id round reveals that as an inconsistency.
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
 * Blog is compared on `person.*`. Its root `firstName`/`lastName` are the public byline and are excluded.
 * Blog's empty `person` reads as different on purpose; the first repair fills it.
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
 * Prefill source: the first system in configured order with a record.
 * Not the first to answer, since the fan-out is parallel. The dialog names the source and lets it be changed.
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
