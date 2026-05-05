import {
  computed,
  getCurrentInstance,
  onBeforeUnmount,
  ref,
  watch,
  type ComputedRef,
  type Ref,
} from 'vue'
import { onBeforeRouteLeave } from 'vue-router'

type UnsavedSource = Ref<boolean | Set<unknown> | unknown[] | null | undefined>

export interface UseUnsavedChangesGuardOptions {
  /**
   * Reactive sources that signal "unsaved" state. Each source's truthiness is
   * checked: a Set/array is "dirty" when non-empty, a boolean when true, null
   * or undefined as not dirty.
   */
  sources: UnsavedSource[]
  /**
   * Block route navigation via vue-router's onBeforeRouteLeave. Default true.
   * When omitted/false, the route guard is not registered.
   */
  guardRoute?: boolean | Ref<boolean>
  /**
   * Block window/tab unload via beforeunload. Default true.
   */
  guardWindowUnload?: boolean | Ref<boolean>
  /**
   * Optional Vuetify dialog v-model. When provided, attempts to close the
   * dialog while dirty are intercepted: dialog stays open until the user
   * confirms via the confirm dialog or via `acknowledge()`.
   */
  guardDialogModel?: Ref<boolean>
}

export interface UseUnsavedChangesGuardApi {
  hasUnsavedChanges: ComputedRef<boolean>
  /**
   * v-model-bound to the confirm dialog. When the guard wants to ask the user
   * to confirm leaving, it sets this to true. The confirm dialog reads it.
   */
  promptOpen: Ref<boolean>
  /**
   * Resolves the confirm prompt with `discard=true` (proceed) or `false`
   * (stay). Called by the confirm dialog.
   */
  resolvePrompt: (discard: boolean) => void
  /**
   * Manually mark the most recent intent as acknowledged so the next
   * route/dialog/unload attempt proceeds without prompting. Useful right
   * before a programmatic navigation that the consumer has already
   * confirmed.
   */
  acknowledge: () => void
}

const isTruthySource = (value: unknown): boolean => {
  if (value === null || value === undefined) return false
  if (typeof value === 'boolean') return value
  if (value instanceof Set) return value.size > 0
  if (Array.isArray(value)) return value.length > 0
  return Boolean(value)
}

const resolveBool = (v: boolean | Ref<boolean> | undefined, fallback: boolean): boolean => {
  if (v === undefined) return fallback
  if (typeof v === 'boolean') return v
  return v.value
}

export function useUnsavedChangesGuard(
  options: UseUnsavedChangesGuardOptions,
): UseUnsavedChangesGuardApi {
  const hasUnsavedChanges = computed<boolean>(() =>
    options.sources.some((s) => isTruthySource(s.value)),
  )

  const promptOpen = ref<boolean>(false)
  let pendingResolver: ((discard: boolean) => void) | null = null
  let acknowledgedOnce = false

  const askToLeave = (): Promise<boolean> => {
    if (acknowledgedOnce) {
      acknowledgedOnce = false
      return Promise.resolve(true)
    }
    return new Promise((resolve) => {
      pendingResolver = resolve
      promptOpen.value = true
    })
  }

  const resolvePrompt = (discard: boolean) => {
    promptOpen.value = false
    if (pendingResolver) {
      pendingResolver(discard)
      pendingResolver = null
    }
  }

  const acknowledge = () => {
    acknowledgedOnce = true
  }

  // Route guard — `onBeforeRouteLeave` only works inside a route component
  // (it reads the current vm context). Outside a component it's a no-op.
  if (resolveBool(options.guardRoute, true) && getCurrentInstance()) {
    try {
      onBeforeRouteLeave(async () => {
        if (!hasUnsavedChanges.value) return true
        const discard = await askToLeave()
        return discard
      })
    } catch {
      // Not in a route context — skip silently.
    }
  }

  // beforeunload — modern browsers strip custom messages but still display a
  // generic confirm. Setting `returnValue` is the canonical way to opt in.
  if (resolveBool(options.guardWindowUnload, true)) {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges.value) return
      e.preventDefault()
      e.returnValue = ''
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', onBeforeUnload)
      onBeforeUnmount(() => {
        window.removeEventListener('beforeunload', onBeforeUnload)
      })
    }
  }

  // Dialog guard — when the parent dialog tries to close while dirty, intercept
  // and ask the user to confirm. The parent dialog model goes from false→true
  // (open) to true→false (closing); we re-open it while we await the prompt.
  if (options.guardDialogModel) {
    const dialogModel = options.guardDialogModel
    let suppressNext = false
    watch(dialogModel, async (now, prev) => {
      if (suppressNext) {
        suppressNext = false
        return
      }
      if (prev === true && now === false && hasUnsavedChanges.value) {
        // Re-open the dialog while we wait for the user's choice.
        suppressNext = true
        dialogModel.value = true
        const discard = await askToLeave()
        if (discard) {
          suppressNext = true
          dialogModel.value = false
        }
      }
    })
  }

  return {
    hasUnsavedChanges,
    promptOpen,
    resolvePrompt,
    acknowledge,
  }
}
