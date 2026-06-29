function giftsParseJsonScript(id){
  var el = document.getElementById(id);
  if (!el) return null;
  try {
    var raw = String(el.textContent || '').trim();
    return raw ? JSON.parse(raw) : null;
  } catch(e) {
    return null;
  }
}

var GIFTS_PAGE_CONFIG = giftsParseJsonScript('giftsPageConfig') || {};
var giftsRewardServices = Array.isArray(GIFTS_PAGE_CONFIG.rewardServices) ? GIFTS_PAGE_CONFIG.rewardServices : [];
var giftsRewardProducts = Array.isArray(GIFTS_PAGE_CONFIG.rewardProducts) ? GIFTS_PAGE_CONFIG.rewardProducts : [];

function giftsEscHtml(value){
  return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch] || ch;
  });
}

function rewardOptionsHtml(items){
  return (Array.isArray(items) ? items : []).map(function(item){
    var id = item && item.id != null ? String(item.id) : '';
    var label = item && item.label != null ? String(item.label) : '';
    if (!id || !label) return '';
    return '<option value="' + giftsEscHtml(id) + '">' + giftsEscHtml(label) + '</option>';
  }).join('');
}
function refreshRewardItemRow(row){
  if (!row) return;
  var typeSel = row.querySelector('.reward-item-type');
  var type = typeSel ? String(typeSel.value || '').toLowerCase() : 'service';
  var svcWrap = row.querySelector('.reward-item-service-wrap');
  var prdWrap = row.querySelector('.reward-item-product-wrap');
  var lblWrap = row.querySelector('.reward-item-custom-label-wrap');
  var detWrap = row.querySelector('.reward-item-custom-details-wrap');
  var svc = row.querySelector('.reward-item-service');
  var prd = row.querySelector('.reward-item-product');
  var lbl = row.querySelector('.reward-item-custom-label');
  var det = row.querySelector('.reward-item-custom-details');

  var showSvc = (type === 'service');
  var showPrd = (type === 'product');
  var showCus = (type === 'custom');

  if (svcWrap) svcWrap.classList.toggle('d-none', !showSvc);
  if (prdWrap) prdWrap.classList.toggle('d-none', !showPrd);
  if (lblWrap) lblWrap.classList.toggle('d-none', !showCus);
  if (detWrap) detWrap.classList.toggle('d-none', !showCus);

  if (svc && !showSvc) svc.value = '';
  if (prd && !showPrd) prd.value = '';
  if (lbl && !showCus) lbl.value = '';
  if (det && !showCus) det.value = '';
}

function syncRewardItemRemoveButtons(){
  var rows = Array.prototype.slice.call(document.querySelectorAll('#rewardItemsWrap .reward-item-row'));
  rows.forEach(function(row){
    var btn = row.querySelector('.reward-item-remove');
    if (btn) btn.disabled = rows.length <= 1;
  });
}

function addRewardItemRow(){
  var wrap = document.getElementById('rewardItemsWrap');
  if (!wrap) return;
  var row = document.createElement('div');
  row.className = 'border rounded-3 p-2 reward-item-row';
  row.innerHTML = `
    <div class="row g-2 align-items-end">
      <div class="col-md-2">
        <label class="form-label small text-muted">Tipo</label>
        <select class="form-select reward-item-type" name="reward_item_type[]">
          <option value="service" selected>Servizio</option>
          <option value="product">Prodotto</option>
          <option value="custom">Custom</option>
        </select>
      </div>
      <div class="col-md-6 reward-item-service-wrap">
        <label class="form-label small text-muted">Servizio</label>
        <select class="form-select reward-item-service" name="reward_item_service_id[]">
          <option value="">— seleziona —</option>${rewardOptionsHtml(giftsRewardServices)}
        </select>
      </div>
      <div class="col-md-6 reward-item-product-wrap">
        <label class="form-label small text-muted">Prodotto</label>
        <select class="form-select reward-item-product" name="reward_item_product_id[]">
          <option value="">— seleziona —</option>${rewardOptionsHtml(giftsRewardProducts)}
        </select>
      </div>
      <div class="col-md-6 reward-item-custom-label-wrap">
        <label class="form-label small text-muted">Etichetta custom</label>
        <input class="form-control reward-item-custom-label" name="reward_item_custom_label[]" value="" placeholder="Es. Piega gratuita">
      </div>
      <div class="col-md-2">
        <label class="form-label small text-muted">Quantità</label>
        <input class="form-control reward-item-qty" type="number" min="1" step="1" name="reward_item_qty[]" value="1">
      </div>
      <div class="col-md-2 d-flex justify-content-end">
        <button class="btn btn-sm btn-outline-danger reward-item-remove mt-md-4" type="button">✕</button>
      </div>
      <div class="col-12 reward-item-custom-details-wrap">
        <label class="form-label small text-muted">Dettagli (opzionale)</label>
        <input class="form-control reward-item-custom-details" name="reward_item_custom_details[]" value="" placeholder="Es. Valido dal lunedì al giovedì">
      </div>
    </div>`;
  wrap.appendChild(row);
  refreshRewardItemRow(row);
  syncRewardItemRemoveButtons();
}

function removeRewardItemRow(btn){
  var wrap = document.getElementById('rewardItemsWrap');
  if (!wrap) return;
  var rows = wrap.querySelectorAll('.reward-item-row');
  if (rows.length <= 1) return;
  var row = btn ? btn.closest('.reward-item-row') : null;
  if (row) row.remove();
  syncRewardItemRemoveButtons();
}

function validateRewardItems(){
  var rows = Array.prototype.slice.call(document.querySelectorAll('#rewardItemsWrap .reward-item-row'));
  if (!rows.length) {
    alert('Aggiungi almeno un elemento in "Cosa viene regalato".');
    return false;
  }
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var type = row.querySelector('.reward-item-type') ? String(row.querySelector('.reward-item-type').value || '').toLowerCase() : '';
    var rowNo = i + 1;
    if (type === 'service') {
      var svc = row.querySelector('.reward-item-service');
      if (!svc || !svc.value) {
        alert('Elemento premio #' + rowNo + ': seleziona il servizio.');
        return false;
      }
    } else if (type === 'product') {
      var prd = row.querySelector('.reward-item-product');
      if (!prd || !prd.value) {
        alert('Elemento premio #' + rowNo + ': seleziona il prodotto.');
        return false;
      }
    } else if (type === 'custom') {
      var lbl = row.querySelector('.reward-item-custom-label');
      if (!lbl || !String(lbl.value || '').trim()) {
        alert('Elemento premio #' + rowNo + ': inserisci l\'etichetta custom.');
        return false;
      }
    } else {
      alert('Elemento premio #' + rowNo + ': tipo non valido.');
      return false;
    }
  }
  return true;
}

var giftClientEligibilitySnapshots = [];
var giftClientEligibilityById = {};
var giftExcludedSelectedIds = [];

function parseGiftDateInput(value){
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
  if (!m) return null;
  var year = parseInt(m[1], 10);
  var month = parseInt(m[2], 10) - 1;
  var day = parseInt(m[3], 10);
  var dt = new Date(year, month, day);
  if (!dt || dt.getFullYear() !== year || dt.getMonth() !== month || dt.getDate() !== day) return null;
  return dt;
}

function formatGiftDateInput(date){
  if (!date || Object.prototype.toString.call(date) !== '[object Date]' || isNaN(date.getTime())) return '';
  var year = date.getFullYear();
  var month = String(date.getMonth() + 1).padStart(2, '0');
  var day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function giftTodayDate(){
  var now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addGiftDays(date, days){
  if (!date || isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + Number(days || 0));
}

function syncGiftValidityMinDates(){
  var form = document.getElementById('giftForm');
  if (!form) return;
  var vf = form.querySelector('input[name="valid_from"]');
  var vt = form.querySelector('input[name="valid_to"]');
  if (!vf || !vt) return;

  var today = giftTodayDate();
  var todayStr = formatGiftDateInput(today);
  if (todayStr) vf.min = todayStr;

  var dFrom = parseGiftDateInput(vf.value);
  if (dFrom) {
    var minTo = formatGiftDateInput(addGiftDays(dFrom, 1));
    vt.min = minTo || '';
    var dTo = parseGiftDateInput(vt.value);
    if (dTo && dTo.getTime() <= dFrom.getTime()) {
      vt.value = '';
    }
  } else {
    vt.min = '';
  }
}

function giftEligibilityConfig(){
  var cb = document.getElementById('giftFidelityOnly');
  var form = document.getElementById('giftForm');
  var cfg = {
    fidelityOnly: !!(cb && cb.checked),
    points: []
  };
  if (!form) return cfg;
  Array.prototype.slice.call(form.querySelectorAll('input[name="eligible_levels_points[]"]:checked')).forEach(function(el){
    var v = String(el.value || '').trim().toLowerCase();
    if (v) cfg.points.push(v);
  });
  return cfg;
}

function giftClientMatchesEligibility(snapshot, cfg){
  if (!snapshot) return false;
  if (!cfg || !cfg.fidelityOnly) return true;
  if (!snapshot.adhering) return false;
  var curPts = String(snapshot.points_level || '').trim().toLowerCase();
  if (!cfg.points || !cfg.points.length) return true;
  if (cfg.points && cfg.points.length && curPts && cfg.points.indexOf(curPts) !== -1) return true;
  return false;
}

function giftEligibilityHasSelectedLevels(cfg){
  cfg = cfg || giftEligibilityConfig();
  return !!(cfg.points && cfg.points.length);
}

function giftExcludedSelectionLocked(cfg){
  cfg = cfg || giftEligibilityConfig();
  return !!(cfg && cfg.fidelityOnly && !giftEligibilityHasSelectedLevels(cfg));
}

function sanitizeGiftExcludedSelections(){
  var cfg = giftEligibilityConfig();
  giftExcludedSelectedIds = giftExcludedSelectedIds.filter(function(id){
    id = parseInt(id, 10) || 0;
    if (!id) return false;
    var snap = giftClientEligibilityById[id] || null;
    return !!snap && giftClientMatchesEligibility(snap, cfg);
  });
}

function renderGiftExcludedClients(){
  var listEl = document.getElementById('giftExcludedClientsList');
  var hiddenWrap = document.getElementById('giftExcludedHiddenInputs');
  if (!listEl || !hiddenWrap) return;

  listEl.innerHTML = '';
  hiddenWrap.innerHTML = '';

  var ordered = giftExcludedSelectedIds.slice().map(function(id){ return parseInt(id, 10) || 0; }).filter(function(id){ return id > 0; });
  ordered.sort(function(a, b){
    var labelA = String((giftClientEligibilityById[a] && giftClientEligibilityById[a].label) || ('Cliente #' + a)).toLowerCase();
    var labelB = String((giftClientEligibilityById[b] && giftClientEligibilityById[b].label) || ('Cliente #' + b)).toLowerCase();
    if (labelA < labelB) return -1;
    if (labelA > labelB) return 1;
    return a - b;
  });

  if (!ordered.length) {
    var empty = document.createElement('div');
    empty.className = 'text-muted small';
    empty.textContent = 'Nessun cliente escluso selezionato.';
    listEl.appendChild(empty);
    return;
  }

  ordered.forEach(function(id){
    var snap = giftClientEligibilityById[id] || { id: id, label: 'Cliente #' + id, adhering: false, points_level: '' };
    var item = document.createElement('div');
    item.className = 'border rounded-3 px-3 py-2 d-flex justify-content-between align-items-center gap-2';

    var labelWrap = document.createElement('div');
    var title = document.createElement('div');
    title.className = 'fw-semibold';
    title.textContent = snap.label || ('Cliente #' + id);
    labelWrap.appendChild(title);

    var metaParts = [];
    if (snap.adhering) metaParts.push('Fidelity attiva'); else metaParts.push('No Fidelity');
    if (snap.points_level_label) metaParts.push('Punti: ' + snap.points_level_label);
    if (metaParts.length) {
      var meta = document.createElement('div');
      meta.className = 'text-muted small';
      meta.textContent = metaParts.join(' • ');
      labelWrap.appendChild(meta);
    }

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sm btn-outline-danger';
    btn.textContent = 'Rimuovi';
    btn.addEventListener('click', function(){
      giftExcludedSelectedIds = giftExcludedSelectedIds.filter(function(existingId){ return parseInt(existingId, 10) !== id; });
      syncGiftExclusionUi();
    });

    item.appendChild(labelWrap);
    item.appendChild(btn);
    listEl.appendChild(item);

    var hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.name = 'excluded_client_ids[]';
    hidden.value = String(id);
    hiddenWrap.appendChild(hidden);
  });
}

function renderGiftExclusionCandidates(){
  var selectEl = document.getElementById('giftExcludeCandidateSelect');
  var helpEl = document.getElementById('giftExcludeCandidatesHelp');
  var addBtn = document.getElementById('giftExcludeAddBtn');
  if (!selectEl) return;

  var cfg = giftEligibilityConfig();
  var locked = giftExcludedSelectionLocked(cfg);
  var selectedLookup = {};
  giftExcludedSelectedIds.forEach(function(id){
    id = parseInt(id, 10) || 0;
    if (id > 0) selectedLookup[id] = true;
  });

  selectEl.innerHTML = '';
  var placeholder = document.createElement('option');
  placeholder.value = '';

  if (locked) {
    placeholder.textContent = 'Seleziona prima almeno un Livello Punti';
    selectEl.appendChild(placeholder);
    selectEl.disabled = true;
    if (addBtn) addBtn.disabled = true;
    if (helpEl) helpEl.textContent = 'Con "Solo clienti con Fidelity" attivo devi selezionare almeno un Livello Punti per sbloccare questo campo.';
    return;
  }

  var candidates = giftClientEligibilitySnapshots.filter(function(snapshot){
    var id = parseInt(snapshot.id, 10) || 0;
    if (!id || selectedLookup[id]) return false;
    return giftClientMatchesEligibility(snapshot, cfg);
  });

  candidates.sort(function(a, b){
    var labelA = String(a.label || '').toLowerCase();
    var labelB = String(b.label || '').toLowerCase();
    if (labelA < labelB) return -1;
    if (labelA > labelB) return 1;
    return (parseInt(a.id, 10) || 0) - (parseInt(b.id, 10) || 0);
  });

  placeholder.textContent = candidates.length ? '— seleziona cliente —' : 'Nessun cliente disponibile';
  selectEl.appendChild(placeholder);

  candidates.forEach(function(snapshot){
    var option = document.createElement('option');
    option.value = String(snapshot.id || '');
    option.textContent = String(snapshot.label || ('Cliente #' + snapshot.id));
    selectEl.appendChild(option);
  });

  selectEl.disabled = !candidates.length;
  if (addBtn) addBtn.disabled = !candidates.length;
  if (helpEl) {
    helpEl.textContent = candidates.length
      ? 'La lista viene aggiornata in base alle impostazioni attuali della campagna.'
      : 'Nessun cliente disponibile con i filtri attuali oppure tutti già selezionati.';
  }
}

function syncGiftExclusionUi(){
  sanitizeGiftExcludedSelections();
  renderGiftExcludedClients();
  renderGiftExclusionCandidates();
}

function addGiftExcludedSelectedClient(){
  var selectEl = document.getElementById('giftExcludeCandidateSelect');
  if (!selectEl || !selectEl.value) return;
  var id = parseInt(selectEl.value, 10) || 0;
  if (!id) return;
  if (giftExcludedSelectedIds.indexOf(id) === -1) giftExcludedSelectedIds.push(id);
  syncGiftExclusionUi();
}

function toggleGiftLevels(){
  var cb = document.getElementById('giftFidelityOnly');
  var wrap = document.getElementById('giftLevelsWrap');
  if (!cb || !wrap) return;
  wrap.style.display = cb.checked ? '' : 'none';
  wrap.querySelectorAll('input[type=checkbox]').forEach(function(i){
    i.disabled = !cb.checked;
  });
}


function validateGiftForm(e){
  var cb = document.getElementById('giftFidelityOnly');
  var form = document.getElementById('giftForm');
  if (!cb || !form) return true;
  if (cb.checked) {
    var n = form.querySelectorAll('input[name="eligible_levels_points[]"]:checked').length;
    if (n <= 0) {
      alert('Seleziona almeno un livello Punti.');
      if (e) e.preventDefault();
      return false;
    }
  }
  var locationInputs = form.querySelectorAll('input[name="gift_location_ids[]"]');
  if (locationInputs.length > 0 && form.querySelectorAll('input[name="gift_location_ids[]"]:checked').length <= 0) {
    alert('Seleziona almeno una sede per l\'gift.');
    if (e) e.preventDefault();
    return false;
  }

  var vf = form.querySelector('input[name="valid_from"]');
  var vt = form.querySelector('input[name="valid_to"]');
  if (!vf || !vt || !vf.value || !vt.value) {
    alert('Validità dal e Validità al sono obbligatori.');
    if (e) e.preventDefault();
    return false;
  }
  var dFrom = parseGiftDateInput(vf.value);
  var dTo = parseGiftDateInput(vt.value);
  if (!dFrom || !dTo) {
    alert('Inserisci date valide per Valido dal e Valido al.');
    if (e) e.preventDefault();
    return false;
  }
  if (dTo.getTime() <= dFrom.getTime()) {
    alert('Valido al deve essere almeno il giorno successivo a Valido dal.');
    if (e) e.preventDefault();
    return false;
  }

  var idIn = form.querySelector('input[name="id"]');
  var isNew = !idIn || !idIn.value;
  if (isNew) {
    var today = giftTodayDate();
    if (dFrom.getTime() < today.getTime()) {
      alert('Valido dal non può essere nel passato.');
      if (e) e.preventDefault();
      return false;
    }
  }

  if (!validateRewardItems()) {
    if (e) e.preventDefault();
    return false;
  }

  if (!validateRulesForm()) {
    if (e) e.preventDefault();
    return false;
  }
  return true;
}

function validateRulesForm(){
  var rows = document.querySelectorAll('#rulesTable tbody tr');
  if (!rows || rows.length !== 1) {
    alert('Configura una sola regola di sblocco.');
    return false;
  }

  var tr = rows[0];
  var typeSel = tr.querySelector('.rule-type');
  var type = typeSel ? typeSel.value : '';
  var svc = tr.querySelector('.rule-service');
  var prd = tr.querySelector('.rule-product');
  var thr = tr.querySelector('.rule-threshold');

  if (type === 'service_qty' && (!svc || !svc.value)) {
    alert('Seleziona il servizio da conteggiare.');
    return false;
  }
  if (type === 'product_qty' && (!prd || !prd.value)) {
    alert('Seleziona il prodotto da conteggiare.');
    return false;
  }

  var needsThreshold = !(type === 'first_visit');
  if (needsThreshold) {
    var raw = thr ? (thr.value || '') : '';
    var num = (type === 'total_spend') ? parseFloat(String(raw).replace(',', '.')) : parseInt(raw, 10);
    if (!raw || isNaN(num) || num <= 0) {
      alert('Inserisci una soglia valida (> 0).');
      return false;
    }
  }

  return true;
}

function comboboxNorm(s){
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function initSimpleCombobox(boxEl, items, selectedId, allValue, allLabel){
  if (!boxEl) return;
  var toggle = boxEl.querySelector('.app-combobox-toggle');
  var hidden = boxEl.querySelector('input[type=hidden]');
  var search = boxEl.querySelector('.app-combobox-search');
  var list = boxEl.querySelector('.app-combobox-list');
  var textEl = toggle ? toggle.querySelector('.app-combobox-text') : null;
  var placeholderEl = toggle ? toggle.querySelector('.app-combobox-placeholder') : null;
  if (!toggle || !hidden || !search || !list || !textEl || !placeholderEl) return;

  var data = [{
    id: String(allValue),
    label: String(allLabel),
    search: comboboxNorm(allLabel)
  }].concat(Array.isArray(items) ? items : []);

  function render(){
    var q = comboboxNorm(search.value);
    list.innerHTML = '';
    var shown = 0;
    data.forEach(function(it){
      if (!q || String(it.search || '').indexOf(q) !== -1) {
        var a = document.createElement('button');
        a.type = 'button';
        a.className = 'dropdown-item d-flex justify-content-between align-items-center';
        a.textContent = it.label;
        a.addEventListener('click', function(){
          setValue(it.id);
          search.value = '';
          render();
        });
        list.appendChild(a);
        shown++;
      }
    });
    if (shown === 0) {
      var d = document.createElement('div');
      d.className = 'text-muted small px-2 py-1';
      d.textContent = 'Nessun risultato';
      list.appendChild(d);
    }
  }

  function updateLabel(){
    var id = String(hidden.value || '');
    var it = data.find(function(x){ return String(x.id) === id; }) || null;
    var label = it ? String(it.label || '') : '';
    if (id && id !== String(allValue) && label) {
      textEl.textContent = label;
      textEl.classList.remove('d-none');
      placeholderEl.classList.add('d-none');
    } else {
      textEl.textContent = '';
      textEl.classList.add('d-none');
      placeholderEl.classList.remove('d-none');
    }
  }

  function setValue(id){
    hidden.value = String(id == null ? '' : id);
    updateLabel();
  }

  setValue(String(selectedId != null && selectedId !== '' ? selectedId : (hidden.value || allValue || '')));
  render();
  search.addEventListener('input', render);
  toggle.addEventListener('shown.bs.dropdown', function(){
    setTimeout(function(){ search.focus(); search.select(); }, 0);
  });
}

document.addEventListener('change', function(e){
  if (e.target && e.target.id === 'giftFidelityOnly') {
    toggleGiftLevels();
    syncGiftExclusionUi();
  }
  if (e.target && e.target.name === 'eligible_levels_points[]') {
    syncGiftExclusionUi();
  }
  if (e.target && e.target.classList.contains('reward-item-type')) refreshRewardItemRow(e.target.closest('.reward-item-row'));
  if (e.target && e.target.classList.contains('rule-type')) refreshRuleRow(e.target.closest('tr'));
  if (e.target && (e.target.name === 'valid_from' || e.target.name === 'valid_to')) syncGiftValidityMinDates();
  if (e.target && e.target.id === 'gift_terms_enabled') toggleGiftTerms();
});

document.addEventListener('click', function(e){
  var addBtn = e.target && e.target.closest ? e.target.closest('[data-reward-add]') : null;
  if (addBtn) {
    addRewardItemRow();
    return;
  }

  var removeBtn = e.target && e.target.closest ? e.target.closest('.reward-item-remove') : null;
  if (removeBtn) {
    removeRewardItemRow(removeBtn);
    return;
  }

  var alertAction = e.target && e.target.closest ? e.target.closest('[data-alert-message]') : null;
  if (alertAction) {
    e.preventDefault();
    alert(alertAction.getAttribute('data-alert-message') || '');
    return;
  }

  var confirmAction = e.target && e.target.closest ? e.target.closest('[data-confirm]') : null;
  if (confirmAction && !window.confirm(confirmAction.getAttribute('data-confirm') || 'Confermare questa operazione?')) {
    e.preventDefault();
  }
});

function toggleGiftTerms(){
  var on = !!document.getElementById('gift_terms_enabled')?.checked;
  var box = document.getElementById('gift_terms_box');
  if (box) box.classList.toggle('d-none', !on);
}

document.addEventListener('DOMContentLoaded', function(){
  toggleGiftLevels();
  toggleGiftTerms();
  var form = document.getElementById('giftForm');
  if (form) {
    form.addEventListener('submit', validateGiftForm);
    syncGiftValidityMinDates();
  }
  document.querySelectorAll('#rewardItemsWrap .reward-item-row').forEach(function(row){ refreshRewardItemRow(row); });
  syncRewardItemRemoveButtons();
  document.querySelectorAll('#rulesTable .rule-type').forEach(function(sel){ refreshRuleRow(sel.closest('tr')); });

  giftClientEligibilitySnapshots = Array.isArray(GIFTS_PAGE_CONFIG.giftClientEligibilitySnapshots) ? GIFTS_PAGE_CONFIG.giftClientEligibilitySnapshots : [];
  if (!Array.isArray(giftClientEligibilitySnapshots)) giftClientEligibilitySnapshots = [];
  giftClientEligibilityById = {};
  giftClientEligibilitySnapshots.forEach(function(snapshot){
    snapshot.id = parseInt(snapshot.id, 10) || 0;
    snapshot.label = String(snapshot.label || ('Cliente #' + snapshot.id));
    snapshot.points_level = String(snapshot.points_level || '').trim().toLowerCase();
    giftClientEligibilityById[snapshot.id] = snapshot;
  });
  giftExcludedSelectedIds = Array.isArray(GIFTS_PAGE_CONFIG.selectedExcludedIds) ? GIFTS_PAGE_CONFIG.selectedExcludedIds : [];
  var giftExcludeAddBtn = document.getElementById('giftExcludeAddBtn');
  if (giftExcludeAddBtn) giftExcludeAddBtn.addEventListener('click', addGiftExcludedSelectedClient);
  var giftExcludeCandidateSelect = document.getElementById('giftExcludeCandidateSelect');
  if (giftExcludeCandidateSelect) {
    giftExcludeCandidateSelect.addEventListener('dblclick', addGiftExcludedSelectedClient);
  }
  syncGiftExclusionUi();

  var giftClientItems = Array.isArray(GIFTS_PAGE_CONFIG.clientItems) ? GIFTS_PAGE_CONFIG.clientItems : [];
  if (Array.isArray(giftClientItems)) {
    giftClientItems = giftClientItems.map(function(it){ it.search = comboboxNorm(it.label); return it; });
  }
  var giftClientFilterBox = document.getElementById('giftClientFilterBox');
  if (giftClientFilterBox) {
    var hv = giftClientFilterBox.querySelector('input[type=hidden]');
    initSimpleCombobox(giftClientFilterBox, giftClientItems, (hv ? hv.value : '0'), '0', 'Tutti');
  }

  var giftGiftItems = Array.isArray(GIFTS_PAGE_CONFIG.giftItems) ? GIFTS_PAGE_CONFIG.giftItems : [];
  if (Array.isArray(giftGiftItems)) {
    giftGiftItems = giftGiftItems.map(function(it){ it.search = comboboxNorm(it.label); return it; });
  }
  var giftGiftFilterBox = document.getElementById('giftGiftFilterBox');
  if (giftGiftFilterBox) {
    var giftHv = giftGiftFilterBox.querySelector('input[type=hidden]');
    initSimpleCombobox(giftGiftFilterBox, giftGiftItems, (giftHv ? giftHv.value : '0'), '0', 'Tutti');
  }

  var assignGiftClientBox = document.getElementById('assignGiftClientBox');
  if (assignGiftClientBox) {
    var assignHidden = assignGiftClientBox.querySelector('input[type=hidden]');
    initSimpleCombobox(assignGiftClientBox, giftClientItems, (assignHidden ? assignHidden.value : ''), '', '— seleziona —');
  }

  var autoOpenSummaryId = String(GIFTS_PAGE_CONFIG.autoOpenSummaryId || '');
  if (autoOpenSummaryId) {
    var autoOpenSummaryEl = document.getElementById(autoOpenSummaryId);
    if (autoOpenSummaryEl && window.bootstrap && bootstrap.Modal) {
      bootstrap.Modal.getOrCreateInstance(autoOpenSummaryEl).show();
    }
  }

  var assignGiftForm = document.getElementById('assignGiftForm');
  if (assignGiftForm) {
    var assignForceField = assignGiftForm.querySelector('input[name="force_ineligible"]');
    var assignGiftSelect = assignGiftForm.querySelector('select[name="gift_id"]');
    var assignClientHidden = assignGiftForm.querySelector('input[name="client_id"]');
    var assignModalEl = document.getElementById('assignGiftModal');
    var assignSubmitting = false;

    function resetAssignForce(){
      if (assignForceField) assignForceField.value = '0';
      assignSubmitting = false;
    }

    if (assignGiftSelect) assignGiftSelect.addEventListener('change', resetAssignForce);
    if (assignClientHidden) assignClientHidden.addEventListener('change', resetAssignForce);
    if (assignModalEl) {
      assignModalEl.addEventListener('hidden.bs.modal', function(){
        resetAssignForce();
      });
    }

    assignGiftForm.addEventListener('submit', function(e){
      if (assignSubmitting) return;
      e.preventDefault();

      var clientId = assignClientHidden ? String(assignClientHidden.value || '').trim() : '';
      var giftId = assignGiftSelect ? String(assignGiftSelect.value || '').trim() : '';
      if (!clientId) {
        alert('Seleziona un cliente.');
        return;
      }
      if (!giftId) {
        alert('Seleziona un omaggio.');
        return;
      }

      var formData = new FormData(assignGiftForm);
      formData.set('_mode', 'assign_manual_check');
      if (assignForceField) assignForceField.value = '0';

      fetch(window.location.href, {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      })
      .then(function(resp){
        return resp.json();
      })
      .then(function(data){
        if (!data || data.ok !== true) {
          alert((data && data.error) ? data.error : 'Errore durante la verifica dell\'idoneità del cliente.');
          return;
        }

        if (data.eligible === false && data.requires_confirmation) {
          var confirmMessage = String(data.message || 'Il cliente selezionato non è idoneo a questo gift. Vuoi assegnarlo comunque?');
          if (!window.confirm(confirmMessage)) {
            resetAssignForce();
            return;
          }
          if (assignForceField) assignForceField.value = '1';
        }

        assignSubmitting = true;
        assignGiftForm.submit();
      })
      .catch(function(){
        alert('Errore durante la verifica dell\'idoneità del cliente.');
        resetAssignForce();
      });
    });
  }
});

function refreshRuleRow(tr){
  if (!tr) return;
  var type = tr.querySelector('.rule-type') ? tr.querySelector('.rule-type').value : '';
  var svc = tr.querySelector('.rule-service');
  var prd = tr.querySelector('.rule-product');
  var thr = tr.querySelector('.rule-threshold');
  var hintSvc = tr.querySelector('.rule-hint-service');
  var hintPrd = tr.querySelector('.rule-hint-product');

  var showSvc = (type === 'service_qty');
  var showPrd = (type === 'product_qty');
  if (svc) {
    svc.style.display = showSvc ? '' : 'none';
    if (!showSvc) svc.value = '';
  }
  if (hintSvc) hintSvc.style.display = showSvc ? '' : 'none';

  if (prd) {
    prd.style.display = showPrd ? '' : 'none';
    if (!showPrd) prd.value = '';
  }
  if (hintPrd) hintPrd.style.display = showPrd ? '' : 'none';

  if (thr) {
    var hideThr = (type === 'first_visit');
    thr.style.display = hideThr ? 'none' : '';
    if (hideThr) {
      thr.value = '';
    } else if (type === 'total_spend') {
      thr.type = 'number';
      thr.step = '0.01';
      thr.min = '0.01';
      thr.placeholder = '100.00';
      thr.inputMode = 'decimal';
    } else {
      thr.type = 'number';
      thr.step = '1';
      thr.min = '1';
      thr.placeholder = '1';
      thr.inputMode = 'numeric';
    }
  }
}
