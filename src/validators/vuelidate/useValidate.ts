import { useValidateBetween } from '@/validators/vuelidate/common/useValidateBetween'
import { useValidateEmail } from '@/validators/vuelidate/common/useValidateEmail'
import { useValidateMaxLength } from '@/validators/vuelidate/common/useValidateMaxLength'
import { useValidateMaxValue } from '@/validators/vuelidate/common/useValidateMaxValue'
import { useValidateMinLength } from '@/validators/vuelidate/common/useValidateMinLength'
import { useValidateMinValue } from '@/validators/vuelidate/common/useValidateMinValue'
import { useValidateNumeric } from '@/validators/vuelidate/common/useValidateNumeric'
import { useValidateRequired } from '@/validators/vuelidate/common/useValidateRequired'
import { useValidateRequiredIf } from '@/validators/vuelidate/common/useValidateRequiredIf'
import { useValidateSlug } from '@/validators/vuelidate/common/useValidateSlug'
import { useValidateStringArrayItemLength } from '@/validators/vuelidate/common/useValidateStringArrayItemLength'
import { useValidateUrl } from '@/validators/vuelidate/common/useValidateUrl'
import { useValidateCompareDates } from '@/validators/vuelidate/common/useValidateCompareDates'

export function useValidate() {
  return {
    required: useValidateRequired(),
    requiredIf: useValidateRequiredIf(),
    minLength: useValidateMinLength(),
    maxLength: useValidateMaxLength(),
    minValue: useValidateMinValue(),
    maxValue: useValidateMaxValue(),
    between: useValidateBetween(),
    email: useValidateEmail(),
    numeric: useValidateNumeric(),
    slug: useValidateSlug(),
    url: useValidateUrl(),
    stringArrayItemLength: useValidateStringArrayItemLength(),
    datesCompare: useValidateCompareDates(),
  }
}
