<script lang="ts" setup>
import { type Component, computed, onBeforeUnmount, shallowRef, watch } from 'vue'
import { isNavigationFailure, NavigationFailureType, useRoute, useRouter } from 'vue-router'
import AAlerts from '@/domains/system/components/AAlerts.vue'

const props = withDefaults(
  defineProps<{
    /** The layouts by the name pages give in `definePage({ meta: { layout } })`. */
    layouts: Record<string, Component>
    /** Until the first route resolves, and for a route without `meta.layout`. */
    defaultLayout?: string
    /** Milliseconds a navigation is pending before the progress bar shows; a negative value turns the bar off. */
    navigationProgressDelay?: number
  }>(),
  {
    defaultLayout: 'AppLayoutLoader',
    navigationProgressDelay: 300,
  }
)

const route = useRoute()
const router = useRouter()

// Read on a change of the route's meta, not on the first render: until the first navigation resolves,
// the default layout shows.
const routeLayout = shallowRef<string | undefined>(undefined)

watch(
  () => route.meta,
  (meta) => {
    routeLayout.value = (meta as { layout?: string }).layout
  }
)

// A name missing from the map renders the page without a layout, rather than hiding it behind the loader.
const current = computed(() => {
  const name = routeLayout.value || props.defaultLayout
  const found = props.layouts[name]
  if (!found) console.error(`[ALayoutSwitch] Unknown layout '${name}'.`)
  return found
})

// The old page stays until the new one's chunks are in, which on a slow network
// or the first visit after a deploy takes seconds, with nothing else showing.
const navigating = shallowRef(false)
let progressTimer: ReturnType<typeof setTimeout> | undefined
const stopProgress = () => {
  clearTimeout(progressTimer)
  progressTimer = undefined
  navigating.value = false
}
const removeBeforeEach = router.beforeEach(() => {
  if (props.navigationProgressDelay < 0 || navigating.value || progressTimer !== undefined) return
  progressTimer = setTimeout(() => {
    progressTimer = undefined
    navigating.value = true
  }, props.navigationProgressDelay)
})
const removeAfterEach = router.afterEach((_to, _from, failure) => {
  // A newer navigation replaced this one and is still pending.
  if (isNavigationFailure(failure, NavigationFailureType.cancelled)) return
  stopProgress()
})
const removeOnError = router.onError(stopProgress)
onBeforeUnmount(() => {
  stopProgress()
  removeBeforeEach()
  removeAfterEach()
  removeOnError()
})
</script>

<template>
  <!--
    The single alerts host, outside the layout switch.
    A host inside a layout drops its alerts when the route switches layouts,
    e.g. a start-up error vanished when the drawer replaced the loader.
  -->
  <AAlerts />
  <VProgressLinear
    v-if="navigating"
    class="a-layout-switch__navigation"
    indeterminate
    color="primary"
    height="3"
  />
  <component
    :is="current"
    v-if="current"
  >
    <slot />
  </component>
  <slot v-else />
</template>

<style lang="scss">
.a-layout-switch__navigation {
  position: fixed !important;
  inset: 0 0 auto;
  // Above the layout's app bar and drawer (1000 and up), below overlays (2000) and the alerts.
  z-index: 1500 !important;
}
</style>
