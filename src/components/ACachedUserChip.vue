<script lang="ts" setup>
import type { IntegerId } from '@/types/common'
import type { AnzuUserMinimal } from '@/types/AnzuUser'
import { computed, shallowRef, watch } from 'vue'
import type { CollabCachedUsersMap } from '@/components/collab/composables/collabHelpers'
import { isNull, isUndefined } from '@/utils/common'
import { COMMON_CONFIG } from '@/model/commonConfig'
import AAnzuUserAvatar from '@/components/AAnzuUserAvatar.vue'
import { useRouter } from 'vue-router'

const props = withDefaults(
  defineProps<{
    id: null | undefined | IntegerId
    routeName?: string | undefined
    cachedUsers?: CollabCachedUsersMap | undefined
  }>(),
  {
    routeName: undefined,
    cachedUsers: undefined,
  }
)

const router = useRouter()
const cached = shallowRef<undefined | AnzuUserMinimal>(undefined)
const loaded = shallowRef<boolean>(false)

const item = computed(() => {
  if (props.id) {
    return props.cachedUsers?.get(props.id)
  }
  return undefined
})

const text = computed(() => {
  if (cached.value) {
    return cached.value.person.fullName.length ? cached.value.person.fullName : cached.value.email.split('@')[0]
  }
  return ''
})

const onClick = () => {
  if (!props.routeName) return
  router.push({ name: props.routeName, params: { id: props.id } })
}

watch(
  item,
  async (newValue) => {
    if (loaded.value) return
    if (isUndefined(newValue) || newValue._loaded === false) return
    cached.value = newValue
    loaded.value = true
  },
  { immediate: true }
)
</script>

<template>
  <div
    v-if="isUndefined(cachedUsers)"
    class="d-inline-flex"
  ></div>
  <div
    v-else
    class="d-inline-flex"
  >
    <span v-if="isNull(id) || isUndefined(id)">-</span>
    <VChip
      v-else
      class="pl-1"
      size="small"
      :append-icon="COMMON_CONFIG.CHIP.ICON.LINK"
      @click.stop="onClick"
    >
      <AAnzuUserAvatar
        v-if="loaded"
        :user="cached ?? undefined"
        container-class="mr-1"
        :size="20"
      />
      {{ text }}
      <VProgressCircular
        v-if="!loaded"
        :size="12"
        :width="2"
        indeterminate
        class="ml-1"
      />
    </VChip>
  </div>
</template>
