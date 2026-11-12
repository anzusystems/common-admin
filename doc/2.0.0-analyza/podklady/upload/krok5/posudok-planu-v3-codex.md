**Version 3 is not ready to execute.** The main sequence is coherent, but rollback and recovery still need safeguards.

### Findings

- **BLOCKER — rollback can suggest moving existing source directories.** `navrat.sh` does not check whether `find "$S/src"` succeeded inside its process substitution. If the snapshot directory is missing or unreadable while `HOTOVO` remains, `comm` treats every current entry as new and prints `mv` commands for top-level `src` entries. Validate both `find` results before generating commands. [Plan:244](/home/volar/projects/anzusystems/common-admin/doc/2.0.0-analyza/podklady/upload/krok5/plan-implementacie.md:244); [appendix:1218](/home/volar/projects/anzusystems/common-admin/doc/2.0.0-analyza/podklady/upload/krok5/plan-implementacie.md:1218).

- **GAP — a failed copy has no defined restoration path.** N-C rolls back LIB and reruns `kopia.sh`; the saved installed package is explicitly only a record. If `copy.sh` fails after removing DAM’s installed `dist`, rerunning it may fail for the same reason and leave DAM unusable. This remains open from the earlier installed-package rollback finding. [Plan:253](/home/volar/projects/anzusystems/common-admin/doc/2.0.0-analyza/podklady/upload/krok5/plan-implementacie.md:253); [copy.sh:95](/home/volar/projects/anzusystems/common-admin/copy.sh:95).

- **GAP — owner presence is required only at the start.** The stated rule is coding only with the owner; the plan requires presence “at the start of coding” but gives no stop rule if the owner leaves. [Plan:1037](/home/volar/projects/anzusystems/common-admin/doc/2.0.0-analyza/podklady/upload/krok5/plan-implementacie.md:1037); [owner instruction:227](/home/volar/projects/anzusystems/common-admin/doc/2.0.0-analyza/upload-postup.md:227).

- **GAP — targeted LIB browser runs bypass the memory gate.** CK scripts gate each command and S0 measures peaks, fixing most of the v2 memory finding. The agent command for targeted runs uses the lock but never calls `brana.sh`, despite browser runs being a stated memory risk. [Plan:791](/home/volar/projects/anzusystems/common-admin/doc/2.0.0-analyza/podklady/upload/krok5/plan-implementacie.md:791); [agent command:858](/home/volar/projects/anzusystems/common-admin/doc/2.0.0-analyza/podklady/upload/krok5/plan-implementacie.md:858).

- **GAP — “anytime” owner decisions need a copy deadline.** PV16 is offered anytime, but its LIB change is assigned to C3 and its DAM change follows a copy. A decision after C3 has no scheduled transfer or check. [Plan:640](/home/volar/projects/anzusystems/common-admin/doc/2.0.0-analyza/podklady/upload/krok5/plan-implementacie.md:640); [design:1521](/home/volar/projects/anzusystems/common-admin/doc/2.0.0-analyza/podklady/upload/krok5/navrh-jadro.md:1521).

- **MINOR — P0 unnecessarily requires U1 to be open.** The schedule says “U1 open,” while the dependency and procedure require only its completed snapshot. Early U1 completion should not prevent P0. [Plan:110](/home/volar/projects/anzusystems/common-admin/doc/2.0.0-analyza/podklady/upload/krok5/plan-implementacie.md:110); [plan:151](/home/volar/projects/anzusystems/common-admin/doc/2.0.0-analyza/podklady/upload/krok5/plan-implementacie.md:151).

### Checks

1. **Both v2 reviews:** P0’s live-tree transfer, C0, open-step rollback, copy/step ordering, `prenos.sh` failure handling, patch errors, source pinning, lock behavior, design updates, K-04 timing, and S0 setup are addressed. Installed-package recovery remains open; memory protection is improved but incomplete as above.
2. **V3 consistency:** the principal C1 → P0 → K4 and C2 → U6 boundaries agree across the schedule and procedure. Findings above cover remaining rule and closure gaps.
3. **Appendix:** reviewed the scripts line by line, including exit handling, quoting, `LC_ALL=C`, `find`/`comm`, and `flock`. The appendix itself contains no `rm` or `cd`; `navrat.sh` prints conditional `mv` commands. `copy.sh` contains `cd` and removals, with owner approval scheduled before C1.
4. **Design dependencies and critical-path arithmetic:** no findings in the mandatory path; its listed durations total 54.75 hours. The optional PV16 deadline is the dependency gap above.

Read-only review of the plan, both v2 reviews, both designs, log, and `copy.sh`. No files changed; no tests, builds, repository scripts, network calls, or git writes ran.
