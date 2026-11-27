**U1 review**

1. **Low — test gap:** [damNameInputs.test.ts](/home/volar/projects/anzusystems/krok5-praca/wt/lib-u/src/domains/dam/__tests__/damNameInputs.test.ts:189) says Enter opens a new author *with the typed name*, but asserts only that the dialog opens. The test would still pass if the typed name were dropped.

No other U1 finding: the reviewed defaults preserve CMS and UGC behavior, and the changes match the listed ZK12 and OB3 decisions. I did not run tests.

**Outside U1:** The already tracked finding 44 remains in [AuthorRemoteAutocompleteWithCached.vue](/home/volar/projects/anzusystems/krok5-praca/wt/lib-u/src/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue:279): conflict chips are offered even when the author is already selected. The plan schedules that repair after U1.