<script lang="ts" setup>
import { type Component, computed, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import AAlerts from '@/components/AAlerts.vue'

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

// A name the map does not have renders the page without a layout, as an unregistered global
// component did, rather than hiding it behind the loader.
const current = computed(() => {
  const name = routeLayout.value || props.defaultLayout
  const found = props.layouts[name]
  if (!found) console.error(`[ALayoutSwitch] Unknown layout '${name}'.`)
  return found
})
</script>

<template>
  <!-- The one alerts host, outside the layout switch. A host inside a layout takes the alerts it is
       showing away with it when the route switches layouts: a start-up error raised while the loader
       was up vanished the moment the drawer replaced it. -->
  <AAlerts />
  <component
    :is="current"
    v-if="current"
  >
    <slot />
  </component>
  <slot v-else />
</template>
