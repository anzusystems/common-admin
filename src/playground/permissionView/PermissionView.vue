<script lang="ts" setup>
import { Grant } from '@/domains/auth/valueObject/Grant'
import { GrantOrigin } from '@/domains/permission/valueObject/GrantOrigin'
import PermissionValueChip from '@/domains/permission/components/APermissionValueChip.vue'
import PermissionGrantEditor from '@/domains/permission/components/APermissionGrantEditor.vue'
import ARow from '@/domains/ui/components/ARow.vue'
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import { defineAuth } from '@/domains/auth/composables/defineAuth'
import type { AclValue } from '@/domains/auth/types/Permission'

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
          <Acl permission="cms_entity_create">
            <ARow>Element denied and hidden by ACL (example 1)</ARow>
          </Acl>
          <ARow v-if="can('cms_entity_create')"> Element denied and hidden by ACL (example 2) </ARow>
          <Acl permission="cms_entity_view">
            <ARow>Element allowed and showed by ACL (example 1)</ARow>
          </Acl>
          <ARow v-if="can('cms_entity_view')">Element allowed and showed by ACL (example 2)</ARow>
        </VCol>
      </ARow>
    </VCardText>
  </VCard>
</template>
