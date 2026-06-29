(() => {
  'use strict';

  const configEl = document.getElementById('fidelityAdesionePageConfig');
  let fidelityAdesioneConfig = {};
  if (configEl) {
    try {
      const parsedConfig = JSON.parse(configEl.textContent || '{}');
      fidelityAdesioneConfig = parsedConfig && typeof parsedConfig === 'object' ? parsedConfig : {};
    } catch (e) {
      fidelityAdesioneConfig = {};
    }
  }

(() => {
  function escapeHtml(str){
    return String(str || '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s]));
  }

  document.addEventListener('submit', function(e){
    const form = e.target && e.target.matches ? e.target : null;
    if (!form || !form.matches('[data-fidelity-card-delete-form]')) return;
    const msg = form.getAttribute('data-confirm') || 'Eliminare questa tessera?';
    if (!window.confirm(msg)) e.preventDefault();
  });

  const CARD_DEFAULT_VALIDITY_VALUE = Number(fidelityAdesioneConfig.cardDefaultValidityValue || 0);
  const CARD_DEFAULT_VALIDITY_UNIT = String(fidelityAdesioneConfig.cardDefaultValidityUnit || 'days');
  const CARD_TODAY_YMD = String(fidelityAdesioneConfig.todayYmd || '');

  function cardIso(dt){
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function cardParseYmdToDate(ymd){
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim());
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || (dt.getMonth() + 1) !== mo || dt.getDate() !== d) return null;
    return dt;
  }

  function cardAddDaysYmd(ymd, days){
    const dt = cardParseYmdToDate(ymd);
    if (!dt) return '';
    dt.setDate(dt.getDate() + Number(days || 0));
    return cardIso(dt);
  }

  function cardAddMonthsClampedYmd(ymd, months){
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim());
    if (!m) return '';
    let y = Number(m[1]);
    let mo = Number(m[2]);
    let d = Number(m[3]);

    let total = (y * 12) + (mo - 1) + Number(months || 0);
    if (total < 0) total = 0;
    y = Math.floor(total / 12);
    mo = (total % 12) + 1;

    const dim = new Date(y, mo, 0).getDate();
    if (d > dim) d = dim;

    return cardIso(new Date(y, mo - 1, d));
  }

  function cardComputeAutoExpires(baseFrom){
    baseFrom = String(baseFrom || '').trim();
    if (!baseFrom) return '';
    const val = Number(CARD_DEFAULT_VALIDITY_VALUE || 0);
    const unit = String(CARD_DEFAULT_VALIDITY_UNIT || 'days').toLowerCase();
    if (!(val > 0)) return '';
    if (unit === 'months') return cardAddMonthsClampedYmd(baseFrom, val);
    if (unit === 'years') return cardAddMonthsClampedYmd(baseFrom, val * 12);
    return cardAddDaysYmd(baseFrom, val);
  }

  async function searchClients(q){
    const url = 'index.php?page=api_clients&action=search&exclude_with_card=1&q=' + encodeURIComponent(q);
    try {
      const res = await fetch(url, { credentials: 'same-origin', headers: {'Accept':'application/json'} });
      const js = await res.json();
      if (!js || !js.ok || !Array.isArray(js.clients)) return [];
      return js.clients;
    } catch (e) {
      return [];
    }
  }

  // --- New card modal: client search ---
  const inp = document.getElementById('cardClientSearch');
  const resultsEl = document.getElementById('cardClientResults');
  const hidId = document.getElementById('cardClientId');
  const selBox = document.getElementById('cardClientSelected');
  const selName = document.getElementById('cardClientSelectedName');
  const selMeta = document.getElementById('cardClientSelectedMeta');
  const btnClear = document.getElementById('cardClientClear');
  const issuedEl = document.getElementById('cardIssuedAt');
  const expiresViewEl = document.getElementById('cardExpiresAtView');
  const statusSel = document.getElementById('cardStatusSelect');
  const expiredNoticeEl = document.getElementById('cardAlreadyExpiredNotice');

  function cardFormatDisplayDate(ymd){
    const dt = cardParseYmdToDate(ymd);
    if (!dt) return '—';
    const d = String(dt.getDate()).padStart(2, '0');
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const y = dt.getFullYear();
    return `${d}/${m}/${y}`;
  }

  function cardIsPastYmd(ymd){
    ymd = String(ymd || '').trim();
    return !!ymd && !!CARD_TODAY_YMD && ymd < CARD_TODAY_YMD;
  }

  function syncCardAlreadyExpiredNotice(){
    if (!expiredNoticeEl) return;
    const computed = cardComputeAutoExpires(issuedEl ? (issuedEl.value || '') : '');
    const wantsActive = !statusSel || String(statusSel.value || 'active') === 'active';
    const show = wantsActive && cardIsPastYmd(computed);
    expiredNoticeEl.classList.toggle('d-none', !show);
  }

  function applyCardAutoExpiry(){
    if (!issuedEl || !expiresViewEl) return;
    const computed = cardComputeAutoExpires(issuedEl.value || '');
    expiresViewEl.textContent = cardFormatDisplayDate(computed);
    syncCardAlreadyExpiredNotice();
  }

  function setSelected(client){
    if (!hidId) return;
    hidId.value = String(client.id || '');
    if (selName) selName.textContent = client.full_name || ('#' + client.id);
    const meta = [client.email || '', client.phone || ''].filter(Boolean).join(' • ');
    if (selMeta) selMeta.textContent = meta;
    if (selBox) selBox.classList.remove('d-none');
    if (inp) {
      inp.value = '';
      inp.disabled = true;
    }
    if (resultsEl) resultsEl.innerHTML = '';
  }

  function clearSelected(){
    if (hidId) hidId.value = '';
    if (selBox) selBox.classList.add('d-none');
    if (inp) {
      inp.disabled = false;
      inp.value = '';
      inp.focus();
    }
    if (resultsEl) resultsEl.innerHTML = '';
  }

  if (btnClear) btnClear.addEventListener('click', clearSelected);

  if (issuedEl) {
    const syncAuto = () => applyCardAutoExpiry();
    issuedEl.addEventListener('input', syncAuto);
    issuedEl.addEventListener('change', syncAuto);
  }

  if (statusSel) {
    statusSel.addEventListener('change', syncCardAlreadyExpiredNotice);
  }

  let t = null;
  if (inp) {
    inp.addEventListener('input', () => {
      const q = String(inp.value || '').trim();
      if (t) clearTimeout(t);
      if (q.length < 2) {
        if (resultsEl) resultsEl.innerHTML = '';
        return;
      }
      t = setTimeout(async () => {
        const list = await searchClients(q);
        if (!resultsEl) return;
        resultsEl.innerHTML = '';
        if (!Array.isArray(list) || !list.length) {
          const empty = document.createElement('div');
          empty.className = 'list-group-item text-muted small';
          empty.textContent = 'Nessun cliente disponibile senza tessera Fidelity.';
          resultsEl.appendChild(empty);
          return;
        }
        list.forEach(c => {
          const id = parseInt(c.id || 0, 10) || 0;
          if (!id) return;
          const name = c.full_name || ('#' + id);
          const meta = [c.email || '', c.phone || ''].filter(Boolean).join(' • ');

          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
          btn.innerHTML = `<div><div class="fw-semibold">${escapeHtml(name)}</div>${meta ? `<div class="text-muted small">${escapeHtml(meta)}</div>` : ''}</div><span class="badge bg-primary">Seleziona</span>`;
          btn.addEventListener('click', () => setSelected(c));
          resultsEl.appendChild(btn);
        });
      }, 250);
    });
  }

  const newModalEl = document.getElementById('newCardModal');
  if (newModalEl) {
    const resetNewCardModal = () => {
      clearSelected();
      const form = document.getElementById('newCardForm');
      if (form) form.reset();
      applyCardAutoExpiry();
      syncCardAlreadyExpiredNotice();
    };

    newModalEl.addEventListener('show.bs.modal', () => {
      applyCardAutoExpiry();
      syncCardAlreadyExpiredNotice();
    });

    newModalEl.addEventListener('hidden.bs.modal', resetNewCardModal);
  }

  const newCardFormEl = document.getElementById('newCardForm');
  if (newCardFormEl) {
    newCardFormEl.addEventListener('submit', function(e){
      const computed = cardComputeAutoExpires(issuedEl ? (issuedEl.value || '') : '');
      const wantsActive = !statusSel || String(statusSel.value || 'active') === 'active';
      if (wantsActive && cardIsPastYmd(computed)) {
        e.preventDefault();
        syncCardAlreadyExpiredNotice();
        window.alert('Con la Data emissione selezionata la tessera risulta già scaduta. Scegli una data più recente oppure impostala come Disattiva.');
      }
    });
  }

  // --- Edit modal fill ---
  const editModalEl = document.getElementById('editCardModal');
  const editModeEl = document.getElementById('editCardMode');
  const editReactivateBtn = document.getElementById('editCardReactivateBtn');
  const editSaveBtn = document.getElementById('editCardSaveBtn');
  const editStatusEl = document.getElementById('editCardStatus');
  const editFormEl = document.getElementById('editCardForm');
  if (editModalEl) {
    editModalEl.addEventListener('show.bs.modal', (event) => {
      const btn = event.relatedTarget;
      if (!btn) return;

      const cardId = btn.getAttribute('data-card-id') || '';
      const code = btn.getAttribute('data-code') || '';
      const clientName = btn.getAttribute('data-client-name') || '';
      const expiresAt = btn.getAttribute('data-expires-at') || '';
      const status = btn.getAttribute('data-status') || 'active';
      const isExpired = String(btn.getAttribute('data-is-expired') || '0') === '1';
      const reactivateExpiresAt = btn.getAttribute('data-reactivate-expires-at') || '';

      const idEl = document.getElementById('editCardId');
      if (idEl) idEl.value = cardId;

      if (editModeEl) editModeEl.value = 'update_card';

      const codeEl = document.getElementById('editCardCode');
      if (codeEl) codeEl.textContent = code || '—';

      const clEl = document.getElementById('editCardClient');
      if (clEl) clEl.textContent = clientName || '—';

      const expEl = document.getElementById('editCardExpires');
      if (expEl) expEl.textContent = cardFormatDisplayDate(expiresAt);

      const expHelpEl = document.getElementById('editCardExpiresHelp');
      if (expHelpEl) {
        if (isExpired) {
          expHelpEl.textContent = reactivateExpiresAt
            ? ('Tessera scaduta. Con la riattivazione la nuova scadenza sarà ' + cardFormatDisplayDate(reactivateExpiresAt) + '.')
            : 'Tessera scaduta. Per riattivarla imposta prima una durata tessera in Fidelity → Adesione → Impostazioni tessera Fidelity.';
        } else {
          expHelpEl.textContent = 'La data di scadenza è visualizzata ma non può essere modificata qui.';
        }
      }

      const stEl = document.getElementById('editCardStatus');
      if (stEl) stEl.value = (status === 'inactive') ? 'inactive' : 'active';

      if (editReactivateBtn) {
        editReactivateBtn.classList.toggle('d-none', !isExpired);
        if (reactivateExpiresAt) {
          editReactivateBtn.removeAttribute('disabled');
        } else {
          editReactivateBtn.setAttribute('disabled', 'disabled');
        }
      }
    });
  }

  if (editSaveBtn) {
    editSaveBtn.addEventListener('click', () => {
      if (editModeEl) editModeEl.value = 'update_card';
    });
  }

  if (editFormEl) {
    editFormEl.addEventListener('submit', (e) => {
      if (!editModeEl || editModeEl.value !== 'update_card') return;
      if (!editStatusEl || String(editStatusEl.value || '') !== 'inactive') return;
      const ok = window.confirm('Impostando "Disattiva" il cliente perderà le agevolazioni Fidelity prenotate sulle prenotazioni in stato In sospeso / Prenotato. Le prenotazioni in stato Eseguito resteranno invariate. Continuare?');
      if (!ok) e.preventDefault();
    });
  }

  if (editReactivateBtn) {
    editReactivateBtn.addEventListener('click', () => {
      const form = document.getElementById('editCardForm');
      if (!form) return;
      if (!confirm('Riattivare questa tessera Fidelity? La data di scadenza verrà ricalcolata dalla data odierna.')) return;
      if (editModeEl) editModeEl.value = 'reactivate_card';
      form.submit();
    });
  }

  applyCardAutoExpiry();

  // Client-side validation for new card
  const newForm = document.getElementById('newCardForm');
  if (newForm) {
    newForm.addEventListener('submit', (e) => {
      const v = (hidId && hidId.value) ? String(hidId.value) : '';
      if (!v) {
        e.preventDefault();
        alert('Seleziona un cliente.');
      }
    });
  }
})();

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
      reminderDays: Number.isFinite(parseInt(out.reminderDays, 10)) ? parseInt(out.reminderDays, 10) : 0
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
      reminderDays: getInt('fidelity_card_expiry_reminder_days')
    });
  }

  function isSameState(a, b) {
    return JSON.stringify(normalizeState(a)) === JSON.stringify(normalizeState(b));
  }

  function durationMayImpactDiscounts(state) {
    return !!state.expiryEnabled && (
      !initialState.expiryEnabled ||
      initialState.validityValue !== state.validityValue ||
      initialState.validityUnit !== state.validityUnit
    );
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
    const showImpact = durationMayImpactDiscounts(state);

    if (confirmTextEl) {
      confirmTextEl.textContent = state.expiryEnabled
        ? 'Tutte le tessere Fidelity esistenti verranno aggiornate in base alle nuove impostazioni di scadenza.'
        : 'La scadenza verrà rimossa da tutte le tessere Fidelity esistenti.';
    }
    if (confirmDetailEl) {
      confirmDetailEl.textContent = state.expiryEnabled
        ? 'La data di scadenza verrà ricalcolata dalla data emissione di ogni tessera già presente.'
        : 'Con la scadenza disattivata la tessera non avrà più una data di scadenza e non saranno disponibili rinnovo automatico e promemoria di scadenza.';
    }
    if (confirmImpactEl) {
      confirmImpactEl.classList.toggle('d-none', !showImpact);
    }
  }

  function resetConfirmState() {
    allowSubmit = false;
    confirmInput.value = '0';
  }

  ['change', 'input'].forEach(function(evtName){
    form.addEventListener(evtName, function(e){
      if (e && e.target && e.target.name) resetConfirmState();
    });
  });

  expiryToggle.addEventListener('change', syncFidelityCardUi);
  renewalToggle.addEventListener('change', syncFidelityCardUi);
  syncFidelityCardUi();

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
      confirmInput.value = '0';
      return;
    }

    e.preventDefault();
    updateConfirmCopy();

    if (confirmModal) {
      confirmModal.show();
      return;
    }

    let msg = state.expiryEnabled
      ? 'Tutte le tessere Fidelity esistenti verranno aggiornate in base alle nuove impostazioni di scadenza. Vuoi continuare?'
      : 'La scadenza verrà rimossa da tutte le tessere Fidelity esistenti. Vuoi continuare?';

    if (durationMayImpactDiscounts(state)) {
      msg += '\n\nATTENZIONE: la nuova durata potrebbe far risultare scadute alcune tessere Fidelity con perdita delle agevolazioni Fidelity collegate alle prenotazioni in stato In sospeso / Prenotato.';
    }

    if (!window.confirm(msg)) return;

    allowSubmit = true;
    confirmInput.value = '1';
    form.submit();
  });
})();
})();
