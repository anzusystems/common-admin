import type { AssetMetadataSuggestions } from '@/domains/dam/types/Asset'
import { isArray, isEmptyObject } from '@/shared/utils/common'
import type { DocId } from '@/shared/types/common'

export function useAssetSuggestions() {
  const updateNewNames = (suggestions: AssetMetadataSuggestions, newNames: Set<string>) => {
    for (const [key, value] of Object.entries(suggestions)) {
      if (isEmptyObject(value)) {
        newNames.add(key)
      }
    }
  }

  const getAuthorConflicts = (suggestions: AssetMetadataSuggestions) => {
    const conflicts: Array<DocId> = []
    for (const value of Object.values(suggestions)) {
      if (isArray(value) && value.length > 1) {
        value.forEach((id) => {
          conflicts.push(id)
        })
      }
    }
    return conflicts
  }

  return {
    updateNewNames,
    getAuthorConflicts,
  }
}
