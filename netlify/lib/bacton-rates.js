// =====================================================================
// Bacton Logistics Pallet Tariff 2026 — FULL PALLET rates only.
// Source: Bacton_Logistics_Pallet_Network_Tariff_26-27.pdf
// Valid until 31 March 2027. Next year: replace the ZONES table below.
//
// All tariff figures are EXCLUDING VAT. One brick pack = one full pallet.
// Shared by netlify/functions/delivery-quote.js (and later create-checkout).
// =====================================================================

const TARIFF_VALID_UNTIL = '2027-03-31';
const VAT_RATE = 0.20;
// Fuel surcharge on brick pallets. Set at 19% — the highest Bacton figure
// expected — so delivery is never undercharged. It can be changed in the
// dashboard (Settings → Bacton Fuel Surcharge); this is used when nothing
// has been saved there.
const FUEL_SURCHARGE_PCT = 19;
const TAIL_LIFT_PER_PALLET = 4.00;   // ex VAT, per pallet

// Multiple pallets to one consignee
const VOLUME_DISCOUNTS = [
  { min: 8, pct: 10.0 },
  { min: 5, pct: 7.5 },
  { min: 3, pct: 5.0 },
];

// Zones that get "call us for a delivery quote" instead of a price:
// Isle of Wight (EEC only), Isle of Man, Scottish islands, Channel Islands,
// Northern Ireland (customs charges apply).
const QUOTE_ONLY_ZONES = new Set(['24','29','30','31','32','33','34','35','36','37']);

// Specific districts the tariff marks POA
const POA_DISTRICTS = { TR: [[21,25]], GY: [[9,10]] };

// economy / nextDay are FULL PALLET, ex VAT. nextDay null = not offered.
// Each area is either a whole area (true) or a list of [from,to] districts.
const ZONES = [
  { zone:'LOCAL', economy:30.00, nextDay:38.50, areas:{ IP:true, NR:true } },
  { zone:'1', economy:50.29, nextDay:57.98, areas:{
      B:true, BB:true, BD:true, BL:true, CH:true, CV:true, CW:true, DE:true, DN:true,
      DY:true, HD:true, HX:true, L:true, LE:[[1,12],[17,21],[65,65],[67,67]], LS:true,
      M:true, MK:[[1,19],[77,77]], NG:true, NN:true, OL:true,
      PE:[[1,1],[3,10],[27,28]], PR:true, S:true, SK:[[1,5],[7,11],[13,17]], ST:true,
      TF:true, WA:true, WF:true, WN:true, WR:true, WS:true, WV:true } },
  { zone:'2', economy:52.45, nextDay:61.71, areas:{
      LE:[[13,16]], LN:[[1,3]], MK:[[40,42]], PE:[[2,2],[11,11]], SK:[[6,6],[12,12],[22,23]] } },
  { zone:'3', economy:52.45, nextDay:61.87, areas:{
      BS:true, CB:[[6,11],[21,25]], FY:true, GL:true, HU:true, LN:[[4,8]], LU:true,
      MK:[[43,46]], NP:[[1,1],[10,10],[18,20],[26,26],[44,44]],
      PE:[[12,16],[19,19],[26,26],[29,38]] } },
  { zone:'4', economy:54.01, nextDay:65.21, areas:{
      AL:true, CB:[[1,5]], CF:[[1,8],[10,11],[14,15],[23,24],[83,83]], HG:true, HP:true,
      HR:true, LN:[[9,13]], NP:[[2,2],[4,4],[7,8],[11,16],[22,25]],
      OX:[[7,7],[15,17]], PE:[[20,25]], SN:true, SR:true, TS:true } },
  { zone:'5', economy:56.04, nextDay:65.81, areas:{
      BA:true, CF:[[31,48],[61,64],[71,72],[81,82],[87,99]], DH:true, DL:true,
      LA:[[1,10]], NE:[[1,18],[20,47],[49,49]],
      OX:[[1,6],[8,14],[18,29],[33,33],[39,39],[44,44],[49,49]], SG:true, SL:true } },
  { zone:'6',  economy:58.46, nextDay:66.99, areas:{ CM:true, CO:true, SO:true, SS:true } },
  { zone:'7',  economy:60.74, nextDay:72.87, areas:{ RG:true, YO:true } },
  { zone:'8',  economy:60.74, nextDay:72.87, areas:{ LL:[[11,14]], PO:[[1,22]] } },
  { zone:'9',  economy:61.64, nextDay:73.52, areas:{ TA:true } },
  { zone:'10', economy:61.75, nextDay:73.52, areas:{ BH:true, GU:true, LL:[[15,34]], RH:true } },
  { zone:'11', economy:63.31, nextDay:75.44, areas:{
      LA:[[11,23]], NE:[[19,19],[48,48],[61,71]], SP:true, SY:[[1,9],[12,15]] } },
  { zone:'12', economy:64.71, nextDay:76.94, areas:{ BN:true, ME:true } },
  { zone:'13', economy:70.01, nextDay:80.88, areas:{
      CA:true, CT:true, LD:true, LL:[[35,78]], SA:[[1,18]], SY:[[10,11],[16,25]], TN:true } },
  { zone:'14', economy:75.89, nextDay:85.59, areas:{ DT:true, EX:true, PL:true, TQ:true } },
  { zone:'15', economy:76.66, nextDay:83.52, areas:{ SA:[[19,48],[56,56],[61,73],[99,99]] } },
  { zone:'16', economy:78.81, nextDay:85.87, areas:{
      DG:[[2,7],[12,16]], EH:true, FK:[[1,7]], G:[[1,62],[64,82],[90,90]],
      KA:[[1,18],[20,25],[29,30]], KY:[[1,5]], ML:true, PA:[[1,19]] } },
  { zone:'17', economy:80.58, nextDay:86.34, areas:{
      DG:[[1,1],[8,11]], FK:[[8,9]], G:[[63,63],[83,84]], KA:[[19,19],[26,26]],
      KY:[[6,16],[99,99]], TD:true } },
  { zone:'18', economy:81.26, nextDay:86.76, areas:{ FK:[[10,21]] } },
  { zone:'19', economy:88.42, nextDay:92.89, areas:{ TR:true } },
  { zone:'20', economy:93.47, nextDay:116.40, areas:{ DD:true, PH:[[1,14]] } },
  { zone:'21', economy:106.32, nextDay:129.93, areas:{ AB:[[10,30],[39,39]] } },

  // London
  { zone:'L1', economy:60.74, nextDay:69.34, areas:{ HA:[[0,1]], WD:true } },
  { zone:'L2', economy:61.64, nextDay:70.25, areas:{ EN:true, HA:[[2,9]], UB:true } },
  { zone:'L3', economy:66.46, nextDay:74.69, areas:{
      BR:true, CR:true, DA:true, IG:true, RM:true, SM:true, TW:true } },
  { zone:'L4', economy:72.67, nextDay:81.75, areas:{
      E:true, KT:true, N:true, NW:true, SE:[[2,10],[12,28]],
      SW:[[2,2],[4,4],[6,6],[8,9],[11,20],[99,99]], W:[[3,7],[9,9],[12,13]] } },
  { zone:'L5', economy:77.73, nextDay:84.11, areas:{
      EC:true, SE:[[1,1],[11,11]], SW:[[1,1],[3,3],[5,5],[7,7],[10,10]],
      W:[[1,2],[8,8],[10,11],[14,14]], WC:true } },

  // Highlands and Islands — Extended Economy, no next day
  { zone:'22', economy:106.32, nextDay:null, areas:{ PH:[[15,26]] } },
  { zone:'23', economy:108.11, nextDay:null, areas:{ AB:[[31,38],[41,46],[51,56]] } },
  { zone:'24', economy:101.39, nextDay:null, areas:{ PO:[[30,41]] } },
  { zone:'25', economy:111.28, nextDay:null, areas:{ IV:[[1,28],[30,32],[36,36],[53,54]] } },
  { zone:'26', economy:116.56, nextDay:null, areas:{ PA:[[21,21]], PH:[[30,41],[49,50]] } },
  { zone:'27', economy:125.05, nextDay:null, areas:{ KW:[[1,14]] } },
  { zone:'28', economy:133.00, nextDay:null, areas:{ PA:[[22,38]] } },
  { zone:'29', economy:155.37, nextDay:null, areas:{ IM:true } },
  { zone:'30', economy:150.51, nextDay:null, areas:{ PH:[[42,44]], KA:[[27,28]] } },
  { zone:'31', economy:168.93, nextDay:null, areas:{ PA:[[20,20],[41,49],[60,78],[80,80]] } },
  { zone:'32', economy:196.89, nextDay:null, areas:{ ZE:true } },
  { zone:'33', economy:181.69, nextDay:null, areas:{
      IV:[[40,49],[51,52],[55,56],[63,63]], KW:[[15,17]] } },
  { zone:'34', economy:217.06, nextDay:null, areas:{ HS:true } },
  { zone:'35', economy:212.60, nextDay:null, areas:{ GY:true, JE:true } },

  // Northern Ireland — Extended Economy
  { zone:'36', economy:89.91, nextDay:null, areas:{ BT:[[1,17],[36,39],[41,41]] } },
  { zone:'37', economy:97.56, nextDay:null, areas:{
      BT:[[18,35],[40,40],[42,49],[51,58],[60,71],[74,82],[92,94]] } },
  // Zones 38/39 (Dublin, rest of ROI) have no UK postcode — not offered online.
];

// ---------------------------------------------------------------------

function parsePostcode(input) {
  const s = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.length < 2 || s.length > 7) return null;
  // Full postcode → outward code is everything except the last 3 chars
  const outward = (s.length >= 5 && /^\d[A-Z]{2}$/.test(s.slice(-3))) ? s.slice(0, -3) : s;
  const m = outward.match(/^([A-Z]{1,2})(\d{1,2})[A-Z]?$/);
  if (!m) return null;
  return { outward, area: m[1], district: parseInt(m[2], 10), full: s.length >= 5 };
}

function inRanges(ranges, n) {
  return ranges.some(function (r) { return n >= r[0] && n <= r[1]; });
}

function findZone(pc) {
  for (const z of ZONES) {
    const a = z.areas[pc.area];
    if (a === true || (Array.isArray(a) && inRanges(a, pc.district))) return z;
  }
  return null;
}

function volumeDiscountPct(pallets) {
  for (const b of VOLUME_DISCOUNTS) if (pallets >= b.min) return b.pct;
  return 0;
}

const pence = function (x) { return Math.round(x * 100); };
const pounds = function (p) { return Math.round(p) / 100; };

/**
 * quote({ postcode, pallets, service: 'economy'|'nextDay', tailLift })
 * Returns a breakdown in pounds. ok:false with a message when no price
 * can be given online.
 */
function quote(opts) {
  const pallets = parseInt(opts && opts.pallets, 10);
  const service = (opts && /^next/i.test(String(opts.service))) ? 'nextDay' : 'economy';
  const tailLift = !!(opts && (opts.tailLift === true || opts.tailLift === 'true' || opts.tailLift === '1' || opts.tailLift === 1));

  if (!pallets || pallets < 1 || pallets > 50) {
    return { ok: false, reason: 'pallets', message: 'Invalid number of pallets.' };
  }
  const pc = parsePostcode(opts && opts.postcode);
  if (!pc) return { ok: false, reason: 'postcode', message: 'Please enter a valid UK postcode.' };

  const poa = POA_DISTRICTS[pc.area];
  const zone = findZone(pc);
  if (!zone || (poa && inRanges(poa, pc.district)) || QUOTE_ONLY_ZONES.has(zone.zone)) {
    return {
      ok: false, reason: 'quote', outward: pc.outward, zone: zone ? zone.zone : null,
      message: 'We need to quote delivery to ' + pc.outward +
               ' individually. Please call 01772 287622 or WhatsApp 07549 809252.'
    };
  }

  const services = { economy: true, nextDay: zone.nextDay != null };
  if (service === 'nextDay' && !services.nextDay) {
    return { ok: false, reason: 'service', outward: pc.outward, zone: zone.zone, services,
             message: 'Next day delivery is not available to ' + pc.outward + '. Economy only.' };
  }

  const rateP      = pence(zone[service]);
  const palletsP   = rateP * pallets;
  const discPct    = volumeDiscountPct(pallets);
  const discP      = Math.round(palletsP * discPct / 100);
  // Fuel applies to the pallet charge after the volume discount, not to tail-lift.
  const fuelPct    = (opts && isFinite(parseFloat(opts.fuelPct))) ? parseFloat(opts.fuelPct) : FUEL_SURCHARGE_PCT;
  const fuelP      = Math.round((palletsP - discP) * fuelPct / 100);
  const tailP      = tailLift ? pence(TAIL_LIFT_PER_PALLET) * pallets : 0;
  const netP       = palletsP - discP + fuelP + tailP;
  const vatP       = Math.round(netP * VAT_RATE);
  const totalP     = netP + vatP;

  return {
    ok: true,
    outward: pc.outward, zone: zone.zone, service, services, pallets, tailLift,
    breakdown: {
      ratePerPallet: pounds(rateP),
      palletsSubtotal: pounds(palletsP),
      volumeDiscountPct: discPct,
      volumeDiscount: pounds(discP),
      fuelSurchargePct: fuelPct,
      fuelSurcharge: pounds(fuelP),
      tailLift: pounds(tailP),
      netExVat: pounds(netP),
      vat: pounds(vatP),
      total: pounds(totalP),
    },
    tariffValidUntil: TARIFF_VALID_UNTIL,
    tariffExpired: new Date() > new Date(TARIFF_VALID_UNTIL + 'T23:59:59Z'),
  };
}

module.exports = { quote, parsePostcode, findZone, ZONES, TARIFF_VALID_UNTIL, VAT_RATE,
                   FUEL_SURCHARGE_PCT, TAIL_LIFT_PER_PALLET, QUOTE_ONLY_ZONES };
