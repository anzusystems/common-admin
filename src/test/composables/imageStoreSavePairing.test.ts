import { describe, expect, it } from 'vitest'
import { keepSentDamCredit } from '@/components/damImage/uploadQueue/composables/imageStore'
import type { ImageStoreItem } from '@/types/ImageAware'

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
