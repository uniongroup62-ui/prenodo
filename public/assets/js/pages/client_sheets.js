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

  const CLIENT_SHEETS_CONFIG = parseJsonScript('clientSheetsConfig') || {};

  document.addEventListener('click', (event) => {
    const action = event.target.closest('[data-client-sheets-confirm]');

    if (!action) return;

    const message = action.getAttribute('data-client-sheets-confirm') || 'Confermare questa operazione?';

    if (!window.confirm(message)) {
      event.preventDefault();
    }
  });

  (() => {
  const builder = document.getElementById('sheetFieldBuilder');
  const addBtn = document.getElementById('addSheetFieldRow');
  const presetBtn = document.getElementById('applySheetPreset');
  const presetSelect = document.getElementById('sheetPresetSelect');
  const tpl = document.getElementById('sheetFieldRowTemplate');
  const templateForm = document.getElementById('sheetTemplateForm');
  const validationAlert = document.getElementById('sheetTemplateValidationAlert');
  if (!builder || !tpl) return;

  const presets = CLIENT_SHEETS_CONFIG.presets || {};
  const typeUi = CLIENT_SHEETS_CONFIG.typeUi || {};
  let rowIndex = 1000;

  const splitOptions = (value) => String(value || '')
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter((item) => item !== '');

  const setFieldInvalid = (input, invalid) => {
    if (!input) return;
    input.classList.toggle('is-invalid', !!invalid);
  };

  const showValidation = (messages) => {
    if (!validationAlert) return;
    if (!messages.length) {
      validationAlert.classList.add('d-none');
      validationAlert.innerHTML = '';
      return;
    }
    validationAlert.classList.remove('d-none');
    validationAlert.innerHTML = '';
    const intro = document.createElement('div');
    intro.className = 'fw-semibold mb-2';
    intro.textContent = 'Controlla i campi obbligatori prima di salvare il tab:';
    validationAlert.appendChild(intro);
    const list = document.createElement('ul');
    messages.forEach((message) => {
      const item = document.createElement('li');
      item.textContent = message;
      list.appendChild(item);
    });
    validationAlert.appendChild(list);
  };

  const bindRow = (row) => {
    const typeSelect = row.querySelector('[data-field-type]');
    const unitWrap = row.querySelector('[data-field-unit-wrap]');
    const placeholderWrap = row.querySelector('[data-field-placeholder-wrap]');
    const helpWrap = row.querySelector('[data-field-help-wrap]');
    const optionsWrap = row.querySelector('[data-field-options-wrap]');
    const removeBtn = row.querySelector('[data-remove-field-row]');
    const labelInput = row.querySelector('[data-field-label-input]');
    const unitInput = row.querySelector('[data-field-unit-input]');
    const optionsInput = row.querySelector('[data-field-options-input]');

    const clearAlertIfResolved = () => {
      if (!validationAlert || validationAlert.classList.contains('d-none')) return;
      const anyInvalid = templateForm?.querySelector('.is-invalid');
      if (!anyInvalid) showValidation([]);
    };

    const syncType = () => {
      const type = typeSelect ? typeSelect.value : 'text';
      const config = typeUi[type] || typeUi.text || {unit:false, placeholder:true, options:false};
      if (unitWrap) unitWrap.classList.toggle('d-none', !config.unit);
      if (placeholderWrap) {
        placeholderWrap.classList.toggle('d-none', !config.placeholder);
        placeholderWrap.classList.toggle('col-md-6', !!config.placeholder);
        placeholderWrap.classList.toggle('col-12', !config.placeholder);
      }
      if (helpWrap) {
        helpWrap.classList.toggle('col-md-6', !!config.placeholder);
        helpWrap.classList.toggle('col-12', !config.placeholder);
      }
      if (optionsWrap) optionsWrap.classList.toggle('d-none', !config.options);
      if (labelInput) labelInput.required = true;
      if (unitInput) {
        unitInput.required = !!config.unit;
        if (!config.unit) setFieldInvalid(unitInput, false);
      }
      if (optionsInput) {
        optionsInput.required = !!config.options;
        if (!config.options) setFieldInvalid(optionsInput, false);
      }
    };

    if (typeSelect) {
      typeSelect.addEventListener('change', () => {
        syncType();
        clearAlertIfResolved();
      });
    }
    [labelInput, unitInput, optionsInput].forEach((input) => {
      input?.addEventListener('input', () => {
        setFieldInvalid(input, false);
        clearAlertIfResolved();
      });
    });
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        const rows = builder.querySelectorAll('[data-field-row]');
        const allowEmpty = builder.getAttribute('data-allow-empty') === '1';
        if (rows.length <= 1) {
          if (allowEmpty) {
            row.remove();
            if (!builder.querySelector('[data-field-row]') && !builder.querySelector('[data-no-new-fields-message]')) {
              const note = document.createElement('div');
              note.className = 'text-muted small';
              note.setAttribute('data-no-new-fields-message', '1');
              note.textContent = 'Nessun nuovo campo aggiunto. Usa "Aggiungi nuovo campo" per estendere il tab senza toccare le compilazioni già salvate.';
              builder.appendChild(note);
            }
            clearAlertIfResolved();
            return;
          }
          row.querySelectorAll('input[type="text"], input[type="hidden"], textarea').forEach((el) => { el.value = ''; });
          row.querySelectorAll('input[type="checkbox"]').forEach((el) => { el.checked = false; });
          if (typeSelect) typeSelect.value = 'text';
          syncType();
          clearAlertIfResolved();
          return;
        }
        row.remove();
        clearAlertIfResolved();
      });
    }
    syncType();
  };

  const assignNames = (row, idx) => {
    row.querySelectorAll('[data-name]').forEach((el) => {
      const key = el.getAttribute('data-name');
      if (!key) return;
      el.setAttribute('name', `fields[row_${idx}][${key}]`);
    });
  };

  const addRow = (field = {}) => {
    const placeholderNote = builder.querySelector('[data-no-new-fields-message]');
    if (placeholderNote) placeholderNote.remove();
    const fragment = tpl.content.cloneNode(true);
    const row = fragment.querySelector('[data-field-row]');
    rowIndex += 1;
    assignNames(row, rowIndex);

    row.querySelectorAll('[data-name]').forEach((el) => {
      const key = el.getAttribute('data-name');
      if (!key) return;
      const value = Object.prototype.hasOwnProperty.call(field, key) ? field[key] : '';
      if (el.type === 'checkbox') {
        el.checked = !!value;
      } else if (key === 'options_raw') {
        if (Array.isArray(field.options)) {
          el.value = field.options.join(', ');
        } else {
          el.value = value || '';
        }
      } else {
        el.value = value || '';
      }
    });

    builder.appendChild(fragment);
    bindRow(builder.lastElementChild);
  };

  builder.querySelectorAll('[data-field-row]').forEach(bindRow);

  if (addBtn) {
    addBtn.addEventListener('click', () => addRow({type: 'text'}));
  }

  if (presetBtn && presetSelect) {
    presetBtn.addEventListener('click', () => {
      const key = presetSelect.value || 'blank';
      const rows = presets[key] || [];
      const hasContent = Array.from(builder.querySelectorAll('[data-field-row]')).some((row) => {
        const input = row.querySelector('[data-field-label-input]');
        return input && input.value.trim() !== '';
      });
      if (hasContent && !confirm('Sostituire i campi attuali con il preset selezionato?')) {
        return;
      }
      builder.innerHTML = '';
      if (!rows.length) {
        addRow({type: 'text'});
        showValidation([]);
        return;
      }
      rows.forEach((field) => addRow(field));
      showValidation([]);
    });
  }

  if (templateForm) {
    templateForm.addEventListener('submit', (event) => {
      const rows = Array.from(builder.querySelectorAll('[data-field-row]'));
      const allowEmpty = builder.getAttribute('data-allow-empty') === '1';
      const messages = [];

      if (!rows.length && !allowEmpty) {
        messages.push('Aggiungi almeno un campo personalizzato prima di salvare il tab.');
      }

      rows.forEach((row, index) => {
        const typeSelect = row.querySelector('[data-field-type]');
        const labelInput = row.querySelector('[data-field-label-input]');
        const unitInput = row.querySelector('[data-field-unit-input]');
        const optionsInput = row.querySelector('[data-field-options-input]');
        const type = typeSelect ? typeSelect.value : 'text';
        const config = typeUi[type] || typeUi.text || {unit:false, placeholder:true, options:false};
        const prefix = `Campo ${index + 1}`;
        const labelValue = labelInput ? labelInput.value.trim() : '';
        const unitValue = unitInput ? unitInput.value.trim() : '';
        const optionValues = optionsInput ? splitOptions(optionsInput.value) : [];

        setFieldInvalid(labelInput, labelValue === '');
        if (labelValue === '') messages.push(`${prefix}: compila Etichetta campo.`);

        const unitMissing = !!config.unit && unitValue === '';
        setFieldInvalid(unitInput, unitMissing);
        if (unitMissing) messages.push(`${prefix}: compila Unità.`);

        const optionsMissing = !!config.options && optionValues.length === 0;
        setFieldInvalid(optionsInput, optionsMissing);
        if (optionsMissing) messages.push(`${prefix}: inserisci almeno una voce in Opzioni elenco.`);
      });

      if (messages.length) {
        event.preventDefault();
        showValidation(messages);
        validationAlert?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      showValidation([]);
    });
  }
  })();

  (() => {
  const defaultMaxBytes = Number(CLIENT_SHEETS_CONFIG.defaultMaxBytes || 0);
  const defaultMaxFiles = Number(CLIENT_SHEETS_CONFIG.defaultMaxFiles || 0);
  const recordForm = document.getElementById('clientSheetRecordForm');
  const recordSaveError = document.getElementById('recordSaveAjaxError');
  const recordSaveButton = recordForm?.querySelector('[data-record-save-button]') || null;
  const galleryOverlay = document.getElementById('sheetGalleryOverlay');
  const galleryImage = galleryOverlay?.querySelector('[data-gallery-image-view]') || null;
  const galleryCaptionTitle = galleryOverlay?.querySelector('[data-gallery-caption-title]') || null;
  const galleryCaptionNote = galleryOverlay?.querySelector('[data-gallery-caption-note]') || null;
  const galleryCounter = galleryOverlay?.querySelector('[data-gallery-counter]') || null;
  const galleryPrev = galleryOverlay?.querySelector('[data-gallery-prev]') || null;
  const galleryNext = galleryOverlay?.querySelector('[data-gallery-next]') || null;
  const uploadControllers = [];
  let galleryItems = [];
  let galleryIndex = 0;

  const configByKind = {
    photo: {
      allowedMimeTypes: ['image/jpeg', 'image/png'],
      allowedExtensions: ['jpg', 'jpeg', 'png'],
      allowedLabel: 'JPG o PNG',
      singular: 'immagine',
      plural: 'immagini',
      removeLabel: 'Elimina immagine',
      notePlaceholder: 'Nota immagine (facoltativa)',
      confirmLabel: 'Eliminare questa immagine? L\'operazione sarà immediata.',
    },
    document: {
      allowedMimeTypes: [
        'application/pdf',
        'application/x-pdf',
        'application/msword',
        'application/vnd.ms-word',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.oasis.opendocument.text',
        'application/vnd.ms-excel',
        'application/excel',
        'application/x-excel',
        'application/x-msexcel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/octet-stream',
        'application/zip',
      ],
      allowedExtensions: ['pdf', 'doc', 'docx', 'odt', 'xls', 'xlsx'],
      allowedLabel: 'PDF, DOC, DOCX, ODT, XLS o XLSX',
      singular: 'documento',
      plural: 'documenti',
      removeLabel: 'Elimina documento',
      notePlaceholder: 'Nota documento (facoltativa)',
      confirmLabel: 'Eliminare questo documento? L\'operazione sarà immediata.',
    },
  };

  const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1).replace(/\.0$/, '')} MB`;
    }
    if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(bytes >= 10 * 1024 ? 0 : 1).replace(/\.0$/, '')} KB`;
    }
    return `${bytes} B`;
  };

  const getFileExtension = (name) => {
    const lower = String(name || '').toLowerCase();
    const parts = lower.split('.');
    return parts.length > 1 ? parts.pop() : '';
  };

  const documentIconClass = (name) => {
    const ext = getFileExtension(name);
    if (ext === 'pdf') return 'bi-filetype-pdf';
    if (['doc', 'docx', 'odt'].includes(ext)) return 'bi-file-earmark-text';
    if (['xls', 'xlsx'].includes(ext)) return 'bi-file-earmark-excel';
    return 'bi-file-earmark';
  };

  const isAllowedFile = (file, kind) => {
    const config = configByKind[kind] || configByKind.photo;
    const type = String(file.type || '').toLowerCase();
    const ext = getFileExtension(file.name || '');
    if (!config.allowedExtensions.includes(ext)) return false;
    if (!type) return true;
    if (config.allowedMimeTypes.includes(type)) return true;
    if (kind === 'photo') return false;
    return ['application/octet-stream', 'application/zip'].includes(type);
  };

  const setRecordError = (message = '') => {
    if (!recordSaveError) return;
    if (!message) {
      recordSaveError.classList.add('d-none');
      recordSaveError.textContent = '';
      return;
    }
    recordSaveError.classList.remove('d-none');
    recordSaveError.textContent = message;
  };

  const setRecordSavingState = (busy) => {
    if (!recordSaveButton) return;
    if (!recordSaveButton.dataset.originalHtml) {
      recordSaveButton.dataset.originalHtml = recordSaveButton.innerHTML;
    }
    recordSaveButton.disabled = !!busy;
    recordSaveButton.innerHTML = busy
      ? '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Upload in corso...'
      : recordSaveButton.dataset.originalHtml;
  };

  const ensureProgressNode = (card) => {
    if (!card) return null;
    let wrap = card.querySelector('[data-upload-progress]');
    if (wrap) {
      return {
        wrap,
        status: wrap.querySelector('[data-upload-progress-status]'),
        percent: wrap.querySelector('[data-upload-progress-percent]'),
        bar: wrap.querySelector('[data-upload-progress-bar]'),
      };
    }

    wrap = document.createElement('div');
    wrap.className = 'sheet-upload-progress d-none';
    wrap.setAttribute('data-upload-progress', '1');

    const header = document.createElement('div');
    header.className = 'd-flex justify-content-between gap-2 small text-muted mb-1';

    const status = document.createElement('span');
    status.setAttribute('data-upload-progress-status', '1');
    status.textContent = 'In attesa upload';
    header.appendChild(status);

    const percent = document.createElement('span');
    percent.setAttribute('data-upload-progress-percent', '1');
    percent.textContent = '0%';
    header.appendChild(percent);

    const progress = document.createElement('div');
    progress.className = 'progress';

    const bar = document.createElement('div');
    bar.className = 'progress-bar';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute('aria-valuenow', '0');
    bar.style.width = '0%';
    bar.setAttribute('data-upload-progress-bar', '1');
    progress.appendChild(bar);

    wrap.appendChild(header);
    wrap.appendChild(progress);

    const host = card.querySelector('.body') || card.querySelector('.flex-grow-1') || card;
    host.appendChild(wrap);

    return { wrap, status, percent, bar };
  };

  const updateProgressNode = (card, percent, statusLabel, variant = 'primary') => {
    const node = ensureProgressNode(card);
    if (!node) return;
    const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
    node.wrap.classList.remove('d-none');
    node.status.textContent = statusLabel;
    node.percent.textContent = `${safePercent}%`;
    node.bar.style.width = `${safePercent}%`;
    node.bar.setAttribute('aria-valuenow', String(safePercent));
    node.bar.className = `progress-bar bg-${variant}`;
  };

  const resetProgressNode = (card) => {
    const node = ensureProgressNode(card);
    if (!node) return;
    node.wrap.classList.add('d-none');
    node.status.textContent = 'In attesa upload';
    node.percent.textContent = '0%';
    node.bar.style.width = '0%';
    node.bar.setAttribute('aria-valuenow', '0');
    node.bar.className = 'progress-bar';
  };

  const refreshGalleryItems = () => {
    galleryItems = Array.from(document.querySelectorAll('[data-gallery-trigger]')).filter((trigger) => {
      const src = String(trigger.getAttribute('data-gallery-src') || '').trim();
      return src !== '' && trigger.offsetParent !== null;
    });
  };

  const renderGallery = () => {
    if (!galleryOverlay || !galleryImage || !galleryCounter) return;
    if (!galleryItems.length) {
      galleryImage.removeAttribute('src');
      galleryImage.alt = '';
      if (galleryCaptionTitle) galleryCaptionTitle.textContent = '';
      if (galleryCaptionNote) {
        galleryCaptionNote.textContent = '';
        galleryCaptionNote.classList.add('d-none');
      }
      galleryCounter.textContent = '';
      if (galleryPrev) galleryPrev.disabled = true;
      if (galleryNext) galleryNext.disabled = true;
      return;
    }

    if (galleryIndex < 0) galleryIndex = 0;
    if (galleryIndex >= galleryItems.length) galleryIndex = galleryItems.length - 1;

    const trigger = galleryItems[galleryIndex];
    const src = String(trigger.getAttribute('data-gallery-src') || '');
    const title = String(trigger.getAttribute('data-gallery-title') || 'Immagine');
    const note = String(trigger.getAttribute('data-gallery-note') || '').trim();

    galleryImage.src = src;
    galleryImage.alt = title;
    if (galleryCaptionTitle) galleryCaptionTitle.textContent = title;
    if (galleryCaptionNote) {
      galleryCaptionNote.textContent = note;
      galleryCaptionNote.classList.toggle('d-none', note === '');
    }
    galleryCounter.textContent = `${galleryIndex + 1} / ${galleryItems.length}`;
    if (galleryPrev) galleryPrev.disabled = galleryItems.length <= 1;
    if (galleryNext) galleryNext.disabled = galleryItems.length <= 1;
  };

  const openGallery = (trigger) => {
    if (!galleryOverlay) return;
    refreshGalleryItems();
    const index = galleryItems.indexOf(trigger);
    galleryIndex = index >= 0 ? index : 0;
    renderGallery();
    galleryOverlay.classList.remove('d-none');
    galleryOverlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('overflow-hidden');
  };

  const closeGalleryOverlay = () => {
    if (!galleryOverlay) return;
    galleryOverlay.classList.add('d-none');
    galleryOverlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('overflow-hidden');
  };

  const moveGallery = (step) => {
    if (!galleryItems.length) return;
    galleryIndex = (galleryIndex + step + galleryItems.length) % galleryItems.length;
    renderGallery();
  };

  document.addEventListener('click', (event) => {
    const galleryTrigger = event.target.closest('[data-gallery-trigger]');
    if (galleryTrigger) {
      event.preventDefault();
      openGallery(galleryTrigger);
      return;
    }
    if (event.target.closest('[data-gallery-prev]')) {
      event.preventDefault();
      moveGallery(-1);
      return;
    }
    if (event.target.closest('[data-gallery-next]')) {
      event.preventDefault();
      moveGallery(1);
      return;
    }
    if (event.target.closest('[data-gallery-close]')) {
      event.preventDefault();
      closeGalleryOverlay();
      return;
    }
    if (galleryOverlay && event.target === galleryOverlay) {
      closeGalleryOverlay();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (!galleryOverlay || galleryOverlay.classList.contains('d-none')) return;
    if (event.key === 'Escape') {
      closeGalleryOverlay();
    } else if (event.key === 'ArrowLeft') {
      moveGallery(-1);
    } else if (event.key === 'ArrowRight') {
      moveGallery(1);
    }
  });

  const setGridVisibility = (grid) => {
    if (!grid) return;
    grid.classList.toggle('d-none', grid.children.length === 0);
  };

  const setControllerErrors = (controller, messages) => {
    const errorBox = controller.errorBox;
    if (!errorBox) return;
    if (!messages.length) {
      errorBox.classList.add('d-none');
      errorBox.innerHTML = '';
      return;
    }
    errorBox.classList.remove('d-none');
    errorBox.innerHTML = '';
    const list = document.createElement('ul');
    list.className = 'sheet-upload-error-list';
    messages.forEach((message) => {
      const item = document.createElement('li');
      item.textContent = message;
      list.appendChild(item);
    });
    errorBox.appendChild(list);
  };

  const deleteExistingAttachment = async (controller, item, card, removeBtn) => {
    if (!recordForm) return;
    if (!item || item.source !== 'existing') return;
    const recordId = Number(recordForm.querySelector('[name="record_id"]')?.value || 0);
    const templateId = Number(recordForm.querySelector('[name="template_id"]')?.value || 0);
    const csrf = String(recordForm.querySelector('[name="_csrf"]')?.value || '');
    const confirmMessage = String(item.confirmMessage || controller.config.confirmLabel || 'Confermi l\'eliminazione del file?');

    if (recordId <= 0 || !item.id) {
      setRecordError('File non valido.');
      return;
    }
    if (!window.confirm(confirmMessage)) return;

    setRecordError('');
    const originalHtml = removeBtn?.innerHTML || '';
    card?.classList.add('sheet-existing-delete-busy');
    if (removeBtn) {
      removeBtn.disabled = true;
      removeBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Eliminazione...';
    }

    try {
      const formData = new FormData();
      formData.set('_csrf', csrf);
      formData.set('_action', 'delete_attachment');
      formData.set('_response', 'json');
      formData.set('record_id', String(recordId));
      if (templateId > 0) formData.set('template_id', String(templateId));
      formData.set('field_id', controller.fieldId);
      formData.set('attachment_id', item.id);

      const response = await fetch(recordForm.getAttribute('action') || window.location.href, {
        method: 'POST',
        body: formData,
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json',
        },
      });

      let payload = {};
      try {
        payload = await response.json();
      } catch (error) {
        payload = {};
      }
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || 'Impossibile eliminare il file.');
      }

      controller.state.items = controller.state.items.filter((entry) => !(entry.source === 'existing' && entry.id === item.id));
      controller.syncHiddenMeta();
      controller.renderItems();
      refreshGalleryItems();
      if (galleryOverlay && !galleryOverlay.classList.contains('d-none')) {
        if (!galleryItems.length) {
          closeGalleryOverlay();
        } else {
          if (galleryIndex >= galleryItems.length) galleryIndex = galleryItems.length - 1;
          renderGallery();
        }
      }
    } catch (error) {
      card?.classList.remove('sheet-existing-delete-busy');
      if (removeBtn) {
        removeBtn.disabled = false;
        removeBtn.innerHTML = originalHtml;
      }
      setRecordError(error instanceof Error ? error.message : 'Impossibile eliminare il file.');
      recordSaveError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const createController = (input) => {
    const kind = String(input.dataset.uploadKind || 'photo').toLowerCase() === 'document' ? 'document' : 'photo';
    const config = configByKind[kind] || configByKind.photo;
    const maxBytes = Number(input.dataset.maxSize || defaultMaxBytes) || defaultMaxBytes;
    const maxFiles = Number(input.dataset.maxFiles || defaultMaxFiles) || defaultMaxFiles;
    const fieldId = String(input.dataset.fieldId || '').trim();
    const wrapper = input.closest('.card-body') || input.parentElement;
    const grid = wrapper?.querySelector('[data-staged-upload-grid]') || null;
    const existingGrid = wrapper?.querySelector('[data-existing-attachment-grid]') || null;
    const errorBox = wrapper?.querySelector('[data-upload-errors]') || null;
    const dropzone = wrapper?.querySelector('[data-upload-dropzone]') || null;
    const metaHost = wrapper?.querySelector('[data-upload-meta]') || null;
    const supportsDataTransfer = typeof DataTransfer !== 'undefined';
    const state = { items: [], seq: 0 };
    const metaInput = document.createElement('input');
    metaInput.type = 'hidden';
    metaInput.name = `attachment_meta[${fieldId}]`;
    if (metaHost) metaHost.appendChild(metaInput);

    const controller = {
      input,
      kind,
      config,
      fieldId,
      maxBytes,
      maxFiles,
      grid,
      existingGrid,
      errorBox,
      dropzone,
      metaInput,
      supportsDataTransfer,
      state,
      syncInputFiles: () => {},
      syncHiddenMeta: () => {},
      renderItems: () => {},
    };

    const fileKey = (file) => [file.name, file.size, file.lastModified, file.type].join('::');
    const getStagedItems = () => controller.state.items.filter((item) => item.source === 'staged');

    const buildExistingItems = () => {
      if (!existingGrid) return [];
      const items = Array.from(existingGrid.querySelectorAll('[data-existing-attachment-card]')).map((card, index) => ({
        source: 'existing',
        id: String(card.dataset.attachmentId || '').trim(),
        name: String(card.dataset.attachmentName || '').trim() || `${kind === 'document' ? 'Documento' : 'Foto'} ${index + 1}`,
        note: String(card.dataset.attachmentNote || '').trim(),
        url: String(card.dataset.attachmentUrl || '').trim(),
        size: Number(card.dataset.attachmentSize || 0) || 0,
        uploadedAt: String(card.dataset.attachmentUploadedAt || '').trim(),
        file: null,
        previewUrl: String(card.dataset.attachmentUrl || '').trim(),
        confirmMessage: card.querySelector('[data-remove-existing-attachment]')?.dataset.removeConfirm || config.confirmLabel,
        card: null,
      })).filter((item) => item.id !== '');
      existingGrid.classList.add('d-none');
      return items;
    };

    controller.state.items = buildExistingItems();

    controller.syncInputFiles = () => {
      if (!supportsDataTransfer) return;
      const dataTransfer = new DataTransfer();
      getStagedItems().forEach((item) => {
        if (item.file) dataTransfer.items.add(item.file);
      });
      input.files = dataTransfer.files;
    };

    controller.syncHiddenMeta = () => {
      if (!metaInput) return;
      const payload = controller.state.items.map((item) => ({
        source: item.source,
        id: item.source === 'existing' ? item.id : item.tempId,
        note: String(item.note || '').trim(),
      }));
      metaInput.value = JSON.stringify(payload);
    };

    const moveItem = (index, direction) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= controller.state.items.length) return;
      const clone = controller.state.items.slice();
      const [moved] = clone.splice(index, 1);
      clone.splice(nextIndex, 0, moved);
      controller.state.items = clone;
      controller.syncInputFiles();
      controller.syncHiddenMeta();
      controller.renderItems();
      setControllerErrors(controller, []);
    };

    const removeStagedItem = (tempId) => {
      const next = [];
      controller.state.items.forEach((item) => {
        if (item.source === 'staged' && item.tempId === tempId) {
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
          return;
        }
        next.push(item);
      });
      controller.state.items = next;
      controller.syncInputFiles();
      controller.syncHiddenMeta();
      controller.renderItems();
      setControllerErrors(controller, []);
    };

    controller.renderItems = () => {
      if (!grid) return;
      grid.innerHTML = '';

      controller.state.items.forEach((item, index) => {
        const positionText = `Posizione ${index + 1}`;
        if (kind === 'photo') {
          const card = document.createElement('div');
          card.className = 'sheet-photo-card';
          item.card = card;

          const previewBtn = document.createElement('button');
          previewBtn.type = 'button';
          previewBtn.className = 'sheet-gallery-thumb';
          previewBtn.setAttribute('data-gallery-trigger', '1');
          previewBtn.setAttribute('data-gallery-src', item.previewUrl || item.url || '');
          previewBtn.setAttribute('data-gallery-title', item.name || 'Foto');
          previewBtn.setAttribute('data-gallery-note', item.note || '');

          const image = document.createElement('img');
          image.src = item.previewUrl || item.url || '';
          image.alt = item.name || 'Foto';
          previewBtn.appendChild(image);
          card.appendChild(previewBtn);

          const body = document.createElement('div');
          body.className = 'body';

          const position = document.createElement('div');
          position.className = 'sheet-item-position mb-1';
          position.textContent = positionText;
          body.appendChild(position);

          const name = document.createElement('div');
          name.className = 'fw-semibold small text-truncate';
          name.textContent = item.name || 'Foto';
          body.appendChild(name);

          const meta = document.createElement('div');
          meta.className = 'text-muted small mb-2';
          meta.textContent = item.source === 'existing'
            ? `${item.uploadedAt ? item.uploadedAt : 'Caricata'}${item.size > 0 ? ` • ${formatBytes(item.size)}` : ''}`
            : `Da salvare • ${formatBytes(item.size || 0)}`;
          body.appendChild(meta);

          const note = document.createElement('textarea');
          note.className = 'form-control form-control-sm sheet-attachment-note-input';
          note.rows = 2;
          note.placeholder = config.notePlaceholder;
          note.value = item.note || '';
          note.addEventListener('input', () => {
            item.note = note.value.trim();
            previewBtn.setAttribute('data-gallery-note', item.note || '');
            controller.syncHiddenMeta();
            refreshGalleryItems();
            if (galleryOverlay && !galleryOverlay.classList.contains('d-none')) {
              renderGallery();
            }
          });
          body.appendChild(note);

          const actions = document.createElement('div');
          actions.className = 'sheet-sort-actions mt-3';

          const upBtn = document.createElement('button');
          upBtn.type = 'button';
          upBtn.className = 'btn btn-outline-secondary btn-sm';
          upBtn.innerHTML = '<i class="bi bi-arrow-up"></i>';
          upBtn.title = 'Sposta su';
          upBtn.disabled = index === 0;
          upBtn.addEventListener('click', () => moveItem(index, -1));
          actions.appendChild(upBtn);

          const downBtn = document.createElement('button');
          downBtn.type = 'button';
          downBtn.className = 'btn btn-outline-secondary btn-sm';
          downBtn.innerHTML = '<i class="bi bi-arrow-down"></i>';
          downBtn.title = 'Sposta giù';
          downBtn.disabled = index === (controller.state.items.length - 1);
          downBtn.addEventListener('click', () => moveItem(index, 1));
          actions.appendChild(downBtn);

          const removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.className = 'btn btn-outline-danger btn-sm';
          removeBtn.innerHTML = '<i class="bi bi-trash me-1"></i>' + config.removeLabel;
          removeBtn.addEventListener('click', () => {
            if (item.source === 'existing') {
              deleteExistingAttachment(controller, item, card, removeBtn);
              return;
            }
            removeStagedItem(item.tempId);
          });
          actions.appendChild(removeBtn);

          body.appendChild(actions);
          card.appendChild(body);
          grid.appendChild(card);
          resetProgressNode(card);
          return;
        }

        const card = document.createElement('div');
        card.className = 'sheet-attachment-card';
        item.card = card;

        const layout = document.createElement('div');
        layout.className = 'd-flex gap-3 align-items-start';

        const icon = document.createElement('div');
        icon.className = 'sheet-attachment-icon';
        icon.innerHTML = `<i class="bi ${documentIconClass(item.name)}"></i>`;
        layout.appendChild(icon);

        const body = document.createElement('div');
        body.className = 'flex-grow-1 min-w-0';

        const position = document.createElement('div');
        position.className = 'sheet-item-position mb-1';
        position.textContent = positionText;
        body.appendChild(position);

        const name = document.createElement('div');
        name.className = 'fw-semibold small text-break';
        name.textContent = item.name || 'Documento';
        body.appendChild(name);

        const meta = document.createElement('div');
        meta.className = 'text-muted small mt-1';
        meta.textContent = item.source === 'existing'
          ? `${item.uploadedAt ? item.uploadedAt : 'Caricato'}${item.size > 0 ? ` • ${formatBytes(item.size)}` : ''}`
          : `Da salvare • ${formatBytes(item.size || 0)}`;
        body.appendChild(meta);

        const note = document.createElement('textarea');
        note.className = 'form-control form-control-sm sheet-attachment-note-input';
        note.rows = 2;
        note.placeholder = config.notePlaceholder;
        note.value = item.note || '';
        note.addEventListener('input', () => {
          item.note = note.value.trim();
          controller.syncHiddenMeta();
        });
        body.appendChild(note);

        const actions = document.createElement('div');
        actions.className = 'sheet-sort-actions mt-3';

        if (item.source === 'existing' && item.url) {
          const openBtn = document.createElement('a');
          openBtn.className = 'btn btn-outline-primary btn-sm';
          openBtn.target = '_blank';
          openBtn.rel = 'noopener';
          openBtn.href = item.url;
          openBtn.innerHTML = '<i class="bi bi-box-arrow-up-right me-1"></i>Apri';
          actions.appendChild(openBtn);
        }

        const upBtn = document.createElement('button');
        upBtn.type = 'button';
        upBtn.className = 'btn btn-outline-secondary btn-sm';
        upBtn.innerHTML = '<i class="bi bi-arrow-up"></i>';
        upBtn.title = 'Sposta su';
        upBtn.disabled = index === 0;
        upBtn.addEventListener('click', () => moveItem(index, -1));
        actions.appendChild(upBtn);

        const downBtn = document.createElement('button');
        downBtn.type = 'button';
        downBtn.className = 'btn btn-outline-secondary btn-sm';
        downBtn.innerHTML = '<i class="bi bi-arrow-down"></i>';
        downBtn.title = 'Sposta giù';
        downBtn.disabled = index === (controller.state.items.length - 1);
        downBtn.addEventListener('click', () => moveItem(index, 1));
        actions.appendChild(downBtn);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn btn-outline-danger btn-sm';
        removeBtn.innerHTML = '<i class="bi bi-trash me-1"></i>' + config.removeLabel;
        removeBtn.addEventListener('click', () => {
          if (item.source === 'existing') {
            deleteExistingAttachment(controller, item, card, removeBtn);
            return;
          }
          removeStagedItem(item.tempId);
        });
        actions.appendChild(removeBtn);

        body.appendChild(actions);
        layout.appendChild(body);
        card.appendChild(layout);
        grid.appendChild(card);
        resetProgressNode(card);
      });

      setGridVisibility(grid);
      controller.syncHiddenMeta();
      refreshGalleryItems();
    };

    const validateAndStoreFiles = (incomingFiles) => {
      const messages = [];
      const nextItems = controller.state.items.slice();
      const stagedMap = new Map(getStagedItems().map((item) => [fileKey(item.file), item]));

      Array.from(incomingFiles || []).forEach((file) => {
        if (!isAllowedFile(file, kind)) {
          messages.push(`${file.name}: formato non supportato. Usa solo ${config.allowedLabel}.`);
          return;
        }
        if (Number(file.size || 0) > maxBytes) {
          messages.push(`${file.name}: supera il limite di ${formatBytes(maxBytes)}.`);
          return;
        }
        const key = fileKey(file);
        if (stagedMap.has(key)) {
          return;
        }

        const previewUrl = kind === 'photo' ? URL.createObjectURL(file) : '';
        const newItem = {
          source: 'staged',
          tempId: `tmp_${Date.now()}_${controller.state.seq++}`,
          name: file.name || (kind === 'photo' ? 'Nuova immagine' : 'Nuovo documento'),
          note: '',
          url: '',
          previewUrl,
          size: Number(file.size || 0),
          uploadedAt: '',
          file,
          card: null,
        };
        stagedMap.set(key, newItem);
        nextItems.push(newItem);
      });

      if (nextItems.length > maxFiles) {
        messages.push(`Puoi caricare al massimo ${maxFiles} ${config.plural} per questo campo.`);
        while (nextItems.length > maxFiles) {
          const removed = nextItems.pop();
          if (removed?.source === 'staged' && removed.previewUrl) {
            URL.revokeObjectURL(removed.previewUrl);
          }
        }
      }

      controller.state.items = nextItems;
      controller.syncInputFiles();
      controller.syncHiddenMeta();
      controller.renderItems();
      setControllerErrors(controller, messages);
    };

    input.addEventListener('change', () => {
      validateAndStoreFiles(input.files);
    });

    if (dropzone) {
      const setDragState = (active) => {
        dropzone.classList.toggle('is-dragover', !!active);
      };

      ['dragenter', 'dragover'].forEach((eventName) => {
        dropzone.addEventListener(eventName, (event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragState(true);
        });
      });

      ['dragleave', 'dragend', 'drop'].forEach((eventName) => {
        dropzone.addEventListener(eventName, (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (eventName === 'dragleave' && dropzone.contains(event.relatedTarget)) return;
          setDragState(false);
        });
      });

      dropzone.addEventListener('drop', (event) => {
        const files = event.dataTransfer?.files;
        if (files && files.length) {
          validateAndStoreFiles(files);
        }
      });

      dropzone.addEventListener('click', (event) => {
        if (event.target === input || event.target.closest('input, button, a, textarea')) return;
        input.click();
      });

      dropzone.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        input.click();
      });
    }

    controller.syncInputFiles();
    controller.syncHiddenMeta();
    controller.renderItems();
    return controller;
  };

  document.querySelectorAll('[data-sheet-upload-input]').forEach((input) => {
    uploadControllers.push(createController(input));
  });

  const collectPendingUploadEntries = () => {
    const entries = [];
    uploadControllers.forEach((controller) => {
      controller.state.items.forEach((item) => {
        if (item.source !== 'staged' || !item.file) return;
        entries.push({
          controller,
          item,
          file: item.file,
          card: item.card || null,
          size: Math.max(1, Number(item.file.size || 0)),
        });
      });
    });
    return entries;
  };

  if (recordForm) {
    recordForm.addEventListener('submit', (event) => {
      const entries = collectPendingUploadEntries();
      if (!entries.length) return;
      if (!recordForm.reportValidity()) return;

      event.preventDefault();
      setRecordError('');
      setRecordSavingState(true);
      entries.forEach((entry) => updateProgressNode(entry.card, 0, 'In attesa upload...', 'primary'));

      const formData = new FormData(recordForm);
      formData.set('_response', 'json');

      const xhr = new XMLHttpRequest();
      xhr.open('POST', recordForm.getAttribute('action') || window.location.href, true);
      xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

      const totalFileBytes = entries.reduce((sum, entry) => sum + entry.size, 0);
      xhr.upload.addEventListener('progress', (progressEvent) => {
        if (!progressEvent.lengthComputable || totalFileBytes <= 0) return;
        const scaledLoaded = Math.min(totalFileBytes, (progressEvent.loaded / progressEvent.total) * totalFileBytes);
        let cursor = 0;
        entries.forEach((entry) => {
          const fileLoaded = Math.min(entry.size, Math.max(0, scaledLoaded - cursor));
          const percent = Math.max(0, Math.min(100, Math.round((fileLoaded / entry.size) * 100)));
          updateProgressNode(
            entry.card,
            percent,
            percent >= 100 ? 'Upload completato, attendo conferma...' : 'Upload in corso...',
            'primary'
          );
          cursor += entry.size;
        });
      });

      const handleFailure = (message) => {
        setRecordSavingState(false);
        entries.forEach((entry) => resetProgressNode(entry.card));
        setRecordError(message || 'Impossibile salvare la scheda. Riprova.');
        recordSaveError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };

      xhr.addEventListener('load', () => {
        let payload = null;
        try {
          payload = JSON.parse(xhr.responseText || '{}');
        } catch (error) {
          payload = null;
        }

        if (xhr.status >= 200 && xhr.status < 300 && payload && payload.ok) {
          entries.forEach((entry) => updateProgressNode(entry.card, 100, 'Upload completato.', 'success'));
          window.location.assign(payload.redirect || window.location.href);
          return;
        }

        handleFailure(payload && payload.message ? payload.message : 'Salvataggio non riuscito. Correggi i dati e riprova.');
      });

      xhr.addEventListener('error', () => {
        handleFailure('Errore di rete durante il caricamento dei file.');
      });

      xhr.addEventListener('abort', () => {
        handleFailure('Upload annullato.');
      });

      xhr.send(formData);
    });
  }

  window.addEventListener('beforeunload', () => {
    uploadControllers.forEach((controller) => {
      controller.state.items.forEach((item) => {
        if (item.source === 'staged' && item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    });
  });

  refreshGalleryItems();
  })();
})();
