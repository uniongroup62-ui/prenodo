(function () {
  'use strict';

  var configEl = document.getElementById('quotesPageConfig');
  var quotesConfig = {};

  if (configEl) {
    try {
      quotesConfig = JSON.parse(configEl.textContent || '{}') || {};
    } catch (e) {
      quotesConfig = {};
    }
  }

  document.addEventListener('click', function (event) {
    if (!(event.target instanceof Element)) return;

    var printButton = event.target.closest('[data-quote-print]');
    if (printButton) {
      event.preventDefault();
      window.print();
      return;
    }

    var confirmTarget = event.target.closest('[data-confirm]');
    if (confirmTarget) {
      var message = confirmTarget.getAttribute('data-confirm') || 'Confermare?';
      if (!window.confirm(message)) event.preventDefault();
      return;
    }

    var selectTarget = event.target.closest('[data-select-on-click]');
    if (selectTarget && typeof selectTarget.select === 'function') {
      selectTarget.select();
    }
  });

  if (quotesConfig.mode === 'list') {
    (function(){
      // Combobox helper (minimal) - same behaviour as other pages
      function norm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim(); }
    
      function initCombobox(boxEl, items, selectedId, allValue, allLabel){
        if(!boxEl) return;
        const toggle = boxEl.querySelector('.app-combobox-toggle');
        const hidden = boxEl.querySelector('input[type=hidden]');
        const search = boxEl.querySelector('.app-combobox-search');
        const list = boxEl.querySelector('.app-combobox-list');
        const textEl = boxEl.querySelector('.app-combobox-text');
        const placeholderEl = boxEl.querySelector('.app-combobox-placeholder');
        if(!toggle || !hidden || !search || !list || !textEl || !placeholderEl) return;
    
        const allItem = { id: String(allValue), label: String(allLabel), search: norm(allLabel) };
        const data = [allItem].concat(items);
    
        function render(){
          const q = norm(search.value);
          list.innerHTML = '';
          let shown = 0;
          data.forEach(it => {
            if(!q || String(it.search||'').indexOf(q) !== -1){
              const a = document.createElement('button');
              a.type = 'button';
              a.className = 'dropdown-item d-flex justify-content-between align-items-center';
              a.textContent = it.label;
              a.addEventListener('click', function(){
                hidden.value = it.id;
                updateLabel();
                search.value = '';
                render();
              });
              list.appendChild(a);
              shown++;
            }
          });
          if(shown === 0){
            const d = document.createElement('div');
            d.className = 'text-muted small px-2 py-1';
            d.textContent = 'Nessun risultato';
            list.appendChild(d);
          }
        }
    
        function updateLabel(){
          const id = String(hidden.value || '');
          const it = data.find(x => String(x.id) === id);
          const label = it ? it.label : '';
          if(id && id !== String(allValue) && label){
            textEl.textContent = label;
            textEl.classList.remove('d-none');
            placeholderEl.classList.add('d-none');
          } else {
            textEl.textContent = '';
            textEl.classList.add('d-none');
            placeholderEl.classList.remove('d-none');
          }
        }
    
        // initial
        hidden.value = String(selectedId || allValue || '');
        updateLabel();
        render();
    
        search.addEventListener('input', render);
        toggle.addEventListener('shown.bs.dropdown', function(){
          setTimeout(() => { search.focus(); search.select(); }, 0);
        });
      }
    
      const clientItems = (Array.isArray(quotesConfig.clientItems) ? quotesConfig.clientItems : []).map(function(it){
          it.search = norm(it.label);
          return it;
        });
    
      initCombobox(
        document.getElementById('clientFilterBox'),
        clientItems,
        String(quotesConfig.selectedClientId || '0'),
        '0',
        'Tutti'
      );
    })();
  }

  if (quotesConfig.mode === 'form') {
    (function(){
      const IS_EDIT = !!quotesConfig.isEdit;
      // --- Data ---
      const clients = Array.isArray(quotesConfig.clients) ? quotesConfig.clients : [];
      const products = Array.isArray(quotesConfig.products) ? quotesConfig.products : [];
      const services = Array.isArray(quotesConfig.services) ? quotesConfig.services : [];
      const packages = Array.isArray(quotesConfig.packages) ? quotesConfig.packages : [];
    
      // --- Numero preventivo automatico SOLO in creazione ---
      // Requisito: per i NUOVI preventivi il numero deve essere progressivo per anno (es. 1/2026) e
      // deve aggiornarsi automaticamente se cambia l'anno della data.
      // Se l'utente modifica manualmente il numero, non lo sovrascriviamo più.
      (function initAutoNumberForNew(){
        if (IS_EDIT) return;
        const dateEl = document.getElementById('quoteDate');
        const numEl  = document.getElementById('quoteNumber');
        if (!dateEl || !numEl) return;
    
        let manual = false;
        numEl.addEventListener('input', function(){ manual = true; });
    
        async function refresh(){
          if (manual) return;
          const d = String(dateEl.value || '').trim();
          if (!d) return;
          try {
            const url = 'index.php?page=quotes&action=next_number&quote_date=' + encodeURIComponent(d);
            const res = await fetch(url, { credentials: 'same-origin' });
            if (!res.ok) return;
            const j = await res.json();
            if (j && j.ok && j.number) {
              numEl.value = String(j.number);
            }
          } catch (e) {}
        }
    
        // Aggiorna quando cambia la data (basta che cambi l'anno)
        dateEl.addEventListener('change', refresh);
    
        // Se il numero è vuoto (casi edge), valorizza al load
        if (String(numEl.value || '').trim() === '' && String(dateEl.value || '').trim() !== '') {
          refresh();
        }
      })();
    
      function norm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim(); }
      function money(n){
        n = Number(n||0);
        // Italian format
        return n.toLocaleString('it-IT', {minimumFractionDigits:2, maximumFractionDigits:2});
      }
    
      const locationEl = document.getElementById('quoteLocationId');
      function currentFormLocationId(){
        return String((locationEl && locationEl.value) ? locationEl.value : (quotesConfig.initialLocationId || ''));
      }
      function rowAllowedForLocation(row, locId){
        if(!row) return true;
        const restricted = row.location_restricted === true || row.location_restricted === 1 || String(row.location_restricted || '') === '1';
        if(!restricted) return true;
        const ids = Array.isArray(row.location_ids) ? row.location_ids.map(x => String(x)) : [];
        return ids.indexOf(String(locId || '')) !== -1;
      }
      function rowForQuoteItem(it){
        const t = String(it && it.item_type || '');
        const id = String(it && it.item_id || '');
        if(!id || id === '0') return null;
        if(t === 'service') return services.find(x => String(x.id) === id) || null;
        if(t === 'product') return products.find(x => String(x.id) === id) || null;
        if(t === 'package') return packages.find(x => String(x.id) === id) || null;
        return null;
      }
      function quoteItemAllowedForLocation(it){
        const t = String(it && it.item_type || 'custom');
        if(t === 'custom') return true;
        return rowAllowedForLocation(rowForQuoteItem(it), currentFormLocationId());
      }
    
      // --- Combobox helper ---
      function initCombobox(boxEl, items, hiddenEl, placeholder, onSelect){
        if(!boxEl) return;
        const toggle = boxEl.querySelector('.app-combobox-toggle');
        const hidden = hiddenEl || boxEl.querySelector('input[type=hidden]');
        const search = boxEl.querySelector('.app-combobox-search');
        const list = boxEl.querySelector('.app-combobox-list');
        const textEl = boxEl.querySelector('.app-combobox-text');
        const placeholderEl = boxEl.querySelector('.app-combobox-placeholder');
        if(!toggle || !hidden || !search || !list || !textEl || !placeholderEl) return;
    
        function render(){
          const q = norm(search.value);
          list.innerHTML = '';
          let shown = 0;
          items.forEach(it => {
            if(!q || String(it.search||'').indexOf(q) !== -1){
              const a = document.createElement('button');
              a.type = 'button';
              a.className = 'dropdown-item d-flex justify-content-between align-items-center';
              a.innerHTML = it.html || it.label;
              a.addEventListener('click', function(){
                hidden.value = it.id;
                try { hidden.dispatchEvent(new Event('change', { bubbles: true })); } catch(e) {}
                updateLabel();
                search.value = '';
                render();
                if (typeof onSelect === 'function') onSelect(it);
              });
              list.appendChild(a);
              shown++;
            }
          });
          if(shown === 0){
            const d = document.createElement('div');
            d.className = 'text-muted small px-2 py-1';
            d.textContent = 'Nessun risultato';
            list.appendChild(d);
          }
        }
    
        function updateLabel(){
          const id = String(hidden.value || '');
          const it = items.find(x => String(x.id) === id);
          const label = it ? (it.labelPlain || it.label) : '';
          if(id && id !== '0' && label){
            textEl.textContent = label;
            textEl.classList.remove('d-none');
            placeholderEl.classList.add('d-none');
          } else {
            textEl.textContent = '';
            textEl.classList.add('d-none');
            placeholderEl.classList.remove('d-none');
            if(placeholder) placeholderEl.textContent = placeholder;
          }
        }
    
        // initial
        updateLabel();
        render();
    
        search.addEventListener('input', render);
        toggle.addEventListener('shown.bs.dropdown', function(){
          setTimeout(() => { search.focus(); search.select(); }, 0);
        });
    
        return { updateLabel, render };
      }
    
      // Client combobox
      const clientItems = [{id:'0', label:'— Seleziona —', labelPlain:'— Seleziona —', search:norm('— Seleziona —')}].concat(
        clients.map(c => {
          const label = String(c.full_name || ('#'+c.id));
          return { id:String(c.id), label:label, labelPlain:label, search:norm(label) };
        })
      );
    
      const clientIdEl = document.getElementById('clientId');
      const clientNameEl = document.getElementById('clientName');
      const clientLastNameEl = document.getElementById('clientLastName');
      const clientEmailEl = document.getElementById('clientEmail');
      const clientPhoneEl = document.getElementById('clientPhone');
      const clientAddressEl = document.getElementById('clientAddress');
      const clientRegionEl = document.getElementById('clientRegion');
      const clientCapEl = document.getElementById('clientCap');
      const clientCityEl = document.getElementById('clientCity');
      const clientProvinceEl = document.getElementById('clientProvince');
    
      // Info fiscali
      const clientTaxCodeEl = document.getElementById('clientTaxCode');
      const clientVatNumberEl = document.getElementById('clientVatNumber');
      const clientSdiEl = document.getElementById('clientSdi');
      const clientCompanyNameEl = document.getElementById('clientCompanyName');
      const clientPecEl = document.getElementById('clientPec');
    
      initCombobox(document.getElementById('clientBox'), clientItems, clientIdEl, '— Seleziona —', function(it){
        if(it && String(it.id||'0') !== '0') applyClient(it.id);
      });
    
      // When selecting client, prefill
      function applyClient(id){
        const c = clients.find(x => String(x.id) === String(id));
        if(!c) return;
        // Nome / Cognome (usa first_name/last_name se presenti, altrimenti split di full_name)
        let first = String(c.first_name || '').trim();
        let last = String(c.last_name || '').trim();
        if (!first && !last) {
          const full = String(c.full_name || '').trim();
          if (full.indexOf(',') !== -1) {
            const parts = full.split(',');
            last = String(parts[0] || '').trim();
            first = String(parts.slice(1).join(',') || '').trim();
          } else {
            const parts = full.split(/\s+/).filter(Boolean);
            if (parts.length > 1) {
              last = parts.pop();
              first = parts.join(' ');
            } else {
              first = full;
            }
          }
        }
        clientNameEl.value = first || (c.full_name || '');
        if (clientLastNameEl) clientLastNameEl.value = last || '';
    
        clientEmailEl.value = c.email || '';
        clientPhoneEl.value = c.phone || '';
        clientAddressEl.value = c.address || '';
        if (clientRegionEl) clientRegionEl.value = c.region || '';
        clientCapEl.value = c.cap || '';
        clientCityEl.value = c.city || '';
        clientProvinceEl.value = c.province || '';
    
        if (clientCompanyNameEl) clientCompanyNameEl.value = c.company_name || '';
        if (clientVatNumberEl) clientVatNumberEl.value = c.vat_number || '';
        if (clientTaxCodeEl) clientTaxCodeEl.value = c.tax_code || '';
        if (clientSdiEl) clientSdiEl.value = c.sdi || '';
        if (clientPecEl) clientPecEl.value = c.pec || '';
    
        // Trigger Italy-geo cascade (Regione -> Provincia -> Città)
        if (clientRegionEl) {
          try { clientRegionEl.dispatchEvent(new Event('change', { bubbles: true })); } catch(e) {}
        }
      }
    
      // Hook selection: observe changes on hidden input
      clientIdEl.addEventListener('change', function(){
        const id = clientIdEl.value;
        if(id && id !== '0') applyClient(id);
      });
    
      // Service combobox
      const serviceItems = [{id:'0', label:'Seleziona…', labelPlain:'Seleziona…', search:norm('Seleziona…')}].concat(
        services.filter(s => rowAllowedForLocation(s, currentFormLocationId())).map(s => {
          const label = String(s.name || ('#'+s.id));
          return { id:String(s.id), label:label, labelPlain:label, search:norm(label) };
        })
      );
      const serviceIdEl = document.getElementById('serviceId');
      initCombobox(document.getElementById('serviceBox'), serviceItems, serviceIdEl, 'Seleziona…', function(it){
        if(!it || String(it.id||'0') === '0') return;
        const s = services.find(x => String(x.id) === String(it.id));
        if(!s) return;
        const pe = document.getElementById('itemPrice');
        if(pe) pe.value = String(Number(s.price||0));
      });
    
      // Product combobox (nome + SKU)
      const productItems = [{id:'0', label:'Seleziona…', labelPlain:'Seleziona…', search:norm('Seleziona…')}].concat(
        products.filter(p => rowAllowedForLocation(p, currentFormLocationId())).map(p => {
          const name = String(p.name || ('#'+p.id));
          const sku = String(p.sku || '');
          const labelPlain = sku ? (name + ' (' + sku + ')') : name;
          const html = sku ? (name + ' <span class="text-muted">(' + sku + ')</span>') : name;
          return { id:String(p.id), label:labelPlain, labelPlain:labelPlain, html:html, search:norm(name + ' ' + sku) };
        })
      );
      const productIdEl = document.getElementById('productId');
      initCombobox(document.getElementById('productBox'), productItems, productIdEl, 'Seleziona…', function(it){
        if(!it || String(it.id||'0') === '0') return;
        const p = products.find(x => String(x.id) === String(it.id));
        if(!p) return;
        const pe = document.getElementById('itemPrice');
        if(pe) pe.value = String(Number(p.price||0));
      });
    
    
      // Package combobox (nome + sedute)
      const packageItems = [{id:'0', label:'Seleziona…', labelPlain:'Seleziona…', search:norm('Seleziona…')}].concat(
        packages.filter(p => rowAllowedForLocation(p, currentFormLocationId())).map(p => {
          const name = String(p.name || ('#'+p.id));
          const sessions = Number(p.sessions_total || 1);
          const price = Number(p.price || 0);
          const ia = (p.is_active === undefined || p.is_active === null) ? '1' : p.is_active;
          const isActive = (String(ia) === '1' || ia === 1 || ia === true);
    
          const metaParts = [];
          if (sessions) metaParts.push(String(Math.round(sessions)) + ' sedute');
          metaParts.push('€ ' + money(price));
          if (!isActive) metaParts.push('disattivo');
    
          const metaPlain = metaParts.join(' • ');
          const labelPlain = metaPlain ? (name + ' — ' + metaPlain) : name;
          const html = metaPlain ? (name + ' <span class="text-muted">— ' + metaPlain + '</span>') : name;
    
          return { id:String(p.id), label:labelPlain, labelPlain:labelPlain, html:html, search:norm(name + ' ' + metaParts.join(' ')) };
        })
      );
      const packageIdEl = document.getElementById('packageId');
      initCombobox(document.getElementById('packageBox'), packageItems, packageIdEl, 'Seleziona…', function(it){
        if(!it || String(it.id||'0') === '0') return;
        const p = packages.find(x => String(x.id) === String(it.id));
        if(!p) return;
        const pe = document.getElementById('itemPrice');
        if(pe) pe.value = String(Number(p.price||0));
        const qe = document.getElementById('itemQty');
        if(qe) qe.value = '1';
      });
    
      // --- Items management ---
      const itemsJsonEl = document.getElementById('itemsJson');
      let items = [];
      try { items = JSON.parse(itemsJsonEl.value || '[]'); if(!Array.isArray(items)) items = []; } catch(e){ items = []; }
    
      if (locationEl && String(locationEl.tagName || '').toUpperCase() === 'SELECT') {
        locationEl.addEventListener('change', function(){
          const initial = String(locationEl.getAttribute('data-initial-location') || '');
          const selected = String(locationEl.value || '');
          if(selected === initial) return;
          const message = items.length
            ? 'Cambiando sede la pagina verra ricaricata. Eventuali modifiche non salvate andranno perse. Continuare?'
            : 'Cambiando sede la pagina verra ricaricata per aggiornare prodotti, servizi e pacchetti. Continuare?';
          if(!window.confirm(message)){
            locationEl.value = initial;
            return;
          }
          let url = 'index.php?page=quotes&action=' + (IS_EDIT ? ('edit&id=' + encodeURIComponent(String(quotesConfig.quoteId || '0'))) : 'new');
          url += '&location_id=' + encodeURIComponent(selected);
          window.location.href = url;
        });
      }
    
      const itemTypeEl = document.getElementById('itemType');
      const pickServiceWrap = document.getElementById('pickServiceWrap');
      const pickProductWrap = document.getElementById('pickProductWrap');
      const pickPackageWrap = document.getElementById('pickPackageWrap');
      const customDescWrap = document.getElementById('customDescWrap');
    
      const customDescEl = document.getElementById('customDesc');
      const qtyEl = document.getElementById('itemQty');
      const priceEl = document.getElementById('itemPrice');
      const taxEl = document.getElementById('itemTax');
      const discEl = document.getElementById('itemDisc');
    
      function syncTypeUI(){
        const t = itemTypeEl.value;
        pickServiceWrap.classList.toggle('d-none', t !== 'service');
        pickProductWrap.classList.toggle('d-none', t !== 'product');
        pickPackageWrap.classList.toggle('d-none', t !== 'package');
        customDescWrap.classList.toggle('d-none', t !== 'custom');
    
        const lockedPrice = (t === 'service' || t === 'product' || t === 'package');
        if (priceEl) {
          priceEl.readOnly = lockedPrice;
          priceEl.classList.toggle('bg-light', lockedPrice);
          priceEl.title = lockedPrice ? 'Prezzo bloccato: viene preso dal catalogo.' : '';
        }
      }
      itemTypeEl.addEventListener('change', syncTypeUI);
      syncTypeUI();
    
      function computeLine(it){
        const qty = Number(it.qty||1);
        const unit = Number(it.unit_price||0);
        const disc = Math.min(100, Math.max(0, Number(it.discount_percent||0)));
        const tax = Math.min(100, Math.max(0, Number(it.tax_rate||0)));
        const gross = qty * unit;
        const sub = gross * (1 - disc/100);
        const taxAmt = sub * (tax/100);
        const tot = sub + taxAmt;
        return {
          line_subtotal: Math.round(sub*100)/100,
          line_tax: Math.round(taxAmt*100)/100,
          line_total: Math.round(tot*100)/100,
          discount_amount: Math.round((gross - sub)*100)/100,
        };
      }
    
      function renderItems(){
        const tbody = document.querySelector('#itemsTable tbody');
        tbody.innerHTML = '';
        if(items.length === 0){
          const tr = document.createElement('tr');
          tr.innerHTML = '<td colspan="7" class="text-muted p-3">Nessuna riga.</td>';
          tbody.appendChild(tr);
        } else {
          items.forEach((it, idx) => {
            const calc = computeLine(it);
            const tr = document.createElement('tr');
            const shownDesc = (String(it.item_type || '') === 'product' && it.sku && String(it.description || '').indexOf('(' + String(it.sku) + ')') === -1) ? (String(it.description || '') + ' (' + String(it.sku) + ')') : String(it.description || '');
            tr.innerHTML = `
              <td>
                <div class="fw-semibold">${escapeHtml(shownDesc)}</div>
                ${it.sku ? `<div class="small text-muted">SKU: ${escapeHtml(it.sku)}</div>` : ``}
                ${Number(it.discount_percent||0) > 0 ? `<div class="small text-muted">Sconto: ${escapeHtml(String(it.discount_percent))}%</div>` : ``}
              </td>
              <td class="text-end">${escapeHtml(String(it.qty||1))}</td>
              <td class="text-end">€ ${money(it.unit_price||0)}</td>
              <td class="text-end">${escapeHtml(String(it.tax_rate||0))}%</td>
              <td class="text-end">${escapeHtml(String(it.discount_percent||0))}%</td>
              <td class="text-end fw-semibold">€ ${money(calc.line_total)}</td>
              <td class="text-end">
                <button type="button" class="btn btn-sm btn-outline-danger" data-rm="${idx}"><i class="bi bi-x-lg"></i></button>
              </td>
            `;
            tbody.appendChild(tr);
          });
        }
    
        // Remove handlers
        tbody.querySelectorAll('button[data-rm]').forEach(btn => {
          btn.addEventListener('click', function(){
            const i = parseInt(btn.getAttribute('data-rm'), 10);
            if(!isNaN(i)){
              items.splice(i, 1);
              persist();
              renderItems();
            }
          });
        });
    
        renderTotals();
      }
    
      function renderTotals(){
        let sub = 0, disc = 0, tax = 0, total = 0;
        items.forEach(it => {
          const calc = computeLine(it);
          sub += calc.line_subtotal;
          disc += calc.discount_amount;
          tax += calc.line_tax;
          total += calc.line_total;
        });
        document.getElementById('tSubtotal').textContent = '€ ' + money(sub);
        document.getElementById('tDiscount').textContent = '€ ' + money(disc);
        document.getElementById('tTax').textContent = '€ ' + money(tax);
        document.getElementById('tTotal').textContent = '€ ' + money(total);
      }
    
      function persist(){
        itemsJsonEl.value = JSON.stringify(items);
      }
    
      function escapeHtml(s){
        return String(s||'').replace(/[&<>"']/g, function(c){
          return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]);
        });
      }
    
      document.getElementById('addItemBtn').addEventListener('click', function(){
        const t = itemTypeEl.value;
        let desc = '';
        let itemId = null;
        let sku = null;
        let lockedUnit = null;
    
        if(t === 'service'){
          const sid = String(serviceIdEl.value || '0');
          if(sid === '0'){ alert('Seleziona un servizio.'); return; }
          const s = services.find(x => String(x.id) === sid);
          if(!s){ alert('Servizio non trovato.'); return; }
          desc = s.name || 'Servizio';
          itemId = Number(s.id);
          lockedUnit = Number(s.price || 0);
    
        } else if(t === 'product'){
          const pid = String(productIdEl.value || '0');
          if(pid === '0'){ alert('Seleziona un prodotto.'); return; }
          const p = products.find(x => String(x.id) === pid);
          if(!p){ alert('Prodotto non trovato.'); return; }
          sku = p.sku || null;
          desc = sku ? ((p.name || 'Prodotto') + ' (' + sku + ')') : (p.name || 'Prodotto');
          itemId = Number(p.id);
          lockedUnit = Number(p.price || 0);
    
        } else if(t === 'package'){
          const pkid = String(packageIdEl.value || '0');
          if(pkid === '0'){ alert('Seleziona un pacchetto.'); return; }
          const p = packages.find(x => String(x.id) === pkid);
          if(!p){ alert('Pacchetto non trovato.'); return; }
          const name = p.name || 'Pacchetto';
          const sessions = Number(p.sessions_total || 0);
          desc = sessions ? (name + ' (' + Math.round(sessions) + ' sedute)') : name;
          itemId = Number(p.id);
          lockedUnit = Number(p.price || 0);
    
        } else {
          desc = String(customDescEl.value || '').trim();
          if(!desc){ alert('Inserisci una descrizione.'); return; }
        }
    
        const qty = Number(qtyEl.value||1);
        const unit = (lockedUnit !== null) ? Number(lockedUnit || 0) : Number(priceEl.value||0);
        const taxRate = Number(taxEl.value||0);
        const discP = Number(discEl.value||0);
    
        items.push({
          item_type: t,
          item_id: itemId,
          description: desc,
          sku: sku,
          qty: qty,
          unit_price: unit,
          tax_rate: taxRate,
          discount_percent: discP
        });
    
        // reset add form
        if(t === 'custom') customDescEl.value = '';
        // keep price? reset to 0
        priceEl.value = '0';
        qtyEl.value = '1';
        taxEl.value = taxEl.value || '0';
        discEl.value = '0';
        serviceIdEl.value = '0';
        productIdEl.value = '0';
        packageIdEl.value = '0';
    
        persist();
        renderItems();
      });
    
      // Prefill if edit
      renderItems();
    
      // On submit: ensure items saved
      document.getElementById('quoteForm').addEventListener('submit', function(){
        persist();
      });
    })();
  }
})();
