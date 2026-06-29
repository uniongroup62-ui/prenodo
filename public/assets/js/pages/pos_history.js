(function(){
  'use strict';

  var configEl = document.getElementById('posCronologiaPageConfig');
  var posCronologiaConfig = {};
  if (configEl) {
    try {
      var parsedConfig = JSON.parse(configEl.textContent || '{}');
      posCronologiaConfig = parsedConfig && typeof parsedConfig === 'object' ? parsedConfig : {};
    } catch (e) {
      posCronologiaConfig = {};
    }
  }

  document.addEventListener('change', function(event){
    var el = event.target && event.target.closest ? event.target.closest('[data-auto-submit]') : null;
    if (!el || !el.form) return;
    el.form.submit();
  });

(function() {
          const modalEl = document.getElementById('cancelSaleModal');
          if (!modalEl) return;

          modalEl.addEventListener('shown.bs.modal', function () {
            const body = modalEl.querySelector('.modal-body');
            if (body) body.scrollTop = 0;
          });

          const form = document.getElementById('cancelSaleForm');
          if (form) {
            form.addEventListener('submit', function () {
              const btn = document.getElementById('cancelSaleConfirmBtn');
              if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>Annullamento...';
              }
            });
          }
        })();

document.addEventListener('DOMContentLoaded', function(){
  function norm(value){
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }
  document.querySelectorAll('.pos-filter-search').forEach(function(input){
    var target = document.querySelector(input.getAttribute('data-filter-target') || '');
    if (!target) return;
    var options = Array.prototype.slice.call(target.querySelectorAll('[data-filter-option]'));
    input.addEventListener('input', function(){
      var q = norm(input.value);
      options.forEach(function(option){
        var text = norm(option.getAttribute('data-filter-text') || option.textContent || '');
        option.classList.toggle('d-none', q !== '' && text.indexOf(q) === -1);
      });
    });
  });

  var filterForm = document.querySelector('.pos-movements-filter');
  if (filterForm) {
    var clientName = 'client_id[]';
    var exclusiveNames = ['service_id[]', 'product_id[]', 'package_id[]', 'movement_type[]'];

    function boxesByName(name){
      return Array.prototype.slice.call(filterForm.querySelectorAll('input[type="checkbox"][name="' + name + '"]'));
    }

    function groupForName(name){
      var first = boxesByName(name)[0] || null;
      return first ? first.closest('.pos-filter-group') : null;
    }

    function checkedGroup(){
      for (var i = 0; i < exclusiveNames.length; i++) {
        if (boxesByName(exclusiveNames[i]).some(function(box){ return box.checked; })) return exclusiveNames[i];
      }
      return '';
    }

    function setGroupState(name, disabled){
      var group = groupForName(name);
      boxesByName(name).forEach(function(box){
        box.disabled = !!disabled;
        var label = box.closest('.pos-filter-check');
        if (label) label.classList.toggle('is-disabled', !!disabled);
      });
      if (group) {
        group.classList.toggle('is-disabled', !!disabled);
        group.querySelectorAll('.pos-filter-search').forEach(function(search){
          search.disabled = !!disabled;
        });
      }
    }

    function refreshExclusiveGroups(){
      var activeName = checkedGroup();
      exclusiveNames.forEach(function(name){
        setGroupState(name, !!activeName && name !== activeName);
      });
    }

    function clearOtherGroups(activeName){
      exclusiveNames.forEach(function(name){
        if (name === activeName) return;
        boxesByName(name).forEach(function(box){ box.checked = false; });
      });
    }

    filterForm.addEventListener('change', function(ev){
      var box = ev.target;
      if (!box || box.type !== 'checkbox') return;
      var name = String(box.name || '');

      if (name === clientName && box.checked) {
        boxesByName(clientName).forEach(function(other){
          if (other !== box) other.checked = false;
        });
      }

      if (exclusiveNames.indexOf(name) !== -1 && box.checked) {
        boxesByName(name).forEach(function(other){
          if (other !== box) other.checked = false;
        });
        clearOtherGroups(name);
      }

      refreshExclusiveGroups();
    });

    boxesByName(clientName).forEach(function(box, idx){
      if (box.checked && boxesByName(clientName).findIndex(function(other){ return other.checked; }) !== idx) {
        box.checked = false;
      }
    });
    exclusiveNames.forEach(function(name){
      var seen = false;
      boxesByName(name).forEach(function(box){
        if (!box.checked) return;
        if (!seen) {
          seen = true;
        } else {
          box.checked = false;
        }
      });
    });
    var initialActive = checkedGroup();
    if (initialActive) clearOtherGroups(initialActive);
    refreshExclusiveGroups();
  }
});

function posMovComboboxNorm(value){
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function initPosMovCombobox(boxEl, items, selectedId, allValue, allLabel){
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
    search: posMovComboboxNorm(allLabel)
  }].concat(Array.isArray(items) ? items : []);

  function updateLabel(){
    var id = String(hidden.value || '');
    var match = data.find(function(entry){ return String(entry.id) === id; }) || null;
    var label = match ? String(match.label || '') : '';
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

  function render(){
    var q = posMovComboboxNorm(search.value);
    list.innerHTML = '';
    var shown = 0;
    data.forEach(function(entry){
      if (!q || String(entry.search || '').indexOf(q) !== -1) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'dropdown-item d-flex justify-content-between align-items-center';
        button.textContent = entry.label;
        button.addEventListener('click', function(){
          hidden.value = String(entry.id == null ? '' : entry.id);
          updateLabel();
          search.value = '';
          render();
        });
        list.appendChild(button);
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

  hidden.value = String(selectedId != null && selectedId !== '' ? selectedId : (hidden.value || allValue || ''));
  updateLabel();
  render();
  search.addEventListener('input', render);
  boxEl.addEventListener('shown.bs.dropdown', function(){
    window.setTimeout(function(){
      search.focus();
      search.select();
    }, 0);
  });
}

document.addEventListener('DOMContentLoaded', function(){
  var movementClientItems = Array.isArray(posCronologiaConfig.movementClientItems) ? posCronologiaConfig.movementClientItems : [];
  if (Array.isArray(movementClientItems)) {
    movementClientItems = movementClientItems.map(function(entry){
      entry.search = posMovComboboxNorm(entry.label);
      return entry;
    });
  }

  var clientBox = document.getElementById('posMovementClientFilterBox');
  if (clientBox) {
    var hidden = clientBox.querySelector('input[type=hidden]');
    initPosMovCombobox(clientBox, movementClientItems, hidden ? hidden.value : '0', '0', 'Tutti');
  }
});
})();
