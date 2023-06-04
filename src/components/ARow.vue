<script lang="ts" setup>
import type { ARowProps } from '@/components/ARowProps'

withDefaults(
  defineProps<ARowProps>(),
  {
    title: '',
    value: '',
    dataCy: undefined,
    titleClass: 'text-subtitle-2',
  }
)
</script>

<template>
  <VRow :data-cy="dataCy">
    <VCol>
      <h4
        v-if="title.length"
        class="text-subtitle-2"
      >
        {{ title }}
      </h4>
      <slot>
        <span class="text-high-emphasis">{{ value }}</span>
      </slot>
    </VCol>
  </VRow>
</template>
