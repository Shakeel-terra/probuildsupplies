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
const { quote, parsePostcode, findZone, QUOTE_ONLY_ZONES, FUEL_SURCHARGE_PCT } = require('./bacton-rates');

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

// ── Bacton fuel surcharge, set weekly in the dashboard ────────────────
// Stored in the Supabase `settings` table as fuel_surcharge_pct. Read with
// the service-role key (server only). If it can't be read we keep the last
// figure we saw, and before that the fallback in bacton-rates.js — never 0.
const SUPA_HOST = 'kiifrcsqsxlumteoyenf.supabase.co';
let fuel = { at: 0, pct: null, updated: null, source: 'fallback' };
function getSettings(keys) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return Promise.reject(new Error('SUPABASE_SERVICE_ROLE_KEY not set'));
  const path = '/rest/v1/settings?select=key,value&key=in.(' + keys.join(',') + ')';
  return new Promise(function (resolve, reject) {
    https.get({ hostname: SUPA_HOST, path: path, headers: { apikey: key, Authorization: 'Bearer ' + key } }, function (res) {
      let data = '';
      res.on('data', function (c) { data += c; });
      res.on('end', function () {
        if (res.statusCode !== 200) return reject(new Error('settings HTTP ' + res.statusCode));
        try { const out = {}; JSON.parse(data).forEach(function (r) { out[r.key] = r.value; }); resolve(out); }
        catch (e) { reject(e); }
      });
    }).on('error', reject).setTimeout(4000, function () { this.destroy(new Error('settings timeout')); });
  });
}
async function getFuel() {
  if (fuel.pct != null && Date.now() - fuel.at < 60 * 1000) return fuel;
  try {
    const s = await getSettings(['fuel_surcharge_pct', 'fuel_surcharge_updated']);
    const pct = parseFloat(s.fuel_surcharge_pct);
    if (isFinite(pct) && pct >= 0 && pct <= 60) {
      fuel = { at: Date.now(), pct: pct, updated: s.fuel_surcharge_updated || null, source: 'dashboard' };
    } else if (fuel.pct == null) {
      fuel = { at: Date.now(), pct: FUEL_SURCHARGE_PCT, updated: null, source: 'fallback' };
    }
  } catch (e) {
    console.error('Fuel surcharge setting unavailable:', e.message);
    if (fuel.pct == null) fuel = { at: Date.now(), pct: FUEL_SURCHARGE_PCT, updated: null, source: 'fallback' };
    else fuel.at = Date.now();
  }
  return fuel;
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
  const f = await getFuel();
  const raw = Array.isArray(input && input.items) ? input.items.slice(0, 99) : [];
  const lines = raw.map(function (it) { return resolve(it, products); });
  lines.forEach(function (l) { if (l.unit != null) l.total = l.unit * l.qty; });

  const buyable  = lines.filter(function (l) { return l.kind !== 'unavailable'; });
  const subtotal = buyable.reduce(function (s, l) { return s + l.total; }, 0);
  const pallets  = buyable.filter(function (l) { return l.kind === 'brick'; })
                          .reduce(function (s, l) { return s + l.qty; }, 0);
  const needsPostcode = buyable.some(function (l) { return l.kind === 'brick' || l.kind === 'included'; });

  // Economy only: Next Day is not offered (most orders can't be fulfilled next day).
  const service  = 'economy';
  const tailLift = !!(input && input.tailLift);
  const delivery = { status: 'none', pallets, service, tailLift, total: 0, options: null, message: '', fuelPct: f.pct };

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
        const eco = quote({ postcode: input.postcode, pallets, service: 'economy', tailLift, fuelPct: f.pct });
        if (!eco.ok) {
          delivery.status = 'quote';
          delivery.message = eco.message;
        } else {
          const nd = quote({ postcode: input.postcode, pallets, service: 'nextDay', tailLift, fuelPct: f.pct });
          delivery.options = {
            economy: { total: Math.round(eco.breakdown.total * 100), breakdown: eco.breakdown },
            nextDay: null,
          };
          delivery.zone = eco.zone;
          delivery.tailLiftPerPallet = 480; // £4.00 + VAT
          const chosen = 'economy';
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

// ── What the browser is allowed to see ───────────────────────────────
// The fuel surcharge is never shown or sent to customers. It is folded
// into the delivery rate, and the percentage is removed entirely.
function publicBreakdown(b) {
  if (!b) return b;
  return {
    deliveryRate: Math.round((b.palletsSubtotal + (b.fuelSurcharge || 0)) * 100) / 100,
    volumeDiscountPct: b.volumeDiscountPct,
    volumeDiscount: b.volumeDiscount,
    tailLift: b.tailLift,
    netExVat: b.netExVat,
    vat: b.vat,
    total: b.total,
  };
}
function publicView(order) {
  const o = JSON.parse(JSON.stringify(order));
  const d = o.delivery || {};
  delete d.fuelPct;
  if (d.breakdown) d.breakdown = publicBreakdown(d.breakdown);
  if (d.options) Object.keys(d.options).forEach(function (k) {
    if (d.options[k]) d.options[k].breakdown = publicBreakdown(d.options[k].breakdown);
  });
  return o;
}

module.exports = { priceOrder, publicView, publicBreakdown, loadProducts, resolve, toPence, SAMPLE_PRICE_PENCE, getFuel, getSettings,
  _setProductsForTest: function (list) { cache = { at: Date.now() + 1e12, list: list }; },
  _setFuelForTest: function (pct) { fuel = { at: Date.now() + 1e12, pct: pct, updated: null, source: 'test' }; } };
