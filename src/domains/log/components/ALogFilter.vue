<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import AFilterString from '@/domains/filters/components/AFilterString.vue'
import AFilterTimeInterval from '@/domains/filters/components/AFilterTimeInterval.vue'
import AFilterValueObjectOptionsSelect from '@/domains/filters/components/AFilterValueObjectOptionsSelect.vue'
import AFilterWrapper from '@/domains/filters/components/AFilterWrapper.vue'
import type { TimeIntervalToolsValue } from '@/domains/filters/composables/filterTimeIntervalTools'
import { type LogTypeType, useLogType } from '@/domains/log/composables/logType'
import { useLogLevel } from '@/domains/log/valueObject/LogLevel'

defineProps<{
  type: LogTypeType
  allowedTimeIntervals?: TimeIntervalToolsValue[] | undefined
}>()

const emit = defineEmits<{
  (e: 'submit'): void
  (e: 'reset'): void
  (e: 'changeType', type: LogTypeType): void
}>()

const { t } = useI18n()
const { logLevelOptions } = useLogLevel()
const { logTypeOptions } = useLogType()
</script>

<template>
  <AFilterWrapper
    enable-top
    @submit="emit('submit')"
    @reset="emit('reset')"
  >
    <template #top>
      <VRow class="align-start">
        <VCol
          class="pb-0"
          cols="12"
          sm="4"
        >
          <!--
            A plain select, not `AFilterValueObjectOptionsSelect`: that one throws unless the name
            it is given is a live filter field, and the type is not one. It picks the endpoint and
            lives in the route, which is also what makes it survive a filter reset.
          -->
          <VSelect
            :model-value="type"
            :items="logTypeOptions"
            :label="t('common.log.filter.type')"
            item-title="title"
            item-value="value"
            density="compact"
            variant="outlined"
            hide-details
            data-cy="filter-log-type"
            @update:model-value="emit('changeType', $event)"
          />
        </VCol>
      </VRow>
      <VDivider class="mb-4 mt-4" />
    </template>
    <template #search>
      <AFilterString
        name="contextId"
        class="mr-2"
      />
      <AFilterString
        name="message"
        class="mr-2"
      />
      <AFilterTimeInterval
        name-from="datetimeFrom"
        name-until="datetimeTo"
        :allowed="allowedTimeIntervals"
      />
    </template>
    <template #item.levelName>
      <AFilterValueObjectOptionsSelect
        name="levelName"
        :items="logLevelOptions"
      />
    </template>
  </AFilterWrapper>
</template>
