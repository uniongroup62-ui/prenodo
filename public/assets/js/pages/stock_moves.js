function stockMovesReadJsonConfig(id) {
  const el = document.getElementById(id);
  if (!el) return {};
  try {
    return JSON.parse(el.textContent || '{}') || {};
  } catch (e) {
    return {};
  }
}

const STOCK_MOVES_PAGE_CONFIG = stockMovesReadJsonConfig('stockMovesPageConfig');

document.addEventListener('submit', function (event) {
  const form = event.target && event.target.closest
    ? event.target.closest('[data-stock-moves-confirm]')
    : null;

  if (!form) return;

  const message = form.getAttribute('data-stock-moves-confirm') || 'Confermare questa operazione?';

  if (!window.confirm(message)) {
    event.preventDefault();
  }
});

document.querySelectorAll('[data-stock-print]').forEach(function(btn){
  btn.addEventListener('click', function(){
    try { window.print(); } catch (e) {}
  });
});

if (STOCK_MOVES_PAGE_CONFIG.autoPrint) {
  // Auto-open dialog di stampa (l'utente puo salvare in PDF dal browser)
  window.addEventListener('load', function(){
    try { window.print(); } catch (e) {}
  });
}

(function(){
  const products = Array.isArray(STOCK_MOVES_PAGE_CONFIG.formProducts) ? STOCK_MOVES_PAGE_CONFIG.formProducts : [];
  const items = [];

  const addBtn = document.getElementById('addItemBtn');
  const addQty = document.getElementById('addQty');
  const body = document.getElementById('itemsBody');

  function norm(s){ return String(s||'').toLowerCase().trim(); }
  function getProd(id){ return products.find(p => String(p.id) === String(id)); }

  // --- Product searchable combobox (nome + Codice prodotto) ---
  const productBox = document.querySelector('.js-product-box');
  const productToggle = productBox ? productBox.querySelector('.app-combobox-toggle') : null;
  const productHidden = document.getElementById('productId');
  const productSearch = productBox ? productBox.querySelector('.app-combobox-search') : null;
  const productList = productBox ? productBox.querySelector('.app-combobox-list') : null;
  const productTextEl = productToggle ? productToggle.querySelector('.app-combobox-text') : null;
  const productPlaceholderEl = productToggle ? productToggle.querySelector('.app-combobox-placeholder') : null;

  const productItems = (products || []).map(p => {
    const name = String(p.name || '');
    const sku = String(p.sku || '');
    const label = String(p.display_name || (sku ? (name + ' (' + sku + ')') : name)).trim();
    const search = norm(name + ' ' + sku + ' ' + label);
    return { id: String(p.id || ''), label: label || ('#' + String(p.id || '')), search };
  });

  function getBootstrapDropdown(toggleBtn){
    try{
      if(toggleBtn && window.bootstrap && window.bootstrap.Dropdown){
        return window.bootstrap.Dropdown.getOrCreateInstance(toggleBtn, { autoClose: true });
      }
    }catch(e){}
    return null;
  }

  function closeDropdown(toggleBtn){
    if(!toggleBtn) return;

    const dd = getBootstrapDropdown(toggleBtn);
    if(dd){
      try{ dd.hide(); }catch(e){}
      return;
    }

    const root = toggleBtn.closest('.app-combobox');
    const menu = root ? root.querySelector('.dropdown-menu') : null;

    if(menu) menu.classList.remove('show');
    if(root) root.classList.remove('show');
    toggleBtn.classList.remove('show');
    toggleBtn.setAttribute('aria-expanded', 'false');
  }

  function openDropdown(toggleBtn){
    if(!toggleBtn) return;

    // Close other open comboboxes (fallback & bootstrap-safe)
    document.querySelectorAll('.app-combobox .dropdown-menu.show').forEach(function (m) {
      const r = m.closest('.app-combobox');
      const t = r ? r.querySelector('.app-combobox-toggle') : null;
      if (t && t !== toggleBtn) closeDropdown(t);
    });

    const dd = getBootstrapDropdown(toggleBtn);
    if(dd){
      try{ dd.toggle(); }catch(e){
        try{ dd.show(); }catch(e2){}
      }
      return;
    }

    const root = toggleBtn.closest('.app-combobox');
    const menu = root ? root.querySelector('.dropdown-menu') : null;
    if(!root || !menu) return;

    const isShown = menu.classList.contains('show');
    if(isShown){
      closeDropdown(toggleBtn);
      return;
    }

    menu.classList.add('show');
    root.classList.add('show');
    toggleBtn.classList.add('show');
    toggleBtn.setAttribute('aria-expanded', 'true');
  }

  // One global outside-click close handler (for fallback mode)
  if (!window.__appComboboxOutsideClose) {
    window.__appComboboxOutsideClose = true;
    document.addEventListener('click', function (e) {
      document.querySelectorAll('.app-combobox .dropdown-menu.show').forEach(function (m) {
        const r = m.closest('.app-combobox');
        if (r && !r.contains(e.target)) {
          const t = r.querySelector('.app-combobox-toggle');
          if (t) closeDropdown(t);
        }
      });
    });
  }

  function setProduct(id, label){
    if(!productHidden || !productTextEl || !productPlaceholderEl) return;
    const val = String(id || '').trim();
    productHidden.value = val;

    if(val){
      productTextEl.textContent = String(label || '');
      productTextEl.style.display = '';
      productPlaceholderEl.style.display = 'none';
    }else{
      productTextEl.textContent = '';
      productTextEl.style.display = 'none';
      productPlaceholderEl.style.display = '';
    }
  }

  function getSelectedProductId(){
    return String(productHidden ? productHidden.value : '').trim();
  }

  function renderProductList(){
    if(!productList || !productSearch) return;

    const q = norm(productSearch.value);
    const out = [];
    const MAX = 300;

    for(const it of productItems){
      if(!it.id) continue;
      if(!q || it.search.indexOf(q) !== -1){
        out.push(it);
        if(out.length >= MAX) break;
      }
    }

    productList.innerHTML = '';
    if(!out.length){
      const empty = document.createElement('div');
      empty.className = 'list-group-item disabled text-muted';
      empty.textContent = 'Nessun risultato';
      productList.appendChild(empty);
      return;
    }

    const current = getSelectedProductId();
    out.forEach((it) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'list-group-item list-group-item-action';
      if(current && String(it.id) === String(current)) btn.classList.add('active');
      btn.textContent = it.label;
      btn.addEventListener('click', function () {
        setProduct(it.id, it.label);
        closeDropdown(productToggle);
      });
      productList.appendChild(btn);
    });
  }

  function focusProductSearch(){
    try{
      if(productSearch){
        productSearch.focus();
        productSearch.select();
      }
    }catch(e){}
  }

  function refreshProductDropdown(){
    if(productSearch) productSearch.value = '';
    renderProductList();
    focusProductSearch();
  }

  if(productBox && productToggle){
    // If Bootstrap dropdown is used, this event fires automatically; otherwise we still manage open ourselves.
    productBox.addEventListener('shown.bs.dropdown', function () {
      if(productToggle.disabled) return;
      refreshProductDropdown();
    });

    // Always manage open ourselves (works with or without Bootstrap JS)
    productToggle.addEventListener('click', function (e) {
      if(productToggle.disabled) return;
      e.preventDefault();
      e.stopPropagation(); // prevent Bootstrap delegated handler from double-toggling
      openDropdown(productToggle);
      setTimeout(refreshProductDropdown, 0);
    });
  }

  if(productSearch){
    productSearch.addEventListener('input', renderProductList);
    productSearch.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const first = productList ? productList.querySelector('.list-group-item-action:not(.disabled)') : null;
        if (first) first.click();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDropdown(productToggle);
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const first = productList ? productList.querySelector('.list-group-item-action:not(.disabled)') : null;
        if (first) first.focus();
      }
    });
  }

  if(productList){
    productList.addEventListener('keydown', function (e) {
      const active = document.activeElement;
      if (!active || !active.classList || !active.classList.contains('list-group-item-action')) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = active.nextElementSibling;
        if (next && next.classList.contains('list-group-item-action')) next.focus();
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = active.previousElementSibling;
        if (prev && prev.classList.contains('list-group-item-action')) prev.focus();
        else focusProductSearch();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDropdown(productToggle);
        if(productToggle) productToggle.focus();
      }
    });
  }

  const causeSelect = document.getElementById('causeSelect');
  const itemsHint = document.getElementById('itemsHint');
  const incomingHeadCells = document.querySelectorAll('[data-incoming-head]');

  function isCarico(){
    return !causeSelect || causeSelect.value === 'carico';
  }

  function syncIncomingVisibility(){
    const showIncoming = isCarico();
    incomingHeadCells.forEach(th => {
      th.style.display = showIncoming ? '' : 'none';
    });
    if(itemsHint){
      itemsHint.textContent = showIncoming
        ? 'Le righe gestiscono quantità e, per i carichi, anche il prodotto in arrivo.'
        : 'Le righe gestiscono solo la quantità per gli scarichi.';
    }
    if(!showIncoming){
      items.forEach(it => {
        it.incoming_flag = 0;
        it.incoming_qty = '';
        it.incoming_eta = '';
      });
    }
  }

  // Initial state
  setProduct('', '');
  syncIncomingVisibility();

  function render(){
    if(!body) return;
    const showIncoming = isCarico();
    body.innerHTML = '';
    if(items.length === 0){
      body.innerHTML = `<tr><td colspan="${showIncoming ? 7 : 4}" class="text-muted p-3">Nessun prodotto aggiunto.</td></tr>`;
      return;
    }

    items.forEach((it, idx) => {
      const p = getProd(it.product_id) || {name:'Prodotto', sku:'', supplier:'', display_name:'Prodotto'};
      const tr = document.createElement('tr');
      const allowZeroQty = !!(showIncoming && it.incoming_flag);

      tr.innerHTML = `
        <td class="fw-semibold">
          ${escapeHtml(p.display_name || p.name)}
          <input type="hidden" name="items[${idx}][product_id]" value="${escapeAttr(it.product_id)}">
        </td>
        <td class="text-muted">${escapeHtml(p.sku||'—')}</td>
        <td class="text-end">
          <input class="form-control form-control-sm" type="number" min="${allowZeroQty ? 0 : 1}" name="items[${idx}][qty]" value="${escapeAttr(it.qty)}" ${allowZeroQty ? '' : 'required'}>
        </td>
        ${showIncoming ? `
          <td>
            <div class="form-check">
              <input class="form-check-input" type="checkbox" id="inc_${idx}" name="items[${idx}][incoming_flag]" value="1" ${it.incoming_flag ? 'checked' : ''}>
              <label class="form-check-label" for="inc_${idx}">Prodotto in arrivo</label>
            </div>
          </td>
          <td>
            <input class="form-control form-control-sm" type="number" min="1" name="items[${idx}][incoming_qty]" value="${escapeAttr(it.incoming_qty||'')}" ${it.incoming_flag ? '' : 'disabled'} placeholder="Es. 24">
          </td>
          <td>
            <input class="form-control form-control-sm" type="date" name="items[${idx}][incoming_eta]" value="${escapeAttr(it.incoming_eta||'')}" ${it.incoming_flag ? '' : 'disabled'}>
          </td>
        ` : ''}
        <td class="text-end">
          <button class="btn btn-sm btn-outline-danger" type="button" data-rm="${idx}">Rimuovi</button>
        </td>
      `;

      body.appendChild(tr);
    });

    body.querySelectorAll('button[data-rm]').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.getAttribute('data-rm'), 10);
        if(!isNaN(i)){
          items.splice(i, 1);
          render();
        }
      });
    });

    if(showIncoming){
      body.querySelectorAll('input[type="checkbox"][id^="inc_"]').forEach(chk => {
        chk.addEventListener('change', () => {
          const idx = parseInt(chk.id.replace('inc_',''),10);
          if(isNaN(idx) || !items[idx]) return;
          items[idx].incoming_flag = chk.checked ? 1 : 0;
          if(!chk.checked){
            items[idx].incoming_qty = '';
            items[idx].incoming_eta = '';
          }
          render();
        });
      });
    }

    body.querySelectorAll('input[name$="[qty]"]').forEach(inp => {
      inp.addEventListener('input', () => {
        const m = inp.name.match(/items\[(\d+)\]\[qty\]/);
        if(!m) return;
        const idx = parseInt(m[1],10);
        if(isNaN(idx) || !items[idx]) return;
        const v = parseInt(inp.value,10);
        items[idx].qty = (!isNaN(v) && v>=0) ? v : 0;
      });
    });

    body.querySelectorAll('input[name$="[incoming_qty]"]').forEach(inp => {
      inp.addEventListener('input', () => {
        const m = inp.name.match(/items\[(\d+)\]\[incoming_qty\]/);
        if(!m) return;
        const idx = parseInt(m[1],10);
        if(isNaN(idx) || !items[idx]) return;
        const v = parseInt(inp.value,10);
        items[idx].incoming_qty = (!isNaN(v) && v>0) ? v : '';
      });
    });

    body.querySelectorAll('input[name$="[incoming_eta]"]').forEach(inp => {
      inp.addEventListener('change', () => {
        const m = inp.name.match(/items\[(\d+)\]\[incoming_eta\]/);
        if(!m) return;
        const idx = parseInt(m[1],10);
        if(isNaN(idx) || !items[idx]) return;
        items[idx].incoming_eta = inp.value || '';
      });
    });
  }

  function escapeHtml(str){
    return String(str||'')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }
  function escapeAttr(str){
    return escapeHtml(str);
  }

  function addSelected(){
    const pid = productHidden ? parseInt(productHidden.value, 10) : 0;
    const q = addQty ? parseInt(addQty.value, 10) : 1;
    if(!pid){ alert('Seleziona un prodotto'); return; }
    const qty = (!isNaN(q) && q >= 0) ? q : 1;
    const existing = items.find(x => String(x.product_id) === String(pid));
    if(existing){
      existing.qty += qty;
      render();
      return;
    }
    items.push({ product_id: pid, qty: qty, incoming_flag: 0, incoming_qty: '', incoming_eta: '' });
    render();
  }

  if(addBtn){ addBtn.addEventListener('click', addSelected); }
  if(causeSelect){
    causeSelect.addEventListener('change', () => {
      syncIncomingVisibility();
      render();
    });
  }

  // Prevent submit if no items
  const form = document.getElementById('stockDocForm');
  if(form){
    form.addEventListener('submit', (e) => {
      if(items.length === 0){
        e.preventDefault();
        alert('Aggiungi almeno un prodotto.');
      }
    });
  }

  // Default render
  render();
})();

(function(){
  function norm(s){ return String(s||'').toLowerCase().trim(); }

  function getBootstrapDropdown(toggleBtn){
    try{
      if(toggleBtn && window.bootstrap && window.bootstrap.Dropdown){
        return window.bootstrap.Dropdown.getOrCreateInstance(toggleBtn, { autoClose: true });
      }
    }catch(e){}
    return null;
  }

  function closeDropdown(toggleBtn){
    if(!toggleBtn) return;

    const dd = getBootstrapDropdown(toggleBtn);
    if(dd){
      try{ dd.hide(); }catch(e){}
      return;
    }

    const root = toggleBtn.closest('.app-combobox');
    const menu = root ? root.querySelector('.dropdown-menu') : null;

    if(menu) menu.classList.remove('show');
    if(root) root.classList.remove('show');
    toggleBtn.classList.remove('show');
    toggleBtn.setAttribute('aria-expanded', 'false');
  }

  function openDropdown(toggleBtn){
    if(!toggleBtn) return;

    // Close other open comboboxes (fallback & bootstrap-safe)
    document.querySelectorAll('.app-combobox .dropdown-menu.show').forEach(function (m) {
      const r = m.closest('.app-combobox');
      const t = r ? r.querySelector('.app-combobox-toggle') : null;
      if (t && t !== toggleBtn) closeDropdown(t);
    });

    const dd = getBootstrapDropdown(toggleBtn);
    if(dd){
      try{ dd.toggle(); }catch(e){
        try{ dd.show(); }catch(e2){}
      }
      return;
    }

    const root = toggleBtn.closest('.app-combobox');
    const menu = root ? root.querySelector('.dropdown-menu') : null;
    if(!root || !menu) return;

    const isShown = menu.classList.contains('show');
    if(isShown){
      closeDropdown(toggleBtn);
      return;
    }

    menu.classList.add('show');
    root.classList.add('show');
    toggleBtn.classList.add('show');
    toggleBtn.setAttribute('aria-expanded', 'true');
  }

  // One global outside-click close handler (for fallback mode)
  if (!window.__appComboboxOutsideClose) {
    window.__appComboboxOutsideClose = true;
    document.addEventListener('click', function (e) {
      document.querySelectorAll('.app-combobox .dropdown-menu.show').forEach(function (m) {
        const r = m.closest('.app-combobox');
        if (r && !r.contains(e.target)) {
          const t = r.querySelector('.app-combobox-toggle');
          if (t) closeDropdown(t);
        }
      });
    });
  }

  function initCombobox(boxEl, items, opts){
    if(!boxEl) return;

    const toggle = boxEl.querySelector('.app-combobox-toggle');
    const hidden = boxEl.querySelector('input[type="hidden"]');
    const search = boxEl.querySelector('.app-combobox-search');
    const list = boxEl.querySelector('.app-combobox-list');
    const textEl = toggle ? toggle.querySelector('.app-combobox-text') : null;
    const placeholderEl = toggle ? toggle.querySelector('.app-combobox-placeholder') : null;

    if(!toggle || !hidden || !search || !list || !textEl || !placeholderEl) return;

    const allValue = (opts && opts.allValue != null) ? String(opts.allValue) : '0';
    const allLabel = (opts && opts.allLabel != null) ? String(opts.allLabel) : 'Tutti';

    const allItem = { id: allValue, label: allLabel, search: norm(allLabel) };
    const itemList = [allItem].concat(Array.isArray(items) ? items : []);

    function setValue(id, label){
      hidden.value = String(id);
      textEl.textContent = String(label || '');
      textEl.style.display = '';
      placeholderEl.style.display = 'none';
    }

    function getValue(){
      return String(hidden.value || '').trim();
    }

    function findById(id){
      const sid = String(id || '');
      return itemList.find(it => String(it.id) === sid) || null;
    }

    function render(){
      const q = norm(search.value);
      const out = [];
      const MAX = 300;

      for(const it of itemList){
        if(!q || String(it.search || '').indexOf(q) !== -1){
          out.push(it);
          if(out.length >= MAX) break;
        }
      }

      list.innerHTML = '';
      if(!out.length){
        const empty = document.createElement('div');
        empty.className = 'list-group-item disabled text-muted';
        empty.textContent = 'Nessun risultato';
        list.appendChild(empty);
        return;
      }

      const current = getValue();
      out.forEach((it) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'list-group-item list-group-item-action';
        if(current && String(it.id) === String(current)) btn.classList.add('active');
        btn.textContent = it.label;
        btn.addEventListener('click', function () {
          setValue(it.id, it.label);
          closeDropdown(toggle);
        });
        list.appendChild(btn);
      });
    }

    function focusSearch(){
      try{
        search.focus();
        search.select();
      }catch(e){}
    }

    function refresh(){
      search.value = '';
      render();
      focusSearch();
    }

    boxEl.addEventListener('shown.bs.dropdown', function () {
      if(toggle.disabled) return;
      refresh();
    });

    toggle.addEventListener('click', function (e) {
      if(toggle.disabled) return;
      e.preventDefault();
      e.stopPropagation();
      openDropdown(toggle);
      setTimeout(refresh, 0);
    });

    search.addEventListener('input', render);
    search.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const first = list.querySelector('.list-group-item-action:not(.disabled)');
        if (first) first.click();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDropdown(toggle);
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const first = list.querySelector('.list-group-item-action:not(.disabled)');
        if (first) first.focus();
      }
    });

    list.addEventListener('keydown', function (e) {
      const active = document.activeElement;
      if (!active || !active.classList || !active.classList.contains('list-group-item-action')) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = active.nextElementSibling;
        if (next && next.classList.contains('list-group-item-action')) next.focus();
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = active.previousElementSibling;
        if (prev && prev.classList.contains('list-group-item-action')) prev.focus();
        else focusSearch();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDropdown(toggle);
        toggle.focus();
      }
    });

    // Init state
    let initVal = getValue();
    if (!initVal) initVal = allValue;
    const found = findById(initVal);
    if (found) setValue(found.id, found.label);
    else setValue(allValue, allLabel);
  }

  const products = Array.isArray(STOCK_MOVES_PAGE_CONFIG.filterProducts) ? STOCK_MOVES_PAGE_CONFIG.filterProducts : [];
  const suppliers = Array.isArray(STOCK_MOVES_PAGE_CONFIG.filterSuppliers) ? STOCK_MOVES_PAGE_CONFIG.filterSuppliers : [];

  const productItems = (products || []).map(p => {
    const name = String(p.name || '');
    const sku = String(p.sku || '');
    const label = String(p.display_name || (sku ? (name + ' (' + sku + ')') : name)).trim();
    return { id: String(p.id || ''), label: label || ('#' + String(p.id || '')), search: norm(name + ' ' + sku + ' ' + label) };
  });

  const supplierItems = (suppliers || []).map(s => {
    const label = String(s || '').trim();
    return { id: label, label: label, search: norm(label) };
  });

  initCombobox(document.querySelector('.js-filter-product-box'), productItems, { allValue: '0', allLabel: 'Tutti' });
  initCombobox(document.querySelector('.js-filter-supplier-box'), supplierItems, { allValue: '0', allLabel: 'Tutti' });
})();
