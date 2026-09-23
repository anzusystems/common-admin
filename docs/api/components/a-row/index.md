<script setup>
import ARowDemo from './ARowDemo.vue'
</script>

# ARow

- mostly used to print data in detail view
- it's shorthand to this code (`titleClass` default: `font-weight-bold text-label-large`, title is rendered only when not empty):

```vue
<VRow>
  <VCol>
    <h4 v-if="title.length" :class="titleClass">
      {{ title }}
    </h4>
    <slot>
      <span class="text-high-emphasis">{{ value }}</span>
    </slot>
  </VCol>
</VRow>
```

## Examples
<DocsExample>
  <ARowDemo />
</DocsExample>

<<< @/api/components/a-row/ARowDemo.vue

## Types
#### Props
<<< @/../src/components/ARow.vue#docs-props{ts}

#### Slots
- default
