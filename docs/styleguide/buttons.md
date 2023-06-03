<script setup>
import { VBtn } from 'vuetify/components/VBtn';
import { VIcon } from 'vuetify/components/VIcon';
import { VListItem } from 'vuetify/components/VList';
import { VTooltip } from 'vuetify/components/VTooltip'; 
import AActionCloseButton from "../../src/components/buttons/action/AActionCloseButton.vue";
import AActionSaveButton from "../../src/components/buttons/action/AActionSaveButton.vue";
import ABtnSplit from "../../src/components/buttons/ABtnSplit.vue";
</script>

# Buttons

## General

We follow these UX rules:
- buttons should be familiar, accessible
- visual hierarchy doesn't rely on color alone only, this means color of button shouldn't be identifier of importance color can be changed any time but importance and identification of button must stay
- most important button should be only one in a context, more of other types

According rules above we have 4 types of buttons:

## Types

#### Primary button

- most important and visible button
- only one in a block or row

<VBtn class="my-2" color="primary" variant="flat">Primary</VBtn>

```html
<ABtnPrimary>Primary</ABtnPrimary>
```

#### Secondary button

- most important and visible button
- preffered only one in a block or row

<VBtn class="my-2" color="primary" variant="outlined">Secondary</VBtn>

```html
<ABtnSecondary>Secondary</ABtnSecondary>
```

#### Tertiary button

- you can use multiple of these buttons in block or row

<VBtn class="my-2" color="primary" variant="text">Tertiary</VBtn>

```html
<ABtnTertiary>Tertiary</ABtnTertiary>
```

#### Icon button

- all buttons with icon must have tooltips

<VBtn class="my-2" variant="text" icon="mdi-cog">
  <VIcon icon="mdi-home" />
  <VTooltip
    activator="parent"
    location="top"
  >
    Tooltip text
  </VTooltip>
</VBtn>

```html
<ABtnIcon>
  <VIcon icon="mdi-home" />
  <VTooltip
    activator="parent"
    location="top"
  >
    Tooltip text
  </VTooltip>
</ABtnIcon>
```

::: info
If you are not sure what type of button to use, consult it with product owner, UX expert or senior developer
:::

## Sizes

- we can use any button size supported by vuetify, but mostly we use `default` and `small`

<VBtn class="my-2 mr-2" color="primary" variant="flat" size="x-large">x-large</VBtn>
<VBtn class="my-2 mr-2" color="primary" variant="flat" size="large">large</VBtn>
<VBtn class="my-2 mr-2" color="primary" variant="flat" size="default">default</VBtn>
<VBtn class="my-2 mr-2" color="primary" variant="flat" size="small">small</VBtn>
<VBtn class="my-2" color="primary" variant="flat" size="x-small">x-small</VBtn>

```html
<ABtnPrimary size="x-large">x-large</ABtnPrimary>
<ABtnPrimary size="large">large</ABtnPrimary>
<ABtnPrimary>default</ABtnPrimary>
<ABtnPrimary size="small">small</ABtnPrimary>
<ABtnPrimary size="x-small">x-small</ABtnPrimary>
```

## Action buttons

- on all places we use buttons above, but in toolbar, we use `rounded` version of buttons
- all other rules apply here too: you can have one primary, one secondary, and multiple tertiary and icon buttons in action toolbar
- on mobile version, some types can switch to save space or can be grouped to split button
- buttons are aligned to right side of toolbar
- order of buttons from left to right reflect importance of buttons: primary, secondary, tertiary, icon
- max numbers in toolbar should be 4, if exceeded consult using split button or different approach with product owner
- example:

<AActionSaveButton class="my-2 mr-2" />
<AActionCloseButton class="my-2" />

```html
<ABtnIcon>
  <VIcon icon="mdi-home" />
  <VTooltip
    activator="parent"
    location="top"
  >
    Tooltip text
  </VTooltip>
</ABtnIcon>
```

## Split button

- special type of button
- can be used where you need to group several actions together
- also can be used on mobile view to save horizontal space
- variants: `primary`, `secondary`, `tertiary`
- example:


<ABtnSplit rounded="pill">
  <template #button-content>Save</template>
  <VListItem>save and close</VListItem>
</ABtnSplit>
<ABtnSplit>
  <template #button-content>Save</template>
  <VListItem>save and close</VListItem>
</ABtnSplit>
<ABtnSplit variant="secondary">
  <template #button-content>Save</template>
  <VListItem>save and close</VListItem>
</ABtnSplit>
<ABtnSplit variant="tertiary">
  <template #button-content>Save</template>
  <VListItem>save and close</VListItem>
</ABtnSplit>

```html
<ABtnSplit rounded="pill" buttonT="t('common.button.save')">
  <VListItem>save and close</VListItem>
</ABtnSplit>
<ABtnSplit buttonT="t('common.button.save')">
  <VListItem>save and close</VListItem>
</ABtnSplit>
<ABtnSplit variant="secondary" buttonT="t('common.button.save')">
  <VListItem>save and close</VListItem>
</ABtnSplit>
<ABtnSplit variant="tertiary" buttonT="t('common.button.save')">
  <VListItem>save and close</VListItem>
</ABtnSplit>
```
