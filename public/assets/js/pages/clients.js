(function(){
  'use strict';

  function clampPercent(value){
    var n = parseFloat(String(value || '0').replace(',', '.'));
    if (!Number.isFinite(n)) n = 0;
    return Math.max(0, Math.min(100, n));
  }

  document.querySelectorAll('[data-progress-width]').forEach(function(bar){
    bar.style.width = clampPercent(bar.getAttribute('data-progress-width')) + '%';
  });

  document.addEventListener('click', function(event){
    var confirmTarget = event.target.closest('[data-confirm]');
    if (confirmTarget) {
      var message = confirmTarget.getAttribute('data-confirm') || 'Confermare?';
      if (!window.confirm(message)) event.preventDefault();
      return;
    }

    var apptTarget = event.target.closest('[data-client-appointment-open]');
    if (!apptTarget) return;

    var id = parseInt(apptTarget.getAttribute('data-client-appointment-open') || '0', 10) || 0;
    if (id > 0 && window.qbOpenEditAppointment) {
      event.preventDefault();
      window.qbOpenEditAppointment(id);
    }
  });
})();
