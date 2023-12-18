import { ref } from 'vue'
import type { CommonAdminCollabOptions } from '@/AnzuSystemsCommonAdmin'
import { isUndefined } from '@/utils/common'

const collabOptions = ref<CommonAdminCollabOptions>(undefined)

export function initCommonAdminCollabOptions(data: CommonAdminCollabOptions) {
  collabOptions.value = data
}

export function useCommonAdminCollabOptions() {
  if (isUndefined(collabOptions.value)) {
    throw new Error("Composable can't be used without properly configured common admin.")
  }

  return {
    enabled: collabOptions.value.enabled,
    socketUrl: collabOptions.value.socketUrl,
  }
}
