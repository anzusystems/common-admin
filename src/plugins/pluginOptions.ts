import { ref } from 'vue'
import type {
  CommonAdminCollabOptions,
  CommonAdminCoreDamOptions,
  CommonAdminImageOptions,
} from '@/AnzuSystemsCommonAdmin'
import { isUndefined } from '@/shared/utils/common'

// Plugin install options. They live here so installing the plugin
// does not load the DAM, image and collab modules that read them.

export const imageOptions = ref<CommonAdminImageOptions>(undefined)

export const coreDamOptions = ref<CommonAdminCoreDamOptions | undefined>(undefined)

export const collabOptions = ref<CommonAdminCollabOptions>({
  enabled: false,
  socketUrl: '',
  beforeReconnect: () => new Promise((resolve) => resolve()),
  io: undefined,
})

export function initCommonAdminImageOptions(data: CommonAdminImageOptions) {
  imageOptions.value = data
}

export function initCommonAdminCoreDamOptions(data: CommonAdminCoreDamOptions) {
  coreDamOptions.value = data
}

export function initCommonAdminCollabOptions(data: CommonAdminCollabOptions | undefined) {
  if (isUndefined(data)) return
  collabOptions.value = data
}
