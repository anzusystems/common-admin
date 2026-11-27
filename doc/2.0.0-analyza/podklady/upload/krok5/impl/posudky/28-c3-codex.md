The JSDoc, cited test lines, and real-timer rationale check out. I did not run tests.

Two documentation points remain:

- The “[processed]” notification does not itself settle the library row, but the warning appears only if the refresh returns `pending`; the later queued read does not guarantee an immediate `Uploaded` state. [Design note](/home/volar/projects/anzusystems/common-admin/doc/2.0.0-analyza/podklady/upload/krok5/navrh-komponenty.md:1467)
- DAM notifications in admin-cms are controlled by runtime configuration, so “enabled” is conditional. [admin-cms main.ts](/home/volar/projects/petit/admin-cms/src/main.ts:66)

Outside the change: bez nálezu.