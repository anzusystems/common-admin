import { type Ref } from 'vue'
import useVuelidate from '@vuelidate/core'
import { helpers } from '@vuelidate/validators'
import { useValidateRequired } from '@/validators/vuelidate/common/useValidateRequired'
import { useValidateMinLength } from '@/validators/vuelidate/common/useValidateMinLength'
import { useValidateMaxLength } from '@/validators/vuelidate/common/useValidateMaxLength'

export const QuizValidationSymbol = Symbol.for('playground:quiz-validation-scope')

export const QuizAnswerValueType = {
  Bool: 'bool',
  Points: 'points',
} as const
export type QuizAnswerValueTypeType = (typeof QuizAnswerValueType)[keyof typeof QuizAnswerValueType]

export interface QuizAttributes {
  answerValueType: QuizAnswerValueTypeType
}

export interface QuizQuestionAnswer {
  id: number
  question: number
  position: number
  title: string
  points: number
}

export interface QuizQuestion {
  id: number
  quiz: number
  position: number
  title: string
  explanation: string
  answers: QuizQuestionAnswer[]
}

export interface Quiz {
  id: number
  title: string
  attributes: QuizAttributes
  questions: QuizQuestion[]
}

let nextQuestionId = 1000
let nextAnswerId = 5000

export const createQuiz = (): Quiz => ({
  id: 1,
  title: 'Sample quiz',
  attributes: { answerValueType: QuizAnswerValueType.Bool },
  questions: [
    {
      id: 1,
      quiz: 1,
      position: 1,
      title: 'What is the capital of France?',
      explanation: 'Paris is the capital of France.',
      answers: [
        { id: 1, question: 1, position: 1, title: 'Paris', points: 1 },
        { id: 2, question: 1, position: 2, title: 'London', points: 0 },
        { id: 3, question: 1, position: 3, title: 'Berlin', points: 0 },
      ],
    },
    {
      id: 2,
      quiz: 1,
      position: 2,
      title: 'How many planets in the Solar System?',
      explanation: 'Eight, since Pluto was reclassified.',
      answers: [
        { id: 4, question: 2, position: 1, title: 'Seven', points: 0 },
        { id: 5, question: 2, position: 2, title: 'Eight', points: 1 },
        { id: 6, question: 2, position: 3, title: 'Nine', points: 0 },
      ],
    },
  ],
})

export const createQuizQuestion = (): QuizQuestion => ({
  id: nextQuestionId++,
  quiz: 0,
  position: 0,
  title: '',
  explanation: '',
  answers: [],
})

export const createQuizQuestionAnswer = (): QuizQuestionAnswer => ({
  id: nextAnswerId++,
  question: 0,
  position: 0,
  title: '',
  points: 0,
})

export function useQuizValidation(quiz: Ref<Quiz>) {
  const required = useValidateRequired()
  const minLength = useValidateMinLength()
  const maxLength = useValidateMaxLength()

  const rules = {
    quiz: {
      title: {
        required,
        minLength: minLength(3),
        maxLength: maxLength(255),
      },
      questions: {
        required,
        minLength: minLength(2),
        $each: helpers.forEach({
          title: {
            required,
            minLength: minLength(1),
          },
          answers: {
            required,
            minLength: minLength(2),
          },
        }),
      },
    },
  }
  const v$ = useVuelidate(rules, { quiz }, { $scope: QuizValidationSymbol })

  return { v$ }
}
