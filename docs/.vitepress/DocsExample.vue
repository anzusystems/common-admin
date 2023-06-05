<script setup lang="ts">
import { useTheme } from 'vuetify'
import { computed, mergeProps, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    hideInvert?: boolean
    scopedDefaultsProvider?: boolean
    title?: string
  }>(),
  {
    hideInvert: false,
    scopedDefaultsProvider: false,
    title: 'Example',
  }
)

const parentTheme = useTheme()
const _theme = ref<null | string>(null)
const theme = computed({
  get: () => _theme.value ?? parentTheme.name.value,
  set: (val) => (_theme.value = val as string),
})
const toggleTheme = () => (theme.value = theme.value === 'light' ? 'dark' : 'light')

const isDark = computed(() => {
  return parentTheme.current.value.dark
})

const actions = computed(() => {
  const array = []

  if (!props.hideInvert) {
    array.push({
      icon: 'mdi-theme-light-dark',
      text: 'Invert theme',
      onClick: toggleTheme,
    })
  }

  return array
})
</script>


<template>
  <VDefaultsProvider :scoped="scopedDefaultsProvider">
    <VSheet
      border
      class="mb-9 overflow-hidden"
      rounded
    >
      <VLazy min-height="44">
        <VToolbar
          :color="isDark ? '#1F1F1F' : 'grey-lighten-4'"
          border="b"
          flat
          height="44"
          class="text-caption text-medium-emphasis pl-4 pr-0"
        >
          <slot name="title"><div>{{ title}}</div></slot>

          <VSpacer />

          <VTooltip
            v-for="({ text, ...action }, i) of actions"
            :key="i"
            location="top"
          >
            <template #activator="{ props: tooltip }">
              <v-btn
                class="ms-2 text-medium-emphasis"
                density="comfortable"
                variant="text"
                v-bind="mergeProps(action as any, tooltip)"
              />
            </template>
            <span>{{ text }}</span>
          </VTooltip>
        </VToolbar>
      </VLazy>

      <div class="d-flex flex-column">
        <VThemeProvider
          :theme="theme"
          class="pa-4 rounded-b"
          with-background
        >
          <ClientOnly>
            <slot />
          </ClientOnly>
        </VThemeProvider>
      </div>
    </VSheet>
  </VDefaultsProvider>
</template>

