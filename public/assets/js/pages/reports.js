(function(){
  function parseJsonScript(id){
    var el = document.getElementById(id);
    if (!el) return null;
    try {
      var raw = String(el.textContent || '').trim();
      return raw ? JSON.parse(raw) : null;
    } catch(e) {
      return null;
    }
  }

window.addEventListener('load', function () {
  var reportConfig = parseJsonScript('reportsPageConfig') || {};
  var reportCharts = reportConfig.charts || {};
  var palette = reportCharts.palette || ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2'];
  var moneyFmt = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
  var numberFmt = new Intl.NumberFormat('it-IT');
  var chartIds = [
    'reportTrendChart',
    'reportAppointmentsTrendChart',
    'reportSalesTypesChart',
    'reportPaymentMethodsChart',
    'reportGenderChart',
    'reportAgeChart',
    'reportFinanceChart',
    'reportClientsChart',
    'reportItemsChart',
    'reportOperatorsChart'
  ];
  var rangeSelect = document.getElementById('reportRange');
  var customGroups = Array.prototype.slice.call(document.querySelectorAll('[data-report-custom-group]'));
  var compareCheckbox = document.getElementById('reportCompare');
  var comparePanel = document.querySelector('[data-report-compare-panel]');
  var compareModeSelect = document.getElementById('reportCompareMode');
  var compareMonthGroups = Array.prototype.slice.call(document.querySelectorAll('[data-report-compare-month]'));
  var compareCustomGroups = Array.prototype.slice.call(document.querySelectorAll('[data-report-compare-custom]'));
  var periodSummary = document.querySelector('[data-report-period-summary]');
  var compareEffective = document.querySelector('[data-report-compare-effective]');
  var compareMonthInput = document.querySelector('[data-report-compare-month-input]');
  var compareCustomDateInputs = Array.prototype.slice.call(document.querySelectorAll('[data-report-compare-custom-date]'));
  var reportRangeKey = String(reportConfig.rangeKey || '');
  var reportToday = parseYmd(reportConfig.today || '');

  function setGroupVisible(groups, visible) {
    groups.forEach(function (group) {
      group.classList.toggle('d-none', !visible);
    });
  }

  function parseYmd(value) {
    var match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    var date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) return null;
    return date;
  }

  function formatItDate(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return '';
    return String(date.getDate()).padStart(2, '0') + '/' + String(date.getMonth() + 1).padStart(2, '0') + '/' + date.getFullYear();
  }

  function addDays(date, days) {
    var out = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    out.setDate(out.getDate() + Number(days || 0));
    return out;
  }

  function daysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  function shiftMonths(date, months) {
    var target = new Date(date.getFullYear(), date.getMonth() + Number(months || 0), 1);
    var day = Math.min(date.getDate(), daysInMonth(target.getFullYear(), target.getMonth()));
    return new Date(target.getFullYear(), target.getMonth(), day);
  }

  function shiftYears(date, years) {
    var year = date.getFullYear() + Number(years || 0);
    var day = Math.min(date.getDate(), daysInMonth(year, date.getMonth()));
    return new Date(year, date.getMonth(), day);
  }

  function inclusiveDays(from, to) {
    var ms = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime() - new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
    return Math.max(1, Math.floor(ms / 86400000) + 1);
  }

  function previousPeriodRange(from, rangeDays) {
    var to = addDays(from, -1);
    return [addDays(to, -(Math.max(1, rangeDays) - 1)), to];
  }

  function sameLengthMonthRange(monthValue, rangeDays) {
    var match = String(monthValue || '').match(/^(\d{4})-(\d{2})$/);
    if (!match) return null;
    var start = new Date(Number(match[1]), Number(match[2]) - 1, 1);
    var end = addDays(start, Math.max(1, rangeDays) - 1);
    var monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    if (end > monthEnd) end = monthEnd;
    return [start, end];
  }

  function autoCompareRange(rangeKey, from, to, rangeDays) {
    if (rangeKey === 'month_current' || rangeKey === 'month_previous') {
      return [shiftMonths(from, -1), shiftMonths(to, -1)];
    }
    if (rangeKey === 'year_current') {
      return [shiftYears(from, -1), shiftYears(to, -1)];
    }
    return previousPeriodRange(from, rangeDays);
  }

  function quickPeriodRange(rangeKey) {
    if (!(reportToday instanceof Date) || isNaN(reportToday.getTime())) return null;
    if (rangeKey === 'today') {
      return [reportToday, reportToday];
    }
    if (rangeKey === 'yesterday') {
      var yesterday = addDays(reportToday, -1);
      return [yesterday, yesterday];
    }
    if (rangeKey === 'last_7') {
      return [addDays(reportToday, -6), reportToday];
    }
    if (rangeKey === 'last_30') {
      return [addDays(reportToday, -29), reportToday];
    }
    if (rangeKey === 'last_90') {
      return [addDays(reportToday, -89), reportToday];
    }
    if (rangeKey === 'last_180') {
      return [addDays(reportToday, -179), reportToday];
    }
    if (rangeKey === 'month_previous') {
      var previousMonth = new Date(reportToday.getFullYear(), reportToday.getMonth() - 1, 1);
      return [previousMonth, new Date(previousMonth.getFullYear(), previousMonth.getMonth() + 1, 0)];
    }
    if (rangeKey === 'year_current') {
      return [new Date(reportToday.getFullYear(), 0, 1), reportToday];
    }
    if (rangeKey === 'month_current') {
      return [new Date(reportToday.getFullYear(), reportToday.getMonth(), 1), reportToday];
    }
    return null;
  }

  function currentPeriodRange() {
    var selectedRange = rangeSelect ? rangeSelect.value : reportRangeKey;
    if (selectedRange && selectedRange !== 'custom') {
      var quickRange = quickPeriodRange(selectedRange);
      if (quickRange) return quickRange;
    }
    var fromInput = document.querySelector('input[name="from"]');
    var toInput = document.querySelector('input[name="to"]');
    var from = parseYmd((fromInput && fromInput.value) || (periodSummary ? periodSummary.getAttribute('data-from') : ''));
    var to = parseYmd((toInput && toInput.value) || (periodSummary ? periodSummary.getAttribute('data-to') : ''));
    if (!from || !to) return null;
    if (from > to) {
      var tmp = from;
      from = to;
      to = tmp;
    }
    return [from, to];
  }

  function updatePeriodSummary(range) {
    var label = document.querySelector('[data-report-period-label]');
    if (label && range) {
      label.textContent = formatItDate(range[0]) + ' - ' + formatItDate(range[1]);
    }
  }

  function updateCompareEffective() {
    if (!compareEffective) return;
    var range = currentPeriodRange();
    if (!range) return;
    var from = range[0];
    var to = range[1];
    var rangeDays = inclusiveDays(from, to);
    var mode = compareModeSelect ? compareModeSelect.value : 'auto';
    var currentRangeKey = rangeSelect ? rangeSelect.value : reportRangeKey;
    var compareRange = autoCompareRange(currentRangeKey, from, to, rangeDays);

    if (mode === 'previous_period') {
      compareRange = previousPeriodRange(from, rangeDays);
    } else if (mode === 'previous_year') {
      compareRange = [shiftYears(from, -1), shiftYears(to, -1)];
    } else if (mode === 'month') {
      compareRange = sameLengthMonthRange(compareMonthInput ? compareMonthInput.value : '', rangeDays) || compareRange;
    } else if (mode === 'custom') {
      var customFromInput = document.querySelector('input[name="compare_from"]');
      var customToInput = document.querySelector('input[name="compare_to"]');
      var customFrom = parseYmd(customFromInput ? customFromInput.value : '');
      var customTo = parseYmd(customToInput ? customToInput.value : '');
      if (customFrom && customTo) {
        if (customFrom > customTo) {
          var swap = customFrom;
          customFrom = customTo;
          customTo = swap;
        }
        compareRange = [customFrom, customTo];
      }
    }

    compareEffective.textContent = formatItDate(compareRange[0]) + ' - ' + formatItDate(compareRange[1]);
  }

  function updateRangeVisibility() {
    setGroupVisible(customGroups, !!rangeSelect && rangeSelect.value === 'custom');
    updatePeriodSummary(currentPeriodRange());
    updateCompareEffective();
  }

  function updatePeriodAndCompare() {
    updatePeriodSummary(currentPeriodRange());
    updateCompareEffective();
  }

  function updateCompareVisibility() {
    var enabled = !!compareCheckbox && compareCheckbox.checked;
    if (comparePanel) comparePanel.classList.toggle('d-none', !enabled);
    var mode = compareModeSelect ? compareModeSelect.value : 'auto';
    setGroupVisible(compareMonthGroups, enabled && mode === 'month');
    setGroupVisible(compareCustomGroups, enabled && mode === 'custom');
    updateCompareEffective();
  }

  if (rangeSelect) {
    rangeSelect.addEventListener('change', updateRangeVisibility);
    updateRangeVisibility();
  }
  if (compareCheckbox) {
    compareCheckbox.addEventListener('change', updateCompareVisibility);
  }
  if (compareModeSelect) {
    compareModeSelect.addEventListener('change', updateCompareVisibility);
  }
  if (compareMonthInput) {
    compareMonthInput.addEventListener('change', updateCompareEffective);
    compareMonthInput.addEventListener('input', updateCompareEffective);
  }
  compareCustomDateInputs.forEach(function (input) {
    input.addEventListener('change', updateCompareEffective);
    input.addEventListener('input', updateCompareEffective);
  });
  updateCompareVisibility();

  document.querySelectorAll('[data-report-custom-date]').forEach(function (input) {
    input.addEventListener('change', function () {
      if (rangeSelect) {
        rangeSelect.value = 'custom';
        updateRangeVisibility();
      }
      updateCompareEffective();
    });
    input.addEventListener('input', updatePeriodAndCompare);
  });

  function hasValues(chart) {
    if (!chart) return false;
    var values = Array.isArray(chart.values) ? chart.values.slice() : [];
    if (Array.isArray(chart.previousValues)) values = values.concat(chart.previousValues);
    return values.some(function (value) {
      return Number(value) > 0;
    });
  }

  function emptyChart(canvasId, message) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var wrap = canvas.closest('.report-chart-wrap');
    if (!wrap) return;
    canvas.remove();
    var empty = document.createElement('div');
    empty.className = 'report-chart-empty';
    empty.textContent = message || 'Nessun dato disponibile nel periodo selezionato.';
    wrap.appendChild(empty);
  }

  function moneyShort(value) {
    value = Number(value || 0);
    if (Math.abs(value) >= 1000) {
      return (value / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 }) + 'k €';
    }
    return value.toLocaleString('it-IT', { maximumFractionDigits: 0 }) + ' €';
  }

  function integerShort(value) {
    value = Number(value || 0);
    if (Math.abs(value) >= 1000) {
      return (value / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 }) + 'k';
    }
    return numberFmt.format(Math.round(value));
  }

  function backgroundColors(count) {
    var colors = [];
    for (var i = 0; i < count; i++) {
      colors.push(palette[i % palette.length]);
    }
    return colors;
  }

  document.querySelectorAll('[data-report-modal-search]').forEach(function (input) {
    var modal = input.closest('.modal');
    if (!modal) return;
    var rows = Array.prototype.slice.call(modal.querySelectorAll('[data-report-modal-row]'));
    var emptyRow = modal.querySelector('[data-report-modal-empty]');
    var countEl = modal.querySelector('[data-report-modal-count]');
    var updateRows = function () {
      var query = input.value.trim().toLocaleLowerCase('it-IT');
      var visible = 0;
      rows.forEach(function (row) {
        var haystack = row.textContent.toLocaleLowerCase('it-IT');
        var show = query === '' || haystack.indexOf(query) !== -1;
        row.classList.toggle('d-none', !show);
        if (show) visible++;
      });
      if (emptyRow) emptyRow.classList.toggle('d-none', visible > 0);
      if (countEl) countEl.textContent = numberFmt.format(visible) + ' risultati';
    };
    input.addEventListener('input', updateRows);
    modal.addEventListener('shown.bs.modal', function () {
      input.focus();
      updateRows();
    });
  });

  if (typeof Chart === 'undefined') {
    chartIds.forEach(function (id) {
      emptyChart(id, 'Grafico non disponibile.');
    });
    return;
  }

  Chart.defaults.font.family = "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  Chart.defaults.color = '#344054';

  function renderLine(canvasId, chart) {
    if (!hasValues(chart)) {
      emptyChart(canvasId);
      return;
    }
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var datasets = [{
      label: 'Periodo attuale',
      data: chart.values || [],
      borderColor: palette[0],
      backgroundColor: 'rgba(37, 99, 235, .12)',
      borderWidth: 2,
      fill: true,
      pointRadius: 2,
      pointHoverRadius: 4,
      tension: .25
    }];
    if (chart.compareEnabled && Array.isArray(chart.previousValues) && chart.previousValues.some(function (value) { return Number(value) > 0; })) {
      datasets.push({
        label: 'Periodo precedente',
        data: chart.previousValues || [],
        borderColor: palette[6] || '#64748b',
        backgroundColor: 'rgba(100, 116, 139, .08)',
        borderDash: [6, 4],
        borderWidth: 2,
        fill: false,
        pointRadius: 2,
        pointHoverRadius: 4,
        tension: .25
      });
    }
    new Chart(canvas, {
      type: 'line',
      data: {
        labels: chart.labels || [],
        datasets: datasets
      },
      options: {
        maintainAspectRatio: false,
        responsive: true,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: {
            display: datasets.length > 1,
            position: 'bottom',
            labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true }
          },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return ctx.dataset.label + ': ' + moneyFmt.format(ctx.parsed.y || 0);
              },
              afterLabel: function (ctx) {
                var counts = ctx.datasetIndex === 1 ? chart.previousCounts : chart.counts;
                var count = Array.isArray(counts) ? Number(counts[ctx.dataIndex] || 0) : 0;
                return (chart.countLabel || 'Movimenti') + ': ' + numberFmt.format(count);
              }
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } },
          y: { beginAtZero: true, ticks: { callback: moneyShort } }
        }
      }
    });
  }

  function renderCountLine(canvasId, chart) {
    if (!hasValues(chart)) {
      emptyChart(canvasId);
      return;
    }
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var datasets = [{
      label: 'Periodo attuale',
      data: chart.values || [],
      borderColor: palette[1] || '#16a34a',
      backgroundColor: 'rgba(22, 163, 74, .12)',
      borderWidth: 2,
      fill: true,
      pointRadius: 2,
      pointHoverRadius: 4,
      tension: .25
    }];
    if (chart.compareEnabled && Array.isArray(chart.previousValues) && chart.previousValues.some(function (value) { return Number(value) > 0; })) {
      datasets.push({
        label: 'Periodo precedente',
        data: chart.previousValues || [],
        borderColor: palette[6] || '#64748b',
        backgroundColor: 'rgba(100, 116, 139, .08)',
        borderDash: [6, 4],
        borderWidth: 2,
        fill: false,
        pointRadius: 2,
        pointHoverRadius: 4,
        tension: .25
      });
    }
    new Chart(canvas, {
      type: 'line',
      data: {
        labels: chart.labels || [],
        datasets: datasets
      },
      options: {
        maintainAspectRatio: false,
        responsive: true,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: {
            display: datasets.length > 1,
            position: 'bottom',
            labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true }
          },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return ctx.dataset.label + ': ' + numberFmt.format(ctx.parsed.y || 0);
              }
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } },
          y: { beginAtZero: true, ticks: { precision: 0, callback: integerShort } }
        }
      }
    });
  }

  function renderDoughnut(canvasId, chart) {
    if (!hasValues(chart)) {
      emptyChart(canvasId);
      return;
    }
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: chart.labels || [],
        datasets: [{
          data: chart.values || [],
          backgroundColor: backgroundColors((chart.values || []).length),
          borderColor: '#fff',
          borderWidth: 2
        }]
      },
      options: {
        cutout: '62%',
        maintainAspectRatio: false,
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true }
          },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return ctx.label + ': ' + moneyFmt.format(ctx.parsed || 0);
              }
            }
          }
        }
      }
    });
  }

  function renderCountDoughnut(canvasId, chart) {
    if (!hasValues(chart)) {
      emptyChart(canvasId);
      return;
    }
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var values = chart.values || [];
    var total = values.reduce(function (sum, value) { return sum + Number(value || 0); }, 0);
    new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: chart.labels || [],
        datasets: [{
          data: values,
          backgroundColor: backgroundColors(values.length),
          borderColor: '#fff',
          borderWidth: 2
        }]
      },
      options: {
        cutout: '62%',
        maintainAspectRatio: false,
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true }
          },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var value = Number(ctx.parsed || 0);
                var pct = total > 0 ? ' (' + ((value / total) * 100).toLocaleString('it-IT', { maximumFractionDigits: 1 }) + '%)' : '';
                return ctx.label + ': ' + numberFmt.format(value) + pct;
              }
            }
          }
        }
      }
    });
  }

  function renderBar(canvasId, chart) {
    if (!hasValues(chart)) {
      emptyChart(canvasId);
      return;
    }
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: chart.labels || [],
        datasets: [{
          label: 'Incasso',
          data: chart.values || [],
          backgroundColor: backgroundColors((chart.values || []).length),
          borderRadius: 5,
          maxBarThickness: 18
        }]
      },
      options: {
        indexAxis: 'y',
        maintainAspectRatio: false,
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return moneyFmt.format(ctx.parsed.x || 0);
              },
              afterLabel: function (ctx) {
                var counts = Array.isArray(chart.counts) ? chart.counts : [];
                var count = Number(counts[ctx.dataIndex] || 0);
                return count > 0 ? 'Utilizzi: ' + numberFmt.format(count) : undefined;
              }
            }
          }
        },
        scales: {
          x: { beginAtZero: true, ticks: { callback: moneyShort } },
          y: { grid: { display: false }, ticks: { font: { size: 11 } } }
        }
      }
    });
  }

  function renderCountBar(canvasId, chart, label) {
    if (!hasValues(chart)) {
      emptyChart(canvasId);
      return;
    }
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: chart.labels || [],
        datasets: [{
          label: label || 'Clienti',
          data: chart.values || [],
          backgroundColor: backgroundColors((chart.values || []).length),
          borderRadius: 5,
          maxBarThickness: 22
        }]
      },
      options: {
        indexAxis: 'y',
        maintainAspectRatio: false,
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return numberFmt.format(ctx.parsed.x || 0);
              }
            }
          }
        },
        scales: {
          x: { beginAtZero: true, ticks: { precision: 0, callback: integerShort } },
          y: { grid: { display: false }, ticks: { font: { size: 11 } } }
        }
      }
    });
  }

  renderLine('reportTrendChart', reportCharts.trend);
  renderCountLine('reportAppointmentsTrendChart', reportCharts.appointmentTrend);
  renderDoughnut('reportSalesTypesChart', reportCharts.salesTypes);
  renderBar('reportPaymentMethodsChart', reportCharts.paymentMethods);
  renderCountDoughnut('reportGenderChart', reportCharts.gender);
  renderCountBar('reportAgeChart', reportCharts.age, 'Clienti');
  renderDoughnut('reportFinanceChart', reportCharts.finance);
  renderBar('reportClientsChart', reportCharts.clients);
  renderBar('reportItemsChart', reportCharts.items);
  renderBar('reportOperatorsChart', reportCharts.operators);
});
})();
