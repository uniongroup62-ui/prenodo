const POS_CONFIG = (() => {
  const el = document.getElementById('posPageConfig');
  try {
    return el ? JSON.parse(el.textContent || '{}') : {};
  } catch (err) {
    return {};
  }
})();
window.POS_PAGE_CONFIG = POS_CONFIG;

(function(){
  const tbody = document.querySelector('#itemsTable tbody');

  function fmtEUR(n){
    n = (typeof n === 'number' && isFinite(n)) ? n : 0;
    return '€ ' + n.toFixed(2).replace('.', ',');
  }

  function escapeHtml(v){
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getRowStatusMeta(type){
    type = String(type || '').toLowerCase().trim();
    if (type === 'service') {
      return { onLabel: 'Eseguito', offLabel: 'Prepagato', onValue: 'executed', offValue: 'prepaid' };
    }
    if (type === 'product') {
      return { onLabel: 'Ritirato', offLabel: 'Ordinato', onValue: 'collected', offValue: 'ordered' };
    }
    return null;
  }

  function getGiftboxRequiredStatus(type){
    type = String(type || '').toLowerCase().trim();
    if (type === 'service') return 'prepaid';
    if (type === 'product') return 'ordered';
    return '';
  }

  function getGiftboxEligibilityRows(){
    if (!tbody) return [];
    return Array.from(tbody.querySelectorAll('tr[data-item-row]')).map(tr => {
      const type = String(tr.dataset.type || '').toLowerCase().trim();
      if (!['service', 'product'].includes(type)) return null;
      const required = getGiftboxRequiredStatus(type);
      const current = String(tr.dataset.itemStatus || '').toLowerCase().trim();
      if (!required || current === required) return null;
      const nameEl = tr.querySelector('.pos-item-name');
      const name = String(nameEl ? nameEl.textContent : '').trim() || (type === 'service' ? 'Servizio' : 'Prodotto');
      return { type, name };
    }).filter(Boolean);
  }

  function getGiftboxEligibilityMessage(){
    const rows = getGiftboxEligibilityRows();
    if (!rows.length) return '';

    const services = rows.filter(r => r.type === 'service').map(r => r.name);
    const products = rows.filter(r => r.type === 'product').map(r => r.name);
    const parts = [];
    const excerpt = (arr) => {
      const names = Array.from(new Set((arr || []).map(v => String(v || '').trim()).filter(Boolean)));
      if (!names.length) return '';
      const shown = names.slice(0, 3).join(', ');
      return names.length > 3 ? (shown + ', ...') : shown;
    };

    if (services.length) {
      const names = excerpt(services);
      parts.push('i servizi devono essere impostati come Prepagato' + (names ? (' (' + names + ')') : ''));
    }
    if (products.length) {
      const names = excerpt(products);
      parts.push('i prodotti devono essere impostati come Ordinato' + (names ? (' (' + names + ')') : ''));
    }

    return parts.length ? ('Per creare una GiftBox, ' + parts.join(' e ') + '.') : '';
  }

  function syncItemStatusControl(tr){
    if (!tr) return;
    const meta = getRowStatusMeta(tr.dataset.type || '');
    if (!meta) return;

    const toggle = tr.querySelector('.js-item-status-toggle');
    const hidden = tr.querySelector('input[name$="[item_status]"]');
    const badge = tr.querySelector('.js-item-status-label');
    if (!toggle || !hidden || !badge) return;

    const checked = !!toggle.checked;
    const value = checked ? meta.onValue : meta.offValue;
    hidden.value = value;
    tr.dataset.itemStatus = value;
    badge.textContent = checked ? meta.onLabel : meta.offLabel;
    badge.className = 'badge rounded-pill js-item-status-label ' + (checked ? 'text-bg-success' : 'text-bg-secondary');
  }

  function buildItemStatusControl(type, idx, currentStatus){
    const meta = getRowStatusMeta(type);
    if (!meta) return '';
    const checked = String(currentStatus || '') === meta.onValue;
    const statusId = 'pos_item_status_' + String(idx);
    return `
      <div class="mt-1 d-flex align-items-center gap-2 flex-wrap">
        <span class="badge rounded-pill js-item-status-label ${checked ? 'text-bg-success' : 'text-bg-secondary'}">${checked ? meta.onLabel : meta.offLabel}</span>
        <div class="form-check form-switch m-0">
          <input class="form-check-input js-item-status-toggle" type="checkbox" id="${statusId}" ${checked ? 'checked' : ''}>
          <label class="form-check-label small text-muted" for="${statusId}">${meta.onLabel} / ${meta.offLabel}</label>
        </div>
        <input type="hidden" name="items[${idx}][item_status]" value="${checked ? meta.onValue : meta.offValue}">
      </div>
    `;
  }

  function ensureEmpty(){
    if (!tbody) return;
    if (tbody.querySelector('tr[data-item-row]')) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-muted p-3">Aggiungi almeno un elemento.</td></tr>';
    if (window.posOnCartChange) window.posOnCartChange();
  }


  // Helpers: regole di esclusività GiftCard / GiftBox (vendita standalone)
  function posCartHasGiftcard(){
    if (!tbody) return false;
    return !!tbody.querySelector('tr[data-item-row][data-type="giftcard"]');
  }
  function posCartHasRecharge(){
    if (!tbody) return false;
    return !!tbody.querySelector('tr[data-item-row][data-type="recharge"]');
  }
  function posCartHasStandalonePackage(){
    if (!tbody) return false;
    const rows = Array.from(tbody.querySelectorAll('tr[data-item-row][data-type="package"]'));
    return rows.some(tr => String(tr.dataset.inGiftbox || '0') !== '1');
  }
  function posCartHasServiceProductRecharge(){
    if (!tbody) return false;
    return !!tbody.querySelector('tr[data-item-row][data-type="service"], tr[data-item-row][data-type="product"], tr[data-item-row][data-type="recharge"]');
  }
  function posCartHasNonRechargeItems(){
    if (!tbody) return false;
    return !!tbody.querySelector('tr[data-item-row][data-type="service"], tr[data-item-row][data-type="product"], tr[data-item-row][data-type="package"], tr[data-item-row][data-type="giftcard"]');
  }
  function posCartHasNonGiftcardItems(){
    if (!tbody) return false;
    // In vendita GiftCard non sono cumulabili servizi/prodotti/pacchetti/ricariche.
    return !!tbody.querySelector('tr[data-item-row][data-type="service"], tr[data-item-row][data-type="product"], tr[data-item-row][data-type="package"], tr[data-item-row][data-type="recharge"]');
  }

  // espongo per altri script
  window.posCartHasGiftcard = posCartHasGiftcard;
  window.posCartHasRecharge = posCartHasRecharge;
  window.posCartHasStandalonePackage = posCartHasStandalonePackage;
  window.posCartHasServiceProductRecharge = posCartHasServiceProductRecharge;
  window.posCartHasNonRechargeItems = posCartHasNonRechargeItems;
  window.posCartHasNonGiftcardItems = posCartHasNonGiftcardItems;
  window.posGetGiftboxEligibilityMessage = getGiftboxEligibilityMessage;

  window.recalcRow = function(tr){
    const qtyInput = tr.querySelector('input[name$="[qty]"]');
    const qty = Math.max(1, parseInt(qtyInput.value || '1', 10) || 1);
    qtyInput.value = qty;

    const price = parseFloat(tr.dataset.price || '0') || 0;
    const lineTotal = Math.round(price * qty * 100) / 100;
    tr.dataset.lineTotal = lineTotal.toFixed(2);
    tr.querySelector('.line-total').textContent = fmtEUR(lineTotal);

    if (window.posOnCartChange) window.posOnCartChange();
  };

  window.addItem = function(type){
    const sel = document.getElementById(type === 'service' ? 'serviceSelect' : 'productSelect');
    if (!sel || !sel.value) return;

    if (window.posQuoteLockActive && window.posQuoteLockActive()) {
      alert(window.posQuoteLockMessage('Con un preventivo collegato non puoi aggiungere elementi al carrello.'));
      return;
    }

    // Regola: se è presente una GiftCard in carrello, non permettere altri elementi.
    if (typeof window.posCartHasGiftcard === 'function' && window.posCartHasGiftcard()) {
      alert('Non puoi aggiungere altri elementi: è presente una GiftCard in carrello. Rimuovila per continuare.');
      return;
    }

    // Regola: se è presente una ricarica in carrello, la vendita deve restare composta solo dalla ricarica.
    if (typeof window.posCartHasRecharge === 'function' && window.posCartHasRecharge()) {
      alert('Non puoi aggiungere servizi o prodotti: è presente una ricarica in carrello. Le ricariche vanno vendute da sole.');
      return;
    }

    // se tabella vuota, rimuove placeholder
    const placeholder = tbody.querySelector('tr:not([data-item-row])');
    if (placeholder) placeholder.remove();

    const opt = sel.options[sel.selectedIndex];
    const id = sel.value;
    const name = opt.dataset.name || opt.textContent;
    const price = parseFloat(opt.dataset.price || '0') || 0;

    // Evita righe duplicate per lo stesso servizio/prodotto:
    // se gia presente nel carrello, incrementa la quantita.
    const sameRows = Array.from(tbody.querySelectorAll('tr[data-item-row]')).filter((r)=>{
      return String(r.dataset.type || '').trim() === String(type)
        && String(r.dataset.id || '').trim() === String(id);
    });
    if (sameRows.length > 0) {
      const target = sameRows[0];
      const qtyInput = target.querySelector('input[name$="[qty]"]');
      if (qtyInput) {
        let baseQty = Math.max(1, parseInt(qtyInput.value || '1', 10) || 1);

        // Se nel carrello esistono gia duplicati storici, li consolida sulla prima riga.
        if (sameRows.length > 1) {
          for (let i = 1; i < sameRows.length; i++) {
            const qEl = sameRows[i].querySelector('input[name$="[qty]"]');
            const q = Math.max(1, parseInt((qEl && qEl.value) || '1', 10) || 1);
            baseQty += q;
            sameRows[i].remove();
          }
        }

        const nextQty = Math.min(1000, baseQty + 1);
        qtyInput.value = String(nextQty);
        window.recalcRow(target);
      }

      sel.value = '';
      if (window.posOnCartChange) window.posOnCartChange();
      return;
    }

    const tr = document.createElement('tr');
    tr.dataset.itemRow = '1';
    tr.dataset.type = type;
    tr.dataset.id = id;
    tr.dataset.price = price.toFixed(2);
    tr.dataset.lineTotal = price.toFixed(2);

    let defaultStatus = (type === 'service') ? 'executed' : 'collected';
    try {
      if (typeof gbHasDraft === 'function' && gbHasDraft()) {
        defaultStatus = getGiftboxRequiredStatus(type) || defaultStatus;
      }
    } catch (e) {}
    tr.dataset.itemStatus = defaultStatus;

    const idx = String(Date.now()) + String(Math.floor(Math.random()*1000));
    const itemStatusHtml = buildItemStatusControl(type, idx, tr.dataset.itemStatus);

    tr.innerHTML = `
      <td class="text-uppercase small">${escapeHtml(type)}</td>
      <td>
        <div class="fw-semibold pos-item-name">${escapeHtml(name)}</div>
        ${itemStatusHtml}
        <input type="hidden" name="items[${idx}][type]" value="${escapeHtml(type)}">
        <input type="hidden" name="items[${idx}][id]" value="${escapeHtml(id)}">
      </td>
      <td>
        <input class="form-control form-control-sm pos-qty-input" type="number" min="1" step="1" name="items[${idx}][qty]" value="1">
      </td>
      <td class="text-end small">${fmtEUR(price)}</td>
      <td class="text-end small line-total">${fmtEUR(price)}</td>
      <td class="text-end">
        <button type="button" class="btn btn-sm btn-outline-danger">✕</button>
      </td>
    `;

    const qtyInput = tr.querySelector('input[name$="[qty]"]');
    qtyInput.addEventListener('input', ()=> window.recalcRow(tr));
    qtyInput.addEventListener('change', ()=> window.recalcRow(tr));

    const statusToggle = tr.querySelector('.js-item-status-toggle');
    if (statusToggle) {
      statusToggle.addEventListener('change', ()=>{
        syncItemStatusControl(tr);
        try {
          if (typeof gbHasDraft === 'function' && gbHasDraft()) {
            const required = getGiftboxRequiredStatus(tr.dataset.type || '');
            if (required && String(tr.dataset.itemStatus || '').toLowerCase().trim() !== required) {
              statusToggle.checked = false;
              syncItemStatusControl(tr);
              alert(String(tr.dataset.type || '').toLowerCase().trim() === 'service'
                ? 'Con GiftBox attiva, i servizi devono essere impostati come Prepagato.'
                : 'Con GiftBox attiva, i prodotti devono essere impostati come Ordinato.');
            }
          }
        } catch (e) {}
        if (window.posOnCartChange) window.posOnCartChange();
      });
      syncItemStatusControl(tr);
    }

    tr.querySelector('button').addEventListener('click', ()=>{
      tr.remove();
      const stillHasItems = !!tbody.querySelector('tr[data-item-row]');
      ensureEmpty();
      // Aggiorna sempre i totali / promo quando un elemento viene rimosso.
      // (ensureEmpty() chiama posOnCartChange solo se la tabella diventa vuota)
      if (stillHasItems) {
        if (window.posOnCartChange) window.posOnCartChange();
      }
    });

    tbody.prepend(tr);
    sel.value = '';

    if (window.posOnCartChange) window.posOnCartChange();
  };


  // ------------------------------
  // Pacchetti -> aggiungi al carrello (acquisto alla chiusura vendita)
  // ------------------------------
  const PK_DEFAULT_VALIDITY_VALUE = Number(POS_CONFIG.packageDefaultValidityValue || 0) || 0;
  const PK_DEFAULT_VALIDITY_UNIT = String(POS_CONFIG.packageDefaultValidityUnit || 'days');
  let pkPackageExpiryTouched = false;

  function pkTodayYMD(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${dd}`;
  }

  function pkFmtDate(ymd){
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim());
    if (!m) return String(ymd || '').trim();
    return `${m[3]}/${m[2]}/${m[1]}`;
  }

  function pkParseYmdToDate(ymd){
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim());
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || (dt.getMonth() + 1) !== mo || dt.getDate() !== d) return null;
    return dt;
  }

  function pkIsoDate(dt){
    if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return '';
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function pkAddMonthsClampedYmd(ymd, months){
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim());
    if (!m) return '';
    let y = Number(m[1]);
    let mo = Number(m[2]);
    let d = Number(m[3]);
    let total = (y * 12) + (mo - 1) + (parseInt(months, 10) || 0);
    if (total < 0) total = 0;
    y = Math.floor(total / 12);
    mo = (total % 12) + 1;
    const dim = new Date(y, mo, 0).getDate();
    if (d > dim) d = dim;
    return pkIsoDate(new Date(y, mo - 1, d));
  }

  function pkAddDurationYmd(ymd, value, unit){
    const v = parseInt(value || '0', 10) || 0;
    if (v <= 0) return '';
    unit = String(unit || 'days').toLowerCase();
    if (unit === 'months') return pkAddMonthsClampedYmd(ymd, v);
    if (unit === 'years') return pkAddMonthsClampedYmd(ymd, v * 12);
    const dt = pkParseYmdToDate(ymd);
    if (!dt) return '';
    dt.setDate(dt.getDate() + v);
    return pkIsoDate(dt);
  }

  function pkCalculatePackageExpiry(startDate, meta){
    if (!meta || !meta.id) return '';
    return pkAddDurationYmd(startDate, meta.validityValue || 0, meta.validityUnit || 'days');
  }

  function pkCloseModal(){
    const modalEl = document.getElementById('posModalPackages');
    if (!modalEl) return;
    try {
      bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    } catch (e) {
      modalEl.classList.remove('show');
      modalEl.style.display = 'none';
    }
  }

  function pkResetModal(){
    const sel = document.getElementById('posPackageSelect');
    const sd = document.getElementById('posPackageStartDate');
    const ex = document.getElementById('posPackageExpiresAt');
    const note = document.getElementById('posPackageNote');
    const exp = document.getElementById('posPackageExpiryHint');

    pkPackageExpiryTouched = false;
    if (sel) sel.value = '';
    if (sd) sd.value = pkTodayYMD();
    if (ex) {
      ex.value = '';
      ex.min = '';
    }
    if (note) note.value = '';
    if (exp) exp.textContent = '';

    const gbInfo = document.getElementById('posPackageGiftboxModeInfo');
    if (gbInfo) gbInfo.classList.add('d-none');
  }

  function pkGetSelectedMeta(){
    const sel = document.getElementById('posPackageSelect');
    const opt = sel && sel.selectedOptions && sel.selectedOptions[0] ? sel.selectedOptions[0] : null;
    const id = sel ? String(sel.value || '').trim() : '';
    const name = opt ? (String(opt.dataset.name || '').trim() || String(opt.textContent || '').trim()) : '';
    const price = opt ? (parseFloat(String(opt.dataset.price || '0').replace(',', '.')) || 0) : 0;
    const validityDays = opt ? (parseInt(String(opt.dataset.validityDays || '0'), 10) || 0) : 0;
    let validityValue = validityDays;
    let validityUnit = 'days';
    let validitySource = validityDays > 0 ? 'catalog' : 'none';
    if (validityDays <= 0) {
      validityValue = parseInt(String(PK_DEFAULT_VALIDITY_VALUE || '0'), 10) || 0;
      validityUnit = String(PK_DEFAULT_VALIDITY_UNIT || 'days').toLowerCase();
      if (!['days','months','years'].includes(validityUnit)) validityUnit = 'days';
      validitySource = validityValue > 0 ? 'default' : 'none';
    }
    return { id, name, price, validityDays, validityValue, validityUnit, validitySource };
  }

  function pkSyncExpiryHint(){
    const exp = document.getElementById('posPackageExpiryHint');
    if (!exp) return;

    const meta = pkGetSelectedMeta();
    if (!meta.id) {
      exp.textContent = '';
      return;
    }
    const sdEl = document.getElementById('posPackageStartDate');
    const startDate = String(sdEl ? sdEl.value : '').trim() || pkTodayYMD();

    const gbActive = (typeof gbHasDraft === 'function') ? !!gbHasDraft() : false;
    const gbMode = gbActive;

    if (meta.validityDays > 0) {
      const expYmd = (typeof gbAddDaysYmd === 'function') ? gbAddDaysYmd(startDate, meta.validityDays) : '';
      exp.textContent = `Validità pacchetto: ${meta.validityDays} giorni` + (expYmd ? (` • Scadenza prevista: ${pkFmtDate(expYmd)}`) : '');
    } else {
      exp.textContent = gbMode ? 'Questo pacchetto non ha giorni validità: verrà usata la scadenza GiftBox predefinita (modificabile).' : 'Questo pacchetto non ha giorni validità impostati.';
    }
  }

  function pkSyncExpiryHint(){
    const exp = document.getElementById('posPackageExpiryHint');
    if (!exp) return;

    const meta = pkGetSelectedMeta();
    if (!meta.id) {
      exp.textContent = '';
      const exElEmpty = document.getElementById('posPackageExpiresAt');
      if (exElEmpty && !pkPackageExpiryTouched) exElEmpty.value = '';
      return;
    }

    const sdEl = document.getElementById('posPackageStartDate');
    const startDate = String(sdEl ? sdEl.value : '').trim() || pkTodayYMD();
    const exEl = document.getElementById('posPackageExpiresAt');
    const minTo = pkAddDurationYmd(startDate, 1, 'days');
    if (exEl) exEl.min = minTo || '';

    const calculatedExpiry = pkCalculatePackageExpiry(startDate, meta);
    if (exEl && (!pkPackageExpiryTouched || !String(exEl.value || '').trim())) {
      exEl.value = calculatedExpiry || '';
    }

    const gbActive = (typeof gbHasDraft === 'function') ? !!gbHasDraft() : false;
    if (calculatedExpiry) {
      const source = meta.validitySource === 'catalog' ? 'catalogo pacchetto' : 'impostazioni pacchetti';
      exp.textContent = `Scadenza proposta da ${source}: ${pkFmtDate(calculatedExpiry)}`;
    } else {
      exp.textContent = gbActive ? 'Questo pacchetto non ha una scadenza automatica: la GiftBox restera gestibile manualmente.' : 'Questo pacchetto non ha una scadenza automatica.';
    }
  }

  function pkAddRowToCart(data){
    if (!tbody) return;


    // Regola: se è presente una GiftCard in carrello, non permettere pacchetti.
    if (typeof window.posCartHasGiftcard === 'function' && window.posCartHasGiftcard()) {
      alert('Non puoi aggiungere pacchetti: è presente una GiftCard in carrello. Rimuovila per continuare.');
      return;
    }

    // Regola: le ricariche vanno vendute da sole.
    if (typeof window.posCartHasRecharge === 'function' && window.posCartHasRecharge()) {
      alert('Non puoi aggiungere pacchetti: è presente una ricarica in carrello. Le ricariche vanno vendute da sole.');
      return;
    }

    // se tabella vuota, rimuove placeholder
    const placeholder = tbody.querySelector('tr:not([data-item-row])');
    if (placeholder) placeholder.remove();

    const tr = document.createElement('tr');
    tr.dataset.itemRow = '1';
    tr.dataset.type = 'package';
    tr.dataset.id = String(data.package_id || '');
    tr.dataset.name = String(data.package_name || '').trim();
    tr.dataset.price = Number(data.price || 0).toFixed(2);
    tr.dataset.lineTotal = Number(data.price || 0).toFixed(2);
    tr.dataset.startDate = String(data.start_date || '').trim();
    tr.dataset.expiresAt = String(data.expires_at || '').trim();
    tr.dataset.validityDays = String(parseInt(data.validity_days || '0', 10) || 0);
    tr.dataset.validityValue = String(parseInt(data.validity_value || data.validity_days || '0', 10) || 0);
    tr.dataset.validityUnit = String(data.validity_unit || 'days').trim() || 'days';
    tr.dataset.inGiftbox = data.in_giftbox ? '1' : '0';

    const idx = String(Date.now()) + String(Math.floor(Math.random()*1000));

    const startLabel = data.start_date ? ('Valido dal: ' + pkFmtDate(data.start_date)) : '';
    const expiresLabel = data.expires_at ? (' - Valido al: ' + pkFmtDate(data.expires_at)) : '';
    const noteLabel = data.note ? (' • ' + String(data.note)) : '';

    const gbBadge = data.in_giftbox ? ' • <span class="badge text-bg-primary">GiftBox</span>' : '';

    const elLabel = `Pacchetto • ${String(data.package_name || '').trim()}` + gbBadge;

    tr.innerHTML = `
      <td class="text-uppercase small">pacchetto</td>
      <td>
        <div class="fw-semibold">${elLabel}</div>
        <div class="text-muted small">${startLabel}${expiresLabel}${noteLabel}</div>

        <input type="hidden" name="items[${idx}][type]" value="package">
        <input type="hidden" name="items[${idx}][id]" value="${String(data.package_id || '')}">
        <input type="hidden" name="items[${idx}][qty]" value="1">

        <input type="hidden" name="items[${idx}][package_start_date]" value="${String(data.start_date || '')}">
        <input type="hidden" name="items[${idx}][package_expires_at]" value="${String(data.expires_at || '')}">
        <input type="hidden" name="items[${idx}][package_note]" value="${String(data.note || '')}">
        <input type="hidden" name="items[${idx}][in_giftbox]" value="${data.in_giftbox ? '1' : '0'}">
      </td>
      <td>
        <input class="form-control form-control-sm pos-qty-input" type="number" value="1" disabled>
      </td>
      <td class="text-end small">${fmtEUR(Number(data.price || 0))}</td>
      <td class="text-end small line-total">${fmtEUR(Number(data.price || 0))}</td>
      <td class="text-end">
        <button type="button" class="btn btn-sm btn-outline-danger">✕</button>
      </td>
    `;

    tr.querySelector('button').addEventListener('click', ()=>{
      tr.remove();
      const stillHasItems = !!tbody.querySelector('tr[data-item-row]');
      ensureEmpty();
      // Aggiorna sempre i totali / promo quando un elemento viene rimosso.
      // (ensureEmpty() chiama posOnCartChange solo se la tabella diventa vuota)
      if (stillHasItems) {
        if (window.posOnCartChange) window.posOnCartChange();
      }
    });

    tbody.prepend(tr);

    if (window.posOnCartChange) window.posOnCartChange();
  }

  // Aggiorna dinamicamente il flag "in GiftBox" per le righe pacchetto già presenti in carrello.
  function pkEscHtml(s){
    return String(s || '').replace(/[&<>"']/g, (m)=>({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m] || m));
  }

  function pkSetRowInGiftbox(tr, inGiftbox){
    if (!tr) return;
    const flag = inGiftbox ? '1' : '0';
    tr.dataset.inGiftbox = flag;

    // hidden input
    const hid = tr.querySelector('input[type="hidden"][name$="[in_giftbox]"]');
    if (hid) hid.value = flag;

    // label + badge
    const nm = String(tr.dataset.name || '').trim() || 'Pacchetto';
    const labelEl = tr.querySelector('td:nth-child(2) .fw-semibold');
    if (labelEl) {
      const badge = inGiftbox ? ' • <span class="badge text-bg-primary">GiftBox</span>' : '';
      labelEl.innerHTML = 'Pacchetto • ' + pkEscHtml(nm) + badge;
    }
  }

  function pkSetAllInGiftbox(inGiftbox){
    const tableBody = document.querySelector('#itemsTable tbody');
    if (!tableBody) return;
    const rows = Array.from(tableBody.querySelectorAll('tr[data-item-row][data-type="package"]'));
    rows.forEach(tr => pkSetRowInGiftbox(tr, inGiftbox));
  }

  // Espone helper per altri script (es. GiftBox)
  window.posPkSetAllInGiftbox = pkSetAllInGiftbox;

  const pkAddBtn = document.getElementById('posPackageAddBtn');
  if (pkAddBtn) pkAddBtn.addEventListener('click', ()=>{
    try {

      if (typeof window.posCartHasGiftcard === 'function' && window.posCartHasGiftcard()) {
        alert('Non puoi aggiungere pacchetti: è presente una GiftCard in carrello. Rimuovila per continuare.');
        return;
      }
      const sel = document.getElementById('posPackageSelect');
      const packageId = sel ? String(sel.value || '').trim() : '';
      if (!packageId) return alert('Seleziona un pacchetto.');

      const meta = pkGetSelectedMeta();
      const packageName = meta.name || packageId;
      const price = meta.price || 0;
      const validityDays = meta.validityDays || 0;

      const clientId = (typeof selectedClientId === 'function') ? String(selectedClientId() || '').trim() : '';
      const gbActive = (typeof gbHasDraft === 'function') ? !!gbHasDraft() : false;
      // Il pacchetto viene inserito nella GiftBox solo se la GiftBox è attiva.
      // Se non c'è cliente e la GiftBox non è attiva, il pacchetto può essere comunque aggiunto
      // ma la vendita verrà bloccata in chiusura finché non si seleziona un cliente o si attiva la GiftBox.
      const wantGiftbox = gbActive;

      // Blocco: GiftBox e Ricariche non possono essere abbinate
      if (wantGiftbox && typeof window.posCartHasRecharge === 'function' && window.posCartHasRecharge()) {
        return alert('Non puoi aggiungere un pacchetto in GiftBox: è presente una ricarica in carrello. Rimuovila per continuare.');
      }

      // Se è in GiftBox, verifica che la feature sia disponibile e attiva automaticamente la bozza
      const __giftboxEnabled = !!POS_CONFIG.giftboxEnabled;
      if (wantGiftbox && !__giftboxEnabled) {
        return alert('GiftBox non disponibile (modulo o DB non aggiornato).');
      }

      const sdEl = document.getElementById('posPackageStartDate');
      const startDate = String(sdEl ? sdEl.value : '').trim() || pkTodayYMD();
      if (!pkParseYmdToDate(startDate)) return alert('Data "Valido dal" non valida.');

      const exEl = document.getElementById('posPackageExpiresAt');
      let expiresAt = String(exEl ? exEl.value : '').trim();
      if (!expiresAt) expiresAt = pkCalculatePackageExpiry(startDate, meta);
      if (expiresAt && !pkParseYmdToDate(expiresAt)) return alert('Data "Valido al" non valida.');
      if (expiresAt && startDate >= expiresAt) return alert('La data "Valido al" deve essere successiva a "Valido dal".');

      const noteEl = document.getElementById('posPackageNote');
      const note = String(noteEl ? noteEl.value : '').trim();

      pkAddRowToCart({
        package_id: packageId,
        package_name: packageName,
        price: price,
        validity_days: validityDays,
        validity_value: meta.validityValue || 0,
        validity_unit: meta.validityUnit || 'days',
        start_date: startDate,
        expires_at: expiresAt,
        note: note,
        in_giftbox: wantGiftbox ? 1 : 0
      });

      // Se abbinato alla GiftBox:
      // - attiva bozza GiftBox (anche senza servizi/prodotti)
      // - imposta automaticamente validità GiftBox in base al pacchetto
      if (wantGiftbox) {
        try {
          if (typeof gbEnsureDraft === 'function') {
            gbEnsureDraft();
          }
          // Priorità alle date del pacchetto
          const vf = startDate;
          const vt = expiresAt;

          const draftFrom = document.getElementById('pos_giftbox_valid_from');
          const draftTo = document.getElementById('pos_giftbox_valid_to');
          if (draftFrom) draftFrom.value = vf;
          if (vt && draftTo) draftTo.value = vt;

          // Se il modal GiftBox è aperto, aggiorna live
          const gbModalEl = document.getElementById('posModalGiftbox');
          if (gbModalEl && gbModalEl.classList.contains('show') && typeof gbRenderModal === 'function') {
            gbRenderModal();
          }
        } catch (e) {
          console.warn('GiftBox date sync failed', e);
        }
      }

      pkCloseModal();
      pkResetModal();
    } catch (err) {
      console.error('Package POS error', err);
      alert('Errore durante l\'aggiunta del pacchetto al carrello.');
    }
  });

  // UX: aggiornamento scadenza al cambio pacchetto/data
  const pkSelEl = document.getElementById('posPackageSelect');
  const pkSdEl = document.getElementById('posPackageStartDate');
  const pkExEl = document.getElementById('posPackageExpiresAt');
  if (pkSelEl) pkSelEl.addEventListener('change', pkSyncExpiryHint);
  if (pkSdEl) {
    pkSdEl.addEventListener('change', pkSyncExpiryHint);
    pkSdEl.addEventListener('input', pkSyncExpiryHint);
  }
  if (pkExEl) {
    pkExEl.addEventListener('input', ()=>{
      pkPackageExpiryTouched = String(pkExEl.value || '').trim() !== '';
      pkSyncExpiryHint();
    });
    pkExEl.addEventListener('change', ()=>{
      pkPackageExpiryTouched = String(pkExEl.value || '').trim() !== '';
      pkSyncExpiryHint();
    });
  }


// ------------------------------
// Ricariche (credito) -> aggiungi al carrello
// ------------------------------
const rcModalEl   = document.getElementById('posModalRecharge');
const rcTplSel    = document.getElementById('posRechargeTemplateSelect');
const rcAmountInp = document.getElementById('posRechargeAmount');
const rcBonusKind = document.getElementById('posRechargeBonusKind');
const rcBonusVal  = document.getElementById('posRechargeBonusValue');
const rcEarnPts   = document.getElementById('posRechargeEarnPoints');
const rcNoteInp   = document.getElementById('posRechargeNote');
const rcPrevBase  = document.getElementById('posRechargePrevBase');
const rcPrevBonus = document.getElementById('posRechargePrevBonus');
const rcPrevTotal = document.getElementById('posRechargePrevTotal');
const rcPrevPts   = document.getElementById('posRechargePrevPoints');
const rcHelp      = document.getElementById('posRechargeClientHelp');
const rcAddBtn    = document.getElementById('posRechargeAddBtn');

const rcFeatureEnabled = !!POS_CONFIG.rechargeEnabled;
const rcPointsFeatureEnabled = !!POS_CONFIG.rechargePointsFeatureEnabled;
const rcMoneyMax = Number(POS_CONFIG.rechargeMoneyMax || 0) || 0;
const rcPreviewPointsApi = 'index.php?page=pos&mode=preview_recharge_points';
const rcCsrf = document.getElementById('posForm')?.querySelector('input[name="_csrf"]')?.value || '';
let rcPreviewSeq = 0;
let rcLastPointsKey = '';
let rcLastPointsValue = 0;

// Regola UX: una sola ricarica per vendita.
// Se la ricarica è già nel carrello, riaprendo il modal precompiliamo i dati per modificarla.
function rcFindExistingRow(){
  if (!tbody) return null;
  return tbody.querySelector('tr[data-item-row][data-type="recharge"]');
}

function rcRemoveExistingRows(){
  if (!tbody) return;
  tbody.querySelectorAll('tr[data-item-row][data-type="recharge"]').forEach(r => r.remove());
}

function rcGetRowField(tr, suffix){
  if (!tr) return '';
  const inp = tr.querySelector('input[name$="[' + suffix + ']"]');
  return inp ? String(inp.value || '') : '';
}

function rcSetEditMode(isEdit){
  if (rcAddBtn) rcAddBtn.textContent = isEdit ? 'Salva' : 'Aggiungi alla lista';
  // titolo modal (opzionale)
  try {
    const t = rcModalEl?.querySelector('.modal-title');
    if (t) t.textContent = isEdit ? 'Modifica ricarica credito' : 'Ricarica credito';
  } catch (e) {}
}

function rcLoadFromRow(tr){
  if (!tr) return false;
  const tplId = parseInt(rcGetRowField(tr, 'recharge_template_id') || tr.dataset.id || '0', 10) || 0;
  const amount = rcGetRowField(tr, 'recharge_amount') || '';
  const bk = rcGetRowField(tr, 'recharge_bonus_kind') || 'none';
  const bv = rcGetRowField(tr, 'recharge_bonus_value') || '0';
  const earn = !!(rcGetRowField(tr, 'recharge_earn_points') || '').trim();
  const note = rcGetRowField(tr, 'recharge_note') || '';

  if (rcTplSel) rcTplSel.value = tplId > 0 ? String(tplId) : '';
  if (rcAmountInp) rcAmountInp.value = String(amount);
  if (rcBonusKind) rcBonusKind.value = String(bk || 'none');
  rcBonusEnable();
  if (rcBonusVal) rcBonusVal.value = String(bv);
  if (rcEarnPts) rcEarnPts.checked = earn;
  if (rcNoteInp) rcNoteInp.value = String(note);

  rcCalcPreview();
  rcSyncClientState();
  rcSetEditMode(true);
  return true;
}


function rcNormMoney(x){
  if (x === null || x === undefined) return 0;
  let s = String(x).trim().replace(',', '.');
  let n = parseFloat(s);
  if (!isFinite(n)) n = 0;
  if (n < 0) n = 0;
  return Math.round(n * 100) / 100;
}

function rcFmtPts(n){
  n = (typeof n === 'number' && isFinite(n)) ? n : parseFloat(String(n || '0').replace(',', '.'));
  if (!isFinite(n)) n = 0;
  if (n > 0) return String(Math.floor(n + 1e-9));
  if (n < 0) return String(Math.ceil(n - 1e-9));
  return '0';
}

function rcEsc(s){
  s = String(s ?? '');
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function rcBonusEnable(){
  if (!rcBonusKind || !rcBonusVal) return;
  const k = String(rcBonusKind.value || 'none');
  if (k === 'none') {
    rcBonusVal.value = '0';
    rcBonusVal.setAttribute('disabled', 'disabled');
  } else {
    rcBonusVal.removeAttribute('disabled');
  }
}

function rcSelectedClientId(){
  const clientSel = document.getElementById('posClient');
  return String(clientSel?.value || '').trim();
}

function rcPointsKey(clientId, amount){
  return [String(clientId || ''), Number(amount || 0).toFixed(2)].join('|');
}

async function rcFetchPointsPreview(clientId, amount, key, render){
  amount = rcNormMoney(amount);
  if (!rcPointsFeatureEnabled || !clientId || amount <= 0.00001) {
    if (render && rcPrevPts) rcPrevPts.textContent = '0';
    return { points: 0, error: null };
  }

  const seq = ++rcPreviewSeq;
  if (render && rcPrevPts) {
    rcPrevPts.textContent = '...';
    rcPrevPts.removeAttribute('title');
  }

  try {
    const fd = new FormData();
    fd.append('_csrf', rcCsrf);
    fd.append('client_id', String(clientId));
    fd.append('amount', Number(amount).toFixed(2));
    const res = await fetch(rcPreviewPointsApi, { method: 'POST', body: fd, headers: { 'Accept': 'application/json' } });
    const j = await res.json();
    const pts = j && j.ok ? Number(j.points || 0) : 0;
    const safePts = isFinite(pts) ? Math.max(0, pts) : 0;

    if (seq === rcPreviewSeq && key === rcPointsKey(clientId, amount)) {
      rcLastPointsKey = key;
      rcLastPointsValue = safePts;
      if (render && rcPrevPts) {
        rcPrevPts.textContent = rcFmtPts(safePts);
        const campaign = String(j?.campaign_name || '').trim();
        const error = String(j?.error || '').trim();
        if (campaign) rcPrevPts.title = 'Campagna: ' + campaign;
        else if (error) rcPrevPts.title = error;
        else rcPrevPts.removeAttribute('title');
      }
    }

    return { points: safePts, error: j?.error || null };
  } catch (e) {
    if (seq === rcPreviewSeq && render && rcPrevPts) {
      rcPrevPts.textContent = '0';
      rcPrevPts.title = 'Preview punti non disponibile: il calcolo verra eseguito alla chiusura vendita.';
    }
    return { points: 0, error: 'Preview punti non disponibile.' };
  }
}

function rcSyncClientState(){
    if (!rcFeatureEnabled) {
      if (rcHelp) {
        rcHelp.textContent = 'Funzione ricariche non disponibile.';
        rcHelp.classList.add('text-danger');
      }
      if (rcAddBtn) rcAddBtn.disabled = true;
      if (rcEarnPts) {
        rcEarnPts.checked = false;
        rcEarnPts.disabled = true;
      }
      rcCalcPreview();
      return false;
    }
  if (!rcHelp && !rcAddBtn) return;

  const clientSel = document.getElementById('posClient');
  const opt = clientSel?.selectedOptions?.[0] || null;
  const cid = opt?.value ? String(opt.value) : '';
  const adhering = String(opt?.getAttribute('data-adhering') || '0') === '1';

  let ok = true;
  let msg = '';

  if (!cid) {
    ok = false;
    msg = 'Seleziona un cliente per aggiungere una ricarica.';
  } else if (!adhering) {
    msg = 'La ricarica verrà associata al cliente anche senza Fidelity attiva. In questo caso non verranno accreditati punti.';
  } else {
    msg = 'La ricarica verrà registrata alla chiusura vendita (Concludi).';
  }

  if (rcEarnPts) {
    const canEarnPoints = !!(cid && adhering && rcPointsFeatureEnabled);
    if (!canEarnPoints) rcEarnPts.checked = false;
    rcEarnPts.disabled = !canEarnPoints;
  }
if (rcHelp) {
    rcHelp.textContent = msg;
    rcHelp.classList.toggle('text-danger', !ok);
  }
  if (rcAddBtn) rcAddBtn.disabled = !ok;
  rcCalcPreview();
  return ok;
}

function rcCalcPreview(){
  const base = rcNormMoney(rcAmountInp?.value || 0);
  const kind = String(rcBonusKind?.value || 'none');
  const val  = rcNormMoney(rcBonusVal?.value || 0);

  let bonus = 0;
  if (kind === 'percent') bonus = base * (val / 100.0);
  else if (kind === 'fixed') bonus = val;
  bonus = Math.round(Math.max(0, bonus) * 100) / 100;

  const total = Math.round((base + bonus) * 100) / 100;

  const pointsBase = (rcPointsFeatureEnabled && rcEarnPts && rcEarnPts.checked) ? total : base;
  const clientId = rcSelectedClientId();
  const pointsKey = rcPointsKey(clientId, pointsBase);
  let pts = (pointsKey === rcLastPointsKey) ? rcLastPointsValue : 0;

  if (rcPrevBase)  rcPrevBase.textContent  = fmtEUR(base);
  if (rcPrevBonus) rcPrevBonus.textContent = fmtEUR(bonus);
  if (rcPrevTotal) rcPrevTotal.textContent = fmtEUR(total);
  if (rcPrevPts) {
    if (rcPointsFeatureEnabled && clientId && pointsBase > 0.00001 && pointsKey !== rcLastPointsKey) {
      rcPrevPts.textContent = '...';
    } else {
      rcPrevPts.textContent = rcFmtPts(pts);
    }
  }

  if (rcPointsFeatureEnabled && clientId && pointsBase > 0.00001 && pointsKey !== rcLastPointsKey) {
    rcFetchPointsPreview(clientId, pointsBase, pointsKey, true);
  } else if (!(rcPointsFeatureEnabled && clientId && pointsBase > 0.00001)) {
    rcPreviewSeq++;
    rcLastPointsKey = '';
    rcLastPointsValue = 0;
  }

  return { base, kind, val, bonus, total, pts, pointsBase, pointsKey };
}

async function rcResolvePointsPreview(cal){
  if (!cal || !rcPointsFeatureEnabled) return cal;
  const clientId = rcSelectedClientId();
  const pointsBase = rcNormMoney(cal.pointsBase || 0);
  const key = cal.pointsKey || rcPointsKey(clientId, pointsBase);
  if (!clientId || pointsBase <= 0.00001) {
    cal.pts = 0;
    return cal;
  }
  if (key === rcLastPointsKey) {
    cal.pts = rcLastPointsValue;
    return cal;
  }
  const info = await rcFetchPointsPreview(clientId, pointsBase, key, true);
  cal.pts = Number(info.points || 0);
  if (!isFinite(cal.pts) || cal.pts < 0) cal.pts = 0;
  return cal;
}

function rcApplyTemplate(){
  if (!rcTplSel) return;
  const opt = rcTplSel.selectedOptions?.[0] || null;
  if (!opt) return;

  const base = opt.getAttribute('data-base-amount') || '';
  const bk   = opt.getAttribute('data-bonus-kind') || 'none';
  const bv   = opt.getAttribute('data-bonus-value') || '0';
  const ep   = opt.getAttribute('data-earn-points') || '0';

  if (rcAmountInp) rcAmountInp.value = String(base);
  if (rcBonusKind) rcBonusKind.value = String(bk);
  if (rcBonusVal)  rcBonusVal.value  = String(bv);
  if (rcEarnPts)   rcEarnPts.checked = rcPointsFeatureEnabled ? (String(ep) === '1') : false;

  rcBonusEnable();
  rcCalcPreview();
}

function rcReset(){
  if (rcTplSel) rcTplSel.value = '';
  if (rcAmountInp) rcAmountInp.value = '';
  if (rcBonusKind) rcBonusKind.value = 'none';
  if (rcBonusVal)  rcBonusVal.value = '0';
  if (rcEarnPts)   rcEarnPts.checked = rcPointsFeatureEnabled ? true : false;
  if (rcNoteInp)   rcNoteInp.value = '';
  rcBonusEnable();
  rcCalcPreview();
  rcSyncClientState();
  rcSetEditMode(false);
}

if (rcTplSel) rcTplSel.addEventListener('change', ()=>{
  if (rcTplSel.value) rcApplyTemplate();
  else rcCalcPreview();
});

if (rcAmountInp) rcAmountInp.addEventListener('input', rcCalcPreview);
if (rcBonusKind) rcBonusKind.addEventListener('change', ()=>{ rcBonusEnable(); rcCalcPreview(); });
if (rcBonusVal)  rcBonusVal.addEventListener('input', rcCalcPreview);
if (rcEarnPts)   rcEarnPts.addEventListener('change', rcCalcPreview);
const rcClientSel = document.getElementById('posClient');
if (rcClientSel) rcClientSel.addEventListener('change', rcSyncClientState);

// Reset e sync su apertura modal
if (rcModalEl) {
  rcModalEl.addEventListener('show.bs.modal', (ev)=>{
    // Blocco: ricariche non cumulabili con GiftCard o GiftBox
    try {
      if (typeof window.posCartHasGiftcard === 'function' && window.posCartHasGiftcard()) {
        if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
        alert('Non puoi aggiungere ricariche: è presente una GiftCard in carrello. Rimuovila per continuare.');
        return;
      }
    } catch (e) {}
    try {
      if (typeof window.posCartHasStandalonePackage === 'function' && window.posCartHasStandalonePackage()) {
        if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
        alert('Non puoi aggiungere ricariche: è presente un pacchetto in carrello. Concludi una vendita separata oppure rimuovi il pacchetto.');
        return;
      }
    } catch (e) {}
    try {
      if (typeof gbHasDraft === 'function' && gbHasDraft()) {
        if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
        alert('Non puoi aggiungere ricariche: è presente una GiftBox in questa vendita. Elimina la GiftBox per continuare.');
        return;
      }
    } catch (e) {}
    try {
      if (typeof window.posCartHasNonRechargeItems === 'function' && window.posCartHasNonRechargeItems()) {
        if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
        alert('Non puoi aggiungere ricariche: sono già presenti altri elementi in carrello. Le ricariche vanno vendute da sole.');
        return;
      }
    } catch (e) {}

    // Se esiste già una ricarica nel carrello, apri il modal in modalità modifica.
    const existing = rcFindExistingRow();
    if (existing) rcLoadFromRow(existing);
    else rcReset();
  });
}

if (rcAddBtn) rcAddBtn.addEventListener('click', async ()=>{
  // Blocco: ricariche non cumulabili con GiftCard o GiftBox
  try {
    if (typeof window.posCartHasGiftcard === 'function' && window.posCartHasGiftcard()) {
      alert('Non puoi aggiungere ricariche: è presente una GiftCard in carrello. Rimuovila per continuare.');
      return;
    }
  } catch (e) {}
  try {
    if (typeof window.posCartHasStandalonePackage === 'function' && window.posCartHasStandalonePackage()) {
      alert('Non puoi aggiungere ricariche: è presente un pacchetto in carrello. Concludi una vendita separata oppure rimuovi il pacchetto.');
      return;
    }
  } catch (e) {}
  try {
    if (typeof gbHasDraft === 'function' && gbHasDraft()) {
      alert('Non puoi aggiungere ricariche: è presente una GiftBox in questa vendita. Elimina la GiftBox per continuare.');
      return;
    }
  } catch (e) {}
  try {
    if (typeof window.posCartHasNonRechargeItems === 'function' && window.posCartHasNonRechargeItems()) {
      alert('Non puoi aggiungere ricariche: sono già presenti altri elementi in carrello. Le ricariche vanno vendute da sole.');
      return;
    }
  } catch (e) {}

  // Client ok?
  if (!rcSyncClientState()) return;
  const tplId = parseInt(rcTplSel?.value || '0', 10) || 0;
  const tplOpt = rcTplSel?.selectedOptions?.[0] || null;

  const cal = await rcResolvePointsPreview(rcCalcPreview());
  if (cal.base <= 0.00001) {
    alert('Inserisci un importo di ricarica valido.');
    return;
  }
  if (cal.base > rcMoneyMax) {
    alert('Importo ricarica troppo alto. Massimo ' + fmtEUR(rcMoneyMax) + '.');
    return;
  }
  if (cal.val > rcMoneyMax) {
    alert('Valore bonus troppo alto. Massimo ' + fmtEUR(rcMoneyMax) + '.');
    return;
  }
  if (cal.bonus > rcMoneyMax || cal.total > rcMoneyMax) {
    alert('Totale credito troppo alto. Massimo ' + fmtEUR(rcMoneyMax) + '.');
    return;
  }

  // Regola: una sola ricarica per vendita (se già presente, la sostituiamo).
  rcRemoveExistingRows();

  // se tabella vuota, rimuove placeholder
  const placeholder = tbody.querySelector('tr:not([data-item-row])');
  if (placeholder) placeholder.remove();

  const tr = document.createElement('tr');
  tr.dataset.itemRow = '1';
  tr.dataset.type = 'recharge';
  tr.dataset.id = String(tplId);
  tr.dataset.price = Number(cal.base || 0).toFixed(2);
  tr.dataset.lineTotal = Number(cal.base || 0).toFixed(2);

  const idx = String(Date.now()) + String(Math.floor(Math.random()*1000));
  const tplTitle = tplId ? ((tplOpt?.getAttribute('data-title') || tplOpt?.textContent || '').trim()) : '';

  const elLabel = `Ricarica credito${tplTitle ? (' • ' + tplTitle) : ''}`;
  const noteTxt = (rcNoteInp?.value || '').trim();

  const subBits = [];
  subBits.push('Credito: ' + fmtEUR(cal.total));
  if (cal.bonus > 0.00001) subBits.push('Bonus: ' + fmtEUR(cal.bonus));
  if (rcPointsFeatureEnabled) subBits.push('Punti: ' + rcFmtPts(cal.pts) + ((rcEarnPts && rcEarnPts.checked) ? ' (importo + bonus)' : ' (solo importo)'));
  if (noteTxt) subBits.push(noteTxt);

  tr.innerHTML = `
    <td class="text-uppercase small">ricarica</td>
    <td>
      <div class="fw-semibold">${rcEsc(elLabel)}</div>
      <div class="text-muted small">${rcEsc(subBits.join(' • '))}</div>

      <input type="hidden" name="items[${idx}][type]" value="recharge">
      <input type="hidden" name="items[${idx}][id]" value="${String(tplId)}">
      <input type="hidden" name="items[${idx}][qty]" value="1">

      <input type="hidden" name="items[${idx}][recharge_template_id]" value="${String(tplId)}">
      <input type="hidden" name="items[${idx}][recharge_template_title]" value="${rcEsc(tplTitle)}">
      <input type="hidden" name="items[${idx}][recharge_amount]" value="${Number(cal.base || 0).toFixed(2)}">
      <input type="hidden" name="items[${idx}][recharge_bonus_kind]" value="${rcEsc(cal.kind)}">
      <input type="hidden" name="items[${idx}][recharge_bonus_value]" value="${Number(cal.val || 0).toFixed(2)}">
      <input type="hidden" name="items[${idx}][recharge_earn_points]" value="${(rcEarnPts && rcEarnPts.checked) ? '1' : ''}">
      <input type="hidden" name="items[${idx}][recharge_note]" value="${rcEsc(noteTxt)}">
    </td>
    <td>
      <input class="form-control form-control-sm pos-qty-input" type="number" value="1" disabled>
    </td>
    <td class="text-end small">${fmtEUR(Number(cal.base || 0))}</td>
    <td class="text-end small line-total">${fmtEUR(Number(cal.base || 0))}</td>
    <td class="text-end">
      <button type="button" class="btn btn-sm btn-outline-danger">✕</button>
    </td>
  `;

  tr.querySelector('button').addEventListener('click', ()=>{
    tr.remove();
    ensureEmpty();
    if (window.posOnCartChange) window.posOnCartChange();
  });

  tbody.prepend(tr);

  ensureEmpty();
  if (window.posOnCartChange) window.posOnCartChange();

  // Chiudi modal
  try { bootstrap.Modal.getInstance(rcModalEl)?.hide(); } catch(e){}
});

  // ------------------------------
  // GiftCard -> aggiungi al carrello
  // ------------------------------
  function gcNormMoney(x){
    if (x === null || x === undefined) return 0;
    if (typeof x === 'number') return isFinite(x) ? x : 0;
    x = String(x).trim().replace(',', '.');
    return parseFloat(x) || 0;
  }
  function gcIsEmail(v){
    v = String(v || '').trim();
    if (!v) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  function gcTodayYMD(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${dd}`;
  }

  // Default scadenza GiftCard (impostazioni in "Profilo attività")
  const GC_DEFAULT_VALIDITY_VALUE = Number(POS_CONFIG.giftcardDefaultValidityValue || 0) || 0;
  const GC_DEFAULT_VALIDITY_UNIT = String(POS_CONFIG.giftcardDefaultValidityUnit || 'days');

  function gcIso(d){
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${dd}`;
  }

  function gcParseYmdToDate(ymd){
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim());
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(y, mo-1, d);
    // validate (Date auto-corrects invalid dates)
    if (dt.getFullYear() !== y || (dt.getMonth()+1) !== mo || dt.getDate() !== d) return null;
    return dt;
  }

  function gcAddDaysYmd(ymd, days){
    const dt = gcParseYmdToDate(ymd);
    if (!dt) return '';
    dt.setDate(dt.getDate() + Number(days || 0));
    return gcIso(dt);
  }

  function gcAddMonthsClampedYmd(ymd, months){
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim());
    if (!m) return '';
    let y = Number(m[1]);
    let mo = Number(m[2]);
    let d = Number(m[3]);

    let total = (y * 12) + (mo - 1) + Number(months || 0);
    if (total < 0) total = 0;
    y = Math.floor(total / 12);
    mo = (total % 12) + 1;

    const dim = new Date(y, mo, 0).getDate();
    if (d > dim) d = dim;

    const dt = new Date(y, mo-1, d);
    return gcIso(dt);
  }

  function gcComputeAutoExpires(baseFrom){
    baseFrom = String(baseFrom || '').trim();
    if (!baseFrom) return '';
    const val = Number(GC_DEFAULT_VALIDITY_VALUE || 0);
    const unit = String(GC_DEFAULT_VALIDITY_UNIT || 'days').toLowerCase();
    if (!(val > 0)) return '';
    if (unit === 'months') return gcAddMonthsClampedYmd(baseFrom, val);
    if (unit === 'years') return gcAddMonthsClampedYmd(baseFrom, val * 12);
    return gcAddDaysYmd(baseFrom, val);
  }

  function gcTodayDate(){
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function gcSyncValidityMinDates(){
    const vfEl = document.getElementById('posGcValidFrom');
    const expEl = document.getElementById('posGcExpiresAt');
    if (!vfEl || !expEl) return;

    const today = gcTodayDate();
    const todayYmd = gcIso(today);
    if (todayYmd) vfEl.min = todayYmd;

    const curFrom = gcParseYmdToDate(vfEl.value);
    if (curFrom && curFrom.getTime() < today.getTime()) {
      vfEl.value = todayYmd;
    }

    const fromDate = gcParseYmdToDate(vfEl.value);
    if (fromDate) {
      const minTo = gcAddDaysYmd(vfEl.value, 1);
      expEl.min = minTo || '';
      const expDate = gcParseYmdToDate(expEl.value);
      if (expDate && expDate.getTime() <= fromDate.getTime()) {
        expEl.value = '';
      }
    } else {
      expEl.min = '';
    }
  }


  function gcRemoveExistingRows(){
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr[data-item-row][data-type="giftcard"]'));
    rows.forEach(r => r.remove());
  }

  // Regola UX: una sola GiftCard per vendita.
  // Se la GiftCard è già nel carrello, riaprendo il modal precompiliamo i dati per modificarla.
  function gcFindExistingRow(){
    if (!tbody) return null;
    return tbody.querySelector('tr[data-item-row][data-type="giftcard"]');
  }

  function gcGetRowField(tr, suffix){
    if (!tr) return '';
    const inp = tr.querySelector('input[name$="[' + suffix + ']"]');
    return inp ? String(inp.value || '') : '';
  }

  function gcClientNameById(cid){
    cid = String(cid || '').trim();
    if (!cid || cid === '0') return '';
    const sel = document.getElementById('posClient');
    if (!sel) return '';
    const opt = Array.from(sel.options).find(o => String(o.value || '') === cid);
    return opt ? String(opt.textContent || '').trim() : '';
  }

  function gcSetEditMode(isEdit){
    const btn = document.getElementById('posGiftcardCreateBtn');
    if (btn) btn.textContent = isEdit ? 'Salva' : 'Aggiungi alla lista';
    try {
      const t = document.querySelector('#posModalGiftcard .modal-title');
      if (t) t.textContent = isEdit ? 'Modifica GiftCard' : 'Emetti GiftCard';
    } catch (e) {}
  }

  function gcFillModalFromRow(tr){
    if (!tr) return false;

    const amountEl = document.getElementById('posGcAmount');
    const evEl = document.getElementById('posGcEventType');
    const rnEl = document.getElementById('posGcRecipientName');
    const reEl = document.getElementById('posGcRecipientEmail');
    const vfEl = document.getElementById('posGcValidFrom');
    const expEl = document.getElementById('posGcExpiresAt');
    const msgEl = document.getElementById('posGcMessage');
    const noteEl = document.getElementById('posGcNote');
    const internalNoteEl = document.getElementById('posGcInternalNote');
    const hideAmtEl = document.getElementById('posGcVoucherHideAmount');
    const showAmtEl = document.getElementById('posGcShowAmount');
    const doNotSendEl = document.getElementById('posGcDoNotSend');
    const sendNowEl = document.getElementById('posGcSendNow');
    const sendDateEl = document.getElementById('posGcSendDate');
    const sendOnEl = document.getElementById('posGcSendOn');

    // mittente (modal)
    const hidEl = document.getElementById('posGiftcardClientId');
    const lblEl = document.getElementById('posGiftcardClientLabel');

    const storedSender = String(gcGetRowField(tr, 'gc_client_id') || '').trim();
    const curSender = String(document.getElementById('posClient')?.value || '').trim();
    const effSender = (curSender && curSender !== '0') ? curSender : ((storedSender && storedSender !== '0') ? storedSender : '');

    if (hidEl) hidEl.value = effSender;
    const nm = gcClientNameById(effSender);
    if (lblEl) lblEl.textContent = nm || (effSender ? ('ID ' + effSender) : 'Mittente obbligatorio');

    if (amountEl) amountEl.value = gcGetRowField(tr, 'gc_amount') || '';
    if (evEl) {
      const v = gcGetRowField(tr, 'gc_event_type') || '';
      if (v) evEl.value = v;
    }
    if (rnEl) rnEl.value = gcGetRowField(tr, 'gc_recipient_name') || '';
    if (reEl) reEl.value = gcGetRowField(tr, 'gc_recipient_email') || '';

    // Destinatario: cliente già esistente (ripristino)
    try {
      const exToggle = document.getElementById('posGcRecipientExistingToggle');
      const exBox = document.getElementById('posGcRecipientExistingBox');
      const exSelectedBox = document.getElementById('posGcRecipientSelectedBox');
      const exSelectedName = document.getElementById('posGcRecipientSelectedName');
      const exSelectedMeta = document.getElementById('posGcRecipientSelectedMeta');
      const exSearchWrap = document.getElementById('posGcRecipientSearchWrap');
      const exSearch = document.getElementById('posGcRecipientClientSearch');
      const exList = document.getElementById('posGcRecipientClientList');
      const exAlert = document.getElementById('posGcRecipientFidelityAlert');
      const exCid = document.getElementById('posGiftcardRecipientClientId');

      const rcid = parseInt(String(gcGetRowField(tr, 'gc_recipient_client_id') || '0'), 10) || 0;
      if (exToggle) exToggle.checked = (rcid > 0);
      if (exBox) exBox.classList.toggle('d-none', !(rcid > 0));
      if (exCid) exCid.value = (rcid > 0) ? String(rcid) : '';
      if (exSearch) exSearch.value = '';

      if (exList) {
        // reset filtri
        const btns = Array.from(exList.querySelectorAll('button[data-client-id]'));
        btns.forEach(btn => btn.classList.remove('d-none'));
        try { posMarkActiveRecipient(exList, rcid); } catch (e) {}
      }
      try { posSetRecipientFidelityAlert(exAlert, rcid > 0 ? posFindClientMeta(rcid) : null); } catch (e) {}

      // Riallinea/lock campi precompilati in base al cliente selezionato
      try {
        if (rcid > 0) {
          gcSetRecipientClient(rcid);
        } else {
          if (rnEl) rnEl.readOnly = false;
          if (reEl) reEl.readOnly = false;
        }
      } catch (e2) {}
    } catch (e) {}
    if (vfEl) vfEl.value = gcGetRowField(tr, 'gc_valid_from') || gcTodayYMD();
    if (expEl) expEl.value = gcGetRowField(tr, 'gc_expires_at') || '';
    try { gcSyncValidityMinDates(); } catch (e) {}
    if (msgEl) msgEl.value = gcGetRowField(tr, 'gc_message') || '';
    if (noteEl) noteEl.value = gcGetRowField(tr, 'gc_note') || '';
    if (internalNoteEl) internalNoteEl.value = gcGetRowField(tr, 'gc_internal_note') || '';
    if (hideAmtEl) hideAmtEl.checked = (String(gcGetRowField(tr, 'gc_voucher_hide_amount') || '0') === '1');
    if (showAmtEl) showAmtEl.checked = (String(gcGetRowField(tr, 'gc_show_amount') || '1') !== '0');

    const sendMode = String(gcGetRowField(tr, 'gc_send_mode') || 'now').toLowerCase();
    const sendOn = String(gcGetRowField(tr, 'gc_send_on') || '').trim();

    if (doNotSendEl) doNotSendEl.checked = (sendMode === 'none');
    if (sendNowEl) sendNowEl.checked = (sendMode !== 'date');
    if (sendDateEl) sendDateEl.checked = (sendMode === 'date');
    if (sendOnEl) sendOnEl.value = (sendMode === 'date') ? sendOn : '';

    // Sync UI invio email (required + show/hide data)
    try { if (typeof window.posGcSyncUI === 'function') window.posGcSyncUI(); } catch(e) {}

    gcSetEditMode(true);
    return true;
  }

  function gcCloseModal(){
    const modalEl = document.getElementById('posModalGiftcard');
    if (!modalEl) return;
    try {
      bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    } catch (e) {
      modalEl.classList.remove('show');
      modalEl.style.display = 'none';
    }
  }

  function gcResetModal(){
    const amountEl = document.getElementById('posGcAmount');
    const evEl = document.getElementById('posGcEventType');
    const rnEl = document.getElementById('posGcRecipientName');
    const reEl = document.getElementById('posGcRecipientEmail');
    const vfEl = document.getElementById('posGcValidFrom');
    const expEl = document.getElementById('posGcExpiresAt');
    const msgEl = document.getElementById('posGcMessage');
    const noteEl = document.getElementById('posGcNote');
    const internalNoteEl = document.getElementById('posGcInternalNote');
    const hideAmtEl = document.getElementById('posGcVoucherHideAmount');
    const showAmtEl = document.getElementById('posGcShowAmount');
    const doNotSendEl = document.getElementById('posGcDoNotSend');
    const sendNowEl = document.getElementById('posGcSendNow');
    const sendDateEl = document.getElementById('posGcSendDate');
    const sendOnBoxEl = document.getElementById('posGcSendOnBox');
    const sendOnEl = document.getElementById('posGcSendOn');

    if (amountEl) amountEl.value = '';
    if (rnEl) rnEl.value = '';
    if (reEl) reEl.value = '';
    if (rnEl) rnEl.readOnly = false;
    if (reEl) reEl.readOnly = false;
    if (vfEl) vfEl.value = gcTodayYMD();
    if (expEl) {
      expEl.value = '';
      try {
        const baseFrom = (vfEl ? String(vfEl.value || '').trim() : '') || gcTodayYMD();
        const autoTo = gcComputeAutoExpires(baseFrom);
        if (autoTo) expEl.value = autoTo;
      } catch (e) {}
    }
    try { gcSyncValidityMinDates(); } catch (e) {}
    if (msgEl) msgEl.value = '';
    if (noteEl) noteEl.value = '';
    if (internalNoteEl) internalNoteEl.value = '';
    if (hideAmtEl) hideAmtEl.checked = false;
    if (showAmtEl) showAmtEl.checked = true;
    if (doNotSendEl) doNotSendEl.checked = false;
    if (sendNowEl) sendNowEl.checked = true;
    if (sendDateEl) sendDateEl.checked = false;
    if (sendOnEl) {
      sendOnEl.value = '';
      sendOnEl.required = false;
    }
    if (sendOnBoxEl) sendOnBoxEl.classList.add('d-none');

    // Destinatario: cliente già esistente (reset)
    try {
      const exToggle = document.getElementById('posGcRecipientExistingToggle');
      const exBox = document.getElementById('posGcRecipientExistingBox');
      const exSearch = document.getElementById('posGcRecipientClientSearch');
      const exList = document.getElementById('posGcRecipientClientList');
      const exAlert = document.getElementById('posGcRecipientFidelityAlert');
      const exCid = document.getElementById('posGiftcardRecipientClientId');

      if (exToggle) exToggle.checked = false;
      if (exBox) exBox.classList.add('d-none');
      if (exSelectedName) exSelectedName.textContent = '';
      if (exSelectedMeta) exSelectedMeta.textContent = '';
      if (exSelectedBox) exSelectedBox.classList.add('d-none');
      if (exSearchWrap) exSearchWrap.classList.remove('d-none');
      if (exSearch) {
        exSearch.value = '';
        exSearch.disabled = false;
      }
      if (exCid) exCid.value = '';

      if (exList) {
        const btns = Array.from(exList.querySelectorAll('button[data-client-id]'));
        btns.forEach(btn => {
          btn.classList.remove('active','bg-light','d-none');
        });
      }

      if (exAlert) {
        exAlert.classList.add('d-none');
        exAlert.textContent = '';
        exAlert.classList.remove('alert-success','alert-warning','alert-info');
      }
    } catch (e) {}

    // Sync UI ("Non inviare" / invio programmato)
    try { if (typeof window.posGcSyncUI === 'function') window.posGcSyncUI(); } catch(e) {}

    // evento: lascia il valore corrente (default giftcard)
    if (evEl && !String(evEl.value || '').trim()) {
      evEl.selectedIndex = 0;
    }
  }

  // Precompila automaticamente il modal quando esiste già una GiftCard nel carrello.
  // Così il pulsante "GiftCard" (blu) può riaprire i dettagli e permettere la modifica.
  const gcModalEl = document.getElementById('posModalGiftcard');
  if (gcModalEl) {
    gcModalEl.addEventListener('show.bs.modal', (ev)=>{
      const tr = gcFindExistingRow();
      if (tr) {
        gcFillModalFromRow(tr);
        return;
      }

      // Nuova GiftCard: modalità creazione + mittente = cliente selezionato.
      gcSetEditMode(false);
      const hidEl = document.getElementById('posGiftcardClientId');
      const lblEl = document.getElementById('posGiftcardClientLabel');

      const curId = String(document.getElementById('posClient')?.value || '').trim();
      if (!curId) {
        if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
        alert('Seleziona un mittente prima di emettere una GiftCard.');
        return;
      }
      if (hidEl) hidEl.value = curId || '';
      const nm = gcClientNameById(curId);
      if (lblEl) lblEl.textContent = nm || ('ID ' + curId);

      // Default validità/scadenza (se il campo "Valida al" è vuoto)
      try {
        const vfEl = document.getElementById('posGcValidFrom');
        const expEl = document.getElementById('posGcExpiresAt');
        if (vfEl && !String(vfEl.value || '').trim()) vfEl.value = gcTodayYMD();
        const baseFrom = (vfEl ? String(vfEl.value || '').trim() : '') || gcTodayYMD();
        if (expEl && !String(expEl.value || '').trim()) {
          const autoTo = gcComputeAutoExpires(baseFrom);
          if (autoTo) expEl.value = autoTo;
        }
        gcSyncValidityMinDates();
      } catch (e) {}
    });
  }

  // UX: se l'operatore cambia "Validità dal" e "Valida al" è vuoto, calcola la scadenza automatica.
  try {
    const vfEl = document.getElementById('posGcValidFrom');
    const expEl = document.getElementById('posGcExpiresAt');
    if (vfEl && expEl) {
      const syncGcValidity = () => {
        try { gcSyncValidityMinDates(); } catch (e) {}
      };
      vfEl.addEventListener('change', ()=>{
        syncGcValidity();
        if (String(expEl.value || '').trim()) return;
        const baseFrom = String(vfEl.value || '').trim();
        const autoTo = gcComputeAutoExpires(baseFrom);
        const dFrom = gcParseYmdToDate(baseFrom);
        const dTo = gcParseYmdToDate(autoTo);
        if (autoTo && dFrom && dTo && dTo.getTime() > dFrom.getTime()) {
          expEl.value = autoTo;
        }
      });
      expEl.addEventListener('change', syncGcValidity);
      syncGcValidity();
    }
  } catch (e) {}

  function gcAddRowToCart(data){
    if (!tbody) return;

    // se tabella vuota, rimuove placeholder
    const placeholder = tbody.querySelector('tr:not([data-item-row])');
    if (placeholder) placeholder.remove();

    // consenti una sola GiftCard alla volta: rimpiazza
    gcRemoveExistingRows();

    const tr = document.createElement('tr');
    tr.dataset.itemRow = '1';
    tr.dataset.type = 'giftcard';
    tr.dataset.id = '0';
    tr.dataset.price = Number(data.amount || 0).toFixed(2);
    tr.dataset.lineTotal = Number(data.amount || 0).toFixed(2);

    const idx = String(Date.now()) + String(Math.floor(Math.random()*1000));

    const hasClient = !!(String(data.client_id || '').trim() && String(data.client_id || '').trim() !== '0');
    if (!hasClient) {
      alert('Seleziona un mittente prima di emettere una GiftCard.');
      return;
    }

    const sendLabel = (data.send_mode === 'none')
      ? 'Invio: non inviata'
      : ((data.send_mode === 'date' && data.send_on)
        ? ('Invio: ' + String(data.send_on).split('-').reverse().join('/'))
        : 'Invio: alla chiusura vendita');

    const elLabel = `GiftCard • ${data.event_label || data.event_type || 'GiftCard'} • ${data.recipient_name || ''}`.trim();

    tr.innerHTML = `
      <td class="text-uppercase small">giftcard</td>
      <td>
        <div class="fw-semibold">${elLabel}</div>
        <div class="text-muted small">${sendLabel}</div>
    <input type="hidden" name="items[${idx}][type]" value="giftcard">
        <input type="hidden" name="items[${idx}][id]" value="0">
        <input type="hidden" name="items[${idx}][qty]" value="1">
	    <!-- mittente (cliente selezionato in POS). Nota: prima era un bug (selectedClientId non definito) -->
	    <input type="hidden" name="items[${idx}][gc_client_id]" value="${String(data.client_id || '')}">
	    <input type="hidden" name="items[${idx}][gc_recipient_client_id]" value="${String(data.recipient_client_id || '')}">

        <input type="hidden" name="items[${idx}][gc_amount]" value="${Number(data.amount || 0).toFixed(2)}">
        <input type="hidden" name="items[${idx}][gc_event_type]" value="${String(data.event_type || '')}">
        <input type="hidden" name="items[${idx}][gc_recipient_name]" value="${String(data.recipient_name || '')}">
        <input type="hidden" name="items[${idx}][gc_recipient_email]" value="${String(data.recipient_email || '')}">
        <input type="hidden" name="items[${idx}][gc_valid_from]" value="${String(data.valid_from || '')}">
        <input type="hidden" name="items[${idx}][gc_expires_at]" value="${String(data.expires_at || '')}">
        <input type="hidden" name="items[${idx}][gc_message]" value="${String(data.message || '')}">
        <input type="hidden" name="items[${idx}][gc_note]" value="${String(data.note || '')}">
        <input type="hidden" name="items[${idx}][gc_internal_note]" value="${String(data.internal_note || '')}">
        <input type="hidden" name="items[${idx}][gc_send_mode]" value="${String(data.send_mode || 'now')}">
        <input type="hidden" name="items[${idx}][gc_send_on]" value="${String(data.send_on || '')}">
        <input type="hidden" name="items[${idx}][gc_voucher_hide_amount]" value="${data.voucher_hide_amount ? '1' : '0'}">
        <input type="hidden" name="items[${idx}][gc_show_amount]" value="${data.show_amount ? '1' : '0'}">
      </td>
      <td>
        <input class="form-control form-control-sm pos-qty-input" type="number" value="1" disabled>
      </td>
      <td class="text-end small">${fmtEUR(Number(data.amount || 0))}</td>
      <td class="text-end small line-total">${fmtEUR(Number(data.amount || 0))}</td>
      <td class="text-end">
        <button type="button" class="btn btn-sm btn-outline-danger">✕</button>
      </td>
    `;

    tr.querySelector('button').addEventListener('click', ()=>{
      tr.remove();
      const stillHasItems = !!tbody.querySelector('tr[data-item-row]');
      ensureEmpty();
      // Aggiorna sempre i totali / promo quando un elemento viene rimosso.
      // (ensureEmpty() chiama posOnCartChange solo se la tabella diventa vuota)
      if (stillHasItems) {
        if (window.posOnCartChange) window.posOnCartChange();
      }
    });

    tbody.prepend(tr);

    if (window.posOnCartChange) window.posOnCartChange();
  }

  const gcCreateBtn = document.getElementById('posGiftcardCreateBtn');
	  if (gcCreateBtn) gcCreateBtn.addEventListener('click', ()=>{
	    try {

      // Regola: GiftCard non cumulabile con altri elementi o GiftBox.
      if (typeof window.posCartHasRecharge === 'function' && window.posCartHasRecharge()) {
      return alert('GiftCard e Ricariche non possono essere abbinate nella stessa vendita. Rimuovi la ricarica dal carrello per continuare.');
    }

    if (typeof window.posCartHasNonGiftcardItems === 'function' && window.posCartHasNonGiftcardItems()) {
        alert('Per vendere una GiftCard la vendita deve contenere solo la GiftCard. Rimuovi gli altri elementi dal carrello.');
        return;
      }
      const gbDraftFlag = document.getElementById('pos_giftbox_draft');
      if (gbDraftFlag && String(gbDraftFlag.value || '0') === '1') {
        alert('GiftCard e GiftBox non possono essere abbinate nella stessa vendita. Elimina la GiftBox prima di creare la GiftCard.');
        return;
      }
    // Mittente: usa il valore del modal (precompilato su apertura).
    const clientSel = document.getElementById('posClient');
    const hidClientEl = document.getElementById('posGiftcardClientId');
    const clientId = hidClientEl ? String(hidClientEl.value || '').trim() : (clientSel ? String(clientSel.value || '').trim() : '');
    const clientName = gcClientNameById(clientId);
    if (!clientId || clientId === '0') {
      alert('Seleziona un mittente prima di emettere una GiftCard.');
      return;
    }

    const gcLbl = document.getElementById('posGiftcardClientLabel');
    if (gcLbl) gcLbl.textContent = clientName || ('ID ' + clientId);

    const amount = gcNormMoney(document.getElementById('posGcAmount')?.value);
    const eventEl = document.getElementById('posGcEventType');
    const eventType = String(eventEl ? eventEl.value : '').trim();
    const eventLabel = eventEl && eventEl.selectedOptions && eventEl.selectedOptions[0] ? (eventEl.selectedOptions[0].textContent || '').trim() : '';
    const recipientName = String(document.getElementById('posGcRecipientName')?.value || '').trim();
    const recipientEmail = String(document.getElementById('posGcRecipientEmail')?.value || '').trim();

    const recipientExisting = !!document.getElementById('posGcRecipientExistingToggle')?.checked;
    const recipientClientId = recipientExisting
      ? (parseInt(String(document.getElementById('posGiftcardRecipientClientId')?.value || '0'), 10) || 0)
      : 0;
    const validFrom = String(document.getElementById('posGcValidFrom')?.value || '').trim() || gcTodayYMD();
    const expiresAt = String(document.getElementById('posGcExpiresAt')?.value || '').trim();
    const message = String(document.getElementById('posGcMessage')?.value || '').trim();
    const note = String(document.getElementById('posGcNote')?.value || '').trim();
    const internalNote = String(document.getElementById('posGcInternalNote')?.value || '').trim();
    const voucherHideAmount = !!document.getElementById('posGcVoucherHideAmount')?.checked;
    const showAmount = !!document.getElementById('posGcShowAmount')?.checked;

    const doNotSend = !!document.getElementById('posGcDoNotSend')?.checked;

    const sendMode = doNotSend ? 'none' : ((document.getElementById('posGcSendDate')?.checked) ? 'date' : 'now');
    const sendOn = String(document.getElementById('posGcSendOn')?.value || '').trim();

    if (!(amount > 0)) return alert('Inserisci un importo valido.');
    if (!eventType) return alert('Seleziona un evento.');
    if (!recipientName) return alert('Inserisci il destinatario.');
    if (recipientExisting && !(recipientClientId > 0)) return alert('Seleziona il cliente destinatario.');
    if (recipientEmail && !gcIsEmail(recipientEmail)) return alert('Inserisci una email destinatario valida.');
    if (sendMode !== 'none' && !gcIsEmail(recipientEmail)) return alert('Inserisci una email destinatario valida.');
    if (!validFrom) return alert('Seleziona la data "Validità dal".');
    const validFromDate = gcParseYmdToDate(validFrom);
    if (!validFromDate) return alert('GiftCard: data "Valida dal" non valida.');
    if (validFromDate.getTime() < gcTodayDate().getTime()) return alert('GiftCard: la data "Valida dal" non puo essere nel passato.');
    if (expiresAt) {
      const expiresAtDate = gcParseYmdToDate(expiresAt);
      if (!expiresAtDate) return alert('GiftCard: data "Valida al" non valida.');
      if (expiresAtDate.getTime() <= validFromDate.getTime()) return alert('GiftCard: la data "Valida al" deve essere almeno il giorno successivo a "Valida dal".');
    }
    if (sendMode === 'date' && !sendOn) return alert('Seleziona la data di invio.');

    gcAddRowToCart({
	      client_id: clientId,
      amount,
      event_type: eventType,
      event_label: eventLabel,
      recipient_client_id: recipientClientId,
      recipient_name: recipientName,
      recipient_email: recipientEmail,
      valid_from: validFrom,
      expires_at: expiresAt,
      message,
      note,
      internal_note: internalNote,
      send_mode: sendMode,
      send_on: (sendMode === 'date') ? sendOn : '',
      voucher_hide_amount: voucherHideAmount,
      show_amount: showAmount
    });

    gcCloseModal();
    gcResetModal();
	    } catch (err) {
	      console.error('GiftCard POS error', err);
	      alert('Errore durante la creazione della GiftCard. Controlla i dati e riprova.');
	    }
  });

  gcResetModal();
  ensureEmpty();
})();

// stato condiviso per calcoli (coupon/promo) lato JS
window.posPricing = window.posPricing || {
  code: '',
  code_discount: 0,
  is_promo: 0,
  promo_id: 0,
  promo_name: '',
  promo_allows_fidelity: 1,
  promo_non_discounted_subtotal: 0,
  stacked_with_coupon: 0
};

window.posQuoteLock = {
  active: Number(POS_CONFIG.quoteLock && POS_CONFIG.quoteLock.active || 0) || 0,
  quoteId: Number(POS_CONFIG.quoteLock && POS_CONFIG.quoteLock.quoteId || 0) || 0,
  message: String(POS_CONFIG.quoteLock && POS_CONFIG.quoteLock.message || 'Preventivo collegato: per mantenere coerenza non puoi aggiungere o rimuovere righe, n\u00e9 applicare coupon, promozioni o sconti manuali.')
};
window.posQuoteLockActive = function(){
  return !!(window.posQuoteLock && Number(window.posQuoteLock.active || 0) > 0);
};
window.posQuoteLockMessage = function(fallback){
  const msg = window.posQuoteLock && window.posQuoteLock.message ? String(window.posQuoteLock.message) : '';
  return msg || String(fallback || 'Operazione non disponibile con un preventivo collegato.');
};
document.addEventListener('DOMContentLoaded', function(){
  if (!(window.posQuoteLockActive && window.posQuoteLockActive())) return;
  const couponInp = document.getElementById('coupon_code');
  const couponHelp = document.getElementById('couponHelp');
  const couponBox = document.getElementById('couponBox');
  const discountType = document.getElementById('discount_type');
  const discountValue = document.getElementById('discount_value');
  if (couponInp) couponInp.value = '';
  if (couponBox) couponBox.classList.remove('d-none');
  if (couponHelp) couponHelp.textContent = 'Con un preventivo collegato coupon e promozioni non sono applicabili.';
  if (discountType) discountType.value = 'none';
  if (discountValue) discountValue.value = '0';
  document.querySelectorAll('#itemsTable tbody tr[data-quote-import="1"] input[name$="[qty]"]').forEach(function(el){
    el.readOnly = true;
    el.classList.add('bg-light');
  });
  document.querySelectorAll('#itemsTable tbody tr[data-quote-import="1"] button.btn-outline-danger').forEach(function(btn){
    btn.disabled = true;
    btn.title = 'Riga bloccata dal preventivo collegato';
  });
});

(function(){
  const clientSel = document.getElementById('posClient');
  const pointsBox = document.getElementById('posFidelityRedeemBox');
  const ptsInput = document.getElementById('fidelity_points_use');
  const help = document.getElementById('fidelityHelp');
	  const maxBtn = document.getElementById('pointsMaxBtn');
  const tableBody = document.querySelector('#itemsTable tbody');
  const discountType = document.getElementById('discount_type');
  const discountValue = document.getElementById('discount_value');

  const euroPerPoint = Number(POS_CONFIG.fidEuroPerPoint || 0) || 0;
  const minPts = Number(POS_CONFIG.fidMinPoints || 0) || 0;
  const fidLabel = String(POS_CONFIG.fidLabel || 'Punti');

  function norm(x){
    if (x === null || x === undefined) return 0;
    if (typeof x === 'number') return isFinite(x) ? x : 0;
    x = String(x).trim().replace(',', '.');
    return parseFloat(x) || 0;
  }
  function wholePts(n){
    const v = norm(n);
    if (v > 0) return Math.floor(v + 1e-9);
    if (v < 0) return Math.ceil(v - 1e-9);
    return 0;
  }
  function fmtPts(n){ return String(wholePts(n)); }
  function escHtml(v){
    return String(v ?? '').replace(/[&<>\"']/g, (ch)=>({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[ch] || ch));
  }

  function round2(n){
    return Math.round((Number(n) || 0) * 100) / 100;
  }

  function getSubtotal(){
    let s = 0;
    if (!tableBody) return 0;
    tableBody.querySelectorAll('tr[data-item-row]').forEach(tr=>{
      s += norm(tr.dataset.lineTotal);
    });
    return round2(s);
  }

  function getCodeDiscount(){
    return norm(window.posPricing?.code_discount);
  }

  function getManualDiscount(subtotal, codeDisc){
    const type = discountType?.value || '';
    const val = norm(discountValue?.value);
    let d = 0;
    if (type === 'percent') d = subtotal * (val / 100);
    else if (type === 'fixed' || type === 'amount') d = val;
    d = Math.max(0, d);
    const cap = Math.max(0, subtotal - codeDisc);
    if (d > cap) d = cap;
    return round2(d);
  }

  function calcMaxPointsUse(available){
    if (available <= 0 || euroPerPoint <= 0) return 0;
    if (document.querySelector('#itemsTable tbody tr[data-item-row][data-type="recharge"]')) return 0;

    const subtotal = getSubtotal();
    const codeDisc = getCodeDiscount();
    const manualDisc = getManualDiscount(subtotal, codeDisc);
    const baseAfter = Math.max(0, subtotal - codeDisc - manualDisc);

    let baseForPts = baseAfter;
    if (window.posPricing?.is_promo && window.posPricing?.promo_id && !window.posPricing?.promo_allows_fidelity) {
      const nonDisc = norm(window.posPricing?.promo_non_discounted_subtotal);
      const manualPortion = (subtotal > 0 && manualDisc > 0) ? (manualDisc * (nonDisc / subtotal)) : 0;
      baseForPts = Math.max(0, nonDisc - manualPortion);
    }

    const capAmount = Math.max(0, baseForPts);

    let maxPtsByAmount = Math.floor((capAmount / euroPerPoint) + 1e-9);

    let maxUse = Math.floor(Math.min(wholePts(available), maxPtsByAmount) + 1e-9);
    const minWhole = wholePts(minPts);
    if (minWhole > 0 && maxUse < minWhole) maxUse = 0;
    return Math.max(0, maxUse);
  }


  function sync(){
    if (!clientSel || !ptsInput || !help) return;

    const cid = String(clientSel.value || '');
    const opt = cid ? clientSel.options[clientSel.selectedIndex] : null;
    const loaded = opt ? (String(opt.dataset.pointsLoaded || '0') === '1') : false;

    if (!cid) {
      ptsInput.max = '0';
      ptsInput.dataset.redeemMax = '0';
      ptsInput.value = '';
      if (pointsBox) pointsBox.classList.add('d-none');
      help.textContent = '';
      return;
    }

    if (!loaded) {
      ptsInput.max = '0';
      ptsInput.dataset.redeemMax = '0';
      ptsInput.value = '';
      if (pointsBox) pointsBox.classList.add('d-none');
      help.textContent = '';
      return;
    }

    const available = opt ? norm(opt.dataset.points) : 0;
    const reserved = opt ? norm(opt.dataset.pointsReserved) : 0;
    const balance  = opt ? norm(opt.dataset.pointsBalance) : 0;

    const maxUse = calcMaxPointsUse(available);

    ptsInput.max = String(maxUse);
    ptsInput.dataset.redeemMax = String(maxUse);
    let cur = wholePts(ptsInput.value);

    // clamp input (evita richieste > disponibili e decimali)
    if (cur > maxUse) cur = maxUse;
    if (cur < 0) cur = 0;
    ptsInput.value = cur ? String(cur) : '';

    const showBox = (maxUse > 0.00001);
    if (pointsBox) pointsBox.classList.toggle('d-none', !showBox);
    if (!showBox) {
      ptsInput.value = '';
      help.textContent = '';
      return;
    }

    let msg = 'Disponibili: ' + fmtPts(available) + ' ' + fidLabel + ' \u2022 Max: ' + fmtPts(maxUse) + ' ' + fidLabel;
    if (Math.abs(balance) > 0.00001) {
      msg += ' • Saldo: ' + fmtPts(balance);
    }
    if (reserved > 0.00001) {
      msg += ' • Prenotati: ' + fmtPts(reserved);
    }
    if (balance < -0.00001) {
      msg += ' • Saldo negativo: i punti disponibili restano 0 finché non vengono compensati da nuovi accrediti.';
    }
    if (minPts > 0) msg += ' • Min: ' + fmtPts(minPts);

    if (cur > 0) {
      const eur = cur * euroPerPoint;
      msg += ' • Stai usando ~€ ' + eur.toFixed(2).replace('.', ',');
    }
    help.textContent = msg;
  }

  if (clientSel) clientSel.addEventListener('change', sync);
  if (ptsInput) {
    ptsInput.addEventListener('input', sync);
    ptsInput.addEventListener('change', sync);
  }
	  if (discountType) discountType.addEventListener('change', sync);
	  if (discountValue) {
	    discountValue.addEventListener('input', sync);
	    discountValue.addEventListener('change', sync);
	  }
	  if (maxBtn && ptsInput) {
	    maxBtn.addEventListener('click', ()=>{
	      const m = norm(ptsInput.max);
	      ptsInput.value = m ? String(m) : '';
	      // forza i listener (ricalcolo totale)
	      ptsInput.dispatchEvent(new Event('input', { bubbles: true }));
	      sync();
	    });
	  }

  window.posSyncPointsHelp = sync;
  sync();
})();

(function(){
  const form = document.getElementById('posForm');
  const csrf = form?.querySelector('input[name="_csrf"]')?.value || '';

  const clientSel = document.getElementById('posClient');
  const couponInp = document.getElementById('coupon_code');
  const couponHelp = document.getElementById('couponHelp');
  const couponToggle = document.getElementById('couponToggle');
  const couponBox = document.getElementById('couponBox');
  const couponApplyBtn = document.getElementById('couponApplyBtn');
  const couponRemoveBtn = document.getElementById('couponRemoveBtn');

  // Buono/Coupon draft (creato alla chiusura vendita)
  const ncDraftFlagEl = document.getElementById('pos_new_coupon_draft');
  const ncDraftCodeEl = document.getElementById('pos_new_coupon_code');
  const ncDraftTypeEl = document.getElementById('pos_new_coupon_discount_type');
  const ncDraftValEl  = document.getElementById('pos_new_coupon_discount_value');
  const ncDraftFromEl = document.getElementById('pos_new_coupon_valid_from');
  const ncDraftUseEl  = document.getElementById('pos_new_coupon_use_in_sale');


  const discountType = document.getElementById('discount_type');
  const discountValue = document.getElementById('discount_value');

  const ptsInp = document.getElementById('fidelity_points_use');
	  const ptsMaxBtn = document.getElementById('pointsMaxBtn');

  const creditUseHidden = document.getElementById('pos_credit_use');
  const giftcardIdHidden = document.getElementById('pos_giftcard_id');
  const giftcardUseHidden = document.getElementById('pos_giftcard_use');

  const residualsBox = document.getElementById('posResidualsBox');
  const residualsOpen = document.getElementById('posResidualsOpen');
  const residualsSummary = document.getElementById('posResidualsSummary');

  const residualsModalEl = document.getElementById('posResidualsModal');
  const residualsClientLabel = document.getElementById('posResidualsClientLabel');
  const residualsEmptyState = document.getElementById('posResidualsEmptyState');
  const residualsApplyBtn = document.getElementById('posResidualsApplyBtn');

  const residualCreditCard = document.getElementById('posResidualCreditCard');
  const residualCreditToggle = document.getElementById('posResidualCreditToggle');
  const residualCreditAvail = document.getElementById('posResidualCreditAvail');
  const residualCreditAmount = document.getElementById('posResidualCreditAmount');
  const residualCreditMaxBtn = document.getElementById('posResidualCreditMaxBtn');
  const residualCreditHint = document.getElementById('posResidualCreditHint');

  const residualGiftcardCard = document.getElementById('posResidualGiftcardCard');
  const residualGiftcardList = document.getElementById('posResidualGiftcardList');
  const residualGiftcardControls = document.getElementById('posResidualGiftcardControls');
  const residualGiftcardAmount = document.getElementById('posResidualGiftcardAmount');
  const residualGiftcardMaxBtn = document.getElementById('posResidualGiftcardMaxBtn');
  const residualGiftcardHint = document.getElementById('posResidualGiftcardHint');

  // Badge cliente (Fidelity / Punti)
  const elClientAdhering = document.getElementById('posClientAdhering');
  const elClientPoints = document.getElementById('posClientPoints');
  const elRedeemInfo = document.getElementById('posRedeemInfo');

  // Dettaglio prezzi
  const elSubtotal = document.getElementById('posSubtotalVal');
  const rowCode = document.getElementById('posCodeDiscountRow');
  const elCodeLabel = document.getElementById('posCodeDiscountLabel');
  const elCodeVal = document.getElementById('posCodeDiscountVal');

  const rowManual = document.getElementById('posManualDiscountRow');
  const elManualVal = document.getElementById('posManualDiscountVal');

  const rowFid = document.getElementById('posFidelityRow');
  const elFidLabel = document.getElementById('posFidelityLabel');
  const elFidVal = document.getElementById('posFidelityVal');


  const rowGiftcard = document.getElementById('posGiftcardRow');
  const elGiftcardVal = document.getElementById('posGiftcardVal');

  const rowCredit = document.getElementById('posCreditRow');
  const elCreditVal = document.getElementById('posCreditVal');

  const paymentTypeBox = document.getElementById('posPaymentTypeBox');
  const paymentTypeHelp = document.getElementById('posPaymentTypeHelp');
  const paymentTypeInputs = Array.from(document.querySelectorAll('input[name="payment_type"]'));
  const concludeBtn = document.getElementById('posConcludeBtn');
  const concludeHelp = document.getElementById('posConcludeHelp');

  const installmentChoiceInput = document.getElementById('pos_installment_choice_mode');
  const installmentPlanEnabledInput = document.getElementById('pos_installment_plan_enabled');
  const installmentPlanJsonInput = document.getElementById('pos_installment_plan_json');
  const installmentCard = document.getElementById('posInstallmentCard');
  const installmentHeadline = document.getElementById('posInstallmentHeadline');
  const installmentRequiredBadge = document.getElementById('posInstallmentRequiredBadge');
  const installmentHelp = document.getElementById('posInstallmentHelp');
  const installmentSingleBtn = document.getElementById('posInstallmentSingleBtn');
  const installmentConfigureBtn = document.getElementById('posInstallmentConfigureBtn');
  const installmentSummary = document.getElementById('posInstallmentSummary');
  const installmentSummaryText = document.getElementById('posInstallmentSummaryText');
  const installmentSummaryNote = document.getElementById('posInstallmentSummaryNote');
  const installmentScheduleWrap = document.getElementById('posInstallmentScheduleWrap');
  const installmentScheduleBody = document.getElementById('posInstallmentScheduleBody');
  const installmentEditBtn = document.getElementById('posInstallmentEditBtn');

  const installmentModalEl = document.getElementById('posInstallmentModal');
  const installmentClientLabelEl = document.getElementById('posInstallmentClientLabel');
  const installmentSaleTotalEl = document.getElementById('posInstallmentSaleTotal');
  const installmentPaymentTypeEl = document.getElementById('posInstallmentPaymentType');
  const installmentDownPaymentEl = document.getElementById('posInstallmentDownPayment');
  const installmentCountEl = document.getElementById('posInstallmentCount');
  const installmentFirstDueEl = document.getElementById('posInstallmentFirstDue');
  const installmentIntervalValueEl = document.getElementById('posInstallmentIntervalValue');
  const installmentIntervalUnitEl = document.getElementById('posInstallmentIntervalUnit');
  const installmentNotesEl = document.getElementById('posInstallmentNotes');
  const installmentModalErrorEl = document.getElementById('posInstallmentModalError');
  const installmentPreviewDownPaymentEl = document.getElementById('posInstallmentPreviewDownPayment');
  const installmentPreviewFinancedEl = document.getElementById('posInstallmentPreviewFinanced');
  const installmentPreviewLastDueEl = document.getElementById('posInstallmentPreviewLastDue');
  const installmentPreviewBodyEl = document.getElementById('posInstallmentPreviewBody');
  const installmentSaveBtn = document.getElementById('posInstallmentSaveBtn');

  const elTotal = document.getElementById('posTotalVal');

  const euroPerPoint = Number(POS_CONFIG.fidEuroPerPoint || 0) || 0;
  const fidMinPoints = Number(POS_CONFIG.fidMinPoints || 0) || 0;
  const fidLabel = String(POS_CONFIG.fidLabel || 'Punti');

  const hasFidelityRedeem = POS_CONFIG.fidRedeemEnabled ? 1 : 0;
  const posRedeemInfoDefault = String(POS_CONFIG.posRedeemInfoDefault || '');

  const API_PREVIEW = 'index.php?page=pos&mode=preview_discount';
  const API_AUTO_PROMO = 'index.php?page=pos&mode=preview_auto_promo';
  const API_RESIDUALS = 'index.php?page=pos&mode=client_payment_residuals';

  let residualsInfo = {
    show_box: 0,
    credit: { available: 0, balance: 0, locked: 0, locked_amount: 0, locked_booking_code: '' },
    giftcards: []
  };
  let residualDraft = { credit_use: 0, giftcard_id: 0, giftcard_use: 0 };
  let residualsReqId = 0;
  let residualsModal = null;

  function getResidualsModal(){
    if (!residualsModalEl) return null;
    if (residualsModal && typeof residualsModal.show === 'function' && typeof residualsModal.hide === 'function') {
      return residualsModal;
    }
    if (window.bootstrap && window.bootstrap.Modal) {
      residualsModal = (typeof window.bootstrap.Modal.getOrCreateInstance === 'function')
        ? window.bootstrap.Modal.getOrCreateInstance(residualsModalEl)
        : new window.bootstrap.Modal(residualsModalEl);
      return residualsModal;
    }
    if (window.jQuery && typeof window.jQuery.fn?.modal === 'function') {
      residualsModal = {
        show(){ window.jQuery(residualsModalEl).modal('show'); },
        hide(){ window.jQuery(residualsModalEl).modal('hide'); }
      };
      return residualsModal;
    }
    return null;
  }

  let installmentModal = null;
  let currentPosTotal = 0;
  let currentPosSubtotal = 0;
  let installmentContextNotice = '';

  function getInstallmentModal(){
    if (!installmentModalEl) return null;
    if (installmentModal && typeof installmentModal.show === 'function' && typeof installmentModal.hide === 'function') {
      return installmentModal;
    }
    if (window.bootstrap && window.bootstrap.Modal) {
      installmentModal = (typeof window.bootstrap.Modal.getOrCreateInstance === 'function')
        ? window.bootstrap.Modal.getOrCreateInstance(installmentModalEl)
        : new window.bootstrap.Modal(installmentModalEl);
      return installmentModal;
    }
    if (window.jQuery && typeof window.jQuery.fn?.modal === 'function') {
      installmentModal = {
        show(){ window.jQuery(installmentModalEl).modal('show'); },
        hide(){ window.jQuery(installmentModalEl).modal('hide'); }
      };
      return installmentModal;
    }
    return null;
  }

  function norm(x){
    if (x === null || x === undefined) return 0;
    if (typeof x === 'number') return isFinite(x) ? x : 0;
    x = String(x).trim().replace(',', '.');
    return parseFloat(x) || 0;
  }
  function round2(n){ return Math.round(n * 100) / 100; }
  function fmtEUR(n){ return '€ ' + (round2(n)).toFixed(2).replace('.', ','); }
  function wholePts(n){
    const v = norm(n);
    if (v > 0) return Math.floor(v + 1e-9);
    if (v < 0) return Math.ceil(v - 1e-9);
    return 0;
  }
  function fmtPts(n){ return String(wholePts(n)); }
  function escHtml(v){
    return String(v ?? '').replace(/[&<>\"']/g, (ch)=>({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[ch] || ch));
  }

  function paymentTypeLabel(value){
    value = String(value || '').trim().toLowerCase();
    if (value === 'cash') return 'Contanti';
    if (value === 'card') return 'Carta di Credito';
    if (value === 'check') return 'Assegno';
    if (value === 'bank') return 'Bonifico';
    return '';
  }

  function selectedPaymentType(){
    const picked = paymentTypeInputs.find((inp) => inp.checked && !inp.disabled);
    return picked ? String(picked.value || '').trim() : '';
  }

  function fmtIsoDate(value){
    const v = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return '—';
    return v.substring(8, 10) + '/' + v.substring(5, 7) + '/' + v.substring(0, 4);
  }

  function formatDateObj(d){
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  function shiftIsoDate(value, unit, step, iterations){
    const baseIso = /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim()) ? String(value).trim() : todayIso();
    const n = Math.max(1, parseInt(String(step || '1'), 10) || 1);
    const offset = Math.max(0, parseInt(String(iterations == null ? '1' : iterations), 10) || 0);
    if (offset === 0) return baseIso;

    if (unit === 'day' || unit === 'week') {
      const base = new Date(baseIso + 'T12:00:00');
      const d = new Date(base.getTime());
      const days = unit === 'week' ? (n * offset * 7) : (n * offset);
      d.setDate(d.getDate() + days);
      return formatDateObj(d);
    }

    const match = baseIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return baseIso;
    const year = parseInt(match[1], 10) || 0;
    const month = parseInt(match[2], 10) || 1;
    const day = parseInt(match[3], 10) || 1;
    const monthIndex = (month - 1) + (n * offset);
    const targetYear = year + Math.floor(monthIndex / 12);
    const targetMonth = (monthIndex % 12) + 1;
    const daysInTarget = new Date(targetYear, targetMonth, 0).getDate();
    const targetDay = Math.min(day, daysInTarget);
    return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
  }

  function buildInstallmentSchedule(remainingAmount, count, firstDueDate, intervalUnit, intervalValue){
    const amount = round2(Math.max(0, norm(remainingAmount)));
    const rows = [];
    const c = Math.max(1, Math.min(120, parseInt(String(count || '1'), 10) || 1));
    const totalCents = Math.round(amount * 100);
    const base = Math.floor(totalCents / c);
    const rem = totalCents - (base * c);
    const anchorDate = /^\d{4}-\d{2}-\d{2}$/.test(String(firstDueDate || '').trim()) ? String(firstDueDate) : todayIso();
    for (let i = 1; i <= c; i++) {
      const cents = base + (i <= rem ? 1 : 0);
      rows.push({
        installment_no: i,
        due_date: shiftIsoDate(anchorDate, intervalUnit || 'month', intervalValue || 1, i - 1),
        amount: round2(cents / 100),
      });
    }
    return rows;
  }

  function normalizeInstallmentChoice(mode){
    const value = String(mode || '').trim().toLowerCase();
    return (value === 'single' || value === 'installment') ? value : '';
  }

  function readInstallmentChoice(){
    const choice = normalizeInstallmentChoice(installmentChoiceInput ? installmentChoiceInput.value : '');
    if (choice) return choice;
    return readInstallmentPlan() ? 'installment' : '';
  }

  function writeInstallmentChoice(mode){
    if (installmentChoiceInput) installmentChoiceInput.value = normalizeInstallmentChoice(mode);
  }

  function readInstallmentPlan(){
    const enabled = !!(installmentPlanEnabledInput && String(installmentPlanEnabledInput.value || '0') === '1');
    if (!enabled || !installmentPlanJsonInput) return null;
    try {
      const parsed = JSON.parse(String(installmentPlanJsonInput.value || '').trim() || '{}');
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function writeInstallmentPlan(plan){
    if (!installmentPlanEnabledInput || !installmentPlanJsonInput) return;
    if (plan && typeof plan === 'object') {
      installmentPlanEnabledInput.value = '1';
      installmentPlanJsonInput.value = JSON.stringify(plan);
      writeInstallmentChoice('installment');
      installmentContextNotice = '';
    } else {
      installmentPlanEnabledInput.value = '0';
      installmentPlanJsonInput.value = '';
    }
  }

  function applyInstallmentChoice(mode, reason){
    const choice = normalizeInstallmentChoice(mode);
    if (choice === 'single') {
      writeInstallmentPlan(null);
    }
    writeInstallmentChoice(choice);
    installmentContextNotice = (typeof reason === 'string' && reason.trim() !== '') ? reason.trim() : '';
    renderInstallmentCard();
    syncConcludeState();
  }

  function clearInstallmentPlan(reason, keepChoiceMode){
    writeInstallmentPlan(null);
    const keepChoice = normalizeInstallmentChoice(keepChoiceMode);
    if (keepChoice !== '') writeInstallmentChoice(keepChoice);
    if (typeof reason === 'string' && reason.trim() !== '') installmentContextNotice = reason.trim();
    renderInstallmentCard();
    syncConcludeState();
  }

  function resetInstallmentChoice(reason){
    writeInstallmentPlan(null);
    writeInstallmentChoice('');
    installmentContextNotice = (typeof reason === 'string' && reason.trim() !== '') ? reason.trim() : '';
    renderInstallmentCard();
    syncConcludeState();
  }

  function installmentSingleChoiceEnabled(total){
    return round2(total) > 0.00001 && selectedPaymentType() !== '';
  }

  function installmentCanBeConfigured(total){
    const clientId = parseInt(String(clientSel ? (clientSel.value || '0') : '0'), 10) || 0;
    return installmentSingleChoiceEnabled(total) && clientId > 0 && !hasRechargeInCart();
  }

  function renderInstallmentScheduleRows(targetBody, rows){
    if (!targetBody) return;
    targetBody.innerHTML = '';
    if (!Array.isArray(rows) || !rows.length) {
      targetBody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-2">Nessuna rata da mostrare.</td></tr>';
      return;
    }
    targetBody.innerHTML = rows.map((row) => `<tr><td>Rata ${escHtml(row.installment_no)}</td><td>${escHtml(fmtIsoDate(row.due_date))}</td><td class="text-end">${escHtml(fmtEUR(row.amount))}</td></tr>`).join('');
  }

  function collectInstallmentPlanFromModal(){
    const clientId = parseInt(String(clientSel ? (clientSel.value || '0') : '0'), 10) || 0;
    const total = round2(currentPosTotal);
    const paymentType = selectedPaymentType();
    const hasRecharge = hasRechargeInCart();
    if (total <= 0.00001) throw new Error('Il totale della vendita deve essere maggiore di zero.');
    if (clientId <= 0) throw new Error('Seleziona un cliente prima di configurare la rateizzazione.');
    if (!paymentType) throw new Error('Seleziona il tipo di pagamento prima di configurare la rateizzazione.');
    if (hasRecharge) throw new Error('Le ricariche credito possono essere concluse solo con pagamento in unica soluzione.');

    const downPayment = round2(Math.max(0, norm(installmentDownPaymentEl ? installmentDownPaymentEl.value : 0)));
    if (downPayment >= total) throw new Error("L'acconto iniziale deve essere inferiore al totale della vendita.");

    const financed = round2(Math.max(0, total - downPayment));
    if (financed <= 0.00001) throw new Error('Il residuo da rateizzare deve essere maggiore di zero.');

    const count = Math.max(1, Math.min(120, parseInt(String(installmentCountEl ? installmentCountEl.value : '1'), 10) || 1));
    const unit = ['day','week','month'].includes(String(installmentIntervalUnitEl ? installmentIntervalUnitEl.value : 'month')) ? String(installmentIntervalUnitEl.value) : 'month';
    const maxInterval = unit === 'day' ? 365 : (unit === 'week' ? 52 : 24);
    const intervalValue = Math.max(1, Math.min(maxInterval, parseInt(String(installmentIntervalValueEl ? installmentIntervalValueEl.value : '1'), 10) || 1));
    const firstDueDate = String(installmentFirstDueEl ? installmentFirstDueEl.value : '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(firstDueDate)) throw new Error('Inserisci la data della prima scadenza.');

    let notes = String(installmentNotesEl ? installmentNotesEl.value : '').trim();
    if (notes.length > 1000) notes = notes.slice(0, 1000);

    const schedule = buildInstallmentSchedule(financed, count, firstDueDate, unit, intervalValue);
    const lastDueDate = schedule.length ? String(schedule[schedule.length - 1].due_date || firstDueDate) : firstDueDate;

    return {
      client_id: clientId,
      sale_total: total,
      payment_type: paymentType,
      down_payment_amount: downPayment,
      financed_amount: financed,
      installments_count: count,
      interval_unit: unit,
      interval_value: intervalValue,
      first_due_date: firstDueDate,
      last_due_date: lastDueDate,
      notes: notes,
      schedule: schedule
    };
  }

  function renderInstallmentModalPreview(){
    if (!installmentPreviewBodyEl) return null;
    let plan = null;
    let err = '';
    try {
      plan = collectInstallmentPlanFromModal();
    } catch (e) {
      err = String(e && e.message ? e.message : e || 'Configurazione rate non valida.');
    }

    if (installmentModalErrorEl) {
      installmentModalErrorEl.textContent = err;
      installmentModalErrorEl.classList.toggle('d-none', err === '');
    }

    if (!plan) {
      if (installmentPreviewDownPaymentEl) installmentPreviewDownPaymentEl.textContent = fmtEUR(0);
      if (installmentPreviewFinancedEl) installmentPreviewFinancedEl.textContent = fmtEUR(0);
      if (installmentPreviewLastDueEl) installmentPreviewLastDueEl.textContent = '—';
      renderInstallmentScheduleRows(installmentPreviewBodyEl, []);
      return null;
    }

    if (installmentPreviewDownPaymentEl) installmentPreviewDownPaymentEl.textContent = fmtEUR(plan.down_payment_amount);
    if (installmentPreviewFinancedEl) installmentPreviewFinancedEl.textContent = fmtEUR(plan.financed_amount);
    if (installmentPreviewLastDueEl) installmentPreviewLastDueEl.textContent = fmtIsoDate(plan.last_due_date);
    renderInstallmentScheduleRows(installmentPreviewBodyEl, plan.schedule);
    return plan;
  }

  function populateInstallmentModal(){
    if (!installmentModalEl) return;
    const plan = readInstallmentPlan();
    const total = round2(currentPosTotal);
    const paymentType = selectedPaymentType();
    const opt = clientSel && clientSel.options ? clientSel.options[clientSel.selectedIndex] : null;
    const clientLabel = opt ? String(opt.textContent || opt.innerText || '').trim() : '—';

    if (installmentClientLabelEl) installmentClientLabelEl.value = clientLabel || '—';
    if (installmentSaleTotalEl) installmentSaleTotalEl.value = fmtEUR(total);
    if (installmentPaymentTypeEl) installmentPaymentTypeEl.value = paymentTypeLabel(paymentType);

    if (installmentDownPaymentEl) installmentDownPaymentEl.value = plan ? String(round2(norm(plan.down_payment_amount)).toFixed(2)) : '0.00';
    if (installmentCountEl) installmentCountEl.value = plan ? String(Math.max(1, parseInt(plan.installments_count || '1', 10) || 1)) : '3';
    if (installmentFirstDueEl) installmentFirstDueEl.value = plan && plan.first_due_date ? String(plan.first_due_date) : shiftIsoDate(todayIso(), 'month', 1);
    if (installmentIntervalUnitEl) installmentIntervalUnitEl.value = plan && ['day','week','month'].includes(String(plan.interval_unit || 'month')) ? String(plan.interval_unit) : 'month';
    const unit = installmentIntervalUnitEl ? String(installmentIntervalUnitEl.value || 'month') : 'month';
    const maxInterval = unit === 'day' ? 365 : (unit === 'week' ? 52 : 24);
    if (installmentIntervalValueEl) {
      let v = plan ? Math.max(1, parseInt(plan.interval_value || '1', 10) || 1) : 1;
      if (v > maxInterval) v = maxInterval;
      installmentIntervalValueEl.max = String(maxInterval);
      installmentIntervalValueEl.value = String(v);
    }
    if (installmentNotesEl) installmentNotesEl.value = plan && plan.notes ? String(plan.notes) : '';
    renderInstallmentModalPreview();
  }

  function renderInstallmentCard(){
    if (!installmentCard) return;
    const total = round2(currentPosTotal);
    const plan = readInstallmentPlan();
    const choice = readInstallmentChoice();
    const hasClient = (parseInt(String(clientSel ? (clientSel.value || '0') : '0'), 10) || 0) > 0;
    const hasRecharge = hasRechargeInCart();
    const paymentType = selectedPaymentType();
    const canChooseSingle = installmentSingleChoiceEnabled(total);
    const canConfigure = installmentCanBeConfigured(total);
    const choiceRequired = canChooseSingle && choice === '';
    const choiceIsSingle = choice === 'single';
    const choiceIsInstallment = choice === 'installment';

    installmentCard.classList.toggle('is-disabled', !canChooseSingle && !choiceIsInstallment && !plan);
    installmentCard.classList.toggle('is-required', choiceRequired);
    if (installmentRequiredBadge) installmentRequiredBadge.classList.toggle('d-none', !choiceRequired);

    if (installmentSingleBtn) {
      installmentSingleBtn.disabled = !canChooseSingle;
      installmentSingleBtn.classList.toggle('is-selected', choiceIsSingle);
      installmentSingleBtn.classList.toggle('is-pending', false);
    }
    if (installmentConfigureBtn) {
      installmentConfigureBtn.disabled = !canConfigure;
      installmentConfigureBtn.classList.toggle('is-selected', choiceIsInstallment && !!plan);
      installmentConfigureBtn.classList.toggle('is-pending', choiceIsInstallment && !plan);
      installmentConfigureBtn.textContent = plan ? 'Modifica piano' : (choiceIsInstallment ? 'Configura piano' : 'Rateizzato');
    }

    if (installmentHeadline) {
      if (!canChooseSingle) installmentHeadline.textContent = 'Pagamento unico / rateizzato';
      else if (!choice) installmentHeadline.textContent = 'Seleziona modalità di saldo';
      else if (choiceIsSingle) installmentHeadline.textContent = 'Pagamento in unica soluzione selezionato';
      else installmentHeadline.textContent = plan ? 'Pagamento rateizzato configurato' : 'Pagamento rateizzato da configurare';
    }

    let helpText = 'Seleziona esplicitamente se il cliente paga in unica soluzione oppure con un piano rate.';
    if (total <= 0.00001) helpText = 'Totale a 0: nessuna scelta richiesta tra pagamento unico e rateizzato.';
    else if (!paymentType) helpText = 'Seleziona il tipo di pagamento per scegliere come incassare la vendita.';
    else if (!choice) helpText = 'Scelta obbligatoria: seleziona Pagamento unico o Rateizzato per continuare.';
    else if (choiceIsSingle) helpText = 'Pagamento in unica soluzione confermato.';
    else if (!hasClient) helpText = 'Per rateizzare la vendita devi prima selezionare un cliente.';
    else if (!plan) helpText = 'Completa la configurazione del piano rate per continuare.';
    else helpText = 'Piano rate confermato. Puoi modificarlo oppure selezionare Pagamento unico.';
    if (hasRecharge && !choice) helpText = 'Le ricariche credito possono essere concluse solo con pagamento in unica soluzione.';
    if (hasRecharge && choiceIsInstallment) helpText = 'Rateizzazione non disponibile per le ricariche credito. Seleziona Pagamento unico.';
    if (installmentContextNotice) helpText = installmentContextNotice;
    if (installmentHelp) installmentHelp.textContent = helpText;

    if (!plan) {
      if (installmentSummary) installmentSummary.classList.add('d-none');
      return;
    }

    if (installmentSummary) installmentSummary.classList.remove('d-none');
    if (installmentSummaryText) {
      const intervalValue = Math.max(1, parseInt(plan.interval_value || '1', 10) || 1);
      const intervalLabel = plan.interval_unit === 'day'
        ? `${intervalValue} ${intervalValue === 1 ? 'giorno' : 'giorni'}`
        : (plan.interval_unit === 'week'
          ? `${intervalValue} ${intervalValue === 1 ? 'settimana' : 'settimane'}`
          : `${intervalValue} ${intervalValue === 1 ? 'mese' : 'mesi'}`);
      installmentSummaryText.textContent = [
        'Acconto oggi ' + fmtEUR(plan.down_payment_amount || 0),
        'Residuo ' + fmtEUR(plan.financed_amount || 0),
        String(plan.installments_count || 0) + ' rate',
        'Cadenza ' + intervalLabel,
        'Prima scadenza ' + fmtIsoDate(plan.first_due_date || '')
      ].join(' • ');
    }
    if (installmentSummaryNote) {
      const note = String(plan.notes || '').trim();
      installmentSummaryNote.textContent = note !== '' ? ('Note: ' + note) : '';
      installmentSummaryNote.classList.toggle('d-none', note === '');
    }
    if (installmentScheduleWrap) installmentScheduleWrap.classList.toggle('d-none', !Array.isArray(plan.schedule) || !plan.schedule.length);
    renderInstallmentScheduleRows(installmentScheduleBody, Array.isArray(plan.schedule) ? plan.schedule : []);
  }

  function syncInstallmentPlanForContext(){
    const plan = readInstallmentPlan();
    const choice = readInstallmentChoice();
    const clientId = parseInt(String(clientSel ? (clientSel.value || '0') : '0'), 10) || 0;
    const total = round2(currentPosTotal);
    const paymentType = selectedPaymentType();
    const hasRecharge = hasRechargeInCart();

    if (total <= 0.00001 || !paymentType) {
      if (choice || plan) {
        resetInstallmentChoice('');
        return;
      }
      renderInstallmentCard();
      return;
    }

    if (hasRecharge && (choice === 'installment' || plan)) {
      clearInstallmentPlan('Le ricariche credito possono essere concluse solo con pagamento in unica soluzione.', 'single');
      return;
    }

    if (!plan) {
      renderInstallmentCard();
      return;
    }

    const planClientId = parseInt(String(plan.client_id || '0'), 10) || 0;
    const planTotal = round2(norm(plan.sale_total || 0));
    const planPaymentType = String(plan.payment_type || '').trim();
    if (clientId <= 0 || planClientId !== clientId || Math.abs(planTotal - total) > 0.02 || planPaymentType !== paymentType) {
      clearInstallmentPlan('Il piano rate è stato rimosso perché cliente, totale o tipo pagamento sono cambiati.', 'installment');
      return;
    }
    renderInstallmentCard();
  }

  function getInstallmentConcludeBlockReason(){
    const total = round2(currentPosTotal);
    if (total <= 0.00001) return '';

    const paymentType = selectedPaymentType();
    if (!paymentType) return 'Seleziona il tipo di pagamento della vendita.';

    const choice = readInstallmentChoice();
    const hasRecharge = hasRechargeInCart();
    if (!choice) {
      return hasRecharge
        ? 'Seleziona Pagamento unico per concludere la ricarica credito.'
        : 'Seleziona Pagamento unico o Rateizzato prima di concludere la vendita.';
    }
    if (hasRecharge && choice !== 'single') return 'Le ricariche credito possono essere concluse solo con pagamento in unica soluzione.';
    if (choice === 'single') return '';

    const plan = readInstallmentPlan();
    if (!plan) return 'Configura il piano rate prima di concludere la vendita.';

    const clientId = parseInt(String(clientSel ? (clientSel.value || '0') : '0'), 10) || 0;
    if (clientId <= 0) return 'Seleziona un cliente per concludere una vendita rateizzata.';
    if (total <= 0.00001) return 'La rateizzazione non è valida con totale a zero.';
    const planClientId = parseInt(String(plan.client_id || '0'), 10) || 0;
    const planTotal = round2(norm(plan.sale_total || 0));
    const planPaymentType = String(plan.payment_type || '').trim();
    if (planClientId !== clientId || Math.abs(planTotal - total) > 0.02 || planPaymentType !== paymentType) {
      return 'Il totale o il cliente della vendita è cambiato. Aggiorna la rateizzazione prima di concludere.';
    }
    return '';
  }

  function openInstallmentModal(){
    if (hasRechargeInCart()) {
      clearInstallmentPlan('Le ricariche credito possono essere concluse solo con pagamento in unica soluzione.', 'single');
      return;
    }
    applyInstallmentChoice('installment', 'Completa la configurazione del piano rate per continuare.');
    if (!installmentCanBeConfigured(currentPosTotal)) {
      renderInstallmentCard();
      return;
    }
    populateInstallmentModal();
    const modal = getInstallmentModal();
    if (modal) modal.show();
  }

  function todayIso(){
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${dd}`;
  }

  function getNewCouponDraft(){
    const enabled = !!(ncDraftFlagEl && String(ncDraftFlagEl.value || '0') === '1');
    if (!enabled) return null;

    const code = String(ncDraftCodeEl?.value || '').trim().toUpperCase();
    const tRaw = String(ncDraftTypeEl?.value || '').trim().toLowerCase();
    const type = (tRaw === 'fixed' || tRaw === 'amount' || tRaw === 'eur' || tRaw === '€') ? 'fixed' : 'percent';
    const value = norm(ncDraftValEl?.value || 0);
    const validFrom = String(ncDraftFromEl?.value || '').trim();
    const useInSale = !!(ncDraftUseEl && String(ncDraftUseEl.value || '0') === '1');

    return { code, type, value, validFrom, useInSale };
  }


  // Aggiorna badge/controlli legati al cliente selezionato
  let lastClientId = clientSel?.value || '';
  function syncClientMetaUI(){
    const cid = clientSel?.value || '';
    const hasClient = !!cid;
    const opt = hasClient ? clientSel.options[clientSel.selectedIndex] : null;
    const hasRecharge = hasRechargeInCart();

    const pointsLoaded = opt ? (String(opt.dataset.pointsLoaded || '0') === '1') : false;
    const points = (opt && pointsLoaded) ? norm(opt.dataset.points) : 0;
    const adhering = opt ? (norm(opt.dataset.adhering) > 0) : false;

    if (elClientPoints) elClientPoints.textContent = hasClient ? (pointsLoaded ? fmtPts(points) : '…') : '0';
    if (elClientAdhering) elClientAdhering.textContent = hasClient ? (adhering ? 'SI' : 'NO') : '—';

    if (elRedeemInfo) {
      if (!hasClient) elRedeemInfo.textContent = posRedeemInfoDefault;
      else if (hasFidelityRedeem && !pointsLoaded) elRedeemInfo.textContent = 'Caricamento punti disponibili…';
      else elRedeemInfo.textContent = '';
    }

    // Abilita/disabilita i campi loyalty
    if (ptsInp) ptsInp.disabled = (hasRecharge || !hasClient || !hasFidelityRedeem || !pointsLoaded);
    if (ptsMaxBtn) ptsMaxBtn.disabled = (hasRecharge || !hasClient || !hasFidelityRedeem || !pointsLoaded);

    // Reset automatico se cambia cliente (evita valori del cliente precedente)
    if (cid !== lastClientId) {
      if (ptsInp) ptsInp.value = '';
      if (creditUseHidden) creditUseHidden.value = '0';
      if (giftcardIdHidden) giftcardIdHidden.value = '0';
      if (giftcardUseHidden) giftcardUseHidden.value = '0';
      residualDraft = { credit_use: 0, giftcard_id: 0, giftcard_use: 0 };
      residualsInfo = {
        show_box: 0,
        credit: { available: 0, balance: 0, locked: 0, locked_amount: 0, locked_booking_code: '' },
        giftcards: []
      };

      if (window.posSyncPointsHelp) window.posSyncPointsHelp();
    }

    lastClientId = cid;
  }

  function getCartItems(){
    const out = [];
    document.querySelectorAll('#itemsTable tbody tr[data-item-row]').forEach(tr=>{
      const type = tr.dataset.type;
      const id = parseInt(tr.dataset.id || '0', 10) || 0;
      const qtyInp = tr.querySelector('input[name$="[qty]"]');
      const qty = Math.max(1, parseInt(qtyInp?.value || '1', 10) || 1);
      if (!type) return;
      if (type !== 'recharge' && !id) return;
      const item = {type, id, qty};
      const statusInp = tr.querySelector('input[name$="[item_status]"]');
      if (statusInp && String(statusInp.value || '').trim() !== '') {
        item.item_status = String(statusInp.value || '').trim();
      }
      if (type === 'recharge') item.amount = norm(tr.dataset.price || '0');
      out.push(item);
    });
    return out;
  }

  function getSubtotal(){
    let s = 0;
    document.querySelectorAll('#itemsTable tbody tr[data-item-row]').forEach(tr=>{
      s += norm(tr.dataset.lineTotal);
    });
    return round2(s);
  }

  function getCodeDiscount(){ return norm(window.posPricing?.code_discount); }

  function calcManualDiscount(subtotal, codeDisc){
    if (hasRechargeInCart()) return 0;
    const t = discountType?.value || '';
    const v = norm(discountValue?.value);
    let d = 0;
    if (t === 'percent') d = subtotal * (v / 100);
    else if (t === 'fixed' || t === 'amount') d = v;
    d = Math.max(0, d);
    const cap = Math.max(0, subtotal - codeDisc);
    if (d > cap) d = cap;
    return round2(d);
  }

  function calcPointsDiscount(subtotal, codeDisc, manualDisc){
    if (hasRechargeInCart()) return {points:0, discount:0};
    if (!ptsInp) return {points:0, discount:0};
    const req = wholePts(ptsInp.value);
    if (req <= 0 || euroPerPoint <= 0) return {points:0, discount:0};

    const opt = clientSel?.options?.[clientSel.selectedIndex];
    const available = opt ? wholePts(opt.dataset.points) : 0;
    let usePts = wholePts(Math.min(req, available));
    const minWhole = wholePts(fidMinPoints);
    if (minWhole > 0 && usePts < minWhole) return {points:0, discount:0};

    // Base post coupon/promo + sconto manuale
    const baseAfter = Math.max(0, subtotal - codeDisc - manualDisc);

    // Caso promo non cumulabile: base = solo importo non scontato dalla promo
    let baseForPts = baseAfter;
    if (window.posPricing?.is_promo && window.posPricing?.promo_id && !window.posPricing?.promo_allows_fidelity) {
      const nonDisc = norm(window.posPricing?.promo_non_discounted_subtotal);
      const manualPortion = (subtotal > 0 && manualDisc > 0) ? (manualDisc * (nonDisc / subtotal)) : 0;
      baseForPts = Math.max(0, nonDisc - manualPortion);
    }

    const capAmount = Math.max(0, baseForPts);

    // cap punti corrispondenti al capAmount
    let maxPtsByAmount = Math.floor((capAmount / euroPerPoint) + 1e-9);

    if (usePts > maxPtsByAmount) usePts = maxPtsByAmount;
    usePts = wholePts(usePts);
    if (minWhole > 0 && usePts < minWhole) usePts = 0;

    let disc = round2(usePts * euroPerPoint);
    if (disc > capAmount) disc = capAmount;

    return {points:usePts, discount:disc};
  }

  // Carica punti Fidelity DISPONIBILI (saldo - prenotati) per il cliente selezionato.
  // Motivo: `clients.points` è il saldo totale, ma può includere punti "prenotati" su appuntamenti.
  async function loadFidelity(){
    const cid = clientSel?.value || '';
    const opt = cid ? clientSel?.options?.[clientSel.selectedIndex] : null;

    // reset (mostra caricamento e impedisce utilizzo fino a risposta)
    if (opt) {
      opt.dataset.pointsLoaded = '0';
      opt.dataset.points = '0';
      opt.dataset.pointsReserved = '0';
      opt.dataset.pointsPending = '0';
      opt.dataset.pointsPendingCode = '';
      opt.dataset.pointsPendingStarts = '';
    }

    // Aggiorna UI subito (evita di mostrare punti "vecchi")
    syncClientMetaUI();
    if (window.posSyncPointsHelp) window.posSyncPointsHelp();
    recalcTotals();

    if (!cid) return;

    try {
      const res = await fetch('index.php?page=pos&mode=client_fidelity&client_id=' + encodeURIComponent(cid));
      const j = await res.json();
      if (j && j.ok && opt) {
        const bal = wholePts(j.balance);
        const resv = wholePts(j.reserved);
        const avail = wholePts(j.available);

        opt.dataset.pointsBalance = String(bal);
        opt.dataset.pointsReserved = String(resv);
        opt.dataset.points = String(avail);
        opt.dataset.pointsPending = String(wholePts(j.pending_reserved_points));
        opt.dataset.pointsPendingCode = String(j.pending_reserved_booking_code || '');
        opt.dataset.pointsPendingStarts = String(j.pending_reserved_starts_at || '');
        opt.dataset.pointsLoaded = '1';
      } else if (opt) {
        opt.dataset.pointsLoaded = '1';
      }
    } catch (e) {
      if (opt) opt.dataset.pointsLoaded = '1';
    }

    // Refresh UI con i valori effettivi (solo se la selezione non è cambiata nel frattempo)
    if (String(clientSel?.value || '') === String(cid)) {
      syncClientMetaUI();
      if (window.posSyncPointsHelp) window.posSyncPointsHelp();
      recalcTotals();
    }
  }

  function fmtYmd(v){
    const s = String(v || '').trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? (m[3] + '/' + m[2] + '/' + m[1]) : s;
  }

  function getSelectedClientLabel(){
    const opt = clientSel?.selectedOptions?.[0] || null;
    return opt ? String(opt.textContent || '').trim() : '';
  }

  function hasRechargeInCart(){
    return !!document.querySelector('#itemsTable tbody tr[data-item-row][data-type="recharge"]');
  }

  function syncRechargeExclusivePricingState(){
    const hasRecharge = hasRechargeInCart();
    const locked = !!(window.posQuoteLockActive && window.posQuoteLockActive());
    const pricingLocked = locked || hasRecharge;

    if (hasRecharge) {
      if (couponInp) {
        couponInp.value = '';
        couponInp.dataset.appliedCode = '';
        couponInp.readOnly = false;
      }
      if (ncDraftUseEl) ncDraftUseEl.value = '0';
      if (discountType) discountType.value = 'none';
      if (discountValue) discountValue.value = '0';
      if (ptsInp) ptsInp.value = '';
      if (window.posPricing) {
        window.posPricing.code = '';
        window.posPricing.code_discount = 0;
        window.posPricing.is_promo = 0;
        window.posPricing.promo_id = 0;
        window.posPricing.promo_name = '';
        window.posPricing.promo_allows_fidelity = 1;
        window.posPricing.promo_non_discounted_subtotal = 0;
        window.posPricing.stacked_with_coupon = 0;
      }
      if (couponHelp) couponHelp.textContent = 'Con una ricarica in carrello coupon, buoni, promozioni, sconti e punti non sono applicabili.';
    }

    if (couponInp) couponInp.disabled = pricingLocked;
    if (couponApplyBtn) couponApplyBtn.disabled = pricingLocked;
    if (couponRemoveBtn) couponRemoveBtn.disabled = pricingLocked;
    if (couponToggle) {
      couponToggle.classList.toggle('text-muted', pricingLocked);
      couponToggle.setAttribute('aria-disabled', pricingLocked ? 'true' : 'false');
    }
    if (discountType) discountType.disabled = pricingLocked;
    if (discountValue) discountValue.disabled = pricingLocked;

    const hasClient = !!(clientSel?.value || '');
    const opt = hasClient ? clientSel.options[clientSel.selectedIndex] : null;
    const pointsLoaded = opt ? (String(opt.dataset.pointsLoaded || '0') === '1') : false;
    const canPoints = hasClient && !!hasFidelityRedeem && pointsLoaded;
    if (ptsInp) ptsInp.disabled = pricingLocked || !canPoints;
    if (ptsMaxBtn) ptsMaxBtn.disabled = pricingLocked || !canPoints;
  }

  function readAppliedResiduals(){
    return {
      credit_use: round2(Math.max(0, norm(creditUseHidden?.value || 0))),
      giftcard_id: parseInt(giftcardIdHidden?.value || '0', 10) || 0,
      giftcard_use: round2(Math.max(0, norm(giftcardUseHidden?.value || 0))),
    };
  }

  function writeAppliedResiduals(data){
    const creditUse = round2(Math.max(0, norm(data?.credit_use || 0)));
    const giftcardId = parseInt(data?.giftcard_id || 0, 10) || 0;
    const giftcardUse = round2(Math.max(0, norm(data?.giftcard_use || 0)));

    if (creditUseHidden) creditUseHidden.value = creditUse > 0.00001 ? creditUse.toFixed(2) : '0';
    if (giftcardIdHidden) giftcardIdHidden.value = String(giftcardId > 0 ? giftcardId : 0);
    if (giftcardUseHidden) giftcardUseHidden.value = giftcardUse > 0.00001 ? giftcardUse.toFixed(2) : '0';
  }

  function findResidualGiftcard(giftcardId){
    const id = parseInt(giftcardId || 0, 10) || 0;
    if (!id) return null;
    return (Array.isArray(residualsInfo.giftcards) ? residualsInfo.giftcards : []).find(gc => (parseInt(gc.id || 0, 10) || 0) === id) || null;
  }

  function getResidualCreditMaxUsable(){
    const creditAvailable = round2(Math.max(0, norm(residualsInfo.credit?.available || 0)));
    if (hasRechargeInCart() || creditAvailable <= 0.00001) return 0;

    const subtotal = getSubtotal();
    const codeDisc = norm(window.posPricing?.code_discount);
    const manualDisc = calcManualDiscount(subtotal, codeDisc);
    const fid = calcPointsDiscount(subtotal, codeDisc, manualDisc);
    const totalBeforeResiduals = round2(Math.max(0, subtotal - codeDisc - manualDisc - fid.discount));

    const applied = readAppliedResiduals();
    const selectedGiftcardId = parseInt(residualDraft.giftcard_id || applied.giftcard_id || 0, 10) || 0;
    const selectedGiftcard = findResidualGiftcard(selectedGiftcardId);
    let giftcardUse = 0;
    if (selectedGiftcard && totalBeforeResiduals > 0.00001) {
      const requestedGiftcardUse = Math.max(0, norm(residualDraft.giftcard_use || applied.giftcard_use || 0));
      giftcardUse = round2(Math.min(Math.max(0, norm(selectedGiftcard.balance || 0)), totalBeforeResiduals, requestedGiftcardUse));
    }

    const totalBeforeCredit = round2(Math.max(0, totalBeforeResiduals - giftcardUse));
    return round2(Math.max(0, Math.min(creditAvailable, totalBeforeCredit)));
  }

  function renderResidualsSummary(){
    const hasClient = !!(clientSel?.value || '');
    const creditAvail = round2(Math.max(0, norm(residualsInfo.credit?.available || 0)));
    const giftcards = Array.isArray(residualsInfo.giftcards) ? residualsInfo.giftcards : [];
    const show = !!(hasClient && (creditAvail > 0.00001 || giftcards.length > 0 || residualsInfo.show_box));

    if (residualsBox) residualsBox.classList.toggle('d-none', !show);
    if (!show) {
      if (residualsSummary) residualsSummary.textContent = '';
      writeAppliedResiduals({ credit_use: 0, giftcard_id: 0, giftcard_use: 0 });
      return;
    }

    const parts = [];
    if (creditAvail > 0.00001) parts.push('Credito disponibile ' + fmtEUR(creditAvail));
    if (giftcards.length > 0) {
      parts.push(giftcards.length === 1 ? '1 GiftCard disponibile' : (String(giftcards.length) + ' GiftCard disponibili'));
    }
    if (hasRechargeInCart()) {
      parts.push('Non utilizzabili con una ricarica in carrello');
    }

    const applied = readAppliedResiduals();
    const appliedParts = [];
    if (applied.giftcard_id > 0 && applied.giftcard_use > 0.00001) {
      const gc = findResidualGiftcard(applied.giftcard_id);
      const gcLabel = gc && gc.code ? ('GiftCard ' + String(gc.code)) : 'GiftCard';
      appliedParts.push(gcLabel + ' ' + fmtEUR(applied.giftcard_use));
    }
    if (applied.credit_use > 0.00001) appliedParts.push('Credito ' + fmtEUR(applied.credit_use));
    if (appliedParts.length) parts.push('In uso: ' + appliedParts.join(' • '));

    if (residualsSummary) residualsSummary.textContent = parts.join(' • ');
  }

  function renderResidualsModal(){
    const applied = readAppliedResiduals();
    const hasRecharge = hasRechargeInCart();
    const creditInfo = residualsInfo.credit || {};
    const creditBalance = round2(Math.max(0, norm(creditInfo.balance || 0)));
    const creditAvailable = round2(Math.max(0, norm(creditInfo.available || 0)));
    const creditMaxUsable = getResidualCreditMaxUsable();
    const giftcards = Array.isArray(residualsInfo.giftcards) ? residualsInfo.giftcards : [];
    const currentGc = findResidualGiftcard(residualDraft.giftcard_id || applied.giftcard_id);

    if (residualsClientLabel) residualsClientLabel.textContent = getSelectedClientLabel() || '—';

    if (round2(norm(residualDraft.credit_use || 0)) > creditMaxUsable) {
      residualDraft.credit_use = creditMaxUsable;
    }

    const showCreditCard = (creditBalance > 0.00001 || creditAvailable > 0.00001 || applied.credit_use > 0.00001);
    if (residualCreditCard) residualCreditCard.classList.toggle('d-none', !showCreditCard);
    if (residualCreditAvail) residualCreditAvail.textContent = fmtEUR(creditAvailable);
    if (residualCreditToggle) residualCreditToggle.checked = norm(residualDraft.credit_use || 0) > 0.00001;
    if (residualCreditAmount) {
      residualCreditAmount.value = norm(residualDraft.credit_use || 0) > 0.00001 ? round2(residualDraft.credit_use).toFixed(2) : '0';
      residualCreditAmount.disabled = hasRecharge || creditMaxUsable <= 0.00001 || !(residualCreditToggle && residualCreditToggle.checked);
      residualCreditAmount.max = String(Math.max(0, creditMaxUsable));
    }
    if (residualCreditToggle) residualCreditToggle.disabled = hasRecharge || creditMaxUsable <= 0.00001;
    if (residualCreditMaxBtn) residualCreditMaxBtn.disabled = hasRecharge || creditMaxUsable <= 0.00001 || !(residualCreditToggle && residualCreditToggle.checked);
    if (residualCreditHint) {
      if (hasRecharge) residualCreditHint.textContent = 'Il credito non può essere usato se nel carrello è presente una ricarica.';
      else if (creditBalance > 0.00001) residualCreditHint.textContent = 'Saldo tessera: ' + fmtEUR(creditBalance) + ' • Max utilizzabile: ' + fmtEUR(creditMaxUsable);
      else residualCreditHint.textContent = '';
    }

    const showGiftcardCard = (giftcards.length > 0 || applied.giftcard_use > 0.00001 || applied.giftcard_id > 0);
    if (residualGiftcardCard) residualGiftcardCard.classList.toggle('d-none', !showGiftcardCard);
    if (residualGiftcardList) {
      if (!giftcards.length) {
        residualGiftcardList.innerHTML = '<div class="text-muted small">Nessuna GiftCard disponibile.</div>';
      } else {
        residualGiftcardList.innerHTML = giftcards.map(gc => {
          const gcId = parseInt(gc.id || 0, 10) || 0;
          const checked = (gcId > 0 && gcId === (parseInt(residualDraft.giftcard_id || applied.giftcard_id || 0, 10) || 0)) ? 'checked' : '';
          const disabled = hasRecharge ? 'disabled' : '';
          const expires = gc.expires_at ? ('Scade: ' + escHtml(fmtYmd(gc.expires_at))) : 'Scadenza: —';
          return `
            <label class="border rounded p-2 mb-2 d-flex justify-content-between align-items-start gap-3 ${checked ? 'border-primary' : ''}">
              <div class="form-check m-0">
                <input class="form-check-input pos-residual-gc-radio" type="radio" name="pos_residual_giftcard_pick" value="${gcId}" ${checked} ${disabled}>
                <span class="form-check-label ms-1">
                  <span class="fw-semibold">${escHtml(gc.code || ('GiftCard #' + String(gcId)))}</span><br>
                  <span class="small text-muted">${expires}</span>
                </span>
              </div>
              <div class="text-end">
                <div class="fw-semibold">${escHtml(fmtEUR(norm(gc.balance || 0)))}</div>
              </div>
            </label>`;
        }).join('');
      }
    }

    if (residualGiftcardControls) residualGiftcardControls.classList.toggle('d-none', !currentGc);
    if (residualGiftcardAmount) {
      residualGiftcardAmount.value = (currentGc && norm(residualDraft.giftcard_use || 0) > 0.00001) ? round2(residualDraft.giftcard_use).toFixed(2) : '0';
      residualGiftcardAmount.disabled = hasRecharge || !currentGc;
      residualGiftcardAmount.max = String(Math.max(0, norm(currentGc?.balance || 0)));
    }
    if (residualGiftcardMaxBtn) residualGiftcardMaxBtn.disabled = hasRecharge || !currentGc;
    if (residualGiftcardHint) {
      if (hasRecharge) residualGiftcardHint.textContent = 'Le GiftCard non possono essere usate se nel carrello è presente una ricarica.';
      else if (currentGc) residualGiftcardHint.textContent = 'Disponibile: ' + fmtEUR(norm(currentGc.balance || 0)) + (currentGc.expires_at ? (' • Scade: ' + fmtYmd(currentGc.expires_at)) : '');
      else residualGiftcardHint.textContent = '';
    }

    const noResiduals = (!showCreditCard && !showGiftcardCard) || (!giftcards.length && creditAvailable <= 0.00001 && !applied.credit_use && !applied.giftcard_use);
    if (residualsEmptyState) {
      residualsEmptyState.classList.toggle('d-none', !noResiduals);
      residualsEmptyState.textContent = hasRecharge
        ? 'I residui del cliente non sono utilizzabili quando nel carrello è presente una ricarica credito.'
        : 'Nessun residuo disponibile per il cliente selezionato.';
    }
  }

  function openResidualsModal(){
    if (!clientSel?.value) return;
    const modal = getResidualsModal();
    if (!modal) return;
    residualDraft = readAppliedResiduals();
    renderResidualsModal();
    modal.show();
  }

  async function loadResiduals(){
    const cid = clientSel?.value || '';
    const myReq = ++residualsReqId;

    residualsInfo = {
      show_box: 0,
      credit: { available: 0, balance: 0, locked: 0, locked_amount: 0, locked_booking_code: '' },
      giftcards: []
    };
    renderResidualsSummary();
    recalcTotals();

    if (!cid) return;

    try {
      const res = await fetch(API_RESIDUALS + '&client_id=' + encodeURIComponent(cid), { headers: { 'Accept': 'application/json' } });
      const j = await res.json();
      if (myReq !== residualsReqId) return;
      if (j && j.ok) {
        residualsInfo = {
          show_box: j.show_box ? 1 : 0,
          credit: j.credit || { available: 0, balance: 0, locked: 0, locked_amount: 0, locked_booking_code: '' },
          giftcards: Array.isArray(j.giftcards) ? j.giftcards : []
        };
      }
    } catch (e) {}

    if (myReq !== residualsReqId) return;
    renderResidualsSummary();
    recalcTotals();
  }

  async function fetchPreview(){
    if (hasRechargeInCart()) {
      syncRechargeExclusivePricingState();
      if (window.posSyncPointsHelp) window.posSyncPointsHelp();
      recalcTotals();
      return;
    }

    const nc = getNewCouponDraft();
    const isNewCouponApplied = !!(nc && nc.useInSale && nc.code);
    const code = isNewCouponApplied ? nc.code : (couponInp?.value || '').trim();
    if (!isNewCouponApplied && couponInp) couponInp.readOnly = false;
    const cid = clientSel?.value || '';
    const quoteImportId = (window.posQuoteLock && window.posQuoteLock.quoteId) ? String(window.posQuoteLock.quoteId) : '';

    // reset
    window.posPricing.code = code;
    window.posPricing.code_discount = 0;
    if (couponInp && !code) couponInp.dataset.appliedCode = '';
    window.posPricing.is_promo = 0;
    window.posPricing.promo_id = 0;
    window.posPricing.promo_name = '';
    window.posPricing.promo_allows_fidelity = 1;
    window.posPricing.promo_non_discounted_subtotal = 0;
    window.posPricing.stacked_with_coupon = 0;

    if (couponHelp) couponHelp.textContent = '';

    if (window.posQuoteLockActive && window.posQuoteLockActive()) {
      if (couponInp) couponInp.value = '';
      if (couponBox) couponBox.classList.remove('d-none');
      if (couponHelp) couponHelp.textContent = 'Con un preventivo collegato coupon e promozioni non sono applicabili.';
      if (window.posSyncPointsHelp) window.posSyncPointsHelp();
      recalcTotals();
      return;
    }

    // Se il buono è stato creato in questa vendita e va applicato subito,
    // calcoliamo lo sconto localmente (il coupon verrà inserito a fine vendita).
    if (isNewCouponApplied) {
      // Mantieni coerente UI: compila e blocca il campo codice
      if (couponInp) {
        couponInp.value = nc.code;
        couponInp.readOnly = true;
        couponInp.dataset.appliedCode = nc.code;
      }
      if (couponBox) couponBox.classList.remove('d-none');

      const subtotal = getSubtotal();
      let disc = 0;

      if (subtotal > 0 && nc.value > 0) {
        if (nc.type === 'percent') disc = subtotal * (nc.value / 100);
        else disc = nc.value;

        if (disc > subtotal) disc = subtotal;
        disc = round2(disc);
      }

      window.posPricing.code = nc.code;
      window.posPricing.code_discount = disc;
      window.posPricing.is_promo = 0;
      window.posPricing.promo_id = 0;
      window.posPricing.promo_name = '';
      window.posPricing.promo_allows_fidelity = 1;
      window.posPricing.promo_non_discounted_subtotal = 0;
      window.posPricing.stacked_with_coupon = 0;

      if (couponHelp) couponHelp.textContent = 'Buono creato in questa vendita (sarà salvato in "Buoni" alla chiusura).';

      if (window.posSyncPointsHelp) window.posSyncPointsHelp();
      recalcTotals();
      return;
    }

    if (!code) {
      // Auto promozioni (senza codice) — best-effort
      try {
        const fdAuto = new FormData();
        fdAuto.append('_csrf', csrf);
        fdAuto.append('client_id', cid);
        if (quoteImportId) fdAuto.append('quote_import_id', quoteImportId);
        fdAuto.append('items', JSON.stringify(getCartItems()));

        const res = await fetch(API_AUTO_PROMO, { method: 'POST', body: fdAuto, headers: { 'Accept': 'application/json' } });
        const j = await res.json();

        if (j && j.ok && j.is_promo && norm(j.discount) > 0) {
          window.posPricing.code = '';
          window.posPricing.code_discount = norm(j.discount);
          window.posPricing.is_promo = 1;
          window.posPricing.promo_id = parseInt(j.promo_id || 0, 10) || 0;
          window.posPricing.promo_name = j.promo_name || '';
          window.posPricing.promo_allows_fidelity = j.promo_allows_fidelity ? 1 : 0;
          window.posPricing.promo_non_discounted_subtotal = norm(j.promo_non_discounted_subtotal);
          window.posPricing.stacked_with_coupon = 0;
        }
      } catch (e) {}

      if (window.posSyncPointsHelp) window.posSyncPointsHelp();
      recalcTotals();
      return;
    }

    const fd = new FormData();
    fd.append('_csrf', csrf);
    fd.append('client_id', cid);
    if (quoteImportId) fd.append('quote_import_id', quoteImportId);
    fd.append('code', code);
    fd.append('items', JSON.stringify(getCartItems()));

    try {
      const res = await fetch(API_PREVIEW, { method: 'POST', body: fd, headers: { 'Accept': 'application/json' } });
      const j = await res.json();

      if (j && j.ok) {
        window.posPricing.code = j.code || code;
        window.posPricing.code_discount = norm(j.discount);
        if (couponInp) {
          couponInp.dataset.appliedCode = (j.applicable && window.posPricing.code_discount > 0.00001)
            ? String(window.posPricing.code || code).trim().toUpperCase()
            : '';
          couponInp.readOnly = !!couponInp.dataset.appliedCode;
        }
        window.posPricing.is_promo = j.is_promo ? 1 : 0;
        window.posPricing.promo_id = parseInt(j.promo_id || 0, 10) || 0;
        window.posPricing.promo_name = j.promo_name || '';
        window.posPricing.promo_allows_fidelity = j.promo_allows_fidelity ? 1 : 0;
        window.posPricing.promo_non_discounted_subtotal = norm(j.promo_non_discounted_subtotal);
        window.posPricing.stacked_with_coupon = j.stacked_with_coupon ? 1 : 0;

        if (couponHelp) {
          if (j.found && !j.applicable) couponHelp.textContent = j.reason || 'Codice non applicabile.';
          else if (!j.found) couponHelp.textContent = j.reason || 'Codice non trovato.';
          else couponHelp.textContent = '';
        }
      }
    } catch (e) {}

    if (window.posSyncPointsHelp) window.posSyncPointsHelp();
    recalcTotals();
  }

  let previewTimer = null;
  function schedulePreview(){
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(fetchPreview, 250);
  }

  function syncPaymentTypeControls(total){
    const enabled = total > 0.00001;
    if (paymentTypeBox) {
      paymentTypeBox.classList.toggle('is-disabled', !enabled);
      paymentTypeBox.setAttribute('aria-disabled', enabled ? 'false' : 'true');
    }
    paymentTypeInputs.forEach((inp)=>{ inp.disabled = !enabled; });
    if (enabled && paymentTypeInputs.length && !paymentTypeInputs.some(inp => inp.checked)) {
      const fallback = paymentTypeInputs.find(inp => inp.value === 'cash') || paymentTypeInputs[0];
      if (fallback) fallback.checked = true;
    }
    if (paymentTypeHelp) {
      paymentTypeHelp.textContent = enabled
        ? 'Seleziona come paga il cliente.'
        : 'Totale a 0: nessun tipo di pagamento selezionabile.';
    }
  }

  function getGiftboxDraftMeta(){
    const draftEl = document.getElementById('pos_giftbox_draft');
    const clientEl = document.getElementById('pos_giftbox_client_id');
    return {
      active: !!(draftEl && String(draftEl.value || '0') === '1'),
      storedClientId: parseInt(String(clientEl ? (clientEl.value || '0') : '0'), 10) || 0
    };
  }

  function cartRowsRequireClient(){
    const rows = Array.from(document.querySelectorAll('#itemsTable tbody tr[data-item-row]'));
    if (!rows.length) return false;
    const giftboxMeta = getGiftboxDraftMeta();
    return rows.some((tr)=>{
      const type = String(tr.dataset.type || '').toLowerCase().trim();
      if (type === 'service' || type === 'product' || type === 'recharge') return true;
      if (type === 'giftcard') return true;
      if (type === 'package') {
        const inGiftbox = String(tr.dataset.inGiftbox || '0') === '1';
        return !(giftboxMeta.active && inGiftbox);
      }
      return false;
    });
  }

  function getConcludeBlockReason(){
    const currentClientId = parseInt(String(clientSel ? (clientSel.value || '0') : '0'), 10) || 0;
    const giftboxMeta = getGiftboxDraftMeta();
    const hasCartRows = !!document.querySelector('#itemsTable tbody tr[data-item-row]');

    if (!hasCartRows) {
      return 'Aggiungi almeno un elemento prima di concludere la vendita.';
    }

    if (giftboxMeta.active && giftboxMeta.storedClientId > 0 && currentClientId !== giftboxMeta.storedClientId) {
      return 'La GiftBox è collegata a un mittente diverso. Seleziona il mittente corretto oppure elimina la GiftBox.';
    }

    if (giftboxMeta.active && giftboxMeta.storedClientId <= 0) {
      return 'Seleziona un mittente per emettere una GiftBox.';
    }

    if (giftboxMeta.active && currentClientId <= 0) {
      return 'Seleziona un mittente per emettere una GiftBox.';
    }

    if (currentClientId <= 0 && cartRowsRequireClient()) {
      return 'Seleziona un cliente per concludere la vendita.';
    }

    const giftcardRow = document.querySelector('#itemsTable tbody tr[data-item-row][data-type="giftcard"]');
    if (giftcardRow) {
      const senderInput = giftcardRow.querySelector('input[name$="[gc_client_id]"]');
      const senderClientId = parseInt(String(senderInput ? (senderInput.value || '0') : '0'), 10) || 0;
      if (senderClientId <= 0) return 'Seleziona un mittente per emettere una GiftCard.';
      if (currentClientId > 0 && senderClientId !== currentClientId) {
        return 'La GiftCard è collegata a un mittente diverso. Rimuovila e ricreala per il mittente selezionato.';
      }
    }

    const installmentReason = getInstallmentConcludeBlockReason();
    if (installmentReason) return installmentReason;

    return '';
  }

  function syncConcludeState(){
    const reason = getConcludeBlockReason();
    const enabled = reason === '';
    if (concludeBtn) {
      concludeBtn.disabled = !enabled;
      concludeBtn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
      concludeBtn.classList.toggle('disabled', !enabled);
      concludeBtn.title = enabled ? '' : reason;
    }
    if (concludeHelp) {
      concludeHelp.textContent = reason;
      concludeHelp.classList.toggle('d-none', enabled);
    }
    return enabled;
  }

  function recalcTotals(){
    syncRechargeExclusivePricingState();
    const subtotal = getSubtotal();
    const codeDisc = getCodeDiscount();
    const manualDisc = calcManualDiscount(subtotal, codeDisc);
    const fid = calcPointsDiscount(subtotal, codeDisc, manualDisc);

    // clamp input punti (per coerenza UI)
    if (ptsInp) {
      const req = wholePts(ptsInp.value);
      if (req > 0 && req !== wholePts(fid.points)) {
        ptsInp.value = fid.points > 0 ? String(fid.points) : '';
        if (window.posSyncPointsHelp) window.posSyncPointsHelp();
      }
    }


    let totalBeforeResiduals = Math.max(0, subtotal - codeDisc - manualDisc - fid.discount);
    totalBeforeResiduals = round2(totalBeforeResiduals);

    const hasRecharge = hasRechargeInCart();
    const applied = readAppliedResiduals();
    const creditAvail = hasRecharge ? 0 : round2(Math.max(0, norm(residualsInfo.credit?.available || 0)));

    let giftcardUse = 0;
    let selectedGiftcardId = parseInt(applied.giftcard_id || 0, 10) || 0;
    const selectedGc = hasRecharge ? null : findResidualGiftcard(selectedGiftcardId);
    if (!selectedGc) selectedGiftcardId = 0;
    if (selectedGc && totalBeforeResiduals > 0.00001) {
      giftcardUse = round2(Math.min(Math.max(0, norm(selectedGc.balance || 0)), totalBeforeResiduals, Math.max(0, norm(applied.giftcard_use || 0))));
      if (giftcardUse <= 0.00001) {
        giftcardUse = 0;
        selectedGiftcardId = 0;
      }
    }

    const totalBeforeCredit = round2(Math.max(0, totalBeforeResiduals - giftcardUse));

    let creditUse = 0;
    if (creditAvail > 0.00001 && totalBeforeCredit > 0.00001) {
      creditUse = round2(Math.min(creditAvail, totalBeforeCredit, Math.max(0, norm(applied.credit_use || 0))));
    }

    writeAppliedResiduals({
      credit_use: creditUse,
      giftcard_id: selectedGiftcardId,
      giftcard_use: giftcardUse,
    });

    const total = round2(Math.max(0, totalBeforeCredit - creditUse));
    currentPosSubtotal = subtotal;
    currentPosTotal = total;

    // UI dettaglio prezzi
    if (elSubtotal) elSubtotal.textContent = fmtEUR(subtotal);

    // code row
    const ncDraft = getNewCouponDraft();
    const isNewCouponApplied = !!(ncDraft && ncDraft.useInSale && ncDraft.code);

    const codeLabel = isNewCouponApplied
      ? ('Buono: ' + ncDraft.code)
      : ((window.posPricing?.stacked_with_coupon && window.posPricing?.promo_name)
          ? ('Promozione + Coupon: ' + window.posPricing.promo_name)
          : ((window.posPricing?.is_promo && window.posPricing?.promo_name)
              ? ('Promozione: ' + window.posPricing.promo_name)
              : 'Coupon / Promo'));

    if (rowCode && elCodeVal && elCodeLabel) {
      if (codeDisc > 0.00001) {
        rowCode.classList.remove('d-none');
        elCodeLabel.textContent = codeLabel;
        elCodeVal.textContent = '-' + fmtEUR(codeDisc);
      } else {
        rowCode.classList.add('d-none');
      }
    }

    if (rowManual && elManualVal) {
      if (manualDisc > 0.00001) {
        rowManual.classList.remove('d-none');
        elManualVal.textContent = '-' + fmtEUR(manualDisc);
      } else {
        rowManual.classList.add('d-none');
      }
    }

    if (rowFid && elFidVal && elFidLabel) {
      if (fid.discount > 0.00001) {
        rowFid.classList.remove('d-none');
        elFidLabel.textContent = 'Sconto Fidelity (' + fmtPts(fid.points) + ' ' + fidLabel + ')';
        elFidVal.textContent = '-' + fmtEUR(fid.discount);
      } else {
        rowFid.classList.add('d-none');
      }
    }


    if (rowGiftcard && elGiftcardVal) {
      if (giftcardUse > 0.00001) {
        rowGiftcard.classList.remove('d-none');
        elGiftcardVal.textContent = '-' + fmtEUR(giftcardUse);
      } else {
        rowGiftcard.classList.add('d-none');
      }
    }

    if (rowCredit && elCreditVal) {
      if (creditUse > 0.00001) {
        rowCredit.classList.remove('d-none');
        elCreditVal.textContent = '-' + fmtEUR(creditUse);
      } else {
        rowCredit.classList.add('d-none');
      }
    }

    if (elTotal) elTotal.textContent = fmtEUR(total);
    syncPaymentTypeControls(total);
    syncInstallmentPlanForContext();
    renderResidualsSummary();
    syncConcludeState();
  }

  // Esponi per altri script
  window.posRecalcTotals = recalcTotals;
  window.posGetConcludeBlockReason = getConcludeBlockReason;
  window.posSyncConcludeState = syncConcludeState;
  window.posOnCartChange = function(){
    schedulePreview();
    if (window.posSyncPointsHelp) window.posSyncPointsHelp();
    recalcTotals();
    if (residualsModalEl && residualsModalEl.classList.contains('show')) {
      renderResidualsModal();
    }
  };

  // Listeners
  if (clientSel) clientSel.addEventListener('change', ()=>{
    syncClientMetaUI();
    loadFidelity();
    loadResiduals();
    schedulePreview();
    recalcTotals();
  });

  if (couponToggle) {
    couponToggle.addEventListener('click', (e)=>{
      e.preventDefault();
      if (couponToggle.getAttribute('aria-disabled') === 'true') return;
      if (couponBox) couponBox.classList.toggle('d-none');
      if (couponBox && !couponBox.classList.contains('d-none') && couponInp) {
        try { couponInp.focus(); } catch (_) {}
      }
    });
  }
  if (couponApplyBtn) {
    couponApplyBtn.addEventListener('click', ()=>{
      if (couponBox) couponBox.classList.remove('d-none');
      const typedCode = couponInp ? String(couponInp.value || '').trim().toUpperCase() : '';
      const appliedCode = couponInp ? String(couponInp.dataset.appliedCode || '').trim().toUpperCase() : '';
      if (couponInp) couponInp.value = typedCode;
      if (appliedCode && typedCode && appliedCode !== typedCode) {
        if (couponInp) couponInp.value = appliedCode;
        if (couponHelp) couponHelp.textContent = 'Puoi applicare un solo coupon per vendita. Rimuovi quello attuale prima di inserirne un altro.';
        return;
      }
      schedulePreview();
    });
  }
  if (couponRemoveBtn) {
    couponRemoveBtn.addEventListener('click', ()=>{
      if (couponInp) {
        couponInp.readOnly = false;
        couponInp.value = '';
        couponInp.dataset.appliedCode = '';
      }
      if (couponHelp) couponHelp.textContent = '';
      if (couponBox) couponBox.classList.add('d-none');
      schedulePreview();
    });
  }
  if (couponInp) {
    couponInp.addEventListener('keydown', (e)=>{
      if (e.key === 'Enter') {
        e.preventDefault();
        schedulePreview();
      }
    });
  }

  if (paymentTypeInputs.length) {
    paymentTypeInputs.forEach((inp)=>{
      inp.addEventListener('change', ()=>{
        installmentContextNotice = '';
        syncInstallmentPlanForContext();
        syncConcludeState();
      });
    });
  }

  if (discountType) discountType.addEventListener('change', ()=>{
    if (window.posSyncPointsHelp) window.posSyncPointsHelp();
    recalcTotals();
  });
  if (discountValue) discountValue.addEventListener('input', ()=>{
    if (window.posSyncPointsHelp) window.posSyncPointsHelp();
    recalcTotals();
  });

  // Punti Fidelity
  if (ptsInp) {
    ptsInp.addEventListener('input', ()=>{
      const p = wholePts(ptsInp.value);
      ptsInp.value = p > 0 ? String(p) : '';
      recalcTotals();
    });
  }


  const bindInstallmentPreviewField = (el) => {
    if (!el) return;
    el.addEventListener('input', renderInstallmentModalPreview);
    el.addEventListener('change', renderInstallmentModalPreview);
  };

  if (installmentSingleBtn) {
    installmentSingleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      applyInstallmentChoice('single', 'Pagamento in unica soluzione selezionato.');
    });
  }
  if (installmentConfigureBtn) {
    installmentConfigureBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openInstallmentModal();
    });
  }
  if (installmentEditBtn) {
    installmentEditBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openInstallmentModal();
    });
  }
  if (installmentSaveBtn) {
    installmentSaveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const plan = renderInstallmentModalPreview();
      if (!plan) return;
      writeInstallmentPlan(plan);
      renderInstallmentCard();
      syncConcludeState();
      const modal = getInstallmentModal();
      if (modal) modal.hide();
    });
  }
  [
    installmentDownPaymentEl,
    installmentCountEl,
    installmentFirstDueEl,
    installmentIntervalValueEl,
    installmentIntervalUnitEl,
    installmentNotesEl,
  ].forEach(bindInstallmentPreviewField);

  if (installmentModalEl) {
    installmentModalEl.addEventListener('hidden.bs.modal', () => {
      renderInstallmentModalPreview();
    });
  }

  if (residualsOpen) {
    residualsOpen.addEventListener('click', (e)=>{
      e.preventDefault();
      openResidualsModal();
    });
  }

  if (residualCreditToggle) {
    residualCreditToggle.addEventListener('change', ()=>{
      if (!residualCreditToggle.checked) {
        residualDraft.credit_use = 0;
        if (residualCreditAmount) residualCreditAmount.value = '0';
      } else if (norm(residualDraft.credit_use || 0) <= 0.00001) {
        residualDraft.credit_use = getResidualCreditMaxUsable();
      }
      renderResidualsModal();
    });
  }

  if (residualCreditAmount) {
    residualCreditAmount.addEventListener('input', ()=>{
      let v = round2(Math.max(0, norm(residualCreditAmount.value || 0)));
      const max = getResidualCreditMaxUsable();
      if (v > max) v = max;
      residualDraft.credit_use = v;
      if (residualCreditToggle) residualCreditToggle.checked = v > 0.00001;
      renderResidualsModal();
    });
  }

  if (residualCreditMaxBtn) {
    residualCreditMaxBtn.addEventListener('click', ()=>{
      residualDraft.credit_use = getResidualCreditMaxUsable();
      if (residualCreditToggle) residualCreditToggle.checked = residualDraft.credit_use > 0.00001;
      renderResidualsModal();
    });
  }

  if (residualGiftcardList) {
    residualGiftcardList.addEventListener('change', (e)=>{
      const radio = e.target.closest('.pos-residual-gc-radio');
      if (!radio) return;
      residualDraft.giftcard_id = parseInt(radio.value || '0', 10) || 0;
      const gc = findResidualGiftcard(residualDraft.giftcard_id);
      residualDraft.giftcard_use = gc ? round2(Math.max(0, Math.min(norm(gc.balance || 0), norm(residualDraft.giftcard_use || 0)))) : 0;
      if (gc && residualDraft.giftcard_use <= 0.00001) residualDraft.giftcard_use = round2(Math.max(0, norm(gc.balance || 0)));
      renderResidualsModal();
    });
  }

  if (residualGiftcardAmount) {
    residualGiftcardAmount.addEventListener('input', ()=>{
      const gc = findResidualGiftcard(residualDraft.giftcard_id);
      let v = round2(Math.max(0, norm(residualGiftcardAmount.value || 0)));
      const max = gc ? round2(Math.max(0, norm(gc.balance || 0))) : 0;
      if (v > max) v = max;
      residualDraft.giftcard_use = v;
      renderResidualsModal();
    });
  }

  if (residualGiftcardMaxBtn) {
    residualGiftcardMaxBtn.addEventListener('click', ()=>{
      const gc = findResidualGiftcard(residualDraft.giftcard_id);
      residualDraft.giftcard_use = gc ? round2(Math.max(0, norm(gc.balance || 0))) : 0;
      renderResidualsModal();
    });
  }

  if (residualsApplyBtn) {
    residualsApplyBtn.addEventListener('click', ()=>{
      const gc = findResidualGiftcard(residualDraft.giftcard_id);
      writeAppliedResiduals({
        credit_use: residualCreditToggle && residualCreditToggle.checked ? round2(Math.max(0, norm(residualDraft.credit_use || 0))) : 0,
        giftcard_id: gc ? (parseInt(gc.id || 0, 10) || 0) : 0,
        giftcard_use: gc ? round2(Math.max(0, norm(residualDraft.giftcard_use || 0))) : 0,
      });
      recalcTotals();
      const modal = getResidualsModal();
      if (modal) modal.hide();
    });
  }

  // Init
  syncClientMetaUI();
  schedulePreview();
  loadFidelity();
  loadResiduals();
  recalcTotals();
})();

window.addEventListener('load', function(){
  const tbody = document.querySelector('#itemsTable tbody');
  if (!tbody) return;

  function syncQuoteImportedStatus(tr){
    if (!tr) return;
    const type = String(tr.dataset.type || '').toLowerCase().trim();
    if (!['service','product'].includes(type)) return;
    const toggle = tr.querySelector('.js-item-status-toggle');
    const hidden = tr.querySelector('input[name$="[item_status]"]');
    const badge = tr.querySelector('.js-item-status-label');
    if (!toggle || !hidden || !badge) return;

    const isOn = !!toggle.checked;
    if (type === 'service') {
      hidden.value = isOn ? 'executed' : 'prepaid';
      tr.dataset.itemStatus = hidden.value;
      badge.textContent = isOn ? 'Eseguito' : 'Prepagato';
      badge.className = 'badge rounded-pill js-item-status-label ' + (isOn ? 'text-bg-success' : 'text-bg-secondary');
    } else {
      hidden.value = isOn ? 'collected' : 'ordered';
      tr.dataset.itemStatus = hidden.value;
      badge.textContent = isOn ? 'Ritirato' : 'Ordinato';
      badge.className = 'badge rounded-pill js-item-status-label ' + (isOn ? 'text-bg-success' : 'text-bg-secondary');
    }
  }

  tbody.querySelectorAll('tr[data-item-row][data-quote-import="1"]').forEach(function(tr){
    if (tr.dataset.boundQuoteImport === '1') return;
    tr.dataset.boundQuoteImport = '1';

    const qtyInput = tr.querySelector('input[name$="[qty]"]');
    if (qtyInput) {
      const onQty = function(){
        if (typeof window.recalcRow === 'function') window.recalcRow(tr);
      };
      qtyInput.addEventListener('input', onQty);
      qtyInput.addEventListener('change', onQty);
      if (typeof window.recalcRow === 'function') window.recalcRow(tr);
    }

    const removeBtn = tr.querySelector('button.btn-outline-danger');
    if (removeBtn) {
      removeBtn.addEventListener('click', function(){
        if (window.posQuoteLockActive && window.posQuoteLockActive()) return;
        tr.remove();
        const hasRows = !!tbody.querySelector('tr[data-item-row]');
        if (!hasRows) {
          tbody.innerHTML = '<tr><td colspan="6" class="text-muted p-3">Aggiungi almeno un elemento.</td></tr>';
        }
        if (typeof window.posOnCartChange === 'function') window.posOnCartChange();
      });
    }

    const statusToggle = tr.querySelector('.js-item-status-toggle');
    if (statusToggle) {
      statusToggle.addEventListener('change', function(){
        syncQuoteImportedStatus(tr);
        if (typeof window.posOnCartChange === 'function') window.posOnCartChange();
      });
      syncQuoteImportedStatus(tr);
    }
  });

  if (typeof window.posOnCartChange === 'function') window.posOnCartChange();
});

(function() {
  // ===== CLIENTI: lista a sinistra -> select nascosto =====
  const clientSel = document.getElementById('posClient');
  const listEl = document.getElementById('posClientList');
  const searchEl = document.getElementById('posClientSearch');
  const labelEl = document.getElementById('posClientLabel');
  const clearBtnEl = document.getElementById('posClientClearBtn');
  const LOCKED_QUOTE_CLIENT_ID = Number(POS_CONFIG.lockedQuoteClientId || 0) || 0;

  // Helper: validazione email (usata da invio GiftCard/GiftBox)
  function gcIsEmail(v){
    v = String(v || '').trim();
    if (!v) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }


  function syncClientUI() {
    if (!clientSel) return;
    const id = String(clientSel.value || '');
    const opt = clientSel.selectedOptions && clientSel.selectedOptions[0] ? clientSel.selectedOptions[0] : null;
    const hasClient = !!(opt && opt.value);
    if (labelEl) labelEl.textContent = hasClient ? (opt.textContent || '').trim() : '—';
    if (clearBtnEl) clearBtnEl.classList.toggle('d-none', !hasClient || !!LOCKED_QUOTE_CLIENT_ID);

    if (listEl) {
      listEl.querySelectorAll('.pos-client-row').forEach(btn => {
        btn.classList.toggle('active', String(btn.dataset.clientId || '') === id);
      });
    }
  }

  // Rimuovi cliente selezionato (X)
  if (clearBtnEl && clientSel) {
    clearBtnEl.addEventListener('click', (ev) => {
      ev.preventDefault();
      if (LOCKED_QUOTE_CLIENT_ID) return;
      if (!clientSel.value) return;
      clientSel.value = '';
      clientSel.dispatchEvent(new Event('change', { bubbles: true }));
      syncClientUI();
    });
  }

  if (listEl && clientSel) {
    listEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.pos-client-row');
      if (!btn) return;
      const id = String(btn.dataset.clientId || '');
      if (!id) return;
      if (LOCKED_QUOTE_CLIENT_ID && String(LOCKED_QUOTE_CLIENT_ID) !== id) return;

      if (clientSel.value !== id) clientSel.value = id;
      clientSel.dispatchEvent(new Event('change', { bubbles: true }));
      syncClientUI();
    });
  }

  if (searchEl && listEl) {
    searchEl.addEventListener('input', () => {
      const q = (searchEl.value || '').toLowerCase().trim();
      listEl.querySelectorAll('.pos-client-row').forEach(btn => {
        const txt = ((btn.dataset.clientName || '') + ' ' + (btn.textContent || '')).toLowerCase();
        btn.style.display = (!q || txt.includes(q)) ? '' : 'none';
      });
    });
  }

  if (clientSel) {
    clientSel.addEventListener('change', syncClientUI);
    syncClientUI();
  }

  // ===== CATALOGO: griglia servizi/prodotti =====
  const POS_SERVICES = Array.isArray(POS_CONFIG.services) ? POS_CONFIG.services : [];

  const POS_PRODUCTS = Array.isArray(POS_CONFIG.products) ? POS_CONFIG.products : [];

  const POS_SERVICE_CATS = Array.isArray(POS_CONFIG.serviceCategories) ? POS_CONFIG.serviceCategories : [];

  const POS_PRODUCT_CATS = Array.isArray(POS_CONFIG.productCategories) ? POS_CONFIG.productCategories : [];

  const gridEl = document.getElementById('posCatalogGrid');
  const searchCatalogEl = document.getElementById('posCatalogSearch');
  const catEl = document.getElementById('posCatalogCategory');
  const btnSvc = document.getElementById('posCatalogBtnServices');
  const btnProd = document.getElementById('posCatalogBtnProducts');

  const csrfToken = document.getElementById('posForm')?.querySelector('input[name="_csrf"]')?.value || '';

  function fmtEUR(n) {
    try {
      return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);
    } catch (e) {
      const v = (Number(n) || 0).toFixed(2);
      return '€ ' + v.replace('.', ',');
    }
  }

  let mode = 'service';

  // ===== PROMO PREZZI IN CATALOGO (card servizi/prodotti) =====
  // Obiettivo: se una promo automatica è applicabile a un singolo servizio/prodotto,
  // mostrare il prezzo scontato direttamente sulla card (oltre che nel totale, che già lo calcola).
  // Le promo con target cliente continuano a richiedere un cliente selezionato.
  //
  // Nota: valutiamo l'elemento "da solo" (qty=1) per non dover ricalcolare l'intero catalogo.
  // Le promo complesse che richiedono combinazioni/quantità multiple saranno visibili nel totale quando aggiungi gli elementi al carrello.
  let promoTimer = null;
  let promoLastKey = '';
  let promoReqCounter = 0;

  function tileSetPromo(btn, info){
    if (!btn) return;
    const base = parseFloat(btn.dataset.basePrice || '0') || 0;

    const elOld = btn.querySelector('.pos-tile-price-old');
    const elNow = btn.querySelector('.pos-tile-price');
    const elBadge = btn.querySelector('.pos-tile-promo-badge');

    if (!elNow) return;

    const hasPromo = !!(info && (info.promo_unit_price !== undefined) && (parseFloat(info.promo_unit_price) + 1e-9 < base));
    if (hasPromo) {
      const promoPrice = parseFloat(info.promo_unit_price) || 0;
      const pct = parseFloat(info.percent) || 0;

      if (elOld) {
        elOld.textContent = fmtEUR(base);
        elOld.classList.remove('d-none');
      }
      elNow.textContent = fmtEUR(promoPrice);

      if (elBadge) {
        let badgeTxt = 'Promo';
        if (pct >= 1) badgeTxt = '-' + Math.round(pct) + '%';
        elBadge.textContent = badgeTxt;
        const title = String(info.promo_name || '').trim();
        elBadge.title = title ? title : '';
        elBadge.classList.remove('d-none');
      }
    } else {
      // reset
      if (elOld) elOld.classList.add('d-none');
      if (elBadge) elBadge.classList.add('d-none');
      elNow.textContent = fmtEUR(base);
      if (elBadge) elBadge.title = '';
    }
  }

  function resetAllTilePromos(){
    if (!gridEl) return;
    gridEl.querySelectorAll('.pos-tile').forEach(btn => tileSetPromo(btn, null));
  }

  async function loadTilePromos(){
    if (!gridEl) return;
    if (window.posQuoteLockActive && window.posQuoteLockActive()) {
      promoLastKey = '';
      resetAllTilePromos();
      return;
    }

    const cid = clientSel ? String(clientSel.value || '') : '';
    const quoteImportId = (window.posQuoteLock && window.posQuoteLock.quoteId) ? String(window.posQuoteLock.quoteId) : '';

    const tiles = Array.from(gridEl.querySelectorAll('.pos-tile'));
    if (!tiles.length) return;

    // Prepara lista visibile (limite per prestazioni)
    const items = [];
    for (const t of tiles) {
      const id = parseInt(t.dataset.id || '0', 10) || 0;
      const tp = String(t.dataset.type || '');
      if (!id || (tp !== 'service' && tp !== 'product')) continue;
      items.push({type: tp, id: id, qty: 1});
      if (items.length >= 60) break;
    }

    const key = cid + '|' + mode + '|' + items.map(x => x.type + ':' + x.id).join(',');
    if (key === promoLastKey) return;
    promoLastKey = key;

    const thisReq = ++promoReqCounter;

    try {
      const fd = new FormData();
      if (csrfToken) fd.append('_csrf', csrfToken);
      fd.append('client_id', cid);
      if (quoteImportId) fd.append('quote_import_id', quoteImportId);
      fd.append('items', JSON.stringify(items));

      const res = await fetch('index.php?page=pos&mode=catalog_promos', { method: 'POST', body: fd, headers: { 'Accept': 'application/json' } });
      const j = await res.json();

      // Se nel frattempo è partita una richiesta più recente, ignora questa
      if (thisReq !== promoReqCounter) return;

      // Se il cliente è cambiato durante la chiamata, ignora
      const cidNow = clientSel ? String(clientSel.value || '') : '';
      if (cidNow !== cid) return;

      if (!j || !j.ok || !j.enabled || !j.map) {
        resetAllTilePromos();
        return;
      }

      const map = j.map || {};

      tiles.forEach(btn => {
        const tp = String(btn.dataset.type || '');
        const id = String(btn.dataset.id || '');
        const info = (map && map[tp] && map[tp][id]) ? map[tp][id] : null;
        tileSetPromo(btn, info);
      });
    } catch (e) {
      // Fail-safe: non bloccare il POS se il modulo promo non è presente o se ci sono errori
    }
  }

  function schedulePromoLoad(force=false){
    if (!gridEl) return;
    if (window.posQuoteLockActive && window.posQuoteLockActive()) {
      promoLastKey = '';
      resetAllTilePromos();
      return;
    }
    if (force) promoLastKey = '';
    if (promoTimer) clearTimeout(promoTimer);
    promoTimer = setTimeout(loadTilePromos, 220);
  }

  // Aggiorna prezzi promo anche quando cambia cliente
  if (clientSel) {
    clientSel.addEventListener('change', () => schedulePromoLoad(true));
  }


  function renderCategoryOptions() {
    if (!catEl) return;
    const prev = catEl.value || '';
    const cats = (mode === 'service') ? POS_SERVICE_CATS : POS_PRODUCT_CATS;

    catEl.innerHTML = '';
    const optAll = document.createElement('option');
    optAll.value = '';
    optAll.textContent = 'Tutte le aree';
    catEl.appendChild(optAll);

    cats.forEach(c => {
      const o = document.createElement('option');
      o.value = String(c.id);
      o.textContent = c.name;
      catEl.appendChild(o);
    });

    // ripristina selezione se possibile
    catEl.value = prev;
    if (prev && catEl.value !== prev) catEl.value = '';
  }

  function renderGrid() {
    if (!gridEl) return;
    const q = (searchCatalogEl?.value || '').toLowerCase().trim();
    const cat = (catEl?.value || '').trim();
    const quoteLocked = !!(window.posQuoteLockActive && window.posQuoteLockActive());

    const data = (mode === 'service') ? POS_SERVICES : POS_PRODUCTS;

    const filtered = data.filter(it => {
      const labelSearch = String(it.display_name || it.name || '').toLowerCase();
      const nameOk = !q || labelSearch.includes(q) || String(it.sku || '').toLowerCase().includes(q);
      const catOk = !cat || String(it.category_id || '') === cat;
      return nameOk && catOk;
    });

    gridEl.innerHTML = '';
    if (!filtered.length) {
      gridEl.innerHTML = '<div class="text-muted small">Nessun risultato.</div>';
      return;
    }

    filtered.forEach(it => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pos-tile';
      btn.dataset.id = String(it.id);
      btn.dataset.type = mode;

      const name = document.createElement('div');
      name.className = 'pos-tile-name';
      name.textContent = it.display_name || it.name;

      const meta = document.createElement('div');
      meta.className = 'pos-tile-meta';

      // Prezzo listino (verrà eventualmente aggiornato con "prezzo promo" quando selezioni un cliente)
      btn.dataset.basePrice = String(it.price);

      const extra = document.createElement('div');
      extra.className = 'small text-muted';
      if (mode === 'product') {
        const st = Number(it.stock || 0);
        extra.textContent = (isFinite(st) ? ('Stock: ' + st) : '');
      } else {
        extra.textContent = '';
      }

      const priceBox = document.createElement('div');
      priceBox.className = 'text-end';

      const priceRow = document.createElement('div');
      priceRow.className = 'pos-tile-price-row';

      const priceOld = document.createElement('span');
      priceOld.className = 'pos-tile-price-old d-none';
      priceOld.textContent = fmtEUR(it.price);

      const priceNow = document.createElement('span');
      priceNow.className = 'pos-tile-price';
      priceNow.textContent = fmtEUR(it.price);

      const badge = document.createElement('span');
      badge.className = 'badge bg-success pos-tile-promo-badge d-none';
      badge.textContent = 'Promo';
      badge.title = '';

      priceRow.appendChild(priceOld);
      priceRow.appendChild(priceNow);
      priceRow.appendChild(badge);
      priceBox.appendChild(priceRow);

      meta.appendChild(extra);
      meta.appendChild(priceBox);

      btn.appendChild(name);
      btn.appendChild(meta);

      if (quoteLocked) {
        btn.disabled = true;
        btn.title = window.posQuoteLockMessage('Con un preventivo collegato non puoi aggiungere elementi al carrello.');
      }

      btn.addEventListener('click', () => {
        if (quoteLocked) {
          alert(window.posQuoteLockMessage('Con un preventivo collegato non puoi aggiungere elementi al carrello.'));
          return;
        }
        // Usa gli select nascosti per sfruttare addItem() e la logica esistente
        try {
          if (mode === 'service') {
            const sel = document.getElementById('serviceSelect');
            if (sel) sel.value = String(it.id);
            if (typeof addItem === 'function') addItem('service');
          } else {
            const sel = document.getElementById('productSelect');
            if (sel) sel.value = String(it.id);
            if (typeof addItem === 'function') addItem('product');
          }
        } catch (e) {
          console.error(e);
          alert('Impossibile aggiungere al carrello.');
        }
      });

      gridEl.appendChild(btn);
    });

    // Dopo aver renderizzato la griglia, prova a mostrare eventuali prezzi promo (se cliente selezionato)
    if (quoteLocked) {
      resetAllTilePromos();
    } else {
      schedulePromoLoad();
    }
  }

  function setMode(newMode) {
    mode = newMode;
    if (btnSvc) btnSvc.classList.toggle('active', mode === 'service');
    if (btnProd) btnProd.classList.toggle('active', mode === 'product');
    renderCategoryOptions();
    renderGrid();
  }

  if (btnSvc) btnSvc.addEventListener('click', () => setMode('service'));
  if (btnProd) btnProd.addEventListener('click', () => setMode('product'));
  if (searchCatalogEl) searchCatalogEl.addEventListener('input', renderGrid);
  if (catEl) catEl.addEventListener('change', renderGrid);

  renderCategoryOptions();
  renderGrid();

	  // ===== MODAL (Pacchetti / Ricariche / GiftBox / Buono) =====
  function selectedClientId() {
    return clientSel ? String(clientSel.value || '') : '';
  }
  function selectedClientName() {
    if (!clientSel) return '';
    const opt = clientSel.selectedOptions && clientSel.selectedOptions[0] ? clientSel.selectedOptions[0] : null;
    return opt ? (opt.textContent || '').trim() : '';
  }
  function requireClient() {
    const id = selectedClientId();
    if (!id) {
      alert('Seleziona prima un cliente.');
      return null;
    }
    return id;
  }
  function showModal(modalId, hiddenId, labelId) {
    const id = requireClient();
    if (!id) return;

    const modalEl = document.getElementById(modalId);
    const hidEl = document.getElementById(hiddenId);
    const lblEl = document.getElementById(labelId);
    if (!modalEl || !hidEl || !lblEl) return;

    hidEl.value = id;
    lblEl.textContent = selectedClientName() || ('ID ' + id);

    try {
      const m = bootstrap.Modal.getOrCreateInstance(modalEl);
      m.show();
    } catch (e) {
      // fallback
      modalEl.classList.add('show');
      modalEl.style.display = 'block';
    }
  }

  // Note: abilito i pulsanti solo se la feature sembra configurata
  const btnRecharge = document.getElementById('posBtnRecharge');
  const btnPackages = document.getElementById('posBtnPackages');
  const btnGiftbox = document.getElementById('posBtnGiftbox');
  const btnGiftcard = document.getElementById('posBtnGiftcard');
  if (btnRecharge) btnRecharge.addEventListener('click', () => {
    try {
      if (typeof window.posCartHasGiftcard === 'function' && window.posCartHasGiftcard()) {
        alert('Non puoi aggiungere ricariche: è presente una GiftCard in carrello. Rimuovila per continuare.');
        return;
      }
    } catch (e) {}
    try {
      if (typeof window.posCartHasStandalonePackage === 'function' && window.posCartHasStandalonePackage()) {
        alert('Non puoi aggiungere ricariche: è presente un pacchetto in carrello. Concludi una vendita separata oppure rimuovi il pacchetto.');
        return;
      }
    } catch (e) {}
    try {
      if (typeof gbHasDraft === 'function' && gbHasDraft()) {
        alert('Non puoi aggiungere ricariche: è presente una GiftBox in questa vendita. Elimina la GiftBox per continuare.');
        return;
      }
    } catch (e) {}
    try {
      if (typeof window.posCartHasNonRechargeItems === 'function' && window.posCartHasNonRechargeItems()) {
        alert('Non puoi aggiungere ricariche: sono già presenti altri elementi in carrello. Le ricariche vanno vendute da sole.');
        return;
      }
    } catch (e) {}
    showModal('posModalRecharge', 'posRechargeClientId', 'posRechargeClientLabel');
  });

  // Pacchetti: possono convivere con servizi/prodotti.
  // Per concludere la vendita resta comunque necessario un cliente.
  if (btnPackages) btnPackages.addEventListener('click', () => {
    if (typeof window.posCartHasGiftcard === 'function' && window.posCartHasGiftcard()) {
      alert('Non puoi aggiungere pacchetti: è presente una GiftCard in carrello. Rimuovila per continuare.');
      return;
    }

    if (typeof window.posCartHasRecharge === 'function' && window.posCartHasRecharge()) {
      alert('Non puoi aggiungere pacchetti: è presente una ricarica in carrello. Le ricariche vanno vendute da sole.');
      return;
    }

    let gbMode = false;
    try {
      gbMode = (typeof gbHasDraft === 'function') ? !!gbHasDraft() : false;
    } catch (e) {
      gbMode = false;
    }

    const hasPackages = !!POS_CONFIG.hasPackages;
    if (!hasPackages) return alert('Nessun pacchetto configurato.');

    const modalEl = document.getElementById('posModalPackages');
    const hidEl = document.getElementById('posPackageClientId');
    const lblEl = document.getElementById('posPackageClientLabel');
    const warnEl = document.getElementById('posPackageNoClientWarn');
    const gbInfoEl = document.getElementById('posPackageGiftboxModeInfo');
    if (!modalEl || !hidEl || !lblEl) return;

    const id = selectedClientId();
    hidEl.value = id || '';
    lblEl.textContent = selectedClientName() || (id ? ('ID ' + id) : 'Nessun cliente selezionato');
    if (warnEl) warnEl.classList.toggle('d-none', !!id);

    // Modalità GiftBox: il pacchetto verrà inserito nel contenuto GiftBox solo se la GiftBox è attiva.
    if (gbInfoEl) gbInfoEl.classList.toggle('d-none', !gbMode);

    try { if (typeof pkSyncExpiryHint === 'function') pkSyncExpiryHint(); } catch(e) {}

    try {
      const m = bootstrap.Modal.getOrCreateInstance(modalEl);
      m.show();
    } catch (e) {
      modalEl.classList.add('show');
      modalEl.style.display = 'block';
    }
  });

  // GiftCard: richiede sempre un cliente mittente selezionato.
  if (btnGiftcard) btnGiftcard.addEventListener('click', () => {
    const enabled = !!POS_CONFIG.giftcardEnabled;
    if (!enabled) return alert('GiftCard non disponibile (modulo o DB non aggiornato).');

    // Regola: GiftCard non cumulabile con altri elementi o GiftBox.
    try {
      if (typeof gbHasDraft === 'function' && gbHasDraft()) {
        return alert('GiftCard e GiftBox non possono essere abbinate nella stessa vendita. Elimina la GiftBox per continuare.');
      }
    } catch(e) {}

    if (typeof window.posCartHasNonGiftcardItems === 'function' && window.posCartHasNonGiftcardItems()) {
      return alert('Per vendere una GiftCard la vendita deve contenere solo la GiftCard. Rimuovi gli altri elementi dal carrello.');
    }

    const modalEl = document.getElementById('posModalGiftcard');
    const hidEl = document.getElementById('posGiftcardClientId');
    const lblEl = document.getElementById('posGiftcardClientLabel');
    if (!modalEl || !hidEl || !lblEl) return;

    const id = selectedClientId();
    if (!id) return alert('Seleziona un mittente prima di emettere una GiftCard.');
    hidEl.value = id || '';
    lblEl.textContent = selectedClientName() || ('ID ' + id);

    try {
      const m = bootstrap.Modal.getOrCreateInstance(modalEl);
      m.show();
    } catch (e) {
      modalEl.classList.add('show');
      modalEl.style.display = 'block';
    }
  });

  // UX: evidenzia (pulsante blu) quando nel carrello esiste già una ricarica / giftcard.
  // Così cliccando nuovamente si riaprono i dettagli per modificarli.
  function posSyncSpecialBottomButtons(){
    try {
      const hasRecharge = (typeof window.posCartHasRecharge === 'function') ? !!window.posCartHasRecharge() : false;
      if (btnRecharge) {
        btnRecharge.classList.toggle('is-selected', hasRecharge);
        btnRecharge.classList.toggle('active', hasRecharge);
      }
    } catch(e) {}

    try {
      const hasGiftcard = (typeof window.posCartHasGiftcard === 'function') ? !!window.posCartHasGiftcard() : false;
      if (btnGiftcard) {
        btnGiftcard.classList.toggle('is-selected', hasGiftcard);
        btnGiftcard.classList.toggle('active', hasGiftcard);
      }
    } catch(e) {}
  }

  // init
  posSyncSpecialBottomButtons();

  // UX: GiftCard - invio email (Non inviare + invio programmato)
  const gcSendNow = document.getElementById('posGcSendNow');
  const gcSendDate = document.getElementById('posGcSendDate');
  const gcSendOnBox = document.getElementById('posGcSendOnBox');
  const gcSendOn = document.getElementById('posGcSendOn');
  const gcDoNotSend = document.getElementById('posGcDoNotSend');
  const gcRecipientEmail = document.getElementById('posGcRecipientEmail');
  const gcShowAmount = document.getElementById('posGcShowAmount');

  let gcNoSendUserChoice = true;
  let gcNoSendForced = false;

  function gcSyncGiftcardUI(){
    const email = String(gcRecipientEmail ? (gcRecipientEmail.value || '') : '').trim();
    const emailOk = gcIsEmail(email);

    // Se l'email non è valida/non completa: forza "Non inviare" e impedisce la disattivazione.
    if (!emailOk) {
      gcNoSendForced = true;
      if (gcDoNotSend) gcDoNotSend.checked = true;
      if (gcDoNotSend) gcDoNotSend.disabled = true;
    } else {
      // Se prima era forzato, ripristina la scelta dell'operatore.
      if (gcNoSendForced && gcDoNotSend) {
        gcDoNotSend.checked = !!gcNoSendUserChoice;
      }
      gcNoSendForced = false;
      if (gcDoNotSend) gcDoNotSend.disabled = false;
    }

    const noSend = !!(gcDoNotSend && gcDoNotSend.checked);

    // Mostra importo: disattivato quando non si invia.
    if (gcShowAmount) gcShowAmount.disabled = noSend;

    // Controlli invio: disabilitati quando "Non inviare" è attivo.
    if (gcSendNow) gcSendNow.disabled = noSend;
    if (gcSendDate) gcSendDate.disabled = noSend;
    if (gcSendOn) {
      gcSendOn.disabled = noSend;
      if (noSend) gcSendOn.required = false;
    }

    if (noSend) {
      if (gcSendOnBox) gcSendOnBox.classList.add('d-none');
      return;
    }

    // Invio programmato: mostra/nasconde data
    const isDate = !!(gcSendDate && gcSendDate.checked);
    if (gcSendOnBox) gcSendOnBox.classList.toggle('d-none', !isDate);
    if (gcSendOn) {
      gcSendOn.required = isDate;
      if (isDate && !String(gcSendOn.value || '').trim()) {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth()+1).padStart(2,'0');
        const dd = String(d.getDate()).padStart(2,'0');
        gcSendOn.value = `${y}-${m}-${dd}`;
      }
    }
  }

  // Expose for other scripts (e.g. reset modal)
  window.posGcSyncUI = gcSyncGiftcardUI;

  if (gcSendNow) gcSendNow.addEventListener('change', gcSyncGiftcardUI);
  if (gcSendDate) gcSendDate.addEventListener('change', gcSyncGiftcardUI);
  if (gcRecipientEmail) gcRecipientEmail.addEventListener('input', gcSyncGiftcardUI);
  if (gcDoNotSend) gcDoNotSend.addEventListener('change', ()=>{
    const email = String(gcRecipientEmail ? (gcRecipientEmail.value || '') : '').trim();
    if (gcIsEmail(email)) {
      gcNoSendUserChoice = !!gcDoNotSend.checked;
    }
    gcSyncGiftcardUI();
  });

  gcSyncGiftcardUI();

  // Destinatario: cliente già esistente (GiftCard)
  const gcRecipientExistingToggleEl = document.getElementById('posGcRecipientExistingToggle');
  const gcRecipientExistingBoxEl = document.getElementById('posGcRecipientExistingBox');
  const gcRecipientClientSearchEl = document.getElementById('posGcRecipientClientSearch');
  const gcRecipientClientListEl = document.getElementById('posGcRecipientClientList');
  const gcRecipientFidelityAlertEl = document.getElementById('posGcRecipientFidelityAlert');
  const gcRecipientSelectedBoxEl = document.getElementById('posGcRecipientSelectedBox');
  const gcRecipientSelectedNameEl = document.getElementById('posGcRecipientSelectedName');
  const gcRecipientSelectedMetaEl = document.getElementById('posGcRecipientSelectedMeta');
  const gcRecipientRemoveBtnEl = document.getElementById('posGcRecipientRemoveBtn');
  const gcRecipientSearchWrapEl = document.getElementById('posGcRecipientSearchWrap');
  const gcRecipientClientIdUiEl = document.getElementById('posGiftcardRecipientClientId');

  function gcSetRecipientClient(clientId){
    const meta = posFindClientMeta(clientId);
    const cid = meta ? meta.id : 0;
    if (gcRecipientClientIdUiEl) gcRecipientClientIdUiEl.value = cid ? String(cid) : '';

    // Compila nome/email destinatario.
    // Se è selezionato un cliente già esistente:
    // - nome (precompilato) NON modificabile
    // - email (precompilata) NON modificabile solo se presente/valida nell'anagrafica cliente
    const recNameEl = document.getElementById('posGcRecipientName');
    const recEmailEl = document.getElementById('posGcRecipientEmail');
    if (recNameEl && meta && meta.name) recNameEl.value = meta.name;
    if (recNameEl) recNameEl.readOnly = !!cid;

    if (recEmailEl) {
      const em = (meta && meta.email) ? String(meta.email || '').trim() : '';
      if (em && posIsEmail(em)) {
        recEmailEl.value = em;
        recEmailEl.readOnly = true;
      } else {
        recEmailEl.readOnly = false;
      }
    }

    // Se compilo l'email via selezione cliente, riallineo subito la UI invio (Non inviare / invio programmato)
    try { if (typeof window.posGcSyncUI === 'function') window.posGcSyncUI(); } catch (e) {}

    try {
      posMarkActiveRecipient(gcRecipientClientListEl, cid);
      const btn = gcRecipientClientListEl ? gcRecipientClientListEl.querySelector('button[data-client-id="' + cid + '"]') : null;
      btn && btn.scrollIntoView && btn.scrollIntoView({block:'nearest'});
    } catch (e) {}
    try { posSetRecipientFidelityAlert(gcRecipientFidelityAlertEl, meta); } catch (e) {}

    // UI: quando un destinatario è selezionato, NON mostrare la ricerca.
    try {
      if (gcRecipientSelectedNameEl) gcRecipientSelectedNameEl.textContent = (meta && meta.name) ? meta.name : (cid ? ('Cliente ID ' + cid) : '');
      if (gcRecipientSelectedMetaEl) {
        const parts = [];
        if (cid) parts.push('#' + cid);
        if (meta && meta.email) parts.push(String(meta.email || '').trim());
        gcRecipientSelectedMetaEl.textContent = parts.join(' • ');
      }
      if (gcRecipientSelectedBoxEl) gcRecipientSelectedBoxEl.classList.toggle('d-none', !(cid > 0));
      if (gcRecipientSearchWrapEl) gcRecipientSearchWrapEl.classList.toggle('d-none', (cid > 0));
      if (gcRecipientClientSearchEl) {
        gcRecipientClientSearchEl.disabled = (cid > 0);
        gcRecipientClientSearchEl.value = '';
      }
    } catch (e) {}
  }

  function gcClearRecipientClient(){
    if (gcRecipientClientIdUiEl) gcRecipientClientIdUiEl.value = '';
    const recNameEl = document.getElementById('posGcRecipientName');
    const recEmailEl = document.getElementById('posGcRecipientEmail');
    if (recNameEl) recNameEl.readOnly = false;
    if (recEmailEl) recEmailEl.readOnly = false;
    try {
      // reset selezione + filtri lista
      posMarkActiveRecipient(gcRecipientClientListEl, 0);
      if (gcRecipientClientListEl) {
        const btns = Array.from(gcRecipientClientListEl.querySelectorAll('button[data-client-id]'));
        btns.forEach(btn => btn.classList.remove('d-none'));
      }
    } catch (e) {}
    try { posSetRecipientFidelityAlert(gcRecipientFidelityAlertEl, null); } catch (e) {}

    // UI: mostra la ricerca e nascondi la box selezionata
    try {
      if (gcRecipientSelectedNameEl) gcRecipientSelectedNameEl.textContent = '';
      if (gcRecipientSelectedMetaEl) gcRecipientSelectedMetaEl.textContent = '';
      if (gcRecipientSelectedBoxEl) gcRecipientSelectedBoxEl.classList.add('d-none');
      if (gcRecipientSearchWrapEl) gcRecipientSearchWrapEl.classList.remove('d-none');
      if (gcRecipientClientSearchEl) {
        gcRecipientClientSearchEl.disabled = false;
        gcRecipientClientSearchEl.value = '';
      }
    } catch (e) {}
  }

  function gcSyncRecipientExistingUI(){
    const on = !!(gcRecipientExistingToggleEl && gcRecipientExistingToggleEl.checked);
    if (gcRecipientExistingBoxEl) gcRecipientExistingBoxEl.classList.toggle('d-none', !on);
    if (!on) {
      gcClearRecipientClient();
      return;
    }

    // Se il toggle è attivo ma non c'è selezione, assicura che sia visibile la ricerca.
    try {
      const rid = parseInt(String(gcRecipientClientIdUiEl ? (gcRecipientClientIdUiEl.value || '') : ''), 10) || 0;
      if (rid > 0) {
        gcSetRecipientClient(rid);
      } else {
        if (gcRecipientSelectedBoxEl) gcRecipientSelectedBoxEl.classList.add('d-none');
        if (gcRecipientSearchWrapEl) gcRecipientSearchWrapEl.classList.remove('d-none');
        if (gcRecipientClientSearchEl) gcRecipientClientSearchEl.disabled = false;
      }
    } catch (e) {}
  }

  if (gcRecipientExistingToggleEl) {
    gcRecipientExistingToggleEl.addEventListener('change', gcSyncRecipientExistingUI);
  }

  if (gcRecipientClientSearchEl && gcRecipientClientListEl) {
    gcRecipientClientSearchEl.addEventListener('input', () => {
      const q = String(gcRecipientClientSearchEl.value || '').trim().toLowerCase();
      const btns = Array.from(gcRecipientClientListEl.querySelectorAll('button[data-client-id]'));
      btns.forEach(btn => {
        const hay = [
          String(btn.getAttribute('data-client-id') || ''),
          String(btn.getAttribute('data-name') || ''),
          String(btn.getAttribute('data-email') || ''),
          String(btn.getAttribute('data-phone') || ''),
        ].join(' ').toLowerCase();
        const visible = !q || hay.includes(q);
        btn.classList.toggle('d-none', !visible);
      });
    });
  }

  if (gcRecipientClientListEl) {
    gcRecipientClientListEl.addEventListener('click', (ev) => {
      const btn = ev.target && ev.target.closest ? ev.target.closest('button[data-client-id]') : null;
      if (!btn) return;
      const cid = parseInt(btn.getAttribute('data-client-id') || '0', 10) || 0;
      if (cid > 0) {
        gcSetRecipientClient(cid);
      }
    });
  }

  if (gcRecipientRemoveBtnEl) {
    gcRecipientRemoveBtnEl.addEventListener('click', () => {
      gcClearRecipientClient();
      try { gcRecipientClientSearchEl && gcRecipientClientSearchEl.focus(); } catch (e) {}
    });
  }

  // Assicurati che all'avvio la UI sia pulita
  gcSyncRecipientExistingUI();


// GiftBox: dal carrello (bozza -> emessa alla chiusura vendita)
// Nuova UX:
// - Nessun pulsante "Crea/Aggiorna" nel modal: la bozza si crea/aggiorna automaticamente.
// - Il contenuto (servizi/prodotti) segue sempre il carrello finché la GiftBox è attiva.
// - Il modal serve solo per vedere riepilogo e inserire dati destinatario/validità.
const gbDraftFlagEl = document.getElementById('pos_giftbox_draft');
const gbDraftClientEl = document.getElementById('pos_giftbox_client_id');
const gbDraftItemsEl = document.getElementById('pos_giftbox_items_json');
const gbDraftFromEl = document.getElementById('pos_giftbox_valid_from');
const gbDraftToEl = document.getElementById('pos_giftbox_valid_to');
const gbDraftRecNameEl = document.getElementById('pos_giftbox_recipient_name');
const gbDraftRecEmailEl = document.getElementById('pos_giftbox_recipient_email');
const gbDraftRecClientIdEl = document.getElementById('pos_giftbox_recipient_client_id');
const gbDraftNoteEl = document.getElementById('pos_giftbox_note');
const gbDraftInternalNoteEl = document.getElementById('pos_giftbox_internal_note');
const gbDraftEventTypeEl = document.getElementById('pos_giftbox_event_type');
const gbDraftVoucherHideAmountEl = document.getElementById('pos_giftbox_voucher_hide_amount');
const gbDraftGiftMessageEl = document.getElementById('pos_giftbox_gift_message');
const gbDraftSendModeEl = document.getElementById('pos_giftbox_send_mode');
const gbDraftSendOnEl = document.getElementById('pos_giftbox_send_on');
const gbDraftEmailShowDetailsEl = document.getElementById('pos_giftbox_email_show_details');

let gbNoSendUserChoice = true;
let gbModeUserChoice = 'now';
let gbShowDetailsUserChoice = true;

let gbModalItems = [];
let gbMetaBound = false;

// Selezione destinatario esistente (GiftBox)
const gbRecipientExistingToggleEl = document.getElementById('posGbRecipientExistingToggle');
const gbRecipientExistingBoxEl = document.getElementById('posGbRecipientExistingBox');
const gbRecipientClientSearchEl = document.getElementById('posGbRecipientClientSearch');
const gbRecipientClientListEl = document.getElementById('posGbRecipientClientList');
const gbRecipientFidelityAlertEl = document.getElementById('posGbRecipientFidelityAlert');
const gbRecipientSelectedBoxEl = document.getElementById('posGbRecipientSelectedBox');
const gbRecipientSelectedNameEl = document.getElementById('posGbRecipientSelectedName');
const gbRecipientSelectedMetaEl = document.getElementById('posGbRecipientSelectedMeta');
const gbRecipientRemoveBtnEl = document.getElementById('posGbRecipientRemoveBtn');
const gbRecipientSearchWrapEl = document.getElementById('posGbRecipientSearchWrap');
const gbRecipientClientIdUiEl = document.getElementById('posGiftboxRecipientClientId');

function posFindClientMeta(clientId){
  const cid = parseInt(clientId || '0', 10) || 0;
  if (!cid) return null;
  try {
    const opt = clientSel ? clientSel.querySelector('option[value="' + cid + '"]') : null;
    if (!opt) return null;
    return {
      id: cid,
      name: String(opt.textContent || '').trim(),
      email: String(opt.getAttribute('data-email') || '').trim(),
      adhering: String(opt.getAttribute('data-adhering') || '0') === '1'
    };
  } catch (e) {
    return null;
  }
}

function posIsEmail(v){
  v = String(v || '').trim();
  if (!v) return false;
  // Simple and safe check (client email dovrebbe essere già validata lato anagrafica)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function posSetRecipientFidelityAlert(alertEl, clientMeta){
  if (!alertEl) return;
  if (!clientMeta || !clientMeta.id) {
    alertEl.classList.add('d-none');
    alertEl.textContent = '';
    alertEl.classList.remove('alert-success','alert-warning','alert-info');
    return;
  }

  alertEl.classList.remove('d-none','alert-success','alert-warning','alert-info');
  alertEl.classList.add('alert-info');
  alertEl.textContent = 'Il voucher sarà associato al destinatario selezionato. Eventuali punti e omaggi della vendita resteranno accreditati solo al mittente (se aderisce alla Fidelity).';
}

function posMarkActiveRecipient(listEl, clientId){
  if (!listEl) return;
  const cid = String(parseInt(clientId || '0', 10) || 0);
  const btns = Array.from(listEl.querySelectorAll('button[data-client-id]'));
  btns.forEach(btn => {
    const isActive = (String(btn.getAttribute('data-client-id') || '') === cid) && cid !== '0';
    btn.classList.toggle('active', isActive);
    btn.classList.toggle('bg-light', isActive);
  });
}

function gbSetRecipientClient(clientId){
  const meta = posFindClientMeta(clientId);
  const cid = meta ? meta.id : 0;
  if (gbRecipientClientIdUiEl) gbRecipientClientIdUiEl.value = cid ? String(cid) : '';

  // Compila nome/email destinatario.
  // Se è selezionato un cliente già esistente:
  // - nome (precompilato) NON modificabile
  // - email (precompilata) NON modificabile solo se presente/valida nell'anagrafica cliente
  const recNameEl = document.getElementById('posGiftboxRecipientName');
  const recEmailEl = document.getElementById('posGiftboxRecipientEmail');
  if (recNameEl && meta && meta.name) recNameEl.value = meta.name;
  if (recNameEl) recNameEl.readOnly = !!cid;

  if (recEmailEl) {
    const em = (meta && meta.email) ? String(meta.email || '').trim() : '';
    if (em && posIsEmail(em)) {
      recEmailEl.value = em;
      recEmailEl.readOnly = true;
    } else {
      recEmailEl.readOnly = false;
    }
  }

  posMarkActiveRecipient(gbRecipientClientListEl, cid);
  try {
    const btn = gbRecipientClientListEl ? gbRecipientClientListEl.querySelector('button[data-client-id="' + cid + '"]') : null;
    btn && btn.scrollIntoView && btn.scrollIntoView({block:'nearest'});
  } catch (e) {}
  posSetRecipientFidelityAlert(gbRecipientFidelityAlertEl, meta);

  // UI: quando un destinatario è selezionato, NON mostrare la ricerca.
  try {
    if (gbRecipientSelectedNameEl) gbRecipientSelectedNameEl.textContent = (meta && meta.name) ? meta.name : (cid ? ('Cliente ID ' + cid) : '');
    if (gbRecipientSelectedMetaEl) {
      const parts = [];
      if (cid) parts.push('#' + cid);
      if (meta && meta.email) parts.push(String(meta.email || '').trim());
      gbRecipientSelectedMetaEl.textContent = parts.join(' • ');
    }
    if (gbRecipientSelectedBoxEl) gbRecipientSelectedBoxEl.classList.toggle('d-none', !(cid > 0));
    if (gbRecipientSearchWrapEl) gbRecipientSearchWrapEl.classList.toggle('d-none', (cid > 0));
    if (gbRecipientClientSearchEl) {
      gbRecipientClientSearchEl.disabled = (cid > 0);
      gbRecipientClientSearchEl.value = '';
    }
  } catch (e) {}

  // salva metadati se draft attivo
  try { if (typeof window.posGbSaveMeta === 'function') window.posGbSaveMeta(); } catch (e) {}
}

function gbClearRecipientClient(){
  if (gbRecipientClientIdUiEl) gbRecipientClientIdUiEl.value = '';
  const recNameEl = document.getElementById('posGiftboxRecipientName');
  const recEmailEl = document.getElementById('posGiftboxRecipientEmail');
  if (recNameEl) recNameEl.readOnly = false;
  if (recEmailEl) recEmailEl.readOnly = false;
  try {
    posMarkActiveRecipient(gbRecipientClientListEl, 0);
    if (gbRecipientClientListEl) {
      const btns = Array.from(gbRecipientClientListEl.querySelectorAll('button[data-client-id]'));
      btns.forEach(btn => btn.classList.remove('d-none'));
    }
  } catch (e) {}
  posSetRecipientFidelityAlert(gbRecipientFidelityAlertEl, null);

  // UI: mostra la ricerca e nascondi la box selezionata
  try {
    if (gbRecipientSelectedNameEl) gbRecipientSelectedNameEl.textContent = '';
    if (gbRecipientSelectedMetaEl) gbRecipientSelectedMetaEl.textContent = '';
    if (gbRecipientSelectedBoxEl) gbRecipientSelectedBoxEl.classList.add('d-none');
    if (gbRecipientSearchWrapEl) gbRecipientSearchWrapEl.classList.remove('d-none');
    if (gbRecipientClientSearchEl) {
      gbRecipientClientSearchEl.disabled = false;
      gbRecipientClientSearchEl.value = '';
    }
  } catch (e) {}
  try { if (typeof window.posGbSaveMeta === 'function') window.posGbSaveMeta(); } catch (e) {}
}

function gbSyncRecipientExistingUI(){
  const on = !!(gbRecipientExistingToggleEl && gbRecipientExistingToggleEl.checked);
  if (gbRecipientExistingBoxEl) gbRecipientExistingBoxEl.classList.toggle('d-none', !on);
  if (!on) {
    gbClearRecipientClient();
    return;
  }

  // Se il toggle è attivo ma non c'è selezione, assicura che sia visibile la ricerca.
  try {
    const rid = parseInt(String(gbRecipientClientIdUiEl ? (gbRecipientClientIdUiEl.value || '') : ''), 10) || 0;
    if (rid > 0) {
      gbSetRecipientClient(rid);
    } else {
      if (gbRecipientSelectedBoxEl) gbRecipientSelectedBoxEl.classList.add('d-none');
      if (gbRecipientSearchWrapEl) gbRecipientSearchWrapEl.classList.remove('d-none');
      if (gbRecipientClientSearchEl) gbRecipientClientSearchEl.disabled = false;
    }
  } catch (e) {}
}

if (gbRecipientExistingToggleEl) {
  gbRecipientExistingToggleEl.addEventListener('change', gbSyncRecipientExistingUI);
}

if (gbRecipientClientSearchEl && gbRecipientClientListEl) {
  gbRecipientClientSearchEl.addEventListener('input', () => {
    const q = String(gbRecipientClientSearchEl.value || '').trim().toLowerCase();
    const btns = Array.from(gbRecipientClientListEl.querySelectorAll('button[data-client-id]'));
    btns.forEach(btn => {
      const hay = [
        String(btn.getAttribute('data-client-id') || ''),
        String(btn.getAttribute('data-name') || ''),
        String(btn.getAttribute('data-email') || ''),
        String(btn.getAttribute('data-phone') || ''),
      ].join(' ').toLowerCase();
      const visible = !q || hay.includes(q);
      btn.classList.toggle('d-none', !visible);
    });
  });
}

if (gbRecipientClientListEl) {
  gbRecipientClientListEl.addEventListener('click', (ev) => {
    const btn = ev.target && ev.target.closest ? ev.target.closest('button[data-client-id]') : null;
    if (!btn) return;
    const cid = parseInt(btn.getAttribute('data-client-id') || '0', 10) || 0;
    if (cid > 0) {
      gbSetRecipientClient(cid);
    }
  });
}

if (gbRecipientRemoveBtnEl) {
  gbRecipientRemoveBtnEl.addEventListener('click', () => {
    gbClearRecipientClient();
    try { gbRecipientClientSearchEl && gbRecipientClientSearchEl.focus(); } catch (e) {}
  });
}

function gbNorm(x){
  if (x === null || x === undefined) return 0;
  if (typeof x === 'number') return isFinite(x) ? x : 0;
  x = String(x).trim().replace(',', '.');
  return parseFloat(x) || 0;
}
function gbFmtEUR(n){
  n = (typeof n === 'number' && isFinite(n)) ? n : 0;
  return '€ ' + n.toFixed(2).replace('.', ',');
}
function gbIso(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}

function pkFmtDate(ymd){
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim());
  if (!m) return String(ymd || '').trim();
  return `${m[3]}/${m[2]}/${m[1]}`;
}


const GB_DEFAULT_VALIDITY_VALUE = Number(POS_CONFIG.giftboxDefaultValidityValue || 0) || 0;
const GB_DEFAULT_VALIDITY_UNIT = String(POS_CONFIG.giftboxDefaultValidityUnit || 'days');

function gbParseYmdToDate(ymd){
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo-1, d);
  // validate (Date auto-corrects invalid dates)
  if (dt.getFullYear() !== y || (dt.getMonth()+1) !== mo || dt.getDate() !== d) return null;
  return dt;
}

function gbAddDaysYmd(ymd, days){
  const dt = gbParseYmdToDate(ymd);
  if (!dt) return '';
  dt.setDate(dt.getDate() + Number(days || 0));
  return gbIso(dt);
}

function gbAddMonthsClampedYmd(ymd, months){
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim());
  if (!m) return '';
  let y = Number(m[1]);
  let mo = Number(m[2]);
  let d = Number(m[3]);

  let total = (y * 12) + (mo - 1) + Number(months || 0);
  if (total < 0) total = 0;
  y = Math.floor(total / 12);
  mo = (total % 12) + 1;

  const dim = new Date(y, mo, 0).getDate();
  if (d > dim) d = dim;

  const dt = new Date(y, mo-1, d);
  return gbIso(dt);
}

function gbTodayDate(){
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function gbSyncValidityMinDates(){
  const fromEl = document.getElementById('posGiftboxValidFrom');
  const toEl = document.getElementById('posGiftboxValidTo');
  if (!fromEl || !toEl) return;

  const today = gbTodayDate();
  const todayYmd = gbIso(today);
  if (todayYmd) fromEl.min = todayYmd;

  const curFrom = gbParseYmdToDate(fromEl.value);
  if (!fromEl.disabled && curFrom && curFrom.getTime() < today.getTime()) {
    fromEl.value = todayYmd;
  }

  const fromDate = gbParseYmdToDate(fromEl.value);
  if (fromDate) {
    const minTo = gbAddDaysYmd(fromEl.value, 1);
    toEl.min = minTo || '';
    const toDate = gbParseYmdToDate(toEl.value);
    if (toDate && toDate.getTime() <= fromDate.getTime()) {
      toEl.value = '';
    }
  } else {
    toEl.min = '';
  }

  if (gbHasDraft()) {
    if (gbDraftFromEl) gbDraftFromEl.value = String(fromEl.value || '').trim();
    if (gbDraftToEl) gbDraftToEl.value = String(toEl.value || '').trim();
  }
}

function gbHasDraft(){
  return !!(gbDraftFlagEl && String(gbDraftFlagEl.value||'0') === '1');
}

function gbClearDraft(){
  if (gbDraftFlagEl) gbDraftFlagEl.value = '0';
  if (gbDraftClientEl) gbDraftClientEl.value = '';
  if (gbDraftItemsEl) gbDraftItemsEl.value = '';
  if (gbDraftFromEl) gbDraftFromEl.value = '';
  if (gbDraftToEl) gbDraftToEl.value = '';
  if (gbDraftRecNameEl) gbDraftRecNameEl.value = '';
  if (gbDraftRecEmailEl) gbDraftRecEmailEl.value = '';
  if (gbDraftRecClientIdEl) gbDraftRecClientIdEl.value = '';
  if (gbDraftNoteEl) gbDraftNoteEl.value = '';
  if (gbDraftInternalNoteEl) gbDraftInternalNoteEl.value = '';
  if (gbDraftEventTypeEl) gbDraftEventTypeEl.value = 'giftbox';
  if (gbDraftVoucherHideAmountEl) gbDraftVoucherHideAmountEl.value = '0';
  if (gbDraftGiftMessageEl) gbDraftGiftMessageEl.value = '';
  if (gbDraftSendModeEl) gbDraftSendModeEl.value = 'none';
  if (gbDraftSendOnEl) gbDraftSendOnEl.value = '';
  if (gbDraftEmailShowDetailsEl) gbDraftEmailShowDetailsEl.value = '1';

  // reset preferenze UI
  gbNoSendUserChoice = true;
  gbModeUserChoice = 'now';
  gbShowDetailsUserChoice = true;

  // Se vengono tolti i dati GiftBox, togli anche l'abbinamento dei pacchetti alla GiftBox
  // (evita che in submit venga riattivata automaticamente una GiftBox per pacchetti marcati).
  try { if (window.posPkSetAllInGiftbox) window.posPkSetAllInGiftbox(false); } catch (e) {}
}

function gbBuildSummaryHTML(items){
  let subtotal = 0;
  let html = '<table class="table table-sm mb-0"><thead><tr><th>Tipo</th><th>Elemento</th><th class="text-end">Q.tà</th></tr></thead><tbody>';
  if (!(items || []).length) {
    html += '<tr><td colspan="3" class="text-muted">Nessun elemento aggiunto. Aggiungi servizi/prodotti oppure pacchetti in abbinamento alla GiftBox.</td></tr>';
  }

  (items || []).forEach(it => {
    const t = String(it.type || '').toLowerCase();
    let type = 'ALTRO';
    if (t === 'service') type = 'SERVIZIO';
    else if (t === 'product') type = 'PRODOTTO';
    else if (t === 'package') type = 'PACCHETTO';
    const name = String(it.name || '').trim();
    let details = '';
    if (t === 'package') {
      const sd = String(it.start_date || '').trim();
      const vd = parseInt(it.validity_days || '0', 10) || 0;
      const expires = String(it.expires_at || '').trim();
      const parts = [];
      if (sd) parts.push('Valido dal: ' + pkFmtDate(sd));
      if (expires) parts.push('Valido al: ' + pkFmtDate(expires));
      else if (vd > 0) parts.push('Validita: ' + vd + ' giorni');
      if (parts.length) details = '<div class="text-muted small">' + parts.join(' • ') + '</div>';
    }
    const qty = Math.max(1, parseInt(it.qty || '1', 10) || 1);
    const lt = gbNorm(it.line_total);
    subtotal += lt;
    html += '<tr><td class="text-uppercase small">' + type + '</td><td>' + name + details + '</td><td class="text-end">' + qty + '</td></tr>';
  });
  subtotal = Math.round(subtotal * 100) / 100;
  html += '</tbody></table>';
  return { html, subtotal };
}

// Legge una snapshot del carrello per il contenuto GiftBox.
// Di default include servizi/prodotti e i pacchetti SOLO se marcati "in GiftBox".
// Se includeAllPackages=true, include anche i pacchetti non ancora marcati (utile per preview prima del salvataggio).
function gbReadCartSnapshot(includeAllPackages){
  includeAllPackages = !!includeAllPackages;
  const draftActive = (typeof gbHasDraft === 'function') ? gbHasDraft() : false;
  const tableBody = document.querySelector('#itemsTable tbody');
  const rows = tableBody ? Array.from(tableBody.querySelectorAll('tr[data-item-row]')) : [];
  const items = [];
  let subtotal = 0;

  rows.forEach(tr => {
    const type = String(tr.dataset.type || '').toLowerCase().trim();
    const itemId = parseInt(tr.dataset.id || '0', 10) || 0;
    if (itemId <= 0) return;

    // In GiftBox includiamo:
    // - sempre servizi/prodotti
    // - pacchetti SOLO se marcati "in_giftbox" (salvo preview includeAllPackages)
    if (!['service','product','package'].includes(type)) return;
    if (type === 'package' && !includeAllPackages && !draftActive && String(tr.dataset.inGiftbox || '0') !== '1') return;

    const qtyInput = tr.querySelector('input[name$="[qty]"]');
    let qty = qtyInput ? (parseInt(qtyInput.value || '1', 10) || 1) : 1;
    if (qty <= 0) qty = 1;
    if (qty > 1000) qty = 1000;

    const lt = gbNorm(tr.dataset.lineTotal);
    subtotal += lt;

    if (type === 'package') {
      items.push({
        type,
        id: itemId,
        name: String(tr.dataset.name || '').trim() || 'Pacchetto',
        qty,
        line_total: lt,
        start_date: String(tr.dataset.startDate || '').trim(),
        expires_at: String(tr.dataset.expiresAt || '').trim(),
        validity_days: parseInt(tr.dataset.validityDays || '0', 10) || 0,
      });
    } else {
      const nameEl = tr.querySelector('.pos-item-name');
      const nameCell = nameEl ? nameEl.textContent : (tr.children && tr.children[1] ? tr.children[1].textContent : '');
      items.push({ type, id: itemId, name: (nameCell || '').trim(), qty, line_total: lt });
    }
  });

  subtotal = Math.round(subtotal * 100) / 100;
  return { items, subtotal };
}

const gbDeleteLink = document.getElementById('posGiftboxDeleteLink');

function gbSyncBtnState(){
  const has = gbHasDraft();
  if (btnGiftbox) {
    btnGiftbox.classList.toggle('is-selected', has);
    btnGiftbox.classList.toggle('active', has);
  }
  if (gbDeleteLink) gbDeleteLink.classList.toggle('d-none', !has);
  try { if (typeof window.posSyncConcludeState === 'function') window.posSyncConcludeState(); } catch (e) {}
}

// Init stato pulsante GiftBox
gbSyncBtnState();

function gbWriteDraftItems(items){
  if (!gbDraftItemsEl) return;
  try {
    gbDraftItemsEl.value = JSON.stringify((items || []).map(it => ({
      type: String(it.type || '').toLowerCase(),
      id: parseInt(it.id || '0', 10) || 0,
      name: String(it.name || '').trim(),
      qty: Math.max(1, parseInt(it.qty || '1', 10) || 1),
      line_total: Math.round(gbNorm(it.line_total) * 100) / 100,
      start_date: (it.type === 'package') ? (String(it.start_date || '').trim() || null) : undefined,
      expires_at: (it.type === 'package') ? (String(it.expires_at || '').trim() || null) : undefined,
      validity_days: (it.type === 'package') ? (parseInt(it.validity_days || '0', 10) || 0) : undefined,
    })));
  } catch (e) {
    gbDraftItemsEl.value = '[]';
  }
}

function gbRenderModal(){
  const modalEl = document.getElementById('posModalGiftbox');
  if (!modalEl) return;

  const hidEl = document.getElementById('posGiftboxClientId');
  const lblEl = document.getElementById('posGiftboxClientLabel');
  const itemsEl = document.getElementById('posGiftboxItems');
  const summaryEl = document.getElementById('posGiftboxCartSummary');
  const fromEl = document.getElementById('posGiftboxValidFrom');
  const toEl = document.getElementById('posGiftboxValidTo');
  const eventEl = document.getElementById('posGiftboxEventType');
  const recNameEl = document.getElementById('posGiftboxRecipientName');
  const recEmailEl = document.getElementById('posGiftboxRecipientEmail');
  const voucherHideEl = document.getElementById('posGiftboxVoucherHideAmount');
  const msgEl = document.getElementById('posGiftboxMessage');
  const noteEl = document.getElementById('posGiftboxNote');
  const internalNoteEl = document.getElementById('posGiftboxInternalNote');
  const doNotSendEl = document.getElementById('posGbDoNotSend');
  const sendNowEl = document.getElementById('posGbSendNow');
  const sendDateEl = document.getElementById('posGbSendDate');
  const sendOnBoxEl = document.getElementById('posGbSendOnBox');
  const sendOnEl = document.getElementById('posGbSendOn');
  const showDetailsEl = document.getElementById('posGbShowDetails');
  const totalsHintEl = document.getElementById('posGiftboxTotalsHint');

  if (!hidEl || !lblEl || !itemsEl || !summaryEl || !fromEl || !toEl || !eventEl || !recNameEl || !recEmailEl || !voucherHideEl || !msgEl || !noteEl || !doNotSendEl || !sendNowEl || !sendDateEl || !sendOnBoxEl || !sendOnEl || !showDetailsEl) return;

  const clientId = selectedClientId();
  hidEl.value = clientId || '';
  lblEl.textContent = selectedClientName() || (clientId ? ('ID ' + clientId) : 'Mittente obbligatorio');

  // Ripristina metadati dal draft
  if (gbDraftFromEl) fromEl.value = gbDraftFromEl.value || '';
  if (gbDraftToEl) toEl.value = gbDraftToEl.value || '';
  if (gbDraftEventTypeEl) eventEl.value = gbDraftEventTypeEl.value || 'giftbox';
  if (gbDraftRecNameEl) recNameEl.value = gbDraftRecNameEl.value || '';
  if (gbDraftRecEmailEl) recEmailEl.value = gbDraftRecEmailEl.value || '';

  // Destinatario esistente (ripristino)
  const storedRecClientId = gbDraftRecClientIdEl ? (parseInt(gbDraftRecClientIdEl.value || '0', 10) || 0) : 0;
  if (gbRecipientExistingToggleEl) gbRecipientExistingToggleEl.checked = (storedRecClientId > 0);
  if (gbRecipientExistingBoxEl) gbRecipientExistingBoxEl.classList.toggle('d-none', !(storedRecClientId > 0));
  if (gbRecipientClientIdUiEl) gbRecipientClientIdUiEl.value = storedRecClientId > 0 ? String(storedRecClientId) : '';
  // Se è selezionato un cliente già esistente, riallinea/lock campi precompilati
  try {
    if (storedRecClientId > 0) {
      gbSetRecipientClient(storedRecClientId);
    } else {
      if (recNameEl) recNameEl.readOnly = false;
      if (recEmailEl) recEmailEl.readOnly = false;
      posMarkActiveRecipient(gbRecipientClientListEl, 0);
      posSetRecipientFidelityAlert(gbRecipientFidelityAlertEl, null);
    }
  } catch (e) {
    try { posMarkActiveRecipient(gbRecipientClientListEl, storedRecClientId); } catch (e2) {}
    try { posSetRecipientFidelityAlert(gbRecipientFidelityAlertEl, storedRecClientId > 0 ? posFindClientMeta(storedRecClientId) : null); } catch (e2) {}
  }
  if (gbDraftVoucherHideAmountEl) voucherHideEl.checked = String(gbDraftVoucherHideAmountEl.value || '0') === '1';
  if (gbDraftGiftMessageEl) msgEl.value = gbDraftGiftMessageEl.value || '';
  if (gbDraftNoteEl) noteEl.value = gbDraftNoteEl.value || '';
    if (gbDraftInternalNoteEl && internalNoteEl) internalNoteEl.value = gbDraftInternalNoteEl.value || '';

  // Se non esiste ancora una bozza (preview), applica i default SOLO nel modal
  // (non scrivere i campi nascosti finché non si preme "Salva").
  if (!gbHasDraft()) {
    const today = new Date();
    if (!String(fromEl.value || '').trim()) fromEl.value = gbIso(today);

    const baseFrom = String(fromEl.value || '').trim() || gbIso(today);
    const val = Number(GB_DEFAULT_VALIDITY_VALUE || 0);
    const unit = String(GB_DEFAULT_VALIDITY_UNIT || 'days').toLowerCase();
    let autoTo = '';
    if (val > 0){
      if (unit === 'months') autoTo = gbAddMonthsClampedYmd(baseFrom, val);
      else if (unit === 'years') autoTo = gbAddMonthsClampedYmd(baseFrom, val * 12);
      else autoTo = gbAddDaysYmd(baseFrom, val);
    }
    if (!String(toEl.value || '').trim() && autoTo) toEl.value = autoTo;

    if (!String(eventEl.value || '').trim()) eventEl.value = 'giftbox';
    voucherHideEl.checked = false;
  }

  // Ripristina preferenze invio email
  const draftSendMode = (gbDraftSendModeEl ? String(gbDraftSendModeEl.value || 'none') : 'none').toLowerCase();
  gbNoSendUserChoice = (draftSendMode === 'none');
  gbModeUserChoice = (draftSendMode === 'date') ? 'date' : 'now';
  gbShowDetailsUserChoice = gbDraftEmailShowDetailsEl ? (String(gbDraftEmailShowDetailsEl.value || '1') !== '0') : true;

  doNotSendEl.checked = gbNoSendUserChoice;
  sendNowEl.checked = (gbModeUserChoice === 'now');
  sendDateEl.checked = (gbModeUserChoice === 'date');
  if (gbDraftSendOnEl) sendOnEl.value = gbDraftSendOnEl.value || '';
  showDetailsEl.checked = !!gbShowDetailsUserChoice;

  // Items JSON (solo recap)
  try { itemsEl.value = JSON.stringify(gbModalItems || []); } catch (e) { itemsEl.value = '[]'; }

  const sum = gbBuildSummaryHTML(gbModalItems);
  summaryEl.innerHTML = sum.html;

  // Totals hint: rimosso (non mostrare Subtotale/Totale nella modal GiftBox)
  if (totalsHintEl) totalsHintEl.classList.add('d-none');

  // Pacchetti in GiftBox: date automatiche + warning validità
  const pkgInfoEl = document.getElementById('posGiftboxPackageDatesInfo');
  const pkgWarnEl = document.getElementById('posGiftboxPackageNoValidityWarn');
  const pkgItems = (gbModalItems || []).filter(it => String(it.type || '').toLowerCase() === 'package');

  // reset UI
  fromEl.disabled = false;
  toEl.disabled = false;
  if (pkgInfoEl) pkgInfoEl.classList.add('d-none');
  if (pkgWarnEl) pkgWarnEl.classList.add('d-none');

  if (pkgItems.length) {
    // Calcolo "valida dal" = min start_date
    const starts = pkgItems.map(it => String(it.start_date || '').trim()).filter(Boolean);
    let minStart = '';
    if (starts.length) {
      // confronto lessicografico OK per Y-m-d
      minStart = starts.slice().sort()[0];
    }

    // Validità: se tutti hanno validity_days > 0, calcolo "valida al" = max(scadenza)
    const withValidity = pkgItems.filter(it => String(it.expires_at || '').trim() !== '');
    const missingValidity = pkgItems.filter(it => String(it.expires_at || '').trim() === '');
    const allHaveValidity = (withValidity.length === pkgItems.length);

    let maxExpiry = '';
    if (withValidity.length) {
      const expiries = withValidity.map(it => {
        return String(it.expires_at || '').trim();
      }).filter(Boolean);
      if (expiries.length) maxExpiry = expiries.slice().sort().slice(-1)[0];
    }

    // Applica override (priorità al pacchetto)
    if (minStart) {
      fromEl.value = minStart;
      if (gbHasDraft() && gbDraftFromEl) gbDraftFromEl.value = minStart;
      fromEl.disabled = true;
    }

    if (allHaveValidity && maxExpiry) {
      toEl.value = maxExpiry;
      if (gbHasDraft() && gbDraftToEl) gbDraftToEl.value = maxExpiry;
      toEl.disabled = true;
    } else {
      // Se manca la validità su uno o più pacchetti, "Valida al" resta gestibile (default GiftBox)
      toEl.disabled = false;
    }

    // Messaggi
    if (pkgInfoEl) {
      let msg = 'Le date di validità della GiftBox seguono la validità del pacchetto.';
      if (minStart) msg += ' Valida dal: <strong>' + pkFmtDate(minStart) + '</strong>.';
      if (allHaveValidity && maxExpiry) msg += ' Valida al: <strong>' + pkFmtDate(maxExpiry) + '</strong>.';
      if (!allHaveValidity) msg += ' Alcuni pacchetti non hanno una scadenza: la scadenza GiftBox restera quella predefinita (modificabile).';
      pkgInfoEl.innerHTML = msg;
      pkgInfoEl.classList.remove('d-none');
    }

    if (pkgWarnEl && missingValidity.length) {
      const names = missingValidity.map(it => String(it.name || '').trim()).filter(Boolean);
      let msg = 'Attenzione: ';
      msg += (names.length ? ('il pacchetto <strong>' + names.join('</strong>, <strong>') + '</strong>') : 'uno o più pacchetti');
      msg += ' non ha una scadenza impostata. Verra usata la scadenza GiftBox predefinita (puoi modificarla).';
      pkgWarnEl.innerHTML = msg;
      pkgWarnEl.classList.remove('d-none');
    }
  }

  gbSyncValidityMinDates();

  const syncEmailUI = () => {
    const email = String(recEmailEl.value || '').trim();
    const emailOk = gcIsEmail(email);

    // Se l'email non è valida/non completa, forza "Non inviare" e blocca la disattivazione.
    if (!emailOk) {
      doNotSendEl.checked = true;
      doNotSendEl.disabled = true;

      sendNowEl.disabled = true;
      sendDateEl.disabled = true;

      sendOnBoxEl.classList.add('d-none');
      sendOnEl.value = '';

      showDetailsEl.checked = !!gbShowDetailsUserChoice;
      showDetailsEl.disabled = true;

      if (gbHasDraft()) {
        if (gbDraftSendModeEl) gbDraftSendModeEl.value = 'none';
        if (gbDraftSendOnEl) gbDraftSendOnEl.value = '';
        if (gbDraftEmailShowDetailsEl) gbDraftEmailShowDetailsEl.value = showDetailsEl.checked ? '1' : '0';
      }
      return;
    }

    doNotSendEl.disabled = false;
    doNotSendEl.checked = !!gbNoSendUserChoice;

    if (doNotSendEl.checked) {
      // Non inviare
      sendNowEl.disabled = true;
      sendDateEl.disabled = true;
      sendOnBoxEl.classList.add('d-none');
      sendOnEl.value = '';

      showDetailsEl.checked = !!gbShowDetailsUserChoice;
      showDetailsEl.disabled = true;

      if (gbHasDraft()) {
        if (gbDraftSendModeEl) gbDraftSendModeEl.value = 'none';
        if (gbDraftSendOnEl) gbDraftSendOnEl.value = '';
        if (gbDraftEmailShowDetailsEl) gbDraftEmailShowDetailsEl.value = showDetailsEl.checked ? '1' : '0';
      }
      return;
    }

    // Invio attivo
    sendNowEl.disabled = false;
    sendDateEl.disabled = false;
    if (gbModeUserChoice === 'date') {
      sendDateEl.checked = true;
      sendNowEl.checked = false;
    } else {
      sendNowEl.checked = true;
      sendDateEl.checked = false;
    }

    if (sendDateEl.checked) {
      sendOnBoxEl.classList.remove('d-none');
      // default oggi se vuoto
      if (!String(sendOnEl.value || '').trim()) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth()+1).padStart(2,'0');
        const dd = String(today.getDate()).padStart(2,'0');
        sendOnEl.value = `${yyyy}-${mm}-${dd}`;
      }
    } else {
      sendOnBoxEl.classList.add('d-none');
      sendOnEl.value = '';
    }

    showDetailsEl.disabled = false;
    showDetailsEl.checked = !!gbShowDetailsUserChoice;

    const mode = sendDateEl.checked ? 'date' : 'now';
    if (gbHasDraft()) {
      if (gbDraftSendModeEl) gbDraftSendModeEl.value = mode;
      if (gbDraftSendOnEl) gbDraftSendOnEl.value = mode === 'date' ? String(sendOnEl.value || '').trim() : '';
      if (gbDraftEmailShowDetailsEl) gbDraftEmailShowDetailsEl.value = showDetailsEl.checked ? '1' : '0';
    }
  };

  // Bind autosave metadati (una sola volta)
  if (!gbMetaBound) {
    gbMetaBound = true;

    const saveMeta = () => {
	      // Allinea sempre la UI invio email (anche in preview senza draft)
	      syncEmailUI();

	      // I campi nascosti vengono aggiornati solo quando la GiftBox è stata salvata (draft attivo)
	      if (!gbHasDraft()) return;

      const curClientId = selectedClientId();
      if (gbDraftClientEl) {
        if (curClientId) gbDraftClientEl.value = curClientId;
        else gbDraftClientEl.value = (String(gbDraftClientEl.value || '').trim() !== '' ? String(gbDraftClientEl.value || '').trim() : '0');
      }

      const vf = String(fromEl.value || '').trim();
      const vt = String(toEl.value || '').trim();

      if (gbDraftFromEl) gbDraftFromEl.value = vf;
      if (gbDraftToEl) gbDraftToEl.value = vt;
      if (gbDraftEventTypeEl) gbDraftEventTypeEl.value = String(eventEl.value || '').trim();
      if (gbDraftRecNameEl) gbDraftRecNameEl.value = String(recNameEl.value || '').trim();
      if (gbDraftRecEmailEl) gbDraftRecEmailEl.value = String(recEmailEl.value || '').trim();
      if (gbDraftRecClientIdEl) {
        const on = !!(gbRecipientExistingToggleEl && gbRecipientExistingToggleEl.checked);
        const cid = on ? (parseInt(String(gbRecipientClientIdUiEl ? (gbRecipientClientIdUiEl.value || '') : ''), 10) || 0) : 0;
        gbDraftRecClientIdEl.value = cid > 0 ? String(cid) : '';
      }
      if (gbDraftVoucherHideAmountEl) gbDraftVoucherHideAmountEl.value = voucherHideEl.checked ? '1' : '0';
      if (gbDraftGiftMessageEl) gbDraftGiftMessageEl.value = String(msgEl.value || '').trim();
      if (gbDraftNoteEl) gbDraftNoteEl.value = String(noteEl.value || '').trim();
      if (gbDraftInternalNoteEl && internalNoteEl) gbDraftInternalNoteEl.value = String(internalNoteEl.value || '').trim();
    };

    // Espone per il pulsante "Salva" nel modal GiftBox
    window.posGbSaveMeta = saveMeta;
    window.posGbSyncEmailUI = syncEmailUI;

    // Date validita
    [fromEl, toEl].forEach(el => {
      el.addEventListener('input', () => {
        gbSyncValidityMinDates();
        saveMeta();
      });
      el.addEventListener('change', () => {
        gbSyncValidityMinDates();
        saveMeta();
      });
    });

    // Metadati
    [eventEl, recNameEl, recEmailEl, voucherHideEl, msgEl, noteEl, internalNoteEl, sendOnEl].forEach(el => {
      el.addEventListener('input', saveMeta);
      el.addEventListener('change', saveMeta);
    });

    // Invio email (preferenze)
    doNotSendEl.addEventListener('change', () => {
      const email = String(recEmailEl.value || '').trim();
      if (gcIsEmail(email)) gbNoSendUserChoice = !!doNotSendEl.checked;
      syncEmailUI();
      saveMeta();
    });
    sendNowEl.addEventListener('change', () => {
      if (sendNowEl.checked) gbModeUserChoice = 'now';
      syncEmailUI();
      saveMeta();
    });
    sendDateEl.addEventListener('change', () => {
      if (sendDateEl.checked) gbModeUserChoice = 'date';
      syncEmailUI();
      saveMeta();
    });
    showDetailsEl.addEventListener('change', () => {
      gbShowDetailsUserChoice = !!showDetailsEl.checked;
      syncEmailUI();
      saveMeta();
    });
  }

  // Allinea subito UI invio email dopo il ripristino valori
  syncEmailUI();
}

function gbEnsureDraft(){
  try {
    const giftboxEligibilityMsg = (typeof window.posGetGiftboxEligibilityMessage === 'function') ? String(window.posGetGiftboxEligibilityMessage() || '') : '';
    if (giftboxEligibilityMsg) {
      alert(giftboxEligibilityMsg);
      return false;
    }
  } catch (e) {}

  const curClientId = selectedClientId();
  if (!curClientId) {
    alert('Seleziona un mittente prima di emettere una GiftBox.');
    return false;
  }
  const effectiveClientId = String(curClientId);

  // In modalità GiftBox, eventuali pacchetti presenti in carrello diventano contenuto GiftBox.
  // Fix bug: se è selezionato un cliente e nel carrello c'è solo un pacchetto, il riepilogo GiftBox non deve risultare vuoto.
  try { if (window.posPkSetAllInGiftbox) window.posPkSetAllInGiftbox(true); } catch (e) {}

  const snap = gbReadCartSnapshot(true);
  // Non bloccare se il contenuto è vuoto: consente di aprire il modal e impostare i metadati.
  // La vendita verrà comunque bloccata se si prova a concludere con GiftBox attiva ma senza contenuto.

  // Se il cliente cambia, resettiamo la bozza per evitare emissioni sul mittente sbagliato.
  if (gbHasDraft()) {
    const storedClientId = gbDraftClientEl ? (parseInt(gbDraftClientEl.value || '0', 10) || 0) : 0;
    const currentClientId = (parseInt(curClientId || '0', 10) || 0);

    if (storedClientId <= 0 || storedClientId !== currentClientId) {
      gbClearDraft();
    }
  }

  if (!gbHasDraft()) {
    // Attiva bozza + default metadati
    if (gbDraftFlagEl) gbDraftFlagEl.value = '1';
    if (gbDraftClientEl) gbDraftClientEl.value = String(effectiveClientId);

    const today = new Date();
    if (gbDraftFromEl && !String(gbDraftFromEl.value || '').trim()) gbDraftFromEl.value = gbIso(today);
    const baseFrom = (gbDraftFromEl ? String(gbDraftFromEl.value || '').trim() : '') || gbIso(today);
    const val = Number(GB_DEFAULT_VALIDITY_VALUE || 0);
    const unit = String(GB_DEFAULT_VALIDITY_UNIT || 'days').toLowerCase();
    let autoTo = '';
    if (val > 0){
      if (unit === 'months') autoTo = gbAddMonthsClampedYmd(baseFrom, val);
      else if (unit === 'years') autoTo = gbAddMonthsClampedYmd(baseFrom, val * 12);
      else autoTo = gbAddDaysYmd(baseFrom, val);
    }
    if (gbDraftToEl && !String(gbDraftToEl.value || '').trim() && autoTo) gbDraftToEl.value = autoTo;

    if (gbDraftRecNameEl && gbDraftRecNameEl.value === null) gbDraftRecNameEl.value = '';
    if (gbDraftRecEmailEl && gbDraftRecEmailEl.value === null) gbDraftRecEmailEl.value = '';
    if (gbDraftNoteEl && gbDraftNoteEl.value === null) gbDraftNoteEl.value = '';
    if (gbDraftInternalNoteEl && gbDraftInternalNoteEl.value === null) gbDraftInternalNoteEl.value = '';

    // Default campi aggiuntivi
    if (gbDraftEventTypeEl && !String(gbDraftEventTypeEl.value || '').trim()) gbDraftEventTypeEl.value = 'giftbox';
    if (gbDraftVoucherHideAmountEl && !String(gbDraftVoucherHideAmountEl.value || '').trim()) gbDraftVoucherHideAmountEl.value = '0';
    if (gbDraftGiftMessageEl && gbDraftGiftMessageEl.value === null) gbDraftGiftMessageEl.value = '';

    // Email settings: default "Non inviare" (email opzionale)
    if (gbDraftSendModeEl && !String(gbDraftSendModeEl.value || '').trim()) gbDraftSendModeEl.value = 'none';
    if (gbDraftSendOnEl && gbDraftSendOnEl.value === null) gbDraftSendOnEl.value = '';
    if (gbDraftEmailShowDetailsEl && !String(gbDraftEmailShowDetailsEl.value || '').trim()) gbDraftEmailShowDetailsEl.value = '1';

    gbNoSendUserChoice = true;
    gbModeUserChoice = 'now';
    gbShowDetailsUserChoice = true;
  }

  // Sync items dal carrello (sempre)
  gbModalItems = snap.items;
  gbWriteDraftItems(gbModalItems);
  gbSyncBtnState();
  return true;
}
function gbOnCartChanged(){
  if (!gbHasDraft()) return;

  // Mantieni i pacchetti in abbinamento alla GiftBox finché la GiftBox è attiva
  try { if (window.posPkSetAllInGiftbox) window.posPkSetAllInGiftbox(true); } catch (e) {}

  // Se l'utente ha tolto tutto dal carrello, disattiviamo GiftBox
  const snap = gbReadCartSnapshot(true);
  if (!snap.items.length) {
    gbClearDraft();
    gbModalItems = [];
    gbSyncBtnState();
    return;
  }

  gbModalItems = snap.items;
  gbWriteDraftItems(gbModalItems);

  // Se il modal è aperto, aggiorna il riepilogo live
  const modalEl = document.getElementById('posModalGiftbox');
  if (modalEl && modalEl.classList.contains('show')) {
    gbRenderModal();
  }
}

// Hook globale: quando cambia il carrello, se GiftBox è attiva aggiorna automaticamente contenuto
const __prevPosOnCartChange = window.posOnCartChange;
window.posOnCartChange = function(){
  try { if (typeof __prevPosOnCartChange === 'function') __prevPosOnCartChange(); } catch (e) {}
  try { gbOnCartChanged(); } catch (e) {}
  try { if (typeof posSyncSpecialBottomButtons === 'function') posSyncSpecialBottomButtons(); } catch (e) {}
};

// Se cambia cliente e GiftBox è attiva, resettiamo (evita emissioni sul cliente sbagliato)
if (clientSel) clientSel.addEventListener('change', ()=>{
  if (!gbHasDraft()) return;
  const cur = selectedClientId();
  const stored = gbDraftClientEl ? String(gbDraftClientEl.value || '') : '';

  if (!cur || !stored || stored === '0' || stored !== cur) {
    gbClearDraft();
    gbModalItems = [];
    gbSyncBtnState();
  }
});

if (btnGiftbox) btnGiftbox.addEventListener('click', () => {
  const enabled = !!POS_CONFIG.giftboxEnabled;
  if (!enabled) return alert('GiftBox non disponibile (modulo o DB non aggiornato).');

  if (typeof window.posCartHasGiftcard === 'function' && window.posCartHasGiftcard()) {
    return alert('GiftBox e GiftCard non possono essere abbinate nella stessa vendita. Rimuovi la GiftCard dal carrello.');
  }

  if (typeof window.posCartHasRecharge === 'function' && window.posCartHasRecharge()) {
    return alert('GiftBox e Ricariche non possono essere abbinate nella stessa vendita. Rimuovi la ricarica dal carrello per continuare.');
  }

  if (!selectedClientId()) {
    return alert('Seleziona un mittente prima di emettere una GiftBox.');
  }

  try {
    const snap = (typeof gbReadCartSnapshot === 'function') ? gbReadCartSnapshot(true) : {items:[]};
    if (!snap.items || !snap.items.length) {
      return alert('Aggiungi prima almeno un contenuto nella lista, poi potrai emettere una GiftBox.');
    }
  } catch (e) {
    const hasRows = !!document.querySelector('#itemsTable tbody tr[data-item-row]');
    if (!hasRows) {
      return alert('Aggiungi prima almeno un contenuto nella lista, poi potrai emettere una GiftBox.');
    }
  }

  try {
    const giftboxEligibilityMsg = (typeof window.posGetGiftboxEligibilityMessage === 'function') ? String(window.posGetGiftboxEligibilityMessage() || '') : '';
    if (giftboxEligibilityMsg) return alert(giftboxEligibilityMsg);
  } catch (e) {}

	  // Apertura modal:
	  // - NON creare automaticamente la GiftBox al click su "GiftBox".
	  // - La bozza (draft) viene creata SOLO quando si preme "Salva".
	  // - In preview, mostra il contenuto del carrello includendo anche i pacchetti non ancora marcati.
	  try {
	    if (gbHasDraft()) {
	      // GiftBox già salvata: allinea contenuto dal carrello
	      gbEnsureDraft();
	    } else {
	      const snap = gbReadCartSnapshot(true);
	      gbModalItems = snap.items;
	    }
	  } catch (e) {
	    try {
	      const snap = gbReadCartSnapshot(true);
	      gbModalItems = snap.items;
	    } catch (e2) {
	      gbModalItems = [];
	    }
	  }

  // Mostra modal (solo riepilogo + metadati)
  const modalEl = document.getElementById('posModalGiftbox');
  if (!modalEl) return;

  gbRenderModal();

  try {
    const m = bootstrap.Modal.getOrCreateInstance(modalEl);
    m.show();
  } catch (e) {
    modalEl.classList.add('show');
    modalEl.style.display = 'block';
  }
});



// Blocco sicurezza: non permettere di concludere con GiftBox attiva ma senza contenuto
const posFormEl = document.getElementById('posForm');
if (posFormEl) posFormEl.addEventListener('submit', (ev) => {
  try {
    const concludeBlockReason = (typeof window.posGetConcludeBlockReason === 'function') ? String(window.posGetConcludeBlockReason() || '') : '';
    if (concludeBlockReason) {
      ev.preventDefault();
      alert(concludeBlockReason);
      return;
    }

    if (typeof gbHasDraft === 'function' && gbHasDraft()) {
	      // Sicurezza: con GiftBox attiva, eventuali pacchetti in carrello devono risultare abbinati alla GiftBox.
	      try { if (window.posPkSetAllInGiftbox) window.posPkSetAllInGiftbox(true); } catch (e) {}
	      const snap = (typeof gbReadCartSnapshot === 'function') ? gbReadCartSnapshot(true) : {items:[]};
      const currentClientId = parseInt(String((typeof selectedClientId === 'function') ? (selectedClientId() || '0') : '0'), 10) || 0;
      const storedClientId = gbDraftClientEl ? (parseInt(String(gbDraftClientEl.value || '0'), 10) || 0) : 0;
      if (currentClientId <= 0 || storedClientId <= 0) {
        ev.preventDefault();
        alert('Seleziona un mittente per emettere una GiftBox.');
        return;
      }
      if (storedClientId !== currentClientId) {
        ev.preventDefault();
        alert('La GiftBox è collegata a un mittente diverso. Seleziona il mittente corretto oppure elimina la GiftBox.');
        return;
      }
      if (!snap.items || !snap.items.length) {
        ev.preventDefault();
        alert('GiftBox attiva ma senza contenuto. Aggiungi almeno un servizio/prodotto oppure un pacchetto in GiftBox, oppure elimina la GiftBox.');
        return;
      }

      const giftboxEligibilityMsg = (typeof window.posGetGiftboxEligibilityMessage === 'function') ? String(window.posGetGiftboxEligibilityMessage() || '') : '';
      if (giftboxEligibilityMsg) {
        ev.preventDefault();
        alert(giftboxEligibilityMsg);
        return;
      }

      // Campi obbligatori
      const evType = gbDraftEventTypeEl ? String(gbDraftEventTypeEl.value || '').trim() : '';
      if (!evType) {
        ev.preventDefault();
        alert('GiftBox: seleziona un evento.');
        return;
      }

      const recName = gbDraftRecNameEl ? String(gbDraftRecNameEl.value || '').trim() : '';
      if (!recName) {
        ev.preventDefault();
        alert('GiftBox: inserisci il destinatario.');
        return;
      }

      const recEmail = gbDraftRecEmailEl ? String(gbDraftRecEmailEl.value || '').trim() : '';
      if (recEmail && !gcIsEmail(recEmail)) {
        ev.preventDefault();
        alert('GiftBox: email destinatario non valida.');
        return;
      }

      // Invio email
      const sendMode = gbDraftSendModeEl ? String(gbDraftSendModeEl.value || 'none').toLowerCase() : 'none';
      if (sendMode !== 'none' && !gcIsEmail(recEmail)) {
        ev.preventDefault();
        alert('GiftBox: inserisci una email destinatario valida per inviare la GiftBox.');
        return;
      }
      if (sendMode === 'date') {
        const sendOn = gbDraftSendOnEl ? String(gbDraftSendOnEl.value || '').trim() : '';
        if (!sendOn || !/^\d{4}-\d{2}-\d{2}$/.test(sendOn)) {
          ev.preventDefault();
          alert('GiftBox: data invio non valida.');
          return;
        }
        if (sendOn < gbIso(gbTodayDate())) {
          ev.preventDefault();
          alert('GiftBox: la data invio programmato non puo essere nel passato.');
          return;
        }
      }

      const validFrom = gbDraftFromEl ? String(gbDraftFromEl.value || '').trim() : '';
      const validTo = gbDraftToEl ? String(gbDraftToEl.value || '').trim() : '';
      const dFrom = gbParseYmdToDate(validFrom);
      if (!dFrom) {
        ev.preventDefault();
        alert('GiftBox: data "Valida dal" non valida.');
        return;
      }
      if (validTo) {
        const dTo = gbParseYmdToDate(validTo);
        if (!dTo) {
          ev.preventDefault();
          alert('GiftBox: data "Valida al" non valida.');
          return;
        }
        if (dTo.getTime() <= dFrom.getTime()) {
          ev.preventDefault();
          alert('GiftBox: la data "Valida al" deve essere almeno il giorno successivo a "Valida dal".');
          return;
        }
      }
    }
  } catch (e) {
    // ignore
  }
});
// Salva GiftBox (chiudi modal)
const gbSaveBtn = document.getElementById('posGiftboxSaveBtn');
if (gbSaveBtn) gbSaveBtn.addEventListener('click', () => {
  // Validazioni minime (richieste)
  const eventEl = document.getElementById('posGiftboxEventType');
  const fromEl = document.getElementById('posGiftboxValidFrom');
  const toEl = document.getElementById('posGiftboxValidTo');
  const recNameEl = document.getElementById('posGiftboxRecipientName');
  const recEmailEl = document.getElementById('posGiftboxRecipientEmail');
  const doNotSendEl = document.getElementById('posGbDoNotSend');
  const sendDateEl = document.getElementById('posGbSendDate');
  const sendOnEl = document.getElementById('posGbSendOn');

  const senderClientId = (typeof selectedClientId === 'function') ? String(selectedClientId() || '').trim() : '';
  if (!senderClientId) {
    alert('Seleziona un mittente prima di emettere una GiftBox.');
    return;
  }

  const evType = String(eventEl ? (eventEl.value || '') : '').trim();
  if (!evType) {
    alert('GiftBox: seleziona un evento.');
    try { eventEl && eventEl.focus(); } catch (e) {}
    return;
  }

  const vf = String(fromEl ? (fromEl.value || '') : '').trim();
  if (!vf) {
    alert('GiftBox: inserisci la data "Valida dal".');
    try { fromEl && fromEl.focus(); } catch (e) {}
    return;
  }

  const vfDate = gbParseYmdToDate(vf);
  if (!vfDate) {
    alert('GiftBox: data "Valida dal" non valida.');
    try { fromEl && fromEl.focus(); } catch (e) {}
    return;
  }
  if (!(fromEl && fromEl.disabled) && vfDate.getTime() < gbTodayDate().getTime()) {
    alert('GiftBox: la data "Valida dal" non puo essere nel passato.');
    try { fromEl && fromEl.focus(); } catch (e) {}
    return;
  }

  const vt = String(toEl ? (toEl.value || '') : '').trim();
  if (vt) {
    const vtDate = gbParseYmdToDate(vt);
    if (!vtDate) {
      alert('GiftBox: data "Valida al" non valida.');
      try { toEl && toEl.focus(); } catch (e) {}
      return;
    }
    if (vtDate.getTime() <= vfDate.getTime()) {
      alert('GiftBox: la data "Valida al" deve essere almeno il giorno successivo a "Valida dal".');
      try { toEl && toEl.focus(); } catch (e) {}
      return;
    }
  }

  const recName = String(recNameEl ? (recNameEl.value || '') : '').trim();
  if (!recName) {
    alert('GiftBox: inserisci il destinatario.');
    try { recNameEl && recNameEl.focus(); } catch (e) {}
    return;
  }

  // Destinatario: cliente già esistente -> selezione obbligatoria
  const existingToggleEl = document.getElementById('posGbRecipientExistingToggle');
  if (existingToggleEl && existingToggleEl.checked) {
    const rid = parseInt(String(gbRecipientClientIdUiEl ? (gbRecipientClientIdUiEl.value || '') : ''), 10) || 0;
    if (rid <= 0) {
      alert('GiftBox: seleziona il cliente destinatario.');
      try { gbRecipientClientSearchEl && gbRecipientClientSearchEl.focus(); } catch (e) {}
      return;
    }
  }

  const email = String(recEmailEl ? (recEmailEl.value || '') : '').trim();
  if (email && !gcIsEmail(email)) {
    alert('GiftBox: email destinatario non valida.');
    try { recEmailEl && recEmailEl.focus(); } catch (e) {}
    return;
  }

  // Se NON è selezionato "Non inviare", allora l'email deve essere valida
  const noSend = !!(doNotSendEl && doNotSendEl.checked);
  if (!noSend) {
    if (!gcIsEmail(email)) {
      alert('GiftBox: inserisci una email destinatario valida per inviare la GiftBox.');
      try { recEmailEl && recEmailEl.focus(); } catch (e) {}
      return;
    }
    // Invio programmato: data obbligatoria
    if (sendDateEl && sendDateEl.checked) {
      const sendOn = String(sendOnEl ? (sendOnEl.value || '') : '').trim();
      if (!sendOn || !/^\d{4}-\d{2}-\d{2}$/.test(sendOn)) {
        alert('GiftBox: data invio non valida.');
        try { sendOnEl && sendOnEl.focus(); } catch (e) {}
        return;
      }
      if (sendOn < gbIso(gbTodayDate())) {
        alert('GiftBox: la data invio programmato non puo essere nel passato.');
        try { sendOnEl && sendOnEl.focus(); } catch (e) {}
        return;
      }
    }
  }

  // Crea/aggiorna la bozza GiftBox SOLO al click su "Salva"
  // (il click su "GiftBox" apre solo il modal in preview).
  try {
    if (!gbHasDraft()) {
      // Preserva le scelte UI invio email prima della creazione draft
      // (gbEnsureDraft imposta dei default che non devono sovrascrivere la scelta dell'operatore).
      const _noSendChoice = !!(doNotSendEl && doNotSendEl.checked);
      const _modeChoice = (sendDateEl && sendDateEl.checked) ? 'date' : 'now';
      const _detailsEl = document.getElementById('posGbShowDetails');
      const _detailsChoice = !!(_detailsEl && _detailsEl.checked);

      if (!gbEnsureDraft()) return;

      gbNoSendUserChoice = _noSendChoice;
      gbModeUserChoice = _modeChoice;
      gbShowDetailsUserChoice = _detailsChoice;
    } else {
      // riallinea contenuto dal carrello (sicurezza)
      gbEnsureDraft();
    }
  } catch (e) {}

  // Salva metadati nel draft (campi nascosti) e chiude
  try {
    if (typeof window.posGbSaveMeta === 'function') window.posGbSaveMeta();
  } catch (e) {}

  const modalEl = document.getElementById('posModalGiftbox');
  if (modalEl) {
    try {
      bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    } catch (e) {
      modalEl.classList.remove('show');
      modalEl.style.display = 'none';
    }
  }
});

// Elimina GiftBox (reset)
if (gbDeleteLink) gbDeleteLink.addEventListener('click', (ev) => {
  ev.preventDefault();
  if (!gbHasDraft()) return;

  if (!confirm('Eliminare la GiftBox?')) return;

  gbClearDraft();
  gbModalItems = [];
  gbSyncBtnState();

  const modalEl = document.getElementById('posModalGiftbox');
  if (modalEl) {
    try {
      bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    } catch (e) {
      modalEl.classList.remove('show');
      modalEl.style.display = 'none';
    }
  }
});


})();
