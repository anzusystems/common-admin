<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useTheme } from '@/domains/system/composables/themeSettings'
import { AssetDetailTabImageWithRoi, useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { type AssetDetailView, pictureIsPlaceholder } from '@/domains/dam/assetDetail/composables/assetDetailView'
import AssetDetailDialogLoader from '@/domains/dam/assetDetail/components/AssetDetailDialogLoader.vue'
import AssetImage from '@/domains/dam/assetDetail/components/AssetImage.vue'
import DamAssetImageRoiSelectLazy from '@/domains/dam/cropper/components/DamAssetImageRoiSelectLazy.vue'
import { useAuthHelpers } from '@/domains/auth/composables/defineAuth'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import type { IntegerId } from '@/shared/types/common'
import { isNull } from '@/shared/utils/common'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'

// The frame of the detail of an asset and of the dialog of a single upload: the dialog, its toolbar, the picture or
// the editor of the region of interest on the left, the sidebar on the right. What it draws comes from the view.

const props = withDefaults(
  defineProps<{
    loading: boolean
    view: AssetDetailView | null
    extSystem: IntegerId
    configName?: string
  }>(),
  {
    configName: undefined,
  }
)

const emit = defineEmits<{
  (e: 'close'): void
}>()

defineSlots<{
  title(): unknown
  'toolbar-actions'(): unknown
  /** Over the picture: given, picture and overlay share a positioned box. */
  'image-overlay'?(): unknown
  sidebar(props: { view: AssetDetailView }): unknown
}>()
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const damConfigName = useDamConfigName(props.configName)

const { t } = useI18n()
const { canSafeHelper } = useAuthHelpers()
const { toolbarColor } = useTheme()

const { activeTab } = storeToRefs(useAssetDetailStore())

const { roiUpdateAcl } = useCommonAdminCoreDamOptions(damConfigName)
// The endpoint refuses the region's save without it: the region tab then only shows the image.
const roiEditable = computed(() => isNull(roiUpdateAcl) || canSafeHelper(roiUpdateAcl, undefined, 'roi'))

const sidebar = ref(true)

const toggleSidebar = () => {
  sidebar.value = !sidebar.value
}

const picture = computed(() => {
  if (!props.view) return {}
  const { image } = props.view
  return {
    assetType: props.view.assetType,
    assetStatus: props.view.assetStatus,
    src: image.src,
    backgroundColor: image.backgroundColor,
    width: image.width,
    height: image.height,
    showUploading: image.uploading,
    showProcessing: image.processing,
    showWaiting: image.waiting,
    showDone: image.done,
    uploadingProgress: image.progress,
    remainingTime: image.remainingTime,
    aspectRatio: image.aspectRatio,
    useComponent: true,
  }
})
</script>

<template>
  <VDialog
    :model-value="true"
    fullscreen
    eager
  >
    <AssetDetailDialogLoader
      v-if="loading"
      @close-dialog="emit('close')"
    />
    <VCard
      v-else-if="view"
      class="dam-image-detail"
      :class="{ 'dam-image-detail--sidebar-active': sidebar }"
    >
      <div class="dam-image-detail__wrapper d-flex flex-column">
        <VToolbar
          :color="toolbarColor"
          density="compact"
          :height="64"
          class="border-b pr-1"
        >
          <div class="text-label-large d-flex px-2">
            <slot name="title" />
          </div>
          <VSpacer />
          <div class="pr-2">
            <VBtn
              :aria-label="t('common.damImage.asset.detail.toggleInfo')"
              :active="sidebar"
              :variant="sidebar ? 'flat' : 'text'"
              :color="sidebar ? 'secondary' : ''"
              icon
              class="mr-1"
              :width="36"
              :height="36"
              @click.stop="toggleSidebar"
            >
              <VIcon
                icon="mdi-information-outline"
                class="d-none d-md-flex"
              />
              <VIcon
                icon="mdi-image-outline"
                class="d-flex d-md-none"
              />
              <VTooltip
                activator="parent"
                location="bottom"
              >
                {{ t('common.damImage.asset.detail.toggleInfo') }}
              </VTooltip>
            </VBtn>
            <slot name="toolbar-actions" />
          </div>
        </VToolbar>
        <div class="d-flex w-100 h-100 position-relative dam-image-detail__content">
          <div class="d-flex w-100 align-center dam-image-detail__left">
            <div
              v-if="(activeTab === AssetDetailTabImageWithRoi.ROI && view.roiEditorTab) || view.simpleMode"
              class="w-100 h-100 pa-2 d-flex align-center justify-center"
            >
              <DamAssetImageRoiSelectLazy
                :ext-system="extSystem"
                :config-name="damConfigName"
                :readonly="!roiEditable"
              />
            </div>
            <div
              v-else
              class="w-100 h-100 pa-2 d-flex align-center justify-center"
            >
              <!-- Around the grey placeholder the box is as large as this area, as the placeholder is without an
                   overlay: it fills it, and the overlay covers it. Around a picture it keeps the picture's size. -->
              <div
                v-if="$slots['image-overlay']"
                class="position-relative"
                :class="{ 'w-100 h-100 d-flex align-center justify-center': pictureIsPlaceholder(view) }"
              >
                <AssetImage v-bind="picture" />
                <slot name="image-overlay" />
              </div>
              <AssetImage
                v-else
                v-bind="picture"
              />
            </div>
          </div>
          <div class="h-100 d-flex dam-image-detail__sidebar border-s">
            <slot
              name="sidebar"
              :view="view"
            />
          </div>
        </div>
      </div>
    </VCard>
  </VDialog>
</template>
