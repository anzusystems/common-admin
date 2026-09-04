<script setup lang="ts">
import { useI18n } from 'vue-i18n'

export interface Props {
  title?: string
  body?: string
  stayLabel?: string
  discardLabel?: string
  /**
   * Names of the dirty sections (from the guard's `dirtyLabels`). When
   * non-empty the dialog lists them instead of the generic body message.
   */
  dirtyLabels?: string[]
}

withDefaults(defineProps<Props>(), {
  title: undefined,
  body: undefined,
  stayLabel: undefined,
  discardLabel: undefined,
  dirtyLabels: () => [],
})

const emit = defineEmits<{
  resolve: [discard: boolean]
}>()

const open = defineModel<boolean>({ required: true })

const { t } = useI18n()

const onStay = () => {
  emit('resolve', false)
}

const onDiscard = () => {
  emit('resolve', true)
}
</script>

<template>
  <VDialog
    v-model="open"
    max-width="480"
    persistent
  >
    <VCard>
      <VCardTitle>
        {{ title ?? t('common.sortable.unsavedChanges.title') }}
      </VCardTitle>
      <VCardText>
        <template v-if="body">
          {{ body }}
        </template>
        <template v-else-if="dirtyLabels.length">
          {{ t('common.sortable.unsavedChanges.sectionsIntro') }}
          <ul class="a-unsaved-sections">
            <li
              v-for="(label, i) in dirtyLabels"
              :key="i"
            >
              {{ label }}
            </li>
          </ul>
          {{ t('common.sortable.unsavedChanges.leaveQuestion') }}
        </template>
        <template v-else>
          {{ t('common.sortable.unsavedChanges.body') }}
        </template>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn
          variant="text"
          @click="onStay"
        >
          {{ stayLabel ?? t('common.sortable.unsavedChanges.stay') }}
        </VBtn>
        <VBtn
          color="warning"
          variant="flat"
          @click="onDiscard"
        >
          {{ discardLabel ?? t('common.sortable.unsavedChanges.discard') }}
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped lang="scss">
.a-unsaved-sections {
  margin: 8px 0;
  padding-left: 20px;

  li {
    font-weight: 500;
  }
}
</style>
