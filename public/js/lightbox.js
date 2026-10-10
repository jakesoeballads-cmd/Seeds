// Foto layar penuh: klik foto (<a data-lightbox="grup">) untuk membukanya.
// Panah kiri/kanan atau geser untuk pindah foto, Esc untuk menutup.
(function () {
  const links = Array.from(document.querySelectorAll('a[data-lightbox]'));
  if (!links.length) return;

  const box = document.createElement('div');
  box.className = 'lightbox';
  box.hidden = true;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.innerHTML = `
    <figure>
      <img alt="">
      <figcaption></figcaption>
    </figure>
    <button type="button" class="lb-close" aria-label="${t('Tutup')}">×</button>
    <button type="button" class="lb-prev" aria-label="${t('Foto sebelumnya')}">‹</button>
    <button type="button" class="lb-next" aria-label="${t('Foto berikutnya')}">›</button>`;
  document.body.appendChild(box);

  const img = box.querySelector('img');
  const caption = box.querySelector('figcaption');
  const prevBtn = box.querySelector('.lb-prev');
  const nextBtn = box.querySelector('.lb-next');
  let group = [];
  let index = 0;
  let opener = null;

  function show(i) {
    index = (i + group.length) % group.length;
    const link = group[index];
    img.src = link.href;
    img.alt = (link.querySelector('img') || {}).alt || '';
    caption.textContent = t('Foto {n} dari {total}', { n: index + 1, total: group.length });
    prevBtn.hidden = nextBtn.hidden = group.length < 2;
  }

  function open(link) {
    group = links.filter((l) => l.dataset.lightbox === link.dataset.lightbox);
    opener = link;
    box.hidden = false;
    document.body.classList.add('lightbox-open');
    show(group.indexOf(link));
    box.querySelector('.lb-close').focus();
  }

  function close() {
    box.hidden = true;
    img.removeAttribute('src');
    document.body.classList.remove('lightbox-open');
    if (opener) opener.focus();
  }

  links.forEach((link) => link.addEventListener('click', (e) => {
    e.preventDefault();
    open(link);
  }));
  box.querySelector('.lb-close').addEventListener('click', close);
  prevBtn.addEventListener('click', () => show(index - 1));
  nextBtn.addEventListener('click', () => show(index + 1));
  // Klik di latar gelap (bukan di foto) menutup.
  box.addEventListener('click', (e) => { if (e.target === box || e.target.tagName === 'FIGURE') close(); });

  document.addEventListener('keydown', (e) => {
    if (box.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') show(index - 1);
    else if (e.key === 'ArrowRight') show(index + 1);
    else if (e.key === 'Tab') {
      // Fokus tetap di dalam dialog.
      const focusable = Array.from(box.querySelectorAll('button:not([hidden])'));
      const pos = focusable.indexOf(document.activeElement);
      if (e.shiftKey && pos <= 0) { e.preventDefault(); focusable[focusable.length - 1].focus(); }
      else if (!e.shiftKey && pos === focusable.length - 1) { e.preventDefault(); focusable[0].focus(); }
    }
  });

  // Geser di layar sentuh.
  let startX = null;
  box.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
  box.addEventListener('touchend', (e) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 50 && group.length > 1) show(index + (dx < 0 ? 1 : -1));
    startX = null;
  });
})();
