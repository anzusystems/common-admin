import type { InjectionKey } from 'vue'

export const SystemScopeSymbol: InjectionKey<string> = Symbol.for('anzu:system-scope')
export const SubjectScopeSymbol: InjectionKey<string> = Symbol.for('anzu:subject-scope')
