import { ref } from 'vue'
import type { IntegerId } from '@/shared/types/common'

const cachedExtSystemId = ref<IntegerId>(0)

export function useExtSystemIdForCached() {
  return {
    cachedExtSystemId,
  }
}
