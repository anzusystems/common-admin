<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { useFilterBookmarkStore } from '@/components/filter2/bookmarksStore.ts'
import { useUserAdminConfigApi } from '@/services/api/userAdminConfig/userAdminConfig.ts'
import type { AxiosInstance } from 'axios'
import { type UserAdminConfig, UserAdminConfigLayoutType } from '@/types/UserAdminConfig.ts'
import { useDisplay } from 'vuetify'
import type { IntegerId } from '@/types/common.ts'

const props = withDefaults(
  defineProps<{
    client: () => AxiosInstance
    system: string
    user: IntegerId
    systemResource: string
  }>(),
  {}
)
const items = ref<UserAdminConfig[]>([])
const loading = ref(false)
const filterBookmarkStore = useFilterBookmarkStore()
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { fetchUserAdminConfigList } = useUserAdminConfigApi(props.client, props.system)
const { mobile } = useDisplay()

const loadBookmarks = async (force = false) => {
  loading.value = true
  items.value = await filterBookmarkStore.getBookmarks(
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

onMounted(() => {
  loadBookmarks()
})
</script>

<template>
  <VBtn
    v-for="item in items"
    :key="item.id"
    size="small"
    text
    @click.stop=""
  >
    {{ item.customName }}
  </VBtn>
</template>
