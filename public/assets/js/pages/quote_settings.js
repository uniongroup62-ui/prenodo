(function () {
  const wrap = document.getElementById('pmRowsWrap');
  const addBtn = document.getElementById('pmAddBtn');

  if (!wrap || !addBtn) return;

  function rowCount() {
    return wrap.querySelectorAll('.pm-row').length;
  }

  function buildRow() {
    const row = document.createElement('div');
    row.className = 'row g-2 align-items-start pm-row mb-2';
    row.innerHTML = `
      <div class="col-md-4">
        <label class="form-label small mb-1">Nome</label>
        <input class="form-control" name="pm_name[]" placeholder="Es. Bonifico">
      </div>
      <div class="col-md-7">
        <label class="form-label small mb-1">Dettagli (opzionali)</label>
        <textarea class="form-control quote-settings-details" name="pm_details[]" rows="2" placeholder="Es. IBAN IT... / email / note..."></textarea>
      </div>
      <div class="col-md-1 d-grid">
        <button class="btn btn-outline-danger btn-sm pm-remove" type="button" title="Rimuovi"><i class="bi bi-trash"></i></button>
      </div>
    `;
    return row;
  }

  addBtn.addEventListener('click', () => {
    wrap.appendChild(buildRow());
  });

  wrap.addEventListener('click', (event) => {
    const btn = event.target && event.target.closest ? event.target.closest('.pm-remove') : null;

    if (!btn) return;

    const row = btn.closest('.pm-row');

    if (row) row.remove();
    if (rowCount() === 0) wrap.appendChild(buildRow());
  });
})();
