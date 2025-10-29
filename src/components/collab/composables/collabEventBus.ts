import type { EventBusKey } from '@vueuse/core'
import { useEventBus } from '@vueuse/core'
import type { CollabFieldDataEnvelope, CollabRoom, CollabRoomPlainData } from '@/components/collab/types/Collab'

export interface CollabRoomDataChangedEvent {
  room: CollabRoom
  field: string
}

export interface CollabJoinRequestEvent {
  room: CollabRoom
  userId: number
  timestamp: number
}

export interface CollabApprovedJoinRequestEvent {
  room: CollabRoom
}

export interface CollabRejectedJoinRequestEvent {
  room: CollabRoom
}

export interface CollabStartingEvent {
  room: CollabRoom
  startedCallback: (data: CollabRoomPlainData) => void
}

export interface CollabGatheringBufferDataEvent {
  room: CollabRoom
}

export interface CollabRequestToTakeModerationEvent {
  room: CollabRoom
  userId: number
  timestamp: number
}

export interface CollabApprovedRequestToTakeModerationEvent {
  room: CollabRoom
}

export interface CollabRejectedRequestToTakeModerationEvent {
  room: CollabRoom
}

export interface CollabKickedFromRoomEvent {
  room: CollabRoom
}

export interface CollabPurgeRoomEvent {
  room: CollabRoom
}

export const collabRoomDataChangedEventBusKey: EventBusKey<CollabRoomDataChangedEvent> =
  Symbol('anzu:collabRoomDataChanged')

export const collabReconnectEventBusKey: EventBusKey<'reconnect'> = Symbol('anzu:collabReconnect')

export const collabStartingEventBusKey: EventBusKey<CollabStartingEvent> = Symbol('anzu:collabStarting')

export const collabGatheringBufferDataEventBusKey: EventBusKey<CollabGatheringBufferDataEvent> = Symbol(
  'anzu:collabGatheringBufferData'
)

export const collabApprovedJoinRequestEventBusKey: EventBusKey<CollabApprovedJoinRequestEvent> = Symbol(
  'anzu:collabApprovedJoinRequest'
)

export const collabRejectedJoinRequestEventBusKey: EventBusKey<CollabRejectedJoinRequestEvent> = Symbol(
  'anzu:collabRejectedJoinRequest'
)

export const collabJoinRequestEventBusKey: EventBusKey<CollabJoinRequestEvent> = Symbol('anzu:collabJoinRequest')

export const collabApprovedRequestToTakeModerationEventBusKey: EventBusKey<CollabApprovedRequestToTakeModerationEvent> =
  Symbol('anzu:collabApprovedRequestToTakeModeration')

export const collabRejectedRequestToTakeModerationEventBusKey: EventBusKey<CollabRejectedRequestToTakeModerationEvent> =
  Symbol('anzu:collabRejectedRequestToTakeModeration')

export const collabRequestToTakeModerationEventBusKey: EventBusKey<CollabRequestToTakeModerationEvent> = Symbol(
  'anzu:collabRequestToTakeModeration'
)

export const collabKickedFromRoomEventBusKey: EventBusKey<CollabKickedFromRoomEvent> =
  Symbol('anzu:collabKickedFromRoom')

export const collabPurgeRoomEventBusKey: EventBusKey<CollabPurgeRoomEvent> =
  Symbol('anzu:collabPurgeRoom')

export function useCollabRoomDataChangeEventBus() {
  return useEventBus<CollabRoomDataChangedEvent, CollabFieldDataEnvelope>(collabRoomDataChangedEventBusKey)
}

export function useCollabReconnectEventBus() {
  return useEventBus(collabReconnectEventBusKey)
}

export function useCollabStartingEventBus() {
  return useEventBus<CollabStartingEvent, { startedCallback: (data: CollabRoomPlainData) => void }>(
    collabStartingEventBusKey
  )
}

export function useCollabGatheringBufferDataEventBus() {
  return useEventBus<CollabGatheringBufferDataEvent>(collabGatheringBufferDataEventBusKey)
}

export function useCollabApprovedJoinRequestEventBus() {
  return useEventBus<CollabApprovedJoinRequestEvent>(collabApprovedJoinRequestEventBusKey)
}

export function useCollabRejectedJoinRequestEventBus() {
  return useEventBus<CollabRejectedJoinRequestEvent>(collabRejectedJoinRequestEventBusKey)
}

export function useCollabJoinRequestEventBus() {
  return useEventBus<CollabJoinRequestEvent>(collabJoinRequestEventBusKey)
}

export function useCollabApprovedRequestToTakeModerationEventBus() {
  return useEventBus<CollabApprovedRequestToTakeModerationEvent>(collabApprovedRequestToTakeModerationEventBusKey)
}

export function useCollabRejectedRequestToTakeModerationEventBus() {
  return useEventBus<CollabRejectedRequestToTakeModerationEvent>(collabRejectedRequestToTakeModerationEventBusKey)
}

export function useCollabRequestToTakeModerationEventBus() {
  return useEventBus<CollabRequestToTakeModerationEvent>(collabRequestToTakeModerationEventBusKey)
}

export function useCollabKickedFromRoomEventBus() {
  return useEventBus<CollabKickedFromRoomEvent>(collabKickedFromRoomEventBusKey)
}

export function useCollabPurgeRoomEventBus() {
  return useEventBus<CollabPurgeRoomEvent>(collabPurgeRoomEventBusKey)
}

export const CollabFieldLockType = {
  Acquire: 'acquire',
  Release: 'release',
} as const
export type CollabFieldLockTypeType = (typeof CollabFieldLockType)[keyof typeof CollabFieldLockType]

export const CollabFieldLockStatus = {
  Success: 'success',
  Failure: 'failure',
} as const
export type CollabFieldLockStatusType = (typeof CollabFieldLockStatus)[keyof typeof CollabFieldLockStatus]

export interface CollabFieldLockStatusPayload {
  type: CollabFieldLockTypeType
  status: CollabFieldLockStatusType
}

export const createFieldLockStatusPayload = (
  type: CollabFieldLockTypeType,
  status: CollabFieldLockStatusType
): CollabFieldLockStatusPayload => ({
  type,
  status,
})

export interface CollabFieldLockStatusEvent {
  room: CollabRoom
  field: string
}

export const collabFieldLockStatusEventBusKey: EventBusKey<CollabFieldLockStatusEvent> =
  Symbol('anzu:collabFieldLockStatus')

export function useCollabFieldLockStatusEventBus() {
  return useEventBus<CollabFieldLockStatusEvent, CollabFieldLockStatusPayload>(collabFieldLockStatusEventBusKey)
}
