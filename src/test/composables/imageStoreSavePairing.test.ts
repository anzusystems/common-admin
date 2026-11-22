import { describe, expect, it } from 'vitest'
import {
  buildImageDamRef,
  keepSentDamCredit,
} from '@/components/damImage/uploadQueue/composables/imageStore'
import type { ImageStoreItem } from '@/types/ImageAware'
import type { AssetSearchListItemDto } from '@/types/coreDam/Asset'

const asset = (licence: number) =>
  ({
    id: 'asset-1',
    licence,
    mainFile: { id: 'file-1' },
    mainFileInternal: false,
  }) as unknown as AssetSearchListItemDto

const item = (damId: string, partial: Partial<ImageStoreItem> = {}) =>
  ({
    key: damId,
    dam: { damId },
    damAuthors: [],
    showDamAuthors: false,
    damSources: [],
    assetId: undefined,
    ...partial,
  }) as unknown as ImageStoreItem

describe('keepSentDamCredit', () => {
  it('keeps authors, sources and asset id of the sent item when the server returns another damId', () => {
    const sent = item('file-1', { damAuthors: ['a1'], damSources: ['s1'], assetId: 'asset-1' })
    const saved = item('taken-over-file')

    const result = keepSentDamCredit(saved, sent)

    expect(result.dam.damId).toBe('taken-over-file')
    expect(result.damAuthors).toEqual(['a1'])
    expect(result.damSources).toEqual(['s1'])
    expect(result.assetId).toBe('asset-1')
    expect(result.showDamAuthors).toBe(false)
  })

  it('offers the authors again when the sent item had no credit', () => {
    expect(keepSentDamCredit(item('b'), item('a')).showDamAuthors).toBe(true)
  })
})

describe('buildImageDamRef', () => {
  it.each([
    ['switch on, foreign licence', true, 5, true],
    ['switch off, foreign licence', false, 5, false],
    ['switch on, upload licence', true, 1, false],
  ])('sets forceTakeOver for %s', (_name, forceTakeOver, assetLicence, expected) => {
    const dam = buildImageDamRef(asset(assetLicence), 1, forceTakeOver)

    expect(dam.forceTakeOver).toBe(expected)
    expect(dam).toMatchObject({ damId: 'file-1', licenceId: assetLicence, uploadLicenceId: 1 })
  })
})
