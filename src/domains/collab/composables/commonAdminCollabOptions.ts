import { collabOptions } from '@/plugins/pluginOptions'
import { isUndefined } from '@/shared/utils/common'

export { initCommonAdminCollabOptions } from '@/plugins/pluginOptions'

export function useCommonAdminCollabOptions() {
  if (isUndefined(collabOptions.value)) {
    throw new Error("Composable can't be used without properly configured common admin.")
  }

  return {
    collabOptions,
  }
}
