<script lang="ts" setup>
withDefaults(
  defineProps<{
    title?: string
    value?: string | number | undefined | null
    dataCy?: string | undefined
    titleClass?: string | undefined
  }>(),
  {
    title: '',
    value: '',
    dataCy: undefined,
    titleClass: 'font-weight-bold text-label-large',
  }
)
</script>

<template>
  <VRow :data-cy="dataCy">
    <VCol>
      <h4
        v-if="title.length"
        :class="titleClass"
      >
        {{ title }}
      </h4>
      <slot>
        <span class="text-high-emphasis">{{ value }}</span>
      </slot>
    </VCol>
  </VRow>
</template>
