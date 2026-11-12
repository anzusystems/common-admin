bez nálezu.

[DistributionCancelDialog.vue:34](/home/volar/projects/anzusystems/admin-dam/src/domains/coreDam/asset/components/detail/components/distribution/DistributionCancelDialog.vue:34): Success for A closes a dialog still showing A, including one reopened for A; it leaves B open. The success alert and list reload still occur. The ordinary path is unchanged.

[DistributionCancelDialog.vue:42](/home/volar/projects/anzusystems/admin-dam/src/domains/coreDam/asset/components/detail/components/distribution/DistributionCancelDialog.vue:42): If A fails while B is open, the user sees A’s error as a global alert. B stays open and becomes usable when loading clears.

[distributionDialogs.test.ts:173](/home/volar/projects/anzusystems/admin-dam/src/test/distribution/distributionDialogs.test.ts:173): The new case would fail against the pre-cycle code, which closes B after A succeeds. Tests were not run.