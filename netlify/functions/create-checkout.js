// netlify/functions/create-checkout.js
//
// Starts a Stripe Checkout session from the checkout page.
// Every price is recalculated here from products.json and the Bacton
// tariff (netlify/lib/order-pricing.js); prices sent by the browser are
// ignored. Brick delivery is added as its own line, and the quoted
// postcode is stored in metadata so the webhook can check the delivery
// address the customer gives Stripe matches it.
const https = require('https');
const { priceOrder } = require('../lib/order-pricing');

function stripePost(params, secretKey) {
  return new Promise(function (resolve, reject) {
    const body = params.toString();
    const req = https.request({
      hostname: 'api.stripe.com', path: '/v1/checkout/sessions', method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + secretKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, function (res) {
      let data = '';
      res.on('data', function (c) { data += c; });
      res.on('end', function () {
        try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('Invalid response from Stripe')); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function json(status, body) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

const SERVICE_LABEL = { economy: 'Economy', nextDay: 'Next Day' };

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_KEY) return json(500, { error: 'Stripe not configured' });

  let body;
  try { body = JSON.parse(event.body); } catch (e) { return json(400, { error: 'Invalid request' }); }
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return json(400, { error: 'Your basket is empty.' });

  let order;
  try {
    order = await priceOrder({ items, postcode: body.postcode, service: body.service, tailLift: body.tailLift });
  } catch (e) {
    console.error('Pricing failed:', e.message);
    return json(500, { error: 'We could not price your basket just now. Please call 01772 287622.' });
  }
  if (!order.canPay) {
    const bad = order.lines.find(function (l) { return l.kind === 'unavailable'; });
    return json(409, { error: bad ? (bad.name + ': ' + bad.message)
                                  : (order.delivery.message || 'Please enter your delivery postcode.'), order });
  }
  // The customer must have seen the total they are about to pay.
  if (body.expectedTotal != null && Math.round(Number(body.expectedTotal)) !== order.total) {
    return json(409, { error: 'Prices have changed since this page loaded. Please check the updated total.', order });
  }

  const base = 'https://probuildsupplies.uk';
  const params = new URLSearchParams();
  params.append('mode', 'payment');
  params.append('success_url', base + '/success.html?session_id={CHECKOUT_SESSION_ID}');
  params.append('cancel_url', base + '/checkout.html');
  params.append('billing_address_collection', 'required');
  params.append('shipping_address_collection[allowed_countries][]', 'GB');
  params.append('phone_number_collection[enabled]', 'true');
  params.append('payment_method_types[]', 'card');
  params.append('customer_creation', 'always');
  params.append('allow_promotion_codes', 'true');
  if (body.userId) params.append('client_reference_id', String(body.userId));
  if (body.customerEmail) params.append('customer_email', String(body.customerEmail));

  let i = 0;
  function addLine(name, desc, unitPence, qty) {
    params.append('line_items[' + i + '][price_data][currency]', 'gbp');
    params.append('line_items[' + i + '][price_data][unit_amount]', String(unitPence));
    params.append('line_items[' + i + '][price_data][product_data][name]', name.slice(0, 250));
    if (desc) params.append('line_items[' + i + '][price_data][product_data][description]', desc.slice(0, 250));
    params.append('line_items[' + i + '][quantity]', String(qty));
    i++;
  }

  order.lines.forEach(function (l) {
    const desc = l.kind === 'brick' ? 'Price excludes delivery, which is shown as a separate line.'
               : l.kind === 'samples' ? 'Sent by DPD.' : 'Delivery included.';
    addLine(l.name + (l.size ? ' — ' + l.size : ''), desc, l.unit, l.qty);
  });

  const d = order.delivery;
  if (d.pallets > 0 && d.total > 0) {
    const b = d.breakdown;
    const parts = [SERVICE_LABEL[d.service], d.pallets + (d.pallets === 1 ? ' pallet' : ' pallets'),
                   'to ' + d.postcode];
    if (d.tailLift) parts.push('tail-lift');
    const desc = (b.volumeDiscountPct ? b.volumeDiscountPct + '% multi-pallet discount applied. ' : '')
               + 'Kerbside delivery. Inc VAT.';
    addLine('Pallet delivery — ' + parts.join(', '), desc, d.total, 1);
  }

  const meta = {
    quoted_postcode: d.postcode || '',
    delivery_service: d.pallets > 0 ? d.service : '',
    pallets: String(d.pallets || 0),
    tail_lift: d.tailLift && d.pallets > 0 ? 'yes' : 'no',
    delivery_total: (d.total / 100).toFixed(2),
    delivery_zone: d.zone || '',
  };
  Object.keys(meta).forEach(function (k) { params.append('metadata[' + k + ']', meta[k]); });

  try {
    const session = await stripePost(params, STRIPE_KEY);
    if (session.error) {
      console.error('Stripe error:', session.error);
      return json(400, { error: session.error.message });
    }
    return json(200, { url: session.url, total: order.total });
  } catch (e) {
    console.error('Function error:', e);
    return json(500, { error: e.message });
  }
};
