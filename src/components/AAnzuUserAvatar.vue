<script lang="ts" setup>
import { computed } from 'vue'
import type { AnzuUser } from '@/types/AnzuUser'

const props = withDefaults(
  defineProps<{
    user?: AnzuUser | undefined | null
    size?: number
    containerClass?: string
  }>(),
  {
    user: undefined,
    size: 36,
    containerClass: '',
  }
)

const color = computed(() => {
  if (props.user?.avatar.color && props.user.avatar.color.length === 7) {
    return props.user.avatar.color
  }
  return '#3f6ad8'
})

const fontSize = computed(() => {
  return props.size * 0.5 + 'px'
})

const text = computed(() => {
  if (!props.user) return ''
  if (props.user.avatar.text.length > 0) return props.user.avatar.text
  const firstNameLastName = props.user.person.firstName.charAt(0) + props.user.person.lastName.charAt(0)
  if (firstNameLastName.length > 0) return firstNameLastName
  return props.user.email.slice(0, 2)
})
</script>

<template>
  <VAvatar
    :color="color"
    class="text-uppercase"
    :class="containerClass"
    :size="size"
  >
    <div
      class="d-inline-flex text-white font-weight-light"
      :style="{ fontSize: fontSize }"
    >
      {{ text }}
    </div>
  </VAvatar>
  <div />
</template>
