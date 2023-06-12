TODO: copy/paste from inhouse now, update

For list api create filter using `makeFilter` helper on `reactive`:

```js
const { makeFilter } = useFilterHelpers()
const filter = reactive({
  fieldName: {
    ...makeFilter(TYPE, DEFAULT_VALUE, LABEL),
    ADDITIONAL_OPTIONAL_OPTIONS,
  },
})
```
for example:
```js
const { makeFilter } = useFilterHelpers()

const filter = reactive({
  id: {
    ...makeFilter('integer', '', t('weather.location.filter.id')),
  },
  originName: {
    ...makeFilter('string', '', t('weather.location.filter.originName')),
  },
  importSource: {
    ...makeFilter('valueObject', [], t('weather.location.filter.importSource')),
  },
  enabled: {
    ...makeFilter('boolean', null, t('weather.location.filter.enabled')),
  },
  country: {
    ...makeFilter('integerArray', [], t('weather.location.filter.country')),
  },
})
```
this will create reacive object:
```
{
  type: type,
  model: defaultValue,
  default: defaultValue,
  title: title,
  error: '',
  touched: false,
  disabled: false,
  ADDITIONAL_OPTIONAL_OPTIONS...
}
```
and these fields are used in filter components and query builder. Purpose of fields::
- `type`: check [TYPE](#TYPE)
- `model`: containing actual value in filter
- `default`: default value (used in reset)
- `title`: title for displaying errors or labels
- `error`: error message, by default empty
- `touched`: if `model` value is changed and different from `default` value, components using filter needs to maintain this
- `disabled`: if filer field is disabled (for now not used)

### TYPE

- `integer`: integer number, also interger ID
- `boolean`: true/false
- `string`: string value, will be encoded, startsWith api filter will be applied
- `valueObject`: our valueObject, multiple options
- `integerArray`: array of integers
- `datetimeFrom`: utc datetime from
- `datetimeTo`: utc datetime to

### ADDITIONAL_OPTIONAL_OPTIONS

- `field`: string, field name used in api, specially for . properties like texts.title, by default same field name is used as filter name
- `stringExact`: boolean, by default string filter is using startsWith filter, if you want to use exact value, set this property to true, default false
- `reset`: boolean, if reset button should reset the value, default true
- `advanced`: boolean, if filter is part of advanced view, default false
- `custom`: boolean, filter is ignored in query builder, for custom logic, default false
- `mandatory`: boolean, touched state is ignored, so this filter is always used in query builder
- `multiple`: some filters like valueObject allows to iput multiple values by default, with this option you can disable it, default true

