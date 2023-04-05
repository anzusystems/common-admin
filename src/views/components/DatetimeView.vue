<script lang="ts" setup>
import ADatetime from '@/components/ADatetime.vue'
import type { DatetimeUTCNullable } from '@/types/common'
import { ref } from 'vue'
import AFormDatetimePicker from '@/components/form/AFormDatetimePicker.vue'

const dateTime = ref<DatetimeUTCNullable>('2023-02-08T08:17:29.000000Z')
</script>

<template>
  <VCard>
    <VCardTitle>Datetime</VCardTitle>
    <VCardText>
      <ADatetime :date-time="dateTime"/>
      <AFormDatetimePicker v-model="dateTime"/>
      <div style="width:60px">
        <AFormDatetimePicker v-model="dateTime"/>
      </div>
    </VCardText>
  </VCard>
</template>
