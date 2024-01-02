<script lang="ts" setup>
import type { DocId, IntegerId } from '@/types/common'
import type { ValidationScope } from '@/types/Validation'
import { computed, ref } from 'vue'
import { useValidate } from '@/validators/vuelidate/useValidate'
import useVuelidate from '@vuelidate/core'
import { useKeywordSelectActions } from '@/components/damImage/uploadQueue/keyword/keywordActions'
import { useKeywordFilter } from '@/components/damImage/uploadQueue/keyword/KeywordFilter'
import { useDamCachedKeywords } from '@/components/damImage/uploadQueue/keyword/cachedKeywords'
import type { DamKeyword } from '@/components/damImage/uploadQueue/keyword/DamKeyword'
import { isArray } from '@/utils/common'
import AFormRemoteAutocompleteWithCached from '@/components/form/AFormRemoteAutocompleteWithCached.vue'
import { useDamCachedAuthorsForRemoteAutocomplete } from '@/components/damImage/uploadQueue/author/cachedAuthors'
import KeywordRemoteAutocompleteCachedKeywordChip from '@/components/damImage/uploadQueue/keyword/KeywordRemoteAutocompleteCachedKeywordChip.vue'
import KeywordCreateButton from '@/components/damImage/uploadQueue/keyword/KeywordCreateButton.vue'

const props = withDefaults(
  defineProps<{
    modelValue: DocId | null | DocId[] | any
    extSystem: IntegerId
    queueId?: string | undefined
    label?: string | undefined
    required?: boolean | null
    disabled?: boolean | undefined
    multiple?: boolean
    clearable?: boolean
    dataCy?: string
    validationScope?: ValidationScope
  }>(),
  {
    label: undefined,
    queueId: undefined,
    required: null,
    disabled: undefined,
    multiple: false,
    clearable: false,
    dataCy: undefined,
    validationScope: undefined,
  }
)
const emit = defineEmits<{
  (e: 'update:modelValue', data: DocId | null | DocId[]): void
}>()

const modelValueComputed = computed({
  get() {
    return props.modelValue
  },
  set(newValue) {
    emit('update:modelValue', [...newValue])
  },
})

const requiredComputed = computed(() => !!props.required)

const { requiredIf } = useValidate()

const rules = {
  modelValueComputed: {
    required: requiredIf(requiredComputed),
  },
}

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const v$ = useVuelidate(rules, { modelValueComputed }, { $scope: props.validationScope })

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const { fetchItemsMinimal } = useKeywordSelectActions(props.extSystem)

const innerFilter = useKeywordFilter()

const addNewKeywordText = ref('')

const searchChange = (newValue: string) => {
  if (newValue.length > 0) addNewKeywordText.value = newValue
}

const { addManualToCachedKeywords } = useDamCachedKeywords()

const afterCreate = (keyword: DamKeyword) => {
  addManualToCachedKeywords(keyword)
  if (isArray(modelValueComputed.value)) {
    modelValueComputed.value = [...modelValueComputed.value, keyword.id]
    return
  }
  modelValueComputed.value = keyword.id
}

const itemSlotIsSelected = (item: DocId) => {
  if (isArray(modelValueComputed.value)) {
    return modelValueComputed.value.includes(item)
  } else if (modelValueComputed.value) {
    return modelValueComputed.value === item
  }
  return false
}
</script>

<template>
  <div class="d-flex">
    <AFormRemoteAutocompleteWithCached
      v-model="modelValueComputed"
      :use-cached="useDamCachedAuthorsForRemoteAutocomplete"
      :v="v$"
      :required="requiredComputed"
      :label="label"
      :fetch-items-minimal="fetchItemsMinimal"
      :inner-filter="innerFilter"
      :multiple="multiple"
      :clearable="clearable"
      filter-by-field="text"
      :filter-sort-by="null"
      item-title="name"
      item-value="id"
      :data-cy="dataCy"
      @search-change="searchChange"
    >
      <template #item="{ props: itemSlotProps, item: itemSlotItem }">
        <VListItem
          v-bind="itemSlotProps"
          @click.prevent=""
        >
          <template
            v-if="multiple"
            #prepend
          >
            <VCheckboxBtn
              :model-value="itemSlotIsSelected(itemSlotItem.value)"
              :ripple="false"
            />
          </template>
          <template #title>
            <KeywordRemoteAutocompleteCachedKeywordChip
              :id="itemSlotItem.value"
              :key="itemSlotItem.value"
              :queue-id="queueId"
              :title="itemSlotItem.title"
              text-only
            />
          </template>
        </VListItem>
      </template>
      <template #chip="{ item: chipSlotItem }">
        <KeywordRemoteAutocompleteCachedKeywordChip
          :id="chipSlotItem.value"
          :key="chipSlotItem.value"
          :queue-id="queueId"
          :title="chipSlotItem.title"
          force-rounded
        />
      </template>
    </AFormRemoteAutocompleteWithCached>
    <div>
      <KeywordCreateButton
        variant="icon"
        data-cy="add-keyword"
        :ext-system="extSystem"
        :initial-value="addNewKeywordText"
        disable-redirect
        :disabled="disabled"
        @on-success="afterCreate"
      />
    </div>
  </div>
</template>
