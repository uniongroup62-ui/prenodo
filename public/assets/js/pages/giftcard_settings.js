(function () {
  document.addEventListener('click', (event) => {
    const action = event.target.closest('[data-giftcard-settings-confirm]');

    if (!action) return;

    const message = action.getAttribute('data-giftcard-settings-confirm') || 'Confermare questa operazione?';

    if (!window.confirm(message)) {
      event.preventDefault();
    }
  });
})();
