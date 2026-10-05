import { describe, expect, it } from 'vitest'
import type { AxiosInstance } from 'axios'
import {
  initCommonAdminCoreDamOptions,
  useCommonAdminCoreDamOptions,
} from '@/domains/dam/composables/commonAdminCoreDamOptions'

// The ROI editor is offered by the grant the configured endpoint checks: admin-ugc saves through `/ugc/v1/roi`, which
// checks none, and has no DAM user to check one against.

const damClient = () => ({}) as AxiosInstance

describe('roiUpdateAcl', () => {
  it('follows the endpoint unless set', () => {
    initCommonAdminCoreDamOptions({
      configs: {
        default: { damClient },
        adm: { damClient, endPointRoi: '/adm/v1/roi' },
        ugc: { damClient, endPointRoi: '/ugc/v1/roi' },
        off: { damClient, roiUpdateAcl: null },
        custom: { damClient, endPointRoi: '/ugc/v1/roi', roiUpdateAcl: 'dam_regionOfInterest_create' },
      },
    } as never)

    expect(useCommonAdminCoreDamOptions('default').roiUpdateAcl).toBe('dam_regionOfInterest_update')
    expect(useCommonAdminCoreDamOptions('adm').roiUpdateAcl).toBe('dam_regionOfInterest_update')
    expect(useCommonAdminCoreDamOptions('ugc').roiUpdateAcl).toBeNull()
    expect(useCommonAdminCoreDamOptions('off').roiUpdateAcl).toBeNull()
    expect(useCommonAdminCoreDamOptions('custom').roiUpdateAcl).toBe('dam_regionOfInterest_create')
  })

  it('and the image rotation follows the image endpoint the same way', () => {
    initCommonAdminCoreDamOptions({
      configs: {
        default: { damClient },
        ugc: { damClient, endPointImage: '/ugc/v1/image' },
        off: { damClient, imageRotateAcl: null },
      },
    } as never)

    expect(useCommonAdminCoreDamOptions('default').imageRotateAcl).toBe('dam_image_update')
    expect(useCommonAdminCoreDamOptions('ugc').imageRotateAcl).toBeNull()
    expect(useCommonAdminCoreDamOptions('off').imageRotateAcl).toBeNull()
  })
})
