function clientSheetTemplatesReadJsonConfig(id) {
  const el = document.getElementById(id);
  if (!el) return {};
  try {
    return JSON.parse(el.textContent || '{}') || {};
  } catch (e) {
    return {};
  }
}

const CLIENT_SHEET_TEMPLATES_CONFIG = clientSheetTemplatesReadJsonConfig('clientSheetTemplatesConfig');

document.querySelectorAll('[data-delete-confirm]').forEach((button) => {
  button.addEventListener('click', (event) => {
    const message = button.getAttribute('data-delete-confirm') || 'Confermare eliminazione?';
    if (!confirm(message)) event.preventDefault();
  });
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

  const presets = CLIENT_SHEET_TEMPLATES_CONFIG.presets || {};
  const typeUi = CLIENT_SHEET_TEMPLATES_CONFIG.typeUi || {};
  let rowIndex = 1000;

  const splitOptions = (value) => String(value || '').split(/[\n,]+/).map((item) => item.trim()).filter((item) => item !== '');
  const setFieldInvalid = (input, invalid) => { if (input) input.classList.toggle('is-invalid', !!invalid); };
  const showValidation = (messages) => {
    if (!validationAlert) return;
    if (!messages.length) {
      validationAlert.classList.add('d-none');
      validationAlert.innerHTML = '';
      return;
    }
    validationAlert.classList.remove('d-none');
    validationAlert.innerHTML = '<div class="fw-semibold mb-2">Controlla i campi obbligatori prima di salvare il tab:</div>';
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

    typeSelect?.addEventListener('change', syncType);
    [labelInput, unitInput, optionsInput].forEach((input) => input?.addEventListener('input', () => setFieldInvalid(input, false)));
    removeBtn?.addEventListener('click', () => {
      const rows = builder.querySelectorAll('[data-field-row]');
      const allowEmpty = builder.getAttribute('data-allow-empty') === '1';
      if (rows.length <= 1) {
        if (allowEmpty) {
          row.remove();
          if (!builder.querySelector('[data-field-row]') && !builder.querySelector('[data-no-new-fields-message]')) {
            const note = document.createElement('div');
            note.className = 'text-muted small';
            note.setAttribute('data-no-new-fields-message', '1');
            note.textContent = 'Nessun nuovo campo aggiunto.';
            builder.appendChild(note);
          }
          return;
        }
        row.querySelectorAll('input[type="text"], input[type="hidden"], textarea').forEach((el) => { el.value = ''; });
        row.querySelectorAll('input[type="checkbox"]').forEach((el) => { el.checked = false; });
        if (typeSelect) typeSelect.value = 'text';
        syncType();
        return;
      }
      row.remove();
    });
    syncType();
  };

  const assignNames = (row, idx) => {
    row.querySelectorAll('[data-name]').forEach((el) => {
      const key = el.getAttribute('data-name');
      if (key) el.setAttribute('name', `fields[row_${idx}][${key}]`);
    });
  };
  const addRow = (field = {}) => {
    builder.querySelector('[data-no-new-fields-message]')?.remove();
    const fragment = tpl.content.cloneNode(true);
    const row = fragment.querySelector('[data-field-row]');
    rowIndex += 1;
    assignNames(row, rowIndex);
    row.querySelectorAll('[data-name]').forEach((el) => {
      const key = el.getAttribute('data-name');
      const value = Object.prototype.hasOwnProperty.call(field, key) ? field[key] : '';
      if (el.type === 'checkbox') el.checked = !!value;
      else if (key === 'options_raw' && Array.isArray(field.options)) el.value = field.options.join(', ');
      else el.value = value || '';
    });
    builder.appendChild(fragment);
    bindRow(builder.lastElementChild);
  };

  builder.querySelectorAll('[data-field-row]').forEach(bindRow);
  addBtn?.addEventListener('click', () => addRow({type: 'text'}));
  presetBtn?.addEventListener('click', () => {
    const rows = presets[presetSelect?.value || 'blank'] || [];
    const hasContent = Array.from(builder.querySelectorAll('[data-field-row]')).some((row) => {
      const input = row.querySelector('[data-field-label-input]');
      return input && input.value.trim() !== '';
    });
    if (hasContent && !confirm('Sostituire i campi attuali con il preset selezionato?')) return;
    builder.innerHTML = '';
    if (!rows.length) addRow({type: 'text'});
    else rows.forEach((field) => addRow(field));
    showValidation([]);
  });
  templateForm?.addEventListener('submit', (event) => {
    const rows = Array.from(builder.querySelectorAll('[data-field-row]'));
    const allowEmpty = builder.getAttribute('data-allow-empty') === '1';
    const messages = [];
    if (!rows.length && !allowEmpty) messages.push('Aggiungi almeno un campo personalizzato prima di salvare il tab.');
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
      if (unitMissing) messages.push(`${prefix}: compila Unita.`);
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
})();
