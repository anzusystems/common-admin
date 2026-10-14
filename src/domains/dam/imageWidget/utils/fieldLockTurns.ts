import type { CollabFieldName, CollabRoom } from '@/domains/collab/types/Collab'

// The turns of the lock of a field of a collaboration room that the image widgets of the page take: each request for
// the lock and each release, by any widget of that field. A widget drawn again elsewhere (the pin of a sidebar widget
// in admin-cms) is a second widget of the same field, and the server takes the requests and the releases of both as
// those of one editor: a release of either frees a lock the other holds.
const turns = new Map<string, number>()

const keyOf = (room: CollabRoom, field: CollabFieldName) => JSON.stringify([room, field])

/** A turn of the lock of the field is taken: its number. */
export const takeFieldLockTurn = (room: CollabRoom, field: CollabFieldName) => {
  const turn = (turns.get(keyOf(room, field)) ?? 0) + 1
  turns.set(keyOf(room, field), turn)
  return turn
}

/** The number of the last turn of the lock of the field. */
export const lastFieldLockTurn = (room: CollabRoom, field: CollabFieldName) => turns.get(keyOf(room, field)) ?? 0
