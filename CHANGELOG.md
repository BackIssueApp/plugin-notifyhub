# Changelog

Notable, user-facing changes per release. Format follows [Keep a Changelog](https://keepachangelog.com);
versions follow the tags in this repository (`vX.Y.Z` → the release bundle BackIssue's plugin catalog installs).

Contributors: please **don't** edit this file in pull requests — entries are added
by the maintainers when changes merge, so concurrent PRs don't conflict here.

## [Unreleased]

### Added

- **Translated UI.** The channel cards under Settings → Notifications follow
  the language picked under Profile → Language on BackIssue builds newer
  than 0.9.0, English on older ones. Translations ship for French, German,
  Spanish, Italian, Portuguese and Dutch in `locales/`.

## [0.1.0] — 2026-07-09

Initial release: outbound notifications for BackIssue via the `registerNotifier` hook.

### Added
- **Discord** channel — rich embeds with level color, category, and the series'
  cover art when the event has one.
- **Telegram** channel — messages from your own bot to a chat or group.
- **Pushover** channel — push notifications; errors arrive high-priority.
- **ntfy** channel — pub-sub push (self-hosted or ntfy.sh) with level-mapped
  priority and tags.
- **Generic webhook** channel — plain JSON POST per event; keeps the payload and
  setting keys of BackIssue's old built-in webhook, so existing configs carry over.
- One collapsible settings card per channel with a live Active/Not set up status,
  per-category filter chips (All = everything), and a Send test button that uses
  the form's current values.
