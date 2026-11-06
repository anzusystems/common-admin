import { hasInjectionContext, inject, type InjectionKey, provide } from 'vue'
import { coreDamOptions } from '@/plugins/pluginOptions'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { isUndefined } from '@/shared/utils/common'

// Not exported from `src/lib.ts`. Components an application mounts take the name as `configName`.
export const DamConfigNameKey: InjectionKey<string> = Symbol('anzu:dam-config-name')

/**
 * DAM configuration name of a component: its own `configName`, else the nearest ancestor's, else `default`.
 * Provided to child components. Read once in `setup`, like the configuration options.
 */
export function useDamConfigName(explicit?: string): string {
  const name = explicit ?? inject(DamConfigNameKey, undefined) ?? 'default'
  provide(DamConfigNameKey, name)

  return name
}

/**
 * Name a public composable uses when the caller gives none: in
 * component setup the nearest ancestor's, elsewhere `default`.
 * It does not see the component's own `configName` and provides nothing to children.
 */
export function inheritedDamConfigName(explicit?: string): string {
  if (explicit !== undefined) return explicit

  return (hasInjectionContext() ? inject(DamConfigNameKey, undefined) : undefined) ?? 'default'
}

/**
 * Throws for an unknown configuration name once the plugin has set
 * options. Before that every name passes and is checked on use.
 * `default` always passes: its caches exist from the start, even in apps without DAM.
 */
export function checkDamConfigName(configName: string) {
  if (configName === 'default' || isUndefined(coreDamOptions.value)) return
  useCommonAdminCoreDamOptions(configName)
}
