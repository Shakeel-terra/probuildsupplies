const https = require('https');

function stripePost(params, secretKey) {
  return new Promise(function(resolve, reject) {
    const body = params.toString();
    const options = {
      hostname: 'api.stripe.com',
      path: '/v1/checkout/sessions',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + secretKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      }
    };
    const req = https.request(options, function(res) {
      let data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Invalid response from Stripe')); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Stripe not configured' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch(e) { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request' }) }; }

  const { items, successUrl, cancelUrl, userId, customerEmail } = body;
  if (!items || !items.length) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No items in cart' }) };
  }

  const params = new URLSearchParams();
  params.append('mode', 'payment');
  params.append('success_url', successUrl);
  params.append('cancel_url', cancelUrl);
  params.append('billing_address_collection', 'required');
  params.append('shipping_address_collection[allowed_countries][]', 'GB');
  params.append('payment_method_types[]', 'card');
  params.append('customer_creation', 'always');
  if (userId) params.append('client_reference_id', String(userId));
  if (customerEmail) params.append('customer_email', String(customerEmail));

  let itemIndex = 0;
  items.forEach(function(item) {
    const priceStr = String(item.price || '0').replace(/[^0-9.]/g, '');
    const amount = Math.round(parseFloat(priceStr) * 100);
    if (!amount || isNaN(amount)) return;

    const i = itemIndex++;
    params.append('line_items[' + i + '][price_data][currency]', 'gbp');
    params.append('line_items[' + i + '][price_data][unit_amount]', amount);
    params.append('line_items[' + i + '][price_data][product_data][name]',
      item.name + (item.size ? ' — ' + item.size : ''));
    params.append('line_items[' + i + '][price_data][product_data][description]',
      'Free delivery to UK mainland. Trade prices.');
    // Note: image URLs from Supabase are too long for Stripe (2048 char limit) so omitted
    params.append('line_items[' + i + '][quantity]', String(item.quantity || 1));
  });

  if (itemIndex === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No valid items with prices' }) };
  }

  try {
    const session = await stripePost(params, STRIPE_KEY);

    if (session.error) {
      console.error('Stripe error:', session.error);
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: session.error.message })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };

  } catch(e) {
    console.error('Function error:', e);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message })
    };
  }
};
