<script lang="ts" setup>
import { Grant } from '@/model/valueObject/Grant'
import { GrantOrigin } from '@/model/valueObject/GrantOrigin'
import PermissionValueChip from '@/components/permission/PermissionValueChip.vue'
import PermissionGrantEditor from '@/components/permission/PermissionGrantEditor.vue'
</script>

<template>
  <VCard>
    <VCardTitle>PermissionValueChip</VCardTitle>
    <VCardSubtitle> :grant-origin="GrantOrigin.User" :grant="Grant.Allow" </VCardSubtitle>
    <VCardText>
      <PermissionValueChip :grant-origin="GrantOrigin.User" :grant="Grant.Allow" />
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
    </VCardText>
  </VCard>
</template>
