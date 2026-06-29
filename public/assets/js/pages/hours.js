(function(){
  'use strict';

  document.addEventListener('click', function(event){
    var confirmEl = event.target && event.target.closest ? event.target.closest('[data-confirm]') : null;
    if (!confirmEl) return;
    var message = confirmEl.getAttribute('data-confirm') || 'Confermare?';
    if (!window.confirm(message)) event.preventDefault();
  });

document.addEventListener('DOMContentLoaded', function(){
  const tbody = document.getElementById('hoursTable');
  if(!tbody) return;

  const form = tbody.closest('form');

  function toMin(v){
    v = String(v || '').trim();
    if(!v) return null;
    const parts = v.split(':');
    if(parts.length < 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if(Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  }

  function setValidity(input, msg){
    if(!input) return;
    input.setCustomValidity(msg || '');
    if(msg){
      input.classList.add('is-invalid');
    } else {
      input.classList.remove('is-invalid');
    }
  }

  function clearRowValidity(dow){
    const main = getRow(dow, 'main');
    const split = getRow(dow, 'split');
    [main, split].forEach(r => {
      if(!r) return;
      r.querySelectorAll('input[type="time"]').forEach(i => setValidity(i, ''));
    });
  }

  function validateDow(dow){
    const main = getRow(dow, 'main');
    const split = getRow(dow, 'split');
    if(!main || !split) return true;

    const closed = !!(main.querySelector('.js-closed') && main.querySelector('.js-closed').checked);
    if(closed){
      clearRowValidity(dow);
      return true;
    }

    const opens = main.querySelector('input[name="hours[' + dow + '][opens]"]');
    const closes = main.querySelector('input[name="hours[' + dow + '][closes]"]');
    const opens2 = split.querySelector('input[name="hours[' + dow + '][opens2]"]');
    const closes2 = split.querySelector('input[name="hours[' + dow + '][closes2]"]');

    // Aggiorna i min per aiutare l'utente
    if(closes){
      if(opens && opens.value) closes.min = opens.value; else closes.removeAttribute('min');
    }
    if(opens2){
      if(closes && closes.value) opens2.min = closes.value; else opens2.removeAttribute('min');
    }
    if(closes2){
      if(opens2 && opens2.value) closes2.min = opens2.value; else closes2.removeAttribute('min');
    }

    // Reset
    clearRowValidity(dow);

    let ok = true;

    const o = toMin(opens && opens.value);
    const c = toMin(closes && closes.value);

    if(!opens.value || !closes.value){
      ok = false;
      if(!opens.value) setValidity(opens, 'Compila anche l\'apertura');
      if(!closes.value) setValidity(closes, 'Compila anche la chiusura');
    } else if(o !== null && c !== null && c <= o){
      ok = false;
      setValidity(closes, 'La chiusura deve essere successiva all\'apertura');
    }

    const o2 = toMin(opens2 && opens2.value);
    const c2 = toMin(closes2 && closes2.value);

    if((opens2 && opens2.value) || (closes2 && closes2.value)){
      // Split richiede la prima fascia
      if(!opens.value || !closes.value){
        ok = false;
        setValidity(opens2, 'Compila prima apertura/chiusura');
        setValidity(closes2, 'Compila prima apertura/chiusura');
      } else {
        if(!opens2.value || !closes2.value){
          ok = false;
          if(!opens2.value) setValidity(opens2, 'Compila anche la riapertura');
          if(!closes2.value) setValidity(closes2, 'Compila anche la chiusura 2');
        } else {
          if(o2 !== null && c !== null && o2 < c){
            ok = false;
            setValidity(opens2, 'La riapertura deve essere uguale o successiva alla chiusura');
          }
          if(o2 !== null && c2 !== null && c2 <= o2){
            ok = false;
            setValidity(closes2, 'La chiusura 2 deve essere successiva alla riapertura');
          }
        }
      }
    }

    return ok;
  }

  function getRow(dow, role){
    return tbody.querySelector('tr[data-dow="' + dow + '"][data-role="' + role + '"]');
  }

  function hasSplitValues(splitRow){
    if(!splitRow) return false;
    const inputs = splitRow.querySelectorAll('input[type="time"]');
    for(const i of inputs){
      if(String(i.value || '').trim() !== '') return true;
    }
    return false;
  }

  function setSplit(dow, active, clear){
    const main = getRow(dow, 'main');
    const split = getRow(dow, 'split');
    if(!main || !split) return;

    const closed = !!(main.querySelector('.js-closed') && main.querySelector('.js-closed').checked);
    const btnAdd = main.querySelector('.js-add-split');
    const btnRem = main.querySelector('.js-remove-split');

    if(closed){
      // Se il giorno è chiuso, nascondi sempre (ma NON cancellare i valori)
      split.classList.add('d-none');
      if(btnAdd) btnAdd.classList.add('d-none');
      if(btnRem) btnRem.classList.add('d-none');
      return;
    }

    if(active){
      split.classList.remove('d-none');
      if(btnAdd) btnAdd.classList.add('d-none');
      if(btnRem) btnRem.classList.remove('d-none');
      // focus sul primo campo della seconda fascia
      const first = split.querySelector('input[name^="hours["]');
      if(first) setTimeout(() => { try{ first.focus(); }catch(_e){} }, 0);
    } else {
      split.classList.add('d-none');
      if(btnAdd) btnAdd.classList.remove('d-none');
      if(btnRem) btnRem.classList.add('d-none');
      if(clear){
        split.querySelectorAll('input[type="time"]').forEach(i => { i.value = ''; });
      }
    }
  }

  function syncRow(dow){
    const main = getRow(dow, 'main');
    const split = getRow(dow, 'split');
    if(!main || !split) return;
    const closed = !!(main.querySelector('.js-closed') && main.querySelector('.js-closed').checked);
    if(closed){
      setSplit(dow, false, false);
      return;
    }
    const active = !split.classList.contains('d-none') || hasSplitValues(split);
    setSplit(dow, active, false);
  }

  // Handlers
  tbody.querySelectorAll('.js-add-split').forEach(btn => {
    btn.addEventListener('click', function(){
      const dow = String(this.dataset.dow || '');
      if(!dow) return;
      setSplit(dow, true, false);
      validateDow(dow);
    });
  });

  tbody.querySelectorAll('.js-remove-split').forEach(btn => {
    btn.addEventListener('click', function(){
      const dow = String(this.dataset.dow || '');
      if(!dow) return;
      if(!confirm('Rimuovere l\'orario spezzato per questo giorno?')) return;
      setSplit(dow, false, true);
      validateDow(dow);
    });
  });

  tbody.querySelectorAll('.js-closed').forEach(chk => {
    chk.addEventListener('change', function(){
      const dow = String(this.dataset.dow || '');
      if(!dow) return;
      syncRow(dow);
      validateDow(dow);
    });
  });

  // Validazione live sugli input time
  tbody.addEventListener('input', function(e){
    const t = e.target;
    if(!t || !(t instanceof HTMLElement)) return;
    if(!t.matches('input[type="time"]')) return;
    const tr = t.closest('tr[data-dow]');
    if(!tr) return;
    const dow = String(tr.getAttribute('data-dow') || '');
    if(dow) validateDow(dow);
  });

  // Blocco submit se invalido
  if(form){
    form.addEventListener('submit', function(e){
      let firstInvalid = null;
      tbody.querySelectorAll('tr.hours-row[data-role="main"]').forEach(tr => {
        const dow = String(tr.getAttribute('data-dow') || '');
        if(!dow) return;
        const ok = validateDow(dow);
        if(!ok && !firstInvalid){
          firstInvalid = tbody.querySelector('tr[data-dow="' + dow + '"] input.is-invalid');
        }
      });
      if(firstInvalid){
        e.preventDefault();
        try{ firstInvalid.focus(); firstInvalid.reportValidity(); }catch(_e){}
      }
    });
  }

  // Initial sync
  tbody.querySelectorAll('tr.hours-row[data-role="main"]').forEach(tr => {
    const dow = String(tr.getAttribute('data-dow') || '');
    if(dow) syncRow(dow);
    if(dow) validateDow(dow);
  });
});

document.addEventListener('DOMContentLoaded', function(){
  const splitRow = document.getElementById('exceptionSplitRow');
  const o2 = document.getElementById('exceptionOpens2');
  const c2 = document.getElementById('exceptionCloses2');
  const btnAdd = document.getElementById('btnAddExceptionSplit');
  const btnRem = document.getElementById('btnRemoveExceptionSplit');

  function setSplit(active, clear){
    if(!splitRow) return;
    if(active){
      splitRow.classList.remove('d-none');
      if(btnAdd) btnAdd.classList.add('d-none');
      if(btnRem) btnRem.classList.remove('d-none');
      try{ o2 && o2.focus(); }catch(e){}
    } else {
      splitRow.classList.add('d-none');
      if(btnAdd) btnAdd.classList.remove('d-none');
      if(btnRem) btnRem.classList.add('d-none');
      if(clear){
        if(o2) o2.value='';
        if(c2) c2.value='';
      }
    }
  }

  const hasSplit = ((o2 && o2.value) || (c2 && c2.value));
  setSplit(!!hasSplit, false);

  if(btnAdd) btnAdd.addEventListener('click', function(){ setSplit(true, false); });
  if(btnRem) btnRem.addEventListener('click', function(){ if(confirm('Rimuovere l\'orario spezzato?')) setSplit(false, true); });
});
})();
