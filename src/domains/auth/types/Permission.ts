import type { GrantType } from '@/domains/auth/valueObject/Grant'

export type AclValue = `${string}_${string}_${string}`

/**
 * Where an admin registers its ACL values, once:
 * `declare module '@anzusystems/common-admin' { interface AclRegistry { acl: AclValue } }`.
 * `<Acl :permission>` then accepts only those.
 */
// oxlint-disable-next-line typescript/no-empty-interface, typescript/no-empty-object-type -- filled in by the admins
export interface AclRegistry {}

/** The ACL values of a registry: its `acl` union, or any `system_subject_action` when there is none. */
export type AclValueOf<TRegistry> = TRegistry extends { acl: infer TAcl extends string } ? TAcl : AclValue

/** What `<Acl :permission>` accepts: the admin's registered ACL values. */
export type RegisteredAclValue = AclValueOf<AclRegistry>

/** An admin with typed ACL values passes their union; the default accepts any `system_subject_action`. */
export type Permissions<TAcl extends string = AclValue> = {
  [key in TAcl]?: GrantType
}
