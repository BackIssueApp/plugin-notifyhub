# Notifications Hub

Sends BackIssue's notification events — imports, download failures, new
releases, request activity — to the services you actually watch: **Discord**
(rich embeds with cover art), **Telegram**, **Pushover**, **ntfy**, or any
**webhook**. The in-app notification bell keeps recording everything
regardless; this plugin is the outbound side.

## Install

One click from **Sidebar → Plugins** in BackIssue, or drop this folder into
the app's `plugins/` directory and restart.

## Setup

Open **Settings → Notifications**. Each channel is a collapsible card:

- fill in its details (webhook URL, bot token + chat ID, app token + user
  key, or topic URL),
- pick which categories it fires for with the **Send for** chips
  (**All** = everything),
- hit **Send test** — the test uses what's in the form, so no need to save
  first.

A channel shows **Active** once its fields are filled; clear them to turn it
off. Each channel filters categories independently — a failures-only Discord
webhook next to an everything ntfy topic is fine.

The **generic webhook** channel POSTs plain JSON per event (Discord-compatible
`content` plus structured `type`/`category`/`level`/`title`/`body`/`url`
fields) and uses the same settings as the webhook that used to be built into
BackIssue, so an existing config carries over on install.

Full guide: <https://backissue.app/notifications>
