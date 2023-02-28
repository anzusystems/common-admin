<script lang="ts" setup>
import ADatetime from '@/components/ADatetime.vue'
import type { DatetimeUTCNullable } from '@/types/common'
import { ref } from 'vue'

const dateTime = ref<DatetimeUTCNullable>('2023-02-08T08:17:29.000000Z')
</script>

<template>
  <VCard>
    <VCardTitle>Datetime</VCardTitle>
    <VCardText>
      <ADatetime :date-time="dateTime" />
    </VCardText>
  </VCard>
</template>
