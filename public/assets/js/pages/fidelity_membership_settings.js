(() => {
  const form = document.getElementById('fidelityCardValidityForm');
  const confirmInput = document.getElementById('fidelityCardApplyConfirm');
  const expiryToggle = document.getElementById('fidelityCardExpiryEnabled');
  const expiryFields = document.getElementById('fidelityCardExpiryFields');
  const noExpiryNotice = document.getElementById('fidelityCardNoExpiryNotice');
  const dependentFields = document.getElementById('fidelityCardExpiryDependentFields');
  const renewalToggle = document.getElementById('fidelityCardRenewalEnabled');
  const renewalFields = document.getElementById('fidelityCardRenewalFields');
  const reminderFields = document.getElementById('fidelityCardReminderFields');
  const confirmModalEl = document.getElementById('fidelityCardValidityConfirmModal');
  const confirmTextEl = document.getElementById('fidelityCardValidityConfirmText');
  const confirmDetailEl = document.getElementById('fidelityCardValidityConfirmDetail');
  const confirmImpactEl = document.getElementById('fidelityCardValidityConfirmImpact');
  const confirmBtn = document.getElementById('fidelityCardValidityConfirmSubmit');
  const saveBtn = document.getElementById('fidelityCardValiditySubmit');
  if (!form || !confirmInput || !expiryToggle || !expiryFields || !noExpiryNotice || !dependentFields || !renewalToggle || !renewalFields || !reminderFields) return;

  let allowSubmit = false;
  let confirmModal = null;
  if (confirmModalEl && window.bootstrap && typeof bootstrap.Modal === 'function') {
    confirmModal = bootstrap.Modal.getOrCreateInstance(confirmModalEl);
  }

  let initialState = {};
  try {
    initialState = JSON.parse(form.getAttribute('data-initial-settings') || '{}') || {};
  } catch (e) {
    initialState = {};
  }

  function getInt(name) {
    const el = form.querySelector('[name="' + name + '"]');
    if (!el) return 0;
    const n = parseInt(el.value || '0', 10);
    return Number.isFinite(n) ? n : 0;
  }

  function getStr(name) {
    const el = form.querySelector('[name="' + name + '"]');
    return el ? String(el.value || '') : '';
  }

  function normalizeState(raw) {
    const out = raw || {};
    return {
      expiryEnabled: out.expiryEnabled ? 1 : 0,
      validityValue: Number.isFinite(parseInt(out.validityValue, 10)) ? parseInt(out.validityValue, 10) : 0,
      validityUnit: String(out.validityUnit || 'days'),
      renewalEnabled: out.renewalEnabled ? 1 : 0,
      renewalValue: Number.isFinite(parseInt(out.renewalValue, 10)) ? parseInt(out.renewalValue, 10) : 0,
      renewalUnit: String(out.renewalUnit || 'days'),
      reminderDays: Number.isFinite(parseInt(out.reminderDays, 10)) ? parseInt(out.reminderDays, 10) : 0,
      restoreValue: Number.isFinite(parseInt(out.restoreValue, 10)) ? parseInt(out.restoreValue, 10) : 0,
      restoreUnit: String(out.restoreUnit || 'days'),
      restoreLabel: String(out.restoreLabel || '')
    };
  }

  initialState = normalizeState(initialState);

  function currentState() {
    return normalizeState({
      expiryEnabled: expiryToggle.checked ? 1 : 0,
      validityValue: getInt('fidelity_card_default_validity_value'),
      validityUnit: getStr('fidelity_card_default_validity_unit'),
      renewalEnabled: renewalToggle.checked ? 1 : 0,
      renewalValue: getInt('fidelity_card_renewal_window_value'),
      renewalUnit: getStr('fidelity_card_renewal_window_unit'),
      reminderDays: getInt('fidelity_card_expiry_reminder_days'),
      restoreValue: initialState.restoreValue || 0,
      restoreUnit: initialState.restoreUnit || 'days',
      restoreLabel: initialState.restoreLabel || ''
    });
  }

  function isSameState(a, b) {
    return JSON.stringify(normalizeState(a)) === JSON.stringify(normalizeState(b));
  }

  function hasSettingsChanges() {
    return !isSameState(initialState, currentState());
  }

  function syncSaveButtonState() {
    if (!saveBtn) return;
    const dirty = hasSettingsChanges();
    saveBtn.disabled = !dirty;
    saveBtn.setAttribute('aria-disabled', dirty ? 'false' : 'true');
    saveBtn.title = dirty ? 'Salva le modifiche alla tessera Fidelity' : 'Nessuna modifica da salvare';
  }

  function determineConfirmMode(state) {
    const durationChanged = initialState.validityValue !== state.validityValue || initialState.validityUnit !== state.validityUnit;
    const renewalChanged = initialState.renewalEnabled !== state.renewalEnabled
      || initialState.renewalValue !== state.renewalValue
      || initialState.renewalUnit !== state.renewalUnit
      || initialState.reminderDays !== state.reminderDays;

    if (initialState.expiryEnabled && !state.expiryEnabled) return 'disable_expiry';
    if (!initialState.expiryEnabled && state.expiryEnabled) return 'restore_existing_from_snapshot';
    if (state.expiryEnabled && durationChanged) return 'duration_only';
    if (renewalChanged) return 'renewal_only';
    return 'generic';
  }

  function syncFidelityCardUi() {
    const expiryEnabled = !!expiryToggle.checked;
    const renewalEnabled = !!renewalToggle.checked;

    expiryFields.style.display = expiryEnabled ? '' : 'none';
    noExpiryNotice.style.display = expiryEnabled ? 'none' : '';
    dependentFields.style.display = expiryEnabled ? '' : 'none';

    if (expiryEnabled) {
      renewalFields.style.display = renewalEnabled ? '' : 'none';
      reminderFields.style.display = renewalEnabled ? 'none' : '';
    } else {
      renewalFields.style.display = 'none';
      reminderFields.style.display = 'none';
    }
  }

  function updateConfirmCopy() {
    const state = currentState();
    const mode = determineConfirmMode(state);
    const restoreLabel = String(initialState.restoreLabel || 'l\'ultima durata memorizzata');
    let title = 'Le modifiche avranno effetto sulle nuove tessere Fidelity e sulle tessere scadute che verranno riattivate.';
    let detail = "Le tessere attive già esistenti non subiranno variazioni di durata. Se riattivi la scadenza automatica, le tessere già presenti recupereranno prima l'ultima data di scadenza memorizzata e torneranno attive automaticamente se quella data è ancora valida; se manca una data specifica verrà usata la durata memorizzata. Rinnovo automatico e promemoria, se modificati, si aggiornano anche per le tessere già presenti.";
    let showImpact = false;

    if (mode === 'disable_expiry') {
      title = 'La scadenza verrà rimossa da tutte le tessere Fidelity già presenti.';
      detail = 'Tutte le tessere esistenti saranno rese senza scadenza. Rinnovo automatico e promemoria di scadenza non saranno disponibili finché non riattivi la scadenza.';
    } else if (mode === 'restore_existing_from_snapshot') {
      title = 'La scadenza automatica verrà riattivata per le tessere Fidelity già presenti.';
      detail = "Le tessere già presenti recupereranno prima l'ultima data di scadenza memorizzata al momento della disattivazione; se per una tessera non esiste una data specifica verrà usata la durata memorizzata (" + restoreLabel + "). Le tessere con scadenza ripristinata ancora valida torneranno attive automaticamente; quelle con scadenza già trascorsa resteranno scadute / non attive finché non usi Riattiva tessera. La durata impostata ora verrà usata per le nuove tessere e per le tessere scadute che riattiverai.";
      showImpact = true;
    } else if (mode === 'renewal_only') {
      title = 'Rinnovo automatico e promemoria di scadenza verranno aggiornati anche per le tessere già presenti.';
      detail = 'Le tessere attive esistenti non cambieranno durata o data di scadenza.';
    }

    if (confirmTextEl) confirmTextEl.textContent = title;
    if (confirmDetailEl) confirmDetailEl.textContent = detail;
    if (confirmImpactEl) confirmImpactEl.classList.toggle('d-none', !showImpact);
  }

  function resetConfirmState() {
    allowSubmit = false;
    confirmInput.value = '0';
  }

  ['change', 'input'].forEach(function(evtName){
    form.addEventListener(evtName, function(e){
      if (e && e.target && e.target.name) {
        resetConfirmState();
        syncFidelityCardUi();
        syncSaveButtonState();
      }
    });
  });

  expiryToggle.addEventListener('change', function(){
    syncFidelityCardUi();
    syncSaveButtonState();
  });
  renewalToggle.addEventListener('change', function(){
    syncFidelityCardUi();
    syncSaveButtonState();
  });
  syncFidelityCardUi();
  syncSaveButtonState();

  if (confirmBtn) {
    confirmBtn.addEventListener('click', function(){
      allowSubmit = true;
      confirmInput.value = '1';
      if (confirmModal) confirmModal.hide();
      form.submit();
    });
  }

  form.addEventListener('submit', function(e){
    if (allowSubmit) return;

    const state = currentState();
    if (isSameState(initialState, state)) {
      e.preventDefault();
      confirmInput.value = '0';
      syncSaveButtonState();
      return;
    }

    e.preventDefault();
    updateConfirmCopy();

    if (confirmModal) {
      confirmModal.show();
      return;
    }

    const mode = determineConfirmMode(state);
    let msg = "Le modifiche avranno effetto sulle nuove tessere Fidelity e sulle tessere scadute che verranno riattivate. Le tessere attive già esistenti non subiranno variazioni. Se in futuro riattiverai la scadenza automatica, le tessere già presenti recupereranno prima l'ultima data di scadenza memorizzata e torneranno attive automaticamente se quella data è ancora valida. Vuoi continuare?";

    if (mode === 'disable_expiry') {
      msg = 'La scadenza verrà rimossa da tutte le tessere Fidelity già presenti. Vuoi continuare?';
    } else if (mode === 'restore_existing_from_snapshot') {
      const restoreLabel = String(initialState.restoreLabel || 'l\'ultima durata memorizzata');
      msg = "La scadenza automatica verrà riattivata per le tessere Fidelity già presenti. Le tessere già presenti recupereranno prima l'ultima data di scadenza memorizzata al momento della disattivazione; se per una tessera non esiste una data specifica verrà usata la durata memorizzata (" + restoreLabel + "). Le tessere con scadenza ripristinata ancora valida torneranno attive automaticamente; quelle con scadenza già trascorsa resteranno scadute / non attive finché non usi Riattiva tessera. Vuoi continuare?";
      msg += '\n\nATTENZIONE: alcune tessere potrebbero tornare scadute e le prenotazioni in stato In sospeso / Prenotato perderebbero le agevolazioni Fidelity collegate.';
    } else if (mode === 'renewal_only') {
      msg = 'Rinnovo automatico e promemoria di scadenza verranno aggiornati anche per le tessere già presenti. Le tessere attive esistenti non cambieranno durata o data di scadenza. Vuoi continuare?';
    }

    if (!window.confirm(msg)) return;

    allowSubmit = true;
    confirmInput.value = '1';
    form.submit();
  });
})();
