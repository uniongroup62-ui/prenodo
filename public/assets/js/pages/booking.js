(function () {
  'use strict';

  function syncCustomerCancelFields() {
    var checkbox = document.getElementById('bookingCustomerCancelEnabled');
    var value = document.getElementById('bookingCancelBeforeValue');
    var unit = document.getElementById('bookingCancelBeforeUnit');
    var enabled = !!(checkbox && checkbox.checked);
    if (value) value.disabled = !enabled;
    if (unit) unit.disabled = !enabled;
  }

  function clampPercent(value) {
    value = Number(value);
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, value));
  }

  function applyProgressWidths() {
    document.querySelectorAll('[data-booking-progress-width]').forEach(function (bar) {
      bar.style.width = clampPercent(bar.getAttribute('data-booking-progress-width')) + '%';
    });
  }

  function closeSortControl(control) {
    if (!control) return;
    control.classList.remove('is-open');
    var button = control.querySelector('.appt-sort-button');
    if (button) button.setAttribute('aria-expanded', 'false');
  }

  function closeAllSortControls(exceptControl) {
    document.querySelectorAll('[data-booking-sort-control].is-open').forEach(function (control) {
      if (control !== exceptControl) closeSortControl(control);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var checkbox = document.getElementById('bookingCustomerCancelEnabled');
    var printButton = document.getElementById('printBtn');
    if (checkbox) checkbox.addEventListener('change', syncCustomerCancelFields);
    if (printButton) printButton.addEventListener('click', function () {
      window.print();
    });
    syncCustomerCancelFields();
    applyProgressWidths();
  });

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!(target instanceof Element)) return;

    var sortButton = target.closest('.appt-sort-button');
    var sortControl = sortButton ? sortButton.closest('[data-booking-sort-control]') : null;
    if (sortControl) {
      event.preventDefault();
      var open = !sortControl.classList.contains('is-open');
      closeAllSortControls(sortControl);
      sortControl.classList.toggle('is-open', open);
      sortButton.setAttribute('aria-expanded', open ? 'true' : 'false');
      return;
    }

    var sortOption = target.closest('.appt-sort-option[data-sort]');
    sortControl = sortOption ? sortOption.closest('[data-booking-sort-control]') : null;
    if (sortControl) {
      event.preventDefault();
      var sortInput = document.getElementById(sortControl.getAttribute('data-sort-input') || '');
      var sortForm = document.getElementById(sortControl.getAttribute('data-sort-form') || '');
      if (sortInput) sortInput.value = sortOption.getAttribute('data-sort') === 'asc' ? 'asc' : 'desc';
      closeSortControl(sortControl);
      if (sortForm) sortForm.submit();
      return;
    }

    var thumb = target.closest('.pd-thumb');
    if (thumb) {
      var main = document.getElementById('pdMainImg');
      var src = thumb.getAttribute('data-src');
      if (main && src) main.src = src;
      return;
    }

    closeAllSortControls(null);
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeAllSortControls(null);
  });
})();
