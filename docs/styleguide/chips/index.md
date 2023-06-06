<script setup>
import ChipsDemo from "./ChipsDemo.vue";
import ChipsDemoNonLinkable from "./ChipsDemoNonLinkable.vue";
import ChipsDemoLinkable from "./ChipsDemoLinkable.vue";
import ChipsDemoLinkableExternal from "./ChipsDemoLinkableExternal.vue";
import ChipsDemoUser from "./ChipsDemoUser.vue";
</script>

# Chip

- always use `label` version of chip (do not use rounded, rounded can be only buttons), example:
<DocsExample>
  <ChipsDemo />
</DocsExample>

## Non-linkable
- used for display important info, for example statuses (published, draft, etc.) or boolean values (true, false) etc.
- can be colored in special cases
- if they are not colored, they are lighter colored as linkable version
- they don't contain icons (except special cases, but still can't use icons used in linkable version)

<DocsExample>
  <ChipsDemoNonLinkable />
</DocsExample>

```html
<AChipNoLink class="mr-2">
  draft
</AChipNoLink>
<AChipNoLink class="mr-2" color="success">
  published
</AChipNoLink>
```

## Linkable
- mostly used by `ACachedChip` component
- link to entity detail inside of admin (same tab), must append `mdi-arrow-top-right` icon inside

<DocsExample>
  <ChipsDemoLinkable />
</DocsExample>

```vue
<VChip
  :append-icon="COMMON_CONFIG.CHIP.ICON.LINK"
  label
  size="small"
  @click.stop=""
  class="mr-2"
>
  internal link
</VChip>
```
- link to external link or entity of admin (new tab), must append `mdi-open-in-new` icon inside

<DocsExample>
  <ChipsDemoLinkableExternal />
</DocsExample>

```vue
<VChip
  :append-icon="COMMON_CONFIG.CHIP.ICON.LINK_EXTERNAL"
  label
  size="small"
  @click.stop=""
>
  external link
</VChip>
```


## User chip
- used as linkable version above (just a label chip, text and icon), or can use special avatar layout (rounded, colored avatar info), depends on if the system is using avatars
- example:

<DocsExample>
  <ChipsDemoUser />
</DocsExample>
