<script lang="ts" setup>
withDefaults(
  defineProps<{
    max?: number
    group?: string
    position?: string
    width?: string
    customClass?: string | undefined
  }>(),
  {
    max: 5,
    group: 'alerts',
    position: 'top center',
    width: '50%',
    customClass: undefined,
  }
)
</script>

<template>
  <Notifications :max="max" :group="group" :position="position" :width="width" :class="customClass">
    <template #body="props">
      <VAlert :type="props.item.type" class="ma-1" density="compact">
        <div class="white-space-pre" data-cy="page-title" v-text="props.item.text" />
        <template #close>
          <VIcon icon="mdi-close" @click.stop="props.close" />
        </template>
      </VAlert>
    </template>
  </Notifications>
</template>
