import type { CustomDataFormElement } from '@/domains/customDataForm/types/CustomDataForm'
import { commonT, commonTe } from '@/plugins/i18n'

/**
 * The two kinds of DAM custom forms. An asset form describes the asset, a distribution form
 * what is published to a distribution service, so the same property means different things in each.
 */
export type DamCustomFormKind = 'asset' | 'distribution'

/**
 * Translation key of the name of a DAM form element, one per meaning. A property means the same in every
 * asset form (of any ext system and asset type) and in every distribution form, but not across the two.
 */
export const damCustomFormElementNameKey = (kind: DamCustomFormKind, property: string): string =>
  `common.damCustomFormElement.${kind}.${property}`

/** The elements of a DAM form, each with the translation key of its name. */
export const withDamCustomFormElementNameKeys = (
  kind: DamCustomFormKind,
  elements: CustomDataFormElement[]
): CustomDataFormElement[] =>
  elements.map((element) => ({ ...element, nameKey: damCustomFormElementNameKey(kind, element.property) }))

/**
 * Name of a form element in the current language. The stored `name` stays for an element without a key
 * (a form of another system, such as the CMS) and for one the library has no text for (one added in the DAM later).
 */
export const customDataFormElementName = (element: Pick<CustomDataFormElement, 'name' | 'nameKey'>): string =>
  element.nameKey && commonTe(element.nameKey) ? commonT(element.nameKey) : element.name
