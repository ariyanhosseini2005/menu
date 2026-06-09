document.addEventListener('sg:ready', async () => {
  const s = await SG.getSettings();
  const hours = s.hours || { defaultStart: 18, fridayStart: 12, end: 24 };
  let spots = [];
  try { spots = (await SG.api('/api/spots')).spots; } catch { document.getElementById('spotGrid').innerHTML = '<div class="empty">خطا در بارگذاری.</div>'; }

  const state = { date: '', slot: '', spot: '', taken: [] };
  const el = id => document.getElementById(id);
  const rDate = el('rDate'), rSlots = el('rSlots'), spotGrid = el('spotGrid'),
        rSel = el('rSel'), rWhen = el('rWhen'), rGuestsOut = el('rGuestsOut'), rGuests = el('rGuests');

  (function initDate() {
    const t = new Date();
    const str = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    rDate.min = str; rDate.value = str; state.date = str;
  })();

  function slotsForDate(dateStr) {
    const day = new Date(dateStr + 'T00:00:00').getDay(); // 5 = جمعه
    const start = day === 5 ? (hours.fridayStart || 12) : (hours.defaultStart || 18);
    const end = hours.end || 24;
    const out = []; for (let h = start; h < end; h++) out.push(String(h).padStart(2, '0') + ':00');
    return out;
  }

  async function refreshAvailability() {
    if (!state.date || !state.slot) { state.taken = []; return; }
    try { state.taken = (await SG.api(`/api/availability?date=${state.date}&slot=${state.slot}`)).taken || []; }
    catch { state.taken = []; }
  }

  function renderSlots() {
    rSlots.innerHTML = '';
    const list = slotsForDate(state.date);
    if (!list.includes(state.slot)) state.slot = list[0] || '';
    list.forEach(sl => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'slot' + (state.slot === sl ? ' active' : ''); b.textContent = sl;
      b.onclick = async () => { state.slot = sl; state.spot = ''; renderSlots(); await refreshAvailability(); renderSpots(); };
      rSlots.appendChild(b);
    });
  }
  const spotName = id => { const x = spots.find(s => s.id === id); return x ? x.name : '—'; };

  function renderSpots() {
    spotGrid.innerHTML = '';
    spots.forEach(sp => {
      const taken = state.taken.includes(sp.id);
      const b = document.createElement('button'); b.type = 'button';
      b.className = 'spot' + (sp.type === 'hall' ? ' hall' : '') + (state.spot === sp.id ? ' selected' : '') + (taken ? ' taken' : '');
      b.innerHTML = sp.type === 'hall'
        ? `<span class="emoji">${sp.emoji}</span><div><div class="name">${sp.name}</div><div class="cap">${sp.capacity}</div></div>`
        : `<span class="emoji">${sp.emoji}</span><div class="name">${sp.name}</div><div class="cap">${sp.capacity}</div>`;
      if (taken) { b.disabled = true; }
      else b.onclick = () => { state.spot = sp.id; renderSpots(); };
      spotGrid.appendChild(b);
    });
    updateSummary();
  }
  function updateSummary() {
    rSel.textContent = state.spot ? spotName(state.spot) : '—';
    rWhen.textContent = (state.date && state.slot) ? `${state.date} • ${state.slot}` : '—';
    rGuestsOut.textContent = rGuests.value ? SG.faNum(rGuests.value) + ' نفر' : '—';
  }

  rDate.addEventListener('change', async () => { state.date = rDate.value; state.spot = ''; renderSlots(); await refreshAvailability(); renderSpots(); });
  rGuests.addEventListener('input', updateSummary);

  // My reservations (local)
  const MINE = 'sg_my_resv';
  const getMine = () => { try { return JSON.parse(localStorage.getItem(MINE) || '[]'); } catch { return []; } };
  const setMine = a => localStorage.setItem(MINE, JSON.stringify(a));
  function renderMine() {
    const box = el('myResv'); const mine = getMine().filter(r => r.status !== 'cancelled');
    if (!mine.length) { box.innerHTML = '<div class="empty">هنوز رزروی ثبت نکرده‌اید.</div>'; return; }
    box.innerHTML = '';
    mine.sort((a, b) => (a.date + a.slot).localeCompare(b.date + b.slot));
    mine.forEach(r => {
      const sp = spots.find(x => x.id === r.spot);
      const d = document.createElement('div'); d.className = 'cart-item'; d.style.gridTemplateColumns = '40px 1fr auto';
      d.innerHTML = `<div style="font-size:24px">${sp ? sp.emoji : '🛖'}</div>
        <div><div class="ct">${spotName(r.spot)}</div><div class="cm">${r.date} • ساعت ${r.slot} • ${SG.faNum(r.guests)} نفر • کد ${r.code}</div></div>
        <button class="btn sm danger" data-c="${r.code}">لغو</button>`;
      d.querySelector('[data-c]').onclick = () => cancel(r.code, r.phone);
      box.appendChild(d);
    });
  }
  async function cancel(code, phone) {
    if (!confirm('این رزرو لغو شود؟')) return;
    try { await SG.api('/api/reservations/cancel', { method: 'POST', body: { code, phone } }); } catch (e) { SG.toast(e.message, true); return; }
    setMine(getMine().map(r => r.code === code ? { ...r, status: 'cancelled' } : r));
    await refreshAvailability(); renderSpots(); renderMine(); SG.toast('رزرو لغو شد.');
  }

  el('rConfirm').onclick = async () => {
    const name = el('rName').value.trim(), phone = el('rPhone').value.trim(), guests = rGuests.value, note = el('rNote').value.trim();
    if (!state.date) return SG.toast('تاریخ را انتخاب کنید.', true);
    if (!state.slot) return SG.toast('ساعت را انتخاب کنید.', true);
    if (!state.spot) return SG.toast('یک آلاچیق یا سالن انتخاب کنید.', true);
    if (!name) return SG.toast('نام را وارد کنید.', true);
    if (!/^0?9\d{9}$/.test(phone)) return SG.toast('شماره موبایل معتبر وارد کنید.', true);
    let r;
    try { r = await SG.api('/api/reservations', { method: 'POST', body: { date: state.date, slot: state.slot, spotId: state.spot, guests, name, phone, note } }); }
    catch (e) { SG.toast(e.message, true); await refreshAvailability(); renderSpots(); return; }
    const rec = { code: r.code, date: state.date, slot: state.slot, spot: state.spot, guests, name, phone, status: 'active' };
    setMine([...getMine(), rec]);
    const wa = (s.contact && s.contact.whatsapp) || '';
    const txt = ['🛖 رزرو جدید — سندتن گاردن', '', 'محل: ' + spotName(state.spot), 'تاریخ: ' + state.date, 'ساعت: ' + state.slot, 'نفرات: ' + guests, 'نام: ' + name, 'تلفن: ' + phone, note ? 'توضیحات: ' + note : '', 'کد رزرو: ' + r.code].filter(Boolean).join('\n');
    if (wa) window.open(`https://wa.me/${wa}?text=${encodeURIComponent(txt)}`, '_blank');
    state.spot = ''; await refreshAvailability(); renderSpots(); renderMine();
    SG.toast('✅ رزرو ثبت شد! کد: ' + r.code);
  };

  renderSlots(); await refreshAvailability(); renderSpots(); renderMine();
});
