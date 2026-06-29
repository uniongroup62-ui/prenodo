(function(){
  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch] || ch;
    });
  }

  function norm(value){
    try {
      return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    } catch(e) {
      return String(value || '').toLowerCase().trim();
    }
  }

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

  function safeParseArray(raw){
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch(e) {
      return [];
    }
  }

  function showModalFallback(el, options){
    if (!el) return;
    if (window.bootstrap && window.bootstrap.Modal) {
      window.bootstrap.Modal.getOrCreateInstance(el, options || undefined).show();
      return;
    }
    el.style.display = 'block';
    el.classList.add('show');
  }

  function setHidden(el, hidden){
    if (!el) return;
    el.classList.toggle('d-none', !!hidden);
  }

  function initAutoSubmit(){
    document.addEventListener('change', function(event){
      const target = event.target;
      if (!target || !target.matches || !target.matches('[data-auto-submit]')) return;
      if (target.form) target.form.submit();
    });
  }

  function initDeleteConfirmHandlers(){
    document.addEventListener('click', function(event){
      const submitButton = event.target.closest('[data-confirm-submit-button]');
      if (submitButton) {
        const message = submitButton.getAttribute('data-confirm-submit-button') || 'Confermare?';
        if (!confirm(message)) event.preventDefault();
        return;
      }

      const categoryDelete = event.target.closest('[data-service-category-delete]');
      if (categoryDelete) {
        if (!window.serviceCategoryConfirmDelete(categoryDelete)) event.preventDefault();
        return;
      }

      const serviceDelete = event.target.closest('[data-service-delete]');
      if (serviceDelete && !window.servicesConfirmDelete(serviceDelete)) event.preventDefault();
    });
  }

  function initServiceOrderTable(){
    const table = document.getElementById('svcOrderTable');
    const input = document.getElementById('service_order');
    if (!table || !input) return;
    const refresh = function(){
      const ids = Array.from(table.querySelectorAll('tbody tr')).map(function(tr){
        return tr.getAttribute('data-id');
      });
      input.value = ids.join(',');
    };
    table.addEventListener('click', function(event){
      const btnUp = event.target.closest('.svc-up');
      const btnDown = event.target.closest('.svc-down');
      if (!btnUp && !btnDown) return;
      const tr = event.target.closest('tr');
      if (!tr) return;
      if (btnUp) {
        const prev = tr.previousElementSibling;
        if (prev) tr.parentNode.insertBefore(tr, prev);
      } else {
        const next = tr.nextElementSibling;
        if (next) tr.parentNode.insertBefore(next, tr);
      }
      refresh();
    });
  }

  function initServiceResourceChecks(){
    document.addEventListener('change', function(event){
      const target = event.target;
      if (!target || !target.classList || !target.classList.contains('js-resource-check')) return;
      const rid = target.getAttribute('data-res');
      const input = document.querySelector('.js-resource-qty[data-res="' + rid + '"]');
      if (!input) return;
      input.disabled = !target.checked;
      if (target.checked && (!input.value || parseInt(input.value, 10) < 1)) input.value = 1;
    });
  }

  function initServiceFormVisibility(){
    const cb = document.getElementById('svcNoOperator');
    const staffBox = document.getElementById('svcStaffBox');
    const note = document.getElementById('svcNoOperatorNote');
    const warning = document.getElementById('svcStaffLocationWarning');
    const cabinWarning = document.getElementById('svcCabinLocationWarning');
    const resourceWarning = document.getElementById('svcResourceLocationWarning');
    const locationChecks = Array.from(document.querySelectorAll('input[name="location_ids[]"]'));
    const cabinOptions = Array.from(document.querySelectorAll('[data-cabin-option="1"]'));
    const staffOptions = Array.from(document.querySelectorAll('[data-staff-option="1"]'));
    const resourceRows = Array.from(document.querySelectorAll('[data-resource-row="1"]'));
    const hasFormControls = cb || locationChecks.length || cabinOptions.length || staffOptions.length || resourceRows.length;
    if (!hasFormControls) return;

    function selectedLocations(){
      return locationChecks.filter(function(input){ return input.checked; }).map(function(input){
        const label = document.querySelector('label[for="' + input.id + '"]');
        return {
          id: String(input.value || ''),
          name: label ? label.textContent.trim() : ('Sede #' + input.value)
        };
      }).filter(function(location){ return location.id !== ''; });
    }

    function optionLocations(option){
      const raw = option ? String(option.getAttribute('data-locations') || '') : '';
      return raw.split(',').map(function(value){ return value.trim(); }).filter(Boolean);
    }

    function optionCovers(option, locationId){
      if (!option || option.getAttribute('data-global') === '1') return true;
      return optionLocations(option).indexOf(String(locationId)) !== -1;
    }

    function optionMatches(option, locations){
      if (!locations.length || !option || option.getAttribute('data-global') === '1') return true;
      for (let i = 0; i < locations.length; i++) {
        if (optionCovers(option, locations[i].id)) return true;
      }
      return false;
    }

    function renderMessages(target, messages){
      if (!target) return;
      if (!messages.length) {
        setHidden(target, true);
        target.innerHTML = '';
        return;
      }
      setHidden(target, false);
      target.innerHTML = messages.map(function(message){ return '<div>' + esc(message) + '</div>'; }).join('');
    }

    function parseResourceQty(row){
      if (!row) return {};
      try {
        const parsed = JSON.parse(row.getAttribute('data-resource-qty') || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch(e) {
        return {};
      }
    }

    function resourceMinQtyForLocations(row, locations){
      const qtyMap = parseResourceQty(row);
      const keys = Object.keys(qtyMap);
      if (!keys.length) {
        return { hasMap: false, qty: 0, compatible: false };
      }
      if (!locations.length) return { hasMap: true, qty: 0, compatible: true };
      let minQty = null;
      let compatible = true;
      locations.forEach(function(location){
        let qty = parseInt(qtyMap[String(location.id)] == null ? '0' : qtyMap[String(location.id)], 10);
        if (isNaN(qty) || qty < 0) qty = 0;
        minQty = (minQty === null) ? qty : Math.min(minQty, qty);
        if (qty <= 0) compatible = false;
      });
      return { hasMap: true, qty: Math.max(0, minQty == null ? 0 : minQty), compatible: compatible };
    }

    function renderAvailableCell(cell, qty){
      if (!cell) return;
      qty = parseInt(qty, 10);
      if (isNaN(qty) || qty <= 0) {
        cell.innerHTML = '<span class="badge text-bg-secondary">Non disponibile</span>';
      } else {
        cell.textContent = String(qty);
      }
    }

    function refreshStaffVisibility(){
      const noOperator = cb && cb.checked;
      setHidden(staffBox, noOperator);
      setHidden(note, !noOperator);
      if (noOperator) {
        renderMessages(warning, []);
        return;
      }

      const locations = selectedLocations();
      const coverage = {};
      const messages = [];
      locations.forEach(function(location){ coverage[location.id] = false; });

      staffOptions.forEach(function(option){
        const input = option.querySelector('input[type="checkbox"]');
        const compatible = optionMatches(option, locations);
        const checked = !!(input && input.checked);

        setHidden(option, !(compatible || checked));

        if (!compatible && checked) {
          messages.push('L\'operatore "' + String(option.getAttribute('data-staff-name') || 'Operatore') + '" non e disponibile in tutte le sedi selezionate: rimuovilo dal servizio o abilitalo in Operatori.');
        }
        if (compatible && checked) {
          locations.forEach(function(location){
            if (optionCovers(option, location.id)) coverage[location.id] = true;
          });
        }
      });

      if (!locations.length && locationChecks.length) {
        messages.push('Seleziona almeno una sede in cui il servizio sara disponibile.');
      }
      locations.forEach(function(location){
        if (!coverage[location.id]) {
          messages.push('Per la sede "' + location.name + '" manca almeno un operatore abilitato.');
        }
      });
      renderMessages(warning, messages);
    }

    function refreshCabinVisibility(){
      if (!cabinOptions.length) return;
      const locations = selectedLocations();
      const coverage = {};
      let visibleCount = 0;
      const messages = [];
      locations.forEach(function(location){ coverage[location.id] = false; });

      cabinOptions.forEach(function(option){
        const input = option.querySelector('input[type="checkbox"]');
        const compatible = optionMatches(option, locations);
        const checked = !!(input && input.checked);

        setHidden(option, !(compatible || checked));

        if (compatible || checked) visibleCount++;
        if (!compatible && checked) {
          messages.push('La cabina "' + String(option.getAttribute('data-cabin-name') || 'Cabina') + '" non e disponibile in tutte le sedi selezionate: rimuovila dal servizio o abilitala in Cabine.');
        }
        if (compatible && checked) {
          locations.forEach(function(location){
            if (optionCovers(option, location.id)) coverage[location.id] = true;
          });
        }
      });

      if (locations.length && visibleCount === 0) {
        messages.push('Nessuna cabina disponibile nelle sedi selezionate.');
      }
      locations.forEach(function(location){
        if (!coverage[location.id]) {
          messages.push('Per la sede "' + location.name + '" manca almeno una cabina abilitata.');
        }
      });
      renderMessages(cabinWarning, messages);
    }

    function refreshResourceVisibility(){
      if (!resourceRows.length) return;
      const locations = selectedLocations();
      let visibleCount = 0;
      const messages = [];

      resourceRows.forEach(function(row){
        const input = row.querySelector('.js-resource-check');
        const qtyInput = row.querySelector('.js-resource-qty');
        const cell = row.querySelector('[data-resource-available-cell="1"]');
        const info = resourceMinQtyForLocations(row, locations);
        const compatible = !locations.length || info.compatible;
        const checked = !!(input && input.checked);
        const keepVisible = compatible || checked;

        setHidden(row, !keepVisible);

        if (info.hasMap && locations.length) renderAvailableCell(cell, info.qty);
        if (qtyInput) {
          const maxQty = (info.qty > 0) ? info.qty : 1000000;
          qtyInput.setAttribute('max', String(maxQty));
          qtyInput.disabled = !(input && input.checked);
          if (input && input.checked && compatible) {
            let value = parseInt(qtyInput.value || '1', 10);
            if (isNaN(value) || value < 1) value = 1;
            if (info.hasMap && info.qty > 0 && value > info.qty) value = info.qty;
            qtyInput.value = String(value);
          }
        }

        if (compatible) visibleCount++;
        if (!compatible && checked) {
          messages.push('La risorsa "' + String(row.getAttribute('data-resource-name') || 'Risorsa') + '" non e disponibile in tutte le sedi selezionate: rimuovila dal servizio o abilitala in Risorse.');
        }
      });

      if (locations.length && resourceRows.length && visibleCount === 0) {
        messages.push('Nessuna risorsa disponibile in tutte le sedi selezionate.');
      }
      renderMessages(resourceWarning, messages);
    }

    if (cb) cb.addEventListener('change', refreshStaffVisibility);
    locationChecks.forEach(function(input){
      input.addEventListener('change', function(){
        refreshCabinVisibility();
        refreshStaffVisibility();
        refreshResourceVisibility();
      });
    });
    cabinOptions.forEach(function(option){
      const input = option.querySelector('input[type="checkbox"]');
      if (input) input.addEventListener('change', refreshCabinVisibility);
    });
    staffOptions.forEach(function(option){
      const input = option.querySelector('input[type="checkbox"]');
      if (input) input.addEventListener('change', refreshStaffVisibility);
    });
    resourceRows.forEach(function(row){
      const input = row.querySelector('.js-resource-check');
      const qtyInput = row.querySelector('.js-resource-qty');
      if (input) input.addEventListener('change', refreshResourceVisibility);
      if (qtyInput) qtyInput.addEventListener('input', refreshResourceVisibility);
    });
    refreshCabinVisibility();
    refreshStaffVisibility();
    refreshResourceVisibility();
  }

  function initAutoShowModals(){
    document.querySelectorAll('[data-service-autoshow-modal]').forEach(function(el){
      showModalFallback(el, { backdrop: 'static', keyboard: false });
    });
  }

  function initRecommendedCombobox(boxEl, items, allLabel, onChange, options){
    if (!boxEl) return null;
    const mode = options && options.mode ? String(options.mode) : 'recommended';
    const toggle = boxEl.querySelector('.app-combobox-toggle');
    const hidden = boxEl.querySelector('input[type="hidden"]');
    const search = boxEl.querySelector('.app-combobox-search');
    const list = boxEl.querySelector('.app-combobox-list');
    const textEl = boxEl.querySelector('.app-combobox-text');
    const placeholderEl = boxEl.querySelector('.app-combobox-placeholder');
    if (!toggle || !hidden || !search || !list || !textEl || !placeholderEl) return null;

    const data = [{ id: '', label: String(allLabel || 'Tutti'), meta: '', search: norm(allLabel || 'Tutti') }]
      .concat((items || []).map(function(item){
        const label = String(item && item.label ? item.label : '');
        const meta = String(item && item.meta ? item.meta : '');
        return {
          id: String(item && item.id != null ? item.id : ''),
          label: label,
          meta: meta,
          search: norm((item && item.search) || (label + ' ' + meta))
        };
      }));

    function updateLabel(){
      const id = String(hidden.value || '');
      const item = data.find(function(entry){ return String(entry.id) === id; }) || null;
      if (id && item && item.label) {
        textEl.textContent = item.label;
        textEl.classList.remove('d-none');
        placeholderEl.classList.add('d-none');
      } else {
        textEl.textContent = '';
        textEl.classList.add('d-none');
        placeholderEl.classList.remove('d-none');
      }
    }

    function setValue(value, trigger){
      hidden.value = String(value == null ? '' : value);
      updateLabel();
      if (trigger && typeof onChange === 'function') onChange(hidden.value);
    }

    function render(){
      const query = norm(search.value);
      list.innerHTML = '';
      let shown = 0;
      data.forEach(function(item){
        if (query && String(item.search || '').indexOf(query) === -1) return;
        const button = document.createElement('button');
        button.type = 'button';
        if (mode === 'simple') {
          button.className = 'dropdown-item d-flex justify-content-between align-items-center';
          button.textContent = item.label;
        } else {
          button.className = 'dropdown-item recommended-combobox-item';
          button.innerHTML =
            '<span class="recommended-combobox-label">' + esc(item.label) + '</span>' +
            (item.meta ? '<span class="recommended-combobox-meta">' + esc(item.meta) + '</span>' : '');
        }
        button.addEventListener('click', function(){
          setValue(item.id, true);
          search.value = '';
          render();
          try {
            if (window.bootstrap && window.bootstrap.Dropdown) {
              window.bootstrap.Dropdown.getOrCreateInstance(toggle).hide();
            }
          } catch(e) {}
        });
        list.appendChild(button);
        shown++;
      });
      if (!shown) {
        const empty = document.createElement('div');
        empty.className = 'text-muted small px-2 py-1';
        empty.textContent = 'Nessun risultato';
        list.appendChild(empty);
      }
    }

    hidden.value = String(hidden.value || '');
    updateLabel();
    render();
    search.addEventListener('input', render);
    toggle.addEventListener('shown.bs.dropdown', function(){
      search.value = '';
      render();
      setTimeout(function(){ try { search.focus(); search.select(); } catch(e) {} }, 0);
    });

    return {
      getValue: function(){ return String(hidden.value || ''); },
      setValue: function(value, trigger){ setValue(value, !!trigger); }
    };
  }

  function initRecommendedPageFilters(){
    const serviceCombobox = document.querySelector('[data-rec-page-service-combobox]');
    if (!serviceCombobox) return;
    const data = parseJsonScript('recommendedPageServiceFilterData') || {};
    const items = Array.isArray(data.items) ? data.items : [];
    initRecommendedCombobox(serviceCombobox, items, 'Tutti i servizi', null, { mode: 'simple' });
  }

  function initCategoryPageFilters(){
    const categoryCombobox = document.querySelector('[data-service-category-filter-combobox]');
    if (!categoryCombobox) return;
    const data = parseJsonScript('serviceCategoryFilterData') || {};
    const items = Array.isArray(data.items) ? data.items : [];
    initRecommendedCombobox(categoryCombobox, items, 'Tutte', null, { mode: 'simple' });
  }

  function initServiceListServiceFilter(){
    const serviceCombobox = document.querySelector('[data-service-list-service-filter-combobox]');
    if (!serviceCombobox) return;
    const data = parseJsonScript('serviceListServiceFilterData') || {};
    const items = Array.isArray(data.items) ? data.items : [];
    initRecommendedCombobox(serviceCombobox, items, 'Tutti i servizi', null, { mode: 'simple' });
  }

  function initRecommendedModals(){
    document.querySelectorAll('[data-rec-modal]').forEach(function(modal){
      const form = modal.querySelector('form');
      const hiddenBox = modal.querySelector('[data-rec-hidden-inputs]');
      const orderList = modal.querySelector('[data-rec-order-list]');
      const orderEmpty = modal.querySelector('[data-rec-order-empty]');
      const countBadge = modal.querySelector('[data-rec-count]');
      const serviceFilter = modal.querySelector('[data-rec-service-filter]');
      const serviceCombobox = modal.querySelector('[data-rec-service-combobox]');
      const options = Array.from(modal.querySelectorAll('[data-rec-option]'));
      const groups = Array.from(modal.querySelectorAll('[data-rec-group]'));
      const checkboxById = {};
      const optionById = {};
      const serviceFilterItems = [];
      let order = String(modal.getAttribute('data-rec-initial-order') || '')
        .split(',')
        .map(function(id){ return id.trim(); })
        .filter(Boolean);

      options.forEach(function(option){
        const id = String(option.getAttribute('data-rec-id') || '');
        const name = String(option.getAttribute('data-rec-name') || 'Servizio');
        const categoryLabel = String(option.getAttribute('data-rec-category-label') || '');
        if (id) {
          serviceFilterItems.push({
            id: id,
            label: name,
            meta: categoryLabel,
            search: option.getAttribute('data-rec-search') || (name + ' ' + categoryLabel)
          });
        }
        const checkbox = option.querySelector('[data-rec-checkbox]');
        if (!id || !checkbox) return;
        checkboxById[id] = checkbox;
        optionById[id] = option;
        checkbox.addEventListener('change', function(){
          if (checkbox.checked) {
            if (order.indexOf(id) === -1) order.push(id);
          } else {
            order = order.filter(function(item){ return item !== id; });
          }
          renderOrder();
        });
      });
      initRecommendedCombobox(serviceCombobox, serviceFilterItems, 'Tutti i servizi', filterOptions, { mode: 'simple' });

      function normalizeOrder(){
        const seen = {};
        order = order.filter(function(id){
          if (seen[id] || !checkboxById[id] || !checkboxById[id].checked) return false;
          seen[id] = true;
          return true;
        });
        options.forEach(function(option){
          const id = String(option.getAttribute('data-rec-id') || '');
          const checkbox = checkboxById[id];
          if (id && checkbox && checkbox.checked && order.indexOf(id) === -1) order.push(id);
        });
      }

      function syncHiddenInputs(){
        if (!hiddenBox) return;
        hiddenBox.innerHTML = '';
        order.forEach(function(id){
          if (!checkboxById[id] || !checkboxById[id].checked) return;
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = 'recommended_ids[]';
          input.value = id;
          hiddenBox.appendChild(input);
        });
      }

      function syncCount(){
        if (!countBadge) return;
        const total = order.length;
        countBadge.textContent = total + (total === 1 ? ' selezionato' : ' selezionati');
      }

      function moveId(id, direction){
        const index = order.indexOf(id);
        if (index === -1) return;
        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= order.length) return;
        const tmp = order[index];
        order[index] = order[nextIndex];
        order[nextIndex] = tmp;
        renderOrder();
      }

      function removeId(id){
        if (checkboxById[id]) checkboxById[id].checked = false;
        order = order.filter(function(item){ return item !== id; });
        renderOrder();
      }

      function renderOrder(){
        normalizeOrder();
        syncHiddenInputs();
        syncCount();
        if (!orderList) return;
        orderList.innerHTML = '';
        setHidden(orderEmpty, order.length > 0);

        order.forEach(function(id, index){
          const option = optionById[id];
          if (!option) return;
          const name = option.getAttribute('data-rec-name') || 'Servizio';
          const row = document.createElement('div');
          row.className = 'recommended-order-item';
          row.innerHTML =
            '<span class="recommended-order-index">' + (index + 1) + '</span>' +
            '<span class="recommended-order-name">' + esc(name) + '</span>' +
            '<span class="recommended-order-actions">' +
              '<button type="button" class="btn btn-sm btn-outline-secondary" data-rec-up title="Sposta su"><i class="bi bi-chevron-up"></i></button>' +
              '<button type="button" class="btn btn-sm btn-outline-secondary" data-rec-down title="Sposta giu"><i class="bi bi-chevron-down"></i></button>' +
              '<button type="button" class="btn btn-sm btn-outline-danger" data-rec-remove title="Rimuovi"><i class="bi bi-x-lg"></i></button>' +
            '</span>';
          const up = row.querySelector('[data-rec-up]');
          const down = row.querySelector('[data-rec-down]');
          const remove = row.querySelector('[data-rec-remove]');
          if (up) up.addEventListener('click', function(){ moveId(id, -1); });
          if (down) down.addEventListener('click', function(){ moveId(id, 1); });
          if (remove) remove.addEventListener('click', function(){ removeId(id); });
          if (up) up.disabled = index === 0;
          if (down) down.disabled = index === order.length - 1;
          orderList.appendChild(row);
        });
      }

      function filterOptions(){
        const serviceId = String(serviceFilter && serviceFilter.value ? serviceFilter.value : '');
        options.forEach(function(option){
          const optionId = String(option.getAttribute('data-rec-id') || '');
          const matchesService = !serviceId || optionId === serviceId;
          setHidden(option, !matchesService);
        });
        groups.forEach(function(group){
          const visible = Array.from(group.querySelectorAll('[data-rec-option]')).some(function(option){
            return !option.classList.contains('d-none');
          });
          setHidden(group, !visible);
        });
      }

      if (form) form.addEventListener('submit', function(){ renderOrder(); });
      renderOrder();
      filterOptions();
    });
  }

  function showCategoryBlockModal(payload){
    if (!payload) return;
    const el = document.getElementById('categoryDeleteBlockModal');
    if (!el) { alert('Categoria non eliminabile.'); return; }
    const subtitle = document.getElementById('categoryDeleteBlockSubtitle');
    const list = document.getElementById('categoryDeleteBlockList');
    const categoryName = payload.category_name || 'Categoria';
    const services = Array.isArray(payload.services) ? payload.services : [];
    if (subtitle) subtitle.textContent = 'Categoria: ' + categoryName;
    if (list) {
      if (!services.length) {
        list.innerHTML = '<div class="text-muted">Sono presenti servizi associati a questa categoria.</div>';
      } else {
        list.innerHTML = '<div class="accordion" id="categoryDeleteBlockAccordion">' +
          '<div class="accordion-item border rounded-3 overflow-hidden mb-2">' +
            '<h3 class="accordion-header" id="categoryDeleteBlockHeading">' +
              '<button class="accordion-button collapsed bg-white shadow-none py-2" type="button" data-bs-toggle="collapse" data-bs-target="#categoryDeleteBlockCollapse" aria-expanded="false" aria-controls="categoryDeleteBlockCollapse">' +
                '<span class="d-flex align-items-center justify-content-between gap-2 w-100 pe-2">' +
                  '<span class="fw-semibold">Servizi associati</span>' +
                  '<span class="badge rounded-pill text-bg-info">' + services.length + '</span>' +
                '</span>' +
              '</button>' +
            '</h3>' +
            '<div id="categoryDeleteBlockCollapse" class="accordion-collapse collapse" aria-labelledby="categoryDeleteBlockHeading">' +
              '<div class="accordion-body py-2">' +
                '<div class="list-group list-group-flush">' +
            services.map(function(svc){
              const name = svc && svc.name ? svc.name : 'Servizio';
              const state = svc && svc.active ? 'Attivo' : 'Disattivo';
              return '<div class="list-group-item px-0">' +
                '<div class="fw-semibold">' + esc(name) + '</div>' +
                '<div class="small text-muted">Stato: ' + esc(state) + '</div>' +
              '</div>';
            }).join('') +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
      }
    }
    showModalFallback(el);
  }

  window.serviceCategoryConfirmDelete = function(el){
    const services = safeParseArray(el && el.getAttribute ? el.getAttribute('data-category-services') : '[]');
    const name = el && el.getAttribute ? (el.getAttribute('data-category-name') || 'Categoria') : 'Categoria';
    if (services.length > 0) {
      showCategoryBlockModal({category_name: name, services: services});
      return false;
    }
    return confirm('Eliminare definitivamente questa categoria? Verra eliminata solo se non ha servizi associati.');
  };

  function groupItems(items){
    const groups = {};
    (items || []).forEach(function(item){
      const key = (item && item.group) ? String(item.group) : 'Associazioni';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item || {});
    });
    return groups;
  }

  function renderBlockers(items){
    const groups = groupItems(items);
    const names = Object.keys(groups);
    if (!names.length) return '<div class="text-muted">Nessuna associazione rilevata.</div>';
    return '<div class="accordion" id="serviceDeleteBlockAccordion">' + names.map(function(group, idx){
      const rows = groups[group];
      const headingId = 'serviceDeleteBlockHeading' + idx;
      const collapseId = 'serviceDeleteBlockCollapse' + idx;
      const list = rows.map(function(item){
        const title = item && item.title ? item.title : 'Elemento collegato';
        const detail = item && item.detail ? item.detail : '';
        return '<div class="list-group-item px-0">' +
          '<div class="fw-semibold">' + esc(title) + '</div>' +
          (detail ? '<div class="small text-muted">' + esc(detail) + '</div>' : '') +
          '</div>';
      }).join('');
      return '<div class="accordion-item border rounded-3 overflow-hidden mb-2">' +
        '<h3 class="accordion-header" id="' + headingId + '">' +
          '<button class="accordion-button collapsed bg-white shadow-none py-2" type="button" data-bs-toggle="collapse" data-bs-target="#' + collapseId + '" aria-expanded="false" aria-controls="' + collapseId + '">' +
            '<span class="d-flex align-items-center justify-content-between gap-2 w-100 pe-2">' +
              '<span class="fw-semibold">' + esc(group) + '</span>' +
              '<span class="badge rounded-pill text-bg-info">' + rows.length + '</span>' +
            '</span>' +
          '</button>' +
        '</h3>' +
        '<div id="' + collapseId + '" class="accordion-collapse collapse" aria-labelledby="' + headingId + '">' +
          '<div class="accordion-body py-2">' +
            '<div class="list-group list-group-flush">' + list + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  function showServiceBlockModal(serviceName, blockers){
    const el = document.getElementById('serviceDeleteBlockModal');
    if (!el) { alert('Servizio non eliminabile.'); return; }
    const subtitle = document.getElementById('serviceDeleteBlockSubtitle');
    const list = document.getElementById('serviceDeleteBlockList');
    if (subtitle) subtitle.textContent = serviceName ? ('Servizio: ' + serviceName) : '';
    if (list) list.innerHTML = renderBlockers(blockers || []);
    showModalFallback(el);
  }

  window.servicesConfirmDelete = function(el){
    const blockers = safeParseArray(el && el.getAttribute ? el.getAttribute('data-service-delete-blockers') : '[]');
    const name = el && el.getAttribute ? (el.getAttribute('data-service-name') || 'Servizio') : 'Servizio';
    if (blockers.length > 0) {
      showServiceBlockModal(name, blockers);
      return false;
    }
    return confirm('Eliminare definitivamente questo servizio? Lo storico gia creato rimarra invariato.');
  };

  document.addEventListener('DOMContentLoaded', function(){
    initAutoSubmit();
    initDeleteConfirmHandlers();
    initServiceOrderTable();
    initServiceResourceChecks();
    initServiceFormVisibility();
    initAutoShowModals();
    initServiceListServiceFilter();
    initCategoryPageFilters();
    initRecommendedPageFilters();
    initRecommendedModals();

    const pendingCategoryDeleteBlockPopup = parseJsonScript('serviceCategoryDeleteBlockPopup');
    if (pendingCategoryDeleteBlockPopup) showCategoryBlockModal(pendingCategoryDeleteBlockPopup);

    const pendingServiceDeleteBlockPopup = parseJsonScript('serviceDeleteBlockPopup');
    if (pendingServiceDeleteBlockPopup && pendingServiceDeleteBlockPopup.blockers && pendingServiceDeleteBlockPopup.blockers.length) {
      showServiceBlockModal(pendingServiceDeleteBlockPopup.service_name || 'Servizio', pendingServiceDeleteBlockPopup.blockers || []);
    }
  });
})();
