**Patch: no findings.** The exact four-call assertions catch a missing or swapped field listener on a type panel; the panel-title assertions catch an always-true type-panel `v-if`. The fixed CMS fixture makes these checks deterministic.

Excluding General is justified for the type-panel requirement. It leaves one separate coverage gap: CMS queues containing only non-image types do not assert that General is absent.

Both cycle 3 test gaps and the documentation correction are addressed. **Outside the patch:** duplicate author conflict IDs and the add chip’s missing explicit accessible label remain. Tests were not run, as requested.