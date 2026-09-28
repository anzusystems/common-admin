import { describe, expectTypeOf, it } from 'vitest'
import { ref } from 'vue'
import useVuelidate from '@vuelidate/core'
import { maxLength, required } from '@vuelidate/validators'
import type AFormTextField from '@/domains/form/components/AFormTextField.vue'
import type { AFormFieldValidation } from '@/shared/types/Validation'

// Form fields took `v?: any`, so a typo in `:v="v$.titel"` or a hand-made object missing `$touch`
// only showed at runtime.
describe('AFormFieldValidation', () => {
  it('is what a vuelidate field state is', () => {
    const v$ = useVuelidate(
      { title: { required, maxLength: maxLength(10) }, note: {} },
      { title: ref(''), note: ref('') }
    )
    expectTypeOf(v$.value.title).toExtend<AFormFieldValidation>()
    expectTypeOf(v$.value.note).toExtend<AFormFieldValidation>()
  })

  it('is what the fields take, and an object without $touch is not', () => {
    expectTypeOf<InstanceType<typeof AFormTextField>['$props']['v']>().toEqualTypeOf<
      AFormFieldValidation | null | undefined
    >()
    expectTypeOf<{ $errors: []; $path: string; $invalid: false }>().not.toExtend<AFormFieldValidation>()
  })
})
