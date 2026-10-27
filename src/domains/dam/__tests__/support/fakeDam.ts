import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import { type AssetDetailItemDto, DamAssetStatus, DamAssetType } from '@/domains/dam/types/Asset'
import {
  AssetFileFailReason,
  type AssetFileFailReasonType,
  type AssetFileImage,
  type AssetFileLink,
  type AssetFileLinks,
  AssetFileProcessStatus,
  type AssetFileProcessStatusType,
} from '@/domains/dam/types/AssetFile'
import type { DocId } from '@/shared/types/common'

// The DAM as the upload sees it from the browser: the axios client an application passes in its options.
// Nothing of the library is replaced. Tests built on this only hold requests and answer them.

export type FakeDamMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export interface FakeDamRequest {
  method: FakeDamMethod
  url: string
  data: unknown
  config: AxiosRequestConfig
}

export interface FakeDamAnswer {
  status: number
  /**
   * Goes to the library as JSON carries it (`copyOf`): reactive values as at the answer, no
   * `undefined` fields or functions, a `Date` as text, and one object referenced twice as two.
   */
  data?: unknown
}

/** Answers a request, or returns `undefined` to leave it to later rules and the DAM's own answers. */
export type FakeDamRule = (
  request: FakeDamRequest
) => FakeDamAnswer | Promise<FakeDamAnswer> | undefined | Promise<undefined>

export interface FakeDamEndPoints {
  asset: string
  image: string
}

const TIMESTAMP = '2026-10-07T10:00:00.000000Z'

export const damImageFile = (
  id: DocId,
  asset: DocId,
  status: AssetFileProcessStatusType,
  parts: Partial<AssetFileImage> = {}
): AssetFileImage => ({
  id,
  asset,
  fileAttributes: {
    status,
    mimeType: 'image/jpeg',
    size: 3000,
    originFileName: 'photo.jpg',
    originUrl: '',
    failReason: AssetFileFailReason.None,
  },
  imageAttributes: {
    ratioWidth: 16,
    ratioHeight: 9,
    width: 1600,
    height: 900,
    rotation: 0,
    mostDominantColor: '#cccccc',
    animated: false,
  },
  originAssetFile: null,
  links: {},
  metadata: {
    exifData: [],
    id: `metadata-${id}`,
    createdAt: TIMESTAMP,
    modifiedAt: TIMESTAMP,
    createdBy: 1,
    modifiedBy: 1,
  },
  manipulatedAt: TIMESTAMP,
  flags: { public: true, singleUse: false, overrideInternal: false, internal: false },
  createdAt: TIMESTAMP,
  modifiedAt: TIMESTAMP,
  createdBy: 1,
  modifiedBy: 1,
  _resourceName: 'imageFile',
  ...parts,
})

const link = (file: DocId, name: string): AssetFileLink => ({
  width: 1600,
  height: 900,
  requestedWidth: 1600,
  requestedHeight: 900,
  url: `https://image.test/${file}/${name}.jpg`,
  title: name,
  type: 'image',
})

export const damImageLinks = (file: DocId): AssetFileLinks => ({
  image_list: link(file, 'list'),
  image_table: link(file, 'table'),
  image_detail: link(file, 'detail'),
  image_animated: link(file, 'animated'),
  audio: link(file, 'audio'),
})

export const damAsset = (id: DocId, parts: Partial<AssetDetailItemDto> = {}): AssetDetailItemDto => ({
  id,
  texts: { displayTitle: '' },
  attributes: { assetType: DamAssetType.Image, assetStatus: DamAssetStatus.WithFile },
  flags: { described: false, visible: true },
  licence: 1,
  mainFile: null,
  keywords: [],
  authors: [],
  podcasts: [],
  metadata: { authorSuggestions: {}, keywordSuggestions: {}, customData: {} },
  siblingToAsset: null,
  distributionCategory: null,
  assetFileProperties: { distributesInServices: [], slotNames: [], fromRss: false, width: 1600, height: 900 },
  mainFileSingleUse: null,
  mainFileInternal: null,
  mainFileOverrideInternal: null,
  createdAt: TIMESTAMP,
  modifiedAt: TIMESTAMP,
  createdBy: 1,
  modifiedBy: 1,
  _resourceName: 'asset',
  _system: 'coreDam',
  ...parts,
})

export const damAssetWithFile = (
  id: DocId,
  file: DocId,
  status: AssetFileProcessStatusType,
  parts: Partial<AssetDetailItemDto> = {},
  fileParts: Partial<AssetFileImage> = {}
): AssetDetailItemDto => damAsset(id, { mainFile: damImageFile(file, id, status, fileParts), ...parts })

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const settled = (status: number) => status >= 200 && status < 300

/**
 * What goes over the wire is a copy. A JSON text is a copy already, a form is copied field by field.
 * Anything else goes through JSON and back. `structuredClone` refuses a Vue proxy a test may answer
 * with, and it keeps two entries pointing to one object as one object, which no DAM answer does.
 */
const copyOf = (data: unknown): unknown => {
  if (data === undefined || data === null || typeof data === 'string') return data
  if (data instanceof FormData) {
    const copy = new FormData()
    data.forEach((value, name) => copy.append(name, value))
    return copy
  }
  return JSON.parse(JSON.stringify(data)) as unknown
}

export function createFakeDam(endPoints: FakeDamEndPoints) {
  const requests: FakeDamRequest[] = []
  const unanswered: FakeDamRequest[] = []
  const rules: FakeDamRule[] = []
  const assets = new Map<DocId, AssetDetailItemDto>()
  let started = 0

  const image = escape(endPoints.image)
  const asset = escape(endPoints.asset)
  const routes = {
    start: new RegExp(`^${image}/licence/(\\d+)$`),
    chunk: new RegExp(`^${image}/([^/]+)/chunk$`),
    finish: new RegExp(`^${image}/([^/]+)/uploaded$`),
    byFile: new RegExp(`^${asset}/asset-file/([^/]+)$`),
    byIds: new RegExp(`^${asset}/licence/(\\d+)/ids/([^/]*)$`),
    bulkMetadata: new RegExp(`^${asset}/metadata-bulk-update$`),
    one: new RegExp(`^${asset}/([^/?]+)$`),
  }

  const own = (request: FakeDamRequest): FakeDamAnswer | undefined => {
    const { method, url } = request
    let match: RegExpMatchArray | null
    if (method === 'POST' && (match = url.match(routes.start))) {
      started++
      const created = { id: `file-${started}`, asset: `asset-${started}` }
      assets.set(
        created.asset,
        damAssetWithFile(created.asset, created.id, AssetFileProcessStatus.Uploading, {
          licence: Number(match[1]),
          attributes: { assetType: DamAssetType.Image, assetStatus: DamAssetStatus.Draft },
        })
      )
      return { status: 201, data: created }
    }
    if (method === 'POST' && routes.chunk.test(url)) return { status: 201, data: {} }
    if (method === 'PATCH' && (match = url.match(routes.finish))) {
      const file = match[1]
      const finished = [...assets.values()].find((one) => one.mainFile?.id === file)
      // All chunks are in. Later changes the server made to the file status are not reverted.
      if (finished?.mainFile?.fileAttributes.status === AssetFileProcessStatus.Uploading) {
        finished.mainFile.fileAttributes.status = AssetFileProcessStatus.Uploaded
      }
      return { status: 200, data: finished?.mainFile ?? {} }
    }
    if (method === 'PATCH' && routes.bulkMetadata.test(url)) {
      return { status: 200, data: JSON.parse(request.data as string) }
    }
    if (method !== 'GET') return undefined
    if ((match = url.match(routes.byFile))) {
      const file = match[1]
      const found = [...assets.values()].find((one) => one.mainFile?.id === file)
      return found ? { status: 200, data: found } : { status: 404 }
    }
    if ((match = url.match(routes.byIds))) {
      // Reads are scoped to the licence in the URL, as in the DAM. An asset of another licence is not found.
      const licence = Number(match[1])
      const found = match[2]!
        .split(',')
        .map((id) => assets.get(id))
        .filter((one) => one !== undefined && one.licence === licence)
      return { status: 200, data: { data: found, totalCount: found.length } }
    }
    if ((match = url.match(routes.one))) {
      const found = assets.get(match[1]!)
      return found ? { status: 200, data: found } : { status: 404 }
    }
    return undefined
  }

  const answer = async (request: FakeDamRequest) => {
    for (const rule of rules) {
      const ruled = await rule(request)
      if (ruled) return ruled
    }
    const answered = own(request)
    if (answered) return answered
    unanswered.push(request)
    return { status: 404 }
  }

  const respond = (method: FakeDamMethod, url: string, data: unknown, config: AxiosRequestConfig = {}) => {
    const request: FakeDamRequest = { method, url, data: copyOf(data), config }
    const sent = { ...config, method, url, data }
    const signal = config.signal as AbortSignal | undefined
    const cancelledError = () => new axios.CanceledError(undefined, undefined, sent as never)
    // As axios does: a request dispatched on an aborted signal rejects before it goes out.
    if (signal?.aborted) return Promise.reject(cancelledError())
    requests.push(request)
    // A request whose signal aborts in flight rejects as cancelled, answered or not.
    const cancelled = new Promise<never>((_, reject) => {
      signal?.addEventListener('abort', () => reject(cancelledError()))
    })
    // Every answer is copied, so none hands out an asset the DAM holds.
    const answered = answer(request).then((one) => {
      const response = { status: one.status, statusText: '', data: copyOf(one.data), headers: {}, config: sent }
      // As axios settles an answer: by the `validateStatus` of the request, where it has one.
      if ((config.validateStatus ?? settled)(one.status)) return response
      throw new axios.AxiosError(
        `Request failed with status code ${one.status}`,
        one.status >= 500 ? axios.AxiosError.ERR_BAD_RESPONSE : axios.AxiosError.ERR_BAD_REQUEST,
        sent as never,
        undefined,
        response as never
      )
    })
    // The loser of the race must not surface as an unhandled rejection.
    cancelled.catch(() => undefined)
    answered.catch(() => undefined)
    return Promise.race([answered, cancelled])
  }

  const instance = {
    defaults: { headers: {} },
    getUri: (config: AxiosRequestConfig = {}) => config.url ?? '',
    request: (config: AxiosRequestConfig) =>
      respond((config.method ?? 'GET').toUpperCase() as FakeDamMethod, config.url ?? '', config.data, config),
    get: (url: string, config?: AxiosRequestConfig) => respond('GET', url, undefined, config),
    delete: (url: string, config?: AxiosRequestConfig) => respond('DELETE', url, undefined, config),
    post: (url: string, data?: unknown, config?: AxiosRequestConfig) => respond('POST', url, data, config),
    patch: (url: string, data?: unknown, config?: AxiosRequestConfig) => respond('PATCH', url, data, config),
    put: (url: string, data?: unknown, config?: AxiosRequestConfig) => respond('PUT', url, data, config),
  } as unknown as AxiosInstance

  const sentTo = (method: FakeDamMethod, route: RegExp) =>
    requests.filter((request) => request.method === method && route.test(request.url))

  return {
    endPoints,
    client: () => instance,
    requests,
    unanswered,
    assets,
    reply: (rule: FakeDamRule) => {
      rules.unshift(rule)
      return () => {
        const index = rules.indexOf(rule)
        if (index >= 0) rules.splice(index, 1)
      }
    },
    hold: (method: FakeDamMethod, route: RegExp) => {
      const waiting: Array<{ request: FakeDamRequest; release: (given?: FakeDamAnswer) => void }> = []
      const holds: FakeDamRule = (request) => {
        if (request.method !== method || !route.test(request.url)) return undefined
        return new Promise<FakeDamAnswer>((resolve) => {
          const held = {
            request,
            release: (given?: FakeDamAnswer) => {
              const index = waiting.indexOf(held)
              if (index >= 0) waiting.splice(index, 1)
              resolve(given ?? own(request) ?? { status: 404 })
            },
          }
          waiting.push(held)
          const signal = request.config.signal as AbortSignal | undefined
          signal?.addEventListener('abort', () => {
            const index = waiting.indexOf(held)
            if (index >= 0) waiting.splice(index, 1)
          })
        })
      }
      rules.unshift(holds)
      return {
        waiting,
        release: (given?: FakeDamAnswer) => [...waiting].forEach((held) => held.release(given)),
        stop: () => {
          const index = rules.indexOf(holds)
          if (index >= 0) rules.splice(index, 1)
        },
      }
    },
    /**
     * Sets the file of an asset as the DAM reports it from now on. Returns
     * a copy, as a read would. Further changes go through `assets`.
     */
    fileBecomes: (
      id: DocId,
      status: AssetFileProcessStatusType,
      parts: Partial<AssetDetailItemDto> = {},
      fileParts: Partial<AssetFileImage> & { failReason?: AssetFileFailReasonType } = {}
    ) => {
      const current = assets.get(id)
      const { failReason, ...restOfFile } = fileParts
      const file = current?.mainFile?.id ?? `file-of-${id}`
      const next = damAssetWithFile(id, file, status, { licence: current?.licence ?? 1, ...parts }, restOfFile)
      if (failReason && next.mainFile) next.mainFile.fileAttributes.failReason = failReason
      assets.set(id, next)
      return copyOf(next) as AssetDetailItemDto
    },
    routes,
    sentTo,
    assetReads: () => [...sentTo('GET', routes.one), ...sentTo('GET', routes.byIds)],
    originReads: () => sentTo('GET', routes.byFile),
    /**
     * The name of the picked file a chunk request carries. Two files
     * are sent side by side, so tests must not assume which asks first.
     */
    chunkOf: (request: FakeDamRequest) => ((request.data as FormData).get('file') as File).name,
    body: (request: FakeDamRequest) => JSON.parse(request.data as string) as unknown,
  }
}

export type FakeDam = ReturnType<typeof createFakeDam>
