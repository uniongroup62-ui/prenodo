(function () {
  document.addEventListener('click', (event) => {
    const cancelButton = event.target.closest('.js-pending-cancel-btn[data-appointment-id]');
    if (cancelButton) {
      const id = parseInt(String(cancelButton.getAttribute('data-appointment-id') || '').trim(), 10) || 0;
      if (!(id > 0)) return;

      if (!window.qbAppointmentCancelDialog || typeof window.qbAppointmentCancelDialog.open !== 'function') {
        window.location.href = 'index.php?page=notifications&msg=' + encodeURIComponent('Popup annullamento non disponibile');
        return;
      }

      window.qbAppointmentCancelDialog.open(id, {
        external: true,
        pendingOnly: true,
        originalStatus: 'pending',
        onSuccess: function () {
          window.location.href = 'index.php?page=notifications&msg=' + encodeURIComponent('Appuntamento annullato');
        }
      });
      return;
    }

    const action = event.target.closest('[data-notifications-quotes-confirm]');

    if (!action) return;

    const message = action.getAttribute('data-notifications-quotes-confirm') || 'Confermare questa operazione?';

    if (!window.confirm(message)) {
      event.preventDefault();
    }
  });
})();
