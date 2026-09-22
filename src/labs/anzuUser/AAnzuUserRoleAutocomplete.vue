<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AxiosClientFn } from '@/labs/api/client'
import { usePermissionConfigActions } from '@/labs/permissionConfig/permissionConfigActions'

const props = withDefaults(
  defineProps<{
    client: AxiosClientFn
    /** Roles are per backend: they come from that system's `/adm/v1/permissions/config`. */
    system: string
    entity?: string | undefined
    endPoint?: string | undefined
    readonly?: boolean
  }>(),
  {
    entity: undefined,
    endPoint: undefined,
    readonly: false,
  }
)

const modelValue = defineModel<string[]>({ required: true })

/* eslint-disable vue/no-setup-props-reactivity-loss */
const { permissionConfig, translatePermission } = usePermissionConfigActions({
  client: props.client,
  system: props.system,
  entity: props.entity,
  endPoint: props.endPoint,
})
/* eslint-enable vue/no-setup-props-reactivity-loss */

const items = computed(() =>
  permissionConfig.value.roles.map((role) => ({
    title: translatePermission('roles', role),
    value: role,
  }))
)

const { t } = useI18n()
</script>

<template>
  <VAutocomplete
    v-model="modelValue"
    :items="items"
    item-value="value"
    item-title="title"
    :label="t('common.anzuUser.model.roles')"
    :readonly="readonly"
    :clearable="!readonly"
    multiple
    chips
    closable-chips
    hide-details
    autocomplete="off"
    data-cy="user-roles"
  />
</template>
