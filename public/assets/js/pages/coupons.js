(function () {
  const btn = document.getElementById('btnGenCouponCode');
  const inp = document.getElementById('couponCodeInput');

  if (btn && inp) {
    btn.addEventListener('click', async () => {
      try {
        const r = await fetch('index.php?page=coupons&do=gen_code', { credentials: 'same-origin' });
        const j = await r.json();

        if (j && j.code) {
          inp.value = String(j.code).toUpperCase();
        }
      } catch (e) {
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
        let out = '';

        for (let i = 0; i < 10; i += 1) {
          out += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        inp.value = out;
      }
    });
  }

  const scopeSel = document.getElementById('couponApplyScope');
  const boxes = {
    service_categories: document.getElementById('couponScopeCategories'),
    services: document.getElementById('couponScopeServices'),
    product_categories: document.getElementById('couponScopeProductCategories'),
    products: document.getElementById('couponScopeProducts')
  };

  function syncScopeBoxes() {
    const value = scopeSel ? String(scopeSel.value || '') : '';

    Object.keys(boxes).forEach((key) => {
      const el = boxes[key];

      if (!el) return;

      const visible = key === value;
      el.classList.toggle('d-none', !visible);
      el.querySelectorAll('select').forEach((sel) => {
        sel.disabled = !visible;
      });
    });
  }

  if (scopeSel) {
    scopeSel.addEventListener('change', syncScopeBoxes);
    syncScopeBoxes();
  }

  document.addEventListener('click', (event) => {
    const action = event.target.closest('[data-coupons-confirm]');

    if (!action) return;

    const message = action.getAttribute('data-coupons-confirm') || 'Confermare questa operazione?';

    if (!window.confirm(message)) {
      event.preventDefault();
    }
  });
})();
