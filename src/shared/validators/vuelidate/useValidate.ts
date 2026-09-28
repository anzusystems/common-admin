import { useValidateBetween } from '@/shared/validators/vuelidate/common/useValidateBetween'
import { useValidateEmail } from '@/shared/validators/vuelidate/common/useValidateEmail'
import { useValidateHexColor } from '@/shared/validators/vuelidate/common/useValidateHexColor'
import { useValidateMaxLength } from '@/shared/validators/vuelidate/common/useValidateMaxLength'
import { useValidateMaxValue } from '@/shared/validators/vuelidate/common/useValidateMaxValue'
import { useValidateMinLength } from '@/shared/validators/vuelidate/common/useValidateMinLength'
import { useValidateMinValue } from '@/shared/validators/vuelidate/common/useValidateMinValue'
import { useValidateNumeric } from '@/shared/validators/vuelidate/common/useValidateNumeric'
import { useValidateRequired } from '@/shared/validators/vuelidate/common/useValidateRequired'
import { useValidateRequiredIf } from '@/shared/validators/vuelidate/common/useValidateRequiredIf'
import { useValidateSlug } from '@/shared/validators/vuelidate/common/useValidateSlug'
import { useValidateStringArrayItemLength } from '@/shared/validators/vuelidate/common/useValidateStringArrayItemLength'
import { useValidateUrl } from '@/shared/validators/vuelidate/common/useValidateUrl'
import { useValidateCompareDates } from '@/shared/validators/vuelidate/common/useValidateCompareDates'

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
    hexColor: useValidateHexColor(),
    numeric: useValidateNumeric(),
    slug: useValidateSlug(),
    url: useValidateUrl(),
    stringArrayItemLength: useValidateStringArrayItemLength(),
    datesCompare: useValidateCompareDates(),
  }
}
