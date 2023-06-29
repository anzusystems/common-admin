<script lang="ts" setup>
import ABooleanValue from '@/components/ABooleanValue.vue'
import ARow from '@/components/ARow.vue'
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardText>
      <ARow>
        <ABooleanValue
          :value="true"
          chip
        />
      </ARow>
      <ARow>
        <ABooleanValue
          :value="true"
          chip
          invert-color
        />
      </ARow>
    </VCardText>
  </VCard>
</template>
