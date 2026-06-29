(function () {
  'use strict';

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
      return;
    }
    callback();
  }

  function initBookingQuotes() {
    var list = document.getElementById('myQuoteList');
    if (!list) return;

    var empty = document.getElementById('myQuoteEmpty');
    var loading = document.getElementById('myQuoteLoading');
    var alertBox = document.getElementById('myQuoteAlert');
    var statusSel = document.getElementById('myQuoteStatusFilter');
    var filterForm = document.getElementById('myQuoteFilterForm');
    var dateFromEl = document.getElementById('myQuoteDateFrom');
    var dateToEl = document.getElementById('myQuoteDateTo');
    var resetFiltersBtn = document.getElementById('myQuoteResetFilters');
    var sortInput = document.getElementById('myQuoteSortInput');
    var sortControl = document.getElementById('myQuoteSortControl');
    var sortButton = document.getElementById('myQuoteSortButton');
    var sortOptions = Array.from(document.querySelectorAll('#myQuoteSortMenu .appt-sort-option[data-sort]'));
    var pager = document.getElementById('myQuotePager');
    var btnPrev = document.getElementById('myQuotePrev');
    var btnNext = document.getElementById('myQuoteNext');
    var pageInfo = document.getElementById('myQuotePageInfo');
    var baseUrl = list.getAttribute('data-quotes-base') || '';
    var csrf = list.getAttribute('data-quotes-csrf') || '';
    var perPage = 5;
    var page = 1;
    var totalPages = 1;
    var quoteSort = 'desc';
    var allQuotes = [];
    var quoteStatusOptions = [
      { key: 'sent', label: 'Inviati' },
      { key: 'expired', label: 'Scaduti' },
      { key: 'accepted', label: 'Accettati' },
      { key: 'paid', label: 'Pagati' },
      { key: 'rejected', label: 'Rifiutati' },
      { key: 'canceled', label: 'Annullati' }
    ];

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
      if (status === 'accepted') return 'is-accepted';
      if (status === 'rejected') return 'is-rejected';
      if (status === 'sent') return 'is-sent';
      if (status === 'expired') return 'is-expired';
      if (status === 'paid') return 'is-paid';
      if (status === 'canceled') return 'is-canceled';
      return 'is-muted';
    }

    function showAlert(kind, message) {
      if (!alertBox) return;
      alertBox.className = 'alert alert-' + kind;
      alertBox.textContent = String(message || '');
      alertBox.classList.remove('d-none');
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e) {}
    }

    function hideAlert() {
      if (!alertBox) return;
      alertBox.classList.add('d-none');
    }

    function getStatusKey(quote) {
      var raw = String((quote && quote.status) || '').toLowerCase().trim();
      var label;
      if (raw) return raw;
      label = String((quote && quote.status_label) || '').toLowerCase().trim();
      return label;
    }

    function getQuoteDay(quote) {
      var value = String((quote && quote.quote_date) || '').trim();
      var match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
      return match ? match[1] : '';
    }

    function getQuoteSortTime(quote) {
      var value = String((quote && quote.quote_date) || '').trim();
      var time;
      if (!value) return 0;
      time = new Date((value.length === 10 ? (value + 'T00:00:00') : value).replace(' ', 'T')).getTime();
      return isNaN(time) ? 0 : time;
    }

    function sortQuoteItems(items) {
      var dir = quoteSort === 'asc' ? 'asc' : 'desc';
      items.sort(function (a, b) {
        var ta = getQuoteSortTime(a);
        var tb = getQuoteSortTime(b);
        var ia = Number((a && a.id) || 0);
        var ib = Number((b && b.id) || 0);
        if (ta !== tb) return dir === 'asc' ? (ta - tb) : (tb - ta);
        return dir === 'asc' ? (ia - ib) : (ib - ia);
      });
      return items;
    }

    function closeSortMenu() {
      if (!sortControl) return;
      sortControl.classList.remove('is-open');
      if (sortButton) sortButton.setAttribute('aria-expanded', 'false');
    }

    function updateSortOptions() {
      quoteSort = quoteSort === 'asc' ? 'asc' : 'desc';
      if (sortInput) sortInput.value = quoteSort;
      sortOptions.forEach(function (option) {
        option.classList.toggle('is-active', String(option.getAttribute('data-sort')) === quoteSort);
      });
    }

    function dateFilterValues() {
      var from = String(dateFromEl ? dateFromEl.value : '').trim();
      var to = String(dateToEl ? dateToEl.value : '').trim();
      var tmp;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) from = '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) to = '';
      if (from && to && from > to) {
        tmp = from;
        from = to;
        to = tmp;
        if (dateFromEl) dateFromEl.value = from;
        if (dateToEl) dateToEl.value = to;
      }
      return { from: from, to: to };
    }

    function filtersActive() {
      var dates = dateFilterValues();
      var selected = statusSel ? String(statusSel.value || '') : '';
      return !!(selected || dates.from || dates.to);
    }

    function syncResetButton() {
      if (!resetFiltersBtn) return;
      resetFiltersBtn.classList.toggle('d-none', !filtersActive());
    }

    function statusOptionExists(value) {
      if (!value) return true;
      return !!(statusSel && Array.from(statusSel.options || []).some(function (option) {
        return String(option.value) === String(value);
      }));
    }

    function buildStatusOptions(quotes) {
      var current;
      var map;
      var preferredOrder;
      var items;
      var allOpt;
      if (!statusSel) return;
      current = String(statusSel.value || '');
      map = new Map();
      quoteStatusOptions.forEach(function (item) {
        map.set(item.key, item.label);
      });
      (Array.isArray(quotes) ? quotes : []).forEach(function (quote) {
        var key = getStatusKey(quote);
        var label = String((quote && (quote.status_label || quote.status)) || '').trim();
        if (!label) return;
        if (!map.has(key || label.toLowerCase())) map.set(key || label.toLowerCase(), label);
      });

      preferredOrder = ['sent', 'expired', 'accepted', 'paid', 'rejected', 'canceled'];
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

      statusSel.innerHTML = '';
      allOpt = document.createElement('option');
      allOpt.value = '';
      allOpt.textContent = 'Tutti';
      statusSel.appendChild(allOpt);
      items.forEach(function (item) {
        var opt = document.createElement('option');
        opt.value = item.key;
        opt.textContent = item.label;
        statusSel.appendChild(opt);
      });
      if (statusOptionExists(current)) statusSel.value = current;
    }

    function getFilteredQuotes() {
      var selected = statusSel ? String(statusSel.value || '') : '';
      var dates = dateFilterValues();
      var items = allQuotes.filter(function (quote) {
        var day;
        if (selected && getStatusKey(quote) !== selected) return false;
        day = getQuoteDay(quote);
        if ((dates.from || dates.to) && !day) return false;
        if (dates.from && day < dates.from) return false;
        if (dates.to && day > dates.to) return false;
        return true;
      });
      return sortQuoteItems(items);
    }

    function setFilterValue(value) {
      var next = String(value || '');
      if (!statusOptionExists(next)) next = '';
      if (statusSel) statusSel.value = next;
      syncResetButton();
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

    async function loadQuotes() {
      var response = await fetch(baseUrl + '&mode=my_quotes', { headers: { Accept: 'application/json' } });
      var payload = await response.json();
      if (!payload || !payload.ok) throw new Error((payload && payload.error) || 'Errore');
      allQuotes = Array.isArray(payload.quotes) ? payload.quotes : [];
      allQuotes.sort(function (a, b) {
        var sa = String((a && a.quote_date) || '');
        var sb = String((b && b.quote_date) || '');
        var ta = new Date((sa.length === 10 ? (sa + 'T00:00:00') : sa).replace(' ', 'T')).getTime();
        var tb = new Date((sb.length === 10 ? (sb + 'T00:00:00') : sb).replace(' ', 'T')).getTime();
        var ia = Number((a && a.id) || 0);
        var ib = Number((b && b.id) || 0);
        var va = isNaN(ta) ? 0 : ta;
        var vb = isNaN(tb) ? 0 : tb;
        if (vb !== va) return vb - va;
        return ib - ia;
      });
      buildStatusOptions(allQuotes);
    }

    function render() {
      var filtered = getFilteredQuotes();
      var items;
      syncResetButton();
      if (page < 1) page = 1;
      totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
      if (page > totalPages) page = totalPages;
      items = filtered.slice((page - 1) * perPage, page * perPage);

      list.innerHTML = '';
      if (empty) empty.classList.add('d-none');
      if (!items.length) {
        if (empty) {
          empty.textContent = filtersActive() ? 'Nessun preventivo trovato per i filtri selezionati.' : 'Nessun preventivo trovato.';
          empty.classList.remove('d-none');
        }
        if (pager) pager.classList.add('d-none');
        return;
      }

      updatePager(filtered.length);
      items.forEach(function (quote) {
        var rawNumber = quote.number || '';
        var number = rawNumber ? esc(rawNumber) : '&mdash;';
        var quoteDate = fmtDate(quote.quote_date);
        var validUntil = quote.valid_until ? fmtDate(quote.valid_until) : '';
        var total = (typeof quote.total === 'number') ? quote.total.toFixed(2).replace('.', ',') : '0,00';
        var status = String(quote.status || '');
        var rawStatusLabel = quote.status_label || status || '';
        var statusLabel = rawStatusLabel ? esc(rawStatusLabel) : '&mdash;';
        var badge = badgeClass(status);
        var canRespond = !!quote.can_respond;
        var openUrl = quote.public_url ? esc(quote.public_url) : '';
        var pdfUrl = quote.pdf_url ? esc(quote.pdf_url) : '';
        var el = document.createElement('div');
        el.className = 'quote-item';
        el.innerHTML = ''
          + '<div class="quote-icon" aria-hidden="true"><i class="bi bi-file-earmark-text"></i></div>'
          + '<div class="quote-content">'
          + '<div class="quote-top">'
          + '<div>'
          + '<div class="quote-title">Preventivo #' + number + '</div>'
          + '<span class="quote-status ' + badge + '"><i class="bi bi-circle-fill"></i>' + statusLabel + '</span>'
          + '</div>'
          + '<div class="quote-total">&euro;' + esc(total) + '</div>'
          + '</div>'
          + '<div class="quote-meta-grid">'
          + '<div><i class="bi bi-calendar-event"></i><span>Data: <strong>' + (quoteDate ? esc(quoteDate) : '&mdash;') + '</strong></span></div>'
          + '<div><i class="bi bi-hourglass-split"></i><span>Valido fino al: <strong>' + (validUntil ? esc(validUntil) : '&mdash;') + '</strong></span></div>'
          + '</div>'
          + '<div class="quote-actions">'
          + (openUrl ? '<a class="btn btn-outline-primary btn-sm btn-pill" href="' + openUrl + '" target="_blank" rel="noopener"><i class="bi bi-eye me-1"></i>Apri</a>' : '')
          + (pdfUrl ? '<a class="btn btn-outline-secondary btn-sm btn-pill" href="' + pdfUrl + '" target="_blank" rel="noopener"><i class="bi bi-filetype-pdf me-1"></i>PDF</a>' : '')
          + (canRespond ? ''
            + '<button type="button" class="btn btn-success btn-sm btn-pill" data-act="accept" data-id="' + esc(quote.id) + '"><i class="bi bi-check2 me-1"></i>Accetta</button>'
            + '<button type="button" class="btn btn-outline-danger btn-sm btn-pill" data-act="reject" data-id="' + esc(quote.id) + '"><i class="bi bi-x-lg me-1"></i>Rifiuta</button>'
            : '')
          + '</div>'
          + '</div>';

        el.querySelectorAll('button[data-act]').forEach(function (button) {
          button.addEventListener('click', async function () {
            var id;
            var action;
            var fd;
            var response;
            var payload;
            hideAlert();
            id = Number(button.getAttribute('data-id') || 0);
            action = String(button.getAttribute('data-act') || '');
            if (!id || !action) return;
            if (action === 'reject' && !confirm('Rifiutare questo preventivo?')) return;
            if (action === 'accept' && !confirm('Accettare questo preventivo?')) return;

            try {
              button.disabled = true;
              fd = new FormData();
              if (csrf) fd.set('_csrf', csrf);
              fd.set('quote_id', String(id));
              fd.set('decision', action);

              response = await fetch(baseUrl + '&mode=quote_decision', {
                method: 'POST',
                headers: { Accept: 'application/json' },
                body: fd
              });
              payload = await response.json();
              if (!payload || !payload.ok) throw new Error((payload && payload.error) || 'Errore');

              showAlert('success', payload.message || 'Operazione completata.');
              await loadQuotes();
              page = 1;
              render();
            } catch (e) {
              showAlert('danger', (e && e.message) || 'Errore.');
              try {
                await loadQuotes();
                render();
              } catch (e2) {}
            } finally {
              button.disabled = false;
            }
          });
        });

        list.appendChild(el);
      });
    }

    async function boot() {
      try {
        if (!baseUrl) throw new Error('Endpoint preventivi non configurato.');
        await loadQuotes();
        setFilterValue('');

        if (statusSel) {
          statusSel.addEventListener('change', function () {
            setFilterValue(statusSel.value);
            page = 1;
            render();
          });
        }
        if (filterForm) {
          filterForm.addEventListener('submit', function (event) {
            event.preventDefault();
            page = 1;
            render();
          });
        }
        [dateFromEl, dateToEl].forEach(function (el) {
          if (!el) return;
          el.addEventListener('change', function () {
            page = 1;
            render();
          });
        });
        if (resetFiltersBtn) {
          resetFiltersBtn.addEventListener('click', function () {
            if (statusSel) statusSel.value = '';
            if (dateFromEl) dateFromEl.value = '';
            if (dateToEl) dateToEl.value = '';
            page = 1;
            render();
          });
        }

        updateSortOptions();
        if (sortButton && sortControl) {
          sortButton.addEventListener('click', function () {
            var isOpen = sortControl.classList.toggle('is-open');
            sortButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
          });
        }
        sortOptions.forEach(function (option) {
          option.addEventListener('click', function () {
            var next = String(option.getAttribute('data-sort') || 'desc');
            quoteSort = next === 'asc' ? 'asc' : 'desc';
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

  onReady(initBookingQuotes);
})();
