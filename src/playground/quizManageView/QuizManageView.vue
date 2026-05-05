<script lang="ts" setup>
import { ref } from 'vue'
import ActionbarWrapper from '@/playground/system/ActionbarWrapper.vue'
import AFormTextarea from '@/components/form/AFormTextarea.vue'
import type { ListEditorKey } from '@/labs/listEditor/types/listEditorTypes'
import QuizManageQuestions from '@/playground/quizManageView/QuizManageQuestions.vue'
import { QuizAnswerValueType, createQuiz } from '@/playground/quizManageView/quizMock'

const quiz = ref(createQuiz())

const questionsUnsavedKeys = ref(new Set<ListEditorKey>())
const answersUnsavedKeys = ref(new Set<ListEditorKey>())
const sharedMode = ref<'view' | 'reorder'>('view')
</script>

<template>
  <ActionbarWrapper />

  <VCard>
    <VCardText>
      <h2 class="text-headline-medium mt-4 mb-2">
        Quiz manage — two ASortableListEditor stacked (questions → answers)
      </h2>
      <p class="text-body-medium text-medium-emphasis mb-2">
        Mirrors the admin-cms quiz edit page. The outer editor lists
        <strong>questions</strong>; clicking a question opens its inline form which renders an inner
        editor of that question's <strong>answers</strong>. A
        <strong>single Reorder button</strong> on the outer editor drives both — drag questions to
        reorder questions, open a question and drag its answers to reorder answers, and Apply at the
        top commits everything.
      </p>
      <p class="text-body-medium text-medium-emphasis mb-6">
        <strong>Try:</strong> click the Reorder button → open a question while in reorder mode →
        drag answers; Apply commits, Cancel restores the original order of both questions and
        answers. Clear an answer's title to see the red rail propagate up to the question row.
      </p>

      <VRow class="mb-6">
        <VCol cols="8">
          <AFormTextarea
            v-model="quiz.title"
            label="Quiz title"
            required
          />
        </VCol>
        <VCol cols="4">
          <VSelect
            v-model="quiz.attributes.answerValueType"
            :items="[
              { value: QuizAnswerValueType.Bool, title: 'Bool (single correct)' },
              { value: QuizAnswerValueType.Points, title: 'Points (per answer)' },
            ]"
            label="Answer value type"
          />
        </VCol>
      </VRow>

      <VAlert
        v-if="quiz.questions.length < 2"
        text="At least 2 questions required."
        type="error"
        density="compact"
        class="mb-3"
      />
      <QuizManageQuestions
        v-model="quiz"
        v-model:mode="sharedMode"
        v-model:unsaved-keys="questionsUnsavedKeys"
        v-model:answers-unsaved-keys="answersUnsavedKeys"
      />

      <div class="text-body-small text-medium-emphasis mt-4">
        questions unsaved: {{ questionsUnsavedKeys.size }} — answers unsaved (merged across all
        questions): {{ answersUnsavedKeys.size }} — mode: {{ sharedMode }}
      </div>
    </VCardText>
  </VCard>
</template>
