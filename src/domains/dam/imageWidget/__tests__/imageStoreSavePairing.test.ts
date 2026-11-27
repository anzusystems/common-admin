import { describe, expect, it } from 'vitest'
import { keepSentDamCredit } from '@/domains/dam/imageWidget/store/imageStore'
import type { ImageStoreItem } from '@/domains/dam/types/ImageAware'

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
  it('keeps authors, sources and asset id of the sent row for the same file', () => {
    const sent = item('file-1', { damAuthors: ['a1'], damSources: ['s1'], assetId: 'asset-1' })

    const result = keepSentDamCredit(item('file-1'), sent)

    expect(result.damAuthors).toEqual(['a1'])
    expect(result.damSources).toEqual(['s1'])
    expect(result.assetId).toBe('asset-1')
    expect(result.showDamAuthors).toBe(false)
  })

  // The take over gave the image a copy, another asset: the picked one would take a later pick that belongs to it.
  it('keeps the credit but not the asset of a row whose photo the save took over', () => {
    const sent = item('file-1', { damAuthors: ['a1'], damSources: ['s1'], assetId: 'asset-1', showDamAuthors: true })
    const saved = item('taken-over-file')

    const result = keepSentDamCredit(saved, sent)

    expect(result.dam.damId).toBe('taken-over-file')
    expect(result.damAuthors).toEqual(['a1'])
    expect(result.damSources).toEqual(['s1'])
    expect(result.assetId).toBeUndefined()
    expect(result.showDamAuthors).toBe(false)
  })

  it('offers the pick again only where the sent row offered it and it had no credit', () => {
    expect(keepSentDamCredit(item('a'), item('a', { showDamAuthors: true, assetId: 'asset-a' })).showDamAuthors).toBe(
      true
    )
    expect(keepSentDamCredit(item('a'), item('a', { showDamAuthors: false })).showDamAuthors).toBe(false)
    expect(keepSentDamCredit(item('a'), item('a', { showDamAuthors: true, damAuthors: ['a1'] })).showDamAuthors).toBe(
      false
    )
  })
})
