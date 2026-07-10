// Notifications hub: outbound channels for BackIssue's notification events.
// Core records every event in the in-app bell and hands it to registered
// notifiers; this plugin fans each event out to the channels the admin has
// configured — Discord (rich embeds with cover art), Telegram, Pushover,
// ntfy, and a generic JSON webhook (compatible with the old core webhook:
// same config keys, so existing setups keep working untouched).
import Database from 'better-sqlite3';
import config from '../../src/config.js';

// Level → Discord embed color / Pushover priority / ntfy priority.
const COLORS = { info: 0x4c9be8, success: 0x5fd38a, warn: 0xffc24b, error: 0xff5a52 };
const NTFY_PRIO = { info: '3', success: '3', warn: '4', error: '5' };

// Per-channel category filter: empty/unset = all categories.
function allows(csv, category) {
  const list = String(csv || '').split(',').map((s) => s.trim()).filter(Boolean);
  return list.length === 0 || list.includes(category);
}

export default function register(api) {
  api.registerSettings({
    // Generic webhook — SAME keys the core webhook used, for seamless carry-over.
    notifyWebhookUrl:     { type: 'string', allowEmpty: true },
    notifyWebhookEvents:  { type: 'string', allowEmpty: true },
    // Discord webhook (rich embeds).
    notifyDiscordUrl:     { type: 'string', allowEmpty: true },
    notifyDiscordEvents:  { type: 'string', allowEmpty: true },
    // Telegram bot.
    notifyTelegramToken:  { type: 'string', allowEmpty: true },
    notifyTelegramChat:   { type: 'string', allowEmpty: true },
    notifyTelegramEvents: { type: 'string', allowEmpty: true },
    // Pushover.
    notifyPushoverToken:  { type: 'string', allowEmpty: true },
    notifyPushoverUser:   { type: 'string', allowEmpty: true },
    notifyPushoverEvents: { type: 'string', allowEmpty: true },
    // ntfy (full topic URL, e.g. https://ntfy.sh/my-topic).
    notifyNtfyUrl:        { type: 'string', allowEmpty: true },
    notifyNtfyEvents:     { type: 'string', allowEmpty: true },
  });

  // Read-only peek at the catalog for cover art on Discord embeds. Opened
  // lazily: the DB may not exist yet when the plugin registers.
  let cat = null;
  function coverFor(seriesId) {
    if (!seriesId) return null;
    try {
      cat ??= new Database(config.dbPath, { readonly: true });
      const r = cat.prepare(`
        SELECT COALESCE(cv.image_url, s.cover_url) cover FROM series s
        LEFT JOIN cv_series cv ON cv.comicvine_id = s.cv_id WHERE s.id = ?`).get(seriesId);
      return r?.cover || null;
    } catch { return null; }
  }

  // ---- channel senders (each throws on transport failure; callers catch) ----
  // cfg defaults to live config; the test route overlays the form's current
  // (possibly unsaved) values so "Send test" tests what the user is looking at.
  const senders = {
    async webhook(ev, fetchImpl, cfg = config) {
      const url = String(cfg.notifyWebhookUrl || '').trim();
      if (!url || !allows(cfg.notifyWebhookEvents, ev.category)) return false;
      const content = ev.body ? `${ev.title} — ${ev.body}` : String(ev.title || '');
      await fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content, source: 'backissue', type: ev.type, category: ev.category, level: ev.level, title: ev.title, body: ev.body, url: ev.url }),
      });
      return true;
    },

    async discord(ev, fetchImpl, cfg = config) {
      const url = String(cfg.notifyDiscordUrl || '').trim();
      if (!url || !allows(cfg.notifyDiscordEvents, ev.category)) return false;
      const cover = coverFor(ev.seriesId);
      const embed = {
        title: String(ev.title || '').slice(0, 256),
        description: ev.body ? String(ev.body).slice(0, 2048) : undefined,
        color: COLORS[ev.level] ?? COLORS.info,
        timestamp: new Date().toISOString(),
        footer: { text: `BackIssue · ${ev.category}` },
        ...(cover ? { thumbnail: { url: cover } } : {}),
      };
      const r = await fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
      });
      if (r && !r.ok) throw new Error(`Discord HTTP ${r.status}`);
      return true;
    },

    async telegram(ev, fetchImpl, cfg = config) {
      const token = String(cfg.notifyTelegramToken || '').trim();
      const chat = String(cfg.notifyTelegramChat || '').trim();
      if (!token || !chat || !allows(cfg.notifyTelegramEvents, ev.category)) return false;
      const text = ev.body ? `${ev.title}\n${ev.body}` : String(ev.title || '');
      const r = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chat, text }),
      });
      if (r && !r.ok) throw new Error(`Telegram HTTP ${r.status}`);
      return true;
    },

    async pushover(ev, fetchImpl, cfg = config) {
      const token = String(cfg.notifyPushoverToken || '').trim();
      const user = String(cfg.notifyPushoverUser || '').trim();
      if (!token || !user || !allows(cfg.notifyPushoverEvents, ev.category)) return false;
      const r = await fetchImpl('https://api.pushover.net/1/messages.json', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          token, user,
          title: String(ev.title || ''),
          message: String(ev.body || ev.title || ''),
          priority: ev.level === 'error' ? '1' : '0',
        }).toString(),
      });
      if (r && !r.ok) throw new Error(`Pushover HTTP ${r.status}`);
      return true;
    },

    async ntfy(ev, fetchImpl, cfg = config) {
      const url = String(cfg.notifyNtfyUrl || '').trim();
      if (!url || !allows(cfg.notifyNtfyEvents, ev.category)) return false;
      const r = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Title': String(ev.title || '').replace(/[^\x20-\x7e]/g, ' '), // header-safe ASCII
          'Priority': NTFY_PRIO[ev.level] || '3',
          'Tags': ev.level === 'error' ? 'rotating_light' : ev.level === 'warn' ? 'warning' : 'books',
        },
        body: String(ev.body || ev.title || ''),
      });
      if (r && !r.ok) throw new Error(`ntfy HTTP ${r.status}`);
      return true;
    },
  };

  // Every notification event fans out to every configured channel; one
  // channel's failure never blocks the others (each is caught and logged).
  api.registerNotifier?.(async (ev, { fetchImpl = fetch } = {}) => {
    await Promise.all(Object.entries(senders).map(([name, send]) =>
      Promise.resolve()
        .then(() => send(ev, fetchImpl))
        .catch((e) => console.warn(`[notifyhub] ${name} failed:`, e?.message || e))));
  });

  // POST /api/notifyhub/test { channel, ...notify* fields } — send a test
  // message through ONE channel using the form's current (unsaved) values,
  // ignoring category filters (a test should always send). Path ends in
  // /test → settings.manage, like the source test routes.
  api.registerRoute('post', '/api/notifyhub/test', async (req, res) => {
    const channel = String(req.body?.channel || '');
    const send = senders[channel];
    if (!send) return res.status(400).json({ error: `unknown channel '${channel}'` });
    const cfg = { ...config };
    for (const [k, v] of Object.entries(req.body || {})) {
      if (/^notify[A-Za-z]+$/.test(k) && typeof v === 'string') cfg[k] = v;
    }
    for (const k of Object.keys(cfg)) if (/^notify.*Events$/.test(k)) cfg[k] = ''; // '' = all categories
    const ev = {
      type: 'test', category: 'system', level: 'info',
      title: 'BackIssue test notification',
      body: `The ${channel} channel is working.`,
      url: null, userId: null, seriesId: null,
    };
    try {
      const sent = await send(ev, fetch, cfg);
      res.json(sent ? { ok: true } : { ok: false, error: 'Channel not configured — fill in its fields first.' });
    } catch (e) {
      res.json({ ok: false, error: String(e?.message || e) });
    }
  });

  api.registerClientAsset({ js: 'client/notifyhub.js', css: 'client/notifyhub.css' });
}
