<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import AFormTextField from '@/components/form/AFormTextField.vue'
import ASystemEntityScope from '@/components/form/ASystemEntityScope.vue'
import type { AxiosClientFn } from '@/labs/api/client'
import APermissionEditor from '@/labs/permission/APermissionEditor.vue'
import { usePermissionGroupValidation } from '@/labs/permissionGroup/permissionGroupValidations'
import { PERMISSION_GROUP_ENTITY } from '@/labs/permissionGroup/permissionGroupApi'
import { usePermissionGroupOneStore } from '@/labs/permissionGroup/permissionGroupStore'

defineProps<{
  client: AxiosClientFn
  /** Backend identity for the permission config fetch, not the i18n namespace below. */
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

const { permissionGroup } = storeToRefs(usePermissionGroupOneStore())
const { v$ } = usePermissionGroupValidation(permissionGroup)
</script>

<template>
  <!--
    `common` / `permissionGroup` is the translation namespace the field labels are looked up under,
    and it is the library's own -- the labels read the same whichever backend the row came from.
    The backend identity travels in `system` above.
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
    </VRow>
  </ASystemEntityScope>
</template>
