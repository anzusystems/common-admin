import { describe, expectTypeOf, it } from 'vitest'
import type { GlobalComponents } from 'vue'
import type Acl from '@/domains/auth/components/Acl.vue'
// The augmentation that declares `Acl` a global component (a type-only import pulls it in).
import type {} from '@/shared/types/globalComponents'
import type { AclValue, AclValueOf, RegisteredAclValue } from '@/domains/auth/types/Permission'

// `Acl` is registered globally by the plugin, so templates use it without an import. Before 2.0 the
// library did not declare it, every admin declared it by hand, and the ACL values it accepted came
// from an `AclValue` redeclaration that was a duplicate identifier (hidden by skipLibCheck).
describe('Acl typing', () => {
  it('is declared as a global component', () => {
    expectTypeOf<GlobalComponents['Acl']>().toEqualTypeOf<typeof Acl>()
  })

  it('takes the ACL values an admin registers', () => {
    expectTypeOf<AclValueOf<{ acl: 'cms_article_read' | 'cms_article_update' }>>().toEqualTypeOf<
      'cms_article_read' | 'cms_article_update'
    >()
  })

  it('takes any system_subject_action when nothing is registered', () => {
    expectTypeOf<AclValueOf<object>>().toEqualTypeOf<AclValue>()
    expectTypeOf<RegisteredAclValue>().toEqualTypeOf<AclValue>()
  })
})
