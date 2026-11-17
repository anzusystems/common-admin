<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import type { DocId, IntegerId } from '@/types/common'
import type { ValidationScope } from '@/types/Validation'
import ASystemEntityScope from '@/components/form/ASystemEntityScope.vue'
import AuthorRemoteAutocompleteWithCached from '@/components/damImage/uploadQueue/author/AuthorRemoteAutocompleteWithCached.vue'
import DamSourcesAuthorsRow from '@/components/damImage/uploadQueue/components/DamSourcesAuthorsRow.vue'

withDefaults(
  defineProps<{
    extSystem: IntegerId
    sourceEnabled: boolean
    authorEnabled?: boolean
    sourceRequired?: boolean
    authorRequired?: boolean
    disabled?: boolean
    validationScope?: ValidationScope
    authorConflicts?: DocId[]
    queueId?: string
    credit?: string
    creditLabel?: string
  }>(),
  {
    authorEnabled: true,
    sourceRequired: false,
    authorRequired: false,
    disabled: false,
    validationScope: undefined,
    authorConflicts: undefined,
    queueId: undefined,
    credit: '',
    creditLabel: undefined,
  },
)

const emit = defineEmits<{
  (e: 'change'): void
}>()

const sources = defineModel<DocId[]>('sources', { required: true })
const authors = defineModel<DocId[]>('authors', { required: true })

const { t } = useI18n()
</script>

<template>
  <DamSourcesAuthorsRow
    :source-enabled="sourceEnabled"
    :author-enabled="authorEnabled"
    :credit="credit"
    :credit-label="creditLabel"
  >
    <template #sources>
      <ASystemEntityScope
        subject="author"
        system="dam"
      >
        <div class="d-flex">
          <div class="a-dam-sources-authors-fields__field">
            <AuthorRemoteAutocompleteWithCached
              v-model="sources"
              v-model:counterpart="authors"
              :ext-system="extSystem"
              :queue-id="queueId"
              :label="t('common.damImage.asset.model.sources')"
              data-cy="custom-field-sources"
              source
              clearable
              multiple
              :disabled="disabled"
              :required="sourceRequired"
              :validation-scope="validationScope"
              @update:model-value="emit('change')"
              @update:counterpart="emit('change')"
            />
          </div>
          <slot name="sources-append" />
        </div>
      </ASystemEntityScope>
    </template>
    <template #authors>
      <ASystemEntityScope
        subject="author"
        system="dam"
      >
        <div class="d-flex">
          <div class="a-dam-sources-authors-fields__field">
            <AuthorRemoteAutocompleteWithCached
              v-model="authors"
              v-model:counterpart="sources"
              :ext-system="extSystem"
              :queue-id="queueId"
              :label="t('common.damImage.asset.model.authors')"
              :author-conflicts="authorConflicts"
              data-cy="custom-field-authors"
              :source="sourceEnabled ? false : undefined"
              clearable
              multiple
              :disabled="disabled"
              :required="authorRequired"
              :validation-scope="validationScope"
              @update:model-value="emit('change')"
              @update:counterpart="emit('change')"
            />
          </div>
          <slot name="authors-append" />
        </div>
      </ASystemEntityScope>
    </template>
  </DamSourcesAuthorsRow>
</template>

<style lang="scss" scoped>
.a-dam-sources-authors-fields__field {
  flex-grow: 1;
  min-width: 0;
}
</style>
