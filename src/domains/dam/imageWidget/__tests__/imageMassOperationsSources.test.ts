import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useImageMassOperations } from '@/domains/dam/imageWidget/composables/useImageMassOperations'
import { useImageStore } from '@/domains/dam/imageWidget/store/imageStore'
import type { ImageStoreItem } from '@/domains/dam/types/ImageAware'

// Filling sources or authors in the gallery writes the credit of the row's sources and authors into its source.
const fetchAuthorListByIds = vi.hoisted(() => vi.fn())
vi.mock('@/domains/dam/author/api/authorApi', () => ({
  ENTITY: 'author',
  fetchAuthorListByIds,
  useFetchAuthorList: vi.fn(),
  createAuthor: vi.fn(),
}))
vi.mock('@/domains/dam/composables/commonAdminCoreDamOptions', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCommonAdminCoreDamOptions: () => ({ damClient: () => ({}), endPointAuthor: '/adm/v1/author' }),
}))
vi.mock('@/domains/dam/config/composables/damConfigState', () => ({
  useDamConfigState: () => ({
    getDamConfigExtSystem: () => ({
      image: {
        authors: { enabled: true, required: false },
        sources: {
          enabled: true,
          required: false,
          creditFormat: '{sources}/{authors}',
          creditSourcesSeparator: '/',
          creditAuthorsSeparator: ', ',
        },
      },
    }),
  }),
}))

const named = (id: string, hiddenInCredit = false) => ({ id, name: id.toUpperCase(), flags: { hiddenInCredit } })

const row = (overrides: Partial<ImageStoreItem>): ImageStoreItem => ({
  key: 'k1',
  texts: { description: '', source: '' },
  flags: { showSource: true, internal: false, overrideInternal: false },
  dam: { damId: 'file-1', licenceId: 1, regionPosition: 0, internal: false },
  position: 1,
  damAuthors: [],
  damSources: [],
  showDamAuthors: true,
  assetId: 'asset-1',
  ...overrides,
})

beforeEach(() => {
  setActivePinia(createPinia())
  fetchAuthorListByIds.mockReset()
  fetchAuthorListByIds.mockImplementation(async (_client, _endPoint, _extSystem, ids: string[]) =>
    ids.map((id) => named(id))
  )
})

describe('useImageMassOperations sources', () => {
  it('fills the sources and writes the credit of the row sources and authors', async () => {
    const store = useImageStore()
    store.setImages([row({ damAuthors: ['jane'] })])
    await useImageMassOperations('default').replaceEmptySources(['tasr'])
    expect(store.images[0]!.damSources).toEqual(['tasr'])
    expect(store.images[0]!.texts.source).toBe('TASR/JANE')
  })

  it('fills both at once on the rows either alone would fill', async () => {
    const store = useImageStore()
    store.setImages([row({ showDamAuthors: false })])
    await useImageMassOperations('default').replaceEmptySelections({ damSources: ['tasr'], damAuthors: ['jane'] })
    expect(store.images[0]!.damSources).toEqual(['tasr'])
    expect(store.images[0]!.damAuthors).toEqual(['jane'])
    expect(store.images[0]!.texts.source).toBe('TASR/JANE')
  })

  it('keeps the sources of a row when filling only empty ones', async () => {
    const store = useImageStore()
    store.setImages([row({ damSources: ['sita'] })])
    await useImageMassOperations('default').replaceEmptySources(['tasr'])
    expect(store.images[0]!.damSources).toEqual(['sita'])
    expect(store.images[0]!.texts.source).toBe('')
  })

  it('keeps the names of both in the credit when a second fill is pressed while the first loads names', async () => {
    const store = useImageStore()
    store.setImages([row({})])
    const operations = useImageMassOperations('default')
    await Promise.all([operations.replaceEmptySources(['tasr']), operations.replaceEmptyAuthors(['jane'])])
    expect(store.images[0]!.damSources).toEqual(['tasr'])
    expect(store.images[0]!.damAuthors).toEqual(['jane'])
    expect(store.images[0]!.texts.source).toBe('TASR/JANE')
  })

  it('leaves out names hidden in credit', async () => {
    fetchAuthorListByIds.mockImplementation(async (_client, _endPoint, _extSystem, ids: string[]) =>
      ids.map((id) => named(id, id === 'tasr'))
    )
    const store = useImageStore()
    store.setImages([row({ damAuthors: ['jane'] })])
    await useImageMassOperations('default').replaceEmptySources(['tasr'])
    expect(store.images[0]!.texts.source).toBe('JANE')
  })
})
