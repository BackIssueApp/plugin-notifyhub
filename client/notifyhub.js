// Notifications hub client UI — one collapsible card per channel, injected
// into Settings → Notifications (slot: settings-plugin-notifications). Cards
// reuse the Sources section's .src-block pattern, so core wires the
// open/close behavior and the filter box sees them for free. Fields use the
// id="set-<key>" convention (core loads/saves them generically); category
// filters are chip rows that write a CSV into a hidden set-* input.
(function () {
  window.BackIssue.registerClient((api) => {
    const slot = api.slot('settings-plugin-notifications');
    if (!slot || slot.querySelector('#set-notifyDiscordUrl')) return;
    document.getElementById('notify-hub-empty-note')?.remove(); // the "not installed" hint

    // Mirrors core's notification categories (src/notifications.js CATEGORIES).
    const CATS = [
      ['import', 'Imports'], ['failure', 'Failures'], ['release', 'Releases'],
      ['request', 'Requests'], ['system', 'System'],
    ];
    const CHANNELS = [
      {
        id: 'discord', name: 'Discord', events: 'notifyDiscordEvents',
        need: ['notifyDiscordUrl'],
        blurb: 'Rich embeds — level color, category, and cover art.',
        fields:
          '<label class="field"><span>Webhook URL</span><input id="set-notifyDiscordUrl" type="text" spellcheck="false" placeholder="https://discord.com/api/webhooks/…"></label>' +
          '<p class="modal__note">Server Settings → Integrations → Webhooks → New Webhook, then copy its URL. Events with a series attached include the cover as a thumbnail.</p>',
      },
      {
        id: 'telegram', name: 'Telegram', events: 'notifyTelegramEvents',
        need: ['notifyTelegramToken', 'notifyTelegramChat'],
        blurb: 'Messages from your own bot, to a chat or group.',
        fields:
          '<div class="fields-row">' +
            '<label class="field"><span>Bot token</span><input id="set-notifyTelegramToken" type="password" spellcheck="false" autocomplete="new-password" placeholder="123456:ABC-…"></label>' +
            '<label class="field"><span>Chat ID</span><input id="set-notifyTelegramChat" type="text" spellcheck="false" placeholder="-1001234567890"></label>' +
          '</div>' +
          '<p class="modal__note">Create a bot with <b>@BotFather</b> (it gives you the token); get your chat ID from <b>@userinfobot</b>, or a group\'s ID from its invite/info.</p>',
      },
      {
        id: 'pushover', name: 'Pushover', events: 'notifyPushoverEvents',
        need: ['notifyPushoverToken', 'notifyPushoverUser'],
        blurb: 'Push notifications to your phone or desktop.',
        fields:
          '<div class="fields-row">' +
            '<label class="field"><span>App token</span><input id="set-notifyPushoverToken" type="password" spellcheck="false" autocomplete="new-password"></label>' +
            '<label class="field"><span>User key</span><input id="set-notifyPushoverUser" type="text" spellcheck="false"></label>' +
          '</div>' +
          '<p class="modal__note">Create an application at pushover.net to get the app token; the user key is on your dashboard. Errors arrive as high-priority.</p>',
      },
      {
        id: 'ntfy', name: 'ntfy', events: 'notifyNtfyEvents',
        need: ['notifyNtfyUrl'],
        blurb: 'Simple pub-sub push — self-hosted or ntfy.sh.',
        fields:
          '<label class="field"><span>Topic URL</span><input id="set-notifyNtfyUrl" type="text" spellcheck="false" placeholder="https://ntfy.sh/my-backissue-topic"></label>' +
          '<p class="modal__note">The full URL of your topic. Subscribe to the same topic in the ntfy app; pick something unguessable on the public server.</p>',
      },
      {
        id: 'webhook', name: 'Webhook', events: 'notifyWebhookEvents',
        need: ['notifyWebhookUrl'],
        blurb: 'Plain JSON POST to any URL you run.',
        fields:
          '<label class="field"><span>Webhook URL</span><input id="set-notifyWebhookUrl" type="text" spellcheck="false" placeholder="https://example.com/hook"></label>' +
          '<p class="modal__note">POSTs <code>{ content, type, category, level, title, body, url }</code> per event. Settings carried over from the old built-in webhook.</p>',
      },
    ];

    const csv = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);

    const wrap = document.createElement('div');
    wrap.className = 'nh-channels';
    wrap.innerHTML = CHANNELS.map((c) =>
      '<div class="src-block" data-nh="' + c.id + '">' +
        '<div class="src-toggle">' +
          '<div class="src-toggle__text">' +
            '<b>' + c.name + '</b>' +
            '<span class="modal__note src-toggle__note">' + c.blurb + '</span>' +
          '</div>' +
          '<span class="nh-state" data-nh-state="' + c.id + '"></span>' +
        '</div>' +
        '<div class="src-config">' +
          c.fields +
          '<div class="nh-cats" data-nh-cats="' + c.events + '">' +
            '<span class="nh-cats__label">Send for</span>' +
            '<button type="button" class="nh-chip" data-cat="">All</button>' +
            CATS.map(([k, label]) => '<button type="button" class="nh-chip" data-cat="' + k + '">' + label + '</button>').join('') +
            '<input type="hidden" id="set-' + c.events + '">' +
          '</div>' +
          '<div class="client-test">' +
            '<button type="button" class="btn btn--ghost" data-nh-test="' + c.id + '">Send test</button>' +
            '<span class="client-status" data-nh-result="' + c.id + '" hidden></span>' +
          '</div>' +
        '</div>' +
      '</div>').join('');
    slot.appendChild(wrap);

    /* ---- header status chips: "Active" once the channel's required fields
       are filled in (an active channel sends; there is no separate enable). */
    function syncStates() {
      for (const c of CHANNELS) {
        const on = c.need.every((k) => (document.getElementById('set-' + k)?.value || '').trim());
        const el = wrap.querySelector('[data-nh-state="' + c.id + '"]');
        el.textContent = on ? 'Active' : 'Not set up';
        el.classList.toggle('is-on', on);
      }
    }

    /* ---- category chips ⇄ hidden CSV input (empty = all categories) ---- */
    function paintCats(row) {
      const list = csv(row.querySelector('input[type=hidden]').value);
      for (const chip of row.querySelectorAll('.nh-chip')) {
        const cat = chip.dataset.cat;
        chip.classList.toggle('is-active', cat === '' ? !list.length : list.includes(cat));
      }
    }
    for (const row of wrap.querySelectorAll('.nh-cats')) {
      row.addEventListener('click', (e) => {
        const chip = e.target.closest('.nh-chip');
        if (!chip) return;
        const hidden = row.querySelector('input[type=hidden]');
        let list = csv(hidden.value);
        if (chip.dataset.cat === '') list = [];
        else if (list.includes(chip.dataset.cat)) list = list.filter((c) => c !== chip.dataset.cat);
        else list.push(chip.dataset.cat);
        hidden.value = list.join(',');
        hidden.dispatchEvent(new Event('input', { bubbles: true })); // core's dirty tracking
        paintCats(row);
      });
    }

    // Settings load fills the set-* inputs first, then calls the hooks — sync
    // the widgets from the freshly-loaded values. Also open the cards of
    // channels already in use, matching how enabled sources start expanded.
    api.onSettingsLoad(() => {
      for (const row of wrap.querySelectorAll('.nh-cats')) paintCats(row);
      syncStates();
      for (const c of CHANNELS) {
        const on = c.need.every((k) => (document.getElementById('set-' + k)?.value || '').trim());
        wrap.querySelector('[data-nh="' + c.id + '"]').classList.toggle('is-open', on);
      }
    });
    wrap.addEventListener('input', syncStates); // live while typing

    /* ---- per-channel test: sends the form's CURRENT values (no Save needed);
       the server ignores category filters for tests. */
    for (const btn of wrap.querySelectorAll('[data-nh-test]')) {
      btn.addEventListener('click', async () => {
        const c = CHANNELS.find((x) => x.id === btn.dataset.nhTest);
        const out = wrap.querySelector('[data-nh-result="' + c.id + '"]');
        out.hidden = false; out.textContent = 'Sending…'; out.className = 'client-status is-testing';
        const body = { channel: c.id };
        for (const k of c.need) body[k] = document.getElementById('set-' + k)?.value || '';
        let r;
        try { r = await api.post('/api/notifyhub/test', body); }
        catch (e) { r = { ok: false, error: String(e) }; }
        out.innerHTML = (r.ok ? api.icon('check') + ' Sent — check the channel.'
                              : api.icon('close') + ' ' + api.escapeHtml(r.error || 'Failed'));
        out.className = 'client-status ' + (r.ok ? 'is-ok' : 'is-bad');
      });
    }
  });
})();
