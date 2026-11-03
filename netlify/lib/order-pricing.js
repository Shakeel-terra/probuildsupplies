// =====================================================================
// Order pricing — the single source of truth for what a basket costs.
//
// Used by:
//   netlify/functions/checkout-quote.js   (the checkout page asks for prices)
//   netlify/functions/create-checkout.js  (builds the Stripe session)
//
// Prices never come from the browser. Every basket line is looked up in
// products.json (written by the dashboard on Publish), and brick delivery
// comes from the Bacton tariff in bacton-rates.js.
//
// Rules
//   • Bricks (any category containing "Brick"): one pack = one pallet,
//     charged per pallet by postcode. Economy or Next Day, optional tail-lift.
//   • Everything else (paving, sandstone, palletised plasterboard): delivery
//     included in the price.
//   • Brick samples (£7.99 for any 3): sent by DPD, no pallet charge.
//   • A postcode is required whenever the basket holds anything delivered by
//     pallet, so offshore/POA areas are caught before payment.
// =====================================================================
const https = require('https');
const { quote, parsePostcode, findZone, QUOTE_ONLY_ZONES } = require('./bacton-rates');

const SITE_URL = (process.env.URL || 'https://probuildsupplies.uk').replace(/\/+$/, '');
const SAMPLE_PRICE_PENCE = 799;
const SAMPLE_ID_PREFIX = 'brick-samples-';
const CONTACT = 'call 01772 287622 or WhatsApp 07549 809252';

// ── products.json, cached briefly between calls ──────────────────────
let cache = { at: 0, list: null };
function getJSON(url) {
  return new Promise(function (resolve, reject) {
    https.get(url, function (res) {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('products.json HTTP ' + res.statusCode)); }
      let data = '';
      res.on('data', function (c) { data += c; });
      res.on('end', function () { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}
async function loadProducts() {
  if (cache.list && Date.now() - cache.at < 60 * 1000) return cache.list;
  const list = await getJSON(SITE_URL + '/products.json?t=' + Date.now());
  cache = { at: Date.now(), list: Array.isArray(list) ? list : (list.products || []) };
  return cache.list;
}

// ── helpers ───────────────────────────────────────────────────────────
function toPence(v) {
  const m = String(v == null ? '' : v).replace(/,/g, '').match(/\d+(\.\d+)?/);
  return m ? Math.round(parseFloat(m[0]) * 100) : null;
}
const isBrick = function (p) { return /brick/i.test(p.category || ''); };

// Product pages use a cleaned slug as the basket id (dashboard pgCleanSlug):
// price suffixes stripped and the old "country-light-grey" typo corrected.
// Keep this identical to the dashboard so ids always match.
function cleanSlug(s) {
  s = String(s || '').replace(/-\d+-\d+-per-[a-z0-9]+$/, '').replace('country-light-grey', 'county-light-grey');
  return s.replace(/-+/g, '-').replace(/^-|-$/g, '');
}
function bySlug(products, id) {
  return products.find(function (x) { return x.slug === id; })
      || products.find(function (x) { return cleanSlug(x.slug) === id; });
}

// Same rule as the product page builder: the default option is the
// cheapest variant with a real price, falling back to the product price.
function defaultVariant(p) {
  const vs = p.sizeVariants || [];
  const priced = vs.filter(function (v) { return toPence(v && v.price) != null; })
                   .sort(function (a, b) { return toPence(a.price) - toPence(b.price); });
  return priced[0] || vs[0] || null;
}

// Basket ids: "slug" (default option) or "slug-N" (size dropdown index N).
function resolve(item, products) {
  const id = String(item.id || '');
  const qty = Math.max(1, Math.min(999, parseInt(item.quantity, 10) || 1));
  const key = id + '|' + (item.size || '');

  if (id.indexOf(SAMPLE_ID_PREFIX) === 0) {
    return { key, id, kind: 'samples', name: 'Brick Samples — Any 3', size: String(item.size || '').slice(0, 300),
             qty, unit: SAMPLE_PRICE_PENCE, image: item.image || '' };
  }

  let p = bySlug(products, id);
  let variant = null, chosenSize = false;
  if (p) {
    variant = defaultVariant(p);
  } else {
    const m = id.match(/^(.*)-(\d+)$/);
    if (m) {
      p = bySlug(products, m[1]);
      if (p) { variant = (p.sizeVariants || [])[parseInt(m[2], 10)] || null; chosenSize = true; }
    }
  }
  if (!p) return { key, id, kind: 'unavailable', name: item.name || 'Item', size: item.size || '', qty,
                   message: 'This product is no longer available.' };
  if (p.mode === 'enquiry' || p.visible === false) {
    return { key, id, kind: 'unavailable', name: p.name, size: item.size || '', qty,
             message: 'This product is on enquiry only. Please ' + CONTACT + '.' };
  }

  // A size the customer picked must have its own price. Some sizes carry
  // text such as "STOCK COMING SOON" instead; never fall back to another
  // size's price for those.
  if (chosenSize && (!variant || toPence(variant.price) == null)) {
    const label = variant ? [variant.size, variant.pack].filter(Boolean).join(' / ') : (item.size || '');
    const soon = variant && /stock|soon|out of/i.test(String(variant.price || ''));
    return { key, id, kind: 'unavailable', name: p.name, size: label, qty,
             message: soon ? 'This size is out of stock at the moment.'
                           : 'This size has no online price. Please ' + CONTACT + '.' };
  }
  const unit = toPence(variant && variant.price) != null ? toPence(variant.price) : toPence(p.price);
  if (unit == null || unit <= 0) {
    return { key, id, kind: 'unavailable', name: p.name, size: item.size || '', qty,
             message: 'This product has no online price. Please ' + CONTACT + '.' };
  }
  const size = variant ? [variant.size, variant.pack].filter(Boolean).join(' / ') : (item.size || '');
  const browserUnit = toPence(item.price);
  return {
    key, id, slug: p.slug, kind: isBrick(p) ? 'brick' : 'included',
    category: p.category || '', name: p.name, size, qty, unit,
    image: (p.images && p.images[0]) || p.image || item.image || '',
    priceChanged: browserUnit != null && browserUnit !== unit,
  };
}

/**
 * priceOrder({ items, postcode, service, tailLift })
 * Returns everything the checkout page shows and Stripe charges, in pence.
 */
async function priceOrder(input) {
  const products = await loadProducts();
  const raw = Array.isArray(input && input.items) ? input.items.slice(0, 99) : [];
  const lines = raw.map(function (it) { return resolve(it, products); });
  lines.forEach(function (l) { if (l.unit != null) l.total = l.unit * l.qty; });

  const buyable  = lines.filter(function (l) { return l.kind !== 'unavailable'; });
  const subtotal = buyable.reduce(function (s, l) { return s + l.total; }, 0);
  const pallets  = buyable.filter(function (l) { return l.kind === 'brick'; })
                          .reduce(function (s, l) { return s + l.qty; }, 0);
  const needsPostcode = buyable.some(function (l) { return l.kind === 'brick' || l.kind === 'included'; });

  const service  = /^next/i.test(String(input && input.service)) ? 'nextDay' : 'economy';
  const tailLift = !!(input && input.tailLift);
  const delivery = { status: 'none', pallets, service, tailLift, total: 0, options: null, message: '' };

  if (needsPostcode) {
    const pc = parsePostcode(input && input.postcode);
    if (!input || !input.postcode) {
      delivery.status = 'need_postcode';
    } else if (!pc || !pc.full) {
      delivery.status = 'invalid';
      delivery.message = 'Enter your full delivery postcode, for example PR2 8JE.';
    } else {
      delivery.postcode = pc.outward + ' ' + String(input.postcode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-3);
      delivery.outward = pc.outward;
      const zone = findZone(pc);
      if (pallets > 50) {
        delivery.status = 'quote';
        delivery.message = 'We quote delivery individually for orders over 50 pallets. Please ' + CONTACT + '.';
      } else if (pallets > 0) {
        const eco = quote({ postcode: input.postcode, pallets, service: 'economy', tailLift });
        if (!eco.ok) {
          delivery.status = 'quote';
          delivery.message = eco.message;
        } else {
          const nd = quote({ postcode: input.postcode, pallets, service: 'nextDay', tailLift });
          delivery.options = {
            economy: { total: Math.round(eco.breakdown.total * 100), breakdown: eco.breakdown },
            nextDay: nd.ok ? { total: Math.round(nd.breakdown.total * 100), breakdown: nd.breakdown } : null,
          };
          delivery.zone = eco.zone;
          delivery.tailLiftPerPallet = 480; // £4.00 + VAT
          const chosen = (service === 'nextDay' && delivery.options.nextDay) ? 'nextDay' : 'economy';
          delivery.service = chosen;
          delivery.total = delivery.options[chosen].total;
          delivery.breakdown = delivery.options[chosen].breakdown;
          delivery.status = 'ok';
        }
      } else if (!zone || QUOTE_ONLY_ZONES.has(zone.zone)) {
        // Free-delivery goods (paving etc.) are UK mainland only.
        delivery.status = 'quote';
        delivery.message = 'Free delivery covers the UK mainland only. For delivery to ' + pc.outward + ', please ' + CONTACT + '.';
      } else {
        delivery.status = 'ok';
        delivery.zone = zone.zone;
      }
    }
  } else if (buyable.length) {
    delivery.status = 'ok'; // samples only — sent by DPD, included in £7.99
  }

  const unavailable = lines.filter(function (l) { return l.kind === 'unavailable'; });
  const canPay = buyable.length > 0 && unavailable.length === 0 && delivery.status === 'ok';
  return {
    ok: true, lines, subtotal, delivery,
    total: subtotal + (delivery.status === 'ok' ? delivery.total : 0),
    canPay,
    priceChanged: lines.some(function (l) { return l.priceChanged; }),
  };
}

module.exports = { priceOrder, loadProducts, resolve, toPence, SAMPLE_PRICE_PENCE,
  _setProductsForTest: function (list) { cache = { at: Date.now() + 1e12, list: list }; } };
