# Styleguide

## Basic info

- based on [vuetify](https://vuetifyjs.com/), so technically it's possible to use any component from vuetify (mind limitations here in styleguide)
- all anzusystems admin follow these rules here so use them as reference
- mostly flat and clean design, don't use shadows if possible

## Layout

### Toolbar

- mostly one line (some exceptions can use more)
- always visible, sticky
- consist of 3 parts:
  - burger menu show/hide
  - breadcrumbs
  - action buttons

#### Breadcrumbs

- first part is a logo
- all items must have link to specific view, except last item
- breadcrumbs will mostly have 3 levels like this:
  - `logo > entity list > entity detail/create/edit`
- in some specific situation 4th level can be used, in multi system admins even 5 levels can be used

### Sidebar

- 3 modes:
  - hidden
  - full
  - compact
- on desktop, sidebar is fully visible with full text, using burger menu in Toolbar, sidebar switch to compact mode where only icons are visible
- compact mode can contain different items than full version
- on mobile, the burger icon in Toolbar switch between full and hidden only
- items in sidebar can be grouped to groups, specially when admin is multi system
- bottom part of sidebar contains admin switcher and user dropdown menu

#### Admin switcher
- optional
- UX to quick switch between corporate admins
- can be configured using json file

#### User dropdown
- contains user info:
  - avatar text and color, user info
- link to settings where you can change theme and language
- logout link

### Content

See [views](#views)

## Views

- most entities are using basic CRUD views: `list`, `detail`, `edit`, `create`
- all of them are optional, some entities doesn't have create or edit view etc.

### List
- mostly contains filters and data table
- in special cases special grid can be used, consult with product owner
- can contain create or other actions on toolbar

#### Filter
- use `AFilterWrapper` with filter components (`AFilterString`, `AFilterBooleanSelect`, etc.)
- use one `underlined` design
- always display above datatable on list
- contains main filters (`search` slot), chips of selected filters, submit and reset button; with `user-id` and `client` props also filter bookmarks
- submit button is `text` version by default, when any filter is changed, it will display as `primary` button, on submit or reset it's changed to text version again
- can also contain hidden filters, can be shown by show/hide button
- in a sidebar (e.g. asset list) use `AFilterWrapperSidebar`

#### Datatable
- use vuetify datatable component (`VDataTableServer`)
- should also contain above table:
  - sort select (`ADatatableOrdering`)
  - column config to show/hide columns (`ADatatableConfigButton`)
- should contain below datatable:
  - pagination (`ADatatablePagination`)
- datatable can have rows linkable and should lead to the entity detail (edit when the entity has no detail view)
- on the right side of row should be always actions and should contain (order applied):
  - copy id button - copy entity id to clipboard (`ATableCopyIdButton`)
  - detail button - redirect to entity detail (`ATableDetailButton`)
  - edit button - redirect to entity edit (`ATableEditButton`)

### Detail
- displays readonly data about entity
- can contain link to edit entity
- use 8:4 one level grid layout for content, all other layout consult with product owner
- use [`ACard`](#acard) `loading` prop when data are loading
- print data with [`ARow`](#arow)
- print values with `ADatetime` (`:date-time`), `ABooleanValue` (`:value`) and `ACopyText` (`:value`, ids), related entities with `ACachedChip`, statuses with `AChipNoLink`; use the same components in datatable cells

### Edit/Create
- contains form to create or edit entity
- in special cases dialog can be used to create or modify component, consult with product owner
- after entity is created, redirect to edit, special cases can use different redirect or list datatable refresh
- hint: use one component for create and edit form to save maintenance time for 2 components
- use 8:4 one level grid layout for content, all other layout consult with product owner
- use [`ACard`](#acard) `loading` prop when data are loading
- check [form](#form) rules

## Dialog

- use vuetify `VDialog` with some modification to close button and toolbar

```html
<ABtnPrimary @click.stop="dialog = true">
  Open
</ABtnPrimary>
<VDialog :model-value="dialog">
  <VCard v-if="dialog">
    <ADialogToolbar @cancel="dialog = false">
      Title
    </ADialogToolbar>
    <VCardText>
      Lorem ipsum dolor sit amet.
    </VCardText>
    <VCardActions>
      <VSpacer />
      <ABtnTertiary @click.stop="dialog = false">
        {{ t('common.button.cancel') }}
      </ABtnTertiary>
      <ABtnPrimary @click.stop="">
        {{ t('common.button.create') }}
      </ABtnPrimary>
    </VCardActions>
  </VCard>
</VDialog>
```

- use `ACreateDialog` when applicable, in most cases can save your time

## Form
- use one `underlined` design

### Boolean

- to set boolean value, where value is mandatory, just use vuetify component `VSwitch` (or `AFormSwitch` in forms, it also supports collab field lock):

```html
<VSwitch label="Visible" />
```

- to set optional boolean value (true/false/null), use dropdown `ABooleanSelect`:

```html
<ABooleanSelect v-model="value" label="Visible" />
```

- in filters, we use `AFilterBooleanSelect` component

## Buttons

### General

We follow these UX rules:
- buttons should be familiar, accessible
- visual hierarchy doesn't rely on color alone only, this means color of button shouldn't be identifier of importance color can be changed any time but importance and identification of button must stay
- most important button should be only one in a context, more of other types

According rules above we have 4 types of buttons:

### Types

#### Primary button

- most important and visible button
- only one in a block or row

```html
<ABtnPrimary>Primary</ABtnPrimary>
```

#### Secondary button

- second most important button, less visible than primary
- preferred only one in a block or row

```html
<ABtnSecondary>Secondary</ABtnSecondary>
```

#### Tertiary button

- you can use multiple of these buttons in block or row

```html
<ABtnTertiary>Tertiary</ABtnTertiary>
```

#### Icon button

- all buttons with icon must have tooltips
- `ABtnIcon` is `VBtn` with `icon` and `variant="text"`; `<VBtn icon variant="text">`, used widely in admins, is the same button

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

> [!NOTE]
> If you are not sure what type of button to use, consult it with product owner, UX expert or senior developer

### Sizes

- we can use any button size supported by vuetify, but mostly we use `default` and `small`

```html
<ABtnPrimary size="x-large">x-large</ABtnPrimary>
<ABtnPrimary size="large">large</ABtnPrimary>
<ABtnPrimary>default</ABtnPrimary>
<ABtnPrimary size="small">small</ABtnPrimary>
<ABtnPrimary size="x-small">x-small</ABtnPrimary>
```

### Action buttons

- on all places we use buttons above, but in toolbar, we use `rounded` version of buttons
- all other rules apply here too: you can have one primary, one secondary, and multiple tertiary and icon buttons in action toolbar
- on mobile version, some types can switch to save space or can be grouped to split button
- buttons are aligned to right side of toolbar
- order of buttons from left to right reflect importance of buttons: primary, secondary, tertiary, icon
- max numbers in toolbar should be 4, if exceeded consult using split button or different approach with product owner
- example:

```html
<AActionSaveButton />
<AActionEditButton variant="secondary" route-name="..." />
<ABtnTertiary rounded>Other</ABtnTertiary>
<AActionCloseButtonHistory />
```

### Split button

- special type of button
- can be used where you need to group several actions together
- also can be used on mobile view to save horizontal space
- variants: `primary`, `secondary`, `tertiary`
- `button-t` takes a translation key, or use `button-content` slot
- example:

```html
<ABtnSplit rounded="pill" button-t="common.button.save">
  <VListItem>save and close</VListItem>
</ABtnSplit>
<ABtnSplit button-t="common.button.save">
  <VListItem>save and close</VListItem>
</ABtnSplit>
<ABtnSplit variant="secondary" button-t="common.button.save">
  <VListItem>save and close</VListItem>
</ABtnSplit>
<ABtnSplit variant="tertiary" button-t="common.button.save">
  <VListItem>save and close</VListItem>
</ABtnSplit>
```

## Chip

- always use `label` version of chip (do not use rounded, rounded can be only buttons)

### Non-linkable
- used for display important info, for example statuses (published, draft, etc.) or boolean values (true, false) etc.
- can be colored in special cases
- if they are not colored, they are lighter colored as linkable version
- they don't contain icons (except special cases, but still can't use icons used in linkable version)

```html
<AChipNoLink class="mr-2">
  draft
</AChipNoLink>
<AChipNoLink class="mr-2" color="success">
  published
</AChipNoLink>
```

### Linkable
- mostly used by `ACachedChip` component
- link to entity detail inside of admin (same tab), must append `mdi-arrow-top-right` icon inside

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

### User chip
- used as linkable version above (just a label chip, text and icon), or can use special avatar layout (rounded, colored avatar info), depends on if the system is using avatars
- avatar layout example:

```vue
<VChip
  class="pl-1"
  size="small"
  :append-icon="COMMON_CONFIG.CHIP.ICON.LINK"
  @click.stop=""
>
  <template #prepend>
    <AAnzuUserAvatar
      :user="user"
      container-class="mr-1"
      :size="20"
    />
  </template>
  User name
</VChip>
```

## Components

### ACard

- it's just a wrapper component for vuetify's `VCard` with `variant="flat"`, other attributes are passed to `VCard`
- when `loading` prop is active, it shows `VCard` loading bar and a layer to prevent to click on any element inside
- `title` is passed to `VCard` `title`
- `blockInput` together with `loading` also sets `inert` on the card, so focus and keyboard input inside are blocked too
- props and slots: [`src/domains/ui/components/ACard.vue`](../../src/domains/ui/components/ACard.vue), other props: [vuetify docs](https://vuetifyjs.com/en/api/v-card/#props)

```vue
<ACard loading>
  <VCardText>Lorem ipsum dolor sit amet</VCardText>
</ACard>
```

### ARow

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

- props and slots: [`src/domains/ui/components/ARow.vue`](../../src/domains/ui/components/ARow.vue)

```vue
<ARow title="My title">
  Lorem ipsum
</ARow>
```

## Other

- always use `A` prefix for exported components (exception: `Acl`); components used only inside the library need not have it
- in utils, always use prefix for exports like `object`, `array`, `string`, `date`, `dateTime`, etc. (exceptions: type guards `is*` like `isDefined`, `isString`, and `cloneDeep`, `prettyBytes`, `prettyDuration`, `generateUUIDv1`, `generateUUIDv4`)
