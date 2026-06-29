(function () {
  'use strict';

  var PER_PAGE = 5;

  function ready(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
      return;
    }
    callback();
  }

  function text(value) {
    return value == null ? '' : String(value);
  }

  function parseDate(value) {
    var date = new Date(text(value).replace(' ', 'T'));
    return isNaN(date.getTime()) ? null : date;
  }

  function fmtDateTime(value) {
    var date = parseDate(value);
    if (!date) return text(value);
    return date.toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function dateParts(value) {
    var date = parseDate(value);
    if (!date) return { date: text(value) || '-', time: '-' };
    return {
      date: date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }).replace('.', ''),
      time: date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    };
  }

  function timeOnly(value) {
    var date = parseDate(value);
    if (!date) return '';
    return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }

  function esc(value) {
    return text(value).replace(/[&<>"']/g, function (match) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[match];
    });
  }

  function fmtMoney(value) {
    var amount = Number(value);
    if (!Number.isFinite(amount)) amount = 0;
    return amount.toFixed(2).replace('.', ',');
  }

  function getStatusKey(appt) {
    var raw = text(appt && appt.status).toLowerCase().trim();
    if (raw) return raw;
    return text(appt && appt.status_label).toLowerCase().trim();
  }

  function getStatusGroup(appt) {
    var status = getStatusKey(appt);
    if (['pending', 'in_attesa', 'in attesa', 'waiting'].includes(status)) return 'pending';
    if (['scheduled', 'confirmed', 'confermato', 'confermata', 'approved', 'booked', 'prenotato', 'prenotata'].includes(status)) return 'scheduled';
    if (['canceled', 'cancelled', 'annullato', 'annullata', 'rejected', 'rifiutato', 'rifiutata'].includes(status)) return 'canceled';
    if (['done', 'completed', 'executed', 'eseguito', 'eseguita', 'completato', 'completata'].includes(status)) return 'done';
    return status ? 'other' : '';
  }

  function getApptTime(appt) {
    var date = parseDate(appt && appt.starts_at);
    return date ? date.getTime() : NaN;
  }

  function getApptDay(appt) {
    var match = text(appt && appt.starts_at).trim().match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : '';
  }

  function statusClass(appt) {
    var status = getStatusKey(appt);
    if (['pending', 'in_attesa', 'waiting'].includes(status)) return 'is-wait';
    if (['scheduled', 'confirmed', 'confermato', 'approved'].includes(status)) return 'is-ok';
    if (['canceled', 'cancelled', 'annullato', 'rejected', 'rifiutato'].includes(status)) return 'is-bad';
    return 'is-muted';
  }

  function init() {
    var root = document.getElementById('myAppointmentsApp');
    if (!root) return;

    var scope = root.closest('.customer-appointments') || document;
    var list = document.getElementById('myApptList');
    var empty = document.getElementById('myApptEmpty');
    var loading = document.getElementById('myApptLoading');
    var filterForm = document.getElementById('myApptFilterForm');
    var sortInput = document.getElementById('myApptSort');
    var sortControl = document.getElementById('myApptSortControl');
    var sortButton = document.getElementById('myApptSortButton');
    var statusInput = document.getElementById('myApptStatus');
    var dateFromInput = document.getElementById('myApptDateFrom');
    var dateToInput = document.getElementById('myApptDateTo');
    var resetFiltersButton = document.getElementById('myApptResetFilters');
    var pager = document.getElementById('myApptPager');
    var buttonPrev = document.getElementById('myApptPrev');
    var buttonNext = document.getElementById('myApptNext');
    var pageInfo = document.getElementById('myApptPageInfo');
    var sortOptions = Array.from(scope.querySelectorAll('.appt-sort-option[data-sort]'));
    var baseUrl = root.getAttribute('data-base-url') || '';
    var csrf = root.getAttribute('data-csrf') || '';
    var allAppointments = [];
    var page = 1;
    var totalPages = 1;

    if (!list || !empty || !baseUrl) return;

    function getFilterValues() {
      var from = dateFromInput ? text(dateFromInput.value) : '';
      var to = dateToInput ? text(dateToInput.value) : '';
      if (from && to && from > to) {
        var temp = from;
        from = to;
        to = temp;
      }
      return {
        sort: sortInput && sortInput.value === 'asc' ? 'asc' : 'desc',
        status: statusInput ? text(statusInput.value) : '',
        from: from,
        to: to
      };
    }

    function updateFilterReset() {
      if (!resetFiltersButton) return;
      var filters = getFilterValues();
      resetFiltersButton.classList.toggle('d-none', !(filters.status || filters.from || filters.to));
    }

    function closeSortMenu() {
      if (!sortControl) return;
      sortControl.classList.remove('is-open');
      if (sortButton) sortButton.setAttribute('aria-expanded', 'false');
    }

    function setSortValue(value, shouldRender) {
      var next = value === 'asc' ? 'asc' : 'desc';
      if (sortInput) sortInput.value = next;
      sortOptions.forEach(function (option) {
        option.classList.toggle('is-active', text(option.getAttribute('data-sort')) === next);
      });
      if (shouldRender) {
        page = 1;
        render();
      }
    }

    function getFilteredAppointments() {
      var filters = getFilterValues();
      var items = allAppointments.slice();
      if (filters.status) {
        items = items.filter(function (appt) {
          return getStatusGroup(appt) === filters.status;
        });
      }
      if (filters.from || filters.to) {
        items = items.filter(function (appt) {
          var day = getApptDay(appt);
          if (!day) return false;
          if (filters.from && day < filters.from) return false;
          if (filters.to && day > filters.to) return false;
          return true;
        });
      }
      items.sort(function (a, b) {
        var timeA = getApptTime(a);
        var timeB = getApptTime(b);
        var valueA = isNaN(timeA) ? 0 : timeA;
        var valueB = isNaN(timeB) ? 0 : timeB;
        return filters.sort === 'asc' ? valueA - valueB : valueB - valueA;
      });
      return items;
    }

    function canShowCancelButton(appt) {
      return !!(appt && appt.can_cancel && ['pending', 'scheduled'].includes(getStatusGroup(appt)));
    }

    function canShowCalendarButton(appt) {
      return !!(appt && appt.public_code && ['pending', 'scheduled'].includes(getStatusGroup(appt)));
    }

    function updatePager(total) {
      if (!pager) return;
      totalPages = Math.max(1, Math.ceil((total || 0) / PER_PAGE));
      if ((total || 0) <= PER_PAGE) {
        pager.classList.add('d-none');
        return;
      }
      pager.classList.remove('d-none');
      if (pageInfo) pageInfo.textContent = 'Pagina ' + page + ' di ' + totalPages;
      if (buttonPrev) buttonPrev.disabled = page <= 1;
      if (buttonNext) buttonNext.disabled = page >= totalPages;
    }

    function render() {
      updateFilterReset();
      var filtered = getFilteredAppointments();
      if (page < 1) page = 1;
      totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
      if (page > totalPages) page = totalPages;
      var appointments = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

      list.innerHTML = '';
      empty.classList.add('d-none');

      if (!appointments.length) {
        empty.classList.remove('d-none');
        if (pager) pager.classList.add('d-none');
        return;
      }

      updatePager(filtered.length);

      appointments.forEach(function (appt) {
        var when = fmtDateTime(appt.starts_at);
        var parts = dateParts(appt.starts_at);
        var endTime = timeOnly(appt.ends_at);
        var timeRange = endTime && endTime !== parts.time ? (parts.time || '-') + ' - ' + endTime : (parts.time || '-');
        var status = esc(appt.status_label || appt.status || '-');
        var services = (Array.isArray(appt.services) ? appt.services : []).map(esc).filter(Boolean).join(', ');
        var operators = (Array.isArray(appt.operators) ? appt.operators : []).map(esc).filter(Boolean).join(', ');
        var location = esc(appt.location_name || '');
        var price = fmtMoney(appt.total_price);
        var codeRaw = text(appt.public_code);
        var code = esc(codeRaw);
        var pkg = esc(appt.package_summary || '');
        var prepaid = esc(appt.prepaid_summary || '');
        var gift = esc(appt.gift_summary || '');
        var ics = baseUrl + '&mode=ics&code=' + encodeURIComponent(codeRaw);
        var cancelHtml = '';
        var element = document.createElement('div');

        if (canShowCancelButton(appt)) {
          cancelHtml = '<button type="button" class="btn btn-outline-danger btn-sm btn-pill js-cancel-appt" data-id="' + esc(appt.id) + '"><i class="bi bi-x-circle me-1"></i>Annulla</button>';
        }

        element.className = 'appt-item';
        element.innerHTML = [
          '<div>',
            '<div class="appt-top">',
              '<div class="appt-copy">',
                '<div class="appt-title">' + (services || 'Appuntamento') + '</div>',
                '<span class="appt-status ' + statusClass(appt) + '">' + status + '</span>',
              '</div>',
              '<div class="appt-price">&euro;' + price + '</div>',
            '</div>',
            '<div class="appt-meta-grid">',
              '<div><i class="bi bi-calendar3"></i><span>' + (parts.date || when) + '</span></div>',
              '<div><i class="bi bi-clock"></i><span>' + timeRange + '</span></div>',
              '<div><i class="bi bi-geo-alt"></i><span>' + (location || 'Sede da confermare') + '</span></div>',
              operators ? '<div><i class="bi bi-person"></i><span>' + operators + '</span></div>' : '',
            '</div>',
            pkg ? '<div class="appt-package-line"><i class="bi bi-box-seam"></i><span>' + pkg + '</span></div>' : '',
            prepaid ? '<div class="appt-package-line"><i class="bi bi-credit-card-2-front"></i><span>' + prepaid + '</span></div>' : '',
            gift ? '<div class="appt-package-line"><i class="bi bi-gift"></i><span>' + gift + '</span></div>' : '',
            '<div class="appt-actions">',
              code ? '<span class="btn btn-light btn-sm btn-pill disabled">#' + code + '</span>' : '',
              canShowCalendarButton(appt) ? '<a class="btn btn-outline-primary btn-sm btn-pill" href="' + ics + '"><i class="bi bi-calendar2-plus me-1"></i>Calendario</a>' : '',
              cancelHtml,
            '</div>',
          '</div>'
        ].join('');
        list.appendChild(element);
      });
    }

    if (filterForm) {
      filterForm.addEventListener('submit', function (event) {
        event.preventDefault();
        page = 1;
        render();
      });
    }

    if (resetFiltersButton) {
      resetFiltersButton.addEventListener('click', function () {
        if (statusInput) statusInput.value = '';
        if (dateFromInput) dateFromInput.value = '';
        if (dateToInput) dateToInput.value = '';
        page = 1;
        render();
      });
    }

    if (sortButton && sortControl) {
      sortButton.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        var open = !sortControl.classList.contains('is-open');
        sortControl.classList.toggle('is-open', open);
        sortButton.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      document.addEventListener('click', function (event) {
        if (!sortControl.contains(event.target)) closeSortMenu();
      });
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') closeSortMenu();
      });
    }

    sortOptions.forEach(function (option) {
      option.addEventListener('click', function () {
        setSortValue(text(option.getAttribute('data-sort')) || 'desc', true);
        closeSortMenu();
      });
    });

    [statusInput, dateFromInput, dateToInput].forEach(function (field) {
      if (!field) return;
      field.addEventListener('change', updateFilterReset);
      field.addEventListener('input', updateFilterReset);
    });

    if (buttonPrev) {
      buttonPrev.addEventListener('click', function () {
        if (page > 1) {
          page -= 1;
          render();
        }
      });
    }

    if (buttonNext) {
      buttonNext.addEventListener('click', function () {
        if (page < totalPages) {
          page += 1;
          render();
        }
      });
    }

    list.addEventListener('click', function (event) {
      var target = event.target;
      var button = target && target.closest ? target.closest('.js-cancel-appt') : null;
      if (!button) return;
      event.preventDefault();

      var id = parseInt(button.getAttribute('data-id') || '0', 10);
      if (!id || !confirm('Vuoi annullare questo appuntamento?')) return;

      button.disabled = true;
      var formData = new FormData();
      formData.append('_csrf', csrf);
      formData.append('appointment_id', String(id));

      fetch(baseUrl + '&mode=cancel_appointment', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      })
        .then(function (response) {
          return response.json().catch(function () {
            return null;
          });
        })
        .then(function (payload) {
          if (!payload || !payload.ok) throw new Error(payload && payload.error ? payload.error : 'Errore annullamento');
          var item = allAppointments.find(function (appt) {
            return Number(appt && appt.id) === id;
          });
          if (item) {
            item.status = 'canceled';
            item.status_label = 'Annullato';
            item.can_cancel = false;
            item.cancel_reason = null;
          }
          render();
        })
        .catch(function (error) {
          alert(error && error.message ? error.message : String(error));
        })
        .finally(function () {
          button.disabled = false;
        });
    });

    setSortValue(sortInput ? sortInput.value : 'desc', false);

    fetch(baseUrl + '&mode=my_appointments', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (payload) {
        if (!payload || !payload.ok) throw new Error(payload && payload.error ? payload.error : 'Errore');
        allAppointments = Array.isArray(payload.appointments) ? payload.appointments : [];
        render();
      })
      .catch(function () {
        empty.classList.remove('d-none');
      })
      .finally(function () {
        if (loading && loading.parentNode) loading.parentNode.removeChild(loading);
      });
  }

  ready(init);
})();
