<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import ACopyText from '@/domains/ui/components/ACopyText.vue'
import ARow from '@/domains/ui/components/ARow.vue'
import type { AxiosClientFn } from '@/domains/api/utils/client'
import APermissionEditor from '@/domains/permission/components/APermissionEditor.vue'
import { usePermissionGroupOneStore } from '@/domains/permission/group/store/permissionGroupStore'

defineProps<{
  client: AxiosClientFn
  system: string
  /**
   * Where the grants editor reads the permission config. Defaults to `GET /adm/v1/permissions/config`.
   * Deliberately not named `endPoint`: a page once passed the permission-group endpoint as `endPoint`.
   * The editor then fetched the group list as config and crashed, and
   * the per-system config store left user pages broken until reload.
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
            A group has no resolved permissions of its own. `resolvedPermissions`
            stays undefined so the origin column reads every grant as the group's own.
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
