/* ===========================================================
   Netlify runs this automatically whenever any form on the
   site is submitted — no wiring needed beyond the filename.

   Email was getting lost in the volume, so every enquiry also
   goes to the Telegram group. Failures are swallowed: a
   notification must never cost an enquiry.
   =========================================================== */
const https = require('https');

// Friendly labels, so the message says what it is rather than a slug.
const FORM_LABELS = {
  'brick-matching': { icon: '📷', title: 'BRICK MATCH REQUEST' },
  'free-samples':   { icon: '🧱', title: 'SAMPLE REQUEST' },
  'trade-account':  { icon: '🏗️', title: 'TRADE ACCOUNT APPLICATION' },
  'bulk-order':     { icon: '📦', title: 'BULK ORDER / QUOTE' },
  'contact':        { icon: '✉️', title: 'CONTACT ENQUIRY' },
};

// Internal fields nobody needs to read in a notification.
const SKIP = ['form-name', 'bot-field', 'ip', 'user_agent', 'referrer'];

// Shown first when present, because they're what you act on.
const PRIORITY = ['full-name', 'name', 'company', 'phone', 'mobile', 'email',
                  'postcode', 'quantity', 'brick-size', 'product'];

function label(key) {
  return key.replace(/[-_]/g, ' ')
            .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
}

function post(path, payload) {
  return new Promise(function (resolve) {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: 'api.telegram.org',
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, function (res) {
      let data = '';
      res.on('data', function (c) { data += c; });
      res.on('end', function () {
        if (res.statusCode >= 400) console.error('Telegram said:', res.statusCode, data);
        resolve();
      });
    });
    req.on('error', function (e) { console.error('Telegram request failed:', e.message); resolve(); });
    req.write(body);
    req.end();
  });
}

exports.handler = async function (event) {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log('Telegram not configured — skipping notification.');
    return { statusCode: 200, body: 'ok' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body).payload || {};
  } catch (e) {
    console.error('Could not parse submission:', e.message);
    return { statusCode: 200, body: 'ok' };
  }

  const formName = payload.form_name || 'unknown';
  const data = payload.data || {};
  const meta = FORM_LABELS[formName] || { icon: '📬', title: formName.toUpperCase() };

  // Order the fields: the useful ones first, everything else after.
  const keys = Object.keys(data).filter(function (k) {
    return SKIP.indexOf(k) < 0 && String(data[k] || '').trim() !== '';
  });
  keys.sort(function (a, b) {
    const ia = PRIORITY.indexOf(a), ib = PRIORITY.indexOf(b);
    if (ia > -1 && ib < 0) return -1;
    if (ib > -1 && ia < 0) return 1;
    if (ia > -1 && ib > -1) return ia - ib;
    return 0;
  });

  const lines = keys.map(function (k) {
    let v = String(data[k]).trim();
    if (v.length > 400) v = v.slice(0, 400) + '…';
    return label(k) + ': ' + v;
  });

  // Uploaded photos arrive as separate URLs, not in data.
  const files = [];
  Object.keys(payload).forEach(function (k) {
    if (/^photo|file|upload/i.test(k) && typeof payload[k] === 'string' && /^https?:/.test(payload[k])) {
      files.push(payload[k]);
    }
  });
  if (payload.data) {
    Object.keys(payload.data).forEach(function (k) {
      const v = payload.data[k];
      if (typeof v === 'object' && v && v.url) files.push(v.url);
    });
  }

  const text = meta.icon + ' ' + meta.title + '\n\n'
             + lines.join('\n')
             + (files.length ? '\n\n📎 ' + files.length + ' photo(s) attached — see the link below' : '')
             + '\n\nSubmitted ' + new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' });

  try {
    await post('/bot' + token + '/sendMessage', { chat_id: chatId, text: text });
    // Photos sent separately so the message itself stays readable.
    for (let i = 0; i < files.length && i < 4; i++) {
      await post('/bot' + token + '/sendMessage', { chat_id: chatId, text: files[i] });
    }
  } catch (e) {
    console.error('Telegram notify failed:', e.message);
  }

  return { statusCode: 200, body: 'ok' };
};
