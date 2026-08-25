// netlify/functions/stripe-webhook.js
//
// Listens for Stripe "checkout.session.completed" events and records
// the order in Supabase so customers can see it in their account and
// staff can see + update it in the admin dashboard.
//
// Setup required (see setup-instructions.md for full steps):
//   1. Netlify env var STRIPE_WEBHOOK_SECRET  (from Stripe → Webhooks)
//   2. Netlify env var STRIPE_SECRET_KEY      (same one used by create-checkout.js)
//   3. Netlify env var SUPABASE_SERVICE_ROLE_KEY (from Supabase → Settings → API)
//   4. In Stripe Dashboard, add a webhook endpoint pointing to:
//        https://YOURDOMAIN/.netlify/functions/stripe-webhook
//      listening for the "checkout.session.completed" event.

const https = require('https');
const crypto = require('crypto');

const SUPA_URL = 'https://kiifrcsqsxlumteoyenf.supabase.co';

// ── Generic HTTPS JSON request helper ──────────────────────────
function request(options, body) {
  return new Promise(function (resolve, reject) {
    const req = https.request(options, function (res) {
      let data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        let parsed = null;
        try { parsed = data ? JSON.parse(data) : null; } catch (e) { parsed = data; }
        resolve({ statusCode: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function stripeGet(path, secretKey) {
  return request({
    hostname: 'api.stripe.com',
    path: path,
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + secretKey },
  });
}

// ── Verify the "Stripe-Signature" header manually (no stripe npm package needed) ──
function verifyStripeSignature(rawBody, signatureHeader, secret, toleranceSeconds) {
  if (!signatureHeader) return false;
  const parts = signatureHeader.split(',').reduce(function (acc, part) {
    const idx = part.indexOf('=');
    const key = part.slice(0, idx);
    const val = part.slice(idx + 1);
    if (key === 't') acc.timestamp = val;
    if (key === 'v1') { acc.signatures = acc.signatures || []; acc.signatures.push(val); }
    return acc;
  }, {});

  if (!parts.timestamp || !parts.signatures || !parts.signatures.length) return false;

  const signedPayload = parts.timestamp + '.' + rawBody;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');

  const isValidSig = parts.signatures.some(function (sig) {
    try {
      return crypto.timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expected, 'utf8'));
    } catch (e) {
      return false;
    }
  });
  if (!isValidSig) return false;

  const age = Math.abs(Date.now() / 1000 - parseInt(parts.timestamp, 10));
  if (toleranceSeconds && age > toleranceSeconds) return false;

  return true;
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!WEBHOOK_SECRET || !STRIPE_KEY || !SERVICE_ROLE_KEY) {
    console.error('Missing required environment variables for stripe-webhook.');
    return { statusCode: 500, body: 'Server not configured' };
  }

  // Netlify may deliver the raw body base64-encoded — decode before verifying.
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;

  const signatureHeader = (event.headers && (event.headers['stripe-signature'] || event.headers['Stripe-Signature'])) || '';

  const validSignature = verifyStripeSignature(rawBody, signatureHeader, WEBHOOK_SECRET, 300);
  if (!validSignature) {
    console.error('Invalid Stripe webhook signature.');
    return { statusCode: 400, body: 'Invalid signature' };
  }

  let stripeEvent;
  try {
    stripeEvent = JSON.parse(rawBody);
  } catch (e) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  // We only care about completed checkouts. Acknowledge everything else so
  // Stripe doesn't keep retrying events we don't need.
  if (stripeEvent.type !== 'checkout.session.completed') {
    return { statusCode: 200, body: 'Ignored' };
  }

  const session = stripeEvent.data && stripeEvent.data.object;
  if (!session || !session.id) {
    return { statusCode: 400, body: 'Malformed session object' };
  }

  // Fetch line items separately — the webhook payload doesn't include them.
  let items = [];
  try {
    const lineItemsRes = await stripeGet(
      '/v1/checkout/sessions/' + session.id + '/line_items?limit=100',
      STRIPE_KEY
    );
    if (lineItemsRes.body && Array.isArray(lineItemsRes.body.data)) {
      items = lineItemsRes.body.data.map(function (li) {
        // create-checkout.js writes the name as "Product Name — Size" when a
        // size/variant was chosen. Split it back into two fields so the
        // dashboard can show product and size separately.
        const full = li.description || 'Item';
        const sepIdx = full.indexOf(' — ');
        const name = sepIdx > -1 ? full.slice(0, sepIdx) : full;
        const size = sepIdx > -1 ? full.slice(sepIdx + 3) : '';
        return {
          name: name,
          size: size,
          quantity: li.quantity || 1,
          amount_total: typeof li.amount_total === 'number' ? li.amount_total / 100 : null,
          unit_price: (typeof li.amount_total === 'number' && li.quantity)
            ? Math.round((li.amount_total / li.quantity)) / 100 : null,
        };
      });
    }
  } catch (e) {
    console.error('Could not fetch line items:', e.message);
    // Continue anyway — better to record the order with no item breakdown
    // than to silently drop it.
  }

  const customerDetails = session.customer_details || {};
  const shipping = session.shipping_details || session.customer_details || null;

  const orderRow = {
    user_id: session.client_reference_id || null,
    customer_email: customerDetails.email || session.customer_email || '',
    customer_name: customerDetails.name || (shipping && shipping.name) || null,
    customer_phone: customerDetails.phone || (shipping && shipping.phone) || null,
    stripe_session_id: session.id,
    stripe_payment_intent: session.payment_intent || null,
    items: items,
    total: typeof session.amount_total === 'number' ? session.amount_total / 100 : 0,
    currency: session.currency || 'gbp',
    shipping_address: shipping ? (shipping.address || null) : null,
    billing_address: customerDetails.address || null,
    status: 'Processing',
  };

  if (!orderRow.customer_email) {
    console.error('Session has no customer email, skipping insert:', session.id);
    return { statusCode: 200, body: 'No email on session' };
  }

  try {
    const upsertRes = await request(
      {
        hostname: SUPA_URL.replace('https://', ''),
        path: '/rest/v1/orders?on_conflict=stripe_session_id',
        method: 'POST',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': 'Bearer ' + SERVICE_ROLE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=minimal',
        },
      },
      JSON.stringify(orderRow)
    );

    if (upsertRes.statusCode >= 400) {
      console.error('Supabase insert failed:', upsertRes.statusCode, upsertRes.body);
      // Return 500 so Stripe retries the webhook later.
      return { statusCode: 500, body: 'Database error' };
    }
  } catch (e) {
    console.error('Supabase request failed:', e.message);
    return { statusCode: 500, body: 'Database request failed' };
  }

  return { statusCode: 200, body: 'OK' };
};
