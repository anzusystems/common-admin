<script lang="ts" setup>
import { Grant, useGrant } from '@/model/valueObject/Grant'
import { GrantOrigin, useGrantOrigin } from '@/model/valueObject/GrantOrigin'
import { computed } from 'vue'

const props = defineProps<{
  grant: Grant
  grantOrigin: GrantOrigin
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
      v-if="grantOrigin !== GrantOrigin.DefaultGrant"
      class="ml-1"
    >({{ grantOriginOption?.title }})</span>
  </VChip>
</template>
