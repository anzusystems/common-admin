<script setup lang="ts">
const props = withDefaults(defineProps<{ id?: IntegerId }>(), { id: 0 })
const emit = defineEmits<{ change: [value: number] }>()
const model = defineModel<number>()
const count = ref(props.id)
defineExpose({ count })
const onClick = () => emit('change', count.value + (model.value ?? 0))
</script>

<template>
  <button @click="onClick">{{ count }}</button>
</template>
