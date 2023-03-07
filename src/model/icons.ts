import type { Immutable } from '@/utils/object'
import { objectDeepFreeze } from '@/utils/object'

const icons = {
  CHIP_LINK: 'eye-arrow-right-outline',
  CHIP_LINK_EXTERNAL: 'mdi-open-in-new',
}

export const ICON: Immutable<typeof icons> = objectDeepFreeze(icons)
