<script setup>
import AChipNoLink from "../../src/components/AChipNoLink.vue";
import AAnzuUserAvatar from "../../src/components/AAnzuUserAvatar.vue";
import { VChip } from 'vuetify/components/VChip';
import { VProgressCircular } from 'vuetify/components/VProgressCircular';
import { COMMON_CONFIG } from '../../src/model/commonConfig'
</script>

# Chip

- always use `label` version of chip (do not use rounded, rounded can be only buttons), example:
<div class="mt-4"> 
<ClientOnly>
  <AChipNoLink class="mr-2">draft</AChipNoLink>
  <AChipNoLink class="mr-2" color="success">published</AChipNoLink>
  <VChip
    :append-icon="COMMON_CONFIG.CHIP.ICON.LINK"
    label
    size="small"
    @click.stop=""
    class="mr-2"
  >
    internal link
  </VChip>
  <VChip
    :append-icon="COMMON_CONFIG.CHIP.ICON.LINK_EXTERNAL"
    label
    size="small"
    @click.stop=""
  >
    external link
  </VChip>
</ClientOnly>
</div>

## Non-linkable
- used for display important info, for example statuses (published, draft, etc.) or boolean values (true, false) etc.
- can be colored in special cases
- if they are not colored, they are lighter colored as linkable version
- they don't contain icons (except special cases, but still can't use icons used in linkable version)

<ClientOnly>
  <AChipNoLink class="mr-2">draft</AChipNoLink>
  <AChipNoLink class="mr-2" color="success">published</AChipNoLink>
</ClientOnly>

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

<ClientOnly>
  <VChip
    :append-icon="COMMON_CONFIG.CHIP.ICON.LINK"
    label
    size="small"
    @click.stop=""
    class="mr-2"
  >
  internal link
  </VChip>
</ClientOnly>

```html
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

<ClientOnly>
  <VChip
    :append-icon="COMMON_CONFIG.CHIP.ICON.LINK_EXTERNAL"
    label
    size="small"
    @click.stop=""
  >
    external link
  </VChip>
</ClientOnly>

```html
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

<div class="d-flex align-center">
  <ClientOnly>
    <VChip
      :append-icon="COMMON_CONFIG.CHIP.ICON.LINK"
      label
      size="small"
      @click.stop=""
      class="mr-2"
    >
      User name
    </VChip>
    <div class="d-inline-flex mr-2">
      <VChip
        class="pl-1"
        size="small"
        :append-icon="COMMON_CONFIG.CHIP.ICON.LINK"
        @click.stop=""
      >
        <VProgressCircular
          :size="12"
          :width="2"
          indeterminate
          class="ml-1"
        />
      </VChip>
    </div>
    <div class="d-inline-flex">
      <VChip
        class="pl-1"
        size="small"
        :append-icon="COMMON_CONFIG.CHIP.ICON.LINK"
        @click.stop=""
      >
        <template #prepend>
          <AAnzuUserAvatar
            :user="
            {
              id: 1,
              person: {
                firstName: '',
                lastName: '',
                fullName: ''
              },
              avatar: {
                color: '',
                text: 'UN'
              },
              email: ''
            }
            "
            container-class="mr-1"
            :size="20"
          />
        </template>
        User name
      </VChip>
    </div>
  </ClientOnly>
</div>
