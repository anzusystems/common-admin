<script lang="ts" setup>
import { Grant } from '@/model/valueObject/Grant'
import { GrantOrigin } from '@/model/valueObject/GrantOrigin'
import PermissionValueChip from '@/components/permission/APermissionValueChip.vue'
import PermissionGrantEditor from '@/components/permission/APermissionGrantEditor.vue'
import ARow from '@/components/ARow.vue'
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import { defineAuth } from '@/composables/auth/defineAuth'
import type { AclValue } from '@/types/Permission'

const { can } = defineAuth<AclValue>('cms')
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardTitle>PermissionValueChip</VCardTitle>
    <VCardSubtitle> :grant-origin="GrantOrigin.User" :grant="Grant.Allow"</VCardSubtitle>
    <VCardText>
      <PermissionValueChip
        :grant-origin="GrantOrigin.User"
        :grant="Grant.Allow"
      />
    </VCardText>
    <VCardTitle>PermissionGrantEditor</VCardTitle>
    <VCardSubtitle>
      :selected-grant="Grant.Allow" :available-grants="[Grant.Deny, Grant.AllowOwner ,Grant.Allow]"
    </VCardSubtitle>
    <VCardText>
      <PermissionGrantEditor
        :selected-grant="Grant.Allow"
        :available-grants="[Grant.Deny, Grant.AllowOwner, Grant.Allow]"
      />
      <ARow class="mt-2">
        <VCol
          cols="12"
          md="8"
        >
          <Acl permission="anzu_entity_create">
            <ARow>Element denied and hidden by ACL (example 1)</ARow>
          </Acl>
          <ARow v-if="can('anzu_entity_create')">
            Element denied and hidden by ACL (example 2)
          </ARow>
          <Acl permission="anzu_entity_view">
            <ARow>Element allowed and showed by ACL (example 1)</ARow>
          </Acl>
          <ARow v-if="can('anzu_entity_view')">
            Element allowed and showed by ACL (example 2)
          </ARow>
        </VCol>
      </ARow>
    </VCardText>
  </VCard>
</template>
