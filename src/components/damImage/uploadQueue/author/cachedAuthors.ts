import type { DocId } from '@/types/common'
import { defineCached } from '@/composables/system/defineCached'
import type { DamAuthor, DamAuthorMinimal } from '@/components/damImage/uploadQueue/author/DamAuthor'
import { fetchAuthorListByIds } from '@/components/damImage/uploadQueue/api/authorApi'
import { useDamConfigState } from '@/components/damImage/uploadQueue/composables/damConfigState'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { isNull } from '@/utils/common'

const mapFullToMinimal = (author: DamAuthor): DamAuthorMinimal => ({
  id: author.id,
  name: author.name,
  identifier: author.identifier,
})

const mapIdToMinimal = (id: DocId): DamAuthorMinimal => {
  return { id: id, name: '', identifier: '' }
}

const { cache, toFetch, fetch, add, addManual, addManualMinimal, has, get, isLoaded } = defineCached<
  DocId,
  DamAuthor,
  DamAuthorMinimal
>(mapFullToMinimal, mapIdToMinimal, (ids) => {
  const { initialized } = useDamConfigState()
  if (isNull(initialized.damConfigExtSystem)) {
    throw new Error('Ext system must be initialised.')
  }
  const { damClient } = useCommonAdminCoreDamOptions()
  return fetchAuthorListByIds(damClient, initialized.damConfigExtSystem, ids)
})

export const useDamCachedAuthors = () => {
  return {
    addManualToCachedAuthors: addManual,
    addManualMinimalToCachedAuthors: addManualMinimal,
    addToCachedAuthors: add,
    fetchCachedAuthors: fetch,
    toFetchCachedAuthors: toFetch,
    cachedAuthors: cache,
    hasCachedAuthor: has,
    getCachedAuthor: get,
    isLoadedCachedAuthor: isLoaded,
  }
}

export const useDamCachedAuthorsForRemoteAutocomplete = () => {
  return {
    fetch,
    add,
    addManualMinimal,
  }
}
