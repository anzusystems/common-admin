<script lang="ts" setup>
import { ref, watch } from 'vue'
import useVuelidate from '@vuelidate/core'
import { useI18n } from 'vue-i18n'
import ADialogToolbar from '@/components/ADialogToolbar.vue'
import AUserMetadataForm from '@/labs/anzuUser/AUserMetadataForm.vue'
import { useAnzuUserFactory } from '@/model/factory/AnzuUserFactory'
import type { BaseUser } from '@/types/AnzuUser'
import type { IntegerIdNullable } from '@/types/common'
import { cloneDeep, isNull } from '@/utils/common'

const props = withDefaults(
  defineProps<{
    /** The system's name as the app translates it. */
    systemLabel: string
    /** The system's `createNote` -- what is special about having an account there. */
    createNote?: string | undefined
    /**
     * Whether the account about to be created will be switched on.
     *
     * The sentence about a working public account is composed here rather than carried by the
     * descriptor, because it depends on the value being sent: creating from a panel copies the
     * source account's `enabled` -- usually true -- while creating after a search that found
     * nobody sends false, since there is no source to copy from.
     */
    willBeEnabled?: boolean
    loading?: boolean
    disabled?: boolean
    /** The target system's `requiredMetadata`: the profile the form validates against. */
    requiredMetadata?: boolean
    /** The person's id. Always drawn and never editable here -- this path is about somebody who exists. */
    userId?: IntegerIdNullable
    /**
     * What is already known about them, to prefill the form.
     *
     * Not the body that gets posted: the caller reads the source again immediately before the POST.
     * This is what the operator sees and completes, and completing it is the point -- a person known
     * only in blog usually has an empty `person`, while the target may require it, so a silent copy
     * would create a record the target's own form then refuses to save.
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

// Seeded on every open, not once: the row behind it is re-probed after each write, and a stale
// prefill would put what the account looked like two writes ago into the body.
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
        <ADialogToolbar @on-cancel="dialog = false">
          {{ t('common.userSystem.create.title', { system: systemLabel }) }}
        </ADialogToolbar>
        <VCardText>
          <!--
            The id is shown and locked: the person exists, this is their global id, and the whole
            operation is about giving that same identity an account here.
          -->
          <AUserMetadataForm
            v-model:user="user"
            :required="requiredMetadata"
            id-input
            is-edit
          />
          <!--
            Said out loud, because neither is obvious and neither can be undone: the account is
            created with nothing granted, and no admin in the fleet can delete an AnzuUser.
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
