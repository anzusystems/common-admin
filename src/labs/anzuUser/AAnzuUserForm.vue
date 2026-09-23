<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ASystemEntityScope from '@/components/form/ASystemEntityScope.vue'
import type { AxiosClientFn } from '@/labs/api/client'
import AUserEnabledSwitch from '@/labs/anzuUser/AUserEnabledSwitch.vue'
import AUserMetadataForm from '@/labs/anzuUser/AUserMetadataForm.vue'
import AAnzuUserRoleAutocomplete from '@/labs/anzuUser/AAnzuUserRoleAutocomplete.vue'
import { ANZU_USER_ENTITY } from '@/labs/anzuUser/anzuUserApi'
import APermissionEditor from '@/labs/permission/APermissionEditor.vue'
import { usePermissionActions } from '@/labs/permission/permissionActions'
import APermissionGroupRemoteAutocomplete from '@/labs/permissionGroup/APermissionGroupRemoteAutocomplete.vue'
import { PERMISSION_GROUP_ENDPOINT } from '@/labs/permissionGroup/permissionGroupApi'
import type { AnzuUser } from '@/types/AnzuUser'

const props = withDefaults(
  defineProps<{
    client: AxiosClientFn
    system: string
    /**
     * The permission-group endpoint, which is not the user one.
     *
     * There is deliberately no `entity` prop here. `entity` names a *resource*, not a system, and
     * it is what a server validation failure is filed under -- so the group autocomplete, the role
     * list and the permission editor each use their own, and passing the user's down would file a
     * group's error under the user's labels.
     */
    permissionGroupEndPoint?: string
    /**
     * One component for detail and edit (decision 27). Two parallel components drift: a field
     * added to the editable one and forgotten in the other is a silent divergence with nothing to
     * fail.
     */
    readonly?: boolean
    isEdit?: boolean
    /** From the system's descriptor. */
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
 * What the account would end up with if saved now: the grants of the groups currently ticked, plus
 * the ones set on the user. Recomputed locally so ticking a group shows its effect without a round
 * trip -- the server's own `resolvedPermissions` describes the record as it was loaded.
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
          cannot build. The same `readonly` reaches them, so the app swaps its autocompletes for
          chips inside.
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
        <!-- Impersonation and anything else the app hangs off this form. -->
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
