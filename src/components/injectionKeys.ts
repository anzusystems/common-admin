import type { InjectionKey } from 'vue'

export const SystemScopeSymbol: InjectionKey<string> = Symbol.for('anzu:system-scope')
export const SubjectScopeSymbol: InjectionKey<string> = Symbol.for('anzu:subject-scope')
export const DamClientSymbol: InjectionKey<string> = Symbol.for('anzu:dam-client')
export const CmsClientSymbol: InjectionKey<string> = Symbol.for('anzu:cms-client')
