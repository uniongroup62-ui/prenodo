(function () {
  'use strict';

  function ready(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
      return;
    }
    callback();
  }

  function csrfToken() {
    var meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') || '' : '';
  }

  function buildUrl(params) {
    var url = new URL(window.location.href);
    url.searchParams.set('page', 'booking');
    url.searchParams.set('public', '1');
    if (params) {
      Object.keys(params).forEach(function (key) {
        var value = params[key];
        if (value === null) url.searchParams.delete(key);
        else url.searchParams.set(key, String(value));
      });
    }
    return url;
  }

  function hubUrl() {
    return buildUrl({
      mode: null,
      start: null,
      my: null,
      quotes: null,
      packs: null,
      credit: null,
      fidelity: null,
      hub: '1'
    }).toString();
  }

  function fetchJson(url, options) {
    var opt = Object.assign({
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store'
    }, options || {});
    var controller = window.AbortController ? new AbortController() : null;
    var timer = null;

    if (controller) {
      opt.signal = controller.signal;
      timer = window.setTimeout(function () {
        try {
          controller.abort();
        } catch (error) {}
      }, 15000);
    }

    return fetch(url, opt)
      .then(function (response) {
        var contentType = String(response.headers.get('content-type') || '').toLowerCase();
        if (contentType.indexOf('application/json') !== -1) return response.json();
        return response.text().catch(function () {
          return '';
        }).then(function (body) {
          try {
            return JSON.parse(body);
          } catch (error) {}
          var err = new Error('Risposta non valida dal server');
          err.status = response.status;
          err.body = body;
          throw err;
        });
      })
      .finally(function () {
        if (timer) window.clearTimeout(timer);
      });
  }

  function friendlyErr(error) {
    if (error && typeof error === 'object') {
      if (error.name === 'AbortError') {
        return 'La richiesta sta impiegando troppo tempo. Riprova. Se stai usando il booking incorporato (iframe), prova ad aprire il link in una nuova scheda.';
      }
      var status = Number(error.status || 0);
      var body = String(error.body || '').replace(/<[^>]*>/g, '').trim();
      if (status === 403) {
        return body || 'Sessione non valida (cookie bloccati o CSRF non valido). Ricarica la pagina e riprova. Se il booking e incorporato, aprilo in una nuova scheda o abilita i cookie di terze parti.';
      }
      if (body) return body;
    }
    return 'Errore di rete. Riprova.';
  }

  function setButtonLoading(button, html) {
    if (!button) return '';
    var oldHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = html;
    return oldHtml;
  }

  function restoreButton(button, html) {
    if (!button) return;
    button.disabled = false;
    button.innerHTML = html;
  }

  ready(function () {
    var loginGateButton = document.getElementById('gateLogin');
    var registerGateButton = document.getElementById('gateRegister');
    var modalEl = document.getElementById('customerModal');
    if (!loginGateButton && !registerGateButton && !modalEl) return;

    var csrf = csrfToken();
    var modal = modalEl && window.bootstrap && bootstrap.Modal ? new bootstrap.Modal(modalEl) : null;
    var alertBox = document.getElementById('custAuthAlert');
    var verifyBox = document.getElementById('custVerifyBox');
    var verifyEmailEl = document.getElementById('custVerifyEmail');
    var verifyForm = document.getElementById('custVerifyForm');
    var resendButton = document.getElementById('custResendCodeBtn');
    var backButton = document.getElementById('custBackToAuthBtn');
    var forgotBox = document.getElementById('custForgotBox');
    var forgotForm = document.getElementById('custForgotForm');
    var forgotButton = document.getElementById('custForgotBtn');
    var backForgotButton = document.getElementById('custBackFromForgotBtn');
    var tabsEl = modalEl ? modalEl.querySelector('#custTabs') : null;
    var tabContentEl = modalEl ? modalEl.querySelector('.tab-content') : null;

    function showAlert(message, type) {
      if (!alertBox) return;
      alertBox.textContent = message || 'Errore';
      alertBox.classList.remove('d-none');
      alertBox.classList.remove('alert-danger', 'alert-success', 'alert-info', 'alert-warning');
      alertBox.classList.add('alert-' + (type || 'danger'));
    }

    function showErr(message) {
      showAlert(message, 'danger');
    }

    function clearErr() {
      if (!alertBox) return;
      alertBox.classList.add('d-none');
      alertBox.textContent = '';
      alertBox.classList.remove('alert-danger', 'alert-success', 'alert-info', 'alert-warning');
      alertBox.classList.add('alert-danger');
    }

    function showVerify(email) {
      clearErr();
      if (forgotBox) forgotBox.classList.add('d-none');
      if (verifyEmailEl) verifyEmailEl.textContent = email || '';
      try {
        if (verifyBox) {
          var alert = verifyBox.querySelector('.alert');
          if (alert) {
            var note = document.getElementById('custVerifySentMsg');
            if (!note) {
              note = document.createElement('div');
              note.id = 'custVerifySentMsg';
              note.className = 'text-muted small mt-2';
              alert.appendChild(note);
            }
            note.textContent = 'Codice inviato. Controlla la tua email (anche spam).';
          }
        }
      } catch (error) {}
      if (verifyBox) verifyBox.classList.remove('d-none');
      if (tabsEl) tabsEl.classList.add('d-none');
      if (tabContentEl) tabContentEl.classList.add('d-none');
    }

    function hideVerify() {
      clearErr();
      if (verifyBox) verifyBox.classList.add('d-none');
      if (forgotBox) forgotBox.classList.add('d-none');
      if (tabsEl) tabsEl.classList.remove('d-none');
      if (tabContentEl) tabContentEl.classList.remove('d-none');
    }

    function showForgot(prefillEmail) {
      clearErr();
      if (verifyBox) verifyBox.classList.add('d-none');
      if (forgotBox) forgotBox.classList.remove('d-none');
      if (tabsEl) tabsEl.classList.add('d-none');
      if (tabContentEl) tabContentEl.classList.add('d-none');
      try {
        var email = forgotForm ? forgotForm.querySelector('input[name="email"]') : null;
        if (email && prefillEmail) email.value = prefillEmail;
      } catch (error) {}
    }

    function hideForgot() {
      clearErr();
      if (forgotBox) forgotBox.classList.add('d-none');
      if (verifyBox) verifyBox.classList.add('d-none');
      if (tabsEl) tabsEl.classList.remove('d-none');
      if (tabContentEl) tabContentEl.classList.remove('d-none');
    }

    function openModal(tab) {
      if (!modal) return;
      clearErr();
      hideVerify();
      hideForgot();
      var tabButton = document.getElementById(tab === 'register' ? 'tab-register' : 'tab-login');
      if (tabButton && window.bootstrap && bootstrap.Tab) {
        try {
          new bootstrap.Tab(tabButton).show();
        } catch (error) {}
      }
      modal.show();
    }

    function postForm(mode, form) {
      var formData = new FormData(form);
      if (csrf) formData.set('_csrf', csrf);
      return fetchJson(buildUrl({ mode: mode }).toString(), { method: 'POST', body: formData });
    }

    function postData(mode, data) {
      var formData = new FormData();
      if (csrf) formData.set('_csrf', csrf);
      Object.keys(data || {}).forEach(function (key) {
        formData.append(key, data[key]);
      });
      return fetchJson(buildUrl({ mode: mode }).toString(), { method: 'POST', body: formData });
    }

    function goHub() {
      var target = hubUrl();
      if (window.location.href === target) {
        window.location.reload();
        return;
      }
      window.location.href = target;
    }

    if (loginGateButton) {
      loginGateButton.addEventListener('click', function () {
        openModal('login');
      });
    }

    if (registerGateButton) {
      registerGateButton.addEventListener('click', function () {
        openModal('register');
      });
    }

    var loginForm = document.getElementById('custLoginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', function (event) {
        event.preventDefault();
        clearErr();
        var submitButton = event.target.querySelector('button[type="submit"]');
        var oldHtml = setButtonLoading(submitButton, '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Accedo...');
        var email = String(new FormData(event.target).get('email') || '').trim();

        postForm('customer_login', event.target)
          .then(function (payload) {
            if (!payload || !payload.ok) {
              showErr(payload && payload.error ? payload.error : 'Credenziali non valide.');
              return;
            }
            if (payload.requires_verification) {
              showVerify(payload.email || email);
              return;
            }
            goHub();
          })
          .catch(function (error) {
            showErr(friendlyErr(error));
          })
          .finally(function () {
            restoreButton(submitButton, oldHtml);
          });
      });
    }

    var registerForm = document.getElementById('custRegisterForm');
    if (registerForm) {
      registerForm.addEventListener('submit', function (event) {
        event.preventDefault();
        clearErr();
        var form = event.target;
        var p1 = form.querySelector('input[name="password"]') ? form.querySelector('input[name="password"]').value : '';
        var p2 = form.querySelector('input[name="password2"]') ? form.querySelector('input[name="password2"]').value : '';
        if (p1 !== p2) {
          showErr('Le password non coincidono.');
          return;
        }
        var submitButton = form.querySelector('button[type="submit"]');
        var oldHtml = setButtonLoading(submitButton, '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Creo...');
        var email = String(new FormData(form).get('email') || '').trim();

        postForm('customer_register', form)
          .then(function (payload) {
            if (!payload || !payload.ok) {
              showErr(payload && payload.error ? payload.error : "Impossibile creare l'account.");
              return;
            }
            if (payload.requires_verification) {
              showVerify(payload.email || email);
              return;
            }
            goHub();
          })
          .catch(function (error) {
            showErr(friendlyErr(error));
          })
          .finally(function () {
            restoreButton(submitButton, oldHtml);
          });
      });
    }

    if (forgotButton) {
      forgotButton.addEventListener('click', function () {
        try {
          var email = String(document.querySelector('#custLoginForm input[name="email"]') ? document.querySelector('#custLoginForm input[name="email"]').value : '').trim();
          showForgot(email);
        } catch (error) {
          showForgot('');
        }
      });
    }

    if (backForgotButton) backForgotButton.addEventListener('click', hideForgot);
    if (backButton) backButton.addEventListener('click', hideVerify);

    if (forgotForm) {
      forgotForm.addEventListener('submit', function (event) {
        event.preventDefault();
        clearErr();
        var form = event.target;
        var submitButton = form.querySelector('button[type="submit"]');
        var oldHtml = setButtonLoading(submitButton, '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Invio...');
        var email = String(new FormData(form).get('email') || '').trim();

        postData('customer_forgot_password', { email: email })
          .then(function (payload) {
            if (!payload || !payload.ok) {
              showErr(payload && payload.error ? payload.error : 'Impossibile inviare il link.');
              return;
            }
            showAlert(payload.message || "Se l'email esiste, riceverai un link per reimpostare la password.", 'success');
            hideForgot();
          })
          .catch(function (error) {
            showErr(friendlyErr(error));
          })
          .finally(function () {
            restoreButton(submitButton, oldHtml);
          });
      });
    }

    if (resendButton) {
      resendButton.addEventListener('click', function () {
        postData('customer_resend_code', {})
          .then(function (payload) {
            if (!payload || !payload.ok) {
              showErr(payload && payload.error ? payload.error : 'Impossibile reinviare.');
              return;
            }
            try {
              var note = document.getElementById('custVerifySentMsg');
              if (note) note.textContent = 'Codice reinviato. Controlla la tua email (anche spam).';
            } catch (error) {}
            if (payload.email && verifyEmailEl) verifyEmailEl.textContent = payload.email;
          })
          .catch(function (error) {
            showErr(friendlyErr(error));
          });
      });
    }

    if (verifyForm) {
      verifyForm.addEventListener('submit', function (event) {
        event.preventDefault();
        clearErr();
        var submitButton = verifyForm.querySelector('button[type="submit"]');
        var oldHtml = setButtonLoading(submitButton, '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Verifico...');
        var code = String(new FormData(verifyForm).get('code') || '').trim();

        postData('customer_verify_code', { code: code })
          .then(function (payload) {
            if (!payload || !payload.ok) {
              showErr(payload && payload.error ? payload.error : 'Verifica non riuscita.');
              return;
            }
            goHub();
          })
          .catch(function (error) {
            showErr(friendlyErr(error));
          })
          .finally(function () {
            restoreButton(submitButton, oldHtml);
          });
      });
    }
  });
})();
