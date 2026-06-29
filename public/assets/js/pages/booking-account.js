(function () {
  'use strict';

  function ready(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
      return;
    }
    callback();
  }

  function endpoint(baseUrl, mode) {
    return baseUrl + (baseUrl.indexOf('?') === -1 ? '?' : '&') + 'mode=' + encodeURIComponent(mode);
  }

  function stripHtml(value) {
    return String(value || '').replace(/<[^>]*>/g, '').trim();
  }

  function fetchJson(url, options) {
    return fetch(url, Object.assign({
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store'
    }, options || {}))
      .then(function (response) {
        return response.text();
      })
      .then(function (body) {
        try {
          return JSON.parse(body);
        } catch (error) {
          throw new Error(stripHtml(body) || 'Risposta non valida dal server.');
        }
      });
  }

  function setButtonHtml(button, html) {
    if (!button) return;
    button.innerHTML = html;
  }

  function clearField(form, name) {
    if (!form) return;
    var field = form.querySelector('input[name="' + name + '"]');
    if (field) field.value = '';
  }

  function initProfile() {
    var root = document.querySelector('[data-booking-profile-root]');
    if (!root) return;

    var baseUrl = root.getAttribute('data-base-url') || '';
    var csrf = root.getAttribute('data-csrf') || '';
    var form = document.getElementById('bookingProfileForm');
    var submit = document.getElementById('bookingProfileSubmit');
    var alertBox = document.getElementById('bookingProfileAlert');
    var verifyBox = document.getElementById('bookingProfileVerify');
    var verifyForm = document.getElementById('bookingProfileVerifyForm');
    var pendingEmailEl = document.getElementById('bookingProfilePendingEmail');
    var resendButton = document.getElementById('bookingProfileResendCode');

    function showAlert(message, tone) {
      if (!alertBox) return;
      alertBox.textContent = message || '';
      alertBox.className = 'booking-profile__alert' + (message ? ' is-' + (tone || 'success') : '');
    }

    function showVerify(email) {
      if (pendingEmailEl) pendingEmailEl.textContent = email || '';
      if (verifyBox) verifyBox.hidden = false;
    }

    function postForm(mode, formEl) {
      var formData = new FormData(formEl);
      if (csrf) formData.set('_csrf', csrf);
      return fetchJson(endpoint(baseUrl, mode), { method: 'POST', body: formData });
    }

    function postData(mode, data) {
      var formData = new FormData();
      if (csrf) formData.set('_csrf', csrf);
      Object.keys(data || {}).forEach(function (key) {
        formData.set(key, data[key]);
      });
      return fetchJson(endpoint(baseUrl, mode), { method: 'POST', body: formData });
    }

    if (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        showAlert('', 'success');
        var oldHtml = submit ? submit.innerHTML : '';
        if (submit) {
          submit.disabled = true;
          setButtonHtml(submit, '<span>Salvataggio...</span>');
        }

        postForm('customer_update_profile', form)
          .then(function (payload) {
            if (!payload || !payload.ok) {
              showAlert(payload && payload.error ? payload.error : 'Impossibile aggiornare il profilo.', 'danger');
              return;
            }
            clearField(form, 'current_password');
            clearField(form, 'new_password');
            clearField(form, 'new_password_confirm');
            if (payload.email_verification_required) {
              showVerify(payload.pending_email || '');
              showAlert(payload.message || 'Codice inviato alla nuova email.', 'success');
              return;
            }
            showAlert(payload.message || 'Profilo aggiornato.', 'success');
          })
          .catch(function (error) {
            showAlert(error && error.message ? error.message : 'Errore di rete. Riprova.', 'danger');
          })
          .finally(function () {
            if (submit) {
              submit.disabled = false;
              setButtonHtml(submit, oldHtml);
            }
          });
      });
    }

    if (verifyForm) {
      verifyForm.addEventListener('submit', function (event) {
        event.preventDefault();
        showAlert('', 'success');
        postForm('customer_verify_profile_email', verifyForm)
          .then(function (payload) {
            if (!payload || !payload.ok) {
              showAlert(payload && payload.error ? payload.error : 'Codice non valido.', 'danger');
              return;
            }
            showAlert(payload.message || 'Nuova email verificata.', 'success');
            setTimeout(function () {
              window.location.reload();
            }, 700);
          })
          .catch(function (error) {
            showAlert(error && error.message ? error.message : 'Errore di rete. Riprova.', 'danger');
          });
      });
    }

    if (resendButton) {
      resendButton.addEventListener('click', function () {
        showAlert('', 'success');
        var oldText = resendButton.textContent;
        resendButton.disabled = true;
        resendButton.textContent = 'Invio...';

        postData('customer_resend_profile_email_code', {})
          .then(function (payload) {
            if (!payload || !payload.ok) {
              showAlert(payload && payload.error ? payload.error : 'Impossibile reinviare il codice.', 'danger');
              return;
            }
            if (payload.pending_email) showVerify(payload.pending_email);
            showAlert(payload.message || 'Codice reinviato.', 'success');
          })
          .catch(function (error) {
            showAlert(error && error.message ? error.message : 'Errore di rete. Riprova.', 'danger');
          })
          .finally(function () {
            resendButton.disabled = false;
            resendButton.textContent = oldText;
          });
      });
    }
  }

  function initSettings() {
    var root = document.querySelector('[data-booking-settings-root]');
    if (!root) return;

    var baseUrl = root.getAttribute('data-base-url') || '';
    var csrf = root.getAttribute('data-csrf') || '';
    var form = document.getElementById('bookingSettingsForm');
    var submit = document.getElementById('bookingSettingsSubmit');
    var alertBox = document.getElementById('bookingSettingsAlert');

    function showAlert(message, tone) {
      if (!alertBox) return;
      alertBox.textContent = message || '';
      alertBox.className = 'booking-settings__alert' + (message ? ' is-' + (tone || 'success') : '');
    }

    if (!form) return;

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      showAlert('', 'success');
      var oldHtml = submit ? submit.innerHTML : '';
      if (submit) {
        submit.disabled = true;
        setButtonHtml(submit, '<span>Salvataggio...</span>');
      }

      var formData = new FormData(form);
      if (csrf) formData.set('_csrf', csrf);

      fetchJson(endpoint(baseUrl, 'customer_update_reference_location'), { method: 'POST', body: formData })
        .then(function (payload) {
          if (!payload || !payload.ok) {
            showAlert(payload && payload.error ? payload.error : 'Impossibile salvare le impostazioni.', 'danger');
            return;
          }
          showAlert(payload.message || 'Impostazioni aggiornate.', 'success');
        })
        .catch(function (error) {
          showAlert(error && error.message ? error.message : 'Errore di rete. Riprova.', 'danger');
        })
        .finally(function () {
          if (submit) {
            submit.disabled = false;
            setButtonHtml(submit, oldHtml);
          }
        });
    });
  }

  ready(function () {
    initProfile();
    initSettings();
  });
})();
