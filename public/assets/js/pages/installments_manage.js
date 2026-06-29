(function(){
  function readJsonConfig(id){
    const el = document.getElementById(id);
    if(!el) return {};
    try{
      const parsed = JSON.parse(el.textContent || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    }catch(e){
      return {};
    }
  }

  function norm(s){
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function initCombobox(boxEl, items, selectedId, allValue, allLabel){
    if(!boxEl) return;
    const toggle = boxEl.querySelector('.app-combobox-toggle');
    const hidden = boxEl.querySelector('input[type="hidden"]');
    const search = boxEl.querySelector('.app-combobox-search');
    const list = boxEl.querySelector('.app-combobox-list');
    const textEl = boxEl.querySelector('.app-combobox-text');
    const placeholderEl = boxEl.querySelector('.app-combobox-placeholder');
    if(!toggle || !hidden || !search || !list || !textEl || !placeholderEl) return;

    const data = [{ id: String(allValue), label: String(allLabel) }].concat(items || []);

    function updateLabel(){
      const id = String(hidden.value || '');
      const current = data.find(item => String(item.id) === id);
      if(current && id !== String(allValue)){
        textEl.textContent = current.label;
        textEl.classList.remove('d-none');
        placeholderEl.classList.add('d-none');
      }else{
        textEl.textContent = '';
        textEl.classList.add('d-none');
        placeholderEl.textContent = allLabel;
        placeholderEl.classList.remove('d-none');
      }
    }

    function render(){
      const q = norm(search.value);
      list.innerHTML = '';
      let shown = 0;
      data.forEach(item => {
        const haystack = norm(item.label);
        if(!q || haystack.indexOf(q) !== -1){
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'dropdown-item';
          btn.textContent = item.label;
          btn.addEventListener('click', function(){
            hidden.value = String(item.id);
            updateLabel();
            search.value = '';
            render();
            try{
              if(window.bootstrap && window.bootstrap.Dropdown){
                window.bootstrap.Dropdown.getOrCreateInstance(toggle).hide();
              }
            }catch(e){}
          });
          list.appendChild(btn);
          shown++;
        }
      });
      if(shown === 0){
        const empty = document.createElement('div');
        empty.className = 'text-muted small px-2 py-1';
        empty.textContent = 'Nessun risultato';
        list.appendChild(empty);
      }
    }

    hidden.value = String(selectedId != null && selectedId !== '' ? selectedId : allValue);
    updateLabel();
    render();

    boxEl.addEventListener('shown.bs.dropdown', function(){
      search.value = '';
      render();
      try{ search.focus(); }catch(e){}
    });
    search.addEventListener('input', render);
    search.addEventListener('keydown', function(e){
      if(e.key === 'Enter'){
        e.preventDefault();
        const first = list.querySelector('.dropdown-item');
        if(first) first.click();
      }
    });
  }

  const pageConfig = readJsonConfig('installmentsManagePageConfig');
  const clientItems = Array.isArray(pageConfig.clientItems) ? pageConfig.clientItems : [];
  initCombobox(
    document.getElementById('installmentsClientFilterBox'),
    clientItems,
    String(pageConfig.selectedClientId || '0'),
    '0',
    'Tutti'
  );

  document.querySelectorAll('.js-plan-row[data-href]').forEach(function(row){
    const go = function(){
      const href = row.getAttribute('data-href');
      if(href) window.location.href = href;
    };
    row.addEventListener('click', function(e){
      if(e.target.closest('a, button, input, select, textarea, label, form')) return;
      go();
    });
    row.addEventListener('keydown', function(e){
      if(e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        go();
      }
    });
  });
})();
