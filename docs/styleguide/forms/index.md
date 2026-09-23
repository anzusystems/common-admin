<script setup>
import FormsDemoBoolean from './FormsDemoBoolean.vue';
</script>

# Form
- use one `underlined` design

## Boolean

- to set boolean value, where value is mandatory, just use vuetify component `VSwitch` (or `AFormSwitch` in forms, it also supports collab field lock):

<DocsExample>
  <FormsDemoBoolean />
</DocsExample>

```html
<VSwitch label="Visible" />
```

- to set optional boolean value (true/false/null), use dropdown `ABooleanSelect`:

```html
<ABooleanSelect v-model="value" label="Visible" />
```

- in filters, we use `AFilterBooleanSelect`  component

