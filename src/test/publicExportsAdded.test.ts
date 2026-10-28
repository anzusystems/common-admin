import { describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { AxiosError, AxiosHeaders } from 'axios'
// eslint-disable-next-line no-restricted-imports -- this test is about the public entry itself
import * as lib from '@/lib'
import { AnzuApiAxiosError } from '@/shared/error/AnzuApiAxiosError'
import { AnzuApiResponseCodeError } from '@/shared/error/AnzuApiResponseCodeError'
import { AnzuApiTimeoutError } from '@/shared/error/AnzuApiTimeoutError'
import { imageUploadChunk, imageUploadFinish, imageUploadStart } from '@/domains/dam/api/damImageApi'
import { uploadStop, uploadValidationMessage, useUpload } from '@/domains/dam/uploadQueue/composables/uploadService'
import { adminDamUploadPreset } from '@/domains/dam/uploadQueue/presets/uploadPresets'
import { createUploadQueueCore } from '@/domains/dam/uploadQueue/core/uploadQueueCore'
import { fillAuthors, fillCustomDataValue, fillKeywords } from '@/domains/dam/uploadQueue/core/uploadQueueFill'
import { adminDamImportRun, adminDamQueuePreset } from '@/domains/dam/uploadQueue/presets/queuePresets'
import { useImageRoiStore } from '@/domains/dam/cropper/store/imageRoiStore'

describe('exports the admins redefined', () => {
  it('are reachable from the public entry', () => {
    expect(lib.apiErrorStatus).toBeTypeOf('function')
    expect(lib.DamMediaType).toBeTypeOf('object')
    expect(lib.AssetSelectReturnType).toBeTypeOf('object')
    expect(lib.SORT_BY_SCORE_DATE).toBe('score_date')
    expect(lib.SORT_BY_SCORE_BEST).toBe('score_best')
  })

  // An app tearing down its DAM socket needs this export.
  it('include tearing down the DAM notification socket', () => {
    expect(lib.destroyDamNotifications).toBeTypeOf('function')
  })

  // An application with an upload queue store of its own (admin-dam) settles its rows through the same modules.
  it('include the settlement of the upload queue', () => {
    expect(lib.createUploadSettlement).toBeTypeOf('function')
    expect(lib.useDamNotificationsConnection).toBeTypeOf('function')
    expect(lib.uploadSettlementRuntime.scheduler.now).toBeTypeOf('function')
    expect(lib.uploadSettlementRuntime.visibility.isVisible).toBeTypeOf('function')
    expect(Object.keys(lib.UPLOAD_POLL_SCHEDULE)).toEqual(['dense', 'sparse'])
    expect(lib.UploadRowRole.MassEdit).toBe('massEdit')
  })

  // An application whose named DAM client cannot read the DAM configuration fills the store of that name itself.
  it('include the DAM configuration store of a configuration name', () => {
    setActivePinia(createPinia())
    expect(lib.useDamConfigStoreOf()).toBe(lib.useDamConfigStore())
    expect(lib.useDamConfigStoreOf('default')).toBe(lib.useDamConfigStore())
    expect(lib.useDamConfigStoreOf('named')).not.toBe(lib.useDamConfigStore())
  })
})

describe('the core of a DAM upload', () => {
  it('has its requests exported without "image" in their names', () => {
    expect(lib.damFileUploadStart).toBe(imageUploadStart)
    expect(lib.damFileUploadChunk).toBe(imageUploadChunk)
    expect(lib.damFileUploadFinish).toBe(imageUploadFinish)
  })

  it('has the upload service, its set for admin-dam and the text of a validation answer exported', () => {
    expect(lib.useDamUpload).toBe(useUpload)
    expect(lib.adminDamUploadPreset).toBe(adminDamUploadPreset)
    expect(lib.uploadValidationMessage).toBe(uploadValidationMessage)
    expect(lib.uploadStop).toBe(uploadStop)
  })

  it('has the queue core, its set for admin-dam, the run of an import and the mass operations exported', () => {
    expect(lib.createUploadQueueCore).toBe(createUploadQueueCore)
    expect(lib.UPLOAD_QUEUE_ITEM_CHUNK_SIZE).toBe(10485760)
    expect(lib.adminDamQueuePreset).toBe(adminDamQueuePreset)
    expect(lib.adminDamImportRun).toBe(adminDamImportRun)
    expect(lib.uploadQueueFillCustomDataValue).toBe(fillCustomDataValue)
    expect(lib.uploadQueueFillKeywords).toBe(fillKeywords)
    expect(lib.uploadQueueFillAuthors).toBe(fillAuthors)
  })

  it('keeps the sets of the library and the marks of a set inside it', () => {
    const exports = lib as Record<string, unknown>
    expect(
      [
        'libraryUploadPreset',
        'libraryQueuePreset',
        'uploadSide',
        'uploadPresetMembers',
        'uploadQueuePresetMembers',
      ].filter((name) => name in exports)
    ).toEqual([])
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

// For a reader of the upload queue (`readers.failureReported` of a settlement profile): whether `report` hands an
// error to the logger.
describe('apiErrorIsReported', () => {
  it('is true of a failure the logger is handed, and false of a 401, a 403, a timeout, anything unmapped, or anything while reporting is off', () => {
    expect(lib.apiErrorIsReported(new AnzuApiResponseCodeError(502))).toBe(true)
    expect(lib.apiErrorIsReported(new AnzuApiResponseCodeError(401))).toBe(false)
    expect(lib.apiErrorIsReported(new AnzuApiResponseCodeError(403))).toBe(false)
    expect(lib.apiErrorIsReported(new AnzuApiTimeoutError())).toBe(false)
    expect(lib.apiErrorIsReported(new Error('network'))).toBe(false)
    lib.setApiErrorLogger(null)
    try {
      expect(lib.apiErrorIsReported(new AnzuApiResponseCodeError(502))).toBe(false)
    } finally {
      lib.setApiErrorLogger(lib.defaultApiErrorLogger)
    }
  })
})

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

describe('the components of the DAM upload', () => {
  it.each([
    'ADamAssetImage',
    'ADamAssetImageMetaIcons',
    'ADamAssetFileFailReasonChip',
    'ADamAssetCustomMetadataForm',
    'ADamUploadQueueStopButton',
    'ADamKeywordRemoteAutocompleteWithCached',
    'ADamAuthorRemoteAutocompleteWithCached',
    'ADamAuthorCachedChip',
    'ADamAuthorCreateButton',
    'ADamUploadQueueItem',
    'ADamUploadQueueList',
    'ADamUploadQueueMassOperations',
  ])('%s is a component of the public entry', (name) => {
    expect((lib as Record<string, unknown>)[name]).toBeTypeOf('object')
  })

  it.each([
    'useDamAssetFileFailReason',
    'useDamCachedAuthors',
    'useDamCachedKeywords',
    'useExtSystemIdForCached',
    'useDamKeywordAssetTypeConfig',
    'useDamAuthorAssetTypeConfig',
    'useFormatAndSizeCheck',
  ])('%s is a function of the public entry', (name) => {
    expect((lib as Record<string, unknown>)[name]).toBeTypeOf('function')
  })

  it('include the key an application provides the suggestions of its queues under', () => {
    expect(lib.UploadQueueSuggestionsKey).toBe(Symbol.for('anzu:UploadQueueSuggestions'))
  })
})

// admin-dam fills this store from its own panel beside `ADamAssetImageRoiSelect`.
// The store id must stay the same.
describe('the store of the region of interest', () => {
  it('is the very store ADamAssetImageRoiSelect reads, exported as useDamImageRoiStore', () => {
    expect(lib.useDamImageRoiStore).toBe(useImageRoiStore)
    expect(lib.useDamImageRoiStore.$id).toBe('commonAdminDamImageRoiStore')
  })
})
