<script setup>
import ADialogToolbar from "../../src/components/ADialogToolbar.vue";
import { VBtn } from 'vuetify/components/VBtn';
import { VDialog } from 'vuetify/components/VDialog';
import { VSpacer } from 'vuetify/components/VGrid';
import { VCard, VCardText, VCardActions } from 'vuetify/components/VCard'; 
import { ref } from "vue"; 

const fullDialog = ref(false)
</script>

# Dialog

- use vuetify `VDialog` with some modification to close button and toolbar
- example:

<ClientOnly>
  <VBtn
    color="primary"
    @click.stop="fullDialog = true"
  >
    Open
  </VBtn>
  <VDialog :model-value="fullDialog">
    <VCard v-if="fullDialog">
      <ADialogToolbar @on-cancel="fullDialog = false">
        Title
      </ADialogToolbar>
      <VCardText>
        Lorem ipsum dolor sit amet. Aut quae accusantium et quia suscipit id placeat voluptatibus eos voluptatem ipsam est laboriosam nostrum in voluptates rerum. Quo impedit rerum sit maiores omnis vel internos perferendis et corporis esse vel aperiam culpa!
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn
          variant="text"
          @click.stop="fullDialog = false"
        >
          Cancel
        </VBtn>
        <VBtn
          color="primary"
          variant="flat"
          @click.stop=""
        >
          Confirm
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</ClientOnly>


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

