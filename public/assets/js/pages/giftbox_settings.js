(function () {
  document.addEventListener('click', (event) => {
    const action = event.target.closest('[data-giftbox-settings-confirm]');

    if (!action) return;

    const message = action.getAttribute('data-giftbox-settings-confirm') || 'Confermare questa operazione?';

    if (!window.confirm(message)) {
      event.preventDefault();
    }
  });
})();
