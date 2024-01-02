import { computed, ref } from 'vue'
import type { UploadQueueKey } from '@/types/coreDam/UploadQueue'

export const CLASS_PREFIX = 'teleport-target-'

const mountedDivClasses = ref(new Set<string>())

export function useAssetDetailSidebarActionbar(uploadKey: UploadQueueKey) {
  const mounted = () => {
    mountedDivClasses.value.add(CLASS_PREFIX + uploadKey)
  }

  const unMounted = () => {
    mountedDivClasses.value.delete(CLASS_PREFIX + uploadKey)
  }

  const canTeleport = computed(() => {
    return mountedDivClasses.value.has(CLASS_PREFIX + uploadKey)
  })

  const divClassName = computed(() => {
    return CLASS_PREFIX + uploadKey
  })

  return {
    divClassName,
    canTeleport,
    mounted,
    unMounted,
  }
}
