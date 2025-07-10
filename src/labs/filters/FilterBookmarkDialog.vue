<script lang="ts" setup>
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import { useI18n } from 'vue-i18n'
import { inject, nextTick, ref, useTemplateRef, watch } from 'vue'
import AFormTextField from '@/components/form/AFormTextField.vue'
import ARow from '@/components/ARow.vue'
import AFormSwitch from '@/components/form/AFormSwitch.vue'
import type { SortableItem } from '@/components/sortable/sortableActions'
import ASortable from '@/components/sortable/ASortable.vue'
import type { AxiosInstance } from 'axios'
import type { IntegerId } from '@/types/common'
import { MAX_BOOKMARK_ITEMS, useFilterBookmarkStore } from '@/labs/filters/bookmarksStore'
import { useUserAdminConfigApi } from '@/labs/filters/userAdminConfig'
import { useAlerts } from '@/composables/system/alerts'
import { useUserAdminConfigFactory } from '@/model/factory/UserAdminConfigFactory'
import { type UserAdminConfig, UserAdminConfigLayoutType, UserAdminConfigType } from '@/types/UserAdminConfig'
import useVuelidate from '@vuelidate/core'
import { useValidate } from '@/validators/vuelidate/useValidate'
import { cloneDeep, isNull, isUndefined } from '@/utils/common'
import { DatatablePaginationKey, FilterConfigKey, FilterDataKey } from '@/labs/filters/filterInjectionKeys'
import { useFilterHelpers } from '@/labs/filters/filterFactory'
import { hasAnzuApiValidationErrorSpecific, isAnzuApiValidationError } from '@/model/error/AnzuApiValidationError.ts'

const props = withDefaults(
  defineProps<{
    client: () => AxiosInstance
    system: string
    user: IntegerId
    systemResource: string
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

const activeTab = ref<'add' | 'manage'>('add')
const customName = ref('')
const storeDatatableHiddenColumns = ref(false)
const storeDatatableOrder = ref(false)
const saveButtonLoading = ref(false)
const listLoading = ref(false)
const errorCount = ref(false)
const itemsManage = ref<Array<UserAdminConfig>>([])
const itemEdit = ref<{ id: IntegerId; customName: string } | null>(null)

const { required, maxLength } = useValidate()
const rulesCreate = {
  customName: {
    required,
    maxLength: maxLength(100),
  },
}
const vCreate$ = useVuelidate(rulesCreate, { customName }, { $stopPropagation: true })
const rulesEdit = {
  itemEdit: {
    required,
    maxLength: maxLength(100),
  },
}
const vEdit$ = useVuelidate(rulesEdit, { itemEdit }, { $stopPropagation: true })

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
    emit('onClose')
  } catch (e) {
    showErrorsDefault(e)
    saveButtonLoading.value = false
  }
}

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { serializeFilters } = useFilterHelpers(filterData, filterConfig, props.systemResource)

const addBookmark = async () => {
  saveButtonLoading.value = true
  errorCount.value = false
  const config = createDefaultUserAdminConfig(props.system)
  config.user = props.user
  config.configType = UserAdminConfigType.FilterBookmark
  config.layoutType = UserAdminConfigLayoutType.Desktop
  config.systemResource = props.systemResource
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
        system: props.system,
        user: props.user,
        layoutType: UserAdminConfigLayoutType.Desktop,
        systemResource: props.systemResource,
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
    filterBookmarkStore.addOne(
      filterBookmarkStore.generateKey(props.system, UserAdminConfigLayoutType.Desktop, props.systemResource),
      res
    )
    emit('onClose')
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

const onDelete = async (data: SortableItem<UserAdminConfig>) => {
  listLoading.value = true
  try {
    await deleteUserAdminConfig(data.raw.id)
    await reloadItems()
    onItemCancel()
  } catch (e) {
    showErrorsDefault(e)
  } finally {
    listLoading.value = false
  }
}

const inputRef = useTemplateRef('inputRef')

const onEdit = async (data: SortableItem<UserAdminConfig>) => {
  itemEdit.value = { id: data.raw.id, customName: data.raw.customName }
  await nextTick()
  inputRef.value?.focus()
}

const onItemConfirm = async (data: SortableItem<UserAdminConfig>) => {
  if (isNull(itemEdit.value)) return
  listLoading.value = true
  const modified = cloneDeep(data.raw)
  modified.customName = itemEdit.value.customName
  try {
    onItemCancel()
    await updateUserAdminConfig(modified.id, modified)
    await reloadItems()
  } catch (e) {
    showErrorsDefault(e)
  } finally {
    listLoading.value = false
  }
}

const onItemCancel = () => {
  itemEdit.value = null
}

const reloadItems = async () => {
  listLoading.value = true
  try {
    itemsManage.value = await filterBookmarkStore.getBookmarks(
      {
        system: props.system,
        user: props.user,
        layoutType: UserAdminConfigLayoutType.Desktop,
        systemResource: props.systemResource,
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
    :model-value="true"
    :width="500"
  >
    <VCard>
      <ADialogToolbar @on-cancel="emit('onClose')">
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
          <ASortable
            v-else
            v-model="itemsManage"
            show-edit-button
            show-delete-button
            permanent-buttons
            @on-delete="onDelete"
            @on-edit="onEdit"
          >
            <template #item="{ item }: { item: SortableItem<UserAdminConfig> }">
              <AFormTextField
                v-if="itemEdit && itemEdit.id === item.raw.id"
                ref="inputRef"
                v-model="itemEdit.customName"
                hide-details="auto"
                :v="vEdit$"
              />
              <div v-else>
                {{ item.raw.customName }}
              </div>
            </template>
            <template
              v-if="!isNull(itemEdit)"
              #item-buttons="{ item }: { item: SortableItem<UserAdminConfig> }"
            >
              <div
                v-if="itemEdit && itemEdit.id === item.raw.id"
                class="d-flex align-center justify-end"
              >
                <VBtn
                  icon
                  size="x-small"
                  variant="text"
                  class="mx-1"
                  @click.stop="onItemConfirm(item)"
                >
                  <VIcon icon="mdi-check" />
                  <VTooltip
                    anchor="bottom"
                    activator="parent"
                    :text="t('common.button.confirm')"
                  />
                </VBtn>
                <VBtn
                  icon
                  size="x-small"
                  variant="text"
                  class="mx-1"
                  @click.stop="onItemCancel()"
                >
                  <VIcon icon="mdi-close" />
                  <VTooltip
                    anchor="bottom"
                    activator="parent"
                    :text="t('common.button.cancel')"
                  />
                </VBtn>
              </div>
            </template>
          </ASortable>
        </div>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <ABtnTertiary
          data-cy="button-cancel"
          @click.stop="emit('onClose')"
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
</template>
