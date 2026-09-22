<script lang="ts" setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
// `ABtnPrimary` / `ABtnTertiary` are Vuetify aliases registered globally by
// `commonVuetifyConfig`, so they are not imported.
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import { useAlerts } from '@/composables/system/alerts'
import type { AnzuUser } from '@/types/AnzuUser'
import type { IntegerIdNullable } from '@/types/common'
import { cloneDeep, isNull } from '@/utils/common'

const props = defineProps<{
  /**
   * Reads the source account from the server. It is a prop because the shape of a user differs per
   * system -- cms answers `CmsUserDto`, dam `DamUserDto` -- and because the page already holds an
   * api instance pointed at the right backend.
   */
  fetchSourceUser: (id: number) => Promise<AnzuUser>
  /**
   * Copies whatever the system keeps beyond roles, groups and grants. cms has nineteen such
   * fields; systems with none leave this out.
   */
  copySystemFields?: ((target: AnzuUser, source: AnzuUser) => void) | undefined
  /** i18n keys listed in the dialog, so the operator sees exactly what will be overwritten. */
  copiedSettingKeys?: string[]
}>()

const user = defineModel<AnzuUser>('user', { required: true })

const dialog = ref(false)
const loading = ref(false)
const srcUserId = ref<IntegerIdNullable>(null)

const { t } = useI18n()
const { showErrorsDefault } = useAlerts()

const showDialog = () => {
  srcUserId.value = null
  dialog.value = true
}

const confirmDialog = async () => {
  if (isNull(srcUserId.value)) return
  loading.value = true
  try {
    const source = await props.fetchSourceUser(srcUserId.value)
    user.value.roles = cloneDeep(source.roles)
    user.value.permissionGroups = cloneDeep(source.permissionGroups)
    user.value.permissions = cloneDeep(source.permissions)
    props.copySystemFields?.(user.value, source)
    dialog.value = false
  } catch (error) {
    showErrorsDefault(error)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <p class="text-body-small">
      {{ t('common.anzuUser.copyPermissions.desc') }}
    </p>
    <div class="text-right">
      <ABtnTertiary
        size="small"
        data-cy="user-copy-permissions"
        @click.stop="showDialog"
      >
        {{ t('common.anzuUser.copyPermissions.title') }}
      </ABtnTertiary>
    </div>
    <VDialog
      v-if="dialog"
      :model-value="dialog"
      :max-width="900"
    >
      <VCard>
        <ADialogToolbar @on-cancel="dialog = false">
          {{ t('common.anzuUser.copyPermissions.title') }}
        </ADialogToolbar>
        <VCardText>
          <!-- Whose account to copy from. The app owns the picker: it knows its own user list. -->
          <slot
            name="sourcePicker"
            :select="(id: IntegerIdNullable) => (srcUserId = id)"
            :selected="srcUserId"
          />
          <strong>{{ t('common.anzuUser.copyPermissions.copiedSettings') }}</strong>
          <ul class="ml-5 text-body-small">
            <li>{{ t('common.anzuUser.model.roles') }}</li>
            <li>{{ t('common.anzuUser.model.permissionGroups') }}</li>
            <li>{{ t('common.anzuUser.model.permissions') }}</li>
            <li
              v-for="key in copiedSettingKeys"
              :key="key"
            >
              {{ t(key) }}
            </li>
          </ul>
        </VCardText>
        <VCardActions>
          <ABtnTertiary @click.stop="dialog = false">
            {{ t('common.button.cancel') }}
          </ABtnTertiary>
          <VSpacer />
          <ABtnPrimary
            :disabled="isNull(srcUserId)"
            :loading="loading"
            data-cy="user-copy-permissions-confirm"
            @click.stop="confirmDialog"
          >
            {{ t('common.button.confirm') }}
          </ABtnPrimary>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>
