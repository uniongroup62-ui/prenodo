(function () {
  'use strict';

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
      return;
    }
    callback();
  }

  function initBookingPackages() {
    var list = document.getElementById('myPackList');
    if (!list) return;

    var empty = document.getElementById('myPackEmpty');
    var loading = document.getElementById('myPackLoading');
    var filterForm = document.getElementById('myPackFilterForm');
    var statusSel = document.getElementById('myPackStatusFilter');
    var dateFromInput = document.getElementById('myPackDateFrom');
    var dateToInput = document.getElementById('myPackDateTo');
    var resetFiltersBtn = document.getElementById('myPackResetFilters');
    var sortInput = document.getElementById('myPackSortInput');
    var sortControl = document.getElementById('myPackSortControl');
    var sortButton = document.getElementById('myPackSortButton');
    var sortOptions = Array.from(document.querySelectorAll('#myPackSortMenu .appt-sort-option[data-sort]'));
    var pager = document.getElementById('myPackPager');
    var btnPrev = document.getElementById('myPackPrev');
    var btnNext = document.getElementById('myPackNext');
    var pageInfo = document.getElementById('myPackPageInfo');
    var alertBox = document.getElementById('myPackAlert');
    var baseUrl = list.getAttribute('data-packs-base') || '';
    var embedParam = list.getAttribute('data-packs-embed-param') || '';
    var perPage = 6;
    var page = 1;
    var totalPages = 1;
    var packSort = 'desc';
    var allPacks = [];

    function esc(value) {
      return String(value || '').replace(/[&<>"']/g, function (match) {
        return {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#039;'
        }[match];
      });
    }

    function fmtDate(iso) {
      var value = String(iso || '');
      var date;
      if (!value) return '';
      date = new Date(value.length === 10 ? (value + 'T00:00:00') : value.replace(' ', 'T'));
      if (isNaN(date.getTime())) return value;
      return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    function badgeClass(status) {
      status = String(status || '').toLowerCase();
      if (status === 'active') return 'is-active';
      if (status === 'completed') return 'is-completed';
      if (status === 'expired') return 'is-expired';
      if (status === 'canceled') return 'is-canceled';
      return 'is-completed';
    }

    function packageBookUrl(pkg, service) {
      var directUrl = String((service && (service.booking_url || service.book_url)) || '').trim();
      var packageId = Number((service && service.client_package_id) || (pkg && (pkg.client_package_id || pkg.id)) || 0);
      var serviceId = Number((service && service.service_id) || 0);
      var parsed;
      var isPackageUrl;
      var hasPackageId;
      var hasServiceId;
      var url;
      var packageServiceId;

      if (directUrl) {
        try {
          parsed = new URL(directUrl, window.location.href);
          isPackageUrl = parsed.searchParams.get('book_package') === '1';
          hasPackageId = Number(parsed.searchParams.get('client_package_id') || 0) > 0;
          hasServiceId = Number(parsed.searchParams.get('service_id') || 0) > 0;
          if (!isPackageUrl || (hasPackageId && hasServiceId)) return directUrl;
        } catch (e) {
          if (!directUrl.includes('book_package=1') || /client_package_id=\d+/.test(directUrl)) return directUrl;
        }
      }
      if (!packageId || !serviceId) return '';
      url = baseUrl + '&start=1'
        + '&service_id=' + encodeURIComponent(String(serviceId))
        + '&book_package=1'
        + '&client_package_id=' + encodeURIComponent(String(packageId));
      packageServiceId = Number((service && service.client_package_service_id) || 0);
      return url + (packageServiceId ? ('&client_package_service_id=' + encodeURIComponent(String(packageServiceId))) : '') + (embedParam || '');
    }

    function showAlert(message) {
      if (!alertBox) return;
      alertBox.textContent = String(message || '');
      alertBox.classList.remove('d-none');
    }

    function hideAlert() {
      if (!alertBox) return;
      alertBox.classList.add('d-none');
    }

    function getStatusKey(pkg) {
      var raw = String((pkg && pkg.status) || '').toLowerCase().trim();
      var label;
      if (raw) return raw;
      label = String((pkg && pkg.status_label) || '').toLowerCase().trim();
      return label;
    }

    function getPackDay(pkg) {
      var raw = String((pkg && (pkg.purchase_date || pkg.start_date || pkg.created_at)) || '').trim();
      var match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
      return match ? match[1] : '';
    }

    function getPackSortTime(pkg) {
      var raw = String((pkg && (pkg.created_at || pkg.purchase_date || pkg.start_date)) || '').trim();
      var time = raw ? new Date(raw.replace(' ', 'T')).getTime() : 0;
      return isNaN(time) ? 0 : time;
    }

    function sortPackItems(items) {
      items.sort(function (a, b) {
        var ta = getPackSortTime(a);
        var tb = getPackSortTime(b);
        var ia = Number((a && a.id) || 0);
        var ib = Number((b && b.id) || 0);
        if (ta !== tb) return packSort === 'asc' ? (ta - tb) : (tb - ta);
        return packSort === 'asc' ? (ia - ib) : (ib - ia);
      });
      return items;
    }

    function closeSortMenu() {
      if (!sortControl) return;
      sortControl.classList.remove('is-open');
      if (sortButton) sortButton.setAttribute('aria-expanded', 'false');
    }

    function updateSortOptions() {
      sortOptions.forEach(function (option) {
        option.classList.toggle('is-active', option.getAttribute('data-sort') === packSort);
      });
      if (sortInput) sortInput.value = packSort;
    }

    function getFilterValues() {
      var from = dateFromInput ? String(dateFromInput.value || '') : '';
      var to = dateToInput ? String(dateToInput.value || '') : '';
      var tmp;
      if (from && to && from > to) {
        tmp = from;
        from = to;
        to = tmp;
      }
      return {
        status: statusSel ? String(statusSel.value || '') : '',
        from: from,
        to: to
      };
    }

    function updateFilterReset() {
      var filters;
      var active;
      if (!resetFiltersBtn) return;
      filters = getFilterValues();
      active = filters.status !== '' || filters.from !== '' || filters.to !== '';
      resetFiltersBtn.classList.toggle('d-none', !active);
    }

    function buildStatusOptions(packs) {
      var map;
      var preferredOrder;
      var items;
      if (!statusSel) return;
      map = new Map();
      (Array.isArray(packs) ? packs : []).forEach(function (pkg) {
        var key = getStatusKey(pkg);
        var label = String((pkg && (pkg.status_label || pkg.status)) || '').trim();
        if (!label) return;
        map.set(key || label.toLowerCase(), label);
      });

      preferredOrder = ['active', 'completed', 'expired', 'canceled'];
      items = Array.from(map.entries()).map(function (entry) {
        return { key: entry[0], label: entry[1] };
      });
      items.sort(function (a, b) {
        var ia = preferredOrder.indexOf(a.key);
        var ib = preferredOrder.indexOf(b.key);
        if (ia !== -1 || ib !== -1) {
          if (ia === -1) return 1;
          if (ib === -1) return -1;
          return ia - ib;
        }
        return a.label.localeCompare(b.label, 'it');
      });

      statusSel.querySelectorAll('option:not(:first-child)').forEach(function (option) {
        option.remove();
      });
      items.forEach(function (item) {
        var option = document.createElement('option');
        option.value = item.key;
        option.textContent = item.label;
        statusSel.appendChild(option);
      });
    }

    function getFiltered() {
      var filters = getFilterValues();
      var items = allPacks.slice();
      if (filters.status) {
        items = items.filter(function (pkg) {
          return getStatusKey(pkg) === filters.status;
        });
      }
      if (filters.from || filters.to) {
        items = items.filter(function (pkg) {
          var day = getPackDay(pkg);
          if (!day) return false;
          if (filters.from && day < filters.from) return false;
          if (filters.to && day > filters.to) return false;
          return true;
        });
      }
      return sortPackItems(items);
    }

    function updatePager(total) {
      if (!pager) return;
      totalPages = Math.max(1, Math.ceil((total || 0) / perPage));
      if ((total || 0) <= perPage) {
        pager.classList.add('d-none');
        return;
      }
      pager.classList.remove('d-none');
      if (pageInfo) pageInfo.textContent = 'Pagina ' + page + ' di ' + totalPages;
      if (btnPrev) btnPrev.disabled = page <= 1;
      if (btnNext) btnNext.disabled = page >= totalPages;
    }

    async function loadPacks() {
      var separator = baseUrl.includes('?') ? '&' : '?';
      var response = await fetch(baseUrl + separator + 'mode=my_packages&_ts=' + encodeURIComponent(String(Date.now())), {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      var payload = await response.json();
      if (!payload || !payload.ok) throw new Error((payload && payload.error) || 'Errore');

      if (payload.schema_ok === false) {
        showAlert('Funzione pacchetti non disponibile su questa installazione.');
      } else {
        hideAlert();
      }

      allPacks = Array.isArray(payload.packages) ? payload.packages : [];
      allPacks.sort(function (a, b) {
        var ta = new Date(String((a && a.created_at) || '').replace(' ', 'T')).getTime();
        var tb = new Date(String((b && b.created_at) || '').replace(' ', 'T')).getTime();
        var ia = Number((a && a.id) || 0);
        var ib = Number((b && b.id) || 0);
        var va = isNaN(ta) ? 0 : ta;
        var vb = isNaN(tb) ? 0 : tb;
        if (vb !== va) return vb - va;
        return ib - ia;
      });
      buildStatusOptions(allPacks);
    }

    function render() {
      var filtered;
      var items;
      updateFilterReset();
      filtered = getFiltered();
      if (page < 1) page = 1;
      totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
      if (page > totalPages) page = totalPages;
      items = filtered.slice((page - 1) * perPage, page * perPage);

      list.innerHTML = '';
      if (empty) empty.classList.add('d-none');
      if (!items.length) {
        if (empty) empty.classList.remove('d-none');
        if (pager) pager.classList.add('d-none');
        return;
      }

      updatePager(filtered.length);
      items.forEach(function (pkg) {
        var rawName = pkg.package_name || '';
        var name = rawName ? esc(rawName) : '&mdash;';
        var serviceName = pkg.service_name ? esc(pkg.service_name) : '';
        var purchase = pkg.purchase_date ? fmtDate(pkg.purchase_date) : '';
        var start = pkg.start_date ? fmtDate(pkg.start_date) : '';
        var expires = pkg.expires_at ? fmtDate(pkg.expires_at) : '';
        var remaining = Number((pkg.sessions_available !== undefined ? pkg.sessions_available : pkg.sessions_remaining) || 0);
        var total = Number(pkg.sessions_total || 0);
        var used = Math.max(0, total - remaining);
        var percent = total > 0 ? Math.max(0, Math.min(100, Math.round((used / total) * 100))) : 0;
        var status = String(pkg.status || '');
        var rawStatusLabel = pkg.status_label || status || '';
        var statusLabel = rawStatusLabel ? esc(rawStatusLabel) : '&mdash;';
        var badge = badgeClass(status);
        var metaParts = [];
        var note = pkg.notes ? esc(pkg.notes) : '';
        var services = Array.isArray(pkg.services) ? pkg.services : [];
        var bookableServices;
        var el;

        if (serviceName) metaParts.push(serviceName);
        if (purchase) metaParts.push('Acquisto: <strong>' + esc(purchase) + '</strong>');
        if (start) metaParts.push('Inizio: <strong>' + esc(start) + '</strong>');
        if (expires) metaParts.push('Scadenza: <strong>' + esc(expires) + '</strong>');

        bookableServices = services
          .filter(function (service) {
            return Number((service && service.service_id) || 0) > 0;
          })
          .map(function (service) {
            var available = Number((service && (service.sessions_available !== undefined ? service.sessions_available : service.sessions_remaining)) || 0);
            var serviceTotal = Number((service && service.sessions_total) || 0);
            var reserved = Number((service && service.sessions_reserved) || 0);
            var canBook = status === 'active' && available > 0;
            var url = canBook ? packageBookUrl(pkg, service) : '';
            var serviceMeta = (available + ' / ' + serviceTotal + ' libere') + (reserved > 0 ? (' - ' + reserved + ' prenotate') : '');
            return ''
              + '<div class="pkg-service-row">'
              + '<div>'
              + '<div class="pkg-service-row__name">' + esc((service && service.service_name) || 'Servizio') + '</div>'
              + '<div class="pkg-service-row__meta">' + esc(serviceMeta) + '</div>'
              + '</div>'
              + (canBook && url ? '<a class="pkg-book" href="' + esc(url) + '"><i class="bi bi-calendar-plus"></i>Prenota</a>' : '')
              + '</div>';
          })
          .join('');

        el = document.createElement('div');
        el.className = 'pkg-item';
        el.innerHTML = ''
          + '<div class="pkg-top">'
          + '<div class="pkg-content">'
          + '<div class="pkg-title">' + name + '</div>'
          + '<div class="pkg-meta">' + (metaParts.length ? metaParts.join(' &bull; ') : '&mdash;') + '</div>'
          + (note ? '<div class="pkg-note"><i class="bi bi-sticky me-1"></i>' + note + '</div>' : '')
          + '</div>'
          + '<div class="pkg-side text-end">'
          + '<span class="pkg-status ' + badge + '">' + statusLabel + '</span>'
          + '</div>'
          + '</div>'
          + '<div class="pkg-progress">'
          + '<div class="pkg-progress__head">'
          + '<span>Servizi utilizzati</span>'
          + '<span>' + esc(used) + ' / ' + esc(total) + '</span>'
          + '</div>'
          + '<div class="pkg-progress__bar"><div class="pkg-progress__fill" style="width:' + percent + '%"></div></div>'
          + '</div>'
          + (bookableServices ? '<div class="pkg-services">' + bookableServices + '</div>' : '');
        list.appendChild(el);
      });
    }

    async function boot() {
      try {
        if (!baseUrl) throw new Error('Endpoint pacchetti non configurato.');
        await loadPacks();

        if (filterForm) {
          filterForm.addEventListener('submit', function (event) {
            event.preventDefault();
            page = 1;
            render();
          });
        }
        if (resetFiltersBtn) {
          resetFiltersBtn.addEventListener('click', function () {
            if (statusSel) statusSel.value = '';
            if (dateFromInput) dateFromInput.value = '';
            if (dateToInput) dateToInput.value = '';
            page = 1;
            render();
          });
        }

        updateSortOptions();
        if (sortButton && sortControl) {
          sortButton.addEventListener('click', function () {
            var open = !sortControl.classList.contains('is-open');
            sortControl.classList.toggle('is-open', open);
            sortButton.setAttribute('aria-expanded', open ? 'true' : 'false');
          });
        }
        sortOptions.forEach(function (option) {
          option.addEventListener('click', function () {
            packSort = option.getAttribute('data-sort') === 'asc' ? 'asc' : 'desc';
            updateSortOptions();
            closeSortMenu();
            page = 1;
            render();
          });
        });
        document.addEventListener('click', function (event) {
          if (!sortControl || sortControl.contains(event.target)) return;
          closeSortMenu();
        });
        document.addEventListener('keydown', function (event) {
          if (event.key === 'Escape') closeSortMenu();
        });
        [statusSel, dateFromInput, dateToInput].forEach(function (el) {
          if (!el) return;
          el.addEventListener('change', updateFilterReset);
          el.addEventListener('input', updateFilterReset);
        });
        if (btnPrev) btnPrev.addEventListener('click', function () {
          if (page > 1) {
            page--;
            render();
          }
        });
        if (btnNext) btnNext.addEventListener('click', function () {
          if (page < totalPages) {
            page++;
            render();
          }
        });

        render();
      } catch (e) {
        if (empty) empty.classList.remove('d-none');
      } finally {
        if (loading) loading.remove();
      }
    }

    boot();
  }

  onReady(initBookingPackages);
})();
