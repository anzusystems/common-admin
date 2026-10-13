import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { fetchAsset } from '@/domains/dam/api/damAssetApi'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { fetchAuthorListByIds } from '@/domains/dam/author/api/authorApi'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useExtSystemIdForCached } from '@/domains/dam/composables/extSystemIdForCached'
import { useDamConfigState } from '@/domains/dam/config/composables/damConfigState'
import type { AssetDetailItemDto } from '@/domains/dam/types/Asset'
import type { ImageCreateUpdateAware } from '@/domains/dam/types/ImageAware'
import { useAlerts } from '@/domains/system/composables/alerts'
import type { DocId, IntegerId } from '@/shared/types/common'
import { isNull } from '@/shared/utils/common'

interface HeldAsset {
  asset: AssetDetailItemDto
  /** The file the asset was read for: the file of the image made of that pick. */
  file: DocId
}

/**
 * The authors of the DAM the dialog of the image of a widget of one image offers in place of a source: those of an
 * asset picked in the library that has none. The widget holds that asset itself, with the file it read it for, and
 * offers its authors only in the dialog of the image of that file. They used to be those of the asset in the store of
 * the asset detail, which is one for the page: the asset picker, the asset detail and every other widget write there,
 * so the dialog offered, and saved, the authors of an asset that was not the image's.
 * `shownImage`: the image the dialog of the widget shows; none while it shows none.
 */
export function useImageDialogDamAuthors(
  configName: string,
  shownImage: () => ImageCreateUpdateAware | null,
  readonly: () => boolean
) {
  const { damClient, endPointAsset, endPointAuthor } = useCommonAdminCoreDamOptions(configName)
  const { getExtSystemByLicence } = useDamConfigState(damClient)
  const { cachedExtSystemId } = useExtSystemIdForCached()
  const assetDetailStore = useAssetDetailStore()
  const { showErrorsDefault } = useAlerts()

  const held = ref<HeldAsset | null>(null)
  // A read may end once the widget is gone.
  let unmounted = false
  onBeforeUnmount(() => {
    unmounted = true
  })

  /** The image the dialog shows, when it is the one the held asset was read for. */
  const imageOfHeld = () => {
    const image = shownImage()
    return !isNull(held.value) && !isNull(image) && image.dam.damId === held.value.file ? image : null
  }

  /** The asset whose authors the dialog offers: none unless it shows the image the widget read that asset for. */
  const damAuthorsAsset = computed(() => (isNull(held.value) || isNull(imageOfHeld()) ? null : held.value.asset))

  const offerDamAuthorsOf = (asset: AssetDetailItemDto, file: DocId) => {
    held.value = { asset, file }
  }

  const offerNoDamAuthors = () => {
    held.value = null
  }

  /** The authors the user picks in the dialog. */
  const pickDamAuthors = (authors: DocId[]) => {
    const asset = damAuthorsAsset.value
    if (asset) asset.authors = authors
  }

  /**
   * The detail "edit asset" of the dialog opens may have given the asset authors. The asset is read again, once the
   * save of the detail that was on its way when it closed is answered: read before that, it would be as it was. Once
   * it has authors the pick of them goes, and the image the dialog shows takes their names as its source, as the image
   * of an asset picked with its authors has them; what was picked in the dialog before gives way. Without authors the
   * dialog goes on offering them, over the asset as it was read now. `pageExtSystem`: the ext system the page asked for
   * names under when the detail closed, for an asset whose licence does not tell.
   */
  const takeAuthorsOfDetailAsset = async (
    of: HeldAsset,
    detailSave: Promise<void> | null,
    pageExtSystem: IntegerId
  ) => {
    try {
      await detailSave
      const asset = await fetchAsset(damClient, endPointAsset, of.asset.id)
      let source = ''
      if (asset.authors.length > 0) {
        const extSystem = (await getExtSystemByLicence(asset.licence)) ?? pageExtSystem
        const authorsRes = await fetchAuthorListByIds(damClient, endPointAuthor, extSystem, asset.authors)
        source = authorsRes.map((author) => author.name).join(', ')
      }
      // The widget is gone or has turned read-only, or holds the asset of another pick by now: nothing is written.
      if (unmounted || readonly() || held.value !== of) return
      if (asset.authors.length === 0) {
        of.asset = { ...asset, authors: of.asset.authors }
        return
      }
      // Only into the image that asset was read for: the dialog may have closed meanwhile, or show another image.
      const image = imageOfHeld()
      held.value = null
      if (image) image.texts.source = source
    } catch (e) {
      if (!unmounted) showErrorsDefault(e)
    }
  }

  // The read of an asset whose detail has closed, while it is on its way: "confirm" of the dialog waits for it.
  let detailAssetRead: Promise<void> | null = null
  // The confirm that waits for it, while one does.
  let waitingConfirm: symbol | null = null
  const confirmWaits = ref(false)
  const dropWaitingConfirm = () => {
    waitingConfirm = null
    confirmWaits.value = false
  }
  // A confirm is for the opening of the dialog it was pressed in. Once the dialog has closed, or shows an image anew,
  // the one that waits is dropped: the read may answer when the dialog has been opened again, and that opening would
  // be confirmed, and its image saved, without a press.
  watch(shownImage, dropWaitingConfirm, { flush: 'sync' })

  /**
   * "Confirm" of the dialog, pressed while the asset of a detail that has just closed is still being read. What the
   * dialog offers may change by that read, and with it what its form asks for: the confirm waits for the read (`true`:
   * nothing more is taken of this press), and `again` has the form take it anew once the read has answered. Pressed
   * again meanwhile, or while a save runs (`saving`), it is not taken a second time.
   */
  const holdConfirmForDetailAssetRead = (saving: boolean, again: () => void) => {
    const read = detailAssetRead
    if (isNull(read)) return false
    if (saving || !isNull(waitingConfirm)) return true
    const waiting = (waitingConfirm = Symbol('confirm'))
    confirmWaits.value = true
    void read.then(() => {
      if (waitingConfirm !== waiting) return
      dropWaitingConfirm()
      again()
    })
    return true
  }

  /**
   * `shown`: the asset the detail showed; none when it closed from its loader, or by itself after a read that failed.
   * Nothing is read unless the dialog offers the authors of the asset. What the read goes by is noted here, before
   * anything is awaited.
   */
  const onAssetDetailClose = (shown: AssetDetailItemDto | null) => {
    const of = held.value
    if (isNull(shown) || isNull(of) || isNull(imageOfHeld()) || readonly()) return
    const detailSave = assetDetailStore.saving
    const pageExtSystem = cachedExtSystemId.value
    const read = (detailAssetRead ?? Promise.resolve()).then(() =>
      takeAuthorsOfDetailAsset(of, detailSave, pageExtSystem)
    )
    detailAssetRead = read
    void read.then(() => {
      if (detailAssetRead === read) detailAssetRead = null
    })
  }

  return {
    damAuthorsAsset,
    offerDamAuthorsOf,
    offerNoDamAuthors,
    pickDamAuthors,
    onAssetDetailClose,
    holdConfirmForDetailAssetRead,
    /** Whether a confirm waits for the read of the asset of a detail that has just closed: its button spins. */
    confirmWaits,
  }
}
