<script lang="ts" setup>
import type { AnzuUserAndTimeTrackingAware } from '@/types/AnzuUserAndTimeTrackingAware'
import { useI18n } from 'vue-i18n'
import ARow from '@/components/ARow.vue'
import ADatetime from '@/components/ADatetime.vue'

// todo add user details, find generic way for all systems

withDefaults(
  defineProps<{
    data: AnzuUserAndTimeTrackingAware | any
    hideCreatedAt?: boolean
    hideModifiedAt?: boolean
    hideCreatedBy?: boolean
    hideModifiedBy?: boolean
  }>(),
  {
    hideCreatedAt: false,
    hideModifiedAt: false,
    hideCreatedBy: false,
    hideModifiedBy: false,
  }
)

const { t } = useI18n()
</script>

<template>
  <ARow v-if="!hideCreatedAt" :title="t('common.tracking.created')">
    <ADatetime :date-time="data.createdAt" />
  </ARow>
  <ARow v-if="!hideModifiedAt" :title="t('common.tracking.modified')">
    <ADatetime :date-time="data.modifiedAt" />
  </ARow>
</template>
