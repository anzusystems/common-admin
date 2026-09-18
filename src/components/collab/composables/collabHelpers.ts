import type { CollabFieldName, CollabRoom } from '@/components/collab/types/Collab'
import type { DocId, IntegerId } from '@/types/common'
import type { CachedItem } from '@/composables/system/defineCached'
import type { AnzuUserMinimal } from '@/types/AnzuUser'

export const COLLAB_FIELD_PREFIX_EMBED = 'embed:'
export const COLLAB_FIELD_PREFIX_COMMENT = 'comment:'

export type CollabCachedUsersMap = Map<IntegerId, CachedItem<AnzuUserMinimal>>

export function useCollabHelpers() {
  const createCollabRoom = (id: IntegerId | DocId, entity: string, system: string) => {
    return (system + ':' + entity + ':' + id) as CollabRoom
  }

  const createCollabFieldConfig = (name: CollabFieldName, room: CollabRoom, cachedUsers: CollabCachedUsersMap) => {
    return { room, field: name, cachedUsers }
  }

  const createCollabEmbedFieldName = (id: DocId) => {
    return (COLLAB_FIELD_PREFIX_EMBED + id) as CollabFieldName
  }

  const createCollabCommentFieldName = (id: DocId) => {
    return (COLLAB_FIELD_PREFIX_COMMENT + id) as CollabFieldName
  }

  return {
    createCollabRoom,
    createCollabFieldConfig,
    createCollabEmbedFieldName,
    createCollabCommentFieldName,
  }
}
