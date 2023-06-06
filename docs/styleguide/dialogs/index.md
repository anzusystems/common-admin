<script setup>
import DialogDemo from "./DialogDemo.vue";
</script>

# Dialog

- use vuetify `VDialog` with some modification to close button and toolbar

<DocsExample>
  <DialogDemo />
</DocsExample>


```html
<ABtnPrimary @click.stop="dialog = true">
  Open
</ABtnPrimary>
<VDialog :model-value="dialog">
  <VCard v-if="dialog">
    <ADialogToolbar @on-cancel="dialog = false">
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

