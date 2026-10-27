import type { CollabFieldName, CollabRoom } from '@/domains/collab/types/Collab'

// Turn counter for collab field locks taken by image widgets: each request and release by any widget of that field.
// A re-rendered widget (sidebar pin in admin-cms) is a second widget of the same field.
// The server treats both as one editor, so either's release frees the other's lock.
const turns = new Map<string, number>()

const keyOf = (room: CollabRoom, field: CollabFieldName) => JSON.stringify([room, field])

/**
 * Takes a new lock turn for the field and returns its number.
 */
export const takeFieldLockTurn = (room: CollabRoom, field: CollabFieldName) => {
  const turn = (turns.get(keyOf(room, field)) ?? 0) + 1
  turns.set(keyOf(room, field), turn)
  return turn
}

export const lastFieldLockTurn = (room: CollabRoom, field: CollabFieldName) => turns.get(keyOf(room, field)) ?? 0
