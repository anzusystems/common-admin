**Cycle 2 review:** Two low-severity gaps remain.

- The new [chip test](/home/volar/projects/anzusystems/krok5-praca/wt/lib-u/src/domains/dam/__tests__/damNameChipsUnresolved.test.ts:232) can pass with an empty or incorrect tooltip. It checks that a tooltip exists, but not the “record could not be loaded” message it claims to pin. N-U1-2 itself matches the current chip code and admin-dam comparison.
- [N-U1-1](/home/volar/projects/anzusystems/common-admin/doc/2.0.0-analyza/podklady/upload/krok5/impl/U1.md:161) needs a qualifier: an unloaded user is denied **when a creation ACL is configured**. With no ACL, `useAclAllowed(undefined)` permits creation. Its cited test checks a loaded user without the grant, not the unloaded case.

The Enter name assertion and the negative injection case can fail for their intended regressions. Raw ACL values preserve the CMS and UGC defaults and the autocomplete guards; the existing profile test matches the U1 snapshot. The built declaration contains the requested Vue exports.

**Outside U1:** Previously tracked finding 44 remains scheduled after U1; no new outside finding. Review was read-only; I ran no tests.