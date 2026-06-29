(() => {
  'use strict';

  const modalEl = document.getElementById('cancelSaleModal');
  if (modalEl) {
    modalEl.addEventListener('shown.bs.modal', function() {
      const body = modalEl.querySelector('.modal-body');
      if (body) body.scrollTop = 0;
    });
  }

  document.addEventListener('submit', function(e) {
    const form = e.target && e.target.matches ? e.target : null;
    if (!form) return;

    const msg = form.getAttribute('data-confirm');
    if (msg && !window.confirm(msg)) {
      e.preventDefault();
      return;
    }

    if (form.id === 'cancelSaleForm') {
      const btn = document.getElementById('cancelSaleConfirmBtn');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>Annullamento...';
      }
    }
  });
})();
