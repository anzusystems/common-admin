<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { AssetSelectGridView, useGridView } from '@/components/dam/assetSelect/composables/assetSelectGridView'
import { useSidebar } from '@/components/dam/assetSelect/composables/assetSelectFilterSidebar'
import { computed } from 'vue'
import { DamAssetType, type DamAssetTypeType } from '@/types/coreDam/Asset.ts'
import { useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore.ts'
import { storeToRefs } from 'pinia'

withDefaults(
  defineProps<{
    showTypes?: boolean
  }>(),
  {
    showTypes: false,
  }
)
const emit = defineEmits<{
  (e: 'typeChange', data: DamAssetTypeType | 'podcast'): void
}>()

const { t } = useI18n()
const { setGridView } = useGridView()
const { toggleSidebarLeft, sidebarLeft, toggleSidebarRight, sidebarRight } = useSidebar()
const assetSelectStore = useAssetSelectStore()
const { assetType } = storeToRefs(assetSelectStore)

const isImageActive = computed(() => {
  return assetType.value === DamAssetType.Image
})

const isVideoActive = computed(() => {
  return assetType.value === DamAssetType.Video
})

const isPodcastActive = computed(() => {
  return assetType.value === 'podcast'
})

const setFilterImage = () => {
  assetType.value = DamAssetType.Image
  emit('typeChange', DamAssetType.Image)
}

const setFilterVideo = () => {
  assetType.value = DamAssetType.Video
  emit('typeChange', DamAssetType.Video)
}

const setFilterPodcast = () => {
  assetType.value = 'podcast'
  emit('typeChange', 'podcast')
}
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
              :active="sidebarLeft"
              @click="toggleSidebarLeft"
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
            <template v-if="showTypes">
              <VDivider
                vertical
                class="ml-1 mr-2 my-2"
              />
              <VBtn
                icon
                :width="30"
                :height="30"
                class="mr-1"
                data-cy="button-image-types"
                :active="isImageActive"
                :color="isImageActive ? 'secondary' : ''"
                :variant="isImageActive ? 'flat' : 'text'"
                @click.stop="setFilterImage"
              >
                <VIcon
                  icon="mdi-image"
                  :size="16"
                />
                <VTooltip
                  activator="parent"
                  location="bottom"
                >
                  {{ t('common.assetSelect.assetType.image') }}
                </VTooltip>
              </VBtn>
              <VBtn
                icon
                :width="30"
                :height="30"
                class="mr-1"
                data-cy="button-video-types"
                :active="isVideoActive"
                :color="isVideoActive ? 'secondary' : ''"
                :variant="isVideoActive ? 'flat' : 'text'"
                @click.stop="setFilterVideo"
              >
                <VIcon
                  icon="mdi-video"
                  :size="16"
                />
                <VTooltip
                  activator="parent"
                  location="bottom"
                >
                  {{ t('common.assetSelect.assetType.video') }}
                </VTooltip>
              </VBtn>
              <VBtn
                icon
                :width="30"
                :height="30"
                data-cy="button-in-podcast-types"
                :active="isPodcastActive"
                :color="isPodcastActive ? 'secondary' : ''"
                :variant="isPodcastActive ? 'flat' : 'text'"
                @click.stop="setFilterPodcast"
              >
                <VIcon
                  icon="mdi-podcast"
                  :size="16"
                />
                <VTooltip
                  activator="parent"
                  location="bottom"
                >
                  {{ t('common.assetSelect.filter.inPodcast') }}
                </VTooltip>
              </VBtn>
            </template>
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
              :active="sidebarRight"
              @click="toggleSidebarRight"
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
