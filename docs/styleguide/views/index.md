<script setup>
import ViewsListDemo from "./ViewsDemoList.vue";
</script>

# Views

- most entities are using basic CRUD views: `list`, `detail`, `edit`, `create`
- all of them are optional, some entities doesn't have create or edit view etc. 

## List
- mostly contains filters and data table
- in special cases special grid can be used, consult with product owner
- can contain create or other actions on toolbar

#### Filter
- use one `underlined` design
- always display above datatable on list
- contains several filters, submit and reset button
- submit button is `text` version by default, when any filter is changed, it will display as `primary` button, on submit or reset it's changed to text version again
- can also contain hidden filters, can be shown by show/hide button

#### Datatable
- use vuetify datatable component
- should also contain above table:
  - sort select
  - column config to show/hide columns
- should contain below datatable:
  - pagination
- datatable can have rows linkable and should lead to edit of item
- on the right side of row should be always actions and should contain (order applied):
  - copy id button - copy entity id to clipboard
  - detail button - redirect to entity detail
  - edit button - redirect to entity edit
- note: some styling below can be broken for now - because of mix of vitepress + vuetify styles

::: raw
<DocsExample>
  <ViewsListDemo />
</DocsExample>
:::

## Detail
- displays readonly data about entity
- can contain link to edit entity
- use 8:4 one level grid layout for content, all other layout consult with product owner
- use `ACard` `loading` prop when data are loading

## Edit/Create
- contains form to create or edit entity
- in special cases dialog can be used to create or modify component, consult with product owner
- after entity is created, redirect to edit, special cases can use different redirect or list datatable refresh
- hint: use one component for create and edit form to save maintenance time for 2 components
- use 8:4 one level grid layout for content, all other layout consult with product owner
- use `ACard` `loading` prop when data are loading
- check form docs
