<script lang="ts" setup>
import { computed, type Ref, shallowRef, unref, watch } from 'vue'
import AAnzuUserAvatar from '@/components/AAnzuUserAvatar.vue'
import { isNull, isNumber, isUndefined } from '@/utils/common'
import type { CollabCachedUsersMap } from '@/components/collab/composables/collabHelpers'
import type { IntegerId } from '@/types/common'
import type { AnzuUserMinimal } from '@/types/AnzuUser'

const props = withDefaults(
  defineProps<{
    id: null | undefined | IntegerId
    users: CollabCachedUsersMap | Ref<CollabCachedUsersMap>
  }>(),
  {}
)

const cached = shallowRef<undefined | AnzuUserMinimal>(undefined)
const loaded = shallowRef<boolean>(false)

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const cachedUsers = unref(props.users)

const item = computed(() => {
  if (isNumber(props.id) && props.id > 0) {
    return cachedUsers.get(props.id)
  }
  return undefined
})

const tooltip = computed(() => {
  if (item.value) {
    return item.value.person.fullName.length ? item.value.person.fullName : item.value.email.split('@')[0]
  }
  return undefined
})

watch(
  item,
  async (newValue) => {
    if (loaded.value) return
    if (isUndefined(newValue) || !newValue._loaded) return
    cached.value = newValue
    loaded.value = true
  },
  { immediate: true }
)
</script>

<template>
  <div class="d-inline-flex">
    <span v-if="isNull(id) || isUndefined(id)" />
    <AAnzuUserAvatar
      v-else-if="loaded"
      :user="cached ?? undefined"
      container-class=""
      :size="20"
      :tooltip="tooltip"
    />
    <VProgressCircular
      v-else
      :size="12"
      :width="2"
      indeterminate
      class="ml-1"
    />
  </div>
</template>
