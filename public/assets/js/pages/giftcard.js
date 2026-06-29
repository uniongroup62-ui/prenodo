(function () {
  var configEl = document.getElementById('giftcardPageConfig');
  var giftcardConfig = {};

  if (configEl) {
    try {
      giftcardConfig = JSON.parse(configEl.textContent || '{}') || {};
    } catch (e) {
      giftcardConfig = {};
    }
  }

  (function(){
    var toggle = document.getElementById('gcRecipientExistingToggle');
    var wrap = document.getElementById('gcRecipientExistingWrap');
    var hiddenId = document.getElementById('gcRecipientClientId');
    var nameInput = document.getElementById('gcRecipientName');
    var emailInput = document.getElementById('gcRecipientEmail');
    var searchInput = document.getElementById('gcRecipientSearch');
    var resultsBox = document.getElementById('gcRecipientResults');
    var selectedBox = document.getElementById('gcRecipientSelectedBox');
    var selectedName = document.getElementById('gcRecipientSelectedName');
    var selectedMeta = document.getElementById('gcRecipientSelectedMeta');
    var removeBtn = document.getElementById('gcRecipientRemoveBtn');
    var fidelityAlert = document.getElementById('gcRecipientFidelityAlert');
    var staticAlert = document.getElementById('gcRecipientFidelityAlertStatic');
    var searchWrap = document.getElementById('gcRecipientSearchWrap');
  
    if (!toggle || !wrap || !hiddenId || !nameInput || !emailInput || !searchInput || !resultsBox) return;
  
    // Email del cliente già selezionato (server-side), utile per lock iniziale campi.
    var initialSelectedEmail = String(giftcardConfig.initialSelectedEmail || '');
    var recipientLocked = !!giftcardConfig.recipientLocked;
  
    function showEl(el){
      if (!el) return;
      el.classList.remove('d-none');
      el.style.display = '';
    }
    function hideEl(el){
      if (!el) return;
      el.classList.add('d-none');
      el.style.display = '';
    }
  
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
  
    function clearResults(){ resultsBox.innerHTML = ''; }
  
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
  
      // Sblocco campi
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
        staticAlert.textContent = 'La GiftCard sarà associata al destinatario selezionato. Eventuali punti e omaggi della vendita resteranno accreditati solo al mittente (se aderisce alla Fidelity).';
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

  (function(){
    document.querySelectorAll('.js-gc-readonly-form input, .js-gc-readonly-form select, .js-gc-readonly-form textarea, .js-gc-readonly-form button').forEach(function(el){
      if (el && el.type !== 'hidden') el.disabled = true;
    });
  })();

  (function(){
    function gcFilterNorm(s) {
      try { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
      catch (e) { return String(s || '').toLowerCase().trim(); }
    }
  
    function gcInitFilterCombobox(boxEl, items, selectedId, allValue, allLabel) {
      if (!boxEl) return;
      const toggle = boxEl.querySelector('.app-combobox-toggle');
      const hidden = boxEl.querySelector('input[type="hidden"]');
      const search = boxEl.querySelector('.app-combobox-search');
      const list = boxEl.querySelector('.app-combobox-list');
      const textEl = boxEl.querySelector('.app-combobox-text');
      const placeholderEl = boxEl.querySelector('.app-combobox-placeholder');
      if (!toggle || !hidden || !search || !list || !textEl || !placeholderEl) return;
  
      const data = [{ id: String(allValue), label: String(allLabel), search: gcFilterNorm(allLabel) }].concat((items || []).map(function(it){
        return { id: String(it.id), label: String(it.label), search: gcFilterNorm(it.search || it.label) };
      }));
  
      function updateLabel() {
        const id = String(hidden.value || '');
        const it = data.find(function(x){ return String(x.id) === id; }) || null;
        if (it && id !== String(allValue)) {
          textEl.textContent = it.label;
          textEl.classList.remove('d-none');
          placeholderEl.classList.add('d-none');
        } else {
          textEl.textContent = '';
          textEl.classList.add('d-none');
          placeholderEl.classList.remove('d-none');
        }
      }
  
      function render() {
        const q = gcFilterNorm(search.value);
        list.innerHTML = '';
        let shown = 0;
        data.forEach(function(it){
          if (q && String(it.search || '').indexOf(q) === -1) return;
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'dropdown-item d-flex justify-content-between align-items-center';
          btn.textContent = it.label;
          btn.addEventListener('click', function(){
            hidden.value = String(it.id);
            updateLabel();
            try { bootstrap.Dropdown.getOrCreateInstance(toggle).hide(); } catch (e) {}
          });
          list.appendChild(btn);
          shown++;
        });
        if (!shown) {
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
        setTimeout(function(){ try { search.focus(); search.select(); } catch (e) {} }, 0);
      });
    }
  
    const clientItems = Array.isArray(giftcardConfig.filterClientItems) ? giftcardConfig.filterClientItems : [];
  
    gcInitFilterCombobox(
      document.getElementById('giftcardClientFilterBox'),
      clientItems,
      String(giftcardConfig.selectedFilterClientId || '0'),
      '0',
      'Tutti'
    );
  })();

      (function () {
        const clients = Array.isArray(giftcardConfig.clients) ? giftcardConfig.clients : [];
        const services = Array.isArray(giftcardConfig.services) ? giftcardConfig.services : [];
        const products = Array.isArray(giftcardConfig.products) ? giftcardConfig.products : [];
  
        function norm(s) {
          try {
            return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          } catch (e) {
            return (s || '').toString().toLowerCase();
          }
        }
  
        function initCombobox(boxEl, items, onSelect) {
          if (!boxEl) return;
          const toggle = boxEl.querySelector('.dropdown-toggle');
          const valEl = boxEl.querySelector('.app-combobox-value');
          const menu = boxEl.querySelector('.app-combobox-menu');
          const searchEl = boxEl.querySelector('.app-combobox-search');
          const listEl = boxEl.querySelector('.app-combobox-list');
          const textEl = boxEl.querySelector('.app-combobox-text');
          const placeholderEl = boxEl.querySelector('.app-combobox-placeholder');
  
          if (!toggle || !valEl || !menu || !searchEl || !listEl) return;
  
          const render = (filtered) => {
            listEl.innerHTML = '';
            filtered.forEach((it) => {
              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className = 'btn btn-sm btn-light w-100 text-start mb-1';
              btn.textContent = it.text;
              btn.addEventListener('click', () => {
                setSelected(it);
                try { bootstrap.Dropdown.getOrCreateInstance(toggle).hide(); } catch (e) {}
                if (typeof onSelect === 'function') onSelect(it.id);
              });
              listEl.appendChild(btn);
            });
            if (!filtered.length) {
              const div = document.createElement('div');
              div.className = 'text-muted small';
              div.textContent = 'Nessun risultato';
              listEl.appendChild(div);
            }
          };
  
          const setSelected = (it) => {
            const isZero = it && +it.id === 0;
            if (!it || isZero) {
              valEl.value = '0';
              if (textEl) textEl.classList.add('d-none');
              if (placeholderEl) placeholderEl.classList.remove('d-none');
              if (textEl) textEl.textContent = '';
              return;
            }
            valEl.value = String(it.id);
            if (placeholderEl) placeholderEl.classList.add('d-none');
            if (textEl) {
              textEl.classList.remove('d-none');
              textEl.textContent = it.text;
            }
          };
  
          const all = (items || []).map((it) => ({
            id: it.id,
            text: it.text,
            search: norm(it.search || it.text)
          }));
  
          render(all);
  
          searchEl.addEventListener('input', () => {
            const q = norm(searchEl.value);
            const filtered = !q ? all : all.filter((it) => it.search.includes(q));
            render(filtered);
          });
  
          // Reset search when opening
          toggle.addEventListener('click', () => {
            searchEl.value = '';
            render(all);
            setTimeout(() => { try { searchEl.focus(); } catch(e) {} }, 0);
          });
  
          // Init current value
          const cur = +valEl.value;
          if (cur > 0) {
            const found = all.find((it) => +it.id === cur);
            if (found) setSelected(found);
          }
        }
  
        // CLIENTE
        const clientBoxEl = document.getElementById('clientBox');
        if (clientBoxEl) {
          const clientIdEl = document.getElementById('clientId');
          const clientNameEl = document.getElementById('clientName');
          const clientEmailEl = document.getElementById('clientEmail');
          const clientPhoneEl = document.getElementById('clientPhone');
          const clientAddressEl = document.getElementById('clientAddress');
          const clientRegionEl = document.getElementById('clientRegion');
          const clientProvinceEl = document.getElementById('clientProvince');
          const clientCityEl = document.getElementById('clientCity');
          const clientCapEl = document.getElementById('clientCap');
          const clientLastNameEl = document.getElementById('clientLastName');
  
          function splitFullName(full) {
            full = String(full || '').trim();
            if (!full) return { first: '', last: '' };
            // Supporta anche formato "Cognome, Nome"
            if (full.indexOf(',') !== -1) {
              const parts = full.split(',');
              const last = String(parts[0] || '').trim();
              const first = String(parts.slice(1).join(',') || '').trim();
              return { first, last };
            }
            const parts = full.split(/\s+/).filter(Boolean);
            if (parts.length <= 1) return { first: parts[0] || '', last: '' };
            const last = parts.pop();
            const first = parts.join(' ');
            return { first, last };
          }
  
          const applyClient = (id) => {
            const cid = +id;
            if (!cid) return;
            const c = clients.find((x) => +x.id === cid);
            if (!c) return;
  
            // Nome / Cognome (usa first_name/last_name se presenti, altrimenti split di full_name)
            let first = String(c.first_name || '').trim();
            let last = String(c.last_name || '').trim();
            if (!first && !last) {
              const sp = splitFullName(c.full_name || '');
              first = sp.first;
              last = sp.last;
            }
            if (clientNameEl) clientNameEl.value = first || (c.full_name || '');
            if (clientLastNameEl) clientLastNameEl.value = last || '';
  
            if (clientEmailEl) clientEmailEl.value = c.email || '';
            if (clientPhoneEl) clientPhoneEl.value = c.phone || '';
            if (clientAddressEl) clientAddressEl.value = c.address || '';
            if (clientCapEl) clientCapEl.value = c.cap || '';
  if (clientRegionEl) {
              clientRegionEl.value = c.region || '';
              clientRegionEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
  
            // Province/città dopo che italy-geo ha popolato i dropdown
            setTimeout(() => {
              if (clientProvinceEl) {
                clientProvinceEl.value = c.province || '';
                clientProvinceEl.dispatchEvent(new Event('change', { bubbles: true }));
              }
              setTimeout(() => {
                if (clientCityEl) {
                  clientCityEl.value = c.city || '';
                  clientCityEl.dispatchEvent(new Event('change', { bubbles: true }));
                }
              }, 50);
            }, 80);
          };
  
          const clientItems = [
            ...clients.map((c) => ({
              id: c.id,
              text: c.full_name,
              search: [c.full_name, c.first_name, c.last_name, c.email, c.phone, c.company_name].filter(Boolean).join(' ')
            }))
          ];
  
          initCombobox(clientBoxEl, clientItems, (id) => {
            if (clientIdEl) clientIdEl.value = String(id);
            applyClient(id);
          });
  
          if (clientIdEl && +clientIdEl.value > 0) applyClient(+clientIdEl.value);
        }
  
        // LISTE DINAMICHE: SERVIZI / PRODOTTI
        const svcItems = [
          { id: 0, text: '— Nessun servizio —', search: '' },
          ...services.map((s) => ({ id: s.id, text: s.name, search: s.name }))
        ];
  
        const prdItems = [
          { id: 0, text: '— Nessun prodotto —', search: '' },
          ...products.map((p) => ({
            id: p.id,
            text: p.sku ? `${p.name} (${p.sku})` : p.name,
            search: [p.name, p.sku].filter(Boolean).join(' ')
          }))
        ];
  
        function clearItemRow(rowEl) {
          if (!rowEl) return;
          const valEl = rowEl.querySelector('.app-combobox-value');
          if (valEl) valEl.value = '0';
          const textEl = rowEl.querySelector('.app-combobox-text');
          const phEl = rowEl.querySelector('.app-combobox-placeholder');
          if (textEl) {
            textEl.textContent = '';
            textEl.classList.add('d-none');
          }
          if (phEl) phEl.classList.remove('d-none');
  
          const qtyEl = rowEl.querySelector('input[type="number"]');
          if (qtyEl) qtyEl.value = '1';
        }
  
        function setupDynamicList(opts) {
          const container = document.getElementById(opts.containerId);
          const addBtn = document.getElementById(opts.addBtnId);
          const tpl = document.getElementById(opts.tplId);
          if (!container || !addBtn || !tpl) return;
  
          const bindRow = (rowEl) => {
            if (!rowEl) return;
            // init combobox inside row
            const boxEl = rowEl.querySelector(opts.boxSelector);
            if (boxEl) initCombobox(boxEl, opts.items);
  
            const rm = rowEl.querySelector('.gc-remove-row');
            if (rm) {
              rm.addEventListener('click', () => {
                const rows = container.querySelectorAll('.gc-item-row');
                if (rows.length <= 1) {
                  clearItemRow(rowEl);
                  return;
                }
                rowEl.remove();
              });
            }
          };
  
          // Init existing rows
          container.querySelectorAll('.gc-item-row').forEach(bindRow);
  
          // Add row
          addBtn.addEventListener('click', () => {
            const el = tpl.content && tpl.content.firstElementChild
              ? tpl.content.firstElementChild.cloneNode(true)
              : null;
            if (!el) return;
            container.appendChild(el);
            bindRow(el);
          });
        }
  
        setupDynamicList({
          containerId: 'gcServiceRows',
          addBtnId: 'gcAddServiceRow',
          tplId: 'gcServiceRowTpl',
          boxSelector: '.gc-service-box',
          items: svcItems
        });
  
        setupDynamicList({
          containerId: 'gcProductRows',
          addBtnId: 'gcAddProductRow',
          tplId: 'gcProductRowTpl',
          boxSelector: '.gc-product-box',
          items: prdItems
        });
      })();
})();
