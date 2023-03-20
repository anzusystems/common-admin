<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import { dateTimePretty } from '@/utils/datetime'

const props = withDefaults(
  defineProps<{
    data: AnzuUserAndTimeTrackingAware | any
    hideCreatedAt?: boolean
    hideModifiedAt?: boolean
  }>(),
  {
    hideCreatedAt: false,
    hideModifiedAt: false,
  },
)

const createdAt = computed(() => {
  return dateTimePretty(props.data.createdAt)
})
const modifiedAt = computed(() => {
  return dateTimePretty(props.data.modifiedAt)
})

const { t } = useI18n()
</script>

<template>
  <ARow :title="t('common.model.tracking.created')">
    <div class="d-flex align-center">
      <div
        v-if="!hideCreatedAt"
        class="mr-2"
      >
        {{ createdAt }}
      </div>
    </div>
  </ARow>
  <ARow :title="t('common.model.tracking.modified')">
    <div class="d-flex align-center">
      <div
        v-if="!hideModifiedAt"
        class="mr-2"
      >
        {{ modifiedAt }}
      </div>
    </div>
  </ARow>
</template>
