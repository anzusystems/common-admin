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

export interface ImageFile extends AnzuUserAndTimeTrackingAware {
  id: DocId
  asset: DocId
  fileAttributes: FileAttributes
  originAssetFile: DocIdNullable
  links?: AssetFileLinks
  _resourceName: 'imageFile'
}

export interface AudioFile extends AnzuUserAndTimeTrackingAware {
  id: DocId
  asset: DocId
  fileAttributes: FileAttributes
  originAssetFile: DocIdNullable
  links?: AssetFileLinks
  _resourceName: 'audioFile'
}

export interface VideoFile extends AnzuUserAndTimeTrackingAware {
  id: DocId
  asset: DocId
  fileAttributes: FileAttributes
  originAssetFile: DocIdNullable
  links?: AssetFileLinks
  _resourceName: 'videoFile'
}

export interface DocumentFile extends AnzuUserAndTimeTrackingAware {
  id: DocId
  asset: DocId
  fileAttributes: FileAttributes
  originAssetFile: DocIdNullable
  links?: AssetFileLinks
  _resourceName: 'documentFile'
}

export interface FileDownloadLink extends AnzuUserAndTimeTrackingAware {
  id: DocId
  link: string
  _system: string
  _resourceName: 'imageFile'
}

export type AssetFile = ImageFile | AudioFile | VideoFile | DocumentFile

export type AssetFileNullable = ImageFile | AudioFile | VideoFile | DocumentFile | null

export const isImageFile = (value: any): value is ImageFile => {
  if (!value || !value._resourceName) return false
  return value._resourceName === 'imageFile'
}

export const isVideoFile = (value: any): value is VideoFile => {
  if (!value || !value._resourceName) return false
  return value._resourceName === 'videoFile'
}

export const isAudioFile = (value: any): value is AudioFile => {
  if (!value || !value._resourceName) return false
  return value._resourceName === 'audioFile'
}

export const isDocumentFile = (value: any): value is DocumentFile => {
  if (!value || !value._resourceName) return false
  return value._resourceName === 'documentFile'
}
