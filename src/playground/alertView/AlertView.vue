<script lang="ts" setup>
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import { useAlerts } from '@/domains/system/composables/alerts'

const { showError } = useAlerts()
const alert = () => {
  showError('Error test')
}
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardTitle>Alert</VCardTitle>
    <VCardText>
      <VRow>
        <VCol>
          <VBtn @click.stop="alert">Test</VBtn>
        </VCol>
      </VRow>
    </VCardText>
  </VCard>
</template>
