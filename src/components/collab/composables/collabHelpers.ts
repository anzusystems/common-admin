import type { CollabRoom } from '@/components/collab/types/Collab'
import type { CollabFieldName } from '@/components/collab/types/Collab'
import type { DocId, IntegerId } from '@/types/common'
import type { CachedItem } from '@/composables/system/defineCached'
import type { AnzuUserMinimal } from '@/types/AnzuUser'
import { useCommonAdminCollabOptions } from '@/components/collab/composables/commonAdminCollabOptions'

export const COLLAB_FIELD_PREFIX_EMBED = 'embed:'
export const COLLAB_FIELD_PREFIX_COMMENT = 'comment:'

export type CollabCachedUsersMap = Map<IntegerId, CachedItem<AnzuUserMinimal>>

export function useCollabHelpers() {
  const { collabOptions } = useCommonAdminCollabOptions()

  const createCollabRoom = (id: IntegerId | DocId, entity: string, system: string) => {
    return (system + ':' + entity + ':' + id) as CollabRoom
  }

  const createCollabFieldConfig = (name: CollabFieldName, room: CollabRoom, cachedUsers: CollabCachedUsersMap ) => {
    return { room, field: name, enabled: collabOptions.value.enabled, cachedUsers }
  }

  const createCollabCommandConfig = (name: CollabFieldName, room: CollabRoom, cachedUsers: CollabCachedUsersMap) => {
    return { room, field: name, enabled: collabOptions.value.enabled, cachedUsers }
  }

  const createCollabEmbedFieldName = (id: DocId) => {
    return COLLAB_FIELD_PREFIX_EMBED + id as CollabFieldName
  }

  const createCollabCommentFieldName = (id: DocId) => {
    return COLLAB_FIELD_PREFIX_COMMENT + id as CollabFieldName
  }

  return {
    createCollabRoom,
    createCollabFieldConfig,
    createCollabCommandConfig,
    createCollabEmbedFieldName,
    createCollabCommentFieldName,
  }
}
