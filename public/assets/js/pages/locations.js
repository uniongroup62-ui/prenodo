(function () {
  'use strict';

  var configEl = document.getElementById('locationsPageConfig');
  var locationsConfig = {};

  if (configEl) {
    try {
      locationsConfig = JSON.parse(configEl.textContent || '{}') || {};
    } catch (e) {
      locationsConfig = {};
    }
  }

  (function () {
    'use strict';
  
    const locationData = locationsConfig.locationData && typeof locationsConfig.locationData === 'object' ? locationsConfig.locationData : {};
    const locationDefaults = locationsConfig.locationDefaults && typeof locationsConfig.locationDefaults === 'object' ? locationsConfig.locationDefaults : {};
    const csrfToken = String(locationsConfig.csrfToken || '');
    const featureGates = locationsConfig.featureGates && typeof locationsConfig.featureGates === 'object' ? locationsConfig.featureGates : {};
    const bookingPublicAllowed = featureGates.bookingPublicAllowed !== false;
    const marketplacePublicAllowed = featureGates.marketplacePublicAllowed !== false;
    const unavailableMessage = String(featureGates.unavailableMessage || 'Funzione non disponibile per il tuo account');
    const modalEl = document.getElementById('locationModal');
    const form = document.getElementById('locationModalForm');
    const titleEl = document.getElementById('locationModalTitle');
    const subtitleEl = document.getElementById('locationModalSubtitle');
    const bookingEnabledInput = form ? form.elements.booking_enabled : null;
    const bookingMarketplaceWarning = document.getElementById('locationBookingMarketplaceWarning');
    const marketplaceModalEl = document.getElementById('locationMarketplaceModal');
    const marketplaceForm = document.getElementById('locationMarketplaceForm');
    const marketplaceTitleEl = document.getElementById('locationMarketplaceModalTitle');
    const marketplaceSubtitleEl = document.getElementById('locationMarketplaceModalSubtitle');
    const marketplaceLocationId = document.getElementById('locationMarketplaceLocationId');
    const marketplaceLocationName = document.getElementById('locationMarketplaceLocationName');
    const marketplaceLocationAddress = document.getElementById('locationMarketplaceLocationAddress');
    const marketplaceEnabled = document.getElementById('locationMarketplaceEnabled');
    const marketplaceVisibilityHelp = document.getElementById('locationMarketplaceVisibilityHelp');
    const marketplaceBookingDisabled = document.getElementById('locationMarketplaceBookingDisabled');
    const marketplaceSaveButton = document.getElementById('locationMarketplaceSaveButton');
    const activityCards = Array.prototype.slice.call(document.querySelectorAll('[data-activity-card]'));
    const activityCounter = document.getElementById('locationActivityCategoryCounter');
    const primaryActivityInput = document.getElementById('locationPrimaryActivityCategoryId');
    const activityOrderInput = document.getElementById('locationActivityCategoryOrder');
    const gallerySubtitleEl = document.getElementById('locationGalleryModalSubtitle');
    const galleryGrid = document.getElementById('locationGalleryGrid');
    const galleryEmpty = document.getElementById('locationGalleryEmpty');
    const galleryUploadForm = document.getElementById('locationGalleryUploadForm');
    const galleryUploadLocation = document.getElementById('locationGalleryUploadLocationId');
    const galleryDropzone = document.getElementById('locationGalleryDropzone');
    const galleryFileInput = document.getElementById('locationGalleryFileInput');
    const gallerySaveButton = document.getElementById('locationGallerySaveButton');
    const gallerySelectedFiles = document.getElementById('locationGallerySelectedFiles');
    const galleryFeedback = document.getElementById('locationGalleryFeedback');
    const galleryPendingWrap = document.getElementById('locationGalleryPendingWrap');
    const galleryPendingGrid = document.getElementById('locationGalleryPendingGrid');
    const galleryClearPending = document.getElementById('locationGalleryClearPending');
    let galleryPendingEntries = [];
    let galleryIsUploading = false;
    let currentLocationId = 0;
    let currentLocationMarketplaceWasVisible = false;
    let activitySelectionOrder = [];
    const bookingWarningText = bookingMarketplaceWarning ? String(bookingMarketplaceWarning.textContent || '').trim() : '';
  
    if (!modalEl || !form) return;

    function isTruthy(value) {
      return value === true || value === 1 || String(value) === '1';
    }
  
    function refreshBookingMarketplaceWarning() {
      if (!bookingMarketplaceWarning || !bookingEnabledInput) return;
      if (!bookingPublicAllowed) {
        bookingMarketplaceWarning.textContent = unavailableMessage;
        bookingMarketplaceWarning.classList.remove('d-none', 'alert-warning');
        bookingMarketplaceWarning.classList.add('alert-danger');
        return;
      }
      bookingMarketplaceWarning.textContent = bookingWarningText || 'Disattivando le prenotazioni online, la scheda puo restare accessibile ma i pulsanti Prenota non verranno mostrati.';
      bookingMarketplaceWarning.classList.remove('alert-danger');
      bookingMarketplaceWarning.classList.add('alert-warning');
      const shouldWarn = currentLocationId > 0
        && currentLocationMarketplaceWasVisible
        && !bookingEnabledInput.checked;
      bookingMarketplaceWarning.classList.toggle('d-none', !shouldWarn);
    }
  
    function escapeHtml(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  
    function asId(value) {
      const n = parseInt(String(value || '0'), 10);
      return Number.isFinite(n) ? n : 0;
    }
  
    function setControl(name, value) {
      const el = form.elements[name];
      if (!el) return;
      if (el.type === 'checkbox') {
        el.checked = String(value) === '1' || value === true || value === 1;
        return;
      }
      el.value = value == null ? '' : String(value);
      if (el.classList && (
        el.classList.contains('js-it-region')
        || el.classList.contains('js-it-province')
        || el.classList.contains('js-it-city')
      )) {
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  
    function locationGalleryCardHtml(image, index, total, locationId) {
      const id = asId(image && image.id ? image.id : 0);
      const url = image && image.url ? String(image.url) : '';
      const number = index + 1;
      return ''
        + '<div class="location-gallery-card">'
        + '  <div class="location-gallery-card__preview">'
        + (url
            ? '    <img src="' + escapeHtml(url) + '" alt="Foto gallery sede ' + number + '">'
            : '    <div class="h-100 d-flex align-items-center justify-content-center text-muted small">File non trovato</div>')
        + '  </div>'
        + '  <div class="location-gallery-card__body">'
        + '    <div class="small fw-bold mb-2">Foto ' + number + '</div>'
        + '    <div class="d-flex gap-1 flex-wrap">'
        + '      <form method="post" class="d-inline">'
        + '        <input type="hidden" name="_csrf" value="' + escapeHtml(csrfToken) + '">'
        + '        <input type="hidden" name="action" value="location_gallery_move">'
        + '        <input type="hidden" name="location_id" value="' + locationId + '">'
        + '        <input type="hidden" name="gallery_image_id" value="' + id + '">'
        + '        <input type="hidden" name="direction" value="up">'
        + '        <button class="btn btn-outline-secondary btn-sm" type="submit" title="Sposta su" ' + (index === 0 ? 'disabled' : '') + '><i class="bi bi-arrow-up"></i></button>'
        + '      </form>'
        + '      <form method="post" class="d-inline">'
        + '        <input type="hidden" name="_csrf" value="' + escapeHtml(csrfToken) + '">'
        + '        <input type="hidden" name="action" value="location_gallery_move">'
        + '        <input type="hidden" name="location_id" value="' + locationId + '">'
        + '        <input type="hidden" name="gallery_image_id" value="' + id + '">'
        + '        <input type="hidden" name="direction" value="down">'
        + '        <button class="btn btn-outline-secondary btn-sm" type="submit" title="Sposta giu" ' + (index === total - 1 ? 'disabled' : '') + '><i class="bi bi-arrow-down"></i></button>'
        + '      </form>'
        + '      <form method="post" class="d-inline ms-auto" data-location-gallery-delete-form="1">'
        + '        <input type="hidden" name="_csrf" value="' + escapeHtml(csrfToken) + '">'
        + '        <input type="hidden" name="action" value="location_gallery_delete">'
        + '        <input type="hidden" name="location_id" value="' + locationId + '">'
        + '        <input type="hidden" name="gallery_image_id" value="' + id + '">'
        + '        <button class="btn btn-outline-danger btn-sm" type="submit" title="Rimuovi"><i class="bi bi-trash3"></i></button>'
        + '      </form>'
        + '    </div>'
        + '  </div>'
        + '</div>';
    }
  
    function renderLocationGallery(row) {
      const locationId = asId(row && row.id ? row.id : 0);
      const images = locationId > 0 && Array.isArray(row.gallery_images) ? row.gallery_images : [];
      const locationName = row && row.name ? String(row.name) : 'Sede';
  
      if (gallerySubtitleEl) gallerySubtitleEl.textContent = 'Immagini mostrate nella scheda marketplace.';
      if (galleryUploadLocation) galleryUploadLocation.value = String(locationId);
      if (galleryGrid) {
        galleryGrid.innerHTML = images.map(function(image, index){ return locationGalleryCardHtml(image, index, images.length, locationId); }).join('');
      }
      if (galleryEmpty) {
        galleryEmpty.style.display = images.length === 0 ? '' : 'none';
        galleryEmpty.textContent = 'Nessuna foto gallery caricata per questa sede.';
      }
    }
  
    function formatGalleryFileSize(bytes) {
      const size = Number(bytes || 0);
      if (size <= 0) return '0 MB';
      return (size / 1048576).toFixed(1).replace('.', ',') + ' MB';
    }
  
    function syncGalleryFileInput() {
      if (!galleryFileInput) return false;
      try {
        const transfer = new DataTransfer();
        galleryPendingEntries.forEach(function (entry) {
          if (entry && entry.file) transfer.items.add(entry.file);
        });
        galleryFileInput.files = transfer.files;
        return true;
      } catch (_) {
        return galleryPendingEntries.length === 0;
      }
    }
  
    function renderGalleryPendingFiles() {
      syncGalleryFileInput();
      const count = galleryPendingEntries.length;
      if (gallerySaveButton) gallerySaveButton.disabled = galleryIsUploading || count === 0;
      if (galleryPendingWrap) galleryPendingWrap.classList.toggle('d-none', count === 0);
      if (galleryPendingGrid) {
        galleryPendingGrid.innerHTML = galleryPendingEntries.map(function (entry, index) {
          const file = entry.file || {};
          return ''
            + '<div class="location-gallery-card location-gallery-card--pending">'
            + '  <div class="location-gallery-card__preview">'
            + '    <img src="' + escapeHtml(entry.url || '') + '" alt="Anteprima foto gallery ' + (index + 1) + '">'
            + '  </div>'
            + '  <div class="location-gallery-card__body">'
            + '    <div class="d-flex align-items-center justify-content-between gap-2 mb-2">'
            + '      <span class="badge text-bg-warning">Da salvare</span>'
            + '      <button class="btn btn-outline-danger btn-sm" type="button" data-gallery-pending-remove="' + index + '" title="Rimuovi anteprima"><i class="bi bi-x-lg"></i></button>'
            + '    </div>'
            + '    <div class="location-gallery-card__meta">'
            + '      <span class="location-gallery-card__name">' + escapeHtml(file.name || 'Foto') + '</span>'
            + '      <span>' + escapeHtml(formatGalleryFileSize(file.size || 0)) + '</span>'
            + '    </div>'
            + '  </div>'
            + '</div>';
        }).join('');
      }
      if (!gallerySelectedFiles) return;
      if (count === 0) {
        gallerySelectedFiles.textContent = 'Nessuna nuova foto selezionata.';
        return;
      }
      const totalSize = galleryPendingEntries.reduce(function (sum, entry) {
        return sum + ((entry.file && entry.file.size) || 0);
      }, 0);
      const mb = totalSize > 0 ? ' - ' + formatGalleryFileSize(totalSize) + ' totali' : '';
      gallerySelectedFiles.textContent = count === 1 ? ('1 foto pronta' + mb) : (count + ' foto pronte' + mb);
    }
  
    function showGalleryFeedback(message, type) {
      if (!galleryFeedback) return;
      const text = String(message || '');
      galleryFeedback.textContent = text;
      galleryFeedback.className = 'alert mb-3 ' + (text ? '' : 'd-none ') + 'alert-' + (type || 'success');
    }
  
    function setGalleryUploading(isUploading) {
      galleryIsUploading = !!isUploading;
      if (gallerySaveButton) {
        if (!gallerySaveButton.dataset.originalHtml) {
          gallerySaveButton.dataset.originalHtml = gallerySaveButton.innerHTML;
        }
        gallerySaveButton.disabled = galleryIsUploading || galleryPendingEntries.length === 0;
        gallerySaveButton.innerHTML = galleryIsUploading
          ? '<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Salvataggio...'
          : gallerySaveButton.dataset.originalHtml;
      }
      if (galleryDropzone) galleryDropzone.classList.toggle('pe-none', galleryIsUploading);
    }
  
    function clearGalleryPendingFiles() {
      galleryPendingEntries.forEach(function (entry) {
        if (entry && entry.url) URL.revokeObjectURL(entry.url);
      });
      galleryPendingEntries = [];
      if (galleryFileInput) galleryFileInput.value = '';
      renderGalleryPendingFiles();
    }
  
    function addGalleryPendingFiles(fileList) {
      const files = Array.prototype.slice.call(fileList || []);
      if (!files.length) {
        renderGalleryPendingFiles();
        return;
      }
      showGalleryFeedback('', 'success');
      const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      const invalidFiles = [];
      files.forEach(function (file) {
        const typeOk = acceptedTypes.indexOf(file.type) !== -1 || /\.(jpe?g|png|webp)$/i.test(file.name || '');
        if (!typeOk) {
          invalidFiles.push(file.name || 'file');
          return;
        }
        if (file.size > 5242880) {
          invalidFiles.push((file.name || 'file') + ' supera 5 MB');
          return;
        }
        galleryPendingEntries.push({
          file: file,
          url: URL.createObjectURL(file)
        });
      });
      if (galleryFileInput) galleryFileInput.value = '';
      renderGalleryPendingFiles();
      if (invalidFiles.length) {
        alert('Alcune foto non sono state aggiunte: ' + invalidFiles.join(', ') + '.');
      }
    }

    function checkedActivityIdsFromDom() {
      return activityCards
        .map(function (card) {
          const checkbox = card.querySelector('[data-activity-checkbox]');
          return checkbox && checkbox.checked ? asId(checkbox.value) : 0;
        })
        .filter(function (id) { return id > 0; });
    }

    function selectedActivityIds() {
      const checked = checkedActivityIdsFromDom();
      const checkedSet = {};
      checked.forEach(function (id) {
        checkedSet[id] = true;
      });
      activitySelectionOrder = activitySelectionOrder.filter(function (id) {
        return !!checkedSet[id];
      });
      checked.forEach(function (id) {
        if (activitySelectionOrder.indexOf(id) === -1) activitySelectionOrder.push(id);
      });
      return activitySelectionOrder.slice();
    }

    function syncActivityCards() {
      const selected = selectedActivityIds();
      let primaryId = primaryActivityInput ? asId(primaryActivityInput.value) : 0;
      if (selected.length > 0 && selected.indexOf(primaryId) === -1) primaryId = selected[0];
      if (selected.length === 0) primaryId = 0;
      if (primaryActivityInput) primaryActivityInput.value = primaryId > 0 ? String(primaryId) : '0';
      activityCards.forEach(function (card) {
        const checkbox = card.querySelector('[data-activity-checkbox]');
        const badge = card.querySelector('[data-activity-badge]');
        const id = checkbox ? asId(checkbox.value) : 0;
        const checked = !!(checkbox && checkbox.checked);
        card.classList.toggle('is-selected', checked);
        if (badge) {
          if (!checked) {
            badge.textContent = '';
          } else if (id === primaryId) {
            badge.textContent = 'Principale';
          } else {
            const position = selected.indexOf(id) + 1;
            badge.textContent = position > 0 ? String(position) : '';
          }
        }
      });
      if (activityCounter) activityCounter.textContent = selected.length + '/5';
      if (activityOrderInput) activityOrderInput.value = selected.join(',');
    }

    function setActivitySelection(ids, primaryId) {
      const selectedSet = {};
      activitySelectionOrder = [];
      (Array.isArray(ids) ? ids : []).forEach(function (id) {
        id = asId(id);
        if (id > 0 && !selectedSet[id]) {
          selectedSet[id] = true;
          activitySelectionOrder.push(id);
        }
      });
      activityCards.forEach(function (card) {
        const checkbox = card.querySelector('[data-activity-checkbox]');
        if (!checkbox) return;
        checkbox.checked = !!selectedSet[asId(checkbox.value)];
      });
      if (primaryActivityInput) primaryActivityInput.value = String(asId(primaryId));
      syncActivityCards();
    }
  
    function fillMarketplaceModal(row) {
      const data = Object.assign({}, locationDefaults, row || {});
      const locationId = asId(data.id);
      const locationName = data && data.name ? String(data.name) : 'Sede';
      const locationAddress = data && data.address ? String(data.address) : '';
      if (marketplaceTitleEl) marketplaceTitleEl.textContent = 'Marketplace sede';
      if (marketplaceSubtitleEl) marketplaceSubtitleEl.textContent = '';
      if (marketplaceLocationId) marketplaceLocationId.value = String(locationId);
      if (marketplaceLocationName) marketplaceLocationName.textContent = locationName;
      if (marketplaceLocationAddress) {
        marketplaceLocationAddress.textContent = locationAddress;
        marketplaceLocationAddress.style.display = locationAddress ? '' : 'none';
      }
      if (marketplaceEnabled) {
        marketplaceEnabled.checked = marketplacePublicAllowed && isTruthy(data.marketplace_enabled == null ? 1 : data.marketplace_enabled);
        marketplaceEnabled.disabled = !marketplacePublicAllowed;
      }
      if (marketplaceVisibilityHelp) {
        marketplaceVisibilityHelp.textContent = marketplacePublicAllowed ? 'Visualizza o nasconde la sede nel marketplace' : unavailableMessage;
        marketplaceVisibilityHelp.classList.toggle('text-danger', !marketplacePublicAllowed);
      }
      if (marketplaceSaveButton) marketplaceSaveButton.disabled = false;
      if (marketplaceBookingDisabled) marketplaceBookingDisabled.classList.add('d-none');
      setActivitySelection(data.activity_category_ids || [], data.primary_activity_category_id || 0);
      clearGalleryPendingFiles();
      showGalleryFeedback('', 'success');
      renderLocationGallery(data);
    }
  
    function fillForm(row, mode) {
      const data = Object.assign({}, locationDefaults, row || {});
      currentLocationId = asId(data.id);
      currentLocationMarketplaceWasVisible = String(data.marketplace_enabled == null ? 1 : data.marketplace_enabled) === '1';
      form.reset();
      Object.keys(locationDefaults).forEach(function (name) {
        setControl(name, data[name]);
      });
      setControl('id', currentLocationId);
      setControl('booking_enabled', data.booking_enabled == null ? 1 : data.booking_enabled);
      if (bookingEnabledInput) {
        bookingEnabledInput.disabled = !bookingPublicAllowed;
        if (!bookingPublicAllowed) bookingEnabledInput.checked = false;
      }
  
      const isEdit = mode === 'edit' && currentLocationId > 0;
      if (titleEl) titleEl.textContent = isEdit ? 'Modifica sede' : 'Nuova sede';
      if (subtitleEl) {
        subtitleEl.textContent = isEdit && data.name
          ? 'Aggiorna i dati e la visibilità della sede: ' + data.name + '.'
          : 'Aggiungi i dati della tua sede e imposta la visibilità.';
      }
      refreshBookingMarketplaceWarning();
    }
  
    document.addEventListener('click', function (event) {
      const newBtn = event.target.closest('[data-location-new]');
      if (newBtn) {
        fillForm(Object.assign({}, locationDefaults, { id: 0, booking_enabled: bookingPublicAllowed ? 1 : 0 }), 'new');
        return;
      }
  
      const editBtn = event.target.closest('[data-location-edit]');
      if (editBtn) {
        const id = editBtn.getAttribute('data-location-edit');
        fillForm(locationData[String(id)] || locationDefaults, 'edit');
        return;
      }
  
      const marketplaceBtn = event.target.closest('[data-location-marketplace]');
      if (marketplaceBtn) {
        const id = marketplaceBtn.getAttribute('data-location-marketplace');
        fillMarketplaceModal(locationData[String(id)] || { id: id, gallery_images: [], marketplace_enabled: 1 });
      }
    }, true);
  
    if (bookingEnabledInput) {
      bookingEnabledInput.addEventListener('change', refreshBookingMarketplaceWarning);
    }

    activityCards.forEach(function (card) {
      const checkbox = card.querySelector('[data-activity-checkbox]');
      if (!checkbox) return;
      checkbox.addEventListener('change', function () {
        const selected = selectedActivityIds();
        if (selected.length > 5) {
          const id = asId(checkbox.value);
          checkbox.checked = false;
          activitySelectionOrder = activitySelectionOrder.filter(function (selectedId) {
            return selectedId !== id;
          });
          alert('Puoi selezionare al massimo 5 categorie per sede.');
        } else if (checkbox.checked && primaryActivityInput && asId(primaryActivityInput.value) <= 0) {
          primaryActivityInput.value = String(asId(checkbox.value));
        }
        syncActivityCards();
      });
      card.addEventListener('dblclick', function (event) {
        event.preventDefault();
        if (!checkbox.checked) {
          if (selectedActivityIds().length >= 5) {
            alert('Puoi selezionare al massimo 5 categorie per sede.');
            return;
          }
          checkbox.checked = true;
          const id = asId(checkbox.value);
          if (id > 0 && activitySelectionOrder.indexOf(id) === -1) activitySelectionOrder.push(id);
        }
        if (primaryActivityInput) primaryActivityInput.value = String(asId(checkbox.value));
        syncActivityCards();
      });
    });

    if (marketplaceForm) {
      marketplaceForm.addEventListener('submit', function (event) {
        const selected = selectedActivityIds();
        if (activityOrderInput) activityOrderInput.value = selected.join(',');
        if (!marketplacePublicAllowed && marketplaceEnabled && marketplaceEnabled.checked) {
          event.preventDefault();
          alert(unavailableMessage);
          return;
        }
        if (marketplaceEnabled && marketplaceEnabled.checked && selected.length === 0) {
          event.preventDefault();
          alert('Seleziona almeno una categoria attivita per rendere visibile la sede nel marketplace.');
        }
      });
    }
  
    async function submitGalleryDeleteViaAjax(formEl) {
      const locationId = asId(formEl.elements.location_id ? formEl.elements.location_id.value : '0');
      const card = formEl.closest('.location-gallery-card');
      const buttons = Array.prototype.slice.call(formEl.querySelectorAll('button'));
      const formData = new FormData(formEl);
      formData.set('ajax', '1');
      buttons.forEach(function (button) { button.disabled = true; });
      if (card) {
        card.classList.add('opacity-50');
        card.setAttribute('aria-busy', 'true');
      }
      showGalleryFeedback('', 'success');
      try {
        const response = await fetch('index.php?page=locations', {
          method: 'POST',
          body: formData,
          credentials: 'same-origin',
          headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        const contentType = response.headers.get('content-type') || '';
        const payload = contentType.indexOf('application/json') !== -1 ? await response.json() : null;
        if (!response.ok || !payload || !payload.ok) {
          throw new Error((payload && payload.error) ? payload.error : 'Errore durante la rimozione della foto.');
        }
        const updatedLocation = Object.assign(
          {},
          locationData[String(locationId)] || { id: locationId },
          payload.location || {},
          { gallery_images: Array.isArray(payload.gallery_images) ? payload.gallery_images : [] }
        );
        locationData[String(locationId)] = updatedLocation;
        renderLocationGallery(updatedLocation);
        showGalleryFeedback(payload.message || 'Foto gallery sede rimossa', 'success');
        return true;
      } catch (error) {
        if (card) {
          card.classList.remove('opacity-50');
          card.removeAttribute('aria-busy');
        }
        buttons.forEach(function (button) { button.disabled = false; });
        showGalleryFeedback(error && error.message ? error.message : 'Errore durante la rimozione della foto.', 'danger');
        return false;
      }
    }
  
    if (galleryGrid) {
      galleryGrid.addEventListener('submit', function (event) {
        const formEl = event.target;
        if (!(formEl instanceof HTMLFormElement)) return;
        if (!formEl.matches('[data-location-gallery-delete-form="1"]')) return;
        if (!confirm('Rimuovere questa foto dalla gallery della sede?')) {
          event.preventDefault();
          return;
        }
        if (window.fetch && window.FormData) {
          event.preventDefault();
          submitGalleryDeleteViaAjax(formEl);
        }
      });
    }
  
    function validateGalleryFiles() {
      if (!galleryUploadForm || !galleryFileInput || !galleryUploadLocation) return;
      const locationId = asId(galleryUploadLocation.value);
      if (locationId <= 0) {
        alert('Sede non valida.');
        return false;
      }
      if (!galleryPendingEntries.length) {
        alert('Seleziona almeno una foto da salvare.');
        return false;
      }
      for (const entry of galleryPendingEntries) {
        const file = entry.file;
        if (!file) {
          alert('Una o piu foto non sono valide.');
          return false;
        }
        if (file.size > 5242880) {
          alert('Una o piu foto superano il limite di 5 MB.');
          return false;
        }
      }
      if (!syncGalleryFileInput() || !galleryFileInput.files || galleryFileInput.files.length === 0) {
        alert('Il browser non riesce a preparare le foto selezionate. Riprova selezionandole di nuovo.');
        return false;
      }
      return true;
    }
  
    async function submitGalleryViaAjax() {
      if (!galleryUploadForm || !galleryUploadLocation) return false;
      const locationId = asId(galleryUploadLocation.value);
      const formData = new FormData(galleryUploadForm);
      formData.set('ajax', '1');
      setGalleryUploading(true);
      showGalleryFeedback('', 'success');
      try {
        const response = await fetch('index.php?page=locations', {
          method: 'POST',
          body: formData,
          credentials: 'same-origin',
          headers: {
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        const contentType = response.headers.get('content-type') || '';
        const payload = contentType.indexOf('application/json') !== -1 ? await response.json() : null;
        if (!response.ok || !payload || !payload.ok) {
          throw new Error((payload && payload.error) ? payload.error : 'Errore durante il salvataggio gallery.');
        }
        const updatedLocation = Object.assign(
          {},
          locationData[String(locationId)] || { id: locationId },
          payload.location || {},
          { gallery_images: Array.isArray(payload.gallery_images) ? payload.gallery_images : [] }
        );
        locationData[String(locationId)] = updatedLocation;
        clearGalleryPendingFiles();
        renderLocationGallery(updatedLocation);
        showGalleryFeedback(payload.message || 'Foto gallery sede caricate', 'success');
        return true;
      } catch (error) {
        showGalleryFeedback(error && error.message ? error.message : 'Errore durante il salvataggio gallery.', 'danger');
        renderGalleryPendingFiles();
        return false;
      } finally {
        setGalleryUploading(false);
      }
    }
  
    if (galleryDropzone && galleryFileInput && galleryUploadForm) {
      galleryDropzone.addEventListener('click', function () {
        galleryFileInput.click();
      });
      galleryFileInput.addEventListener('change', function () {
        addGalleryPendingFiles(galleryFileInput.files);
      });
      galleryUploadForm.addEventListener('submit', function (event) {
        if (!validateGalleryFiles()) {
          event.preventDefault();
          return;
        }
        if (window.fetch && window.FormData) {
          event.preventDefault();
          submitGalleryViaAjax();
        }
      });
      ['dragenter', 'dragover'].forEach(function (eventName) {
        galleryDropzone.addEventListener(eventName, function (event) {
          event.preventDefault();
          event.stopPropagation();
          galleryDropzone.classList.add('is-dragover');
        });
      });
      ['dragleave', 'dragend', 'drop'].forEach(function (eventName) {
        galleryDropzone.addEventListener(eventName, function (event) {
          event.preventDefault();
          event.stopPropagation();
          galleryDropzone.classList.remove('is-dragover');
        });
      });
      galleryDropzone.addEventListener('drop', function (event) {
        const files = event.dataTransfer ? event.dataTransfer.files : null;
        if (!files || !files.length) return;
        addGalleryPendingFiles(files);
      });
    }
  
    if (galleryPendingGrid) {
      galleryPendingGrid.addEventListener('click', function (event) {
        const removeBtn = event.target.closest('[data-gallery-pending-remove]');
        if (!removeBtn) return;
        const index = parseInt(removeBtn.getAttribute('data-gallery-pending-remove') || '-1', 10);
        if (index < 0 || index >= galleryPendingEntries.length) return;
        const entry = galleryPendingEntries[index];
        if (entry && entry.url) URL.revokeObjectURL(entry.url);
        galleryPendingEntries.splice(index, 1);
        renderGalleryPendingFiles();
      });
    }
  
    if (galleryClearPending) {
      galleryClearPending.addEventListener('click', clearGalleryPendingFiles);
    }
  
    if (marketplaceModalEl) {
      marketplaceModalEl.addEventListener('hidden.bs.modal', function () {
        clearGalleryPendingFiles();
        showGalleryFeedback('', 'success');
        if (galleryUploadLocation) galleryUploadLocation.value = '0';
        if (marketplaceLocationId) marketplaceLocationId.value = '0';
      });
    }
  
    modalEl.addEventListener('hidden.bs.modal', function () {
      currentLocationId = 0;
      fillForm(Object.assign({}, locationDefaults, { id: 0, booking_enabled: bookingPublicAllowed ? 1 : 0 }), 'new');
    });
  })();

  if (locationsConfig.showDeletePreview) {
    (function () {
      'use strict';
    
      function cleanUrl() {
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', 'index.php?page=locations');
        }
      }
    
      function showDeletePreview() {
        const modalEl = document.getElementById('locationDeletePreviewModal');
        if (!modalEl) return;
    
        modalEl.addEventListener('hidden.bs.modal', cleanUrl, { once: true });
    
        if (window.bootstrap && window.bootstrap.Modal) {
          window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
          return;
        }
    
        modalEl.classList.add('show');
        modalEl.style.display = 'block';
        modalEl.removeAttribute('aria-hidden');
        modalEl.setAttribute('aria-modal', 'true');
        document.body.classList.add('modal-open');
      }
    
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', showDeletePreview);
      } else {
        showDeletePreview();
      }
    })();
  }
})();
