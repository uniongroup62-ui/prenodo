(function(){
  const calendarConfigEl = document.getElementById('calendarConfig');
  let calendarConfig = {};
  try {
    calendarConfig = calendarConfigEl ? JSON.parse(calendarConfigEl.textContent || '{}') : {};
  } catch (err) {
    calendarConfig = {};
  }

// IMPORTANT: tutta la logica è dentro DOMContentLoaded
  document.addEventListener('DOMContentLoaded', function(){
    const csrf = String(calendarConfig.csrf || '');
    const CAN_MANAGE_APPOINTMENTS = !!calendarConfig.canManageAppointments;
    const CAN_CREATE_APPOINTMENTS = !!calendarConfig.canCreateAppointments;

    // Utente loggato (per ordinamento colonne Giorno)
    const CURRENT_USER_ID = Number(calendarConfig.currentUserId || 0) || 0;
    const CURRENT_STAFF_ID = Number(calendarConfig.currentStaffId || 0) || 0;
    const SAVED_DAY_STAFF_ORDER = Array.isArray(calendarConfig.savedDayStaffOrder) ? calendarConfig.savedDayStaffOrder : [];
    const CALENDAR_INITIAL_DATE = String(calendarConfig.initialDate || '');
    const CALENDAR_INITIAL_VIEW = String(calendarConfig.initialView || 'staffTimeGridDay');

    let calendarLoadingTimer = null;
    let calendarLoadingHideTimer = null;
    let calendarLoadingActive = false;
    let calendarLoadingErrorVisible = false;

    function calendarLoadingHost(){
      return document.querySelector('.calendar-shell--agenda .fc .fc-view-harness')
        || document.querySelector('.calendar-shell--agenda')
        || document.getElementById('calendar');
    }

    function calendarEnsureLoadingOverlay(){
      const host = calendarLoadingHost();
      if (!host) return null;

      let overlay = document.getElementById('calendarLoadingOverlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'calendarLoadingOverlay';
        overlay.className = 'calendar-loading-overlay';
        overlay.hidden = true;
        overlay.setAttribute('role', 'status');
        overlay.setAttribute('aria-live', 'polite');
        overlay.innerHTML = `
          <div class="calendar-loading-panel">
            <div class="spinner-border text-primary calendar-loading-spinner" aria-hidden="true"></div>
            <div class="calendar-loading-copy">
              <div class="calendar-loading-title" data-calendar-loading-title>Caricamento prenotazioni...</div>
              <div class="calendar-loading-text" data-calendar-loading-text>Aggiornamento del calendario in corso.</div>
              <button type="button" class="btn btn-sm btn-outline-primary calendar-loading-retry" data-calendar-load-retry hidden>Riprova</button>
            </div>
          </div>
        `;
      }

      if (overlay.parentElement !== host) {
        host.appendChild(overlay);
      }

      const retryBtn = overlay.querySelector('[data-calendar-load-retry]');
      if (retryBtn && retryBtn.dataset.bound !== '1') {
        retryBtn.dataset.bound = '1';
        retryBtn.addEventListener('click', function(){
          calendarLoadingErrorVisible = false;
          calendarSetLoading(true, 'Caricamento prenotazioni...');
          try {
            if (window.calendar && typeof window.calendar.refetchEvents === 'function') {
              window.calendar.refetchEvents();
            }
          } catch(_){ }
        });
      }

      return overlay;
    }

    function calendarSetRootBusy(on){
      try {
        const root = document.getElementById('calendar');
        if (!root) return;
        if (on) root.setAttribute('aria-busy', 'true');
        else root.removeAttribute('aria-busy');
      } catch(_){ }
    }

    function calendarSetLoading(on, message){
      clearTimeout(calendarLoadingTimer);
      clearTimeout(calendarLoadingHideTimer);

      if (on) {
        calendarLoadingActive = true;
        calendarLoadingErrorVisible = false;
        calendarSetRootBusy(true);
        calendarLoadingTimer = setTimeout(function(){
          if (!calendarLoadingActive || calendarLoadingErrorVisible) return;
          const overlay = calendarEnsureLoadingOverlay();
          if (!overlay) return;
          overlay.classList.remove('is-error');
          const title = overlay.querySelector('[data-calendar-loading-title]');
          const text = overlay.querySelector('[data-calendar-loading-text]');
          const retryBtn = overlay.querySelector('[data-calendar-load-retry]');
          if (title) title.textContent = message || 'Caricamento prenotazioni...';
          if (text) text.textContent = 'Aggiornamento del calendario in corso.';
          if (retryBtn) retryBtn.hidden = true;
          overlay.hidden = false;
        }, 120);
        return;
      }

      calendarLoadingActive = false;
      calendarSetRootBusy(false);
      if (calendarLoadingErrorVisible) return;

      calendarLoadingHideTimer = setTimeout(function(){
        if (calendarLoadingActive || calendarLoadingErrorVisible) return;
        const overlay = calendarEnsureLoadingOverlay();
        if (overlay) overlay.hidden = true;
      }, 100);
    }

    function calendarSetLoadError(message){
      clearTimeout(calendarLoadingTimer);
      clearTimeout(calendarLoadingHideTimer);
      calendarLoadingActive = false;
      calendarLoadingErrorVisible = true;
      calendarSetRootBusy(false);

      const overlay = calendarEnsureLoadingOverlay();
      if (!overlay) return;
      overlay.classList.add('is-error');
      const title = overlay.querySelector('[data-calendar-loading-title]');
      const text = overlay.querySelector('[data-calendar-loading-text]');
      const retryBtn = overlay.querySelector('[data-calendar-load-retry]');
      if (title) title.textContent = 'Impossibile caricare le prenotazioni';
      if (text) text.textContent = message || 'Controlla la connessione e riprova.';
      if (retryBtn) retryBtn.hidden = false;
      overlay.hidden = false;
    }

    // Colonne operatori (agenda)
    const STAFF_COLS = Array.isArray(calendarConfig.staffCols) ? calendarConfig.staffCols : [];

    // Orari negozio (da Impostazioni → Orari)
    const STORE_HOURS_BY_DOW = (calendarConfig.storeHoursByDow && typeof calendarConfig.storeHoursByDow === 'object') ? calendarConfig.storeHoursByDow : {};
    const STORE_BUSINESS_HOURS_WEEKLY = Array.isArray(calendarConfig.storeBusinessHoursWeekly) ? calendarConfig.storeBusinessHoursWeekly : [];
    const STORE_WEEK_MIN_TIME = String(calendarConfig.storeWeekMinTime || '07:00:00');
    const STORE_WEEK_MAX_TIME = String(calendarConfig.storeWeekMaxTime || '22:00:00');

    // Chiusure (Impostazioni → Chiusure)
    const STORE_CLOSURE_DATES = Array.isArray(calendarConfig.closureDates) ? calendarConfig.closureDates : [];

    // Aperture straordinarie (Impostazioni → Straordinari)
    // Mappa: YYYY-MM-DD -> {opens, closes, opens2, closes2}
    const STORE_SPECIAL_OPEN_BY_DATE = (calendarConfig.specialOpenByDate && typeof calendarConfig.specialOpenByDate === 'object') ? calendarConfig.specialOpenByDate : {};

    // Vista "Giorno" con una colonna per operatore (simile allo screenshot)
    let STAFF_DAY_COLS = (Array.isArray(STAFF_COLS) ? STAFF_COLS : [])
      .map(s => ({
        id: Number(s.id || 0),
        name: String(s.name || ''),
        color: String(s.color || '').trim(),
        photo: String(s.photo || '').trim()
      }))
      .filter(s => (Number(s.id || 0) > 0) && String(s.name || '').trim());

    if (!Array.isArray(STAFF_DAY_COLS) || STAFF_DAY_COLS.length === 0) {
      // Fallback: evita view con 0 colonne
      STAFF_DAY_COLS = [{ id: 0, name: 'Operatore', color: '#999999', photo: '' }];
    }

    // Mappe: staffId -> index colonna e staffName(lower) -> index (resilienza legacy)
    let STAFF_COL_INDEX = Object.create(null);
    let STAFF_COL_INDEX_BY_NAME = Object.create(null);

    function rebuildStaffColIndexes(){
      STAFF_COL_INDEX = Object.create(null);
      STAFF_COL_INDEX_BY_NAME = Object.create(null);
      STAFF_DAY_COLS.forEach((s, idx) => {
        if (!s) return;
        const sid = Number(s.id || 0) || 0;
        if (sid > 0) STAFF_COL_INDEX[String(sid)] = idx;

        const k = String(s.name || '').trim().toLowerCase();
        if (k && STAFF_COL_INDEX_BY_NAME[k] === undefined) STAFF_COL_INDEX_BY_NAME[k] = idx;
      });
    }

    let STAFF_DAY_APPT_COUNTS = Object.create(null);
    let STAFF_DAY_TOTAL_APPT_COUNT = 0;

    function staffDayAppointmentLabel(count){
      const n = Math.max(0, Number(count || 0) || 0);
      return n === 1 ? '1 appuntamento' : `${n} appuntamenti`;
    }

    function staffDayAppointmentCount(staffId){
      const sid = String(Number(staffId || 0) || 0);
      return Math.max(0, Number(STAFF_DAY_APPT_COUNTS[sid] || 0) || 0);
    }

    function staffDayTotalAppointmentLabel(count){
      const n = Math.max(0, Number(count || 0) || 0);
      return n === 1 ? 'appuntamento totale' : 'appuntamenti totali';
    }

    function updateCalendarDayTotalToolbar(){
      try{
        const cal = window.calendar;
        const root = cal && cal.el ? cal.el : document.getElementById('calendar');
        if (!root) return;
        const buttons = root.querySelectorAll('.fc-dayApptTotal-button');
        if (!buttons || !buttons.length) return;
        const total = Math.max(0, Number(STAFF_DAY_TOTAL_APPT_COUNT || 0) || 0);
        buttons.forEach(btn => {
          if (!btn) return;
          btn.setAttribute('tabindex', '-1');
          btn.setAttribute('aria-disabled', 'true');

          btn.classList.remove('calendar-day-total-hidden');
          btn.classList.add('calendar-day-total-indicator');
          btn.removeAttribute('aria-hidden');
          btn.setAttribute('title', `${total} ${staffDayTotalAppointmentLabel(total)}`);
          btn.innerHTML = `
            <span class="calendar-day-total-icon" aria-hidden="true"><i class="bi bi-calendar-check"></i></span>
            <span class="calendar-day-total-number">${escapeHtml(String(total))}</span>
            <span class="calendar-day-total-label">${escapeHtml(staffDayTotalAppointmentLabel(total))}</span>
          `;
        });
      }catch(_){ }
    }

    function updateStaffDayHeaderCounts(){
      try{
        const cal = window.calendar;
        if (!cal || !cal.view || String(cal.view.type || '') !== 'staffTimeGridDay') return;
        const root = cal.el || document.getElementById('calendar');
        if (!root) return;
        root.querySelectorAll('.staff-col-count[data-staff-id]').forEach(el => {
          const sid = Number(el.getAttribute('data-staff-id') || 0) || 0;
          el.textContent = staffDayAppointmentLabel(staffDayAppointmentCount(sid));
        });
        updateCalendarDayTotalToolbar();
      }catch(_){ }
    }

    function setStaffDayAppointmentCounts(counts, totalCount){
      const next = Object.create(null);
      try{
        const source = counts && typeof counts === 'object' ? counts : {};
        for (const [sidRaw, countRaw] of Object.entries(source)) {
          const sid = Number(sidRaw || 0) || 0;
          if (sid <= 0) continue;
          next[String(sid)] = Math.max(0, Number(countRaw || 0) || 0);
        }
      }catch(_){ }
      STAFF_DAY_APPT_COUNTS = next;
      STAFF_DAY_TOTAL_APPT_COUNT = Math.max(0, Number(totalCount || 0) || 0);
      updateCalendarDayTotalToolbar();
      updateStaffDayHeaderCounts();
      setTimeout(updateStaffDayHeaderCounts, 0);
    }

    function isStaffDayCountableEvent(ev){
      try{
        const ep = ev && ev.extendedProps ? ev.extendedProps : {};
        const classes = Array.isArray(ev?.classNames)
          ? ev.classNames
          : String(ev?.classNames || '').split(/\s+/).filter(Boolean);
        if (String(ev?.display || '') === 'background') return false;
        if (Number(ep.is_unavailability || 0) === 1 || Number(ep.is_store_closed || 0) === 1) return false;
        if (classes.includes('staff-unavailability') || classes.includes('store-closed-day')) return false;
        return true;
      }catch(_){
        return false;
      }
    }

    function buildStaffDayAppointmentCounts(events){
      const sets = Object.create(null);
      try{
        STAFF_DAY_COLS.forEach(s => {
          const sid = Number(s && s.id || 0) || 0;
          if (sid > 0) sets[String(sid)] = new Set();
        });

        for (const ev of (Array.isArray(events) ? events : [])) {
          const ep = ev && ev.extendedProps ? ev.extendedProps : {};
          if (!isStaffDayCountableEvent(ev)) continue;

          let sid = Number(ep.staff_id ?? ep.staffId ?? ep.segment_staff_id ?? ep.operator_id ?? 0) || 0;
          if (!(sid > 0)) {
            const idx = Number(ep._staff_col_idx);
            if (Number.isFinite(idx) && STAFF_DAY_COLS[idx]) sid = Number(STAFF_DAY_COLS[idx].id || 0) || 0;
          }
          if (!(sid > 0)) continue;

          const apptKey = String(ep.appointment_id ?? ep.appointmentId ?? ev?.id ?? `${ev?.start || ''}|${ev?.end || ''}|${ev?.title || ''}`);
          if (!sets[String(sid)]) sets[String(sid)] = new Set();
          sets[String(sid)].add(apptKey);
        }
      }catch(_){ }

      const out = Object.create(null);
      for (const [sid, set] of Object.entries(sets)) {
        out[sid] = set instanceof Set ? set.size : 0;
      }
      return out;
    }

    function buildCalendarAppointmentTotal(events){
      const set = new Set();
      try{
        for (const ev of (Array.isArray(events) ? events : [])) {
          if (!isStaffDayCountableEvent(ev)) continue;
          const ep = ev && ev.extendedProps ? ev.extendedProps : {};
          const apptKey = String(ep.appointment_id ?? ep.appointmentId ?? ev?.id ?? `${ev?.start || ''}|${ev?.end || ''}|${ev?.title || ''}`);
          if (apptKey) set.add(apptKey);
        }
      }catch(_){ }
      return set.size;
    }

    function buildStaffDayAppointmentTotal(events){
      return buildCalendarAppointmentTotal(events);
    }


    function syncCalendarStickyToolbarOffset(){
      try{
        const shell = document.querySelector('.calendar-shell');
        if(!shell) return;

        const topbar = document.querySelector('.topbar');
        const topbarHeight = topbar
          ? Math.max(0, Math.ceil(topbar.getBoundingClientRect().height || 0))
          : 72;
        const gap = window.innerWidth <= 992 ? 8 : 12;

        shell.style.setProperty('--calendar-sticky-top', `${topbarHeight + gap}px`);
      }catch(_){ }
    }

    let calendarViewportHeightTimer = null;

    function calendarViewportMinHeight(){
      const width = window.innerWidth || document.documentElement.clientWidth || 0;
      if (width <= 575) return 360;
      if (width <= 991) return 400;
      return 420;
    }

    function computeCalendarViewportHeight(){
      try{
        const shell = document.querySelector('.calendar-shell--agenda');
        if(!shell || !shell.getBoundingClientRect) return null;

        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
        if(!viewportHeight) return null;

        const rect = shell.getBoundingClientRect();
        const footer = document.querySelector('.app-main > footer');
        const footerHeight = footer && footer.getBoundingClientRect
          ? Math.max(0, Math.ceil(footer.getBoundingClientRect().height || 0))
          : 0;
        const gap = (window.innerWidth || 0) <= 575 ? 12 : 16;
        const available = Math.floor(viewportHeight - Math.max(0, rect.top) - footerHeight - gap);

        return Math.max(calendarViewportMinHeight(), available);
      }catch(_){
        return null;
      }
    }

    function syncCalendarViewportHeight(){
      try{
        const shell = document.querySelector('.calendar-shell--agenda');
        const root = document.getElementById('calendar');
        const height = computeCalendarViewportHeight();
        if(!shell || !root || !height) return;

        shell.style.setProperty('--calendar-viewport-height', `${height}px`);
        root.style.setProperty('--calendar-viewport-height', `${height}px`);

        const cal = window.calendar;
        if (cal && typeof cal.setOption === 'function') {
          const prev = Number(window.__calendar_viewport_height || 0) || 0;
          if (prev !== height) {
            window.__calendar_viewport_height = height;
            cal.setOption('height', height);
          } else if (typeof cal.updateSize === 'function') {
            cal.updateSize();
          }
        }
      }catch(_){ }
    }

    function scheduleCalendarViewportHeightSync(delay){
      clearTimeout(calendarViewportHeightTimer);
      calendarViewportHeightTimer = setTimeout(syncCalendarViewportHeight, Number(delay || 0) || 0);
    }

    function normalizeStaffOrder(arr){
      if (!Array.isArray(arr)) return [];
      const out = [];
      const seen = new Set();
      for (const v of arr) {
        const n = Number(v);
        if (!Number.isFinite(n)) continue;
        const id = Math.floor(n);
        if (id <= 0) continue;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push(id);
        if (out.length >= 200) break;
      }
      return out;
    }

    function applyStaffDayColumnsOrdering(pinnedStaffId, otherOrderIds){
      const pinnedId = Number(pinnedStaffId || 0) || 0;

      const cols = Array.isArray(STAFF_DAY_COLS) ? STAFF_DAY_COLS.slice() : [];
      let pinned = null;
      const others = [];

      for (const s of cols) {
        const sid = Number(s?.id || 0) || 0;
        if (pinnedId > 0 && sid === pinnedId && pinned === null) pinned = s;
        else others.push(s);
      }

      const wanted = normalizeStaffOrder(otherOrderIds);
      const byId = new Map();
      for (const s of others) {
        const sid = Number(s?.id || 0) || 0;
        if (sid > 0) byId.set(sid, s);
      }

      const orderedOthers = [];
      for (const id of wanted) {
        if (pinnedId > 0 && id === pinnedId) continue;
        const s = byId.get(id);
        if (!s) continue;
        orderedOthers.push(s);
        byId.delete(id);
      }

      // Aggiungi gli operatori rimasti, mantenendo l'ordine corrente (default alfabetico dal DB)
      for (const s of others) {
        const sid = Number(s?.id || 0) || 0;
        if (sid > 0 && byId.has(sid)) {
          orderedOthers.push(s);
          byId.delete(sid);
        }
      }

      STAFF_DAY_COLS = pinned ? [pinned, ...orderedOthers] : orderedOthers;
      if (!STAFF_DAY_COLS.length) STAFF_DAY_COLS = cols; // safety
      rebuildStaffColIndexes();
    }

    // Ordine iniziale: prima colonna = operatore loggato + ordine salvato degli altri operatori
    applyStaffDayColumnsOrdering(CURRENT_STAFF_ID, SAVED_DAY_STAFF_ORDER);

    const calendarNotesBtn = document.getElementById('calendarNotesBtn');
    const calendarNotesBtnBadge = document.getElementById('calendarNotesBtnBadge');
    const calendarNotesModalEl = document.getElementById('calendarNotesModal');
    const calendarNotesForm = document.getElementById('calendarNotesForm');
    const calendarNotesAlert = document.getElementById('calendarNotesAlert');
    const calendarNotesList = document.getElementById('calendarNotesList');
    const calendarNotesRangeCaption = document.getElementById('calendarNotesRangeCaption');
    const calendarNotesRangeLabel = document.getElementById('calendarNotesRangeLabel');
    const calendarNotesRangeHint = document.getElementById('calendarNotesRangeHint');
    const calendarNotesNewBtn = document.getElementById('calendarNotesNewBtn');
    const calendarNoteDeleteBtn = document.getElementById('calendarNoteDeleteBtn');
    const calendarNoteIdEl = document.getElementById('calendar_note_id');
    const calendarNoteDateEl = document.getElementById('calendar_note_date');
    const calendarNoteTitleEl = document.getElementById('calendar_note_title');
    const calendarNoteTextEl = document.getElementById('calendar_note_text');
    const calendarNotesSaveBtn = document.getElementById('calendarNotesSaveBtn');

    let calendarNotesModal = null;
    try {
      if (calendarNotesModalEl && window.bootstrap && typeof window.bootstrap.Modal === 'function') {
        calendarNotesModal = new bootstrap.Modal(calendarNotesModalEl);
      }
    } catch(_) {
      calendarNotesModal = null;
    }

    let calendarNotesState = {
      start: '',
      end: '',
      total: 0,
      items: [],
      countByDate: Object.create(null),
      selectedId: 0,
      prefillDate: '',
      rangeLabel: '',
      listFilterDate: ''
    };
    let calendarNotesReqSeq = 0;

    function parseCalendarNoteDate(value){
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
      if (!m) return null;
      const y = Number(m[1] || 0);
      const mo = Number(m[2] || 0);
      const d = Number(m[3] || 0);
      const dt = new Date(y, Math.max(0, mo - 1), d);
      if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return null;
      if (dt.getFullYear() !== y || dt.getMonth() !== (mo - 1) || dt.getDate() !== d) return null;
      return dt;
    }

    function normalizeCalendarNoteDateValue(value){
      if (value instanceof Date && !Number.isNaN(value.getTime())) return ymd(value);
      const dt = parseCalendarNoteDate(value);
      if (dt) return ymd(dt);
      return '';
    }

    function getCalendarNotesRange(){
      const cal = window.calendar;
      const viewType = String(cal && cal.view && cal.view.type ? cal.view.type : '');
      let start = null;
      let end = null;
      try {
        if (cal && cal.view && cal.view.currentStart instanceof Date) start = new Date(cal.view.currentStart.getTime());
        if (cal && cal.view && cal.view.currentEnd instanceof Date) end = new Date(cal.view.currentEnd.getTime());
      } catch(_) {
        start = null;
        end = null;
      }
      if (!(start instanceof Date) || Number.isNaN(start.getTime())) start = getCalendarFocusDate();
      if (!(end instanceof Date) || Number.isNaN(end.getTime())) end = addDays(start, 1);

      if (viewType === 'staffTimeGridDay') {
        end = addDays(start, 1);
      } else if (viewType === 'dayGridMonth') {
        start = startOfMonth(start);
        end = addDays(endOfMonth(start), 1);
      } else if (viewType === 'timeGridWeek') {
        const weekStart = startOfWeek(start);
        start = weekStart;
        end = addDays(weekStart, 7);
      }

      return { viewType, start, end };
    }

    function isCalendarNoteDateInVisibleRange(value){
      const dt = parseCalendarNoteDate(value);
      if (!dt) return false;
      const range = getCalendarNotesRange();
      const dayStart = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
      return dayStart >= range.start && dayStart < range.end;
    }

    function formatCalendarNotesRangeLabel(range){
      if (!range || !(range.start instanceof Date)) return '';
      const viewType = String(range.viewType || '');
      if (viewType === 'staffTimeGridDay') {
        return capitalizeFirst(itLongDate(range.start));
      }
      if (viewType === 'timeGridWeek') {
        const endShown = addDays(range.end, -1);
        return capitalizeFirst(itWeekRangeLongLabel(range.start, endShown));
      }
      if (viewType === 'dayGridMonth') {
        return capitalizeFirst(itLongMonthYear(range.start));
      }
      return capitalizeFirst(itLongDate(range.start));
    }

    function setCalendarNotesBadge(total){
      if (!calendarNotesBtnBadge) return;
      const count = Math.max(0, Number(total || 0) || 0);
      if (count <= 0) {
        calendarNotesBtnBadge.textContent = '0';
        calendarNotesBtnBadge.classList.add('d-none');
        return;
      }
      calendarNotesBtnBadge.textContent = count > 99 ? '99+' : String(count);
      calendarNotesBtnBadge.classList.remove('d-none');
    }

    function showCalendarNotesAlert(msg, type){
      if (!calendarNotesAlert) return;
      const safeType = String(type || 'danger').trim() || 'danger';
      calendarNotesAlert.innerHTML = msg
        ? `<div class="alert alert-${safeType} py-2 px-3 mb-3">${msg}</div>`
        : '';
    }

    function clearCalendarNotesAlert(){
      showCalendarNotesAlert('');
    }

    function setCalendarNotesSelectedId(id){
      calendarNotesState.selectedId = Number(id || 0) || 0;
      if (!calendarNotesList) return;
      calendarNotesList.querySelectorAll('[data-note-id]').forEach(function(el){
        const noteId = Number(el.getAttribute('data-note-id') || 0) || 0;
        el.classList.toggle('active', !!calendarNotesState.selectedId && noteId === calendarNotesState.selectedId);
      });
    }

    function getCalendarNotesListFilterDate(){
      return normalizeCalendarNoteDateValue(calendarNotesState.listFilterDate);
    }

    function getCalendarNotesVisibleItems(){
      const items = Array.isArray(calendarNotesState.items) ? calendarNotesState.items : [];
      const filterDate = getCalendarNotesListFilterDate();
      if (!filterDate) return items;
      return items.filter(function(row){
        return normalizeCalendarNoteDateValue(row && row.note_date) === filterDate;
      });
    }

    function getCalendarNotesDisplayLabel(){
      const filterDate = getCalendarNotesListFilterDate();
      if (!filterDate) return calendarNotesState.rangeLabel || '-';
      const dt = parseCalendarNoteDate(filterDate);
      return dt ? capitalizeFirst(itLongDate(dt)) : filterDate;
    }

    function getCalendarNotesDisplayHint(){
      const filterDate = getCalendarNotesListFilterDate();
      const total = getCalendarNotesVisibleItems().length;
      if (filterDate) {
        return total === 1 ? '1 nota del giorno selezionato' : `${total} note del giorno selezionato`;
      }
      return total === 1 ? '1 nota nel periodo visibile' : `${total} note nel periodo visibile`;
    }

    function markerShouldOpenSingleDateList(){
      const cal = window.calendar;
      const viewType = String(cal && cal.view && cal.view.type ? cal.view.type : '');
      return viewType === 'timeGridWeek';
    }

    function resetCalendarNotesForm(prefillDate){
      if (calendarNotesForm) calendarNotesForm.reset();
      if (calendarNoteIdEl) calendarNoteIdEl.value = '';
      if (calendarNoteTitleEl) calendarNoteTitleEl.value = '';
      if (calendarNoteTextEl) calendarNoteTextEl.value = '';
      if (calendarNoteDateEl) {
        const fallback = normalizeCalendarNoteDateValue(prefillDate)
          || normalizeCalendarNoteDateValue(calendarNotesState.prefillDate)
          || normalizeCalendarNoteDateValue(getCalendarFocusDate())
          || normalizeCalendarNoteDateValue(new Date());
        calendarNoteDateEl.value = fallback;
      }
      if (calendarNoteDeleteBtn) calendarNoteDeleteBtn.classList.add('d-none');
      setCalendarNotesSelectedId(0);
      clearCalendarNotesAlert();
    }

    function fillCalendarNoteForm(note){
      const row = note || {};
      if (calendarNoteIdEl) calendarNoteIdEl.value = String(row.id || '');
      if (calendarNoteDateEl) calendarNoteDateEl.value = normalizeCalendarNoteDateValue(row.note_date);
      if (calendarNoteTitleEl) calendarNoteTitleEl.value = String(row.title || '');
      if (calendarNoteTextEl) calendarNoteTextEl.value = String(row.note_text || '');
      if (calendarNoteDeleteBtn) {
        const hasId = Number(row.id || 0) > 0 && CAN_MANAGE_APPOINTMENTS;
        calendarNoteDeleteBtn.classList.toggle('d-none', !hasId);
      }
      setCalendarNotesSelectedId(Number(row.id || 0) || 0);
      clearCalendarNotesAlert();
    }

    function renderCalendarNotesList(){
      if (!calendarNotesList) return;
      const filterDate = getCalendarNotesListFilterDate();
      if (calendarNotesRangeCaption) {
        calendarNotesRangeCaption.textContent = filterDate ? 'Giorno selezionato' : 'Periodo visibile';
      }
      if (calendarNotesRangeLabel) {
        calendarNotesRangeLabel.textContent = getCalendarNotesDisplayLabel();
      }
      if (calendarNotesRangeHint) {
        calendarNotesRangeHint.textContent = getCalendarNotesDisplayHint();
      }

      const items = getCalendarNotesVisibleItems();
      if (!items.length) {
        const emptyTitle = filterDate
          ? 'Nessuna nota per il giorno selezionato'
          : 'Nessuna nota nel periodo visibile';
        const emptyHelp = CAN_MANAGE_APPOINTMENTS
          ? 'Crea una nota dal modulo a sinistra.'
          : 'Le note sono disponibili in sola lettura.';
        calendarNotesList.innerHTML = `
          <div class="calendar-note-empty">
            <div class="fw-semibold mb-1">${escapeHtml(emptyTitle)}</div>
            <div class="small">${escapeHtml(emptyHelp)}</div>
          </div>
        `;
        setCalendarNotesSelectedId(0);
        return;
      }

      const groups = Object.create(null);
      items.forEach(function(row){
        const dateKey = normalizeCalendarNoteDateValue(row.note_date);
        if (!dateKey) return;
        if (!Array.isArray(groups[dateKey])) groups[dateKey] = [];
        groups[dateKey].push(row);
      });

      const days = Object.keys(groups).sort();
      let html = '';
      days.forEach(function(dateKey){
        const rows = groups[dateKey] || [];
        const dt = parseCalendarNoteDate(dateKey);
        const dayLabel = dt ? capitalizeFirst(itLongDate(dt)) : dateKey;
        html += `
          <div class="calendar-note-day-group" data-note-group-date="${escapeHtml(dateKey)}">
            <div class="calendar-note-day-head">
              <div class="fw-semibold">${escapeHtml(dayLabel)}</div>
              <span class="badge text-bg-light">${rows.length}</span>
            </div>
        `;
        rows.forEach(function(row){
          const title = String(row.title || '').trim() || 'Nota senza titolo';
          const noteText = String(row.note_text || '');
          const updatedAt = String(row.updated_at_label || row.updated_at || '').trim();
          const author = String(row.updated_by_name || row.created_by_name || '').trim();
          const metaParts = [];
          if (updatedAt) metaParts.push(updatedAt);
          if (author) metaParts.push(author);
          html += `
            <button type="button" class="calendar-note-card" data-note-id="${Number(row.id || 0)}">
              <div class="calendar-note-card-title">${escapeHtml(title)}</div>
              <div class="calendar-note-card-text">${escapeHtml(noteText).replace(/\n/g, '<br>')}</div>
              <div class="calendar-note-card-meta">${escapeHtml(metaParts.join(' - '))}</div>
            </button>
          `;
        });
        html += '</div>';
      });

      calendarNotesList.innerHTML = html;
      calendarNotesList.querySelectorAll('[data-note-id]').forEach(function(el){
        el.addEventListener('click', function(){
          const noteId = Number(el.getAttribute('data-note-id') || 0) || 0;
          const note = items.find(function(row){ return Number(row.id || 0) === noteId; }) || null;
          if (note) fillCalendarNoteForm(note);
        });
      });
      setCalendarNotesSelectedId(calendarNotesState.selectedId);
    }

    function clearCalendarNoteMarkers(){
      const root = document.getElementById('calendar');
      if (!root) return;
      root.querySelectorAll('.calendar-note-marker-wrap').forEach(function(el){ el.remove(); });
      root.querySelectorAll('.has-calendar-notes').forEach(function(el){ el.classList.remove('has-calendar-notes'); });
    }

    function makeCalendarNoteMarker(dateKey, count){
      const el = document.createElement('span');
      el.className = 'calendar-note-marker-wrap';
      el.setAttribute('data-note-date', String(dateKey || ''));
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.innerHTML = `<span class="calendar-note-marker"><i class="bi bi-stickies" aria-hidden="true"></i><span>${String(count || 0)}</span></span>`;

      const suppressBookingOpenFromMarker = function(ev){
        try {
          window.__calendarIgnoreNextSelectFromNotes = {
            at: Date.now(),
            dateKey: String(dateKey || '')
          };
        } catch(_) {}
        try { ev.stopPropagation(); } catch(_) {}
        try { if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation(); } catch(_) {}
      };

      ['pointerdown','mousedown','touchstart'].forEach(function(evtName){
        el.addEventListener(evtName, suppressBookingOpenFromMarker, { capture: true, passive: false });
        el.addEventListener(evtName, suppressBookingOpenFromMarker, false);
      });

      const openFromMarker = function(ev){
        try {
          window.__calendarIgnoreNextSelectFromNotes = {
            at: Date.now(),
            dateKey: String(dateKey || '')
          };
        } catch(_) {}
        try { ev.preventDefault(); } catch(_) {}
        try { ev.stopPropagation(); } catch(_) {}
        try { if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation(); } catch(_) {}
        const listFilterDate = markerShouldOpenSingleDateList() ? dateKey : '';
        openCalendarNotesModal(dateKey, { listFilterDate: listFilterDate });
      };
      el.addEventListener('click', openFromMarker);
      el.addEventListener('keydown', function(ev){
        if (ev.key === 'Enter' || ev.key === ' ') openFromMarker(ev);
      });
      return el;
    }

    function renderCalendarNoteMarkers(){
      clearCalendarNoteMarkers();
      const root = document.getElementById('calendar');
      const cal = window.calendar;
      if (!root || !cal || !cal.view) return;

      const viewType = String(cal.view.type || '');
      const counts = calendarNotesState.countByDate || {};
      const dateKeys = Object.keys(counts || {});
      if (!dateKeys.length) return;

      if (viewType === 'dayGridMonth') {
        dateKeys.forEach(function(dateKey){
          const count = Number(counts[dateKey] || 0) || 0;
          if (count <= 0) return;
          root.querySelectorAll('.fc-daygrid-day[data-date="' + dateKey + '"]').forEach(function(cell){
            const top = cell.querySelector('.fc-daygrid-day-top') || cell;
            cell.classList.add('has-calendar-notes');
            top.appendChild(makeCalendarNoteMarker(dateKey, count));
          });
        });
        return;
      }

      if (viewType === 'timeGridWeek') {
        dateKeys.forEach(function(dateKey){
          const count = Number(counts[dateKey] || 0) || 0;
          if (count <= 0) return;
          root.querySelectorAll('.fc-col-header-cell[data-date="' + dateKey + '"]').forEach(function(cell){
            const anchor = cell.querySelector('.fc-col-header-cell-cushion') || cell;
            cell.classList.add('has-calendar-notes');
            anchor.appendChild(makeCalendarNoteMarker(dateKey, count));
          });
        });
        return;
      }

      if (viewType === 'staffTimeGridDay') {
        const range = getCalendarNotesRange();
        const dayKey = normalizeCalendarNoteDateValue(range.start);
        const count = Number(counts[dayKey] || 0) || 0;
        if (count <= 0) return;
        const titleEl = root.querySelector('.fc-toolbar-title');
        if (titleEl) {
          titleEl.classList.add('has-calendar-notes');
          titleEl.appendChild(makeCalendarNoteMarker(dayKey, count));
        }
      }
    }

    function scrollCalendarNotesDateIntoView(dateKey){
      if (!calendarNotesList || !dateKey) return;
      const target = calendarNotesList.querySelector('[data-note-group-date="' + String(dateKey).replace(/"/g, '&quot;') + '"]');
      if (!target) return;
      try { target.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch(_) {}
    }

    async function refreshCalendarNotesState(opts){
      const options = opts || {};
      const range = getCalendarNotesRange();
      const startKey = normalizeCalendarNoteDateValue(range.start);
      const endKey = normalizeCalendarNoteDateValue(range.end);
      if (Object.prototype.hasOwnProperty.call(options, 'listFilterDate')) {
        calendarNotesState.listFilterDate = normalizeCalendarNoteDateValue(options.listFilterDate);
      }

      calendarNotesState.rangeLabel = formatCalendarNotesRangeLabel(range);
      if (calendarNotesRangeLabel) calendarNotesRangeLabel.textContent = getCalendarNotesDisplayLabel();
      if (calendarNotesRangeHint) calendarNotesRangeHint.textContent = getCalendarNotesDisplayHint();

      const reqId = ++calendarNotesReqSeq;
      try {
        const params = new URLSearchParams({ action: 'list', start: startKey, end: endKey });
        const res = await fetch('index.php?page=api_calendar_notes&' + params.toString());
        const data = await res.json();
        if (reqId !== calendarNotesReqSeq) return;
        if (!data || !data.ok) {
          throw new Error((data && data.error) ? String(data.error) : 'Errore note');
        }

        calendarNotesState.start = startKey;
        calendarNotesState.end = endKey;
        calendarNotesState.items = Array.isArray(data.notes) ? data.notes : [];
        calendarNotesState.countByDate = (data.count_by_date && typeof data.count_by_date === 'object')
          ? data.count_by_date
          : Object.create(null);
        calendarNotesState.total = Math.max(0, Number(data.total || calendarNotesState.items.length) || 0);

        if (options.keepSelectedId) {
          const wanted = Number(options.keepSelectedId || 0) || 0;
          const exists = calendarNotesState.items.some(function(row){ return Number(row.id || 0) === wanted; });
          calendarNotesState.selectedId = exists ? wanted : 0;
        } else if (calendarNotesState.selectedId) {
          const exists = calendarNotesState.items.some(function(row){ return Number(row.id || 0) === Number(calendarNotesState.selectedId || 0); });
          if (!exists) calendarNotesState.selectedId = 0;
        }

        if (options.prefillDate) {
          calendarNotesState.prefillDate = normalizeCalendarNoteDateValue(options.prefillDate);
        } else if (!calendarNotesState.prefillDate) {
          calendarNotesState.prefillDate = normalizeCalendarNoteDateValue(range.start);
        }

        setCalendarNotesBadge(calendarNotesState.total);
        renderCalendarNotesList();
        renderCalendarNoteMarkers();

        if (options.scrollToDate) {
          scrollCalendarNotesDateIntoView(normalizeCalendarNoteDateValue(options.scrollToDate));
        }
      } catch(err) {
        if (reqId !== calendarNotesReqSeq) return;
        calendarNotesState.items = [];
        calendarNotesState.countByDate = Object.create(null);
        calendarNotesState.total = 0;
        setCalendarNotesBadge(0);
        renderCalendarNotesList();
        renderCalendarNoteMarkers();
        if (calendarNotesModalEl && calendarNotesModalEl.classList.contains('show')) {
          showCalendarNotesAlert(escapeHtml(String(err && err.message ? err.message : 'Errore nel caricamento delle note.')));
        }
      }
    }

    function openCalendarNotesModal(prefillDate, opts){
      const options = opts || {};
      const dateKey = normalizeCalendarNoteDateValue(prefillDate)
        || normalizeCalendarNoteDateValue(getCalendarFocusDate())
        || normalizeCalendarNoteDateValue(new Date());
      const listFilterDate = normalizeCalendarNoteDateValue(options.listFilterDate);
      calendarNotesState.prefillDate = dateKey;
      calendarNotesState.listFilterDate = listFilterDate;
      resetCalendarNotesForm(dateKey);
      if (calendarNotesList) {
        const loadingHint = listFilterDate
          ? 'Sto leggendo le note del giorno selezionato.'
          : 'Sto leggendo le note del periodo visibile.';
        calendarNotesList.innerHTML = `
          <div class="calendar-note-empty">
            <div class="fw-semibold mb-1">Caricamento note...</div>
            <div class="small">${escapeHtml(loadingHint)}</div>
          </div>
        `;
      }
      if (calendarNotesRangeCaption) {
        calendarNotesRangeCaption.textContent = listFilterDate ? 'Giorno selezionato' : 'Periodo visibile';
      }
      if (calendarNotesRangeLabel) {
        calendarNotesRangeLabel.textContent = listFilterDate ? getCalendarNotesDisplayLabel() : (calendarNotesState.rangeLabel || '-');
      }
      if (calendarNotesRangeHint) {
        calendarNotesRangeHint.textContent = listFilterDate ? '0 note del giorno selezionato' : '0 note nel periodo visibile';
      }
      if (calendarNotesModal) calendarNotesModal.show();
      refreshCalendarNotesState({ scrollToDate: dateKey, prefillDate: dateKey, listFilterDate: listFilterDate });
    }

    async function submitCalendarNoteForm(){
      if (!CAN_MANAGE_APPOINTMENTS) {
        showCalendarNotesAlert('Permesso Appuntamenti richiesto.', 'warning');
        return;
      }
      clearCalendarNotesAlert();
      if (!calendarNoteDateEl || !calendarNoteTextEl) return;

      const noteDate = normalizeCalendarNoteDateValue(calendarNoteDateEl.value);
      const noteText = String(calendarNoteTextEl.value || '').trim();
      const title = String(calendarNoteTitleEl ? (calendarNoteTitleEl.value || '') : '').trim();

      if (!noteDate) {
        showCalendarNotesAlert('Seleziona un giorno valido.');
        return;
      }
      if (!noteText) {
        showCalendarNotesAlert('Scrivi il testo della nota.');
        return;
      }
      const noteIsVisibleInCurrentRange = isCalendarNoteDateInVisibleRange(noteDate);

      if (calendarNotesSaveBtn) calendarNotesSaveBtn.disabled = true;
      try {
        const payload = {
          _csrf: csrf,
          action: 'save',
          id: calendarNoteIdEl ? String(calendarNoteIdEl.value || '') : '',
          note_date: noteDate,
          title: title,
          note_text: noteText
        };
        const resp = await postForm('index.php?page=api_calendar_notes', payload);
        if (!resp || !resp.ok) {
          showCalendarNotesAlert(escapeHtml(String((resp && resp.error) ? resp.error : 'Errore nel salvataggio.')));
          return;
        }
        const saved = resp.note || null;
        calendarNotesState.prefillDate = noteDate;
        await refreshCalendarNotesState({
          keepSelectedId: Number(saved && saved.id ? saved.id : 0),
          prefillDate: noteDate,
          scrollToDate: noteDate
        });
        if (saved && Number(saved.id || 0) > 0) fillCalendarNoteForm(saved);
        else resetCalendarNotesForm(noteDate);

        const successMessage = noteIsVisibleInCurrentRange
          ? 'Nota salvata con successo.'
          : 'Nota salvata con successo. La data selezionata e fuori dal periodo visibile: la vedrai in elenco quando il calendario mostrera quel giorno.';
        showCalendarNotesAlert(successMessage, 'success');
      } finally {
        if (calendarNotesSaveBtn) calendarNotesSaveBtn.disabled = false;
      }
    }

    async function deleteCalendarNote(){
      if (!CAN_MANAGE_APPOINTMENTS) {
        showCalendarNotesAlert('Permesso Appuntamenti richiesto.', 'warning');
        return;
      }
      const noteId = Number(calendarNoteIdEl && calendarNoteIdEl.value ? calendarNoteIdEl.value : 0) || 0;
      if (noteId <= 0) return;
      if (!window.confirm('Eliminare questa nota?')) return;
      if (calendarNoteDeleteBtn) calendarNoteDeleteBtn.disabled = true;
      clearCalendarNotesAlert();
      try {
        const resp = await postForm('index.php?page=api_calendar_notes', {
          _csrf: csrf,
          action: 'delete',
          id: String(noteId)
        });
        if (!resp || !resp.ok) {
          showCalendarNotesAlert(escapeHtml(String((resp && resp.error) ? resp.error : 'Errore in eliminazione.')));
          return;
        }
        const fallbackDate = normalizeCalendarNoteDateValue(calendarNoteDateEl && calendarNoteDateEl.value ? calendarNoteDateEl.value : calendarNotesState.prefillDate);
        resetCalendarNotesForm(fallbackDate);
        await refreshCalendarNotesState({ prefillDate: fallbackDate, scrollToDate: fallbackDate });
        showCalendarNotesAlert('Nota eliminata.', 'success');
      } finally {
        if (calendarNoteDeleteBtn) calendarNoteDeleteBtn.disabled = false;
      }
    }

    const STAFF_FALLBACK_PALETTE = ['#fca5a5','#fdba74','#fcd34d','#fde68a','#a7f3d0','#6ee7b7','#67e8f9','#93c5fd','#c4b5fd','#f9a8d4'];

    function normalizeHexColor(c){
      c = String(c || '').trim();
      if (c && !c.startsWith('#')) c = '#' + c;
      return (/^#[0-9a-fA-F]{6}$/.test(c)) ? c : '';
    }

    function staffColorHex(staffId){
      const sid = Number(staffId) || 0;
      if (sid <= 0) return '#e5e7eb';
      const idx = STAFF_COL_INDEX[String(staffId)];
      const s = (idx !== undefined) ? STAFF_DAY_COLS[idx] : null;
      let c = normalizeHexColor(s && s.color ? s.color : '');
      if (!c) {
        const n = Math.abs(sid);
        c = STAFF_FALLBACK_PALETTE[n % STAFF_FALLBACK_PALETTE.length];
      }
      return c;
    }

    function applyStaffAvatarFallbackColors(root){
      const scope = root && typeof root.querySelectorAll === 'function' ? root : document;
      scope.querySelectorAll('.staff-col-avatar-fallback[data-staff-id]').forEach(el => {
        const sid = Number(el.getAttribute('data-staff-id') || 0) || 0;
        el.style.setProperty('--staff-color', staffColorHex(sid));
      });
    }

    function hexToRgba(hex, alpha){
      const m = /^#?([0-9a-fA-F]{6})$/.exec(String(hex||'').trim());
      if(!m) return String(hex||'');
      const x = m[1];
      const r = parseInt(x.slice(0,2), 16);
      const g = parseInt(x.slice(2,4), 16);
      const b = parseInt(x.slice(4,6), 16);
      const a = Math.max(0, Math.min(1, Number(alpha||0)));
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }

    function ymd(dt){
      const pad = n => String(n).padStart(2,'0');
      return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`;
    }

    // Lookup helpers for closures and special openings.
    // - A special opening has priority and can "re-open" a day even if it is in Chiusure.
    const STORE_CLOSURE_SET = new Set(
      (Array.isArray(STORE_CLOSURE_DATES) ? STORE_CLOSURE_DATES : [])
        .map(x => String(x || '').slice(0,10))
        .filter(x => x)
    );

    function isClosureDateKey(dateKey){
      try{ return !!(dateKey && STORE_CLOSURE_SET && STORE_CLOSURE_SET.has(String(dateKey))); }
      catch(_){ return false; }
    }

    function specialOpenRowForDateKey(dateKey){
      try{
        if (!dateKey) return null;
        if (!STORE_SPECIAL_OPEN_BY_DATE) return null;
        return STORE_SPECIAL_OPEN_BY_DATE[String(dateKey)] || null;
      }catch(_){
        return null;
      }
    }

    function addDays(dt, n){
      const d = new Date(dt.getTime());
      d.setDate(d.getDate() + Number(n||0));
      return d;
    }

    function diffDays(a, b){
      // whole-day difference (local timezone)
      const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
      const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
      return Math.round((da - db) / 86400000);
    }

    function withBaseDate(baseDate, timeSource){
      return new Date(
        baseDate.getFullYear(),
        baseDate.getMonth(),
        baseDate.getDate(),
        timeSource.getHours(),
        timeSource.getMinutes(),
        timeSource.getSeconds()
      );
    }

    function staffIdxFromDate(dt, viewStart){
      const idx = diffDays(dt, viewStart);
      if (idx < 0) return 0;
      if (idx >= STAFF_DAY_COLS.length) return STAFF_DAY_COLS.length - 1;
      return idx;
    }

    function isoWeek(dt){
      // ISO week number
      const d = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
      d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
      return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
    }

    function itShortWeekday(dt){
  try{
    return new Intl.DateTimeFormat('it-IT', { weekday:'short' }).format(dt).replace('.', '').toUpperCase();
  }catch(_){
    return '';
  }
}

function itShortMonth(dt){
  try{
    return new Intl.DateTimeFormat('it-IT', { month:'short' }).format(dt).replace('.', '').toUpperCase();
  }catch(_){
    return '';
  }
}

function itLongWeekday(dt){
  try{
    return new Intl.DateTimeFormat('it-IT', { weekday:'long' }).format(dt).replace('.', '');
  }catch(_){
    return '';
  }
}

function itWeekHeaderLabel(dt){
  try{
    const dayName = itLongWeekday(dt);
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    return `${dayName ? dayName.charAt(0).toUpperCase() + dayName.slice(1) : ''} ${dd}/${mm}`.trim();
  }catch(_){
    return '';
  }
}

function applyStaffColumnsStyle(info){
  try{
    const cal = window.calendar;
    const viewType = info?.view?.type || cal?.view?.type || '';
    if(!cal || viewType !== 'staffTimeGridDay') return;

    const root = cal.el || document.getElementById('calendar');
    if (!root) return;

    // Keep all staff columns visually neutral. Operator identity is already shown
    // in the header avatar/dot and inside appointments, so no per-column tint.
    root.querySelectorAll('.fc-timegrid-col-bg').forEach(el => {
      el.style.backgroundColor = 'transparent';
    });
  }catch(_){}
}

function updateCalendarTitle(info){
  try{
    const cal = window.calendar;
    if(!cal) return;
    const titleEl = cal.el.querySelector('.fc-toolbar-title');
    if(!titleEl) return;

    const viewType = info?.view?.type || cal.view?.type || '';

    if(viewType === 'staffTimeGridDay'){
      const d = info?.start || cal.view.currentStart;
      titleEl.textContent = `${capitalizeFirst(itLongWeekday(d))} ${d.getDate()} ${itLongMonth(d)} ${d.getFullYear()}`;
      return;
    }

    if(viewType === 'timeGridWeek'){
      const start = info?.start || cal.view.currentStart;
      const end = (info?.end) ? addDays(info.end, -1) : addDays(start, 6);
      const sameMY = (start.getFullYear() === end.getFullYear()) && (start.getMonth() === end.getMonth());

      if (sameMY){
        titleEl.textContent = `${capitalizeFirst(itLongWeekday(start))} ${start.getDate()} - ${capitalizeFirst(itLongWeekday(end))} ${end.getDate()} ${itLongMonth(end)} ${end.getFullYear()}`;
      } else {
        titleEl.textContent = `${capitalizeFirst(itLongWeekday(start))} ${start.getDate()} ${itLongMonth(start)} ${start.getFullYear()} - ${capitalizeFirst(itLongWeekday(end))} ${end.getDate()} ${itLongMonth(end)} ${end.getFullYear()}`;
      }
      return;
    }

    if(viewType === 'dayGridMonth'){
      // Show range of the current month (1..last day), like in the screenshot
      const cur = (typeof cal.getDate === 'function') ? cal.getDate() : (info?.start || new Date());
      const first = new Date(cur.getFullYear(), cur.getMonth(), 1);
      const last = new Date(cur.getFullYear(), cur.getMonth()+1, 0);
      titleEl.textContent = `${capitalizeFirst(itLongWeekday(first))} ${first.getDate()} - ${capitalizeFirst(itLongWeekday(last))} ${last.getDate()} ${itLongMonth(last)} ${last.getFullYear()}`;
      return;
    }

    // fallback: keep FullCalendar default title
  }catch(_){}
}



function getCalendarFocusDate(){
  try{
    const cal = window.calendar;
    if (!cal) return new Date();
    if (typeof cal.getDate === 'function') {
      const d = cal.getDate();
      if (d instanceof Date && !Number.isNaN(d.getTime())) return new Date(d.getTime());
    }
    if (cal.view && cal.view.currentStart instanceof Date) {
      return new Date(cal.view.currentStart.getTime());
    }
  } catch(_){ }
  return new Date();
}

function startOfMonth(dt){
  return new Date(dt.getFullYear(), dt.getMonth(), 1);
}

function endOfMonth(dt){
  return new Date(dt.getFullYear(), dt.getMonth() + 1, 0);
}

function startOfYear(dt){
  return new Date(dt.getFullYear(), 0, 1);
}

function sameDate(a, b){
  if (!(a instanceof Date) || !(b instanceof Date)) return false;
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function sameMonth(a, b){
  if (!(a instanceof Date) || !(b instanceof Date)) return false;
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth();
}

function sameYear(a, b){
  if (!(a instanceof Date) || !(b instanceof Date)) return false;
  return a.getFullYear() === b.getFullYear();
}

function startOfWeek(dt){
  const d = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return d;
}

function endOfWeek(dt){
  return addDays(startOfWeek(dt), 6);
}

function isDateWithinRange(start, end, dt){
  if (!(start instanceof Date) || !(end instanceof Date) || !(dt instanceof Date)) return false;
  return diffDays(dt, start) >= 0 && diffDays(end, dt) >= 0;
}

function capitalizeFirst(value){
  const str = String(value || '');
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function itLongMonthYear(dt){
  try{
    return new Intl.DateTimeFormat('it-IT', { month:'long', year:'numeric' }).format(dt);
  } catch(_){
    return '';
  }
}

function itLongYear(dt){
  try{
    return new Intl.DateTimeFormat('it-IT', { year:'numeric' }).format(dt);
  } catch(_){
    return String(dt && dt.getFullYear ? dt.getFullYear() : '');
  }
}

function itLongMonth(dt){
  try{
    return new Intl.DateTimeFormat('it-IT', { month:'long' }).format(dt);
  } catch(_){
    return '';
  }
}

function itShortMonthLabel(dt){
  try{
    return new Intl.DateTimeFormat('it-IT', { month:'short' }).format(dt).replace('.', '');
  } catch(_){
    return '';
  }
}

function itShortWeekdayLabel(idx){
  const labels = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
  return labels[idx] || '';
}

function itLongDate(dt){
  try{
    return new Intl.DateTimeFormat('it-IT', { weekday:'long', day:'numeric', month:'long', year:'numeric' }).format(dt);
  } catch(_){
    return '';
  }
}

function itWeekRangeLongLabel(start, end){
  if (sameMonth(start, end)) {
    return `${start.getDate()} - ${end.getDate()} ${itLongMonth(end)} ${end.getFullYear()}`;
  }
  if (sameYear(start, end)) {
    return `${start.getDate()} ${itLongMonth(start)} - ${end.getDate()} ${itLongMonth(end)} ${end.getFullYear()}`;
  }
  return `${start.getDate()} ${itLongMonth(start)} ${start.getFullYear()} - ${end.getDate()} ${itLongMonth(end)} ${end.getFullYear()}`;
}

function itWeekRangeShortLabel(start, end){
  return `${start.getDate()}-${end.getDate()}`;
}

function itWeekRangeSubLabel(start, end){
  if (sameMonth(start, end)) {
    return capitalizeFirst(itLongMonth(start));
  }
  if (sameYear(start, end)) {
    return `${capitalizeFirst(itShortMonthLabel(start))} · ${capitalizeFirst(itShortMonthLabel(end))}`;
  }
  return `${capitalizeFirst(itShortMonthLabel(start))} ${start.getFullYear()} · ${capitalizeFirst(itShortMonthLabel(end))} ${end.getFullYear()}`;
}

function getCalendarDatePickerMode(){
  try{
    const cal = window.calendar;
    const vt = String(cal && cal.view && cal.view.type ? cal.view.type : '');
    if (vt === 'timeGridWeek') return 'week';
    if (vt === 'dayGridMonth') return 'month';
  }catch(_){ }
  return 'day';
}

function getCalendarDatePickerConfig(mode){
  const map = {
    day: {
      dialogLabel: 'Seleziona una data',
      toolbarLabel: 'Seleziona una data',
      navPrev: 'Mese precedente',
      navNext: 'Mese successivo',
      todayLabel: 'Oggi'
    },
    week: {
      dialogLabel: 'Seleziona una settimana',
      toolbarLabel: 'Seleziona una settimana',
      navPrev: 'Mese precedente',
      navNext: 'Mese successivo',
      todayLabel: 'Questa settimana'
    },
    month: {
      dialogLabel: 'Seleziona un mese',
      toolbarLabel: 'Seleziona un mese',
      navPrev: 'Anno precedente',
      navNext: 'Anno successivo',
      todayLabel: 'Questo mese'
    }
  };
  return map[mode] || map.day;
}

function normalizeCalendarDatePickerCursor(mode, dt){
  const base = (dt instanceof Date && !Number.isNaN(dt.getTime())) ? dt : getCalendarFocusDate();
  return mode === 'month' ? startOfYear(base) : startOfMonth(base);
}

function getCalendarDatePickerCursor(mode){
  const currentMode = mode || getCalendarDatePickerMode();
  const raw = window.__calendarDatePickerCursor;
  return normalizeCalendarDatePickerCursor(currentMode, raw instanceof Date ? raw : getCalendarFocusDate());
}

function setCalendarDatePickerCursor(dt, mode){
  window.__calendarDatePickerCursor = normalizeCalendarDatePickerCursor(mode || getCalendarDatePickerMode(), dt);
}

function shiftCalendarDatePickerCursor(dir, mode){
  const currentMode = mode || getCalendarDatePickerMode();
  const base = getCalendarDatePickerCursor(currentMode);
  if (currentMode === 'month') {
    window.__calendarDatePickerCursor = new Date(base.getFullYear() + (dir === 'prev' ? -1 : 1), 0, 1);
    return;
  }
  window.__calendarDatePickerCursor = new Date(base.getFullYear(), base.getMonth() + (dir === 'prev' ? -1 : 1), 1);
}

function ensureCalendarDatePickerElements(){
  let pop = document.getElementById('calendarDatePickerPopover');
  if (pop) return pop;

  pop = document.createElement('div');
  pop.id = 'calendarDatePickerPopover';
  pop.className = 'calendar-mini-picker';
  pop.hidden = true;
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-modal', 'false');
  pop.setAttribute('aria-label', 'Seleziona una data');
  pop.innerHTML = `
    <div class="calendar-mini-picker__header">
      <button type="button" class="calendar-mini-picker__nav-btn" data-cal-nav="prev" aria-label="Mese precedente">
        <i class="bi bi-chevron-left"></i>
      </button>
      <div class="calendar-mini-picker__current-label" data-cal-current-label aria-live="polite"></div>
      <button type="button" class="calendar-mini-picker__nav-btn" data-cal-nav="next" aria-label="Mese successivo">
        <i class="bi bi-chevron-right"></i>
      </button>
    </div>
    <div class="calendar-mini-picker__weekdays" data-cal-weekdays aria-hidden="true"></div>
    <div class="calendar-mini-picker__grid" data-cal-grid role="grid"></div>
    <div class="calendar-mini-picker__footer">
      <div class="calendar-mini-picker__selected" data-cal-selected-label>Data selezionata</div>
      <button type="button" class="calendar-mini-picker__today-btn" data-cal-action="today">Oggi</button>
    </div>
  `;

  const weekdays = pop.querySelector('[data-cal-weekdays]');
  if (weekdays) {
    weekdays.innerHTML = '';
    for (let i = 0; i < 7; i++) {
      const span = document.createElement('span');
      span.textContent = itShortWeekdayLabel(i);
      weekdays.appendChild(span);
    }
  }

  pop.addEventListener('click', function(ev){
    const navBtn = ev.target && ev.target.closest ? ev.target.closest('[data-cal-nav]') : null;
    if (navBtn) {
      ev.preventDefault();
      const dir = String(navBtn.getAttribute('data-cal-nav') || '');
      shiftCalendarDatePickerCursor(dir, getCalendarDatePickerMode());
      renderCalendarDatePicker();
      return;
    }

    const actionBtn = ev.target && ev.target.closest ? ev.target.closest('[data-cal-action]') : null;
    if (actionBtn) {
      const action = String(actionBtn.getAttribute('data-cal-action') || '');
      if (action === 'today') {
        ev.preventDefault();
        const today = new Date();
        try{
          closeCalendarDatePicker();
          const cal = window.calendar;
          if (cal && typeof cal.gotoDate === 'function') cal.gotoDate(today);
        }catch(_){ }
      }
      return;
    }

    const targetBtn = ev.target && ev.target.closest ? ev.target.closest('[data-cal-target-date]') : null;
    if (targetBtn) {
      ev.preventDefault();
      const iso = String(targetBtn.getAttribute('data-cal-target-date') || '');
      if (!iso) return;
      const parts = iso.split('-').map(x => Number(x));
      if (parts.length !== 3) return;
      const selected = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
      if (Number.isNaN(selected.getTime())) return;
      try{
        closeCalendarDatePicker();
        const cal = window.calendar;
        if (cal && typeof cal.gotoDate === 'function') cal.gotoDate(selected);
      }catch(_){ }
    }
  });

  document.body.appendChild(pop);
  return pop;
}

function enhanceCalendarToolbar(){
  try{
    const cal = window.calendar;
    const root = cal && cal.el ? cal.el : document.getElementById('calendar');
    if (!root) return;

    const mode = getCalendarDatePickerMode();
    const cfg = getCalendarDatePickerConfig(mode);
    const btn = root.querySelector('.fc-jumpDate-button');
    if (btn) {
      btn.classList.add('calendar-jump-date-btn');
      btn.setAttribute('title', cfg.toolbarLabel);
      btn.setAttribute('aria-label', cfg.toolbarLabel);
      btn.innerHTML = `<i class="bi bi-calendar3" aria-hidden="true"></i><span class="visually-hidden">${escapeHtml(cfg.toolbarLabel)}</span>`;
    }
    updateCalendarDayTotalToolbar();
  } catch(_){ }
}

function makeCalendarPickerButton(className, targetDate, ariaLabel){
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.setAttribute('role', 'gridcell');
  btn.setAttribute('data-cal-target-date', ymd(targetDate));
  if (ariaLabel) btn.setAttribute('aria-label', ariaLabel);
  return btn;
}

function renderCalendarDatePickerDays(grid, monthBase, focusDate, today){
  const firstOfMonth = startOfMonth(monthBase);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = addDays(firstOfMonth, -firstWeekday);

  for (let i = 0; i < 42; i++) {
    const cellDate = addDays(gridStart, i);
    const btn = makeCalendarPickerButton('calendar-mini-picker__day', cellDate, itLongDate(cellDate));
    btn.textContent = String(cellDate.getDate());

    if (cellDate.getMonth() !== monthBase.getMonth()) btn.classList.add('is-outside');
    if (sameDate(cellDate, today)) btn.classList.add('is-today');
    if (sameDate(cellDate, focusDate)) {
      btn.classList.add('is-selected');
      btn.setAttribute('aria-current', 'date');
    }

    grid.appendChild(btn);
  }
}

function renderCalendarDatePickerWeeks(grid, monthBase, focusDate, today){
  const first = startOfMonth(monthBase);
  const last = endOfMonth(monthBase);
  let weekStart = startOfWeek(first);

  while (diffDays(weekStart, last) <= 0) {
    const weekEnd = addDays(weekStart, 6);
    const btn = makeCalendarPickerButton(
      'calendar-mini-picker__week',
      weekStart,
      `Settimana ${itWeekRangeLongLabel(weekStart, weekEnd)}`
    );

    const main = document.createElement('span');
    main.className = 'calendar-mini-picker__item-main';
    main.textContent = itWeekRangeShortLabel(weekStart, weekEnd);

    const sub = document.createElement('span');
    sub.className = 'calendar-mini-picker__item-sub';
    sub.textContent = itWeekRangeSubLabel(weekStart, weekEnd);

    btn.appendChild(main);
    btn.appendChild(sub);

    if (isDateWithinRange(weekStart, weekEnd, today)) btn.classList.add('is-today');
    if (isDateWithinRange(weekStart, weekEnd, focusDate)) {
      btn.classList.add('is-selected');
      btn.setAttribute('aria-current', 'true');
    }

    grid.appendChild(btn);
    weekStart = addDays(weekStart, 7);
  }
}

function renderCalendarDatePickerMonths(grid, yearBase, focusDate, today){
  for (let i = 0; i < 12; i++) {
    const monthDate = new Date(yearBase.getFullYear(), i, 1);
    const btn = makeCalendarPickerButton(
      'calendar-mini-picker__month',
      monthDate,
      capitalizeFirst(itLongMonthYear(monthDate))
    );
    btn.textContent = capitalizeFirst(itShortMonthLabel(monthDate));

    if (sameMonth(monthDate, today)) btn.classList.add('is-today');
    if (sameMonth(monthDate, focusDate)) {
      btn.classList.add('is-selected');
      btn.setAttribute('aria-current', 'true');
    }

    grid.appendChild(btn);
  }
}

function renderCalendarDatePicker(){
  const pop = ensureCalendarDatePickerElements();
  if (!pop) return;

  const mode = getCalendarDatePickerMode();
  const cfg = getCalendarDatePickerConfig(mode);
  const cursor = getCalendarDatePickerCursor(mode);
  const focusDate = getCalendarFocusDate();
  const today = new Date();

  pop.classList.remove('is-mode-day', 'is-mode-week', 'is-mode-month');
  pop.classList.add(`is-mode-${mode}`);
  pop.setAttribute('aria-label', cfg.dialogLabel);

  const prevBtn = pop.querySelector('[data-cal-nav="prev"]');
  const nextBtn = pop.querySelector('[data-cal-nav="next"]');
  const currentLabel = pop.querySelector('[data-cal-current-label]');
  const selectedLabel = pop.querySelector('[data-cal-selected-label]');
  const todayBtn = pop.querySelector('[data-cal-action="today"]');
  const weekdays = pop.querySelector('[data-cal-weekdays]');
  const grid = pop.querySelector('[data-cal-grid]');

  if (prevBtn) prevBtn.setAttribute('aria-label', cfg.navPrev);
  if (nextBtn) nextBtn.setAttribute('aria-label', cfg.navNext);
  if (todayBtn) todayBtn.textContent = cfg.todayLabel;
  if (currentLabel) currentLabel.textContent = mode === 'month' ? itLongYear(cursor) : itLongMonthYear(cursor);
  if (weekdays) weekdays.hidden = mode !== 'day';

  if (selectedLabel) {
    if (mode === 'week') {
      const selectedWeekStart = startOfWeek(focusDate);
      const selectedWeekEnd = addDays(selectedWeekStart, 6);
      selectedLabel.textContent = `Settimana ${itWeekRangeLongLabel(selectedWeekStart, selectedWeekEnd)}`;
    } else if (mode === 'month') {
      selectedLabel.textContent = `Mese selezionato: ${itLongMonthYear(focusDate)}`;
    } else {
      selectedLabel.textContent = itLongDate(focusDate);
    }
  }

  if (!grid) return;
  grid.innerHTML = '';
  grid.className = 'calendar-mini-picker__grid';
  grid.classList.add(`calendar-mini-picker__grid--${mode}`);

  if (mode === 'week') {
    renderCalendarDatePickerWeeks(grid, cursor, focusDate, today);
    return;
  }

  if (mode === 'month') {
    renderCalendarDatePickerMonths(grid, cursor, focusDate, today);
    return;
  }

  renderCalendarDatePickerDays(grid, cursor, focusDate, today);
}

function attachCalendarDatePicker(){
  const pop = ensureCalendarDatePickerElements();
  if (!pop) return null;

  const cal = window.calendar;
  const root = cal && cal.el ? cal.el : document.getElementById('calendar');
  if (!root) return null;

  const btn = root.querySelector('.fc-jumpDate-button');
  if (!btn) return null;
  const host = btn.parentElement || btn;
  if (pop.parentElement !== host) host.appendChild(pop);

  pop.classList.remove('align-right');
  const desiredWidth = Math.min(336, Math.max(260, window.innerWidth - 24));
  if (host.getBoundingClientRect().left + desiredWidth > window.innerWidth - 12) {
    pop.classList.add('align-right');
  }
  return pop;
}

function openCalendarDatePicker(){
  const pop = attachCalendarDatePicker();
  if (!pop) return;

  setCalendarDatePickerCursor(getCalendarFocusDate(), getCalendarDatePickerMode());
  renderCalendarDatePicker();
  pop.hidden = false;
  pop.classList.add('is-open');

  const btn = document.querySelector('#calendar .fc-jumpDate-button');
  if (btn) btn.classList.add('fc-button-active');
}

function closeCalendarDatePicker(){
  const pop = document.getElementById('calendarDatePickerPopover');
  if (pop) {
    pop.hidden = true;
    pop.classList.remove('is-open');
  }
  const btn = document.querySelector('#calendar .fc-jumpDate-button');
  if (btn) btn.classList.remove('fc-button-active');
}

function toggleCalendarDatePicker(){
  const pop = document.getElementById('calendarDatePickerPopover');
  if (pop && !pop.hidden) {
    closeCalendarDatePicker();
    return;
  }
  openCalendarDatePicker();
}

function syncCalendarDatePickerState(_info){
  enhanceCalendarToolbar();
  const pop = document.getElementById('calendarDatePickerPopover');
  const isOpen = !!(pop && !pop.hidden);
  if (isOpen) closeCalendarDatePicker();
}







// === Vista Giorno: Ordina colonne operatori (per utente) ===
const staffOrderModalEl = document.getElementById('staffOrderModal');
const staffOrderListEl = document.getElementById('staffOrderList');
const staffOrderPinnedInfoEl = document.getElementById('staffOrderPinnedInfo');
const staffOrderPinnedNameEl = document.getElementById('staffOrderPinnedName');
const staffOrderEmptyEl = document.getElementById('staffOrderEmpty');
const staffOrderErrEl = document.getElementById('staffOrderErr');
const staffOrderSaveBtn = document.getElementById('staffOrderSave');

let staffOrderModal = null;
try{
  if (staffOrderModalEl && window.bootstrap && typeof window.bootstrap.Modal === 'function') {
    staffOrderModal = new bootstrap.Modal(staffOrderModalEl);
  }
}catch(_){ staffOrderModal = null; }

function staffNameById(staffId){
  const sid = Number(staffId || 0) || 0;
  if (sid <= 0) return '';
  const idx = STAFF_COL_INDEX[String(sid)];
  const s = (idx !== undefined) ? STAFF_DAY_COLS[idx] : null;
  return s ? String(s.name || '') : '';
}

function getOtherStaffCols(){
  const pinnedId = Number(CURRENT_STAFF_ID || 0) || 0;
  return (Array.isArray(STAFF_DAY_COLS) ? STAFF_DAY_COLS : [])
    .filter(s => {
      const sid = Number(s?.id || 0) || 0;
      if (sid <= 0) return false;
      if (pinnedId > 0 && sid === pinnedId) return false;
      return true;
    });
}

function clearStaffOrderError(){
  if (!staffOrderErrEl) return;
  staffOrderErrEl.hidden = true;
  staffOrderErrEl.textContent = '';
}

function setStaffOrderError(msg){
  if (!staffOrderErrEl) return;
  staffOrderErrEl.hidden = false;
  staffOrderErrEl.textContent = String(msg || 'Errore');
}

let __staffOrderDragEl = null;
let __staffOrderDnDInit = false;

function ensureStaffOrderDnD(){
  if (__staffOrderDnDInit) return;
  if (!staffOrderListEl) return;
  __staffOrderDnDInit = true;

  staffOrderListEl.addEventListener('dragstart', (e) => {
    const item = e.target && e.target.closest ? e.target.closest('.staff-order-item') : null;
    if (!item) return;
    __staffOrderDragEl = item;
    item.classList.add('dragging');
    try{ e.dataTransfer.effectAllowed = 'move'; }catch(_){ }
    try{ e.dataTransfer.setData('text/plain', item.dataset.sid || ''); }catch(_){ }
  });

  staffOrderListEl.addEventListener('dragend', (e) => {
    try{
      const item = e.target && e.target.closest ? e.target.closest('.staff-order-item') : null;
      if (item) item.classList.remove('dragging');
    }catch(_){ }
    __staffOrderDragEl = null;
  });

  staffOrderListEl.addEventListener('dragover', (e) => {
    if (!__staffOrderDragEl) return;
    e.preventDefault();
    const over = e.target && e.target.closest ? e.target.closest('.staff-order-item') : null;
    if (!over || over === __staffOrderDragEl) return;

    const rect = over.getBoundingClientRect();
    const after = (e.clientY - rect.top) > (rect.height / 2);
    staffOrderListEl.insertBefore(__staffOrderDragEl, after ? over.nextSibling : over);
  });

  staffOrderListEl.addEventListener('drop', (e) => {
    e.preventDefault();
  });
}

function renderStaffOrderList(){
  if (!staffOrderListEl) return;
  staffOrderListEl.innerHTML = '';
  clearStaffOrderError();

  const pinnedId = Number(CURRENT_STAFF_ID || 0) || 0;
  const pinnedName = pinnedId ? staffNameById(pinnedId) : '';

  if (staffOrderPinnedInfoEl && staffOrderPinnedNameEl) {
    if (pinnedId > 0 && pinnedName) {
      staffOrderPinnedInfoEl.hidden = false;
      staffOrderPinnedNameEl.textContent = pinnedName;
    } else {
      staffOrderPinnedInfoEl.hidden = true;
      staffOrderPinnedNameEl.textContent = '';
    }
  }

  const list = getOtherStaffCols();
  if (!list.length) {
    if (staffOrderEmptyEl) staffOrderEmptyEl.hidden = false;
    return;
  }
  if (staffOrderEmptyEl) staffOrderEmptyEl.hidden = true;

  for (const s of list) {
    const sid = Number(s?.id || 0) || 0;
    const name = String(s?.name || '').trim();
    if (!sid || !name) continue;

    const item = document.createElement('div');
    item.className = 'list-group-item d-flex align-items-center gap-2 staff-order-item';
    item.draggable = true;
    item.dataset.sid = String(sid);

    const grip = document.createElement('span');
    grip.className = 'text-muted';
    grip.style.cursor = 'grab';
    grip.innerHTML = '<i class="bi bi-grip-vertical"></i>';

    const dot = document.createElement('span');
    dot.className = 'op-color-dot';
    dot.style.background = staffColorHex(sid);
    dot.title = 'Operatore';

    const label = document.createElement('div');
    label.className = 'flex-grow-1';
    label.textContent = name;

    const btnGroup = document.createElement('div');
    btnGroup.className = 'btn-group btn-group-sm';

    const btnUp = document.createElement('button');
    btnUp.type = 'button';
    btnUp.className = 'btn btn-outline-secondary';
    btnUp.title = 'Sposta su';
    btnUp.innerHTML = '<i class="bi bi-chevron-up"></i>';
    btnUp.addEventListener('click', () => {
      const prev = item.previousElementSibling;
      if (prev) staffOrderListEl.insertBefore(item, prev);
    });

    const btnDown = document.createElement('button');
    btnDown.type = 'button';
    btnDown.className = 'btn btn-outline-secondary';
    btnDown.title = 'Sposta giù';
    btnDown.innerHTML = '<i class="bi bi-chevron-down"></i>';
    btnDown.addEventListener('click', () => {
      const next = item.nextElementSibling;
      if (next) staffOrderListEl.insertBefore(next, item);
    });

    btnGroup.appendChild(btnUp);
    btnGroup.appendChild(btnDown);

    item.appendChild(grip);
    item.appendChild(dot);
    item.appendChild(label);
    item.appendChild(btnGroup);

    staffOrderListEl.appendChild(item);
  }

  ensureStaffOrderDnD();
}

function openStaffOrderModal(){
  if (!staffOrderModal) return;
  renderStaffOrderList();
  staffOrderModal.show();
}

function toggleStaffOrderButton(viewType){
  try{
    const cal = window.calendar;
    const root = cal && cal.el ? cal.el : document;
    const btn = root.querySelector('.fc-orderStaffCols-button');
    if (!btn) return;
    const vt = String(viewType || (cal && cal.view && cal.view.type) || '');
    if (vt === 'staffTimeGridDay' && Array.isArray(STAFF_DAY_COLS) && STAFF_DAY_COLS.length > 1) {
      btn.style.display = '';
    } else {
      btn.style.display = 'none';
    }
  }catch(_){ }
}

async function saveStaffOrder(){
  try{
    if (!staffOrderListEl) return;
    clearStaffOrderError();

    const ids = Array.from(staffOrderListEl.querySelectorAll('.staff-order-item'))
      .map(el => Number(el.dataset.sid || 0) || 0)
      .filter(n => n > 0);

    // Persistenza per utente (DB)
    const res = await postForm('index.php?page=api_user_prefs', {
      action: 'set_calendar_day_staff_order',
      order: JSON.stringify(ids),
      _csrf: csrf,
    });

    if (!res || res.ok !== true) {
      throw new Error(res && res.error ? res.error : "Impossibile salvare l'ordinamento");
    }

    // Applica subito il nuovo ordine in memoria
    applyStaffDayColumnsOrdering(CURRENT_STAFF_ID, ids);

    // Forza re-render della vista Giorno + reload eventi (gli eventi sono rimappati su "giorni fittizi")
    try{
      const cal = window.calendar;
      if (cal && cal.view && String(cal.view.type) === 'staffTimeGridDay') {
        try{ if (typeof cal.rerenderDates === 'function') cal.rerenderDates(); else cal.render(); }catch(_){ }
        try{ cal.removeAllEvents && cal.removeAllEvents(); }catch(_){ }
        try{ cal.refetchEvents && cal.refetchEvents(); }catch(_){ }
        try{ applyStaffColumnsStyle({ view: cal.view, start: cal.view.currentStart }); }catch(_){ }
        try{ updateCalendarTitle({ view: cal.view, start: cal.view.currentStart }); }catch(_){ }
      }
    } catch(_){ }

    if (staffOrderModal) staffOrderModal.hide();
  } catch (err) {
    setStaffOrderError(err && err.message ? err.message : err);
  }
}

if (staffOrderSaveBtn) staffOrderSaveBtn.addEventListener('click', saveStaffOrder);
// === Orari negozio → calendario (min/max + evidenziazione fascia aperta/chiusa) ===
// Nota importante:
// - In `staffTimeGridDay` (colonne operatori) usiamo *giorni fittizi* per creare N colonne.
//   Quindi NON possiamo usare le businessHours settimanali con daysOfWeek, altrimenti ogni colonna
//   avrebbe orari diversi (perché ogni colonna è un giorno diverso). In quella vista applichiamo
//   le fasce del *giorno reale* a TUTTE le colonne.

function hhmmss(t){
  if (t === null || t === undefined) return '';
  const s = String(t).trim();
  if (!s) return '';
  if (/^\d{2}:\d{2}$/.test(s)) return s + ':00';
  return s; // assume HH:mm:ss
}

// FullCalendar does not render a slot label for `slotMaxTime` when it is exactly the end boundary.
// Example: max=19:00 with 30-min labels => the last label shown is 18:30 (slot 18:30-19:00).
// Users perceive this as "calendar stops at 18:30" even though the grid reaches 19:00.
// We pad the visible slotMaxTime by one snap (5 min) so the closing label becomes visible,
// while keeping the *real* business hours unchanged.
const SLOT_MAX_PAD_MINUTES = 5;

function _timeToMin(t){
  if (!t) return null;
  const s = String(t).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  let hh = parseInt(m[1], 10);
  let mm = parseInt(m[2], 10);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  if (hh === 24 && mm === 0) return 24*60;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh*60 + mm;
}

function _minToHHMMSS(min){
  if (min === null || min === undefined) return '';
  let m = Math.max(0, Math.min(24*60, parseInt(min, 10)));
  if (Number.isNaN(m)) return '';
  if (m === 24*60) return '24:00:00';
  const hh = Math.floor(m/60);
  const mm = m%60;
  return String(hh).padStart(2,'0') + ':' + String(mm).padStart(2,'0') + ':00';
}

function padSlotMaxTime(max){
  const base = _timeToMin(max);
  if (base === null) return max;
  const padded = Math.min(24*60, base + SLOT_MAX_PAD_MINUTES);
  if (padded === base) return hhmmss(max);
  return _minToHHMMSS(padded);
}

const STORE_WEEK_MAX_TIME_PAD = padSlotMaxTime(STORE_WEEK_MAX_TIME || '22:00:00');

function getStoreRowForDow(dow){
  try{
    const k = String(dow);
    return (STORE_HOURS_BY_DOW && (STORE_HOURS_BY_DOW[k] || STORE_HOURS_BY_DOW[dow])) || null;
  }catch(_){
    return null;
  }
}

function getStoreScheduleForDow(dow){
  const r = getStoreRowForDow(dow) || {};
  const isClosed = Number(r.is_closed || 0) === 1;

  const opens  = hhmmss(r.opens);
  const closes = hhmmss(r.closes);
  const opens2  = hhmmss(r.opens2);
  const closes2 = hhmmss(r.closes2);
  const effectiveClosed = isClosed || !opens || !closes;

  const intervals = [];
  if (!effectiveClosed && opens && closes) intervals.push({ startTime: opens, endTime: closes });
  if (!effectiveClosed && opens2 && closes2) intervals.push({ startTime: opens2, endTime: closes2 });

  // Min/max dell'asse orario per il singolo giorno:
  // - min = apertura prima fascia (fallback min settimanale)
  // - max = chiusura seconda fascia se presente, altrimenti chiusura prima fascia (fallback max settimanale)
  let min = opens || STORE_WEEK_MIN_TIME || '07:00:00';
  let max = (closes2 || closes || STORE_WEEK_MAX_TIME || '22:00:00');

  // Sanity
  try{
    if (String(min) >= String(max)) {
      min = STORE_WEEK_MIN_TIME || '07:00:00';
      max = STORE_WEEK_MAX_TIME || '22:00:00';
    }
  }catch(_){ }

  const maxPad = padSlotMaxTime(max);
  return { isClosed: effectiveClosed, intervals, min, max, maxPad };
}

// Schedule per data reale (considera: apertura straordinaria -> chiusure -> orari standard).
function getStoreScheduleForDate(dateObj){
  try{
    const key = ymd(dateObj);

    // 0) Apertura straordinaria (prioritaria su tutto, anche su Chiusure)
    const sp = specialOpenRowForDateKey(key);
    if (sp) {
      const opens  = hhmmss(sp.opens);
      const closes = hhmmss(sp.closes);
      const opens2  = hhmmss(sp.opens2);
      const closes2 = hhmmss(sp.closes2);

      const intervals = [];
      if (opens && closes) intervals.push({ startTime: opens, endTime: closes });
      if (opens2 && closes2) intervals.push({ startTime: opens2, endTime: closes2 });

      const isClosed = (intervals.length === 0);
      let min = opens || (STORE_WEEK_MIN_TIME || '07:00:00');
      let max = (closes2 || closes || STORE_WEEK_MAX_TIME || '22:00:00');
      try{
        if (String(min) >= String(max)) {
          min = STORE_WEEK_MIN_TIME || '07:00:00';
          max = STORE_WEEK_MAX_TIME || '22:00:00';
        }
      }catch(_){ }
      const maxPad = padSlotMaxTime(max);
      return { isClosed, intervals, min, max, maxPad, isSpecial: 1 };
    }

    // 1) Chiusura per data
    if (isClosureDateKey(key)) {
      const min = STORE_WEEK_MIN_TIME || '07:00:00';
      const max = STORE_WEEK_MAX_TIME || '22:00:00';
      const maxPad = padSlotMaxTime(max);
      return { isClosed: true, intervals: [], min, max, maxPad, isSpecial: 0, isClosure: 1 };
    }

    // 2) Orari standard settimanali
    const dow = (dateObj && typeof dateObj.getDay === 'function') ? dateObj.getDay() : (new Date()).getDay();
    const sch = getStoreScheduleForDow(dow);
    if (sch && typeof sch === 'object') return sch;
  }catch(_){ }

  // Fallback safe
  try {
    const d = (dateObj && typeof dateObj.getDay === 'function') ? dateObj.getDay() : (new Date()).getDay();
    return getStoreScheduleForDow(d);
  } catch(_e) {
    return { isClosed: false, intervals: [], min: STORE_WEEK_MIN_TIME || '07:00:00', max: STORE_WEEK_MAX_TIME || '22:00:00', maxPad: STORE_WEEK_MAX_TIME_PAD || (STORE_WEEK_MAX_TIME || '22:00:00') };
  }
}

// Build businessHours for timeGridWeek using the *effective* schedule for each date in the visible range.
// We map each date to its day-of-week because in a single week view each dow appears once.
function buildWeekBusinessHoursForRange(startDate, endDate){
  const bh = [];
  let min = null;
  let max = null;

  try{
    const d = new Date(startDate.getTime());
    d.setHours(0,0,0,0);
    const end = new Date(endDate.getTime());
    end.setHours(0,0,0,0);

    while (d.getTime() < end.getTime()) {
      const dow = d.getDay();
      const sch = getStoreScheduleForDate(d) || {};
      const intervals = Array.isArray(sch.intervals) ? sch.intervals : [];

      // Only define businessHours for this dow if the day is open.
      if (!sch.isClosed && intervals.length) {
        for (const x of intervals) {
          if (!x || !x.startTime || !x.endTime) continue;
          bh.push({ daysOfWeek: [dow], startTime: x.startTime, endTime: x.endTime });
        }

        if (sch.min && (min === null || String(sch.min) < String(min))) min = sch.min;
        if (sch.max && (max === null || String(sch.max) > String(max))) max = sch.max;
      }

      d.setDate(d.getDate() + 1);
    }
  }catch(_){ }

  if (min === null) min = STORE_WEEK_MIN_TIME || '07:00:00';
  if (max === null) max = STORE_WEEK_MAX_TIME || '22:00:00';
  const maxPad = padSlotMaxTime(max);
  return { businessHours: bh, min, max, maxPad };
}

function storeBreakRangesForDate(dateObj){
  const out = [];
  try{
    const sch = getStoreScheduleForDate(dateObj) || {};
    const intervals = Array.isArray(sch.intervals) ? sch.intervals.slice() : [];
    if (sch.isClosed || intervals.length < 2) return out;

    intervals.sort((a, b) => {
      const am = _timeToMin(hhmmss(a && a.startTime));
      const bm = _timeToMin(hhmmss(b && b.startTime));
      return (am ?? 0) - (bm ?? 0);
    });

    for (let i = 0; i < intervals.length - 1; i++) {
      const start = hhmmss(intervals[i] && intervals[i].endTime);
      const end = hhmmss(intervals[i + 1] && intervals[i + 1].startTime);
      const startMin = _timeToMin(start);
      const endMin = _timeToMin(end);
      if (start && end && startMin !== null && endMin !== null && endMin > startMin) {
        out.push({ startTime: start, endTime: end });
      }
    }
  }catch(_){ }
  return out;
}

function buildStoreBreakEventsForView(ctx){
  const out = [];
  try{
    let viewType = String(ctx && ctx.viewType || '');
    if (!viewType && ctx && ctx.isStaffDayReq) viewType = 'staffTimeGridDay';
    if (viewType !== 'staffTimeGridDay' && viewType !== 'timeGridWeek') return out;

    const makeEvent = (id, dateKey, breakRange, staffId, realDayKey, extraClasses, extraProps) => ({
      id: id,
      title: 'BREAK TIME',
      start: `${dateKey}T${breakRange.startTime}`,
      end: `${dateKey}T${breakRange.endTime}`,
      display: 'background',
      overlap: true,
      editable: false,
      interactive: false,
      extendedProps: {
        staff_id: Number(staffId || 0) || 0,
        is_store_break: 1,
        real_day_key: realDayKey || dateKey,
        ...(extraProps && typeof extraProps === 'object' ? extraProps : {})
      },
      classNames: ['store-break-time'].concat(Array.isArray(extraClasses) ? extraClasses : [])
    });

    if (viewType === 'staffTimeGridDay') {
      const realDate = (ctx && ctx.viewStart) ? ctx.viewStart : new Date();
      const realDayKey = ymd(realDate);
      const breaks = storeBreakRangesForDate(realDate);
      if (!breaks.length) return out;

      STAFF_DAY_COLS.forEach((staff, idx) => {
        const fakeDateKey = ymd(addDays(realDate, idx));
        breaks.forEach((br, brIdx) => {
          const extraClasses = ['store-break-time-staffday'];
          if (idx === 0) extraClasses.push('store-break-time-master');
          out.push(makeEvent(
            `store_break_${realDayKey}_${idx}_${brIdx}`,
            fakeDateKey,
            br,
            staff && staff.id,
            realDayKey,
            extraClasses,
            { staff_break_col_count: STAFF_DAY_COLS.length }
          ));
        });
      });
      return out;
    }

    const start = (ctx && ctx.viewStart) ? new Date(ctx.viewStart.getTime()) : new Date();
    const end = (ctx && ctx.viewEnd) ? new Date(ctx.viewEnd.getTime()) : addDays(start, 7);
    start.setHours(0,0,0,0);
    end.setHours(0,0,0,0);

    let d = new Date(start.getTime());
    while (d.getTime() < end.getTime()) {
      const dayKey = ymd(d);
      const breaks = storeBreakRangesForDate(d);
      breaks.forEach((br, brIdx) => {
        out.push(makeEvent(`store_break_${dayKey}_${brIdx}`, dayKey, br, 0, dayKey));
      });
      d = addDays(d, 1);
    }
  }catch(_){ }
  return out;
}

function _setCalOptIfChanged(cal, key, value){
  try{
    const cache = (window.__cal_opt_cache = window.__cal_opt_cache || {});
    const v = (value === undefined) ? null : value;
    if (cache[key] === v) return;
    cache[key] = v;
    cal.setOption(key, value);
  }catch(_){
    try{ cal.setOption(key, value); }catch(__){}
  }
}

function _setBusinessHoursIfChanged(cal, bh){
  try{
    const cache = (window.__cal_opt_cache = window.__cal_opt_cache || {});
    const s = JSON.stringify(bh || []);
    if (cache.__bh_json === s) return;
    cache.__bh_json = s;
    cal.setOption('businessHours', bh || []);
  }catch(_){
    try{ cal.setOption('businessHours', bh || []); }catch(__){}
  }
}

function applyStoreHoursForView(info){
  try{
    const cal = window.calendar;
    if(!cal || !cal.view) return;
    const vt = String(info?.view?.type || cal.view.type || '');

    // If we previously expanded the time axis to show out-of-hours appointments,
    // keep that expanded range when FullCalendar re-renders and fires `datesSet` again.
    // Without this, a subsequent re-render may restore the baseline shop opening time
    // (e.g. 09:00) even if there is a booking at 07:00.
    const activeAxisPatch = (window.__axis_patch_active && typeof window.__axis_patch_active === 'object')
      ? window.__axis_patch_active
      : null;

    if (vt === 'staffTimeGridDay') {
      const realDate = info?.start || cal.view.currentStart || (typeof cal.getDate === 'function' ? cal.getDate() : new Date());
      // Usa gli orari effettivi della data (considera aperture straordinarie e chiusure)
      const sch = getStoreScheduleForDate(realDate);

      // Applica le fasce del giorno reale a TUTTE le colonne (daysOfWeek=0..6)
      // See note above: in staffTimeGridDay every staff column is a fake day,
      // but the shop schedule must be applied uniformly to all of them.
      // Using daysOfWeek=[0..6] ensures FullCalendar applies the businessHours to every column.
      const bhDay = (sch.intervals || []).map(x => ({ daysOfWeek:[0,1,2,3,4,5,6], startTime: x.startTime, endTime: x.endTime }));

      // Keep dynamic axis (out-of-hours appointments) for the current real day,
      // otherwise fallback to the baseline shop schedule.
      const curKey = ymd(realDate);
      const patchOk = !!(
        activeAxisPatch &&
        Number(activeAxisPatch.isStaffDay || 0) === 1 &&
        String(activeAxisPatch.viewStartKey || '') === String(curKey || '')
      );

      if (patchOk) {
        // Used by selectAllow/eventAllow to prevent interacting with the tiny padded area.
        window.__cal_actual_max_time = activeAxisPatch.actualMaxTime || null;
        _setCalOptIfChanged(cal, 'slotMinTime', activeAxisPatch.slotMinTime || sch.min || STORE_WEEK_MIN_TIME);
        _setCalOptIfChanged(cal, 'slotMaxTime', activeAxisPatch.slotMaxTime || sch.maxPad || sch.max || STORE_WEEK_MAX_TIME_PAD);
      } else {
        // Clear stale patch for another day.
        if (activeAxisPatch && Number(activeAxisPatch.isStaffDay || 0) === 1) {
          try { window.__axis_patch_active = null; } catch(_e) {}
        }
        // Used by selectAllow/eventAllow to prevent interacting with the tiny padded area.
        // If the day is closed we keep it null (no restriction).
        window.__cal_actual_max_time = (!sch.isClosed && sch.max) ? sch.max : null;
        _setCalOptIfChanged(cal, 'slotMinTime', sch.min || STORE_WEEK_MIN_TIME);
        _setCalOptIfChanged(cal, 'slotMaxTime', sch.maxPad || sch.max || STORE_WEEK_MAX_TIME_PAD);
      }
      _setBusinessHoursIfChanged(cal, bhDay);
      return;
    }

    // Week/Month: orari settimanali
    // Keep dynamic axis (out-of-hours appointments) for the current week, otherwise fallback.
    try{
      if (vt === 'timeGridWeek') {
        const curStart = cal.view.currentStart || (typeof cal.getDate === 'function' ? cal.getDate() : null);
        const rangeStart = (info && info.start) ? info.start : (curStart || (typeof cal.getDate === 'function' ? cal.getDate() : new Date()));
        const rangeEnd = (info && info.end) ? info.end : (cal.view.currentEnd ? cal.view.currentEnd : addDays(rangeStart, 7));

        // Calcola orari effettivi della settimana visibile (aperture straordinarie + chiusure + standard)
        const wk = buildWeekBusinessHoursForRange(rangeStart, rangeEnd);
        const baseMin = (wk && wk.min) ? wk.min : (STORE_WEEK_MIN_TIME || '07:00:00');
        const baseMax = (wk && wk.max) ? wk.max : (STORE_WEEK_MAX_TIME || '22:00:00');
        const baseMaxPad = (wk && (wk.maxPad || wk.max)) ? (wk.maxPad || wk.max) : (STORE_WEEK_MAX_TIME_PAD || padSlotMaxTime(baseMax));
        const baseBH = (wk && Array.isArray(wk.businessHours)) ? wk.businessHours : [];
        const curKey = curStart ? ymd(curStart) : '';
        const patchOk = !!(
          activeAxisPatch &&
          Number(activeAxisPatch.isStaffDay || 0) === 0 &&
          String(activeAxisPatch.viewStartKey || '') === String(curKey || '')
        );

        if (patchOk) {
          window.__cal_actual_max_time = activeAxisPatch.actualMaxTime || (baseMax || null);
          _setCalOptIfChanged(cal, 'slotMinTime', activeAxisPatch.slotMinTime || baseMin);
          _setCalOptIfChanged(cal, 'slotMaxTime', activeAxisPatch.slotMaxTime || baseMaxPad);
        } else {
          if (activeAxisPatch && Number(activeAxisPatch.isStaffDay || 0) === 0) {
            try { window.__axis_patch_active = null; } catch(_e) {}
          }
          window.__cal_actual_max_time = baseMax || null;
          _setCalOptIfChanged(cal, 'slotMinTime', baseMin);
          _setCalOptIfChanged(cal, 'slotMaxTime', baseMaxPad);
        }

        // Business hours dinamiche: in timeGridWeek possiamo usare daysOfWeek perché ogni colonna è un giorno unico.
        _setBusinessHoursIfChanged(cal, baseBH);
        return;
      } else {
        // Any other view: just clear the stored patch to avoid leaking it across views.
        if (activeAxisPatch) {
          try { window.__axis_patch_active = null; } catch(_e) {}
        }
        window.__cal_actual_max_time = STORE_WEEK_MAX_TIME || null;
        _setCalOptIfChanged(cal, 'slotMinTime', STORE_WEEK_MIN_TIME);
        _setCalOptIfChanged(cal, 'slotMaxTime', STORE_WEEK_MAX_TIME_PAD);
      }
    } catch(_e) {
      window.__cal_actual_max_time = STORE_WEEK_MAX_TIME || null;
      _setCalOptIfChanged(cal, 'slotMinTime', STORE_WEEK_MIN_TIME);
      _setCalOptIfChanged(cal, 'slotMaxTime', STORE_WEEK_MAX_TIME_PAD);
    }
    _setBusinessHoursIfChanged(cal, STORE_BUSINESS_HOURS_WEEKLY || []);
  }catch(_){ }
}


// === Dynamic time axis (show appointments also outside shop hours) ===
// If an appointment starts before opening (e.g. 08:00) or ends after closing,
// expand slotMinTime/slotMaxTime for the current day/week so the event is visible.
const AXIS_STEP_MINUTES = 5; // keep in sync with slotDuration/snapDuration

function _dtStrToMinOfDay(dtStr){
  const s = String(dtStr || '').trim();
  // Accept both 'YYYY-MM-DD HH:MM:SS' and ISO 'YYYY-MM-DDTHH:MM:SS'
  const m = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if(!m) return null;
  let hh = parseInt(m[1], 10);
  let mm = parseInt(m[2], 10);
  if(Number.isNaN(hh) || Number.isNaN(mm)) return null;
  if(hh == 24 && mm == 0) return 24*60;
  if(hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh*60 + mm;
}

function _roundDown(min, step){
  step = Number(step || 1);
  if(!isFinite(step) || step <= 0) step = 1;
  return Math.floor(Number(min||0) / step) * step;
}

function _roundUp(min, step){
  step = Number(step || 1);
  if(!isFinite(step) || step <= 0) step = 1;
  return Math.ceil(Number(min||0) / step) * step;
}

function _isBackgroundOrUnavailability(ev){
  try{
    if(!ev) return true;
    const id = String(ev.id || '');
    const disp = String(ev.display || '');
    const ep = ev.extendedProps || {};
    if(disp === 'background') return true;
    if(id.startsWith('unav_')) return true;
    if(Number(ep.is_unavailability || 0) === 1) return true;
    return false;
  }catch(_){
    return true;
  }
}

function _computeDynamicAxisForEvents(events, baseMinStr, baseMaxStr){
  // baseMinStr/baseMaxStr are expected as HH:mm:ss (or HH:mm)
  const baseMin = _timeToMin(hhmmss(baseMinStr)) ?? 0;
  const baseMax = _timeToMin(hhmmss(baseMaxStr)) ?? (24*60);

  let evMin = null;
  let evMax = null;

  for(const ev of (events || [])){
    if(_isBackgroundOrUnavailability(ev)) continue;

    const sMin = _dtStrToMinOfDay(ev.start);
    if(sMin !== null){
      evMin = (evMin === null) ? sMin : Math.min(evMin, sMin);
    }

    let eMin = _dtStrToMinOfDay(ev.end);
    if(eMin === null) eMin = sMin;
    if(eMin !== null){
      evMax = (evMax === null) ? eMin : Math.max(evMax, eMin);
    }
  }

  const step = AXIS_STEP_MINUTES;

  let outMin = baseMin;
  let outMax = baseMax;

  if(evMin !== null) outMin = Math.min(outMin, _roundDown(evMin, step));
  if(evMax !== null) outMax = Math.max(outMax, _roundUp(evMax, step));

  // Sanity: ensure a positive range
  if(outMax <= outMin){
    outMax = Math.min(24*60, outMin + step);
  }

  const minStr = _minToHHMMSS(outMin);
  const maxStr = _minToHHMMSS(outMax);
  const maxPad = padSlotMaxTime(maxStr);

  return { min: minStr, max: maxStr, maxPad };
}

function computeAxisPatchFromEvents(events, ctx){
  try{
    const isStaffDay = !!(ctx && ctx.isStaffDayReq);
    const viewStart = (ctx && ctx.viewStart) ? ctx.viewStart : null;
    const viewEnd = (ctx && ctx.viewEnd) ? ctx.viewEnd : null;
    const viewStartKey = viewStart ? ymd(viewStart) : '';

    // Baseline = shop hours
    let baseMin = STORE_WEEK_MIN_TIME || '07:00:00';
    let baseMax = STORE_WEEK_MAX_TIME || '22:00:00';

    if(isStaffDay){
      // IMPORTANT:
      // The time axis must respect *straordinari* (special openings) too.
      // Using only the weekly DOW schedule would ignore per-date overrides and
      // would incorrectly clamp the day to the standard hours.
      const d = viewStart || (window.calendar && window.calendar.view ? window.calendar.view.currentStart : null) || new Date();
      const sch = getStoreScheduleForDate(d);
      if(sch && sch.min) baseMin = sch.min;
      if(sch && sch.max) baseMax = sch.max;
    } else {
      // Week view: baseline should follow the effective shop schedule for the whole range,
      // including straordinari (and excluding closures).
      const cal = window.calendar;
      const s = viewStart || (cal && cal.view ? cal.view.currentStart : null) || new Date();
      const e = viewEnd || (cal && cal.view ? cal.view.currentEnd : null) || null;
      if (s && e) {
        const wk = buildWeekBusinessHoursForRange(s, e);
        if (wk && wk.min) baseMin = wk.min;
        if (wk && wk.max) baseMax = wk.max;
      }
    }

    const dyn = _computeDynamicAxisForEvents(events, baseMin, baseMax);
    if(!dyn) return null;

    return {
      isStaffDay: isStaffDay ? 1 : 0,
      viewStartKey,
      slotMinTime: dyn.min,
      slotMaxTime: dyn.maxPad,
      actualMaxTime: dyn.max,
    };
  }catch(_){
    return null;
  }
}

function applyAxisPatch(patch){
  try{
    const cal = window.calendar;
    if(!cal || !cal.view || !patch) return;

    const vt = String(cal.view.type || '');
    const curStart = cal.view.currentStart || (typeof cal.getDate === 'function' ? cal.getDate() : null);
    const curKey = curStart ? ymd(curStart) : '';

    if(Number(patch.isStaffDay || 0) === 1){
      if(vt !== 'staffTimeGridDay') return;
      if(patch.viewStartKey && curKey && patch.viewStartKey !== curKey) return;
    } else {
      if(vt !== 'timeGridWeek') return;
      if(patch.viewStartKey && curKey && patch.viewStartKey !== curKey) return;
    }

    // Persist the applied patch so that `applyStoreHoursForView()` (triggered by
    // FullCalendar re-renders) does NOT overwrite the expanded axis back to shop hours.
    try { window.__axis_patch_active = patch; } catch(_e) {}

    // Used by selectAllow/eventAllow to prevent interacting with the tiny padded area.
    window.__cal_actual_max_time = patch.actualMaxTime || null;

    _setCalOptIfChanged(cal, 'slotMinTime', patch.slotMinTime);
    _setCalOptIfChanged(cal, 'slotMaxTime', patch.slotMaxTime);
  }catch(_){ }
}

// === FIX: nowIndicator line should span all staff columns in staffTimeGridDay ===
// In our staffTimeGridDay view each staff column is a fake day.
// FullCalendar draws the "now" line only on the real date column (first one),
// so we replicate it across all columns.

function updateStaffNowIndicator(){
  try{
    const cal = window.calendar;
    if(!cal || !cal.view) return;

    const root = cal.el || document.getElementById('calendar');
    if(!root) return;

    const vt = String(cal.view.type || '');
    const custom = root.querySelector('.staff-now-indicator-line');

    if(vt !== 'staffTimeGridDay'){
      // Restore default now line in other views
      root.querySelectorAll('.fc-timegrid-now-indicator-line').forEach(el => {
        try{ el.style.opacity = ''; }catch(_){ }
      });
      if(custom) custom.remove();
      return;
    }

    const cols = root.querySelector('.fc-timegrid-cols');
    const fcLine = root.querySelector('.fc-timegrid-now-indicator-line');

    // If no fcLine (e.g. viewing a day not containing "now"), remove our custom line.
    if(!cols || !fcLine){
      root.querySelectorAll('.fc-timegrid-now-indicator-line').forEach(el => {
        try{ el.style.opacity = ''; }catch(_){ }
      });
      if(custom) custom.remove();
      return;
    }

    // Ensure container positioning
    try{
      const cs = getComputedStyle(cols);
      if(cs.position === 'static') cols.style.position = 'relative';
    }catch(_){ }

    let el = custom;
    if(!el){
      el = document.createElement('div');
      el.className = 'staff-now-indicator-line';
      cols.appendChild(el);
    }

    // Copy vertical position from FullCalendar's own now-indicator line
    let top = String(fcLine.style.top || '').trim();
    if(!top){
      try{ top = String(getComputedStyle(fcLine).top || '').trim(); }catch(_){ top = ''; }
    }
    if(top) el.style.top = top;

    // Hide FC line(s) (keep the arrow on the time axis)
    root.querySelectorAll('.fc-timegrid-now-indicator-line').forEach(l => {
      try{ l.style.opacity = '0'; }catch(_){ }
    });
  }catch(_){ }
}

function installStaffNowIndicatorFix(){
  try{
    if(window.__staff_now_indicator_fix_installed) return;
    window.__staff_now_indicator_fix_installed = true;

    const tick = () => { try{ updateStaffNowIndicator(); }catch(_){ } };
    tick();

    // Keep it in sync with FullCalendar's internal nowIndicator updates (minute-based)
    window.__staff_now_indicator_timer = setInterval(tick, 30000);

    // Also update on scroll inside the timeGrid scroller
    const root = document.getElementById('calendar');
    if(root){
      root.addEventListener('scroll', tick, true);
    }
  }catch(_){ }
}

function formatCalendarHoverTime(mins){
  const n = Number(mins);
  if(!Number.isFinite(n)) return '';
  const total = Math.max(0, Math.min(24*60, Math.round(n)));
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return String(hh).padStart(2,'0') + ':' + String(mm).padStart(2,'0');
}

function ensureCalendarHoverTimeDisplay(){
  try{
    const root = document.getElementById('calendar');
    const shell = root ? root.closest('.calendar-shell') : null;
    if(!shell) return null;

    let el = shell.querySelector('.calendar-hover-time-display');
    if(el) return el;

    el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');

    const centerChunk = shell.querySelector('.fc .fc-header-toolbar .fc-toolbar-chunk:nth-child(2)');
    if(centerChunk){
      el.className = 'calendar-hover-time-display calendar-hover-time-display--inline';
      centerChunk.appendChild(el);
    } else {
      el.className = 'calendar-hover-time-display calendar-hover-time-display--floating';
      shell.appendChild(el);
    }

    return el;
  }catch(_){
    return null;
  }
}

function ensureCalendarHoverTimeGuideLine(){
  try{
    const root = document.getElementById('calendar');
    if(!root) return null;

    const cols = root.querySelector('.fc-timegrid-cols');
    if(!cols) return null;

    try{
      const cs = getComputedStyle(cols);
      if(cs.position === 'static') cols.style.position = 'relative';
    }catch(_){ }

    let line = cols.querySelector('.calendar-hover-time-line');
    if(line) return line;

    line = document.createElement('div');
    line.className = 'calendar-hover-time-line';
    cols.appendChild(line);
    return line;
  }catch(_){
    return null;
  }
}

function ensureCalendarHoverSlotHighlight(){
  try{
    const root = document.getElementById('calendar');
    if(!root) return null;

    const cols = root.querySelector('.fc-timegrid-cols');
    if(!cols) return null;

    try{
      const cs = getComputedStyle(cols);
      if(cs.position === 'static') cols.style.position = 'relative';
    }catch(_){ }

    let highlight = cols.querySelector('.calendar-hover-slot-highlight');
    if(highlight) return highlight;

    highlight = document.createElement('div');
    highlight.className = 'calendar-hover-slot-highlight';
    cols.appendChild(highlight);
    return highlight;
  }catch(_){
    return null;
  }
}

function hideCalendarHoverTimeIndicator(){
  try{
    const display = document.querySelector('.calendar-shell .calendar-hover-time-display');
    if(display){
      display.classList.remove('is-visible');
      display.textContent = '';
    }
  }catch(_){ }

  try{
    const line = document.querySelector('#calendar .calendar-hover-time-line');
    if(line){
      line.classList.remove('is-visible');
    }
  }catch(_){ }

  try{
    const highlight = document.querySelector('#calendar .calendar-hover-slot-highlight');
    if(highlight){
      highlight.classList.remove('is-visible');
    }
  }catch(_){ }
}

function getCalendarHoverSlotRows(){
  try{
    const root = document.getElementById('calendar');
    if(!root) return [];

    const rows = [];
    root.querySelectorAll('.fc-timegrid-slots tr').forEach(tr => {
      try{
        const timeEl = tr.querySelector('[data-time]');
        if(!timeEl) return;

        const startMin = _timeToMin(timeEl.getAttribute('data-time') || '');
        if(startMin === null) return;

        rows.push({ row: tr, startMin: startMin });
      }catch(_row){ }
    });

    return rows;
  }catch(_){
    return [];
  }
}

function getCalendarHoverTimeInfoFromPoint(clientX, clientY){
  try{
    const cal = window.calendar;
    if(!cal || !cal.view) return null;

    const vt = String(cal.view.type || '');
    if(vt !== 'staffTimeGridDay' && vt !== 'timeGridWeek') return null;

    const root = cal.el || document.getElementById('calendar');
    if(!root) return null;

    const cols = root.querySelector('.fc-timegrid-cols');
    if(!cols) return null;

    const colEls = Array.from(root.querySelectorAll('.fc-timegrid-cols .fc-timegrid-col')).filter(el => {
      try{
        const rect = el.getBoundingClientRect();
        return rect.width > 1 && rect.height > 1 && !el.classList.contains('fc-timegrid-axis');
      }catch(_){
        return false;
      }
    });

    let colMatch = null;
    const x = Number(clientX);
    if(Number.isFinite(x)){
      for(const col of colEls){
        const rect = col.getBoundingClientRect();
        if(x >= rect.left && x < rect.right){
          colMatch = { el: col, rect: rect };
          break;
        }
      }
    }
    if(!colMatch) return null;

    const rows = getCalendarHoverSlotRows();
    if(!rows.length) return null;

    let match = null;
    for(const item of rows){
      const rect = item.row.getBoundingClientRect();
      if(clientY >= rect.top && clientY < rect.bottom){
        match = { item: item, rect: rect };
        break;
      }
    }

    if(!match){
      const firstRect = rows[0].row.getBoundingClientRect();
      const lastRect = rows[rows.length - 1].row.getBoundingClientRect();
      if(clientY < firstRect.top || clientY > lastRect.bottom) return null;
      match = clientY < firstRect.top
        ? { item: rows[0], rect: firstRect }
        : { item: rows[rows.length - 1], rect: lastRect };
    }

    let minutes = Number(match.item.startMin || 0);
    const actualMax = _timeToMin(window.__cal_actual_max_time || '');
    if(actualMax !== null) minutes = Math.min(minutes, actualMax);

    const colsRect = cols.getBoundingClientRect();
    const lineTop = Math.max(0, match.rect.top - colsRect.top);
    const colLeft = Math.max(0, colMatch.rect.left - colsRect.left);
    const colWidth = Math.max(0, colMatch.rect.width);
    const slotHeight = Math.max(1, match.rect.height || 0);

    return {
      minutes: minutes,
      lineTop: lineTop,
      colLeft: colLeft,
      colWidth: colWidth,
      slotHeight: slotHeight
    };
  }catch(_){
    return null;
  }
}

function renderCalendarHoverTimeFromPoint(point){
  try{
    if(!point || !Number.isFinite(Number(point.clientY))){
      hideCalendarHoverTimeIndicator();
      return;
    }

    const info = getCalendarHoverTimeInfoFromPoint(Number(point.clientX), Number(point.clientY));
    if(!info){
      hideCalendarHoverTimeIndicator();
      return;
    }

    const display = ensureCalendarHoverTimeDisplay();
    if(display){
      display.textContent = formatCalendarHoverTime(info.minutes);
      display.classList.add('is-visible');
    }

    const line = ensureCalendarHoverTimeGuideLine();
    if(line){
      line.style.top = String(info.lineTop) + 'px';
      line.classList.add('is-visible');
    }

    const highlight = ensureCalendarHoverSlotHighlight();
    if(highlight){
      highlight.style.left = String(info.colLeft) + 'px';
      highlight.style.top = String(info.lineTop) + 'px';
      highlight.style.width = String(info.colWidth) + 'px';
      highlight.style.height = String(info.slotHeight) + 'px';
      highlight.classList.add('is-visible');
    }
  }catch(_){
    hideCalendarHoverTimeIndicator();
  }
}

function scheduleCalendarHoverTimeUpdate(point){
  try{
    window.__calendar_hover_last_point = point || null;

    if(window.__calendar_hover_time_raf) return;

    window.__calendar_hover_time_raf = window.requestAnimationFrame(function(){
      window.__calendar_hover_time_raf = 0;
      renderCalendarHoverTimeFromPoint(window.__calendar_hover_last_point || null);
    });
  }catch(_){
    renderCalendarHoverTimeFromPoint(point || null);
  }
}

function refreshCalendarHoverTimeFromLastPoint(){
  try{
    if(!window.__calendar_hover_last_point){
      hideCalendarHoverTimeIndicator();
      return;
    }
    scheduleCalendarHoverTimeUpdate(window.__calendar_hover_last_point);
  }catch(_){
    hideCalendarHoverTimeIndicator();
  }
}

function installCalendarHoverTimeIndicator(){
  try{
    if(window.__calendar_hover_time_installed) return;
    window.__calendar_hover_time_installed = true;

    const root = document.getElementById('calendar');
    if(!root) return;

    const onPointerMove = function(evt){
      try{
        const target = evt && evt.target;
        if(target && target.closest && target.closest('.fc-event:not(.fc-bg-event)')){
          hideCalendarHoverTimeIndicator();
          return;
        }

        const clientX = Number(evt && evt.clientX);
        const clientY = Number(evt && evt.clientY);
        if(!Number.isFinite(clientX) || !Number.isFinite(clientY)){
          hideCalendarHoverTimeIndicator();
          return;
        }

        scheduleCalendarHoverTimeUpdate({ clientX: clientX, clientY: clientY });
      }catch(_){
        hideCalendarHoverTimeIndicator();
      }
    };

    root.addEventListener('pointermove', onPointerMove, true);
    root.addEventListener('mousemove', onPointerMove, true);

    ['pointerleave', 'mouseleave'].forEach(evtName => {
      root.addEventListener(evtName, function(){
        window.__calendar_hover_last_point = null;
        hideCalendarHoverTimeIndicator();
      }, true);
    });

    root.addEventListener('scroll', function(){
      refreshCalendarHoverTimeFromLastPoint();
    }, true);

    window.addEventListener('resize', function(){
      refreshCalendarHoverTimeFromLastPoint();
    });
  }catch(_){ }
}
    const modalEl = document.getElementById('apptModal');
    const modal = new bootstrap.Modal(modalEl);

    const form = document.getElementById('apptForm');
    const btnSave = document.getElementById('btnSave');
    const btnDelete = document.getElementById('btnDelete');
    const btnDeleteDefaultHtml = btnDelete ? btnDelete.innerHTML : '';

    const clientSel = document.getElementById('client_id');
    const newClientBox = document.getElementById('newClientBox');

    // Fidelity (punti su appuntamento)
    const fidUseEl = document.getElementById('fidelity_points_use');
    const fidAvailEl = document.getElementById('fidelity_points_available');

    const serviceSel = document.getElementById('service_id');
    const staffSel = document.getElementById('staff_id');
    const startsAtEl = document.getElementById('starts_at');
    const endsAtEl = document.getElementById('ends_at');
    const calendarInitialStaffOptions = staffSel
      ? Array.from(staffSel.options || []).map(opt => ({ value: opt.value, text: opt.textContent || '', disabled: !!opt.disabled }))
      : [];
    const fidPreviewAlert = document.getElementById('fidelity_preview_alert');

    // Dettaglio costi (solo se fidelity redeem è attivo)
    const costSubtotalEl = document.getElementById('cost_subtotal');
    const costFidRow = document.getElementById('cost_fidelity_row');
    const costFidLabelEl = document.getElementById('cost_fidelity_label');
    const costFidDiscountEl = document.getElementById('cost_fidelity_discount');
    const costTotalEl = document.getElementById('cost_total');

    const euroFmt = new Intl.NumberFormat('it-IT', { style:'currency', currency:'EUR' });
    const euro = (n) => euroFmt.format((Number(n) || 0));

    function isDeleteAllowedStatus(v){
      const s = String(v || '').trim().toLowerCase();
      return s === 'canceled' || s === 'cancelled' || s === 'annullato';
    }

    function syncDeleteButtonState(statusValue, hasAppointmentId){
      if (!btnDelete) return;
      const hasId = !!hasAppointmentId;
      const locked = hasId && !isDeleteAllowedStatus(statusValue);
      const blockedByPerm = hasId && !CAN_MANAGE_APPOINTMENTS;
      btnDelete.hidden = !hasId;
      btnDelete.disabled = locked || blockedByPerm;
      btnDelete.classList.toggle('disabled', locked || blockedByPerm);
      btnDelete.title = locked ? 'La prenotazione deve essere in stato Annullato. Annullala prima per poterla eliminare.' : '';
      if (blockedByPerm) btnDelete.title = 'Permesso Appuntamenti richiesto.';
      btnDelete.innerHTML = locked
        ? '<i class="bi bi-x-circle me-1"></i>Annulla prima'
        : btnDeleteDefaultHtml;
    }

    function syncModalActionPermissions(){
      if (!btnSave) return;
      const hasId = !!String(document.getElementById('appt_id')?.value || '').trim();
      const canSave = hasId ? CAN_MANAGE_APPOINTMENTS : CAN_CREATE_APPOINTMENTS;
      btnSave.disabled = !canSave;
      btnSave.classList.toggle('disabled', !canSave);
      btnSave.title = canSave ? '' : (hasId ? 'Permesso Appuntamenti richiesto.' : 'Permesso Prenotazione rapida richiesto.');
    }

    const wholePts = (n) => {
      const v = parseFloat(String(n || 0).replace(',', '.')) || 0;
      if (!Number.isFinite(v)) return 0;
      if (v > 0) return Math.floor(v + 1e-9);
      if (v < 0) return Math.ceil(v - 1e-9);
      return 0;
    };
    const fmtPts = (n) => String(wholePts(n));
    const FID_LABEL = String(calendarConfig.fidelityLabel || 'Punti');
    const FID_AUTO_DISCOUNT = false;
    const FID_CONFLICT_POLICY = String(calendarConfig.fidelityConflictPolicy || 'discount');

    function getSelectedServiceSubtotal(){
      if (!serviceSel) return 0;
      const opt = serviceSel.querySelector('option:checked');
      if (!opt) return 0;
      const p = parseFloat(opt.dataset.price || '0');
      return isFinite(p) ? p : 0;
    }

    function renderCostDetails(subtotal, fidelityDiscount, pointsUsed){
      if (!costSubtotalEl || !costTotalEl) return;
      const sub = Number(subtotal) || 0;
      let fid = Number(fidelityDiscount) || 0;
      if (fid < 0) fid = -fid;

      costSubtotalEl.textContent = euro(sub);

      if (costFidRow && costFidDiscountEl) {
        const show = fid > 0.00001;
        costFidRow.classList.toggle('d-none', !show);
        if (show) {
          costFidDiscountEl.textContent = '- ' + euro(fid);
          const pu = Math.round(((parseFloat(String(pointsUsed || 0).replace(',', '.')) || 0) * 100)) / 100;
          if (costFidLabelEl && pu > 0) costFidLabelEl.textContent = `Sconto Fidelity (${fmtPts(pu)} ${FID_LABEL})`;
          else if (costFidLabelEl) costFidLabelEl.textContent = 'Sconto Fidelity';
        } else {
          if (costFidLabelEl) costFidLabelEl.textContent = 'Sconto Fidelity';
        }
      }

      const tot = Math.max(0, sub - fid);
      costTotalEl.textContent = euro(tot);
    }

    // Auto-suggerimento: se l'utente non ha toccato il campo, proponiamo automaticamente i punti massimi utilizzabili.
    let fidTouched = false;
    let fidSuppressTouch = false;

    async function fetchFidelityPreview(clientId, serviceId, requestedPoints, appointmentId){
      try {
        const url = new URL('index.php', window.location.origin);
        url.searchParams.set('page', 'api_appointments');
        url.searchParams.set('action', 'fidelity_preview');
        url.searchParams.set('client_id', String(clientId || ''));
        url.searchParams.set('service_ids', String(serviceId || ''));
        url.searchParams.set('requested_points', String(requestedPoints || 0));
        if (appointmentId) url.searchParams.set('appointment_id', String(appointmentId));
        const locEl = document.getElementById('location_id');
        const locId = locEl ? String(locEl.value || '').trim() : '';
        if (locId) url.searchParams.set('location_id', locId);
        const startsRaw = startsAtEl ? String(startsAtEl.value || '').trim() : '';
        const dateMatch = startsRaw.match(/^(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) url.searchParams.set('appt_date', dateMatch[1]);
        const timeMatch = startsRaw.match(/[T ](\d{2}:\d{2})/);
        if (timeMatch) url.searchParams.set('appt_time', timeMatch[1]);

        const res = await fetch(url.toString(), { credentials: 'same-origin', headers: {'Accept':'application/json'} });
        const js = await res.json();
        return js;
      } catch (e) {
        return null;
      }
    }

    async function refreshFidelityUI(opts = { mode: 'manual' }){
      const mode = (opts && opts.mode) ? String(opts.mode) : 'manual';
      const subtotal = getSelectedServiceSubtotal();

      // Default UI
      if (fidPreviewAlert) {
        fidPreviewAlert.classList.add('d-none');
        fidPreviewAlert.innerHTML = '';
        fidPreviewAlert.classList.remove('alert-warning');
        fidPreviewAlert.classList.add('alert-info');
      }
      renderCostDetails(subtotal, 0, 0);

      if (!fidUseEl || !clientSel || !serviceSel) return;

      const clientId = clientSel.value;
      const serviceId = serviceSel.value;
      const apptId = document.getElementById('appt_id')?.value || '';

      if (!clientId || clientId === '__new__' || !serviceId) {
        // Nothing to compute
        return;
      }

      let requested = (parseFloat(String(fidUseEl.value || '0').replace(',', '.')) || 0);
      requested = Math.round(requested * 100) / 100;

      // In modalità "auto" applichiamo in automatico il massimo (solo se l'utente non ha toccato il campo)
      // In modalità "suggest" calcoliamo comunque il massimo possibile ma NON applichiamo lo sconto.
      let previewRequested = requested;
      if (mode === 'auto') {
        if (!fidTouched) previewRequested = 999999999;
      } else if (mode === 'suggest') {
        if (previewRequested <= 0 || !fidTouched) previewRequested = 999999999;
      }

      let applyDiscount = (mode === 'auto' || mode === 'manual');
      const suggestOnly = (mode === 'suggest');

      if (!suggestOnly && previewRequested <= 0) {
        // Nessun punto selezionato => nessuno sconto applicato
        return;
      }

      const js = await fetchFidelityPreview(clientId, serviceId, previewRequested, apptId);

      let pointsUsed = 0;
      let discount = 0;
      let available = 0;
      let error = null;

      if (js && js.ok && js.enabled) {
        pointsUsed = Math.round(((parseFloat(String(js.points_used || js.points || 0).replace(',', '.')) || 0) * 100)) / 100;
        discount = parseFloat(js.discount || 0) || 0;
        available = Math.round(((parseFloat(String(js.available_points || 0).replace(',', '.')) || 0) * 100)) / 100;
        error = js.error || null;
      }

      // --- Omaggi / conflitto (calcolo una volta) ---
      const conflictPolicy = String(FID_CONFLICT_POLICY || 'discount');

      const giftEnabledFlag = !!(js && js.ok && js.enabled ? (parseInt(js.gift_enabled || 0, 10) || 0) : 0);
      const giftRedeemed = !!(js && js.ok && js.enabled ? (parseInt(js.gift_redeemed || 0, 10) || 0) : 0);
      const giftRedeemedNote = (js && js.gift_redeemed_note) ? String(js.gift_redeemed_note) : '';

      // Lista omaggi: preferisci js.gifts; fallback su campi legacy.
      let giftList = [];
      if (js && Array.isArray(js.gifts)) {
        giftList = js.gifts.map(g => {
          const idx = parseInt(g.idx ?? g.index ?? 0, 10) || 0;
          const min = wholePts(g.min_points ?? g.min ?? 0);
          const desc = (g.description ? String(g.description) : '');
          return { idx, min_points: min, description: desc };
        });
      } else {
        const legacyMin = wholePts((js && js.gift_min_points) || 0);
        const legacyDesc = (js && js.gift_description) ? String(js.gift_description) : '';
        if (legacyMin > 0) giftList = [{ idx: 0, min_points: legacyMin, description: legacyDesc }];
      }
      giftList = giftList.filter(g => (g.min_points || 0) > 0);
      giftList.sort((a,b) => (a.min_points||0) - (b.min_points||0));

      const canDiscount = (pointsUsed > 0 && discount > 0.00001);
      let bestGiftNoDiscount = null;
      let bestGiftAfterMaxDiscount = null;
      if (giftEnabledFlag && !giftRedeemed && giftList.length) {
        // Miglior gift ottenibile senza applicare lo sconto
        bestGiftNoDiscount = giftList.filter(g => (available + 0.0000001) >= (g.min_points || 0)).slice(-1)[0] || null;
        // Miglior gift ottenibile dopo aver applicato lo sconto (punti usati)
        const remAfter = Math.max(0, (available || 0) - (pointsUsed || 0));
        bestGiftAfterMaxDiscount = giftList.filter(g => (remAfter + 0.0000001) >= (g.min_points || 0)).slice(-1)[0] || null;
      }
      const fidConflict = !!(canDiscount && bestGiftNoDiscount && !bestGiftAfterMaxDiscount);

      // Se auto e conflitto, in base alla politica possiamo NON applicare lo sconto automaticamente.
      if (mode === 'auto' && applyDiscount && fidConflict && (conflictPolicy === 'gift' || conflictPolicy === 'choice')) {
        applyDiscount = false;
      }

      // Auto-fill input con i punti normalizzati solo se stiamo realmente applicando lo sconto in auto.
      if (!fidTouched && mode === 'auto') {
        fidSuppressTouch = true;
        fidUseEl.value = (applyDiscount && pointsUsed >= 0) ? String(pointsUsed) : '0';
        fidSuppressTouch = false;
      }

      // Render cost details (applica sconto solo se richiesto)
      const appliedPoints = applyDiscount ? pointsUsed : 0;
      const appliedDiscount = applyDiscount ? discount : 0;
      renderCostDetails(subtotal, appliedDiscount, appliedPoints);

      if (fidPreviewAlert) {
        const giftRemaining = Math.max(0, (available || 0) - (appliedPoints || 0));
        const redeemableGifts = (!giftEnabledFlag || giftRedeemed) ? [] : giftList.filter(g => (giftRemaining + 0.0000001) >= (g.min_points || 0));

        if (error) {
          fidPreviewAlert.classList.remove('d-none');
          fidPreviewAlert.classList.remove('alert-info');
          fidPreviewAlert.classList.add('alert-warning');
          fidPreviewAlert.innerHTML = `<i class="bi bi-exclamation-triangle me-1"></i>${escapeHtml(error)}`;
        } else {
          const parts = [];

          // 1) Sconto punti
          const discountApplied = (applyDiscount && canDiscount);
          const hideDiscountSuggestion = (!discountApplied && fidConflict && conflictPolicy === 'gift');

          if (canDiscount && !hideDiscountSuggestion) {
            if (discountApplied) {
              parts.push(`Verranno scalati <strong>${fmtPts(pointsUsed)}</strong> ${escapeHtml(FID_LABEL || 'Punti')} quando l'appuntamento sarà eseguito.`);
            } else {
              const lbl = escapeHtml(FID_LABEL || 'Punti');
              const availTxt = (available > 0 ? `<strong>${fmtPts(available)}</strong> ${lbl}` : `i ${lbl} del cliente`);
              const maxTxt = `fino a <strong>${euro(discount)}</strong>`;
              const helpTxt = (fidConflict && conflictPolicy === 'choice')
                ? `Il cliente potrà scegliere in cassa se usare lo sconto oppure l'omaggio.`
                : `In alternativa potrà richiederlo in cassa.`;
              parts.push(`
                Il cliente ha a disposizione ${availTxt} per uno sconto ${maxTxt}.
                <button type="button" class="btn btn-sm btn-outline-primary ms-2" id="fidApplyBtn">Applica sconto</button>
                <div class="small text-muted mt-1">${helpTxt}</div>
              `);
            }
          }

          // 2) Omaggi
          const hideGift = (!giftRedeemed && fidConflict && conflictPolicy === 'discount' && canDiscount);
          if (!hideGift) {
            if (giftRedeemed) {
              const note = giftRedeemedNote.trim();
              const noteTxt = note ? ` <span class="text-muted">(${escapeHtml(note)})</span>` : '';
              parts.push(`<div class="small text-muted">omaggio Fidelity già registrato per questo appuntamento.${noteTxt}</div>`);
            } else if (redeemableGifts.length) {
              if (apptId) {
                if (redeemableGifts.length === 1) {
                  const g = redeemableGifts[0];
                  const d = (g.description || '').trim();
                  const descTxt = d ? `: <strong>${escapeHtml(d)}</strong>` : '';
                  parts.push(`omaggio Fidelity disponibile (soglia <strong>${fmtPts(g.min_points)}</strong> ${escapeHtml(FID_LABEL || 'Punti')})${descTxt}.
                    <button type="button" class="btn btn-sm btn-outline-success ms-2" id="fidGiftBtn" data-gift-idx="${g.idx}">Registra gift</button>`);
                } else {
                  const best = redeemableGifts[redeemableGifts.length - 1];
                  const opts = redeemableGifts.map(g => {
                    const ptxt = `${fmtPts(g.min_points)} ${FID_LABEL || 'Punti'}`;
                    const dtxt = (g.description || '').trim() ? ` — ${String(g.description).trim()}` : '';
                    const sel = (g.idx === best.idx) ? 'selected' : '';
                    return `<option value="${g.idx}" ${sel}>${escapeHtml(ptxt + dtxt)}</option>`;
                  }).join('');
                  parts.push(`omaggio Fidelity disponibile:
                    <select class="form-select form-select-sm d-inline-block w-auto ms-2 align-middle" id="fidGiftSelect">${opts}</select>
                    <button type="button" class="btn btn-sm btn-outline-success ms-2" id="fidGiftBtn">Registra gift</button>`);
                }
              } else {
                const best = redeemableGifts[redeemableGifts.length - 1];
                const d = (best.description || '').trim();
                const descTxt = d ? `: <strong>${escapeHtml(d)}</strong>` : '';
                parts.push(`omaggio Fidelity disponibile${descTxt}. <span class="small text-muted">(Salva l'appuntamento per registrarlo)</span>`);
              }
            }
          }

          if (parts.length) {
            fidPreviewAlert.classList.remove('d-none');
            fidPreviewAlert.classList.remove('alert-warning');
            fidPreviewAlert.classList.add('alert-info');
            fidPreviewAlert.innerHTML = `<i class="bi bi-info-circle me-1"></i>${parts.join('<br>')}`;

            const btnApply = fidPreviewAlert.querySelector('#fidApplyBtn');
            if (btnApply) {
              btnApply.addEventListener('click', () => {
                // L'utente ha scelto di applicare lo sconto: imposta i punti normalizzati e ricalcola
                fidTouched = true;
                fidSuppressTouch = true;
                fidUseEl.value = String(pointsUsed);
                fidSuppressTouch = false;
                refreshFidelityUI({ mode: 'manual' });
              });
            }

            const btnGift = fidPreviewAlert.querySelector('#fidGiftBtn');
            if (btnGift) {
              btnGift.addEventListener('click', async () => {
                btnGift.disabled = true;
                try {
                  // Selezione gift (multi-soglia)
                  let giftIdx = null;
                  const sel = fidPreviewAlert.querySelector('#fidGiftSelect');
                  if (sel && sel.value !== undefined && sel.value !== null && String(sel.value) !== '') {
                    giftIdx = String(sel.value);
                  } else {
                    const v = btnGift.getAttribute('data-gift-idx');
                    if (v !== null && v !== undefined && String(v) !== '') giftIdx = String(v);
                  }

                  const payload = {
                    _csrf: csrf,
                    action: 'fidelity_gift_redeem',
                    client_id: String(clientId),
                    appointment_id: String(apptId)
                  };
                  if (giftIdx !== null) payload.gift_idx = String(giftIdx);

                  const resp = await postForm('index.php?page=api_appointments', payload);
                  if (resp && resp.ok) {
                    showAlert('gift registrato con successo.', 'success');
                    // Aggiorna punti disponibili e UI
                    refreshFidelityAvailability(String(clientId || ''));
                    refreshFidelityUI({ mode: mode });
                  } else {
                    showAlert(escapeHtml((resp && resp.error) ? resp.error : 'Operazione non riuscita'), 'danger');
                    btnGift.disabled = false;
                  }
                } catch (e) {
                  showAlert('Errore di rete durante la registrazione dell\'gift.', 'danger');
                  btnGift.disabled = false;
                }
              });
            }
          } else {
            fidPreviewAlert.classList.add('d-none');
            fidPreviewAlert.innerHTML = '';
          }
        }
      }
    }

    async function refreshFidelityAvailability(clientId) {
      if (!fidUseEl || !fidAvailEl) return;
      if (!clientId || clientId === '__new__') {
        fidAvailEl.textContent = '-';
        return;
      }
      try {
        const url = `index.php?page=api_clients&action=points&client_id=${encodeURIComponent(clientId)}`;
        const res = await fetch(url, { credentials: 'same-origin' });
        const js = await res.json();
        if (js && js.ok) {
          const av = (js.available_points !== undefined && js.available_points !== null) ? js.available_points : (js.points || 0);
          fidAvailEl.textContent = fmtPts(av);
        } else {
          fidAvailEl.textContent = '-';
        }
      } catch (e) {
        fidAvailEl.textContent = '-';
      }
    }

    clientSel.addEventListener('change', () => {
      newClientBox.hidden = (clientSel.value !== '__new__');
      refreshFidelityAvailability(clientSel.value);
      // Cambio cliente: reset punti selezionati (i punti appartengono al cliente)
      if (fidUseEl) {
        fidSuppressTouch = true;
        fidUseEl.value = '0';
        fidSuppressTouch = false;
      }
      fidTouched = false;

      // Auto: applica in automatico. Se auto disattivo: mostra solo avviso (a meno che non sia già stato inserito un valore).
      const req = (parseFloat(String(fidUseEl?.value || '0').replace(',', '.')) || 0);
      const mode = (req > 0) ? 'manual' : (FID_AUTO_DISCOUNT ? 'auto' : 'suggest');
      refreshFidelityUI({ mode });
    });

    if (serviceSel) {
      serviceSel.addEventListener('change', () => {
        refreshCalendarStaffForService();
        // Cambiando servizio: ricalcola dettaglio costi.
        // Se i punti sono già stati inseriti, mantieni la scelta (manual); altrimenti auto/suggest.
        const req = (parseFloat(String(fidUseEl?.value || '0').replace(',', '.')) || 0);
        const mode = (req > 0) ? 'manual' : (FID_AUTO_DISCOUNT ? 'auto' : 'suggest');
        refreshFidelityUI({ mode });
      });
    }

    if (fidUseEl) {
      fidUseEl.addEventListener('input', () => {
        if (!fidSuppressTouch) fidTouched = true;
        refreshFidelityUI({ mode: 'manual' });
      });
    }

    let calendarTimeRefreshTimer = null;
    function scheduleCalendarTimeDependentRefresh(){
      if (calendarTimeRefreshTimer) clearTimeout(calendarTimeRefreshTimer);
      calendarTimeRefreshTimer = setTimeout(() => {
        calendarTimeRefreshTimer = null;
        refreshCalendarStaffForService();
        const req = (parseFloat(String(fidUseEl?.value || '0').replace(',', '.')) || 0);
        const mode = (req > 0) ? 'manual' : (FID_AUTO_DISCOUNT ? 'auto' : 'suggest');
        refreshFidelityUI({ mode });
      }, 150);
    }

    [startsAtEl, endsAtEl].filter(Boolean).forEach(el => {
      el.addEventListener('input', scheduleCalendarTimeDependentRefresh);
      el.addEventListener('change', scheduleCalendarTimeDependentRefresh);
    });

    // --- Trova cliente (ricerca) ---
    const linkNewClient = document.getElementById('linkNewClient');
    const linkFindClient = document.getElementById('linkFindClient');

    const clientFindModalEl = document.getElementById('clientFindModal');
    const clientFindModal = new bootstrap.Modal(clientFindModalEl);
    const clientFindQuery = document.getElementById('clientFindQuery');
    const clientFindResults = document.getElementById('clientFindResults');
    const clientFindClear = document.getElementById('clientFindClear');

    function ensureClientOption(id, label){
      const value = String(id);
      if ([...clientSel.options].some(o => o.value === value)) return;
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      // inserisci prima dell'opzione "__new__" se presente
      const newOpt = [...clientSel.options].find(o => o.value === '__new__');
      if (newOpt) clientSel.insertBefore(opt, newOpt);
      else clientSel.appendChild(opt);
    }

    linkNewClient?.addEventListener('click', (e) => {
      e.preventDefault();
      clientSel.value = '__new__';
      clientSel.dispatchEvent(new Event('change'));
    });

    linkFindClient?.addEventListener('click', (e) => {
      e.preventDefault();
      clientFindQuery.value = '';
      clientFindResults.innerHTML = '';
      clientFindModal.show();
      setTimeout(() => clientFindQuery.focus(), 250);
    });

    clientFindClear?.addEventListener('click', () => {
      clientFindQuery.value = '';
      clientFindResults.innerHTML = '';
      clientFindModal.hide();
    });

    function renderClientResults(list){
      if (!Array.isArray(list) || list.length === 0) {
        clientFindResults.innerHTML = '<div class="text-muted small p-2">Nessun risultato.</div>';
        return;
      }

      clientFindResults.innerHTML = '';
      for (const c of list) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'list-group-item list-group-item-action';
        const email = c.email ? String(c.email) : '';
        const phone = c.phone ? String(c.phone) : '';
        btn.innerHTML = `
          <div class="d-flex gap-3 align-items-start">
            <div class="rounded-circle bg-light calendar-client-search-avatar"></div>
            <div class="flex-grow-1">
              <div class="fw-semibold calendar-client-search-name">${escapeHtml(c.full_name || '')}</div>
              <div class="text-muted small">Email: ${escapeHtml(email || '—')}</div>
              <div class="text-muted small">Telefono: ${escapeHtml(phone || '—')}</div>
            </div>
          </div>
        `;
        btn.addEventListener('click', () => {
          const id = c.id;
          ensureClientOption(id, c.full_name);
          clientSel.value = String(id);
          clientSel.dispatchEvent(new Event('change'));
          clientFindModal.hide();
        });
        clientFindResults.appendChild(btn);
      }
    }

    function escapeHtml(s){
      return String(s)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }

    let clientSearchTimer = null;
    async function searchClients(){
      const q = clientFindQuery.value.trim();
      if (!q) { clientFindResults.innerHTML = ''; return; }
      const res = await fetch('index.php?page=api_clients&action=search&exclude_blocked=1&q=' + encodeURIComponent(q));
      const data = await res.json();
      if (!data.ok) {
        clientFindResults.innerHTML = '<div class="text-danger small p-2">Errore ricerca</div>';
        return;
      }
      renderClientResults(data.clients || []);
    }

    clientFindQuery?.addEventListener('input', () => {
      if (clientSearchTimer) clearTimeout(clientSearchTimer);
      clientSearchTimer = setTimeout(searchClients, 250);
    });

    function fmtLocal(dt) {
      const pad = n => String(n).padStart(2,'0');
      const y = dt.getFullYear();
      const m = pad(dt.getMonth()+1);
      const d = pad(dt.getDate());
      const hh = pad(dt.getHours());
      const mm = pad(dt.getMinutes());
      return `${y}-${m}-${d}T${hh}:${mm}`;
    }

    function fmtMysql(dt){
      const pad = n => String(n).padStart(2,'0');
      const y = dt.getFullYear();
      const m = pad(dt.getMonth()+1);
      const d = pad(dt.getDate());
      const hh = pad(dt.getHours());
      const mm = pad(dt.getMinutes());
      const ss = pad(dt.getSeconds());
      return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
    }

    function showAlert(msg, type='danger'){
      const el = document.getElementById('modalAlert');
      el.innerHTML = `<div class="alert alert-${type} d-flex gap-2"><div><i class="bi bi-info-circle"></i></div><div>${msg}</div></div>`;
    }

    async function postForm(url, dataObj){
      const body = new URLSearchParams(dataObj);
      const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body });
      return await res.json();
    }

    function resetModal(){
      document.getElementById('modalAlert').innerHTML='';
      form.reset();
      document.getElementById('appt_id').value='';
      document.getElementById('modalTitle').textContent='Nuovo appuntamento';
      syncDeleteButtonState('', false);
      syncModalActionPermissions();
      newClientBox.hidden = true;

      // Reset Fidelity
      if (fidUseEl) fidUseEl.value = '0';
      if (fidAvailEl) fidAvailEl.textContent = '-';
      fidTouched = false;
      if (fidPreviewAlert) { fidPreviewAlert.classList.add('d-none'); fidPreviewAlert.innerHTML = ''; }
      renderCostDetails(0, 0, 0);
    }

    function fillModal(data){
      document.getElementById('appt_id').value = data.id || '';
      document.getElementById('modalTitle').textContent = data.id ? 'Modifica appuntamento' : 'Nuovo appuntamento';
      syncDeleteButtonState(data.status || '', !!data.id);
      syncModalActionPermissions();

      if (data.client_id) {
        ensureClientOption(data.client_id, data.client_full_name || ('Cliente #' + data.client_id));
      }
      document.getElementById('client_id').value = String(data.client_id || '');
      document.getElementById('service_id').value = String(data.service_id || '');
      document.getElementById('staff_id').value = String(data.staff_id || '');
      document.getElementById('location_id').value = String(data.location_id || (filterLocation ? filterLocation.value : '') || '');
      document.getElementById('starts_at').value = data.starts_at_local || '';
      document.getElementById('ends_at').value = data.ends_at_local || '';
      syncCalendarServicesForLocations();
      refreshCalendarStaffForService(data.staff_id || '');
      document.getElementById('status').value = String(data.status || 'scheduled');
      document.getElementById('notes').value = data.notes || '';

      // Fidelity
      if (fidUseEl) {
        fidUseEl.value = fmtPts((data.fidelity_points_used ?? 0) || 0);
      }
      if (fidAvailEl) {
        if (data.fidelity_available_points !== undefined && data.fidelity_available_points !== null) {
          fidAvailEl.textContent = fmtPts(data.fidelity_available_points);
        } else {
          // fallback: fetch dal client
          refreshFidelityAvailability(String(data.client_id || ''));
        }
      }

      // Aggiorna anteprima + dettaglio costi (in modifica NON auto-suggerire)
      if (data.id) fidTouched = true;
      const req = (parseFloat(String(fidUseEl?.value || '0').replace(',', '.')) || 0);
      // In modifica: se ci sono punti già impostati, applica (manual). Altrimenti, se l'auto-sconto è disattivo, mostra solo il suggerimento.
      const mode = (req > 0) ? 'manual' : (FID_AUTO_DISCOUNT ? 'manual' : 'suggest');
      refreshFidelityUI({ mode });
    }

    btnSave.addEventListener('click', async ()=>{
      document.getElementById('modalAlert').innerHTML='';
      const hasId = !!String(document.getElementById('appt_id')?.value || '').trim();
      if (hasId && !CAN_MANAGE_APPOINTMENTS) { showAlert('Permesso Appuntamenti richiesto.'); return; }
      if (!hasId && !CAN_CREATE_APPOINTMENTS) { showAlert('Permesso Prenotazione rapida richiesto.'); return; }
      const fd = new FormData(form);
      const obj = Object.fromEntries(fd.entries());
      obj._csrf = csrf;
      obj.action = 'save';

      if (obj.client_id === '__new__') {
        if (!obj.new_full_name) { showAlert('Inserisci il nome del nuovo cliente.'); return; }
      } else {
        if (!obj.client_id) { showAlert('Seleziona un cliente.'); return; }
      }
      if (!obj.starts_at || !obj.ends_at) { showAlert('Inserisci inizio e fine.'); return; }

      const resp = await postForm('index.php?page=api_appointments', obj);
      if (!resp.ok) { showAlert(resp.error || 'Errore salvataggio'); return; }
      modal.hide();
      window.calendar.refetchEvents();
    });

    btnDelete.addEventListener('click', async ()=>{
      if (!CAN_MANAGE_APPOINTMENTS) { showAlert('Permesso Appuntamenti richiesto.'); return; }
      const id = document.getElementById('appt_id').value;
      if(!id) return;
      const statusValue = document.getElementById('status')?.value || '';
      if (!isDeleteAllowedStatus(statusValue)) {
        syncDeleteButtonState(statusValue, true);
        showAlert('La prenotazione deve essere in stato Annullato. Annullala prima per poterla eliminare.');
        return;
      }
      if(!confirm('Eliminare questo appuntamento?')) return;
      const resp = await postForm('index.php?page=api_appointments', { _csrf: csrf, action:'delete', id });
      if (!resp.ok) { showAlert(resp.error || 'Errore eliminazione'); return; }
      modal.hide();
      window.calendar.refetchEvents();
    });

    const filterService = document.getElementById('filterService');
    const filterStaff = document.getElementById('filterStaff');
    const filterStatus = document.getElementById('filterStatus');
    const filterLocation = document.getElementById('filterLocation');
    const modalLocationSelect = document.getElementById('location_id');

    function calendarServiceAllowedInLocation(opt, locationId){
      if (!opt || !opt.value) return true;
      const loc = String(locationId || '').trim();
      if (!loc) return true;
      const raw = String(opt.dataset.locationIds || '').trim();
      if (!raw) return true;
      return raw.split(',').map(v => v.trim()).filter(Boolean).includes(loc);
    }

    function syncCalendarServiceSelect(selectEl, locationId, keepSelected){
      if (!selectEl) return;
      const selected = String(selectEl.value || '');
      let selectedStillVisible = selected === '';
      Array.from(selectEl.options || []).forEach(opt => {
        const allowed = calendarServiceAllowedInLocation(opt, locationId);
        const keep = !!keepSelected && selected !== '' && String(opt.value || '') === selected;
        opt.hidden = !allowed && !keep;
        opt.disabled = !allowed && !keep;
        if (String(opt.value || '') === selected && (allowed || keep)) selectedStillVisible = true;
      });
      if (!selectedStillVisible) selectEl.value = '';
    }

    function syncCalendarServicesForLocations(){
      syncCalendarServiceSelect(filterService, filterLocation ? filterLocation.value : '', false);
      syncCalendarServiceSelect(serviceSel, modalLocationSelect ? modalLocationSelect.value : (filterLocation ? filterLocation.value : ''), true);
    }

    let calendarStaffRequestId = 0;
    function renderCalendarStaffOptions(rows, preferredStaffId){
      if (!staffSel) return;
      const preferred = String(preferredStaffId !== undefined ? preferredStaffId : staffSel.value || '');
      const previousLabel = staffSel.options[staffSel.selectedIndex] ? (staffSel.options[staffSel.selectedIndex].textContent || '') : '';
      staffSel.innerHTML = '';
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = '(non assegnato)';
      staffSel.appendChild(blank);

      const seen = new Set(['']);
      (Array.isArray(rows) ? rows : []).forEach(row => {
        const id = String(row && row.id != null ? row.id : '').trim();
        if (!id || seen.has(id)) return;
        seen.add(id);
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = String((row && row.full_name) ? row.full_name : ('Operatore #' + id));
        if (row && row.available === false && id !== preferred) {
          opt.disabled = true;
          const reason = String(row.unavailable_reason || '').trim();
          if (reason) opt.textContent += ' (' + reason + ')';
        }
        staffSel.appendChild(opt);
      });

      if (preferred && !seen.has(preferred)) {
        const opt = document.createElement('option');
        opt.value = preferred;
        opt.textContent = previousLabel && previousLabel !== '(non assegnato)'
          ? previousLabel
          : ('Operatore attuale #' + preferred);
        staffSel.appendChild(opt);
      }
      staffSel.value = preferred && Array.from(staffSel.options).some(opt => String(opt.value) === preferred) ? preferred : '';
    }

    async function refreshCalendarStaffForService(preferredStaffId){
      if (!staffSel) return;
      const preferred = String(preferredStaffId !== undefined ? preferredStaffId : (staffSel.value || ''));
      const reqId = ++calendarStaffRequestId;
      const params = new URLSearchParams();
      params.set('page', 'api_appointments');
      params.set('action', 'staff_for_service');
      params.set('service_id', serviceSel ? String(serviceSel.value || '') : '');
      params.set('location_id', modalLocationSelect ? String(modalLocationSelect.value || '') : (filterLocation ? String(filterLocation.value || '') : ''));
      const apptId = document.getElementById('appt_id')?.value || '';
      const startsVal = document.getElementById('starts_at')?.value || '';
      const endsVal = document.getElementById('ends_at')?.value || '';
      if (apptId) params.set('exclude_id', String(apptId));
      if (startsVal) params.set('starts_at', String(startsVal));
      if (endsVal) params.set('ends_at', String(endsVal));

      try {
        const res = await fetch('index.php?' + params.toString(), { credentials:'same-origin', headers:{'Accept':'application/json'} });
        const js = await res.json();
        if (reqId !== calendarStaffRequestId) return;
        if (js && js.ok && Array.isArray(js.staff)) {
          renderCalendarStaffOptions(js.staff, preferred);
        }
      } catch (_) {
        if (calendarInitialStaffOptions.length && staffSel && !staffSel.options.length) {
          calendarInitialStaffOptions.forEach(src => {
            const opt = document.createElement('option');
            opt.value = src.value;
            opt.textContent = src.text;
            opt.disabled = src.disabled;
            staffSel.appendChild(opt);
          });
          staffSel.value = preferred;
        }
      }
    }

    syncCalendarServicesForLocations();
    if (modalLocationSelect) {
      modalLocationSelect.addEventListener('change', () => {
        syncCalendarServiceSelect(serviceSel, modalLocationSelect.value || '', true);
        refreshCalendarStaffForService();
        refreshFidelityUI({mode:'location'});
      });
    }

    let currentStaff = filterStaff ? (filterStaff.value || '') : '';
    if (filterStaff) {
      filterStaff.addEventListener('change', () => {
        currentStaff = filterStaff.value || '';
        scheduleCalendarViewportHeightSync(0);
        window.calendar.refetchEvents();
      });
    }

    if (calendarNotesBtn) {
      calendarNotesBtn.addEventListener('click', function(){
        openCalendarNotesModal('', { listFilterDate: '' });
      });
    }

    if (calendarNotesForm) {
      calendarNotesForm.addEventListener('submit', function(ev){
        ev.preventDefault();
        submitCalendarNoteForm();
      });
    }

    if (calendarNotesNewBtn) {
      calendarNotesNewBtn.addEventListener('click', function(){
        resetCalendarNotesForm(calendarNotesState.prefillDate || normalizeCalendarNoteDateValue(getCalendarFocusDate()));
        if (calendarNoteTextEl) {
          try { calendarNoteTextEl.focus(); } catch(_) {}
        }
      });
    }

    if (calendarNoteDeleteBtn) {
      calendarNoteDeleteBtn.addEventListener('click', function(){
        deleteCalendarNote();
      });
    }

    if (calendarNotesModalEl) {
      calendarNotesModalEl.addEventListener('shown.bs.modal', function(){
        if (calendarNoteTextEl && !(calendarNoteIdEl && calendarNoteIdEl.value)) {
          try { calendarNoteTextEl.focus(); } catch(_) {}
        }
      });
    }

    if (!CAN_MANAGE_APPOINTMENTS) {
      if (calendarNotesNewBtn) {
        calendarNotesNewBtn.disabled = true;
        calendarNotesNewBtn.title = 'Permesso Appuntamenti richiesto.';
      }
      if (calendarNotesSaveBtn) {
        calendarNotesSaveBtn.disabled = true;
        calendarNotesSaveBtn.title = 'Permesso Appuntamenti richiesto.';
      }
      if (calendarNoteDeleteBtn) calendarNoteDeleteBtn.classList.add('d-none');
      if (calendarNotesForm) {
        calendarNotesForm.querySelectorAll('input, textarea').forEach(el => {
          try { el.readOnly = true; } catch (_) {}
        });
      }
    }



// --- Multi-servizio badge (MS) ---
// Accent color rules (backend calendar):
// - same multiservice group (same appointment_id) => same accent (dot + left bar)
// - different multiservice groups on the same day => different accent
// - never collide with appointment status colors, nor with any other event color that day
const MS_STATUS_COLORS = new Set(['#0d6efd','#f59e0b','#20c997','#6c757d','#dc3545','#fd7e14']);
const MS_ACCENT_PALETTE = ['#7c3aed','#06b6d4','#f97316','#84cc16','#e11d48','#14b8a6','#a855f7','#0ea5e9','#fb7185','#10b981','#8b5cf6','#22c55e','#eab308','#ef4444','#4e6da5'];
let msUsedColorsByDay = Object.create(null);        // day -> Set(colors used by events that day)
let msGroupAccentByDay = Object.create(null);      // day -> { [groupKey]: color }
let msFallbackSeqByDay = Object.create(null);      // day -> int (for fallback colors)

function msDayKeyFromEvent(ev){
  try{
    const rk = ev?.extendedProps?.real_day_key;
    if (rk) return String(rk).slice(0,10);
    const s = ev?.startStr || (ev?.start ? fmtLocal(ev.start) : '');
    return String(s).slice(0,10);
  } catch(_){
    return '';
  }
}

function clamp01(x){ return Math.max(0, Math.min(1, x)); }

function hslToHex(h, s, l){
  // h in [0,360), s/l in [0,1]
  h = ((h%360)+360)%360;
  s = clamp01(s);
  l = clamp01(l);
  const c = (1 - Math.abs(2*l - 1)) * s;
  const x = c * (1 - Math.abs(((h/60) % 2) - 1));
  const m = l - c/2;
  let r=0,g=0,b=0;
  if (h < 60) { r=c; g=x; b=0; }
  else if (h < 120) { r=x; g=c; b=0; }
  else if (h < 180) { r=0; g=c; b=x; }
  else if (h < 240) { r=0; g=x; b=c; }
  else if (h < 300) { r=x; g=0; b=c; }
  else { r=c; g=0; b=x; }
  const toHex = v => Math.round((v+m)*255).toString(16).padStart(2,'0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function ensureDaySets(dayKey){
  if(!msUsedColorsByDay[dayKey]) msUsedColorsByDay[dayKey] = new Set();
  if(!msGroupAccentByDay[dayKey]) msGroupAccentByDay[dayKey] = Object.create(null);
  if(typeof msFallbackSeqByDay[dayKey] !== 'number') msFallbackSeqByDay[dayKey] = 0;
}

function getMsAccentForGroup(dayKey, groupKey){
  if(!dayKey) dayKey = '';
  if(!groupKey) return '#7c3aed';

  ensureDaySets(dayKey);
  const existing = msGroupAccentByDay[dayKey][String(groupKey)];
  if(existing) return existing;

  // Build used set: event colors for that day + status colors + already assigned MS colors
  const used = new Set();
  try{
    const s = msUsedColorsByDay[dayKey];
    if (s) for (const c of s) used.add(String(c||'').toLowerCase());
  } catch(_){ }
  for (const c of MS_STATUS_COLORS) used.add(String(c).toLowerCase());
  try{
    const map = msGroupAccentByDay[dayKey];
    for (const k in map) used.add(String(map[k]||'').toLowerCase());
  } catch(_){ }

  // 1) Try palette first
  let pick = null;
  for (const c of MS_ACCENT_PALETTE){
    const cc = String(c).toLowerCase();
    if(!used.has(cc)) { pick = c; break; }
  }

  // 2) Fallback: generate a distinct HSL color (golden angle) until free
  if(!pick){
    let tries = 0;
    while(tries < 120){
      const idx = (msFallbackSeqByDay[dayKey] || 0) + 1;
      msFallbackSeqByDay[dayKey] = idx;
      const hue = (idx * 137.508) % 360;
      // tuned to be vivid but readable on the white badge
      const cand = hslToHex(hue, 0.78, 0.48);
      if(!used.has(String(cand).toLowerCase())) { pick = cand; break; }
      tries++;
    }
  }

  pick = pick || '#7c3aed';
  msGroupAccentByDay[dayKey][String(groupKey)] = pick;
  msUsedColorsByDay[dayKey].add(String(pick).toLowerCase());
  return pick;
}

function calendarAppointmentStatusTheme(rawStatus){
  let st = String(rawStatus || '').toLowerCase().trim();
  if (st === 'cancelled') st = 'canceled';
  if (st === 'confirmed') st = 'scheduled';
  if (st === 'completed') st = 'done';
  if (st === 'no show' || st === 'no-show' || st === 'noshow' || st === 'non presentato') st = 'no_show';

  const themes = {
    pending: { key:'pending', bg:'#fff7ed', border:'#fed7aa', accent:'#f59e0b', text:'#7c2d12', muted:'#9a3412' },
    scheduled: { key:'scheduled', bg:'#eff6ff', border:'#bfdbfe', accent:'#4e6da5', text:'#1e3a8a', muted:'#475569' },
    done: { key:'done', bg:'#ecfdf5', border:'#bbf7d0', accent:'#22c55e', text:'#14532d', muted:'#166534' },
    canceled: { key:'canceled', bg:'#f1f5f9', border:'#94a3b8', accent:'#64748b', text:'#334155', muted:'#475569' },
    no_show: { key:'no_show', bg:'#f9fafb', border:'#d1d5db', accent:'#374151', text:'#111827', muted:'#4b5563' },
    rejected: { key:'rejected', bg:'#fdf2f8', border:'#fbcfe8', accent:'#ec4899', text:'#831843', muted:'#9d174d' }
  };

  return themes[st] || { key:'other', bg:'#f8fafc', border:'#dbe4ef', accent:'#64748b', text:'#334155', muted:'#64748b' };
}

function applyCalendarSoftAppointmentStyle(info){
  try{
    const ep = info.event.extendedProps || {};
    const isBg = String(info.event.display || '') === 'background';
    if (isBg || Number(ep.is_unavailability || 0) === 1 || Number(ep.is_store_closed || 0) === 1) return;

    const theme = calendarAppointmentStatusTheme(ep.status || '');
    const el = info.el;
    if (!el) return;

    el.classList.add('appt-soft-event', 'appt-soft-' + theme.key);
    el.style.setProperty('--appt-soft-bg', theme.bg);
    el.style.setProperty('--appt-soft-border', theme.border);
    el.style.setProperty('--appt-soft-accent', theme.accent);
    el.style.setProperty('--appt-soft-text', theme.text);
    el.style.setProperty('--appt-soft-muted', theme.muted);
    el.style.setProperty('background-color', theme.bg, 'important');
    el.style.setProperty('border-color', theme.border, 'important');
    el.style.setProperty('color', theme.text, 'important');

    const main = el.querySelector('.fc-event-main');
    if (main) {
      main.style.setProperty('background-color', 'transparent', 'important');
      main.style.setProperty('color', theme.text, 'important');
    }
  } catch(_){ }
}
function applyCalendarAppointmentDensity(info){
  try{
    const ep = info.event.extendedProps || {};
    const isBg = String(info.event.display || '') === 'background';
    if (isBg || Number(ep.is_unavailability || 0) === 1 || Number(ep.is_store_closed || 0) === 1) return;

    const el = info.el;
    if (!el) return;

    const syncDensity = () => {
      try{
        const h = el.getBoundingClientRect ? el.getBoundingClientRect().height : 0;
        const tiny = h > 0 && h < 28;
        const compact = h >= 28 && h < 54;
        el.classList.toggle('appt-event-tiny', tiny);
        el.classList.toggle('appt-event-compact', compact);
      } catch(_e){}
    };

    syncDensity();
    if (window.requestAnimationFrame) window.requestAnimationFrame(syncDensity);
    window.setTimeout(syncDensity, 60);
  } catch(_){ }
}

    // Orari negozio: imposta min/max e businessHours gia al primo render (vista iniziale = staffTimeGridDay)
    const __initSch = getStoreScheduleForDate(new Date());
    const INIT_SLOT_MIN_TIME = (__initSch && __initSch.min) ? __initSch.min : (STORE_WEEK_MIN_TIME || '07:00:00');
    const INIT_SLOT_MAX_TIME = (__initSch && (__initSch.maxPad || __initSch.max))
      ? (__initSch.maxPad || __initSch.max)
      : (STORE_WEEK_MAX_TIME_PAD || STORE_WEEK_MAX_TIME || '22:00:00');
    // IMPORTANT:
    // In the custom view `staffTimeGridDay` we simulate one staff column per *fake* day.
    // FullCalendar businessHours rendering/constraints are much more reliable when `daysOfWeek`
    // is provided. Since in this view every column must share the SAME shop schedule (the real day),
    // we apply the intervals to ALL days-of-week so they match every fake column date.
    const INIT_BUSINESS_HOURS = (__initSch && Array.isArray(__initSch.intervals))
      ? __initSch.intervals.map(x => ({ daysOfWeek:[0,1,2,3,4,5,6], startTime: x.startTime, endTime: x.endTime }))
      : [];

    window.calendar = new FullCalendar.Calendar(document.getElementById('calendar'), {
      locale: 'it',
      // Backend UX: in settimana/mese la griglia deve iniziare da lunedi.
      firstDay: 1,
      initialView: CALENDAR_INITIAL_VIEW || 'staffTimeGridDay',
      initialDate: CALENDAR_INITIAL_DATE || undefined,
      // IMPORTANT:
      // This calendar uses a "fake multi-day" timeGrid to simulate one column per staff.
      // FullCalendar's default lazy fetching can cache/merge results across overlapping ranges.
      // With "fake days" this can make events appear under the wrong staff column after
      // navigation (and the effect is more visible as you add more staff columns).
      // Disable lazy fetching to force a clean fetch on each navigation step.
      lazyFetching: false,
      height: computeCalendarViewportHeight() || 'auto',
      stickyHeaderDates: true,
      nowIndicator: true,
      selectable: CAN_CREATE_APPOINTMENTS,
      editable: CAN_MANAGE_APPOINTMENTS,
      // IMPORTANT (UX + correctness):
      // Prevent selecting/clicking slots which are marked as staff unavailability (grey background).
      // Those intervals are injected as background events with extendedProps.is_unavailability=1.
      // Without this, the user could click on a grey slot, open the booking form, and only later
      // discover that the booking cannot be saved.
      selectOverlap: function(event){
        try{
          const ep = event && event.extendedProps ? event.extendedProps : {};
          if (Number(ep.is_unavailability || 0) === 1) return false;
          return true;
        } catch(_){
          return true;
        }
      },
      // Prevent selecting/dragging into the tiny padded area added only to show the closing label.
      selectAllow: function(sel){
        try{
          const max = window.__cal_actual_max_time;
          if(!max) return true;
          const maxMin = _timeToMin(max);
          if(maxMin === null) return true;
          const end = sel && sel.end;
          if(!end) return true;
          const endMin = end.getHours()*60 + end.getMinutes();
          return endMin <= maxMin;
        }catch(_){ return true; }
      },
      eventAllow: function(dropInfo){
        try{
          const max = window.__cal_actual_max_time;
          if(!max) return true;
          const maxMin = _timeToMin(max);
          if(maxMin === null) return true;
          const end = dropInfo && dropInfo.end;
          if(!end) return true;
          const endMin = end.getHours()*60 + end.getMinutes();
          return endMin <= maxMin;
        }catch(_){ return true; }
      },
      displayEventTime: false,
      loading: function(isLoading){
        calendarSetLoading(!!isLoading, 'Caricamento prenotazioni...');
      },
      buttonText: {
        today: 'Oggi',
        staffTimeGridDay: 'Giorno',
        timeGridWeek: 'Settimana',
        dayGridMonth: 'Mese'
      },
      // Use 5-minute granularity to match the availability slots.
      // FullCalendar defaults to 30 minutes if not specified.
      slotDuration: '00:05:00',
      snapDuration: '00:05:00',
      slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
      slotLabelInterval: '00:30:00',
      slotMinTime: INIT_SLOT_MIN_TIME,
      slotMaxTime: INIT_SLOT_MAX_TIME,
      businessHours: INIT_BUSINESS_HOURS,
      allDaySlot: false,

      views: {
        staffTimeGridDay: {
          type: 'timeGrid',
          duration: { days: STAFF_DAY_COLS.length },
          dateIncrement: { days: 1 },
          buttonText: 'Giorno'
        }
      },
      customButtons: {
        dayApptTotal: {
          text: '',
          click: function(){ return false; }
        },
        jumpDate: {
          text: 'Data',
          click: function(){
            try{ toggleCalendarDatePicker && toggleCalendarDatePicker(); }catch(_){ }
          }
        },
        orderStaffCols: {
          text: 'Ordina',
          click: function(){
            try{ openStaffOrderModal && openStaffOrderModal(); }catch(_){ }
          }
        }
      },

      headerToolbar: {
        left: 'dayApptTotal',
        center: 'prev,next title today jumpDate',
        right: 'staffTimeGridDay,timeGridWeek,dayGridMonth orderStaffCols'
      },

      // Month view: highlight closure dates (Impostazioni → Chiusure)
      // NOTE: `businessHours` shading does not apply in dayGridMonth, so we add a custom class
      // on the day cell itself.
      dayCellClassNames: function(arg){
        try{
          const vt = String(arg?.view?.type || '');
          if (vt !== 'dayGridMonth') return [];
          const key = ymd(arg.date);

          // Closure dates are highlighted ONLY if they are not overridden by a special opening.
          if (isClosureDateKey(key) && !specialOpenRowForDateKey(key)) {
            return ['store-closure-date'];
          }
        } catch(_){ }
        return [];
      },


      dayHeaderContent: function(arg){
        try{
          if (arg.view?.type === 'dayGridMonth') {
            const dayName = itLongWeekday(arg.date);
            const label = dayName ? (dayName.charAt(0).toUpperCase() + dayName.slice(1)) : arg.text;
            return { html: `<span class="calendar-weekday-full">${escapeHtml(label)}</span>` };
          }

          if (arg.view?.type === 'timeGridWeek') {
            const rawDayName = String(itLongWeekday(arg.date) || '');
            const dayName = rawDayName ? (rawDayName.charAt(0).toUpperCase() + rawDayName.slice(1)) : '';
            const dd = String(arg.date.getDate()).padStart(2, '0');
            const mm = String(arg.date.getMonth() + 1).padStart(2, '0');
            return { html: `<span class="calendar-weekday-full"><span class="calendar-weekday-short">${escapeHtml(dayName || '')}</span><span class="calendar-weekday-date">${escapeHtml(dd + '/' + mm)}</span></span>` };
          }

          if (arg.view?.type !== 'staffTimeGridDay') return arg.text;
          const idx = diffDays(arg.date, arg.view.currentStart);
          const s = STAFF_DAY_COLS[idx];
          if (!s) return '';
          const nm = String(s.name || '').trim();
          const first = (Array.from(nm)[0] || 'O').toUpperCase();
          const photo = String(s.photo || '').trim();
          const avatar = photo
            ? `<span class="staff-col-avatar"><img src="${escapeHtml(photo)}" alt=""></span>`
            : `<span class="staff-col-avatar staff-col-avatar-fallback" data-staff-id="${escapeHtml(String(s.id || 0))}">${escapeHtml(first)}</span>`;
          const countLabel = staffDayAppointmentLabel(staffDayAppointmentCount(s.id));
          return { html: `<div class="staff-col-head" data-staff-id="${escapeHtml(String(s.id || 0))}">${avatar}<span class="staff-col-copy"><span class="staff-col-name">${escapeHtml(nm)}</span><span class="staff-col-count" data-staff-id="${escapeHtml(String(s.id || 0))}">${escapeHtml(countLabel)}</span></span></div>` };
        } catch(_){
          return arg.text;
        }
      },

      datesSet: function(info){
        // After each navigation/view change, repaint staff columns background + custom title
        setTimeout(() => {
          applyStaffColumnsStyle(info);
          try{ applyStaffAvatarFallbackColors(document); }catch(_eAvatar){}
          updateCalendarTitle(info);
          try{ toggleStaffOrderButton(info?.view?.type); }catch(_eBtn){}
          try{ updateStaffNowIndicator(); }catch(_e){}
          try{ hideCalendarHoverTimeIndicator(); }catch(_eHover){}
          try{ enhanceCalendarToolbar(); }catch(_eEnhance){}
          try{ syncCalendarDatePickerState(info); }catch(_ePicker){}
          try{ syncCalendarStickyToolbarOffset(); }catch(_eSticky){}
          try{ scheduleCalendarViewportHeightSync(0); }catch(_eHeight){}
          try{ refreshCalendarNotesState(); }catch(_eNotes){}
        }, 0);

        // Adegua il calendario agli orari del negozio (Impostazioni → Orari)
        applyStoreHoursForView(info);

        // IMPORTANT:
        // In "staffTimeGridDay" we remap events to "fake days" (one day per operatore colonna).
        // Those "fake" dates MUST NOT leak into Week/Month views.
        // FullCalendar can reuse/carry the already-loaded events when switching views,
        // so we must CLEAR the event store and fetch again when entering/leaving this view.
        try{
          const vt = (info && info.view && info.view.type) ? String(info.view.type) : '';
          const prev = window.__calendar_prev_view_type ? String(window.__calendar_prev_view_type) : '';
          window.__calendar_prev_view_type = vt;

          if (prev && vt && prev !== vt) {
            const touchingStaffDay = (prev === 'staffTimeGridDay' || vt === 'staffTimeGridDay');
            if (touchingStaffDay && window.calendar) {
              // Remove ALL loaded events (including those with remapped dates)
              // then refetch from backend using the correct range for the new view.
              try{ window.calendar.removeAllEvents && window.calendar.removeAllEvents(); } catch(_e){}
              try{ window.calendar.refetchEvents && window.calendar.refetchEvents(); } catch(_e){}
            }
          }

          // ALSO IMPORTANT:
          // In staffTimeGridDay we simulate N staff columns using an N-day timeGrid.
          // Events for staff "later" columns are intentionally moved to future "fake" dates.
          // When the user navigates (prev/next), FullCalendar's internal event cache can keep
          // some of those previously-fetched events because they still fall inside the new
          // overlapping range. This makes appointments appear under the WRONG staff column.
          // The issue becomes more obvious when you add a new operator (more columns => more fake days).
          // Force-clear & refetch whenever the real day changes while staying in staffTimeGridDay.
          try{
            if (vt === 'staffTimeGridDay' && window.calendar) {
              const d0 = (info && info.start) ? info.start : (window.calendar.view ? window.calendar.view.currentStart : null);
              const key = d0 ? ymd(d0) : '';
              const last = window.__staffday_real_key ? String(window.__staffday_real_key) : '';
              if (last && key && last !== key) {
                try{ window.calendar.removeAllEvents && window.calendar.removeAllEvents(); } catch(_e){}
                try{ window.calendar.refetchEvents && window.calendar.refetchEvents(); } catch(_e){}
              }
              window.__staffday_real_key = key;
              // Bootstrap fix:
              // When entering the calendar page from the menu, FullCalendar may perform the first
              // events fetch before our staff-day remapping logic is fully "armed" (calendar reference/view state).
              // That causes all appointments to appear in the first staff column until the user clicks "Giorno".
              // Force a one-time clear+refetch the first time we land on a real day in staffTimeGridDay.
              const hydrated = window.__staffday_hydrated_key ? String(window.__staffday_hydrated_key) : '';
              if (key && hydrated !== key) {
                window.__staffday_hydrated_key = key;
                setTimeout(() => {
                  try{ window.calendar.removeAllEvents && window.calendar.removeAllEvents(); } catch(_e){}
                  try{ window.calendar.refetchEvents && window.calendar.refetchEvents(); } catch(_e){}
                }, 0);
              }

            } else if (vt !== 'staffTimeGridDay') {
              window.__staffday_real_key = '';
            }
          } catch(_e2){}
        } catch(_e){}
      },

      // FIX (UI):
      // When switching between views, FullCalendar can briefly re-render already-loaded events
      // in the new view before the new fetch completes. This is especially visible because in
      // our custom staffTimeGridDay view we remap events to "fake" dates (one per staff column).
      // Those remapped dates would momentarily show appointments on the wrong day in Week/Month.
      // Clearing the event store *before* the view unmounts prevents the flash.
      viewWillUnmount: function(_arg){
        try{
          if (window.calendar && typeof window.calendar.removeAllEvents === 'function') {
            window.calendar.removeAllEvents();
          }
        } catch(_e){}
      },

      eventContent: function(arg){
  try{
    // Background events (e.g. staff unavailability grey blocks) must NOT render any foreground content.
    // Otherwise they appear like real appointments and can confuse the operator.
    try{
      const ep0 = arg && arg.event && arg.event.extendedProps ? arg.event.extendedProps : {};
      const isBg = (arg && arg.event && String(arg.event.display || '') === 'background');
      if (isBg || Number(ep0.is_unavailability || 0) === 1) {
        return { html: '' };
      }
    } catch(_e0) { /* ignore */ }

    const ep = arg.event.extendedProps || {};

    // Current view type (arg.view exists in most FC versions, fallback to live calendar)
    const cal = window.calendar;
    const viewType = (arg && arg.view && arg.view.type) ? String(arg.view.type) :
                     (cal && cal.view && cal.view.type) ? String(cal.view.type) : '';

    // Show staff/operator name ONLY in Week/Month (not in staffTimeGridDay which already has staff columns)
    const showStaff = (viewType === 'timeGridWeek' || viewType === 'dayGridMonth');

    const client = String(ep.client || '').trim();
    const service = String(ep.service || '').trim();
    const staff = String(ep.staff || ep.staff_name || ep.operator || ep.operator_name || '').trim();

    // Fallback: parse from title if needed (backend titles often are: "Client • Service (Staff)")
    let titleClient = client;
    let titleService = service;
    let titleStaff = staff;

    const t = String(arg.event.title || '');

    if (!titleStaff && t) {
      const m = t.match(/\(([^)]+)\)\s*$/);
      if (m && m[1]) titleStaff = String(m[1]).trim();
    }

    if (!titleClient && t) {
      titleClient = (t.split(' • ')[0] || t).trim();
    }

    if (!titleService && t && t.includes(' • ')) {
      let s = t.split(' • ')[1] || '';
      // remove trailing " (Staff)" if present
      s = s.split(' (')[0].trim();
      titleService = s;
    }

    // Time line (HH:mm - HH:mm (60′))
    const start = arg.event.start;
    const end = arg.event.end;
    const pad = n => String(n).padStart(2,'0');
    const fmtTime = dt => `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    let timeLine = '';
    if (start) {
      const t1 = fmtTime(start);
      const t2 = end ? fmtTime(end) : '';
      let durMin = '';
      if (start && end) {
        const mins = Math.round((end.getTime() - start.getTime()) / 60000);
        if (isFinite(mins) && mins > 0) durMin = ` (${mins}′)`;
      }
      timeLine = t2 ? `${t1} - ${t2}${durMin}` : `${t1}${durMin}`;
    }

    const html = `
      <div class="appt-event">
        ${timeLine ? `<div class="appt-time">${escapeHtml(timeLine)}</div>` : ``}
        <div class="fc-event-title appt-client"><span class="appt-client-name">${escapeHtml(titleClient || '')}</span></div>
        ${(showStaff && titleStaff) ? `<div class="appt-staff">• ${escapeHtml(titleStaff)}</div>` : ``}
        ${titleService ? `<div class="appt-service">• ${escapeHtml(titleService)}</div>` : ``}
      </div>
    `;
    return { html };
  } catch(_){
    return true; // fallback to default
  }
},

      eventDidMount: function(info){

        // Soft card style: keep status color as accent, but avoid full saturated backgrounds.
        try{ applyCalendarSoftAppointmentStyle(info); } catch(_e){}

        try{
          const epBreak = info.event.extendedProps || {};
          if (Number(epBreak.is_store_break || 0) === 1 && info.el) {
            const colCount = Math.max(1, Number(epBreak.staff_break_col_count || STAFF_DAY_COLS.length || 1) || 1);
            info.el.style.setProperty('--staff-break-col-count', String(colCount));
            info.el.style.setProperty('--staff-break-label-left', String(colCount * 50) + '%');
          }
        } catch(_eBreak){}

        try{
          const epClosed = info.event.extendedProps || {};
          if (Number(epClosed.is_store_closed || 0) === 1 && info.el) {
            const colCount = Math.max(1, Number(epClosed.staff_closed_col_count || STAFF_DAY_COLS.length || 1) || 1);
            info.el.style.setProperty('--staff-closed-label-left', String(colCount * 50) + '%');
          }
        } catch(_eClosed){}

        // Note: this hook is used for small badges inside the event.
        // We keep it resilient (no throws) because FullCalendar may re-render often.

        const titleEl = info.el.querySelector('.fc-event-title') || info.el.querySelector('.fc-event-main');

        // --- Multi-servizio badge (MS) ---
        try{
          const apptId = info.event.extendedProps?.appointment_id || info.event.id;
          const cnt = Number(info.event.extendedProps?.ms_count || 0);
          if(apptId && (cnt > 1) && titleEl){
            // tag DOM element for quick group highlight
            info.el.dataset.msGroup = String(apptId);

            const dayKey = msDayKeyFromEvent(info.event) || String(info.event.startStr||'').slice(0,10);
            const accent = String(info.event.extendedProps?.ms_accent || '') || getMsAccentForGroup(dayKey, apptId);

            // left bar (same color as dot)
            try{
              info.el.style.setProperty('--ms-accent', accent);
              info.el.classList.add('ms-has-accent');
            } catch(_){ }

            const existing = titleEl.querySelector('.ms-badge');
            if(!existing){
              const badge = document.createElement('span');
              badge.className = 'ms-badge';
              badge.title = 'Prenotazione multi-servizio (' + String(cnt) + ')';

              const dot = document.createElement('span');
              dot.className = 'ms-dot';
              // dot styling is driven by CSS (ring dot) via --ms-accent on the event

              const label = document.createElement('span');
              label.className = 'ms-label';
              label.textContent = 'MS';

              badge.appendChild(dot);
              badge.appendChild(label);
              titleEl.prepend(badge);
            }
          }
        } catch(_){ }

        // --- Status badge (tutti gli stati) ---
        try{
          let st = String(info.event.extendedProps?.status || '').toLowerCase().trim();
          if (st === 'cancelled') st = 'canceled';
          if (st === 'confirmed') st = 'scheduled';
          if (st === 'completed') st = 'done';
          if (st === 'no show' || st === 'no-show' || st === 'noshow' || st === 'non presentato') st = 'no_show';

          const map = {
            pending:   { key:'pending',   label:'In attesa' },
            scheduled: { key:'scheduled', label:'Prenotato' },
            done:      { key:'done',      label:'Eseguito' },
            canceled:  { key:'canceled',  label:'Annullato' },
            no_show:   { key:'no_show',   label:'No show' },
            rejected:  { key:'canceled',  label:'Annullato' },
          };

          const d = map[st] || { key:'other', label: (st ? st : '—') };

          if (titleEl){
            if (!titleEl.querySelector('.appt-status-badge')){
              const b = document.createElement('span');
              b.className = 'appt-status-badge status-' + d.key;
              b.textContent = d.label;
              b.title = 'Stato: ' + d.label;
              // prepend so it stays before MS badge when both exist
              titleEl.prepend(b);
            }
          }
        } catch(_){ }

        // --- Staff color dot (operatore) ---
        try{
          const epS = info.event.extendedProps || {};
          const isBgS = (String(info.event.display || '') === 'background');
          if (!isBgS && Number(epS.is_unavailability || 0) !== 1 && Number(epS.is_store_closed || 0) !== 1) {
            if (titleEl && !titleEl.querySelector('.appt-staff-dot')) {
              let sid = 0;
              try{
                const rawSid = (epS.staff_id ?? epS.staffId ?? epS.segment_staff_id ?? epS.operator_id ?? epS.operatorId ?? null);
                sid = Number(rawSid || 0) || 0;
              }catch(_eSid){ sid = 0; }

              // Fallback: try resolving from staff name
              if (!sid) {
                const nm0 = String(epS.staff || epS.staff_name || epS.operator || epS.operator_name || '').trim().toLowerCase();
                if (nm0 && STAFF_COL_INDEX_BY_NAME[nm0] !== undefined) {
                  const idx0 = STAFF_COL_INDEX_BY_NAME[nm0];
                  sid = Number((STAFF_DAY_COLS[idx0] && STAFF_DAY_COLS[idx0].id) || 0) || 0;
                }
              }

              // Fallback: parse from title suffix "(Staff)"
              if (!sid) {
                const t0 = String(info.event.title || '');
                const m0 = t0.match(/\(([^)]+)\)\s*$/);
                if (m0 && m0[1]) {
                  const nm1 = String(m0[1]).trim().toLowerCase();
                  if (nm1 && STAFF_COL_INDEX_BY_NAME[nm1] !== undefined) {
                    const idx1 = STAFF_COL_INDEX_BY_NAME[nm1];
                    sid = Number((STAFF_DAY_COLS[idx1] && STAFF_DAY_COLS[idx1].id) || 0) || 0;
                  }
                }
              }

              if (sid > 0) {
                const dot = document.createElement('span');
                dot.className = 'appt-staff-dot';
                dot.style.backgroundColor = staffColorHex(sid);
                dot.title = 'Operatore';

                // Place it BEFORE the status badge (requested), otherwise before MS badge, otherwise at start
                const stBadge = titleEl.querySelector('.appt-status-badge');
                const msBadge = titleEl.querySelector('.ms-badge');

                if (stBadge && stBadge.parentNode) {
                  stBadge.parentNode.insertBefore(dot, stBadge);
                } else if (msBadge && msBadge.parentNode) {
                  msBadge.parentNode.insertBefore(dot, msBadge);
                } else {
                  titleEl.prepend(dot);
                }
              }
            }
          }
        } catch(_){ }

        // Keep very short appointments readable: compact the content after badges/dots are injected.
        try{ applyCalendarAppointmentDensity(info); } catch(_e){}

      },

      eventMouseEnter: function(info){
        try{
          const apptId = info.event.extendedProps?.appointment_id || info.event.id;
          const cnt = Number(info.event.extendedProps?.ms_count || 0);
          if(!apptId || !(cnt>1)) return;
          const root = document.getElementById('calendar');
          if(!root) return;
          root.querySelectorAll('.fc-event[data-ms-group=\"' + String(apptId) + '\"]').forEach(el => el.classList.add('ms-active'));
        } catch(_){}
      },

      eventMouseLeave: function(info){
        try{
          const apptId = info.event.extendedProps?.appointment_id || info.event.id;
          const cnt = Number(info.event.extendedProps?.ms_count || 0);
          if(!apptId || !(cnt>1)) return;
          const root = document.getElementById('calendar');
          if(!root) return;
          root.querySelectorAll('.fc-event[data-ms-group=\"' + String(apptId) + '\"]').forEach(el => el.classList.remove('ms-active'));
        } catch(_){}
      },

      events: function(info, success, failure){
  // IMPORTANT:
  // In FullCalendar the `events(fetchInfo, success, failure)` callback receives only the date-range (fetchInfo),
  // not the view object. So `fetchInfo.view` is undefined and view-based logic would never run.
  // Use the live calendar instance to detect the current view.
  const cal = window.calendar;

  // NOTE:
  // During the initial render, FullCalendar may call this `events()` callback while the Calendar
  // constructor is still running. In that moment `window.calendar` might still be undefined.
  // Since our initialView is `staffTimeGridDay`, we MUST still treat the first fetch as staff-day
  // to remap events into the correct operator columns.
  let viewType = (cal && cal.view && cal.view.type) ? String(cal.view.type) : '';
  if (!viewType && window.__calendar_prev_view_type) viewType = String(window.__calendar_prev_view_type);

  // Heuristic fallback when `cal` is not yet available:
  // In staffTimeGridDay we simulate N staff columns as N "days" (duration = STAFF_DAY_COLS.length).
  // So the fetch range length matches the staff columns count.
  let rangeDays = 0;
  try{
    rangeDays = Math.round((info.end.getTime() - info.start.getTime()) / 86400000);
  }catch(_e){
    rangeDays = 0;
  }
  const isLikelyStaffDay = (rangeDays === STAFF_DAY_COLS.length && STAFF_DAY_COLS.length > 1);

  const isStaffDayReq = (viewType === 'staffTimeGridDay') || (!cal && isLikelyStaffDay);

  // In vista "Giorno" a colonne (per operatore) il calendario mostra N "giorni fittizi" (una colonna = uno staff).
  // Ma dal backend dobbiamo caricare SOLO il giorno reale (currentStart -> +1 giorno).
  const viewStart = (isStaffDayReq && cal && cal.view && cal.view.currentStart) ? cal.view.currentStart : info.start;

  // Backend expects MySQL DATETIME format (safe for phpMyAdmin/MySQL comparisons)
  const apiStart = fmtMysql(viewStart);
  const apiEnd = isStaffDayReq ? fmtMysql(addDays(viewStart, 1)) : fmtMysql(info.end);


  const params = new URLSearchParams({
    start: apiStart,
    end: apiEnd,
    staff_id: currentStaff || '',
    location_id: filterLocation ? (filterLocation.value || '') : '',
    status: filterStatus.value || '',
    service_id: filterService.value || ''
  });

  // In staffTimeGridDay vogliamo evidenziare le fasce NON disponibili (turni/presenze/assenze)
  // con un background grigio per colonna (operatore).
  if (isStaffDayReq) {
    params.set('include_unavailability', '1');
  }

  fetch('index.php?page=api_appointments&action=list&' + params.toString())
    .then(r => r.json())
    .then(data => {
      const events = data.events || [];

      // Vista "Giorno" a colonne (per operatore):
      // remappa le date degli eventi su "giorni fittizi" (una colonna = uno staff)
      if (isStaffDayReq) {
        const baseStart = viewStart; // real day (00:00) of the view
        const realDayKey = ymd(baseStart);

        for (const ev of events) {
          try{
            ev.extendedProps = ev.extendedProps || {};
            const ep = ev.extendedProps;

            // Determine staff column index (robust for legacy/multiservice payloads)
            let idx = 0;
            try{
              const rawStaffId =
                (ep && (ep.staff_id ?? ep.staffId ?? ep.segment_staff_id ?? ep.operator_id)) ??
                (ev && (ev.staff_id ?? ev.staffId ?? ev.operator_id)) ??
                null;

              const staffIdNum = Number(rawStaffId || 0);
              if (staffIdNum > 0 && (STAFF_COL_INDEX[String(staffIdNum)] !== undefined)) {
                idx = STAFF_COL_INDEX[String(staffIdNum)];
              } else {
                // Fallback by staff name (from extendedProps or "(Staff)" suffix in title)
                let staffName = String(ep.staff || ep.staff_name || '').trim();
                if (!staffName) {
                  const t = String(ev.title || '');
                  const m = t.match(/\(([^)]+)\)\s*$/);
                  if (m && m[1]) staffName = String(m[1]).trim();
                }
                const nk = staffName.toLowerCase();
                if (nk && (STAFF_COL_INDEX_BY_NAME[nk] !== undefined)) idx = STAFF_COL_INDEX_BY_NAME[nk];
              }
            } catch(_e){
              idx = 0;
            }

            const colDate = ymd(addDays(baseStart, idx));

            // Keep real day key for grouping (multi-servizio badges) and for drag&drop mapping
            ep.real_day_key = realDayKey;
            ep._real_start = ev.start;
            ep._real_end = ev.end;
            ep._staff_col_idx = idx;

            const stRaw = String(ev.start || '').replace('T',' ');
            const enRaw = String(ev.end || '').replace('T',' ');
            const stTime = (stRaw.length >= 19) ? stRaw.slice(11,19) : ((stRaw.length >= 16) ? (stRaw.slice(11,16) + ':00') : '00:00:00');
            const enTime = (enRaw.length >= 19) ? enRaw.slice(11,19) : ((enRaw.length >= 16) ? (enRaw.slice(11,16) + ':00') : stTime);

            ev.start = `${colDate}T${stTime}`;
            ev.end = `${colDate}T${enTime}`;

            const addClasses = ['staffday-event'];
            if (Number(ep.is_store_closed || 0) === 1) {
              ep.staff_closed_col_count = STAFF_DAY_COLS.length || 1;
              addClasses.push('store-closed-day-staffday');
              if (idx === 0) addClasses.push('store-closed-day-master');
            }

            // keep/append class names
            if (Array.isArray(ev.classNames)) {
              for (const cls of addClasses) {
                if (!ev.classNames.includes(cls)) ev.classNames.push(cls);
              }
            } else if (typeof ev.classNames === 'string' && ev.classNames) {
              const existing = ev.classNames.split(/\s+/).filter(Boolean);
              ev.classNames = existing.concat(addClasses.filter(cls => !existing.includes(cls)));
            } else {
              ev.classNames = addClasses.slice();
            }
          } catch(_){}
        }
      }

      try{
        const breakEvents = buildStoreBreakEventsForView({
          viewType: viewType,
          isStaffDayReq: isStaffDayReq,
          viewStart: viewStart,
          viewEnd: (isStaffDayReq ? addDays(viewStart, 1) : info.end)
        });
        if (breakEvents && breakEvents.length) {
          events.push(...breakEvents);
        }
      }catch(_breakErr){ }

      // Track used colors per day to choose MS group accent safely
      try{
        msUsedColorsByDay = Object.create(null);
        msGroupAccentByDay = Object.create(null);
        msFallbackSeqByDay = Object.create(null);
        for (const ev of events){
          const day = String(ev?.extendedProps?.real_day_key || ev?.start || '').slice(0,10);
          const c = String(ev?.backgroundColor || ev?.color || '').toLowerCase();
          if(!day || !c) continue;
          if(!msUsedColorsByDay[day]) msUsedColorsByDay[day] = new Set();
          msUsedColorsByDay[day].add(c);
        }
      } catch(_){ }

      // Multi-servizio: calcola la numerosità del gruppo per appointment_id
      try{
        const groups = new Map();
        for (const ev of events){
          const apptId = ev?.extendedProps?.appointment_id;
          const segId = ev?.extendedProps?.segment_id;
          if (!apptId || !segId) continue;
          if (!groups.has(apptId)) groups.set(apptId, []);
          groups.get(apptId).push(ev);
        }
        for (const [apptId, arr] of groups.entries()){
          if (!arr || arr.length < 2) continue;
          const groupKey = String(apptId);
          for (const ev of arr){
            ev.extendedProps = ev.extendedProps || {};
            ev.extendedProps.ms_count = arr.length;
            ev.extendedProps.is_multiservice = true;
            // Assign a distinct accent for this multiservice group on this day
            // (same group => same color; different groups on same day => different colors)
            try{
              const dayKey = String(ev?.extendedProps?.real_day_key || ev?.start || '').slice(0,10);
              ev.extendedProps.ms_accent = getMsAccentForGroup(dayKey, groupKey);
            } catch(_){ }
            ev.classNames = (ev.classNames || []).concat(['ms-grouped']);
          }
        }
      } catch(_){}



      // Dynamic time axis: if there are appointments outside shop hours, expand the grid range
      // so the operator can SEE and manage those bookings (e.g. 08:00 when shop opens at 09:00).
      try{
        const axisPatch = computeAxisPatchFromEvents(events, {
          isStaffDayReq: isStaffDayReq,
          viewStart: viewStart,
          viewEnd: (isStaffDayReq ? addDays(viewStart, 1) : info.end)
        });
        if(axisPatch){
          // Apply after FullCalendar finishes ingesting events and the view is mounted.
          // Apply immediately when possible (avoids a 1-frame flash), and also after mount as a safe fallback.
          applyAxisPatch(axisPatch);
          setTimeout(() => { applyAxisPatch(axisPatch); }, 0);
        }
      }catch(_axisErr){ }

      try{
        setStaffDayAppointmentCounts(
          isStaffDayReq ? buildStaffDayAppointmentCounts(events) : {},
          buildCalendarAppointmentTotal(events)
        );
      }catch(_countErr){ }

      success(events);
    })
    .catch(err => {
      try {
        if (typeof failure === 'function') failure(err);
      } catch(_){ }
      setTimeout(function(){
        calendarSetLoadError('Non e stato possibile aggiornare gli appuntamenti del calendario.');
      }, 0);
    });
},

      select: function(selectionInfo){
        if (!CAN_CREATE_APPOINTMENTS) {
          try { if (window.calendar && typeof window.calendar.unselect === 'function') window.calendar.unselect(); } catch(_) {}
          return;
        }
        try {
          const noteClickMeta = window.__calendarIgnoreNextSelectFromNotes || null;
          const noteClickAge = noteClickMeta && noteClickMeta.at ? (Date.now() - Number(noteClickMeta.at)) : 99999;
          if (noteClickMeta && noteClickAge >= 0 && noteClickAge < 1000) {
            window.__calendarIgnoreNextSelectFromNotes = null;
            try { if (window.calendar && typeof window.calendar.unselect === 'function') window.calendar.unselect(); } catch(_) {}
            return;
          }
          if (noteClickMeta && noteClickAge >= 1000) {
            window.__calendarIgnoreNextSelectFromNotes = null;
          }
        } catch(_) {}

        // Prefer the right drawer (Quick booking) if available.
        // The dedicated bridge reuses the same availability hold used by the
        // "Disponibilita" flow, so cabins are unlocked only after a real slot check.
        if (typeof window.qbOpenNewAppointmentFromCalendarSlot === 'function' || typeof window.qbOpenNewAppointment === 'function') {
          let qbSlotPayload = null;

          try {
            const cal = window.calendar;
            const isStaffDayView = (cal && cal.view && cal.view.type === 'staffTimeGridDay');
            const viewStart = (isStaffDayView && cal && cal.view) ? cal.view.currentStart : null;
            let staffId = currentStaff || '';

            if (isStaffDayView && viewStart) {
              const idx = staffIdxFromDate(selectionInfo.start, viewStart);
              const s = STAFF_DAY_COLS[idx];
              staffId = (s && Number(s.id || 0) > 0) ? String(s.id) : '';
            }

            const start = (isStaffDayView && viewStart) ? withBaseDate(viewStart, selectionInfo.start) : selectionInfo.start;
            const pad = n => String(n).padStart(2,'0');
            const d = `${start.getFullYear()}-${pad(start.getMonth()+1)}-${pad(start.getDate())}`;
            const t = `${pad(start.getHours())}:${pad(start.getMinutes())}`;

            qbSlotPayload = {
              date: d,
              time: t,
              staffId: staffId,
              startsAtLocal: fmtLocal(start)
            };
          } catch(_){ }

          if (qbSlotPayload && typeof window.qbOpenNewAppointmentFromCalendarSlot === 'function') {
            window.qbOpenNewAppointmentFromCalendarSlot(qbSlotPayload);
            return;
          }

          if (typeof window.qbOpenNewAppointment === 'function') {
            window.qbOpenNewAppointment();

            const qbDate = document.getElementById('qb_date');
            const qbStartTime = document.getElementById('qb_start_time');
            const qbStarts = document.getElementById('qb_starts');
            const qbEnds = document.getElementById('qb_ends');

            try {
              if (qbSlotPayload) {
                const qbStaffSel = document.querySelector('#quickBookingForm select[name="staff_id"]');
                if (qbStaffSel && qbSlotPayload.staffId) qbStaffSel.value = qbSlotPayload.staffId;
                if (qbDate) qbDate.value = qbSlotPayload.date;
                if (qbStartTime) qbStartTime.value = qbSlotPayload.time;
                if (qbStarts) qbStarts.value = qbSlotPayload.startsAtLocal || '';
                if (qbEnds) qbEnds.value = '';
                if (qbStartTime) qbStartTime.dispatchEvent(new Event('change', { bubbles: true }));
              }
            } catch(_){ }

            return;
          }
        }

// Fallback: legacy modal
        resetModal();
        let selStaffId = currentStaff || '';
        // In vista "Giorno" a colonne (per operatore) ogni colonna è un "giorno fittizio".
        // FullCalendar quindi restituisce una data diversa per ogni colonna (oggi, domani, ...).
        // Prima di aprire il modal, rimappiamo SEMPRE lo slot selezionato al giorno reale
        // (viewStart) mantenendo solo l'orario.
        let selStart = selectionInfo.start;
        let selEnd = selectionInfo.end;
        try {
          const cal = window.calendar;
          if (cal && cal.view && cal.view.type === 'staffTimeGridDay') {
            const viewStart = cal.view.currentStart;
            const idx = staffIdxFromDate(selectionInfo.start, viewStart);
            const s = STAFF_DAY_COLS[idx];
            selStaffId = (s && Number(s.id || 0) > 0) ? String(s.id) : '';

            // Map "fake" date -> real date (same day for all staff columns)
            try{
              selStart = withBaseDate(viewStart, selectionInfo.start);
              selEnd = selectionInfo.end ? withBaseDate(viewStart, selectionInfo.end) : selEnd;
            } catch(_){ }
          }
        } catch(_){ }

        fillModal({
          starts_at_local: fmtLocal(selStart),
          ends_at_local: fmtLocal(selEnd),
          status: 'scheduled',
          staff_id: selStaffId
        });
        modal.show();
      },

      eventClick: async function(clickInfo){
        // Ignore clicks on background/unavailability blocks (grey). They are not real appointments.
        try{
          const ev = clickInfo && clickInfo.event;
          const ep = (ev && ev.extendedProps) ? ev.extendedProps : {};
          const idStr = String((ev && ev.id) ? ev.id : '');
          const isBg = (ev && String(ev.display || '') === 'background');
          const isUnav = isBg || idStr.startsWith('unav_') || Number(ep.is_unavailability || 0) === 1 ||
                         (Array.isArray(ev.classNames) && ev.classNames.indexOf('staff-unavailability') >= 0);
          if(isUnav){
            try{ if(clickInfo.jsEvent){ clickInfo.jsEvent.preventDefault(); clickInfo.jsEvent.stopPropagation(); } }catch(_){ }
            return;
          }
        }catch(_){ }

        const apptId = clickInfo.event.extendedProps?.appointment_id || clickInfo.event.id;
        // Backend: for multi-servizio, allow editing only the main booking.
        // Segment-specific edit is intentionally disabled.
        const segmentId = null;

        // Prefer the right drawer (Quick booking) edit mode
        if (CAN_MANAGE_APPOINTMENTS && typeof window.qbOpenEditAppointment === 'function') {
          window.qbOpenEditAppointment(apptId, segmentId);
          return;
        }

        // Fallback: legacy modal
        resetModal();
        {
          const params = new URLSearchParams({ page:'api_appointments', action:'get', id:String(apptId||'') });
          const res = await fetch('index.php?' + params.toString());
          const data = await res.json();
          if(!data.ok){ alert(data.error || 'Errore'); return; }
          fillModal(data.appointment);
          modal.show();
          return;
        }
      },

      eventDrop: async function(info){
        if (!CAN_MANAGE_APPOINTMENTS) {
          info.revert();
          return;
        }
        const apptId = info.event.extendedProps?.appointment_id || info.event.id;
        const segmentId = info.event.extendedProps?.segment_id || null;

        const cal = window.calendar;
        const isStaffDayView = (cal && cal.view && cal.view.type === 'staffTimeGridDay');
        const viewStart = (isStaffDayView && cal && cal.view) ? cal.view.currentStart : null;

        let start = info.event.start;
        let end = info.event.end || new Date(start.getTime() + 60*60000);

        let payloadStart = start;
        let payloadEnd = end;
        let targetStaffId = null;

        if (isStaffDayView && viewStart) {
          const idx = staffIdxFromDate(start, viewStart);
          const target = STAFF_DAY_COLS[idx];
          targetStaffId = target ? Number(target.id || 0) : 0;

          const curStaffId = Number(info.event.extendedProps?.staff_id || 0);

          // Multi-servizio (segmentato): non permettiamo il cambio operatore via drag&drop
          if (segmentId && targetStaffId !== curStaffId) {
            alert('Per cambiare operatore su prenotazioni multi-servizio, modifica l\'appuntamento (non tramite drag & drop).');
            info.revert();
            return;
          }

          payloadStart = withBaseDate(viewStart, start);
          payloadEnd = withBaseDate(viewStart, end);
        }

        const payload = {
          _csrf: csrf,
          action: 'move',
          id: apptId,
          starts_at: fmtMysql(payloadStart),
          ends_at: fmtMysql(payloadEnd)
        };

        // Vista staff columns: permettiamo di cambiare operatore trascinando tra colonne
        if (isStaffDayView && !segmentId) {
          payload.staff_id = String(targetStaffId ?? '');
        }

        // Segment events: dragging a segment shifts the whole appointment by the same delta.
        // Provide segment_id + old segment timing so the backend can compute the shift.
        if (segmentId) {
          payload.segment_id = segmentId;
          try {
            const oldS = info.oldEvent?.start || info.oldStart || start;
            const oldE = info.oldEvent?.end || info.oldEnd || end;
            const oldSp = (isStaffDayView && viewStart) ? withBaseDate(viewStart, oldS) : oldS;
            const oldEp = (isStaffDayView && viewStart) ? withBaseDate(viewStart, oldE) : oldE;
            payload.old_starts_at = fmtMysql(oldSp);
            payload.old_ends_at = fmtMysql(oldEp);
          } catch(_){ }
        }

        const resp = await postForm('index.php?page=api_appointments', payload);
        if(!resp.ok){
          alert(resp.error || 'Impossibile spostare');
          info.revert();
          return;
        }
        if (isStaffDayView) {
          window.calendar.refetchEvents();
        }
      },

      eventResize: async function(info){
        if (!CAN_MANAGE_APPOINTMENTS) {
          info.revert();
          return;
        }
        // Segment events represent fixed service durations; resizing would break the service schedule.
        if (info.event.extendedProps?.segment_id) {
          alert('Ridimensionamento non supportato per prenotazioni multi-servizio (segmentate).');
          info.revert();
          return;
        }

        const cal = window.calendar;
        const isStaffDayView = (cal && cal.view && cal.view.type === 'staffTimeGridDay');
        const viewStart = (isStaffDayView && cal && cal.view) ? cal.view.currentStart : null;

        const apptId = info.event.extendedProps?.appointment_id || info.event.id;
        const start = info.event.start;
        const end = info.event.end || new Date(start.getTime() + 60*60000);

        const payloadStart = (isStaffDayView && viewStart) ? withBaseDate(viewStart, start) : start;
        const payloadEnd = (isStaffDayView && viewStart) ? withBaseDate(viewStart, end) : end;

        const resp = await postForm('index.php?page=api_appointments', {
          _csrf: csrf,
          action: 'move',
          id: apptId,
          starts_at: fmtMysql(payloadStart),
          ends_at: fmtMysql(payloadEnd)
        });
        if(!resp.ok){ alert(resp.error || 'Impossibile ridimensionare'); info.revert(); return; }
        if(isStaffDayView){ window.calendar.refetchEvents(); }
      }
    });

    /**
     * FIX (UX / no-flash on view switch)
     * --------------------------------
     * Root cause:
     * - The custom view `staffTimeGridDay` uses "fake days" (one per staff column).
     * - To place events under the correct staff, we remap event.start/end to those fake dates.
     * - When switching to Week/Month, FullCalendar can briefly render the *already loaded* eventStore
     *   in the new view BEFORE our `datesSet` refetch/cleanup runs.
     *   That produces a visible "flash": appointments appear for a split second on the wrong day.
     *
     * Solution:
     * - Intercept the toolbar view-button click in CAPTURE phase and clear the event store
     *   *before* FullCalendar processes the click (and before the new view renders).
     * - This guarantees that no remapped events can leak into the next view.
     */
    (function installPreClearOnViewSwitch(){
      try{
        const root = document.getElementById('calendar');
        if(!root || root.__preClearViewSwitchInstalled) return;
        root.__preClearViewSwitchInstalled = true;

        // Use `document` capture so we run BEFORE any FullCalendar internal click handler,
        // regardless of where it's attached (button, toolbar, or document delegation).
        const __preClearHandler = function(e){
          try{
            const btn = e.target && e.target.closest ? e.target.closest('button') : null;
            if(!btn || !btn.classList || !btn.classList.contains('fc-button')) return;

            // Only if the button belongs to THIS calendar instance
            if (!btn.closest || !btn.closest('#calendar')) return;

            // Only the view-switch buttons (avoid prev/next/today)
            const isDayBtn   = btn.classList.contains('fc-staffTimeGridDay-button');
            const isWeekBtn  = btn.classList.contains('fc-timeGridWeek-button');
            const isMonthBtn = btn.classList.contains('fc-dayGridMonth-button');
            if(!isDayBtn && !isWeekBtn && !isMonthBtn) return;

            const cal = window.calendar;
            if(!cal || !cal.view) return;

            const current = String(cal.view.type || '');
            const target = isDayBtn ? 'staffTimeGridDay' : (isWeekBtn ? 'timeGridWeek' : 'dayGridMonth');
            if(!current || !target || current === target) return;

            // Prevent double-run across pointerdown -> click (different DOM events)
            const now = Date.now();
            const lastTs = Number(window.__preclear_view_switch_ts || 0);
            const lastTarget = String(window.__preclear_view_switch_target || '');
            if (lastTs && (now - lastTs) < 800 && lastTarget === target) {
              try{ e.preventDefault(); } catch(_e){}
              try{ e.stopPropagation(); } catch(_e){}
              try{ e.stopImmediatePropagation && e.stopImmediatePropagation(); } catch(_e){}
              return;
            }
            window.__preclear_view_switch_ts = now;
            window.__preclear_view_switch_target = target;

            // IMPORTANT:
            // Prevent FullCalendar from processing the default click/pointer event.
            try{ e.preventDefault(); } catch(_e){}
            try{ e.stopPropagation(); } catch(_e){}
            try{ e.stopImmediatePropagation && e.stopImmediatePropagation(); } catch(_e){}

            // Controlled switch: clear events first, then switch view, then refetch.
            try{
              if (typeof cal.batchRendering === 'function') {
                cal.batchRendering(() => {
                  try{ cal.removeAllEvents(); } catch(_e){}
                  try{ cal.changeView(target); } catch(_e){}
                });
              } else {
                try{ cal.removeAllEvents(); } catch(_e){}
                try{ cal.changeView(target); } catch(_e){}
              }
            } catch(_e){}

            try{ cal.refetchEvents && cal.refetchEvents(); } catch(_e){}
          }catch(_inner){}
        };

        // Capture on pointerdown/mousedown/click to cover all FullCalendar bindings
        ['pointerdown','mousedown','click'].forEach(evt => {
          document.addEventListener(evt, __preClearHandler, true);
        });
      }catch(_e){}
    })();

    window.calendar.render();
    syncCalendarStickyToolbarOffset();
    scheduleCalendarViewportHeightSync(0);
    window.addEventListener('resize', syncCalendarStickyToolbarOffset, { passive: true });
    window.addEventListener('resize', function(){
      scheduleCalendarViewportHeightSync(80);
    }, { passive: true });

    document.addEventListener('click', function(ev){
      const pop = document.getElementById('calendarDatePickerPopover');
      if (!pop || pop.hidden) return;
      const target = ev.target;
      const jumpBtn = target && target.closest ? target.closest('.fc-jumpDate-button') : null;
      if (jumpBtn) return;
      if (pop.contains(target)) return;
      closeCalendarDatePicker();
    });

    document.addEventListener('keydown', function(ev){
      if (ev.key === 'Escape') closeCalendarDatePicker();
    });

    window.addEventListener('resize', () => { try{ closeCalendarDatePicker(); }catch(_){ } }, { passive: true });

    // Fix now-indicator line in staff columns view
    installStaffNowIndicatorFix();

    try{ enhanceCalendarToolbar(); }catch(_){ }
    try{ syncCalendarDatePickerState(); }catch(_){ }

    // Show the hovered slot time to make the selected hour easier to read
    installCalendarHoverTimeIndicator();

    function reloadCalendarForSelectedLocation(){
      if (!filterLocation) return false;
      const loc = String(filterLocation.value || '').trim();
      if (!loc) return false;
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('page', 'calendar');
        url.searchParams.set('set_location_id', loc);
        url.searchParams.delete('location_id');

        const cal = window.calendar;
        const viewType = cal && cal.view && cal.view.type ? String(cal.view.type) : '';
        if (['staffTimeGridDay', 'timeGridWeek', 'dayGridMonth'].includes(viewType)) {
          url.searchParams.set('calendar_view', viewType);
        }
        const focusDate = cal && typeof cal.getDate === 'function' ? cal.getDate() : null;
        if (focusDate instanceof Date && !Number.isNaN(focusDate.getTime())) {
          url.searchParams.set('calendar_date', ymd(focusDate));
        }
        window.location.assign(url.toString());
        return true;
      } catch (_) {
        window.location.href = 'index.php?page=calendar&set_location_id=' + encodeURIComponent(loc);
        return true;
      }
    }

    [filterService, filterStatus].filter(Boolean).forEach(el => el.addEventListener('change', () => {
      if (modalLocationSelect && filterLocation) modalLocationSelect.value = filterLocation.value || modalLocationSelect.value || '';
      syncCalendarServicesForLocations();
      refreshCalendarStaffForService();
      scheduleCalendarViewportHeightSync(0);
      window.calendar.refetchEvents();
    }));
    if (filterLocation) {
      filterLocation.addEventListener('change', () => {
        reloadCalendarForSelectedLocation();
      });
    }
  });
})();
