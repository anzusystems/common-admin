import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useImageMassOperations } from '@/components/damImage/uploadQueue/composables/imageMassOperations'
import { useImageStore } from '@/components/damImage/uploadQueue/composables/imageStore'
import type { ImageStoreItem } from '@/types/ImageAware'

const image = (overrides: Partial<ImageStoreItem>): ImageStoreItem => ({
  key: 'image-1',
  texts: { description: '', source: '' },
  dam: { damId: 'dam-1', licenceId: 1, regionPosition: 0, internal: false },
  flags: { showSource: true, internal: false, overrideInternal: false },
  damAuthors: [],
  damSources: [],
  showDamAuthors: true,
  assetId: 'asset-1',
  ...overrides,
})

describe.each([
  { operation: 'replaceEmptyAuthors', field: 'damAuthors' },
  { operation: 'replaceEmptySources', field: 'damSources' },
] as const)('useImageMassOperations $operation', ({ operation, field }) => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const run = (item: ImageStoreItem, forceReplace: boolean) => {
    const imageStore = useImageStore()
    imageStore.setImages([item])
    useImageMassOperations()[operation](['new-1'], forceReplace)
    return imageStore.images[0]
  }

  it('leaves an image without DAM authors untouched even when forced', () => {
    const result = run(image({ showDamAuthors: false, [field]: ['old-1'] }), true)

    expect(result[field]).toEqual(['old-1'])
    expect(result.damSelectionChanged).toBeUndefined()
  })

  it('fills an empty selection and marks it changed', () => {
    const result = run(image({ [field]: [] }), false)

    expect(result[field]).toEqual(['new-1'])
    expect(result.damSelectionChanged).toBe(true)
  })

  it('keeps a filled selection without force', () => {
    const result = run(image({ [field]: ['old-1'] }), false)

    expect(result[field]).toEqual(['old-1'])
    expect(result.damSelectionChanged).toBeUndefined()
  })
})
