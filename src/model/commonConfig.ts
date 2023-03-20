import type { Immutable } from '@/utils/object'
import { objectDeepFreeze } from '@/utils/object'

const commonConfig = {
  CHIP: {
    CLASS: {
      NO_LINK: 'v-chip-custom-no-link'
    },
    ICON: {
      LINK: 'mdi-arrow-top-right',
      LINK_EXTERNAL: 'mdi-open-in-new',
    }
  }
}

export const COMMON_CONFIG: Immutable<typeof commonConfig> = objectDeepFreeze(commonConfig)
