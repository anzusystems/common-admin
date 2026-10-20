import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { defaultApiErrorLogger, setApiErrorLogger } from '@/domains/api/utils/apiErrors'
import { consumerProfiles, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import {
  createFakeDam,
  damAssetWithFile,
  type FakeDam,
  type FakeDamAnswer,
} from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { rowState } from '@/domains/dam/__tests__/support/uploadQueueRow'
import { alertText, forgetAlerts, shownAlerts } from '@/domains/dam/__tests__/support/uploadUi'
import AssetDetailSidebarActionsTeleportTarget from '@/domains/dam/assetDetail/components/AssetDetailSidebarActionsTeleportTarget.vue'
import AssetDetailSidebarMetadata from '@/domains/dam/assetDetail/components/AssetDetailSidebarMetadata.vue'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

// The save of the detail of one asset, under each of the two applications: what it says when the DAM refuses it.
// The real sidebar of the metadata with its real form over the real store of the detail, its buttons in their real
// place; the DAM is a client that records its requests. Not mounted for real: the inputs that ask the DAM for names
// to offer, and the chips of the users who made and changed the asset.

const QUEUE = 'asset-detail'
/** The upload queue a detail was opened from. */
const ROWS = 'asset-detail-rows'

let pinia: Pinia
let dam: FakeDam
let wrapper: VueWrapper | undefined

describe.each(consumerProfiles)('the save of the detail of an asset under the $name', (profile) => {
  const { endPoints, extSystem, licence } = profile

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    dam = createFakeDam(endPoints)
    installConsumerProfile(profile, dam.client)
    forgetAlerts()
    setApiErrorLogger(null)
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    setApiErrorLogger(defaultApiErrorLogger)
  })

  /** The detail of an asset is open, as a widget opens it. */
  const openDetail = async () => {
    useAssetDetailStore(pinia).setAsset(
      damAssetWithFile('asset-1', 'file-1', AssetFileProcessStatus.Processed, {
        licence,
        metadata: { customData: { description: 'from the server' }, authorSuggestions: {}, keywordSuggestions: {} },
      })
    )
    const Detail = defineComponent({
      setup: () => () =>
        h('div', [
          h(AssetDetailSidebarMetadata, {
            queueKey: QUEUE,
            isActive: true,
            assetType: DamAssetType.Image,
            extSystem,
          }),
          h(AssetDetailSidebarActionsTeleportTarget, { queueKey: QUEUE }),
        ]),
    })
    wrapper = mount(Detail, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
        stubs: { AFormRemoteAutocompleteWithCached: true, ACachedUserChip: true },
      },
    })
    await flushPromises()
    await flushPromises()
  }
  const save = () => document.body.querySelector<HTMLButtonElement>('[data-cy="button-save"]')!
  const saves = () => dam.sentTo('PATCH', dam.routes.bulkMetadata)
  const refuseSaves = (answer: FakeDamAnswer) =>
    dam.reply((request) =>
      request.method === 'PATCH' && dam.routes.bulkMetadata.test(request.url) ? answer : undefined
    )
  const saved = async () => {
    save().click()
    await vi.waitFor(() => expect(saves()).toHaveLength(1))
    await vi.waitFor(() => expect(save().classList.contains('v-btn--loading')).toBe(false))
    await flushPromises()
  }
  const systemError = ['error', alertText('common.alert.unknownError')]
  /** The one alert of a refusal by validation: its heading, and the field each of its lines names. */
  const refusalSaid = () => {
    expect(shownAlerts()).toHaveLength(1)
    const [[colour, text]] = shownAlerts() as Array<[string, string]>
    const [heading, ...lines] = text.split('\n')

    return { colour, heading, fields: lines.map((line) => line.split(': ')[0]) }
  }

  it('sends the asset as the detail holds it, and says the record was updated', async () => {
    await openDetail()

    await saved()

    expect(saves().map((request) => request.url)).toEqual([`${endPoints.asset}/metadata-bulk-update`])
    expect(dam.body(saves()[0])).toMatchObject([
      { id: 'asset-1', described: true, customData: { description: 'from the server' } },
    ])
    expect(shownAlerts()).toEqual([['success', alertText('common.alert.recordWas.updated')]])
  })

  // Nothing reads what the DAM answers the save with.
  it('says the record was updated also when the DAM answers with 200 and no list', async () => {
    refuseSaves({ status: 200, data: {} })
    await openDetail()

    await saved()

    expect(shownAlerts()).toEqual([['success', alertText('common.alert.recordWas.updated')]])
  })

  // Once, and by the name the form gives the field: the save used to say a refusal itself and have the sidebar say
  // it again, the second time by the key of the request.
  it.each([
    ['a custom field by the name its form gives it', '[0].customData.description', 'Description of the image'],
    ['the keywords by theirs', '[0].keywords', alertText('common.damImage.asset.model.keywords')],
  ])('says once which field the DAM refuses: %s', async (_what, key, name) => {
    const elements = useDamConfigStore(pinia).damConfigAssetCustomFormElements.get(extSystem)![DamAssetType.Image]
    elements.find((element) => element.property === 'description')!.name = 'Description of the image'
    refuseSaves({
      status: 422,
      data: { contextId: 'context', error: 'validation_failed', fields: { [key]: ['error_field_empty'] } },
    })
    await openDetail()

    await saved()

    expect(refusalSaid()).toEqual({
      colour: 'error',
      heading: alertText('common.alert.fixApiValidationErrors'),
      fields: [name],
    })
  })

  // The spinning button takes no click of the mouse, and still takes Enter and Space.
  it('sends one save however often its button is pressed while the save runs', async () => {
    const held = dam.hold('PATCH', dam.routes.bulkMetadata)
    await openDetail()

    save().click()
    await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
    await flushPromises()
    expect(save().classList.contains('v-btn--loading')).toBe(true)
    save().click()
    save().click()
    await flushPromises()
    expect(saves()).toHaveLength(1)

    held.release()
    await vi.waitFor(() => expect(save().classList.contains('v-btn--loading')).toBe(false))
    await flushPromises()
    expect(saves()).toHaveLength(1)
    expect(shownAlerts()).toEqual([['success', alertText('common.alert.recordWas.updated')]])
  })

  // The form is not locked while the save runs, and the detail can be closed before the DAM answers. Its host may
  // read the asset again then: it finds the save that is on its way in the store of the detail, under the asset it
  // saves, and waits for it.
  it.each<[string, FakeDamAnswer | undefined]>([
    ['answers it', undefined],
    ['refuses it', { status: 500 }],
  ])(
    'keeps the save that is on its way where its host finds it, until the DAM %s: never as one that fails',
    async (_what, answer) => {
      const held = dam.hold('PATCH', dam.routes.bulkMetadata)
      await openDetail()
      const detail = useAssetDetailStore(pinia)
      expect(detail.savingOf('asset-1', 'default')).toBeNull()

      save().click()
      await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
      const onItsWay = detail.savingOf('asset-1', 'default')
      expect(onItsWay).toBeInstanceOf(Promise)
      // Of that asset only.
      expect(detail.savingOf('asset-2', 'default')).toBeNull()
      // Pressed again while it runs, the button sends nothing: the save on its way is still that one.
      save().click()
      await flushPromises()
      expect(held.waiting).toHaveLength(1)
      expect(detail.savingOf('asset-1', 'default')).toBeInstanceOf(Promise)
      // The detail goes, and its save goes on.
      wrapper!.unmount()
      wrapper = undefined
      expect(detail.savingOf('asset-1', 'default')).toBeInstanceOf(Promise)

      held.release(answer)
      await expect(onItsWay).resolves.toBeUndefined()
      await flushPromises()
      expect(detail.savingOf('asset-1', 'default')).toBeNull()
    }
  )

  // Opened from a row of the upload queue, the detail tells the queue what it saved, and the queue reads the asset
  // once more. When that read fails the rows take what the detail saved, and the switch it keeps apart from the
  // asset: left as they were, the next save of the queue would send their old values over the save of the detail.
  describe('opened from a row of the upload queue', () => {
    let waits: LongWaits

    beforeEach(() => {
      waits = holdLongWaits()
    })
    afterEach(() => {
      useUploadQueuesStore(pinia).stopUpload(ROWS)
      waits.restore()
    })

    /** The row of the asset, and its detail as the dialog of the queue opens it, the switch turned on in it. */
    const openedFromRow = async () => {
      const queue = useUploadQueuesStore(pinia)
      await queue.addByCopyToLicence(ROWS, extSystem, licence, ['asset-1'], 'default')
      const [row] = queue.getQueueItems(ROWS)
      expect(row).toMatchObject({ assetId: 'asset-1', customData: {}, mainFileSingleUse: null })
      await openDetail()
      const detail = useAssetDetailStore(pinia)
      detail.updateUploadStore = true
      detail.mainFileSingleUse = true
      return { queue, detail, row }
    }
    const failAssetReads = () =>
      dam.reply((request) =>
        request.method === 'GET' && dam.routes.one.test(request.url) ? { status: 502 } : undefined
      )
    const assetReads = () => dam.sentTo('GET', dam.routes.one).map((request) => request.url)
    /** "Save" is pressed, and its request is on its way: the DAM has not answered yet. */
    const saveOnItsWay = async () => {
      const held = dam.hold('PATCH', dam.routes.bulkMetadata)
      save().click()
      await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
      await flushPromises()
      return held
    }
    const updated = ['success', alertText('common.alert.recordWas.updated')]

    it('hands the rows of its asset what it saved, the single-use switch too, when the asset cannot be read again', async () => {
      const { row } = await openedFromRow()
      failAssetReads()

      await saved()

      expect(dam.body(saves()[0])).toMatchObject([
        { id: 'asset-1', customData: { description: 'from the server' }, mainFileSingleUse: true },
      ])
      expect(assetReads()).toEqual([`${endPoints.asset}/asset-1`])
      expect(shownAlerts()).toEqual([updated])
      expect(row).toMatchObject({ customData: { description: 'from the server' }, mainFileSingleUse: true })
    })

    it('reads the asset again, and hands the rows of its asset what the DAM has by then', async () => {
      const { row } = await openedFromRow()
      dam.assets.set(
        'asset-1',
        damAssetWithFile('asset-1', 'file-1', AssetFileProcessStatus.Processed, {
          licence,
          metadata: {
            customData: { description: 'as the DAM has it now' },
            authorSuggestions: {},
            keywordSuggestions: {},
          },
          mainFileSingleUse: false,
        })
      )

      await saved()

      expect(assetReads()).toEqual([`${endPoints.asset}/asset-1`])
      expect(shownAlerts()).toEqual([updated])
      expect(row).toMatchObject({ customData: { description: 'as the DAM has it now' }, mainFileSingleUse: false })
    })

    // The dialog of a queue turns the telling on when it opens the detail of a row, and nothing turns it off: a
    // detail opened afterwards from elsewhere tells the queue too, of an asset no queue holds a row of. Its save
    // used to wait for one more read of that asset, with no row to write it into. A row whose file the server is
    // still processing may turn out to be a duplicate of that asset, and become its row while it is read: then the
    // asset is read, and a row that has not become its row is left as it was.
    it.each<[string, string[], number]>([
      ['no queue has a row', [], 0],
      ['the rows of the queue are of other assets, being processed', ['asset-2', 'asset-3'], 1],
    ])(
      'reads the asset after its save only while a row may become its row, the telling still on, when %s',
      async (_what, others, reads) => {
        const queue = useUploadQueuesStore(pinia)
        if (others.length > 0) await queue.addByCopyToLicence(ROWS, extSystem, licence, others, 'default')
        const rows = () => queue.getQueueItems(ROWS).map(rowState)
        const untouched = rows()
        await openDetail()
        useAssetDetailStore(pinia).updateUploadStore = true

        await saved()

        expect(saves()).toHaveLength(1)
        expect(assetReads()).toEqual(Array(reads).fill(`${endPoints.asset}/asset-1`))
        expect(shownAlerts()).toEqual([updated])
        expect(rows()).toEqual(untouched)
      }
    )

    // The form is not locked while the save runs. What is typed or switched meanwhile is not saved, and is not the
    // rows' either: they would send it with the next save of the queue as if the detail had saved it.
    it('hands them what was sent, not what is typed or switched while the save runs', async () => {
      const { detail, row } = await openedFromRow()
      failAssetReads()
      const held = await saveOnItsWay()

      detail.asset!.metadata.customData.description = 'typed while the save runs'
      detail.asset!.keywords.push('keyword-picked-while-the-save-runs')
      detail.asset!.authors.push('author-picked-while-the-save-runs')
      detail.mainFileSingleUse = false
      held.release()
      await vi.waitFor(() => expect(shownAlerts()).toEqual([updated]))

      const sent = { keywords: [], authors: [], customData: { description: 'from the server' } }
      expect(dam.body(saves()[0])).toMatchObject([{ id: 'asset-1', ...sent, mainFileSingleUse: true }])
      expect(row).toMatchObject({ ...sent, mainFileSingleUse: true })
      // What was typed since stays in the form, for the next save.
      expect(detail.asset!.metadata.customData).toEqual({ description: 'typed while the save runs' })
      expect(detail.mainFileSingleUse).toBe(false)
    })

    // The rows of the queue are not locked while the save of the detail runs: what is typed into a row meanwhile is the
    // user's, as what is typed while the asset is read afterwards. It was replaced.
    it('keeps what was typed into the row of its asset while the save runs', async () => {
      const { row } = await openedFromRow()
      failAssetReads()
      const held = await saveOnItsWay()

      row.keywords = ['keyword-typed-meanwhile']
      row.customData = { title: 'typed meanwhile' }
      held.release()
      await vi.waitFor(() => expect(shownAlerts()).toEqual([updated]))

      expect(row).toMatchObject({
        keywords: ['keyword-typed-meanwhile'],
        customData: { title: 'typed meanwhile', description: 'from the server' },
        mainFileSingleUse: true,
      })
    })

    // The store of the detail is shared: by the time the save is answered it can hold another asset.
    it('tells the queue of the asset it saved, when the detail holds another one by the time the save is answered', async () => {
      const { queue, detail, row } = await openedFromRow()
      await queue.addByCopyToLicence(ROWS, extSystem, licence, ['asset-2'], 'default')
      const other = queue.getQueueItems(ROWS)[1]!
      failAssetReads()
      const held = await saveOnItsWay()

      detail.setAsset(
        damAssetWithFile('asset-2', 'file-2', AssetFileProcessStatus.Processed, {
          licence,
          metadata: { customData: { description: 'of another asset' }, authorSuggestions: {}, keywordSuggestions: {} },
        })
      )
      await flushPromises()
      held.release()
      await vi.waitFor(() => expect(shownAlerts()).toEqual([updated]))

      expect(assetReads()).toEqual([`${endPoints.asset}/asset-1`])
      expect(row).toMatchObject({ customData: { description: 'from the server' }, mainFileSingleUse: true })
      expect(other).toMatchObject({ assetId: 'asset-2', customData: {}, mainFileSingleUse: null })
    })

    // Closed while its save runs, the detail has emptied its store by the time the DAM answers. The queue was not
    // told then, and the rows went on holding what the next save of the queue would write over the detail's.
    it.each([
      ['is read again: the rows take what the DAM has', true, 'as the DAM has it now'],
      ['cannot be read again: the rows take what was saved', false, 'from the server'],
    ])(
      'tells the queue also when it was closed while its save ran, and the asset %s',
      async (_what, read, description) => {
        const { detail, row } = await openedFromRow()
        if (read) {
          dam.assets.set(
            'asset-1',
            damAssetWithFile('asset-1', 'file-1', AssetFileProcessStatus.Processed, {
              licence,
              metadata: { customData: { description }, authorSuggestions: {}, keywordSuggestions: {} },
              mainFileSingleUse: true,
            })
          )
        } else {
          failAssetReads()
        }
        const held = await saveOnItsWay()

        // As the dialog of the detail closes: it empties the store, and its sidebar is gone.
        detail.setAsset(null)
        wrapper!.unmount()
        wrapper = undefined
        held.release()
        await vi.waitFor(() => expect(shownAlerts()).toEqual([updated]))

        expect(saves()).toHaveLength(1)
        expect(assetReads()).toEqual([`${endPoints.asset}/asset-1`])
        expect(row).toMatchObject({ customData: { description }, mainFileSingleUse: true })
      }
    )
  })

  it.each<[string, FakeDamAnswer, string[]]>([
    ['answers with 201', { status: 201, data: [] }, systemError],
    ['answers with 204', { status: 204 }, systemError],
    ['answers with 500', { status: 500 }, systemError],
    ['forbids the save', { status: 403 }, ['error', alertText('common.alert.forbiddenError')]],
  ])('says the save failed, as the kind of the failure is, when the DAM %s', async (_what, answer, alert) => {
    refuseSaves(answer)
    await openDetail()

    await saved()

    expect(shownAlerts()).toEqual([alert])
  })
})
