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

  function onReady(callback){
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
      return;
    }
    callback();
  }

  const form = document.getElementById('cabinsForm');
  const countEl = document.getElementById('cabinsCount');
  const wrap = document.getElementById('cabinsNamesWrap');

  if (!countEl || !wrap) return;

  const config = parseJsonScript('cabinPageConfig') || {};
  const initialCabins = Array.isArray(config.initialCabins) ? config.initialCabins : [];
  const pendingPopup = config.pendingPopup || null;
  const csrfToken = String(config.csrfToken || '');
  const selectedLocationId = String(config.selectedLocationId || '');
  const selectedLocationName = String(config.selectedLocationName || '');

  function clamp(value){
    let n = parseInt(value || '0', 10);
    if (isNaN(n) || n < 0) n = 0;
    if (n > 50) n = 50;
    return n;
  }

  function safeParseServices(raw){
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch(e) {
      return [];
    }
  }

  function serviceLabel(service){
    const serviceName = service && service.service_name ? String(service.service_name) : 'Servizio';
    const cabinName = service && service.cabin_name ? String(service.cabin_name) : 'Cabina';
    if (service && service.block_kind === 'appointment') {
      const detail = service.detail ? String(service.detail) : '';
      return cabinName + ' -> ' + serviceName + (detail ? ' - ' + detail : '');
    }
    const active = parseInt((service && service.service_active != null) ? service.service_active : 1, 10) === 1 ? 'Attivo' : 'Disattivo';
    return cabinName + ' → ' + serviceName + ' (' + active + ')';
  }

  function showCabinBlockPopup(title, message, services){
    services = safeParseServices(services);
    if (services.some(function(item){ return item && item.block_kind === 'appointment'; })) {
      message = 'La cabina e associata a servizi o prenotazioni future. Rimuovi prima i collegamenti o sposta le prenotazioni e poi riprova.';
    }

    const modalEl = document.getElementById('cabinDeleteBlockModal');
    const titleEl = document.getElementById('cabinDeleteBlockTitle');
    const msgEl = document.getElementById('cabinDeleteBlockMessage');
    const listEl = document.getElementById('cabinDeleteBlockServiceList');

    if (!modalEl || !titleEl || !msgEl || !listEl || !window.bootstrap || !window.bootstrap.Modal) {
      alert((title || 'Impossibile eliminare la cabina') + '\n\n' + (message || '') + '\n\n' + services.map(serviceLabel).join('\n'));
      return;
    }

    titleEl.textContent = title || 'Impossibile eliminare la cabina';
    msgEl.textContent = message || '';
    listEl.innerHTML = '';

    if (!services.length) {
      const empty = document.createElement('div');
      empty.className = 'text-muted small';
      empty.textContent = 'Sono presenti servizi associati.';
      listEl.appendChild(empty);
    } else {
      const accordion = document.createElement('div');
      accordion.className = 'accordion';
      accordion.id = 'cabinDeleteBlockServiceAccordion';

      const item = document.createElement('div');
      item.className = 'accordion-item border rounded-3 overflow-hidden mb-2';

      const header = document.createElement('h3');
      header.className = 'accordion-header';
      header.id = 'cabinDeleteBlockServiceHeading';

      const button = document.createElement('button');
      button.className = 'accordion-button collapsed bg-white shadow-none py-2';
      button.type = 'button';
      button.setAttribute('data-bs-toggle', 'collapse');
      button.setAttribute('data-bs-target', '#cabinDeleteBlockServiceCollapse');
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-controls', 'cabinDeleteBlockServiceCollapse');

      const label = document.createElement('span');
      label.className = 'd-flex align-items-center justify-content-between gap-2 w-100 pe-2';

      const titleSpan = document.createElement('span');
      titleSpan.className = 'fw-semibold';
      titleSpan.textContent = 'Servizi collegati';

      const badge = document.createElement('span');
      badge.className = 'badge rounded-pill text-bg-info';
      badge.textContent = String(services.length);

      label.appendChild(titleSpan);
      label.appendChild(badge);
      button.appendChild(label);
      header.appendChild(button);
      item.appendChild(header);

      const collapse = document.createElement('div');
      collapse.className = 'accordion-collapse collapse';
      collapse.id = 'cabinDeleteBlockServiceCollapse';
      collapse.setAttribute('aria-labelledby', 'cabinDeleteBlockServiceHeading');

      const body = document.createElement('div');
      body.className = 'accordion-body py-2';

      const list = document.createElement('div');
      list.className = 'list-group list-group-flush';
      services.forEach(function(service){
        const row = document.createElement('div');
        row.className = 'list-group-item px-0';
        row.textContent = serviceLabel(service);
        list.appendChild(row);
      });

      body.appendChild(list);
      collapse.appendChild(body);
      item.appendChild(collapse);
      accordion.appendChild(item);
      listEl.appendChild(accordion);
    }

    window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  function currentRenderedIds(){
    const ids = [];
    wrap.querySelectorAll('input[name="cabin_ids[]"]').forEach(function(input){
      const id = parseInt(input.value || '0', 10);
      if (Number.isFinite(id) && id > 0) ids.push(id);
    });
    return ids;
  }

  function getCurrentRows(){
    const map = {};
    wrap.querySelectorAll('[data-cabin-row]').forEach(function(row){
      const idx = parseInt(row.getAttribute('data-idx') || '0', 10);
      const idInput = row.querySelector('input[name="cabin_ids[]"]');
      const nameInput = row.querySelector('input[name="cabin_names[]"]');
      const servicesRaw = row.getAttribute('data-services') || '[]';
      map[idx] = {
        id: parseInt(idInput ? (idInput.value || '0') : '0', 10) || 0,
        name: nameInput ? nameInput.value : '',
        services: safeParseServices(servicesRaw)
      };
    });
    return map;
  }

  function initialById(id){
    id = parseInt(id || '0', 10);
    if (!id) return null;
    return initialCabins.find(function(cabin){
      return parseInt(cabin.id || '0', 10) === id;
    }) || null;
  }

  function render(){
    const count = clamp(countEl.value);
    countEl.value = count;

    const existing = getCurrentRows();
    wrap.innerHTML = '';

    if (count === 0) {
      const note = document.createElement('div');
      note.className = 'text-muted small';
      note.textContent = selectedLocationName
        ? 'Nessuna cabina configurata per ' + selectedLocationName + '. Imposta il numero di cabine e assegna un nome a ciascuna cabina.'
        : 'Nessuna cabina configurata. Imposta il numero di cabine e assegna un nome a ciascuna cabina.';
      wrap.appendChild(note);
      return;
    }

    const box = document.createElement('div');
    box.className = 'border rounded-3 p-3 bg-light';

    for (let i = 0; i < count; i++) {
      const idx = i;
      const fallback = initialCabins[idx] || {id: 0, name: '', services: []};
      const current = existing[idx] || fallback;
      const id = parseInt((current.id !== undefined ? current.id : fallback.id) || '0', 10) || 0;
      const initial = initialById(id) || fallback;
      const services = (initial && Array.isArray(initial.services)) ? initial.services : [];

      const row = document.createElement('div');
      row.className = 'mb-3';
      row.setAttribute('data-cabin-row', '1');
      row.setAttribute('data-idx', String(idx));
      row.setAttribute('data-services', JSON.stringify(services));

      const label = document.createElement('label');
      label.className = 'form-label mb-1';
      label.textContent = 'Nome cabina ' + (i + 1);

      const group = document.createElement('div');
      group.className = 'd-flex gap-2 align-items-start';

      const input = document.createElement('input');
      input.className = 'form-control';
      input.name = 'cabin_names[]';
      input.setAttribute('data-idx', String(idx));
      input.required = true;
      input.value = (current.name !== undefined) ? current.name : (fallback.name || '');

      const hiddenId = document.createElement('input');
      hiddenId.type = 'hidden';
      hiddenId.name = 'cabin_ids[]';
      hiddenId.value = String(id);

      group.appendChild(input);
      group.appendChild(hiddenId);

      if (id > 0) {
        const del = document.createElement('a');
        del.className = 'btn btn-outline-danger';
        del.href = 'index.php?page=cabins&action=delete&id=' + encodeURIComponent(String(id)) +
          (selectedLocationId ? '&location_id=' + encodeURIComponent(selectedLocationId) : '') +
          '&_csrf=' + encodeURIComponent(csrfToken);
        del.setAttribute('data-cabin-delete', '1');
        del.setAttribute('data-cabin-name', initial.name || input.value || 'Cabina');
        del.setAttribute('data-cabin-services', JSON.stringify(services));
        del.title = 'Elimina cabina';
        del.innerHTML = '<i class="bi bi-trash"></i>';
        del.onclick = function(){ return window.cabinConfirmDelete(del); };
        group.appendChild(del);
      } else {
        const delNew = document.createElement('button');
        delNew.type = 'button';
        delNew.className = 'btn btn-outline-danger';
        delNew.title = 'Rimuovi riga';
        delNew.innerHTML = '<i class="bi bi-trash"></i>';
        delNew.addEventListener('click', function(){
          countEl.value = Math.max(0, clamp(countEl.value) - 1);
          render();
        });
        group.appendChild(delNew);
      }

      row.appendChild(label);
      row.appendChild(group);
      box.appendChild(row);
    }

    wrap.appendChild(box);
  }

  window.cabinConfirmDelete = function(el){
    const services = safeParseServices(el ? el.getAttribute('data-cabin-services') : '[]');
    if (services.length > 0) {
      showCabinBlockPopup(
        'Impossibile eliminare la cabina',
        'La cabina è associata ai servizi elencati. Rimuovi prima la cabina dai servizi collegati: finché è presente in un servizio non può essere eliminata.',
        services
      );
      return false;
    }
    const name = el && el.getAttribute ? (el.getAttribute('data-cabin-name') || 'questa cabina') : 'questa cabina';
    return confirm('Eliminare ' + name + '? La cabina verrà rimossa dalla configurazione, ma lo storico già creato resterà invariato.');
  };

  countEl.addEventListener('input', render);

  if (form) {
    form.addEventListener('submit', function(event){
      const kept = new Set(currentRenderedIds());
      let blocking = [];
      initialCabins.forEach(function(cabin){
        const id = parseInt(cabin.id || '0', 10);
        if (id > 0 && !kept.has(id) && Array.isArray(cabin.services) && cabin.services.length > 0) {
          blocking = blocking.concat(cabin.services);
        }
      });
      if (blocking.length > 0) {
        event.preventDefault();
        showCabinBlockPopup(
          'Impossibile eliminare la cabina',
          'Una o più cabine che stai rimuovendo sono associate ai servizi elencati. Rimuovi prima la cabina dai servizi collegati e poi riprova.',
          blocking
        );
      }
    });
  }

  onReady(function(){
    if (pendingPopup) showCabinBlockPopup(pendingPopup.title, pendingPopup.message, pendingPopup.services || []);
  });

  render();
})();
