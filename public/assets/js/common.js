/* ===== Sandton Garden — shared frontend runtime ===== */
(function () {
  'use strict';
  const SG = window.SG = window.SG || {};
  const faNum = (n) => Number(n || 0).toLocaleString('fa-IR');

  // ---------- API ----------
  async function api(path, opts = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    const token = localStorage.getItem('sg_admin_token');
    if (token && path.includes('/admin/')) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(path, Object.assign({}, opts, { headers, body: opts.body ? JSON.stringify(opts.body) : undefined }));
    let data = null; try { data = await res.json(); } catch {}
    if (!res.ok) throw Object.assign(new Error((data && data.error) || 'خطا'), { status: res.status, data });
    return data;
  }
  SG.api = api;
  SG.faNum = faNum;

  // ---------- Settings ----------
  let _settings = null;
  SG.getSettings = async function () {
    if (_settings) return _settings;
    try { _settings = await api('/api/settings'); } catch { _settings = {}; }
    return _settings;
  };
  SG.fmtPrice = function (n) {
    if (!n || n <= 0) return 'به‌زودی';
    const unit = (_settings && _settings.priceUnit) || 'تومان';
    return faNum(n) + ' ' + unit;
  };

  // ---------- Menu cache (for cart) ----------
  let _menuIndex = null;
  SG.getMenu = async function () {
    if (_menuIndex) return _menuIndex;
    const data = await api('/api/menu');
    _menuIndex = { categories: data.categories, byId: {} };
    data.categories.forEach(c => c.items.forEach(i => { _menuIndex.byId[i.id] = i; }));
    return _menuIndex;
  };

  // ---------- Toast ----------
  let toastT;
  SG.toast = function (msg, isErr) {
    let el = document.getElementById('sg-toast');
    if (!el) { el = document.createElement('div'); el.id = 'sg-toast'; el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = msg; el.className = 'toast show' + (isErr ? ' err' : '');
    clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 3000);
  };

  // ---------- Cart ----------
  const CART_KEY = 'sg_cart';
  SG.cart = {
    get() { try { return JSON.parse(localStorage.getItem(CART_KEY) || '{}'); } catch { return {}; } },
    set(c) { localStorage.setItem(CART_KEY, JSON.stringify(c)); SG._renderCart(); SG._updateCount(); },
    add(id, q = 1) { const c = this.get(); c[id] = (c[id] || 0) + q; if (c[id] <= 0) delete c[id]; this.set(c); },
    setQty(id, q) { const c = this.get(); if (q <= 0) delete c[id]; else c[id] = q; this.set(c); },
    remove(id) { const c = this.get(); delete c[id]; this.set(c); },
    clear() { this.set({}); },
    count() { return Object.values(this.get()).reduce((a, b) => a + b, 0); }
  };
  SG.addToCart = function (id) { SG.cart.add(id, 1); SG.toast('به سبد اضافه شد ✅'); };

  SG._updateCount = function () {
    const n = SG.cart.count();
    document.querySelectorAll('[data-cart-count]').forEach(e => { e.textContent = faNum(n); e.style.display = n ? '' : 'none'; });
  };

  async function cartTotal() {
    const idx = await SG.getMenu(); const c = SG.cart.get(); let t = 0;
    for (const [id, q] of Object.entries(c)) { const it = idx.byId[id]; if (it) t += (it.price || 0) * q; }
    return t;
  }

  SG._renderCart = async function () {
    const list = document.getElementById('sg-cart-list');
    if (!list) return;
    const idx = await SG.getMenu(); const c = SG.cart.get(); const entries = Object.entries(c);
    if (!entries.length) { list.innerHTML = '<div class="empty">سبد خرید خالی است.</div>'; }
    else {
      list.innerHTML = '';
      entries.forEach(([id, q]) => {
        const it = idx.byId[id]; if (!it) return;
        const row = document.createElement('div'); row.className = 'cart-item';
        row.innerHTML = `<img src="${it.image || 'logo.jpg'}" alt="" onerror="this.src='logo.jpg'">
          <div><div class="ct">${it.title}</div><div class="cm">${SG.fmtPrice(it.price)} × ${faNum(q)}</div></div>
          <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
            <div class="cart-qty"><button data-m>−</button><span>${faNum(q)}</span><button data-p>+</button></div>
            <button class="btn sm danger" data-r>حذف</button></div>`;
        row.querySelector('[data-m]').onclick = () => SG.cart.add(id, -1);
        row.querySelector('[data-p]').onclick = () => SG.cart.add(id, 1);
        row.querySelector('[data-r]').onclick = () => SG.cart.remove(id);
        list.appendChild(row);
      });
    }
    const sum = document.getElementById('sg-cart-sum');
    if (sum) sum.textContent = SG.fmtPrice(await cartTotal());
  };

  SG.openCart = function () { const d = document.getElementById('sg-cart'); if (d) { d.classList.add('active'); SG._renderCart(); } };
  SG.closeCart = function () { const d = document.getElementById('sg-cart'); if (d) d.classList.remove('active'); };

  async function orderText() {
    const idx = await SG.getMenu(); const c = SG.cart.get();
    const lines = Object.entries(c).map(([id, q]) => { const it = idx.byId[id]; return it ? `• ${it.title} — ${faNum(q)} × ${SG.fmtPrice(it.price)}` : ''; }).filter(Boolean);
    const total = await cartTotal();
    const name = (document.getElementById('co-name') || {}).value || '';
    const phone = (document.getElementById('co-phone') || {}).value || '';
    const typeSel = document.getElementById('co-type');
    const typeTxt = typeSel ? typeSel.options[typeSel.selectedIndex].text : '';
    const table = (document.getElementById('co-table') || {}).value || '';
    const addr = (document.getElementById('co-addr') || {}).value || '';
    const note = (document.getElementById('co-note') || {}).value || '';
    const arr = ['🍽️ سفارش جدید — سندتن گاردن', '', ...lines, '—', 'مجموع: ' + SG.fmtPrice(total), '', 'نام: ' + name, 'تلفن: ' + phone, 'نوع: ' + typeTxt];
    if (table) arr.push('میز: ' + table);
    if (addr) arr.push('آدرس: ' + addr);
    if (note) arr.push('توضیحات: ' + note);
    return arr.join('\n');
  }
  SG.orderText = orderText;

  async function submitOrder() {
    const c = SG.cart.get(); if (!Object.keys(c).length) return SG.toast('سبد خرید خالی است.', true);
    const name = (document.getElementById('co-name') || {}).value || '';
    const phone = (document.getElementById('co-phone') || {}).value || '';
    const type = (document.getElementById('co-type') || {}).value || 'dinein';
    const items = Object.entries(c).map(([id, qty]) => ({ id: +id, qty }));
    try {
      const r = await api('/api/orders', { method: 'POST', body: {
        items, name, phone, type,
        table: (document.getElementById('co-table') || {}).value || '',
        address: (document.getElementById('co-addr') || {}).value || '',
        note: (document.getElementById('co-note') || {}).value || ''
      }});
      SG.toast('✅ ' + r.message + ' کد: ' + r.code);
      SG.cart.clear(); SG.closeCheckout(); SG.closeCart();
    } catch (e) { SG.toast(e.message, true); }
  }
  SG.openCheckout = function () { const m = document.getElementById('sg-checkout'); if (m) m.classList.add('active'); };
  SG.closeCheckout = function () { const m = document.getElementById('sg-checkout'); if (m) m.classList.remove('active'); };

  // ---------- FX ----------
  function setupFX() {
    const progress = document.getElementById('progress');
    const toTop = document.getElementById('toTop');
    function onScroll() {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      if (progress) progress.style.width = (max > 0 ? (h.scrollTop / max * 100) : 0) + '%';
      if (toTop) toTop.classList.toggle('show', h.scrollTop > 500);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    if (toTop) toTop.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    onScroll();

    if ('IntersectionObserver' in window) {
      SG._revObs = new IntersectionObserver((ents) => ents.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); SG._revObs.unobserve(e.target); } }), { threshold: .12 });
      SG.observeReveals();
    } else document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));

    document.addEventListener('click', e => {
      const t = e.target.closest('.btn,.nav a,.chip,.spot,.feat-card,.icon-btn,.admin-tab');
      if (!t) return;
      const rect = t.getBoundingClientRect(); const size = Math.max(rect.width, rect.height);
      const r = document.createElement('span'); r.className = 'ripple';
      r.style.width = r.style.height = size + 'px';
      r.style.left = (e.clientX - rect.left - size / 2) + 'px';
      r.style.top = (e.clientY - rect.top - size / 2) + 'px';
      t.appendChild(r); setTimeout(() => r.remove(), 600);
    }, true);
  }
  SG.observeReveals = function () {
    if (SG._revObs) document.querySelectorAll('.reveal:not(.visible)').forEach(el => SG._revObs.observe(el));
    else document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
  };
  SG.animateCounters = function (root) {
    (root || document).querySelectorAll('[data-count]').forEach(b => {
      if (b._done) return; b._done = true;
      const target = parseInt(b.getAttribute('data-count'), 10); if (!target) return;
      let cur = 0; const inc = Math.max(1, Math.round(target / 24)); b.textContent = '۰';
      const t = setInterval(() => { cur += inc; if (cur >= target) { cur = target; clearInterval(t); } b.textContent = faNum(cur); }, 40);
    });
  };

  // ---------- Layout injection ----------
  function pageName() { const p = location.pathname.split('/').pop() || 'index.html'; return p === '' ? 'index.html' : p; }
  function navLink(href, label, icon) {
    const active = pageName() === href ? ' active' : '';
    return `<a class="${active}" href="${href}">${label}</a>`;
  }
  function bottomLink(href, label, icon) {
    const active = pageName() === href ? ' active' : '';
    return `<a class="${active}" href="${href}"><span class="bi">${icon}</span>${label}</a>`;
  }

  async function injectLayout() {
    await SG.getSettings();
    const contact = (_settings && _settings.contact) || {};

    // Splash (once per session)
    if (!sessionStorage.getItem('sg_splash') && !/[?&]nosplash/.test(location.search)) {
      const sp = document.createElement('div'); sp.id = 'splash';
      sp.innerHTML = `<div class="splash-stage"><div class="splash-ring"></div><img class="splash-logo" src="/logo.jpg" alt="سندتن"></div>
        <div class="splash-name">Sandton Garden</div><div class="splash-sub">سندتن گاردن</div>`;
      document.body.appendChild(sp);
      const hide = () => { sp.classList.add('hide'); sessionStorage.setItem('sg_splash', '1'); };
      window.addEventListener('load', () => setTimeout(hide, 1100));
      setTimeout(hide, 2200);
    }

    // Progress bar
    const prog = document.createElement('div'); prog.id = 'progress'; document.body.appendChild(prog);

    // Header
    const header = document.createElement('header'); header.className = 'site-header';
    header.innerHTML = `<div class="header-inner">
      <a class="brand" href="/index.html"><img src="/logo.jpg" alt="سندتن گاردن">
        <span class="bt"><b>سندتن گاردن</b><span>SANDTON.GARDEN</span></span></a>
      <nav class="nav">
        ${navLink('index.html', 'خانه')}
        ${navLink('menu.html', 'منو')}
        ${navLink('reserve.html', 'رزرو آلاچیق')}
        ${navLink('gallery.html', 'گالری')}
        ${navLink('about.html', 'درباره ما')}
      </nav>
      <div class="header-actions">
        <button class="icon-btn" id="sg-cart-btn" aria-label="سبد خرید">🛒<span class="cnt" data-cart-count style="display:none">0</span></button>
        <a class="icon-btn" href="/admin.html" aria-label="مدیریت" title="مدیریت">⚙️</a>
      </div>
    </div>`;
    document.body.insertBefore(header, document.body.firstChild);

    // Bottom mobile nav
    const bn = document.createElement('nav'); bn.className = 'bottom-nav';
    bn.innerHTML = `${bottomLink('index.html', 'خانه', '🏠')}${bottomLink('menu.html', 'منو', '🍽️')}${bottomLink('reserve.html', 'رزرو', '🛖')}${bottomLink('gallery.html', 'گالری', '🖼️')}
      <a id="sg-cart-btn2" href="javascript:;"><span class="bi">🛒</span>سبد<span class="cnt" data-cart-count style="display:none;position:absolute;top:4px;left:30%"></span></a>`;
    document.body.appendChild(bn);

    // Footer
    const footer = document.createElement('footer'); footer.className = 'site-footer';
    footer.innerHTML = `<div class="footer-inner">
      <div><div class="brand" style="margin-bottom:10px"><img src="/logo.jpg" alt="" style="width:40px;height:40px"><span class="bt"><b>سندتن گاردن</b><span>SANDTON.GARDEN</span></span></div>
        <p class="muted">تجربه‌ای متفاوت از غذا، نوشیدنی و فضای دنج آلاچیق‌ها در دل طبیعت.</p></div>
      <div><h4>دسترسی سریع</h4><a href="/menu.html">منوی غذا</a><a href="/reserve.html">رزرو آلاچیق</a><a href="/gallery.html">گالری</a><a href="/about.html">درباره ما</a></div>
      <div><h4>ارتباط با ما</h4>
        <a href="tel:+98${(contact.phone||'').replace(/^0/,'')}"><span class="tel">${contact.phoneDisplay || contact.phone || ''}</span></a>
        <a href="https://instagram.com/${contact.instagram||''}" target="_blank" rel="noopener">اینستاگرام</a>
        <a href="https://wa.me/${contact.whatsapp||''}" target="_blank" rel="noopener">واتساپ</a>
        <a href="${contact.mapUrl||'#'}" target="_blank" rel="noopener">موقعیت روی نقشه</a></div>
    </div>
    <div class="copy">© سندتن گاردن — همه حقوق محفوظ است.</div>`;
    document.body.appendChild(footer);

    // toTop
    const tt = document.createElement('button'); tt.id = 'toTop'; tt.textContent = '↑'; tt.setAttribute('aria-label', 'بالا'); document.body.appendChild(tt);

    // Cart drawer + checkout modal
    const drawer = document.createElement('div'); drawer.className = 'drawer'; drawer.id = 'sg-cart';
    drawer.innerHTML = `<div class="overlay"></div>
      <aside class="panel">
        <header><strong>🛒 سبد خرید</strong><button class="btn sm" id="sg-cart-close">✕ بستن</button></header>
        <div class="cart-list" id="sg-cart-list"></div>
        <div class="cart-foot">
          <div class="sum-row"><span>مجموع</span><span id="sg-cart-sum">۰</span></div>
          <div style="display:flex;gap:8px;margin-top:12px">
            <button class="btn full" id="sg-cart-clear">خالی کردن</button>
            <button class="btn primary full" id="sg-cart-checkout">ثبت سفارش</button>
          </div>
        </div>
      </aside>`;
    document.body.appendChild(drawer);

    const co = document.createElement('div'); co.className = 'modal'; co.id = 'sg-checkout';
    co.innerHTML = `<div class="box">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h3 style="margin:0">ثبت سفارش</h3><button class="btn sm" id="co-close">✕</button></div>
      <div class="field"><label>نام و نام‌خانوادگی</label><input id="co-name" placeholder="مثال: علی رضایی"></div>
      <div class="field"><label>شماره تماس</label><input id="co-phone" inputmode="numeric" placeholder="09xxxxxxxxx"></div>
      <div class="field"><label>نوع تحویل</label><select id="co-type">
        <option value="dinein">صرف در محل</option><option value="takeaway">بیرون‌بر</option><option value="delivery">ارسال (پیک)</option></select></div>
      <div class="field" id="co-table-wrap"><label>شماره میز</label><input id="co-table" placeholder="مثال: ۱۲"></div>
      <div class="field" id="co-addr-wrap" style="display:none"><label>آدرس</label><textarea id="co-addr" rows="2"></textarea></div>
      <div class="field"><label>توضیحات</label><textarea id="co-note" rows="2" placeholder="مثلاً بدون سیر..."></textarea></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" id="co-wa">ارسال در واتساپ</button>
        <button class="btn primary full" id="co-submit" style="flex:1">ثبت نهایی</button>
      </div></div>`;
    document.body.appendChild(co);

    // Wire events
    const openCart = () => SG.openCart();
    document.getElementById('sg-cart-btn').onclick = openCart;
    const cb2 = document.getElementById('sg-cart-btn2'); if (cb2) cb2.onclick = openCart;
    drawer.querySelector('.overlay').onclick = SG.closeCart;
    document.getElementById('sg-cart-close').onclick = SG.closeCart;
    document.getElementById('sg-cart-clear').onclick = () => { SG.cart.clear(); };
    document.getElementById('sg-cart-checkout').onclick = () => { if (!SG.cart.count()) return SG.toast('سبد خرید خالی است.', true); SG.openCheckout(); };
    document.getElementById('co-close').onclick = SG.closeCheckout;
    co.onclick = (e) => { if (e.target === co) SG.closeCheckout(); };
    document.getElementById('co-type').onchange = (e) => {
      document.getElementById('co-table-wrap').style.display = e.target.value === 'dinein' ? '' : 'none';
      document.getElementById('co-addr-wrap').style.display = e.target.value === 'delivery' ? '' : 'none';
    };
    document.getElementById('co-submit').onclick = submitOrder;
    document.getElementById('co-wa').onclick = async () => {
      const txt = await orderText();
      window.open(`https://wa.me/${contact.whatsapp || ''}?text=${encodeURIComponent(txt)}`, '_blank');
    };

    SG._updateCount();
    setupFX();
    document.dispatchEvent(new Event('sg:ready'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectLayout);
  else injectLayout();
})();
