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
  <VForm
    name="search2"
    @submit.prevent="submitFilter"
  >
    <VRow>
      <VCol>
        <AFilterString
          v-model="filter.text"
          @update:model-value="onAnyFilterUpdate"
          @keydown.enter="submitFilter"
        />
      </VCol>
      <VRow>
        <VCol>
          <AFilterBooleanSelect
            v-model="filter.described"
            @update:model-value="onAnyFilterUpdate"
          />
        </VCol>
      </VRow>
      <VRow>
        <VCol>
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
    </VRow>
  </VForm>
</template>
