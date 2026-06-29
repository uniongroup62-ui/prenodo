(function () {
  'use strict';

  var configEl = document.getElementById('profiloTenantPageConfig');
  var profiloTenantConfig = {};

  if (configEl) {
    try {
      profiloTenantConfig = JSON.parse(configEl.textContent || '{}') || {};
    } catch (e) {
      profiloTenantConfig = {};
    }
  }

  document.addEventListener('submit', function (event) {
    if (!(event.target instanceof Element)) return;
    var form = event.target.closest('[data-confirm]');
    if (!form) return;

    var message = form.getAttribute('data-confirm') || 'Confermare?';
    if (!window.confirm(message)) event.preventDefault();
  });

  (function(){
    var csrfToken = String(profiloTenantConfig.csrfToken || '');
  
    function clamp(value) {
      value = Number(value);
      if (!Number.isFinite(value)) return 50;
      return Math.max(0, Math.min(100, Math.round(value)));
    }
  
    function applyPosition(preview, xInput, yInput) {
      if (!preview || !xInput || !yInput) return;
      var img = preview.querySelector('img');
      if (!img) return;
      img.style.objectPosition = clamp(xInput.value) + '% ' + clamp(yInput.value) + '%';
    }
  
    function bindPreview(preview) {
      var xInput = document.getElementById(preview.getAttribute('data-x-input') || '');
      var yInput = document.getElementById(preview.getAttribute('data-y-input') || '');
      if (!xInput || !yInput) return;
  
      var dragging = false;
  
      xInput.addEventListener('input', function(){ applyPosition(preview, xInput, yInput); });
      yInput.addEventListener('input', function(){ applyPosition(preview, xInput, yInput); });
  
      preview.addEventListener('pointerdown', function(e){
        if (!preview.querySelector('img')) return;
        dragging = true;
        preview.classList.add('is-dragging');
        try { preview.setPointerCapture(e.pointerId); } catch (_) {}
        updateFromPointer(e);
      });
  
      preview.addEventListener('pointermove', function(e){
        if (!dragging) return;
        updateFromPointer(e);
      });
  
      function stopDrag(e) {
        if (!dragging) return;
        dragging = false;
        preview.classList.remove('is-dragging');
        try { preview.releasePointerCapture(e.pointerId); } catch (_) {}
      }
  
      function updateFromPointer(e) {
        var rect = preview.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        xInput.value = clamp(((e.clientX - rect.left) / rect.width) * 100);
        yInput.value = clamp(((e.clientY - rect.top) / rect.height) * 100);
        applyPosition(preview, xInput, yInput);
      }
  
      preview.addEventListener('pointerup', stopDrag);
      preview.addEventListener('pointercancel', stopDrag);
      preview.addEventListener('pointerleave', stopDrag);
      applyPosition(preview, xInput, yInput);
    }
  
    document.querySelectorAll('[data-branding-position-preview]').forEach(bindPreview);
    document.querySelectorAll('[data-branding-position-reset]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var xInput = document.getElementById(btn.getAttribute('data-x-input') || '');
        var yInput = document.getElementById(btn.getAttribute('data-y-input') || '');
        if (!xInput || !yInput) return;
        xInput.value = '50';
        yInput.value = '50';
        document.querySelectorAll('[data-branding-position-preview]').forEach(function(preview){
          if (preview.getAttribute('data-x-input') === xInput.id) {
            applyPosition(preview, xInput, yInput);
          }
        });
      });
    });
  
    function escapeHtml(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  
    function cacheBust(url) {
      if (!url) return '';
      return url + (url.indexOf('?') === -1 ? '?' : '&') + 'v=' + Date.now();
    }
  
    function setImageVisibility(kind, hasImage) {
      document.querySelectorAll('[data-branding-visible-on-image="' + kind + '"]').forEach(function(el){
        el.classList.toggle('branding-image-hidden', !hasImage);
      });
      document.querySelectorAll('[data-branding-empty="' + kind + '"]').forEach(function(el){
        el.classList.toggle('branding-image-hidden', hasImage);
      });
      document.querySelectorAll('[data-branding-visible-without-image="' + kind + '"]').forEach(function(el){
        el.classList.toggle('branding-image-hidden', hasImage);
      });
    }
  
    function getBrandingPreview(kind) {
      return document.querySelector('[data-branding-position-preview][data-x-input="' + (kind === 'logo' ? 'logoPositionX' : 'coverPositionX') + '"]');
    }
  
    function previewHasImage(kind) {
      var preview = getBrandingPreview(kind);
      var img = preview ? preview.querySelector('img') : null;
      return !!(img && img.getAttribute('src'));
    }
  
    function bindBrandingImageState(kind, img) {
      if (!img || img.dataset.brandingStateBound === '1') return;
      img.dataset.brandingStateBound = '1';
      img.addEventListener('load', function(){
        setImageVisibility(kind, true);
      });
      img.addEventListener('error', function(){
        img.remove();
        setImageVisibility(kind, false);
      });
    }
  
    function refreshBrandingImage(kind, url, position) {
      var preview = getBrandingPreview(kind);
      var xInput = document.getElementById(kind === 'logo' ? 'logoPositionX' : 'coverPositionX');
      var yInput = document.getElementById(kind === 'logo' ? 'logoPositionY' : 'coverPositionY');
      var hasImage = !!url;
  
      setImageVisibility(kind, hasImage);
      if (!preview) return;
  
      var img = preview.querySelector('img');
      if (hasImage && !img) {
        img = document.createElement('img');
        img.alt = kind === 'logo' ? 'Logo attivita' : 'Immagine di copertina';
        preview.appendChild(img);
      }
  
      if (img) {
        if (hasImage) {
          bindBrandingImageState(kind, img);
          img.src = cacheBust(url);
        } else {
          img.remove();
        }
      }
  
      if (position && xInput && yInput) {
        xInput.value = String(clamp(position.x));
        yInput.value = String(clamp(position.y));
      }
      applyPosition(preview, xInput, yInput);
    }
  
    function applyBrandingPayload(payload) {
      if (!payload || typeof payload !== 'object') return;
      refreshBrandingImage('logo', payload.logo_url || '', payload.logo_position || null);
      refreshBrandingImage('cover', payload.cover_url || '', payload.cover_position || null);
    }
  
    ['logo', 'cover'].forEach(function(kind){
      var preview = getBrandingPreview(kind);
      var img = preview ? preview.querySelector('img') : null;
      bindBrandingImageState(kind, img);
      if (img && img.complete && img.naturalWidth === 0) {
        img.remove();
        setImageVisibility(kind, false);
        return;
      }
      setImageVisibility(kind, previewHasImage(kind));
    });
  
    var brandingPending = {
      logo: null,
      cover: null
    };
    var brandingUploading = {
      logo: false,
      cover: false
    };
  
    function formatFileSize(bytes) {
      var size = Number(bytes || 0);
      if (size <= 0) return '0 MB';
      return (size / 1048576).toFixed(1).replace('.', ',') + ' MB';
    }
  
    function showBrandingFeedback(kind, message, type) {
      var feedback = document.querySelector('[data-branding-feedback="' + kind + '"]');
      if (!feedback) return;
      var text = String(message || '');
      feedback.textContent = text;
      feedback.className = 'alert branding-feedback mb-3 ' + (text ? '' : 'd-none ') + 'alert-' + (type || 'success');
    }
  
    function clearBrandingPending(kind) {
      var pending = brandingPending[kind];
      if (pending && pending.url) URL.revokeObjectURL(pending.url);
      brandingPending[kind] = null;
      renderBrandingPending(kind);
    }
  
    function renderBrandingPending(kind) {
      var list = document.querySelector('[data-branding-upload-list="' + kind + '"]');
      var saveBtn = document.querySelector('[data-branding-save="' + kind + '"]');
      var selected = document.querySelector('[data-branding-selected="' + kind + '"]');
      var pending = brandingPending[kind];
      if (saveBtn) saveBtn.disabled = brandingUploading[kind] || !pending;
      if (selected) {
        selected.textContent = pending
          ? ((kind === 'logo' ? 'Logo pronto' : 'Copertina pronta') + ' - ' + formatFileSize(pending.file.size || 0))
          : (kind === 'logo' ? 'Nessun nuovo logo selezionato.' : 'Nessuna nuova copertina selezionata.');
      }
      if (!list) return;
      if (!pending) {
        list.innerHTML = '';
        return;
      }
      var thumbClass = kind === 'logo' ? ' branding-upload-row__thumb--logo' : '';
      list.innerHTML = ''
        + '<div class="branding-upload-row branding-upload-row--pending">'
        + '  <div class="branding-upload-row__thumb' + thumbClass + '"><img src="' + escapeHtml(pending.url || '') + '" alt="Anteprima ' + (kind === 'logo' ? 'logo' : 'copertina') + '"></div>'
        + '  <div class="branding-upload-row__body">'
        + '    <div class="d-flex align-items-center justify-content-between gap-2 mb-1">'
        + '      <span class="badge text-bg-warning">Da salvare</span>'
        + '      <button class="btn btn-outline-danger btn-sm" type="button" data-branding-clear="' + kind + '" title="Rimuovi anteprima"><i class="bi bi-x-lg"></i></button>'
        + '    </div>'
        + '    <div class="small fw-semibold branding-upload-row__name">' + escapeHtml(pending.file.name || 'file') + '</div>'
        + '    <div class="text-muted small">' + escapeHtml(formatFileSize(pending.file.size || 0)) + '</div>'
        + '  </div>'
        + '</div>';
    }
  
    function validateBrandingFile(kind, file) {
      if (!file) return 'File non valido.';
      if (file.size > 5242880) return 'File troppo grande: max 5 MB.';
      var logoOk = /^(image\/jpeg|image\/png)$/i.test(file.type || '') || /\.(jpe?g|png)$/i.test(file.name || '');
      var coverOk = /^(image\/jpeg|image\/png|image\/webp)$/i.test(file.type || '') || /\.(jpe?g|png|webp)$/i.test(file.name || '');
      if (kind === 'logo' && !logoOk) return 'Formato non valido: carica JPG o PNG.';
      if (kind === 'cover' && !coverOk) return 'Formato non valido: carica JPG, PNG o WEBP.';
      return '';
    }
  
    function setBrandingUploading(kind, isUploading) {
      brandingUploading[kind] = !!isUploading;
      var saveBtn = document.querySelector('[data-branding-save="' + kind + '"]');
      var dropzone = document.querySelector('[data-branding-uploader="' + kind + '"]');
      if (saveBtn) {
        if (!saveBtn.dataset.originalHtml) saveBtn.dataset.originalHtml = saveBtn.innerHTML;
        saveBtn.disabled = brandingUploading[kind] || !brandingPending[kind];
        saveBtn.innerHTML = brandingUploading[kind]
          ? '<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Salvataggio...'
          : saveBtn.dataset.originalHtml;
      }
      if (dropzone) dropzone.classList.toggle('is-disabled', brandingUploading[kind]);
    }
  
    function selectBrandingFile(kind, fileList) {
      if (previewHasImage(kind)) return;
      var files = Array.prototype.slice.call(fileList || []);
      if (!files.length) return;
      var file = files[0];
      var error = validateBrandingFile(kind, file);
      if (error) {
        showBrandingFeedback(kind, error, 'danger');
        return;
      }
      clearBrandingPending(kind);
      brandingPending[kind] = {
        file: file,
        url: URL.createObjectURL(file)
      };
      showBrandingFeedback(kind, '', 'success');
      renderBrandingPending(kind);
    }
  
    function submitBrandingUpload(kind, action, fieldName) {
      var pending = brandingPending[kind];
      if (!pending || !pending.file) {
        showBrandingFeedback(kind, kind === 'logo' ? 'Seleziona un logo da salvare.' : 'Seleziona una copertina da salvare.', 'danger');
        return;
      }
      var error = validateBrandingFile(kind, pending.file);
      if (error) {
        showBrandingFeedback(kind, error, 'danger');
        return;
      }
  
      var formData = new FormData();
      formData.append('_csrf', csrfToken);
      formData.append('ajax', '1');
      formData.append('action', action);
      formData.append(fieldName, pending.file, pending.file.name);
      setBrandingUploading(kind, true);
      showBrandingFeedback(kind, '', 'success');
  
      fetch('index.php?page=business_profile', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: formData
      }).then(function(response){
        return response.json().catch(function(){ return {}; }).then(function(payload){
          if (!response.ok || !payload.ok) {
            var errors = payload && Array.isArray(payload.errors) ? payload.errors : ['Salvataggio non riuscito.'];
            throw new Error(errors.join(' '));
          }
          return payload;
        });
      }).then(function(payload){
        clearBrandingPending(kind);
        applyBrandingPayload(payload);
        showBrandingFeedback(kind, payload.message || (kind === 'logo' ? 'Logo salvato' : 'Immagine di copertina salvata'), 'success');
      }).catch(function(error){
        showBrandingFeedback(kind, error && error.message ? error.message : 'Salvataggio non riuscito.', 'danger');
        renderBrandingPending(kind);
      }).finally(function(){
        setBrandingUploading(kind, false);
      });
    }
  
    function bindUploader(kind, action, fieldName) {
      var dropzone = document.querySelector('[data-branding-uploader="' + kind + '"]');
      var input = document.querySelector('[data-branding-file-input="' + kind + '"]');
      var saveBtn = document.querySelector('[data-branding-save="' + kind + '"]');
      var list = document.querySelector('[data-branding-upload-list="' + kind + '"]');
      if (!dropzone || !input || !list || !saveBtn) return;
  
      dropzone.addEventListener('click', function(){ input.click(); });
      input.addEventListener('change', function(){
        selectBrandingFile(kind, input.files);
        input.value = '';
      });
      saveBtn.addEventListener('click', function(){
        submitBrandingUpload(kind, action, fieldName);
      });
      list.addEventListener('click', function(e){
        var clearBtn = e.target.closest('[data-branding-clear="' + kind + '"]');
        if (!clearBtn) return;
        clearBrandingPending(kind);
        showBrandingFeedback(kind, '', 'success');
      });
  
      ['dragenter', 'dragover'].forEach(function(eventName){
        dropzone.addEventListener(eventName, function(e){
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add('is-dragover');
        });
      });
      ['dragleave', 'dragend', 'drop'].forEach(function(eventName){
        dropzone.addEventListener(eventName, function(e){
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove('is-dragover');
        });
      });
      dropzone.addEventListener('drop', function(e){
        selectBrandingFile(kind, e.dataTransfer ? e.dataTransfer.files : []);
      });
      renderBrandingPending(kind);
    }
  
    function postAjax(form) {
      var formData = new FormData(form);
      formData.append('ajax', '1');
      return fetch('index.php?page=business_profile', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: formData
      }).then(function(response){
        return response.json().catch(function(){ return {}; }).then(function(payload){
          if (!response.ok || !payload.ok) {
            var errors = payload && Array.isArray(payload.errors) ? payload.errors : ['Operazione non riuscita.'];
            throw new Error(errors.join(' '));
          }
          return payload;
        });
      });
    }
  
    function bindBrandingDeleteForms() {
      document.querySelectorAll('[data-branding-delete-form]').forEach(function(form){
        form.addEventListener('submit', function(e){
          if (e.defaultPrevented) return;
          e.preventDefault();
          var kind = form.getAttribute('data-branding-delete-form') || '';
          var btn = form.querySelector('button[type="submit"]');
          if (!kind || !btn) return;
          if (!btn.dataset.originalHtml) btn.dataset.originalHtml = btn.innerHTML;
          btn.disabled = true;
          btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Rimozione...';
          showBrandingFeedback(kind, '', 'success');
          postAjax(form).then(function(payload){
            clearBrandingPending(kind);
            applyBrandingPayload(payload);
            showBrandingFeedback(kind, payload.message || (kind === 'logo' ? 'Logo rimosso' : 'Immagine di copertina rimossa'), 'success');
          }).catch(function(error){
            showBrandingFeedback(kind, error && error.message ? error.message : 'Rimozione non riuscita.', 'danger');
          }).finally(function(){
            btn.disabled = false;
            btn.innerHTML = btn.dataset.originalHtml;
          });
        });
      });
    }
  
    bindUploader('logo', 'upload_logo', 'business_logo');
    bindUploader('cover', 'upload_cover', 'business_cover');
    bindBrandingDeleteForms();
  })();
})();
