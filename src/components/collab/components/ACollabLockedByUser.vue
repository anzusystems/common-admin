<script lang="ts" setup>
import { computed, type Ref, shallowRef, unref, watch } from 'vue'
import AAnzuUserAvatar from '@/components/AAnzuUserAvatar.vue'
import { isNull, isNumber, isUndefined } from '@/utils/common'
import type { CollabCachedUsersMap } from '@/components/collab/composables/collabHelpers'
import type { IntegerId } from '@/types/common'
import type { AnzuUserMinimal } from '@/types/AnzuUser'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    id: null | undefined | IntegerId
    users: CollabCachedUsersMap | Ref<CollabCachedUsersMap>
    isModerator?: boolean
  }>(),
  {
    isModerator: false,
  }
)

const cached = shallowRef<undefined | AnzuUserMinimal>(undefined)
const loaded = shallowRef<boolean>(false)

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const cachedUsers = unref(props.users)
const { t } = useI18n()

const item = computed(() => {
  if (isNumber(props.id) && props.id > 0) {
    return cachedUsers.get(props.id)
  }
  return undefined
})

const tooltip = computed(() => {
  let prefix = ''
  if (props.isModerator) {
    prefix = t('common.collab.moderator') + ': '
  }
  if (item.value) {
    return item.value.person.fullName.length
      ? prefix + item.value.person.fullName
      : prefix + item.value.email.split('@')[0]
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
    <template v-else-if="loaded">
      <VBadge
        v-if="isModerator"
        location="top right"
        color="white"
        :width="12"
        :min-width="12"
        :height="14"
        :offset-x="-5"
        :offset-y="-5"
      >
        <template #badge>
          <VIcon
            color="grey-darken-2"
            :size="14"
            icon="mdi-crown"
          />
        </template>
        <AAnzuUserAvatar
          :user="cached ?? undefined"
          :size="20"
          :tooltip="tooltip"
        />
      </VBadge>
      <AAnzuUserAvatar
        v-else
        :user="cached ?? undefined"
        :size="20"
        :tooltip="tooltip"
      />
    </template>
    <VProgressCircular
      v-else
      :size="12"
      :width="2"
      indeterminate
      class="ml-auto mr-auto"
    />
  </div>
</template>
