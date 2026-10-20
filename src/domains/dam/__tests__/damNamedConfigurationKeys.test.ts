import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { defineComponent, h, shallowRef } from 'vue'
import {
  CONSUMER_DAM_ADMIN_DOMAIN,
  cmsConfiguration,
  installConsumerProfile,
} from '@/domains/dam/__tests__/support/consumerProfiles'
import { createFakeDam, type FakeDam, type FakeDamRequest } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { seedDamConfigOf } from '@/domains/dam/__tests__/support/namedDamConfig'
import { useDamCachedUsers } from '@/domains/dam/author/composables/cachedUsers'
import {
  usePodcastInnerFilter,
  usePodcastSelectActions,
} from '@/domains/dam/assetSelect/composables/podcastFilterAndActions'
import { usePagination } from '@/domains/api/composables/pagination'
import DamUserFilterRemoteAutocomplete from '@/domains/dam/user/components/DamUserFilterRemoteAutocomplete.vue'
import DamUserRemoteAutocomplete from '@/domains/dam/user/components/DamUserRemoteAutocomplete.vue'
import { useDamUserInnerFilter } from '@/domains/dam/user/filter/DamUserFilter'
import DamAdminAssetLink from '@/domains/dam/components/DamAdminAssetLink.vue'
import { initCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useDamConfigState } from '@/domains/dam/config/composables/damConfigState'
import { useDamConfigStoreOf } from '@/domains/dam/config/store/damConfigStore'
import ImageMediaWidgetInner from '@/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue'
import {
  initCommonAdminImageOptions,
  useCommonAdminImageOptions,
} from '@/domains/dam/imageWidget/composables/commonAdminImageOptions'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { withinWaitLimit } from '@/domains/dam/imageWidget/utils/waitLimit'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { UploadQueueItemStatus, UploadQueueItemType } from '@/domains/dam/types/UploadQueue'
import { useDamUploadChunkSize } from '@/domains/dam/uploadQueue/composables/damUploadChunkSize'
import { useUpload } from '@/domains/dam/uploadQueue/composables/uploadService'
import { useUploadQueueItemFactory } from '@/domains/dam/uploadQueue/factory/UploadQueueItemFactory'
import { libraryUploadPreset } from '@/domains/dam/uploadQueue/presets/uploadPresets'
import { coreDamOptions } from '@/plugins/pluginOptions'

// A page with two DAM configurations: `default`, as admin-cms has it, and `own`, which sets every address with a key,
// its admin and its timeout. What is asked under `own` goes there, by `own`'s client; under `default` where it went
// before the keys. Each DAM answers every such address.

const { endPoints, extSystem, licence } = cmsConfiguration
const OWN = { asset: '/own/v2/asset', image: '/own/v2/image' }
const OWN_KEYS = {
  endPointConfiguration: '/own/v2/configuration',
  endPointPubConfiguration: '/own/pub/configuration',
  endPointAssetLicence: '/own/v2/asset-licence',
  endPointAssetCustomForm: '/own/v2/asset-custom-form',
  endPointUser: '/own/v2/user',
  endPointPodcast: '/own/v2/podcast',
  endPointCmsAsset: '/own/v2/cms/asset',
}
const TODAY = {
  endPointConfiguration: '/adm/v1/configuration',
  endPointPubConfiguration: '/pub/v1/configuration',
  endPointAssetLicence: '/adm/v1/asset-licence',
  endPointAssetCustomForm: '/adm/v1/asset-custom-form',
  endPointUser: '/adm/v1/user',
  endPointPodcast: '/adm/v1/podcast',
  endPointCmsAsset: '/adm/v1/cms/asset',
}
const OWN_ADMIN = 'https://own.test'
const OWN_TIMEOUT = 120
const EXT = 4
const LICENCE = 7
/** From here on a wait is held: below the 1.5 s the caches wait before they ask. */
const HELD_FROM_MS = 1_200

let pinia: Pinia
let dam: FakeDam
let own: FakeDam
let waits: LongWaits
let wrapper: VueWrapper | undefined

/** A DAM answers each of the addresses with a key, at those given. */
const answerAt = (of: FakeDam, at: typeof TODAY) =>
  of.reply((request) => {
    if (request.method !== 'GET') return undefined
    const path = request.url.split('?')[0]!
    if (path === at.endPointConfiguration) {
      return { status: 200, data: { settings: {}, colorSet: {}, assetExternalProviders: {}, distributionServices: [] } }
    }
    if (path === at.endPointPubConfiguration) return { status: 200, data: { userAuthType: 'json_credentials' } }
    if (path === `${at.endPointConfiguration}/ext-system/${EXT}`) {
      return { status: 200, data: { assetExternalProviders: {}, audio: {}, document: {}, image: {}, video: {} } }
    }
    if (path === `${at.endPointAssetLicence}/${LICENCE}`) {
      return { status: 200, data: { id: LICENCE, extSystem: EXT, name: 'licence' } }
    }
    if (path.startsWith(`${at.endPointAssetCustomForm}/`)) return { status: 200, data: { data: [], totalCount: 0 } }
    if (path === at.endPointUser) {
      const person = { firstName: '', lastName: '', fullName: 'Somebody' }
      return { status: 200, data: { data: [{ id: 5, email: '', avatar: {}, person }], totalCount: 1 } }
    }
    if (path === `${at.endPointPodcast}/licence/${LICENCE}`) {
      return { status: 200, data: { data: [{ id: 'podcast-1', texts: { title: 'A podcast' } }], totalCount: 1 } }
    }
    if (path.startsWith(`${at.endPointCmsAsset}/`)) return { status: 200, data: {} }
    return undefined
  })

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  dam = createFakeDam(endPoints)
  own = createFakeDam(OWN)
  answerAt(dam, TODAY)
  answerAt(own, OWN_KEYS)
  const { coreDam, image } = installConsumerProfile(cmsConfiguration, dam.client)
  initCommonAdminCoreDamOptions({
    ...coreDam!,
    configs: {
      ...coreDam!.configs,
      own: {
        damClient: own.client,
        endPointAsset: OWN.asset,
        endPointImage: OWN.image,
        ...OWN_KEYS,
        adminDomain: OWN_ADMIN,
        apiTimeout: OWN_TIMEOUT,
      },
    },
  })
  initCommonAdminImageOptions({ ...image!, configs: { ...image!.configs, own: image!.configs.default! } })
  seedDamConfigOf('own', pinia)
  waits = holdLongWaits(HELD_FROM_MS)
})

afterEach(async () => {
  wrapper?.unmount()
  wrapper = undefined
  await waits.elapseAll()
  waits.restore()
})

/** The method and the path of every request a client was asked, in order, without the query. */
const asked = (of: FakeDam) =>
  of.requests.map((request: FakeDamRequest) => `${request.method} ${request.url.split('?')[0]}`)

describe('the addresses with a key of a DAM configuration', () => {
  it.each([
    ['own', () => own, OWN_KEYS],
    ['default', () => dam, TODAY],
  ] as const)(
    'are where %s reads its configuration, licences, custom forms, users and podcasts',
    async (name, of, at) => {
      const client = of().client
      const state = useDamConfigState(client, name)

      await state.loadDamPrvConfig()
      await state.loadDamPubConfig()
      await state.loadDamConfigExtSystem(EXT)
      await state.getExtSystemByLicence(LICENCE)
      await state.loadDamConfigAssetCustomFormElements(EXT, [DamAssetType.Image])
      await state.loadDamConfigDistributionCustomFormElements('youtube')
      const users = useDamCachedUsers(name)
      users.addToCachedUsers(5)
      users.fetchCachedUsers()
      await waits.elapse()
      await flushPromises()
      const podcastActions = usePodcastSelectActions(LICENCE, name)
      const podcasts = await podcastActions.fetchItemsByIds(['podcast-1'])
      const { filterData, filterConfig } = usePodcastInnerFilter()
      const listed = await podcastActions.fetchItems(usePagination('id').pagination, filterData, filterConfig)

      expect(asked(of())).toEqual([
        `GET ${at.endPointConfiguration}`,
        `GET ${at.endPointPubConfiguration}`,
        `GET ${at.endPointConfiguration}/ext-system/${EXT}`,
        `GET ${at.endPointAssetLicence}/${LICENCE}`,
        `GET ${at.endPointAssetCustomForm}/ext-system/${EXT}/type/image/element`,
        `GET ${at.endPointAssetCustomForm}/distribution-service/youtube/element`,
        `GET ${at.endPointUser}`,
        `GET ${at.endPointPodcast}/licence/${LICENCE}`,
        `GET ${at.endPointPodcast}/licence/${LICENCE}`,
      ])
      expect(asked(name === 'own' ? dam : own)).toEqual([])
      expect(users.getCachedUser(5)?.person.fullName).toBe('Somebody')
      expect(podcasts).toEqual([{ title: 'A podcast', value: 'podcast-1' }])
      expect(listed).toEqual([{ title: 'A podcast', value: 'podcast-1' }])
    }
  )

  it('refuse, once the plugin is set, a configuration state of a name the application has not got', () => {
    expect(() => useDamConfigState(own.client, 'typo')).toThrow(
      "Composable can't be used without properly configured common admin."
    )
    coreDamOptions.value = undefined
    expect(() => useDamConfigState(own.client, 'typo')).not.toThrow()
  })

  // The user input and the user filter under `own` list and look up its users; an input given a client of its own
  // does so at the fixed address.
  const UserInput = defineComponent({
    name: 'UserInputStandIn',
    props: {
      fetchItems: { type: Function, default: undefined },
      fetchItemsByIds: { type: Function, default: undefined },
    },
    setup: () => () => h('div'),
  })
  it.each([
    [
      'the user input',
      DamUserRemoteAutocomplete,
      () => ({ modelValue: null, configName: 'own' }),
      OWN_KEYS.endPointUser,
    ],
    [
      'the user input given a client',
      DamUserRemoteAutocomplete,
      () => ({ modelValue: null, configName: 'own', client: own.client }),
      TODAY.endPointUser,
    ],
    [
      'the user filter',
      DamUserFilterRemoteAutocomplete,
      () => ({ name: 'createdBy', configName: 'own' }),
      OWN_KEYS.endPointUser,
    ],
  ] as const)('are where %s under the configuration lists its users', async (_name, component, props, endPoint) => {
    wrapper = mount(component as never, {
      props: props() as never,
      global: {
        plugins: [pinia],
        stubs: { AFormRemoteAutocomplete: UserInput, AFilterRemoteAutocomplete: UserInput },
      },
    })
    const input = wrapper.findComponent(UserInput)
    const { filterData, filterConfig } = useDamUserInnerFilter()

    await (input.props('fetchItemsByIds') as (ids: number[]) => Promise<unknown>)([5]).catch(() => undefined)
    await (input.props('fetchItems') as (...list: unknown[]) => Promise<unknown>)(
      usePagination('id').pagination,
      filterData,
      filterConfig
    ).catch(() => undefined)

    expect(asked(own)).toEqual([`GET ${endPoint}`, `GET ${endPoint}`])
    expect(asked(dam)).toEqual([])
  })

  it('are those of before the keys for a configuration state the application asks for before the plugin is set', async () => {
    coreDamOptions.value = undefined

    const state = useDamConfigState(dam.client)
    await expect(state.loadDamPrvConfig()).resolves.toBe(true)
    await state.getExtSystemByLicence(LICENCE)

    expect(asked(dam)).toEqual([`GET ${TODAY.endPointConfiguration}`, `GET ${TODAY.endPointAssetLicence}/${LICENCE}`])
  })

  it('is where the image and media widget under the configuration reads a picked asset as a medium', async () => {
    const Picker = defineComponent({ emits: ['confirm'], setup: () => () => h('div') })
    wrapper = mount(ImageMediaWidgetInner, {
      attachTo: document.body,
      props: {
        image: null,
        media: null,
        queueKey: 'keys-media',
        uploadLicence: licence,
        selectLicences: [licence],
        configName: 'own',
      } as never,
      global: {
        plugins: [pinia],
        provide: {
          [ImageWidgetUploadConfigKey as symbol]: shallowRef({
            licence,
            extSystem,
            licenceName: '',
            extSystemConfig: {},
          }),
        },
        stubs: {
          AAssetSelect: Picker,
          AAssetSelectMedia: Picker,
          ImageDetailDialogMetadata: true,
          AssetDetailDialog: true,
          UploadQueueDialog: true,
          UploadQueueDialogSingle: true,
          AFileInput: true,
          AFileInputDialog: true,
          AFileDropzone: true,
        },
      },
    })
    await flushPromises()

    wrapper.findComponent(Picker).vm.$emit('confirm', {
      type: 'asset',
      copyToLicence: null,
      value: [
        {
          id: 'picked',
          licence,
          mainFile: { id: 'file-of-picked' },
          attributes: { assetType: DamAssetType.Image },
          podcasts: [],
        },
      ],
    })
    await vi.waitFor(() => expect(asked(own)).toContain(`GET ${OWN_KEYS.endPointCmsAsset}/picked`))

    expect(asked(dam).filter((request) => request.includes('/cms/asset'))).toEqual([])
  })
})

describe('the admin and the timeout of a DAM configuration', () => {
  it.each([
    ['own', OWN_ADMIN],
    ['default', CONSUMER_DAM_ADMIN_DOMAIN],
  ] as const)('are what an asset under %s links to', async (configName, domain) => {
    wrapper = mount(DamAdminAssetLink, { props: { assetId: 'asset-9', configName }, global: { plugins: [pinia] } })
    await flushPromises()

    expect(wrapper.find('a').attributes('href')).toBe(`${domain}/asset/asset-9`)
  })

  it.each([
    ['own', () => own, [3000]],
    ['default', () => dam, [1000, 1000, 1000]],
  ] as const)('are what the chunks of an upload under %s are sized by', async (name, of, sizes) => {
    useDamConfigStoreOf(name).damPrvConfig.settings.imageChunkConfig = { minSize: 1000, maxSize: 100_000 }
    useDamUploadChunkSize(undefined, name).updateChunkSize(0.001)
    const item = useUploadQueueItemFactory().createDefault(
      `file_${name}.jpg`,
      UploadQueueItemType.File,
      UploadQueueItemStatus.Waiting,
      DamAssetType.Image,
      1000,
      licence
    )
    item.file = new File([new Uint8Array(3000)], 'photo.jpg', { type: 'image/jpeg' })
    // A chunk of 1000 bytes takes 10 s: fine against 30 s, too short against 120 s.
    item.progress.speed = 100
    const { uploadInit, upload } = useUpload(item, undefined, libraryUploadPreset(name))

    await uploadInit()
    await upload()

    expect(
      of()
        .sentTo('POST', of().routes.chunk)
        .map((request) => ((request.data as FormData).get('file') as File).size)
    ).toEqual(sizes)
  })

  it.each([
    ['own', OWN_TIMEOUT * 1000],
    ['default', 30 * 1000],
  ] as const)('are how long a widget under %s waits for what it waits on', (name, length) => {
    void withinWaitLimit(new Promise(() => undefined), 1, name)

    expect(waits.lengths()).toEqual([length])
  })
})

describe('the image options of a configuration', () => {
  it.each(['constructor', 'toString', 'unknown'])(
    'are refused for %s, a name the application has not given',
    (name) => {
      expect(() => useCommonAdminImageOptions(name)).toThrow(
        "Composable can't be used without properly configured common admin."
      )
    }
  )
})
