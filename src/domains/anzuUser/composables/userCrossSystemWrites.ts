import { useApiRequest } from '@/domains/api/composables/useApiRequest'
import { HTTP_STATUS_BAD_REQUEST, HTTP_STATUS_UNPROCESSABLE_ENTITY } from '@/shared/statusCodes'
import {
  type AnyUserSystemDescriptor,
  descriptorMayWrite,
  resolveCreateEndpoint,
  resolveEnabledWrite,
  resolveMetadataWrite,
} from '@/domains/anzuUser/composables/userSystemDescriptor'
import { BulkOutcome, type BulkOutcomeType } from '@/domains/anzuUser/store/userCrossSystemStore'
import { probeStatusFromError } from '@/domains/anzuUser/composables/userSystemProbe'
import {
  readMetadataField,
  USER_METADATA_FIELDS,
  writeMetadataField,
  type UserMetadataField,
} from '@/domains/anzuUser/utils/userMetadataDiff'
import type { AnzuUser, BaseUser } from '@/shared/types/AnzuUser'
import type { IntegerId } from '@/shared/types/common'
import { cloneDeep, isNull } from '@/shared/utils/common'

export interface WriteResult {
  outcome: BulkOutcomeType
  /**
   * The server's record after the write, when it returned one.
   */
  user?: AnzuUser
  /**
   * Fields whose stored value differed from both the target and what the search saw.
   * The write still goes through (decision 24: the operator's value wins). The log reports the concurrent edit.
   */
  concurrentFields?: UserMetadataField[]
  detail?: string
}

/**
 * 422 and 400 get their own outcome. A PUT validates the whole body.
 * Legacy data that no longer validates fails even a plain disable. That is not a bug.
 */
export const classifyWriteStatus = (status: number | null): BulkOutcomeType => {
  if (status === null) return BulkOutcome.Unavailable
  if (status === 403) return BulkOutcome.Forbidden
  if (status === 401) return BulkOutcome.Unauthenticated
  if (status === 404) return BulkOutcome.NotFound
  if (status === HTTP_STATUS_UNPROCESSABLE_ENTITY || status === HTTP_STATUS_BAD_REQUEST) return BulkOutcome.Invalid
  return BulkOutcome.Unavailable
}

const request = <R extends object, B>(
  descriptor: AnyUserSystemDescriptor,
  method: 'GET' | 'PUT' | 'PATCH' | 'POST',
  url: string
) =>
  useApiRequest<R, B>({
    client: descriptor.client,
    method,
    system: descriptor.system,
    entity: descriptor.entity,
    urlTemplate: url,
  })

export const useUserCrossSystemWrites = () => {
  /**
   * No PATCH exists for `enabled`. Only the full update calls `setEnabled`,
   * so this is a GET then PUT on the same path with the whole record.
   * The DTO defaults roles to `[ROLE_USER]`, `enabled` to true and permissions to empty. A
   * partial body resets roles, wipes grants, detaches groups and re-enables the account.
   * In cms `/adm/users` PUT runs `updateRelations()`, so an omitted `desks` removes the user from every desk.
   */
  const setEnabled = async (
    descriptor: AnyUserSystemDescriptor,
    id: IntegerId,
    enabled: boolean
  ): Promise<WriteResult> => {
    const { get, url } = resolveEnabledWrite(descriptor)
    try {
      const { execute: read } = request<AnzuUser, null>(descriptor, 'GET', get)
      const current = await read({ urlParams: { id } })
      if (current.enabled === enabled) {
        // Already in the target state. A no-op PUT would still run `updateRelations()` in cms.
        return { outcome: BulkOutcome.Done, user: current }
      }
      // The right may have been revoked during the read. Report it as the server would refuse it.
      if (!descriptorMayWrite(descriptor, 'update')) return { outcome: BulkOutcome.Forbidden }
      const body = cloneDeep(current)
      body.enabled = enabled
      const { execute: write } = request<AnzuUser, AnzuUser>(descriptor, 'PUT', url)
      const saved = await write({ urlParams: { id }, body })
      return { outcome: BulkOutcome.Done, user: saved }
    } catch (error) {
      return { outcome: classifyWriteStatus(probeStatusFromError(error)) }
    }
  }

  /**
   * Uses `PATCH /adm/users/{id}` where it exists. Its method
   * has no setters for roles, permissions, groups or `enabled`.
   * The body is still the whole record from the read. It must include `id`:
   * without it the uniqueness validator reports the user's own e-mail as taken.
   */
  const writeMetadata = async (
    descriptor: AnyUserSystemDescriptor,
    id: IntegerId,
    target: BaseUser,
    fields: readonly UserMetadataField[] = USER_METADATA_FIELDS,
    /**
     * What the search showed for this system, to detect a change made in between.
     */
    seen: BaseUser | null = null
  ): Promise<WriteResult & { changed: boolean }> => {
    const { method, get, url } = resolveMetadataWrite(descriptor)
    try {
      const { execute: read } = request<AnzuUser, null>(descriptor, 'GET', get)
      // Read again right before writing. Search results can be hours
      // old, and a system that already matches must not be written.
      const current = await read({ urlParams: { id } })

      const differs = fields.some((field) => readMetadataField(current, field) !== readMetadataField(target, field))
      if (!differs) return { outcome: BulkOutcome.Done, user: current, changed: false }

      // Differs from both the target and what the operator saw: someone else wrote in between.
      // The value is still written, and the log names the fields.
      const concurrentFields = isNull(seen)
        ? []
        : fields.filter(
            (field) =>
              readMetadataField(current, field) !== readMetadataField(seen, field) &&
              readMetadataField(current, field) !== readMetadataField(target, field)
          )

      // The right may have been revoked during the read. Report it as the server would refuse it.
      if (!descriptorMayWrite(descriptor, 'update')) return { outcome: BulkOutcome.Forbidden, changed: false }
      const body = cloneDeep(current)
      fields.forEach((field) => writeMetadataField(body, field, readMetadataField(target, field)))

      const { execute: write } = request<AnzuUser, AnzuUser>(descriptor, method, url)
      const saved = await write({ urlParams: { id }, body })
      return { outcome: BulkOutcome.Done, user: saved, changed: true, concurrentFields }
    } catch (error) {
      return { outcome: classifyWriteStatus(probeStatusFromError(error)), changed: false }
    }
  }

  /**
   * The body comes from the library factory (`roles: []`, `enabled: false`) with metadata copied over.
   * A hand-built body would let the backend default to `ROLE_USER`, a role nobody granted.
   */
  const createInSystem = async (descriptor: AnyUserSystemDescriptor, body: AnzuUser): Promise<WriteResult> => {
    try {
      const { execute } = request<AnzuUser, AnzuUser>(descriptor, 'POST', resolveCreateEndpoint(descriptor))
      const created = await execute({ body })
      return { outcome: BulkOutcome.Done, user: created }
    } catch (error) {
      return { outcome: classifyWriteStatus(probeStatusFromError(error)) }
    }
  }

  /**
   * Reads the source account fresh from the server, not from a store or form.
   */
  const readSourceUser = async (descriptor: AnyUserSystemDescriptor, id: IntegerId): Promise<AnzuUser | null> => {
    const { get } = resolveEnabledWrite(descriptor)
    try {
      const { execute } = request<AnzuUser, null>(descriptor, 'GET', get)
      return await execute({ urlParams: { id } })
    } catch {
      return null
    }
  }

  return {
    setEnabled,
    writeMetadata,
    createInSystem,
    readSourceUser,
  }
}
