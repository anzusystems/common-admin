<script lang="ts" setup>
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import { useI18n } from 'vue-i18n'
import { inject, ref, watch } from 'vue'
import AFormTextField from '@/components/form/AFormTextField.vue'
import ARow from '@/components/ARow.vue'
import AFormSwitch from '@/components/form/AFormSwitch.vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'
import type { AxiosInstance } from 'axios'
import type { IntegerId } from '@/types/common'
import { MAX_BOOKMARK_ITEMS, useFilterBookmarkStore } from '@/labs/filters/bookmarksStore'
import { useUserAdminConfigApi } from '@/labs/filters/userAdminConfig'
import { useAlerts } from '@/composables/system/alerts'
import { useUserAdminConfigFactory } from '@/model/factory/UserAdminConfigFactory'
import { type UserAdminConfig, UserAdminConfigLayoutType, UserAdminConfigType } from '@/types/UserAdminConfig'
import useVuelidate from '@vuelidate/core'
import { useValidate } from '@/validators/vuelidate/useValidate'
import { cloneDeep, isUndefined } from '@/utils/common'
import { DatatablePaginationKey, FilterConfigKey, FilterDataKey } from '@/labs/filters/filterInjectionKeys'
import { useFilterHelpers } from '@/labs/filters/filterFactory'
import AUnsavedConfirmDialog from '@/labs/unsavedGuard/AUnsavedConfirmDialog.vue'
import { useUnsavedChangesGuard } from '@/labs/unsavedGuard/useUnsavedChangesGuard'
import { hasAnzuApiValidationErrorSpecific, isAnzuApiValidationError } from '@/model/error/AnzuApiValidationError'

const props = withDefaults(
  defineProps<{
    client: () => AxiosInstance
    system: string
    subject: string
    user: IntegerId
    datatableHiddenColumns?: string[] | undefined
  }>(),
  {
    datatableHiddenColumns: undefined,
  }
)

const emit = defineEmits<{
  (e: 'onClose'): void
}>()

const filterConfig = inject(FilterConfigKey)
const filterData = inject(FilterDataKey)
const pagination = inject(DatatablePaginationKey)

if (isUndefined(pagination) || isUndefined(filterConfig) || isUndefined(filterData)) {
  throw new Error('Incorrect provide/inject config.')
}

// The dialog is mounted behind the parent's `v-if`, so it had no model of its own -- and the guard
// needs one to watch. Closing now runs through here: `requestClose` lets the guard ask first,
// `forceClose` is for the paths that already are the confirmation.
const isOpen = ref(true)

const guard = useUnsavedChangesGuard({
  sources: [],
  guardDialogModel: isOpen,
  guardRoute: false,
  guardWindowUnload: false,
})

watch(isOpen, (open) => {
  if (!open) emit('onClose')
})

const requestClose = () => {
  isOpen.value = false
}

const forceClose = () => {
  guard.acknowledge()
  isOpen.value = false
}

const activeTab = ref<'add' | 'manage'>('add')
const customName = ref('')
const storeDatatableHiddenColumns = ref(false)
const storeDatatableOrder = ref(false)
const saveButtonLoading = ref(false)
const listLoading = ref(false)
const errorCount = ref(false)
const itemsManage = ref<Array<UserAdminConfig>>([])

interface RowUpdate {
  update: (next: UserAdminConfig) => void
}

const MAX_BOOKMARK_NAME_LENGTH = 100

// The editor owns opening a row, saving it and cancelling out of it, so the rename no longer needs
// its own held copy, its own vuelidate instance or its own confirm/cancel buttons. What is left is
// the rule itself, which drives the editor's red rail and blocks its save.
const validateBookmarkName = (item: UserAdminConfig): boolean =>
  !!item.customName && item.customName.length <= MAX_BOOKMARK_NAME_LENGTH

const { required, maxLength } = useValidate()
const rulesCreate = {
  customName: {
    required,
    maxLength: maxLength(MAX_BOOKMARK_NAME_LENGTH),
  },
}
const vCreate$ = useVuelidate(rulesCreate, { customName }, { $stopPropagation: true })
const filterBookmarkStore = useFilterBookmarkStore()

const {
  createUserAdminConfig,
  useFetchUserAdminConfigList,
  updateUserAdminConfigPositions,
  deleteUserAdminConfig,
  updateUserAdminConfig,
} =
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
  useUserAdminConfigApi(props.client, props.system)
const { t } = useI18n()
const { showErrorsDefault, showValidationError, showWarningT } = useAlerts()
const { createDefaultUserAdminConfig } = useUserAdminConfigFactory()

const sortItems = async () => {
  saveButtonLoading.value = true
  const items = itemsManage.value
  const ids = items.map((item) => item.id)
  try {
    await updateUserAdminConfigPositions(ids)
    saveButtonLoading.value = false
    await reloadItems()
    forceClose()
  } catch (e) {
    showErrorsDefault(e)
    saveButtonLoading.value = false
  }
}

const { serializeFilters } = useFilterHelpers(filterData, filterConfig)

const systemResource = props.system + '_' + props.subject

const addBookmark = async () => {
  saveButtonLoading.value = true
  errorCount.value = false
  const config = createDefaultUserAdminConfig(props.system)
  config.user = props.user
  config.configType = UserAdminConfigType.FilterBookmark
  config.layoutType = UserAdminConfigLayoutType.Desktop
  config.systemResource = systemResource
  config.customName = customName.value
  config.data = {
    filter: serializeFilters(filterData, pagination, false),
    datatableHiddenColumns:
      storeDatatableHiddenColumns.value && props.datatableHiddenColumns ? props.datatableHiddenColumns : undefined,
    sortBy: storeDatatableOrder.value && pagination.value.sortBy ? pagination.value.sortBy : undefined,
  }
  try {
    const count = await filterBookmarkStore.fetchBookmarksCount(
      {
        user: props.user,
        layoutType: UserAdminConfigLayoutType.Desktop,
        systemResource: systemResource,
      },
      useFetchUserAdminConfigList
    )
    if (count >= MAX_BOOKMARK_ITEMS) {
      errorCount.value = true
      saveButtonLoading.value = false
      return
    }
    config.position = count + 1
    const res = await createUserAdminConfig(config)
    filterBookmarkStore.addOne(filterBookmarkStore.generateKey(UserAdminConfigLayoutType.Desktop, systemResource), res)
    forceClose()
  } catch (e) {
    if (
      isAnzuApiValidationError(e) &&
      hasAnzuApiValidationErrorSpecific(e, 'error_field_not_unique', 'cms.userAdminConfig.model.systemResource')
    ) {
      showWarningT('common.filter.bookmark.nameUniqueError')
      return
    }
    showErrorsDefault(e)
  } finally {
    saveButtonLoading.value = false
  }
}

const onConfirm = () => {
  if (activeTab.value === 'add') {
    vCreate$.value.$touch()
    if (vCreate$.value.$invalid) {
      showValidationError()
      return
    }
    addBookmark()
  } else if (activeTab.value === 'manage' && itemsManage.value.length > 0) {
    sortItems()
  }
}

const onDelete = async (item: UserAdminConfig) => {
  listLoading.value = true
  try {
    await deleteUserAdminConfig(item.id)
    await reloadItems()
  } catch (e) {
    showErrorsDefault(e)
  } finally {
    listLoading.value = false
  }
}

// Persists one renamed row. The reload is not optional: the editor's `commitEdit` only closes the
// row, it does not move the baseline, so without it the row would sit amber and the guard would ask
// about a rename already saved -- and the bookmark store would keep handing the filter bar the old
// name. Reloading swaps the editor out for the spinner and back, which re-baselines it on the
// fetched data.
//
// The rethrow is what keeps the row open on failure; the editor skips `commitEdit` when this
// rejects. Without the catch the rejection would leave the click handler unhandled.
const onItemSave = async (item: UserAdminConfig) => {
  try {
    await updateUserAdminConfig(item.id, cloneDeep(item))
  } catch (e) {
    showErrorsDefault(e)
    throw e
  }
  await reloadItems()
}

const reloadItems = async () => {
  listLoading.value = true
  try {
    itemsManage.value = await filterBookmarkStore.getBookmarks(
      {
        user: props.user,
        layoutType: UserAdminConfigLayoutType.Desktop,
        systemResource: systemResource,
      },
      useFetchUserAdminConfigList,
      true
    )
  } catch (e) {
    showErrorsDefault(e)
  } finally {
    listLoading.value = false
  }
}

watch(activeTab, () => {
  errorCount.value = false
  if (activeTab.value === 'manage') {
    reloadItems()
  }
})
</script>

<template>
  <VDialog
    v-model="isOpen"
    :width="500"
  >
    <VCard>
      <ADialogToolbar @on-cancel="requestClose">
        {{ t('common.filter.bookmark.title') }}
      </ADialogToolbar>
      <VCardText class="pt-0">
        <VTabs
          v-model="activeTab"
          fixed-tabs
        >
          <VTab value="add">
            {{ t('common.filter.bookmark.add') }}
          </VTab>
          <VTab value="manage">
            {{ t('common.filter.bookmark.manage') }}
          </VTab>
        </VTabs>
        <div
          v-if="activeTab === 'add'"
          class="w-100 pt-4"
        >
          <ARow :title="t('common.filter.bookmark.infoSave')" />
          <ARow
            v-if="errorCount"
            class="text-error"
            :title="t('common.filter.bookmark.errorMax')"
          />
          <ARow>
            <AFormTextField
              v-model="customName"
              :label="t('common.filter.bookmark.name')"
              required
              :v="vCreate$.customName"
            />
          </ARow>
          <ARow>
            <AFormSwitch
              v-model="storeDatatableHiddenColumns"
              :label="t('common.filter.bookmark.storeTableColumns')"
            />
          </ARow>
          <ARow>
            <AFormSwitch
              v-model="storeDatatableOrder"
              :label="t('common.filter.bookmark.storeTableOrder')"
            />
          </ARow>
        </div>
        <div
          v-else-if="activeTab === 'manage'"
          class="w-100 pt-4"
        >
          <div
            v-if="listLoading"
            class="d-flex w-100 align-center justify-center"
          >
            <VProgressCircular indeterminate />
          </div>
          <!-- Only the order can pend here: a rename saves on the row's own confirm and a delete is
               immediate, so both go clean straight away. A drag waits for the button below, which
               is exactly what the guard asks about on the way out. -->
          <ASortableListEditor
            v-else
            v-model="itemsManage"
            :position="false"
            compact-field="customName"
            :validate="validateBookmarkName"
            :show-add-button="false"
            :unsaved-section-label="t('common.filter.bookmark.unsavedSection')"
            delete-mode="immediate"
            :on-delete="onDelete"
            :on-item-save="onItemSave"
          >
            <template #item="{ raw, actions }: { raw: UserAdminConfig; actions: RowUpdate }">
              <AFormTextField
                :model-value="raw.customName"
                hide-details="auto"
                @update:model-value="actions.update({ ...raw, customName: String($event ?? '') })"
              />
            </template>
          </ASortableListEditor>
        </div>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <ABtnTertiary
          data-cy="button-cancel"
          @click.stop="requestClose"
        >
          {{ t('common.button.cancel') }}
        </ABtnTertiary>
        <ABtnPrimary
          data-cy="button-confirm"
          :loading="saveButtonLoading"
          @click.stop="onConfirm"
        >
          {{ activeTab === 'add' ? t('common.button.add') : t('common.filter.bookmark.saveBookmarkOrder') }}
        </ABtnPrimary>
      </VCardActions>
    </VCard>
  </VDialog>

  <AUnsavedConfirmDialog
    v-model="guard.promptOpen.value"
    :dirty-labels="guard.dirtyLabels.value"
    @resolve="guard.resolvePrompt"
  />
</template>
