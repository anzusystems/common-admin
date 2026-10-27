<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ASystemEntityScope from '@/domains/form/components/ASystemEntityScope.vue'
import type { AxiosClientFn } from '@/domains/api/utils/client'
import AUserEnabledSwitch from '@/domains/anzuUser/components/AUserEnabledSwitch.vue'
import AUserMetadataForm from '@/domains/anzuUser/components/AUserMetadataForm.vue'
import AAnzuUserRoleAutocomplete from '@/domains/anzuUser/components/AAnzuUserRoleAutocomplete.vue'
import { ANZU_USER_ENTITY } from '@/domains/anzuUser/api/anzuUserApi'
import APermissionEditor from '@/domains/permission/components/APermissionEditor.vue'
import { usePermissionActions } from '@/domains/permission/composables/permissionActions'
import APermissionGroupRemoteAutocomplete from '@/domains/permission/group/components/APermissionGroupRemoteAutocomplete.vue'
import { PERMISSION_GROUP_ENDPOINT } from '@/domains/permission/group/api/permissionGroupApi'
import type { AnzuUser } from '@/shared/types/AnzuUser'

const props = withDefaults(
  defineProps<{
    client: AxiosClientFn
    system: string
    /**
     * The permission-group endpoint, which is not the user one.
     * There is deliberately no `entity` prop. `entity` names the resource that server validation
     * errors are filed under. Passing the user's down would file group errors under user labels.
     */
    permissionGroupEndPoint?: string
    /**
     * One component for detail and edit (decision 27). Two components drift:
     * a field added to one and forgotten in the other fails silently.
     */
    readonly?: boolean
    isEdit?: boolean
    /**
     * From the system's descriptor.
     */
    requiredMetadata?: boolean
    idInput?: boolean
    randomColor?: boolean
    enabledNote?: string | undefined
    metadataNote?: string | undefined
  }>(),
  {
    permissionGroupEndPoint: PERMISSION_GROUP_ENDPOINT,
    readonly: false,
    isEdit: false,
    requiredMetadata: false,
    idInput: true,
    randomColor: false,
    enabledNote: undefined,
    metadataNote: undefined,
  }
)

const user = defineModel<AnzuUser>('user', { required: true })

const { t } = useI18n()

/* eslint-disable vue/no-setup-props-reactivity-loss */
const { resolvePermissions } = usePermissionActions({
  client: props.client,
  system: props.system,
  endPoint: props.permissionGroupEndPoint,
})
/* eslint-enable vue/no-setup-props-reactivity-loss */

/**
 * Grants the account would have if saved now: those of the ticked groups plus the user's own.
 * Computed locally so ticking a group shows its effect without a round
 * trip. The server's `resolvedPermissions` reflects the record as loaded.
 */
const resolvedPermissions = computed(() => resolvePermissions(user.value))
</script>

<template>
  <ASystemEntityScope
    system="common"
    :subject="ANZU_USER_ENTITY"
  >
    <VRow>
      <VCol cols="12">
        <AUserEnabledSwitch
          v-model="user.enabled"
          :readonly="readonly"
          :note="enabledNote"
        />
      </VCol>
      <VCol cols="12">
        <AUserMetadataForm
          v-model:user="user"
          :required="requiredMetadata"
          :id-input="idInput"
          :is-edit="isEdit"
          :readonly="readonly"
          :random-color="randomColor"
          :note="metadataNote"
        />
      </VCol>
      <VCol
        v-if="isEdit && !readonly && $slots.copyPermissions"
        cols="12"
      >
        <!-- Copying roles and grants from another account. Only cms offers it today. -->
        <slot name="copyPermissions" />
      </VCol>
      <VCol
        v-if="$slots.systemFields"
        cols="12"
      >
        <!--
          The system's own fields: autocompletes over that backend's entities, which the library
          cannot build. They get the same `readonly`, so the app can swap autocompletes for chips.
        -->
        <slot
          name="systemFields"
          :readonly="readonly"
          :is-edit="isEdit"
        />
      </VCol>
      <VCol cols="12">
        <AAnzuUserRoleAutocomplete
          v-model="user.roles"
          :client="client"
          :system="system"
          :readonly="readonly"
        />
      </VCol>
      <VCol cols="12">
        <APermissionGroupRemoteAutocomplete
          v-model="user.permissionGroups"
          :client="client"
          :system="system"
          :end-point="permissionGroupEndPoint"
          :label="t('common.anzuUser.model.permissionGroups')"
          :readonly="readonly"
          multiple
          clearable
        />
      </VCol>
      <VCol
        v-if="$slots.actions"
        cols="12"
      >
        <slot
          name="actions"
          :user="user"
        />
      </VCol>
      <VCol cols="12">
        <APermissionEditor
          v-model="user.permissions"
          :resolved-permissions="resolvedPermissions"
          :roles="user.roles"
          :client="client"
          :system="system"
          :readonly="readonly"
        />
      </VCol>
    </VRow>
  </ASystemEntityScope>
</template>
