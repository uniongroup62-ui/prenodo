(function () {
  function fieldName(el) {
    if (el.dataset && el.dataset.name) return el.dataset.name;
    var match = (el.name || '').match(/\[\d+\]\[([^\]]+)\]$/);
    if (match) {
      el.dataset.name = match[1];
      return match[1];
    }
    return '';
  }

  function renameRows(list, prefix) {
    if (!list) return;
    Array.prototype.forEach.call(list.children, function (row, index) {
      Array.prototype.forEach.call(row.querySelectorAll('input, select, textarea'), function (el) {
        var name = fieldName(el);
        if (!name) return;
        el.name = prefix + '[' + index + '][' + name + ']';
      });
    });
  }

  function resetRow(row) {
    Array.prototype.forEach.call(row.querySelectorAll('input, textarea, select'), function (el) {
      if (el.tagName === 'SELECT') {
        el.selectedIndex = 0;
      } else if (el.type === 'number' && el.dataset.name === 'duration_min') {
        el.value = '60';
      } else if (el.dataset.name === 'price') {
        el.value = '0';
      } else {
        el.value = '';
      }
    });
  }

  function wireDynamicList(options) {
    var list = document.getElementById(options.listId);
    var button = document.getElementById(options.buttonId);
    var template = document.getElementById(options.templateId);
    if (!list || !button || !template) return;

    button.addEventListener('click', function () {
      var row = template.content.firstElementChild.cloneNode(true);
      resetRow(row);
      list.appendChild(row);
      renameRows(list, options.prefix);
      var first = row.querySelector('input, select, textarea');
      if (first) first.focus();
    });

    list.addEventListener('click', function (event) {
      var remove = event.target.closest('.js-remove-row');
      if (!remove) return;
      if (list.children.length <= 1) {
        resetRow(list.children[0]);
        renameRows(list, options.prefix);
        return;
      }
      remove.closest('.dynamic-row').remove();
      renameRows(list, options.prefix);
    });

    renameRows(list, options.prefix);
  }

  function wireSoloToggle() {
    var toggle = document.getElementById('soloToggle');
    var list = document.getElementById('operatorsList');
    var addButton = document.getElementById('addOperatorBtn');
    if (!toggle || !list) return;

    function sync() {
      var disabled = toggle.checked;
      Array.prototype.forEach.call(list.querySelectorAll('input, select, button'), function (el) {
        el.disabled = disabled;
      });
      if (addButton) addButton.disabled = disabled;
      list.classList.toggle('d-none', disabled);
      if (addButton) addButton.classList.toggle('d-none', disabled);
    }

    toggle.addEventListener('change', sync);
    sync();
  }

  function wireHours() {
    Array.prototype.forEach.call(document.querySelectorAll('.hours-row'), function (row) {
      var checkbox = row.querySelector('.js-hour-closed');
      if (!checkbox) return;
      var splitRow = row.querySelector('.hours-split-row');
      var addSplit = row.querySelector('.js-add-hour-split');
      var removeSplit = row.querySelector('.js-remove-hour-split');
      var inputs = Array.prototype.filter.call(row.querySelectorAll('input[type="time"]'), function (input) {
        return input.type === 'time';
      });
      var splitInputs = splitRow ? Array.prototype.filter.call(splitRow.querySelectorAll('input[type="time"]'), function (input) {
        return input.type === 'time';
      }) : [];

      function hasSplitValues() {
        return splitInputs.some(function (input) {
          return String(input.value || '').trim() !== '';
        });
      }

      function resetTimes() {
        inputs.forEach(function (input) {
          input.value = '';
        });
      }

      function setSplit(active, clear) {
        if (!splitRow) return;
        var isClosed = checkbox.checked;
        if (isClosed) active = false;

        splitRow.classList.toggle('d-none', !active);
        if (addSplit) addSplit.classList.toggle('d-none', active || isClosed);
        if (removeSplit) removeSplit.classList.toggle('d-none', !active || isClosed);

        if (clear) {
          splitInputs.forEach(function (input) {
            input.value = '';
          });
        }

        if (active && splitInputs[0]) {
          setTimeout(function () {
            try { splitInputs[0].focus(); } catch (e) {}
          }, 0);
        }
      }

      function sync() {
        inputs.forEach(function (input) {
          input.disabled = checkbox.checked;
        });
        if (checkbox.checked) {
          setSplit(false, false);
        } else if (splitRow) {
          setSplit(!splitRow.classList.contains('d-none') || hasSplitValues(), false);
        }
      }

      if (addSplit) {
        addSplit.addEventListener('click', function () {
          setSplit(true, false);
          sync();
        });
      }
      if (removeSplit) {
        removeSplit.addEventListener('click', function () {
          if (!confirm("Rimuovere l'orario spezzato per questo giorno?")) return;
          setSplit(false, true);
          sync();
        });
      }
      checkbox.addEventListener('change', function () {
        if (checkbox.checked) resetTimes();
        sync();
      });
      sync();
    });
  }

  function wireActivityCategories() {
    var cards = Array.prototype.slice.call(document.querySelectorAll('[data-onboarding-activity-card]'));
    var primaryInput = document.getElementById('onboardingPrimaryActivityCategoryId');
    var orderInput = document.getElementById('onboardingActivityCategoryOrder');
    var form = document.getElementById('onboardingForm');
    var activitySelectionOrder = [];
    if (!cards.length) return;

    function asId(value) {
      var id = parseInt(String(value || '0'), 10);
      return Number.isFinite(id) ? id : 0;
    }

    function checkedIdsFromDom() {
      return cards.map(function (card) {
        var checkbox = card.querySelector('[data-onboarding-activity-checkbox]');
        return checkbox && checkbox.checked ? asId(checkbox.value) : 0;
      }).filter(function (id) {
        return id > 0;
      });
    }

    function selectedIds() {
      var checked = checkedIdsFromDom();
      var checkedSet = {};
      checked.forEach(function (id) {
        checkedSet[id] = true;
      });
      activitySelectionOrder = activitySelectionOrder.filter(function (id) {
        return !!checkedSet[id];
      });
      checked.forEach(function (id) {
        if (activitySelectionOrder.indexOf(id) === -1) activitySelectionOrder.push(id);
      });
      return activitySelectionOrder.slice();
    }

    function sync() {
      var selected = selectedIds();
      var primaryId = primaryInput ? asId(primaryInput.value) : 0;
      if (selected.length > 0 && selected.indexOf(primaryId) === -1) primaryId = selected[0];
      if (selected.length === 0) primaryId = 0;
      if (primaryInput) primaryInput.value = primaryId > 0 ? String(primaryId) : '0';

      cards.forEach(function (card) {
        var checkbox = card.querySelector('[data-onboarding-activity-checkbox]');
        var badge = card.querySelector('[data-onboarding-activity-badge]');
        var id = checkbox ? asId(checkbox.value) : 0;
        var checked = !!(checkbox && checkbox.checked);
        card.classList.toggle('is-selected', checked);
        if (!badge) return;
        if (!checked) {
          badge.textContent = '';
        } else if (id === primaryId) {
          badge.textContent = 'Principale';
        } else {
          var position = selected.indexOf(id) + 1;
          badge.textContent = position > 0 ? String(position) : '';
        }
      });
      if (orderInput) orderInput.value = selected.join(',');
    }

    if (orderInput && orderInput.value) {
      activitySelectionOrder = String(orderInput.value).split(/[,\s]+/).map(asId).filter(function (id, index, list) {
        return id > 0 && list.indexOf(id) === index;
      });
    }

    cards.forEach(function (card) {
      var checkbox = card.querySelector('[data-onboarding-activity-checkbox]');
      if (!checkbox) return;
      checkbox.addEventListener('change', function () {
        var selected = selectedIds();
        if (selected.length > 5) {
          var id = asId(checkbox.value);
          checkbox.checked = false;
          activitySelectionOrder = activitySelectionOrder.filter(function (selectedId) {
            return selectedId !== id;
          });
          alert('Puoi selezionare al massimo 5 categorie.');
        } else if (checkbox.checked && primaryInput && asId(primaryInput.value) <= 0) {
          primaryInput.value = String(asId(checkbox.value));
        }
        sync();
      });
      card.addEventListener('dblclick', function (event) {
        event.preventDefault();
        if (!checkbox.checked) {
          if (selectedIds().length >= 5) {
            alert('Puoi selezionare al massimo 5 categorie.');
            return;
          }
          checkbox.checked = true;
          var id = asId(checkbox.value);
          if (id > 0 && activitySelectionOrder.indexOf(id) === -1) activitySelectionOrder.push(id);
        }
        if (primaryInput) primaryInput.value = String(asId(checkbox.value));
        sync();
      });
    });

    if (form) {
      form.addEventListener('submit', function (event) {
        var selected = selectedIds();
        if (orderInput) orderInput.value = selected.join(',');
        if (selected.length === 0) {
          event.preventDefault();
          alert('Seleziona almeno una categoria attivita.');
        }
      });
    }

    sync();
  }

  wireDynamicList({
    listId: 'operatorsList',
    buttonId: 'addOperatorBtn',
    templateId: 'operatorTemplate',
    prefix: 'operators'
  });
  wireDynamicList({
    listId: 'cabinsList',
    buttonId: 'addCabinBtn',
    templateId: 'cabinTemplate',
    prefix: 'cabins'
  });
  wireDynamicList({
    listId: 'serviceCategoriesList',
    buttonId: 'addServiceCategoryBtn',
    templateId: 'serviceCategoryTemplate',
    prefix: 'service_categories'
  });
  wireDynamicList({
    listId: 'servicesList',
    buttonId: 'addServiceBtn',
    templateId: 'serviceTemplate',
    prefix: 'services'
  });
  wireSoloToggle();
  wireHours();
  wireActivityCategories();
})();
