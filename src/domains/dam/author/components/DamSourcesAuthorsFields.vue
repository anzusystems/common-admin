<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import type { DocId, IntegerId } from '@/shared/types/common'
import type { ValidationScope } from '@/shared/types/Validation'
import ASystemEntityScope from '@/domains/form/components/ASystemEntityScope.vue'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import DamSourcesAuthorsRow from '@/domains/dam/author/components/DamSourcesAuthorsRow.vue'
import { useDamCachedAuthors } from '@/domains/dam/author/composables/cachedAuthors'
import { useDamCreditPreview } from '@/domains/dam/author/composables/damCredit'
import type { DamFieldsDisabledAs } from '@/domains/dam/uploadQueue/components/uploadQueueBindings'
import { useDamConfigName } from '@/domains/dam/composables/damConfigName'

/**
 * Sources and authors of an asset side by side, each with its own field, and the credit they make.
 * An author created in one field that is of the other kind goes to the other field.
 */
const props = withDefaults(
  defineProps<{
    extSystem: IntegerId
    sourceEnabled: boolean
    authorEnabled?: boolean
    sourceRequired?: boolean
    authorRequired?: boolean
    disabled?: boolean
    /** How the disabled fields look, see `AuthorRemoteAutocompleteWithCached`. */
    disabledAs?: DamFieldsDisabledAs
    validationScope?: ValidationScope
    authorConflicts?: DocId[]
    queueId?: string
    showCredit?: boolean
    creditLabel?: string
    /** DAM configuration to use. Defaults to the parent component's, else `default`. */
    configName?: string
  }>(),
  {
    authorEnabled: true,
    sourceRequired: false,
    authorRequired: false,
    disabled: false,
    disabledAs: 'chips',
    validationScope: undefined,
    authorConflicts: undefined,
    queueId: undefined,
    showCredit: false,
    creditLabel: undefined,
    configName: undefined,
  }
)

const emit = defineEmits<{
  (e: 'change'): void
}>()

const sources = defineModel<DocId[]>('sources', { required: true })
const authors = defineModel<DocId[]>('authors', { required: true })

// eslint-disable-next-line vue/no-setup-props-reactivity-loss
const damConfigName = useDamConfigName(props.configName)

const { t } = useI18n()

const { getCachedAuthor } = useDamCachedAuthors(damConfigName)
const credit = useDamCreditPreview(getCachedAuthor, () => props.extSystem, sources, authors, damConfigName)
</script>

<template>
  <DamSourcesAuthorsRow
    :source-enabled="sourceEnabled"
    :author-enabled="authorEnabled"
    :credit="showCredit && sourceEnabled ? credit : ''"
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
              :disabled-as="disabledAs"
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
              :disabled-as="disabledAs"
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
