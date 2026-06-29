function productsReadJsonConfig(id) {
  const el = document.getElementById(id);
  if (!el) return {};
  try {
    return JSON.parse(el.textContent || '{}') || {};
  } catch (e) {
    return {};
  }
}

const PRODUCTS_PAGE_CONFIG = productsReadJsonConfig('productsPageConfig');

  (function(){
    const modalEl = document.getElementById('productCategoryCreateModal');
    if (!modalEl) return;

    modalEl.addEventListener('shown.bs.modal', function(){
      const input = modalEl.querySelector('input[name="cat_name"]');
      if (!input) return;
      try {
        input.focus();
        input.select();
      } catch (e) {}
    });
  })();

  (function(){
    const pendingCategoryDeleteBlockPopup = PRODUCTS_PAGE_CONFIG.pendingCategoryDeleteBlockPopup || null;

    function safeParseCategory(raw) {
      if (!raw) return { count: 0, products: [] };
      if (typeof raw === 'object') return raw;
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : { count: 0, products: [] };
      } catch (e) {
        return { count: 0, products: [] };
      }
    }

    function showCategoryDeleteBlock(categoryName, data) {
      data = safeParseCategory(data);
      const count = Number(data.count || 0);
      const products = Array.isArray(data.products) ? data.products : [];
      const message = 'La categoria "' + (categoryName || 'Categoria') + '" non puo essere eliminata perche contiene ' + count + ' prodott' + (count === 1 ? 'o' : 'i') + '. Sposta prima i prodotti in un altra categoria o rimuovi la categoria dalla scheda prodotto.';
      const modalEl = document.getElementById('productCategoryDeleteBlockModal');
      const msgEl = document.getElementById('productCategoryDeleteBlockMessage');
      const listEl = document.getElementById('productCategoryDeleteBlockList');
      if (!modalEl || !msgEl || !listEl || typeof bootstrap === 'undefined' || !bootstrap.Modal) {
        alert(message + '\n\n' + products.map(function(p){ return '- ' + (p.label || ('Prodotto #' + (p.id || ''))); }).join('\n'));
        return;
      }
      msgEl.textContent = message;
      listEl.innerHTML = '';
      if (!products.length) {
        listEl.innerHTML = '<div class="text-muted small">Prodotti associati non disponibili nel riepilogo.</div>';
      } else {
        const accordion = document.createElement('div');
        accordion.className = 'accordion';
        accordion.id = 'productCategoryDeleteBlockAccordion';

        const item = document.createElement('div');
        item.className = 'accordion-item border rounded-3 overflow-hidden mb-2';
        const header = document.createElement('h3');
        header.className = 'accordion-header';
        header.id = 'productCategoryDeleteBlockHeading';
        const button = document.createElement('button');
        button.className = 'accordion-button collapsed bg-white shadow-none py-2';
        button.type = 'button';
        button.setAttribute('data-bs-toggle', 'collapse');
        button.setAttribute('data-bs-target', '#productCategoryDeleteBlockCollapse');
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-controls', 'productCategoryDeleteBlockCollapse');
        const label = document.createElement('span');
        label.className = 'd-flex align-items-center justify-content-between gap-2 w-100 pe-2';
        const title = document.createElement('span');
        title.className = 'fw-semibold';
        title.textContent = 'Prodotti associati';
        const badge = document.createElement('span');
        badge.className = 'badge rounded-pill text-bg-info';
        badge.textContent = String(count);
        label.appendChild(title);
        label.appendChild(badge);
        button.appendChild(label);
        header.appendChild(button);
        item.appendChild(header);

        const collapse = document.createElement('div');
        collapse.className = 'accordion-collapse collapse';
        collapse.id = 'productCategoryDeleteBlockCollapse';
        collapse.setAttribute('aria-labelledby', 'productCategoryDeleteBlockHeading');
        const body = document.createElement('div');
        body.className = 'accordion-body py-2';
        const listGroup = document.createElement('div');
        listGroup.className = 'list-group list-group-flush';
        products.forEach(function(p){
          const row = document.createElement('div');
          row.className = 'list-group-item px-0';
          row.textContent = p.label || ('Prodotto #' + (p.id || ''));
          listGroup.appendChild(row);
        });
        if (count > products.length) {
          const row = document.createElement('div');
          row.className = 'list-group-item px-0 text-muted';
          row.textContent = 'Altri ' + (count - products.length) + ' prodotti non mostrati.';
          listGroup.appendChild(row);
        }
        body.appendChild(listGroup);
        collapse.appendChild(body);
        item.appendChild(collapse);
        accordion.appendChild(item);
        listEl.appendChild(accordion);
      }
      bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }

    function productsConfirmCategoryDelete(el) {
      const data = safeParseCategory(el ? el.getAttribute('data-category-products') : '');
      const count = Number(data.count || 0);
      const categoryName = el ? (el.getAttribute('data-category-name') || 'Categoria') : 'Categoria';
      if (count > 0) {
        showCategoryDeleteBlock(categoryName, data);
        return false;
      }
      return confirm('Eliminare definitivamente questa categoria?');
    }

    document.querySelectorAll('[data-category-delete]').forEach(function(el){
      el.addEventListener('click', function(e){
        if (!productsConfirmCategoryDelete(el)) e.preventDefault();
      });
    });

    if (pendingCategoryDeleteBlockPopup) {
      showCategoryDeleteBlock(
        pendingCategoryDeleteBlockPopup.category_name || 'Categoria',
        pendingCategoryDeleteBlockPopup
      );
    }
  })();

            (function(){
              const grid = document.getElementById('productImagesGrid');
              const emptyEl = document.getElementById('productImagesEmpty');
              const countEl = document.getElementById('productImagesCount');
              const uploader = document.getElementById('productImageUploader');
              const input = document.getElementById('productImageInput');
              const uploadList = document.getElementById('productImageUploadList');

              if (!grid || !uploader || !input) return;

              const productId = Number(grid.dataset.productId || 0) || 0;
              const csrf = String(grid.dataset.csrf || '');
              if (!productId || !csrf) return;

              function currentImageIds(){
                return Array.from(grid.querySelectorAll('.product-image-col')).map(el => Number(el.dataset.id || 0)).filter(Boolean);
              }
              function currentCount(){ return currentImageIds().length; }
              function setCount(n){ if (countEl) countEl.textContent = String(n || 0); }
              function setEmptyVisible(show){
                if (!emptyEl) return;
                emptyEl.classList.toggle('d-none', !show);
                emptyEl.style.display = '';
              }

              function showToast(msg, isErr){
                // fallback minimale: alert solo in caso di errore
                if (isErr) alert(String(msg || 'Errore'));
              }

              function renderImages(images){
                // images: [{id,url,is_main}]
                const list = Array.isArray(images) ? images : [];
                // Pulisci grid
                grid.innerHTML = '';

                if (!list.length) {
                  setEmptyVisible(true);
                  setCount(0);
                  return;
                }
                setEmptyVisible(false);
                setCount(list.length);

                for (const im of list) {
                  const id = Number(im?.id || 0) || 0;
                  if (!id) continue;
                  const url = String(im?.url || '');
                  const isMain = !!im?.is_main;

                  const col = document.createElement('div');
                  col.className = 'col-6 col-md-3 product-image-col';
                  col.dataset.id = String(id);
                  col.dataset.main = isMain ? '1' : '0';
                  col.draggable = !isMain;

                  col.innerHTML = `
                    <div class="border rounded-3 p-2 h-100 product-image-card">
                      <div class="position-relative">
                        ${url ? `<a href="${url.replace(/"/g,'&quot;')}" target="_blank" class="d-block">
                          <img src="${url.replace(/"/g,'&quot;')}" alt="" class="img-fluid rounded product-image-preview">
                        </a>` : `<div class="bg-light rounded product-image-placeholder"></div>`}
                        ${isMain ? `<span class="badge text-bg-primary position-absolute top-0 start-0 m-1">Principale</span>` :
                          `<button type="button" class="btn btn-sm btn-light position-absolute top-0 start-0 m-1 js-set-main" title="Imposta come principale" aria-label="Imposta come principale"><i class="bi bi-star"></i></button>`}
                        ${isMain ? '' : `<span class="badge text-bg-light text-muted position-absolute top-0 end-0 m-1 js-drag-handle" title="Trascina per ordinare"><i class="bi bi-grip-vertical"></i></span>`}
                      </div>
                      <div class="d-flex justify-content-between align-items-center mt-2">
                        <span class="text-muted small">#${id}</span>
                        <button type="button" class="btn btn-sm btn-outline-danger js-delete-image" title="Rimuovi" aria-label="Rimuovi immagine"><i class="bi bi-trash"></i></button>
                      </div>
                    </div>
                  `;
                  grid.appendChild(col);
                }
              }

              function postForm(action, data){
                const fd = new FormData();
                fd.append('_csrf', csrf);
                fd.append('product_id', String(productId));
                for (const k in data) fd.append(k, data[k]);
                return fetch(`index.php?page=products&action=${encodeURIComponent(action)}`, {
                  method: 'POST',
                  body: fd,
                  credentials: 'same-origin'
                }).then(r => r.json());
              }

              // Click: set main / delete (event delegation)
              grid.addEventListener('click', (e) => {
                const btnMain = e.target && e.target.closest ? e.target.closest('.js-set-main') : null;
                const btnDel = e.target && e.target.closest ? e.target.closest('.js-delete-image') : null;
                const col = e.target && e.target.closest ? e.target.closest('.product-image-col') : null;
                if (!col) return;
                const imgId = Number(col.dataset.id || 0) || 0;
                if (!imgId) return;

                if (btnMain) {
                  btnMain.disabled = true;
                  postForm('set_main_image', { img_id: String(imgId) })
                    .then(resp => {
                      if (resp && resp.ok) {
                        renderImages(resp.images || []);
                      } else {
                        showToast((resp?.errors && resp.errors[0]) ? resp.errors[0] : 'Errore', true);
                      }
                    })
                    .catch(() => showToast('Errore di rete', true))
                    .finally(() => { try{ btnMain.disabled = false; }catch(_){ } });
                }

                if (btnDel) {
                  if (!confirm('Rimuovere questa immagine?')) return;
                  btnDel.disabled = true;
                  postForm('delete_image_ajax', { img_id: String(imgId) })
                    .then(resp => {
                      if (resp && resp.ok) {
                        renderImages(resp.images || []);
                      } else {
                        showToast((resp?.errors && resp.errors[0]) ? resp.errors[0] : 'Errore', true);
                      }
                    })
                    .catch(() => showToast('Errore di rete', true))
                    .finally(() => { try{ btnDel.disabled = false; }catch(_){ } });
                }
              });

              // Drag & Drop reorder (solo non-principale)
              let dragEl = null;
              grid.addEventListener('dragstart', (e) => {
                const item = e.target && e.target.closest ? e.target.closest('.product-image-col') : null;
                if (!item) return;
                if (String(item.dataset.main || '') === '1') return;
                dragEl = item;
                item.classList.add('dragging');
                try { e.dataTransfer.effectAllowed = 'move'; } catch(_){ }
              });
              grid.addEventListener('dragend', (e) => {
                try{
                  const item = e.target && e.target.closest ? e.target.closest('.product-image-col') : null;
                  if (item) item.classList.remove('dragging');
                }catch(_){ }
                dragEl = null;
              });
              grid.addEventListener('dragover', (e) => {
                if (!dragEl) return;
                e.preventDefault();
                const over = e.target && e.target.closest ? e.target.closest('.product-image-col') : null;
                if (!over || over === dragEl) return;
                if (String(over.dataset.main || '') === '1') return; // non si droppa sulla principale

                const rect = over.getBoundingClientRect();
                const after = (e.clientY - rect.top) > (rect.height / 2);
                grid.insertBefore(dragEl, after ? over.nextSibling : over);

                // Se per qualsiasi motivo finisse prima della principale, rimettila dopo.
                const first = grid.querySelector('.product-image-col');
                if (first && String(first.dataset.main || '') !== '1') {
                  const main = grid.querySelector('.product-image-col[data-main="1"]');
                  if (main) grid.insertBefore(main, first);
                }
              });
              grid.addEventListener('drop', (e) => {
                if (!dragEl) return;
                e.preventDefault();
                const order = currentImageIds();
                postForm('reorder_images', { order: JSON.stringify(order) })
                  .then(resp => {
                    if (resp && resp.ok) {
                      renderImages(resp.images || []);
                    } else {
                      showToast((resp?.errors && resp.errors[0]) ? resp.errors[0] : 'Errore', true);
                    }
                  })
                  .catch(() => showToast('Errore di rete', true));
              });

              // Uploader (drag&drop + click)
              uploader.addEventListener('click', () => input.click());
              uploader.addEventListener('dragover', (e) => { e.preventDefault(); uploader.classList.add('bg-light'); });
              uploader.addEventListener('dragleave', () => uploader.classList.remove('bg-light'));
              uploader.addEventListener('drop', (e) => {
                e.preventDefault();
                uploader.classList.remove('bg-light');
                const files = Array.from((e.dataTransfer && e.dataTransfer.files) ? e.dataTransfer.files : []);
                handleFiles(files);
              });
              input.addEventListener('change', () => {
                const files = Array.from(input.files || []);
                input.value = '';
                handleFiles(files);
              });

              function addUploadRow(file){
                const row = document.createElement('div');
                row.className = 'border rounded-3 p-2 mb-2';
                row.innerHTML = `
                  <div class="d-flex justify-content-between align-items-center">
                    <div class="small fw-semibold text-truncate" style="max-width:70%">${String(file.name || 'immagine')}</div>
                    <div class="small text-muted">${Math.round((file.size||0)/1024)} KB</div>
                  </div>
                  <div class="progress mt-2" style="height:8px;">
                    <div class="progress-bar" role="progressbar" style="width:0%" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
                  </div>
                  <div class="small text-muted mt-1 js-status">In attesa…</div>
                `;
                uploadList.appendChild(row);
                return row;
              }

              function uploadOne(file, row){
                return new Promise((resolve) => {
                  const bar = row.querySelector('.progress-bar');
                  const status = row.querySelector('.js-status');
                  const xhr = new XMLHttpRequest();
                  xhr.open('POST', 'index.php?page=products&action=upload_image_ajax', true);
                  xhr.withCredentials = true;
                  xhr.responseType = 'json';

                  xhr.upload.onprogress = (ev) => {
                    if (!ev.lengthComputable) return;
                    const pct = Math.max(0, Math.min(100, Math.round((ev.loaded / ev.total) * 100)));
                    if (bar) {
                      bar.style.width = pct + '%';
                      bar.setAttribute('aria-valuenow', String(pct));
                    }
                  };

                  xhr.onreadystatechange = () => {
                    if (xhr.readyState !== 4) return;
                    const resp = xhr.response || null;
                    if (xhr.status >= 200 && xhr.status < 300 && resp && resp.ok) {
                      if (status) status.textContent = 'Caricata';
                      if (bar) bar.style.width = '100%';
                      renderImages(resp.images || []);
                    } else {
                      const err = (resp && resp.errors && resp.errors[0]) ? resp.errors[0] : 'Errore upload';
                      if (status) status.textContent = err;
                      row.classList.add('border-danger');
                    }
                    resolve();
                  };

                  const fd = new FormData();
                  fd.append('_csrf', csrf);
                  fd.append('product_id', String(productId));
                  fd.append('image', file, file.name);
                  if (status) status.textContent = 'Caricamento…';
                  xhr.send(fd);
                });
              }

              async function handleFiles(files){
                const list = Array.isArray(files) ? files : [];
                if (!list.length) return;

                const MAX_TOTAL = 5;
                let available = MAX_TOTAL - currentCount();
                if (available <= 0) {
                  showToast('Hai già raggiunto il limite massimo di 5 immagini.', true);
                  return;
                }

                for (const file of list) {
                  if (!file) continue;
                  if (available <= 0) break;
                  // client-side basic validation
                  if (!String(file.type || '').startsWith('image/')) {
                    showToast('File non valido: ' + String(file.name || ''), true);
                    continue;
                  }
                  if ((file.size || 0) > (5 * 1024 * 1024)) {
                    showToast('Immagine troppo grande (max 5 MB): ' + String(file.name || ''), true);
                    continue;
                  }
                  available--;

                  const row = addUploadRow(file);
                  await uploadOne(file, row);
                }
              }
            })();

(function(){
  const modalEl = document.getElementById('productDetailsModal');
  if (!modalEl) return;

  // Bootstrap JS viene caricato nel footer; su alcune installazioni l'inline script
  // viene eseguito prima che "bootstrap" sia disponibile. Per questo creiamo/recuperiamo
  // l'istanza del modal solo al click.
  let bsModal = null;
  function getBsModal(){
    if (bsModal) return bsModal;
    if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
      // getOrCreateInstance evita duplicazioni
      bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    }
    return bsModal;
  }

  function showModalFallback(){
    // Fallback minimale se Bootstrap JS non è disponibile.
    modalEl.classList.add('show');
    modalEl.style.display = 'block';
    modalEl.removeAttribute('aria-hidden');
    modalEl.setAttribute('aria-modal', 'true');
    document.body.classList.add('modal-open');

    if (!document.querySelector('.modal-backdrop[data-fallback="1"]')) {
      const bd = document.createElement('div');
      bd.className = 'modal-backdrop fade show';
      bd.setAttribute('data-fallback', '1');
      document.body.appendChild(bd);
      bd.addEventListener('click', hideModalFallback);
    }
  }

  function hideModalFallback(){
    modalEl.classList.remove('show');
    modalEl.style.display = '';
    modalEl.setAttribute('aria-hidden', 'true');
    modalEl.removeAttribute('aria-modal');
    document.body.classList.remove('modal-open');
    document.querySelectorAll('.modal-backdrop[data-fallback="1"]').forEach(el => el.remove());
  }

  function setText(id, value){
    const el = document.getElementById(id);
    if (!el) return;
    const v = (value === null || value === undefined || String(value).trim()==='') ? '—' : String(value);
    el.textContent = v;
  }
  function euro(v){
    const n = Number(v);
    if (!isFinite(n)) return '—';
    return '€ ' + n.toFixed(2).replace('.', ',');
  }
  function formatDate(iso){
    if (!iso) return '—';
    // accetta YYYY-MM-DD o YYYY-MM-DD HH:MM:SS
    const s = String(iso).trim();
    const d = new Date(s.length===10 ? (s + 'T00:00:00') : s.replace(' ', 'T'));
    if (isNaN(d.getTime())) return s;
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  function renderImages(imagesJson){
    const main = document.getElementById('pd_main_img');
    const no = document.getElementById('pd_no_img');
    const thumbs = document.getElementById('pd_thumbs');
    if (!main || !no || !thumbs) return;

    let arr = [];
    try {
      if (imagesJson && String(imagesJson).trim() !== '') {
        const parsed = JSON.parse(String(imagesJson));
        if (Array.isArray(parsed)) arr = parsed.filter(Boolean).map(String);
      }
    } catch (e) {
      arr = [];
    }

    thumbs.innerHTML = '';
    if (!arr.length) {
      main.src = '';
      main.classList.add('d-none');
      main.style.display = '';
      no.classList.remove('d-none');
      no.style.display = '';
      return;
    }

    no.classList.add('d-none');
    no.style.display = '';
    main.classList.remove('d-none');
    main.style.display = '';
    main.src = arr[0];
    main.alt = 'Immagine prodotto';

    // Click on main image -> open full in a new tab
    main.onclick = function(){
      try { window.open(main.src, '_blank', 'noopener'); } catch(e) {}
    };

    arr.forEach((url, idx) => {
      const wrap = document.createElement('div');
      wrap.className = 'pd-thumb';
      const im = document.createElement('img');
      im.src = url;
      im.alt = '';
      wrap.appendChild(im);
      wrap.addEventListener('click', () => {
        main.src = url;
      });
      thumbs.appendChild(wrap);
    });
  }

  // Gestione click in delega: funziona anche se i bottoni vengono renderizzati dopo.
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-product-view');
    if (!btn) return;

    const ds = btn.dataset || {};
    setText('pd_name', ds.name);
    setText('pd_brand', ds.brand);
    setText('pd_code', ds.code);
    setText('pd_internal_code', ds.internal_code);
    setText('pd_category', ds.category);
    setText('pd_supplier', ds.supplier);
    setText('pd_price', euro(ds.price));
    setText('pd_purchase_price', euro(ds.purchase_price));
    setText('pd_stock', ds.stock);
    setText('pd_min_stock', ds.min_stock);
    setText('pd_reorder_qty', ds.reorder_qty);
    setText('pd_incoming_qty', ds.incoming_qty);
    setText('pd_incoming_eta', formatDate(ds.incoming_eta));

    setText('pd_description', ds.description);
    setText('pd_ingredients', ds.ingredients);
    setText('pd_warnings', ds.warnings);
    renderImages(ds.images);

    const edit = document.getElementById('pd_edit_link');
    if (edit) edit.href = 'index.php?page=products&action=edit&id=' + encodeURIComponent(ds.id || '') + '&location_id=' + encodeURIComponent(String(PRODUCTS_PAGE_CONFIG.productLocationId || 0));

    const m = getBsModal();
    if (m) m.show();
    else showModalFallback();
  });

  // Chiudi (fallback) se Bootstrap JS non gestisce il dismiss
  modalEl.querySelectorAll('[data-bs-dismiss="modal"]').forEach((el) => {
    el.addEventListener('click', () => {
      const m = getBsModal();
      if (m) return; // gestito da Bootstrap
      hideModalFallback();
    });
  });
})();

(function(){
  'use strict';

  function norm(s){ return String(s||'').toLowerCase().trim(); }

  function getBootstrapDropdown(toggleBtn){
    try{
      if(toggleBtn && window.bootstrap && window.bootstrap.Dropdown){
        return window.bootstrap.Dropdown.getOrCreateInstance(toggleBtn, { autoClose: true });
      }
    }catch(e){}
    return null;
  }

  function closeDropdown(toggleBtn){
    if(!toggleBtn) return;

    const dd = getBootstrapDropdown(toggleBtn);
    if(dd){
      try{ dd.hide(); }catch(e){}
      return;
    }

    const root = toggleBtn.closest('.app-combobox');
    const menu = root ? root.querySelector('.dropdown-menu') : null;

    if(menu) menu.classList.remove('show');
    if(root) root.classList.remove('show');
    toggleBtn.classList.remove('show');
    toggleBtn.setAttribute('aria-expanded', 'false');
  }

  function openDropdown(toggleBtn){
    if(!toggleBtn) return;

    // Close other open comboboxes (fallback & bootstrap-safe)
    document.querySelectorAll('.app-combobox .dropdown-menu.show').forEach(function (m) {
      const r = m.closest('.app-combobox');
      const t = r ? r.querySelector('.app-combobox-toggle') : null;
      if (t && t !== toggleBtn) closeDropdown(t);
    });

    const dd = getBootstrapDropdown(toggleBtn);
    if(dd){
      try{ dd.toggle(); }catch(e){
        try{ dd.show(); }catch(e2){}
      }
      return;
    }

    const root = toggleBtn.closest('.app-combobox');
    const menu = root ? root.querySelector('.dropdown-menu') : null;
    if(!root || !menu) return;

    const isShown = menu.classList.contains('show');
    if(isShown){
      closeDropdown(toggleBtn);
      return;
    }

    menu.classList.add('show');
    root.classList.add('show');
    toggleBtn.classList.add('show');
    toggleBtn.setAttribute('aria-expanded', 'true');
  }

  // One global outside-click close handler (for fallback mode)
  if (!window.__appComboboxOutsideClose) {
    window.__appComboboxOutsideClose = true;
    document.addEventListener('click', function (e) {
      document.querySelectorAll('.app-combobox .dropdown-menu.show').forEach(function (m) {
        const r = m.closest('.app-combobox');
        if (r && !r.contains(e.target)) {
          const t = r.querySelector('.app-combobox-toggle');
          if (t) closeDropdown(t);
        }
      });
    });
  }

  function initCombobox(boxEl, items, opts){
    if(!boxEl) return;

    const toggle = boxEl.querySelector('.app-combobox-toggle');
    const hidden = boxEl.querySelector('input[type="hidden"]');
    const search = boxEl.querySelector('.app-combobox-search');
    const list = boxEl.querySelector('.app-combobox-list');
    const textEl = toggle ? toggle.querySelector('.app-combobox-text') : null;
    const placeholderEl = toggle ? toggle.querySelector('.app-combobox-placeholder') : null;

    if(!toggle || !hidden || !search || !list || !textEl || !placeholderEl) return;

    const allValue = (opts && opts.allValue != null) ? String(opts.allValue) : '0';
    const allLabel = (opts && opts.allLabel != null) ? String(opts.allLabel) : 'Tutti';

    const allItem = { id: allValue, label: allLabel, search: norm(allLabel) };
    const itemList = [allItem].concat(Array.isArray(items) ? items : []);

    function setValue(id, label){
      hidden.value = String(id);
      if (String(id) === allValue) {
        textEl.textContent = '';
        textEl.style.display = 'none';
        placeholderEl.style.display = '';
        placeholderEl.textContent = allLabel;
      } else {
        textEl.textContent = String(label || '');
        textEl.style.display = '';
        placeholderEl.style.display = 'none';
      }
    }

    function getValue(){
      return String(hidden.value || '').trim();
    }

    function findById(id){
      const sid = String(id || '');
      return itemList.find(it => String(it.id) === sid) || null;
    }

    function render(){
      const q = norm(search.value);
      const out = [];
      const MAX = 300;

      for(const it of itemList){
        if(!q || String(it.search || '').indexOf(q) !== -1){
          out.push(it);
          if(out.length >= MAX) break;
        }
      }

      list.innerHTML = '';
      if(!out.length){
        const empty = document.createElement('div');
        empty.className = 'list-group-item disabled text-muted';
        empty.textContent = 'Nessun risultato';
        list.appendChild(empty);
        return;
      }

      const current = getValue();
      out.forEach((it) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'list-group-item list-group-item-action';
        if(current && String(it.id) === String(current)) btn.classList.add('active');
        btn.textContent = it.label;
        btn.addEventListener('click', function () {
          setValue(it.id, it.label);
          closeDropdown(toggle);
        });
        list.appendChild(btn);
      });
    }

    function focusSearch(){
      try{
        search.focus();
        search.select();
      }catch(e){}
    }

    function refresh(){
      search.value = '';
      render();
      focusSearch();
    }

    boxEl.addEventListener('shown.bs.dropdown', function () {
      if(toggle.disabled) return;
      refresh();
    });

    toggle.addEventListener('click', function (e) {
      if(toggle.disabled) return;
      e.preventDefault();
      e.stopPropagation();
      openDropdown(toggle);
      setTimeout(refresh, 0);
    });

    search.addEventListener('input', render);
    search.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const first = list.querySelector('.list-group-item-action:not(.disabled)');
        if (first) first.click();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDropdown(toggle);
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const first = list.querySelector('.list-group-item-action:not(.disabled)');
        if (first) first.focus();
      }
    });

    list.addEventListener('keydown', function (e) {
      const active = document.activeElement;
      if (!active || !active.classList || !active.classList.contains('list-group-item-action')) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = active.nextElementSibling;
        if (next && next.classList.contains('list-group-item-action')) next.focus();
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = active.previousElementSibling;
        if (prev && prev.classList.contains('list-group-item-action')) prev.focus();
        else focusSearch();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDropdown(toggle);
        toggle.focus();
      }
    });

    // Init state
    let initVal = getValue();
    if (!initVal) initVal = allValue;
    const found = findById(initVal);
    if (found) setValue(found.id, found.label);
    else setValue(allValue, allLabel);
  }

  const products = Array.isArray(PRODUCTS_PAGE_CONFIG.filterProducts) ? PRODUCTS_PAGE_CONFIG.filterProducts : [];

  const productItems = (products || []).map(p => {
    const name = String(p.name || '');
    const sku = String(p.sku || '');
    const label = String(p.display_name || (sku ? (name + ' (' + sku + ')') : name)).trim();
    return { id: String(p.id || ''), label: label || ('#' + String(p.id || '')), search: norm(name + ' ' + sku + ' ' + label) };
  });

  initCombobox(document.querySelector('.js-filter-product-box'), productItems, { allValue: '0', allLabel: 'Tutti' });
})();

(function(){
  const pendingDeleteBlockPopup = PRODUCTS_PAGE_CONFIG.pendingDeleteBlockPopup || null;
  const pendingProductUpdateConfirmPopup = PRODUCTS_PAGE_CONFIG.pendingProductUpdateConfirmPopup || null;
  const pendingProductPriceUpdateConfirmPopup = PRODUCTS_PAGE_CONFIG.pendingProductPriceUpdateConfirmPopup || null;

  function safeParseBlockers(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function blockerLine(blocker) {
    const title = blocker && blocker.title ? String(blocker.title) : 'Elemento collegato';
    const detail = blocker && blocker.detail ? String(blocker.detail) : '';
    return detail ? (title + ' — ' + detail) : title;
  }

  function renderBlockerGroups(container, blockers) {
    container.innerHTML = '';
    blockers = safeParseBlockers(blockers);
    if (!blockers.length) {
      const empty = document.createElement('div');
      empty.className = 'text-muted small';
      empty.textContent = 'Nessuna associazione rilevata.';
      container.appendChild(empty);
      return;
    }

    const groups = [];
    const byGroup = {};
    blockers.forEach(function(blocker){
      const group = blocker && blocker.group ? String(blocker.group) : 'Associazione attiva';
      if (!byGroup[group]) {
        byGroup[group] = [];
        groups.push(group);
      }
      byGroup[group].push(blocker || {});
    });

    const accordion = document.createElement('div');
    accordion.className = 'accordion';
    accordion.id = 'productBlockerGroupsAccordion' + Math.random().toString(36).slice(2);

    groups.forEach(function(group, idx){
      const rows = byGroup[group] || [];
      const headingId = accordion.id + 'Heading' + idx;
      const collapseId = accordion.id + 'Collapse' + idx;
      const item = document.createElement('div');
      item.className = 'accordion-item border rounded-3 overflow-hidden mb-2';

      const header = document.createElement('h3');
      header.className = 'accordion-header';
      header.id = headingId;

      const button = document.createElement('button');
      button.className = 'accordion-button collapsed bg-white shadow-none py-2';
      button.type = 'button';
      button.setAttribute('data-bs-toggle', 'collapse');
      button.setAttribute('data-bs-target', '#' + collapseId);
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-controls', collapseId);

      const label = document.createElement('span');
      label.className = 'd-flex align-items-center justify-content-between gap-2 w-100 pe-2';
      const title = document.createElement('span');
      title.className = 'fw-semibold';
      title.textContent = group;
      const badge = document.createElement('span');
      badge.className = 'badge rounded-pill text-bg-info';
      badge.textContent = String(rows.length);
      label.appendChild(title);
      label.appendChild(badge);
      button.appendChild(label);
      header.appendChild(button);
      item.appendChild(header);

      const collapse = document.createElement('div');
      collapse.className = 'accordion-collapse collapse';
      collapse.id = collapseId;
      collapse.setAttribute('aria-labelledby', headingId);
      const body = document.createElement('div');
      body.className = 'accordion-body py-2';
      const list = document.createElement('div');
      list.className = 'list-group list-group-flush';
      byGroup[group].forEach(function(blocker){
        const row = document.createElement('div');
        row.className = 'list-group-item px-0';
        row.textContent = blockerLine(blocker);
        list.appendChild(row);
      });
      body.appendChild(list);
      collapse.appendChild(body);
      item.appendChild(collapse);
      accordion.appendChild(item);
    });
    container.appendChild(accordion);
  }

  function showProductDeleteBlockPopup(productName, message, blockers) {
    blockers = safeParseBlockers(blockers);
    const titleText = 'Impossibile eliminare il prodotto';
    const productLabel = productName ? String(productName) : 'Prodotto';
    const msgText = message || ('Il prodotto "' + productLabel + '" non può essere eliminato perché è associato a elementi attivi o ancora da ritirare. Rimuovi o chiudi prima le associazioni elencate.');

    const modalEl = document.getElementById('productDeleteBlockModal');
    const titleEl = document.getElementById('productDeleteBlockModalTitle');
    const msgEl = document.getElementById('productDeleteBlockModalMessage');
    const listEl = document.getElementById('productDeleteBlockList');

    if (!modalEl || !titleEl || !msgEl || !listEl || typeof bootstrap === 'undefined' || !bootstrap.Modal) {
      alert(titleText + '\n\n' + msgText + '\n\n' + blockers.map(blockerLine).join('\n'));
      return;
    }

    titleEl.textContent = titleText;
    msgEl.textContent = msgText;
    renderBlockerGroups(listEl, blockers);
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

  function productUpdateChangedFields(form) {
    if (!form) return [];
    const fields = [];
    const nameInput = form.querySelector('input[name="name"]');
    const codeInput = form.querySelector('input[name="product_code"]');
    const oldName = String(form.getAttribute('data-original-name') || '').trim();
    const oldCode = String(form.getAttribute('data-original-code') || '').trim();
    const newName = nameInput ? String(nameInput.value || '').trim() : oldName;
    const newCode = codeInput ? String(codeInput.value || '').trim() : oldCode;
    if (oldName !== newName) fields.push('nome');
    if (oldCode !== newCode) fields.push('codice prodotto');
    return fields;
  }

  function productAmountCents(value) {
    const raw = String(value == null ? '' : value).replace(',', '.').trim();
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100);
  }

  function productPriceChanged(form) {
    if (!form) return false;
    const priceInput = form.querySelector('input[name="price"]');
    const oldPriceC = productAmountCents(form.getAttribute('data-original-price') || '0');
    const newPriceC = productAmountCents(priceInput ? priceInput.value : '0');
    return oldPriceC !== newPriceC;
  }

  function submitProductFormAfterConfirm(form) {
    if (!form) return;
    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit();
    } else {
      form.submit();
    }
  }

  function showProductUpdateConfirmPopup(form, productName, changedFields, impacts) {
    impacts = safeParseBlockers(impacts);
    changedFields = Array.isArray(changedFields) ? changedFields : [];
    const productLabel = productName ? String(productName) : 'Prodotto';
    const changesLabel = changedFields.length ? changedFields.join(' e ') : 'nome/codice prodotto';
    const msgText = 'Stai modificando ' + changesLabel + ' di "' + productLabel + '". Continuando, il nuovo valore verrà usato nelle GiftBox attive/scadute con dettaglio vendita, nei preventivi bozza/accettati/rifiutati, nei pacchetti attivi/scaduti, nel catalogo pacchetti, nei preordini da ritirare, negli omaggi disponibili e nelle campagne omaggio/promozione attive o disattive elencate sotto. Le vendite concluse e lo storico non incluso resteranno invariati.';

    const modalEl = document.getElementById('productUpdateConfirmModal');
    const msgEl = document.getElementById('productUpdateConfirmMessage');
    const listEl = document.getElementById('productUpdateConfirmList');
    const continueBtn = document.getElementById('productUpdateConfirmContinue');

    if (!modalEl || !msgEl || !listEl || typeof bootstrap === 'undefined' || !bootstrap.Modal) {
      const text = msgText + '\n\n' + impacts.map(blockerLine).join('\n') + '\n\nContinuare?';
      if (!form) { alert(msgText); return; }
      if (confirm(text)) {
        const hidden = form.querySelector('input[name="product_name_code_confirmed"]');
        if (hidden) hidden.value = '1';
        submitProductFormAfterConfirm(form);
      }
      return;
    }

    msgEl.textContent = msgText;
    renderBlockerGroups(listEl, impacts);

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    if (continueBtn) {
      continueBtn.style.display = form ? '' : 'none';
      continueBtn.onclick = function(){
        if (!form) return;
        const hidden = form.querySelector('input[name="product_name_code_confirmed"]');
        if (hidden) hidden.value = '1';
        modal.hide();
        submitProductFormAfterConfirm(form);
      };
    }
    modal.show();
  }


  function showProductPriceUpdateConfirmPopup(form, productName, impacts, oldPrice, newPrice) {
    impacts = safeParseBlockers(impacts);
    const productLabel = productName ? String(productName) : 'Prodotto';
    const oldPriceLabel = Number.isFinite(Number(oldPrice)) ? Number(oldPrice).toFixed(2).replace('.', ',') : '';
    const newPriceLabel = Number.isFinite(Number(newPrice)) ? Number(newPrice).toFixed(2).replace('.', ',') : '';
    let pricePart = '';
    if (oldPriceLabel || newPriceLabel) {
      pricePart = ' da € ' + (oldPriceLabel || '—') + ' a € ' + (newPriceLabel || '—');
    }
    const msgText = 'Stai modificando il prezzo di vendita di "' + productLabel + '"' + pricePart + '. Continuando, il nuovo prezzo verrà aggiornato nel Catalogo pacchetti (solo catalogo, non i pacchetti cliente già esistenti) e nelle Campagne Promozioni elencate sotto. Tutto il resto già creato resterà invariato per mantenere lo storico.';

    const modalEl = document.getElementById('productPriceUpdateConfirmModal');
    const msgEl = document.getElementById('productPriceUpdateConfirmMessage');
    const listEl = document.getElementById('productPriceUpdateConfirmList');
    const continueBtn = document.getElementById('productPriceUpdateConfirmContinue');

    if (!modalEl || !msgEl || !listEl || typeof bootstrap === 'undefined' || !bootstrap.Modal) {
      const text = msgText + '\n\n' + impacts.map(blockerLine).join('\n') + '\n\nContinuare?';
      if (!form) { alert(msgText); return; }
      if (confirm(text)) {
        const hidden = form.querySelector('input[name="product_price_confirmed"]');
        if (hidden) hidden.value = '1';
        submitProductFormAfterConfirm(form);
      }
      return;
    }

    msgEl.textContent = msgText;
    renderBlockerGroups(listEl, impacts);

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    if (continueBtn) {
      continueBtn.style.display = form ? '' : 'none';
      continueBtn.onclick = function(){
        if (!form) return;
        const hidden = form.querySelector('input[name="product_price_confirmed"]');
        if (hidden) hidden.value = '1';
        modal.hide();
        submitProductFormAfterConfirm(form);
      };
    }
    modal.show();
  }

  function productsConfirmDelete(el) {
    const blockers = safeParseBlockers(el ? el.getAttribute('data-product-delete-blockers') : '');
    const productName = el ? (el.getAttribute('data-product-name') || 'Prodotto') : 'Prodotto';

    if (blockers.length > 0) {
      showProductDeleteBlockPopup(
        productName,
        'Il prodotto "' + productName + '" non può essere eliminato perché è associato agli elementi elencati. Finché anche una sola associazione è attiva, l’eliminazione non è consentita.',
        blockers
      );
      return false;
    }

    return confirm('Eliminare definitivamente questo prodotto?\n\nLe vendite, i movimenti e lo storico già creato resteranno invariati.');
  }

  document.querySelectorAll('[data-product-delete]').forEach(function(el){
    el.addEventListener('click', function(e){
      if (!productsConfirmDelete(el)) e.preventDefault();
    });
  });

  document.addEventListener('DOMContentLoaded', function(){
    const productForm = document.getElementById('productForm');
    if (productForm) {
      const nameHiddenReset = productForm.querySelector('input[name="product_name_code_confirmed"]');
      const priceHiddenReset = productForm.querySelector('input[name="product_price_confirmed"]');
      ['name','product_code'].forEach(function(fieldName){
        const input = productForm.querySelector('[name="' + fieldName + '"]');
        if (input && nameHiddenReset) input.addEventListener('input', function(){ nameHiddenReset.value = '0'; });
      });
      const priceInputReset = productForm.querySelector('input[name="price"]');
      if (priceInputReset && priceHiddenReset) priceInputReset.addEventListener('input', function(){ priceHiddenReset.value = '0'; });

      productForm.addEventListener('submit', function(e){
        const nameHidden = productForm.querySelector('input[name="product_name_code_confirmed"]');
        const priceHidden = productForm.querySelector('input[name="product_price_confirmed"]');

        if (!(nameHidden && nameHidden.value === '1')) {
          const changedFields = productUpdateChangedFields(productForm);
          const impacts = safeParseBlockers(productForm.getAttribute('data-product-update-impacts') || '[]');
          if (changedFields.length && impacts.length) {
            e.preventDefault();
            showProductUpdateConfirmPopup(
              productForm,
              productForm.getAttribute('data-product-name') || 'Prodotto',
              changedFields,
              impacts
            );
            return false;
          }
        }

        if (!(priceHidden && priceHidden.value === '1')) {
          const priceImpacts = safeParseBlockers(productForm.getAttribute('data-product-price-impacts') || '[]');
          if (productPriceChanged(productForm) && priceImpacts.length) {
            const priceInput = productForm.querySelector('input[name="price"]');
            e.preventDefault();
            showProductPriceUpdateConfirmPopup(
              productForm,
              productForm.getAttribute('data-product-name') || 'Prodotto',
              priceImpacts,
              Number(productAmountCents(productForm.getAttribute('data-original-price') || '0')) / 100,
              Number(productAmountCents(priceInput ? priceInput.value : '0')) / 100
            );
            return false;
          }
        }

        return true;
      });
    }

    if (pendingDeleteBlockPopup) {
      showProductDeleteBlockPopup(
        pendingDeleteBlockPopup.product_name || 'Prodotto',
        pendingDeleteBlockPopup.message || '',
        pendingDeleteBlockPopup.blockers || []
      );
    }

    if (pendingProductUpdateConfirmPopup) {
      showProductUpdateConfirmPopup(
        productForm || null,
        pendingProductUpdateConfirmPopup.product_name || 'Prodotto',
        pendingProductUpdateConfirmPopup.changed_fields || [],
        pendingProductUpdateConfirmPopup.blockers || []
      );
    }


    if (pendingProductPriceUpdateConfirmPopup) {
      showProductPriceUpdateConfirmPopup(
        productForm || null,
        pendingProductPriceUpdateConfirmPopup.product_name || 'Prodotto',
        pendingProductPriceUpdateConfirmPopup.blockers || [],
        pendingProductPriceUpdateConfirmPopup.old_price || null,
        pendingProductPriceUpdateConfirmPopup.new_price || null
      );
    }
  });
})();
