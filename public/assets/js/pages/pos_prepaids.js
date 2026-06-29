(() => {
  'use strict';

  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  document.querySelectorAll('[data-autosubmit]').forEach(function(input) {
    input.addEventListener('change', function() {
      if (input.form) input.form.submit();
    });
  });

  document.querySelectorAll('.prepaids-filter-card .pos-filter-search').forEach(function(input) {
    const target = document.querySelector(input.getAttribute('data-filter-target') || '');
    if (!target) return;
    const options = Array.prototype.slice.call(target.querySelectorAll('[data-filter-option]'));
    input.addEventListener('input', function() {
      const q = norm(input.value);
      options.forEach(function(option) {
        const text = norm(option.getAttribute('data-filter-text') || option.textContent || '');
        option.classList.toggle('d-none', q !== '' && text.indexOf(q) === -1);
      });
    });
  });
})();
