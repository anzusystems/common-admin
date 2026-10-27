<script lang="ts" setup>
import { ref, watch } from 'vue'
import useVuelidate from '@vuelidate/core'
import { useI18n } from 'vue-i18n'
import ADialogToolbar from '@/domains/ui/components/ADialogToolbar.vue'
import AUserMetadataForm from '@/domains/anzuUser/components/AUserMetadataForm.vue'
import { useAnzuUserFactory } from '@/domains/anzuUser/factory/AnzuUserFactory'
import type { BaseUser } from '@/shared/types/AnzuUser'
import type { IntegerIdNullable } from '@/shared/types/common'
import { cloneDeep, isNull } from '@/shared/utils/common'

const props = withDefaults(
  defineProps<{
    systemLabel: string
    /**
     * The system's `createNote`: what is special about having an account there.
     */
    createNote?: string | undefined
    /**
     * Whether the created account will be switched on.
     * The sentence about a working public account is composed here, not in the descriptor, because it depends on
     * this value. Creating from a panel copies the source's `enabled`; creating after an empty search sends false.
     */
    willBeEnabled?: boolean
    loading?: boolean
    disabled?: boolean
    /**
     * The target system's `requiredMetadata`: the profile the form validates against.
     */
    requiredMetadata?: boolean
    /**
     * The person's id. Always shown and never editable here, because this path is for a person who already exists.
     */
    userId?: IntegerIdNullable
    /**
     * Known data used to prefill the form. It is not the posted
     * body: the caller re-reads the source right before the POST.
     * The operator must complete it. A person known only in blog usually has an empty `person`, which
     * the target may require, so a silent copy would create a record the target's form refuses to save.
     */
    source?: BaseUser | null
  }>(),
  {
    createNote: undefined,
    willBeEnabled: false,
    loading: false,
    disabled: false,
    requiredMetadata: false,
    userId: null,
    source: null,
  }
)

const emit = defineEmits<{
  (e: 'confirm', user: BaseUser): void
}>()

const { t } = useI18n()
const { createAnzuUser } = useAnzuUserFactory()
const dialog = ref(false)

const user = ref<BaseUser>(createAnzuUser())
const v$ = useVuelidate()

// Seeded on every open, not once. The row is re-probed after
// each write, and a stale prefill would send outdated values.
watch(dialog, (open) => {
  if (!open) return
  const seed = isNull(props.source) ? createAnzuUser() : cloneDeep(props.source)
  if (!isNull(props.userId)) seed.id = props.userId
  user.value = seed
  v$.value.$reset()
})

const confirm = async () => {
  if (!(await v$.value.$validate())) return
  dialog.value = false
  emit('confirm', cloneDeep(user.value))
}
</script>

<template>
  <div class="d-inline-flex">
    <VBtn
      :disabled="disabled"
      :loading="loading"
      size="small"
      variant="flat"
      color="primary"
      data-cy="user-system-create"
      @click.stop="dialog = true"
    >
      {{ t('common.userSystem.button.create') }}
    </VBtn>
    <VDialog
      v-model="dialog"
      :max-width="640"
    >
      <VCard>
        <ADialogToolbar @cancel="dialog = false">
          {{ t('common.userSystem.create.title', { system: systemLabel }) }}
        </ADialogToolbar>
        <VCardText>
          <!-- The id is shown and locked: this gives the existing person's global id an account here. -->
          <AUserMetadataForm
            v-model:user="user"
            :required="requiredMetadata"
            id-input
            is-edit
          />
          <!--
            Stated explicitly because neither is obvious or reversible: the account
            is created with nothing granted, and no admin can delete an AnzuUser.
          -->
          <p class="mt-2">{{ t('common.userSystem.create.note') }}</p>
          <p
            v-if="createNote"
            class="mt-2"
          >
            {{ createNote }}
          </p>
          <p class="mt-2">
            {{
              props.willBeEnabled
                ? t('common.userSystem.create.willBeEnabled')
                : t('common.userSystem.create.willBeDisabled')
            }}
          </p>
        </VCardText>
        <VCardActions>
          <ABtnTertiary @click.stop="dialog = false">
            {{ t('common.button.cancel') }}
          </ABtnTertiary>
          <VSpacer />
          <ABtnPrimary
            :loading="loading"
            data-cy="user-system-create-confirm"
            @click.stop="confirm"
          >
            {{ t('common.button.confirm') }}
          </ABtnPrimary>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>
