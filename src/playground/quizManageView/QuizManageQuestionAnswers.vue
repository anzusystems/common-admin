<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import useVuelidate from '@vuelidate/core'
import { helpers } from '@vuelidate/validators'
import ACard from '@/components/ACard.vue'
import ARow from '@/components/ARow.vue'
import AFormTextarea from '@/components/form/AFormTextarea.vue'
import AFormTextField from '@/components/form/AFormTextField.vue'
import ASortableListEditor from '@/labs/listEditor/ASortableListEditor.vue'
import type { ListEditorKey, ListViewItem } from '@/labs/listEditor/types/listEditorTypes'
import { useValidateRequired } from '@/validators/vuelidate/common/useValidateRequired'
import { useValidateMinLength } from '@/validators/vuelidate/common/useValidateMinLength'
import {
  QuizValidationSymbol,
  type QuizQuestion,
  type QuizQuestionAnswer,
  type QuizAnswerValueTypeType,
  QuizAnswerValueType,
  createQuizQuestionAnswer,
} from '@/playground/quizManageView/quizMock'

type ReorderMode = 'view' | 'reorder'

const props = defineProps<{
  modelValue: QuizQuestion
  answerValueType: QuizAnswerValueTypeType
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', data: QuizQuestion): void
}>()
const selectedValue = computed({
  get() {
    return props.modelValue
  },
  set(newValue: QuizQuestion) {
    emit('update:modelValue', newValue)
  },
})
const mode = defineModel<ReorderMode>('mode', { default: 'view' })
const unsavedKeys = defineModel<Set<ListEditorKey>>('unsavedKeys', {
  default: () => new Set<ListEditorKey>(),
})
const valueType = computed(() => props.answerValueType)
watch(valueType, () => {
  selectCorrectAnswer(-1)
})

const required = useValidateRequired()
const minLength = useValidateMinLength()
const answerRules = {
  question: {
    answers: {
      $each: helpers.forEach({
        title: {
          required,
          minLength: minLength(1),
        },
      }),
    },
  },
}
const v$ = useVuelidate(answerRules, { question: selectedValue }, { $scope: QuizValidationSymbol })

const getAnswerValidationState = (_: QuizQuestionAnswer, __: ListEditorKey, index: number) => {
  // helpers.forEach exposes per-row errors as an OBJECT keyed by property
  // name → array of error entries. A row is invalid if any property has a
  // non-empty error array. Plain `.length` is wrong (it's not an array).
  const errors = v$.value.question.answers.$each?.$response?.$errors?.[index]
  if (!errors || typeof errors !== 'object') return null
  const hasErrors = Object.values(errors).some(
    (propErrors) => Array.isArray(propErrors) && propErrors.length > 0,
  )
  return hasErrors ? 'invalid' : null
}

const onAddAnswer = () => {
  const newAnswer = createQuizQuestionAnswer()
  newAnswer.question = selectedValue.value.id
  newAnswer.position = (selectedValue.value.answers.at(-1)?.position ?? 0) + 1
  selectedValue.value.answers.push(newAnswer)
}
const onDeleteAnswer = (vi: ListViewItem<QuizQuestionAnswer>) => {
  selectedValue.value.answers.splice(vi.index, 1)
}

const selectCorrectAnswer = (answerIndex: number) => {
  const answers = selectedValue.value.answers
  answers.forEach((answer) => {
    answer.points = 0
  })
  if (answerIndex > -1) {
    answers[answerIndex].points = 1
  }
  selectedValue.value.answers = answers
}

onMounted(() => {
  if (selectedValue.value.answers.length === 0) {
    onAddAnswer()
    onAddAnswer()
  }
})
</script>

<template>
  <ASortableListEditor
    v-model="selectedValue.answers"
    v-model:mode="mode"
    v-model:unsaved-keys="unsavedKeys"
    :get-validation-state="getAnswerValidationState"
    title="Answers"
    add-label="Add answer"
    embedded
    @add="onAddAnswer"
    @deleted="onDeleteAnswer"
  >
    <template #item-compact="{ raw }: { raw: QuizQuestionAnswer }">
      <span>{{ raw.title || '(empty answer)' }}</span>
    </template>
    <template #item="{ raw, index }: { raw: QuizQuestionAnswer; index: number }">
      <ACard class="pt-5">
        <VRow>
          <VCol cols="11">
            <AFormTextarea
              v-model="raw.title"
              label="Answer title"
              required
            />
          </VCol>
          <VCol cols="1">
            <AFormTextField
              v-if="valueType === QuizAnswerValueType.Points"
              v-model.number="raw.points"
              label="Points"
            />
            <VCheckboxBtn
              v-if="valueType === QuizAnswerValueType.Bool"
              v-model.number="raw.points"
              :true-value="1"
              :false-value="0"
              @change="selectCorrectAnswer(index)"
            />
          </VCol>
        </VRow>
        <ARow>
          <span class="text-body-small text-medium-emphasis">
            (image widget omitted in playground)
          </span>
        </ARow>
      </ACard>
    </template>
  </ASortableListEditor>
</template>
