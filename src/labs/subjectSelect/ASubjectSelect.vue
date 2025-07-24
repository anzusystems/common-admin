<script lang="ts" setup generic="TItem">
import { computed, ref, toRaw, withModifiers } from 'vue'
import { isNull, isUndefined } from '@/utils/common'
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import { useI18n } from 'vue-i18n'
import type { Fn } from '@vueuse/core'
import type { Pagination } from '@/labs/filters/pagination'
import ADatatablePagination from '@/labs/filters/ADatatablePagination.vue'

const props = withDefaults(
  defineProps<{
    selectedItems: Array<TItem>
    pagination: Pagination
    submitFilter: Fn
    resetFilter: Fn
    loading?: boolean
    minCount?: number
    maxCount?: number
    modelValue?: boolean | undefined // dialog
    dialogTitleT?: string
    paginationMode?: 'standard' | 'more'
  }>(),
  {
    loading: false,
    minCount: 1,
    maxCount: 1,
    modelValue: undefined,
    dialogTitleT: 'common.subjectSelect.texts.title',
    paginationMode: 'standard',
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: boolean): void
  (e: 'update:pagination', data: Pagination): void
  (e: 'onOpen'): void
  (e: 'onPageChange'): void
  (e: 'onConfirm', data: Array<TItem>): void
  (e: 'onFetchNextPage'): void
}>()

const dialogLocal = ref(false)
const dialog = computed({
  get() {
    if (isUndefined(props.modelValue)) return dialogLocal.value
    return props.modelValue
  },
  set(newValue: boolean) {
    dialogLocal.value = newValue
    emit('update:modelValue', newValue)
  },
})

const paginationComputed = computed({
  get: () => props.pagination,
  set: (newValue) => {
    emit('update:pagination', { ...toRaw(newValue) })
  },
})

const sidebarLeft = ref(true)
const filterTouched = ref(false)

const { t } = useI18n()

const selectedItemsCount = computed(() => {
  return props.selectedItems.length
})

const disabledSubmit = computed(() => {
  return selectedItemsCount.value < props.minCount || selectedItemsCount.value > props.maxCount
})

const onOpen = () => {
  emit('onOpen')
  sidebarLeft.value = true
  dialog.value = true
}

const toggleSidebar = () => {
  sidebarLeft.value = !sidebarLeft.value
}

const onClose = () => {
  dialog.value = false
}

const onConfirm = () => {
  emit(
    'onConfirm',
    props.selectedItems.map((item) => toRaw(item))
  )
  onClose()
}

const fetchNextPage = () => {
  emit('onFetchNextPage')
}

const onPageChange = () => {
  emit('onPageChange')
}

const lastPage = computed(() => {
  return Math.ceil(paginationComputed.value.totalCount / paginationComputed.value.rowsPerPage)
})

const hasNextPage = computed(() => {
  return !(
    (isNull(paginationComputed.value.hasNextPage) && paginationComputed.value.page === lastPage.value) ||
    paginationComputed.value.hasNextPage === false
  )
})

const autoloadOnIntersect = (isIntersecting: boolean) => {
  if (isIntersecting && hasNextPage.value && !props.loading) {
    fetchNextPage()
  }
}

defineExpose({
  open: onOpen,
})
</script>

<template>
  <slot
    name="activator"
    :props="{ onClick: withModifiers(() => onOpen(), ['stop']) }"
  />
  <VDialog
    v-bind="$attrs"
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
          {{ t(dialogTitleT) }}
        </slot>
      </ADialogToolbar>
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
                    {{ t('common.subjectSelect.filter.toggle') }}
                  </VTooltip>
                </VBtn>
                <slot name="second-bar-left" />
              </div>
              <div class="d-flex align-center">
                <slot name="second-bar-right" />
              </div>
            </div>
          </div>
        </slot>
      </VToolbar>
      <div
        class="subject-select__main"
        :class="{ 'subject-select__main--sidebar-active': sidebarLeft }"
      >
        <div class="subject-select__sidebar system-border-r">
          <div class="subject-select-filter">
            <slot name="filter" />
            <!--            <div class="subject-select-filter__content">-->
            <!--              <VForm-->
            <!--                name="search2"-->
            <!--                class="px-2 pt-4"-->
            <!--                @submit.prevent="submitFilter"-->
            <!--              >-->
            <!--                <slot name="filter" />-->
            <!--              </VForm>-->
            <!--            </div>-->
            <!--            <div class="subject-select-filter__actions">-->
            <!--              <VBtn-->
            <!--                color="primary"-->
            <!--                class="mx-2"-->
            <!--                :variant="filterTouched ? 'flat' : 'text'"-->
            <!--                size="small"-->
            <!--                @click.stop="submitFilter"-->
            <!--              >-->
            <!--                {{ t('common.button.submitFilter') }}-->
            <!--              </VBtn>-->
            <!--              <VBtn-->
            <!--                class="px-2"-->
            <!--                color="light"-->
            <!--                min-width="36px"-->
            <!--                variant="flat"-->
            <!--                size="small"-->
            <!--                @click.stop="resetFilter"-->
            <!--              >-->
            <!--                <VIcon icon="mdi-filter-remove-outline" />-->
            <!--                <VTooltip-->
            <!--                  activator="parent"-->
            <!--                  location="bottom"-->
            <!--                >-->
            <!--                  {{ t('common.button.resetFilter') }}-->
            <!--                </VTooltip>-->
            <!--              </VBtn>-->
            <!--            </div>-->
          </div>
        </div>
        <div class="subject-select__content">
          <slot name="content" />
          <div
            v-if="paginationMode === 'more'"
            class="d-flex w-100 align-center justify-center pa-4"
          >
            <ABtnSecondary
              v-show="hasNextPage || loading"
              v-intersect.quiet="autoloadOnIntersect"
              :loading="loading"
              size="small"
              @click="fetchNextPage"
            >
              <slot name="button-confirm-title">
                {{ t('common.button.loadMore') }}
              </slot>
            </ABtnSecondary>
          </div>
          <ADatatablePagination
            v-else
            v-model="paginationComputed"
            @change="onPageChange"
          />
        </div>
      </div>
      <div class="subject-select__actions system-border-t">
        <div v-if="props.minCount === props.maxCount">
          {{ t('common.subjectSelect.texts.pickExactCount', { count: props.minCount, selected: selectedItemsCount }) }}
        </div>
        <div v-else>
          {{
            t('common.subjectSelect.texts.pickRangeCount', {
              minCount: props.minCount,
              maxCount: props.maxCount,
              selected: selectedItemsCount,
            })
          }}
        </div>
        <VSpacer />
        <ABtnPrimary
          :disabled="disabledSubmit"
          @click.stop="onConfirm"
        >
          <slot name="button-confirm-title">
            {{ t('common.button.confirm') }}
          </slot>
        </ABtnPrimary>
      </div>
    </VCard>
  </VDialog>
</template>
