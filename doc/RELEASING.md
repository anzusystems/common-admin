# Releasing

How a new version of `@anzusystems/common-admin` gets to npm. Which number to raise is described in the [versioning rules in the README](../README.md#versioning).

Releases are made with [`anzusystems/release-tools`](https://github.com/anzusystems/release-tools). This page is a short summary; **all situations, checks and what happens in detail are in its [release guide](https://github.com/anzusystems/release-tools/blob/main/docs/guide.md)**.

## Commands

| Command | What it does |
|---|---|
| `yarn release:start` | asks what to release, creates the release branch in its own folder next to the repository and an empty changelog file |
| `yarn release:publish` | publishes a prerelease or a dev build (the branch stays), or the final version (removes the branch and the folder, unless they hold work that is not released) |
| `yarn release:cleanup` | deletes dev builds and tags that never became a release: all of them, or those older than a given number of days |

Every release starts with a pushed version tag and is checked, built and published by GitHub Actions from exactly the tagged commit, never on your machine. You need Node 22.14+, git 2.38+, `gh` logged in with the scopes `repo` and `workflow`, and a git e-mail that GitHub knows.

## Rules

- `main` holds the latest released version. **Don't merge into `main`**, and don't merge a release pull request yourself: `release:publish` merges it after the version is published (the tool never pushes to `main`). Changes outside the package (`.github/`, `doc/`) are the only exception.
- **Merge into the release branch** whatever belongs in the release. Commit messages do not matter.
- **Write the changelog yourself** in `doc/changelog/<version>.md`. The tool adds its line to `CHANGELOG.md`.
- **A final needs a tested rc.** A final version must have the same content as its highest published prerelease, usually the last rc (common-admin requires it). If anything that affects the package changed after the rc — in the branch or in `main` — publish a new rc; GitHub Actions refuses the final otherwise.
- **Never merge `main` into a hotfix branch.**
- **Something failed?** Run the same command again; it continues where it stopped or tells you exactly what to do.

## Examples

### New version

`main` is at 3.0.0, you want 3.1.0.

```
yarn release:start     → minor         opens ../common-admin-release-3.1.0
                                       merge what belongs in 3.1.0, write doc/changelog/3.1.0.md, push
yarn release:publish   → rc            3.1.0-rc.1 on npm under the npm tag rc; let the admins test it
yarn release:publish   → final         3.1.0 on npm as latest, merged into main; the branch and the folder are removed
                                       (they stay if they hold unreleased commits or uncommitted changes)
```

For the final, the command opens the release pull request and waits for its approval (it prints the link). Then it tags the approved commit; GitHub Actions runs the checks, compares the package with the rc and publishes. Only after that is the published commit merged into `main`. If the checks fail, nothing is published or merged; if a later step fails, running the command again finishes it without publishing twice.

### Prerelease: alpha, beta, rc

In the release folder:

```
yarn release:publish   → beta          3.1.0-beta.1 on npm under the npm tag beta
```

The branch stays open; publish as many as you need, then final. Prereleases are never deleted. If one fails, nothing reaches npm and the next attempt gets the next number. Install: `"@anzusystems/common-admin": "3.1.0-beta.1"`.

### Prerelease by hand

Without the tool: on GitHub, Releases → Draft a new release, choose the branch, type the full version as a new tag (`3.1.0-rc.1`, `3.1.0-beta.1`, `3.1.0-alpha.1`), tick "Set as a pre-release" and publish. GitHub Actions then:

- refuses a release that is not a pre-release, a tag in another format, and a version whose final is already released;
- does nothing if the version is already on npm;
- refuses the commit unless its CI passed (when CI is still running, re-run the failed job after it ends);
- builds and packs it as the tool does and publishes it under the npm tag the tool would choose (see the table below).

It works only on a commit that contains the current `.github/workflows/release-package.yml` (`next` and everything after its merge into `main`). On a branch that still has the old workflow, a GitHub Release starts the old job, which publishes the version in `package.json` whatever the tag says. Finals are made only with `release:publish`; a manual rc counts as its tested rc.

### Dev build

On any branch that comes from `main` since 2.0.0, to try something out in an admin:

```
yarn release:publish   → dev           3.0.0-dev.20260923143000 on GitHub only, not on npm
```

Instead of the time you can type a name (`3.0.0-dev.new-filter`). Install from the URL in its GitHub Release:

```json
"@anzusystems/common-admin": "https://github.com/anzusystems/common-admin/releases/download/3.0.0-dev.20260923143000/anzusystems-common-admin-3.0.0-dev.20260923143000.tgz"
```

### Hotfix of an older version

The latest is 3.0.0, admins on 2.30.1 need a fix.

```
yarn release:start     → hotfix 2.30.1 → 2.30.2      opens ../common-admin-hotfix-2.30.2
                                       put the fix in, write doc/changelog/2.30.2.md, push
yarn release:publish   → rc            2.30.2-rc.1 on npm under the npm tag rc-2.30; test it
yarn release:publish   → final         2.30.2 on npm under latest-2.30; latest stays at 3.0.0
```

The changelog then reaches `main` through the pull request `docs: changelog 2.30.2`; the branch and the folder are removed once it is merged (they stay if they hold commits made after the tag or uncommitted changes). Admins on 2.30 take the fix with `yarn up @anzusystems/common-admin@~2.30.2`.

### Change the version of an open release

3.1.0 has to become 4.0.0:

```
yarn release:start     → major         opens ../common-admin-release-4.0.0
                                       merge release/3.1.0 into it, move doc/changelog/3.1.0.md into 4.0.0.md
yarn release:start     → cancel release/3.1.0    (offers to retarget its open pull requests to release/4.0.0 or close them)
```

Then continue with `release/4.0.0`.

### Cleaning up

```
yarn release:cleanup   → older than 30 days
```

## Where versions end up

| Version | npm | GitHub Release |
|---|---|---|
| `3.1.0` | `latest` | Latest |
| `2.30.2`, older than the latest | `latest-2.30` | not Latest |
| `3.1.0-beta.1` (`alpha`, `rc`) | `beta` (`alpha`, `rc`) | Pre-release |
| `2.30.2-rc.1`, a prerelease of an older line | `rc-2.30` | Pre-release |
| `3.0.0-dev.…` | not on npm | Pre-release with the package, until `release:cleanup` |
