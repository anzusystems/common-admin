<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { AssetSelectGridView, useGridView } from '@/components/dam/assetSelect/composables/assetSelectGridView'
import { useSidebar } from '@/components/dam/assetSelect/composables/assetSelectFilterSidebar'

const { t } = useI18n()
const { setGridView } = useGridView()
const { toggleSidebarLeft, sidebarLeft, toggleSidebarRight, sidebarRight } = useSidebar()
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
              @click="toggleSidebarLeft"
              :active="sidebarLeft"
            >
              <VIcon
                icon="mdi-tune"
                :size="16"
              />
              <VTooltip
                activator="parent"
                location="bottom"
              >
                {{ t('common.assetSelect.meta.filter.toggle') }}
              </VTooltip>
            </VBtn>
            <slot name="second-bar-left" />
          </div>
          <div class="d-flex align-center">
            <slot name="second-bar-right" />
            <VBtn
              size="x-small"
              icon
              variant="text"
              @click.stop="setGridView(AssetSelectGridView.Masonry)"
            >
              <VIcon icon="mdi-view-compact" />
              <VTooltip
                activator="parent"
                location="bottom"
              >
                {{ t('common.assetSelect.meta.grid.masonry') }}
              </VTooltip>
            </VBtn>
            <VBtn
              icon
              size="x-small"
              variant="text"
              @click.stop="setGridView(AssetSelectGridView.Thumbnail)"
            >
              <VIcon icon="mdi-view-grid" />
              <VTooltip
                activator="parent"
                location="bottom"
              >
                {{ t('common.assetSelect.meta.grid.thumbnail') }}
              </VTooltip>
            </VBtn>
            <VBtn
              size="x-small"
              icon
              variant="text"
              @click.stop="setGridView(AssetSelectGridView.Table)"
            >
              <VIcon icon="mdi-view-headline" />
              <VTooltip
                activator="parent"
                location="bottom"
              >
                {{ t('common.assetSelect.meta.grid.table') }}
              </VTooltip>
            </VBtn>
            <VDivider
              vertical
              class="mx-1 my-2"
            />
            <VBtn
              icon
              :width="30"
              :height="30"
              @click="toggleSidebarRight"
              :active="sidebarRight"
            >
              <VIcon
                icon="mdi-information-outline"
                :size="16"
              />
              <VTooltip
                activator="parent"
                location="bottom"
              >
                {{ t('common.assetSelect.meta.info.toggle') }}
              </VTooltip>
            </VBtn>
          </div>
        </div>
      </div>
    </slot>
  </VToolbar>
</template>
