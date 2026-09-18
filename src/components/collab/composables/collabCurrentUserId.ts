import { ref } from 'vue'
import type { IntegerIdNullable } from '@/types/common'

const currentUserId = ref<IntegerIdNullable>(null)

export function useCollabCurrentUserId() {
  function setCollabUserCurrentId(value: IntegerIdNullable) {
    currentUserId.value = value
  }

  return {
    setCollabUserCurrentId,
    currentUserId,
  }
}
