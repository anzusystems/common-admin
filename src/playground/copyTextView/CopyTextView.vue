<script setup lang="ts">
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import { ref } from 'vue'
import ACopyText from '@/components/ACopyText.vue'

const copyTextFirst = ref('copyTextFirst')
const copyTextSecond = ref('copyTextSecond')
const copyTextThird = ref('copyTextThird')
</script>

<template>
  <ActionbarWrapper />
  <VCard>
    <VCardTitle>Copy text</VCardTitle>
    <VCardText>
      <VRow>
        <VCol cols="4">
          <ACopyText :value="copyTextFirst" />
        </VCol>
      </VRow>
      <VRow>
        <VCol cols="4">
          <ACopyText :value="copyTextSecond">
            <template #activator="{ props }">
              <ABtnPrimary
                text="Click me to copy"
                v-bind="props"
              />
            </template>
          </ACopyText>
        </VCol>
      </VRow>
      <VRow>
        <VCol cols="4">
          <ACopyText :value="copyTextThird">
            <template #activator="{ props }">
              <VBtn v-bind="props">
                <VIcon icon="mdi-content-copy" />
              </VBtn>
            </template>
          </ACopyText>
        </VCol>
      </VRow>
    </VCardText>
  </VCard>
</template>
