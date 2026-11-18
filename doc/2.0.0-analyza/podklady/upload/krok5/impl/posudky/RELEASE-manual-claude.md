# Review: job `manual` in `.github/workflows/release-package.yml` (uncommitted change on `next`)

Reviewer: Claude (adversarial review), 2026-10-20. Read-only review; this file is the only file written.

Paths: `rt/…` = `/home/volar/projects/anzusystems/release-tools/…`, other paths are relative to the common-admin repository. Workflow line numbers refer to the working-tree file (89 lines).

Sources used
- The diff (`git diff` on `next` @ df811a87) and the whole workflow file.
- release-tools at 1ff2285. `git ls-remote` shows the release-tools `main` on GitHub is the same commit, so this is exactly the code that `anzusystems/release-tools/publish@main` and `github:anzusystems/release-tools#main` run today.
- GitHub, read-only (`gh api`, `git ls-remote`): `main` = 1c0e9073, `next` = df811a87. Release runs 1.49.0 (run 36555770398, job 109364432370) and 1.48.0 (run 36439196854, job 108984955228) with their job logs. CI run 39462596702 on df811a87. Environment `npmjs-publish`. npm dist-tags of the package, and the provenance attestation of 1.49.0.
- Docs: GitHub Actions ([workflows](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflows), [events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows), [trigger a workflow](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow), [workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)); npm ([trusted publishers](https://docs.npmjs.com/trusted-publishers), [scripts](https://docs.npmjs.com/cli/v11/using-npm/scripts)); https://nodejs.org/dist/index.json; actions/checkout v4 `src/input-helper.ts`; npm/cli `lib/commands/publish.js`.

## High

### H1. Way (1) does not work from `next` now: `main` has no `release.config.json`
- This is about the stated goal, not about the diff. The goal says both ways are "usable from `next` now". Way (1) is not.
- `git show origin/main:release.config.json` fails with "exists on disk, but not in 'origin/main'". `git ls-remote` confirms that GitHub `main` is 1c0e9073, the commit checked.
- The CLI builds every command's context from `origin/main` and stops there: `rt/lib/context.mjs:116-128` throws `release.config.json is not in main yet`. `release:start` and `release:publish` never reach the point of creating a tag.
- The action would refuse too, even for a tool tag pushed some other way: `invalid-tag: release.config.json is not in main` (`rt/publish/validate.mjs:74-75`). The publish job also reads its settings from `main` (`rt/publish/common.mjs:106-112`).
- The plan lists the bootstrap PR into `main` as a step that comes first (doc/2.0.0-RELEASE-FLOW.md:788-794).
- Fix, either:
  - (a) Say in README and RELEASING that way (1) starts only with the merge of `next` into `main`.
  - (b) Get `release.config.json` into `main` first with its own PR. From `main` the tool reads only `repo`, `package`, `publish`, `releaseWorkflow`, `requireTestedPrerelease`, `worktree.copy` and `npmEnvironment` (`rt/lib/config.mjs:114-126`). The build settings come from the tagged commit (`rt/publish/validate.mjs:80-82`). On a branch that is not `release/*` or `hotfix/*`, the CLI offers prereleases (`rt/lib/commands/publish.mjs:49-55`), and `next` contains the stub (`rt/lib/project.mjs:533-536`). I did not run the CLI to prove (b) end to end.

On the happy path, the job `manual` itself works (see "Checked and fine"). It has no High finding of its own.

## Medium

### M1. Releases the CLI creates do start `manual`, so the header comment (line 4) is wrong
- Line 4 says "Releases the tool creates use GITHUB_TOKEN, so they start no run."
- For the action this is true. It creates the Release with `GH_TOKEN: ${{ github.token }}` (`rt/publish/action.yml:128-129`, `rt/publish/publish.mjs:120-129`), and events caused by GITHUB_TOKEN create no workflow run (GitHub, trigger a workflow).
- For the CLI it is false. The CLI uses the token of the logged-in `gh` (`rt/lib/github.mjs:998-1005`, `rt/lib/context.mjs:99`), and it creates or publishes GitHub Releases itself in `ensureRelease` (`rt/lib/commands/final.mjs:718-755`: `publishDraft` at 732, `createRelease` at 747-754). It does this in four cases:
  - The action deferred the Release (`release-deferred`): the provenance could not be read within 180 s, there was none, or the Release is a draft (`rt/publish/publish.mjs:96-102`, `115-116`).
  - `release:publish` then offers the item "released but its GitHub Release is missing" or "… is a draft" (`rt/lib/commands/publish.mjs:155-168` → `233-244`). After a prerelease, the CLI itself tells you to run this (`296-301`).
  - After a final (`rt/lib/commands/final.mjs:658`).
  - In `release:cleanup` (`rt/lib/commands/cleanup.mjs:48`, `215`).
  - The integration test shows the CLI creating the Release of a prerelease (`rt/test/integration/action-init.test.mjs:41-47`).
- What follows is a `published` event from a user, so `manual` runs:
  - For a tool prerelease, both checks pass. The job installs and builds, then `npm publish` fails with E403 "You cannot publish over the previously published versions". The 1.48.0 run failed the same way (job log lines 531-532). Before the PUT is refused, npm has already signed a provenance statement and published it to the public transparency log (1.48.0 log, lines 529-530). Nothing is published twice, but the run goes red after a full build.
  - For a tool final, lines 62-64 refuse it with "a final is published with yarn release:publish". That message is misleading, because it was.
- Fix:
  - Skip the job for the tool's Releases. Their body always ends with the footer `<!-- release-tools`, written by both the action and the CLI (`rt/lib/release-body.mjs:4`, `12-19`; `rt/lib/commands/final.mjs:750`):
    ```yaml
    if: ${{ github.event_name == 'release' && !contains(github.event.release.body, '<!-- release-tools') }}
    ```
  - Also skip versions that are already on npm. Put this first in the first step, before the pre-release check, and add `if: steps.version.outputs.skip != 'true'` to the later steps:
    ```bash
    if npm view "@anzusystems/common-admin@$TAG" version >/dev/null 2>&1; then
      echo "::notice::$TAG is already on npm; nothing to publish."
      echo "skip=true" >> "$GITHUB_OUTPUT"
      exit 0
    fi
    ```
    With npm 11.12.1, `npm view` of a missing version exits 1 with E404, and of an existing version it prints the version (checked). This also covers a manual Release that is turned into a draft and published again.
  - Correct line 4.

### M2. The job that holds the npm OIDC permission also runs third-party code
- The whole job has `environment: npmjs-publish` and `id-token: write` (lines 53-54). The runner gives the OIDC token request variables to every step: that is how the plain `run: npm publish` step finds them.
- So they also reach:
  - `yarn install --immutable`, which runs the build scripts of dependencies. `.yarnrc.yml` has `enableScripts: true`, and the 1.49.0 log shows esbuild, vue-demi and @parcel/watcher being built (YN0007).
  - The vite build with its plugins.
  - The root `prepare` script (L4).
- A compromised dependency could request a token and use the trusted publisher of this file and environment to publish any version of `@anzusystems/common-admin`.
- The tool's two jobs in the same file are designed to prevent this:
  - `build` has no `id-token` (line 21) and installs with `--mode=skip-build` (`rt/lib/pm.mjs:44-54`, `rt/lib/config.mjs:140`).
  - `publish` has the environment and `id-token`, but no checkout of the project (`rt/publish/publish.mjs:13-16`; `rt/publish/action.yml:69-75` checks out only in build mode).
  - `manual` brings back the single-job design of the old workflow in `main`.
- Fix: split the job the way the tool does. This is a sketch; I did not run it:
  ```yaml
  manual-build:
    if: ${{ github.event_name == 'release' && !contains(github.event.release.body, '<!-- release-tools') }}
    runs-on: ubuntu-latest
    permissions: { contents: read, actions: read }
    env: { SKIP_PLAYWRIGHT_INSTALL: 'true' }
    outputs:
      version: ${{ steps.version.outputs.version }}     # empty when the version step skipped (M1)
      npm-tag: ${{ steps.version.outputs.npm-tag }}
    steps:
      - id: version          # lines 56-72, plus M1, M3, M4, L2, L3
        ...
      # every step below: if: steps.version.outputs.skip != 'true'
      - uses: actions/checkout@v4
        with: { persist-credentials: false }            # no ref: pinned to github.sha (L1)
      - run: corepack enable
      - uses: actions/setup-node@v4
        with: { node-version: '24', cache: 'yarn', cache-dependency-path: 'yarn.lock' }
      - run: yarn install --immutable
      - run: npm pkg set version="$VERSION"
        env: { VERSION: '${{ steps.version.outputs.version }}' }
      - run: yarn lib:build
      - run: yarn pack --out "$RUNNER_TEMP/package.tgz"
      - uses: actions/upload-artifact@v4
        with: { name: manual-package, path: '${{ runner.temp }}/package.tgz', if-no-files-found: error, overwrite: true }
  manual-publish:
    needs: manual-build
    if: needs.manual-build.outputs.version != ''
    runs-on: ubuntu-latest
    environment: npmjs-publish
    permissions: { id-token: write }
    steps:
      - uses: actions/setup-node@v4
        with: { node-version: '24' }
      - uses: actions/download-artifact@v4
        with: { name: manual-package, path: '${{ runner.temp }}/pkg' }
      - run: npm publish "$RUNNER_TEMP/pkg/package.tgz" --access public --tag "$NPM_TAG"
        env: { NPM_TAG: '${{ needs.manual-build.outputs.npm-tag }}' }
  ```
- Why this shape:
  - `npm publish <tarball>` runs no lifecycle scripts. npm/cli `lib/commands/publish.js` runs them only when `spec.type === 'directory'`. That also fixes L4.
  - `yarn pack --out` is how the tool packs (`rt/lib/pm.mjs:68-72`, `rt/publish/build.mjs:64-72`). The order version → build → pack is also the tool's (`rt/publish/build.mjs:53-72`). This matters for L6.
  - `overwrite: true`, as the tool has it (`rt/publish/action.yml:115`), lets "Re-run failed jobs" upload again.

### M3. No test gate: a manual rc ships what the tool would refuse, and `next` is red right now
- The job runs only `lint:tsc` and `build` (`package.json:53`). Before it builds, the tool runs `ci.checks`, which are `yarn ci` and `yarn test:run` (`release.config.json:17-19`, `rt/publish/build.mjs:52`), and it stops with `checks-failed` if they fail.
- On `next`'s head df811a87, CI run 39462596702 has a failed Test job ("Run tests"); Lint and Build passed. A pre-release published from `next` today would build fine and reach npm with failing tests.
- With `requireTestedPrerelease: true` (`release.config.json:37`), such an rc can also become the "tested" candidate of the final (L6).
- Fix, one of:
  - Refuse unless CI passed on the commit. In the build job, with `actions: read` and `GH_TOKEN: ${{ github.token }}`:
    ```bash
    ci=$(gh run list -R "$GITHUB_REPOSITORY" --workflow ci.yml --commit "$GITHUB_SHA" --event push --json conclusion -q '.[0].conclusion')
    [ "$ci" = success ] || { echo "::error::CI of $GITHUB_SHA is '${ci:-not found}'; publish a commit whose CI passed."; exit 1; }
    ```
    For df811a87 this query prints `failure` (checked).
  - Run `yarn ci` and `yarn test:run` the way the tool does. This needs the Playwright browser.
  - At least write in the header and in RELEASING that only a commit with green CI is released by hand.

### M4. The npm tag is always `rc`, `beta` or `alpha`, unlike the tool
- Lines 70-72 take the npm tag from the prerelease name alone.
- The tool never moves an npm tag back to a lower version, and it puts a prerelease of an older line under `<id>-X.Y` (`rt/lib/versions.mjs:119-130`). RELEASING.md:99-105 and doc/2.0.0-RELEASE-FLOW.md:103-104 promise the same.
- With this job, two things can happen:
  - A `1.49.1-rc.1` published by hand after `2.0.0-rc.2` moves `rc` back to the 1.x line.
  - A lower rc published by hand, such as `2.0.0-rc.2` while `rc` points to `2.0.0-rc.3`, moves `rc` back.
  - In both cases `@rc` then resolves to the older version. Correcting an npm tag needs a token; it cannot be done through trusted publishing (rt/docs/guide.md:228; doc/2.0.0-RELEASE-FLOW.md:35).
- Fix: before anything is built, refuse what the tool would put under another tag. `sort -V` orders versions of one prerelease id correctly, and only such versions sit on that id's npm tag (checked with rc.9 < rc.10 and 1.49.1-rc.1 < 2.0.0-rc.9):
  ```bash
  cur=$(npm view @anzusystems/common-admin "dist-tags.$id" 2>/dev/null || true)
  if [ -n "$cur" ] && [ "$(printf '%s\n%s\n' "$cur" "$TAG" | sort -V | tail -n 1)" != "$TAG" ]; then
    echo "::error::The npm tag $id points to $cur, which is not lower than $TAG; publish it with yarn release:publish."
    exit 1
  fi
  ```
  Also refuse a version from a line older than the latest released stable line (the tool's `isOlderLine`, `rt/lib/versions.mjs:102-109`), or publish it under `<id>-X.Y` as the tool does.

### M5. "On the branch to publish" holds only for commits that contain this file; elsewhere the old workflow publishes the version in `package.json`
- GitHub runs the workflow file of the release's tagged commit. The workflows doc: "Each workflow run will use the version of the workflow that is present in the associated commit SHA or Git ref of the event." For `release`, `GITHUB_SHA` is "Last commit in the tagged release" (events doc).
- In this clone, only `origin/next` and `origin/feat/list-editors` contain the stub commit 842ab0a5. `origin/main`, `origin/beta` and 40 other remote-tracking branches still have the old file (`git branch -r --no-contains 842ab0a5`; the list may include stale refs).
- On those branches, a GitHub Release starts the old job (`on: release: types: [created]`, `git show origin/main:.github/workflows/release-package.yml`). That job publishes whatever version `package.json` holds, regardless of the tag: under `beta` for a pre-release and under the default `latest` otherwise.
- This has already happened. The Release `1.48.0` (run 36439196854) ran `npm publish` of `1.47.0-beta.dev-1784059879-fix1` (log line 227). It failed only because that version already existed (lines 531-532).
- The old file also still publishes on a push to `beta` that changes the version to a beta.
- Today, a manual pre-release that targets `main` would start the old job; it would fail with E403 on 1.49.0. After the merge, `main` is fine. Maintenance branches of 1.x cut from the old `main` keep the old job, and the tool refuses a hotfix from 1.49.0 because that tag has no stub (`rt/lib/commands/start.mjs:166`).
- Fix:
  - Header lines 2-3 and RELEASING: say "a commit that contains this workflow: `next` now, `main` after the merge".
  - Before any GitHub Release on an old branch, bring this file into that branch, or remove the old one there.
  - Consider removing the old triggers from `main` now with a small PR (RELEASING.md:19 allows `.github/` changes into `main`).

## Low

### L1. The checkout is not pinned to the event's commit
- Lines 73-75 pass `ref: ${{ github.ref }}`. actions/checkout v4 pins `commit = github.sha` only when `ref` is empty (`src/input-helper.ts`). With an explicit tag ref, it fetches whatever the tag points to when the job starts.
- With `queue: max`, the job can wait behind a long tool run. If someone moves the tag meanwhile, the job builds the new commit, while npm provenance names `github.sha`. For 1.49.0 the attestation's `gitCommit` is 1c0e9073, which is also its `gitHead`.
- Fix: drop `with: ref:`, so the default checks out `github.sha`, and add `persist-credentials: false`. The tool does both (`rt/publish/action.yml:69-75`).

### L2. The tag regex accepts versions that npm refuses
- Line 66 uses `[0-9]+`, which accepts leading zeros such as `2.0.0-rc.01` or `02.0.0-rc.1`. These are not valid semver, so they fail only at `npm publish`, after the install and the build. The tool's format forbids them (`rt/lib/tags.mjs:7-9`).
- Fix: `^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)-(alpha|beta|rc)\.(0|[1-9][0-9]*)$`

### L3. No check against versions already released
- The job will publish a prerelease of a version that is already released as a final, for example `1.49.0-rc.1`. The tool refuses this (`rt/publish/validate.mjs:162-164`, `rt/lib/commands/publish.mjs:268-270`).
- Fix: refuse when `npm view "@anzusystems/common-admin@${TAG%%-*}" version` succeeds.

### L4. `npm publish` runs `prepare`, which installs Chromium and system packages
- `npm publish` of a folder runs `prepublishOnly, prepack, prepare, postpack, publish, postpublish` (npm docs, scripts). `prepare` (`package.json:45`) runs `playwright install chromium --with-deps` unless `SKIP_PLAYWRIGHT_INSTALL=true`, and lines 83-84 set that variable only for the install step.
- The old job behaved the same way. In the 1.49.0 log: `> prepare` at 232-233, apt-get as root at 234-448, Chromium, FFmpeg and headless-shell downloads at 449-487, then the publish at 488-537.
- It works, but it puts root package installs and CDN downloads into the step that publishes, and an outage there fails the release after the build.
- Fix: set `SKIP_PLAYWRIGHT_INSTALL: 'true'` on the job, or use `npm publish --ignore-scripts`. Publishing the tarball as in M2 removes the problem entirely.

### L5. The docs say the opposite
- `README.md:54`: "Releases are made with release-tools … never by hand".
- `doc/RELEASING.md:15`: "Every release starts with a pushed version tag and is checked, built and published by GitHub Actions…".
- The header also has line 4 (M1) and "on the branch to publish" (M5).
- `release:init` would now see the workflow as changed and ask whether to replace it (`rt/lib/commands/init.mjs:85-104`, stub in `rt/lib/templates.mjs:31-68`). Answering yes drops `manual`. Worth a sentence next to the job.
- Fix: describe the manual path in README and RELEASING: pre-release only, the tag is the full version, CI green, and a commit that contains this file.

### L6. A manual rc can become the tested candidate of the tool's final
- With `requireTestedPrerelease: true`, the candidate is the highest prerelease released on npm, manual ones included (`rt/lib/versions.mjs:88-95`, `rt/lib/commands/final.mjs:141-145`). The final's package must equal the candidate's (`rt/publish/build.mjs:89-98`).
- `manual` packs by publishing the folder with npm; the tool packs with `yarn pack` (`rt/lib/pm.mjs:68-72`). The comparison ignores `version`, the package's dependency on itself and `CHANGELOG.md` (`rt/lib/package-check.mjs:75-120`), so the two probably compare equal. I did not verify that.
- Together with M3, the "tested" rc may be one whose tests failed. The final still runs the checks itself.
- Fix: pack with `yarn pack --out` as in M2, and gate on CI (M3).

## Answers to the four questions

1. Which workflow file runs, and which events fire
   - A Release whose tag points to a commit on `next` runs the file at that commit, not `main`'s (workflows doc and events doc, quoted in M5). The `release` section has no note that the file must be on the default branch.
   - So the change must be committed and pushed to `next` before the first manual release. A Release on df811a87 would run the committed file, which has no `release` trigger.
   - `published` fires both for a pre-release published directly and for one published from a draft. `prereleased` would miss the draft case (events doc: "The `prereleased` type will not trigger for pre-releases published from draft releases, but the `published` type will trigger").
   - Releases made by the action start no run, because they use GITHUB_TOKEN. Releases made by the CLI do start one (M1). Neither publishes twice.
   - The tag push of a manual Release, if GitHub starts a run for it, ends in success with nothing published:
     - In `build`, validate reads the tag. A lightweight tag gives `annotated: false` (`rt/lib/github.mjs:408-409`), so `toolTag` returns null (`rt/lib/tags.mjs:143-149`).
     - The action reports `nothing: 2.0.0-rc.1 is not a tag of release-tools …` (`rt/publish/common.mjs:118-122`) as a notice, sets `release=false` and exits 0 (`rt/publish/main.mjs:78-82`).
     - `publish` and `manual` are skipped, and the run succeeds.
     - Integration test: `rt/test/integration/action-init.test.mjs:54-66`.

2. Nothing in release-tools breaks
   - The new `if` on `build` behaves as before for `push`: a tag deletion still skips `build` and is recognized as `ref-deletion` (`rt/lib/project.mjs:215`). In `release` runs, `build` and `publish` are skipped.
   - The tool asks the API only for `event=push` runs (`rt/lib/github.mjs:895-917`). So it never sees, waits for, cancels or deletes a `release` run: `waitForRunsOf`, `stopRuns` and `deleteFinishedRuns` all go through `gh.tagRuns` (`rt/lib/project.mjs:273-346`).
   - In push runs:
     - `outcome()` picks the jobs by the names `build` and `publish` (`rt/lib/project.mjs:212-219`).
     - `results()` goes through all jobs but counts only `publish` and the `release-tools` annotations (`245-250`).
     - A skipped `manual` adds nothing and does not change the run's conclusion.
   - `hasStub` still matches (`rt/lib/project.mjs:533-536`).
   - `queue: max` is documented: up to 100 pending runs, none cancelled while there is room, and it cannot be combined with `cancel-in-progress: true`, which is not used here. The tool's e2e checked four queued runs (`rt/test/e2e/flows.test.mjs:188-194`).
   - A manual run can delay a tool run. The tool's age rule uses the run's creation time (`rt/publish/validate.mjs:88-97`), so time spent in the queue does not matter.
   - Manual versions on npm count as released:
     - The next tool prerelease number skips them (`rt/lib/versions.mjs:74-81`, `rt/lib/commands/publish.mjs:291-292`).
     - Lightweight tags are never "unfinished" or cleanup items (`rt/lib/commands/publish.mjs:160-163`, `rt/lib/commands/cleanup.mjs:108-109`).
     - Runs of manual tags report `nothing`, so they never count as a trace of the tool (`rt/lib/project.mjs:261-265`).

3. The job `manual`
   - Trusted publishing:
     - Same file name and environment as the old job. 1.49.0 was published through OIDC from `.github/workflows/release-package.yml` on a `release` event, with provenance. The attestation shows `workflow.path`, `ref: refs/tags/1.49.0` and `event_name: release`, and the job log shows the OIDC publish and the signed provenance at lines 532-537. I cannot read the npm side itself (it needs an npm login); this run is the evidence that it matches.
     - npm needs CLI 11.5.1+ and Node 22.14.0+ (npm docs). Node 24 bundles npm 11.5.1 or newer from 24.5.0 on (nodejs.org index). The runner used 24.21.0 with npm 11.19.0 (1.49.0 log, lines 143-147).
     - Provenance is automatic for a public repository and package (npm docs; log line 534).
     - `npmjs-publish` has no protection rules and no branch policy (`gh api repos/anzusystems/common-admin/environments/npmjs-publish`), so tags are not blocked. That also means any write-access user can publish any commit on a branch that contains this file. That is inherent to this setup and the same for the tool's jobs.
     - npm 11 requires `--tag` for a prerelease, and the job passes one.
   - `npm pkg set version` in a Yarn 4 project is fine:
     - The tool does the same before its build (`rt/publish/build.mjs:53-55`).
     - `corepack enable` does not shim npm.
     - The workspace is `0.0.0-use.local` in `yarn.lock:8-10`, so the lockfile does not change.
   - `yarn lib:build` is the tool's own build command (`release.config.json:8`), and the Lint and Build jobs of CI pass on df811a87. The missing tests are M3.
   - Checking out `github.ref` works, but it is not pinned (L1).
   - The npm tag taken from the name is right for the newest line; see M4 for the rest.
   - A final or a malformed tag is refused before the checkout (lines 62-69). There is no injection: the tag comes in through `env`, and the outputs are validated (gaps: L2, L3).
   - The version published is exactly the tag. Ways to get the wrong content: L1, M2, M3, and M5 for commits without this file.

4. After `next` is merged into `main`
   - Way (1) works from `main`: the config and the stub are then in `main`, and nothing in release-tools needs to change.
   - Way (2) works from `main` and from any branch cut after the merge.
   - Still to change: the skip for the tool's Releases (M1), otherwise every Release the CLI adds produces a red run; the docs (L5); and the old branches (M5). The npm trusted publisher stays as it is, since the file name and environment are unchanged.

## Checked and fine
- Triggers (lines 6-10). The tool's prerelease tags `X.Y.Z-rc.N` already use the `push` filter (lines 7-8), so manual tags of the same format match it too.
- The checks before the checkout (lines 56-72):
  - `prerelease` arrives as `true` or `false`.
  - `${TAG#*-}` followed by `${name%%.*}` gives `rc`, `beta` or `alpha`.
  - The tag reaches the shell only through `env`.
  - `npm-tag` is a valid output name, written with a hyphen as in the tool's outputs.
- `concurrency` (lines 11-14) is shared with the tool's runs and cancels nothing (`cancel-in-progress: false`).
- No other workflow reacts. `ci.yml` filters `push` by `branches` only, so a tag push does not start it. The skipped `publish` in a `release` run is the normal result of a skipped `needs` job.
- `npm publish` from the folder packs `files`: `dist` is included even though `.gitignore` lists it, as the 1.49.0 tarball list shows (log lines 489-530). The manifest's `workspace:*` self-dependency was published the same way before.

## Not verified
- Whether GitHub starts a `push` run for a tag created by the Releases form. The docs do not say, and no run of this workflow shows it. The answer to question 1 covers both cases.
- The npm trusted-publisher entry itself. It needs an npm login; I inferred it from the 1.49.0 run.
- That a manual rc compares equal to a tool final (L6).
- The YAML in M2 and the CLI path in H1 (b). I did not run either.
