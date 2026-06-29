function creditMovementsReadJsonConfig(id){
  var el = document.getElementById(id);
  if (!el) return {};
  try {
    var parsed = JSON.parse(el.textContent || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

function creditComboboxNorm(s){
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function initCreditCombobox(boxEl, items, selectedId, allValue, allLabel){
  if (!boxEl) return;
  var toggle = boxEl.querySelector('.app-combobox-toggle');
  var hidden = boxEl.querySelector('input[type=hidden]');
  var search = boxEl.querySelector('.app-combobox-search');
  var list = boxEl.querySelector('.app-combobox-list');
  var textEl = toggle ? toggle.querySelector('.app-combobox-text') : null;
  var placeholderEl = toggle ? toggle.querySelector('.app-combobox-placeholder') : null;
  if (!toggle || !hidden || !search || !list || !textEl || !placeholderEl) return;

  var data = [{
    id: String(allValue),
    label: String(allLabel),
    search: creditComboboxNorm(allLabel)
  }].concat(Array.isArray(items) ? items : []);

  function render(){
    var q = creditComboboxNorm(search.value);
    list.innerHTML = '';
    var shown = 0;
    data.forEach(function(it){
      if (!q || String(it.search || '').indexOf(q) !== -1) {
        var item = document.createElement('button');
        item.type = 'button';
        item.className = 'dropdown-item d-flex justify-content-between align-items-center';
        item.textContent = it.label;
        item.addEventListener('click', function(){
          setValue(it.id);
          search.value = '';
          render();
        });
        list.appendChild(item);
        shown++;
      }
    });
    if (shown === 0) {
      var empty = document.createElement('div');
      empty.className = 'text-muted small px-2 py-1';
      empty.textContent = 'Nessun risultato';
      list.appendChild(empty);
    }
  }

  function updateLabel(){
    var id = String(hidden.value || '');
    var current = data.find(function(it){ return String(it.id) === id; }) || null;
    var label = current ? String(current.label || '') : '';
    if (id && id !== String(allValue) && label) {
      textEl.textContent = label;
      textEl.classList.remove('d-none');
      placeholderEl.classList.add('d-none');
    } else {
      textEl.textContent = '';
      textEl.classList.add('d-none');
      placeholderEl.classList.remove('d-none');
    }
  }

  function setValue(id){
    hidden.value = String(id == null ? '' : id);
    updateLabel();
  }

  setValue(String(selectedId != null && selectedId !== '' ? selectedId : (hidden.value || allValue || '')));
  render();
  search.addEventListener('input', render);
  toggle.addEventListener('shown.bs.dropdown', function(){
    setTimeout(function(){ search.focus(); search.select(); }, 0);
  });
}

document.addEventListener('DOMContentLoaded', function(){
  var creditPageConfig = creditMovementsReadJsonConfig('creditMovementsPageConfig');
  var creditClientItems = Array.isArray(creditPageConfig.clientItems) ? creditPageConfig.clientItems : [];
  if (Array.isArray(creditClientItems)) {
    creditClientItems = creditClientItems.map(function(it){
      it.search = creditComboboxNorm(it.search || it.label);
      return it;
    });
  }


  document.querySelectorAll('[data-confirm]').forEach(function(el){
    el.addEventListener('click', function(e){
      var message = el.getAttribute('data-confirm') || '';
      if (message && !window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
  });

  var filterBox = document.getElementById('creditClientFilterBox');
  if (filterBox) {
    var filterHidden = filterBox.querySelector('input[type=hidden]');
    initCreditCombobox(filterBox, creditClientItems, (filterHidden ? filterHidden.value : '0'), '0', 'Tutti i clienti');
  }

  var manualBox = document.getElementById('creditManualClientBox');
  if (manualBox) {
    var manualHidden = manualBox.querySelector('input[type=hidden]');
    initCreditCombobox(manualBox, creditClientItems, (manualHidden ? manualHidden.value : ''), '', 'Seleziona...');
  }
});
