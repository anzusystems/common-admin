<script lang="ts" setup>
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useFilterBookmarkStore } from '@/components/filter2/bookmarksStore.ts'
import { useUserAdminConfigApi } from '@/services/api/userAdminConfig/userAdminConfig.ts'
import type { AxiosInstance } from 'axios'
import { type UserAdminConfig, UserAdminConfigLayoutType } from '@/types/UserAdminConfig.ts'
import { useDisplay } from 'vuetify'
import type { IntegerId } from '@/types/common.ts'
import { useResizeObserver, watchThrottled } from '@vueuse/core'
import { isNull } from '@/utils/common.ts'

const props = withDefaults(
  defineProps<{
    client: () => AxiosInstance
    system: string
    user: IntegerId
    systemResource: string
  }>(),
  {}
)

const datatableHiddenColumns = defineModel<string[] | undefined>('datatableHiddenColumns', {
  default: undefined,
  required: true,
})

const loading = ref(false)
const toolbarRef = useTemplateRef('toolbarRef')
const toolbarWidth = ref(300)
const visibleItemsCount = ref(1000)

const filterBookmarkStore = useFilterBookmarkStore()
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { fetchUserAdminConfigList } = useUserAdminConfigApi(props.client, props.system)
const { mobile } = useDisplay()

const loadBookmarks = async (force = false) => {
  loading.value = true
  await filterBookmarkStore.getBookmarks(
    {
      system: props.system,
      user: props.user,
      layoutType: mobile.value ? UserAdminConfigLayoutType.Mobile : UserAdminConfigLayoutType.Desktop,
      systemResource: props.systemResource,
    },
    fetchUserAdminConfigList,
    force
  )
  loading.value = false
}

const onItemClick = (item: UserAdminConfig) => {
  console.log(item)
  console.log(datatableHiddenColumns.value)
}

const THREE_DOTS_WIDTH = 32

const calculateVisible = async (totalWidth: number) => {
  const container = toolbarRef.value
  if (isNull(container)) return
  visibleItemsCount.value = 1000
  await nextTick()
  let cumulativeWidth = 0
  let visible = 0
  for (let i = 0; i < container.children.length; i++) {
    const child = container.children[i] as HTMLElement
    const childWidth = child.offsetWidth
    cumulativeWidth += childWidth
    if (cumulativeWidth >= totalWidth - THREE_DOTS_WIDTH) {
      break
    }
    visible++
  }
  visibleItemsCount.value = visible
}

useResizeObserver(toolbarRef, (entries) => {
  if (entries[0]) {
    toolbarWidth.value = entries[0].contentRect.width
  }
})

watchThrottled(
  toolbarWidth,
  (newValue, oldValue) => {
    if (newValue === oldValue) return
    calculateVisible(newValue)
  },
  { throttle: 1000 }
)

const items = computed(() => {
  const key = filterBookmarkStore.generateKey(
    props.system,
    mobile.value ? UserAdminConfigLayoutType.Mobile : UserAdminConfigLayoutType.Desktop,
    props.systemResource
  )
  const result = filterBookmarkStore.bookmarks.get(key)
  return result?.items ?? []
})

const itemsComputed = computed(() => {
  const visible = visibleItemsCount.value
  return {
    visible: items.value.slice(0, visible),
    hidden: items.value.slice(visible),
  }
})

watch([loading, () => items.value.length], ([newLoading]) => {
  if (newLoading === true || isNull(toolbarRef.value)) return
  toolbarWidth.value = toolbarRef.value.clientWidth
  calculateVisible(toolbarWidth.value)
})

onMounted(() => {
  loadBookmarks()
})
</script>

<template>
  <div
    ref="toolbarRef"
    :key="items.length"
    class="w-100 d-flex overflow-hidden align-center"
  >
    <div v-if="loading" />
    <template v-else>
      <div
        v-for="item in itemsComputed.visible"
        :key="item.id"
        class="white-space-nowrap"
      >
        <VBtn
          text
          size="small"
          @click="onItemClick(item)"
        >
          {{ item.customName }}
        </VBtn>
      </div>
      <VMenu
        v-if="itemsComputed.hidden.length > 0"
        bottom
        offset-y
      >
        <template #activator="{ props: activatorProps }">
          <VBtn
            icon="mdi-menu-down"
            size="x-small"
            :width="28"
            :height="28"
            variant="text"
            v-bind="activatorProps"
          />
        </template>
        <VList density="compact">
          <VListItem
            v-for="item in itemsComputed.hidden"
            :key="item.id"
            @click="onItemClick(item)"
          >
            <VListItemTitle>{{ item.customName }}</VListItemTitle>
          </VListItem>
        </VList>
      </VMenu>
    </template>
  </div>
</template>
