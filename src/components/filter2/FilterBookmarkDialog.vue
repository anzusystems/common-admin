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
import { MAX_BOOKMARK_ITEMS, useFilterBookmarkStore } from '@/components/filter2/bookmarksStore'
import { useUserAdminConfigApi } from '@/services/api/userAdminConfig/userAdminConfig'
import { useAlerts } from '@/composables/system/alerts'
import { useUserAdminConfigFactory } from '@/model/factory/UserAdminConfigFactory'
import { type UserAdminConfig, UserAdminConfigLayoutType, UserAdminConfigType } from '@/types/UserAdminConfig'
import { useDisplay } from 'vuetify'
import useVuelidate from '@vuelidate/core'
import { useValidate } from '@/validators/vuelidate/useValidate'
import { cloneDeep, isNull, isUndefined } from '@/utils/common'
import { FilterConfigKey, FilterDataKey } from '@/components/filter2/filterInjectionKeys'
import { useFilterHelpers } from '@/composables/filter/filterFactory'

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

if (isUndefined(filterConfig) || isUndefined(filterData)) {
  throw new Error('Incorrect provide/inject config.')
}

const activeTab = ref<'add' | 'manage'>('add')
const customName = ref('')
const storeDatatableHiddenColumns = ref(false)
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
  fetchUserAdminConfigList,
  updateUserAdminConfigPositions,
  deleteUserAdminConfig,
  updateUserAdminConfig,
} =
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
  useUserAdminConfigApi(props.client, props.system)
const { t } = useI18n()
const { showErrorsDefault, showValidationError } = useAlerts()
const { createDefaultUserAdminConfig } = useUserAdminConfigFactory()
const { mobile } = useDisplay()

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
  config.layoutType = mobile.value ? UserAdminConfigLayoutType.Mobile : UserAdminConfigLayoutType.Desktop
  config.systemResource = props.systemResource
  config.customName = customName.value
  config.data = {
    filter: serializeFilters(filterData),
    datatableHiddenColumns:
      storeDatatableHiddenColumns.value && props.datatableHiddenColumns ? props.datatableHiddenColumns : undefined,
  }
  try {
    const count = await filterBookmarkStore.fetchBookmarksCount(
      {
        system: props.system,
        user: props.user,
        layoutType: mobile.value ? UserAdminConfigLayoutType.Mobile : UserAdminConfigLayoutType.Desktop,
        systemResource: props.systemResource,
      },
      fetchUserAdminConfigList
    )
    if (count >= MAX_BOOKMARK_ITEMS) {
      errorCount.value = true
      return
    }
    config.position = count + 1 // todo check +1 or not
    const res = await createUserAdminConfig(config)
    filterBookmarkStore.addOne(
      filterBookmarkStore.generateKey(
        props.system,
        mobile.value ? UserAdminConfigLayoutType.Mobile : UserAdminConfigLayoutType.Desktop,
        props.systemResource
      ),
      res
    )
    saveButtonLoading.value = false
    emit('onClose')
  } catch (e) {
    showErrorsDefault(e)
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
    await updateUserAdminConfig(modified.id, modified)
    await reloadItems()
    onItemCancel()
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
        layoutType: mobile.value ? UserAdminConfigLayoutType.Mobile : UserAdminConfigLayoutType.Desktop,
        systemResource: props.systemResource,
      },
      fetchUserAdminConfigList,
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
        Bookmarks
      </ADialogToolbar>
      <VCardText class="pt-0">
        <VTabs
          v-model="activeTab"
          fixed-tabs
        >
          <VTab value="add">
            Add bookmark
          </VTab>
          <VTab value="manage">
            Manage bookmarks
          </VTab>
        </VTabs>
        <div
          v-if="activeTab === 'add'"
          class="w-100 pt-4"
        >
          <ARow title="Current selected filters will be stored with this bookmark." />
          <ARow
            v-if="errorCount"
            class="text-error"
            title="Max numbers of bookmarks reached. You can delete some bookmarks to add new one."
          />
          <ARow>
            <AFormTextField
              v-model="customName"
              label="Name"
              required
              :v="vCreate$.customName"
            />
          </ARow>
          <ARow>
            <AFormSwitch
              v-model="storeDatatableHiddenColumns"
              label="Save datatable columns also"
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
          :disabled="!isNull(itemEdit)"
          @click.stop="onConfirm"
        >
          {{ t('common.button.confirm') }}
        </ABtnPrimary>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
