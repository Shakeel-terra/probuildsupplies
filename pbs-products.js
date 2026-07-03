// Pro Build Supplies — Dynamic Product Loader
// Reads products.json and updates the page content automatically

// ── GLOBAL SITE FIXES (runs on every page) ───────────────────
(function() {

  // 1. Update phone number sitewide
  document.querySelectorAll('a[href*="tel:"]').forEach(function(a) {
    a.href = 'tel:01772287622';
  });
  document.querySelectorAll('.hph').forEach(function(el) {
    el.href = 'tel:01772287622';
    el.textContent = '📞 01772 287622';
  });
  // Also update any visible phone number text in trust strips etc
  document.querySelectorAll('a[href*="tel:"]').forEach(function(a) {
    if (a.textContent.match(/0800|123 4567/)) {
      a.textContent = a.textContent.replace(/0800 123 4567/g, '01772 287622');
    }
  });

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
