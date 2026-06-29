function resourcesReadJsonConfig(id) {
  var el = document.getElementById(id);
  if (!el) return {};
  try {
    return JSON.parse(el.textContent || '{}') || {};
  } catch (e) {
    return {};
  }
}

var RESOURCES_PAGE_CONFIG = resourcesReadJsonConfig('resourcesPageConfig');

(function(){
  var pendingPopup = RESOURCES_PAGE_CONFIG.pendingPopup || null;

  function safeParseServices(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function serviceLabel(svc) {
    var name = (svc && svc.service_name) ? String(svc.service_name) : 'Servizio';
    var qty = parseInt((svc && svc.qty_required) ? svc.qty_required : 1, 10);
    if (!Number.isFinite(qty) || qty < 1) qty = 1;
    return name + ' — quantità risorsa nel servizio: ' + qty;
  }

  function showResourceBlockPopup(title, message, services) {
    services = safeParseServices(services);
    var modalEl = document.getElementById('resourceBlockModal');
    var titleEl = document.getElementById('resourceBlockModalTitle');
    var msgEl = document.getElementById('resourceBlockModalMessage');
    var listEl = document.getElementById('resourceBlockServiceList');

    if (!modalEl || !titleEl || !msgEl || !listEl || typeof bootstrap === 'undefined' || !bootstrap.Modal) {
      var plain = (title || 'Operazione non consentita') + '\n\n' + (message || '') + '\n\n' + services.map(serviceLabel).join('\n');
      alert(plain);
      return;
    }

    titleEl.textContent = title || 'Operazione non consentita';
    msgEl.textContent = message || '';
    listEl.innerHTML = '';

    if (!services.length) {
      var empty = document.createElement('div');
      empty.className = 'text-muted small';
      empty.textContent = 'Nessun servizio rilevato.';
      listEl.appendChild(empty);
    } else {
      var accordion = document.createElement('div');
      accordion.className = 'accordion';
      accordion.id = 'resourceBlockServiceAccordion';
      var item = document.createElement('div');
      item.className = 'accordion-item border rounded-3 overflow-hidden mb-2';
      var header = document.createElement('h3');
      header.className = 'accordion-header';
      header.id = 'resourceBlockServiceHeading';
      var button = document.createElement('button');
      button.className = 'accordion-button collapsed bg-white shadow-none py-2';
      button.type = 'button';
      button.setAttribute('data-bs-toggle', 'collapse');
      button.setAttribute('data-bs-target', '#resourceBlockServiceCollapse');
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-controls', 'resourceBlockServiceCollapse');
      var label = document.createElement('span');
      label.className = 'd-flex align-items-center justify-content-between gap-2 w-100 pe-2';
      var titleSpan = document.createElement('span');
      titleSpan.className = 'fw-semibold';
      titleSpan.textContent = 'Servizi collegati';
      var badge = document.createElement('span');
      badge.className = 'badge rounded-pill text-bg-info';
      badge.textContent = String(services.length);
      label.appendChild(titleSpan);
      label.appendChild(badge);
      button.appendChild(label);
      header.appendChild(button);
      item.appendChild(header);
      var collapse = document.createElement('div');
      collapse.className = 'accordion-collapse collapse';
      collapse.id = 'resourceBlockServiceCollapse';
      collapse.setAttribute('aria-labelledby', 'resourceBlockServiceHeading');
      var body = document.createElement('div');
      body.className = 'accordion-body py-2';
      var list = document.createElement('div');
      list.className = 'list-group list-group-flush';
      services.forEach(function(svc){
        var row = document.createElement('div');
        row.className = 'list-group-item px-0';
        row.textContent = serviceLabel(svc);
        list.appendChild(row);
      });
      body.appendChild(list);
      collapse.appendChild(body);
      item.appendChild(collapse);
      accordion.appendChild(item);
      listEl.appendChild(accordion);
    }

    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  function resourcesConfirmDelete(el) {
    var services = safeParseServices(el ? el.getAttribute('data-resource-services') : '');
    if (services.length > 0) {
      showResourceBlockPopup(
        'Impossibile eliminare la risorsa',
        'La risorsa è associata ai servizi elencati. Elimina prima la risorsa dai servizi collegati: finché è presente in un servizio non può essere eliminata.',
        services
      );
      return false;
    }
    return confirm('Eliminare questa risorsa?');
  }

  document.querySelectorAll('[data-resource-delete]').forEach(function(el){
    el.addEventListener('click', function(e){
      if (!resourcesConfirmDelete(el)) e.preventDefault();
    });
  });

  document.addEventListener('DOMContentLoaded', function(){
    if (pendingPopup) {
      showResourceBlockPopup(pendingPopup.title, pendingPopup.message, pendingPopup.services || []);
    }

    var form = document.getElementById('resourceForm');
    var qtyInput = document.getElementById('resourceQtyTotal');
    if (!form || !qtyInput) return;

    document.addEventListener('change', function(e){
      var target = e.target;
      if (!target || !target.classList || !target.classList.contains('js-resource-location-enabled')) return;
      var lid = target.getAttribute('data-location');
      var qty = document.querySelector('.js-resource-location-qty[data-location="' + lid + '"]');
      if (!qty) return;
      qty.readOnly = !target.checked;
      if (target.checked && (!qty.value || parseInt(qty.value, 10) < 0)) qty.value = 0;
    });

    form.addEventListener('submit', function(e){
      var mode = form.getAttribute('data-mode') || '';
      if (mode !== 'edit') return;

      var currentQty = parseInt(form.getAttribute('data-current-qty') || '0', 10);
      var newQty = parseInt(qtyInput.value || '0', 10);
      if (!Number.isFinite(currentQty) || currentQty < 0) currentQty = 0;
      if (!Number.isFinite(newQty) || newQty < 0) newQty = 0;

      // L'aumento non richiede controlli. Se diminuisce, blocchiamo solo quando un servizio richiede più unità del nuovo totale.
      if (newQty >= currentQty) return;

      var linkedServices = safeParseServices(form.getAttribute('data-linked-services'));
      var blockingServices = linkedServices.filter(function(svc){
        var required = parseInt((svc && svc.qty_required) ? svc.qty_required : 1, 10);
        if (!Number.isFinite(required) || required < 1) required = 1;
        return required > newQty;
      });

      if (blockingServices.length > 0) {
        e.preventDefault();
        showResourceBlockPopup(
          'Quantità non modificabile',
          'La nuova quantità è inferiore alla quantità già impostata nei servizi elencati. Scala la risorsa dal servizio e rendila disponibile prima di modificare la quantità.',
          blockingServices
        );
      }
    });
  });
})();
