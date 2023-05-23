<script lang="ts" setup>

import { useI18n } from 'vue-i18n'
import { GridView, useGridView } from '@/components/dam/assetSelect/composables/gridView'
import { useSidebar } from '@/components/dam/assetSelect/composables/filterSidebar'

const { t } = useI18n()
const { setGridView } = useGridView()
const { sidebarLeft } = useSidebar()

</script>

<template>
  <VToolbar
    density="compact"
    color="transparent"
    class="system-border-b"
  >
    <slot name="second-bar">
      <div class="d-flex flex-column w-100 px-1 align-center">
        <div class="d-flex justify-space-between w-100 align-center">
          <div class="d-flex align-center">
            <VBtn
              icon
              :width="30"
              :height="30"
              @click="sidebarLeft = !sidebarLeft"
            >
              <VIcon
                icon="mdi-tune"
                :size="16"
              />
              <VTooltip
                activator="parent"
                location="bottom"
              >
                {{ t('coreDam.asset.list.filterToggle') }}
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
              @click.stop="setGridView(GridView.Masonry)"
            >
              <VIcon icon="mdi-view-compact" />
              <VTooltip
                activator="parent"
                location="bottom"
              >
                {{ t('coreDam.asset.list.gridView.masonry') }}
              </VTooltip>
            </VBtn>
            <VBtn
              icon
              size="x-small"
              variant="text"
              @click.stop="setGridView(GridView.Thumbnail)"
            >
              <VIcon icon="mdi-view-grid" />
              <VTooltip
                activator="parent"
                location="bottom"
              >
                {{ t('coreDam.asset.list.gridView.thumbnail') }}
              </VTooltip>
            </VBtn>
            <VBtn
              size="x-small"
              icon
              variant="text"
              @click.stop="setGridView(GridView.Table)"
            >
              <VIcon icon="mdi-view-headline" />
              <VTooltip
                activator="parent"
                location="bottom"
              >
                {{ t('coreDam.asset.list.gridView.table') }}
              </VTooltip>
            </VBtn>
          </div>
        </div>
      </div>
    </slot>
  </VToolbar>
</template>
