<script lang="ts" setup>
import type { RouteLocationAsRelativeGeneric, RouteLocationRaw } from 'vue-router'
import { useRoute } from 'vue-router'
import { computed } from 'vue'
import { actionbarSlot, type TeleportSlot } from '@/components/appShell/teleportSlot'
import type { BreadcrumbItem, Breadcrumbs } from '@/composables/system/breadcrumbs'
import { isString, isUndefined } from '@/utils/common'

const props = withDefaults(
  defineProps<{
    breadcrumbs?: Breadcrumbs | undefined
    /**
     * Where a breadcrumb links to, for a breadcrumb that links at all (not the last one, unless
     * `linkLastItem`). Default: its route name with `routeParams`, or `{ id }` when it has an id.
     */
    resolveBreadcrumbRoute?: (item: BreadcrumbItem) => RouteLocationRaw
    /** Another teleport slot to render into. Default: the app bar's actionbar. */
    target?: TeleportSlot
  }>(),
  {
    breadcrumbs: undefined,
    resolveBreadcrumbRoute: undefined,
    target: undefined,
  }
)

const route = useRoute()

const Source = computed(() => (props.target ?? actionbarSlot).Source)

const byName = (item: BreadcrumbItem): RouteLocationRaw => {
  const location: RouteLocationAsRelativeGeneric = { name: item.routeName }
  if (!isUndefined(item.routeParams)) {
    location.params = { ...item.routeParams }
  } else if (!isUndefined(item.id)) {
    location.params = { id: item.id }
  }
  // A breadcrumb's route name is only known at runtime, but RouteLocationRaw is a union keyed on
  // literal names. Names are checked at their definition sites by anzu/valid-route-name.
  return location as RouteLocationRaw
}

const breadcrumbTo = (item: BreadcrumbItem, index: number): RouteLocationRaw | undefined => {
  if (
    isUndefined(props.breadcrumbs) ||
    (!props.breadcrumbs.options.linkLastItem && index === props.breadcrumbs.items.value.length - 1)
  ) {
    return undefined
  }
  return (props.resolveBreadcrumbRoute ?? byName)(item)
}
</script>

<template>
  <component :is="Source">
    <div class="flex-grow-1 flex-shrink-1 min-width-0 overflow-hidden">
      <slot name="breadcrumbs">
        <div
          v-if="!isUndefined(breadcrumbs)"
          class="d-flex align-center min-width-0"
        >
          <VBreadcrumbsDivider
            v-if="breadcrumbs.items.value.length > 0"
            class="px-1"
          >
            &raquo;
          </VBreadcrumbsDivider>
          <VBreadcrumbs
            :key="isString(route.name) ? route.name : route.fullPath"
            class="pl-1 min-width-0"
            density="compact"
          >
            <template
              v-for="(breadcrumb, index) in breadcrumbs.items.value"
              :key="breadcrumb.routeName"
            >
              <VBreadcrumbsItem
                :to="breadcrumbTo(breadcrumb, index)"
                :disabled="false"
                :class="{ 'min-width-0': index === breadcrumbs.items.value.length - 1 }"
              >
                <div class="v-breadcrumbs-item__text">
                  {{ breadcrumb.title }}
                </div>
              </VBreadcrumbsItem>
              <VBreadcrumbsDivider v-if="index < breadcrumbs.items.value.length - 1"> &raquo; </VBreadcrumbsDivider>
            </template>
          </VBreadcrumbs>
        </div>
      </slot>
    </div>
    <div class="flex-grow-0 flex-shrink-0 pl-2">
      <slot name="buttons" />
    </div>
  </component>
</template>

<style lang="scss">
.v-breadcrumbs-item__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
