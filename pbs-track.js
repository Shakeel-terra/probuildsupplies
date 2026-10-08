/* ===========================================================
   Pro Build Supplies — conversion tracking
   -----------------------------------------------------------
   Pushes events into dataLayer for GTM, which forwards them to
   GA4 and Google Ads. Nothing here fires a tag directly, so tag
   configuration stays in GTM where it can be changed without a
   code deploy.

   Events pushed:
     purchase                 (success.html, with value + items)
     generate_lead            (every form, with form_name)
     phone_click
     whatsapp_click
     email_click
     begin_checkout           (when checkout starts)
   =========================================================== */
(function () {
  'use strict';

  window.dataLayer = window.dataLayer || [];
  function push(obj) {
    try { window.dataLayer.push(obj); } catch (e) { /* never break the page */ }
  }

  // ---------------------------------------------------------
  // Purchase — fired on the Stripe success page.
  // The cart is read from localStorage before it gets cleared,
  // which is the only place the line items and value exist
  // client-side. session_id from the URL becomes transaction_id
  // so GA4 can de-duplicate on refresh.
  // ---------------------------------------------------------
  function trackPurchase() {
    if (!/success\.html/i.test(location.pathname)) return;

    var sessionId = '';
    try {
      sessionId = new URLSearchParams(location.search).get('session_id') || '';
    } catch (e) {}

    // Don't double-count if the customer refreshes the page.
    try {
      var seen = sessionStorage.getItem('pbs_purchase_tracked');
      if (seen && seen === sessionId) return;
    } catch (e) {}

    var cart = [];
    try { cart = JSON.parse(localStorage.getItem('pbs_cart') || '[]'); } catch (e) {}
    if (!cart.length) return;   // nothing to report

    function num(v) {
      var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.]/g, ''));
      return isNaN(n) ? 0 : n;
    }

    var items = cart.map(function (c, i) {
      return {
        item_id: String(c.id || ('item-' + i)),
        item_name: String(c.name || 'Product'),
        item_variant: String(c.size || ''),
        item_category: String(c.category || ''),
        price: num(c.price),
        quantity: parseInt(c.quantity, 10) || 1
      };
    });

    var value = items.reduce(function (sum, it) {
      return sum + (it.price * it.quantity);
    }, 0);

    push({ ecommerce: null });   // clear any previous ecommerce object
    push({
      event: 'purchase',
      ecommerce: {
        transaction_id: sessionId || ('pbs-' + Date.now()),
        value: Math.round(value * 100) / 100,
        currency: 'GBP',
        items: items
      }
    });

    try { sessionStorage.setItem('pbs_purchase_tracked', sessionId); } catch (e) {}
  }

  // ---------------------------------------------------------
  // Begin checkout — gives a funnel step between browsing and
  // the Stripe redirect, so drop-off is visible.
  // ---------------------------------------------------------
  function trackBeginCheckout() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-pbs-checkout], .cart-checkout, #cart-checkout');
      if (!el) return;
      var cart = [];
      try { cart = JSON.parse(localStorage.getItem('pbs_cart') || '[]'); } catch (err) {}
      if (!cart.length) return;
      function num(v) {
        var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.]/g, ''));
        return isNaN(n) ? 0 : n;
      }
      var value = cart.reduce(function (s, c) {
        return s + num(c.price) * (parseInt(c.quantity, 10) || 1);
      }, 0);
      push({ ecommerce: null });
      push({
        event: 'begin_checkout',
        ecommerce: {
          value: Math.round(value * 100) / 100,
          currency: 'GBP',
          items: cart.map(function (c, i) {
            return {
              item_id: String(c.id || ('item-' + i)),
              item_name: String(c.name || 'Product'),
              item_variant: String(c.size || ''),
              price: num(c.price),
              quantity: parseInt(c.quantity, 10) || 1
            };
          })
        }
      });
    }, true);
  }

  // ---------------------------------------------------------
  // Form submissions — one event per form, named so each can be
  // made its own conversion in Google Ads.
  //   free-samples    → sample request
  //   brick-matching  → brick match submission
  //   trade-account   → trade account enquiry
  //   bulk-order      → quote enquiry
  //   contact         → contact form
  // ---------------------------------------------------------
  var FORM_LABELS = {
    'free-samples':   'sample_request',
    'brick-matching': 'brick_match_request',
    'trade-account':  'trade_account_enquiry',
    'bulk-order':     'quote_enquiry',
    'contact':        'contact_enquiry'
  };

  function trackForms() {
    document.addEventListener('submit', function (e) {
      var form = e.target;
      if (!form || form.tagName !== 'FORM') return;
      var name = form.getAttribute('name') || 'unknown';
      push({
        event: 'generate_lead',
        form_name: name,
        lead_type: FORM_LABELS[name] || name,
        page_path: location.pathname
      });
    }, true);
  }

  // ---------------------------------------------------------
  // Contact clicks — phone, WhatsApp and email.
  // These matter more than usual here: a lot of trade business
  // starts with a phone call rather than a basket.
  // ---------------------------------------------------------
  function trackContactClicks() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (!a) return;
      var href = a.getAttribute('href') || '';

      if (/^tel:/i.test(href)) {
        push({ event: 'phone_click', contact_method: 'phone',
               link_url: href, page_path: location.pathname });
      } else if (/wa\.me|api\.whatsapp\.com|whatsapp:/i.test(href)) {
        push({ event: 'whatsapp_click', contact_method: 'whatsapp',
               link_url: href, page_path: location.pathname });
      } else if (/^mailto:/i.test(href)) {
        push({ event: 'email_click', contact_method: 'email',
               link_url: href, page_path: location.pathname });
      }
    }, true);
  }

  function init() {
    trackPurchase();
    trackBeginCheckout();
    trackForms();
    trackContactClicks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
