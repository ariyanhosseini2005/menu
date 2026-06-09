document.addEventListener('sg:ready', async () => {
  document.getElementById('cartFab').onclick = () => SG.openCart();
  const menuEl = document.getElementById('menu');
  const chipRow = document.getElementById('chipRow');
  const search = document.getElementById('search');
  const state = { q: '', cat: 'همه' };
  let data;

  try { data = (await SG.getMenu()); }
  catch { menuEl.innerHTML = '<div class="empty">خطا در بارگذاری منو.</div>'; return; }

  function renderChips() {
    chipRow.innerHTML = '';
    ['همه', ...data.categories.map(c => c.name)].forEach(name => {
      const b = document.createElement('button'); b.className = 'chip' + (state.cat === name ? ' active' : ''); b.textContent = name;
      b.onclick = () => { state.cat = name; renderChips(); renderMenu(); if (name !== 'همه') { const el = document.querySelector(`[data-cat="${CSS.escape(name)}"]`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } };
      chipRow.appendChild(b);
    });
  }

  function card(it) {
    const c = SG.cart.get();
    const el = document.createElement('article'); el.className = 'card' + (it.available ? '' : ' soldout');
    el.dataset.id = it.id;
    el.innerHTML = `
      <div class="pic"><img loading="lazy" src="${it.image || '/logo.jpg'}" alt="${it.title}" onerror="this.src='/logo.jpg'">
        ${it.available ? '' : '<div class="badge">ناموجود</div>'}</div>
      <div class="info">
        ${it.popular ? '<span class="pop-tag">★ پرطرفدار</span>' : ''}
        <h3 class="title">${it.title}</h3>
        ${it.description ? `<p class="desc">${it.description}</p>` : ''}
        <div class="price${it.price ? '' : ' na'}">${it.price ? SG.fmtPrice(it.price) : 'به‌زودی'}</div>
        <div class="actions">
          <button class="btn primary sm" ${it.available ? '' : 'disabled'} data-add>افزودن +</button>
          <div class="qty"><button data-m>−</button><span data-q>${SG.faNum(c[it.id] || 0)}</span><button data-p>+</button></div>
        </div>
      </div>`;
    const q = el.querySelector('[data-q]');
    const upd = () => { q.textContent = SG.faNum(SG.cart.get()[it.id] || 0); };
    el.querySelector('[data-add]').onclick = () => { SG.cart.add(it.id, 1); upd(); SG.toast('به سبد اضافه شد ✅'); };
    el.querySelector('[data-m]').onclick = () => { SG.cart.add(it.id, -1); upd(); };
    el.querySelector('[data-p]').onclick = () => { SG.cart.add(it.id, 1); upd(); };
    return el;
  }

  function renderMenu() {
    const q = state.q.trim().toLowerCase();
    menuEl.innerHTML = '';
    let any = false;
    data.categories.forEach(cat => {
      if (state.cat !== 'همه' && state.cat !== cat.name) return;
      const items = cat.items.filter(it => !q || it.title.toLowerCase().includes(q));
      if (!items.length) return;
      any = true;
      const sec = document.createElement('section'); sec.className = 'block'; sec.dataset.cat = cat.name; sec.style.scrollMarginTop = '150px';
      const h = document.createElement('div'); h.className = 'sec-head'; h.innerHTML = `<h2>${cat.name}</h2>`;
      const grid = document.createElement('div'); grid.className = 'grid';
      items.forEach(it => grid.appendChild(card(it)));
      sec.append(h, grid); menuEl.appendChild(sec);
    });
    if (!any) menuEl.innerHTML = '<div class="empty">موردی یافت نشد.</div>';
  }

  search.addEventListener('input', e => { state.q = e.target.value; renderMenu(); });
  renderChips(); renderMenu();
});
