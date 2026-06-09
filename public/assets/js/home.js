document.addEventListener('sg:ready', async () => {
  const s = await SG.getSettings();
  if (s.hero) {
    const k = document.getElementById('hero-kicker'), t = document.getElementById('hero-title'), p = document.getElementById('hero-sub');
    if (s.hero.kicker && k) k.textContent = s.hero.kicker;
    if (s.hero.title && t) t.textContent = s.hero.title;
    if (s.hero.subtitle && p) p.textContent = s.hero.subtitle;
  }
  SG.animateCounters();

  // Featured
  try {
    const idx = await SG.getMenu();
    const pops = []; idx.categories.forEach(c => c.items.forEach(i => { if (i.popular && i.available) pops.push(i); }));
    const list = pops.length ? pops : idx.categories.flatMap(c => c.items).filter(i => i.available).slice(0, 8);
    const row = document.getElementById('featRow'); row.innerHTML = '';
    list.slice(0, 10).forEach(it => {
      const card = document.createElement('div'); card.className = 'feat-card';
      card.innerHTML = `<div class="feat-badge shine">★ ویژه</div>
        <div class="fimg"><img loading="lazy" src="${it.image || '/logo.jpg'}" alt="${it.title}" onerror="this.src='/logo.jpg'"></div>
        <div class="fbody"><div class="ftitle">${it.title}</div>
          <div class="fbottom"><span class="card-price" style="font-weight:900;color:var(--gold)">${SG.fmtPrice(it.price)}</span>
            <button class="btn primary sm" data-add="${it.id}">افزودن +</button></div></div>`;
      card.querySelector('[data-add]').onclick = () => SG.addToCart(it.id);
      row.appendChild(card);
    });
    if (!list.length) row.innerHTML = '<div class="empty">به‌زودی…</div>';
  } catch { document.getElementById('featRow').innerHTML = '<div class="empty">خطا در بارگذاری منو</div>'; }

  // Reviews
  try {
    const { reviews } = await SG.api('/api/reviews');
    const el = document.getElementById('reviews'); el.innerHTML = '';
    (reviews.length ? reviews : []).forEach(r => {
      const d = document.createElement('div'); d.className = 'review';
      d.innerHTML = `<div class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div><p>${r.text}</p><div class="who">— ${r.name}</div>`;
      el.appendChild(d);
    });
    if (!reviews.length) el.innerHTML = '<div class="empty">هنوز نظری ثبت نشده.</div>';
  } catch {}

  // Gallery preview
  try {
    const idx = await SG.getMenu();
    const imgs = [];
    idx.categories.forEach(c => c.items.forEach(it => { if (it.image && !/ibb\.co/.test(it.image)) imgs.push(it.image); }));
    const el = document.getElementById('galleryPreview'); el.innerHTML = '';
    imgs.slice(0, 8).forEach(u => { const im = document.createElement('img'); im.loading = 'lazy'; im.src = u; im.alt = 'گالری'; im.onerror = () => im.remove(); el.appendChild(im); });
  } catch {}

  SG.observeReveals();
});
