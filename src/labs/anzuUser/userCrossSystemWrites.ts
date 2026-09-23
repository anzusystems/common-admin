import { useApiRequest } from '@/labs/api/useApiRequest'
import { HTTP_STATUS_BAD_REQUEST, HTTP_STATUS_UNPROCESSABLE_ENTITY } from '@/composables/statusCodes'
import {
  type AnyUserSystemDescriptor,
  resolveCreateEndpoint,
  resolveEnabledWrite,
  resolveMetadataWrite,
} from '@/labs/anzuUser/userSystemDescriptor'
import { BulkOutcome, type BulkOutcomeType } from '@/labs/anzuUser/userCrossSystemStore'
import { probeStatusFromError } from '@/labs/anzuUser/userSystemProbe'
import {
  readMetadataField,
  USER_METADATA_FIELDS,
  writeMetadataField,
  type UserMetadataField,
} from '@/labs/anzuUser/userMetadataDiff'
import type { AnzuUser, BaseUser } from '@/types/AnzuUser'
import type { IntegerId } from '@/types/common'
import { cloneDeep, isNull } from '@/utils/common'

export interface WriteResult {
  outcome: BulkOutcomeType
  /** What the server holds afterwards, when it answered with the record. */
  user?: AnzuUser
  /**
   * Fields whose stored value had moved away from both the target and what the search saw.
   *
   * The write still goes through -- decision 24 says the operator's value wins -- but somebody
   * edited the record in between, and the log line says so rather than letting it pass unnoticed.
   */
  concurrentFields?: UserMetadataField[]
  detail?: string
}

/**
 * What the operator is told about a failed write.
 *
 * 422 and 400 are their own line and not a generic failure: a PUT validates the whole body, and an
 * account carrying a colour or an e-mail that no longer passes validation will fail even on a plain
 * "disable". With legacy data that is an ordinary outcome, and "could not be saved" would send
 * somebody looking for a bug that is not there.
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
   * Switching an account on or off.
   *
   * There is no PATCH for this anywhere -- the only method that calls `setEnabled` is the full
   * update -- so it is a read followed by a write on the same path, with the whole record the read
   * returned. That is not caution, it is the contract: the DTO defaults roles to `[ROLE_USER]`,
   * `enabled` to true and both permission collections to empty, and the manager writes all four
   * unconditionally. A body of "just the enabled flag" resets the roles, wipes the grants, detaches
   * the groups and switches a disabled account back on.
   *
   * On `/adm/users` in cms it goes further still: that PUT runs `updateRelations()` over seven
   * scalars and twelve collections, so an omitted `desks` does not mean "unchanged", it means
   * "remove from every desk".
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
        // Already there. A no-op PUT would still run `updateRelations()` in cms -- risk for nothing.
        return { outcome: BulkOutcome.Done, user: current }
      }
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
   * Writing the shared metadata.
   *
   * Through `PATCH /adm/users/{id}` wherever that path exists, because the method behind it
   * physically cannot write roles, permissions, groups or `enabled` -- it has no setters for them.
   * That is a stronger guarantee than assembling a careful body, and it is why the plan sends
   * metadata this way rather than through the full update.
   *
   * The body is still the whole record the read returned. `id` in particular has to be in it: the
   * uniqueness validator only excludes the record itself when the DTO carries a non-empty id, and
   * without it the server reports the user's own e-mail as already taken -- on every account.
   */
  const writeMetadata = async (
    descriptor: AnyUserSystemDescriptor,
    id: IntegerId,
    target: BaseUser,
    fields: readonly UserMetadataField[] = USER_METADATA_FIELDS,
    /** What the search showed for this system, so a change made in between can be recognised. */
    seen: BaseUser | null = null
  ): Promise<WriteResult & { changed: boolean }> => {
    const { method, get, url } = resolveMetadataWrite(descriptor)
    try {
      const { execute: read } = request<AnzuUser, null>(descriptor, 'GET', get)
      // Read again immediately before writing, not reused from the search: those results can be
      // hours old, and a system whose value already matches must not be written to at all.
      const current = await read({ urlParams: { id } })

      const differs = fields.some((field) => readMetadataField(current, field) !== readMetadataField(target, field))
      if (!differs) return { outcome: BulkOutcome.Done, user: current, changed: false }

      // Different from what the operator chose *and* from what they were shown when they chose it:
      // somebody else wrote to this record in between. The value still goes in -- that is what was
      // asked for -- and the log names the fields.
      const concurrentFields = isNull(seen)
        ? []
        : fields.filter(
            (field) =>
              readMetadataField(current, field) !== readMetadataField(seen, field) &&
              readMetadataField(current, field) !== readMetadataField(target, field)
          )

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
   * Creating an account in another system.
   *
   * The body comes from the library factory -- `roles: []`, `enabled: false` -- with the metadata
   * copied over. Assembling it by hand from base fields is what would have the backend fill in
   * `ROLE_USER`, leaving an account with a role nobody granted.
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

  /** The source account, read fresh from the server rather than taken from a store or a form. */
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
