(function(){
  function readRechargesConfig(id){
    const el = document.getElementById(id);
    if (!el) return {};
    try {
      const parsed = JSON.parse(el.textContent || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  const rechargesConfig = readRechargesConfig('rechargesPageConfig');
  const fidelityEnabled = !!rechargesConfig.fidelityEnabled;

  document.querySelectorAll('[data-confirm-template-delete]').forEach((form) => {
    form.addEventListener('submit', (ev) => {
      const title = form.getAttribute('data-confirm-template-delete') || '';
      if (!window.confirm('Eliminare il modello: ' + title + '?')) {
        ev.preventDefault();
      }
    });
  });

  // Modal modello
  const modalEl = document.getElementById('templateModal');
  if (modalEl) {
    modalEl.addEventListener('show.bs.modal', (ev) => {
      const btn = ev.relatedTarget;
      const mode = btn && btn.getAttribute('data-mode') ? btn.getAttribute('data-mode') : 'create';

      const form = document.getElementById('templateForm');
      const modeEl = document.getElementById('template_mode');
      const idEl = document.getElementById('template_id_field');
      const titleEl = document.getElementById('t_title');
      const baseEl = document.getElementById('t_base_amount');
      const bkEl = document.getElementById('t_bonus_kind');
      const bvEl = document.getElementById('t_bonus_value');
      const epEl = document.getElementById('t_earn_points');
      const actEl = document.getElementById('t_is_active');
      const sortEl = document.getElementById('t_sort_order');
      const titleH = document.getElementById('templateModalTitle');

      const syncEarnPointsState = (currentMode) => {
        if (!epEl) return;
        if (!fidelityEnabled) {
          epEl.disabled = true;
          if (currentMode === 'create') epEl.checked = false;
          return;
        }
        epEl.disabled = false;
      };

      const setBvState = () => {
        if (!bkEl || !bvEl) return;
        const disabled = (bkEl.value === 'none');
        bvEl.disabled = disabled;
        if (disabled) bvEl.value = '0';
      };

      if (mode === 'edit') {
        if (titleH) titleH.textContent = 'Modifica modello';
        if (modeEl) modeEl.value = 'update_template';
        if (idEl) idEl.value = btn.getAttribute('data-template-id') || '';
        if (titleEl) titleEl.value = btn.getAttribute('data-title') || '';
        if (baseEl) baseEl.value = btn.getAttribute('data-base-amount') || '';
        if (bkEl) bkEl.value = btn.getAttribute('data-bonus-kind') || 'none';
        setBvState();
        if (bvEl) bvEl.value = btn.getAttribute('data-bonus-value') || '0';
        if (epEl) epEl.checked = (btn.getAttribute('data-earn-points') === '1');
        if (actEl) actEl.checked = (btn.getAttribute('data-is-active') === '1');
        if (sortEl) sortEl.value = btn.getAttribute('data-sort-order') || '0';
        syncEarnPointsState('edit');
      } else {
        if (titleH) titleH.textContent = 'Nuovo modello';
        if (modeEl) modeEl.value = 'create_template';
        if (idEl) idEl.value = '';
        if (titleEl) titleEl.value = '';
        if (baseEl) baseEl.value = '';
        if (bkEl) bkEl.value = 'none';
        setBvState();
        if (bvEl) bvEl.value = '0';
        if (epEl) epEl.checked = true;
        if (actEl) actEl.checked = true;
        if (sortEl) sortEl.value = '0';
        syncEarnPointsState('create');
      }

    });
    const bkPersistentEl = document.getElementById('t_bonus_kind');
    const bvPersistentEl = document.getElementById('t_bonus_value');
    if (bkPersistentEl && bvPersistentEl) {
      bkPersistentEl.addEventListener('change', () => {
        const disabled = (bkPersistentEl.value === 'none');
        bvPersistentEl.disabled = disabled;
        if (disabled) bvPersistentEl.value = '0';
      });
    }
  }
})();
