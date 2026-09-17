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

const editor = useTemplateRef<ExposedListEditorHandle<UserAdminConfig>>('editor')

// One save for the whole tab, which is how every other list editor in this codebase is used: the
// editor holds the data and the form's button persists it. A per-row PUT looked tidier and was not
// -- re-baselining the one saved row meant reloading the list, and the reload took the pending
// reorder and any other open row's typed text with it.
const saveManage = async () => {
  if (!editor.value?.validateAll()) return
  saveButtonLoading.value = true
  try {
    const changes = editor.value.getChanges()
    // Deletes first, then renames, then the order -- which is taken from `itemsManage`, and the
    // deleted rows have already left it.
    for (const item of changes.deleted) {
      await deleteUserAdminConfig(item.id)
    }
    for (const item of changes.updated) {
      await updateUserAdminConfig(item.id, cloneDeep(item))
    }
    await updateUserAdminConfigPositions(itemsManage.value.map((item) => item.id))
    // Once, at the end: this is also what refreshes the store the filter bar reads its names from,
    // and what the editor re-baselines against.
    await reloadItems()
    editor.value?.commit()
    forceClose()
  } catch (e) {
    showErrorsDefault(e)
    // A partial save -- some rows written, then a later call threw -- leaves the store holding
    // names the server no longer has. The reload is the only thing that rewrites it.
    await reloadItems()
  } finally {
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
    // Cleared because `requestClose` may not close: with work pending on the other tab the guard
    // asks, and "stay" would otherwise leave this bookmark's name in the field for a second click
    // to create it again. Empty, the `required` rule blocks that.
    customName.value = ''
    vCreate$.value.$reset()
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
  } else if (activeTab.value === 'manage' && itemsManage.value.length > 0) {
    saveManage()
  }
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
    manageLoaded.value = true
  }
}

watch(activeTab, () => {
  errorCount.value = false
  // First entry only. Refetching on every switch would overwrite a pending reorder with the server
  // order the moment the user glanced at the other tab.
  if (activeTab.value === 'manage' && itemsManage.value.length === 0) {
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
        <!-- `v-show`, not `v-if`: the guard sees this tab's pending work only through the section
             the editor registers, so unmounting it on a glance at the other tab would leave the
             dialog able to close on a dragged order without asking. The spinner is the editor's own
             `loading` for the same reason -- swapping it out on every reload would do the same. -->
        <div
          v-show="activeTab === 'manage'"
          class="w-100 pt-4"
        >
          <div
            v-if="!manageLoaded"
            class="d-flex w-100 align-center justify-center"
          >
            <VProgressCircular indeterminate />
          </div>
          <!-- Mounted once the first fetch has settled -- empty or not, so an empty list gets the
               editor's own empty state rather than a blank tab -- and never unmounted after that. -->
          <ASortableListEditor
            v-else
            ref="editor"
            v-model="itemsManage"
            :position="false"
            :loading="listLoading"
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
