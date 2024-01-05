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
            <template #activator="{ onClick, isSupported }">
              <ABtnPrimary
                :disabled="!isSupported"
                text="Click me to copy"
                @click.stop="onClick"
              />
            </template>
          </ACopyText>
        </VCol>
      </VRow>
      <VRow>
        <VCol cols="4">
          <ACopyText :value="copyTextThird">
            <template #activator="{ onClick, isSupported }">
              <VBtn
                :disabled="!isSupported"
                @click.stop="onClick"
              >
                <VIcon icon="mdi-content-copy" />
              </VBtn>
            </template>
          </ACopyText>
        </VCol>
      </VRow>
    </VCardText>
  </VCard>
</template>
