import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
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
import { WAIT_RAN_OUT, withinWaitLimit } from '@/domains/dam/imageWidget/utils/waitLimit'

interface HeldAsset {
  asset: AssetDetailItemDto
  /** The file the asset was read for: the file of the image made of that pick. */
  file: DocId
}

/** What a read of the held asset anew has found: the asset with the names of its authors, or the failure. */
export type HeldAssetAnew =
  | { of: HeldAsset; asset: AssetDetailItemDto; names: string }
  | { of: HeldAsset; failure: unknown }

/** What the read of a held asset after its detail closed found. */
type DetailAssetRead = { of: HeldAsset; asset: AssetDetailItemDto; names: string }

// The requests of a read after a detail has closed, one after another: the rest of the save of the detail, the asset,
// the licence of the asset (once a page), the names of its authors.
const REQUESTS_OF_A_DETAIL_ASSET_READ = 4

/**
 * The image of a held asset, once that asset turns out to have authors: an empty source takes their names. The pick
 * makes that image with an empty source, and its dialog does not show the source while it offers the pick, so an
 * empty source is the pick's (one of white space alone counts as empty). A source it has came from a save of the image
 * elsewhere, and stays: the dialog shows it from then on.
 */
export const giveNamesToEmptySource = (image: ImageCreateUpdateAware, names: string) => {
  if (image.texts.source.trim().length === 0) image.texts.source = names
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
  const { getExtSystemByLicence } = useDamConfigState(damClient, configName)
  const { cachedExtSystemId } = useExtSystemIdForCached(configName)
  const assetDetailStore = useAssetDetailStore()
  const { showErrorsDefault, showErrorT, showUnknownError } = useAlerts()

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

  // The image the dialog shows, once a read of the held asset for it has failed: what the widget holds may be stale by
  // then, and the dialog shows the source of the image in place of the pick, till it shows an image anew. It went on
  // offering the pick of the asset as it was read before; its confirm, which reads the asset again, wrote nothing, but
  // only after the user had picked.
  const staleIn = shallowRef<ImageCreateUpdateAware | null>(null)

  /**
   * The asset whose authors the dialog offers: none unless it shows the image the widget read that asset for, and the
   * last read of it for that image has not failed.
   */
  const damAuthorsAsset = computed(() => {
    if (isNull(held.value)) return null
    const image = imageOfHeld()
    return isNull(image) || image === staleIn.value ? null : held.value.asset
  })

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

  /** The names of the authors of an asset, under the ext system of its licence; `pageExtSystem` where it tells none. */
  const namesOf = async (asset: AssetDetailItemDto, pageExtSystem: IntegerId) => {
    const extSystem = (await getExtSystemByLicence(asset.licence)) ?? pageExtSystem
    const authorsRes = await fetchAuthorListByIds(damClient, endPointAuthor, extSystem, asset.authors)
    return authorsRes.map((author) => author.name).join(', ')
  }

  /**
   * The detail "edit asset" of the dialog opens may have given the asset authors. The asset is read again, once the
   * save of the detail that was on its way when it closed is answered: read before that, it would be as it was. Once
   * it has authors the pick of them goes, and an empty source of the image the dialog shows takes their names, as the
   * image of an asset picked with its authors has them (a source it has stays); what was picked in the dialog before
   * gives way. Without authors the dialog goes on offering them, over the asset as it was read now. `pageExtSystem`:
   * the ext system its configuration asked for names under when the detail closed, for an asset whose licence does not
   * tell.
   */
  const takeAuthorsOfDetailAsset = async (
    of: HeldAsset,
    detailSave: Promise<void> | null,
    pageExtSystem: IntegerId
  ): Promise<DetailAssetRead | null> => {
    try {
      await detailSave
      const asset = await fetchAsset(damClient, endPointAsset, of.asset.id)
      const source = asset.authors.length > 0 ? await namesOf(asset, pageExtSystem) : ''
      const read = { of, asset, names: source }
      // The widget is gone or has turned read-only, or holds the asset of another pick by now: nothing is written.
      if (unmounted || readonly() || held.value !== of) return read
      if (asset.authors.length === 0) {
        of.asset = { ...asset, authors: of.asset.authors }
        return read
      }
      // Only into the image that asset was read for. The dialog may have closed meanwhile, or show another image: the
      // widget holds the asset on, and "edit image" of the image of that file reads it anew, and gives its empty
      // source the names. Dropped here, the asset was gone, and that source stayed empty.
      const image = imageOfHeld()
      if (isNull(image)) return read
      held.value = null
      giveNamesToEmptySource(image, source)
      return read
    } catch (e) {
      if (unmounted) return null
      showErrorsDefault(e)
      const image = held.value === of ? imageOfHeld() : null
      if (image) staleIn.value = image
      return null
    }
  }

  // The read of an asset whose detail has closed last, while it is on its way: "confirm" of the dialog waits for it,
  // and "edit image" takes what it reads.
  let detailAssetRead: Promise<DetailAssetRead | null> | null = null
  // The reads of assets whose detail has closed, those of one asset in a row, by that asset. A read of another asset
  // does not wait for them: it waited for the save of the detail of the asset the widget held before, and its read.
  const detailAssetReads = new Map<DocId, Promise<DetailAssetRead | null>>()
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
  watch(
    shownImage,
    (image) => {
      dropWaitingConfirm()
      if (image !== staleIn.value) staleIn.value = null
    },
    { flush: 'sync' }
  )

  /**
   * "Confirm" of the dialog, pressed while the asset of a detail that has just closed is still being read. What the
   * dialog offers may change by that read, and with it what its form asks for: the confirm waits for the read (`true`:
   * nothing more is taken of this press), and `again` has the form take it anew once the read has answered. Pressed
   * again meanwhile, or while a save runs (`saving`), it is not taken a second time. The wait has one time limit
   * (`withinWaitLimit`), the time of the requests of the read one after another (the save of the detail, the asset, the
   * licence, the names of its authors), each as long as the time the application gives one: a DAM slow but answering
   * does not run it out. Once it runs out the press is not taken, the button stops spinning, and the user is told the
   * request timed out. A press after that waits again, while the read is still on its way. A read that fails drops the
   * press as well, the failure said by the read: the dialog shows the source in place of the pick by then, and taken
   * again the press saved the image with that source, without the authors picked when it was pressed.
   */
  const holdConfirmForDetailAssetRead = (saving: boolean, again: () => void) => {
    const read = detailAssetRead
    if (isNull(read)) return false
    if (saving || !isNull(waitingConfirm)) return true
    const waiting = (waitingConfirm = Symbol('confirm'))
    confirmWaits.value = true
    void withinWaitLimit(read, REQUESTS_OF_A_DETAIL_ASSET_READ, configName).then((answer) => {
      if (waitingConfirm !== waiting) return
      dropWaitingConfirm()
      if (answer === WAIT_RAN_OUT) {
        if (!unmounted) showErrorT('error.apiTimedOut.message')
        return
      }
      if (isNull(answer)) return
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
    const assetId = of.asset.id
    const detailSave = assetDetailStore.savingOf(assetId, configName)
    const pageExtSystem = cachedExtSystemId.value
    const read = (detailAssetReads.get(assetId) ?? Promise.resolve()).then(() =>
      takeAuthorsOfDetailAsset(of, detailSave, pageExtSystem)
    )
    detailAssetReads.set(assetId, read)
    detailAssetRead = read
    void read.then(() => {
      if (detailAssetReads.get(assetId) === read) detailAssetReads.delete(assetId)
      if (detailAssetRead === read) detailAssetRead = null
    })
  }

  /**
   * "Edit image" of the image of `file`, the one the held asset was read for. That asset is as it was at its pick, and
   * may have been given authors elsewhere since: the dialog offered a pick of them all the same, and its confirm wrote
   * that pick over them. So it is read anew first. Pressed while a read of it after a detail that has just closed is
   * on its way, that read is the newer answer, and serves here too: the asset was read twice in a row. Read anew where
   * it failed. What is read for is noted here, at the press: that read may drop the held asset. `null` where nothing
   * is to be read: no asset held for that file, or a widget that is read-only.
   */
  const readHeldAnew = (file: DocId | undefined): Promise<HeldAssetAnew> | null => {
    const of = held.value
    if (isNull(of) || of.file !== file || readonly()) return null
    const pageExtSystem = cachedExtSystemId.value
    return (detailAssetRead ?? Promise.resolve(null)).then(async (afterDetail) => {
      if (afterDetail?.of === of) return afterDetail
      try {
        const asset = await fetchAsset(damClient, endPointAsset, of.asset.id)
        return { of, asset, names: asset.authors.length > 0 ? await namesOf(asset, pageExtSystem) : '' }
      } catch (failure) {
        return { of, failure }
      }
    })
  }

  /**
   * What `readHeldAnew` found, into the image the dialog shows, once it shows the image of that file. Without authors
   * the held asset is the one read now: the pick starts from what the DAM has, and authors picked in a dialog closed
   * without a confirm do not come back. With authors the pick goes, and an empty source takes their names
   * (`giveNamesToEmptySource`). Those names are the dialog's: closed without a confirm, it does not offer them again,
   * nothing being held then. A failed read is said once, and the dialog shows the source of the image in place of the
   * pick, till it shows an image anew: the widget holds the asset on, and the next "edit image" reads it again.
   */
  const takeHeldAnew = (anew: HeldAssetAnew | null, image: ImageCreateUpdateAware | null) => {
    if (isNull(anew) || unmounted || readonly()) return
    if (isNull(image) || image.dam.damId !== anew.of.file) return
    if ('failure' in anew) {
      if (!showErrorsDefault(anew.failure)) showUnknownError()
      if (held.value === anew.of) staleIn.value = image
      return
    }
    if (anew.asset.authors.length === 0) {
      if (held.value === anew.of) anew.of.asset = anew.asset
      return
    }
    if (held.value === anew.of) held.value = null
    giveNamesToEmptySource(image, anew.names)
  }

  /**
   * At a confirm of `image`, the image the dialog shows: what lets the asset the widget holds for the file of that image
   * go once the image has been saved, when the dialog showed its source in place of the pick (a read of the asset had
   * failed). The image has a source of its own by then. Held on, the next "edit image" read the asset again and showed
   * the pick in place of that source, and a pick and a confirm replaced it. Nothing to let go otherwise.
   */
  const letGoOnceSavedWithSource = (image: ImageCreateUpdateAware) => {
    const of = held.value
    if (isNull(of) || of.file !== image.dam.damId || !isNull(damAuthorsAsset.value)) return () => undefined
    return () => {
      if (held.value === of) held.value = null
    }
  }

  /**
   * Read right before the authors picked in the dialog are written into `asset`: the names of the authors it has been
   * given elsewhere meanwhile, `null` while it has none. Throws where the asset or those names cannot be read. Only
   * the DAM could make this read and the write one step: an author given between the two is still written over.
   */
  const authorsGivenMeanwhile = async (asset: AssetDetailItemDto) => {
    const pageExtSystem = cachedExtSystemId.value
    const read = await fetchAsset(damClient, endPointAsset, asset.id)
    return read.authors.length > 0 ? namesOf(read, pageExtSystem) : null
  }

  return {
    damAuthorsAsset,
    offerDamAuthorsOf,
    offerNoDamAuthors,
    pickDamAuthors,
    onAssetDetailClose,
    holdConfirmForDetailAssetRead,
    readHeldAnew,
    takeHeldAnew,
    letGoOnceSavedWithSource,
    authorsGivenMeanwhile,
    /** Whether a confirm waits for the read of the asset of a detail that has just closed: its button spins. */
    confirmWaits,
  }
}
