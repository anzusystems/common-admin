<script lang="ts" setup>
import ADialogToolbar from '@/domains/ui/components/ADialogToolbar.vue'
import { useI18n } from 'vue-i18n'
import { type Component, inject, ref, shallowRef, useTemplateRef, watch } from 'vue'
import AFormTextField from '@/domains/form/components/AFormTextField.vue'
import ARow from '@/domains/ui/components/ARow.vue'
import AFormSwitch from '@/domains/form/components/AFormSwitch.vue'
import { loadListEditor } from '@/domains/listEditor/utils/listEditorLoader'
import type { ExposedListEditorHandle } from '@/domains/listEditor/composables/useListEditorController'
import type { AxiosInstance } from 'axios'
import type { IntegerId } from '@/shared/types/common'
import { MAX_BOOKMARK_ITEMS, useFilterBookmarkStore } from '@/domains/filters/bookmarks/store/bookmarksStore'
import { useUserAdminConfigApi } from '@/domains/filters/bookmarks/api/userAdminConfigApi'
import { useAlerts } from '@/domains/system/composables/alerts'
import { useUserAdminConfigFactory } from '@/domains/filters/bookmarks/factory/UserAdminConfigFactory'
import {
  type UserAdminConfig,
  UserAdminConfigLayoutType,
  UserAdminConfigType,
} from '@/domains/filters/bookmarks/types/UserAdminConfig'
import useVuelidate from '@vuelidate/core'
import { useValidate } from '@/shared/validators/vuelidate/useValidate'
import { cloneDeep, isUndefined } from '@/shared/utils/common'
import { DatatablePaginationKey, FilterConfigKey, FilterDataKey } from '@/domains/filters/utils/filterInjectionKeys'
import { useFilterHelpers } from '@/domains/filters/composables/filterFactory'
import AUnsavedConfirmDialog from '@/domains/unsavedGuard/components/AUnsavedConfirmDialog.vue'
import { useUnsavedChangesGuard } from '@/domains/unsavedGuard/composables/useUnsavedChangesGuard'
import { hasAnzuApiValidationErrorSpecific, isAnzuApiValidationError } from '@/shared/error/AnzuApiValidationError'
import { isAnzuApiAxiosError } from '@/shared/error/AnzuApiAxiosError'
import { HTTP_STATUS_NOT_FOUND } from '@/shared/statusCodes'

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
  (e: 'close'): void
}>()

const filterConfig = inject(FilterConfigKey)
const filterData = inject(FilterDataKey)
const pagination = inject(DatatablePaginationKey)

if (isUndefined(pagination) || isUndefined(filterConfig) || isUndefined(filterData)) {
  throw new Error('Incorrect provide/inject config.')
}

// The dialog is mounted behind the parent's `v-if`, but the guard needs a model to watch.
// All closing goes through here. `requestClose` lets the guard ask
// first. `forceClose` is for paths that already are the confirmation.
const isOpen = ref(true)

// The editor takes its clean baseline on creation, so it waits for the first fetch.
// After that it stays mounted. It alone registers this tab's pending work
// with the guard, and swapping it out would disarm the guard mid-edit.
const manageLoaded = ref(false)
const loadFailed = ref(false)

// The editor component loads on the first visit to the manage tab (see
// `loadListEditor`). Its chunk load can fail independently of the bookmark fetch.
const listEditor = shallowRef<Component>()
const editorLoadFailed = ref(false)
let editorLoading = false

const loadEditor = async () => {
  if (listEditor.value || editorLoading) return
  editorLoading = true
  editorLoadFailed.value = false
  try {
    listEditor.value = await loadListEditor()
  } catch {
    editorLoadFailed.value = true
  } finally {
    editorLoading = false
  }
}

const guard = useUnsavedChangesGuard({
  sources: [],
  guardDialogModel: isOpen,
  guardRoute: false,
  guardWindowUnload: false,
})

watch(isOpen, (open) => {
  if (!open) emit('close')
})

const requestClose = () => {
  // Not while a write is out. The toolbar X and Escape bypass the write-phase disabling.
  // Closing here would ask whether to discard work already sent to the server, and it would be written anyway.
  if (saveButtonLoading.value) return
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

// The editor handles opening, saving and cancelling a row. Only the rule
// remains here. It drives the editor's red rail and blocks its save.
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
const { showErrorsDefault, showUnknownError, showValidationError, showWarningT } = useAlerts()
const { createDefaultUserAdminConfig } = useUserAdminConfigFactory()

const editor = useTemplateRef<ExposedListEditorHandle<UserAdminConfig>>('editor')

// One save for the whole tab, like other list editors here. A per-row PUT required reloading
// the list to re-baseline, which lost the pending reorder and other rows' typed text.
// A DELETE answered with "not found" means the row is already gone. A retry after a
// lost response looks like this. Otherwise every retry would stop on the same row.
const isAlreadyGone = (e: unknown) => isAnzuApiAxiosError(e) && e.cause.response?.status === HTTP_STATUS_NOT_FOUND

const saveManage = async () => {
  // Not while the list is refreshing: the on-screen order is about to be replaced by the incoming answer.
  // The button is also disabled. This check does not depend on the button.
  if (listLoading.value) return
  if (!editor.value?.validateAll()) return
  saveButtonLoading.value = true
  try {
    const changes = editor.value.getChanges()
    // Deletes first, then renames, then the order. The order comes
    // from `itemsManage`, which the deleted rows have already left.
    for (const item of changes.deleted) {
      try {
        await deleteUserAdminConfig(item.id)
      } catch (e) {
        if (!isAlreadyGone(e)) throw e
      }
      // Removed from the cache right away. The filter bar is reading
      // it, and a later failure in this save would skip the refresh.
      filterBookmarkStore.removeOne(bookmarkCacheKey(), item.id)
      // Dropping the pending deletion makes a retry safe after a later call failed.
      // Resent renames are the same idempotent PUT. A resent DELETE on a
      // gone row would fail and stop the batch at the same place every time.
      editor.value.restoreDeleted(item.id)
    }
    for (const item of changes.updated) {
      await updateUserAdminConfig(item.id, cloneDeep(item))
    }
    // An empty list is not a valid order to send.
    if (itemsManage.value.length > 0) {
      await updateUserAdminConfigPositions(itemsManage.value.map((item) => item.id))
    }
    // Once, at the end. This also refreshes the store the filter
    // bar reads names from, and the editor re-baselines against it.
    applyItems(await fetchItems())
    forceClose()
  } catch (e) {
    showErrorsDefault(e)
    // No refetch and no rollback. Written changes already match the
    // server, and unwritten ones stay for the user to fix and resend.
    // A refetch would discard that unsent work without asking. The store is marked stale instead.
    filterBookmarkStore.markStale(bookmarkCacheKey())
  } finally {
    saveButtonLoading.value = false
  }
}

const { serializeFilters } = useFilterHelpers(filterData, filterConfig)

const systemResource = props.system + '_' + props.subject
const bookmarkCacheKey = () => filterBookmarkStore.generateKey(UserAdminConfigLayoutType.Desktop, systemResource)

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
    const { count, maxPosition } = await filterBookmarkStore.fetchBookmarkStats(
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
    // After the highest used position, not the row count. The manage tab renumbers only the
    // rows it sends, so deletions leave gaps and a row count could reuse a taken position.
    config.position = maxPosition + 1
    const res = await createUserAdminConfig(config)
    filterBookmarkStore.addOne(bookmarkCacheKey(), res)
    // Cleared because `requestClose` may not close. If the guard asks and the user stays, a
    // second click would create the bookmark again. Empty, the `required` rule blocks that.
    customName.value = ''
    vCreate$.value.$reset()
    // The write is done, and `requestClose` refuses while one is out. The `finally` sets it again.
    saveButtonLoading.value = false
    // `requestClose`, not `forceClose`: adding a bookmark says nothing
    // about a reorder pending on the other tab, so the guard still asks.
    requestClose()
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
  } else if (activeTab.value === 'manage') {
    // Not gated on a non-empty list. Deleting every row empties it while
    // the deletions are still pending, and only this button sends them.
    saveManage()
  }
}

// Tab switches can start fetches faster than they return. Only the
// newest may apply, or an older answer could restore an outdated list.
let fetchGeneration = 0
let fetchesInFlight = 0

const fetchItems = async (): Promise<UserAdminConfig[] | null> => {
  const generation = ++fetchGeneration
  // A counter, not a flag. An older fetch finishing must not mark the tab
  // settled while a newer one is out, or the editor accepts edits in between.
  fetchesInFlight++
  listLoading.value = true
  loadFailed.value = false
  try {
    const items = await filterBookmarkStore.getBookmarks(
      {
        user: props.user,
        layoutType: UserAdminConfigLayoutType.Desktop,
        systemResource: systemResource,
      },
      useFetchUserAdminConfigList,
      true
    )
    if (generation !== fetchGeneration) return null
    // `null` means this request failed. The store's `error` flag is
    // shared with other fetches, including this dialog's bookmark count.
    if (items === null) {
      loadFailed.value = true
      showUnknownError()
      return null
    }
    return items
  } catch (e) {
    // An overtaken answer must not set the error state or raise an alert.
    if (generation !== fetchGeneration) return null
    loadFailed.value = true
    showErrorsDefault(e)
    return null
  } finally {
    fetchesInFlight--
    listLoading.value = fetchesInFlight > 0
  }
}

// Rows are handed to the editor directly, not via `v-model`, which lags a render.
// A commit before the rows arrived would pin the baseline to the old list,
// and every fetched difference would look like an unsaved user edit.
// On first load the editor mounts later and takes its baseline from `itemsManage`.
const applyItems = (items: UserAdminConfig[] | null) => {
  if (!items) return
  itemsManage.value = items
  manageLoaded.value = true
  editor.value?.commit(items)
}

watch(activeTab, async () => {
  errorCount.value = false
  if (activeTab.value !== 'manage') return
  void loadEditor()
  // Entering the tab refreshes it, for example after adding a bookmark on the other
  // tab. Never over unsaved work: the fetched order would replace the dragged one.
  if (editor.value?.hasUnsaved) return
  const items = await fetchItems()
  // Checked again after the fetch: the user may have started dragging while it ran.
  if (editor.value?.hasUnsaved) return
  applyItems(items)
})
</script>

<template>
  <!--
    `persistent` while a write is out: Escape and outside clicks
    change the model directly, bypassing the write-phase disabling.
  -->
  <VDialog
    v-model="isOpen"
    :persistent="saveButtonLoading"
    :width="500"
  >
    <VCard>
      <ADialogToolbar @cancel="requestClose">
        {{ t('common.filter.bookmark.title') }}
      </ADialogToolbar>
      <VCardText class="pt-0">
        <VTabs
          v-model="activeTab"
          fixed-tabs
        >
          <VTab
            value="add"
            :disabled="saveButtonLoading"
          >
            {{ t('common.filter.bookmark.add') }}
          </VTab>
          <VTab
            value="manage"
            :disabled="saveButtonLoading"
          >
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
              :disabled="saveButtonLoading"
              :v="vCreate$.customName"
            />
          </ARow>
          <ARow>
            <AFormSwitch
              v-model="storeDatatableHiddenColumns"
              :disabled="saveButtonLoading"
              :label="t('common.filter.bookmark.storeTableColumns')"
            />
          </ARow>
          <ARow>
            <AFormSwitch
              v-model="storeDatatableOrder"
              :disabled="saveButtonLoading"
              :label="t('common.filter.bookmark.storeTableOrder')"
            />
          </ARow>
        </div>
        <!--
          `v-show`, not `v-if`: the guard sees pending work only through the section the editor registers.
          Unmounting on a tab switch would let the dialog close on a dragged order without asking.
          The spinner is the editor's own `loading` for the same reason.
        -->
        <div
          v-show="activeTab === 'manage'"
          class="w-100 pt-4"
        >
          <div
            v-if="!manageLoaded && !loadFailed"
            class="d-flex w-100 align-center justify-center"
          >
            <VProgressCircular indeterminate />
          </div>
          <!--
            Nothing loaded yet: the editor's empty state would wrongly
            claim there are no bookmarks after a failed fetch.
          -->
          <ARow
            v-else-if="!manageLoaded"
            class="text-error"
            :title="t('common.alert.unknownError')"
          />
          <div
            v-else-if="editorLoadFailed"
            class="d-flex w-100 align-center justify-space-between"
          >
            <span class="text-error">{{ t('common.alert.unknownError') }}</span>
            <ABtnTertiary
              data-cy="button-retry-editor"
              @click.stop="loadEditor"
            >
              {{ t('common.button.retry') }}
            </ABtnTertiary>
          </div>
          <div
            v-else-if="!listEditor"
            class="d-flex w-100 align-center justify-center"
          >
            <VProgressCircular indeterminate />
          </div>
          <!--
            Mounted once the first fetch settles, even if empty, so an empty
            list shows the editor's empty state. Never unmounted after that.
          -->
          <component
            :is="listEditor"
            v-else
            ref="editor"
            v-model="itemsManage"
            :position="false"
            :loading="listLoading || saveButtonLoading"
            compact-field="customName"
            :validate="validateBookmarkName"
            :show-add-button="false"
            :unsaved-section-label="t('common.filter.bookmark.unsavedSection')"
          >
            <template #item="{ raw, actions }: { raw: UserAdminConfig; actions: RowUpdate }">
              <AFormTextField
                :model-value="raw.customName"
                hide-details="auto"
                @update:model-value="actions.update({ ...raw, customName: String($event ?? '') })"
              />
            </template>
          </component>
        </div>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <!--
          Inputs are disabled while a write is out. The change set was read when the button
          was pressed, so later typing would be lost on the close after a successful save.
        -->
        <ABtnTertiary
          data-cy="button-cancel"
          :disabled="saveButtonLoading"
          @click.stop="requestClose"
        >
          {{ t('common.button.cancel') }}
        </ABtnTertiary>
        <!-- Disabled while the list refreshes: the on-screen order is about to be replaced by the incoming answer. -->
        <ABtnPrimary
          data-cy="button-confirm"
          :disabled="activeTab === 'manage' && (listLoading || !listEditor)"
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
