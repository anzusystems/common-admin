<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { Grant, useGrant } from '@/model/valueObject/Grant'
import { computed } from 'vue'

const props = defineProps<{
  availableGrants: Grant[]
  selectedGrant: Grant | undefined
}>()
const emit = defineEmits<{
  (e: 'change', data?: Grant): void
}>()
const selectedGrant = computed({
  get() {
    return props.selectedGrant
  },
  set(newGrant) {
    emit('change', newGrant)
  }
})
const { getGrantOption } = useGrant()

const {t} = useI18n()
</script>

<template>
  <VBtnToggle
    v-model="selectedGrant"
    divided
    density="compact"
    variant="outlined"
    class="text-disabled"
  >
    <VBtn
      v-for="availableGrant in availableGrants"
      :value="availableGrant"
      :color="getGrantOption(availableGrant).color"
    >
      {{ getGrantOption(availableGrant).title }}
    </VBtn>
  </VBtnToggle>
</template>
