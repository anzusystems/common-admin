import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AxiosInstance } from 'axios'
import { useImageSingleUseUsageFetch } from '@/domains/dam/imageWidget/composables/imageSingleUseUsageFetch'
import { initCommonAdminCoreDamOptions, initCommonAdminImageOptions } from '@/plugins/pluginOptions'
import type { CommonAdminCoreDamConfig, CommonAdminImageConfig } from '@/AnzuSystemsCommonAdmin'

// Who the asset picker asks where a single use photo is used. Only an admin whose CMS checks them says so
// (`singleUseUsageEnabled`, admin-cms). admin-inhouse has the image API of the CMS on daily tools, which has no
// usage route: asked, it answered 404, an error stayed up and a picked photo could never be confirmed.

const request = vi.fn()
const imageClient = () => ({ request, defaults: {}, getUri: () => '' }) as unknown as AxiosInstance
const image = (more: Partial<CommonAdminImageConfig> = {}): CommonAdminImageConfig => ({
  imageClient,
  previewDomain: '',
  previewDomainOriginal: '',
  width: 1,
  height: 1,
  ...more,
})
const install = (
  dam: Record<string, Partial<CommonAdminCoreDamConfig>>,
  images: Record<string, CommonAdminImageConfig>
) => {
  initCommonAdminCoreDamOptions({
    configs: Object.fromEntries(
      Object.entries(dam).map(([name, config]) => [name, { damClient: () => ({}) as AxiosInstance, ...config }])
    ),
    apiTimeout: 30,
    adminDomain: '',
  })
  initCommonAdminImageOptions({ configs: images })
}

describe('useImageSingleUseUsageFetch', () => {
  afterEach(() => {
    initCommonAdminCoreDamOptions(undefined)
    initCommonAdminImageOptions(undefined)
    request.mockReset()
  })

  it('asks nobody where the DAM configuration does not say the CMS checks single use photos', () => {
    install({ default: {} }, { default: image() })

    expect(useImageSingleUseUsageFetch('default')).toBeUndefined()
  })

  it('asks core-cms through the image client where it does, without an image API of the admin', async () => {
    install({ default: { singleUseUsageEnabled: true } }, { default: image() })
    request.mockImplementation((config: { params: { groupIds: string } }) =>
      Promise.resolve({
        status: 200,
        config,
        data: { data: [{ groupId: 'g', holder: null, status: 'free', blocked: false, usageCount: 0, usages: [] }] },
      })
    )

    const usages = await useImageSingleUseUsageFetch('default')!(['g'], null)

    expect(request.mock.calls[0]![0]).toMatchObject({ url: '/adm/v1/image/single-use-usage' })
    expect(usages).toEqual({ g: { holder: null, status: 'free', blocked: false, usageCount: 0, usages: [] } })
  })

  it('asks the image API of the admin, and nobody when it has no usage call', async () => {
    const own = vi.fn().mockResolvedValue({})
    const withApi = { fetchSingleUseUsage: own } as unknown as CommonAdminImageConfig['imageApi']
    const withoutApi = {} as CommonAdminImageConfig['imageApi']
    install(
      { default: { singleUseUsageEnabled: true }, other: { singleUseUsageEnabled: true } },
      { default: image({ imageApi: withApi }), other: image({ imageApi: withoutApi }) }
    )

    await useImageSingleUseUsageFetch('default')!(['g'], { resourceName: 'article', resourceId: 1 })

    expect(own).toHaveBeenCalledWith(imageClient, ['g'], { resourceName: 'article', resourceId: 1 })
    expect(useImageSingleUseUsageFetch('other')).toBeUndefined()
  })

  it('follows the configuration of the name: one that checks does not make another check', () => {
    install({ default: {}, cms: { singleUseUsageEnabled: true } }, { default: image(), cms: image() })

    expect(useImageSingleUseUsageFetch('default')).toBeUndefined()
    expect(useImageSingleUseUsageFetch('cms')).toBeTypeOf('function')
    expect(useImageSingleUseUsageFetch('missing')).toBeUndefined()
  })
})
