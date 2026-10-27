<script lang="ts" setup>
import { type Component, computed, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import AAlerts from '@/domains/system/components/AAlerts.vue'

const props = withDefaults(
  defineProps<{
    /** The layouts by the name pages give in `definePage({ meta: { layout } })`. */
    layouts: Record<string, Component>
    /** Until the first route resolves, and for a route without `meta.layout`. */
    defaultLayout?: string
  }>(),
  {
    defaultLayout: 'AppLayoutLoader',
  }
)

const route = useRoute()

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
</script>

<template>
  <!--
    The single alerts host, outside the layout switch.
    A host inside a layout drops its alerts when the route switches layouts,
    e.g. a start-up error vanished when the drawer replaced the loader.
  -->
  <AAlerts />
  <component
    :is="current"
    v-if="current"
  >
    <slot />
  </component>
  <slot v-else />
</template>
