(function() {
    const openBtn = document.getElementById('openConsentTemplatePreview');
    const sourceField = document.getElementById('body_template');
    const nameField = document.getElementById('consentModuleName');
    const activeField = document.getElementById('consentModuleActive');
    const typeField = document.getElementById('consentPreviewType');
    const previewName = document.getElementById('consentPreviewName');
    const previewActive = document.getElementById('consentPreviewActive');
    const targetField = document.getElementById('consentTemplatePreviewBody');
    const form = document.getElementById('consentTemplatePreviewForm');
    const modalEl = document.getElementById('consentTemplatePreviewModal');
    const frameEl = document.getElementById('consentTemplatePreviewFrame');
    if (!openBtn || !sourceField || !targetField || !form || !modalEl || !frameEl || !previewName || !previewActive || !typeField) return;

    openBtn.addEventListener('click', function() {
      targetField.value = sourceField.value || '';
      previewName.value = nameField ? (nameField.value || '') : '';
      previewActive.value = activeField ? (activeField.checked ? '1' : '0') : '1';
      frameEl.setAttribute('src', 'about:blank');

      if (window.bootstrap && window.bootstrap.Modal) {
        window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
      }

      form.submit();
    });
  })();

(function() {
  const deleteLinks = document.querySelectorAll('.js-consent-module-delete');
  const modalEl = document.getElementById('consentModuleDeleteModal');
  const confirmBtn = document.getElementById('consentModuleDeleteConfirm');
  const titleEl = document.getElementById('consentModuleDeleteTitle');
  const bodyEl = document.getElementById('consentModuleDeleteBody');
  if (!deleteLinks.length || !modalEl || !confirmBtn || !titleEl || !bodyEl) return;

  const escapeHtml = function(value) {
    return String(value || '').replace(/[&<>"']/g, function(ch) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[ch] || ch;
    });
  };

  deleteLinks.forEach(function(link) {
    link.addEventListener('click', function(event) {
      event.preventDefault();
      const href = link.getAttribute('href') || '#';
      const moduleName = (link.getAttribute('data-module-name') || 'questo modulo').trim();
      const associationCount = parseInt(link.getAttribute('data-association-count') || '0', 10) || 0;
      confirmBtn.setAttribute('href', href);
      titleEl.textContent = 'Eliminare il modulo "' + moduleName + '"?';

      if (associationCount > 0) {
        bodyEl.innerHTML = 'Questo modulo e associato a <strong>' + associationCount + ' cliente/i</strong>.<br>Se prosegui, saranno rimosse le associazioni non firmate. Se esistono PDF firmati, l\'eliminazione verra bloccata per conservare lo storico.';
      } else {
        bodyEl.textContent = 'Questa operazione eliminera definitivamente il modulo consenso selezionato.';
      }

      if (window.bootstrap && window.bootstrap.Modal) {
        window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
      } else {
        const plainMessage = associationCount > 0
          ? 'Il modulo "' + moduleName + '" e associato a ' + associationCount + ' cliente/i. Saranno rimosse le associazioni non firmate; se esistono PDF firmati, l\'eliminazione verra bloccata per conservare lo storico. Continuare?'
          : 'Eliminare definitivamente il modulo "' + moduleName + '"?';
        if (window.confirm(plainMessage)) {
          window.location.href = href;
        }
      }
    });
  });
})();
