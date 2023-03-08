import type { Immutable } from '@/utils/object'
import { objectDeepFreeze } from '@/utils/object'

const icons = {
  CHIP_LINK: 'mdi-arrow-top-right',
  CHIP_LINK_EXTERNAL: 'mdi-open-in-new',
}

export const ICON: Immutable<typeof icons> = objectDeepFreeze(icons)
