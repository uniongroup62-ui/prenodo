(function(){
  function parseJsonScript(id){
    const el = document.getElementById(id);
    if (!el) return null;
    try {
      const raw = String(el.textContent || '').trim();
      return raw ? JSON.parse(raw) : null;
    } catch(e) {
      return null;
    }
  }

  const FIDELITY_POINTS_CONFIG = parseJsonScript('fidelityPointsConfig') || {};

  const FIDELITY_LEVELS_ONLY_VIEW = !!FIDELITY_POINTS_CONFIG.levelsOnlyView;

  (function(){
    const settingsForm = document.getElementById('fidSettingsForm');
    const pointsChk = document.getElementById('fidPointsEnabled');
    const redeemChk = document.getElementById('fidRedeem');
    const redeemModalEl = document.getElementById('disableRedeemConfirmModal');
    const redeemConfirmInput = document.getElementById('disableRedeemConfirmedInput');
    const redeemConfirmBtn = document.getElementById('disableRedeemConfirmBtn');
    const wasPointsOperationalEnabled = !!FIDELITY_POINTS_CONFIG.wasPointsOperationalEnabled;
    const wasRedeemEnabled = !!FIDELITY_POINTS_CONFIG.wasRedeemEnabled;
    const redeemDisableNeedsConfirm = !!FIDELITY_POINTS_CONFIG.redeemDisableNeedsConfirm;
    const redeemModalTitle = document.getElementById('disableRedeemConfirmModalLabel');
    const redeemModalIntroTitle = document.getElementById('disableRedeemIntroTitle');
    const redeemModalImpactTitle = document.getElementById('disableRedeemImpactTitle');
    const redeemModalImpactText = document.getElementById('disableRedeemImpactText');

    function updateRedeemDisableModal(isDisablingPointsModule) {
      if (redeemModalTitle) {
        redeemModalTitle.textContent = isDisablingPointsModule ? 'Disattiva Punti Fidelity' : 'Disattiva sconto tramite punti';
      }
      if (redeemModalIntroTitle) {
        redeemModalIntroTitle.textContent = isDisablingPointsModule
          ? 'Prenotazioni aperte con sconto/scelta punti attiva'
          : 'Prenotazioni aperte con sconto/scelta punti';
      }
      if (redeemModalImpactTitle) {
        redeemModalImpactTitle.textContent = isDisablingPointsModule
          ? 'Cosa succede disattivando Punti Fidelity'
          : 'Cosa succede disattivando lo sconto tramite punti';
      }
      if (redeemModalImpactText) {
        redeemModalImpactText.textContent = isDisablingPointsModule
          ? 'Gli sconti/scelte punti verranno rimossi automaticamente dalle prenotazioni aperte coinvolte. Le campagne punti attive verranno disattivate. Saldo punti, movimenti e storico resteranno salvati.'
          : 'Gli sconti/scelte punti verranno rimossi automaticamente dalle prenotazioni aperte coinvolte. I punti torneranno disponibili; saldo punti, movimenti e storico resteranno salvati.';
      }
    }

    if (redeemConfirmBtn && redeemConfirmInput) {
      redeemConfirmBtn.addEventListener('click', function(){
        redeemConfirmInput.value = '1';

        if (settingsForm && typeof settingsForm.reportValidity === 'function' && !settingsForm.reportValidity()) {
          redeemConfirmInput.value = '0';
          return;
        }

        if (settingsForm && typeof settingsForm.requestSubmit === 'function') {
          settingsForm.requestSubmit();
          return;
        }

        if (settingsForm) {
          settingsForm.submit();
          return;
        }

        redeemConfirmInput.value = '0';
      });
    }

    if (settingsForm && redeemChk) {
      settingsForm.addEventListener('submit', function(ev){
        if (ev.defaultPrevented) return;

        const pointsOn = pointsChk ? !!pointsChk.checked : true;
        const wantsDisablePoints = !!wasPointsOperationalEnabled && !pointsOn;
        const wantsDisableRedeem = !!wasRedeemEnabled && (!pointsOn || !redeemChk.checked);
        const wantsDisable = wantsDisablePoints || wantsDisableRedeem;
        const alreadyConfirmed = !!(redeemConfirmInput && redeemConfirmInput.value === '1');

        if (!wantsDisable || !redeemDisableNeedsConfirm || alreadyConfirmed) {
          if (!alreadyConfirmed && redeemConfirmInput) redeemConfirmInput.value = '0';
          return;
        }

        ev.preventDefault();
        updateRedeemDisableModal(wantsDisablePoints);

        if (redeemModalEl && window.bootstrap && bootstrap.Modal) {
          try {
            const bsModal = bootstrap.Modal.getOrCreateInstance(redeemModalEl);
            bsModal.show();
            return;
          } catch (e) {
            // fallback below
          }
        }

        alert(wantsDisablePoints
          ? 'Sono presenti prenotazioni aperte con sconto/scelta punti Fidelity. Conferma la rimozione prima di disattivare Punti Fidelity.'
          : 'Sono presenti prenotazioni aperte con sconto/scelta punti Fidelity. Conferma la rimozione prima di disattivare lo sconto tramite punti.');
      });
    }

    if (redeemChk) {
      redeemChk.addEventListener('change', function(){
        if (redeemChk.checked && redeemConfirmInput) {
          redeemConfirmInput.value = '0';
        }
      });
    }
    if (pointsChk) {
      pointsChk.addEventListener('change', function(){
        if (pointsChk.checked && redeemConfirmInput) {
          redeemConfirmInput.value = '0';
        }
      });
    }

    if (redeemModalEl && window.bootstrap && bootstrap.Modal) {
      redeemModalEl.addEventListener('hidden.bs.modal', function(){
        if (redeemConfirmInput) redeemConfirmInput.value = '0';
      });
    }
  })();

  (function(){
    const settingsForm = document.getElementById('fidSettingsForm');
    const pointsChk = document.getElementById('fidPointsEnabled');
    const expireChk = document.getElementById('fidExpire');
    const expireDaysInput = settingsForm ? settingsForm.querySelector('input[name="fidelity_expire_days"]') : null;
    const confirmedInput = document.getElementById('expirySettingsConfirmedInput');
    const modalEl = document.getElementById('fidelityExpiryConfirmModal');
    const modalTitle = document.getElementById('fidelityExpiryConfirmModalLabel');
    const modalSubtitle = document.getElementById('fidelityExpiryConfirmSubtitle');
    const modalImpact = document.getElementById('fidelityExpiryConfirmImpact');
    const confirmBtn = document.getElementById('fidelityExpiryConfirmBtn');
    const currentExpireEnabled = !!FIDELITY_POINTS_CONFIG.currentExpireEnabled;
    const currentExpireDays = Number(FIDELITY_POINTS_CONFIG.currentExpireDays || 365);

    if (!settingsForm || !expireChk || !confirmedInput) return;

    function cleanDays(value){
      let n = parseInt(String(value == null ? '' : value), 10);
      if (!Number.isFinite(n) || Number.isNaN(n)) n = 0;
      if (n < 0) n = 0;
      if (n > 36500) n = 36500;
      return n;
    }

    function validateExpireDays(){
      if (!expireDaysInput) return true;

      const pointsOn = pointsChk ? !!pointsChk.checked : true;
      const expireOn = !!expireChk.checked;
      const nextDays = cleanDays(expireDaysInput.value);

      if (pointsOn && expireOn && nextDays <= 0) {
        expireDaysInput.setCustomValidity('Inserisci un valore maggiore di 0 per abilitare la scadenza punti.');
        if (typeof expireDaysInput.reportValidity === 'function') expireDaysInput.reportValidity();
        else window.alert('Inserisci un valore maggiore di 0 per abilitare la scadenza punti.');
        try { expireDaysInput.focus(); } catch (e) {}
        return false;
      }

      expireDaysInput.setCustomValidity('');
      return true;
    }

    function getChangeType(){
      const pointsOn = pointsChk ? !!pointsChk.checked : true;
      if (!pointsOn) return '';

      const nextEnabled = !!expireChk.checked;
      const nextDays = cleanDays(expireDaysInput ? expireDaysInput.value : currentExpireDays);

      if (currentExpireEnabled !== nextEnabled) {
        return nextEnabled ? 'enable' : 'disable';
      }
      if (nextEnabled && currentExpireDays !== nextDays) {
        return 'days';
      }
      return '';
    }

    function updateModal(type){
      if (!modalTitle || !modalSubtitle || !modalImpact) return;
      const nextDays = cleanDays(expireDaysInput ? expireDaysInput.value : currentExpireDays);

      if (type === 'enable') {
        modalTitle.textContent = 'Attivare scadenza punti?';
        modalSubtitle.textContent = 'La regola verra applicata ai punti residui aperti.';
        modalImpact.textContent = 'I punti residui ancora disponibili riceveranno una scadenza calcolata da oggi. I nuovi punti avranno la stessa regola.';
        return;
      }

      if (type === 'disable') {
        modalTitle.textContent = 'Disattivare scadenza punti?';
        modalSubtitle.textContent = 'La scadenza verra rimossa dai punti residui aperti.';
        modalImpact.textContent = 'I punti residui ancora disponibili non avranno piu una data di scadenza. I punti gia scaduti in passato non verranno ripristinati.';
        return;
      }

      modalTitle.textContent = 'Aggiornare scadenza punti?';
      modalSubtitle.textContent = 'La nuova durata verra applicata ai punti residui aperti.';
      modalImpact.textContent = 'La scadenza dei punti residui ancora disponibili verra ricalcolata da oggi usando il nuovo numero di giorni.';
    }

    function submitConfirmed(){
      if (!validateExpireDays()) {
        confirmedInput.value = '0';
        return;
      }

      confirmedInput.value = '1';

      if (settingsForm && typeof settingsForm.reportValidity === 'function' && !settingsForm.reportValidity()) {
        confirmedInput.value = '0';
        return;
      }

      if (settingsForm && typeof settingsForm.requestSubmit === 'function') {
        settingsForm.requestSubmit();
        return;
      }

      settingsForm.submit();
    }

    settingsForm.addEventListener('submit', function(ev){
      if (ev.defaultPrevented) return;
      if (confirmedInput.value === '1') return;

      if (!validateExpireDays()) {
        confirmedInput.value = '0';
        return;
      }

      const changeType = getChangeType();
      if (!changeType) {
        confirmedInput.value = '0';
        return;
      }

      if (typeof settingsForm.reportValidity === 'function' && !settingsForm.reportValidity()) {
        return;
      }

      ev.preventDefault();
      updateModal(changeType);

      if (modalEl && window.bootstrap && bootstrap.Modal) {
        try {
          bootstrap.Modal.getOrCreateInstance(modalEl).show();
          return;
        } catch (e) {
          // fallback below
        }
      }

      if (window.confirm('Confermare la modifica della scadenza punti?')) {
        submitConfirmed();
      }
    }, true);

    if (confirmBtn) {
      confirmBtn.addEventListener('click', submitConfirmed);
    }

    [pointsChk, expireChk, expireDaysInput].forEach(function(el){
      if (!el) return;
      el.addEventListener('change', function(){
        confirmedInput.value = '0';
        validateExpireDays();
      });
      el.addEventListener('input', function(){
        confirmedInput.value = '0';
        if (expireDaysInput) expireDaysInput.setCustomValidity('');
      });
    });

    if (modalEl && window.bootstrap && bootstrap.Modal) {
      modalEl.addEventListener('hidden.bs.modal', function(){
        confirmedInput.value = '0';
      });
    }
  })();

  (function(){
    const pointsChk = document.getElementById('fidPointsEnabled');
    const operationalBoxes = document.querySelectorAll('.fidOperationalSettings');
    const campaignCards = document.querySelectorAll('.fidCampaignsCard');
    if (!pointsChk) return;

    function syncPointsVisibility(){
      const savedOn = String(pointsChk.getAttribute('data-saved-enabled') || '') === '1';
      const on = savedOn && !!pointsChk.checked;
      operationalBoxes.forEach(el => {
        if (on) el.classList.remove('d-none');
        else el.classList.add('d-none');
      });
      campaignCards.forEach(el => {
        if (FIDELITY_LEVELS_ONLY_VIEW && el.getAttribute('data-levels-card') === '1') {
          el.classList.remove('d-none');
          return;
        }
        if (on) el.classList.remove('d-none');
        else el.classList.add('d-none');
      });
      const expireChk = document.getElementById('fidExpire');
      const redeemChk = document.getElementById('fidRedeem');
      if (expireChk) expireChk.dispatchEvent(new Event('change'));
      if (redeemChk) redeemChk.dispatchEvent(new Event('change'));
    }

    pointsChk.addEventListener('change', syncPointsVisibility);
    syncPointsVisibility();
  })();

  (function(){
    const levelsForm = document.getElementById('fidLevelsInlineForm');
    const list = document.getElementById('fidPointsLevelsList');
    const tpl = document.getElementById('fidPointsLevelTpl');
    const addBtn = document.getElementById('fidPointsLevelAdd');
    if (!levelsForm || !list) return;

    const previewModalEl = document.getElementById('fidelityLevelDeletePreviewModal');
    const previewSubtitle = document.getElementById('fidelityLevelDeletePreviewSubtitle');
    const previewBody = document.getElementById('fidelityLevelDeletePreviewBody');
    const previewConfirmBtn = document.getElementById('fidelityLevelDeletePreviewConfirm');
    const previewWarning = document.getElementById('fidelityLevelDeletePreviewWarning');
    const thresholdModalEl = document.getElementById('fidelityLevelThresholdPreviewModal');
    const thresholdSubtitle = document.getElementById('fidelityLevelThresholdPreviewSubtitle');
    const thresholdBody = document.getElementById('fidelityLevelThresholdPreviewBody');
    const thresholdConfirmBtn = document.getElementById('fidelityLevelThresholdPreviewConfirm');
    const levelsInlineError = document.getElementById('fidLevelsInlineError');
    let pendingDeleteRow = null;
    let pendingDeleteToken = '';
    let thresholdConfirmed = false;
    let pendingThresholdSignature = '';

    function esc(v){
      return String(v == null ? '' : v).replace(/[&<>"']/g, function(ch){
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch] || ch;
      });
    }

    function getRowName(row){
      if (!row) return 'Livello';
      const input = row.querySelector('input[name="fidelity_points_level_names[]"]');
      const inputName = input ? String(input.value || '').trim() : '';
      if (inputName) return inputName;
      const dataName = String(row.dataset.levelName || '').trim();
      return dataName || 'Livello';
    }

    function getRowToken(row){
      if (!row) return '';
      const family = String(row.dataset.levelFamily || 'points').trim().toLowerCase();
      let key = String(row.dataset.levelKey || '').trim().toLowerCase();
      if (!key) {
        const hidden = row.querySelector('input[type="hidden"][name="fidelity_points_level_keys[]"]');
        if (hidden) key = String(hidden.value || '').trim().toLowerCase();
      }
      if (!family || !key) return '';
      return family + ':' + key;
    }

    function currentDeleteTokens(extraToken){
      const out = [];
      levelsForm.querySelectorAll('input[name="fidelity_delete_confirmed[]"]').forEach(function(el){
        const token = String(el.value || '').trim().toLowerCase();
        if (token) out.push(token);
      });
      if (extraToken) out.push(String(extraToken).trim().toLowerCase());
      return Array.from(new Set(out.filter(Boolean)));
    }

    function addDeleteConfirmationToken(row){
      if (!row) return;
      const token = getRowToken(row);
      if (!token) return;
      let exists = false;
      levelsForm.querySelectorAll('input[name="fidelity_delete_confirmed[]"]').forEach(function(el){
        if (String(el.value || '').trim().toLowerCase() === token) exists = true;
      });
      if (exists) return;
      const inp = document.createElement('input');
      inp.type = 'hidden';
      inp.name = 'fidelity_delete_confirmed[]';
      inp.value = token;
      levelsForm.appendChild(inp);
    }

    function renderSummary(payload){
      const impact = payload && payload.impact ? payload.impact : {};
      const clients = impact.clients || {};
      const campaigns = impact.campaigns || {};
      const promotions = impact.promotions || {};
      const gifts = impact.gifts || {};
      const clientCount = Number(clients.count || 0);
      const campaignTotal = Number(campaigns.updated || 0) + Number(campaigns.disabled || 0);
      const promoTotal = Number(promotions.updated || 0) + Number(promotions.disabled || 0) + Number(promotions.appointments || 0);
      const giftTotal = Number(gifts.updated || 0) + Number(gifts.disabled || 0);
      const totalImpact = clientCount + campaignTotal + promoTotal + giftTotal;
      const nextLevels = clients.next_levels || {};
      const nextRows = Object.keys(nextLevels).map(function(key){
        const item = nextLevels[key] || {};
        return '<div class="small text-muted">' + esc(item.count || 0) + ' clienti &rarr; ' + esc(item.name || 'Livello base') + '</div>';
      }).join('');
      const sections = [];

      function section(id, title, count, html){
        return '<div class="accordion-item border rounded-3 overflow-hidden mb-2">' +
          '<h3 class="accordion-header" id="' + id + 'Head">' +
            '<button class="accordion-button collapsed bg-white shadow-none py-2" type="button" data-bs-toggle="collapse" data-bs-target="#' + id + '" aria-expanded="false" aria-controls="' + id + '">' +
              '<span class="d-flex align-items-center justify-content-between gap-2 w-100 pe-2">' +
                '<span class="fw-semibold">' + esc(title) + '</span>' +
                '<span class="badge rounded-pill text-bg-info">' + esc(count) + '</span>' +
              '</span>' +
            '</button>' +
          '</h3>' +
          '<div id="' + id + '" class="accordion-collapse collapse" aria-labelledby="' + id + 'Head" data-bs-parent="#fidelityLevelDeletePreviewAccordion">' +
            '<div class="accordion-body py-2">' + html + '</div>' +
          '</div>' +
        '</div>';
      }

      if (clientCount > 0) {
        sections.push(section(
          'fidLevelImpactClients',
          'Clienti ricalcolati',
          clientCount,
          nextRows
        ));
      }

      if (campaignTotal > 0) {
        const rows = [];
        if (Number(campaigns.updated || 0) > 0) rows.push('<div class="small">Aggiornate: <strong>' + esc(campaigns.updated || 0) + '</strong></div>');
        if (Number(campaigns.disabled || 0) > 0) rows.push('<div class="small">Disattivate: <strong>' + esc(campaigns.disabled || 0) + '</strong></div>');
        sections.push(section('fidLevelImpactCampaigns', 'Campagne punti', campaignTotal, rows.join('')));
      }

      if (promoTotal > 0) {
        const rows = [];
        if (Number(promotions.updated || 0) > 0) rows.push('<div class="small">Aggiornate: <strong>' + esc(promotions.updated || 0) + '</strong></div>');
        if (Number(promotions.disabled || 0) > 0) rows.push('<div class="small">Disattivate: <strong>' + esc(promotions.disabled || 0) + '</strong></div>');
        if (Number(promotions.appointments || 0) > 0) rows.push('<div class="small">Prenotazioni aperte aggiornate: <strong>' + esc(promotions.appointments || 0) + '</strong></div>');
        sections.push(section('fidLevelImpactPromotions', 'Promozioni', promoTotal, rows.join('')));
      }

      if (giftTotal > 0) {
        const rows = [];
        if (Number(gifts.updated || 0) > 0) rows.push('<div class="small">Aggiornati: <strong>' + esc(gifts.updated || 0) + '</strong></div>');
        if (Number(gifts.disabled || 0) > 0) rows.push('<div class="small">Disattivati: <strong>' + esc(gifts.disabled || 0) + '</strong></div>');
        sections.push(section('fidLevelImpactGifts', 'Omaggi', giftTotal, rows.join('')));
      }

      if (!totalImpact) {
        return '<div class="py-2">' +
          '<div class="h6 fw-semibold mb-2">Sei sicuro di eliminare questo livello?</div>' +
          '<div class="text-muted small">Il livello verra rimosso dalla lista e la modifica sara applicata solo dopo <strong>Salva livelli</strong>.</div>' +
        '</div>';
      }

      return '<div class="accordion" id="fidelityLevelDeletePreviewAccordion">' + sections.join('') + '</div>';
    }

    function count(v){
      const n = Number(v || 0);
      return Number.isFinite(n) ? n : 0;
    }

    function fmtPts(v){
      const n = Number(v || 0);
      if (!Number.isFinite(n)) return '0';
      return n.toLocaleString('it-IT', {maximumFractionDigits: 2});
    }

    function hiddenThresholdInput(){
      return levelsForm.querySelector('input[name="fidelity_threshold_change_confirmed"]');
    }

    function clearThresholdConfirmation(){
      thresholdConfirmed = false;
      pendingThresholdSignature = '';
      const old = hiddenThresholdInput();
      if (old) old.remove();
    }

    function clearLevelsInlineError(){
      if (levelsInlineError) {
        levelsInlineError.textContent = '';
        levelsInlineError.classList.add('d-none');
      }
      list.querySelectorAll('input.is-invalid').forEach(function(input){
        input.classList.remove('is-invalid');
      });
    }

    function showLevelsInlineError(message){
      if (!levelsInlineError) {
        window.alert(message || 'Controlla i livelli card prima di salvare.');
        return;
      }
      levelsInlineError.textContent = message || 'Controlla i livelli card prima di salvare.';
      levelsInlineError.classList.remove('d-none');
      try { levelsInlineError.scrollIntoView({behavior: 'smooth', block: 'center'}); } catch (e) {}
    }

    function currentLevelRows(){
      return Array.from(list.querySelectorAll('.fidPointsLevelRow'));
    }

    function isBaseRow(row){
      return !!row && String(row.dataset.baseLevel || '') === '1';
    }

    function updateRemoveButtons(){
      const rows = currentLevelRows();
      rows.forEach(function(row){
        const btn = row.querySelector('.fidPointsLevelRemove');
        if (!btn) return;
        const base = isBaseRow(row);
        btn.disabled = base;
        btn.title = base ? 'Livello base non eliminabile' : 'Rimuovi';
      });
    }

    function canRemoveLevelRow(row){
      return !isBaseRow(row);
    }

    function showRemoveBlockedError(row){
      if (isBaseRow(row)) {
        showLevelsInlineError('Il livello base predefinito non puo essere eliminato. Puoi modificare solo il nome.');
        return;
      }
      showLevelsInlineError('Questo livello non puo essere rimosso.');
    }

    function validateLevelsBeforePreview(){
      clearLevelsInlineError();
      const rows = currentLevelRows();
      const pointsMap = new Map();

      for (const row of rows) {
        const nameInput = row.querySelector('input[name="fidelity_points_level_names[]"]');
        const pointsInput = row.querySelector('input[name="fidelity_points_level_points[]"]');
        let name = nameInput ? String(nameInput.value || '').trim() : '';
        if (isBaseRow(row) && name === '' && nameInput) {
          nameInput.value = 'Base';
          name = 'Base';
        }
        if (!name) continue;

        const raw = pointsInput ? String(pointsInput.value || '0').replace(',', '.') : '0';
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) {
          if (pointsInput) pointsInput.classList.add('is-invalid');
          return 'Inserisci un valore valido nei punti necessari.';
        }

        const key = n.toFixed(2);
        if (!isBaseRow(row) && Math.abs(n) < 0.0000001) {
          if (pointsInput) pointsInput.classList.add('is-invalid');
          return 'Solo il livello base predefinito puo avere 0 punti.';
        }
        if (pointsMap.has(key)) {
          if (pointsInput) pointsInput.classList.add('is-invalid');
          const other = pointsMap.get(key);
          if (other) other.classList.add('is-invalid');
          return 'Non puoi salvare due livelli card con gli stessi punti necessari.';
        }
        if (pointsInput) pointsMap.set(key, pointsInput);
      }

      return '';
    }

    function setThresholdConfirmation(signature){
      clearThresholdConfirmation();
      const inp = document.createElement('input');
      inp.type = 'hidden';
      inp.name = 'fidelity_threshold_change_confirmed';
      inp.value = String(signature || '');
      levelsForm.appendChild(inp);
      pendingThresholdSignature = inp.value;
      thresholdConfirmed = true;
    }

    function submitLevelsAfterThreshold(signature){
      setThresholdConfirmation(signature);
      if (thresholdModalEl && window.bootstrap && bootstrap.Modal) {
        try { bootstrap.Modal.getOrCreateInstance(thresholdModalEl).hide(); } catch (e) {}
      }
      if (levelsForm.requestSubmit) levelsForm.requestSubmit();
      else levelsForm.submit();
    }

    function renderThresholdPreview(payload){
      const impact = payload && payload.impact ? payload.impact : {};
      const changes = Array.isArray(impact.changes) ? impact.changes : [];
      const clients = impact.clients || {};
      const links = impact.links || {};

      const rows = changes.map(function(ch){
        return '<div class="d-flex justify-content-between align-items-center gap-3 border rounded-3 bg-white px-3 py-2">' +
          '<div class="fw-semibold">' + esc(ch.name || ch.key || 'Livello') + '</div>' +
          '<div class="small text-muted text-nowrap">' + fmtPts(ch.old) + ' &rarr; <strong class="text-body">' + fmtPts(ch.new) + '</strong> punti</div>' +
        '</div>';
      }).join('');

      let html = '<div class="mb-3">' +
        '<div class="fw-semibold mb-2">Soglie modificate</div>' +
        '<div class="d-flex flex-column gap-2">' + rows + '</div>' +
      '</div>';

      const changed = count(clients.changed);
      const movedUp = count(clients.moved_up);
      const movedDown = count(clients.moved_down);
      const same = count(clients.same);
      if (changed > 0) {
        html += '<div class="row g-2 mb-3">' +
          '<div class="col-12 col-md-4"><div class="border rounded-3 bg-white px-3 py-2"><div class="small text-muted">Clienti ricalcolati</div><div class="fw-semibold">' + esc(changed) + '</div></div></div>' +
          '<div class="col-6 col-md-4"><div class="border rounded-3 bg-white px-3 py-2"><div class="small text-muted">Salgono</div><div class="fw-semibold text-success">' + esc(movedUp) + '</div></div></div>' +
          '<div class="col-6 col-md-4"><div class="border rounded-3 bg-white px-3 py-2"><div class="small text-muted">Scendono</div><div class="fw-semibold text-warning">' + esc(movedDown) + '</div></div></div>' +
        '</div>';

      } else {
        html += '<div class="alert alert-info mb-3">' +
          '<div class="fw-semibold mb-1">Nessun cliente cambia livello</div>' +
          '<div class="small">Le soglie cambiano, ma con i punti attuali nessun cliente aderente verrebbe spostato. Clienti invariati: ' + esc(same) + '.</div>' +
        '</div>';
      }

      const linked = [];
      if (count(links.campaigns) > 0) linked.push('Campagne punti: <strong>' + esc(links.campaigns) + '</strong>');
      if (count(links.promotions) > 0) linked.push('Promozioni: <strong>' + esc(links.promotions) + '</strong>');
      if (count(links.gifts) > 0) linked.push('Omaggi: <strong>' + esc(links.gifts) + '</strong>');
      if (count(links.giftboxes) > 0) linked.push('GiftBox: <strong>' + esc(links.giftboxes) + '</strong>');
      if (count(links.open_appointments) > 0) linked.push('Prenotazioni aperte collegate a promozioni: <strong>' + esc(links.open_appointments) + '</strong>');

      if (linked.length) {
        html += '<div class="border rounded-3 bg-white px-3 py-2">' +
          '<div class="fw-semibold mb-1">Regole collegate</div>' +
          '<div class="small text-muted mb-2">Queste regole restano collegate allo stesso livello, ma useranno la nuova soglia.</div>' +
          '<div class="small">' + linked.join('<br>') + '</div>' +
        '</div>';
      }

      return html;
    }

    async function showThresholdPreview(){
      const validationError = validateLevelsBeforePreview();
      if (validationError) {
        showLevelsInlineError(validationError);
        return;
      }

      const fd = new FormData(levelsForm);
      fd.delete('_mode');
      fd.append('_mode', 'preview_fidelity_level_thresholds');

      if (thresholdSubtitle) thresholdSubtitle.textContent = '';
      if (thresholdBody) thresholdBody.innerHTML = '<div class="text-muted">Calcolo impatto in corso...</div>';
      if (thresholdConfirmBtn) thresholdConfirmBtn.disabled = true;

      try {
        const res = await fetch('index.php?page=fidelity_points', {
          method: 'POST',
          body: fd,
          credentials: 'same-origin',
          headers: {'Accept': 'application/json'}
        });
        const data = await res.json();
        if (!res.ok || !data || !data.ok) throw new Error((data && data.error) ? data.error : 'Preview non disponibile.');
        const impact = data.impact || {};
        const changes = Array.isArray(impact.changes) ? impact.changes : [];
        if (!changes.length) {
          thresholdConfirmed = true;
          if (levelsForm.requestSubmit) levelsForm.requestSubmit();
          else levelsForm.submit();
          return;
        }

        pendingThresholdSignature = String(impact.signature || '');
        if (!pendingThresholdSignature) throw new Error('Firma conferma non disponibile.');
        if (thresholdSubtitle) thresholdSubtitle.textContent = changes.length === 1 ? '1 livello modificato' : (changes.length + ' livelli modificati');

        if (!thresholdModalEl || !thresholdBody || !thresholdConfirmBtn || !(window.bootstrap && bootstrap.Modal)) {
          const ok = window.confirm('Confermare la modifica dei punti necessari? I clienti verranno ricalcolati dopo il salvataggio.');
          if (ok) submitLevelsAfterThreshold(pendingThresholdSignature);
          return;
        }

        thresholdBody.innerHTML = renderThresholdPreview(data);
        thresholdConfirmBtn.disabled = false;
        bootstrap.Modal.getOrCreateInstance(thresholdModalEl).show();
      } catch (e) {
        showLevelsInlineError(e && e.message ? e.message : 'Impossibile calcolare il riepilogo. Controlla i livelli card e riprova.');
      }
    }

    async function showDeletePreview(row){
      const token = getRowToken(row);
      if (!token) {
        try { row.remove(); } catch (e) {}
        return;
      }

      pendingDeleteRow = row;
      pendingDeleteToken = token;
      const levelName = getRowName(row);

      if (!previewModalEl || !previewBody || !previewConfirmBtn || !(window.bootstrap && bootstrap.Modal)) {
        const ok = window.confirm('Eliminare il livello card "' + levelName + '"? La rimozione sara applicata solo dopo Salva livelli.');
        if (!ok) return;
        addDeleteConfirmationToken(row);
        try { row.remove(); } catch (e) {}
        return;
      }

      if (previewSubtitle) previewSubtitle.textContent = 'Livello: ' + levelName;
      previewBody.innerHTML = '<div class="text-muted">Calcolo impatto in corso...</div>';
      previewConfirmBtn.disabled = true;
      if (previewWarning) previewWarning.classList.remove('d-none');
      bootstrap.Modal.getOrCreateInstance(previewModalEl).show();

      try {
        const fd = new FormData();
        fd.append('_mode', 'preview_fidelity_level_delete');
        const csrf = levelsForm.querySelector('input[name="_csrf"]');
        if (csrf) fd.append('_csrf', csrf.value || '');
        fd.append('level_token', token);
        currentDeleteTokens(token).forEach(function(t){ fd.append('delete_tokens[]', t); });

        const res = await fetch('index.php?page=fidelity_points', {
          method: 'POST',
          body: fd,
          credentials: 'same-origin',
          headers: {'Accept': 'application/json'}
        });
        const data = await res.json();
        if (!res.ok || !data || !data.ok) throw new Error((data && data.error) ? data.error : 'Preview non disponibile.');
        const impact = data.impact || {};
        const clients = impact.clients || {};
        const campaigns = impact.campaigns || {};
        const promotions = impact.promotions || {};
        const gifts = impact.gifts || {};
        const totalImpact = Number(clients.count || 0)
          + Number(campaigns.updated || 0)
          + Number(campaigns.disabled || 0)
          + Number(promotions.updated || 0)
          + Number(promotions.disabled || 0)
          + Number(promotions.appointments || 0)
          + Number(gifts.updated || 0)
          + Number(gifts.disabled || 0);
        if (previewWarning) previewWarning.classList.toggle('d-none', totalImpact <= 0);
        previewBody.innerHTML = renderSummary(data);
        previewConfirmBtn.disabled = false;
      } catch (e) {
        if (previewWarning) previewWarning.classList.add('d-none');
        previewBody.innerHTML =
          '<div class="alert alert-danger mb-0">' +
            '<div class="fw-semibold mb-1">Impossibile calcolare il riepilogo completo</div>' +
            '<div class="small">' + esc(e && e.message ? e.message : 'Errore non previsto') + '</div>' +
          '</div>';
        previewConfirmBtn.disabled = true;
      }
    }

    if (previewConfirmBtn) {
      previewConfirmBtn.addEventListener('click', function(){
        if (!pendingDeleteRow) return;
        if (!canRemoveLevelRow(pendingDeleteRow)) {
          showRemoveBlockedError(pendingDeleteRow);
          if (previewModalEl && window.bootstrap && bootstrap.Modal) {
            try { bootstrap.Modal.getOrCreateInstance(previewModalEl).hide(); } catch (e) {}
          }
          return;
        }
        addDeleteConfirmationToken(pendingDeleteRow);
        try { pendingDeleteRow.remove(); } catch (e) {}
        updateRemoveButtons();
        pendingDeleteRow = null;
        pendingDeleteToken = '';
        if (previewModalEl && window.bootstrap && bootstrap.Modal) {
          try { bootstrap.Modal.getOrCreateInstance(previewModalEl).hide(); } catch (e) {}
        }
      });
    }

    if (previewModalEl) {
      previewModalEl.addEventListener('hidden.bs.modal', function(){
        pendingDeleteRow = null;
        pendingDeleteToken = '';
      });
    }

    function wireRow(row){
      if (!row) return;
      const btn = row.querySelector('.fidPointsLevelRemove');
      if (!btn) return;
      btn.addEventListener('click', function(){
        clearThresholdConfirmation();
        if (!canRemoveLevelRow(row)) {
          showRemoveBlockedError(row);
          updateRemoveButtons();
          return;
        }
        showDeletePreview(row);
      });
    }

    list.querySelectorAll('.fidPointsLevelRow').forEach(wireRow);
    updateRemoveButtons();

    if (addBtn && tpl) {
      addBtn.addEventListener('click', function(){
        clearThresholdConfirmation();
        const frag = tpl.content.cloneNode(true);
        const row = frag.querySelector('.fidPointsLevelRow');
        list.appendChild(frag);
        wireRow(row);
        updateRemoveButtons();
        try {
          const input = list.querySelector('.fidPointsLevelRow:last-child input[name="fidelity_points_level_names[]"]');
          if (input) input.focus();
        } catch (e) {}
      });
    }

    if (thresholdConfirmBtn) {
      thresholdConfirmBtn.addEventListener('click', function(){
        if (!pendingThresholdSignature) return;
        submitLevelsAfterThreshold(pendingThresholdSignature);
      });
    }

    levelsForm.addEventListener('input', clearThresholdConfirmation);
    levelsForm.addEventListener('change', clearThresholdConfirmation);
    levelsForm.addEventListener('input', clearLevelsInlineError);
    levelsForm.addEventListener('change', clearLevelsInlineError);

    levelsForm.addEventListener('submit', function(ev){
      if (thresholdConfirmed) return;
      ev.preventDefault();
      showThresholdPreview();
    });
  })();

  (function(){
    const forms = document.querySelectorAll('.fidCampaignToggleForm');
    if (!forms.length) return;

    const modalEl = document.getElementById('fidelityCampaignTogglePreviewModal');
    const subtitle = document.getElementById('fidelityCampaignTogglePreviewSubtitle');
    const body = document.getElementById('fidelityCampaignTogglePreviewBody');
    const confirmBtn = document.getElementById('fidelityCampaignTogglePreviewConfirm');
    let pendingForm = null;

    function esc(v){
      return String(v == null ? '' : v).replace(/[&<>"']/g, function(ch){
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch] || ch;
      });
    }

    function count(v){
      const n = Number(v || 0);
      return Number.isFinite(n) ? n : 0;
    }

    function stat(label, value, tone){
      return '<div class="border rounded-3 px-3 py-2 bg-white">' +
        '<div class="small text-muted">' + esc(label) + '</div>' +
        '<div class="fw-semibold text-' + esc(tone || 'body') + '">' + esc(value) + '</div>' +
      '</div>';
    }

    function renderPreview(data){
      const p = data && data.preview ? data.preview : {};
      const appointments = p.appointments || {};
      const sales = p.sales || {};
      const recharges = p.recharges || {};
      const movements = p.movements || {};
      const openAppointments = count(appointments.open);
      const historicAppointments = count(appointments.done) + count(appointments.canceled) + count(appointments.other);
      const saleCount = count(sales.total);
      const rechargeCount = count(recharges.total);
      const movementCount = count(movements.total);
      const refs = count(p.references);

      let html = '';
      if (openAppointments > 0) {
        html += '<div class="alert alert-warning mb-3">' +
          '<div class="fw-semibold mb-1">Prenotazioni aperte collegate</div>' +
          '<div class="small">Le prenotazioni in sospeso o prenotate collegate a questa campagna non genereranno punti se vengono completate mentre la campagna resta disattiva.</div>' +
        '</div>';
      } else if (refs > 0) {
        html += '<div class="alert alert-info mb-3">' +
          '<div class="fw-semibold mb-1">Nessuna prenotazione aperta collegata</div>' +
          '<div class="small">La campagna non verra piu usata per nuovi accrediti. Lo storico gia registrato resta invariato.</div>' +
        '</div>';
      } else {
        html += '<div class="alert alert-info mb-3">' +
          '<div class="fw-semibold mb-1">Nessun collegamento operativo rilevato</div>' +
          '<div class="small">La campagna verra semplicemente disattivata e potrai riattivarla in seguito.</div>' +
        '</div>';
      }

      const stats = [];
      if (openAppointments > 0) stats.push(stat('Prenotazioni aperte', openAppointments, 'warning'));
      if (historicAppointments > 0) stats.push(stat('Prenotazioni storiche', historicAppointments, 'body'));
      if (saleCount > 0) stats.push(stat('Vendite collegate', saleCount, 'body'));
      if (rechargeCount > 0) stats.push(stat('Ricariche collegate', rechargeCount, 'body'));
      if (movementCount > 0) stats.push(stat('Movimenti punti', movementCount, 'body'));

      if (stats.length) {
        html += '<div class="row g-2 mb-3">';
        stats.forEach(function(item){ html += '<div class="col-6 col-md-3">' + item + '</div>'; });
        html += '</div>';
      }

      html += '<div class="small text-muted">' +
        'Vendite, ricariche, movimenti, saldi, punti e storico clienti gia registrati non verranno modificati. ' +
        'La modifica riguarda solo gli utilizzi futuri della campagna.' +
      '</div>';

      if (body) body.innerHTML = html;
      if (confirmBtn) confirmBtn.disabled = false;
    }

    async function openPreview(form){
      const id = String(form.getAttribute('data-campaign-id') || '').trim();
      const name = String(form.getAttribute('data-campaign-name') || '').trim() || 'Campagna punti';
      if (!id) return;

      pendingForm = form;
      if (subtitle) subtitle.textContent = 'Campagna: ' + name;
      if (body) body.innerHTML = '<div class="text-muted">Calcolo impatto in corso...</div>';
      if (confirmBtn) confirmBtn.disabled = true;

      if (!modalEl || !(window.bootstrap && bootstrap.Modal)) {
        if (window.confirm('Disattivare la campagna punti "' + name + '"? Lo storico gia registrato non verra modificato.')) {
          form.dataset.confirmed = '1';
          form.submit();
        }
        return;
      }

      bootstrap.Modal.getOrCreateInstance(modalEl).show();

      try {
        const fd = new FormData();
        fd.append('_mode', 'preview_fidelity_campaign_toggle');
        fd.append('campaign_id', id);
        const csrf = form.querySelector('input[name="_csrf"]');
        if (csrf) fd.append('_csrf', csrf.value || '');
        const res = await fetch('index.php?page=fidelity_points', {
          method: 'POST',
          body: fd,
          credentials: 'same-origin',
          headers: {'Accept': 'application/json'}
        });
        const data = await res.json();
        if (!res.ok || !data || !data.ok) throw new Error((data && data.error) ? data.error : 'Preview non disponibile.');
        renderPreview(data);
      } catch (e) {
        if (body) {
          body.innerHTML = '<div class="alert alert-danger mb-0">' +
            '<div class="fw-semibold mb-1">Impossibile calcolare il riepilogo</div>' +
            '<div class="small">' + esc(e && e.message ? e.message : 'Errore non previsto') + '</div>' +
          '</div>';
        }
        if (confirmBtn) confirmBtn.disabled = true;
      }
    }

    forms.forEach(function(form){
      form.addEventListener('submit', function(ev){
        const action = String(form.getAttribute('data-toggle-action') || '').trim();
        if (action !== 'deactivate') return;
        if (form.dataset.confirmed === '1') return;
        ev.preventDefault();
        openPreview(form);
      });
    });

    if (confirmBtn) {
      confirmBtn.addEventListener('click', function(){
        if (!pendingForm) return;
        pendingForm.dataset.confirmed = '1';
        pendingForm.submit();
      });
    }
  })();

  (function(){
    const buttons = document.querySelectorAll('.fidCampaignDeleteBtn');
    const form = document.getElementById('fidCampaignDeleteForm');
    if (!buttons.length || !form) return;

    const modalEl = document.getElementById('fidelityCampaignDeletePreviewModal');
    const idInput = document.getElementById('fidCampaignDeleteId');
    const reasonInput = document.getElementById('fidCampaignDeleteReason');
    const subtitle = document.getElementById('fidelityCampaignDeletePreviewSubtitle');
    const body = document.getElementById('fidelityCampaignDeletePreviewBody');
    const warning = document.getElementById('fidelityCampaignDeletePreviewWarning');
    const confirmBtn = document.getElementById('fidelityCampaignDeletePreviewConfirm');

    function esc(v){
      return String(v == null ? '' : v).replace(/[&<>"']/g, function(ch){
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch] || ch;
      });
    }

    function count(v){
      const n = Number(v || 0);
      return Number.isFinite(n) ? n : 0;
    }

    function section(id, title, total, html){
      if (total <= 0) return '';
      return '<div class="accordion-item border rounded-3 overflow-hidden mb-2">' +
        '<h3 class="accordion-header" id="' + id + 'Head">' +
          '<button class="accordion-button collapsed bg-white shadow-none py-2" type="button" data-bs-toggle="collapse" data-bs-target="#' + id + '" aria-expanded="false" aria-controls="' + id + '">' +
            '<span class="d-flex align-items-center justify-content-between gap-2 w-100 pe-2">' +
              '<span class="fw-semibold">' + esc(title) + '</span>' +
              '<span class="badge rounded-pill text-bg-info">' + esc(total) + '</span>' +
            '</span>' +
          '</button>' +
        '</h3>' +
        '<div id="' + id + '" class="accordion-collapse collapse" aria-labelledby="' + id + 'Head" data-bs-parent="#fidelityCampaignDeletePreviewAccordion">' +
          '<div class="accordion-body py-2">' + html + '</div>' +
        '</div>' +
      '</div>';
    }

    function renderPreview(data){
      const p = data && data.preview ? data.preview : {};
      const refs = count(p.references);
      const willArchive = !!p.will_archive;
      const canArchive = !!p.can_archive;
      const appointments = p.appointments || {};
      const sales = p.sales || {};
      const recharges = p.recharges || {};
      const movements = p.movements || {};

      if (confirmBtn) confirmBtn.disabled = willArchive && !canArchive;
      if (warning) warning.classList.toggle('d-none', !willArchive);

      if (!willArchive) {
        if (body) {
          body.innerHTML = '<div class="alert alert-info mb-0">' +
            '<div class="fw-semibold mb-1">Nessun collegamento rilevato</div>' +
            '<div class="small">Sei sicuro di eliminare questa campagna? La rimozione sara definitiva solo per la configurazione della campagna.</div>' +
          '</div>';
        }
        return;
      }

      const sections = [];
      sections.push(section(
        'fidCampaignImpactOpenAppointments',
        'Prenotazioni aperte',
        count(appointments.open),
        '<div class="small">Le prenotazioni resteranno registrate, ma la campagna rimossa non generera nuovi punti quando verranno completate.</div>'
      ));

      const historicAppointments = count(appointments.done) + count(appointments.canceled) + count(appointments.other);
      sections.push(section(
        'fidCampaignImpactHistoricAppointments',
        'Prenotazioni storiche',
        historicAppointments,
        '<div class="small">Completate: <strong>' + esc(count(appointments.done)) + '</strong></div>' +
        '<div class="small">Annullate o rifiutate: <strong>' + esc(count(appointments.canceled)) + '</strong></div>' +
        '<div class="small">Altri stati: <strong>' + esc(count(appointments.other)) + '</strong></div>'
      ));

      sections.push(section(
        'fidCampaignImpactSales',
        'Vendite collegate',
        count(sales.total),
        '<div class="small">Attive: <strong>' + esc(count(sales.active)) + '</strong></div>' +
        '<div class="small">Annullate: <strong>' + esc(count(sales.canceled)) + '</strong></div>'
      ));

      sections.push(section(
        'fidCampaignImpactRecharges',
        'Ricariche collegate',
        count(recharges.total),
        '<div class="small">Attive: <strong>' + esc(count(recharges.active)) + '</strong></div>' +
        '<div class="small">Stornate: <strong>' + esc(count(recharges.voided)) + '</strong></div>'
      ));

      sections.push(section(
        'fidCampaignImpactMovements',
        'Movimenti punti',
        count(movements.total),
        '<div class="small">Movimenti collegati: <strong>' + esc(count(movements.total)) + '</strong></div>' +
        '<div class="small">Punti gia registrati: <strong>' + esc(count(movements.points)) + '</strong></div>'
      ));

      let html = '';
      if (!canArchive) {
        html += '<div class="alert alert-danger mb-3">' +
          '<div class="fw-semibold mb-1">DB non allineato</div>' +
          '<div class="small">Verifica il dump SQL completo per archiviare campagne con storico.</div>' +
        '</div>';
      }
      html += '<div class="accordion" id="fidelityCampaignDeletePreviewAccordion">' + sections.join('') + '</div>';
      html += '<div class="text-muted small mt-2">Riferimenti totali: <strong>' + esc(refs) + '</strong>. La cancellazione conservera storico e saldi.</div>';
      if (body) body.innerHTML = html;
    }

    async function openPreview(btn){
      const id = String(btn.getAttribute('data-campaign-id') || '').trim();
      const name = String(btn.getAttribute('data-campaign-name') || '').trim() || 'Campagna punti';
      if (!id) return;

      if (idInput) idInput.value = id;
      if (reasonInput) reasonInput.value = '';
      if (subtitle) subtitle.textContent = 'Campagna: ' + name;
      if (body) body.innerHTML = '<div class="text-muted">Calcolo impatto in corso...</div>';
      if (warning) warning.classList.remove('d-none');
      if (confirmBtn) confirmBtn.disabled = true;

      if (!modalEl || !(window.bootstrap && bootstrap.Modal)) {
        if (window.confirm('Eliminare la campagna punti "' + name + '"? Storico, saldi, prenotazioni, vendite e ricariche non verranno modificati.')) {
          form.submit();
        }
        return;
      }

      bootstrap.Modal.getOrCreateInstance(modalEl).show();

      try {
        const fd = new FormData();
        fd.append('_mode', 'preview_fidelity_campaign_delete');
        fd.append('campaign_id', id);
        const csrf = form.querySelector('input[name="_csrf"]');
        if (csrf) fd.append('_csrf', csrf.value || '');
        const res = await fetch('index.php?page=fidelity_points', {
          method: 'POST',
          body: fd,
          credentials: 'same-origin',
          headers: {'Accept': 'application/json'}
        });
        const data = await res.json();
        if (!res.ok || !data || !data.ok) throw new Error((data && data.error) ? data.error : 'Preview non disponibile.');
        renderPreview(data);
      } catch (e) {
        if (warning) warning.classList.add('d-none');
        if (body) {
          body.innerHTML = '<div class="alert alert-danger mb-0">' +
            '<div class="fw-semibold mb-1">Impossibile calcolare il riepilogo</div>' +
            '<div class="small">' + esc(e && e.message ? e.message : 'Errore non previsto') + '</div>' +
          '</div>';
        }
        if (confirmBtn) confirmBtn.disabled = true;
      }
    }

    buttons.forEach(function(btn){
      btn.addEventListener('click', function(){
        openPreview(btn);
      });
    });

    form.addEventListener('submit', function(ev){
      if (!idInput || !String(idInput.value || '').trim()) {
        ev.preventDefault();
      }
    });
  })();

  (function(){
    const chk = document.getElementById('fidExpire');
    const pointsChk = document.getElementById('fidPointsEnabled');
    const boxes = document.querySelectorAll('.fidExpireSettings');
    if (!chk || !boxes || boxes.length === 0) return;

    function syncExpire(){
      const savedOn = pointsChk ? String(pointsChk.getAttribute('data-saved-enabled') || '') === '1' : true;
      const pointsOn = savedOn && (pointsChk ? !!pointsChk.checked : true);
      const on = pointsOn && !!chk.checked;
      boxes.forEach(el => {
        if (on) el.classList.remove('d-none');
        else el.classList.add('d-none');
      });
    }

    chk.addEventListener('change', syncExpire);
    if (pointsChk) pointsChk.addEventListener('change', syncExpire);
    syncExpire();
  })();

  (function(){
    const chk = document.getElementById('fidRedeem');
    const pointsChk = document.getElementById('fidPointsEnabled');
    const boxes = document.querySelectorAll('.fidRedeemSettings');
    if (!chk || !boxes || boxes.length === 0) return;

    function syncRedeem(){
      const savedOn = pointsChk ? String(pointsChk.getAttribute('data-saved-enabled') || '') === '1' : true;
      const pointsOn = savedOn && (pointsChk ? !!pointsChk.checked : true);
      const on = pointsOn && !!chk.checked;
      boxes.forEach(el => {
        if (on) el.classList.remove('d-none');
        else el.classList.add('d-none');
      });
    }

    chk.addEventListener('change', syncRedeem);
    if (pointsChk) pointsChk.addEventListener('change', syncRedeem);
    syncRedeem();
  })();


  (function(){
    const form = document.getElementById('fidCampaignForm');
    if (!form) return;
    const campaignModalEl = document.getElementById('fidelityCampaignFormModal');
    let campaignModalHiddenWired = false;
    function wireCampaignModalHidden(){
      if (!campaignModalEl || campaignModalHiddenWired) return;
      campaignModalHiddenWired = true;
      campaignModalEl.addEventListener('hidden.bs.modal', function(){
        const cleanUrl = String(campaignModalEl.getAttribute('data-clean-url') || '').trim();
        if (!cleanUrl || !(window.history && window.history.replaceState)) return;
        if (/(?:^|[?&])(campaign_id|new_campaign)=/.test(window.location.search)) {
          window.history.replaceState(null, '', cleanUrl);
        }
      });
    }
    function openCampaignModalWhenReady(attempt){
      if (!campaignModalEl) return;
      if (window.bootstrap && bootstrap.Modal) {
        wireCampaignModalHidden();
        bootstrap.Modal.getOrCreateInstance(campaignModalEl).show();
        return;
      }
      if ((attempt || 0) < 40) {
        window.setTimeout(function(){ openCampaignModalWhenReady((attempt || 0) + 1); }, 50);
      }
    }
    openCampaignModalWhenReady(0);

    function refreshEarnMode(){
      const amount = document.getElementById('fid_earn_amount');
      const tiers = document.getElementById('fid_earn_tiers');
      const amountWrap = document.getElementById('fid_earn_amount_wrap');
      const tiersWrap = document.getElementById('fid_earn_tiers_wrap');
      const minWrap = document.getElementById('fid_min_spend_wrap');
      const isTiers = !!(tiers && tiers.checked);
      if (amountWrap) amountWrap.classList.toggle('d-none', isTiers);
      if (tiersWrap) tiersWrap.classList.toggle('d-none', !isTiers);
      if (minWrap) minWrap.classList.toggle('d-none', isTiers);
    }

    const amount = document.getElementById('fid_earn_amount');
    const tiers = document.getElementById('fid_earn_tiers');
    if (amount) amount.addEventListener('change', refreshEarnMode);
    if (tiers) tiers.addEventListener('change', refreshEarnMode);
    refreshEarnMode();

    const endsNever = document.getElementById('fid_campaign_ends_never');
    const endsInp = document.getElementById('fid_campaign_ends_at');
    function refreshEnds(){
      if (!endsNever || !endsInp) return;
      const on = !!endsNever.checked;
      endsInp.disabled = on;
      if (on) endsInp.value = '';
    }
    if (endsNever && endsInp) {
      endsNever.addEventListener('change', refreshEnds);
      refreshEnds();
    }

    const tierBody = document.getElementById('fid_tiers_body');
    const addTier = document.getElementById('fid_add_tier');
    if (addTier && tierBody) {
      addTier.addEventListener('click', function(){
        const tr = document.createElement('tr');
        tr.innerHTML = ''
          + '<td><div class="input-group input-group-sm"><span class="input-group-text">EUR</span><input class="form-control" type="number" step="0.01" min="0" name="fid_campaign_tier_min[]" value="0"></div></td>'
          + '<td><input class="form-control form-control-sm" type="number" step="1" min="0" name="fid_campaign_tier_points[]" value="1"></td>'
          + '<td class="text-end"><button class="btn btn-sm btn-outline-danger fid-remove-tier" type="button"><i class="bi bi-x"></i></button></td>';
        tierBody.appendChild(tr);
      });
    }


    document.addEventListener('click', function(ev){
      const tierBtn = ev.target.closest ? ev.target.closest('.fid-remove-tier') : null;
      if (tierBtn) {
        const tr = tierBtn.closest('tr');
        if (tr && tr.parentNode) tr.parentNode.removeChild(tr);
      }
    });
  })();

  (function(){
    const modeSelect = document.querySelector('select[name="earn_mode"]');
    const modeFields = document.querySelectorAll('.ruleModeField');
    if (!modeSelect || !modeFields || modeFields.length === 0) return;

    function syncRuleMode(){
      const mode = String(modeSelect.value || '').trim().toLowerCase();
      modeFields.forEach((el) => {
        const modes = String(el.getAttribute('data-modes') || '')
          .split(',')
          .map((part) => part.trim().toLowerCase())
          .filter(Boolean);
        const visible = mode !== '' && modes.indexOf(mode) !== -1;
        el.classList.toggle('d-none', !visible);
        el.querySelectorAll('input, select, textarea').forEach((field) => {
          field.disabled = !visible;
        });
      });
    }

    modeSelect.addEventListener('change', syncRuleMode);
    syncRuleMode();
  })();
})();
