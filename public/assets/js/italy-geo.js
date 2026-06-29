/*
  Italy geo selector (Regione -> Provincia -> Città) with searchable dropdown lists.

  UX requirements:
  - Regione / Provincia / Città are selectable ONLY from a list.
  - Each dropdown includes a search field.
  - Provincia is enabled only after selecting a valid Regione.
  - Città is enabled only after selecting a valid Provincia.

  Markup expected (inside the same .row):
    .js-it-region-box   contains input[type=hidden].js-it-region
    .js-it-province-box contains input[type=hidden].js-it-province
    .js-it-city-box     contains input[type=hidden].js-it-city

  Data file: /assets/data/italy_geo.json
*/

(function () {
  'use strict';

  function norm(s) {
    return String(s || '').trim().toLowerCase();
  }

  function getBootstrapDropdown(toggleBtn) {
    try {
      if (toggleBtn && window.bootstrap && window.bootstrap.Dropdown) {
        return window.bootstrap.Dropdown.getOrCreateInstance(toggleBtn, { autoClose: true });
      }
    } catch (e) {}
    return null;
  }

  function closeDropdown(toggleBtn) {
    if (!toggleBtn) return;

    // Prefer Bootstrap Dropdown if present, but ALWAYS fallback to manual
    // if Bootstrap fails (e.g. Popper issues / embedding inside overflow contexts).
    const dd = getBootstrapDropdown(toggleBtn);
    if (dd) {
      try {
        dd.hide();
      } catch (e) {
        // ignore and fallback below
      }

      // If Bootstrap actually hid it, we're done.
      const r0 = toggleBtn.closest('.app-combobox');
      const m0 = r0 ? r0.querySelector('.dropdown-menu') : null;
      if (m0 && !m0.classList.contains('show')) {
        return;
      }
    }

    // Fallback: toggle classes manually
    const root = toggleBtn.closest('.app-combobox');
    const menu = root ? root.querySelector('.dropdown-menu') : null;

    if (menu) menu.classList.remove('show');
    if (root) root.classList.remove('show');
    toggleBtn.classList.remove('show');
    toggleBtn.setAttribute('aria-expanded', 'false');
  }

  function openDropdown(toggleBtn) {
    if (!toggleBtn) return;

    // Close other open comboboxes (fallback & bootstrap-safe)
    document.querySelectorAll('.app-combobox .dropdown-menu.show').forEach(function (m) {
      const r = m.closest('.app-combobox');
      const t = r ? r.querySelector('.app-combobox-toggle') : null;
      if (t && t !== toggleBtn) closeDropdown(t);
    });

    const dd = getBootstrapDropdown(toggleBtn);
    if (dd) {
      try {
        dd.toggle();
      } catch (e) {
        try { dd.show(); } catch (e2) {}
      }

      // If Bootstrap successfully opened it, stop here.
      const r0 = toggleBtn.closest('.app-combobox');
      const m0 = r0 ? r0.querySelector('.dropdown-menu') : null;
      if (m0 && m0.classList.contains('show')) {
        return;
      }
      // Otherwise: fallback to manual open below.
    }

    const root = toggleBtn.closest('.app-combobox');
    const menu = root ? root.querySelector('.dropdown-menu') : null;
    if (!root || !menu) return;

    const isShown = menu.classList.contains('show');
    if (isShown) {
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

  function createCombo(boxEl, opts) {
    const toggle = boxEl.querySelector('.app-combobox-toggle');
    const clearBtn = boxEl.querySelector('.app-combobox-clear'); // optional (we removed it in UI)
    const hidden = boxEl.querySelector('input[type="hidden"]');
    const search = boxEl.querySelector('.app-combobox-search');
    const list = boxEl.querySelector('.app-combobox-list');
    const textEl = toggle ? toggle.querySelector('.app-combobox-text') : null;
    const placeholderEl = toggle ? toggle.querySelector('.app-combobox-placeholder') : null;

    if (!toggle || !hidden || !search || !list || !textEl || !placeholderEl) return null;

    let items = [];

    function setPlaceholder(t) {
      if (t != null) placeholderEl.textContent = String(t);
    }

    function setEnabled(enabled, placeholder) {
      toggle.disabled = !enabled;

      // Keep placeholder in sync when switching enabled/disabled states
      if (placeholder != null) setPlaceholder(placeholder);

      if (!enabled) {
        toggle.classList.add('bg-light');
      } else {
        toggle.classList.remove('bg-light');
      }

      if (clearBtn) clearBtn.disabled = !enabled || !String(hidden.value || '').trim();
    }

    function setValue(v, silent) {
      const val = String(v || '').trim();
      hidden.value = val;

      if (val) {
        textEl.textContent = val;
        // Support both strategies:
        // - some pages hide/show using inline styles (preferred)
        // - other pages (legacy) hide/show using Bootstrap utility classes (d-none)
        //   so we toggle both to avoid "selected value appears blank" bugs.
        textEl.classList.remove('d-none');
        placeholderEl.classList.add('d-none');
        textEl.style.display = '';
        placeholderEl.style.display = 'none';
        if (clearBtn) clearBtn.disabled = toggle.disabled;
      } else {
        textEl.textContent = '';
        textEl.classList.add('d-none');
        placeholderEl.classList.remove('d-none');
        textEl.style.display = 'none';
        placeholderEl.style.display = '';
        if (clearBtn) clearBtn.disabled = true;
      }

      if (!silent && opts && typeof opts.onValue === 'function') {
        opts.onValue(val);
      }
    }

    function getValue() {
      return String(hidden.value || '').trim();
    }

    function setItems(arr) {
      items = Array.isArray(arr) ? arr.slice() : [];
      render();
    }

    function render() {
      const q = norm(search.value);
      const out = [];
      const MAX = 300;

      for (const it of items) {
        if (!q || norm(it).includes(q)) {
          out.push(it);
          if (out.length >= MAX) break;
        }
      }

      list.innerHTML = '';
      if (!out.length) {
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
        if (current && it === current) btn.classList.add('active');
        btn.textContent = it;
        btn.addEventListener('click', function () {
          setValue(it, false);
          closeDropdown(toggle);
        });
        list.appendChild(btn);
      });
    }

    function focusSearch() {
      try {
        search.focus();
        search.select();
      } catch (e) {}
    }

    function refreshAndFocus() {
      search.value = '';
      render();
      focusSearch();
    }

    // If Bootstrap dropdown is used, this event fires automatically.
    boxEl.addEventListener('shown.bs.dropdown', function () {
      if (toggle.disabled) return;
      refreshAndFocus();
    });

    // Always manage open ourselves (works with or without Bootstrap JS)
    toggle.addEventListener('click', function (e) {
      if (toggle.disabled) return;
      e.preventDefault();
      e.stopPropagation(); // prevent Bootstrap delegated handler from double-toggling
      openDropdown(toggle);
      setTimeout(refreshAndFocus, 0);
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (clearBtn.disabled) return;
        setValue('', false);
      });
    }

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

    // Initial paint from hidden value (silent)
    setValue(getValue(), true);

    return {
      el: boxEl,
      toggle,
      hidden,
      setItems,
      setEnabled,
      setPlaceholder,
      setValue,
      getValue,
    };
  }

  const scriptEl = document.currentScript || document.getElementById('italyGeoScript');
  const base = (scriptEl && scriptEl.getAttribute('data-base'))
    ? String(scriptEl.getAttribute('data-base')).replace(/\/$/, '')
    : '';
  const DATA_URL = base ? base + '/assets/data/italy_geo.json' : 'assets/data/italy_geo.json';

  const regionBoxes = Array.from(document.querySelectorAll('.js-it-region-box'));
  if (!regionBoxes.length) return;

  // Build combos immediately so the dropdown opens even if geo data is still loading
  // or if Bootstrap JS is not available.
  const instances = [];
  regionBoxes.forEach((regionBox) => {
    const row = regionBox.closest('.row') || document;
    const provinceBox = row.querySelector('.js-it-province-box');
    const cityBox = row.querySelector('.js-it-city-box');
    if (!provinceBox || !cityBox) return;

    let onRegionValue = function () {};
    let onProvinceValue = function () {};
    let onCityValue = function () {};

    const regionCombo = createCombo(regionBox, { onValue: (val) => onRegionValue(val) });
    const provinceCombo = createCombo(provinceBox, { onValue: (val) => onProvinceValue(val) });
    const cityCombo = createCombo(cityBox, { onValue: (val) => onCityValue(val) });
    if (!regionCombo || !provinceCombo || !cityCombo) return;

    // While loading, keep any prefilled values visible but disable dependent fields.
    regionCombo.setItems([]);
    regionCombo.setEnabled(true, 'Seleziona una regione…');
    provinceCombo.setItems([]);
    provinceCombo.setEnabled(false, 'Seleziona prima la regione…');
    cityCombo.setItems([]);
    cityCombo.setEnabled(false, 'Seleziona prima la provincia…');

    instances.push({
      regionCombo,
      provinceCombo,
      cityCombo,
      row,
      setOnRegion: (fn) => (onRegionValue = fn),
      setOnProvince: (fn) => (onProvinceValue = fn),
      setOnCity: (fn) => (onCityValue = fn),
    });
  });
  if (!instances.length) return;

  fetch(DATA_URL, { cache: 'force-cache' })
    .then((r) => r.json())
    .then((geo) => {
      if (!geo || !geo.regions || !geo.provincesByRegion || !geo.citiesByProvince) return;

      // Indexes for case-insensitive matching.
      const regionIndex = {};
      (geo.regions || []).forEach((name) => (regionIndex[norm(name)] = name));

      const provinceIndex = {};
      Object.keys(geo.provincesByRegion || {}).forEach((rname) => {
        const idx = {};
        (geo.provincesByRegion[rname] || []).forEach((pname) => (idx[norm(pname)] = pname));
        provinceIndex[rname] = idx;
      });

      const cityIndex = {};
      Object.keys(geo.citiesByProvince || {}).forEach((pname) => {
        const idx = {};
        (geo.citiesByProvince[pname] || []).forEach((cname) => (idx[norm(cname)] = cname));
        cityIndex[pname] = idx;
      });

      // Map province -> region (useful for restoring legacy records that stored only province/city)
      const provinceToRegion = {};
      Object.keys(geo.provincesByRegion || {}).forEach((rname) => {
        (geo.provincesByRegion[rname] || []).forEach((pname) => {
          provinceToRegion[norm(pname)] = rname;
        });
      });

      function inferRegionFromProvince(val) {
        const r = provinceToRegion[norm(val)];
        return r ? (canonicalRegion(r) || r) : null;
      }

      function canonicalRegion(val) {
        return regionIndex[norm(val)] || null;
      }
      function canonicalProvince(regionName, val) {
        if (!regionName) return null;
        const idx = provinceIndex[regionName];
        if (!idx) return null;
        return idx[norm(val)] || null;
      }
      function canonicalCity(provinceName, val) {
        if (!provinceName) return null;
        const idx = cityIndex[provinceName];
        if (!idx) return null;
        return idx[norm(val)] || null;
      }

      instances.forEach((inst) => {
        const state = { region: null, province: null };
        let isRestoring = true;

        const regionCombo = inst.regionCombo;
        const provinceCombo = inst.provinceCombo;
        const cityCombo = inst.cityCombo;

        // Allow programmatic updates (e.g. prefill from client record)
        regionCombo.hidden.addEventListener('change', function () {
          applyRegion(regionCombo.getValue());
        });
        provinceCombo.hidden.addEventListener('change', function () {
          applyProvince(provinceCombo.getValue());
        });
        cityCombo.hidden.addEventListener('change', function () {
          applyCity(cityCombo.getValue());
        });

        function disableProvince(preserve) {
          provinceCombo.setItems([]);
          provinceCombo.setEnabled(false, 'Seleziona prima la regione…');
          if (!preserve) provinceCombo.setValue('', true);
        }

        function disableCity(preserve) {
          cityCombo.setItems([]);
          cityCombo.setEnabled(false, 'Seleziona prima la provincia…');
          if (!preserve) cityCombo.setValue('', true);
        }

        function enableProvince(regionName) {
          provinceCombo.setItems(geo.provincesByRegion[regionName] || []);
          provinceCombo.setEnabled(true, 'Seleziona una provincia…');
        }

        function enableCity(provinceName) {
          cityCombo.setItems(geo.citiesByProvince[provinceName] || []);
          cityCombo.setEnabled(true, 'Seleziona una città…');
        }

        function applyRegion(val) {
          const r = canonicalRegion(val);

          if (!r) {
            state.region = null;
            state.province = null;
            regionCombo.setValue('', true);
            disableProvince();
            disableCity();
            return;
          }

          // Canonicalize
          regionCombo.setValue(r, true);

          // If region changed, reset province + city
          if (state.region !== r) {
            state.region = r;
            state.province = null;
            provinceCombo.setValue('', true);
            cityCombo.setValue('', true);
          }

          enableProvince(r);

          // Province might already be set (edit): re-validate it
          const p0 = canonicalProvince(r, provinceCombo.getValue());
          if (p0) {
            applyProvince(p0);
          } else {
            state.province = null;
            provinceCombo.setValue('', true);
            disableCity();
          }
        }

        function applyProvince(val) {
          if (!state.region) {
            provinceCombo.setValue('', true);
            disableCity();
            return;
          }

          const p = canonicalProvince(state.region, val);
          if (!p) {
            state.province = null;
            provinceCombo.setValue('', true);
            disableCity();
            return;
          }

          provinceCombo.setValue(p, true);

          // If province changed, reset city
          if (state.province !== p) {
            state.province = p;
            cityCombo.setValue('', true);
          }

          enableCity(p);

          const c0 = canonicalCity(p, cityCombo.getValue());
          if (c0) applyCity(c0);
          else if (!isRestoring) cityCombo.setValue('', true);
        }

        function applyCity(val) {
          if (!state.province) {
            cityCombo.setValue('', true);
            return;
          }

          const c = canonicalCity(state.province, val);
          if (!c) {
            cityCombo.setValue('', true);
            return;
          }

          cityCombo.setValue(c, true);
        }

        // Wire callbacks now that geo data is available
        inst.setOnRegion(applyRegion);
        inst.setOnProvince(applyProvince);
        inst.setOnCity(applyCity);

        // Init lists
        regionCombo.setItems(geo.regions || []);
        regionCombo.setEnabled(true, 'Seleziona una regione…');
        // Keep any prefilled legacy values until we can validate them
        disableProvince(true);
        disableCity(true);

        // Restore prefilled values (edit / legacy)
        let r0 = canonicalRegion(regionCombo.getValue());
        if (!r0) {
          // If region is missing but province is present (legacy records), try to infer region from province
          const inferred = inferRegionFromProvince(provinceCombo.getValue());
          if (inferred) r0 = inferred;
        }

        if (r0) {
          regionCombo.setValue(r0, true);
          state.region = r0;
          enableProvince(r0);

          const p0 = canonicalProvince(r0, provinceCombo.getValue());
          if (p0) {
            provinceCombo.setValue(p0, true);
            state.province = p0;
            enableCity(p0);

            const c0 = canonicalCity(p0, cityCombo.getValue());
            if (c0) cityCombo.setValue(c0, true);
          } else {
            // Province not valid for this region: keep legacy value visible, but let user choose
            disableCity(true);
          }
        } else {
          // No region selected and we can't infer it: keep legacy province/city values visible (no data loss)
          regionCombo.setValue('', true);
          disableProvince(true);
          disableCity(true);
        }

        // End of restore stage: after this point invalid selections will be cleared normally
        isRestoring = false;
      });
    })
    .catch((err) => {
      console.warn('[italy-geo] geo data not loaded', err);
    });
})();
