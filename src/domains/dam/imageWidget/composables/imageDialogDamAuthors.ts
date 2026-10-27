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
  /**
   * The file the asset was read for, i.e. the file of the image made from that pick.
   */
  file: DocId
}

/**
 * Result of re-reading the held asset: the asset with its author names, or the failure.
 */
export type HeldAssetAnew =
  | { of: HeldAsset; asset: AssetDetailItemDto; names: string }
  | { of: HeldAsset; failure: unknown }

/**
 * Result of reading a held asset after its detail closed.
 */
type DetailAssetRead = { of: HeldAsset; asset: AssetDetailItemDto; names: string }

// Sequential requests of a read after a detail closes: the rest of the detail save, the asset,
// the asset licence (once per page), and the author names.
const REQUESTS_OF_A_DETAIL_ASSET_READ = 4

/**
 * Fills an empty source with the authors' names once the held asset turns out to have authors.
 * The pick creates the image with an empty source, and the dialog hides the source while it offers the pick.
 * So an empty or whitespace-only source belongs to the pick. A non-empty source came from a save elsewhere and stays.
 */
export const giveNamesToEmptySource = (image: ImageCreateUpdateAware, names: string) => {
  if (image.texts.source.trim().length === 0) image.texts.source = names
}

/**
 * DAM authors the single-image widget dialog offers in place of a source, for a library-picked asset that has none.
 * The widget holds the asset and the file it was read for, and offers its authors only in that file's image dialog.
 * Do not use the asset detail store: it is shared per page by the picker,
 * detail and other widgets, which caused wrong authors to be saved.
 * `shownImage`: the image the widget dialog shows, or none.
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

  /**
   * The image the dialog shows, when it is the one the held asset was read for.
   */
  const imageOfHeld = () => {
    const image = shownImage()
    return !isNull(held.value) && !isNull(image) && image.dam.damId === held.value.file ? image : null
  }

  // The shown image after a read of the held asset for it failed. The held asset may then be stale.
  // The dialog shows the image source instead of the pick until it shows an image again.
  // Otherwise it kept offering the stale pick, and its confirm wrote nothing only after the user had picked.
  const staleIn = shallowRef<ImageCreateUpdateAware | null>(null)

  /**
   * The asset whose authors the dialog offers.
   * Null unless the dialog shows the image the asset was read for and the last read for that image has not failed.
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

  const pickDamAuthors = (authors: DocId[]) => {
    const asset = damAuthorsAsset.value
    if (asset) asset.authors = authors
  }

  /**
   * Author names resolve under the ext system of the asset licence.
   * Falls back to `pageExtSystem` when the licence has none.
   */
  const namesOf = async (asset: AssetDetailItemDto, pageExtSystem: IntegerId) => {
    const extSystem = (await getExtSystemByLicence(asset.licence)) ?? pageExtSystem
    const authorsRes = await fetchAuthorListByIds(damClient, endPointAuthor, extSystem, asset.authors)
    return authorsRes.map((author) => author.name).join(', ')
  }

  /**
   * The "edit asset" detail may have added authors, so the asset is read again.
   * The read waits for the detail save that was pending on close. An earlier read returns the old asset.
   * If the asset now has authors, the author pick is dropped and an
   * empty image source takes their names. An existing source stays.
   * `pageExtSystem` is the ext system configured when the detail closed. It is used when the licence gives none.
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
      // Unmounted, turned read-only, or now holding another pick's asset: write nothing.
      if (unmounted || readonly() || held.value !== of) return read
      if (asset.authors.length === 0) {
        of.asset = { ...asset, authors: of.asset.authors }
        return read
      }
      // Write only into the image the asset was read for. The dialog may have closed or show another image.
      // The widget keeps holding the asset, so "edit image" of that file re-reads
      // it and fills the empty source. Dropping it here left that source empty.
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

  // The latest pending read of an asset whose detail closed. "Confirm" waits for it, and "edit image" uses its result.
  let detailAssetRead: Promise<DetailAssetRead | null> | null = null
  // Pending detail-close reads, chained per asset. A read of another asset does not wait for them.
  const detailAssetReads = new Map<DocId, Promise<DetailAssetRead | null>>()
  // The confirm currently waiting for that read, if any.
  let waitingConfirm: symbol | null = null
  const confirmWaits = ref(false)
  const dropWaitingConfirm = () => {
    waitingConfirm = null
    confirmWaits.value = false
  }
  // A confirm belongs to the dialog opening it was pressed in. Drop it when the dialog closes or shows a new image.
  // Otherwise the read could answer after a reopen and confirm and save that opening without a press.
  watch(
    shownImage,
    (image) => {
      dropWaitingConfirm()
      if (image !== staleIn.value) staleIn.value = null
    },
    { flush: 'sync' }
  )

  /**
   * "Confirm" pressed while a just-closed detail's asset is still read. The read may change what
   * the form asks for, so the confirm waits (`true`) and `again` re-runs it after the read.
   * Repeated presses, or presses while `saving`, are ignored.
   * The wait is limited by `withinWaitLimit` over the read's sequential requests, so a slow
   * but answering DAM does not time out. On timeout the press is dropped and the user is told.
   * A failed read also drops the press. Otherwise it saved the image with the shown source, without the picked authors.
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
   * `shown`: the asset the detail showed; none if it closed from its loader or after a failed read.
   * Reads only if the dialog offers this asset's authors. The read's inputs are captured before any await.
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
   * "Edit image" of `file`. The held asset is as it was at pick time and may have
   * gained authors since; confirming would overwrite them, so it is re-read first.
   * A pending detail-close read is newer and is reused. A failed one is retried.
   * Inputs are captured at the press because the read may drop the held asset.
   * Returns `null` if no asset is held for that file or the widget is read-only.
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
   * Applies a `readHeldAnew` result to the shown image of that file.
   * Without authors the fresh asset becomes the held one, so picks from a dialog closed without confirm do not return.
   * With authors the pick goes and an empty source takes their names (`giveNamesToEmptySource`).
   * A failed read is reported once and the dialog shows the source until
   * a new image is shown. The asset stays held for the next "edit image".
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
   * On confirm of `image`: release the held asset after save if the dialog showed the source because a read failed.
   * Otherwise the next "edit image" re-read the asset, showed the pick again, and a confirm replaced the user's source.
   */
  const letGoOnceSavedWithSource = (image: ImageCreateUpdateAware) => {
    const of = held.value
    if (isNull(of) || of.file !== image.dam.damId || !isNull(damAuthorsAsset.value)) return () => undefined
    return () => {
      if (held.value === of) held.value = null
    }
  }

  /**
   * Read right before picked authors are written into `asset`. Returns names of authors
   * given elsewhere meanwhile, or `null` if none. Throws if they cannot be read.
   * Not atomic: an author added between this read and the write is still overwritten.
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
    /**
     * A confirm waits for the read of a just-closed detail's asset. Its button spins.
     */
    confirmWaits,
  }
}
