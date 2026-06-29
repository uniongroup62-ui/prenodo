(function(){
  'use strict';

  const configEl = document.getElementById('costsPageConfig');
  let costsPageConfig = {};
  if (configEl) {
    try {
      const parsedConfig = JSON.parse(configEl.textContent || '{}');
      costsPageConfig = parsedConfig && typeof parsedConfig === 'object' ? parsedConfig : {};
    } catch (e) {
      costsPageConfig = {};
    }
  }

  document.querySelectorAll('[data-cost-color]').forEach(function(badge){
    const color = String(badge.getAttribute('data-cost-color') || '').trim();
    if (/^#[0-9a-fA-F]{3,8}$/.test(color)) {
      badge.style.backgroundColor = color;
    }
  });

  document.addEventListener('click', function(event){
    const alertEl = event.target && event.target.closest ? event.target.closest('[data-alert]') : null;
    if (alertEl) {
      event.preventDefault();
      window.alert(alertEl.getAttribute('data-alert') || '');
      return;
    }

    const confirmEl = event.target && event.target.closest ? event.target.closest('[data-confirm]') : null;
    if (!confirmEl) return;
    const message = confirmEl.getAttribute('data-confirm') || 'Confermare?';
    if (!window.confirm(message)) event.preventDefault();
  });

  document.addEventListener('submit', function(event){
    const form = event.target;
    if (!form || !form.getAttribute) return;
    const message = form.getAttribute('data-confirm-submit') || '';
    if (message && !window.confirm(message)) event.preventDefault();
  });

(function(){
  const modalEl = document.getElementById('costCategoryCreateModal');
  if (!modalEl) return;

  modalEl.addEventListener('shown.bs.modal', function(){
    const name = modalEl.querySelector('input[name="name"]');
    if (name) {
      try { name.focus(); name.select(); } catch (e) {}
    }
  });

  if (costsPageConfig.openCategoryCreateModal && window.bootstrap && bootstrap.Modal) {
    try { bootstrap.Modal.getOrCreateInstance(modalEl).show(); } catch (e) {}
  }
})();

(function(){
        const chk = document.getElementById('is_recurring');
        const fields = document.querySelectorAll('.rec-fields');
        const endMode = document.getElementById('recurrence_end_mode');
        const endDateWrap = document.getElementById('recurrence_end_date_wrap');
        const endDate = document.getElementById('recurrence_end_date');

        function syncEndMode(){
          const useDate = !!(chk && chk.checked && endMode && endMode.value === 'date');
          if (endDateWrap) endDateWrap.style.display = useDate ? '' : 'none';
          if (endDate) endDate.disabled = !useDate;
        }

        function sync(){
          const on = chk && chk.checked;
          fields.forEach(el => { el.style.display = on ? '' : 'none'; });
          syncEndMode();
        }

        if (chk) chk.addEventListener('change', sync);
        if (endMode) endMode.addEventListener('change', syncEndMode);
        sync();
      })();

(function(){
  const track = document.getElementById('track_payments');
  const paid  = document.getElementById('paid_amount');
  const total = document.querySelector('input[name="amount"]');
  const preview = document.getElementById('paid_remaining_preview');
  const isPaid = document.getElementById('is_paid');

  function parseMoney(v){
    let s = (v || '').toString().trim().replace(/\s+/g,'');
    if (!s) return 0;
    // Gestione formati: "1.234,56" e "1234.56"
    const hasComma = s.indexOf(',') !== -1;
    const hasDot = s.indexOf('.') !== -1;
    if (hasComma && hasDot) {
      s = s.replace(/\./g,'').replace(',', '.');
    } else if (hasComma) {
      s = s.replace(',', '.');
    } else if ((s.match(/\./g) || []).length > 1) {
      s = s.replace(/\./g,'');
    }
    const n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }

  function fmtEUR(n){
    try { return new Intl.NumberFormat('it-IT', { style:'currency', currency:'EUR' }).format(n||0); }
    catch (e) { return '€ ' + (n||0).toFixed(2).replace('.', ','); }
  }

  function updatePreview(){
    if (!preview) return;
    if (!track || !track.checked || !total || !paid) { preview.textContent = ''; return; }
    const t = parseMoney(total.value);
    const p = parseMoney(paid.value);
    const r = Math.max(t - p, 0);
    preview.textContent = 'Residuo: ' + fmtEUR(r);
  }

  function syncPaidField(){
    if (!track || !paid) return;
    paid.disabled = !track.checked;
    updatePreview();
  }

  if (track) track.addEventListener('change', syncPaidField);
  if (total) total.addEventListener('input', updatePreview);
  if (paid) paid.addEventListener('input', updatePreview);
  if (isPaid) isPaid.addEventListener('change', function(){
    if (this.checked && track && track.checked && total && paid) {
      paid.value = total.value;
      updatePreview();
    }
  });

  syncPaidField();
  updatePreview();
})();

(function(){
  function norm(s){
    try { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
    catch(e){ return String(s || '').toLowerCase().trim(); }
  }

  function initCombobox(boxEl, items, selectedId, allValue, allLabel){
    if (!boxEl) return;
    const toggle = boxEl.querySelector('.app-combobox-toggle');
    const hidden = boxEl.querySelector('input[type="hidden"]');
    const search = boxEl.querySelector('.app-combobox-search');
    const list = boxEl.querySelector('.app-combobox-list');
    const textEl = boxEl.querySelector('.app-combobox-text');
    const placeholderEl = boxEl.querySelector('.app-combobox-placeholder');
    if (!toggle || !hidden || !search || !list || !textEl || !placeholderEl) return;

    const data = [{ id: String(allValue), label: String(allLabel), search: norm(allLabel) }].concat((items || []).map(function(it){
      return { id: String(it.id), label: String(it.label), search: norm(it.search || it.label) };
    }));

    function updateLabel(){
      const id = String(hidden.value || allValue);
      const it = data.find(function(x){ return x.id === id; }) || null;
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

    function render(){
      const q = norm(search.value);
      list.innerHTML = '';
      let shown = 0;
      data.forEach(function(it){
        if (q && String(it.search || '').indexOf(q) === -1) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dropdown-item';
        btn.textContent = it.label;
        btn.addEventListener('click', function(){
          hidden.value = it.id;
          updateLabel();
          try { bootstrap.Dropdown.getOrCreateInstance(toggle).hide(); } catch(e) {}
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
      setTimeout(function(){ try { search.focus(); search.select(); } catch(e) {} }, 0);
    });
  }

  const categoryItems = Array.isArray(costsPageConfig.categoryItems) ? costsPageConfig.categoryItems : [];

  initCombobox(document.getElementById('costCategoryFilterBox'), categoryItems, String(costsPageConfig.selectedCategoryFilterId || '0'), '0', 'Tutte');
  initCombobox(document.getElementById('costCategoryExactFilterBox'), categoryItems, String(costsPageConfig.selectedCategoryExactFilterId || '0'), '0', 'Tutte');
})();

(function(){
  function initBulkForm(form){
    if (!form) return;
    const checks = Array.from(form.querySelectorAll('[data-bulk-check]'));
    const master = form.querySelector('[data-bulk-master]');
    const buttons = Array.from(form.querySelectorAll('[data-bulk-submit]'));
    const count = form.querySelector('[data-bulk-count]');

    function sync(){
      const selected = checks.filter(function(ch){ return ch.checked; }).length;
      buttons.forEach(function(btn){ btn.disabled = selected === 0; });
      if (count) count.textContent = selected + (selected === 1 ? ' selezionato' : ' selezionati');
      if (master) {
        master.checked = selected > 0 && selected === checks.length;
        master.indeterminate = selected > 0 && selected < checks.length;
      }
    }

    if (master) {
      master.addEventListener('change', function(){
        checks.forEach(function(ch){ ch.checked = master.checked; });
        sync();
      });
    }
    checks.forEach(function(ch){ ch.addEventListener('change', sync); });
    sync();
  }

  initBulkForm(document.getElementById('costBulkForm'));
  initBulkForm(document.getElementById('categoryBulkForm'));
})();

(function(){
  const modal = document.getElementById('costSummaryModal');
  if (!modal) return;

  function setField(name, value){
    const el = modal.querySelector('[data-cost-summary-field="' + name + '"]');
    if (el) el.textContent = value || '-';
  }

  document.querySelectorAll('.js-cost-summary').forEach(function(btn){
    btn.addEventListener('click', function(){
      setField('title', btn.dataset.title);
      setField('due', btn.dataset.due);
      setField('status', btn.dataset.status);
      setField('location', btn.dataset.location);
      setField('category', btn.dataset.category);
      setField('supplier', btn.dataset.supplier);
      setField('recurring', btn.dataset.recurring);
      setField('total', btn.dataset.total);
      setField('paid', btn.dataset.paid);
      setField('remaining', btn.dataset.remaining);
      setField('payment', btn.dataset.payment);
      setField('doc', btn.dataset.doc);
      setField('docDate', btn.dataset.docDate);
      setField('notes', btn.dataset.notes);

      const wrap = modal.querySelector('[data-cost-summary-attachment-wrap]');
      const link = modal.querySelector('[data-cost-summary-attachment]');
      if (wrap && link) {
        const url = btn.dataset.attachmentUrl || '';
        if (url) {
          link.href = url;
          const span = link.querySelector('span');
          if (span) span.textContent = btn.dataset.attachmentName || 'Allegato';
          wrap.classList.remove('d-none');
        } else {
          link.href = '#';
          wrap.classList.add('d-none');
        }
      }
    });
  });
})();
})();
