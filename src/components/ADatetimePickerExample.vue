<template>
  <div
    ref="fieldContainerRef"
    class="v-date-field"
  >
    <!-- ================================================== VTextField -->
    <v-text-field
      ref="textFieldRef"
      v-bind="$attrs"
      :class="textFieldClasses"
      :color="color"
      :density="density"
      :hint="hint"
      :messages="messages"
      :model-value="textFieldModelValue"
      :persistent-hint="persistentHint"
      :persistent-placeholder="persistentPlaceholder"
      :placeholder="placeholder"
      :readonly="textFieldReadonly"
      :theme="themeAll"
      @click:clear="toggleDatePicker('clear')"
      @click:control="toggleCheck('textField')"
      @keyup.enter="toggleDatePicker('keyup')"
      @update:model-value="updateModelValue($event, 'textField')"
    >
      <!-- ========================= Pass Slots -->
      <template
        v-for="(_, slot) in slots"
        #[slot]="scope"
      >
        <slot
          v-if="!slots['prepend'] && !slots['prepend-inner'] && !slots['append-inner'] && !slots['append']"
          :name="slot"
          v-bind="{ ...scope }"
        />
      </template>

      <!-- ========================= Prepend Slot -->
      <template
        v-if="slots.prepend"
        #[`prepend`]="props"
      >
        <slot
          name="prepend"
          v-bind="{
            ...props,
            toggleDatePicker,
          }"
        />
      </template>

      <template
        v-if="prependIcon && !slots['prepend']"
        #prepend
      >
        <DatePickerIcon
          v-if="prependIcon"
          :color="hoverIconColor"
          :icon="prependIcon"
          :icon-size="iconSize"
          @click="toggleDatePicker"
        />
      </template>

      <!-- ========================= Prepend Inner Slot -->
      <template
        v-if="slots['prepend-inner']"
        #[`prepend-inner`]="props"
      >
        <slot
          name="prepend-inner"
          v-bind="{
            ...props,
            toggleDatePicker,
          }"
        />
      </template>

      <template
        v-if="prependInnerIcon && !slots['prepend-inner']"
        #prepend-inner
      >
        <DatePickerIcon
          v-if="prependInnerIcon"
          :color="hoverIconColor"
          :icon="prependInnerIcon"
          :icon-size="iconSize"
          @click="toggleCheck('textFieldIcon')"
        />
      </template>

      <!-- ========================= Append Inner Slot -->
      <template
        v-if="slots['append-inner']"
        #[`append-inner`]="props"
      >
        <slot
          name="append-inner"
          v-bind="{
            ...props,
            toggleDatePicker,
          }"
        />
      </template>

      <template
        v-if="appendInnerIcon && !slots['append-inner']"
        #append-inner
      >
        <DatePickerIcon
          v-if="appendInnerIcon"
          :color="hoverIconColor"
          :icon="appendInnerIcon"
          :icon-size="iconSize"
          @click="toggleCheck('textFieldIcon')"
        />
      </template>

      <!-- ========================= Append Slot -->
      <template
        v-if="slots.append"
        #[`append`]="props"
      >
        <slot
          name="append"
          v-bind="{
            ...props,
            toggleDatePicker,
          }"
        />
      </template>

      <template
        v-if="appendIcon && !slots['append']"
        #append
      >
        <DatePickerIcon
          v-if="appendIcon"
          :color="hoverIconColor"
          :icon="appendIcon"
          :icon-size="iconSize"
          @click="toggleDatePicker"
        />
      </template>

      <!-- Label Slot -->
      <template
        v-if="slots.label || label"
        #label
      >
        <slot
          v-if="slots.label"
          name="label"
        />

        <div v-else-if="label">
          {{ label }}
          <span
            v-if="required"
            class="text-error ms-1"
          >*</span>
        </div>
      </template>
    </v-text-field>
  </div>

  <!-- ================================================== Card Picker Container  -->
  <Teleport to="body">
    <v-defaults-provider :defaults="defaults">
      <v-card
        v-bind="defaultCardProps"
        ref="cardRef"
        :class="cardClasses"
        :style="cardStyles"
        :theme="defaults.VCard?.theme ?? themeAll"
        :width="textFieldProperties.width"
      >
        <!-- Date Picker -->
        <v-date-picker
          :disabled="readonly || defaults.VDatePicker?.disabled"
          :header="header"
          input-mode="calendar"
          :model-value="datePickerModelValue"
          :month="pickerMonth"
          :theme="themeAll"
          :title="title"
          @update:model-value="updateModelValue($event, 'datePicker')"
          @update:month="emit('update:month', $event)"
          @update:view-mode="emit('update:viewMode', $event)"
          @update:year="emit('update:year', $event)"
        >
          <template
            v-for="(_, slot) in slots"
            #[slot]="scope"
          >
            <slot
              v-if="slots['actions'] || slots['header'] || slots['title']"
              :name="slot"
              v-bind="{ ...scope }"
            />
          </template>
        </v-date-picker>
      </v-card>
    </v-defaults-provider>
  </Teleport>
</template>

<script setup lang="ts">
import {
  CardStylesObject,
  HtmlRefElement,
  InternalValue,
  Props,
  TextFieldProperties,
  VuetifyDefaults,
} from '@/types'
import { useConvertToUnit } from '@/plugin/composables/helpers'
import {
  useCardClasses,
  useTextFieldClasses,
} from '@/plugin/composables/classes'
import DatePickerIcon from '@/plugin/components/DatePickerIcon.vue'
import type { VCard } from 'vuetify/components'
import { onClickOutside } from '@vueuse/core'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import advancedFormat from 'dayjs/plugin/advancedFormat'

// -------------------------------------------------- Props //
const props = withDefaults(defineProps<Props>(), {
  appendIcon: undefined,
  appendInnerIcon: undefined,
  cardFieldWidth: false,
  cardOffsetX: 0,
  cardOffsetY: 5,
  cardPadding: 4,
  cardProps: () => ({}) as const,
  color: undefined,
  datePickerProps: () => ({}) as const,
  density: 'default',
  format: 'YYYY-MM-DD',
  hint: '',
  iconHoverColor: undefined,
  iconSize: 'default',
  label: undefined,
  messages: undefined,
  name: 'date',
  open: 'bottom left',
  persistentHint: false,
  persistentPlaceholder: false,
  placeholder: 'Select Date',
  prependIcon: undefined,
  prependInnerIcon: 'default',
  readonly: false,
  readonlyInput: false,
  required: false,
})
const emit = defineEmits([
  'update',
  'update:modelValue',
  'update:month',
  'update:viewMode',
  'update:year',
])
dayjs.extend(advancedFormat)
dayjs.extend(customParseFormat)

const attrs = useAttrs()
const slots = useSlots()
// -------------------------------------------------- Defaults //
// ------------------------- VCard //
const defaultCardProps: Props['cardProps'] = {
  elevation: props.cardProps.elevation ?? props.elevation ?? 5,
  hover: false,
  loading: false,
  verticalOffset: 28,
}

// ------------------------- VDatePicker //
const defaultDatePickerProps: Props['datePickerProps'] = {
  // // active: undefined,								// ! Fail: Not sure what this does or works - Will Not Use
  // // calendarIcon: '$calendar', 				// ? Pass - Used for 'input' mode - Will Not Use
  // // keyboardIcon: '$vuetify',					// ? Fail: Source Code shows for v3.5 - Probably will not use if for input mode
  // ! landscape: https://github.com/vuetifyjs/vuetify/issues/18274
  landscape: false,												// ! Fail: Not sure what this does or works - Not implemented?
  // // location: undefined,							// ! Fail: Not sure what this does or works - Will Not Use
  // ! month https://github.com/vuetifyjs/vuetify/pull/18686
  month: undefined,												// ! Pass/Fail w/bug
  // // position: undefined,							// ! Fail: Not sure what this does or works - Not implemented? - Will Not Use
  rounded: false,													// ! Fail: Not sure what this does or works - Not implemented?
  text: undefined,												// ! Fail: Not sure what this does or works
  // // width: undefined,									// ! Fail: Not sure what this does or works - Will Not Use
  // ! year https://github.com/vuetifyjs/vuetify/pull/18686
  year: undefined,												// ! Pass/Fail w/bug
}

const { datePickerProps, format } = toRefs(props)

const defaults = ref<VuetifyDefaults>({
  VCard: {
    ...defaultCardProps,
    ...props.cardProps,
  },
  VDatePicker: {
    ...defaultDatePickerProps,
    ...{
      allowedDates: props.allowedDates ?? undefined, 								// * Pass
      bgColor: props.pickerBgColor ?? undefined, 										// * Pass
      // border: false, 																						// ! Pass/Fail - Will Not Use
      color: props.pickerColor ?? undefined, 												// * Pass
      disabled: false, 																							// * Pass
      elevation: 0, 																								// * Pass: Keep this value
      header: props.header ?? 'Select Date',												// * Pass
      height: props.height ?? undefined, 														// * Pass
      hideHeader: props.hideHeader ?? false, 												// * Pass
      hideWeekdays: props.hideWeekdays ?? false,										// * Pass
      // inputMode: 'calendar',																			// * Pass - Do not include, Keep as calendar
      // inputPlaceholder: 'dd/mm/yyyy',														// * Pass - Do not include
      // inputText: '$vuetify.datePicker.input.placeholder', 				// * Pass - Do not include
      max: props.max ?? undefined, 																	// * Pass
      maxHeight: props.maxHeight ?? undefined,											// * Pass
      maxWidth: props.maxWidth ?? undefined,												// * Pass
      min: props.min ?? undefined,																	// * Pass
      minHeight: props.minHeight ?? undefined,											// * Pass
      minWidth: props.minWidth ?? 360,															// * Pass
      modeIcon: props.modeIcon ?? '$subgroup',											// * Pass
      multiple: props.multiple ?? false,														// * Pass
      nextIcon: props.nextIcon ?? '$next',													// * Pass
      prevIcon: props.prevIcon ?? '$prev',													// * Pass
      showAdjacentMonths: props.showAdjacentMonths ?? false,				// * Pass
      showWeek: props.showWeek ?? false,														// * Pass
      tag: props.pickerTag ?? 'div',																// * Pass
      // theme: undefined,																					// * Pass - Do not include, Handled by VTextField Prop
      title: props.title ?? '$vuetify.datePicker.title',						// * Pass
      viewMode: props.viewMode ?? 'month',													// * Pass
    },
    ...datePickerProps.value,
  },
})

// -------------------------------------------------- Data #
const cardRef = ref<VCard | null>(null)
const cardStyles = ref<CardStylesObject>({})
const textFieldModelValue = ref<InternalValue>(attrs.modelValue)
const datePickerModelValue = ref<InternalValue>(undefined)
const datePickerOpen = ref<boolean>(false)
const fieldContainerRef = ref<HtmlRefElement>(null)
const pickerMonth = ref<Props['month']>(undefined)
const themeAll = ref(props.theme ?? undefined)
let textFieldProperties = reactive<TextFieldProperties>({
  bottom: 0,
  height: 0,
  left: 0,
  right: 0,
  top: 0,
  width: 0,
})

const placeholder = ref<Props['placeholder']>(props.placeholder)
const header = ref<Props['header']>(defaults.value.VDatePicker?.header ?? 'Select Date')
const title = ref<Props['title']>(defaults.value.VDatePicker?.title ?? 'Select Date')
const multiple = ref<Props['multiple']>(defaults.value.VDatePicker?.multiple)

// -------------------------------------------------- Mounted #
onMounted(() => {
  if (multiple.value) {
    placeholder.value = 'Select Dates'
    title.value = placeholder.value
    header.value = 'Enter Dates'

    if (typeof textFieldModelValue.value === 'string') {
      const dateArray: any[] = textFieldModelValue.value.split(',')

      dateArray.forEach((d: string, index: number) => {
        dateArray[index] = new Date(d)
      })

      textFieldModelValue.value = dateArray
    }

    setTextFieldValue(textFieldModelValue.value)
    emitModelValues(formatMultipleValue())
    return
  }

  if (textFieldModelValue.value !== null && typeof textFieldModelValue.value !== 'undefined') {
    textFieldModelValue.value = formatSingleValue(textFieldModelValue.value)
    emitModelValues(textFieldModelValue.value)
  }

  setDatePickerFieldValue(textFieldModelValue.value)
})

// -------------------------------------------------- Computed #

// ------------------------- Text Field #
const textFieldClasses = computed(() => useTextFieldClasses({
  name: props.name,
  readonly: props.readonly,
  readonlyInput: props.readonlyInput,
}))

const textFieldReadonly = computed(() => {
  return props.readonly || props.readonlyInput || multiple.value
})

const hoverIconColor = computed<string | undefined>(() => {
  if (props.iconHoverColor === false) {
    return undefined
  }

  if (typeof props.iconHoverColor === 'string') {
    return props.iconHoverColor
  }

  return props.color ?? undefined
})

// ------------------------- Card #
const cardClasses = computed(() => useCardClasses({
  fullWidth: props.cardFieldWidth,
}))

// -------------------------------------------------- Methods //

// ------------------------- Toggle Check //
// ? Checks to prevent double triggers //
function toggleCheck(trigger: string) {
  if (trigger === 'textField' && !props.readonlyInput && !props.readonly) {
    return
  }

  if (trigger === 'textFieldIcon' && (props.readonlyInput || props.readonly)) {
    return
  }

  toggleDatePicker()
}

// ------------------------- Toggle Date Picker //
function toggleDatePicker(trigger?: string | Event): void {
  const defaultCoords = { left: 0, right: 0, top: 0, width: 0 }
  const fieldContainer = fieldContainerRef.value

  // Only close the date picker if it is open on keyup & clear event //
  if (!datePickerOpen.value && (trigger === 'keyup' || trigger === 'clear')) {

    // If clear, reset the model values //
    if (trigger === 'clear') {
      updateModelValue('', 'clear')
    }

    return
  }

  datePickerOpen.value = !datePickerOpen.value

  // If date picker is closed no further action is needed //
  if (!datePickerOpen.value) {
    cardStyles.value.display = 'none'
    return
  }

  const fieldElementCoords = fieldContainer?.getBoundingClientRect() ?? defaultCoords

  // Set the height and width of the field //
  let inputHeight: number | undefined = fieldContainer?.offsetHeight ?? 0
  let inputWidth: number = 300
  let positionLeft = fieldElementCoords?.left ?? 0
  let positionRight = fieldElementCoords?.right ?? 0

  const fieldInputContainer: HtmlRefElement = fieldContainerRef?.value?.querySelector('.v-field__input')
  const fieldContainerInputCoords = fieldInputContainer?.getBoundingClientRect() ?? defaultCoords

  inputHeight = fieldInputContainer?.offsetHeight
  inputWidth = fieldInputContainer?.offsetWidth ?? 0
  positionLeft = fieldContainerInputCoords.left
  positionRight = fieldContainerInputCoords.right - fieldContainerInputCoords.width

  textFieldProperties = {
    bottom: 'initial',
    height: inputHeight as number,
    left: positionLeft,
    right: positionRight,
    top: (window.scrollY + fieldElementCoords?.top ?? 0),
    width: props.cardFieldWidth ? inputWidth : 'auto',
  }

  setCardStyles()
}

// ------------------------- Set Card Styles //
function setCardStyles(): void {
  let top: string | number = Number(textFieldProperties.top) + Number(textFieldProperties.height)
  let bottom: string | number = 'initial'
  let offsetY = Number(props.cardOffsetY) ?? 0
  const offsetX = Number(props.cardOffsetX) ?? 0

  if (props.hint || props.messages) {
    offsetY += defaults.value.VCard?.verticalOffset ?? 0
  }

  top = top + offsetY

  // Top/Bottom Card Alignment //
  if (props.open?.includes('top')) {
    bottom = (window.innerHeight - top) + Number(textFieldProperties.height) + (offsetY * 2)
    top = 'initial'
  }

  // Left/Right Card Alignment //
  let left: string | number = Number(textFieldProperties.left) + offsetX
  let right: string | number = textFieldProperties.right ?? 0

  if (props.cardFieldWidth) {
    left = textFieldProperties.left as number
    right = 'initial'
  }
  else {
    right = 'initial'

    if (props.open?.includes('right')) {
      left = 'initial' as string
      right = Number(textFieldProperties.right) + offsetX
    }
  }

  const styles: CardStylesObject = {
    bottom: useConvertToUnit({ value: bottom }),
    display: 'block',
    left: useConvertToUnit({ value: left }),
    minWidth: useConvertToUnit({ value: textFieldProperties.width }),
    padding: useConvertToUnit({ value: props.cardPadding }),
    right: useConvertToUnit({ value: right }),
    top: useConvertToUnit({ value: top }),
    width: useConvertToUnit({ value: textFieldProperties.width }),
  }

  cardStyles.value = styles
}

// ------------------------- Toggle Date Picker Click Outside Trigger //
onClickOutside(fieldContainerRef, (event) => {
  const element = unref(cardRef)

  if (event.target !== element && !element?.$el?.contains(event.target) && datePickerOpen.value) {
    toggleDatePicker('outside')
  }
}, { ignore: [cardRef] })

// ------------------------- Format Single & Multiple Value //
function formatSingleValue(val: InternalValue) {
  return dayjs(String(val)).format(String(format.value))
}

function formatMultipleValue(): InternalValue {
  const selectedLength = Array.isArray(datePickerModelValue.value) ? datePickerModelValue.value.length : 0
  let returnValue: any | any[] = []

  if (selectedLength > 0) {
    returnValue = [...datePickerModelValue.value as string[]]

    returnValue.forEach((d: string, index: number) => {
      returnValue[index] = formatSingleValue(d)
    })
  }

  return returnValue
}

// ------------------------- Set Text Field Value //
function setTextFieldValue(val: InternalValue): void {
  datePickerModelValue.value = val

  if (multiple.value) {
    const selectedLength = Array.isArray(val) ? val.length : 0

    if (!val || typeof val === 'undefined' || selectedLength === 0) {
      textFieldModelValue.value = undefined
      return
    }

    textFieldModelValue.value = `${selectedLength} selected`

    if (selectedLength === 1) {
      textFieldModelValue.value = dayjs(dayjs(String(val))).format(String(format.value))
    }
    return
  }

  textFieldModelValue.value = formatSingleValue(datePickerModelValue.value)
  // textFieldModelValue.value = dayjs(dayjs(String(datePickerModelValue.value))).format(String(format.value));
}

// ------------------------- Set Date Picker Value //
function setDatePickerFieldValue(val: InternalValue): void {
  textFieldModelValue.value = val

  if (multiple.value && !val) {
    datePickerModelValue.value = undefined
    return
  }

  // TODO: Check this after bug fixed: https://github.com/vuetifyjs/vuetify/pull/18686
  pickerMonth.value = dayjs(String(val)).month() ?? props.month

  datePickerModelValue.value = dayjs(String(textFieldModelValue.value), String(format.value)).toDate()
}

// ------------------------- Update Models //
function updateModelValue(value: any, component: string): void {
  let returnValue: any | any[] = value ?? ''

  if (component === 'textField') {
    setDatePickerFieldValue(value)
  }
  if (component === 'datePicker') {
    datePickerModelValue.value = value
    setTextFieldValue(value)
  }
  if (component === 'clear') {
    datePickerModelValue.value = []
    setTextFieldValue(undefined)
  }

  returnValue = textFieldModelValue.value

  if (multiple.value) {
    returnValue = formatMultipleValue()
  }

  emitModelValues(returnValue)
}

function emitModelValues(val: InternalValue): void {
  emit('update:modelValue', val)
  emit('update', val)
}

</script>

<style lang="scss" scoped>
</style>
