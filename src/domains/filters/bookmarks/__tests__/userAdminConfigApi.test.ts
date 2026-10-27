import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosInstance } from 'axios'
import { useUserAdminConfigApi } from '@/domains/filters/bookmarks/api/userAdminConfigApi'
import { defaultApiErrorLogger, setApiErrorLogger } from '@/domains/api/utils/apiErrors'

// The endpoint answers a 204, and axios delivers it as `data: ''`. Read as a call that owes a body,
// every save of the manage dialog failed and was reported, though the server had stored it.

beforeEach(() => {
  setApiErrorLogger(null)
})

afterEach(() => {
  setApiErrorLogger(defaultApiErrorLogger)
})

describe('updating bookmark positions', () => {
  it('resolves on a no-content answer, and nothing is reported', async () => {
    const logged = vi.fn()
    setApiErrorLogger(logged)
    const request = vi.fn().mockResolvedValue({ status: 204, data: '' })
    const { updateUserAdminConfigPositions } = useUserAdminConfigApi(
      () => ({ request }) as unknown as AxiosInstance,
      'cms'
    )

    await expect(updateUserAdminConfigPositions([2, 3, 1])).resolves.toBeUndefined()

    expect(request.mock.calls[0][0]).toMatchObject({
      method: 'PATCH',
      url: '/adm/v1/user-admin-config/update-positions',
      data: JSON.stringify({ userAdminConfigs: [2, 3, 1] }),
    })
    expect(logged).not.toHaveBeenCalled()
  })
})
