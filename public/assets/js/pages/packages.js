function packagesReadJsonConfig(id) {
  const el = document.getElementById(id);
  if (!el) return {};
  try {
    return JSON.parse(el.textContent || '{}') || {};
  } catch (e) {
    return {};
  }
}

const PACKAGES_PAGE_CONFIG = packagesReadJsonConfig('packagesPageConfig');

(function(){
  // Combobox helper (minimal)
  function norm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim(); }

  document.addEventListener('click', function(e){
    const link = e.target && e.target.closest ? e.target.closest('[data-package-catalog-delete]') : null;
    if (!link) return;
    const msg = link.getAttribute('data-confirm') || 'Eliminare questo pacchetto dal catalogo?';
    if (!window.confirm(msg)) e.preventDefault();
  });

  function initCombobox(boxEl, items, selectedId, allValue, allLabel, opts){
    opts = opts || {};
    if(!boxEl) return;
    const toggle = boxEl.querySelector('.app-combobox-toggle');
    const hidden = boxEl.querySelector('input[type=hidden]');
    const search = boxEl.querySelector('.app-combobox-search');
    const list = boxEl.querySelector('.app-combobox-list');
    const textEl = boxEl.querySelector('.app-combobox-text');
    const placeholderEl = boxEl.querySelector('.app-combobox-placeholder');
    if(!toggle || !hidden || !search || !list || !textEl || !placeholderEl) return;

    const allItem = { id: String(allValue), label: String(allLabel), search: norm(allLabel) };
    let data = [allItem].concat(items);

      function render(){
      const q = norm(search.value);
      list.innerHTML = '';
      let shown = 0;
      data.forEach(it => {
        if(!q || String(it.search||'').indexOf(q) !== -1){
          const a = document.createElement('button');
          a.type = 'button';
          a.className = 'dropdown-item d-flex justify-content-between align-items-center';
          a.textContent = it.label;
          a.addEventListener('click', function(){
              setValue(it.id, true);
            search.value = '';
            render();
          });
          list.appendChild(a);
          shown++;
        }
      });
      if(shown === 0){
        const d = document.createElement('div');
        d.className = 'text-muted small px-2 py-1';
        d.textContent = 'Nessun risultato';
        list.appendChild(d);
      }
    }

      function updateLabel(){
      const id = String(hidden.value || '');
      const it = data.find(x => String(x.id) === id);
      const label = it ? it.label : '';
      if(id && id !== String(allValue) && label){
        textEl.textContent = label;
        textEl.classList.remove('d-none');
        placeholderEl.classList.add('d-none');
      } else {
        textEl.textContent = '';
        textEl.classList.add('d-none');
        placeholderEl.classList.remove('d-none');
      }
    }

      function setValue(id, trigger){
        hidden.value = String(id == null ? '' : id);
        updateLabel();
        if(trigger && typeof opts.onChange === 'function'){
          const it = data.find(x => String(x.id) === String(hidden.value || ''));
          opts.onChange(it || null, hidden.value);
        }
      }

    // initial
      setValue(String(selectedId != null ? selectedId : (hidden.value || allValue || '')), false);
    render();

      // Expose setter for programmatic updates (e.g. auto-fill)
      boxEl._appCombobox = {
        setValue: function(v){ setValue(v, false); },
        setValueAndTrigger: function(v){ setValue(v, true); },
        setItems: function(newItems){
          data = [allItem].concat(newItems || []);
          const current = String(hidden.value || '');
          if(!data.find(x => String(x.id) === current)) hidden.value = String(allValue);
          updateLabel();
          render();
        },
        getValue: function(){ return String(hidden.value || ''); },
        findItem: function(v){ return data.find(x => String(x.id) === String(v)); },
      };

    search.addEventListener('input', render);
    toggle.addEventListener('shown.bs.dropdown', function(){
      setTimeout(() => { search.focus(); search.select(); }, 0);
    });
  }

  // Clients
  const clientItems = (Array.isArray(PACKAGES_PAGE_CONFIG.clients) ? PACKAGES_PAGE_CONFIG.clients : []).map(function(it){ it.search = norm(it.label); return it; });

  const cBox = document.getElementById('pkgClientFilterBox');
  if (cBox) {
    const hv = cBox.querySelector('input[type=hidden]');
    initCombobox(cBox, clientItems, (hv ? hv.value : '0'), '0', 'Tutti');
  }

  // Client package form: Cliente (required)
  const cpClientBox = document.getElementById('cpClientBox');
  if (cpClientBox) {
    const hv = cpClientBox.querySelector('input[type=hidden]');
    initCombobox(cpClientBox, clientItems, (hv ? hv.value : ''), '', 'Seleziona…');
  }

  // Package names
  const pkgItems = (Array.isArray(PACKAGES_PAGE_CONFIG.packageNames) ? PACKAGES_PAGE_CONFIG.packageNames : []).map(function(it){ it.search = norm(it.label); return it; });

  const pBox = document.getElementById('packageFilterBox');
  if (pBox) {
    const hv = pBox.querySelector('input[type=hidden]');
    initCombobox(pBox, pkgItems, (hv ? hv.value : ''), '', 'Tutti');
  }

  // Services (catalog create/edit)
  const serviceItems = (Array.isArray(PACKAGES_PAGE_CONFIG.services) ? PACKAGES_PAGE_CONFIG.services : []).map(function(it){ it.search = norm(it.label); return it; });

  // Products (catalog create/edit)
  const productItems = (Array.isArray(PACKAGES_PAGE_CONFIG.products) ? PACKAGES_PAGE_CONFIG.products : []).map(function(it){ it.search = norm(it.label); return it; });

  function toNum(v){
    const n = parseFloat(String(v || '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  function round2(n){ return Math.round((toNum(n) + Number.EPSILON) * 100) / 100; }
  function fmtMoney(n){ return round2(n).toFixed(2); }

  function recalcRow(row){
    if (!row) return;
    const qtyEl = row.querySelector('.js-pkg-qty');
    const unitEl = row.querySelector('.js-pkg-unit-price');
    const dtEl = row.querySelector('.js-pkg-discount-type');
    const dvEl = row.querySelector('.js-pkg-discount-value');
    const totEl = row.querySelector('.js-pkg-line-total');

    const qty = Math.max(1, parseInt((qtyEl && qtyEl.value) ? qtyEl.value : '1', 10) || 1);
    const unit = Math.max(0, toNum(unitEl ? unitEl.value : 0));
    const dt = String(dtEl && dtEl.value ? dtEl.value : 'percent');
    const dv = Math.max(0, toNum(dvEl ? dvEl.value : 0));

    const sub = qty * unit;
    let discAmt = (dt === 'amount') ? dv : (sub * (dv / 100));
    if (discAmt > sub) discAmt = sub;
    if (discAmt < 0) discAmt = 0;

    const total = sub - discAmt;
    if (totEl) totEl.value = fmtMoney(total);
  }

  function refreshPkgItemControls(){
    const rowsWrap = document.getElementById('pkgItemsRows');
    if (!rowsWrap) return;
    const rows = Array.from(rowsWrap.querySelectorAll('.pkg-item-row'));
    const canRemove = rows.length > 1;
    rows.forEach(function(row){
      const btn = row.querySelector('.js-pkg-item-remove');
      if (btn) btn.disabled = !canRemove;
    });
  }

  function recalcTotals(){
    const rowsWrap = document.getElementById('pkgItemsRows');
    if (!rowsWrap) return;
    let subtotal = 0;
    let srvQty = 0;
    let prdQty = 0;

    Array.from(rowsWrap.querySelectorAll('.pkg-item-row')).forEach(function(row){
      recalcRow(row);
      const t = String(row.getAttribute('data-item-type') || 'service');
      const qtyEl = row.querySelector('.js-pkg-qty');
      const q = Math.max(1, parseInt((qtyEl && qtyEl.value) ? qtyEl.value : '1', 10) || 1);
      if (t === 'service') srvQty += q;
      if (t === 'product') prdQty += q;

      const ltEl = row.querySelector('.js-pkg-line-total');
      subtotal += toNum(ltEl ? ltEl.value : 0);
    });

    subtotal = round2(subtotal);

    const subEl = document.getElementById('pkgSubtotal');
    if (subEl) subEl.value = fmtMoney(subtotal);

    const totalDtEl = document.getElementById('pkgTotalDiscountType');
    const totalDvEl = document.getElementById('pkgTotalDiscountValue');
    const grandEl = document.getElementById('pkgGrandTotal');

    const dt = String(totalDtEl && totalDtEl.value ? totalDtEl.value : 'percent');
    const dv = Math.max(0, toNum(totalDvEl ? totalDvEl.value : 0));
    let discAmt = (dt === 'amount') ? dv : (subtotal * (dv / 100));
    if (discAmt > subtotal) discAmt = subtotal;
    if (discAmt < 0) discAmt = 0;
    const total = round2(subtotal - discAmt);
    if (grandEl) grandEl.value = fmtMoney(total);

    const hint = document.getElementById('pkgItemsHint');
    if (hint) {
      const parts = [];
      if (srvQty > 0) parts.push('Sedute servizi: ' + String(srvQty));
      if (prdQty > 0) parts.push('Prodotti: ' + String(prdQty));
      hint.textContent = parts.join(' • ');
    }

    refreshPkgItemControls();
  }

  function initPkgItemRow(row){
    if (!row) return;
    const type = String(row.getAttribute('data-item-type') || 'service');
    const box = row.querySelector('.js-pkg-item-box');
    const hv = box ? box.querySelector('input[type=hidden]') : null;
    const items = (type === 'product') ? productItems : serviceItems;
    const allLabel = (type === 'product') ? 'Seleziona prodotto…' : 'Seleziona servizio…';

    if (box) {
      initCombobox(box, items, (hv ? hv.value : '0'), '0', allLabel, {
        onChange: function(it){
          const priceEl = row.querySelector('.js-pkg-unit-price');
          if (priceEl && it && it.price != null) {
            priceEl.value = fmtMoney(it.price);
          }
          recalcTotals();
        }
      });

      // On load, if selected item exists, ensure price is set
      try {
        if (box._appCombobox && hv && hv.value && hv.value !== '0') {
          const it = box._appCombobox.findItem(hv.value);
          const priceEl = row.querySelector('.js-pkg-unit-price');
          if (it && priceEl && (!priceEl.value || toNum(priceEl.value) === 0)) {
            priceEl.value = fmtMoney(it.price || 0);
          }
        }
      } catch(e) {}
    }

    recalcRow(row);
  }

  const pkgItemsWrap = document.getElementById('pkgItemsRows');
  if (pkgItemsWrap) {
    // Init existing rows
    pkgItemsWrap.querySelectorAll('.pkg-item-row').forEach(function(row){
      initPkgItemRow(row);
    });

    pkgItemsWrap.addEventListener('click', function(e){
      const btn = e.target.closest('.js-pkg-item-remove');
      if (!btn) return;
      const row = btn.closest('.pkg-item-row');
      if (row) row.remove();
      recalcTotals();
    });

    pkgItemsWrap.addEventListener('input', function(e){
      if (!e.target) return;
      if (e.target.classList && (e.target.classList.contains('js-pkg-qty') || e.target.classList.contains('js-pkg-discount-value'))) {
        recalcTotals();
      }
    });

    pkgItemsWrap.addEventListener('change', function(e){
      if (!e.target) return;
      if (e.target.classList && e.target.classList.contains('js-pkg-discount-type')) {
        recalcTotals();
      }
    });
  }

  const totalDiscTypeEl = document.getElementById('pkgTotalDiscountType');
  const totalDiscValEl = document.getElementById('pkgTotalDiscountValue');
  if (totalDiscTypeEl) totalDiscTypeEl.addEventListener('change', recalcTotals);
  if (totalDiscValEl) totalDiscValEl.addEventListener('input', recalcTotals);

  function addPkgRow(type){
    if (!pkgItemsWrap) return;
    const t = (type === 'product') ? 'product' : 'service';
    const placeholder = (t === 'product') ? 'Seleziona prodotto…' : 'Seleziona servizio…';

    const row = document.createElement('div');
    row.className = 'row g-2 align-items-end pkg-item-row mb-2';
    row.setAttribute('data-item-type', t);
    row.innerHTML = `
      <input type="hidden" name="pkg_item_type[]" value="${t}">
      <div class="col-md-4">
        <div class="app-combobox dropdown js-pkg-item-box">
          <button class="form-control text-start app-combobox-toggle dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
            <span class="app-combobox-text d-none"></span>
            <span class="app-combobox-placeholder text-muted">${placeholder}</span>
          </button>
          <div class="dropdown-menu p-2 w-100">
            <input type="text" class="form-control form-control-sm app-combobox-search" placeholder="Cerca…" autocomplete="off">
            <div class="app-combobox-list mt-2"></div>
          </div>
          <input type="hidden" name="pkg_item_id[]" value="0">
        </div>
      </div>
      <div class="col-md-1">
        <input class="form-control js-pkg-qty" type="number" min="1" step="1" name="pkg_qty[]" value="1">
      </div>
      <div class="col-md-2">
        <div class="input-group">
          <span class="input-group-text">€</span>
          <input class="form-control js-pkg-unit-price" type="number" min="0" step="0.01" name="pkg_unit_price[]" value="0.00" readonly>
        </div>
      </div>
      <div class="col-md-2">
        <div class="input-group">
          <select class="form-select js-pkg-discount-type" name="pkg_discount_type[]">
            <option value="percent" selected>%</option>
            <option value="amount">€</option>
          </select>
          <input class="form-control js-pkg-discount-value" type="number" min="0" step="0.01" name="pkg_discount_value[]" value="0.00">
        </div>
      </div>
      <div class="col-md-2">
        <div class="input-group">
          <span class="input-group-text">€</span>
          <input class="form-control js-pkg-line-total" type="number" min="0" step="0.01" name="pkg_line_total[]" value="0.00" readonly>
        </div>
      </div>
      <div class="col-md-1">
        <button type="button" class="btn btn-outline-danger w-100 js-pkg-item-remove" title="Rimuovi">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>
    `;
    pkgItemsWrap.appendChild(row);
    initPkgItemRow(row);
    recalcTotals();

    // focus search
    try {
      const search = row.querySelector('.app-combobox-search');
      if (search) search.focus();
    } catch(e) {}
  }

  const addSrvBtn = document.getElementById('pkgAddServiceBtn');
  if (addSrvBtn) addSrvBtn.addEventListener('click', function(){ addPkgRow('service'); });

  const addPrdBtn = document.getElementById('pkgAddProductBtn');
  if (addPrdBtn) {
    if (!productItems || productItems.length === 0) {
      addPrdBtn.disabled = true;
      addPrdBtn.title = 'Nessun prodotto disponibile in Magazzino';
    }
    addPrdBtn.addEventListener('click', function(){ addPkgRow('product'); });
  }

  recalcTotals();

  // Usage form (dettaglio pacchetto cliente): sedute servizi + ritiri prodotto
  const usageItems = Array.isArray(PACKAGES_PAGE_CONFIG.usageItems) ? PACKAGES_PAGE_CONFIG.usageItems : [];

  const usageItemEl = document.getElementById('packageUsageItemRef');
  const usageOpEl = document.getElementById('packageUsageOp');
  const usageQtyEl = document.getElementById('packageUsageQty');
  const usageUnitEl = document.getElementById('packageUsageUnit');
  const usageItemHelpEl = document.getElementById('packageUsageItemHelp');
  const usageOpHelpEl = document.getElementById('packageUsageOpHelp');
  const usageNoteEl = document.getElementById('packageUsageNote');
  const usageSubmitBtnEl = document.getElementById('packageUsageSubmitBtn');

  function usageSelectedItem(){
    if (!usageItems || usageItems.length === 0) return null;
    const ref = usageItemEl ? String(usageItemEl.value || '') : '';
    return usageItems.find(function(it){ return String(it.item_ref || '') === ref; }) || usageItems[0] || null;
  }

  function usageSetOptionText(selectEl, value, textValue){
    if (!selectEl) return;
    Array.from(selectEl.options || []).forEach(function(opt){
      if (String(opt.value || '') === String(value || '')) {
        opt.textContent = String(textValue || '');
      }
    });
  }

  function usageUpdateForm(){
    const item = usageSelectedItem();
    const type = item && String(item.type || '') === 'product' ? 'product' : 'service';
    const total = item ? Math.max(1, parseInt(item.qty_total || 0, 10) || 1) : 1;
    const remaining = item ? Math.max(0, Math.min(total, parseInt(item.qty_remaining || 0, 10) || 0)) : 0;
    const remainingBase = item ? Math.max(0, Math.min(total, parseInt(item.qty_remaining_base || item.qty_remaining || 0, 10) || 0)) : remaining;
    const reservedQty = item ? Math.max(0, Math.min(remainingBase, parseInt(item.reserved_qty || 0, 10) || 0)) : 0;
    const restoreAvailable = item
      ? Math.max(0, Math.min(total, parseInt(item.restore_available || (total - remainingBase), 10) || 0))
      : Math.max(0, total - remainingBase);
    const unitLabel = item && item.unit_label ? String(item.unit_label) : (type === 'product' ? 'pz' : 'sedute');
    const itemLabel = item && item.label ? String(item.label) : (type === 'product' ? 'Prodotto' : 'Servizio');
    const consumeLabel = type === 'product' ? 'Segna ritirato' : 'Scala';
    const restoreLabel = type === 'product' ? 'Ripristina ritiro' : 'Ripristina';

    usageSetOptionText(usageOpEl, 'consume', consumeLabel);
    usageSetOptionText(usageOpEl, 'restore', restoreLabel);

    if (usageUnitEl) usageUnitEl.textContent = unitLabel;
    if (usageNoteEl) usageNoteEl.placeholder = type === 'product' ? 'Es. prodotto ritirato / correzione' : 'Es. seduta effettuata / correzione';

    if (usageItemHelpEl) {
      const parts = [];
      const leading = type === 'product' ? 'Quantità disponibili' : 'Sedute disponibili';
      parts.push(itemLabel + ' • ' + leading + ': ' + String(remaining) + '/' + String(total) + ' ' + unitLabel);
      if (reservedQty > 0) {
        parts.push('In sospeso: ' + String(reservedQty) + ' ' + unitLabel);
      }
      parts.push('Ripristinabili: ' + String(restoreAvailable) + ' ' + unitLabel + '.');
      usageItemHelpEl.textContent = parts.join(' • ');
    }

    const currentOp = usageOpEl ? String(usageOpEl.value || 'consume') : 'consume';
    const maxQty = currentOp === 'restore' ? restoreAvailable : remaining;

    if (usageQtyEl) {
      usageQtyEl.min = '1';
      usageQtyEl.max = String(Math.max(1, maxQty));
      if (maxQty <= 0) {
        usageQtyEl.value = '1';
        usageQtyEl.disabled = true;
      } else {
        usageQtyEl.disabled = false;
        const curVal = parseInt(usageQtyEl.value || '1', 10) || 1;
        if (curVal > maxQty) usageQtyEl.value = String(maxQty);
        if (curVal < 1) usageQtyEl.value = '1';
      }
    }

    if (usageOpHelpEl) {
      if (type === 'product') {
        usageOpHelpEl.textContent = currentOp === 'restore'
          ? 'Ripristina ritiro = riaccredita il prodotto nel pacchetto e ricarica lo stock di magazzino.'
          : 'Segna ritirato = scala il prodotto dal pacchetto e scarica il magazzino.';
      } else {
        usageOpHelpEl.textContent = currentOp === 'restore'
          ? 'Ripristina = aumenta le sedute rimanenti del servizio selezionato.'
          : 'Scala = diminuisce le sedute rimanenti del servizio selezionato.';
      }
      if (maxQty <= 0) {
        usageOpHelpEl.textContent += ' Nessuna quantità disponibile per questa operazione.';
      }
    }

    if (usageSubmitBtnEl) usageSubmitBtnEl.disabled = !item || maxQty <= 0;
  }

  if (usageItemEl && usageOpEl) {
    usageItemEl.addEventListener('change', usageUpdateForm);
    usageOpEl.addEventListener('change', usageUpdateForm);
    usageUpdateForm();
  }

  // Client package form: Servizio (opzionale)
  const cpServiceBox = document.getElementById('cpServiceBox');
  if (cpServiceBox) {
    const hv = cpServiceBox.querySelector('input[type=hidden]');
    initCombobox(cpServiceBox, serviceItems, (hv ? hv.value : '0'), '0', '—');
  }

  // Client package form: Catalogo (opzionale)
  const catalogAllItems = (Array.isArray(PACKAGES_PAGE_CONFIG.catalogItems) ? PACKAGES_PAGE_CONFIG.catalogItems : []).map(function(it){ it.search = norm(it.label); return it; });

  function catalogItemsForSelectedLocation(){
    const sel = document.querySelector('#clientPackageForm select[name="location_id"]');
    const locId = sel ? parseInt(sel.value || '0', 10) || 0 : 0;
    if(!locId) return catalogAllItems;
    return catalogAllItems.filter(function(it){
      const ids = Array.isArray(it.location_ids) ? it.location_ids.map(function(v){ return parseInt(v || '0', 10) || 0; }).filter(Boolean) : [];
      return ids.length === 0 || ids.indexOf(locId) !== -1;
    });
  }

  function addDays(ymd, days){
    try {
      const d = new Date(String(ymd || '') + 'T00:00:00');
      if (Number.isNaN(d.getTime())) return '';
      d.setDate(d.getDate() + (parseInt(days, 10) || 0));
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth()+1).padStart(2,'0');
      const dd = String(d.getDate()).padStart(2,'0');
      return `${yyyy}-${mm}-${dd}`;
    } catch(e){ return ''; }
  }

  const packageDefaultValidityValue = parseInt(PACKAGES_PAGE_CONFIG.packageDefaultValidityValue || 0, 10) || 0;
  const packageDefaultValidityUnit = String(PACKAGES_PAGE_CONFIG.packageDefaultValidityUnit || 'days');

  function addMonthsClamped(ymd, months){
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim());
    if (!m) return '';
    let y = Number(m[1]);
    let mo = Number(m[2]);
    let d = Number(m[3]);
    let total = (y * 12) + (mo - 1) + (parseInt(months, 10) || 0);
    if (total < 0) total = 0;
    y = Math.floor(total / 12);
    mo = (total % 12) + 1;
    const dim = new Date(y, mo, 0).getDate();
    if (d > dim) d = dim;
    return `${String(y).padStart(4,'0')}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }

  function addPackageDuration(ymd, value, unit){
    const v = parseInt(value || '0', 10) || 0;
    if (v <= 0) return '';
    unit = String(unit || 'days').toLowerCase();
    if (unit === 'months') return addMonthsClamped(ymd, v);
    if (unit === 'years') return addMonthsClamped(ymd, v * 12);
    return addDays(ymd, v);
  }

  function catalogPackageExpiry(it, startYmd){
    const days = parseInt(it && it.validity_days || 0, 10) || 0;
    if (days > 0) return addPackageDuration(startYmd, days, 'days');
    return addPackageDuration(startYmd, packageDefaultValidityValue, packageDefaultValidityUnit);
  }

  const cpCatalogBox = document.getElementById('cpCatalogBox');
  if (cpCatalogBox) {
    const hv = cpCatalogBox.querySelector('input[type=hidden]');
    initCombobox(cpCatalogBox, catalogItemsForSelectedLocation(), (hv ? hv.value : '0'), '0', '— personalizzato —', {
      onChange: function(it, value){
        // Auto-fill fields when a catalog package is chosen
        if(!it || String(value || '') === '0') return;

        const name = document.getElementById('packageName');
        const tot = document.getElementById('sessionsTotal');
        const rem = document.getElementById('sessionsRemaining');
        const start = document.getElementById('startDate');
        const exp = document.getElementById('expiresAt');

        if (name) name.value = String(it.name || it.label || '');
        if (tot) tot.value = String(it.sessions_total || '');
        if (rem) rem.value = String(it.sessions_total || '');

        if (cpServiceBox && cpServiceBox._appCombobox && it.service_id && String(it.service_id) !== '0') {
          cpServiceBox._appCombobox.setValue(String(it.service_id));
        }

        if (exp && (!exp.value || String(exp.value).trim() === '') && start && start.value) {
          const autoExpiry = catalogPackageExpiry(it, start.value);
          if (autoExpiry) exp.value = autoExpiry;
        }
      }
    });
    const cpLocationSel = document.querySelector('#clientPackageForm select[name="location_id"]');
    if (cpLocationSel) {
      cpLocationSel.addEventListener('change', function(){
        if (cpCatalogBox._appCombobox) cpCatalogBox._appCombobox.setItems(catalogItemsForSelectedLocation());
      });
    }
  }
})();
