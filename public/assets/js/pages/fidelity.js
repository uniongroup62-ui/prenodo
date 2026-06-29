(function () {
  const configEl = document.getElementById('fidelityPageConfig');
  let config = {};

  if (configEl) {
    try {
      config = JSON.parse(configEl.textContent || '{}');
    } catch (e) {
      config = {};
    }
  }

  const toggleChk = document.getElementById('fidEnabledGlobal');
  const toggleLbl = document.querySelector('label[for="fidEnabledGlobal"]');
  const toggleForm = document.getElementById('fidToggleForm');
  const modalEl = document.getElementById('disableFidelityConfirmModal');
  const wasEnabled = Boolean(config.wasEnabled);
  const disableModalMode = String(config.disableModalMode || '');

  function syncToggleLabel() {
    if (!toggleChk || !toggleLbl) return;
    toggleLbl.textContent = toggleChk.checked ? 'Attivo' : 'Disattivo';
  }

  if (toggleChk) {
    toggleChk.addEventListener('change', syncToggleLabel);
    syncToggleLabel();
  }

  if (toggleForm && toggleChk) {
    toggleForm.addEventListener('submit', (ev) => {
      if (!wasEnabled) return;
      if (toggleChk.checked) return;
      if (!disableModalMode) return;

      ev.preventDefault();

      if (modalEl && window.bootstrap && window.bootstrap.Modal) {
        try {
          const bsModal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
          bsModal.show();
          return;
        } catch (e) {
        }
      }

      const fallbackMsg = disableModalMode === 'campaigns'
        ? 'Sono presenti campagne collegate alla Fidelity. Disattivale prima dalle sezioni Promozioni / Omaggi.'
        : 'Sono presenti prenotazioni in stato In sospeso/Prenotato con agevolazioni Fidelity. Usa il popup di conferma per completare la disattivazione.';

      window.alert(fallbackMsg);
    });
  }
})();
