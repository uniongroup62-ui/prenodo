function fidelityWalletReadJsonConfig(id){
  var el = document.getElementById(id);
  if (!el) return {};
  try {
    var parsed = JSON.parse(el.textContent || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

function walletComboboxNorm(s){
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function initWalletCombobox(boxEl, items, selectedId, allValue, allLabel){
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
    search: walletComboboxNorm(allLabel)
  }].concat(Array.isArray(items) ? items : []);

  function render(){
    var q = walletComboboxNorm(search.value);
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
  var walletPageConfig = fidelityWalletReadJsonConfig('fidelityWalletPageConfig');
  var walletClientItems = Array.isArray(walletPageConfig.clientItems) ? walletPageConfig.clientItems : [];
  if (Array.isArray(walletClientItems)) {
    walletClientItems = walletClientItems.map(function(it){
      it.search = walletComboboxNorm(it.search || it.label);
      return it;
    });
  }
  var walletClientFilterBox = document.getElementById('walletClientFilterBox');
  if (walletClientFilterBox) {
    var hidden = walletClientFilterBox.querySelector('input[type=hidden]');
    initWalletCombobox(walletClientFilterBox, walletClientItems, (hidden ? hidden.value : '0'), '0', 'Tutti i clienti');
  }
  var manualMoveClientBox = document.getElementById('manualMoveClientBox');
  if (manualMoveClientBox) {
    var manualHidden = manualMoveClientBox.querySelector('input[type=hidden]');
    initWalletCombobox(manualMoveClientBox, walletClientItems, (manualHidden ? manualHidden.value : ''), '', 'Seleziona...');
  }
});
