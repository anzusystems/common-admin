import type { InjectionKey } from 'vue'
import type { AxiosInstance } from 'axios'
import type { CommonAdminImageOptions, CurrentUserType, CustomAclResolver } from '@/AnzuSystemsCommonAdmin'
import type { LanguageCode } from '@/composables/languageSettings'
import type { IntegerId } from '@/types/common'

export const SystemScopeSymbol: InjectionKey<string | undefined> = Symbol.for('anzu:SystemScope')
export const SubjectScopeSymbol: InjectionKey<string | undefined> = Symbol.for('anzu:SubjectScope')
export const DamClientSymbol: InjectionKey<(() => AxiosInstance) | undefined> = Symbol.for('anzu:DamClient')
export const CurrentUserSymbol: InjectionKey<CurrentUserType | undefined> = Symbol.for('anzu:CurrentUser')
export const CustomAclResolverSymbol: InjectionKey<CustomAclResolver | undefined> = Symbol.for('anzu:CustomAclResolver')
export const AvailableLanguagesSymbol: InjectionKey<LanguageCode[] | undefined> = Symbol.for('anzu:AvailableLanguages')
export const DefaultLanguageSymbol: InjectionKey<LanguageCode | undefined> = Symbol.for('anzu:DefaultLanguage')
export const DefaultLicenceIdSymbol: InjectionKey<IntegerId | undefined> = Symbol.for('anzu:DefaultLicenceId')
export const ImageOptions: InjectionKey<CommonAdminImageOptions | undefined> = Symbol.for('anzu:ImageOptions')
