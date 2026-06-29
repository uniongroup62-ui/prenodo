(() => {
  'use strict';

  function eachRedeemInput(callback) {
    document.querySelectorAll('.og-redeem-input').forEach(callback);
  }

  function showOrSubmit(modalId, formId, message) {
    const modalEl = document.getElementById(modalId);
    if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      bootstrap.Modal.getOrCreateInstance(modalEl).show();
      return;
    }
    if (!window.confirm(message)) return;
    const form = document.getElementById(formId);
    if (form) form.submit();
  }

  document.addEventListener('submit', function(e) {
    const form = e.target && e.target.matches ? e.target : null;
    if (!form) return;
    const msg = form.getAttribute('data-confirm');
    if (msg && !window.confirm(msg)) e.preventDefault();
  });

  document.addEventListener('click', function(e) {
    const target = e.target && e.target.closest ? e.target.closest('[data-og-select-all-remaining], [data-og-clear-selection], [data-og-cancel-instance], [data-og-delete-instance]') : null;
    if (!target) return;

    if (target.matches('[data-og-select-all-remaining]')) {
      eachRedeemInput(function(el) {
        const max = parseInt(el.getAttribute('data-max') || '0', 10);
        if (!max || max <= 0) return;
        if (el.type === 'checkbox') {
          el.checked = true;
        } else {
          el.value = String(max);
        }
      });
      return;
    }

    if (target.matches('[data-og-clear-selection]')) {
      eachRedeemInput(function(el) {
        if (el.type === 'checkbox') {
          el.checked = false;
        } else {
          el.value = '0';
        }
      });
      return;
    }

    if (target.matches('[data-og-cancel-instance]')) {
      showOrSubmit('giftCancelModal', 'giftCancelForm', 'Annullare questo gift?');
      return;
    }

    if (target.matches('[data-og-delete-instance]')) {
      showOrSubmit('giftDeleteModal', 'giftDeleteForm', 'Eliminare definitivamente questo gift?');
    }
  });
})();
