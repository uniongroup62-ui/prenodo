(() => {

function plannerParseJsonScript(id){
  const el = document.getElementById(id);
  if (!el) return null;
  try {
    const raw = String(el.textContent || '').trim();
    return raw ? JSON.parse(raw) : null;
  } catch(e) {
    return null;
  }
}

const PLANNER_CONFIG = plannerParseJsonScript('appointmentsPlanConfig') || {};

// Planner: Cliente (come schermata prenotazione)
const planClientId = document.getElementById('plan_client_id');
const planNewBox = document.getElementById('planNewClientBox');
const planSelBox = document.getElementById('planSelectedClientBox');
const planSelName = document.getElementById('planSelName');
const planSelEmail = document.getElementById('planSelEmail');
const planSelPhone = document.getElementById('planSelPhone');
const planClearSel = document.getElementById('planClearSelectedClient');
const planLinkNew = document.getElementById('planLinkNewClient');
const planLinkFind = document.getElementById('planLinkFindClient');

const planNewName = document.getElementById('plan_new_full_name');
const planNewPhone = document.getElementById('plan_new_phone');
const planNewEmail = document.getElementById('plan_new_email');

const planFindModalEl = document.getElementById('planClientFindModal');
const planFindQuery = document.getElementById('planClientFindQuery');
const planFindClear = document.getElementById('planClientFindClear');
const planFindResults = document.getElementById('planClientFindResults');

// Bootstrap JS viene caricato nel footer (dopo questo script), quindi qui potrebbe
// non essere ancora disponibile. Creiamo l'istanza del modal "lazy" al primo uso.
let planFindModal = null;
function getPlanFindModal(){
  if(planFindModal) return planFindModal;
  try{
    if(planFindModalEl && window.bootstrap && bootstrap.Modal){
      planFindModal = (bootstrap.Modal.getOrCreateInstance)
        ? bootstrap.Modal.getOrCreateInstance(planFindModalEl)
        : new bootstrap.Modal(planFindModalEl);
    }
  } catch(_){ planFindModal = null; }
  return planFindModal;
}

function planEsc(s){
  return String(s ?? '').replace(/[&<>\"']/g, (c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}

function planToggleBox(el, show){
  if(!el) return;
  el.classList.toggle('d-none', !show);
  el.style.display = '';
}

function planShowNew(){
  if(planClientId) planClientId.value = '';
  planToggleBox(planSelBox, false);
  planToggleBox(planNewBox, true);
}

function planSetSelected(c){
  if(!c) return;
  if(planClientId) planClientId.value = String(c.id || '');
  if(planSelName) planSelName.textContent = String(c.full_name || '');
  if(planSelEmail) planSelEmail.textContent = String(c.email || '—');
  if(planSelPhone) planSelPhone.textContent = String(c.phone || '—');
  planToggleBox(planSelBox, true);
  planToggleBox(planNewBox, false);
  // Evita creazione involontaria di un nuovo cliente
  if(planNewName) planNewName.value = '';
  if(planNewPhone) planNewPhone.value = '';
  if(planNewEmail) planNewEmail.value = '';
}

function planRenderClients(list){
  if(!planFindResults) return;
  if(!list || !list.length){
    planFindResults.innerHTML = '<div class="text-muted small p-2">Nessun risultato.</div>';
    return;
  }
  planFindResults.innerHTML = list.map(c => `
    <button type="button" class="list-group-item list-group-item-action"
            data-id="${planEsc(c.id)}"
            data-name="${planEsc(c.full_name)}"
            data-email="${planEsc(c.email)}"
            data-phone="${planEsc(c.phone)}">
      <div class="fw-semibold text-primary">${planEsc(c.full_name)}</div>
      <div class="small text-muted">Email: ${planEsc(c.email)||'—'}</div>
      <div class="small text-muted">Telefono: ${planEsc(c.phone)||'—'}</div>
    </button>
  `).join('');
}

if(planLinkNew) planLinkNew.addEventListener('click', (e)=>{ e.preventDefault(); planShowNew(); });
if(planClearSel) planClearSel.addEventListener('click', (e)=>{ e.preventDefault(); planShowNew(); });

if(planLinkFind) planLinkFind.addEventListener('click', (e)=>{
  e.preventDefault();
  const modal = getPlanFindModal();
  if(!modal) return;
  if(planFindResults) planFindResults.innerHTML = '';
  if(planFindQuery) planFindQuery.value = '';
  modal.show();
  setTimeout(()=>{ try{ planFindQuery && planFindQuery.focus(); }catch(_){} }, 150);
});

let planTimer = null;
if(planFindQuery) planFindQuery.addEventListener('input', ()=>{
  const q = (planFindQuery.value || '').trim();
  if(planTimer) clearTimeout(planTimer);
  planTimer = setTimeout(async ()=>{
    if(!q){ planRenderClients([]); return; }
    try{
      const res = await fetch('index.php?page=api_clients&action=search&exclude_blocked=1&q=' + encodeURIComponent(q));
      const data = await res.json();
      if(!data.ok){ planRenderClients([]); return; }
      planRenderClients(data.clients || []);
    } catch(_){ planRenderClients([]); }
  }, 200);
});

if(planFindClear) planFindClear.addEventListener('click', ()=>{
  if(planFindQuery) planFindQuery.value = '';
  if(planFindResults) planFindResults.innerHTML = '';
  try{ planFindQuery && planFindQuery.focus(); }catch(_){}
});

if(planFindResults) planFindResults.addEventListener('click', (e)=>{
  const btn = e.target.closest('[data-id]');
  if(!btn) return;
  const c = {
    id: btn.dataset.id,
    full_name: btn.dataset.name,
    email: btn.dataset.email,
    phone: btn.dataset.phone
  };
  planSetSelected(c);
  try{ const m = getPlanFindModal(); m && m.hide(); }catch(_){ }
});


const msRoot = document.getElementById('planner_services_ms');
const msControl = document.getElementById('planner_ms_control');
const msDropdown = document.getElementById('planner_ms_dropdown');
const pillsEl = document.getElementById('planner_ms_pills');
const placeholderEl = document.getElementById('planner_ms_placeholder');
const serviceSearch = document.getElementById('planner_service_search');

const fromEl = document.getElementById('plannerTimeFrom');
const toEl = document.getElementById('plannerTimeTo');
const startDateEl = document.getElementById('plannerStartDate');

const staffBox = document.getElementById('plannerStaffPerService');
const INITIAL_STAFF_MAP = PLANNER_CONFIG.initialStaffMap || {};
const CABINS_ENABLED = !!PLANNER_CONFIG.cabinsEnabled;
const CABINS_BY_SERVICE = PLANNER_CONFIG.cabinsByService || {};
const CABINS_BY_ID = PLANNER_CONFIG.cabinsById || {};
const INITIAL_CABIN_MAP = PLANNER_CONFIG.initialCabinMap || {};

// Cabins are selectable ONLY after Anteprima, when we know the actual slot.
const PLANNER_HAS_PREVIEW = !!PLANNER_CONFIG.hasPreview;
const PLANNER_CABIN_AVAIL = PLANNER_CONFIG.cabinAvail || {};

function getAllServiceChecks(){
  return msRoot ? Array.from(msRoot.querySelectorAll('.qb-ms-check')) : [];
}

// Avoid relying on CSS.escape (missing in some browsers / embedded webviews).
function findServiceCheckById(serviceId){
  const sid = String(serviceId || '');
  if(!sid) return null;
  const checks = getAllServiceChecks();
  for(const ch of checks){
    if(String(ch.value) === sid) return ch;
  }
  return null;
}

function getSelectedServiceIds(){
  return getAllServiceChecks()
    .filter(ch => ch.checked)
    .map(ch => parseInt(ch.value, 10))
    .filter(n => Number.isFinite(n) && n > 0);
}

function getServiceLabel(serviceId){
  const sid = String(serviceId || '');
  const ch = findServiceCheckById(sid);
  if (!ch) return 'Servizio ' + sid;
  const name = (ch.dataset && ch.dataset.name) ? String(ch.dataset.name) : '';
  return name || ('Servizio ' + sid);
}

function renderPills(){
  if(!pillsEl || !placeholderEl) return;
  pillsEl.innerHTML = '';
  const checks = getAllServiceChecks().filter(ch => ch.checked);
  placeholderEl.hidden = checks.length > 0;

  for(const ch of checks){
    const name = (ch.dataset && ch.dataset.name) ? ch.dataset.name : ch.value;

    const pill = document.createElement('span');
    pill.className = 'badge bg-primary d-inline-flex align-items-center me-1 mb-1 qb-ms-pill';
    pill.append(document.createTextNode(name));

    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'btn-close btn-close-white ms-2';
    x.setAttribute('aria-label', 'Rimuovi');
    x.dataset.removeId = String(ch.value);

    pill.appendChild(x);
    pillsEl.appendChild(pill);
  }
}

function applyServiceSearchFilter(q){
  if(!msRoot) return;
  const needle = String(q||'').trim().toLowerCase();

  const items = Array.from(msRoot.querySelectorAll('.qb-ms-item'));
  for(const it of items){
    const hay = (it.getAttribute('data-name') || it.textContent || '').toLowerCase();
    it.hidden = needle ? !hay.includes(needle) : false;
  }

  const groups = Array.from(msRoot.querySelectorAll('.qb-ms-group'));
  for(const g of groups){
    const anyVisible = Array.from(g.querySelectorAll('.qb-ms-item')).some(it => !it.hidden);
    g.hidden = !anyVisible;
  }
}

function openDropdown(){
  if(!msDropdown || !msControl) return;
  msDropdown.hidden = false;
  msControl.setAttribute('aria-expanded', 'true');
  if(serviceSearch){
    serviceSearch.value = '';
    applyServiceSearchFilter('');
    setTimeout(()=>serviceSearch.focus(), 0);
  }
}

function closeDropdown(){
  if(!msDropdown || !msControl) return;
  msDropdown.hidden = true;
  msControl.setAttribute('aria-expanded', 'false');
  if(serviceSearch){
    serviceSearch.value = '';
    applyServiceSearchFilter('');
  }
}

function toggleDropdown(){
  if(!msDropdown || msDropdown.hidden) openDropdown(); else closeDropdown();
}

// Init planner multiselect (Servizi)
if(msRoot && msControl && msDropdown){
  renderPills();

  msControl.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDropdown();
  });

  msControl.addEventListener('keydown', (e) => {
    if(e.key === 'Enter' || e.key === ' '){
      e.preventDefault();
      toggleDropdown();
    } else if(e.key === 'Escape'){
      closeDropdown();
    }
  });

  document.addEventListener('click', (e) => {
    if(!msRoot.contains(e.target)) closeDropdown();
  });

  if(serviceSearch){
    serviceSearch.addEventListener('input', () => applyServiceSearchFilter(serviceSearch.value));
    serviceSearch.addEventListener('keydown', (e) => {
      if(e.key === 'Escape'){
        e.preventDefault();
        closeDropdown();
        msControl && msControl.focus();
      }
    });
  }

  // Re-render pills on change, plus keep search filter applied
  msRoot.addEventListener('change', (e) => {
    if(!e.target || !e.target.classList || !e.target.classList.contains('qb-ms-check')) return;
    renderPills();
  });

  // Remove pills
  if(pillsEl){
    pillsEl.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest ? e.target.closest('button[data-remove-id]') : null;
      if(!btn) return;
      const id = btn.getAttribute('data-remove-id');
      const ch = findServiceCheckById(String(id));
      if(ch){
        ch.checked = false;
        ch.dispatchEvent(new Event('change', {bubbles:true}));
      }
    });
  }
}

  let staffReqToken = 0;
  async function fetchStaffMap(serviceIds){
    const ids = (Array.isArray(serviceIds) ? serviceIds : []).map(x => parseInt(x,10)).filter(n => n>0);
    if(!ids.length) return {};
    const tok = ++staffReqToken;
    try{
      const url = 'index.php?page=api_appointments&action=staff_for_services&service_ids=' + encodeURIComponent(ids.join(','));
      const res = await fetch(url, {credentials:'same-origin'});
      const data = await res.json();
      if(tok !== staffReqToken) return null;
      if(data && data.ok && data.staff_map) return data.staff_map;
    }catch(_){ /* ignore */ }
    if(tok !== staffReqToken) return null;
    return {};
  }

  async function renderStaffSelectors(){
    if (!staffBox) return;

    // Preserve current selections in UI (if any)
    const currentStaff = {...(INITIAL_STAFF_MAP || {})};
    staffBox.querySelectorAll('select[data-service-id]').forEach(sel => {
      const sid = parseInt(sel.getAttribute('data-service-id') || '0', 10);
      const v = parseInt(sel.value || '0',10);
      if (sid>0 && v>0) currentStaff[sid]=v;
    });

    const currentCabin = {...(INITIAL_CABIN_MAP || {})};
    staffBox.querySelectorAll('select[data-cabin-service-id]').forEach(sel => {
      const sid = parseInt(sel.getAttribute('data-cabin-service-id') || '0', 10);
      const v = parseInt(sel.value || '0',10);
      if (sid>0) currentCabin[sid]=v;
    });

    const selected = getSelectedServiceIds();

    if (!selected.length){
      staffBox.innerHTML = "<div class=\"text-muted small\">Seleziona uno o più servizi per scegliere l'operatore.</div>";
      return;
    }

    staffBox.innerHTML = '<div class="text-muted small">Caricamento operatori...</div>';
    const staffMap = await fetchStaffMap(selected);
    if(staffMap === null) return;

    staffBox.innerHTML = '';

    selected.forEach(serviceId => {
      const listRaw = staffMap?.[String(serviceId)] || staffMap?.[serviceId];
      const list = Array.isArray(listRaw) ? listRaw : [];
      const elig = list.map(x => ({
        id: parseInt(x.id,10),
        name: (x.full_name || x.name || '').trim()
      })).filter(x => x.id>0);

      const row = document.createElement('div');
      row.className = 'd-flex flex-wrap align-items-center gap-2 mb-2';

      const label = document.createElement('div');
      label.className = 'small fw-semibold';
      label.style.minWidth = '180px';
      label.textContent = getServiceLabel(serviceId);
      row.appendChild(label);

      // --- Operator select ---
      if (elig.length===0){
        const sel = document.createElement('select');
        sel.className = 'form-select form-select-sm';
        sel.style.maxWidth = '260px';
        sel.disabled = true;

        const o = document.createElement('option');
        o.value = '';
        o.textContent = 'Nessun operatore';
        sel.appendChild(o);

        row.appendChild(sel);
      } else if (elig.length===1){
        // Auto-assign unique operator (come Nuova prenotazione)
        const hid = document.createElement('input');
        hid.type = 'hidden';
        hid.name = `staff_map[${serviceId}]`;
        hid.value = String(elig[0].id);
        row.appendChild(hid);

        const sel = document.createElement('select');
        sel.className = 'form-select form-select-sm';
        sel.style.maxWidth = '260px';
        sel.disabled = true;

        const o = document.createElement('option');
        o.value = String(elig[0].id);
        o.textContent = elig[0].name || ('ID ' + elig[0].id);
        sel.appendChild(o);

        row.appendChild(sel);
      } else {
        const sel = document.createElement('select');
        sel.className = 'form-select form-select-sm';
        sel.style.maxWidth = '260px';
        sel.name = `staff_map[${serviceId}]`;
        sel.setAttribute('data-service-id', String(serviceId));

        const ph = document.createElement('option');
        ph.value = '';
        ph.textContent = '(seleziona)';
        sel.appendChild(ph);

        elig.forEach(st => {
          const o = document.createElement('option');
          o.value = String(st.id);
          o.textContent = st.name || ('ID ' + st.id);
          sel.appendChild(o);
        });

        const pref = parseInt(currentStaff?.[serviceId] || '0',10);
        if (pref>0) sel.value = String(pref);

        row.appendChild(sel);
      }

      // --- Cabin select (optional) ---
      if (CABINS_ENABLED){
        const cwrap = document.createElement('div');
        cwrap.className = 'd-flex align-items-center gap-2';

        const clabel = document.createElement('div');
        clabel.className = 'small text-muted';
        clabel.textContent = 'Cabina';
        cwrap.appendChild(clabel);

        const cabinName = (cid) => {
          const k = String(cid || '');
          const obj = CABINS_BY_ID?.[k] || CABINS_BY_ID?.[cid];
          const nm = obj && (obj.name || obj.full_name) ? String(obj.name || obj.full_name) : '';
          return (nm || ('Cabina ' + k)).trim();
        };

        const avail = PLANNER_CABIN_AVAIL?.[String(serviceId)] || PLANNER_CABIN_AVAIL?.[serviceId];
        const freeIds = Array.isArray(avail?.free_ids)
          ? avail.free_ids.map(x => parseInt(x,10)).filter(n => Number.isFinite(n) && n>0)
          : null;

        // Gate cabin selection until Anteprima.
        if (!PLANNER_HAS_PREVIEW){
          const hid = document.createElement('input');
          hid.type = 'hidden';
          hid.name = `cabin_map[${serviceId}]`;
          hid.value = '0';
          cwrap.appendChild(hid);

          const sel = document.createElement('select');
          sel.className = 'form-select form-select-sm';
          sel.style.maxWidth = '220px';
          sel.disabled = true;

          const o = document.createElement('option');
          o.value = '0';
          o.textContent = '(Premi Anteprima)';
          sel.appendChild(o);
          cwrap.appendChild(sel);
        } else {
          // Prefer cabins free on the preview slot; fallback to allowed cabins list.
          let cabins = [];
          if (freeIds && freeIds.length){
            cabins = freeIds.map(cid => ({id: cid, name: cabinName(cid)}));
          } else {
            const cListRaw = CABINS_BY_SERVICE?.[String(serviceId)] || CABINS_BY_SERVICE?.[serviceId];
            const cList = Array.isArray(cListRaw) ? cListRaw : [];
            cabins = cList.map(x => ({
              id: parseInt(x.id,10),
              name: (x.name || '').trim() || cabinName(x.id)
            })).filter(x => x.id>0);
          }

          if (cabins.length===0){
            const sel = document.createElement('select');
            sel.className = 'form-select form-select-sm';
            sel.style.maxWidth = '220px';
            sel.disabled = true;
            const o = document.createElement('option');
            o.value = '';
            o.textContent = 'Nessuna cabina';
            sel.appendChild(o);
            cwrap.appendChild(sel);
          } else if (cabins.length===1){
            // One free cabin: auto-select it (same UX as quickbooking)
            const hid = document.createElement('input');
            hid.type = 'hidden';
            hid.name = `cabin_map[${serviceId}]`;
            hid.value = String(cabins[0].id);
            cwrap.appendChild(hid);

            const sel = document.createElement('select');
            sel.className = 'form-select form-select-sm';
            sel.style.maxWidth = '220px';
            sel.disabled = true;

            const o = document.createElement('option');
            o.value = String(cabins[0].id);
            o.textContent = cabins[0].name || ('ID ' + cabins[0].id);
            sel.appendChild(o);
            cwrap.appendChild(sel);
	          } else {
            const sel = document.createElement('select');
            sel.className = 'form-select form-select-sm';
            sel.style.maxWidth = '220px';
            sel.name = `cabin_map[${serviceId}]`;
            sel.setAttribute('data-cabin-service-id', String(serviceId));

	            const freeSet = new Set(cabins.map(x => x.id));
            cabins.forEach(cb => {
              const o = document.createElement('option');
              o.value = String(cb.id);
              o.textContent = cb.name || ('ID ' + cb.id);
              sel.appendChild(o);
            });

	            // No "(Auto)" option: always show / keep a real cabin where possible.
	            const pref = parseInt(currentCabin?.[serviceId] || '0',10);
	            if (pref>0 && freeSet.has(pref)) sel.value = String(pref);
	            else if (cabins.length) sel.value = String(cabins[0].id);

            cwrap.appendChild(sel);
          }
        }

        row.appendChild(cwrap);
      }

      staffBox.appendChild(row);
    });

    // Keep the "Crea appuntamenti" form in sync with cabin selections.
    plannerSyncCabinsToCreateForm();
  }

  function plannerGetCreateForm(){
    return document.getElementById('plannerCreateForm');
  }

  function plannerExtractServiceIdFromName(name){
    const m = String(name || '').match(/^cabin_map\[(\d+)\]$/);
    return m ? parseInt(m[1],10) : 0;
  }

  function plannerFindHiddenByName(form, name){
    if(!form) return null;
    const inputs = form.querySelectorAll('input[type="hidden"]');
    for(const inp of inputs){
      if(String(inp.name || '') === String(name || '')) return inp;
    }
    return null;
  }

  function plannerSyncCabinsToCreateForm(){
    const cf = plannerGetCreateForm();
    if(!cf || !staffBox) return;

    const cabinVals = {};
    staffBox.querySelectorAll('input[type="hidden"][name^="cabin_map["], select[name^="cabin_map["]')
      .forEach(el => {
        const sid = plannerExtractServiceIdFromName(el.name);
        if(!sid) return;
        cabinVals[sid] = String(el.value ?? '0');
      });

    Object.keys(cabinVals).forEach(sid => {
      const name = `cabin_map[${sid}]`;
      let hid = plannerFindHiddenByName(cf, name);
      if(!hid){
        hid = document.createElement('input');
        hid.type = 'hidden';
        hid.name = name;
        cf.appendChild(hid);
      }
      hid.value = cabinVals[sid];
    });
  }

  // Render operator selectors based on selected services
  if (msRoot) {
    msRoot.addEventListener('change', ()=>{ renderStaffSelectors(); });
    renderStaffSelectors();
  }

  // When changing cabin selection after preview, keep the create form in sync.
  if (staffBox) {
    staffBox.addEventListener('change', (e)=>{
      const t = e.target;
      if (t && t.matches && t.matches('select[name^="cabin_map["]')) {
        plannerSyncCabinsToCreateForm();
      }
    });
  }

  const weekdayEls = Array.from(document.querySelectorAll('input[name="weekdays[]"]'));

  // --- Auto-calcolo "Alle ore" (minimo) = "Dalle ore" + durata servizi ---
  if (msRoot && fromEl && toEl) {
    let computedMinEnd = null;

    const parseHHMM = (v) => {
      if (!v || typeof v !== 'string') return null;
      const m = v.trim().match(/^(\d{1,2}):(\d{2})$/);
      if (!m) return null;
      const h = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10);
      if (Number.isNaN(h) || Number.isNaN(mm) || h < 0 || h > 23 || mm < 0 || mm > 59) return null;
      return h * 60 + mm;
    };

    const fmtHHMM = (mins) => {
      const h = Math.floor(mins / 60);
      const mm = mins - (h * 60);
      const hh = String(h).padStart(2, '0');
      const m2 = String(mm).padStart(2, '0');
      return `${hh}:${m2}`;
    };

    
const totalDurationMin = () => {
  let total = 0;
  const checks = getAllServiceChecks();
  for (const ch of checks) {
    if (!ch.checked) continue;
    const d = parseInt((ch.dataset && (ch.dataset.dur || ch.dataset.duration)) || '0', 10);
    if (!Number.isNaN(d) && d > 0) total += d;
  }
  return total;
};

    const recomputeEndTime = () => {
      const startMin = parseHHMM(fromEl.value);
      const dur = totalDurationMin();
      if (startMin === null || dur <= 0) {
        computedMinEnd = null;
        toEl.removeAttribute('min');
        return;
      }

      let endMin = startMin + dur;
      // Evita overflow oltre fine giornata (non gestiamo appuntamenti che passano al giorno dopo)
      const max = (23 * 60) + 59;
      if (endMin > max) endMin = max;

      computedMinEnd = endMin;
      const minStr = fmtHHMM(endMin);
      // Impedisce selezioni "indietro" (browser/timepicker)
      toEl.min = minStr;

      // Se l'utente aveva scelto un end >= min, lo teniamo. Altrimenti impostiamo il minimo.
      const curEnd = parseHHMM(toEl.value);
      if (curEnd === null || curEnd < endMin) {
        toEl.value = minStr;
      }
    };

    msRoot.addEventListener('change', recomputeEndTime);
    fromEl.addEventListener('input', recomputeEndTime);
    // Ulteriore guard: se il timepicker consente input manuale, blocca comunque valori < min.
    toEl.addEventListener('input', () => {
      if (computedMinEnd === null) return;
      const curEnd = parseHHMM(toEl.value);
      if (curEnd !== null && curEnd < computedMinEnd) {
        toEl.value = fmtHHMM(computedMinEnd);
      }
    });
    toEl.addEventListener('change', () => {
      if (computedMinEnd === null) return;
      const curEnd = parseHHMM(toEl.value);
      if (curEnd !== null && curEnd < computedMinEnd) {
        toEl.value = fmtHHMM(computedMinEnd);
      }
    });
    // Prima valorizzazione (utile se la pagina ricarica con valori già selezionati)
    recomputeEndTime();
  }

  // --- Auto-calcolo "Dal giorno" in base ai giorni della settimana selezionati ---
  // Regola: quando sono selezionati uno o più giorni, "Dal giorno" viene impostato
  // automaticamente alla prossima occorrenza (strettamente successiva a oggi) del giorno più vicino.
  // Inoltre non si può selezionare una data precedente (min).
  if (startDateEl && weekdayEls.length) {
    const pad2 = (n) => String(n).padStart(2, '0');
    const fmtDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

    const selectedWeekdays = () => weekdayEls
      .filter((el) => el && el.checked)
      .map((el) => parseInt(el.value, 10))
      .filter((n) => Number.isFinite(n) && n >= 0 && n <= 6);

    // Per "Dal giorno" limitiamo la selezione al primo giorno selezionato (ordine Lun->Dom).
    // Esempio: Lun+Mar => nel datepicker sono ammessi solo i Lunedì (il calendario poi creerà anche i Martedì).
    const anchorWeekday = (wds) => {
      const order = [1, 2, 3, 4, 5, 6, 0];
      let best = null;
      let bestIdx = 999;
      for (const wd of (wds || [])) {
        const idx = order.indexOf(wd);
        if (idx >= 0 && idx < bestIdx) {
          bestIdx = idx;
          best = wd;
        }
      }
      return best;
    };

    const parseISODate = (s) => {
      if (!s || typeof s !== 'string') return null;
      const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return null;
      const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
      d.setHours(0, 0, 0, 0);
      return Number.isFinite(d.getTime()) ? d : null;
    };

    const nextAllowedOnOrAfter = (from, wds) => {
      const d = new Date(from);
      d.setHours(0, 0, 0, 0);
      for (let i = 0; i < 370; i++) {
        if (!wds.length || wds.includes(d.getDay())) return d;
        d.setDate(d.getDate() + 1);
      }
      return d;
    };

    // Min date:
    // - sempre non retroattiva (>= oggi)
    // - se seleziono giorni della settimana: dalla prossima occorrenza (strettamente successiva a oggi)
    //   di uno dei giorni selezionati.
    const computeMinStartDate = (wds) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (!wds.length) return today;
      const base = new Date(today);
      base.setDate(base.getDate() + 1); // escludi oggi
      return nextAllowedOnOrAfter(base, wds);
    };

    // Normalizza start_date per:
    // - rispettare min (non retroattiva)
    // - rispettare i giorni della settimana selezionati (se presenti)
    const normalizeStartDate = () => {
      const selected = selectedWeekdays();
      const anchor = selected.length ? anchorWeekday(selected) : null;
      const allowedForStart = anchor === null ? [] : [anchor];

      const minDate = computeMinStartDate(allowedForStart);
      const minStr = fmtDate(minDate);
      startDateEl.min = minStr;

      const cur = parseISODate(startDateEl.value);
      let candidate = cur || minDate;
      if (candidate < minDate) candidate = minDate;
      if (allowedForStart.length && !allowedForStart.includes(candidate.getDay())) {
        candidate = nextAllowedOnOrAfter(candidate, allowedForStart);
      }
      const candStr = fmtDate(candidate);
      if (!startDateEl.value || startDateEl.value !== candStr) startDateEl.value = candStr;
    };

    weekdayEls.forEach((el) => el.addEventListener('change', normalizeStartDate));
    startDateEl.addEventListener('input', normalizeStartDate);
    startDateEl.addEventListener('change', normalizeStartDate);

    // Prima valorizzazione (utile se la pagina ricarica con valori già selezionati)
    normalizeStartDate();
  }
})();
