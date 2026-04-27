import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { ListEditorKey } from '@/labs/listEditor/types/listEditorTypes'

export interface KeyboardNavViewItem {
  key: ListEditorKey
  expanded?: boolean
  canExpand?: boolean
  canIndent?: boolean
  canOutdent?: boolean
}

export type KeyboardNavVariant = 'flat' | 'sortable' | 'nested'

export interface KeyboardNavOptions {
  viewItems: ComputedRef<KeyboardNavViewItem[]>
  variant: KeyboardNavVariant
  isReorderMode: Ref<boolean> | ComputedRef<boolean>
  disabled?: Ref<boolean> | ComputedRef<boolean>

  isEditing: (key: ListEditorKey) => boolean

  onToggleEdit?: (key: ListEditorKey) => void
  onCancelEdit?: (key: ListEditorKey) => void

  onMoveUp?: (key: ListEditorKey) => void
  onMoveDown?: (key: ListEditorKey) => void
  onMoveTop?: (key: ListEditorKey) => void
  onMoveBottom?: (key: ListEditorKey) => void

  onIndent?: (key: ListEditorKey) => void
  onOutdent?: (key: ListEditorKey) => void
  onToggleChildren?: (key: ListEditorKey, expand: boolean) => void

  onCancelReorder?: () => void
}

export interface KeyboardNavApi {
  focusedKey: Ref<ListEditorKey | null>
  grabbedKey: Ref<ListEditorKey | null>
  isFocused: (key: ListEditorKey) => boolean
  isGrabbed: (key: ListEditorKey) => boolean
  rowTabindex: (key: ListEditorKey) => number
  setFocus: (key: ListEditorKey | null) => void
  releaseGrab: () => void
  handleKeydown: (key: ListEditorKey, e: KeyboardEvent) => void
}

// Roving tabindex + keyboard navigation for list-editor rows. Single tabstop
// per editor; arrow keys move an internal pointer; reorder mode adds a "grab"
// state where Enter/Space picks up the focused row and arrows move it.
export function useKeyboardNav(options: KeyboardNavOptions): KeyboardNavApi {
  const focusedKey = ref<ListEditorKey | null>(null)
  const grabbedKey = ref<ListEditorKey | null>(null)

  const orderedKeys = computed<ListEditorKey[]>(() =>
    options.viewItems.value.map((v) => v.key),
  )

  const isFocused = (key: ListEditorKey): boolean => focusedKey.value === key
  const isGrabbed = (key: ListEditorKey): boolean => grabbedKey.value === key

  function rowTabindex(key: ListEditorKey): number {
    const ordered = orderedKeys.value
    if (ordered.length === 0) return -1
    if (focusedKey.value === null) return ordered[0] === key ? 0 : -1
    return focusedKey.value === key ? 0 : -1
  }

  function focusRowElement(key: ListEditorKey | null) {
    if (key === null || typeof document === 'undefined') return
    void Promise.resolve().then(() => {
      const el = document.querySelector<HTMLElement>(
        `[data-id="${CSS.escape(String(key))}"]`,
      )
      el?.focus()
    })
  }

  function setFocus(key: ListEditorKey | null) {
    focusedKey.value = key
    focusRowElement(key)
  }

  function releaseGrab() {
    grabbedKey.value = null
  }

  function isFormField(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null
    return !!el?.matches?.('input, textarea, select, [contenteditable], [contenteditable="true"]')
  }

  function handleKeydown(key: ListEditorKey, e: KeyboardEvent) {
    if (options.disabled?.value) return

    const ordered = orderedKeys.value
    const i = ordered.indexOf(key)
    if (i < 0) return

    const focusedItem = options.viewItems.value[i]
    const inReorder = options.isReorderMode.value
    const isGrabbedNow = grabbedKey.value === key
    const grabbedSomewhere = grabbedKey.value !== null

    // Form fields keep native key behavior (cursor, newlines, selection) for
    // every key except Escape. Esc still closes the edit panel even mid-typing.
    const onFormField = isFormField(e.target)

    switch (e.key) {
      case 'ArrowUp':
        if (onFormField) return
        e.preventDefault()
        if (inReorder && isGrabbedNow) {
          options.onMoveUp?.(key)
        } else if (i > 0) {
          setFocus(ordered[i - 1])
        }
        return

      case 'ArrowDown':
        if (onFormField) return
        e.preventDefault()
        if (inReorder && isGrabbedNow) {
          options.onMoveDown?.(key)
        } else if (i < ordered.length - 1) {
          setFocus(ordered[i + 1])
        }
        return

      case 'Home':
        if (onFormField) return
        e.preventDefault()
        if (inReorder && isGrabbedNow) {
          options.onMoveTop?.(key)
        } else if (ordered.length > 0) {
          setFocus(ordered[0])
        }
        return

      case 'End':
        if (onFormField) return
        e.preventDefault()
        if (inReorder && isGrabbedNow) {
          options.onMoveBottom?.(key)
        } else if (ordered.length > 0) {
          setFocus(ordered[ordered.length - 1])
        }
        return

      case 'ArrowLeft':
        if (options.variant !== 'nested' || onFormField) return
        e.preventDefault()
        if (inReorder && isGrabbedNow && focusedItem.canOutdent) {
          options.onOutdent?.(key)
        } else if (focusedItem.expanded) {
          options.onToggleChildren?.(key, false)
        }
        return

      case 'ArrowRight':
        if (options.variant !== 'nested' || onFormField) return
        e.preventDefault()
        if (inReorder && isGrabbedNow && focusedItem.canIndent) {
          options.onIndent?.(key)
        } else if (focusedItem.canExpand && !focusedItem.expanded) {
          options.onToggleChildren?.(key, true)
        }
        return

      case 'Enter':
      case ' ': // Space
        if (onFormField) return
        e.preventDefault()
        if (inReorder) {
          if (isGrabbedNow) {
            grabbedKey.value = null
          } else {
            grabbedKey.value = key
          }
        } else {
          options.onToggleEdit?.(key)
        }
        return

      case 'Escape':
        if (grabbedSomewhere) {
          e.preventDefault()
          grabbedKey.value = null
          return
        }
        if (inReorder) {
          e.preventDefault()
          options.onCancelReorder?.()
          return
        }
        if (options.isEditing(key)) {
          e.preventDefault()
          options.onCancelEdit?.(key)
          return
        }
        return

      default:
        return
    }
  }

  return {
    focusedKey,
    grabbedKey,
    isFocused,
    isGrabbed,
    rowTabindex,
    setFocus,
    releaseGrab,
    handleKeydown,
  }
}
