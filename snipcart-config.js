// Pro Build Supplies — Snipcart Config
// This file is auto-updated by the Admin Dashboard
// To update: Admin → Settings → Snipcart API Key → Save → Publish

(function() {
  var key = 'YOUR_SNIPCART_PUBLIC_API_KEY'; // replaced by admin on publish
  var el = document.getElementById('snipcart');
  if (el && key && key !== 'YOUR_SNIPCART_PUBLIC_API_KEY') {
    el.setAttribute('data-api-key', key);
  }
})();
