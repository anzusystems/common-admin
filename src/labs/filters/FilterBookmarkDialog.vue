<script lang="ts" setup>
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import { useI18n } from 'vue-i18n'
import { inject, ref, useTemplateRef, watch } from 'vue'
import AFormTextField from '@/components/form/AFormTextField.vue'
import ARow from '@/components/ARow.vue'
import AFormSwitch from '@/components/form/AFormSwitch.vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'
import type { ExposedListEditorHandle } from '@/labs/listEditor/composables/useListEditorController'
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
import { isAnzuApiAxiosError } from '@/model/error/AnzuApiAxiosError'
import { HTTP_STATUS_NOT_FOUND } from '@/composables/statusCodes'

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

// The editor takes its clean baseline when it is created, so it waits for the first fetch. After
// that it stays mounted whatever happens -- it is the only thing registering this tab's pending
// work with the guard, and a reload that swapped it out would disarm the guard mid-edit.
const manageLoaded = ref(false)
const loadFailed = ref(false)

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
  // Not while a write is out. The toolbar's X and the escape key reach this without going past
  // anything the write phase disables, and closing here would ask the user whether to discard work
  // that is already on its way to the server -- then write it anyway, whatever they answered.
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
const { showErrorsDefault, showUnknownError, showValidationError, showWarningT } = useAlerts()
const { createDefaultUserAdminConfig } = useUserAdminConfigFactory()

const editor = useTemplateRef<ExposedListEditorHandle<UserAdminConfig>>('editor')

// One save for the whole tab, which is how every other list editor in this codebase is used: the
// editor holds the data and the form's button persists it. A per-row PUT looked tidier and was not
// -- re-baselining the one saved row meant reloading the list, and the reload took the pending
// reorder and any other open row's typed text with it.
// A delete answered with "not found" says the row is already gone, which is what this was asking
// for. That is how an attempt whose answer never made it back looks the second time around: without
// reading it this way, every retry would stop on the same row and the dialog could never finish.
const isAlreadyGone = (e: unknown) => isAnzuApiAxiosError(e) && e.cause.response?.status === HTTP_STATUS_NOT_FOUND

const saveManage = async () => {
  // Not while the list is being refreshed: the order this would send is the one on screen, and the
  // answer already on its way is about to replace it. The button is disabled for the same reason --
  // this is the half of it that does not depend on anyone looking at the button.
  if (listLoading.value) return
  if (!editor.value?.validateAll()) return
  saveButtonLoading.value = true
  try {
    const changes = editor.value.getChanges()
    // Deletes first, then renames, then the order -- which is taken from `itemsManage`, and the
    // deleted rows have already left it.
    for (const item of changes.deleted) {
      try {
        await deleteUserAdminConfig(item.id)
      } catch (e) {
        if (!isAlreadyGone(e)) throw e
      }
      // Out of the cache in the same breath: the filter bar is already on screen reading it, and a
      // save that fails further down never gets to the refresh that would have done this.
      filterBookmarkStore.removeOne(bookmarkCacheKey(), item.id)
      // That row is gone for good. Dropping its pending deletion here is what makes a second press
      // of the save button safe after a later call in this batch failed: the renames it resends are
      // the same PUT with the same result, but a DELETE resent against a row that is already gone
      // would fail and stop the batch at the same place every time.
      editor.value.restoreDeleted(item.id)
    }
    for (const item of changes.updated) {
      await updateUserAdminConfig(item.id, cloneDeep(item))
    }
    // Deleting every row leaves nothing to order, and an empty list is not an order to send.
    if (itemsManage.value.length > 0) {
      await updateUserAdminConfigPositions(itemsManage.value.map((item) => item.id))
    }
    // Once, at the end: this is also what refreshes the store the filter bar reads its names from,
    // and what the editor re-baselines against.
    applyItems(await fetchItems())
    forceClose()
  } catch (e) {
    showErrorsDefault(e)
    // Nothing is refetched here and nothing is rolled back. What was written already looks the way
    // it looks on the server -- a deleted row is gone from both, a renamed one carries the new name
    // in both -- and what was not written is still the user's to correct and send again. Refetching
    // would take that unsent work with it without asking, which is the one thing this dialog must
    // not do. The store is told its copy is behind instead.
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
    // After the highest position in use, not after the number of rows. The manage tab renumbers
    // only the rows it sends, so a deletion saved there leaves a gap, and counting rows from then
    // on would put this bookmark on a position another one already holds.
    config.position = maxPosition + 1
    const res = await createUserAdminConfig(config)
    filterBookmarkStore.addOne(bookmarkCacheKey(), res)
    // Cleared because `requestClose` may not close: with work pending on the other tab the guard
    // asks, and "stay" would otherwise leave this bookmark's name in the field for a second click
    // to create it again. Empty, the `required` rule blocks that.
    customName.value = ''
    vCreate$.value.$reset()
    // The write is done, and `requestClose` refuses while one is out. The `finally` sets it again.
    saveButtonLoading.value = false
    // `requestClose`, not `forceClose`: adding a bookmark is a decision about THIS tab. It says
    // nothing about a reorder left pending on the other one, so the guard still gets to ask.
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
    // Not gated on the list being non-empty: deleting every row empties it while leaving the
    // deletions themselves pending, and this button is the only thing that sends them.
    saveManage()
  }
}

// Entering the manage tab starts a fetch, and the tabs can be switched faster than one comes back,
// so two can be in flight at once. Only the newest one is allowed to land: without this an older
// answer could overtake a newer one and put the list back to what it was two switches ago.
let fetchGeneration = 0
let fetchesInFlight = 0

const fetchItems = async (): Promise<UserAdminConfig[] | null> => {
  const generation = ++fetchGeneration
  // Counted, not a flag: an older fetch answering must not report the tab as settled while a newer
  // one is still out, or the editor takes edits again in the gap between the two.
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
    // `null` is this request's own answer that it failed; the store's `error` flag is shared with
    // every other fetch it serves, this dialog's bookmark count among them.
    if (items === null) {
      loadFailed.value = true
      showUnknownError()
      return null
    }
    return items
  } catch (e) {
    // The same question as on the way out of the try: an answer that a newer one has overtaken does
    // not get to put the tab into an error state or raise an alert over it.
    if (generation !== fetchGeneration) return null
    loadFailed.value = true
    showErrorsDefault(e)
    return null
  } finally {
    fetchesInFlight--
    listLoading.value = fetchesInFlight > 0
  }
}

// The fetched rows are handed to the editor rather than left to reach it through `v-model`: that
// way round is a render away, and a commit that ran before the rows arrived would pin the baseline
// to the list from before the fetch -- every difference the fetch brought would then read as the
// user's own unsaved edit. The editor is still to mount on the first load; it takes its own
// baseline from `itemsManage` when it does.
const applyItems = (items: UserAdminConfig[] | null) => {
  if (!items) return
  itemsManage.value = items
  manageLoaded.value = true
  editor.value?.commit(items)
}

watch(activeTab, async () => {
  errorCount.value = false
  if (activeTab.value !== 'manage') return
  // Entering the tab refreshes it -- a bookmark just added on the other tab is the near case -- but
  // never over work the user has not saved: the fetched order would replace the dragged one.
  if (editor.value?.hasUnsaved) return
  const items = await fetchItems()
  // Asked again on the way back: the fetch takes long enough for the user to have started dragging
  // in the meantime, and applying it then would be the same loss, just later.
  if (editor.value?.hasUnsaved) return
  applyItems(items)
})
</script>

<template>
  <!-- `persistent` while a write is out: the escape key and a click outside go straight to the
       model, past everything the write phase disables. -->
  <VDialog
    v-model="isOpen"
    :persistent="saveButtonLoading"
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
        <!-- `v-show`, not `v-if`: the guard sees this tab's pending work only through the section
             the editor registers, so unmounting it on a glance at the other tab would leave the
             dialog able to close on a dragged order without asking. The spinner is the editor's own
             `loading` for the same reason -- swapping it out on every reload would do the same. -->
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
          <!-- Nothing ever loaded: the editor's own empty state would claim there are no bookmarks,
               which is not what a failed fetch found out. -->
          <ARow
            v-else-if="!manageLoaded"
            class="text-error"
            :title="t('common.alert.unknownError')"
          />
          <!-- Mounted once the first fetch has settled -- empty or not, so an empty list gets the
               editor's own empty state rather than a blank tab -- and never unmounted after that. -->
          <ASortableListEditor
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
          </ASortableListEditor>
        </div>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <!-- Nothing in here takes input while a write is out: the change set was read when the
             button was pressed, so anything typed after that would not be in it, and the close that
             follows a successful save would take it with it. -->
        <ABtnTertiary
          data-cy="button-cancel"
          :disabled="saveButtonLoading"
          @click.stop="requestClose"
        >
          {{ t('common.button.cancel') }}
        </ABtnTertiary>
        <!-- Not while the list is being refreshed: the order this would send is the one on screen,
             which the answer on its way is about to replace. -->
        <ABtnPrimary
          data-cy="button-confirm"
          :disabled="activeTab === 'manage' && listLoading"
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
