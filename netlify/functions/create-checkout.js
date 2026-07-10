exports.handler = async function(event) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Stripe not configured. Please contact us on 01772 287622.' })
    };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch(e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  const { items, successUrl, cancelUrl } = body;

  if (!items || !items.length) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No items in cart' }) };
  }

  // Build Stripe API params
  const params = new URLSearchParams();
  params.append('mode', 'payment');
  params.append('success_url', successUrl);
  params.append('cancel_url', cancelUrl);
  params.append('billing_address_collection', 'required');
  params.append('shipping_address_collection[allowed_countries][]', 'GB');
  params.append('payment_method_types[]', 'card');
  params.append('customer_creation', 'always');

  // Add each cart item as a line item
  items.forEach(function(item, i) {
    const priceStr = String(item.price || '0').replace(/[^0-9.]/g, '');
    const amount = Math.round(parseFloat(priceStr) * 100);
    if (!amount || isNaN(amount)) return;

    params.append(`line_items[${i}][price_data][currency]`, 'gbp');
    params.append(`line_items[${i}][price_data][unit_amount]`, amount);
    params.append(`line_items[${i}][price_data][product_data][name]`,
      item.name + (item.size ? ' — ' + item.size : ''));
    params.append(`line_items[${i}][price_data][product_data][description]`,
      'Free delivery to UK mainland. Trade prices.');
    if (item.image) {
      params.append(`line_items[${i}][price_data][product_data][images][0]`, item.image);
    }
    params.append(`line_items[${i}][quantity]`, String(item.quantity || 1));
  });

  // Add a custom field for order notes
  params.append('custom_fields[0][key]', 'order_notes');
  params.append('custom_fields[0][label][type]', 'custom');
  params.append('custom_fields[0][label][custom]', 'Order notes (optional)');
  params.append('custom_fields[0][type]', 'text');
  params.append('custom_fields[0][optional]', 'true');

  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await response.json();

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
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ url: session.url }),
    };

  } catch(e) {
    console.error('Function error:', e);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Payment error: ' + e.message })
    };
  }
};
