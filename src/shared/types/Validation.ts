import type { Ref } from 'vue'

export type ValidationScope = string | number | boolean | symbol | undefined

/**
 * What a form field reads from its `v`. A vuelidate field state
 * (`v$.title`) fits as is; anything else must provide these members.
 */
export interface AFormFieldValidation {
  $touch: () => void
  $invalid: boolean
  /**
   * Joined into the field's error message.
   */
  $errors: ReadonlyArray<{ $message: string | Ref<string> }>
  /**
   * `system.subject.field`: names the field for collaboration and the remote form fields.
   */
  $path: string
  /**
   * A `required` rule stars the label. Its `$params.type` tells it from `requiredIf`.
   * Typed `unknown` because vuelidate types this member as a nested validation on a field without that rule.
   */
  required?: unknown
}

export type ACreateDialogValidation = Pick<AFormFieldValidation, '$touch' | '$invalid'>
