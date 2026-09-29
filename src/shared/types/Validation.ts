import type { Ref } from 'vue'

export type ValidationScope = string | number | boolean | symbol | undefined

/**
 * What a form field reads from its `v`. A vuelidate field state (`v$.title`) fits as it is; anything
 * else has to provide these members.
 */
export interface AFormFieldValidation {
  $touch: () => void
  $invalid: boolean
  /** Joined into the field's error message. */
  $errors: ReadonlyArray<{ $message: string | Ref<string> }>
  /** `system.subject.field`: names the field for collaboration and the remote form fields. */
  $path: string
  /**
   * A `required` rule stars the label; its `$params.type` tells it from `requiredIf`. `unknown`
   * because vuelidate types the member of a field without that rule as a nested validation.
   */
  required?: unknown
}

/** What `ACreateDialog` reads from its `v`: the form's state. */
export type ACreateDialogValidation = Pick<AFormFieldValidation, '$touch' | '$invalid'>
