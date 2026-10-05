import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/domains/auth/store/authStore'
import { defineAuth } from '@/domains/auth/composables/defineAuth'
import { Grant } from '@/domains/auth/valueObject/Grant'

// Route guards and templates may ask before a system's current user is there; `can()` throws in
// exactly that case, which breaks the navigation or the render. `canSafe` answers no instead.

const { can, canSafe, useCurrentUser } = defineAuth<`${string}_${string}_${string}`>('brick')

const userWith = (permissions: Record<string, number>) =>
  ({ id: 1, roles: [], resolvedPermissions: permissions }) as never

beforeEach(() => {
  useAuthStore().reset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('canSafe', () => {
  it('answers false for a system nothing has loaded, where can() throws', () => {
    expect(() => can('brick_menu_ui')).toThrow()
    expect(canSafe('brick_menu_ui')).toBe(false)
  })

  it('answers what can() answers once the system is loaded', () => {
    useCurrentUser('brick').setCurrentUser(userWith({ brick_menu_ui: Grant.Allow, brick_menu_edit: Grant.Deny }))

    expect(canSafe('brick_menu_ui')).toBe(true)
    expect(canSafe('brick_menu_edit')).toBe(false)
  })

  it('evaluates an array with AND, and an empty one as no check', () => {
    useCurrentUser('brick').setCurrentUser(userWith({ brick_menu_ui: Grant.Allow, brick_menu_edit: Grant.Deny }))

    expect(canSafe(['brick_menu_ui', 'brick_menu_edit'])).toBe(false)
    expect(canSafe(['brick_menu_ui'])).toBe(true)
    expect(canSafe([])).toBe(true)
  })

  it('denies when one of the systems in an array is not loaded', () => {
    useCurrentUser('brick').setCurrentUser(userWith({ brick_menu_ui: Grant.Allow }))

    expect(canSafe(['brick_menu_ui', 'weather_location_ui'])).toBe(false)
  })

  it('denies an allowOwner grant without a subject instead of throwing', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    useCurrentUser('brick').setCurrentUser(userWith({ brick_menu_delete: Grant.AllowOwner }))

    expect(() => can('brick_menu_delete')).toThrow()
    expect(canSafe('brick_menu_delete')).toBe(false)
  })
})
