document.addEventListener('sg:ready', async () => {
  const loginView = document.getElementById('loginView');
  const appView = document.getElementById('appView');
  const tabsEl = document.getElementById('tabs');
  const contentEl = document.getElementById('tabContent');
  const statsEl = document.getElementById('stats');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- Auth ----------
  async function checkAuth() {
    const token = localStorage.getItem('sg_admin_token');
    if (!token) return showLogin();
    try { await SG.api('/api/admin/me'); showApp(); }
    catch { localStorage.removeItem('sg_admin_token'); showLogin(); }
  }
  function showLogin() { loginView.style.display = ''; appView.style.display = 'none'; }
  async function showApp() { loginView.style.display = 'none'; appView.style.display = ''; await loadStats(); buildTabs(); switchTab('menu'); }

  document.getElementById('admLogin').onclick = doLogin;
  document.getElementById('admPass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  async function doLogin() {
    const pass = document.getElementById('admPass').value;
    try { const r = await SG.api('/api/admin/login', { method: 'POST', body: { password: pass } }); localStorage.setItem('sg_admin_token', r.token); showApp(); }
    catch (e) { SG.toast(e.message, true); }
  }
  document.getElementById('admLogout').onclick = async () => {
    try { await SG.api('/api/admin/logout', { method: 'POST' }); } catch {}
    localStorage.removeItem('sg_admin_token'); showLogin();
  };

  async function loadStats() {
    try {
      const s = await SG.api('/api/admin/stats');
      statsEl.innerHTML = `
        <div class="stat"><b>${SG.faNum(s.items)}</b><span>آیتم منو</span></div>
        <div class="stat"><b>${SG.faNum(s.reservationsActive)}</b><span>رزرو فعال</span></div>
        <div class="stat"><b>${SG.faNum(s.ordersNew)}</b><span>سفارش جدید</span></div>
        <div class="stat"><b>${SG.faNum(s.reviewsPending)}</b><span>نظر در انتظار</span></div>`;
    } catch {}
  }

  // ---------- Tabs ----------
  const TABS = [
    ['menu', '🍽️ منو و قیمت‌ها'], ['reservations', '🛖 رزروها'], ['orders', '🧾 سفارش‌ها'],
    ['reviews', '⭐ نظرات'], ['spots', '🗺️ آلاچیق‌ها'], ['settings', '⚙️ تنظیمات'], ['password', '🔑 رمز عبور']
  ];
  let active = 'menu';
  function buildTabs() {
    tabsEl.innerHTML = '';
    TABS.forEach(([k, label]) => { const b = document.createElement('button'); b.className = 'admin-tab' + (active === k ? ' active' : ''); b.textContent = label; b.onclick = () => switchTab(k); tabsEl.appendChild(b); });
  }
  function switchTab(k) { active = k; buildTabs(); ({ menu: tabMenu, reservations: tabReservations, orders: tabOrders, reviews: tabReviews, spots: tabSpots, settings: tabSettings, password: tabPassword }[k])(); }

  // ---------- Modal helper ----------
  function modal(title, bodyHtml, onSave) {
    const m = document.createElement('div'); m.className = 'modal active';
    m.innerHTML = `<div class="box"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h3 style="margin:0">${esc(title)}</h3><button class="btn sm" data-x>✕</button></div><div data-body>${bodyHtml}</div><div style="display:flex;gap:8px;margin-top:14px"><button class="btn" data-x>انصراف</button><button class="btn primary full" data-save>ذخیره</button></div></div>`;
    document.body.appendChild(m);
    const close = () => m.remove();
    m.querySelectorAll('[data-x]').forEach(b => b.onclick = close);
    m.onclick = e => { if (e.target === m) close(); };
    m.querySelector('[data-save]').onclick = async () => { try { await onSave(m); close(); } catch (e) { SG.toast(e.message, true); } };
    return m;
  }

  // ---------- MENU ----------
  let menuCats = [];
  async function tabMenu() {
    contentEl.innerHTML = '<div class="empty">در حال بارگذاری…</div>';
    const { categories } = await SG.api('/api/admin/menu'); menuCats = categories;
    let html = `<div style="display:flex;gap:8px;margin-bottom:14px"><input id="newCat" class="field" placeholder="نام دسته جدید" style="flex:1;padding:11px;border-radius:12px;border:1px solid var(--line);background:rgba(28,22,48,.7);color:#fff"><button class="btn primary" id="addCat">+ دسته</button></div>`;
    categories.forEach(cat => {
      html += `<div class="admin-cat-h"><h3>${esc(cat.name)}</h3><div style="display:flex;gap:6px">
        <button class="btn sm" data-additem="${cat.id}">+ آیتم</button>
        <button class="btn sm" data-rencat="${cat.id}">ویرایش</button>
        <button class="btn sm danger" data-delcat="${cat.id}">حذف</button></div></div>`;
      cat.items.forEach(it => {
        html += `<div class="admin-item">
          <img src="${esc(it.image || '/logo.jpg')}" onerror="this.src='/logo.jpg'" alt="">
          <div><div style="font-weight:800">${esc(it.title)} ${it.popular ? '⭐' : ''} ${it.available ? '' : '🚫'}</div>
            <div class="muted">${it.price ? SG.fmtPrice(it.price) : 'بدون قیمت'}</div></div>
          <div style="display:flex;gap:6px"><button class="btn sm" data-edit="${it.id}">✏️</button><button class="btn sm danger" data-del="${it.id}">🗑️</button></div>
        </div>`;
      });
    });
    contentEl.innerHTML = html;

    document.getElementById('addCat').onclick = async () => {
      const name = document.getElementById('newCat').value.trim(); if (!name) return;
      await SG.api('/api/admin/categories', { method: 'POST', body: { name } }); tabMenu();
    };
    contentEl.querySelectorAll('[data-delcat]').forEach(b => b.onclick = async () => { if (confirm('حذف دسته و همه‌ی آیتم‌هایش؟')) { await SG.api('/api/admin/categories/' + b.dataset.delcat, { method: 'DELETE' }); tabMenu(); } });
    contentEl.querySelectorAll('[data-rencat]').forEach(b => b.onclick = async () => {
      const cat = menuCats.find(c => c.id == b.dataset.rencat); const name = prompt('نام دسته:', cat.name); if (name == null) return;
      await SG.api('/api/admin/categories/' + cat.id, { method: 'PUT', body: { name } }); tabMenu();
    });
    contentEl.querySelectorAll('[data-additem]').forEach(b => b.onclick = () => itemModal(null, +b.dataset.additem));
    contentEl.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => { const it = findItem(+b.dataset.edit); itemModal(it, it.categoryId); });
    contentEl.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (confirm('این آیتم حذف شود؟')) { await SG.api('/api/admin/items/' + b.dataset.del, { method: 'DELETE' }); tabMenu(); } });
  }
  function findItem(id) { for (const c of menuCats) { const it = c.items.find(i => i.id === id); if (it) return { ...it, categoryId: c.id }; } }

  function itemModal(it, categoryId) {
    const opts = menuCats.map(c => `<option value="${c.id}" ${c.id === categoryId ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
    const body = `
      <div class="field"><label>نام</label><input id="i-title" value="${esc(it ? it.title : '')}"></div>
      <div class="field"><label>دسته</label><select id="i-cat">${opts}</select></div>
      <div class="field-row">
        <div class="field"><label>قیمت (عدد، تومان)</label><input id="i-price" type="number" value="${it ? it.price : 0}"></div>
        <div class="field"><label></label><label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input id="i-pop" type="checkbox" ${it && it.popular ? 'checked' : ''}> پرطرفدار</label>
          <label style="display:flex;gap:8px;align-items:center"><input id="i-av" type="checkbox" ${!it || it.available ? 'checked' : ''}> موجود</label></div>
      </div>
      <div class="field"><label>توضیح (اختیاری)</label><input id="i-desc" value="${esc(it ? it.description : '')}"></div>
      <div class="field"><label>لینک عکس یا Base64</label><textarea id="i-img" rows="2" placeholder="https://…">${esc(it ? it.image : '')}</textarea></div>`;
    modal(it ? 'ویرایش آیتم' : 'افزودن آیتم', body, async () => {
      const payload = {
        title: document.getElementById('i-title').value.trim(),
        categoryId: +document.getElementById('i-cat').value,
        price: +document.getElementById('i-price').value || 0,
        popular: document.getElementById('i-pop').checked,
        available: document.getElementById('i-av').checked,
        description: document.getElementById('i-desc').value.trim(),
        image: document.getElementById('i-img').value.trim()
      };
      if (!payload.title) throw new Error('نام الزامی است.');
      if (it) await SG.api('/api/admin/items/' + it.id, { method: 'PUT', body: payload });
      else await SG.api('/api/admin/items', { method: 'POST', body: payload });
      SG.toast('ذخیره شد ✅'); tabMenu();
    });
  }

  // ---------- RESERVATIONS ----------
  async function tabReservations() {
    contentEl.innerHTML = '<div class="empty">در حال بارگذاری…</div>';
    const { reservations } = await SG.api('/api/admin/reservations');
    if (!reservations.length) { contentEl.innerHTML = '<div class="empty">رزروی ثبت نشده.</div>'; return; }
    let html = '<div class="scroll-x"><table class="table"><tr><th>کد</th><th>تاریخ</th><th>ساعت</th><th>محل</th><th>نفرات</th><th>نام</th><th>تلفن</th><th>وضعیت</th></tr>';
    reservations.forEach(r => {
      html += `<tr><td>${esc(r.code)}</td><td>${esc(r.date)}</td><td>${esc(r.slot)}</td><td>${esc(r.spotName)}</td><td>${SG.faNum(r.guests)}</td><td>${esc(r.name)}</td><td class="tel">${esc(r.phone)}</td>
        <td><select data-r="${r.id}"><option value="active" ${r.status === 'active' ? 'selected' : ''}>فعال</option><option value="done" ${r.status === 'done' ? 'selected' : ''}>انجام‌شده</option><option value="cancelled" ${r.status === 'cancelled' ? 'selected' : ''}>لغو</option></select></td></tr>`;
    });
    html += '</table></div>';
    contentEl.innerHTML = html;
    contentEl.querySelectorAll('[data-r]').forEach(s => s.onchange = async () => {
      try { await SG.api('/api/admin/reservations/' + s.dataset.r, { method: 'PATCH', body: { status: s.value } }); SG.toast('به‌روزرسانی شد'); loadStats(); }
      catch (e) { SG.toast(e.message, true); tabReservations(); }
    });
  }

  // ---------- ORDERS ----------
  const ORDER_STATUS = { new: 'جدید', preparing: 'در حال آماده‌سازی', ready: 'آماده', done: 'تحویل شد', cancelled: 'لغو' };
  async function tabOrders() {
    contentEl.innerHTML = '<div class="empty">در حال بارگذاری…</div>';
    const { orders } = await SG.api('/api/admin/orders');
    if (!orders.length) { contentEl.innerHTML = '<div class="empty">سفارشی ثبت نشده.</div>'; return; }
    let html = '<div class="scroll-x"><table class="table"><tr><th>کد</th><th>اقلام</th><th>مبلغ</th><th>نوع</th><th>نام</th><th>تلفن</th><th>وضعیت</th></tr>';
    const typeTxt = { dinein: 'در محل', takeaway: 'بیرون‌بر', delivery: 'ارسال' };
    orders.forEach(o => {
      const items = o.items.map(i => `${esc(i.title)}×${SG.faNum(i.qty)}`).join('، ');
      html += `<tr><td>${esc(o.code)}</td><td style="max-width:220px">${items}</td><td>${SG.fmtPrice(o.total)}</td><td>${typeTxt[o.type] || o.type}</td><td>${esc(o.name)}</td><td class="tel">${esc(o.phone)}</td>
        <td><select data-o="${o.id}">${Object.entries(ORDER_STATUS).map(([k, v]) => `<option value="${k}" ${o.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></td></tr>`;
    });
    html += '</table></div>';
    contentEl.innerHTML = html;
    contentEl.querySelectorAll('[data-o]').forEach(s => s.onchange = async () => { await SG.api('/api/admin/orders/' + s.dataset.o, { method: 'PATCH', body: { status: s.value } }); SG.toast('به‌روزرسانی شد'); loadStats(); });
  }

  // ---------- REVIEWS ----------
  async function tabReviews() {
    contentEl.innerHTML = '<div class="empty">در حال بارگذاری…</div>';
    const { reviews } = await SG.api('/api/admin/reviews');
    if (!reviews.length) { contentEl.innerHTML = '<div class="empty">نظری ثبت نشده.</div>'; return; }
    contentEl.innerHTML = reviews.map(r => `<div class="admin-item" style="grid-template-columns:1fr auto">
      <div><div style="font-weight:800">${esc(r.name)} <span style="color:var(--gold)">${'★'.repeat(r.rating)}</span> ${r.approved ? '<span class="tag active">تأییدشده</span>' : '<span class="tag done">در انتظار</span>'}</div>
        <div class="muted">${esc(r.text)}</div></div>
      <div style="display:flex;gap:6px">${r.approved ? `<button class="btn sm" data-un="${r.id}">عدم نمایش</button>` : `<button class="btn sm primary" data-ap="${r.id}">تأیید</button>`}<button class="btn sm danger" data-dr="${r.id}">🗑️</button></div></div>`).join('');
    contentEl.querySelectorAll('[data-ap]').forEach(b => b.onclick = async () => { await SG.api('/api/admin/reviews/' + b.dataset.ap, { method: 'PATCH', body: { approved: true } }); tabReviews(); loadStats(); });
    contentEl.querySelectorAll('[data-un]').forEach(b => b.onclick = async () => { await SG.api('/api/admin/reviews/' + b.dataset.un, { method: 'PATCH', body: { approved: false } }); tabReviews(); loadStats(); });
    contentEl.querySelectorAll('[data-dr]').forEach(b => b.onclick = async () => { if (confirm('حذف نظر؟')) { await SG.api('/api/admin/reviews/' + b.dataset.dr, { method: 'DELETE' }); tabReviews(); loadStats(); } });
  }

  // ---------- SPOTS ----------
  async function tabSpots() {
    contentEl.innerHTML = '<div class="empty">در حال بارگذاری…</div>';
    const { spots } = await SG.api('/api/admin/spots');
    contentEl.innerHTML = spots.map(s => `<div class="admin-item" style="grid-template-columns:46px 1fr auto">
      <div style="font-size:26px;text-align:center">${esc(s.emoji)}</div>
      <div style="display:grid;gap:6px">
        <input data-name="${s.id}" value="${esc(s.name)}" style="padding:8px;border-radius:10px;border:1px solid var(--line);background:rgba(28,22,48,.7);color:#fff">
        <input data-cap="${s.id}" value="${esc(s.capacity)}" placeholder="ظرفیت" style="padding:8px;border-radius:10px;border:1px solid var(--line);background:rgba(28,22,48,.7);color:#fff">
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:center">
        <label class="muted" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-act="${s.id}" ${s.active ? 'checked' : ''}>فعال</label>
        <button class="btn sm primary" data-save="${s.id}">ذخیره</button></div></div>`).join('');
    contentEl.querySelectorAll('[data-save]').forEach(b => b.onclick = async () => {
      const id = b.dataset.save;
      const body = { name: contentEl.querySelector(`[data-name="${id}"]`).value, capacity: contentEl.querySelector(`[data-cap="${id}"]`).value, active: contentEl.querySelector(`[data-act="${id}"]`).checked };
      await SG.api('/api/admin/spots/' + id, { method: 'PUT', body }); SG.toast('ذخیره شد ✅');
    });
  }

  // ---------- SETTINGS ----------
  async function tabSettings() {
    const s = await SG.api('/api/settings');
    const c = s.contact || {}, hero = s.hero || {}, hours = s.hours || {};
    contentEl.innerHTML = `
      <div class="about-card"><h3>متن صفحه‌ی اصلی (Hero)</h3>
        <div class="field"><label>برچسب بالا</label><input id="se-kicker" value="${esc(hero.kicker)}"></div>
        <div class="field"><label>عنوان</label><input id="se-title" value="${esc(hero.title)}"></div>
        <div class="field"><label>توضیح</label><textarea id="se-sub" rows="2">${esc(hero.subtitle)}</textarea></div>
      </div>
      <div class="about-card"><h3>اطلاعات تماس</h3>
        <div class="field-row"><div class="field"><label>تلفن</label><input id="se-phone" value="${esc(c.phone)}"></div>
          <div class="field"><label>نمایش تلفن</label><input id="se-phoned" value="${esc(c.phoneDisplay)}"></div></div>
        <div class="field-row"><div class="field"><label>اینستاگرام</label><input id="se-insta" value="${esc(c.instagram)}"></div>
          <div class="field"><label>واتساپ (با کد کشور)</label><input id="se-wa" value="${esc(c.whatsapp)}"></div></div>
        <div class="field"><label>آدرس</label><input id="se-addr" value="${esc(c.address)}"></div>
        <div class="field"><label>لینک نقشه</label><input id="se-map" value="${esc(c.mapUrl)}"></div>
      </div>
      <div class="about-card"><h3>ساعات کاری و رزرو</h3>
        <div class="field-row"><div class="field"><label>شروع روزهای عادی</label><input id="se-ds" type="number" value="${hours.defaultStart || 18}"></div>
          <div class="field"><label>شروع جمعه</label><input id="se-fs" type="number" value="${hours.fridayStart || 12}"></div></div>
        <div class="field"><label>ساعت پایان</label><input id="se-end" type="number" value="${hours.end || 24}"></div>
        <div class="field"><label>متن ساعات کاری (هر خط: روز | ساعت)</label><textarea id="se-htext" rows="3">${(hours.text || []).map(h => h.day + ' | ' + h.time).join('\n')}</textarea></div>
      </div>
      <div class="about-card"><h3>واحد قیمت</h3>
        <div class="field"><input id="se-unit" value="${esc(s.priceUnit || 'تومان')}"></div></div>
      <button class="btn primary full" id="se-save">ذخیره‌ی تنظیمات</button>`;
    document.getElementById('se-save').onclick = async () => {
      const text = document.getElementById('se-htext').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const [day, time] = l.split('|').map(x => (x || '').trim()); return { day, time }; });
      const body = {
        hero: { kicker: val('se-kicker'), title: val('se-title'), subtitle: val('se-sub') },
        contact: { phone: val('se-phone'), phoneDisplay: val('se-phoned'), instagram: val('se-insta'), whatsapp: val('se-wa'), address: val('se-addr'), mapUrl: val('se-map') },
        hours: { defaultStart: +val('se-ds') || 18, fridayStart: +val('se-fs') || 12, end: +val('se-end') || 24, text },
        priceUnit: val('se-unit') || 'تومان'
      };
      try { await SG.api('/api/admin/settings', { method: 'PUT', body }); SG.toast('تنظیمات ذخیره شد ✅'); } catch (e) { SG.toast(e.message, true); }
    };
    function val(id) { return document.getElementById(id).value.trim(); }
  }

  // ---------- PASSWORD ----------
  function tabPassword() {
    contentEl.innerHTML = `<div class="about-card" style="max-width:420px">
      <h3>تغییر رمز عبور</h3>
      <div class="field"><label>رمز جدید (حداقل ۶ کاراکتر)</label><input id="pw-new" type="password"></div>
      <div class="field"><label>تکرار رمز</label><input id="pw-rep" type="password"></div>
      <button class="btn primary full" id="pw-save">تغییر رمز</button></div>`;
    document.getElementById('pw-save').onclick = async () => {
      const a = document.getElementById('pw-new').value, b = document.getElementById('pw-rep').value;
      if (a.length < 6) return SG.toast('رمز باید حداقل ۶ کاراکتر باشد.', true);
      if (a !== b) return SG.toast('رمزها یکسان نیستند.', true);
      try { await SG.api('/api/admin/password', { method: 'POST', body: { password: a } }); SG.toast('رمز تغییر کرد. دوباره وارد شوید.'); setTimeout(() => { localStorage.removeItem('sg_admin_token'); showLogin(); }, 1500); }
      catch (e) { SG.toast(e.message, true); }
    };
  }

  checkAuth();
});
