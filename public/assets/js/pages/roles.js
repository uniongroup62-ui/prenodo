(function(){
  const form = document.querySelector('form[method="post"]');
  if (!form) return;
  const cssEscape = (window.CSS && typeof window.CSS.escape === 'function')
    ? window.CSS.escape
    : function(value){ return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"'); };
  const inputs = Array.from(form.querySelectorAll('[data-role-perm-input]'));
  const inputsByPerm = new Map();
  const childrenByParent = new Map();
  const autoChildrenByParent = new Map();

  function splitPerms(raw){
    return String(raw || '').split(',').map(function(v){ return v.trim(); }).filter(Boolean);
  }

  inputs.forEach(function(input){
    const perm = String(input.dataset.perm || '');
    if (!perm) return;
    inputsByPerm.set(perm, input);
    input.dataset.directSelected = input.dataset.direct === '1' ? '1' : '0';
    splitPerms(input.dataset.parentPerms).forEach(function(parentPerm){
      if (!childrenByParent.has(parentPerm)) childrenByParent.set(parentPerm, []);
      childrenByParent.get(parentPerm).push(perm);
    });
    splitPerms(input.dataset.autoParentPerms).forEach(function(parentPerm){
      if (!autoChildrenByParent.has(parentPerm)) autoChildrenByParent.set(parentPerm, []);
      autoChildrenByParent.get(parentPerm).push(perm);
    });
  });

  function inputByPerm(perm){
    return inputsByPerm.get(String(perm)) || form.querySelector('[data-role-perm-input][data-perm="' + cssEscape(String(perm)) + '"]');
  }

  function moduleChildren(rootInput){
    const raw = String(rootInput && rootInput.dataset.moduleChildren || '');
    return raw.split(',').map(function(v){ return v.trim(); }).filter(Boolean);
  }

  function syncModule(rootInput){
    if (!rootInput) return;
    const childInputs = moduleChildren(rootInput).map(inputByPerm).filter(Boolean);
    const checkedChildren = childInputs.filter(function(childInput){
      return childInput.checked;
    }).length;

    rootInput.checked = checkedChildren > 0;
  }

  function setInheritedState(input, inherited){
    input.dataset.inherited = inherited ? '1' : '0';
    const node = input.closest('[data-role-perm-node]');
    const badge = node ? node.querySelector('[data-inherited-badge]') : null;
    if (badge) badge.classList.toggle('d-none', !inherited);
  }

  const roots = Array.from(form.querySelectorAll('[data-module-root-input="1"]'));

  function syncAutoEnabledParents(){
    autoChildrenByParent.forEach(function(childPerms, parentPerm){
      const parentInput = inputByPerm(parentPerm);
      if (!parentInput || parentInput.dataset.moduleRootInput === '1') return;
      const hasSelectedChild = childPerms.map(inputByPerm).filter(Boolean).some(function(childInput){
        return childInput.checked;
      });
      if (!hasSelectedChild) return;
      parentInput.dataset.directSelected = '1';
      parentInput.checked = true;
      parentInput.disabled = false;
    });
  }

  function syncInheritedChildren(){
    const granted = new Set();
    const inherited = new Set();

    inputs.forEach(function(input){
      if (input.dataset.moduleRootInput === '1') return;
      const perm = String(input.dataset.perm || '');
      if (!perm) return;
      const direct = input.dataset.directSelected === '1';
      input.disabled = false;
      input.checked = direct;
      setInheritedState(input, false);
    });

    syncAutoEnabledParents();

    inputs.forEach(function(input){
      if (input.dataset.moduleRootInput === '1') return;
      const perm = String(input.dataset.perm || '');
      if (!perm) return;
      if (input.checked) granted.add(perm);
    });

    let changed = true;
    while (changed) {
      changed = false;
      Array.from(granted).forEach(function(parentPerm){
        (childrenByParent.get(parentPerm) || []).forEach(function(childPerm){
          inherited.add(childPerm);
          if (!granted.has(childPerm)) {
            granted.add(childPerm);
            changed = true;
          }
        });
      });
    }

    inputs.forEach(function(input){
      if (input.dataset.moduleRootInput === '1') return;
      const perm = String(input.dataset.perm || '');
      if (!perm) return;
      const isInherited = inherited.has(perm);
      if (isInherited) {
        input.checked = true;
        input.disabled = true;
      } else {
        input.checked = input.dataset.directSelected === '1';
        input.disabled = false;
      }
      setInheritedState(input, isInherited);
    });

    roots.forEach(syncModule);
  }

  inputs.forEach(function(input){
    if (input.dataset.moduleRootInput === '1') return;
    input.addEventListener('change', function(){
      if (input.disabled) return;
      input.dataset.directSelected = input.checked ? '1' : '0';
      syncInheritedChildren();
    });
  });

  roots.forEach(function(rootInput){
    const childInputs = moduleChildren(rootInput).map(inputByPerm).filter(Boolean);
    if (childInputs.some(function(childInput){ return childInput.checked; })) {
      rootInput.checked = true;
    }

    childInputs.forEach(function(childInput){
      childInput.addEventListener('change', function(){
        syncModule(rootInput);
      });
    });

    syncModule(rootInput);
  });

  syncInheritedChildren();
})();
