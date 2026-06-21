import type { ListEditorKey } from '@/labs/listEditor/types/listEditorTypes'

/**
 * Runs `validateAll()` and, on failure, opens each invalid row via `reveal()`
 * so a blocked save shows WHICH rows are wrong (QA 85050 B4-17). Shared by all
 * variants; `reveal` does the per-variant opening (nested also expands ancestors).
 */
export function validateAllAndReveal(
  controller: { validateAll: () => boolean; invalidKeys: { value: Set<ListEditorKey> } },
  reveal: (key: ListEditorKey) => void,
): boolean {
  const valid = controller.validateAll()
  if (!valid) {
    for (const key of controller.invalidKeys.value) reveal(key)
  }
  return valid
}
