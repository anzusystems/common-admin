<script setup>
import { VSwitch } from 'vuetify/components/VSwitch';
</script>

# Form
- use one `underlined` design

## Boolean

- to set boolean value, where value us mandatory, just use vuetify component `VSwitch`:

<ClientOnly>
  <VSwitch></VSwitch>
</ClientOnly>

- to set optional boolean value (true/false/null), use dropdown:
TODO: create a new component ABooleanSwitch and update docs

- in filters, we use `AFilterBooleanSelect`  component

