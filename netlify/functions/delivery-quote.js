// Delivery price for brick pallets, from the Bacton tariff.
// GET  /.netlify/functions/delivery-quote?postcode=PR2%208JE&pallets=3&service=economy&tailLift=1
// POST { postcode, pallets, service: 'economy'|'nextDay', tailLift: true|false }
const { quote } = require('../lib/bacton-rates');
const { getFuel, publicBreakdown } = require('../lib/order-pricing');

exports.handler = async function (event) {
  let input = event.queryStringParameters || {};
  if (event.httpMethod === 'POST') {
    try { input = JSON.parse(event.body || '{}'); }
    catch (e) { return respond(400, { ok: false, message: 'Invalid request' }); }
  } else if (event.httpMethod !== 'GET') {
    return respond(405, { ok: false, message: 'Method Not Allowed' });
  }
  const f = await getFuel();
  const q = quote(Object.assign({}, input, { fuelPct: f.pct, service: 'economy' }));  // Economy only
  if (q.breakdown) q.breakdown = publicBreakdown(q.breakdown);
  return respond(200, q);
};

function respond(status, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}
