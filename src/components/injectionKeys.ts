import type { InjectionKey } from 'vue'
import type { LanguageCode } from '@/composables/languageSettings'

export const SystemScopeSymbol: InjectionKey<string | undefined> = Symbol.for('anzu:SystemScope')
export const SubjectScopeSymbol: InjectionKey<string | undefined> = Symbol.for('anzu:SubjectScope')
export const AvailableLanguagesSymbol: InjectionKey<LanguageCode[] | undefined> = Symbol.for('anzu:AvailableLanguages')
export const DefaultLanguageSymbol: InjectionKey<LanguageCode | undefined> = Symbol.for('anzu:DefaultLanguage')
