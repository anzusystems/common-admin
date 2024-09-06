<script lang="ts" setup>
import { type GrantType, useGrant } from '@/model/valueObject/Grant'
import { GrantOriginDefault, type GrantOriginType, useGrantOrigin } from '@/model/valueObject/GrantOrigin'
import { computed } from 'vue'

const props = defineProps<{
  grant: GrantType
  grantOrigin: GrantOriginType
}>()

const { getGrantOption } = useGrant()
const grantOption = computed(() => getGrantOption(props.grant))

const { getGrantOriginOption } = useGrantOrigin()
const grantOriginOption = computed(() => getGrantOriginOption(props.grantOrigin))
</script>

<template>
  <VChip
    v-if="grantOption"
    :color="grantOption.color"
    label
    size="small"
  >
    {{ grantOption.title }}
    <span
      v-if="grantOrigin !== GrantOriginDefault"
      class="ml-1"
    >({{ grantOriginOption?.title }})</span>
  </VChip>
</template>
