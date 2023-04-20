<script setup lang="ts">
import type { LanguageCode } from '@/composables/languageSettings'
import { computed } from 'vue'
import FlagSk from '@/components/flags/FlagSk.vue'
import FlagEn from '@/components/flags/FlagEn.vue'
import FlagEmpty from '@/components/flags/FlagEmpty.vue'

// flag source: https://github.com/hampusborgos/country-flags

const props = withDefaults(
  defineProps<{
    code?: LanguageCode | undefined
    dataCy?: string
  }>(),
  {
    code: 'xx',
    dataCy: 'flag-country',
  }
)

const currentFlagComponent = computed(() => {
  switch (props.code) {
    case 'sk':
      return FlagSk
    case 'en':
      return FlagEn
    default:
      return FlagEmpty
  }
})
</script>

<template>
  <div class="flag">
    <component
      :is="currentFlagComponent"
      :data-cy="dataCy"
    />
  </div>
</template>
