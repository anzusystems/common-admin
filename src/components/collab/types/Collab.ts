import type { RouteParams } from 'vue-router'
import type { CollabCachedUsersMap } from '@/components/collab/composables/collabHelpers'

export type CollabUserId = number
export type CollabUserIdNullable = number | null

export type CollabRoom = string

export type CollabComponentConfig =
  | undefined
  | {
      room: CollabRoom
      field: CollabFieldName
      cachedUsers: CollabCachedUsersMap
    }

export const CollabStatus = {
  Inactive: 'inactive',
  Active: 'active',
} as const
export type CollabStatusType = (typeof CollabStatus)[keyof typeof CollabStatus]

export interface CollabRoomInfo {
  name: CollabRoom
  moderator: CollabUserIdNullable
  users: CollabUserId[]
  status: CollabStatusType
}

export interface CollabRoomsInfo extends Record<CollabRoom, CollabRoomInfo> {}

export interface CollabFieldDataEnvelope {
  type: 'scalar' | 'json'
  user: CollabUserId
  value: CollabFieldData
}

export type CollabFieldData = unknown
export type CollabFieldName = string
export type CollabFieldLock = CollabUserIdNullable

export interface CollabRoomLocks extends Record<CollabFieldName, CollabFieldLock> {}

export interface CollabRoomData extends Record<CollabFieldName, CollabFieldDataEnvelope> {}

export interface CollabRoomPlainData extends Record<CollabFieldName, CollabFieldData> {}

export const CollabAccessRoomStatus = {
  Ok: 'ok',
  Occupied: 'occupied',
  Failed: 'failed',
} as const
export type CollabAccessRoomStatusType = (typeof CollabAccessRoomStatus)[keyof typeof CollabAccessRoomStatus]

export interface CollabRoomInfoCallback {
  room: CollabRoomInfo
}

interface CollabAccessRoomCallback {
  status: CollabAccessRoomStatusType
}

export interface CollabSuccessAccessRoomCallback extends CollabAccessRoomCallback, CollabRoomInfoCallback {
  status: typeof CollabAccessRoomStatus.Ok
}

export interface CollabOccupiedAccessRoomCallback extends CollabAccessRoomCallback, CollabRoomInfoCallback {
  status: typeof CollabAccessRoomStatus.Occupied
}

export interface CollabFailedAccessRoomCallback extends CollabAccessRoomCallback {
  status: typeof CollabAccessRoomStatus.Failed
  reason: string
}

export type CollabAccessRoomCallbackTypes =
  | CollabSuccessAccessRoomCallback
  | CollabOccupiedAccessRoomCallback
  | CollabFailedAccessRoomCallback

export function isCollabSuccessAccessRoomCallback(
  callback: CollabAccessRoomCallbackTypes
): callback is CollabSuccessAccessRoomCallback {
  return callback.status === CollabAccessRoomStatus.Ok
}

export function isCollabOccupiedAccessRoomCallback(
  callback: CollabAccessRoomCallbackTypes
): callback is CollabSuccessAccessRoomCallback {
  return callback.status === CollabAccessRoomStatus.Occupied
}

export const CollabChangeRoomLockStatus = {
  Ok: 'ok',
  Failed: 'failed',
} as const
export type CollabChangeRoomLockStatusType =
  (typeof CollabChangeRoomLockStatus)[keyof typeof CollabChangeRoomLockStatus]

export interface CollabRoomLocksInfoCallback {
  locks: CollabRoomLocks
}

interface CollabChangeRoomLocksInfoCallback {
  status: CollabChangeRoomLockStatusType
}

export interface CollabSuccessChangeRoomLockCallback
  extends CollabChangeRoomLocksInfoCallback,
    CollabRoomLocksInfoCallback {
  status: typeof CollabChangeRoomLockStatus.Ok
  locks: CollabRoomLocks
}

export interface CollabFailedChangeRoomLockCallback extends CollabChangeRoomLocksInfoCallback {
  status: typeof CollabChangeRoomLockStatus.Failed
  reason: string
}

export type CollabChangeRoomLockCallbackTypes = CollabSuccessChangeRoomLockCallback | CollabFailedChangeRoomLockCallback

export function isCollabSuccessChangeRoomLockCallback(
  callback: CollabChangeRoomLockCallbackTypes
): callback is CollabSuccessChangeRoomLockCallback {
  return callback.status === CollabChangeRoomLockStatus.Ok
}

export function isCollabFailedChangeRoomLockCallback(
  callback: CollabChangeRoomLockCallbackTypes
): callback is CollabFailedChangeRoomLockCallback {
  return callback.status === CollabChangeRoomLockStatus.Failed
}

export interface CollabFieldLockOptions {
  forceFailure?: boolean
}

export const CollabRoomJoinStrategy = {
  Free: 'free',
  Moderated: 'moderated',
} as const
export type CollabRoomJoinStrategyType = (typeof CollabRoomJoinStrategy)[keyof typeof CollabRoomJoinStrategy]

export interface CollabRoomOptions {
  joinStrategy?: CollabRoomJoinStrategyType
  editors?: CollabFieldName[]
}

export const CollabRequestToTakeModerationStatus = {
  Ok: 'ok',
  AlreadyRequested: 'alreadyRequested',
  Failed: 'failed',
} as const
export type CollabRequestToTakeModerationStatusType =
  (typeof CollabRequestToTakeModerationStatus)[keyof typeof CollabRequestToTakeModerationStatus]

export interface CollabRequestToTakeModerationStatusCallback {
  status: CollabRequestToTakeModerationStatusType
}

export const CollabRequestToJoinStatus = {
  Ok: 'ok',
  AlreadyRequested: 'alreadyRequested',
  Failed: 'failed',
} as const
export type CollabRequestToJoinStatusType = (typeof CollabRequestToJoinStatus)[keyof typeof CollabRequestToJoinStatus]

export interface CollabRequestToJoinStatusCallback {
  status: CollabRequestToJoinStatusType
}

export interface CollabClientToServerEvents {
  subscribeCollabRoomInfo: (room: CollabRoom, callback: (data: CollabRoomInfoCallback) => void) => void
  unsubscribeCollabRoomInfo: (room: CollabRoom, callback: (data: CollabRoomInfoCallback) => void) => void
  joinCollabRoom: (
    room: CollabRoom,
    options: CollabRoomOptions,
    callback: (data: CollabAccessRoomCallbackTypes) => void
  ) => void
  leaveCollabRoom: (room: CollabRoom, callback: (data: CollabAccessRoomCallbackTypes) => void) => void
  acquireFieldLock: (
    room: CollabRoom,
    field: CollabFieldName,
    options: CollabFieldLockOptions,
    callback: (data: CollabChangeRoomLockCallbackTypes) => void
  ) => void
  releaseFieldLock: (
    room: CollabRoom,
    field: CollabFieldName,
    changedData: unknown,
    options: CollabFieldLockOptions,
    callback: (data: CollabChangeRoomLockCallbackTypes) => void
  ) => void
  changeFieldData: (
    room: CollabRoom,
    field: CollabFieldName,
    changedData: unknown,
    callback: (data: CollabChangeRoomLockCallbackTypes) => void
  ) => void
  requestToJoin: (
    room: CollabRoom,
    timestamp: number,
    callback: (data: CollabRequestToJoinStatusCallback) => void
  ) => void
  approveRequestToJoin: (room: CollabRoom, userId: CollabUserId) => void
  rejectRequestToJoin: (room: CollabRoom, userId: CollabUserId) => void
  enteredCollabRoom: (room: CollabRoom) => void
  requestToTakeModeration: (
    room: CollabRoom,
    timestamp: number,
    callback: (data: CollabRequestToTakeModerationStatusCallback) => void
  ) => void
  approveRequestToTakeModeration: (room: CollabRoom) => void
  rejectRequestToTakeModeration: (room: CollabRoom) => void
  kickUserFromRoom: (room: CollabRoom, userId: CollabUserId) => void
  transferModeration: (room: CollabRoom, userId: CollabUserId) => void
  fetchRoomsInfo: (rooms: CollabRoom[], callback: (data: CollabRoomsInfo) => void) => void
}

export interface CollabServerToClientEvents {
  collabRoomChanged: (room: CollabRoomInfo) => void
  collabRoomLocksChanged: (room: CollabRoom, locks: CollabRoomLocks) => void
  collabRoomDataChanged: (room: CollabRoom, data: CollabRoomData) => void
  requestToJoin: (room: CollabRoom, user: CollabUserId, timestamp: number) => void
  approvedRequestToJoin: (room: CollabRoom) => void
  rejectedRequestToJoin: (room: CollabRoom) => void
  startCollab: (room: CollabRoom, callback: (data: CollabRoomPlainData) => void) => void
  requestToTakeModeration: (room: CollabRoom, user: CollabUserId, timestamp: number) => void
  transferredModeration: (room: CollabRoom) => void
  approvedRequestToTakeModeration: (room: CollabRoom) => void
  rejectedRequestToTakeModeration: (room: CollabRoom) => void
  kickedFromRoom: (room: CollabRoom) => void
}

export interface CollabConfig {
  room: CollabRoom
  joinStrategy: CollabRoomJoinStrategyType
  occupiedOrKickedRedirectToRoute: string
  editors: CollabFieldName[]
}
export type CollabRouteMeta = (params: RouteParams) => CollabConfig

export interface CollabDelayedRequest {
  userId: CollabUserId
  timestamp: number
}
