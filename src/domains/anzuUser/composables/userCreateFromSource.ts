import { computed, ref, shallowRef, toValue, type MaybeRefOrGetter } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAlerts } from '@/domains/system/composables/alerts'
import { useAnzuUserFactory } from '@/domains/anzuUser/factory/AnzuUserFactory'
import { BulkOutcome } from '@/domains/anzuUser/store/userCrossSystemStore'
import { useUserCrossSystemWrites } from '@/domains/anzuUser/composables/userCrossSystemWrites'
import { type AnyUserSystemDescriptor, descriptorMayWrite } from '@/domains/anzuUser/composables/userSystemDescriptor'
import type { AnzuUser, BaseUser } from '@/shared/types/AnzuUser'
import type { IntegerId } from '@/shared/types/common'
import { cloneDeep, isNull } from '@/shared/utils/common'

export interface UseUserCreateFromSourceOptions {
  userId: MaybeRefOrGetter<IntegerId>
  /**
   * The systems a new account copies from, in order of preference. The first one holding the person is the source.
   * The other-systems page puts the system the operator came from first. A page whose own system has no
   * account for the person passes the admin's other systems.
   */
  sources: MaybeRefOrGetter<AnyUserSystemDescriptor[]>
}

interface FoundSource {
  descriptor: AnyUserSystemDescriptor
  user: AnzuUser
}

/** Creates this person's account in another system, copying the source system's record. */
export const useUserCreateFromSource = (options: UseUserCreateFromSourceOptions) => {
  const { t } = useI18n()
  const writes = useUserCrossSystemWrites()
  const { createAnzuUser } = useAnzuUserFactory()
  const { showError, showRecordWas } = useAlerts()

  /**
   * The source record as the server holds it, not as a form does.
   * Read again before each POST. An unsaved switch in a form must not be copied,
   * because in blog and forum it would mean a working public account.
   */
  const source = ref<AnzuUser | null>(null)
  const sourceDescriptor = shallowRef<AnyUserSystemDescriptor | null>(null)
  const creatingSystem = ref<string | null>(null)

  /** Copying a person into another system copies whether they are switched on. Roles stay empty. */
  const createEnabled = computed(() => source.value?.enabled === true)

  const labelOf = (descriptor: AnyUserSystemDescriptor) => descriptor.label ?? descriptor.system

  const findSource = async (): Promise<FoundSource | null> => {
    const id = toValue(options.userId)
    for (const descriptor of toValue(options.sources)) {
      if (!descriptor.isEnabled()) continue
      const user = await writes.readSourceUser(descriptor, id)
      if (!isNull(user)) return { descriptor, user }
    }
    return null
  }

  let generation = 0

  const loadSource = async () => {
    const token = ++generation
    const found = await findSource()
    if (token !== generation) return
    source.value = found?.user ?? null
    sourceDescriptor.value = found?.descriptor ?? null
  }

  const readAgain = async (): Promise<FoundSource | null> => {
    const known = sourceDescriptor.value
    if (isNull(known)) return findSource()
    const user = await writes.readSourceUser(known, toValue(options.userId))
    return isNull(user) ? null : { descriptor: known, user }
  }

  /** Resolves whether the account was created. Every failure is reported here. */
  const create = async (target: AnyUserSystemDescriptor, metadata: BaseUser): Promise<boolean> => {
    creatingSystem.value = target.system
    try {
      const found = await readAgain()
      if (isNull(found)) {
        const tried = isNull(sourceDescriptor.value)
          ? toValue(options.sources).filter((descriptor) => descriptor.isEnabled())
          : [sourceDescriptor.value]
        showError(t('common.userSystem.create.sourceUnreadable', { system: tried.map(labelOf).join(', ') }))
        return false
      }
      // The dialog already promised "created ready to use" or "created switched off" from the earlier read. If the
      // server now disagrees, the promise was wrong, and in blog and forum that means a working public account.
      // Usually the first read failed, leaving `source` null and the dialog saying "disabled"
      // for an enabled account. Nothing is written until the corrected row is confirmed again.
      if (found.user.enabled !== createEnabled.value) {
        source.value = found.user
        sourceDescriptor.value = found.descriptor
        showError(t('common.userSystem.create.sourceChanged'))
        return false
      }
      // The create right may have been lost while the source was read. Nothing is offered then, so nothing is reported.
      if (!descriptorMayWrite(target, 'create')) return false
      // Built by the library factory, never by hand. A body of base fields
      // alone makes the backend add `ROLE_USER`, a role nobody granted.
      // Metadata comes from the dialog, validated against the target's profile. The source may leave fields empty
      // (blog never fills `person`) that the target requires. The id and `enabled` come from the fresh read.
      const body = createAnzuUser(target.system)
      body.id = found.user.id
      body.email = metadata.email
      body.person = cloneDeep(metadata.person)
      body.avatar = cloneDeep(metadata.avatar)
      body.enabled = found.user.enabled
      const result = await writes.createInSystem(target, body)
      if (result.outcome !== BulkOutcome.Done) {
        // Without this message the failure looked like success: the
        // re-probed row still said "absent" with no explanation.
        showError(labelOf(target) + ': ' + t('common.userSystem.bulk.outcome.' + result.outcome))
        return false
      }
      showRecordWas('created')
      return true
    } finally {
      creatingSystem.value = null
    }
  }

  return {
    source,
    sourceDescriptor,
    createEnabled,
    creatingSystem,
    loadSource,
    create,
  }
}
