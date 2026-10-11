import { inject, type InjectionKey, provide } from 'vue'

// Not exported from `src/lib.ts`: the components an application mounts take the name as their `configName`.
export const DamConfigNameKey: InjectionKey<string> = Symbol('anzu:dam-config-name')

/**
 * The name of the DAM configuration a component works under: its own `configName` when it is given one, else that of
 * the nearest component above it that has one, else `default`. Handed on to the components below. Read once, in
 * `setup`, as the options of the configuration are.
 */
export function useDamConfigName(explicit?: string): string {
  const name = explicit ?? inject(DamConfigNameKey, undefined) ?? 'default'
  provide(DamConfigNameKey, name)

  return name
}
