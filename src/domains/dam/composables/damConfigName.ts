import { hasInjectionContext, inject, type InjectionKey, provide } from 'vue'
import { coreDamOptions } from '@/plugins/pluginOptions'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { isUndefined } from '@/shared/utils/common'

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

/**
 * The name a public composable works under when its caller names none: in a component's setup the name of the nearest
 * ancestor that has one (as `useDamConfigName` inherits it), anywhere else `default`. A component's own `configName`
 * is not seen here: it passes it. It hands nothing on.
 */
export function inheritedDamConfigName(explicit?: string): string {
  if (explicit !== undefined) return explicit

  return (hasInjectionContext() ? inject(DamConfigNameKey, undefined) : undefined) ?? 'default'
}

/**
 * Throws for a configuration name the application has not got, once the plugin has set the options. Before that every
 * name passes: what asks under it checks it then. `default` always passes: its caches are there from the start, in an
 * application without the DAM too.
 */
export function checkDamConfigName(configName: string) {
  if (configName === 'default' || isUndefined(coreDamOptions.value)) return
  useCommonAdminCoreDamOptions(configName)
}
