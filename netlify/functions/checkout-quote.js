// Prices a basket for the checkout page: product lines from products.json,
// brick delivery from the Bacton tariff. Nothing here trusts browser prices.
// POST { items:[{id,size,quantity,price}], postcode, service:'economy'|'nextDay', tailLift }
const { priceOrder } = require('../lib/order-pricing');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return respond(405, { ok: false, message: 'Method Not Allowed' });
  let input;
  try { input = JSON.parse(event.body || '{}'); }
  catch (e) { return respond(400, { ok: false, message: 'Invalid request' }); }
  try {
    return respond(200, await priceOrder(input));
  } catch (e) {
    console.error('checkout-quote failed:', e.message);
    return respond(500, { ok: false, message: 'We could not price your basket just now. Please call 01772 287622.' });
  }
};

function respond(status, body) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
           body: JSON.stringify(body) };
}
