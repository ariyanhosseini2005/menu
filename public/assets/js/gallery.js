document.addEventListener('sg:ready', async () => {
  const el = document.getElementById('gallery');
  const lb = document.getElementById('lightbox'), lbImg = document.getElementById('lbImg');
  lb.onclick = () => lb.classList.remove('active');
  try {
    const idx = await SG.getMenu();
    const seen = new Set(); const imgs = [];
    idx.categories.forEach(c => c.items.forEach(it => { if (it.image && !/ibb\.co/.test(it.image) && !seen.has(it.image)) { seen.add(it.image); imgs.push({ u: it.image, t: it.title }); } }));
    el.innerHTML = '';
    if (!imgs.length) { el.innerHTML = '<div class="empty">تصویری موجود نیست.</div>'; return; }
    imgs.forEach(o => {
      const im = document.createElement('img'); im.loading = 'lazy'; im.src = o.u; im.alt = o.t;
      im.onerror = () => im.remove();
      im.onclick = () => { lbImg.src = o.u; lb.classList.add('active'); };
      el.appendChild(im);
    });
  } catch { el.innerHTML = '<div class="empty">خطا در بارگذاری گالری.</div>'; }
});
