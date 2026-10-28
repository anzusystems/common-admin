import type { SYSTEM_CMS } from '@/shared/systems'
import type { DocId, IntegerId } from '@/types/ids'
import type { Ref } from 'vue'

export let id: IntegerId = 1
export let system: typeof SYSTEM_CMS = 'cms'
export type Holder = Ref<DocId>
