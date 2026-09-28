import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  type Component,
  type Ref,
  shallowRef,
  Teleport,
} from 'vue'

export interface TeleportSlot {
  /** The element sources teleport into. The last one mounted wins; unmounting it clears the slot. */
  Target: Component
  /** Teleports its default slot into the mounted target, and renders nothing while none is mounted. */
  Source: Component
  /** Whether a target is mounted. */
  ready: Readonly<Ref<boolean>>
}

/**
 * A place one component renders into from anywhere else, such as the app bar's actionbar. The target
 * element itself is held rather than looked up by an `#id` selector: a source rendered before its
 * target, or on a page without one, waits instead of warning "Failed to locate Teleport target".
 */
export function createTeleportSlot(name: string): TeleportSlot {
  const target = shallowRef<HTMLElement | null>(null)

  const Target = defineComponent({
    name: `${name}Target`,
    props: { tag: { type: String, default: 'div' } },
    setup(props) {
      const el = shallowRef<HTMLElement | null>(null)
      onMounted(() => {
        target.value = el.value
      })
      onBeforeUnmount(() => {
        if (target.value === el.value) target.value = null
      })
      return () => h(props.tag, { ref: el })
    },
  })

  const Source = defineComponent({
    name: `${name}Source`,
    props: { disabled: { type: Boolean, default: false } },
    setup(props, { slots }) {
      return () =>
        target.value ? h(Teleport, { to: target.value, disabled: props.disabled }, slots.default?.() ?? []) : null
    },
  })

  return { Target, Source, ready: computed(() => target.value !== null) }
}

/** The actionbar in the app bar of an admin's drawer layout. */
export const actionbarSlot = createTeleportSlot('AActionbar')
