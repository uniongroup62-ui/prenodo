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

  function toast(message, variant){
    try{
      const container = document.getElementById('appToastContainer') || document.body;
      const value = String(variant || 'info');
      const allowed = ['primary','secondary','success','danger','warning','info','light','dark'];
      const bgClass = allowed.includes(value) ? `text-bg-${value}` : 'text-bg-info';
      const el = document.createElement('div');
      el.className = `toast align-items-center ${bgClass} border-0 app-toast`;
      el.setAttribute('role','alert');
      el.setAttribute('aria-live','assertive');
      el.setAttribute('aria-atomic','true');
      el.innerHTML = `
        <div class="d-flex">
          <div class="toast-body">${String(message || '')}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Chiudi"></button>
        </div>
      `;
      container.appendChild(el);
      if (window.bootstrap && window.bootstrap.Toast) {
        const instance = window.bootstrap.Toast.getOrCreateInstance(el, { delay: 4500 });
        el.addEventListener('hidden.bs.toast', function(){ el.remove(); });
        instance.show();
      } else {
        setTimeout(function(){
          try { el.remove(); } catch(_e) {}
        }, 4500);
      }
    } catch(_e) {
      alert(message);
    }
  }

  function restoreMoveButtons(group, fallbackButton){
    try{
      const buttons = group ? Array.from(group.querySelectorAll('button')) : [fallbackButton];
      buttons.filter(Boolean).forEach(function(button){
        const prev = (button.dataset && button.dataset.prevDisabled) ? button.dataset.prevDisabled : '0';
        button.disabled = (prev === '1');
        try { delete button.dataset.prevDisabled; } catch(_e) {}
      });
    } catch(_e) {}
  }

  function disableMoveButtons(group, fallbackButton){
    try{
      const buttons = group ? Array.from(group.querySelectorAll('button')) : [fallbackButton];
      buttons.filter(Boolean).forEach(function(button){
        try { button.dataset.prevDisabled = button.disabled ? '1' : '0'; } catch(_e) {}
        button.disabled = true;
      });
    } catch(_e) {
      if (fallbackButton) fallbackButton.disabled = true;
    }
  }

  function initBulkSelection(){
    const selectAll = document.getElementById('apptSelectAll');
    const checkboxes = Array.from(document.querySelectorAll('.appt-select'));
    const selectableCheckboxes = checkboxes.filter(function(checkbox){ return !checkbox.disabled; });
    const info = document.getElementById('bulkSelInfo');
    const idsField = document.getElementById('bulkDeleteIds');
    const btn = document.getElementById('bulkDeleteBtn');

    function syncBulk(){
      const ids = selectableCheckboxes.filter(function(checkbox){ return checkbox.checked; }).map(function(checkbox){ return checkbox.value; });
      if (idsField) idsField.value = ids.join(',');
      if (info) info.textContent = (ids.length ? (ids.length + ' selezionati') : '0 selezionati');
      if (btn) btn.disabled = (ids.length === 0);

      if (selectAll) {
        const allChecked = selectableCheckboxes.length > 0 && selectableCheckboxes.every(function(checkbox){ return checkbox.checked; });
        const someChecked = selectableCheckboxes.some(function(checkbox){ return checkbox.checked; });
        selectAll.checked = allChecked;
        selectAll.indeterminate = !allChecked && someChecked;
        if (selectableCheckboxes.length === 0) {
          selectAll.checked = false;
          selectAll.indeterminate = false;
        }
      }
    }

    if (selectAll) {
      selectAll.addEventListener('change', function(){
        selectableCheckboxes.forEach(function(checkbox){ checkbox.checked = selectAll.checked; });
        syncBulk();
      });
    }
    checkboxes.forEach(function(checkbox){ checkbox.addEventListener('change', syncBulk); });
    syncBulk();
  }

  function restoreOpenMultiserviceGroup(){
    try{
      const openGroupId = sessionStorage.getItem('ms_open_group');
      if (openGroupId) {
        sessionStorage.removeItem('ms_open_group');
        const toggleBtn = document.querySelector(`tr.ms-parent[data-ms-group="${openGroupId}"] .ms-toggle`);
        if (toggleBtn) toggleBtn.click();
      }
    } catch(_e) {}
  }

  async function handleSegmentMove(event){
    const btnMove = event.target.closest('.ms-seg-move');
    if (!btnMove) return;
    event.preventDefault();
    if (btnMove.disabled) return;

    const direction = (btnMove.getAttribute('data-ms-move') || '').trim();
    const appointmentId = (btnMove.getAttribute('data-appt') || '').trim();
    const segmentId = (btnMove.getAttribute('data-seg') || '').trim();
    if (!direction || !appointmentId || !segmentId) return;

    const group = btnMove.closest('.btn-group') || btnMove.parentElement;
    disableMoveButtons(group, btnMove);

    try{
      const row = btnMove.closest('tr');
      const groupId = row ? (row.getAttribute('data-ms-child') || '') : '';
      if (groupId) sessionStorage.setItem('ms_open_group', groupId);
    } catch(_e) {}

    const csrf = (document.querySelector('meta[name="csrf-token"]') || {}).content || '';
    const formData = new FormData();
    formData.append('_csrf', csrf);
    formData.append('action', 'swap_segment');
    formData.append('id', appointmentId);
    formData.append('segment_id', segmentId);
    formData.append('direction', direction);

    try{
      const response = await fetch('index.php?page=api_appointments', { method: 'POST', body: formData });
      const data = await response.json();
      if (!data || !data.ok) {
        toast((data && data.error) ? data.error : 'Operazione non riuscita', 'danger');
        restoreMoveButtons(group, btnMove);
        return;
      }
      toast('Ordine multi-servizio aggiornato.', 'success');
      setTimeout(function(){ window.location.reload(); }, 250);
    } catch(error) {
      toast('Errore di rete durante l\'aggiornamento.', 'danger');
      restoreMoveButtons(group, btnMove);
    }
  }

  function initQuickBookingOpen(){
    const config = parseJsonScript('appointmentsPageConfig') || {};
    const openEditId = parseInt(config.openEditId || '0', 10) || 0;
    const openNew = !!config.openNew;
    try{
      if (openEditId > 0) {
        if (window.qbOpenEditAppointment) window.qbOpenEditAppointment(openEditId);
      } else if (openNew) {
        if (window.qbOpenNewAppointment) window.qbOpenNewAppointment();
      }
    } catch(_e) {}
  }

  function initAppointmentColors(){
    document.querySelectorAll('[data-appointment-color]').forEach(function(dot){
      const color = String(dot.getAttribute('data-appointment-color') || '').trim();
      if (/^#[0-9a-fA-F]{6}$/.test(color)) {
        dot.style.backgroundColor = color;
      }
    });
  }

  function initConfirmHandlers(){
    document.addEventListener('click', function(event){
      const target = event.target.closest('[data-confirm]');
      if (!target) return;
      const message = target.getAttribute('data-confirm') || 'Confermare?';
      if (!window.confirm(message)) event.preventDefault();
    });

    document.addEventListener('submit', function(event){
      const form = event.target;
      if (!form || !form.getAttribute) return;
      const message = form.getAttribute('data-confirm-submit') || '';
      if (message && !window.confirm(message)) event.preventDefault();
    });
  }

  window.addEventListener('DOMContentLoaded', function(){
    initAppointmentColors();
    initConfirmHandlers();
    initBulkSelection();
    restoreOpenMultiserviceGroup();
    document.addEventListener('click', handleSegmentMove);
    initQuickBookingOpen();
  });
})();
