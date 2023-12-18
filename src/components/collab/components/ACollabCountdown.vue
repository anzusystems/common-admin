<script setup lang="ts">
import { onMounted, onUnmounted, type Ref, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    label?: string
    seconds?: number
    parentheses?: boolean
  }>(),
  {
    label: '',
    seconds: 60,
    parentheses: false,
  }
)
const emit = defineEmits<{
  (e: 'done'): void
}>()

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const countdown = ref(props.seconds)
const countdownTimer: Ref<ReturnType<typeof setTimeout> | undefined> = ref(undefined)

watch(
  countdown,
  (newValue) => {
    if (newValue > 0) {
      countdownTimer.value = setTimeout(() => countdown.value--, 1000)
    } else {
      emit('done')
    }
  },
  { immediate: true }
)

onMounted(() => {
  countdown.value = props.seconds
})

onUnmounted(() => {
  clearTimeout(countdownTimer.value)
  countdownTimer.value = undefined
})
</script>

<template>
  <span>
    <span v-if="parentheses">(</span>
    <span
      v-if="label"
      class="font-weight-bold mr-1"
    >{{ label }}
    </span>
    <span>{{ countdown }}</span>
    <span v-if="parentheses">)</span>
  </span>
</template>
