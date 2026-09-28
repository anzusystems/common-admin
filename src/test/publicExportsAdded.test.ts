import { describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
// eslint-disable-next-line no-restricted-imports -- this test is about the public entry itself
import * as lib from '@/lib'
import { AnzuApiAxiosError } from '@/shared/error/AnzuApiAxiosError'
import { AnzuApiResponseCodeError } from '@/shared/error/AnzuApiResponseCodeError'
import { AnzuApiTimeoutError } from '@/shared/error/AnzuApiTimeoutError'

// Values the admins used to define themselves because the library kept them internal.
describe('exports the admins redefined', () => {
  it('are reachable from the public entry', () => {
    expect(lib.apiErrorStatus).toBeTypeOf('function')
    expect(lib.DamMediaType).toBeTypeOf('object')
    expect(lib.AssetSelectReturnType).toBeTypeOf('object')
    expect(lib.SORT_BY_SCORE_DATE).toBe('score_date')
    expect(lib.SORT_BY_SCORE_BEST).toBe('score_best')
  })
})

describe('apiErrorStatus', () => {
  it('reads the status of an axios response error', () => {
    const response = { status: 404, statusText: '', headers: {}, config: { headers: new AxiosHeaders() }, data: {} }
    const error = new AnzuApiAxiosError(new AxiosError('x', undefined, undefined, undefined, response as never))
    expect(lib.apiErrorStatus(error)).toBe(404)
  })

  it('reads the code of a response axios let through', () => {
    expect(lib.apiErrorStatus(new AnzuApiResponseCodeError(409))).toBe(409)
  })

  it('answers undefined when nothing answered', () => {
    expect(lib.apiErrorStatus(new AnzuApiTimeoutError())).toBeUndefined()
    expect(lib.apiErrorStatus(new Error('network'))).toBeUndefined()
    expect(lib.apiErrorStatus(undefined)).toBeUndefined()
  })
})

// 2.0.0: every exported component starts with `A`, and the injection keys end in `Key`.
describe('renamed in 2.0.0', () => {
  const renamed = {
    DamAdminAssetLink: 'ADamAdminAssetLink',
    DamAssetImageRoiSelect: 'ADamAssetImageRoiSelect',
    DamAssetLicenceGroupRemoteAutocomplete: 'ADamAssetLicenceGroupRemoteAutocomplete',
    DamAssetLicenceRemoteAutocomplete: 'ADamAssetLicenceRemoteAutocomplete',
    DamAuthorFilterRemoteAutocomplete: 'ADamAuthorFilterRemoteAutocomplete',
    DamDistributionServiceSelect: 'ADamDistributionServiceSelect',
    DamExtSystemRemoteAutocomplete: 'ADamExtSystemRemoteAutocomplete',
    DamExternalProviderAssetSelect: 'ADamExternalProviderAssetSelect',
    DamKeywordFilterRemoteAutocomplete: 'ADamKeywordFilterRemoteAutocomplete',
    DamUserFilterRemoteAutocomplete: 'ADamUserFilterRemoteAutocomplete',
    FiltersSelected: 'AFiltersSelected',
    ImageMassOperations: 'AImageMassOperations',
    SystemScopeSymbol: 'SystemScopeKey',
    SubjectScopeSymbol: 'SubjectScopeKey',
    ImageWidgetUploadConfig: 'ImageWidgetUploadConfigKey',
  }

  it.each(Object.entries(renamed))('%s is exported as %s only', (from, to) => {
    const exports = lib as Record<string, unknown>
    expect(exports[to]).toBeDefined()
    expect(exports[from]).toBeUndefined()
  })

  it('keeps the injection keys identical at runtime', () => {
    expect(lib.SystemScopeKey).toBe(Symbol.for('anzu:SystemScope'))
    expect(lib.ImageWidgetUploadConfigKey).toBe(Symbol.for('anzu:ImageWidgetUploadConfig'))
  })
})
