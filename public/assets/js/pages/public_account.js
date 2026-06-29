(function () {
  'use strict';

  document.querySelectorAll('[data-cover-url]').forEach(function (card) {
    var cover = String(card.getAttribute('data-cover-url') || '').trim();
    if (!cover) return;

    var escapedCover = cover.replace(/["\\\n\r\f]/g, '\\$&');
    card.style.setProperty('--cover', 'url("' + escapedCover + '")');
  });
})();
