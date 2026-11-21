# 033. Safari refused the app's inline styles

2026-11-21 · Register: none (bug fix) · No storage change · No scoring change · No export change

## Problem

The WebKit job (Safari's engine) failed the theme, Today and Two weeks checks with "Refused to apply a stylesheet because its hash, its nonce, or 'unsafe-inline' does not appear in the style-src directive of the Content Security Policy" (run 44957314419). Chromium passes.

## Cause

The Content-Security-Policy in `vite.config.ts` says `style-src 'self'`. The app sets inline styles from code with React `style={{ ... }}`: bar heights on Today and Two weeks, the avatar size, the colour chips. Chromium lets styles set from code through. WebKit applies `style-src` to them too, so on an iPhone those sizes and colours can be dropped. The bundle holds no `<style>` element and no `style="..."` text, so the style props are the only source. The error and the screens that fail match them.

Not reproduced locally: the cloud container cannot download WebKit. The cause is from the CI log plus the source, and the CI WebKit job is the check.

## Fix

Add `style-src-attr 'unsafe-inline'` to the policy. It covers style attributes only. Style sheets and `<style>` elements stay limited to the app's own files (`style-src 'self'`), and scripts are untouched, so the protection against changed or injected code is the same.

Rejected: replacing every style prop with classes or CSS variables. Heights and colours come from the data, so it means many classes, a large change for no gain in protection.

## Check

WebKit job on the pull request: theme, Today and Two weeks no longer report the console error. Reverting is one line.
