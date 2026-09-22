<script lang="ts" setup>
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AAvatarColorPicker from '@/components/AAvatarColorPicker.vue'
import ACopyText from '@/components/ACopyText.vue'
import ARow from '@/components/ARow.vue'
import AFormTextField from '@/components/form/AFormTextField.vue'
import ASystemEntityScope from '@/components/form/ASystemEntityScope.vue'
import { ANZU_USER_ENTITY } from '@/labs/anzuUser/anzuUserApi'
import { useUserMetadataValidation } from '@/labs/anzuUser/anzuUserValidations'
import type { BaseUser } from '@/types/AnzuUser'

const props = withDefaults(
  defineProps<{
    /**
     * The system's validation profile (`requiredMetadata`). The cross-system repair form passes
     * `true` outright: it writes to nine places at once, and a loose form could put an empty name
     * into cms -- a record cms's own form would then refuse to save.
     */
    required?: boolean
    /**
     * Whether the id is typed in at all. False only in cms, whose backend resolves it from SSO.
     * With `isEdit` this makes three states, which one `readonly` could not express: not drawn,
     * editable, or shown read-only.
     */
    idInput?: boolean
    isEdit?: boolean
    readonly?: boolean
    /**
     * Random colour on an empty value, as all four admins do today. Deliberately not passed by the
     * cross-system repair form: it is always strict, so it would invent a colour on open and mark
     * it as a change in every system at once.
     */
    randomColor?: boolean
    /** The system's `metadataNote` -- the same sentence the cross-system dialog shows. */
    note?: string | undefined
    /** i18n namespace for the field labels; the backend identity does not belong here. */
    scopeSystem?: string
    scopeSubject?: string
    /** Vuelidate scope. Omitted means the page's own collector picks these rules up. */
    validationScope?: string | symbol | false | undefined
  }>(),
  {
    required: false,
    idInput: true,
    isEdit: false,
    readonly: false,
    randomColor: false,
    note: undefined,
    scopeSystem: 'common',
    scopeSubject: ANZU_USER_ENTITY,
    validationScope: undefined,
  }
)

const user = defineModel<BaseUser>('user', { required: true })

const { t } = useI18n()

/* eslint-disable vue/no-setup-props-reactivity-loss */
const { v$ } = useUserMetadataValidation(user, {
  required: props.required,
  idInput: props.idInput,
  isEdit: props.isEdit,
  scope: props.validationScope,
})
/* eslint-enable vue/no-setup-props-reactivity-loss */

const derivedFullName = () => {
  const { firstName, lastName } = user.value.person
  if (firstName.length === 0 || lastName.length === 0) return ''
  return firstName + ' ' + lastName
}

const derivedAvatarText = () => {
  const { firstName, lastName } = user.value.person
  if (firstName.length === 0 || lastName.length === 0) return ''
  return firstName.slice(0, 1) + lastName.slice(0, 1)
}

/**
 * A dirty flag, not a checkbox: the two derived fields stay ordinary inputs that recompute while
 * nobody has touched them, and stop the moment somebody does.
 *
 * The flags are seeded from the data rather than starting clean. A stored value that differs from
 * what the names would produce was set on purpose -- the cms fixtures carry `Anzu` + `User 1` with
 * a full name of `Anzu User1` -- and renaming the person must not silently overwrite it.
 */
const fullNameTouched = ref(false)
const avatarTextTouched = ref(false)

const seedTouchedFlags = () => {
  fullNameTouched.value = user.value.person.fullName.length > 0 && user.value.person.fullName !== derivedFullName()
  avatarTextTouched.value = user.value.avatar.text.length > 0 && user.value.avatar.text !== derivedAvatarText()
}

onMounted(seedTouchedFlags)

/**
 * Re-seeded whenever the record itself is replaced, not only when its id changes.
 *
 * The id is not enough: the metadata repair dialog swaps between two systems' records *for the
 * same person*, so the id never moves. Without this the flags would still describe the record
 * before the swap, and a deliberate full name in the newly chosen source would be overwritten by
 * one derived from its names -- silently discarding the very value the operator picked as the
 * source of truth.
 *
 * Declared before the derive watcher below so it runs first: the flags are up to date before
 * anything decides whether to recompute.
 */
watch(
  () => user.value,
  () => seedTouchedFlags()
)

// Keyed on the names themselves rather than on an array, whose identity is new on every read --
// that alone would make this fire on any object replacement, including one that changed nothing.
watch(
  () => `${user.value.person.firstName}\u0000${user.value.person.lastName}`,
  (next, previous) => {
    if (props.readonly || next === previous) return
    if (!fullNameTouched.value) user.value.person.fullName = derivedFullName()
    if (!avatarTextTouched.value) user.value.avatar.text = derivedAvatarText()
  }
)
</script>

<template>
  <ASystemEntityScope
    :system="scopeSystem"
    :subject="scopeSubject"
  >
    <VRow>
      <VCol cols="12">
        <VAlert
          v-if="note"
          type="info"
          variant="tonal"
          density="compact"
          class="mb-4"
        >
          {{ note }}
        </VAlert>
        <VRow>
          <VCol
            cols="12"
            sm="3"
          >
            <!--
              Three states, not two. Not drawn where the backend resolves the id itself; a plain
              field while creating; read-only once the record exists, because it is the primary key
              every other system looks this person up by.
            -->
            <!--
              `.number` is not decoration and it is not inert on a component: Vue applies model
              modifiers inside `emit`, so without it the field hands back the string "42" against a
              declared `IntegerIdNullable`, and that string is what the create body carries. Every
              admin that draws this field binds it the same way.
            -->
            <AFormTextField
              v-if="idInput && !isEdit && !readonly"
              v-model.number="user.id"
              type="number"
              :v="v$.user.id"
              :label="t('common.anzuUser.model.id')"
              :hint="t('common.anzuUser.hint.idReadonlyOnEdit')"
              persistent-hint
            />
            <ARow
              v-else-if="user.id"
              :title="t('common.anzuUser.model.id')"
            >
              <ACopyText :value="user.id" />
            </ARow>
          </VCol>
          <VCol
            cols="12"
            sm="9"
          >
            <ARow
              v-if="readonly"
              :title="t('common.anzuUser.model.email')"
              :value="user.email"
            />
            <AFormTextField
              v-else
              v-model="user.email"
              :v="v$.user.email"
              data-cy="user-email"
            />
          </VCol>
        </VRow>
        <VRow>
          <VCol
            cols="12"
            sm="3"
          >
            <ARow
              v-if="readonly"
              :title="t('common.anzuUser.model.person.firstName')"
              :value="user.person.firstName"
            />
            <AFormTextField
              v-else
              v-model="user.person.firstName"
              :v="v$.user.person.firstName"
              data-cy="user-firstName"
            />
          </VCol>
          <VCol
            cols="12"
            sm="3"
          >
            <ARow
              v-if="readonly"
              :title="t('common.anzuUser.model.person.lastName')"
              :value="user.person.lastName"
            />
            <AFormTextField
              v-else
              v-model="user.person.lastName"
              :v="v$.user.person.lastName"
              data-cy="user-lastName"
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
          >
            <ARow
              v-if="readonly"
              :title="t('common.anzuUser.model.person.fullName')"
              :value="user.person.fullName"
            />
            <!--
              `@update:model-value` only fires on a real edit: assigning from the watcher above goes
              through the model, not through the field, so recomputing never marks the field touched.
            -->
            <AFormTextField
              v-else
              v-model="user.person.fullName"
              :v="v$.user.person.fullName"
              :hint="fullNameTouched ? undefined : t('common.anzuUser.hint.derivedFromName')"
              :persistent-hint="!fullNameTouched"
              data-cy="user-fullName"
              @update:model-value="fullNameTouched = true"
            />
          </VCol>
        </VRow>
        <VRow>
          <VCol
            cols="12"
            sm="3"
          >
            <AAvatarColorPicker
              v-model="user.avatar.color"
              :label="t('common.anzuUser.model.avatar.color')"
              :readonly="readonly"
              :required="required"
              :random-color="randomColor"
            />
            <div
              v-if="v$.user.avatar.color.$error"
              class="text-error text-body-small"
            >
              {{ v$.user.avatar.color.$errors[0]?.$message }}
            </div>
          </VCol>
          <VCol
            cols="12"
            sm="3"
          >
            <ARow
              v-if="readonly"
              :title="t('common.anzuUser.model.avatar.text')"
              :value="user.avatar.text"
            />
            <AFormTextField
              v-else
              v-model="user.avatar.text"
              :v="v$.user.avatar.text"
              :maxlength="3"
              :hint="avatarTextTouched ? undefined : t('common.anzuUser.hint.derivedFromName')"
              :persistent-hint="!avatarTextTouched"
              data-cy="user-avatarText"
              @update:model-value="avatarTextTouched = true"
            />
          </VCol>
        </VRow>
      </VCol>
    </VRow>
  </ASystemEntityScope>
</template>
