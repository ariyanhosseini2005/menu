document.addEventListener('sg:ready', async () => {
  const s = await SG.getSettings();
  const c = s.contact || {}, hours = s.hours || {};

  const phone = c.phone || '';
  document.getElementById('abPhone').href = 'tel:+98' + phone.replace(/^0/, '');
  document.getElementById('abInsta').href = 'https://instagram.com/' + (c.instagram || '');
  const mb = document.getElementById('mapBtn'); if (mb) mb.href = c.mapUrl || '#';

  const hoursBox = document.getElementById('hoursBox');
  hoursBox.innerHTML = (hours.text || []).map(h => `<div class="info-row"><span class="k">${h.day}</span><span>${h.time}</span></div>`).join('') || '<div class="muted">به‌زودی</div>';

  document.getElementById('contactBox').innerHTML = `
    <div class="info-row"><span class="k">تلفن</span><a href="tel:+98${phone.replace(/^0/, '')}"><span class="tel">${c.phoneDisplay || phone}</span></a></div>
    <div class="info-row"><span class="k">اینستاگرام</span><a href="https://instagram.com/${c.instagram || ''}" target="_blank" rel="noopener">@${c.instagram || ''}</a></div>
    <div class="info-row"><span class="k">واتساپ</span><a href="https://wa.me/${c.whatsapp || ''}" target="_blank" rel="noopener">ارسال پیام</a></div>
    <div class="info-row"><span class="k">آدرس</span><span>${c.address || '—'}</span></div>`;

  async function loadReviews() {
    try {
      const { reviews } = await SG.api('/api/reviews');
      const el = document.getElementById('reviews'); el.innerHTML = '';
      if (!reviews.length) { el.innerHTML = '<div class="empty">هنوز نظری ثبت نشده.</div>'; return; }
      reviews.forEach(r => { const d = document.createElement('div'); d.className = 'review'; d.innerHTML = `<div class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div><p>${r.text}</p><div class="who">— ${r.name}</div>`; el.appendChild(d); });
    } catch {}
  }
  loadReviews();

  document.getElementById('rvSubmit').onclick = async () => {
    const name = document.getElementById('rvName').value.trim();
    const text = document.getElementById('rvText').value.trim();
    const rating = +document.getElementById('rvRating').value;
    if (!name || !text) return SG.toast('نام و متن نظر را وارد کنید.', true);
    try {
      const r = await SG.api('/api/reviews', { method: 'POST', body: { name, text, rating } });
      SG.toast(r.message || 'ثبت شد.');
      document.getElementById('rvName').value = ''; document.getElementById('rvText').value = '';
    } catch (e) { SG.toast(e.message, true); }
  };

  SG.observeReveals();
});
