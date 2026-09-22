<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAlerts } from '@/composables/system/alerts'
import { ROLE_SUPER_ADMIN } from '@/composables/auth/defineAuth'
import APermissionGrantEditor from '@/components/permission/APermissionGrantEditor.vue'
import APermissionValueChip from '@/components/permission/APermissionValueChip.vue'
import type { AxiosClientFn } from '@/labs/api/client'
import { usePermissionConfigActions } from '@/labs/permissionConfig/permissionConfigActions'
import { Grant, type GrantType } from '@/model/valueObject/Grant'
import { GrantOrigin, GrantOriginDefault } from '@/model/valueObject/GrantOrigin'
import type { Permissions } from '@/types/Permission'
import { cloneDeep, isUndefined } from '@/utils/common'
import { objectDeletePropertyByPath, objectGetValueByPath, objectSetValueByPath } from '@/utils/object'

const props = withDefaults(
  defineProps<{
    client: AxiosClientFn
    /** Which backend's permission vocabulary to draw. Never a global -- see `permissionConfigActions`. */
    system: string
    entity?: string | undefined
    endPoint?: string | undefined
    /**
     * The grants the subject already has from roles and groups. Undefined means "this model is a
     * group, not a user": the origin column then reads every explicit grant as coming from the
     * group itself rather than from the user.
     */
    resolvedPermissions?: Permissions | undefined
    roles?: string[]
    /** One component for detail and edit (decision 27). Readonly drops the grant column. */
    readonly?: boolean
  }>(),
  {
    entity: undefined,
    endPoint: undefined,
    resolvedPermissions: undefined,
    roles: () => [],
    readonly: false,
  }
)

const modelValue = defineModel<Permissions>({ required: true })

const { t } = useI18n()
const { showWarning } = useAlerts()

// A clone, because every mutation below writes a whole object back through `modelValue`: editing
// the model in place would not re-trigger the parent's watchers that guard unsaved changes.
const permissions = computed(() => cloneDeep(modelValue.value))

/* eslint-disable vue/no-setup-props-reactivity-loss */
const { permissionConfig, loadingPermissionConfig, isPermissionConfigInitialized, translatePermission } =
  usePermissionConfigActions({
    client: props.client,
    system: props.system,
    entity: props.entity,
    endPoint: props.endPoint,
  })
/* eslint-enable vue/no-setup-props-reactivity-loss */

const changeGrant = (subject: string, action: string, grant?: GrantType) => {
  const permissionName = subject + '_' + action
  if (isUndefined(grant) && Object.hasOwn(permissions.value, permissionName)) {
    objectDeletePropertyByPath(permissions.value, permissionName)
    modelValue.value = permissions.value
    return
  }
  objectSetValueByPath(permissions.value, permissionName, grant)
  modelValue.value = permissions.value
}

const getSelectedGrant = (subject: string, action: string) => {
  return objectGetValueByPath(permissions.value, subject + '_' + action)
}

const getAvailableGrants = (subject: string, action: string): GrantType[] => {
  const grants = objectGetValueByPath(permissionConfig.value.config, subject + '.' + action + '.grants')
  if (isUndefined(grants)) {
    return permissionConfig.value.defaultGrants
  }
  return grants
}

const RESTRICTIVE_GRANTS: GrantType[] = [Grant.Deny, Grant.AllowOwner]

const isExplicitRestrictiveGrant = (subject: string, action: string) => {
  const permissionName = subject + '_' + action
  if (!Object.hasOwn(permissions.value, permissionName)) return false
  return RESTRICTIVE_GRANTS.includes(getSelectedGrant(subject, action))
}

/**
 * "Allow everything in this subject", but it refuses to undo a deliberate restriction: an action
 * someone explicitly set to deny or owner-only is left alone and counted, and the count is
 * reported. Silently widening those is the one way this button could grant access nobody asked
 * for.
 */
const allowAllActions = (subject: string) => {
  let keptRestrictiveGrantCount = 0
  for (const action of Object.keys(permissionConfig.value.config[subject])) {
    if (!getAvailableGrants(subject, action).includes(Grant.Allow)) continue
    if (isExplicitRestrictiveGrant(subject, action)) {
      keptRestrictiveGrantCount++
      continue
    }
    objectSetValueByPath(permissions.value, subject + '_' + action, Grant.Allow)
  }
  modelValue.value = permissions.value
  if (keptRestrictiveGrantCount > 0) {
    showWarning(
      t('common.permissionEditor.restrictiveGrantKept', { count: keptRestrictiveGrantCount }, keptRestrictiveGrantCount)
    )
  }
}

const hasSuperAdminRole = computed(() => props.roles.includes(ROLE_SUPER_ADMIN))

const getResolvedGrant = (subject: string, action: string) => {
  if (hasSuperAdminRole.value) return Grant.Allow
  const permissionName = subject + '_' + action
  if (props.resolvedPermissions && Object.hasOwn(props.resolvedPermissions, permissionName)) {
    return objectGetValueByPath(props.resolvedPermissions, permissionName)
  }
  if (Object.hasOwn(permissions.value, permissionName)) {
    return objectGetValueByPath(permissions.value, permissionName)
  }
  return Grant.Deny
}

const getGrantOrigin = (subject: string, action: string) => {
  if (hasSuperAdminRole.value) return GrantOrigin.Role
  const permissionName = subject + '_' + action
  if (isUndefined(props.resolvedPermissions)) {
    if (Object.hasOwn(permissions.value, permissionName)) return GrantOrigin.Group
    return GrantOriginDefault
  }
  if (Object.hasOwn(permissions.value, permissionName)) return GrantOrigin.User
  if (Object.hasOwn(props.resolvedPermissions, permissionName)) return GrantOrigin.Group
  return GrantOriginDefault
}
</script>

<template>
  <VCard :loading="loadingPermissionConfig">
    <VCardText>
      <VTable v-if="isPermissionConfigInitialized">
        <thead>
          <tr>
            <th>{{ t('common.anzuUser.table.grants') }}</th>
            <th v-if="!readonly">
              {{ t('common.anzuUser.table.permissions') }}
            </th>
            <th>{{ t('common.anzuUser.table.resolvedPermissions') }}</th>
          </tr>
        </thead>
        <tbody>
          <template
            v-for="permissionSubject in Object.keys(permissionConfig.config)"
            :key="permissionSubject"
          >
            <tr>
              <td
                :colspan="readonly ? 2 : 3"
                class="text-headline-small font-weight-bold"
              >
                {{ translatePermission('subjects', permissionSubject) }}
                <VBtn
                  v-if="!readonly"
                  size="x-small"
                  variant="text"
                  class="ml-2"
                  :data-cy="`permission-allow-all-${permissionSubject}`"
                  @click="allowAllActions(permissionSubject)"
                >
                  {{ t('common.permissionEditor.allowAll') }}
                </VBtn>
              </td>
            </tr>
            <tr
              v-for="permissionAction in Object.keys(permissionConfig.config[permissionSubject])"
              :key="permissionAction"
            >
              <td>
                {{ translatePermission('actions', permissionAction) }}
                <div class="text-body-small text-disabled">{{ permissionSubject }}_{{ permissionAction }}</div>
              </td>
              <td v-if="!readonly">
                <APermissionGrantEditor
                  :available-grants="getAvailableGrants(permissionSubject, permissionAction)"
                  :selected-grant="getSelectedGrant(permissionSubject, permissionAction)"
                  @change="changeGrant(permissionSubject, permissionAction, $event)"
                />
              </td>
              <td>
                <APermissionValueChip
                  :grant="getResolvedGrant(permissionSubject, permissionAction)"
                  :grant-origin="getGrantOrigin(permissionSubject, permissionAction)"
                />
              </td>
            </tr>
          </template>
        </tbody>
      </VTable>
    </VCardText>
  </VCard>
</template>
