<script lang="ts" setup>
// @ts-nocheck
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
  },
)
</script>

<template>
  <Notifications
    :max="max"
    :group="group"
    :position="position"
    :width="width"
    :class="['a-alerts', customClass]"
  >
    <template #body="props">
      <VAlert
        :type="props.item.type"
        :title="props.item.title"
        :text="props.item.text"
        class="ma-1"
        density="compact"
        data-cy="page-title"
      >
        <template #close>
          <VIcon
            icon="mdi-close"
            @click.stop="props.close"
          />
        </template>
      </VAlert>
    </template>
  </Notifications>
</template>

<style lang="scss">
@use 'sass:map';
@use 'vuetify/lib/styles/settings/_variables.scss' as vars;

.a-alerts {
  @media #{map.get(vars.$display-breakpoints, 'md-and-down')} {
    width: 96% !important;
    left: 2% !important;
  }
}
</style>
