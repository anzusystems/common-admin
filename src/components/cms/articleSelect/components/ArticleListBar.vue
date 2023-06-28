<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { useSidebar } from '@/components/cms/articleSelect/composables/filterSidebar'

const { t } = useI18n()
const { toggleSidebar } = useSidebar()
</script>

<template>
  <VToolbar
    density="compact"
    color="transparent"
    :height="46"
    elevation="0"
    class="system-border-b subject-select__second-bar"
  >
    <slot name="second-bar">
      <div class="d-flex flex-column w-100 px-1 align-center">
        <div class="d-flex justify-space-between w-100 align-center">
          <div class="d-flex align-center">
            <VBtn
              icon
              :width="30"
              :height="30"
              @click="toggleSidebar"
            >
              <VIcon
                icon="mdi-tune"
                :size="16"
              />
              <VTooltip
                activator="parent"
                location="bottom"
              >
                {{ t('common.articleSelect.meta.filter.toggle') }}
              </VTooltip>
            </VBtn>
            <slot name="second-bar-left" />
          </div>
        </div>
      </div>
    </slot>
  </VToolbar>
</template>
