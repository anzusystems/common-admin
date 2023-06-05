<script lang="ts" setup>
import { RouteRecordNormalized, useRouter } from 'vue-router'
import { computed } from 'vue'
import { isString } from '@/utils/common'

const router = useRouter()

const allRoutes = router.getRoutes()

const generateTitle = (item: RouteRecordNormalized) => {
  if (item.meta.title) return item.meta.title
  if (isString(item.name)) {
    const word = item.name.split('-').slice(1).join(' ')
    return word.charAt(0).toUpperCase() + word.slice(1)
  }
  return item.name
}

const items = computed(() => {
  return allRoutes
    .filter((route) => route.path.startsWith('/view/'))
    .map((item) => ({
      name: item.name,
      title: generateTitle(item),
    }))
})
</script>

<template>
  <VListItem
    v-for="item in items"
    :key="item.name"
    :to="{ name: item.name }"
    prepend-icon="mdi-test-tube"
    :title="item.title"
  />
</template>
