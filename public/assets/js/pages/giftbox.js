(function () {
  'use strict';

  var configEl = document.getElementById('giftboxPageConfig');
  var giftboxConfig = {};

  if (configEl) {
    try {
      giftboxConfig = JSON.parse(configEl.textContent || '{}') || {};
    } catch (e) {
      giftboxConfig = {};
    }
  }

  (function(){
    var toggle = document.getElementById('gbRecipientExistingToggle');
    var wrap = document.getElementById('gbRecipientExistingWrap');
    var hiddenId = document.getElementById('gbRecipientClientId');
    var nameInput = document.getElementById('gbRecipientName');
    var emailInput = document.getElementById('gbRecipientEmail');
    var searchInput = document.getElementById('gbRecipientSearch');
    var resultsBox = document.getElementById('gbRecipientResults');
    var selectedBox = document.getElementById('gbRecipientSelectedBox');
    var selectedName = document.getElementById('gbRecipientSelectedName');
    var selectedMeta = document.getElementById('gbRecipientSelectedMeta');
    var removeBtn = document.getElementById('gbRecipientRemoveBtn');
    var fidelityAlert = document.getElementById('gbRecipientFidelityAlert');
    var staticAlert = document.getElementById('gbRecipientFidelityAlertStatic');
    var searchWrap = document.getElementById('gbRecipientSearchWrap');
  
    if (!toggle || !wrap || !hiddenId || !nameInput || !emailInput || !searchInput || !resultsBox) return;
  
    // Email del cliente già selezionato (server-side), utile per lock iniziale campi.
    var initialSelectedEmail = String(giftboxConfig.recipientInitialSelectedEmail || '');
    var recipientLocked = !!giftboxConfig.recipientLocked;
  
    function showEl(el){ if (el) el.classList.remove('d-none'); }
    function hideEl(el){ if (el) el.classList.add('d-none'); }
  
    function setFidelityAlert(kind, text){
      if (!fidelityAlert) return;
      fidelityAlert.classList.remove('d-none','alert-success','alert-warning','alert-danger','alert-info');
      if (!kind) {
        fidelityAlert.classList.add('d-none');
        fidelityAlert.textContent = '';
        return;
      }
      fidelityAlert.classList.add('alert-' + kind);
      fidelityAlert.textContent = text || '';
    }
  
    function clearResults(){
      resultsBox.innerHTML = '';
    }
  
    function clearSelected(){
      if (recipientLocked) return;
      hiddenId.value = '0';
      if (selectedName) selectedName.textContent = '';
      if (selectedMeta) selectedMeta.textContent = '';
      if (selectedBox) hideEl(selectedBox);
      if (staticAlert) hideEl(staticAlert);
      setFidelityAlert(null, '');
  
      // Se non c'è un cliente selezionato, mostra la ricerca
      if (searchWrap) showEl(searchWrap);
  
      // Sblocco campi (se prima era attivo il lock)
      if (nameInput) nameInput.readOnly = false;
      if (emailInput) emailInput.readOnly = false;
    }
  
    function setSelectedClient(c){
      if (recipientLocked) return;
      if (!c || !c.id) return;
      hiddenId.value = String(c.id);
  
      // Precompila campi destinatario.
      // Se è selezionato un cliente già esistente:
      // - nome (precompilato) NON modificabile
      // - email (precompilata) NON modificabile solo se presente/valida nell'anagrafica cliente
      if (nameInput && (c.full_name || c.full_name === '')) nameInput.value = c.full_name || '';
      if (nameInput) nameInput.readOnly = true;
  
      var em = String(c.email || '').trim();
      if (emailInput) {
        if (em) {
          emailInput.value = em;
          emailInput.readOnly = true;
        } else {
          emailInput.readOnly = false;
        }
      }
  
      if (selectedName) selectedName.textContent = c.full_name || '';
      if (selectedMeta) {
        var parts = ['#' + c.id];
        if (c.email) parts.push(c.email);
        if (c.phone) parts.push(c.phone);
        selectedMeta.textContent = parts.join(' • ');
      }
      if (selectedBox) showEl(selectedBox);
  
      // Quando un cliente è selezionato, la ricerca NON deve essere visibile.
      if (searchWrap) hideEl(searchWrap);
      if (searchInput) searchInput.value = '';
      clearResults();
      setFidelityAlert(null, '');
  
      var adh = (parseInt(c.adhering || 0, 10) === 1);
      if (staticAlert) {
        staticAlert.classList.remove('alert-success','alert-warning','alert-info');
        staticAlert.classList.add('alert-info');
        staticAlert.textContent = 'La GiftBox sarà associata al destinatario selezionato. Eventuali punti e omaggi della vendita resteranno accreditati solo al mittente (se aderisce alla Fidelity).';
        showEl(staticAlert);
      }
      // Nota Fidelity: mostrare SOLO quella nella box selezionata (staticAlert).
    }
  
    // Toggle show/hide
    toggle.addEventListener('change', function(){
      if (recipientLocked) {
        toggle.checked = ((parseInt(hiddenId.value || '0', 10) || 0) > 0);
        return;
      }
      if (toggle.checked) {
        showEl(wrap);
        // Se già selezionato un cliente, la ricerca non deve essere visibile.
        try {
          var cid0 = parseInt(hiddenId.value || '0', 10) || 0;
          if (cid0 > 0) {
            if (searchWrap) hideEl(searchWrap);
          } else {
            if (searchWrap) showEl(searchWrap);
          }
        } catch (e) {}
        return;
      }
      hideEl(wrap);
      clearSelected();
      searchInput.value = '';
      clearResults();
    });
  
    if (removeBtn) {
      removeBtn.addEventListener('click', function(){
        if (recipientLocked) return;
        clearSelected();
        try { searchInput && searchInput.focus(); } catch (e) {}
      });
    }
  
    var lastTerm = '';
    var tmr = null;
  
    async function doSearch(term){
      if (recipientLocked) return;
      term = (term || '').trim();
      if (term.length < 2) {
        clearResults();
        setFidelityAlert(null, '');
        return;
      }
      lastTerm = term;
  
      try {
        var url = 'index.php?page=api_clients&action=search&q=' + encodeURIComponent(term);
        var res = await fetch(url, { credentials: 'same-origin' });
        var j = await res.json();
        if (!j || !j.ok) throw new Error((j && j.error) ? j.error : 'Errore ricerca');
        if (lastTerm !== term) return;
  
        var list = Array.isArray(j.clients) ? j.clients : [];
        clearResults();
        if (!list.length) {
          var empty = document.createElement('div');
          empty.className = 'text-muted small py-2 px-2';
          empty.textContent = 'Nessun cliente trovato.';
          resultsBox.appendChild(empty);
          return;
        }
        list.forEach(function(c){
          var a = document.createElement('button');
          a.type = 'button';
          a.className = 'list-group-item list-group-item-action';
  
          var title = document.createElement('div');
          title.className = 'fw-semibold';
          title.textContent = c.full_name || '';
  
          var meta = document.createElement('div');
          meta.className = 'text-muted small';
          var parts = ['#' + c.id];
          if (c.email) parts.push(c.email);
          if (c.phone) parts.push(c.phone);
          meta.textContent = parts.join(' • ');
  
          a.appendChild(title);
          a.appendChild(meta);
  
          a.addEventListener('click', function(){
            setSelectedClient(c);
            clearResults();
            searchInput.value = '';
          });
  
          resultsBox.appendChild(a);
        });
      } catch (e) {
        clearResults();
        setFidelityAlert('danger', e && e.message ? e.message : 'Errore ricerca');
      }
    }
  
    searchInput.addEventListener('input', function(){
      if (recipientLocked) return;
      if (!toggle.checked) return;
      if (tmr) window.clearTimeout(tmr);
      var term = searchInput.value;
      tmr = window.setTimeout(function(){ doSearch(term); }, 250);
    });
  
    // Lock iniziale (se pagina caricata con destinatario già selezionato)
    try {
      if (recipientLocked) {
        if (toggle) toggle.disabled = true;
        if (removeBtn) removeBtn.disabled = true;
        if (searchInput) searchInput.disabled = true;
        if (nameInput) nameInput.readOnly = true;
        if (emailInput) emailInput.readOnly = true;
        if (searchWrap) hideEl(searchWrap);
      }
      var initId = parseInt(hiddenId.value || '0', 10) || 0;
      if (initId > 0) {
        if (nameInput) nameInput.readOnly = true;
        if (searchWrap) hideEl(searchWrap);
        var em0 = String(initialSelectedEmail || '').trim();
        if (emailInput) {
          if (em0) {
            emailInput.value = em0;
            emailInput.readOnly = true;
          } else {
            emailInput.readOnly = false;
          }
        }
      }
    } catch (e) {}
  })();

  function gbSelectAllRemaining(){
    document.querySelectorAll('.gb-redeem-input').forEach(function(el){
      var max = parseInt(el.getAttribute('data-max') || '0', 10);
      if (!max || max <= 0) return;
      if (el.type === 'checkbox') {
        el.checked = true;
      } else {
        el.value = String(max);
      }
    });
  }
  function gbClearSelection(){
    document.querySelectorAll('.gb-redeem-input').forEach(function(el){
      if (el.type === 'checkbox') {
        el.checked = false;
      } else {
        el.value = '0';
      }
    });
  }

  function giftboxEscapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch];
    });
  }
  
  function giftboxCatalogOptions(items){
    return (Array.isArray(items) ? items : []).map(function(item){
      return '<option value="' + giftboxEscapeHtml(item.id || '') + '">' + giftboxEscapeHtml(item.label || '') + '</option>';
    }).join('');
  }
  
  function refreshItemRow(tr){
    if(!tr) return;
    var typeSel = tr.querySelector('.item-type');
    if(!typeSel) return;
    var t = typeSel.value;
  
    var svc = tr.querySelector('.item-service');
    var prd = tr.querySelector('.item-product');
    var custom = tr.querySelector('.item-custom');
  
    if (svc) svc.classList.toggle('d-none', t !== 'service');
    if (prd) prd.classList.toggle('d-none', t !== 'product');
    if (custom) custom.classList.toggle('d-none', t !== 'custom');
  }
  
  function removeItemRow(btn){
    var tr = btn.closest('tr');
    if(tr) tr.remove();
  }
  
  function addItemRow(){
    var tbody = document.querySelector('#itemsTable tbody');
    if(!tbody) return;
    var tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <select class="form-select form-select-sm item-type" name="item_type[]">
          <option value="service" selected>Servizio</option>
          <option value="product">Prodotto</option>
          <option value="custom">Voce</option>
        </select>
      </td>
      <td>
        <select class="form-select form-select-sm item-service" name="item_service_id[]">
          <option value="">—</option>
          ${giftboxCatalogOptions(giftboxConfig.services)}
        </select>
  
        <select class="form-select form-select-sm item-product mt-1" name="item_product_id[]">
          <option value="">—</option>
          ${giftboxCatalogOptions(giftboxConfig.products)}
        </select>
  
        <div class="row g-2 mt-1 item-custom">
          <div class="col-md-4">
            <input class="form-control form-control-sm" name="item_custom_label[]" placeholder="Titolo" value="">
          </div>
          <div class="col-md-8">
            <input class="form-control form-control-sm" name="item_custom_details[]" placeholder="Dettagli (opzionale)" value="">
          </div>
        </div>
      </td>
      <td class="text-center">
        <input class="form-control form-control-sm text-center" type="number" name="item_qty[]" value="1" min="1" max="1000">
      </td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-danger" type="button" data-giftbox-remove-row="1">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
    refreshItemRow(tr);
    tr.querySelector('.item-type').addEventListener('change', function(){ refreshItemRow(tr); });
  }
  
  // GiftBox template: livelli condizionati dal checkbox "Solo clienti con Fidelity"
  function toggleGiftboxLevels(){
    var cb = document.getElementById('gbFidelityOnly');
    var wrap = document.getElementById('gbLevelsWrap');
    if (!cb || !wrap) return;
  
    wrap.classList.toggle('d-none', !cb.checked);
  
    wrap.querySelectorAll('input[type=checkbox]').forEach(function(i){
      i.disabled = !cb.checked;
    });
  }
  
  function validateGiftboxForm(e){
    var cb = document.getElementById('gbFidelityOnly');
    var form = document.getElementById('giftboxForm');
    if (!cb || !form) return true;
  
    if (cb.checked) {
      var n = form.querySelectorAll('input[name="eligible_levels_points[]"]:checked').length;
      if (n <= 0) {
        alert('Seleziona almeno un livello Punti.');
        if (e) e.preventDefault();
        return false;
      }
    }
    return true;
  }
  
  // Emissione istanza: blocca se la GiftBox è scaduta / non ancora valida
  function refreshIssueGiftboxValidity(){
    var sel = document.getElementById('issueGiftboxSelect');
    var alertBox = document.getElementById('issueGiftboxValidityAlert');
    var btn = document.getElementById('issueSubmitBtn');
    if (!sel || !alertBox || !btn) return;
  
    var v = sel.value || '';
    if (!v) {
      alertBox.classList.add('d-none');
      btn.disabled = true;
      return;
    }
  
    var opt = sel.options[sel.selectedIndex];
    var vf = opt ? (opt.getAttribute('data-valid-from') || '') : '';
    var vt = opt ? (opt.getAttribute('data-valid-to') || '') : '';
    var today = String(giftboxConfig.issueToday || '');
  
    var ok = true;
    var msg = '';
  
    if (vf && today < vf) {
      ok = false;
      msg = 'La GiftBox selezionata non è ancora valida.';
    }
    if (vt && today > vt) {
      ok = false;
      msg = 'La GiftBox selezionata è scaduta e non può essere emessa.';
    }
  
    if (!ok) {
      alertBox.textContent = msg;
      alertBox.classList.remove('d-none');
      btn.disabled = true;
    } else {
      alertBox.classList.add('d-none');
      btn.disabled = false;
    }
  }

  document.addEventListener('submit', function(event){
    var form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    var message = form.getAttribute('data-confirm-submit');
    if (!message) return;

    if (!window.confirm(message)) {
      event.preventDefault();
    }
  });
  
  document.addEventListener('click', function(event){
    if (!(event.target instanceof Element)) return;
  
    var confirmTarget = event.target.closest('[data-confirm]');
    if (confirmTarget) {
      var message = confirmTarget.getAttribute('data-confirm') || 'Confermare?';
      if (!window.confirm(message)) event.preventDefault();
      return;
    }
  
    var removeBtn = event.target.closest('[data-giftbox-remove-row]');
    if (removeBtn) {
      event.preventDefault();
      removeItemRow(removeBtn);
      return;
    }
  
    var addBtn = event.target.closest('[data-giftbox-add-row]');
    if (addBtn) {
      event.preventDefault();
      addItemRow();
      return;
    }
  
    var selectAllBtn = event.target.closest('[data-giftbox-select-all]');
    if (selectAllBtn) {
      event.preventDefault();
      gbSelectAllRemaining();
      return;
    }
  
    var clearBtn = event.target.closest('[data-giftbox-clear-selection]');
    if (clearBtn) {
      event.preventDefault();
      gbClearSelection();
    }
  });
  
  document.addEventListener('DOMContentLoaded', function(){
    document.querySelectorAll('#itemsTable .item-type').forEach(function(sel){
      refreshItemRow(sel.closest('tr'));
      sel.addEventListener('change', function(){ refreshItemRow(sel.closest('tr')); });
    });
  
    var cb = document.getElementById('gbFidelityOnly');
    if (cb) {
      toggleGiftboxLevels();
      cb.addEventListener('change', toggleGiftboxLevels);
    }
  
    var form = document.getElementById('giftboxForm');
    if (form) {
      form.addEventListener('submit', validateGiftboxForm);
    }
  
    var sel = document.getElementById('issueGiftboxSelect');
    if (sel) {
      refreshIssueGiftboxValidity();
      sel.addEventListener('change', refreshIssueGiftboxValidity);
    }
  });

  (function(){
    function gbNorm(s){
      try { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
      catch(e){ return String(s || '').toLowerCase().trim(); }
    }
  
    function gbInitFilterCombobox(boxEl, items, selectedId, allValue, allLabel){
      if(!boxEl) return;
      const toggle = boxEl.querySelector('.app-combobox-toggle');
      const hidden = boxEl.querySelector('input[type="hidden"]');
      const search = boxEl.querySelector('.app-combobox-search');
      const list = boxEl.querySelector('.app-combobox-list');
      const textEl = boxEl.querySelector('.app-combobox-text');
      const placeholderEl = boxEl.querySelector('.app-combobox-placeholder');
      if(!toggle || !hidden || !search || !list || !textEl || !placeholderEl) return;
  
      const data = [{ id: String(allValue), label: String(allLabel), search: gbNorm(allLabel) }].concat((items || []).map(function(it){
        return { id: String(it.id), label: String(it.label), search: gbNorm(it.search || it.label) };
      }));
  
      function updateLabel(){
        const id = String(hidden.value || '');
        const it = data.find(function(x){ return String(x.id) === id; }) || null;
        if(it && id !== String(allValue)){
          textEl.textContent = it.label;
          textEl.classList.remove('d-none');
          placeholderEl.classList.add('d-none');
        } else {
          textEl.textContent = '';
          textEl.classList.add('d-none');
          placeholderEl.classList.remove('d-none');
        }
      }
  
      function render(){
        const q = gbNorm(search.value);
        list.innerHTML = '';
        let shown = 0;
        data.forEach(function(it){
          if(q && String(it.search || '').indexOf(q) === -1) return;
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'dropdown-item d-flex justify-content-between align-items-center';
          btn.textContent = it.label;
          btn.addEventListener('click', function(){
            hidden.value = String(it.id);
            updateLabel();
            try { bootstrap.Dropdown.getOrCreateInstance(toggle).hide(); } catch(e){}
          });
          list.appendChild(btn);
          shown++;
        });
        if(!shown){
          const empty = document.createElement('div');
          empty.className = 'text-muted small px-2 py-1';
          empty.textContent = 'Nessun risultato';
          list.appendChild(empty);
        }
      }
  
      hidden.value = String(selectedId != null ? selectedId : (hidden.value || allValue));
      updateLabel();
      render();
      search.addEventListener('input', render);
      toggle.addEventListener('shown.bs.dropdown', function(){
        search.value = '';
        render();
        setTimeout(function(){ try { search.focus(); search.select(); } catch(e){} }, 0);
      });
    }
  
    const clientItems = Array.isArray(giftboxConfig.clientItems) ? giftboxConfig.clientItems : [];
  
    gbInitFilterCombobox(
      document.getElementById('giftboxClientFilterBox'),
      clientItems,
      String(giftboxConfig.selectedClientId || '0'),
      '0',
      'Tutti'
    );
  })();
})();
