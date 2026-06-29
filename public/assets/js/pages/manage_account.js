(function () {
  function normalizeSlug(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '')
      .replace(/[-_]{2,}/g, '-')
      .replace(/^[-_]+|[-_]+$/g, '')
      .slice(0, 62);
  }

  function setStatus(container, state, message, suggestions, onSuggestion) {
    if (!container) return;
    container.className = 'manage-url-status';
    container.hidden = !message && (!suggestions || !suggestions.length);
    if (state) container.classList.add('is-' + state);

    var html = '';
    var messageClass = 'manage-url-message' + (state ? ' is-' + state : '');
    if (message) html += '<div class="' + messageClass + '">' + escapeHtml(message) + '</div>';
    if (suggestions && suggestions.length) {
      html += '<div class="manage-url-suggestions-label">Scegli un suggerimento:</div>';
      html += '<div class="manage-url-suggestions">';
      suggestions.forEach(function (slug) {
        html += '<button type="button" class="manage-url-suggestion" data-slug="' + escapeAttr(slug) + '">' + escapeHtml(slug) + '</button>';
      });
      html += '</div>';
    }
    container.innerHTML = html;
    container.querySelectorAll('[data-slug]').forEach(function (button) {
      button.addEventListener('click', function () {
        onSuggestion(button.getAttribute('data-slug') || '');
      });
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char];
    });
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#096;');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var form = document.querySelector('[data-manage-register-form]');
    if (!form) return;

    var businessInput = form.querySelector('[data-business-name]');
    var slugInput = form.querySelector('[data-url-slug]');
    var status = form.querySelector('[data-url-status]');
    var submit = form.querySelector('[type="submit"]');
    var checkUrl = form.getAttribute('data-check-url') || '';
    if (!businessInput || !slugInput || !status || !checkUrl) return;

    var userEditedSlug = slugInput.value.trim() !== '';
    var lastAutoSlug = normalizeSlug(slugInput.value);
    var timer = null;
    var controller = null;

    function scheduleCheck() {
      window.clearTimeout(timer);
      timer = window.setTimeout(checkAvailability, 420);
    }

    function setSubmitEnabled(enabled) {
      if (submit) submit.disabled = !enabled;
    }

    function applyBusinessSlug() {
      if (userEditedSlug && slugInput.value.trim() !== '' && slugInput.value !== lastAutoSlug) return;
      var next = normalizeSlug(businessInput.value);
      if (next && slugInput.value !== next) {
        slugInput.value = next;
        lastAutoSlug = next;
      }
    }

    function checkAvailability() {
      var slug = normalizeSlug(slugInput.value);
      if (slugInput.value !== slug) slugInput.value = slug;

      if (!slug) {
        setSubmitEnabled(true);
        setStatus(status, 'neutral', '', [], function () {});
        return;
      }

      if (controller) controller.abort();
      controller = new AbortController();

      setSubmitEnabled(false);
      setStatus(status, 'checking', 'Verifica disponibilita URL...', [], function () {});

      var url = new URL(checkUrl, window.location.origin);
      url.searchParams.set('slug', slug);
      url.searchParams.set('business_name', businessInput.value || '');

      fetch(url.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
        credentials: 'same-origin'
      })
        .then(function (response) { return response.json(); })
        .then(function (data) {
          var available = !!data.available;
          setSubmitEnabled(available);
          setStatus(
            status,
            available ? 'ok' : 'error',
            data.message || (available ? 'URL disponibile.' : 'URL non disponibile.'),
            Array.isArray(data.suggestions) ? data.suggestions : [],
            function (suggestedSlug) {
              userEditedSlug = true;
              slugInput.value = suggestedSlug;
              slugInput.focus();
              scheduleCheck();
            }
          );
        })
        .catch(function (error) {
          if (error && error.name === 'AbortError') return;
          setSubmitEnabled(true);
          setStatus(status, 'neutral', 'Verifica URL non disponibile ora. Il controllo finale verra eseguito al salvataggio.', [], function () {});
        });
    }

    businessInput.addEventListener('input', function () {
      applyBusinessSlug();
      scheduleCheck();
    });

    slugInput.addEventListener('input', function () {
      userEditedSlug = true;
      scheduleCheck();
    });

    slugInput.addEventListener('blur', checkAvailability);

    if (slugInput.value.trim() !== '') {
      scheduleCheck();
    } else if (businessInput.value.trim() !== '') {
      applyBusinessSlug();
      scheduleCheck();
    } else {
      status.hidden = true;
    }
  });
})();
