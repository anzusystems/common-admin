import { type Ref, ref } from 'vue'
import type { IntegerId } from '@/shared/types/common'
import { inheritedDamConfigName } from '@/domains/dam/composables/damConfigName'

// Ext system the name caches of each DAM configuration use. The
// widgets and the asset select set it. Names never share one.
const cachedExtSystemIds = new Map<string, Ref<IntegerId>>([['default', ref<IntegerId>(0)]])

/**
 * Ext system the author and keyword name caches of `configName` use.
 * The image widgets and asset select of that configuration set it.
 * An app showing those names elsewhere sets it itself.
 * Without a name, uses the inherited one during component setup,
 * render or a lifecycle hook (not after an `await`), else `default`.
 */
export function useExtSystemIdForCached(configName?: string) {
  const name = inheritedDamConfigName(configName)
  let cachedExtSystemId = cachedExtSystemIds.get(name)
  if (!cachedExtSystemId) {
    cachedExtSystemId = ref<IntegerId>(0)
    cachedExtSystemIds.set(name, cachedExtSystemId)
  }

  return {
    cachedExtSystemId,
  }
}
