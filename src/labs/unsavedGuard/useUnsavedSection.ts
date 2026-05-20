import {
  computed,
  getCurrentInstance,
  inject,
  onBeforeUnmount,
  provide,
  reactive,
  type ComputedRef,
  type InjectionKey,
} from 'vue'

/**
 * One named, savable section the unsaved-changes confirm dialog can name back
 * to the user. `dirty` is evaluated reactively inside the section's getter.
 */
export interface UnsavedSectionDescriptor {
  label: string
  dirty: boolean
}

/**
 * Getter returning a single descriptor, or an array of them for a component
 * that owns several sub-sections (e.g. page positions in one PageContentsManage).
 */
export type UnsavedSectionSource = () => UnsavedSectionDescriptor | UnsavedSectionDescriptor[]

export interface UnsavedSectionRegistry {
  register: (id: symbol, source: ComputedRef<UnsavedSectionDescriptor[]>) => void
  unregister: (id: symbol) => void
  /** Labels of every registered section currently flagged dirty. */
  dirtyLabels: ComputedRef<string[]>
}

export const UnsavedSectionKey = Symbol('unsaved.sections') as InjectionKey<UnsavedSectionRegistry>

export function createUnsavedSectionRegistry(): UnsavedSectionRegistry {
  const sources = reactive(new Map<symbol, ComputedRef<UnsavedSectionDescriptor[]>>())

  const dirtyLabels = computed<string[]>(() => {
    const out: string[] = []
    for (const source of sources.values()) {
      for (const descriptor of source.value) {
        if (descriptor.dirty) out.push(descriptor.label)
      }
    }
    return out
  })

  return {
    register(id, source) {
      sources.set(id, source)
    },
    unregister(id) {
      sources.delete(id)
    },
    dirtyLabels,
  }
}

/**
 * Creates a registry and `provide`s it for descendants. Called internally by
 * `useUnsavedChangesGuard` so the guard host automatically supplies one.
 */
export function provideUnsavedSectionRegistry(): UnsavedSectionRegistry {
  const registry = createUnsavedSectionRegistry()
  if (getCurrentInstance()) provide(UnsavedSectionKey, registry)
  return registry
}

/**
 * Registers one or more named sections so the unsaved-changes confirm dialog
 * can tell the user *which* parts are dirty instead of a generic message.
 *
 * Pass a getter returning a descriptor — or an array of descriptors when the
 * component owns several sub-sections (e.g. one PageContentsManage owns N page
 * positions). No-op when called outside a guarded route (inject returns null).
 */
export function useUnsavedSection(source: UnsavedSectionSource): void {
  const registry = inject(UnsavedSectionKey, null)
  if (!registry) return
  if (!getCurrentInstance()) return

  const id = Symbol('unsaved.section')
  const normalized = computed<UnsavedSectionDescriptor[]>(() => {
    const resolved = source()
    return Array.isArray(resolved) ? resolved : [resolved]
  })

  registry.register(id, normalized)
  onBeforeUnmount(() => registry.unregister(id))
}
