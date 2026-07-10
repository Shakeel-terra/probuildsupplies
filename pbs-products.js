// Pro Build Supplies — Dynamic Product Loader
// Reads products.json and updates the page content automatically

// ── GLOBAL SITE FIXES (runs on every page) ───────────────────
(function() {

  // 1. Update phone number sitewide — covers links, trust strips, Expert Advice, footer
  document.querySelectorAll('a[href*="tel:"]').forEach(function(a) {
    a.href = 'tel:01772287622';
  });
  document.querySelectorAll('.hph').forEach(function(el) {
    el.href = 'tel:01772287622';
    el.textContent = '📞 01772 287622';
  });
  // Scan ALL text nodes on the page and replace the old number wherever it appears
  (function replacePhoneText(el) {
    el.childNodes.forEach(function(node) {
      if (node.nodeType === 3) { // text node
        if (node.textContent.includes('0800 123 4567')) {
          node.textContent = node.textContent.replace(/0800 123 4567/g, '01772 287622');
        }
      } else if (node.nodeType === 1 && node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE') {
        replacePhoneText(node);
      }
    });
  })(document.body);

  // 2. Center search bar + center & space nav links
  var layoutStyle = document.createElement('style');
  layoutStyle.textContent =
    // Center search bar in header
    '.hdr-i{position:relative}' +
    '.srch{position:absolute!important;left:50%;transform:translateX(-50%);width:420px;max-width:calc(100% - 380px);flex:none!important;margin:0!important}' +
    // Center and evenly space nav
    '.nav-i{justify-content:center!important}' +
    '.nav a{padding:11px 20px!important}' +
    // Fix dropdown clipping — nav container must not clip overflow
    '.nav{overflow:visible!important}' +
    '.nav-i{overflow:visible!important}' +
    // Keep logo and cart visible above search on mobile
    '@media(max-width:768px){.srch{position:static!important;transform:none!important;width:100%!important;max-width:100%!important;display:none!important}}';
  document.head.appendChild(layoutStyle);

  // 3. Live search with dropdown
  (function() {
    var input = document.querySelector('.srch input');
    if (!input) return;

    var ss = document.createElement('style');
    ss.textContent =
      '.srch > div, .srch > form{position:relative}' +
      '.search-drop{position:absolute;top:calc(100% + 4px);left:0;right:0;background:#1E1E1E;border:1px solid #444;border-top:3px solid #F55C1B;border-radius:0 0 6px 6px;z-index:99998;box-shadow:0 12px 32px rgba(0,0,0,.5);max-height:400px;overflow-y:auto;display:none}' +
      '.search-drop.open{display:block}' +
      '.sd-item{display:flex;align-items:center;gap:12px;padding:10px 14px;cursor:pointer;border-bottom:1px solid #2a2a2a;text-decoration:none}' +
      '.sd-item:last-child{border-bottom:none}' +
      '.sd-item:hover,.sd-item.active{background:#2a2a2a}' +
      '.sd-img{width:44px;height:44px;flex-shrink:0;background:#2a2a2a;border-radius:3px;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:1.2rem}' +
      '.sd-img img{width:44px;height:44px;object-fit:cover}' +
      '.sd-info{flex:1;min-width:0}' +
      '.sd-name{color:#fff;font-family:"Barlow Condensed",sans-serif;font-weight:700;font-size:.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.sd-cat{color:#888;font-size:.75rem;margin-top:1px}' +
      '.sd-price{color:#F55C1B;font-family:"Barlow Condensed",sans-serif;font-weight:900;font-size:1rem;flex-shrink:0}' +
      '.sd-none{padding:14px;color:#888;font-size:.85rem;text-align:center}' +
      '.sd-all{display:block;padding:10px 14px;text-align:center;color:#F55C1B;font-family:"Barlow Condensed",sans-serif;font-weight:700;font-size:.82rem;letter-spacing:.5px;text-transform:uppercase;border-top:1px solid #333;text-decoration:none}' +
      '.sd-all:hover{background:#2a2a2a}';
    document.head.appendChild(ss);

    var drop = document.createElement('div');
    drop.className = 'search-drop';
    input.parentNode.appendChild(drop);

    var allProducts = [];
    var loaded = false;

    function loadAndSearch() {
      if (loaded) { doSearch(); return; }
      fetch('products.json?v=' + Date.now())
        .then(function(r){ return r.json(); })
        .then(function(data){
          allProducts = (data || []).filter(function(p){ return p.visible !== false; });
          loaded = true;
          doSearch();
        }).catch(function(){});
    }

    function getPrice(p) {
      if (p.sizeVariants && p.sizeVariants.length) {
        var f = p.sizeVariants.find(function(v){ return v.price && v.price !== 'POA'; });
        return f ? f.price : (p.price || 'POA');
      }
      return p.price || 'POA';
    }

    var activeIdx = -1;

    function doSearch() {
      var q = input.value.trim().toLowerCase();
      drop.innerHTML = '';
      if (q.length < 2) { drop.classList.remove('open'); return; }

      var results = allProducts.filter(function(p) {
        return (p.name||'').toLowerCase().includes(q) ||
               (p.category||'').toLowerCase().includes(q) ||
               (p.description||'').toLowerCase().includes(q);
      }).slice(0, 8);

      if (!results.length) {
        drop.innerHTML = '<div class="sd-none">No products found for "' + q + '"</div>';
        drop.classList.add('open');
        return;
      }

      results.forEach(function(p) {
        var a = document.createElement('a');
        a.className = 'sd-item';
        a.href = 'product.html?slug=' + encodeURIComponent(p.slug || '');
        a.innerHTML =
          '<div class="sd-img">' + (p.image ? '<img src="' + p.image + '" alt="">' : '📦') + '</div>' +
          '<div class="sd-info">' +
            '<div class="sd-name">' + (p.name||'') + '</div>' +
            '<div class="sd-cat">' + (p.category||'') + '</div>' +
          '</div>' +
          '<div class="sd-price">' + getPrice(p) + '</div>';
        drop.appendChild(a);
      });

      if (results.length === 8) {
        var all = document.createElement('a');
        all.className = 'sd-all';
        all.href = 'shop.html?q=' + encodeURIComponent(q);
        all.textContent = 'View all results →';
        drop.appendChild(all);
      }

      drop.classList.add('open');
      activeIdx = -1;
    }

    input.addEventListener('input', loadAndSearch);
    input.addEventListener('focus', function(){ if (input.value.length >= 2) drop.classList.add('open'); });

    input.addEventListener('keydown', function(e) {
      var items = drop.querySelectorAll('.sd-item, .sd-all');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIdx = Math.min(activeIdx + 1, items.length - 1);
        items.forEach(function(el, i){ el.classList.toggle('active', i === activeIdx); });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIdx = Math.max(activeIdx - 1, -1);
        items.forEach(function(el, i){ el.classList.toggle('active', i === activeIdx); });
      } else if (e.key === 'Enter') {
        if (activeIdx >= 0 && items[activeIdx]) {
          window.location = items[activeIdx].href;
        } else {
          window.location = 'shop.html?q=' + encodeURIComponent(input.value.trim());
        }
      } else if (e.key === 'Escape') {
        drop.classList.remove('open');
      }
    });

    var btn = input.parentNode.querySelector('button');
    if (btn) {
      btn.addEventListener('click', function() {
        if (input.value.trim()) window.location = 'shop.html?q=' + encodeURIComponent(input.value.trim());
      });
    }

    document.addEventListener('click', function(e) {
      if (!input.parentNode.contains(e.target)) drop.classList.remove('open');
    });
  })();

  // 4. Update footer sitewide
  (function() {
    var footer = document.querySelector('footer .ft-i');
    if (!footer) return;
    footer.innerHTML =
      '<div class="ftg">' +
        '<div class="ft-brand">' +
          '<a href="index.html" class="logo">Pro Build <b>Supplies</b></a>' +
          '<p>Premium building materials at trade prices, delivered direct to your door or site. Free delivery on every order.</p>' +
          '<p style="margin-top:12px;font-size:.78rem;color:#555;line-height:1.9">' +
            'Pro Build Supplies Preston Ltd<br>' +
            'Suite 23, Derby House<br>' +
            'Lytham Road, Preston, PR2 8JE<br>' +
            'Company No: 16777639 &nbsp;|&nbsp; VAT: 347928163' +
          '</p>' +
        '</div>' +
        '<div class="fc"><h4>Products</h4>' +
          '<a href="handmade-bricks.html">Handmade Bricks</a>' +
          '<a href="reclaimed-bricks.html">Reclaimed Bricks</a>' +
          '<a href="porcelain-paving.html">Porcelain Paving</a>' +
          '<a href="indian-sandstone.html">Indian Sandstone</a>' +
          '<a href="mdf.html">MDF Sheets</a>' +
          '<a href="plasterboards.html">Plasterboards</a>' +
        '</div>' +
        '<div class="fc"><h4>Help &amp; Info</h4>' +
          '<a href="delivery.html">Delivery Info</a>' +
          '<a href="returns.html">Returns Policy</a>' +
          '<a href="samples.html">Free Samples</a>' +
          '<a href="trade-accounts.html">Trade Accounts</a>' +
          '<a href="contact.html">Contact Us</a>' +
        '</div>' +
        '<div class="fc"><h4>Company</h4>' +
          '<a href="about.html">About Us</a>' +
          '<a href="privacy-policy.html">Privacy Policy</a>' +
          '<a href="terms.html">Terms &amp; Conditions</a>' +
          '<a href="mailto:tradecounter@probuildsupplies.uk" style="margin-top:10px;word-break:break-all">📧 tradecounter@probuildsupplies.uk</a>' +
          '<a href="tel:01772287622">📞 01772 287622</a>' +
        '</div>' +
      '</div>' +
      '<div class="ft-bot">' +
        '<span>&copy; 2026 Pro Build Supplies Preston Ltd. All rights reserved.</span>' +
        '<div class="pays"><span class="pay">VISA</span><span class="pay">Mastercard</span><span class="pay">PayPal</span><span class="pay">Klarna</span><span class="pay">AMEX</span></div>' +
      '</div>';
  })();

  // Add Plasterboards nav item after MDF
  (function() {
    var navI = document.querySelector('.nav-i');
    if (!navI) return;
    // Don't add twice
    if (navI.querySelector('a[href="plasterboards.html"]')) return;
    var pb = document.createElement('a');
    pb.href = 'plasterboards.html';
    pb.textContent = '📋 Plasterboards';
    if (window.location.pathname.endsWith('/plasterboards') ||
        window.location.pathname.includes('plasterboards')) {
      pb.classList.add('cur');
    }
    // Try to insert after MDF, otherwise just append to nav
    var mdfLink = navI.querySelector('a[href="mdf.html"]') ||
                  Array.from(navI.querySelectorAll('a')).find(function(a) {
                    return a.textContent.trim().includes('MDF');
                  });
    if (mdfLink && mdfLink.nextSibling) {
      navI.insertBefore(pb, mdfLink.nextSibling);
    } else if (mdfLink) {
      mdfLink.parentNode.appendChild(pb);
    } else {
      navI.appendChild(pb);
    }
  })();

  // 3. Fix dropdown triggering on scroll
  // Override CSS :hover with JS class-based approach
  var ddStyle = document.createElement('style');
  ddStyle.textContent =
    '.ni .dd{display:none!important}' +
    '.ni.ni-open .dd{display:block!important}';
  (document.head || document.documentElement).appendChild(ddStyle);

  // Disable pointer-events on the entire nav during scroll —
  // this stops the browser from activating CSS :hover on nav items at all
  var navEl = document.getElementById('nav');
  var scrollTimer;

  window.addEventListener('scroll', function() {
    // Freeze the nav — no hover events possible while scrolling
    if (navEl) navEl.style.pointerEvents = 'none';
    // Close any open dropdowns
    document.querySelectorAll('.ni.ni-open').forEach(function(ni) {
      ni.classList.remove('ni-open');
    });
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function() {
      // Re-enable nav after scroll stops
      if (navEl) navEl.style.pointerEvents = '';
    }, 150);
  }, { passive: true });

  // JS-controlled hover for dropdowns
  document.querySelectorAll('.ni').forEach(function(ni) {
    ni.addEventListener('mouseenter', function() {
      ni.classList.add('ni-open');
    });
    ni.addEventListener('mouseleave', function() {
      ni.classList.remove('ni-open');
    });
  });

})();
// ─────────────────────────────────────────────────────────────

(function() {
  'use strict';

  var BASE = '';
  var isProductPage = window.location.pathname.includes('/products/');
  if (isProductPage) BASE = '../';

  // ── ANTI-FLASH: hide the static grid immediately so the old hardcoded
  // products never appear on screen (or get clicked) before the real
  // dashboard data has loaded in ─────────────────────────────────────
  var __hideEl = null;
  (function(){
    var path = window.location.pathname;
    if (isProductPage) return;
    var isDynamicListPage =
      path.includes('shop.html') || path.endsWith('/shop') ||
      path.includes('handmade-bricks.html') || path.endsWith('/handmade-bricks') ||
      path.includes('reclaimed-bricks.html') || path.endsWith('/reclaimed-bricks') ||
      path.includes('porcelain-paving.html') || path.endsWith('/porcelain-paving') ||
      path.includes('indian-sandstone.html') || path.endsWith('/indian-sandstone') ||
      path.includes('mdf.html') || path.endsWith('/mdf') ||
      path.includes('plasterboards.html') || path.endsWith('/plasterboards');
    if (!isDynamicListPage) return;
    __hideEl = document.getElementById('sfgrid') || document.querySelector('.pgrid');
    if (__hideEl) {
      __hideEl.style.opacity = '0';
      __hideEl.style.pointerEvents = 'none';
      __hideEl.style.transition = 'opacity .15s ease';
    }
  })();
  function __reveal() {
    if (__hideEl) {
      __hideEl.style.opacity = '1';
      __hideEl.style.pointerEvents = '';
    }
  }

  // ── LOAD PRODUCTS.JSON ────────────────────────────────────
  function loadProducts(cb) {
    var url = BASE + 'products.json?v=' + Date.now();
    fetch(url)
      .then(function(r) { return r.json(); })
      .then(function(data) { cb(null, Array.isArray(data) ? data : []); })
      .catch(function(e) { cb(e, []); });
  }

  // ── HELPERS ───────────────────────────────────────────────
  function catIcon(c) {
    var m = {'Handmade Bricks':'🧱','Reclaimed Bricks':'♻️','Porcelain Paving':'🪨','Indian Sandstone':'🌿','MDF':'🪵','Plasterboards':'📋'};
    return m[c] || '📦';
  }
  function catBg(c) {
    if (!c) return 'background:linear-gradient(135deg,#C0392B20,#C0392B50)';
    if (c.includes('Brick'))    return 'background:linear-gradient(135deg,#C0392B20,#C0392B50)';
    if (c.includes('Porcelain'))return 'background:linear-gradient(135deg,#62656720,#62656750)';
    if (c.includes('Sandstone'))return 'background:linear-gradient(135deg,#C8A45A20,#C8A45A50)';
    return 'background:linear-gradient(135deg,#A0522D20,#A0522D50)';
  }
  function esc(s) { return (s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function getPrice(p) {
    if (p.sizeVariants && p.sizeVariants.length) {
      var first = p.sizeVariants.find(function(v){return v.price && v.price !== 'POA';});
      return first ? first.price : (p.price || 'POA');
    }
    return p.price || 'POA';
  }

  // ── PRODUCT CARD HTML ─────────────────────────────────────
  function makeCard(p, prefix) {
    prefix = prefix || '';
    var price = getPrice(p);
    var img = p.image
      ? '<img src="'+p.image+'" alt="'+esc(p.name)+'" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0">'
      : catIcon(p.category);
    var buyBtn = (price === 'POA' || !price)
      ? '<a href="'+prefix+'contact.html" class="pbtn">📞 Enquire</a>'
      : '<a href="'+prefix+'product.html?slug='+encodeURIComponent(p.slug||'')+'" class="pbtn">View Product</a>';
    return '<a href="'+prefix+'product.html?slug='+encodeURIComponent(p.slug||'')+'" class="pcard">'
      + '<div class="pimg" style="'+catBg(p.category)+'">'+img+'</div>'
      + '<div class="pinfo">'
      + '<div class="pcat">'+esc(p.category)+'</div>'
      + '<div class="pname">'+esc(p.name)+'</div>'
      + '<div class="pprice">'+esc(price)+'</div>'
      + '</div></a>';
  }

  // ── SHOP PAGE ─────────────────────────────────────────────
  function initShop(products) {
    var grid = document.getElementById('sfgrid');
    var cnt  = document.getElementById('sfcnt');
    if (!grid) return;

    var vis = products.filter(function(p){ return p.visible !== false; });
    grid.innerHTML = vis.map(function(p){ return makeCard(p, ''); }).join('');
    if (cnt) cnt.textContent = 'Showing all ' + vis.length + ' products';
    __reveal();

    // Filter buttons
    document.querySelectorAll('.sfb').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var f = this.dataset.f;
        document.querySelectorAll('.sfb').forEach(function(b){ b.classList.remove('on'); });
        this.classList.add('on');
        var shown = 0;
        grid.querySelectorAll('.pcard').forEach(function(card, i) {
          var cat = vis[i] ? vis[i].category : '';
          var show = f === 'all' || cat === f;
          card.style.display = show ? '' : 'none';
          if (show) shown++;
        });
        if (cnt) cnt.textContent = (f === 'all' ? 'Showing all ' : 'Showing ') + shown + ' products';
      });
    });
  }

  // ── CATEGORY LISTING PAGES ────────────────────────────────
  function initCategoryPage(products, categoryFilter) {
    var grid = document.querySelector('.pgrid');
    if (!grid) return;
    var filtered = products.filter(function(p){
      return p.visible !== false && (!categoryFilter || p.category === categoryFilter);
    });
    if (!filtered.length) { __reveal(); return; }
    grid.innerHTML = filtered.map(function(p){ return makeCard(p, ''); }).join('');
    __reveal();
  }

  // ── PRODUCT PAGE ──────────────────────────────────────────
  function initProductPage(products) {
    var slug = window.location.pathname.split('/').pop().replace('.html','');
    var prod = products.find(function(p){ return p.slug === slug; });
    if (!prod) return;

    // Update image
    if (prod.image) {
      var box = document.querySelector('.pp-imgbox');
      if (box) box.innerHTML = '<img src="'+prod.image+'" alt="'+esc(prod.name)+'" style="width:100%;height:100%;object-fit:cover">';
    }

    // Update price
    var priceEl = document.getElementById('pp-price');
    var noteEl  = document.getElementById('pp-pnote');

    // Size variants dropdown
    if (prod.sizeVariants && prod.sizeVariants.length > 0) {
      // Update price to first variant
      var firstV = prod.sizeVariants[0];
      if (priceEl && firstV.price) priceEl.textContent = firstV.price;
      if (noteEl  && firstV.pack)  noteEl.textContent  = '📦 ' + firstV.pack + ' | Free delivery';

      // Rebuild size select
      var sel = document.getElementById('szSel');
      if (sel) {
        sel.innerHTML = prod.sizeVariants.map(function(v, i) {
          return '<option value=\''+JSON.stringify({p:v.price,n:v.pack})+'\' '+(i===0?'selected':'')+'>'+v.size+' — '+v.pack+(v.price?' — '+v.price:'')+' </option>';
        }).join('');
        // Add change handler
        sel.addEventListener('change', function() {
          try {
            var v = JSON.parse(this.value);
            if (priceEl && v.p) priceEl.textContent = v.p;
            if (noteEl  && v.n) noteEl.textContent  = '📦 ' + v.n + ' | Free delivery';
            // Update snipcart button
            var atcBtn = document.querySelector('.snipcart-add-item');
            if (atcBtn && v.p) {
              var numPrice = parseFloat((v.p||'').replace(/[^0-9.]/g,''));
              if (!isNaN(numPrice)) atcBtn.dataset.itemPrice = numPrice.toFixed(2);
              atcBtn.dataset.itemCustom1Value = this.options[this.selectedIndex].text;
            }
          } catch(e){}
        });
      }
    } else if (prod.price) {
      if (priceEl) priceEl.textContent = prod.price;
      if (noteEl && prod.priceNote) noteEl.textContent = '📦 ' + prod.priceNote;
    }

    // Update buy button / add to cart
    var actDiv = document.querySelector('.pp-acts');
    if (actDiv && prod.price !== 'POA' && prod.price) {
      var rawPrice = parseFloat((getPrice(prod)||'').replace(/[^0-9.]/g,''));
      if (!isNaN(rawPrice) && rawPrice > 0) {
        // Update snipcart button data
        var atcBtn = document.querySelector('.snipcart-add-item');
        if (atcBtn) {
          atcBtn.dataset.itemPrice = rawPrice.toFixed(2);
          atcBtn.dataset.itemName  = prod.name;
          if (prod.image) atcBtn.dataset.itemImage = prod.image;
          if (prod.delivery === 'included') atcBtn.dataset.itemShippable = 'false';
          // Set size custom field if variants exist
          if (prod.sizeVariants && prod.sizeVariants.length) {
            atcBtn.dataset.itemCustom1Name  = 'Size';
            atcBtn.dataset.itemCustom1Value = prod.sizeVariants[0].size + ' — ' + prod.sizeVariants[0].pack;
          }
        }
      }
    }

    // Update related products
    var relGrid = document.querySelector('.rgrid');
    if (relGrid) {
      var related = products.filter(function(p){
        return p.visible !== false && p.slug !== slug && p.category === prod.category;
      }).slice(0, 4);
      if (related.length) {
        relGrid.innerHTML = related.map(function(r) {
          var img2 = r.image
            ? '<img src="'+r.image+'" alt="" style="width:100%;height:100%;object-fit:cover">'
            : catIcon(r.category);
          return '<a href="'+r.slug+'.html" class="pcard">'
            +'<div class="pimg" style="'+catBg(r.category)+'">'+img2+'</div>'
            +'<div class="pinfo"><div class="pcat">'+esc(r.category)+'</div><div class="pname">'+esc(r.name)+'</div>'
            +'<div class="pprice">'+esc(getPrice(r))+'</div><span class="pbtn">View Product</span></div></a>';
        }).join('');
      }
    }
  }

  // ── HOMEPAGE FEATURED PRODUCTS ────────────────────────────
  function initHomepage(products) {
    // Look for a featured products grid on the homepage
    var featGrid = document.getElementById('featuredGrid');
    if (!featGrid) return;
    var featured = products.filter(function(p){ return p.visible !== false; }).slice(0, 8);
    featGrid.innerHTML = featured.map(function(p){ return makeCard(p, ''); }).join('');
  }

  // ── INIT ──────────────────────────────────────────────────
  loadProducts(function(err, products) {
    if (err || !products.length) { __reveal(); return; }

    var path = window.location.pathname;

    if (path.includes('/products/')) {
      initProductPage(products);
      return;
    }

    if (path.includes('shop.html') || path.endsWith('/shop')) {
      initShop(products); return;
    }
    if (path.includes('handmade-bricks.html') || path.endsWith('/handmade-bricks')) {
      initCategoryPage(products, 'Handmade Bricks'); return;
    }
    if (path.includes('reclaimed-bricks.html') || path.endsWith('/reclaimed-bricks')) {
      initCategoryPage(products, 'Reclaimed Bricks'); return;
    }
    if (path.includes('porcelain-paving.html') || path.endsWith('/porcelain-paving')) {
      initCategoryPage(products, 'Porcelain Paving'); return;
    }
    if (path.includes('indian-sandstone.html') || path.endsWith('/indian-sandstone')) {
      initCategoryPage(products, 'Indian Sandstone'); return;
    }
    if (path.includes('mdf.html') || path.endsWith('/mdf')) {
      initCategoryPage(products, 'MDF'); return;
    }
    if (path.includes('plasterboards.html') || path.endsWith('/plasterboards')) {
      initCategoryPage(products, 'Plasterboards'); return;
    }
    if (path.endsWith('/') || path.includes('index.html')) {
      initHomepage(products); return;
    }
  });

})();

// ── PBS CART SYSTEM (replaces Snipcart) ──────────────────────
(function() {
  'use strict';

  // ── STORAGE ──────────────────────────────────────────────────
  function getCart() {
    try { return JSON.parse(localStorage.getItem('pbs_cart') || '[]'); }
    catch(e) { return []; }
  }
  function saveCart(cart) {
    try { localStorage.setItem('pbs_cart', JSON.stringify(cart)); }
    catch(e) {}
  }

  // ── CSS ───────────────────────────────────────────────────────
  var css = document.createElement('style');
  css.textContent = [
    '.pbs-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99990;opacity:0;pointer-events:none;transition:opacity .3s}',
    '.pbs-overlay.on{opacity:1;pointer-events:auto}',
    '.pbs-drawer{position:fixed;top:0;right:0;width:420px;max-width:100vw;height:100vh;background:#fff;z-index:99999;transform:translateX(100%);transition:transform .35s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;box-shadow:-8px 0 40px rgba(0,0,0,.2)}',
    '.pbs-drawer.on{transform:translateX(0)}',
    '.pbs-dh{background:#1A1A1A;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}',
    '.pbs-dh span{font-family:"Barlow Condensed",sans-serif;font-weight:900;font-size:1.2rem;color:#fff;letter-spacing:.5px;text-transform:uppercase}',
    '.pbs-dclose{background:none;border:none;color:#888;font-size:1.4rem;cursor:pointer;padding:4px;line-height:1;transition:color .2s}',
    '.pbs-dclose:hover{color:#fff}',
    '.pbs-items{flex:1;overflow-y:auto;padding:16px}',
    '.pbs-empty{text-align:center;padding:60px 20px;color:#888}',
    '.pbs-empty p{font-size:.9rem;margin-top:8px}',
    '.pbs-item{display:flex;gap:12px;padding:14px 0;border-bottom:1px solid #eee}',
    '.pbs-item:last-child{border-bottom:none}',
    '.pbs-iimg{width:70px;height:70px;object-fit:cover;border-radius:4px;flex-shrink:0;background:#f0ede8}',
    '.pbs-iimg-ph{width:70px;height:70px;border-radius:4px;flex-shrink:0;background:#f0ede8;display:flex;align-items:center;justify-content:center;font-size:1.8rem}',
    '.pbs-iinfo{flex:1;min-width:0}',
    '.pbs-iname{font-family:"Barlow Condensed",sans-serif;font-weight:700;font-size:.95rem;color:#1A1A1A;line-height:1.2;margin-bottom:3px}',
    '.pbs-isize{font-size:.75rem;color:#888;margin-bottom:8px}',
    '.pbs-iqty{display:flex;align-items:center;gap:8px}',
    '.pbs-iqbtn{background:#f0ede8;border:none;width:28px;height:28px;border-radius:4px;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s}',
    '.pbs-iqbtn:hover{background:#F55C1B;color:#fff}',
    '.pbs-iqnum{font-weight:700;font-size:.9rem;min-width:20px;text-align:center}',
    '.pbs-irem{background:none;border:none;color:#ccc;cursor:pointer;font-size:.8rem;margin-left:auto;padding:4px;transition:color .2s}',
    '.pbs-irem:hover{color:#e53e3e}',
    '.pbs-iprice{font-family:"Barlow Condensed",sans-serif;font-weight:900;font-size:1rem;color:#1A1A1A;text-align:right;flex-shrink:0}',
    '.pbs-foot{padding:16px 20px;border-top:2px solid #f0ede8;background:#fff;flex-shrink:0}',
    '.pbs-subtotal{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}',
    '.pbs-subtotal span:first-child{font-size:.85rem;color:#888}',
    '.pbs-subtotal span:last-child{font-family:"Barlow Condensed",sans-serif;font-weight:900;font-size:1.3rem;color:#1A1A1A}',
    '.pbs-note{font-size:.75rem;color:#888;margin-bottom:14px;line-height:1.5}',
    '.pbs-checkout{display:block;width:100%;background:#F55C1B;color:#fff;border:none;padding:15px;font-family:"Barlow Condensed",sans-serif;font-weight:900;font-size:1.1rem;letter-spacing:.8px;text-transform:uppercase;border-radius:4px;cursor:pointer;transition:background .2s}',
    '.pbs-checkout:hover{background:#d94d0f}',
    '.pbs-checkout:disabled{background:#ccc;cursor:not-allowed}',
    '.pbs-secure{text-align:center;font-size:.73rem;color:#888;margin-top:10px}',
    '.pbs-poa-note{background:#fff8e1;border:1px solid #FFD000;border-radius:4px;padding:10px 12px;font-size:.78rem;color:#555;margin-top:10px;line-height:1.5}',
  ].join('');
  document.head.appendChild(css);

  // ── HTML ──────────────────────────────────────────────────────
  var overlay = document.createElement('div');
  overlay.className = 'pbs-overlay';
  overlay.id = 'pbs-overlay';
  document.body.appendChild(overlay);

  var drawer = document.createElement('div');
  drawer.className = 'pbs-drawer';
  drawer.id = 'pbs-drawer';
  drawer.innerHTML =
    '<div class="pbs-dh"><span>🛒 Your Cart</span><button class="pbs-dclose" id="pbs-close">✕</button></div>' +
    '<div class="pbs-items" id="pbs-items"></div>' +
    '<div class="pbs-foot" id="pbs-foot" style="display:none">' +
      '<div class="pbs-subtotal"><span>Subtotal (ex. delivery)</span><span id="pbs-total">£0.00</span></div>' +
      '<p class="pbs-note">Free delivery on all orders to UK mainland. Shipping will be confirmed at checkout.</p>' +
      '<button class="pbs-checkout" id="pbs-checkout">Pay Securely with Stripe →</button>' +
      '<p class="pbs-secure">🔒 Secured by Stripe &nbsp;|&nbsp; Visa, Mastercard, Apple Pay, Google Pay</p>' +
    '</div>';
  document.body.appendChild(drawer);

  // ── OPEN / CLOSE ──────────────────────────────────────────────
  function openCart() {
    renderCart();
    overlay.classList.add('on');
    drawer.classList.add('on');
    document.body.style.overflow = 'hidden';
  }
  function closeCart() {
    overlay.classList.remove('on');
    drawer.classList.remove('on');
    document.body.style.overflow = '';
  }

  overlay.addEventListener('click', closeCart);
  document.getElementById('pbs-close').addEventListener('click', closeCart);
  document.addEventListener('keydown', function(e){ if(e.key==='Escape') closeCart(); });

  // ── CART OPERATIONS ───────────────────────────────────────────
  function addItem(item) {
    var cart = getCart();
    var key = item.id + '|' + (item.size || '');
    var existing = cart.find(function(c){ return (c.id+'|'+(c.size||'')) === key; });
    if (existing) {
      existing.quantity = (existing.quantity || 1) + 1;
    } else {
      item.quantity = 1;
      cart.push(item);
    }
    saveCart(cart);
    updateCount();
    openCart();
  }

  function removeItem(id, size) {
    var cart = getCart().filter(function(c){ return !(c.id===id && (c.size||'')===(size||'')); });
    saveCart(cart);
    updateCount();
    renderCart();
  }

  function changeQty(id, size, delta) {
    var cart = getCart();
    var item = cart.find(function(c){ return c.id===id && (c.size||'')===(size||''); });
    if (!item) return;
    item.quantity = Math.max(1, (item.quantity||1) + delta);
    saveCart(cart);
    updateCount();
    renderCart();
  }

  function calcTotal(cart) {
    return cart.reduce(function(sum, item) {
      var p = parseFloat(String(item.price || '0').replace(/[^0-9.]/g,''));
      return sum + (isNaN(p) ? 0 : p * (item.quantity || 1));
    }, 0);
  }

  // ── RENDER ────────────────────────────────────────────────────
  function renderCart() {
    var cart = getCart();
    var itemsEl = document.getElementById('pbs-items');
    var footEl = document.getElementById('pbs-foot');
    var totalEl = document.getElementById('pbs-total');
    if (!itemsEl) return;

    if (!cart.length) {
      itemsEl.innerHTML =
        '<div class="pbs-empty">🛒<br><p>Your cart is empty</p>' +
        '<p style="margin-top:16px"><a href="shop.html" style="color:#F55C1B;font-weight:600">Browse products →</a></p></div>';
      if (footEl) footEl.style.display = 'none';
      return;
    }

    var hasPOA = cart.some(function(c){ return !c.price || c.price==='POA'; });
    var buyable = cart.filter(function(c){ return c.price && c.price!=='POA'; });

    itemsEl.innerHTML = cart.map(function(item) {
      var imgHtml = item.image
        ? '<img class="pbs-iimg" src="'+item.image+'" alt="'+esc(item.name)+'">'
        : '<div class="pbs-iimg-ph">📦</div>';
      var priceEach = parseFloat(String(item.price||'0').replace(/[^0-9.]/g,''));
      var linePrice = isNaN(priceEach) ? 'POA' : '£'+(priceEach*(item.quantity||1)).toFixed(2);
      var safeId = esc(item.id);
      var safeSize = esc(item.size||'');
      return '<div class="pbs-item">' +
        imgHtml +
        '<div class="pbs-iinfo">' +
          '<div class="pbs-iname">'+esc(item.name)+'</div>' +
          (item.size ? '<div class="pbs-isize">'+esc(item.size)+'</div>' : '') +
          (item.price && item.price!=='POA'
            ? '<div class="pbs-iqty">' +
                '<button class="pbs-iqbtn" onclick="pbsQty(\''+safeId+'\',\''+safeSize+'\',-1)">−</button>' +
                '<span class="pbs-iqnum">'+(item.quantity||1)+'</span>' +
                '<button class="pbs-iqbtn" onclick="pbsQty(\''+safeId+'\',\''+safeSize+'\',1)">+</button>' +
              '</div>'
            : '<div style="font-size:.75rem;color:#888;margin-top:4px">Price on application</div>'
          ) +
        '</div>' +
        '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">' +
          '<div class="pbs-iprice">'+linePrice+'</div>' +
          '<button class="pbs-irem" onclick="pbsRem(\''+safeId+'\',\''+safeSize+'\')">✕ Remove</button>' +
        '</div>' +
      '</div>';
    }).join('');

    if (hasPOA) {
      itemsEl.innerHTML += '<div class="pbs-poa-note">⚠️ Some items are priced on application. To enquire, please <a href="contact.html" style="color:#F55C1B">contact us</a> or call 01772 287622.</div>';
    }

    if (footEl) {
      var total = calcTotal(buyable.length ? buyable.map(function(c){
        return cart.find(function(x){ return x.id===c.id && (x.size||'')===(c.size||''); })||c;
      }) : []);
      if (totalEl) totalEl.textContent = '£'+total.toFixed(2);
      footEl.style.display = buyable.length ? '' : 'none';
    }
  }

  // ── COUNT ─────────────────────────────────────────────────────
  function esc(s){ return String(s||'').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function updateCount() {
    var cart = getCart();
    var total = cart.reduce(function(s,c){ return s+(c.quantity||1); }, 0);

    // Update any existing snipcart-items-count spans
    document.querySelectorAll('.snipcart-items-count').forEach(function(el){
      el.textContent = total;
      el.style.cssText = 'background:#FFD000;color:#1A1A1A;font-size:.65rem;font-weight:700;border-radius:10px;padding:1px 5px;margin-left:3px;font-family:"Barlow Condensed",sans-serif;vertical-align:middle;display:' + (total ? 'inline' : 'none');
    });

    // Also inject our own badge into every cart button in case span is missing
    document.querySelectorAll('.cart-btn').forEach(function(btn) {
      // Hide the old snipcart span to avoid duplicates
      var old = btn.querySelector('.snipcart-items-count');
      if (old) old.style.display = 'none';

      var badge = btn.querySelector('.pbs-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'pbs-badge';
        badge.style.cssText = 'background:#FFD000;color:#1A1A1A;font-size:.65rem;font-weight:700;border-radius:10px;padding:1px 6px;margin-left:4px;font-family:"Barlow Condensed",sans-serif;vertical-align:middle;display:none';
        btn.appendChild(badge);
      }
      badge.textContent = total;
      badge.style.display = total ? 'inline' : 'none';
    });
  }

  // ── GLOBAL HELPERS (called from inline onclick) ───────────────
  window.pbsRem = removeItem;
  window.pbsQty = changeQty;

  // ── CHECKOUT ─────────────────────────────────────────────────
  document.getElementById('pbs-checkout').addEventListener('click', function() {
    var cart = getCart().filter(function(c){ return c.price && c.price!=='POA'; });
    if (!cart.length) return;
    var btn = this;
    btn.disabled = true;
    btn.textContent = 'Redirecting to Stripe…';

    var base = window.location.origin;
    fetch('/.netlify/functions/create-checkout', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        items: cart,
        successUrl: base + '/success.html?session_id={CHECKOUT_SESSION_ID}',
        cancelUrl: base + window.location.pathname + window.location.search,
      })
    })
    .then(function(r){ return r.json(); })
    .then(function(data){
      if (data.url) {
        window.location = data.url;
      } else {
        alert('Sorry, there was a problem starting checkout. Please call us on 01772 287622.');
        btn.disabled = false;
        btn.textContent = 'Pay Securely with Stripe →';
      }
    })
    .catch(function(){
      alert('Sorry, there was a problem. Please call us on 01772 287622.');
      btn.disabled = false;
      btn.textContent = 'Pay Securely with Stripe →';
    });
  });

  // ── INTERCEPT CART BUTTON IN HEADER ──────────────────────────
  document.addEventListener('click', function(e) {
    var cartBtn = e.target.closest('.cart-btn, .snipcart-checkout');
    if (cartBtn) { e.preventDefault(); e.stopPropagation(); openCart(); return; }

    var addBtn = e.target.closest('.snipcart-add-item, #pp-addbtn, .pbs-add');
    if (addBtn) {
      e.preventDefault(); e.stopPropagation();
      var id = addBtn.dataset.itemId || addBtn.dataset.productSlug || '';
      var name = addBtn.dataset.itemName || addBtn.dataset.productName || '';
      var price = addBtn.dataset.itemPrice || '';
      var image = addBtn.dataset.itemImage || addBtn.dataset.productImage || '';
      var size = addBtn.dataset.itemCustom1Value || addBtn.dataset.itemSize || '';
      if (!name || !id) return;
      if (price) price = '£' + parseFloat(price).toFixed(2);
      addItem({ id: id, name: name, price: price, image: image, size: size });
    }
  }, true);

  // ── INIT ─────────────────────────────────────────────────────
  updateCount();

})();
