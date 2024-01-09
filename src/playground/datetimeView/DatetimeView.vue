<script lang="ts" setup>
import ADatetime from '@/components/ADatetime.vue'
import type { DatetimeUTCNullable } from '@/types/common'
import { ref } from 'vue'
import AFormDatetimePicker from '@/components/form/AFormDatetimePicker.vue'
import { dateTimeNow } from '@/utils/datetime'
import AFormFlagDatetimePicker from '@/components/form/AFormFlagDatetimePicker.vue'
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import ADatetimePickerNew from '@/components/datetime/ADatetimePickerNew.vue'

const dateTime = ref<DatetimeUTCNullable>('2023-02-08T08:17:29.000000Z')
const dateTimeDefaultNull = ref<DatetimeUTCNullable>(null)

const changeToNow = () => {
  dateTimeDefaultNull.value = dateTimeNow()
  dateTime.value = dateTimeNow()
}
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardText>
      dateTime: {{ dateTime }}<br>
      dateTimeDefaultNull: {{ dateTimeDefaultNull }}
    </VCardText>
    <VCardTitle>ADatetime component to display formatted datetime</VCardTitle>
    <VCardText>
      <VRow>
        <VCol>
          <ADatetime :date-time="dateTime" />
        </VCol>
      </VRow>
    </VCardText>
  </VCard>

  <VCard>
    <VCardTitle>
      ADatetimePicker component basic
    </VCardTitle>
    <VCardText>
      <p class="mb-4">
        (always prefer to use AFormDatetimePicker or AFilterDatetimePicker version, this is a helper component
        for them with main functionality of datetime picking)
      </p>
      <VRow>
        <VCol>
          <ADatetimePickerNew
            v-model="dateTime"
            label="default value null, not clearable, not required"
            :default-value="null"
          />
        </VCol>
      </VRow>
      <VRow>
        <VCol>
          <ADatetimePickerNew
            v-model="dateTimeDefaultNull"
            label="init value null, default value null, clearable, not required"
            :default-value="null"
            clearable
          />
        </VCol>
      </VRow>
      <VRow>
        <VCol>
          <ADatetimePickerNew
            v-model="dateTime"
            label="default value 2020-01-01T09:15:00.000000Z, clearable, required"
            default-value="2020-01-01T09:15:00.000000Z"
            clearable
            required
          />
        </VCol>
      </VRow>
    </VCardText>
  </VCard>

  <VCard>
    <VCardTitle>AFormDatetimePicker component reactivity test</VCardTitle>
    <VCardText>
      <VRow>
        <VCol> Current value: <ADatetime :date-time="dateTimeDefaultNull" /> </VCol>
      </VRow>
      <VRow>
        <VCol>
          <AFormDatetimePicker
            v-model="dateTimeDefaultNull"
            clearable
          />
        </VCol>
      </VRow>
      <VRow>
        <VCol> Current value: <ADatetime :date-time="dateTime" /> </VCol>
      </VRow>
      <VRow>
        <VCol>
          <AFormDatetimePicker
            v-model="dateTime"
            clearable
          />
        </VCol>
      </VRow>
      <VRow>
        <VCol>
          <ABtnPrimary @click="changeToNow">
            Change to now
          </ABtnPrimary>
        </VCol>
      </VRow>
    </VCardText>
  </VCard>
  <VCard>
    <VCardTitle>AFormFlagDatetimePicker component test</VCardTitle>
    <VCardText>
      <VRow>
        <VCol>
          <AFormFlagDatetimePicker
            v-model="dateTime"
            label="test with value set by default"
          />
        </VCol>
      </VRow>
      <VRow>
        <VCol>
          <AFormFlagDatetimePicker
            v-model="dateTimeDefaultNull"
            label="test with null set by default"
          />
        </VCol>
      </VRow>
    </VCardText>
  </VCard>
</template>
