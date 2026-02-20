<script lang="ts" setup>
withDefaults(
  defineProps<{
    title?: string
    text?: string
    buttonText?: string
    icon?: string
    iconSize?: string
    returnRouteName?: string
  }>(),
  {
    title: undefined,
    text: undefined,
    buttonText: undefined,
    icon: undefined,
    iconSize: undefined,
    returnRouteName: undefined,
  }
)
</script>

<template>
  <div class="d-flex justify-center align-center fill-height">
    <div class="d-flex flex-column align-center">
      <slot name="default">
        <h1
          v-if="icon || title"
          class="d-flex justify-center align-center text-primary"
        >
          <VIcon
            v-if="icon"
            :size="iconSize"
            :icon="icon"
          />
          <span v-if="title">{{ title }}</span>
        </h1>

        <p
          v-if="text"
          class="pa-4"
        >
          {{ text }}
        </p>

        <ABtnPrimary
          v-if="buttonText && returnRouteName"
          :to="{ name: returnRouteName }"
          size="large"
        >
          {{ buttonText }}
        </ABtnPrimary>
      </slot>
    </div>
  </div>
</template>
