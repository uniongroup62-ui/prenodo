document.addEventListener('DOMContentLoaded', function () {
  var el = document.getElementById('pendingEmailAlert');
  if (!el) return;
  var ms = parseInt(el.getAttribute('data-remaining-ms') || '0', 10);
  var expiredMessage = el.querySelector('[data-email-code-expired]');
  if (isFinite(ms) && ms > 0) {
    window.setTimeout(function () {
      if (expiredMessage) expiredMessage.classList.remove('d-none');
    }, ms + 50);
  } else if (expiredMessage) {
    expiredMessage.classList.remove('d-none');
  }

  var resendBtn = document.getElementById('resendEmailCodeBtn');
  if (!resendBtn) return;
  var label = resendBtn.querySelector('[data-resend-label]');
  var wait = parseInt(resendBtn.getAttribute('data-wait-seconds') || '0', 10);
  var readyLabel = resendBtn.getAttribute('data-ready-label') || 'Reinvia codice';

  function renderResend() {
    if (!isFinite(wait) || wait <= 0) {
      resendBtn.disabled = false;
      if (label) label.textContent = readyLabel;
      return;
    }
    resendBtn.disabled = true;
    if (label) label.textContent = 'Reinvia tra ' + wait + 's';
  }

  renderResend();
  if (isFinite(wait) && wait > 0) {
    var timer = window.setInterval(function () {
      wait -= 1;
      renderResend();
      if (wait <= 0) window.clearInterval(timer);
    }, 1000);
  }
});
