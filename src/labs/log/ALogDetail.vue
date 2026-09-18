<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import ALogLevelChip from '@/components/log/ALogLevelChip.vue'
import type { Log } from '@/types/Log'
import { dateTimeFriendly } from '@/utils/datetime'
import { formatJson } from '@/utils/json'

defineProps<{
  log: Log
}>()

const { t } = useI18n()
</script>

<template>
  <VRow>
    <VCol>
      <VRow>
        <VCol cols="3">
          <h4 class="text-label-large">
            {{ t('common.log.model.id') }}
          </h4>
          {{ log.id }}
        </VCol>
        <VCol cols="3">
          <h4 class="text-label-large">
            {{ t('common.log.model.levelName') }}
          </h4>
          <ALogLevelChip :level="log.levelName" />
        </VCol>
        <VCol cols="2">
          <h4 class="text-label-large">
            {{ t('common.log.model.context.userId') }}
          </h4>
          {{ log.context.userId }}
        </VCol>
        <VCol cols="2">
          <h4 class="text-label-large">
            {{ t('common.log.model.context.appVersion') }}
          </h4>
          {{ log.context.appVersion }}
        </VCol>
        <VCol cols="2">
          <h4 class="text-label-large">
            {{ t('common.log.model.context.requestOriginAppVersion') }}
          </h4>
          {{ log.context.requestOriginAppVersion }}
        </VCol>
      </VRow>
      <VRow>
        <VCol cols="4">
          <h4 class="text-label-large">
            {{ t('common.log.model.context.contextId') }}
          </h4>
          {{ log.context.contextId }}
        </VCol>
        <VCol cols="4">
          <h4 class="text-label-large">
            {{ t('common.log.model.context.ip') }}
          </h4>
          {{ log.context.ip }}
        </VCol>
        <VCol cols="4">
          <h4 class="text-label-large">
            {{ t('common.log.model.datetime') }}
          </h4>
          {{ dateTimeFriendly(log.datetime) }}
        </VCol>
      </VRow>
      <VRow>
        <VCol cols="12">
          <h4 class="text-label-large">
            {{ t('common.log.model.message') }}
          </h4>
          <pre>{{ log.message }}</pre>
        </VCol>
      </VRow>
      <VRow>
        <VCol cols="6">
          <h4 class="text-label-large">
            {{ t('common.log.model.context.path') }}
          </h4>
          {{ log.context.method }} {{ log.context.path }}
        </VCol>
        <VCol cols="6">
          <h4 class="text-label-large">
            {{ t('common.log.model.context.httpStatus') }}
          </h4>
          {{ log.context.httpStatus }}
        </VCol>
      </VRow>
      <VRow>
        <VCol cols="12">
          <h4 class="text-label-large">
            {{ t('common.log.model.context.content') }}
          </h4>
          <pre>{{ formatJson(log.context.content ?? '') }}</pre>
        </VCol>
      </VRow>
      <VRow>
        <VCol cols="12">
          <h4 class="text-label-large">
            {{ t('common.log.model.context.response') }}
          </h4>
          <pre>{{ formatJson(log.context.response) }}</pre>
        </VCol>
      </VRow>
    </VCol>
  </VRow>
</template>

<style lang="scss" scoped>
pre {
  overflow: auto;
}
</style>
