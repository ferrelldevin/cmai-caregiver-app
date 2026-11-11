# Releasing, checking the live site, and undoing a bad deploy

Every merge to `main` that passes the checks is deployed to GitHub Pages. A release is a version number on top of that, so a backup or a report can name the exact code that made it.

## Cut a release

1. In one pull request, bump `version` in `package.json` and in `CITATION.cff` (same number).
2. In the same pull request, move the `Unreleased` entries in `CHANGELOG.md` under a heading with the new version and the date, for example `## [0.3.0] - 2026-11-20`, and start a new empty `Unreleased` section above it.
3. Merge it. The `Tag release` workflow sees `package.json` change on `main` and tags that commit `v<version>`. If the tag already exists it does nothing.
4. Check the About page ("How ratings are worked out") on a phone. It shows the version and the build, for example `Version 0.3.0 (build a1b2c3d)`. The build is the first 7 characters of the commit on `main`.

A scoring change also needs a new `RULE_VERSION` (see `docs/scoring-spec.md`). That is separate from the app version.

## What the deploy checks on its own

The last step of the deploy job fetches the live page and looks for `<meta name="build" content="<short commit>">`. It retries for about two minutes while Pages catches up. If the page never shows the commit that was just deployed, the job fails and says so.

A failed live check does not undo anything. It means the site is not what `main` says it is. Look at the Actions run, then decide whether to wait, re-run the deploy, or undo it.

## Undo a bad deploy

1. In GitHub, open the pull request that caused the problem and press **Revert**. That makes a new pull request that undoes it.
2. Merge the revert pull request. The deploy runs again with the old code, and the live check confirms it.
3. Phones update on their next open. The service worker fetches the new files and swaps them in.

A revert cannot undo a database change on a phone. If the pull request upgraded the database version, say so in the revert pull request: phones that already upgraded need an export, a cleared app and a restore (see the pull request that made the change).

## At lab adoption (not now)

Change the deploy job's condition to run only on a `v*` tag, so the site changes only on a release. Until then every green merge to `main` is live.
