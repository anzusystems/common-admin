# Filters

## List api filters

Create `reactive` object properties using `makeFilterHelper`, and export is as global composable example:

```ts
const makeFilter = makeFilterHelper('system', 'subject')

const filter = reactive({
  id: {
    ...makeFilter({ name: 'id' }),
  },
  email: {
    ...makeFilter({ name: 'email', variant: 'startsWith' }),
  },
  enabled: {
    ...makeFilter({ name: 'enabled' }),
  },
})

export function useSubjectListFilter() {
  return filter
}
```

TODO
