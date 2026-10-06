<script lang="ts" setup>
import { watch } from 'vue'
import useVuelidate from '@vuelidate/core'
import type { ValidationScope } from '@/shared/types/Validation'

// The elements behind "show all", under a collector of their own: the form has to know whether what
// fails is in here, to show it. The elements report to this collector, and it reports to the form.
const props = withDefaults(
  defineProps<{
    visible: boolean
    validationScope?: ValidationScope
  }>(),
  {
    validationScope: undefined,
  }
)

const emit = defineEmits<{
  (e: 'error', isError: boolean): void
}>()

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const v$ = useVuelidate({ $scope: props.validationScope })

// Whether an element in here shows a message: after a save that touched them all, and also when the user
// left one of them invalid (the collector as a whole is in error only once every element was touched).
watch(
  () => v$.value.$errors.length > 0,
  (isError) => emit('error', isError)
)
</script>

<template>
  <div
    v-show="visible"
    class="w-100"
  >
    <slot />
  </div>
</template>
