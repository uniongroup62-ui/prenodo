(function(){
  var configEl = document.getElementById('staffAvailabilityPageConfig');
  var staffAvailabilityConfig = {};
  if (configEl) {
    try {
      var parsedConfig = JSON.parse(configEl.textContent || '{}');
      staffAvailabilityConfig = parsedConfig && typeof parsedConfig === 'object' ? parsedConfig : {};
    } catch (e) {
      staffAvailabilityConfig = {};
    }
  }

  document.querySelectorAll('[data-timeline-left]').forEach(function(el){
    var left = String(el.getAttribute('data-timeline-left') || '').trim();
    if (/^\d+(?:\.\d+)?%$/.test(left)) {
      el.style.setProperty('--timeline-left', left);
    }
  });

  document.querySelectorAll('[data-timeline-width]').forEach(function(el){
    var width = String(el.getAttribute('data-timeline-width') || '').trim();
    if (/^\d+(?:\.\d+)?%$/.test(width)) {
      el.style.setProperty('--timeline-width', width);
    }
  });

  document.querySelectorAll('[data-staff-color]').forEach(function(el){
    var color = String(el.getAttribute('data-staff-color') || '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(color)) {
      el.style.backgroundColor = color;
    }
  });

  function qs(sel, root){ return (root||document).querySelector(sel); }

  document.addEventListener('click', function(ev){
    var link = ev.target && ev.target.closest ? ev.target.closest('[data-confirm]') : null;
    if (!link) return;
    var message = link.getAttribute('data-confirm') || 'Confermare?';
    if (!window.confirm(message)) ev.preventDefault();
  });

  var off = qs('#offcanvasEvent');
  if (!off) return;

  var titleEl = qs('#offcanvasEventLabel');
  var form = qs('#eventForm');

  // Modal: appointment conflicts
  var modalEl = qs('#modalApptConflicts');
  var tbodyEl = qs('#apptConflictsTbody');
  var btnConfirm = qs('#btnApptConflictsConfirm');
  var bsModal = null;

  function fmtDateIt(iso){
    iso = String(iso||'');
    var m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return iso;
    return m[3] + '/' + m[2] + '/' + m[1];
  }

  function esc(s){
    return String(s==null?'':s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  function showConflicts(conflicts){
    if (!modalEl || !tbodyEl || !btnConfirm) {
      // Fallback: simple confirm()
      var ok = confirm('Sono presenti appuntamenti già prenotati/in attesa negli orari selezionati. Vuoi continuare?');
      if (ok) {
        qs('#f_confirm_appt_conflicts').value = '1';
        if (form.requestSubmit) form.requestSubmit(); else form.submit();
      }
      return;
    }

    // Build rows
    var html = '';
    (conflicts||[]).forEach(function(c){
      var date = fmtDateIt(c.date || '');
      var tf = (c.time_from || '').toString();
      var tt = (c.time_to || '').toString();
      var ora = (tf && tt) ? (tf + ' - ' + tt) : (tf || tt || '');
      var client = c.client || '';
      var code = (c.public_code || '').trim();
      if (!code) code = '-';
      var service = c.service || '';

      html += '<tr>'
        + '<td>' + esc(date) + '</td>'
        + '<td>' + esc(ora) + '</td>'
        + '<td>' + esc(client) + '</td>'
        + '<td>' + esc(code) + '</td>'
        + '<td>' + esc(service) + '</td>'
        + '</tr>';
    });

    if (!html) {
      html = '<tr><td colspan="5" class="text-muted">Nessun appuntamento</td></tr>';
    }

    tbodyEl.innerHTML = html;

    // Open modal
    bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    bsModal.show();
  }

  function setRepeat(value){
    var r = form.querySelector('input[name="repeat"][value="'+value+'"]');
    if (r) r.checked = true;
  }

  function setDows(csv){
    var set = {};
    (csv||'').split(',').forEach(function(x){
      x = (x||'').trim();
      if (x !== '') set[x] = 1;
    });
    form.querySelectorAll('input[name="dows[]"]').forEach(function(cb){
      cb.checked = !!set[cb.value];
    });
  }

  function isShiftType(){
    var t = (qs('#f_type')||{}).value || '';
    t = String(t||'').toLowerCase();
    return (t === 'turno' || t === 'presenza');
  }

  function updateRepeatUI(){
    var repeat = (form.querySelector('input[name="repeat"]:checked')||{}).value || 'none';
    var dateFrom = qs('#f_date_from');
    var dateTo = qs('#f_date_to');
    var until = qs('#f_repeat_until');
    if (!dateTo || !until) return;

    var isRepeat = (repeat !== 'none');
    var lockRange = isRepeat || isShiftType();

    // Date "Al" is only meaningful for time-off, non-repeated events.
    // For shifts/presences we always keep it locked to the same day.
    // "Al" è obbligatorio: per i turni/presenze e per i ripetuti viene bloccato sullo stesso giorno.
    if (lockRange) {
      if (dateFrom && dateFrom.value) dateTo.value = dateFrom.value;
      dateTo.disabled = false;
      dateTo.readOnly = true;
      dateTo.setAttribute('readonly','readonly');
      dateTo.style.pointerEvents = 'none';
    } else {
      dateTo.disabled = false;
      dateTo.readOnly = false;
      dateTo.removeAttribute('readonly');
      dateTo.style.pointerEvents = '';
    }
    dateTo.required = true;

    // Repeat extras
    var dowChecks = form.querySelectorAll('input[name="dows[]"]');
    if (isRepeat) {
      until.disabled = false;
      until.required = true;
      dowChecks.forEach(function(cb){ cb.disabled = false; });
    } else {
      until.required = false;
      until.disabled = true;
      // Avoid stale values causing accidental repeats later
      until.value = '';
      dowChecks.forEach(function(cb){ cb.checked = false; cb.disabled = true; });
    }
  }

  // Bind repeat changes
  form.querySelectorAll('input[name="repeat"]').forEach(function(r){
    r.addEventListener('change', updateRepeatUI);
  });

  // Keep UI consistent when type/date changes
  var typeSel = qs('#f_type');
  if (typeSel) typeSel.addEventListener('change', updateRepeatUI);
  var dateFromEl = qs('#f_date_from');
  if (dateFromEl) dateFromEl.addEventListener('change', updateRepeatUI);

  function resetForm(prefill){
    prefill = prefill || {};
    titleEl.textContent = 'Nuovo evento';
    qs('#f_confirm_appt_conflicts').value = '0';
    qs('#f_event_id').value = '0';
    qs('#f_event_table').value = '';
    qs('#f_event_old_start').value = '';
    qs('#f_event_old_end').value = '';

    var defaultDate = prefill.date || String(staffAvailabilityConfig.date || '');
    qs('#f_date_from').value = defaultDate;
    qs('#f_date_to').value = defaultDate;
    qs('#f_time_from').value = '';
    qs('#f_time_to').value = '';
    qs('#f_repeat_until').value = '';
    qs('#f_apply_series').checked = false;
    qs('#seriesBox').style.display = 'none';

    setRepeat('none');
    form.querySelectorAll('input[name="dows[]"]').forEach(function(cb){ cb.checked = false; });

    // default staff
    var defaultStaff = (prefill.staff || String(staffAvailabilityConfig.focusStaffId || '0'));
    if (defaultStaff && defaultStaff !== '0') qs('#f_staff').value = defaultStaff;

    // default type
    qs('#f_type').value = prefill.type || 'Turno';

    updateRepeatUI();
  }

  // When opening via main button
  off.addEventListener('show.bs.offcanvas', function(){
    // If we are opening due to an edit/prefill, we don't reset here.
    if (off.dataset.mode !== 'edit' && off.dataset.mode !== 'prefill') {
      resetForm();
    }
    off.dataset.mode = '';
  });

  // Avoid stale values (repeat/date range) leaking between opens
  off.addEventListener('hidden.bs.offcanvas', function(){
    resetForm();
  });

  // Event delegation (works for day and weekly view)
  document.addEventListener('click', function(ev){
    // Add event from weekly cell
    var addBtn = ev.target.closest('.js-add-event');
    if (addBtn) {
      ev.preventDefault();
      off.dataset.mode = 'prefill';
      resetForm({
        staff: addBtn.getAttribute('data-staff') || '',
        date: addBtn.getAttribute('data-date') || String(staffAvailabilityConfig.date || '')
      });
      var bsOffcanvas = bootstrap.Offcanvas.getOrCreateInstance(off);
      bsOffcanvas.show();
      return;
    }

    // Edit event (day bars + weekly chips)
    var editBtn = ev.target.closest('.js-edit');
    if (!editBtn) return;
    ev.preventDefault();

    var box = editBtn.closest('[data-edit="1"]');
    if (!box) return;

    titleEl.textContent = 'Modifica evento';
    off.dataset.mode = 'edit';

    // reset confirmation flag (each save must run its own check)
    qs('#f_confirm_appt_conflicts').value = '0';

    qs('#f_event_id').value = box.getAttribute('data-id') || '0';
    qs('#f_event_table').value = box.getAttribute('data-table') || '';
    qs('#f_event_old_start').value = box.getAttribute('data-old-start') || '';
    qs('#f_event_old_end').value = box.getAttribute('data-old-end') || '';
    qs('#f_staff').value = box.getAttribute('data-staff') || '';
    qs('#f_type').value = box.getAttribute('data-type') || 'Turno';

    var df = box.getAttribute('data-date-from') || '';
    var dt = box.getAttribute('data-date-to') || df || '';
    qs('#f_date_from').value = df;
    qs('#f_date_to').value = dt;

    var tf = box.getAttribute('data-time-from') || '';
    var tt = box.getAttribute('data-time-to') || '';
    qs('#f_time_from').value = tf;
    qs('#f_time_to').value = tt;

    // Default: single event edit
    setRepeat('none');
    qs('#f_repeat_until').value = '';
    form.querySelectorAll('input[name="dows[]"]').forEach(function(cb){ cb.checked = false; });

    // Series (availability only)
    var series = box.getAttribute('data-series') || '';
    if (series && (box.getAttribute('data-table') === 'availability')) {
      qs('#seriesBox').style.display = '';

      // Prefill series settings if we have meta
      var rep = box.getAttribute('data-series-repeat') || '';
      var repUntil = box.getAttribute('data-series-until') || '';
      var dows = box.getAttribute('data-series-dows') || '';
      var rangeTo = box.getAttribute('data-series-range-to') || '';

      if (rangeTo) {
        // contiguous series -> date range
        qs('#f_date_to').value = rangeTo;
        setRepeat('none');
      } else if (rep && rep !== 'none') {
        setRepeat(rep);
        if (repUntil) qs('#f_repeat_until').value = repUntil;
        if (dows) setDows(dows);
      }
    } else {
      qs('#seriesBox').style.display = 'none';
      qs('#f_apply_series').checked = false;
    }

    updateRepeatUI();

    var bsOffcanvas = bootstrap.Offcanvas.getOrCreateInstance(off);
    bsOffcanvas.show();
  });

  // Confirm button in the conflicts modal
  if (btnConfirm) {
    btnConfirm.addEventListener('click', function(){
      qs('#f_confirm_appt_conflicts').value = '1';
      try {
        var m = bootstrap.Modal.getInstance(modalEl);
        if (m) m.hide();
      } catch(e) {}
      if (form.requestSubmit) form.requestSubmit(); else form.submit();
    });
  }

  // Before saving, check if there are existing appointments for the selected operator
  // in the same date/time range (statuses: pending/scheduled).
  form.addEventListener('submit', function(ev){
    var confEl = qs('#f_confirm_appt_conflicts');
    if (confEl && confEl.value === '1') return; // already confirmed

    // Let the browser show required/invalid-field messages.
    if (typeof form.reportValidity === 'function' && !form.reportValidity()) {
      ev.preventDefault();
      return;
    }

    ev.preventDefault();

    var fd = new FormData(form);
    fd.set('do', 'check_appt_conflicts');

    fetch('index.php?page=staff_availability', {
      method: 'POST',
      body: fd,
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
    .then(function(res){
      return res.json();
    })
    .then(function(data){
      var conflicts = (data && data.ok && Array.isArray(data.conflicts)) ? data.conflicts : [];
      if (conflicts.length > 0) {
        showConflicts(conflicts);
        return;
      }
      // No conflicts (or degraded safe): submit normally.
      if (confEl) confEl.value = '1';
      if (form.requestSubmit) form.requestSubmit(); else form.submit();
    })
    .catch(function(){
      // If the check fails, do not block the user.
      if (confEl) confEl.value = '1';
      if (form.requestSubmit) form.requestSubmit(); else form.submit();
    });
  });

  // Ensure the initial UI state is consistent
  updateRepeatUI();
})();
