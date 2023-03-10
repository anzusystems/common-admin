<script lang="ts" setup>
withDefaults(
  defineProps<{
    heading?: string
    icon?: string
    dataCy?: string
  }>(),
  {
    heading: '',
    icon: undefined,
    dataCy: 'page-title',
  }
)
</script>

<template>
  <div class="app-page-title-wrapper">
    <div
      v-if="icon"
      class="app-page-title-icon"
    >
      <VIcon
        class="icon-gradient"
        size="x-small"
        :icon="icon"
      />
    </div>
    <div
      class="app-page-title-texts"
      :data-cy="dataCy"
    >
      <h1 class="text-subtitle-1 font-weight-bold pl-2">
        {{ heading }}
      </h1>
    </div>
  </div>
</template>
