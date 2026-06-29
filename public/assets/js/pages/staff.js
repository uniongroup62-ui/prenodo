(function(){
  'use strict';

  var configEl = document.getElementById('staffPageConfig');
  var staffPageConfig = {};
  if (configEl) {
    try {
      var parsedConfig = JSON.parse(configEl.textContent || '{}');
      staffPageConfig = parsedConfig && typeof parsedConfig === 'object' ? parsedConfig : {};
    } catch (e) {
      staffPageConfig = {};
    }
  }

(function(){
  function initStaffPhotoCropper(){
    var input = document.getElementById('staffPhotoInput');
    var cropper = document.getElementById('staffPhotoCropper');
    var img = document.getElementById('staffPhotoCropImg');
    var placeholder = document.getElementById('staffPhotoPlaceholder');
    var zoom = document.getElementById('staffPhotoZoom');
    var centerBtn = document.getElementById('staffPhotoCenter');
    var cropData = document.getElementById('staffPhotoCropData');
    var removePhoto = document.getElementById('removeStaffPhoto');
    if (!input || !cropper || !img || !zoom || !centerBtn || !cropData) return;

    var MAX_SIZE = 5 * 1024 * 1024;
    var state = {
      active: false,
      src: '',
      naturalW: 0,
      naturalH: 0,
      baseScale: 1,
      zoom: 1,
      x: 0,
      y: 0,
      dragging: false,
      startX: 0,
      startY: 0,
      startOffsetX: 0,
      startOffsetY: 0
    };

    function viewportSize(){
      var r = cropper.getBoundingClientRect();
      var v = Math.max(1, Math.round(Math.min(r.width || 180, r.height || 180)));
      return v;
    }

    function clampOffsets(){
      var v = viewportSize();
      var scale = state.baseScale * state.zoom;
      var drawW = state.naturalW * scale;
      var drawH = state.naturalH * scale;
      var maxX = Math.max(0, (drawW - v) / 2);
      var maxY = Math.max(0, (drawH - v) / 2);
      state.x = Math.max(-maxX, Math.min(maxX, state.x));
      state.y = Math.max(-maxY, Math.min(maxY, state.y));
    }

    function updateHiddenCrop(){
      if (!state.active || !state.src || !state.naturalW || !state.naturalH) {
        cropData.value = '';
        return;
      }
      try {
        var v = viewportSize();
        var out = 512;
        var scale = state.baseScale * state.zoom;
        var ratio = out / v;
        var canvas = document.createElement('canvas');
        canvas.width = out;
        canvas.height = out;
        var ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, out, out);
        var dw = state.naturalW * scale * ratio;
        var dh = state.naturalH * scale * ratio;
        var dx = (out / 2) + (state.x * ratio) - (dw / 2);
        var dy = (out / 2) + (state.y * ratio) - (dh / 2);
        ctx.drawImage(img, dx, dy, dw, dh);
        cropData.value = canvas.toDataURL('image/jpeg', 0.88);
      } catch (e) {
        cropData.value = '';
      }
    }

    function render(){
      if (!state.active) return;
      clampOffsets();
      var v = viewportSize();
      var scale = state.baseScale * state.zoom;
      img.style.width = (state.naturalW * scale) + 'px';
      img.style.height = (state.naturalH * scale) + 'px';
      img.style.left = (v / 2 + state.x) + 'px';
      img.style.top = (v / 2 + state.y) + 'px';
      img.style.transform = 'translate(-50%, -50%)';
      img.classList.add('is-visible');
      cropper.classList.add('is-ready');
      if (placeholder) placeholder.style.display = 'none';
      zoom.disabled = false;
      centerBtn.disabled = false;
      updateHiddenCrop();
    }

    function centerImage(){
      if (!state.active) return;
      state.x = 0;
      state.y = 0;
      render();
    }

    function loadDataUrl(src){
      state.active = false;
      cropData.value = '';
      img.onload = function(){
        state.src = src;
        state.naturalW = img.naturalWidth || 1;
        state.naturalH = img.naturalHeight || 1;
        var v = viewportSize();
        state.baseScale = Math.max(v / state.naturalW, v / state.naturalH);
        state.zoom = 1;
        state.x = 0;
        state.y = 0;
        zoom.value = '1';
        state.active = true;
        render();
      };
      img.src = src;
    }

    input.addEventListener('change', function(){
      var file = input.files && input.files[0] ? input.files[0] : null;
      cropData.value = '';
      if (!file) return;
      if (file.size > MAX_SIZE) {
        alert('Immagine troppo grande: massimo 5 MB.');
        input.value = '';
        cropper.classList.remove('is-ready');
        return;
      }
      if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type || '')) {
        alert('Formato non valido: carica JPG, PNG, WEBP o GIF.');
        input.value = '';
        cropper.classList.remove('is-ready');
        return;
      }
      if (removePhoto) removePhoto.checked = false;
      var reader = new FileReader();
      reader.onload = function(e){ loadDataUrl(String(e.target && e.target.result || '')); };
      reader.readAsDataURL(file);
    });

    zoom.addEventListener('input', function(){
      if (!state.active) return;
      state.zoom = Math.max(1, Math.min(3, parseFloat(zoom.value || '1') || 1));
      render();
    });
    centerBtn.addEventListener('click', centerImage);

    cropper.addEventListener('pointerdown', function(e){
      if (!state.active) return;
      e.preventDefault();
      state.dragging = true;
      state.startX = e.clientX;
      state.startY = e.clientY;
      state.startOffsetX = state.x;
      state.startOffsetY = state.y;
      cropper.classList.add('is-dragging');
      try { cropper.setPointerCapture(e.pointerId); } catch (_) {}
    });
    cropper.addEventListener('pointermove', function(e){
      if (!state.dragging) return;
      state.x = state.startOffsetX + (e.clientX - state.startX);
      state.y = state.startOffsetY + (e.clientY - state.startY);
      render();
    });
    function endDrag(e){
      if (!state.dragging) return;
      state.dragging = false;
      cropper.classList.remove('is-dragging');
      try { cropper.releasePointerCapture(e.pointerId); } catch (_) {}
      updateHiddenCrop();
    }
    cropper.addEventListener('pointerup', endDrag);
    cropper.addEventListener('pointercancel', endDrag);
    cropper.addEventListener('pointerleave', function(e){ if (state.dragging) endDrag(e); });

    if (removePhoto) {
      removePhoto.addEventListener('change', function(){
        if (!removePhoto.checked) return;
        input.value = '';
        cropData.value = '';
      });
    }
  }

  document.addEventListener('DOMContentLoaded', initStaffPhotoCropper);
})();

(function(){
  function initStaffCreateModal(){
    var modalEl = document.getElementById('staffOperatorCreateModal');
    if (!modalEl) return;

    var shouldOpen = !!staffPageConfig.openCreateModal;
    var listUrl = staffPageConfig.listUrl || 'index.php?page=staff';

    if (shouldOpen && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }

    modalEl.addEventListener('hidden.bs.modal', function(){
      if (!shouldOpen || !listUrl || !window.history || !window.history.replaceState) return;
      window.history.replaceState({}, document.title, listUrl);
      shouldOpen = false;
      staffPageConfig.openCreateModal = false;
    });
  }

  document.addEventListener('DOMContentLoaded', initStaffCreateModal);
})();

(function(){
  var pendingStaffDeleteBlockPopup = staffPageConfig.deleteBlockPopup || null;

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
    var active = parseInt((svc && svc.service_active !== undefined) ? svc.service_active : 1, 10);
    return active === 1 ? name : (name + ' — non attivo');
  }

  document.addEventListener('click', function(event){
    var confirmEl = event.target && event.target.closest ? event.target.closest('[data-confirm]') : null;
    if (!confirmEl) return;
    var message = confirmEl.getAttribute('data-confirm') || 'Confermare?';
    if (!window.confirm(message)) event.preventDefault();
  });

  function showStaffDeleteBlockPopup(payload) {
    payload = payload || {};
    var services = safeParseServices(payload.services || []);
    var operatorName = payload.operator_name || payload.staff_name || 'Operatore';
    var message = payload.message || ("L'operatore non può essere eliminato perché è associato ai servizi elencati. Rimuovi prima l'operatore dai servizi collegati.");

    var modalEl = document.getElementById('staffDeleteBlockModal');
    var titleEl = document.getElementById('staffDeleteBlockModalTitle');
    var msgEl = document.getElementById('staffDeleteBlockModalMessage');
    var listEl = document.getElementById('staffDeleteBlockServiceList');

    if (!modalEl || !titleEl || !msgEl || !listEl || typeof bootstrap === 'undefined' || !bootstrap.Modal) {
      alert((payload.title || "Impossibile eliminare l'operatore") + '\n\n' + message + '\n\n' + services.map(serviceLabel).join('\n'));
      return;
    }

    titleEl.textContent = payload.title || "Impossibile eliminare l'operatore";
    msgEl.textContent = message.replace('L\'operatore', "L'operatore") + (operatorName ? ('\nOperatore: ' + operatorName) : '');
    listEl.innerHTML = '';

    if (!services.length) {
      var empty = document.createElement('div');
      empty.className = 'text-muted small';
      empty.textContent = 'Nessun servizio rilevato.';
      listEl.appendChild(empty);
    } else {
      var accordion = document.createElement('div');
      accordion.className = 'accordion';
      accordion.id = 'staffDeleteBlockServiceAccordion';
      var item = document.createElement('div');
      item.className = 'accordion-item border rounded-3 overflow-hidden mb-2';
      var header = document.createElement('h3');
      header.className = 'accordion-header';
      header.id = 'staffDeleteBlockServiceHeading';
      var button = document.createElement('button');
      button.className = 'accordion-button collapsed bg-white shadow-none py-2';
      button.type = 'button';
      button.setAttribute('data-bs-toggle', 'collapse');
      button.setAttribute('data-bs-target', '#staffDeleteBlockServiceCollapse');
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-controls', 'staffDeleteBlockServiceCollapse');
      var label = document.createElement('span');
      label.className = 'd-flex align-items-center justify-content-between gap-2 w-100 pe-2';
      var titleSpan = document.createElement('span');
      titleSpan.className = 'fw-semibold';
      titleSpan.textContent = 'Servizi associati';
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
      collapse.id = 'staffDeleteBlockServiceCollapse';
      collapse.setAttribute('aria-labelledby', 'staffDeleteBlockServiceHeading');
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

  function confirmStaffDelete(el) {
    var services = safeParseServices(el ? el.getAttribute('data-staff-services') : '');
    var staffName = el ? (el.getAttribute('data-staff-name') || 'Operatore') : 'Operatore';
    if (services.length > 0) {
      showStaffDeleteBlockPopup({
        operator_name: staffName,
        services: services,
        message: "L'operatore non può essere eliminato perché è associato ai servizi elencati. Rimuovi prima l'operatore dai servizi collegati."
      });
      return false;
    }
    return window.confirm('Eliminare questo operatore?');
  }

  document.addEventListener('click', function(event){
    var deleteEl = event.target && event.target.closest ? event.target.closest('[data-staff-delete]') : null;
    if (!deleteEl) return;
    if (!confirmStaffDelete(deleteEl)) event.preventDefault();
  });

  document.addEventListener('DOMContentLoaded', function(){
    if (pendingStaffDeleteBlockPopup) showStaffDeleteBlockPopup(pendingStaffDeleteBlockPopup);
  });
})();
})();
