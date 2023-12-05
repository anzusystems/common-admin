import type { AssetMetadataSuggestions } from '@/types/coreDam/Asset'
import { isArray, isEmptyObject } from '@/utils/common'
import type { DocId } from '@/types/common'

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

