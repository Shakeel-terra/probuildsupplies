/* =====================================================================
   Pro Build Supplies — cookie consent (Google Consent Mode v2)

   Loaded on every page BEFORE Google Tag Manager:
     <script src="/pbs-consent.js"></script>

   • Until the visitor chooses, analytics and advertising storage are
     DENIED. Google tags then send only cookieless signals, which Google
     uses to model conversions.
   • "Accept all" grants analytics + ads; "Reject" keeps them denied.
     Both buttons are equally prominent (ICO guidance).
   • The choice is stored in localStorage ("pbs_consent") for 12 months.
   • A "Cookie settings" link in the footer reopens the banner.
   • The basket and checkout are essential and never need consent.
   ===================================================================== */
(function () {
  'use strict';
  var KEY = 'pbs_consent';
  var MAX_AGE = 365 * 24 * 60 * 60 * 1000;   // ask again after 12 months

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  var GRANTED = { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted', analytics_storage: 'granted' };
  var DENIED  = { ad_storage: 'denied',  ad_user_data: 'denied',  ad_personalization: 'denied',  analytics_storage: 'denied' };

  function read() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (v && (v.choice === 'granted' || v.choice === 'denied') && Date.now() - (v.at || 0) < MAX_AGE) return v.choice;
    } catch (e) {}
    return null;
  }
  function save(choice) {
    try { localStorage.setItem(KEY, JSON.stringify({ choice: choice, at: Date.now() })); } catch (e) {}
  }

  // 1. Defaults — must run before GTM loads
  gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied',
    functionality_storage: 'granted', security_storage: 'granted',
    wait_for_update: 500
  });
  gtag('set', 'ads_data_redaction', true);
  gtag('set', 'url_passthrough', true);

  var stored = read();
  if (stored === 'granted') gtag('consent', 'update', GRANTED);

  function apply(choice) {
    save(choice);
    gtag('consent', 'update', choice === 'granted' ? GRANTED : DENIED);
    window.dataLayer.push({ event: 'pbs_consent_update', consent_choice: choice });
    hide();
  }

  // 2. Banner
  var css =
    '#pbs-cc{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;background:#1A1A1A;color:#f2f2f2;' +
      'border-top:4px solid #F55C1B;box-shadow:0 -6px 24px rgba(0,0,0,.25);font-family:inherit}' +
    '#pbs-cc .cc-i{max-width:1180px;margin:0 auto;padding:16px 20px;display:flex;gap:18px;align-items:center;flex-wrap:wrap}' +
    '#pbs-cc p{margin:0;flex:1 1 420px;font-size:.92rem;line-height:1.5}' +
    '#pbs-cc a{color:#FFD000;text-decoration:underline}' +
    '#pbs-cc .cc-b{display:flex;gap:10px;flex-wrap:wrap}' +
    '#pbs-cc button{min-width:130px;padding:11px 18px;border-radius:4px;font-weight:700;font-size:.95rem;cursor:pointer;border:2px solid #fff;font-family:inherit}' +
    // Equal prominence for both choices (ICO guidance)
    '#pbs-cc .cc-acc,#pbs-cc .cc-rej{background:#fff;color:#1A1A1A}' +
    '#pbs-cc button:focus-visible{outline:3px solid #FFD000;outline-offset:2px}' +
    '@media(max-width:600px){#pbs-cc .cc-i{padding:14px}#pbs-cc p{font-size:.86rem}#pbs-cc .cc-b{width:100%}#pbs-cc button{flex:1 1 0;min-width:0}}' +
    '.pbs-cookie-link{color:inherit;text-decoration:underline;cursor:pointer;background:none;border:0;padding:0;font:inherit}';

  var el = null;
  function show() {
    if (el) return;
    if (!document.getElementById('pbs-cc-style')) {
      var st = document.createElement('style'); st.id = 'pbs-cc-style'; st.textContent = css; document.head.appendChild(st);
    }
    el = document.createElement('div');
    el.id = 'pbs-cc';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Cookie choices');
    el.innerHTML =
      '<div class="cc-i">' +
        '<p><strong>Cookies.</strong> We&rsquo;d like to use cookies to understand how our site is used and to measure our adverts. ' +
        'Your basket and checkout work either way. <a href="/privacy-policy.html#cookies">Privacy policy</a></p>' +
        '<div class="cc-b">' +
          '<button type="button" class="cc-rej">Reject</button>' +
          '<button type="button" class="cc-acc">Accept all</button>' +
        '</div>' +
      '</div>';
    el.querySelector('.cc-acc').addEventListener('click', function () { apply('granted'); });
    el.querySelector('.cc-rej').addEventListener('click', function () { apply('denied'); });
    document.body.appendChild(el);
    document.body.style.paddingBottom = el.offsetHeight + 'px';
  }
  function hide() {
    if (!el) return;
    el.parentNode.removeChild(el); el = null;
    document.body.style.paddingBottom = '';
  }
  window.pbsCookieSettings = function () { hide(); show(); var b = el && el.querySelector('.cc-acc'); if (b) b.focus(); };

  // 3. "Cookie settings" link in the footer (static footers and the one pbs-products.js builds)
  function addFooterLink() {
    var bots = document.querySelectorAll('.ft-bot');
    for (var i = 0; i < bots.length; i++) {
      if (bots[i].querySelector('.pbs-cookie-link')) continue;
      var a = document.createElement('a');
      a.href = '#'; a.className = 'pbs-cookie-link'; a.textContent = 'Cookie settings';
      var first = bots[i].firstElementChild;
      if (first) { first.appendChild(document.createTextNode(' \u00b7 ')); first.appendChild(a); }
      else bots[i].appendChild(a);
    }
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('.pbs-cookie-link, [data-cookie-settings]');
    if (t) { e.preventDefault(); window.pbsCookieSettings(); }
  });

  function ready() {
    if (!read()) show();
    addFooterLink();
    // the footer may be rebuilt after load by pbs-products.js
    setTimeout(addFooterLink, 1500);
    setTimeout(addFooterLink, 4000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})();
