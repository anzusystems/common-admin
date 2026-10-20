import { type Ref, ref } from 'vue'
import type { IntegerId } from '@/shared/types/common'
import { inheritedDamConfigName } from '@/domains/dam/composables/damConfigName'

// The ext system the caches of names of each DAM configuration ask under: the last one written for that name, as the
// widgets and the asset select write it. Two names never share one.
const cachedExtSystemIds = new Map<string, Ref<IntegerId>>([['default', ref<IntegerId>(0)]])

/**
 * The ext system the caches of the names of authors and keywords of the DAM configuration `configName` ask under,
 * written by the image widgets and the asset select of that configuration; an application that shows names of it
 * outside them writes it itself. A name left out is the inherited one while a component sets up, renders or runs a
 * lifecycle hook (not after an `await` there), else `default`.
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
