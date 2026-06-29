(function () {
  document.addEventListener('click', (event) => {
    const action = event.target.closest('[data-client-consents-confirm]');

    if (!action) return;

    const message = action.getAttribute('data-client-consents-confirm') || 'Confermare questa operazione?';

    if (!window.confirm(message)) {
      event.preventDefault();
    }
  });
})();
