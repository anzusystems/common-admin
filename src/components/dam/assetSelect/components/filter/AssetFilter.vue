<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { useAssetListActions } from '@/components/dam/assetSelect/composables/assetListActions'
import AFilterString from '@/components/filter/AFilterString.vue'
import AFilterBooleanSelect from '@/components/filter/AFilterBooleanSelect.vue'

const { t } = useI18n()
const { filter, fetchAssetList, resetAssetList, filterTouch, filterUnTouch, filterIsTouched } = useAssetListActions()

const submitFilter = () => {
  filterUnTouch()
  fetchAssetList()
}

const resetFilter = () => {
  resetAssetList()
  filterUnTouch()
}
const onAnyFilterUpdate = () => {
  filterTouch()
}

</script>

<template>
  <div class="pa-2">
    <VForm
      name="search2"
      @submit.prevent="submitFilter"
    >
      <VRow>
        <VCol :cols="12">
          <AFilterString
            v-model="filter.text"
            @update:model-value="onAnyFilterUpdate"
            @keydown.enter="submitFilter"
          />
        </VCol>
      </VRow>
      <VRow>
        <VCol :cols="12">
          <AFilterBooleanSelect
            v-model="filter.described"
            @update:model-value="onAnyFilterUpdate"
          />
        </VCol>
      </VRow>
      <VRow>
        <VCol :cols="12">
          <AFilterBooleanSelect
            v-model="filter.visible"
            @update:model-value="onAnyFilterUpdate"
          />
        </VCol>
      </VRow>
      <VRow>
        <VCol>
          <AFilterBooleanSelect
            v-model="filter.generatedBySystem"
            @update:model-value="onAnyFilterUpdate"
          />
        </VCol>
      </VRow>
    </VForm>
  </div>
  <div class="pa-2 d-flex align-center justify-center">
    <VBtn
      color="primary"
      class="mr-2"
      :variant="filterIsTouched ? 'flat' : 'text'"
      size="small"
      @click.stop="submitFilter"
    >
      {{ t('common.button.submitFilter') }}
    </VBtn>
    <VBtn
      class="px-2"
      color="light"
      min-width="36px"
      variant="flat"
      size="small"
      @click.stop="resetFilter"
    >
      <VIcon icon="mdi-filter-remove-outline" />
      <VTooltip
        activator="parent"
        location="bottom"
      >
        {{ t('common.button.resetFilter') }}
      </VTooltip>
    </VBtn>
  </div>
</template>
