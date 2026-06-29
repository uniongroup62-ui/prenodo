(() => {
  'use strict';

  function readConfig() {
    const el = document.getElementById('giftsVoucherConfig');
    if (!el) return {};
    try {
      const parsed = JSON.parse(el.textContent || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  const config = readConfig();

  document.addEventListener('click', function(e) {
    const btn = e.target && e.target.closest ? e.target.closest('[data-voucher-print]') : null;
    if (!btn) return;
    try { window.print(); } catch (err) {}
  });

  document.querySelectorAll('[data-voucher-hide-on-error]').forEach(function(img) {
    const hide = function() { img.classList.add('d-none'); };
    img.addEventListener('error', hide);
    if (img.complete && img.naturalWidth === 0) hide();
  });

  try {
    const code = String(config.barcode || '');
    if (window.JsBarcode && code) {
      window.JsBarcode('#barcode', code, {
        format: 'CODE128',
        displayValue: false,
        height: 70,
        margin: 0
      });
    }
  } catch (e) {}

  if (config.autoPrint) {
    window.addEventListener('load', function() {
      try { window.print(); } catch (e) {}
    });
  }
})();
