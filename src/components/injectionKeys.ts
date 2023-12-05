import type { InjectionKey } from 'vue'
import type { CurrentUserType, CustomAclResolver } from '@/AnzuSystemsCommonAdmin'
import type { LanguageCode } from '@/composables/languageSettings'

export const SystemScopeSymbol: InjectionKey<string | undefined> = Symbol.for('anzu:SystemScope')
export const SubjectScopeSymbol: InjectionKey<string | undefined> = Symbol.for('anzu:SubjectScope')
export const CurrentUserSymbol: InjectionKey<CurrentUserType | undefined> = Symbol.for('anzu:CurrentUser')
export const CustomAclResolverSymbol: InjectionKey<CustomAclResolver | undefined> = Symbol.for('anzu:CustomAclResolver')
export const AvailableLanguagesSymbol: InjectionKey<LanguageCode[] | undefined> = Symbol.for('anzu:AvailableLanguages')
export const DefaultLanguageSymbol: InjectionKey<LanguageCode | undefined> = Symbol.for('anzu:DefaultLanguage')
