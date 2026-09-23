<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import ACopyText from '@/components/ACopyText.vue'
import ARow from '@/components/ARow.vue'
import type { AxiosClientFn } from '@/labs/api/client'
import APermissionEditor from '@/labs/permission/APermissionEditor.vue'
import { usePermissionGroupOneStore } from '@/labs/permissionGroup/permissionGroupStore'

defineProps<{
  client: AxiosClientFn
  system: string
  /**
   * Where the grants editor reads the permission config -- `GET /adm/v1/permissions/config` when
   * left out, which every backend has.
   *
   * Named for what it is, and deliberately not `endPoint`: a page holding the permission-group
   * endpoint passed it here as `endPoint`, the editor fetched the group list as its config and
   * crashed -- and, the config store being keyed by system, left that system's user pages broken
   * until reload. A stray `end-point` now falls through as an attribute and changes nothing.
   */
  permissionConfigEndPoint?: string | undefined
}>()

const { permissionGroup, loadingPermissionGroup } = storeToRefs(usePermissionGroupOneStore())

const { t } = useI18n()
</script>

<template>
  <VRow>
    <VCol
      cols="12"
      sm="8"
    >
      <VRow>
        <VCol cols="12">
          <VCard :loading="loadingPermissionGroup">
            <VCardText>
              <ARow
                :title="t('common.permissionGroup.model.title')"
                :value="permissionGroup.title"
              />
              <ARow
                :title="t('common.permissionGroup.model.description')"
                :value="permissionGroup.description"
              />
            </VCardText>
          </VCard>
        </VCol>
      </VRow>
      <VRow>
        <VCol cols="12">
          <!--
            A group has no resolved permissions of its own: `resolvedPermissions` is left undefined
            so the origin column reads every grant as the group's own rather than a user's.
          -->
          <APermissionEditor
            v-model="permissionGroup.permissions"
            :client="client"
            :system="system"
            :end-point="permissionConfigEndPoint"
            readonly
          />
        </VCol>
      </VRow>
    </VCol>
    <VCol
      cols="12"
      sm="4"
    >
      <ARow :title="t('common.permissionGroup.model.id')">
        <ACopyText :value="permissionGroup.id" />
      </ARow>
      <!-- Created/modified by whom: each app resolves users against its own cache and routes. -->
      <slot
        name="tracking"
        :permission-group="permissionGroup"
      />
    </VCol>
  </VRow>
</template>
