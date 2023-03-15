import type { Immutable } from '@/utils/object'
import { objectDeepFreeze } from '@/utils/object'

const commonConfig = {
  BREADCRUMB: {
    DIVIDER: '&raquo;'
  },
  CHIP: {
    ICON: {
      LINK: 'mdi-arrow-top-right',
      LINK_EXTERNAL: 'mdi-open-in-new',
    }
  }
}

export const COMMON_CONFIG: Immutable<typeof commonConfig> = objectDeepFreeze(commonConfig)
