<script lang="ts" setup>
import { computed, ref, withModifiers } from 'vue'
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import { useI18n } from 'vue-i18n'
import { useSidebar } from '@/components/cms/articleSelect/composables/filterSidebar'
import type { DocId } from '@/types/common'
import { useArticleListActions } from '@/components/cms/articleSelect/composables/articleListActions'
import ArticleListTable from '@/components/cms/articleSelect/components/ArticleListTable.vue'
import ArticleFilter from '@/components/cms/articleSelect/components/ArticleFilter.vue'
import ArticleListBar from '@/components/cms/articleSelect/components/ArticleListBar.vue'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    minCount: number
    maxCount: number
  }>(),
  {}
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: boolean): void
  (e: 'onConfirm', data: DocId[]): void
  (e: 'onOpen'): void
  (e: 'onClose'): void
}>()

const { initStoreContext, selectedCount, loader, pagination, fetchNextPage, resetArticleList, getSelectedDocIds } =
  useArticleListActions()

const { openSidebar, sidebarLeft } = useSidebar()

const onOpen = () => {
  initStoreContext(1 === props.minCount && props.minCount === props.maxCount, props.minCount, props.maxCount)
  resetArticleList()
  openSidebar()
  emit('onOpen')
  dialog.value = true
}

const onClose = () => {
  emit('onClose')
  dialog.value = false
}

const onConfirm = () => {
  emit('onConfirm', getSelectedDocIds())
  onClose()
}

const autoloadOnIntersect = (isIntersecting: boolean) => {
  if (isIntersecting && pagination.hasNextPage === true) {
    fetchNextPage()
  }
}

const dialog = ref(false)

const disabledSubmit = computed(() => {
  return selectedCount.value < props.minCount || selectedCount.value > props.maxCount
})
</script>

<template>
  <slot
    name="activator"
    :props="{ onClick: withModifiers(() => onOpen(), ['stop']) }"
  >
    <ABtnPrimary
      rounded="pill"
      @click.stop="onOpen"
    />
  </slot>
  <VDialog
    :model-value="dialog"
    fullscreen
    class="subject-select"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <VCard
      v-if="dialog"
      class="subject-select__card"
    >
      <ADialogToolbar
        class="subject-select__toolbar system-border-b"
        @on-cancel="onClose"
      >
        <slot name="title">
          {{ t('common.articleSelect.meta.texts.title') }}
        </slot>
      </ADialogToolbar>
      <ArticleListBar />
      <div
        class="subject-select__main"
        :class="{ 'subject-select__main--sidebar-active': sidebarLeft }"
      >
        <div class="subject-select__sidebar system-border-r">
          <ArticleFilter />
        </div>
        <div class="subject-select__content">
          <ArticleListTable />
          <div class="d-flex w-100 align-center justify-center pa-4">
            <ABtnSecondary
              v-show="pagination.hasNextPage || loader"
              v-intersect="autoloadOnIntersect"
              :loading="loader"
              size="small"
              @click="fetchNextPage"
            >
              <slot name="button-confirm-title">
                {{ t('common.articleSelect.meta.controls.loadMore') }}
              </slot>
            </ABtnSecondary>
          </div>
        </div>
      </div>
      <div class="subject-select__actions system-border-t">
        <div v-if="props.minCount === props.maxCount">
          {{ t('common.articleSelect.meta.texts.pickExactCount', { count: props.minCount, selected: selectedCount }) }}
        </div>
        <div v-else>
          {{
            t('common.articleSelect.meta.texts.pickRangeCount', {
              minCount: props.minCount,
              maxCount: props.maxCount,
              selected: selectedCount,
            })
          }}
        </div>
        <VSpacer />
        <ABtnPrimary
          :disabled="disabledSubmit"
          @click.stop="onConfirm"
        >
          <slot name="button-confirm-title">
            {{ t('common.articleSelect.meta.controls.confirm') }}
          </slot>
        </ABtnPrimary>
      </div>
    </VCard>
  </VDialog>
</template>
