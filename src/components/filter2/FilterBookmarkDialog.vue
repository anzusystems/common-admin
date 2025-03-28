<script lang="ts" setup>
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import { useI18n } from 'vue-i18n'
import { ref, watch } from 'vue'
import AFormTextField from '@/components/form/AFormTextField.vue'
import ARow from '@/components/ARow.vue'
import AFormSwitch from '@/components/form/AFormSwitch.vue'
import type { SortableItem } from '@/components/sortable/sortableActions.ts'
import ASortable from '@/components/sortable/ASortable.vue'
import type { AxiosInstance } from 'axios'
import type { IntegerId } from '@/types/common.ts'
import { MAX_BOOKMARK_ITEMS, useFilterBookmarkStore } from '@/components/filter2/bookmarksStore.ts'
import { useUserAdminConfigApi } from '@/services/api/userAdminConfig/userAdminConfig.ts'
import { useAlerts } from '@/composables/system/alerts.ts'
import { useUserAdminConfigFactory } from '@/model/factory/UserAdminConfigFactory.ts'
import { type UserAdminConfig, UserAdminConfigLayoutType, UserAdminConfigType } from '@/types/UserAdminConfig.ts'
import { useDisplay } from 'vuetify'
import useVuelidate from '@vuelidate/core'
import { useValidate } from '@/validators/vuelidate/useValidate.ts'

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

const activeTab = ref<'add' | 'manage'>('add')
const customName = ref('')
const saveButtonLoading = ref(false)
const listLoading = ref(false)
const errorCount = ref(false)

const { required, maxLength } = useValidate()
const rules = {
  customName: {
    required,
    maxLength: maxLength(100),
  },
}
const v$ = useVuelidate(rules, { customName }, { $stopPropagation: true })

const filterBookmarkStore = useFilterBookmarkStore()
// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { createUserAdminConfig, fetchUserAdminConfigList, updateUserAdminConfigPositions } = useUserAdminConfigApi(
  props.client,
  props.system
)
const { t } = useI18n()
const { showErrorsDefault, showValidationError } = useAlerts()
const { createDefaultUserAdminConfig } = useUserAdminConfigFactory()
const { mobile } = useDisplay()

const itemsManage = ref<Array<UserAdminConfig>>([])

const sortItems = async () => {
  saveButtonLoading.value = true
  const items = itemsManage.value
  const ids = items.map((item) => item.id)
  try {
    await updateUserAdminConfigPositions(ids)
    saveButtonLoading.value = false
    emit('onClose')
  } catch (e) {
    showErrorsDefault(e)
    saveButtonLoading.value = false
  }
}

const addBookmark = async () => {
  saveButtonLoading.value = true
  errorCount.value = false
  const config = createDefaultUserAdminConfig(props.system)
  config.user = props.user
  config.configType = UserAdminConfigType.FilterBookmark
  config.layoutType = mobile.value ? UserAdminConfigLayoutType.Mobile : UserAdminConfigLayoutType.Desktop
  config.systemResource = props.systemResource
  config.customName = customName.value
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
    v$.value.$touch()
    if (v$.value.$invalid) {
      showValidationError()
      return
    }
    addBookmark()
  } else if (activeTab.value === 'manage' && itemsManage.value.length > 0) {
    sortItems()
  }
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
              :v="v$.customName"
            />
          </ARow>
          <ARow>
            <AFormSwitch
              label="Save datatable columns also"
              :model-value="true"
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
          >
            <template #item="{ item }: { item: SortableItem<UserAdminConfig> }">
              {{ item.raw.customName }}
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
          {{ t('common.button.confirm') }}
        </ABtnPrimary>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
