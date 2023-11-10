import type { DocId, DocIdNullable } from '@/types/common'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'

export enum AssetFileProcessStatus {
  Uploading = 'uploading', // file entity created and ready to receive chunks
  Uploaded = 'uploaded', // all chunks were sent
  Stored = 'stored', // File is stored and ready to processing
  Duplicate = 'duplicate', // AssetFile is duplicate of another asset
  Processed = 'processed', // file processed and ready to serve
  Failed = 'failed',
}

export enum AssetFileFailReason {
  None = 'none',
  Unknown = 'unknown',
  InvalidChecksum = 'invalid_checksum',
  InvalidMimeType = 'invalid_mime_type',
  DownloadFailed = 'download_failed',
  InvalidSize = 'invalid_size',
  Default = None,
}

interface FileAttributes {
  status: AssetFileProcessStatus
  mimeType: string
  size: number
  originFileName: string
  originUrl: string
  failReason: AssetFileFailReason
}

export enum AssetFileLinkType {
  Image = 'image',
  Audio = 'audio',
  Default = Image,
}

export interface AssetFileLink {
  width: number
  height: number
  requestedWidth: number
  requestedHeight: number
  url: string
  title: string
  type: AssetFileLinkType
}

export type AssetFileLinks =
  | Record<'image_list' | 'image_table' | 'image_detail' | 'audio', AssetFileLink>
  | Record<string, never>

export interface AssetFileImage extends AnzuUserAndTimeTrackingAware {
  id: DocId
  asset: DocId
  fileAttributes: FileAttributes
  originAssetFile: DocIdNullable
  links?: AssetFileLinks
  _resourceName: 'imageFile'
}

export interface AssetFileAudio extends AnzuUserAndTimeTrackingAware {
  id: DocId
  asset: DocId
  fileAttributes: FileAttributes
  originAssetFile: DocIdNullable
  links?: AssetFileLinks
  _resourceName: 'audioFile'
}

export interface AssetFileVideo extends AnzuUserAndTimeTrackingAware {
  id: DocId
  asset: DocId
  fileAttributes: FileAttributes
  originAssetFile: DocIdNullable
  links?: AssetFileLinks
  _resourceName: 'videoFile'
}

export interface AssetFileDocument extends AnzuUserAndTimeTrackingAware {
  id: DocId
  asset: DocId
  fileAttributes: FileAttributes
  originAssetFile: DocIdNullable
  links?: AssetFileLinks
  _resourceName: 'documentFile'
}

export interface AssetFileDownloadLink extends AnzuUserAndTimeTrackingAware {
  id: DocId
  link: string
  _system: string
  _resourceName: 'imageFile'
}

export type AssetFile = AssetFileImage | AssetFileAudio | AssetFileVideo | AssetFileDocument

export type AssetFileNullable = AssetFileImage | AssetFileAudio | AssetFileVideo | AssetFileDocument | null

export const assetFileIsImageFile = (value: any): value is AssetFileImage => {
  if (!value || !value._resourceName) return false
  return value._resourceName === 'imageFile'
}

export const assetFileIsVideoFile = (value: any): value is AssetFileVideo => {
  if (!value || !value._resourceName) return false
  return value._resourceName === 'videoFile'
}

export const assetFileIsAudioFile = (value: any): value is AssetFileAudio => {
  if (!value || !value._resourceName) return false
  return value._resourceName === 'audioFile'
}

export const assetFileIsDocumentFile = (value: any): value is AssetFileDocument => {
  if (!value || !value._resourceName) return false
  return value._resourceName === 'documentFile'
}
