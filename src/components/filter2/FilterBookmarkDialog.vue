<script lang="ts" setup>
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
import AFormTextField from '@/components/form/AFormTextField.vue'
import ARow from '@/components/ARow.vue'
import AFormSwitch from '@/components/form/AFormSwitch.vue'
import type { SortableItem } from '@/components/sortable/sortableActions.ts'
import ASortable from '@/components/sortable/ASortable.vue'

const emit = defineEmits<{
  (e: 'onClose'): void
}>()

const activeTab = ref<'add' | 'manage'>('add')

const { t } = useI18n()

const itemsBasic = ref<Array<any>>([
  { id: 1, text: 'One', position: 100 },
  { id: 2, text: 'Two', position: 200 },
  { id: 3, text: 'Tree', position: 300 },
  { id: 4, text: 'Four', position: 400 },
])

const onConfirm = () => {
  console.log('onConfirm')
}
</script>

<template>
  <VDialog
    :model-value="true"
    :width="500"
  >
    <VCard>
      <ADialogToolbar @on-cancel="emit('onClose')">
        Bookmarks
      </ADialogToolbar>
      <VCardText class="pt-0">
        <VTabs
          v-model="activeTab"
          fixed-tabs
        >
          <VTab value="add">
            Add bookmark
          </VTab>
          <VTab value="manage">
            Manage bookmarks
          </VTab>
        </VTabs>
        <div
          v-if="activeTab === 'add'"
          class="w-100 pt-4"
        >
          <ARow title="Current selected filters will be stored with this bookmark." />
          <ARow>
            <AFormTextField
              label="Name"
              :model-value="''"
            />
          </ARow>
          <ARow>
            <AFormSwitch
              label="Save datatable columns also"
              :model-value="true"
            />
          </ARow>
        </div>
        <div
          v-else-if="activeTab === 'manage'"
          class="w-100 pt-4"
        >
          <ASortable
            v-model="itemsBasic"
            show-edit-button
            show-delete-button
          >
            <template #item="{ item }: { item: SortableItem<any> }">
              {{ item.raw.id }} {{ item.raw.text }}
            </template>
          </ASortable>
        </div>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <ABtnTertiary
          data-cy="button-cancel"
          @click.stop="emit('onClose')"
        >
          {{ t('common.button.cancel') }}
        </ABtnTertiary>
        <ABtnPrimary
          data-cy="button-confirm"
          @click.stop="onConfirm"
        >
          {{ t('common.button.confirm') }}
        </ABtnPrimary>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
