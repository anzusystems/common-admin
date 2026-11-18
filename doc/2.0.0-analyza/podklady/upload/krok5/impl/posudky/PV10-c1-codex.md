**PV10 review: No findings.** Both duplicate paths record `uploadedAssetId` when marking the row; the library path does so before replacing `assetId`. `??=` preserves the first value on a later duplicate settlement. The public field is optional and has type `DocIdNullable`.

No new user visible behavior was found in admin-cms, admin-ugc, or admin-dam. The field has no production reader, and the checked upload and bulk-save requests construct explicit payloads without it. I found no test assertion that cannot fail.

**Outside the patch: No findings.** This was a read-only review; I did not run tests.