function promotionsReadJsonConfig(id) {
  var el = document.getElementById(id);
  if (!el) return {};
  try {
    return JSON.parse(el.textContent || '{}') || {};
  } catch (e) {
    return {};
  }
}

var PROMOTIONS_PAGE_CONFIG = promotionsReadJsonConfig('promotionsPageConfig');

function promoSetHidden(el, hidden) {
  if (!el) return;
  el.classList.toggle('promo-hidden', !!hidden);
}

document.addEventListener('DOMContentLoaded', function(){
  function parsePending(raw) {
    try {
      var parsed = JSON.parse(raw || '{}');
      return {
        count: Number(parsed.count || 0),
        items: Array.isArray(parsed.items) ? parsed.items : []
      };
    } catch (e) {
      return { count: 0, items: [] };
    }
  }

  document.querySelectorAll('.js-promo-action-confirm').forEach(function(btn){
    btn.addEventListener('click', function(){
      var modalEl = document.getElementById('promotionActionConfirmModal');
      if (!modalEl || !window.bootstrap || !bootstrap.Modal) return;
      var kind = btn.getAttribute('data-kind') || '';
      var title = btn.getAttribute('data-title') || 'Promozione';
      var href = btn.getAttribute('data-href') || '#';
      var pending = parsePending(btn.getAttribute('data-pending') || '{}');

      var titleEl = document.getElementById('promotionActionConfirmTitle');
      var warningEl = document.getElementById('promotionActionConfirmWarning');
      var pendingCountEl = document.getElementById('promotionActionPendingCount');
      var pendingTextEl = document.getElementById('promotionActionPendingText');
      var pendingListEl = document.getElementById('promotionActionPendingList');
      var goEl = document.getElementById('promotionActionConfirmGo');

      if (titleEl) {
        titleEl.textContent = (kind === 'delete' ? 'Elimina promozione' : 'Disattiva promozione') + ' - ' + title;
      }
      if (warningEl) {
        warningEl.innerHTML = kind === 'delete'
          ? '<div class="fw-semibold mb-1">Eliminazione definitiva</div><div>Le prenotazioni in stato In sospeso o Prenotato perderanno la promozione. Le prenotazioni eseguite e le vendite gia registrate non subiranno variazioni. La campagna verra eliminata definitivamente.</div>'
          : '<div class="fw-semibold mb-1">Conferma disattivazione</div><div>Le prenotazioni in stato In sospeso o Prenotato perderanno la promozione. Le prenotazioni eseguite e le vendite gia registrate non subiranno variazioni.</div>';
      }
      if (pendingTextEl) {
        pendingTextEl.textContent = pending.count > 0
          ? pending.count + ' prenotazion' + (pending.count === 1 ? 'e aperta perdera' : 'i aperte perderanno') + ' la promozione.'
          : 'Non risultano prenotazioni aperte collegate alla promozione.';
      }
      if (pendingCountEl) pendingCountEl.textContent = String(pending.count || 0);
      if (pendingListEl) {
        pendingListEl.innerHTML = '';
        pending.items.slice(0, 20).forEach(function(item){
          var row = document.createElement('div');
          row.className = 'list-group-item px-0';
          row.textContent = (item.label || 'Prenotazione') + (item.detail ? ' - ' + item.detail : '');
          pendingListEl.appendChild(row);
        });
        if (pending.count > pending.items.length) {
          var more = document.createElement('div');
          more.className = 'list-group-item px-0 text-muted';
          more.textContent = 'Altre ' + (pending.count - pending.items.length) + ' prenotazioni non mostrate.';
          pendingListEl.appendChild(more);
        }
      }
      var pendingCollapseEl = document.getElementById('promotionActionPendingCollapse');
      var pendingToggleEl = document.querySelector('[data-bs-target="#promotionActionPendingCollapse"]');
      if (pendingCollapseEl) pendingCollapseEl.classList.remove('show');
      if (pendingToggleEl) {
        pendingToggleEl.classList.add('collapsed');
        pendingToggleEl.setAttribute('aria-expanded', 'false');
      }
      if (goEl) goEl.setAttribute('href', href);
      bootstrap.Modal.getOrCreateInstance(modalEl).show();
    });
  });

  var autoOpenSummaryId = String(PROMOTIONS_PAGE_CONFIG.autoOpenSummaryId || '');
  if (!autoOpenSummaryId) return;
  var el = document.getElementById(autoOpenSummaryId);
  if (el && window.bootstrap && bootstrap.Modal) {
    bootstrap.Modal.getOrCreateInstance(el).show();
  }
});

var promoClientEligibilitySnapshots = Array.isArray(PROMOTIONS_PAGE_CONFIG.clientEligibilitySnapshots) ? PROMOTIONS_PAGE_CONFIG.clientEligibilitySnapshots : [];
var promoClientEligibilityById = {};
promoClientEligibilitySnapshots.forEach(function(snapshot){
  var id = parseInt(snapshot.id, 10) || 0;
  if (id > 0) promoClientEligibilityById[id] = snapshot;
});
var promoExcludedSelectedIds = Array.isArray(PROMOTIONS_PAGE_CONFIG.excludedSelectedIds) ? PROMOTIONS_PAGE_CONFIG.excludedSelectedIds : [];
promoExcludedSelectedIds = promoExcludedSelectedIds.map(function(id){ return parseInt(id, 10) || 0; }).filter(function(id){ return id > 0; });

// -----------------------------
// Scope / Sconto (UI)
// -----------------------------

function __getScopeModes() {
  var svcMode = document.getElementById('apply_services_mode')?.value || 'all';
  var prdMode = document.getElementById('apply_products_mode')?.value || 'none';
  return { svcMode: svcMode, prdMode: prdMode };
}

function updateDiscountUI() {
  var st = __getScopeModes();

  var section = document.getElementById('discount_section');
  var svcBox = document.getElementById('svc_global_discount_box');
  var prdBox = document.getElementById('prd_global_discount_box');
  var help = document.getElementById('discount_help');

  var hasSvc = (st.svcMode === 'all');
  var hasPrd = (st.prdMode === 'all');
  var hasAny = (hasSvc || hasPrd);

  promoSetHidden(section, !hasAny);

  var toggleSection = function(box, show) {
    if (!box) return;
    promoSetHidden(box, !show);
    box.querySelectorAll('select, input, textarea').forEach(function(el){
      el.disabled = !show;
    });
  };

  toggleSection(svcBox, hasSvc);
  toggleSection(prdBox, hasPrd);

  if (help) {
    if (!hasAny) {
      help.innerText = 'Hai scelto solo elementi selezionati: imposta lo sconto sulle righe per ogni servizio/prodotto.';
    } else if (hasSvc && hasPrd) {
      help.innerText = 'Imposta lo sconto separatamente per “Tutti i servizi” e “Tutti i prodotti”.';
    } else if (hasSvc && st.prdMode === 'selected') {
      help.innerText = 'Imposta lo sconto per “Tutti i servizi”. I prodotti selezionati hanno lo sconto configurabile sulle righe.';
    } else if (hasPrd && st.svcMode === 'selected') {
      help.innerText = 'Imposta lo sconto per “Tutti i prodotti”. I servizi selezionati hanno lo sconto configurabile sulle righe.';
    } else if (hasSvc) {
      help.innerText = 'Imposta lo sconto per “Tutti i servizi”.';
    } else if (hasPrd) {
      help.innerText = 'Imposta lo sconto per “Tutti i prodotti”.';
    } else {
      help.innerText = '';
    }
  }
}

function togglePickers() {
  var st = __getScopeModes();
  var svcPicker = document.getElementById('services_picker');
  var prdPicker = document.getElementById('products_picker');
  promoSetHidden(svcPicker, st.svcMode !== 'selected');
  promoSetHidden(prdPicker, st.prdMode !== 'selected');
  updateDiscountUI();
  syncAllItemRows();
}

// -----------------------------
// Per-item discount controls
// -----------------------------

function __parseNumber(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  var s = String(v).trim();
  if (s === '') return 0;
  // supporto virgola decimale
  s = s.replace(',', '.');
  var n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

function __fmtMoney(v) {
  var n = __parseNumber(v);
  try {
    return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch (e) {
    return (Math.round(n * 100) / 100).toFixed(2);
  }
}

function updateItemPreview(row) {
  if (!row) return;
  var preview = row.querySelector('.item-discount-preview');
  if (!preview) return;

  var base = __parseNumber(row.getAttribute('data-unit-price') || 0);
  if (!isFinite(base) || base <= 0) {
    preview.textContent = '';
    return;
  }

  var cb = row.querySelector('input[type="checkbox"]');
  if (cb && !cb.checked) {
    preview.textContent = '';
    return;
  }

  var selType = row.querySelector('select.item-discount-type');
  var inpVal = row.querySelector('input.item-discount-value');
  var dtype = (selType && selType.value) ? selType.value : 'percent';
  var dval = __parseNumber(inpVal ? inpVal.value : 0);

  if (dtype === 'percent') {
    if (dval < 0) dval = 0;
    if (dval > 100) dval = 100;
  } else {
    if (dval < 0) dval = 0;
  }

  var discount = 0;
  if (dtype === 'percent') {
    discount = (base * dval / 100.0);
  } else {
    discount = dval;
  }
  if (discount < 0) discount = 0;
  if (discount > base) discount = base;
  var finalPrice = Math.max(0, base - discount);

  if (discount > 0.00001) {
    preview.textContent = 'Prezzo dopo sconto: € ' + __fmtMoney(finalPrice) + ' ( -€ ' + __fmtMoney(discount) + ' )';
  } else {
    preview.textContent = 'Prezzo dopo sconto: € ' + __fmtMoney(finalPrice);
  }
}

function updateAllItemPreviews() {
  document.querySelectorAll('.svc-item, .prd-item').forEach(updateItemPreview);
}

function syncItemRow(row) {
  if (!row) return;
  var cb = row.querySelector('input[type="checkbox"]');
  var controls = row.querySelector('.item-discount-controls');
  if (!cb || !controls) return;

  if (cb.checked) {
    promoSetHidden(controls, false);
    controls.querySelectorAll('select, input').forEach(function(el){
      el.disabled = false;
    });
  } else {
    promoSetHidden(controls, true);
    controls.querySelectorAll('select, input').forEach(function(el){
      el.disabled = true;
    });
  }

  updateItemPreview(row);
}

function syncAllItemRows() {
  document.querySelectorAll('.svc-item').forEach(syncItemRow);
  document.querySelectorAll('.prd-item').forEach(syncItemRow);
}

function applyQuick(kind) {
  kind = (kind === 'prd') ? 'prd' : 'svc';

  var typeEl = document.getElementById(kind === 'svc' ? 'quick_svc_type' : 'quick_prd_type');
  var valEl = document.getElementById(kind === 'svc' ? 'quick_svc_value' : 'quick_prd_value');
  var minQtyEl = document.getElementById(kind === 'svc' ? 'quick_svc_min_qty' : 'quick_prd_min_qty');

  if (!typeEl) return;

  var dtype = (typeEl.value || 'percent');
  var dval = (valEl ? (valEl.value || '') : '');
  var minQty = (minQtyEl ? (minQtyEl.value || '') : '');

  document.querySelectorAll(kind === 'svc' ? '.svc-item' : '.prd-item').forEach(function(row){
    var cb = row.querySelector('input[type="checkbox"]');
    if (!cb || !cb.checked) return;

    var selType = row.querySelector('select.item-discount-type');
    var inpVal = row.querySelector('input.item-discount-value');
    var inpMinQty = row.querySelector('input.item-min-qty');

    if (selType) selType.value = dtype;
    if (inpVal) inpVal.value = dval;
    if (inpMinQty) inpMinQty.value = (minQty || '1');

    syncItemRow(row);
    updateItemPreview(row);
  });
}

// -----------------------------
// Target / clienti esclusi
// -----------------------------

function promoEligibilityConfig(){
  var target = document.getElementById('target_type')?.value || 'all';
  var points = [];
  document.querySelectorAll('input[name="target_fidelity_levels[]"]:checked').forEach(function(cb){
    var v = String(cb.value || '').trim().toLowerCase();
    if (!v) return;
    if (v.indexOf('points:') === 0) {
      points.push(v.substring(7));
    } else {
      points.push(v);
    }
  });
  return { target: target, points: points };
}

function promoClientMatchesEligibility(snapshot, cfg){
  if (!snapshot) return false;
  cfg = cfg || promoEligibilityConfig();
  if (cfg.target !== 'fidelity') return true;
  if (!snapshot.adhering) return false;
  var curPts = String(snapshot.points_level || '').trim().toLowerCase();
  if (!cfg.points || !cfg.points.length) return true;
  if (cfg.points && cfg.points.length && curPts && cfg.points.indexOf(curPts) !== -1) return true;
  return false;
}

function promoExclusionSelectionLocked(cfg){
  return false;
}

function sanitizePromoExcludedSelections(){
  var cfg = promoEligibilityConfig();
  promoExcludedSelectedIds = promoExcludedSelectedIds.filter(function(id){
    id = parseInt(id, 10) || 0;
    if (!id) return false;
    var snap = promoClientEligibilityById[id] || null;
    return !!snap && promoClientMatchesEligibility(snap, cfg);
  });
}

function renderPromoExcludedClients(){
  var listEl = document.getElementById('promoExcludedClientsList');
  var hiddenWrap = document.getElementById('promoExcludedHiddenInputs');
  if (!listEl || !hiddenWrap) return;

  listEl.innerHTML = '';
  hiddenWrap.innerHTML = '';

  var ordered = promoExcludedSelectedIds.slice().map(function(id){ return parseInt(id, 10) || 0; }).filter(function(id){ return id > 0; });
  ordered.sort(function(a, b){
    var labelA = String((promoClientEligibilityById[a] && promoClientEligibilityById[a].label) || ('Cliente #' + a)).toLowerCase();
    var labelB = String((promoClientEligibilityById[b] && promoClientEligibilityById[b].label) || ('Cliente #' + b)).toLowerCase();
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
    var snap = promoClientEligibilityById[id] || { id: id, label: 'Cliente #' + id, adhering: false, points_level: '' };
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
      promoExcludedSelectedIds = promoExcludedSelectedIds.filter(function(existingId){ return parseInt(existingId, 10) !== id; });
      syncPromoExclusionUi();
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

function renderPromoExclusionCandidates(){
  var selectEl = document.getElementById('promoExcludeCandidateSelect');
  var helpEl = document.getElementById('promoExcludeCandidatesHelp');
  var addBtn = document.getElementById('promoExcludeAddBtn');
  if (!selectEl) return;

  var cfg = promoEligibilityConfig();
  var locked = promoExclusionSelectionLocked(cfg);
  var selectedLookup = {};
  promoExcludedSelectedIds.forEach(function(id){
    id = parseInt(id, 10) || 0;
    if (id > 0) selectedLookup[id] = true;
  });

  selectEl.innerHTML = '';
  var placeholder = document.createElement('option');
  placeholder.value = '';

  if (locked) {
    placeholder.textContent = 'Seleziona prima almeno un livello Fidelity';
    selectEl.appendChild(placeholder);
    selectEl.disabled = true;
    if (addBtn) addBtn.disabled = true;
    if (helpEl) helpEl.textContent = 'Con "Solo clienti con Fidelity" attivo devi selezionare almeno un livello Punti per sbloccare questo campo.';
    return;
  }

  var candidates = promoClientEligibilitySnapshots.filter(function(snapshot){
    var id = parseInt(snapshot.id, 10) || 0;
    if (!id || selectedLookup[id]) return false;
    return promoClientMatchesEligibility(snapshot, cfg);
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
      ? 'La lista viene aggiornata in base al target della promozione.'
      : 'Nessun cliente disponibile con i filtri attuali oppure tutti già selezionati.';
  }
}

function syncPromoExclusionUi(){
  sanitizePromoExcludedSelections();
  renderPromoExcludedClients();
  renderPromoExclusionCandidates();
}

function addPromoExcludedSelectedClient(){
  var selectEl = document.getElementById('promoExcludeCandidateSelect');
  if (!selectEl || !selectEl.value) return;
  var id = parseInt(selectEl.value, 10) || 0;
  if (!id) return;
  if (promoExcludedSelectedIds.indexOf(id) === -1) promoExcludedSelectedIds.push(id);
  syncPromoExclusionUi();
}

function toggleTarget() {
  var t = document.getElementById('target_type')?.value || 'all';
  promoSetHidden(document.getElementById('target_new'), t !== 'new');
  promoSetHidden(document.getElementById('target_inactive'), t !== 'inactive');
  promoSetHidden(document.getElementById('target_birthday'), t !== 'birthday');
  promoSetHidden(document.getElementById('target_fidelity'), t !== 'fidelity');
  syncPromoExclusionUi();
}

function filterList(input, cls) {
  var q = (input.value || '').toLowerCase().trim();
  document.querySelectorAll('.' + cls).forEach(function(el){
    var t = (el.getAttribute('data-text') || '');
    promoSetHidden(el, !(q === '' || t.indexOf(q) !== -1));
  });
}

function removeRow(btn) {
  var row = btn.closest('.tw-row, .bo-row');
  if (row) row.remove();
}

function addTimeWindowRow() {
  var wrap = document.getElementById('time_windows_wrap');
  if (!wrap) return;
  var tpl = document.createElement('div');
  tpl.className = 'row g-2 align-items-end mb-2 tw-row';
  tpl.innerHTML = `
    <div class="col-4">
      <label class="form-label small">Giorno</label>
      <select class="form-select form-select-sm" name="tw_day[]">
        <option value="1">Lun</option>
        <option value="2">Mar</option>
        <option value="3">Mer</option>
        <option value="4">Gio</option>
        <option value="5">Ven</option>
        <option value="6">Sab</option>
        <option value="7">Dom</option>
      </select>
    </div>
    <div class="col-3">
      <label class="form-label small">Da</label>
      <input class="form-control form-control-sm" type="time" name="tw_start[]" value="" />
    </div>
    <div class="col-3">
      <label class="form-label small">A</label>
      <input class="form-control form-control-sm" type="time" name="tw_end[]" value="" />
    </div>
    <div class="col-2">
      <button class="btn btn-outline-danger btn-sm w-100" type="button" data-promo-remove-row><i class="bi bi-x-lg"></i></button>
    </div>
  `;
  wrap.appendChild(tpl);
}

function addBlackoutRow() {
  var wrap = document.getElementById('blackout_wrap');
  if (!wrap) return;
  var tpl = document.createElement('div');
  tpl.className = 'row g-2 align-items-end mb-2 bo-row';
  tpl.innerHTML = `
    <div class="col-10">
      <input class="form-control form-control-sm" type="date" name="bo_date[]" value="" />
    </div>
    <div class="col-2">
      <button class="btn btn-outline-danger btn-sm w-100" type="button" data-promo-remove-row><i class="bi bi-x-lg"></i></button>
    </div>
  `;
  wrap.appendChild(tpl);
}

function toggleStackable(){
  var on = !!document.getElementById('stackable')?.checked;
  var box = document.getElementById('stackableMethods');
  promoSetHidden(box, !on);
}

function togglePromoConditions(){
  var on = !!document.getElementById('promo_conditions_enabled')?.checked;
  var box = document.getElementById('promo_conditions_box');
  promoSetHidden(box, !on);
}

// -----------------------------
// Bindings
// -----------------------------

document.addEventListener('click', function(event){
  var target = event.target;
  if (!(target instanceof Element)) return;

  var alertBtn = target.closest('[data-promo-alert]');
  if (alertBtn) {
    event.preventDefault();
    alert(alertBtn.getAttribute('data-promo-alert') || '');
    return;
  }

  var quickBtn = target.closest('[data-promo-quick]');
  if (quickBtn) {
    event.preventDefault();
    applyQuick(quickBtn.getAttribute('data-promo-quick') || 'svc');
    return;
  }

  var removeBtn = target.closest('[data-promo-remove-row]');
  if (removeBtn) {
    event.preventDefault();
    removeRow(removeBtn);
    return;
  }

  if (target.closest('[data-promo-add-time-window]')) {
    event.preventDefault();
    addTimeWindowRow();
    return;
  }

  if (target.closest('[data-promo-add-blackout]')) {
    event.preventDefault();
    addBlackoutRow();
    return;
  }

  if (target.closest('[data-promo-exclude-add]')) {
    event.preventDefault();
    addPromoExcludedSelectedClient();
  }
});

document.addEventListener('input', function(event){
  var target = event.target;
  if (!(target instanceof Element)) return;
  var filterInput = target.closest('[data-promo-filter]');
  if (!filterInput) return;
  filterList(filterInput, filterInput.getAttribute('data-promo-filter') || '');
});

document.getElementById('apply_services_mode')?.addEventListener('change', togglePickers);
document.getElementById('apply_products_mode')?.addEventListener('change', togglePickers);

document.getElementById('target_type')?.addEventListener('change', toggleTarget);
document.querySelectorAll('.promo-fidelity-level').forEach(function(cb){
  cb.addEventListener('change', syncPromoExclusionUi);
});

document.getElementById('stackable')?.addEventListener('change', toggleStackable);

document.getElementById('promo_conditions_enabled')?.addEventListener('change', togglePromoConditions);

document.querySelectorAll('.svc-check, .prd-check').forEach(function(cb){
  cb.addEventListener('change', function(){
    syncItemRow(cb.closest('.svc-item, .prd-item'));
  });
});

// Aggiorna preview "Prezzo dopo sconto" quando cambia tipo/valore.
document.querySelectorAll('select.item-discount-type').forEach(function(sel){
  sel.addEventListener('change', function(){
    updateItemPreview(sel.closest('.svc-item, .prd-item'));
  });
});
document.querySelectorAll('input.item-discount-value').forEach(function(inp){
  inp.addEventListener('input', function(){
    updateItemPreview(inp.closest('.svc-item, .prd-item'));
  });
  inp.addEventListener('change', function(){
    updateItemPreview(inp.closest('.svc-item, .prd-item'));
  });
});

// Safety net: ensure that the inputs of checked rows are enabled when submitting the form.
// Disabled inputs are not submitted and would make per-item discounts appear "not saved".
var promoForm = document.getElementById('promotionForm');
if (promoForm) {
  promoForm.addEventListener('submit', function(ev){
    function q(selector) {
      return promoForm.querySelector(selector);
    }
    function qa(selector) {
      return promoForm.querySelectorAll(selector);
    }
    function stopSubmit(message, selector) {
      alert(message);
      if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
      try {
        var focusEl = selector ? (q(selector) || document.querySelector(selector)) : null;
        if (focusEl && typeof focusEl.focus === 'function') focusEl.focus();
      } catch (e) {}
      return false;
    }

    var checkedLocations = qa('input[name="promotion_location_ids[]"]:checked').length;
    if (checkedLocations <= 0) {
      return stopSubmit('Seleziona almeno una sede per la promozione.', 'input[name="promotion_location_ids[]"]');
    }

    var startsAt = q('input[name="starts_at"]')?.value || '';
    var endsAt = q('input[name="ends_at"]')?.value || '';
    if (startsAt && endsAt && startsAt > endsAt) {
      return stopSubmit('La data di fine deve essere uguale o successiva alla data di inizio.', 'input[name="ends_at"]');
    }

    var invalidTimeRow = null;
    qa('.tw-row').forEach(function(row){
      if (invalidTimeRow) return;
      var s = row.querySelector('input[name="tw_start[]"]')?.value || '';
      var e = row.querySelector('input[name="tw_end[]"]')?.value || '';
      if (!s && !e) return;
      if (!s || !e || s >= e) invalidTimeRow = row;
    });
    if (invalidTimeRow) {
      return stopSubmit('Completa correttamente le fasce orarie: il campo "A" deve essere successivo a "Da".');
    }

    var modes = __getScopeModes();
    if (modes.svcMode === 'none' && modes.prdMode === 'none') {
      return stopSubmit('Seleziona almeno servizi o prodotti da includere nella promozione.', '#apply_services_mode');
    }
    if (modes.svcMode === 'selected' && qa('.svc-check:checked').length <= 0) {
      return stopSubmit('Se hai scelto "Solo servizi selezionati", seleziona almeno un servizio.', '#apply_services_mode');
    }
    if (modes.prdMode === 'selected' && qa('.prd-check:checked').length <= 0) {
      return stopSubmit('Se hai scelto "Solo prodotti selezionati", seleziona almeno un prodotto.', '#apply_products_mode');
    }
    var promoActive = !!q('#is_active')?.checked;
    if (promoActive && modes.svcMode === 'selected') {
      var inactiveServiceRow = null;
      qa('.svc-item').forEach(function(row){
        if (inactiveServiceRow) return;
        var cb = row.querySelector('.svc-check');
        if (cb && cb.checked && String(row.dataset.active || '0') !== '1') inactiveServiceRow = row;
      });
      if (inactiveServiceRow) {
        return stopSubmit('Non puoi attivare una promozione con servizi selezionati disattivati o non trovati.');
      }
    }
    if (promoActive && modes.prdMode === 'selected') {
      var inactiveProductRow = null;
      qa('.prd-item').forEach(function(row){
        if (inactiveProductRow) return;
        var cb = row.querySelector('.prd-check');
        if (cb && cb.checked && String(row.dataset.active || '0') !== '1') inactiveProductRow = row;
      });
      if (inactiveProductRow) {
        return stopSubmit('Non puoi attivare una promozione con prodotti selezionati disattivati o non trovati.');
      }
    }

    var svcVal = __parseNumber(q('input[name="discount_value"]')?.value || 0);
    var svcType = q('select[name="discount_type"]')?.value || 'percent';
    var prdValRaw = q('input[name="products_discount_value"]')?.value || '';
    var prdVal = String(prdValRaw).trim() === '' ? svcVal : __parseNumber(prdValRaw);
    var prdType = q('select[name="products_discount_type"]')?.value || svcType;
    if (modes.svcMode === 'all') {
      if (svcVal <= 0) return stopSubmit('Inserisci uno sconto maggiore di 0 per tutti i servizi.', 'input[name="discount_value"]');
      if (svcType === 'percent' && svcVal > 100) return stopSubmit('Lo sconto percentuale servizi non puo superare 100%.', 'input[name="discount_value"]');
    }
    if (modes.prdMode === 'all') {
      if (prdVal <= 0) return stopSubmit('Inserisci uno sconto maggiore di 0 per tutti i prodotti.', 'input[name="products_discount_value"]');
      if (prdType === 'percent' && prdVal > 100) return stopSubmit('Lo sconto percentuale prodotti non puo superare 100%.', 'input[name="products_discount_value"]');
    }
    var badSelectedDiscount = null;
    if (modes.svcMode === 'selected') {
      qa('.svc-item').forEach(function(row){
        if (badSelectedDiscount) return;
        var cb = row.querySelector('.svc-check');
        if (!cb || !cb.checked) return;
        var val = __parseNumber(row.querySelector('input.item-discount-value')?.value || 0);
        var type = row.querySelector('select.item-discount-type')?.value || 'percent';
        if (val <= 0 || (type === 'percent' && val > 100)) badSelectedDiscount = row;
      });
    }
    if (!badSelectedDiscount && modes.prdMode === 'selected') {
      qa('.prd-item').forEach(function(row){
        if (badSelectedDiscount) return;
        var cb = row.querySelector('.prd-check');
        if (!cb || !cb.checked) return;
        var val = __parseNumber(row.querySelector('input.item-discount-value')?.value || 0);
        var type = row.querySelector('select.item-discount-type')?.value || 'percent';
        if (val <= 0 || (type === 'percent' && val > 100)) badSelectedDiscount = row;
      });
    }
    if (badSelectedDiscount) {
      return stopSubmit('Imposta uno sconto valido maggiore di 0 per ogni elemento selezionato.');
    }

    var condEnabled = !!q('#promo_conditions_enabled')?.checked;
    var condText = q('textarea[name="promo_conditions"]')?.value || '';
    if (condEnabled && String(condText).trim() === '') {
      return stopSubmit('Inserisci il testo delle condizioni promozionali oppure disattiva il flag.', 'textarea[name="promo_conditions"]');
    }

    try {
      syncPromoExclusionUi();
      qa('.svc-item, .prd-item').forEach(function(row){
        var cb = row.querySelector('input[type="checkbox"]');
        if (!cb || !cb.checked) return;
        var controls = row.querySelector('.item-discount-controls');
        if (!controls) return;
        promoSetHidden(controls, false);
        controls.querySelectorAll('select, input').forEach(function(el){
          el.disabled = false;
        });
      });
    } catch (e) {}
  });
}

// Init
if (document.getElementById('promotionForm')) {
  togglePickers();
  toggleTarget();
  toggleStackable();
  togglePromoConditions();
  syncAllItemRows();
  updateAllItemPreviews();
  updateDiscountUI();
}
