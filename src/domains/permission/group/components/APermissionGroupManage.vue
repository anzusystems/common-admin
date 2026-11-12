<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import AFormTextField from '@/domains/form/components/AFormTextField.vue'
import ASystemEntityScope from '@/domains/form/components/ASystemEntityScope.vue'
import type { AxiosClientFn } from '@/domains/api/utils/client'
import APermissionEditor from '@/domains/permission/components/APermissionEditor.vue'
import { usePermissionGroupValidation } from '@/domains/permission/group/composables/permissionGroupValidations'
import { PERMISSION_GROUP_ENTITY } from '@/domains/permission/group/api/permissionGroupApi'
import { usePermissionGroupOneStore } from '@/domains/permission/group/store/permissionGroupStore'

defineProps<{
  client: AxiosClientFn
  /** Backend identity for the permission config fetch, not the i18n namespace below. */
  system: string
  /**
   * Where the grants editor reads the permission config. Defaults to `GET /adm/v1/permissions/config`.
   * Deliberately not named `endPoint`: a page once passed the permission-group endpoint as `endPoint`.
   * The editor then fetched the group list as config and crashed, and
   * the per-system config store left user pages broken until reload.
   */
  permissionConfigEndPoint?: string | undefined
}>()

const { permissionGroup } = storeToRefs(usePermissionGroupOneStore())
const { v$ } = usePermissionGroupValidation(permissionGroup)
</script>

<template>
  <!--
    `common` / `permissionGroup` is the library's translation
    namespace for the field labels, the same for every backend.
    The backend identity is passed in `system` above.
  -->
  <ASystemEntityScope
    system="common"
    :subject="PERMISSION_GROUP_ENTITY"
  >
    <VRow>
      <VCol cols="12">
        <VCard>
          <VCardText>
            <AFormTextField
              v-model="permissionGroup.title"
              :v="v$.permissionGroup.title"
              data-cy="permissionGroup-title"
            />
            <AFormTextField
              v-model="permissionGroup.description"
              :v="v$.permissionGroup.description"
              data-cy="permissionGroup-description"
            />
          </VCardText>
        </VCard>
      </VCol>
      <VCol cols="12">
        <APermissionEditor
          v-model="permissionGroup.permissions"
          :client="client"
          :system="system"
          :end-point="permissionConfigEndPoint"
        />
      </VCol>
      <VCol
        v-if="$slots.tracking"
        cols="12"
      >
        <!-- Created/modified by whom: each app resolves users against its own cache and routes. -->
        <slot
          name="tracking"
          :permission-group="permissionGroup"
        />
      </VCol>
    </VRow>
  </ASystemEntityScope>
</template>
