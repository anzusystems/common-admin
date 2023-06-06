<script lang="ts" setup>
import { computed } from 'vue'
import { type RouteParams, type RouteRecordName, type RouteRecordNormalized, useRoute } from 'vue-router'
import { useActionbar } from '@/views/system/actionbar'
import { isString } from '@/utils/common'

const { canTeleport } = useActionbar()

const route = useRoute()

const generateTitle = (item: RouteRecordNormalized) => {
  if (item.meta.title) return item.meta.title
  if (isString(item.name)) {
    const word = item.name.split('-').slice(1).join(' ')
    return word.charAt(0).toUpperCase() + word.slice(1)
  }
  return item.name
}

const breadcrumbs = computed(() => {
  const final: any[] = []
  console.log(route.matched)
  route.matched.forEach((value) => {
    if (value.path.length === 0) return
    const to: { path: string; name: string | undefined | RouteRecordName; params: RouteParams | undefined } = {
      path: value.path,
      name: value.name ?? undefined,
      params: { ...route.params },
    }
    if (isString(value.path) && value.path.startsWith('/view/')) {
      final.push({
        disabled: false,
        title: generateTitle(value),
        to: to,
      })
    }
  })
  return final
})
</script>

<template>
  <Teleport
    v-if="canTeleport"
    to="#anzu-actionbar"
  >
    <div class="flex-grow-1 flex-shrink-1 min-width-0 overflow-hidden">
      <slot name="breadcrumbs">
        <div class="d-flex align-center min-width-0">
          <VBreadcrumbsDivider
            v-if="breadcrumbs.length > 0"
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
              v-for="(breadcrumb, index) in breadcrumbs"
              :key="breadcrumb.to.path"
            >
              <VBreadcrumbsItem
                :to="breadcrumb.to"
                :disabled="false"
                :class="{ 'min-width-0': index === breadcrumbs.length - 1 }"
              >
                <div class="v-breadcrumbs-item__text">
                  {{ breadcrumb.title }}
                </div>
              </VBreadcrumbsItem>
              <VBreadcrumbsDivider v-if="index < breadcrumbs.length - 1">
                &raquo;
              </VBreadcrumbsDivider>
            </template>
          </VBreadcrumbs>
        </div>
      </slot>
    </div>
    <div class="flex-grow-0 flex-shrink-0 pl-2">
      <slot name="buttons" />
    </div>
  </Teleport>
</template>

<style lang="scss">
.v-breadcrumbs-item__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
