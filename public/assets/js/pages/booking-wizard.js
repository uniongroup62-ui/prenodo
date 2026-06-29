(function(){
  const wizardConfigEl = document.getElementById('bookingWizardConfig');
  let wizardConfig = {};
  try {
    wizardConfig = wizardConfigEl ? JSON.parse(wizardConfigEl.textContent || '{}') : {};
  } catch (err) {
    wizardConfig = {};
  }
  const overlay = document.getElementById('bookingOverlay');
  const bookingModalShell = overlay ? overlay.querySelector('.booking-modal') : null;
  const btnClose = document.getElementById('btnClose');
  const btnBack = document.getElementById('btnBack');
  const btnBackTop = document.getElementById('btnBackTop');
  const btnNext = document.getElementById('btnNext');
  const btnRecap = document.getElementById('btnRecap');
  const btnNextSummary = document.getElementById('btnNextSummary');
  const wizardForm = document.getElementById('wizardForm');
  const stepTitle = document.getElementById('stepTitle');
  const bookingStepDescription = document.getElementById('bookingStepDescription');
  const bookingProgress = document.getElementById('bookingProgress');
  const progressItems = Array.from(document.querySelectorAll('.booking-progress__item'));
  const bookingStepCounter = document.getElementById('bookingStepCounter');
  const leftTitle = document.getElementById('leftTitle');
  const leftText = document.getElementById('leftText');
  const categoryTabs = Array.from(document.querySelectorAll('[data-category-tab]'));
  const serviceSectionTitle = document.getElementById('bookingServiceSectionTitle');
  const summarySelectionText = document.getElementById('summarySelectionText');

  const staffSelect = document.getElementById('staffSelect');
  const locationSelect = document.getElementById('locationSelect');
  const locationCards = Array.from(document.querySelectorAll('.booking-location-card'));
  const currentPageLocationId = String(wizardConfig.currentPageLocationId || '');
  const skipLocationStep = locationCards.length === 1;
  const initialBookingStep = Math.max(1, Math.min(7, parseInt(String(wizardConfig.initialBookingStep || '1'), 10) || 1));
  const initialServiceIds = String(wizardConfig.initialServiceIds || '');
  const INITIAL_RESIDUAL = wizardConfig.initialResidual || null;
  const RESIDUAL_REQUESTED_SERVER = !!wizardConfig.residualRequestedServer;
  const RESIDUAL_CONTEXT_ERROR = String(wizardConfig.residualContextError || '');
  const RESIDUAL_REQUESTED = RESIDUAL_REQUESTED_SERVER || (() => {
    try {
      const params = new URLSearchParams(window.location.search || '');
      return params.get('book_package') === '1' || params.get('book_prepaid') === '1' || params.get('book_giftbox') === '1' || params.get('book_omaggio') === '1';
    } catch (e) {
      return false;
    }
  })();
  const serviceCatalogPromotions = (wizardConfig.serviceCatalogPromotions && typeof wizardConfig.serviceCatalogPromotions === 'object') ? wizardConfig.serviceCatalogPromotions : {};
  const staffList = document.getElementById('staffList');
  const staffEmpty = document.getElementById('staffEmpty');
  const staffIdInput = document.getElementById('staff_id');
	  const staffMapInput = document.getElementById('staff_map');
  const locationIdInput = document.getElementById('location_id');

  const serviceIdsInput = document.getElementById('service_ids');
  const dateInput = document.getElementById('date');
  const timeInput = document.getElementById('time');
  const appointmentHoldTokenInput = document.getElementById('appointment_hold_token');
  const giftboxRedeemInput = document.getElementById('giftbox_redeem');
  const giftRedeemInput = document.getElementById('gift_redeem');
  const packageRedeemInput = document.getElementById('package_redeem');
  const prepaidServiceRedeemInput = document.getElementById('prepaid_service_redeem');
  const bookingHoldCountdownEl = document.getElementById('bookingHoldCountdown');

  const serviceCards = Array.from(document.querySelectorAll('.service-card'));
  const catCards = Array.from(document.querySelectorAll('.cat-card'));

  const recommendedBox = document.getElementById('recommendedBox');
  const recommendedList = document.getElementById('recommendedList');

  const slotGrid = document.getElementById('slotGrid');
  const slotEmpty = document.getElementById('slotEmpty');
  const slotDateLabel = document.getElementById('slotDateLabel');
  const dateStripDays = document.getElementById('dateStripDays');
  const dateStripMonthLabel = document.getElementById('dateStripMonthLabel');
  const dateStripPrev = document.getElementById('dateStripPrev');
  const dateStripNext = document.getElementById('dateStripNext');
  const dateStripCalendarBtn = document.getElementById('dateStripCalendarBtn');
  const calendarPopover = document.getElementById('calendarPopover');

  const sumStaff = document.getElementById('sumStaff');
  const sumStaffDetails = document.getElementById('sumStaffDetails');
  const sumLocation = document.getElementById('sumLocation');
  const sumServices = document.getElementById('sumServices');
  const sumDateTime = document.getElementById('sumDateTime');
  const sumDuration = document.getElementById('sumDuration');
  const sumTotal = document.getElementById('sumTotal');
  const sumCostLines = document.getElementById('sumCostLines');

  // Recap step (step 7)
  const summaryAside = document.querySelector('.booking-summary');
  const recServiceTitle = document.getElementById('recServiceTitle');
  const recDateTime = document.getElementById('recDateTime');
  const recStaffName = document.getElementById('recStaffName');
  const recStaffDetails = document.getElementById('recStaffDetails');
  const recLocationName = document.getElementById('recLocationName');
  const recLocationAddress = document.getElementById('recLocationAddress');
  const recClientInitials = document.getElementById('recClientInitials');
  const recClientName = document.getElementById('recClientName');
  const recClientEmail = document.getElementById('recClientEmail');
  const recCostLines = document.getElementById('recCostLines');
  const recTotal = document.getElementById('recTotal');
  const recPromoConditions = document.getElementById('recPromoConditions');
  const recPromoConditionsText = document.getElementById('recPromoConditionsText');
  const recFidelityNote = document.getElementById('recFidelityNote');
  const sumFidelityNote = document.getElementById('sumFidelityNote');
  const bookingRecapPopup = document.getElementById('bookingRecapPopup');
  const bookingRecapClose = document.getElementById('bookingRecapClose');
  const bookingRecapPopupTitle = document.getElementById('bookingRecapPopupTitle');
  const bookingRecapPopupDateTime = document.getElementById('bookingRecapPopupDateTime');
  const bookingRecapPopupStaff = document.getElementById('bookingRecapPopupStaff');
  const bookingRecapPopupLocation = document.getElementById('bookingRecapPopupLocation');
  const bookingRecapPopupDuration = document.getElementById('bookingRecapPopupDuration');
  const bookingRecapPopupCostLines = document.getElementById('bookingRecapPopupCostLines');
  const bookingRecapPopupTotal = document.getElementById('bookingRecapPopupTotal');
  const bookingRecapPopupFidelityNote = document.getElementById('bookingRecapPopupFidelityNote');
  const bookingRecapPopupPromoConditions = document.getElementById('bookingRecapPopupPromoConditions');
  const fidelityPointsUseInput = document.getElementById('fidelity_points_use');
  const discountModeInput = document.getElementById('discount_mode');

  // Fidelity UI (solo recap, quando e disponibile solo lo sconto punti)
  const recFidelityBox = document.getElementById('recFidelityBox');
  const recFidelityAvail = document.getElementById('recFidelityAvail');
  const recFidelityUseToggle = document.getElementById('recFidelityUseToggle');
  const recFidelityToggleRow = document.getElementById('recFidelityToggleRow');
  const recFidelityHint = document.getElementById('recFidelityHint');
  const recFidelityDiscountAmount = document.getElementById('recFidelityDiscountAmount');

  // Vantaggi cliente (step 6)
  const giftcardRedeemInput = document.getElementById('giftcard_redeem');
  const recGiftcardUseBox = document.getElementById('recGiftcardUseBox');
  const recGiftcardList = document.getElementById('recGiftcardList');
  const recGiftcardHint = document.getElementById('recGiftcardHint');
  const benefitsEmptyBox = document.getElementById('benefitsEmptyBox');
  const creditUseInput = document.getElementById('credit_use');
  const recCreditUseBox = document.getElementById('recCreditUseBox');
  const recCreditUseToggle = document.getElementById('recCreditUseToggle');
  const recCreditAvail = document.getElementById('recCreditAvail');
  const recCreditChoiceRow = recCreditUseToggle ? recCreditUseToggle.closest('.giftcard-choice') : null;


  // Fidelity choice (conflitto sconto/gift)
  const fidelityChoiceInput = document.getElementById('fidelity_choice');
  const fidelityGiftIdxInput = document.getElementById('fidelity_gift_idx');

  const recFidelityChoiceBox = document.getElementById('recFidelityChoiceBox');
  const fidChoiceLater = document.getElementById('fidChoiceLater');
  const fidChoiceDiscount = document.getElementById('fidChoiceDiscount');
  const fidChoiceGift = document.getElementById('fidChoiceGift');
  const fidChoiceDiscountEuro = document.getElementById('fidChoiceDiscountEuro');
  const fidChoiceDiscountPoints = document.getElementById('fidChoiceDiscountPoints');
  const fidChoiceDiscountLabel = document.getElementById('fidChoiceDiscountLabel');
  const fidChoiceGiftDesc = document.getElementById('fidChoiceGiftDesc');
  const fidChoiceGiftPoints = document.getElementById('fidChoiceGiftPoints');
  const fidChoiceGiftLabel = document.getElementById('fidChoiceGiftLabel');

  // Fidelity in booking pubblico serve sia per lo sconto punti (redeem) che per gli omaggi.
  // Quindi consideriamo la funzione attiva se è abilitata globalmente e se è attivo almeno
  // uno tra: sconto tramite punti oppure omaggi.
  const FIDELITY_ENABLED = !!wizardConfig.fidelityEnabled;
  const BENEFITS_PREVIEW_ENABLED = true;
  const FIDELITY_AUTO_DISCOUNT = false;
  const FIDELITY_LABEL = String(wizardConfig.fidelityLabel || 'Punti');
  const FIDELITY_CONFLICT_POLICY = String(wizardConfig.fidelityConflictPolicy || 'discount');

  // --- Fidelity helpers (omaggi) ---
  function getFidelityGiftList(preview){
    let gifts = [];
    if (preview && Array.isArray(preview.gifts)) {
      gifts = preview.gifts.map((g, idx) => {
        const min = wholePts((g.min_points ?? g.min ?? 0) || 0);
        const desc = (g.description ? String(g.description) : '');
        const giftIdx = (g.idx !== undefined && g.idx !== null) ? (parseInt(g.idx, 10) || 0) : idx;
        return { idx: giftIdx, min_points: min, description: desc };
      });
    } else if (preview) {
      const legacyMin = wholePts(preview.gift_min_points || 0);
      const legacyDesc = (preview.gift_description ? String(preview.gift_description) : '');
      if (legacyMin > 0) gifts = [{ idx: 0, min_points: legacyMin, description: legacyDesc }];
    }

    gifts = gifts.filter(g => (g.min_points || 0) > 0);
    gifts.sort((a,b) => (a.min_points||0) - (b.min_points||0));
    return gifts;
  }

  function bestFidelityGiftForRemaining(remainingPoints, giftList){
    const rem = Math.max(0, wholePts(remainingPoints || 0));
    if (!Array.isArray(giftList) || !giftList.length) return null;
    let best = null;
    for (const g of giftList) {
      if ((rem + 0.00001) >= (g.min_points || 0)) best = g;
    }
    return best;
  }

  // Coupon UI (conferma)
  const couponToggle = document.getElementById('couponToggle');
  const couponBox = document.getElementById('couponBox');
  const couponInput = document.getElementById('couponInput');
  const couponApplyBtn = document.getElementById('couponApplyBtn');
  const couponRemoveBtn = document.getElementById('couponRemoveBtn');
  const couponMsg = document.getElementById('couponMsg');
  const couponCodeInput = document.getElementById('coupon_code');
  const promotionIdInput = document.getElementById('promotion_id');

  // Promozioni (recap)
  const promotionsBox = document.getElementById('promotionsBox');
  const promotionsList = document.getElementById('promotionsList');
  let promotionsKey = '';
  let promotionsLoading = false;
  let promotionsItems = [];
  const CHOOSE_STAFF_ENABLED = !!wizardConfig.chooseStaffEnabled;
  // Base URL for public booking API calls. Using a fixed endpoint avoids bugs when
  // the booking UI is embedded or opened from a URL that doesn't carry the needed params.
  const BOOKING_API_BASE = String(wizardConfig.bookingApiBase || '');
  const PUBLIC_HOME_URL = String(wizardConfig.publicHomeUrl || '');
  const STAFF_MAP = (wizardConfig.staffMap && typeof wizardConfig.staffMap === 'object') ? wizardConfig.staffMap : {};
  const BUSINESS_NAME = String(wizardConfig.businessName || '');
  const BUSINESS_ADDRESS = String(wizardConfig.businessAddress || '');

  // Recommended services mapping (service -> [recommended])
  const REC_ROWS = Array.isArray(wizardConfig.recRows) ? wizardConfig.recRows : [];



  const wizardSteps = Array.from(document.querySelectorAll('.wizard-step'));
  let step = 1;
  let selectedCategoryId = null;
  let selectedServices = new Set();
  let selectedServiceOrder = [];// preserves user selection order for multi-service sequencing
  let selectedDate = null;
  let selectedTime = null;
  let dateStripStart = null;
	  let skippedStaffStep = !CHOOSE_STAFF_ENABLED;
	  let lastStaffServices = []; // [{service_id,name,duration_min,staff:[...]}]
  let selectedStaffByService = {}; // service_id -> staff_id (string)


  let appliedCoupon = null;
  let appliedPromotion = null;
  let bookingHoldExpiresAtMs = 0;
  let bookingHoldTimer = null;
  let bookingSlotsLoading = false;
  let bookingSlotAutoRefreshTimer = null;

  function initialResidualContext(){
    if (!INITIAL_RESIDUAL || typeof INITIAL_RESIDUAL !== 'object') return null;
    const sid = String(INITIAL_RESIDUAL.service_id || '').trim();
    if (!sid) return null;
    return INITIAL_RESIDUAL;
  }

  function residualFlowActive(){
    return !!initialResidualContext();
  }

  function residualUnavailableMessage(){
    return RESIDUAL_CONTEXT_ERROR || 'Il residuo selezionato non e disponibile per la prenotazione.';
  }

  function bookingShowHoldError(message){
    const text = String(message || residualUnavailableMessage());
    if (bookingHoldCountdownEl) {
      bookingHoldCountdownEl.classList.remove('d-none', 'alert-info', 'alert-warning');
      bookingHoldCountdownEl.classList.add('alert-danger');
      bookingHoldCountdownEl.textContent = text;
    }
    try {
      if (typeof uiToast === 'function') uiToast(text, 'warning');
    } catch (e) {}
  }

  function unresolvedResidualRequested(){
    return !!(RESIDUAL_REQUESTED && !residualFlowActive());
  }

  function shouldSkipLocationStep(){
    return skipLocationStep && !unresolvedResidualRequested();
  }

  function normalizeWizardStepForResidual(n){
    let next = Math.max(1, Math.min(7, parseInt(n, 10) || 1));
    if (unresolvedResidualRequested()) return 1;
    if (residualFlowActive() && (next === 2 || next === 3)) return 1;
    return next;
  }

  function firstWizardStep(){
    return shouldSkipLocationStep() ? 2 : 1;
  }

  function normalizeWizardStepForLocation(n){
    const next = Math.max(1, Math.min(7, parseInt(n, 10) || 1));
    if (shouldSkipLocationStep() && next === 1) return 2;
    return next;
  }

  function residualLabelForService(id){
    const ctx = initialResidualContext();
    if (!ctx || String(ctx.service_id || '') !== String(id || '')) return '';
    return String(ctx.label || (ctx.type === 'package' ? 'Pacchetto' : (ctx.type === 'giftbox' ? 'GiftBox' : (ctx.type === 'gift' ? 'gift' : 'Prepagato')))).trim();
  }

  function hasResidualSelected(){
    const ctx = initialResidualContext();
    return !!(ctx && selectedServices && selectedServices.has(String(ctx.service_id || '')));
  }

  function residualServiceId(){
    const ctx = initialResidualContext();
    return ctx ? String(ctx.service_id || '').trim() : '';
  }

  function syncResidualInputs(){
    const ctx = initialResidualContext();
    const active = !!(ctx && selectedServices && selectedServices.has(String(ctx.service_id || '')));
    if (giftboxRedeemInput) {
      const rows = active && Array.isArray(ctx.giftbox_redeem) ? ctx.giftbox_redeem : [];
      giftboxRedeemInput.value = rows.length ? JSON.stringify(rows) : '';
    }
    if (giftRedeemInput) {
      const rows = active && Array.isArray(ctx.gift_redeem) ? ctx.gift_redeem : [];
      giftRedeemInput.value = rows.length ? JSON.stringify(rows) : '';
    }
    if (packageRedeemInput) {
      const rows = active && Array.isArray(ctx.package_redeem) ? ctx.package_redeem : [];
      packageRedeemInput.value = rows.length ? JSON.stringify(rows) : '';
    }
    if (prepaidServiceRedeemInput) {
      const rows = active && Array.isArray(ctx.prepaid_service_redeem) ? ctx.prepaid_service_redeem : [];
      prepaidServiceRedeemInput.value = rows.length ? JSON.stringify(rows) : '';
    }
  }

  function bookingCurrentHoldToken(){
    return appointmentHoldTokenInput ? String(appointmentHoldTokenInput.value || '').trim() : '';
  }

  function bookingSetHoldToken(token){
    const next = String(token || '').trim();
    if (appointmentHoldTokenInput) appointmentHoldTokenInput.value = next;
    if (!next) bookingClearHoldCountdown();
  }

  function bookingHoldExpiryMs(data){
    const ttl = Number(data && data.ttl_seconds);
    if (Number.isFinite(ttl) && ttl > 0) return Date.now() + (ttl * 1000);
    const raw = String((data && data.expires_at) || '').trim();
    if (raw) {
      const parsed = Date.parse(raw.replace(' ', 'T'));
      if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
  }

  function bookingFormatHoldRemaining(ms){
    const seconds = Math.max(0, Math.ceil(Number(ms || 0) / 1000));
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return minutes + ':' + String(rest).padStart(2, '0');
  }

  function bookingClearHoldCountdown(options){
    if (bookingHoldTimer) {
      clearInterval(bookingHoldTimer);
      bookingHoldTimer = null;
    }
    bookingHoldExpiresAtMs = 0;
    const hide = !options || options.hide !== false;
    if (bookingHoldCountdownEl && hide) {
      bookingHoldCountdownEl.classList.add('d-none');
      bookingHoldCountdownEl.classList.remove('alert-warning', 'alert-danger');
      bookingHoldCountdownEl.classList.add('alert-info');
      bookingHoldCountdownEl.textContent = '';
    }
  }

  function bookingRenderHoldCountdown(){
    if (!bookingHoldCountdownEl) return;
    const token = bookingCurrentHoldToken();
    const remaining = bookingHoldExpiresAtMs ? (bookingHoldExpiresAtMs - Date.now()) : 0;
    if (!token || remaining <= 0) {
      bookingHoldCountdownEl.classList.add('d-none');
      return;
    }
    bookingHoldCountdownEl.classList.remove('d-none', 'alert-info', 'alert-warning', 'alert-danger');
    bookingHoldCountdownEl.classList.add(remaining <= 30000 ? 'alert-warning' : 'alert-info');
    bookingHoldCountdownEl.textContent = 'Slot riservato per ' + bookingFormatHoldRemaining(remaining) + '.';
  }

  function bookingHoldIsExpired(){
    return !!(bookingCurrentHoldToken() && bookingHoldExpiresAtMs && Date.now() >= bookingHoldExpiresAtMs);
  }

  function bookingHoldExpiredDefaultMessage(){
    return 'La disponibilita selezionata e scaduta. Scegli di nuovo uno slot.';
  }

  function bookingShowHoldExpiredMessage(message){
    if (!bookingHoldCountdownEl) return;
    bookingHoldCountdownEl.classList.remove('d-none', 'alert-info', 'alert-warning');
    bookingHoldCountdownEl.classList.add('alert-danger');
    bookingHoldCountdownEl.textContent = String(message || bookingHoldExpiredDefaultMessage());
  }

  function bookingHandleHoldExpired(message){
    const finalMessage = String(message || bookingHoldExpiredDefaultMessage());
    const dateToRefresh = selectedDate;
    bookingClearHoldCountdown({ hide: false });
    bookingSetHoldToken('');
    selectedTime = null;
    if (timeInput) timeInput.value = '';
    if (!CHOOSE_STAFF_ENABLED) {
      selectedStaffByService = {};
      if (staffIdInput) staffIdInput.value = '';
      if (staffMapInput) staffMapInput.value = '';
    }
    if (slotGrid) Array.from(slotGrid.querySelectorAll('.slot-btn')).forEach(x => x.classList.remove('selected'));
    bookingShowHoldExpiredMessage(finalMessage);
    updateSummary();
    validateStep();
    if (step > 5) showStep(5);
    if (dateToRefresh) fetchSlotsFor(dateToRefresh).catch(() => {});
    uiToast(finalMessage, 'warning');
  }

  function bookingStartHoldCountdown(data){
    bookingClearHoldCountdown();
    bookingHoldExpiresAtMs = bookingHoldExpiryMs(data);
    if (!bookingHoldExpiresAtMs) return;
    bookingRenderHoldCountdown();
    bookingHoldTimer = setInterval(() => {
      if (bookingHoldIsExpired()) {
        bookingHandleHoldExpired();
      } else {
        bookingRenderHoldCountdown();
      }
    }, 1000);
  }

  function stopBookingSlotAutoRefresh(){
    if (bookingSlotAutoRefreshTimer) {
      clearTimeout(bookingSlotAutoRefreshTimer);
      bookingSlotAutoRefreshTimer = null;
    }
  }

  function shouldBookingSlotAutoRefresh(){
    return !!(
      step === 5 &&
      selectedDate &&
      serviceIdsInput &&
      String(serviceIdsInput.value || '').trim() &&
      !document.hidden
    );
  }

  function scheduleBookingSlotAutoRefresh(){
    stopBookingSlotAutoRefresh();
    if (!shouldBookingSlotAutoRefresh()) return;
    bookingSlotAutoRefreshTimer = setTimeout(() => {
      bookingSlotAutoRefreshTimer = null;
      if (!shouldBookingSlotAutoRefresh()) return;
      if (bookingSlotsLoading) {
        scheduleBookingSlotAutoRefresh();
        return;
      }
      fetchSlotsFor(selectedDate, { silent: true, auto: true }).catch(() => {
        scheduleBookingSlotAutoRefresh();
      });
    }, 15000);
  }

  function finishBookingSlotsRequest(requestId){
    if (requestId !== slotsRequestId) return;
    bookingSlotsLoading = false;
    try { slotGrid.removeAttribute('aria-busy'); } catch (e) {}
    scheduleBookingSlotAutoRefresh();
  }

  function bookingCsrfToken(){
    return document.querySelector('input[name="_csrf"]')?.value || document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
  }

  function bookingCurrentLocationId(){
    return (locationIdInput?.value || document.getElementById('locationSelect')?.value || '').trim();
  }

  async function releaseBookingHold(){
    const token = bookingCurrentHoldToken();
    if (!token) return;
    bookingSetHoldToken('');
    try {
      const body = new URLSearchParams();
      body.set('mode', 'release_hold');
      body.set('appointment_hold_token', token);
      const csrfToken = bookingCsrfToken();
      if (csrfToken) body.set('_csrf', csrfToken);
      const url = new URL(BOOKING_API_BASE);
      url.searchParams.set('mode', 'release_hold');
      await fetch(url.toString(), {
        method: 'POST',
        credentials: 'same-origin',
        keepalive: true,
        headers: {'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8', 'Accept':'application/json'},
        body: body.toString()
      });
    } catch (e) {}
  }

  async function createBookingHold(date, time){
    const serviceIds = String(serviceIdsInput?.value || '').trim();
    if (!date || !time || !serviceIds) throw new Error('Seleziona prima servizio, data e ora.');

    const body = new URLSearchParams();
    body.set('mode', 'hold_slot');
    body.set('date', String(date));
    body.set('time', String(time).slice(0, 5));
    body.set('service_ids', serviceIds);
    const staffMap = (staffMapInput && staffMapInput.value) ? staffMapInput.value : '';
    if (staffMap) {
      body.set('staff_map', staffMap);
      body.set('staff_id', '');
    } else if (staffIdInput && staffIdInput.value) {
      body.set('staff_id', staffIdInput.value);
    }
    const locId = bookingCurrentLocationId();
    if (locId) body.set('location_id', locId);
    const previous = bookingCurrentHoldToken();
    if (previous) body.set('appointment_hold_token', previous);
    const csrfToken = bookingCsrfToken();
    if (csrfToken) body.set('_csrf', csrfToken);

    const url = new URL(BOOKING_API_BASE);
    url.searchParams.set('mode', 'hold_slot');
    const res = await fetch(url.toString(), {
      method: 'POST',
      credentials: 'same-origin',
      headers: {'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8', 'Accept':'application/json'},
      body: body.toString()
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || !data.ok || !data.token) {
      throw new Error((data && data.error) ? String(data.error) : 'Orario non piu disponibile. Scegli un altro slot.');
    }
    bookingSetHoldToken(data.token);
    bookingStartHoldCountdown(data);
    return data;
  }

  function applyBookingHoldAllocation(data){
    if (!data || typeof data !== 'object') return;
    const staffIds = Array.isArray(data.staff_ids)
      ? data.staff_ids.map(v => String(v || '').trim()).filter(Boolean)
      : [];
    const segments = Array.isArray(data.segments) ? data.segments : [];
    const selectedIds = getOrderedSelectedServiceIds().map(String);

    if (segments.length) {
      const map = {};
      segments.forEach(seg => {
        const serviceId = String(seg && seg.service_id != null ? seg.service_id : '').trim();
        const staffId = String(seg && seg.staff_id != null ? seg.staff_id : '').trim();
        if (serviceId && staffId) {
          selectedStaffByService[serviceId] = staffId;
          map[serviceId] = staffId;
        }
      });
      if (Object.keys(map).length && staffMapInput) {
        staffMapInput.value = JSON.stringify(map);
      }
    } else if (staffIds.length === 1 && selectedIds.length === 1) {
      selectedStaffByService[selectedIds[0]] = staffIds[0];
    }

    if (staffIdInput) {
      if (staffIds.length === 1) {
        staffIdInput.value = staffIds[0];
      } else if (selectedIds.length === 1 && selectedStaffByService[selectedIds[0]]) {
        staffIdInput.value = String(selectedStaffByService[selectedIds[0]]);
      } else {
        staffIdInput.value = '';
      }
    }

    updateSummary();
    validateStep();
  }

  // Promotion preview state (auto)
  let promotionPreviewKey = '';
  let promotionPreviewLoading = false;
  let promotionPreviewPromise = null;
  let promotionPreviewReqId = 0; // {code, discount, subtotal, total, description}

  // Fidelity/benefit preview state (punti, credito e GiftCard).
  function emptyFidelityPreview(enabled = true){
    return {
      enabled: !!enabled,
      label: FIDELITY_LABEL,
      client_found: false,
      available_points: 0,
      points_used: 0,
      discount: 0,
      gift_enabled: 0,
      gift_min_points: 0,
      gift_description: null,
      gifts: [],
      gift_can_redeem: 0,
      credit: { schema_ok: 0, requires_login: 1, logged_in: 0, balance: 0 },
      giftcards: { schema_ok: 0, requires_login: 1, logged_in: 0, items: [] }
    };
  }
  let fidelityPreview = emptyFidelityPreview(FIDELITY_ENABLED);
  let fidelityPreviewKey = '';
  let fidelityPreviewLoading = false;
  let discountModeTouched = false;

  function normMoney(v){
    const n = parseFloat(String(v ?? '').replace(',', '.'));
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100) / 100;
  }

  function getDiscountMode(){
    const v = (discountModeInput ? String(discountModeInput.value || '') : '').trim().toLowerCase();
    return v === 'fidelity' ? 'fidelity' : 'none';
  }

  function setDiscountMode(mode){
    const m = String(mode || '').trim().toLowerCase() === 'fidelity' ? 'fidelity' : 'none';
    if (discountModeInput) discountModeInput.value = m;
    if (recFidelityUseToggle) {
      const fidelityBoxVisible = !!(recFidelityBox && !recFidelityBox.classList.contains('d-none'));
      recFidelityUseToggle.checked = (m === 'fidelity' && fidelityBoxVisible);
    }
  }

  if (recFidelityUseToggle) {
    recFidelityUseToggle.addEventListener('change', () => {
      discountModeTouched = true;
      if (recFidelityUseToggle.checked) {
        setDiscountMode('fidelity');
      } else {
        if (fidelityPointsUseInput) fidelityPointsUseInput.value = '0';
        setDiscountMode('none');
      }
      updateSummary();
      updateRecap();
    });
  }

  if (recCreditUseToggle) {
    recCreditUseToggle.addEventListener('change', () => {
      updateSummary();
      updateRecap();
    });
  }

  function giftcardPreviewItems(){
    const raw = (fidelityPreview && fidelityPreview.giftcards && Array.isArray(fidelityPreview.giftcards.items))
      ? fidelityPreview.giftcards.items
      : [];
    return raw.map((item) => {
      const id = parseInt(item && (item.id ?? item.giftcard_id ?? 0), 10) || 0;
      const code = String((item && (item.code ?? item.public_code ?? item.card_code)) || '').trim();
      const title = String((item && (item.title ?? item.name ?? item.label)) || (code ? ('GiftCard ' + code) : ('GiftCard #' + id))).trim();
      const balance = normMoney(item && (item.balance ?? item.remaining ?? item.remaining_amount ?? 0));
      const expires = String((item && (item.expires_at ?? item.expiry_date ?? item.valid_until)) || '').trim();
      return { id, code, title, balance, expires };
    }).filter(item => item.id > 0 && item.balance > 0.00001);
  }

  function currentGiftcardSelection(){
    const raw = giftcardRedeemInput ? String(giftcardRedeemInput.value || '').trim() : '';
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      const row = Array.isArray(parsed) ? parsed[0] : parsed;
      if (!row || typeof row !== 'object') return null;
      const id = parseInt(row.giftcard_id ?? row.id ?? 0, 10) || 0;
      const amount = normMoney(row.amount ?? row.value ?? 0);
      const code = String(row.code ?? row.public_code ?? '').trim();
      return id > 0 ? { id, amount, code } : null;
    } catch (e) {
      return null;
    }
  }

  function currentGiftcardId(){
    const sel = currentGiftcardSelection();
    return sel ? (parseInt(sel.id, 10) || 0) : 0;
  }

  function giftcardSelectedAmount(){
    const sel = currentGiftcardSelection();
    return sel ? normMoney(sel.amount || 0) : 0;
  }

  function writeGiftcardRedeem(item, amount){
    if (!giftcardRedeemInput) return;
    const id = parseInt(item && item.id, 10) || 0;
    const applied = normMoney(amount || 0);
    if (!id || applied <= 0.00001) {
      giftcardRedeemInput.value = '';
      return;
    }
    const row = { giftcard_id: id, amount: applied };
    if (item && item.code) row.code = String(item.code);
    giftcardRedeemInput.value = JSON.stringify([row]);
  }

  function renderGiftcardChoices(items, selectedId, maxApplicable){
    const list = Array.isArray(items) ? items : [];
    const max = Math.max(0, normMoney(maxApplicable || 0));
    if (recGiftcardUseBox) recGiftcardUseBox.classList.toggle('d-none', list.length <= 0 || max <= 0.00001);
    if (recGiftcardHint) {
      recGiftcardHint.textContent = max > 0
        ? 'Scegli una GiftCard da applicare al residuo.'
        : 'La prenotazione e gia coperta dal credito.';
    }
    if (!recGiftcardList) return;
    recGiftcardList.innerHTML = '';
    if (!list.length) return;

    if (selectedId > 0) {
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'giftcard-choice';
      clearBtn.dataset.giftcardClear = '1';
      clearBtn.innerHTML = '<div><div class="giftcard-choice__name">Non utilizzare GiftCard</div><div class="giftcard-choice__meta">Mantieni il totale senza GiftCard.</div></div>';
      recGiftcardList.appendChild(clearBtn);
    }

    list.forEach((item) => {
      const useAmount = Math.min(item.balance || 0, max || item.balance || 0);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'giftcard-choice' + (selectedId === item.id ? ' is-active' : '');
      btn.dataset.giftcardId = String(item.id);
      btn.dataset.giftcardAmount = String(useAmount);
      if (max <= 0.00001) btn.disabled = true;
      const code = item.code ? ('Codice ' + item.code) : ('GiftCard #' + item.id);
      const expires = item.expires ? (' - scade ' + item.expires) : '';
      btn.innerHTML = `
        <div>
          <div class="giftcard-choice__name">${escapeHtml(item.title || 'GiftCard')}</div>
          <div class="giftcard-choice__meta">${escapeHtml(code + expires)}</div>
        </div>
        <div class="giftcard-choice__amount">${escapeHtml(euro(useAmount))}</div>
      `;
      recGiftcardList.appendChild(btn);
    });
  }

  function bookingAmountBeforeCustomerBenefits(){
    let subtotal = 0;
    try {
      subtotal = servicesFromSelection().reduce((sum, svc) => sum + (normMoney(svc && svc.price) || 0), 0);
    } catch (e) {
      subtotal = 0;
    }
    subtotal = normMoney(subtotal);
    if (subtotal <= 0.00001) return 0;

    let preBenefitDiscount = 0;
    if (appliedCoupon && appliedCoupon.code) {
      preBenefitDiscount = normMoney(appliedCoupon.discount || 0);
    } else if (appliedPromotion && appliedPromotion.id) {
      preBenefitDiscount = normMoney(appliedPromotion.discount || 0);
    }
    preBenefitDiscount = Math.max(0, Math.min(preBenefitDiscount, subtotal));
    return Math.max(0, normMoney(subtotal - preBenefitDiscount));
  }

  function hasBenefitsAvailable(){
    const amountBeforeCustomerBenefits = bookingAmountBeforeCustomerBenefits();
    const fidelityAvailable = !!(
      FIDELITY_ENABLED &&
      fidelityPreview &&
      fidelityPreview.enabled &&
      fidelityPreview.client_found &&
      wholePts(fidelityPreview.points_used || 0) > 0 &&
      normMoney(fidelityPreview.discount || 0) > 0.00001
    );
    const gcAvailable = amountBeforeCustomerBenefits > 0.00001 && giftcardPreviewItems().length > 0;
    const cr = (fidelityPreview && fidelityPreview.credit) ? fidelityPreview.credit : null;
    const crSchemaOk = !!(cr && (parseInt(String(cr.schema_ok || 0), 10) || 0));
    const crLoggedIn = !!(cr && cr.logged_in);
    const crBalance = cr ? normMoney(cr.balance ?? 0) : 0;
    return !!(fidelityAvailable || gcAvailable || (amountBeforeCustomerBenefits > 0.00001 && crSchemaOk && crLoggedIn && crBalance > 0.00001));
  }

  function clearBenefitSelections(){
    if (fidelityPointsUseInput) fidelityPointsUseInput.value = '0';
    if (discountModeInput) discountModeInput.value = 'none';
    if (recFidelityUseToggle) recFidelityUseToggle.checked = false;
    if (recFidelityToggleRow) recFidelityToggleRow.classList.remove('is-active');
    if (creditUseInput) creditUseInput.value = '0';
    if (recCreditUseToggle) recCreditUseToggle.checked = false;
    if (recCreditChoiceRow) recCreditChoiceRow.classList.remove('is-active');
    if (giftcardRedeemInput) giftcardRedeemInput.value = '';
    if (fidelityChoiceInput) fidelityChoiceInput.value = '';
    if (fidelityGiftIdxInput) fidelityGiftIdxInput.value = '';
  }

  if (recGiftcardList) {
    recGiftcardList.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest ? e.target.closest('[data-giftcard-id], [data-giftcard-clear]') : null;
      if (!btn) return;
      e.preventDefault();
      if (btn.dataset.giftcardClear === '1') {
        if (giftcardRedeemInput) giftcardRedeemInput.value = '';
      } else {
        const id = parseInt(btn.dataset.giftcardId || '0', 10) || 0;
        const item = giftcardPreviewItems().find(x => x.id === id);
        if (item) writeGiftcardRedeem(item, normMoney(btn.dataset.giftcardAmount || item.balance || 0));
      }
      fidelityPreviewKey = '';
      updateSummary();
      updateRecap();
    });
  }

  function getClientInfoForFidelity(){
    const fn = (document.getElementById('first_name')?.value || '').trim();
    const ln = (document.getElementById('last_name')?.value || '').trim();
    const email = (document.getElementById('email')?.value || '').trim();
    const phone = (document.getElementById('phone')?.value || '').trim();
    const full_name = (fn + ' ' + ln).trim();
    return { first_name: fn, last_name: ln, full_name, email, phone };
  }



  function computePromotionKey() {
    const ids = Array.from(selectedServices)
      .map(v => parseInt(v, 10))
      .filter(v => Number.isFinite(v) && v > 0)
      .sort((a, b) => a - b)
      .join(',');

    const ci = getClientInfoForFidelity();
    const fullName = `${ci.first_name || ''} ${ci.last_name || ''}`.trim();
    const preferred = (promotionIdInput?.value || '').trim();
    const locationId = (locationIdInput?.value || document.getElementById('locationSelect')?.value || '');

    return JSON.stringify({
      ids,
      date: selectedDate || '',
      time: selectedTime || '',
      locationId,
      fullName,
      email: ci.email || '',
      phone: ci.phone || '',
      preferred,
      coupon: (appliedCoupon?.code || ''),
    });
  }

  async function refreshPromotionPreviewIfNeeded(force = false) {
    // Se è attivo un coupon, mantieni l'eventuale promo già associata dal backend/API
    // solo quando il coupon la sta cumulando esplicitamente.
    if (appliedCoupon && appliedCoupon.code) {
      promotionPreviewReqId++;
      promotionPreviewLoading = false;
      promotionPreviewPromise = null;
      const stackedPromotionId = (appliedCoupon && appliedCoupon.promotion_id != null)
        ? (parseInt(String(appliedCoupon.promotion_id), 10) || 0)
        : 0;
      if (stackedPromotionId > 0) {
        if (promotionIdInput) promotionIdInput.value = String(stackedPromotionId);
      } else {
        if (appliedPromotion) appliedPromotion = null;
        if (promotionIdInput) promotionIdInput.value = '';
      }
      return;
    }

    const idsArr = Array.from(selectedServices)
      .map(v => parseInt(v, 10))
      .filter(v => Number.isFinite(v) && v > 0)
      .sort((a, b) => a - b);
    const ids = idsArr.join(',');

    // Need at least services + date (time optional; time-dependent promos won't apply)
    if (!ids || !selectedDate) {
      promotionPreviewReqId++;
      promotionPreviewLoading = false;
      promotionPreviewPromise = null;
      if (appliedPromotion) {
        appliedPromotion = null;
        if (promotionIdInput) promotionIdInput.value = '';
      }
      return;
    }

    const key = computePromotionKey();
    if (!force && promotionPreviewKey === key) {
      if (promotionPreviewLoading && promotionPreviewPromise) return promotionPreviewPromise;
      return;
    }
    promotionPreviewKey = key;

    const reqId = ++promotionPreviewReqId;
    promotionPreviewLoading = true;

    promotionPreviewPromise = (async () => {
      try {
      const ci = getClientInfoForFidelity();
      const fullName = `${ci.first_name || ''} ${ci.last_name || ''}`.trim();

      // IMPORTANT:
      // Use the fixed public booking endpoint for API calls.
      // Using window.location.href can break when the booking UI is opened via
      // a rewritten URL / embedded URL that doesn't carry all required params.
      const url = new URL(BOOKING_API_BASE);
      url.searchParams.set('mode', 'promotion_preview');
      url.searchParams.set('service_ids', ids);
      url.searchParams.set('date', String(selectedDate || ''));
      if (selectedTime) url.searchParams.set('time', String(selectedTime));
      const locId = (locationIdInput?.value || document.getElementById('locationSelect')?.value || '');
      if (locId) url.searchParams.set('location_id', locId);

      const preferred = (promotionIdInput?.value || '').trim();
      if (preferred) url.searchParams.set('promotion_id', preferred);

      if (fullName) url.searchParams.set('full_name', fullName);
      if (ci.email) url.searchParams.set('email', ci.email);
      if (ci.phone) url.searchParams.set('phone', ci.phone);

      const resp = await fetch(url.toString(), { headers: { 'Accept': 'application/json' }, cache: 'no-store' });
      const ct = resp.headers.get('content-type') || '';
      if (!ct.includes('application/json')) throw new Error('Invalid response');
      const data = await resp.json();

      if (reqId !== promotionPreviewReqId) return;

      const eligible = !!(data && data.ok && data.eligible);
      const discount = eligible ? (parseFloat(data.discount) || 0) : 0;
      const pid = eligible ? (parseInt(data.promotion_id, 10) || 0) : 0;

      if (eligible && pid > 0 && discount > 0) {
        appliedPromotion = {
          id: pid,
          title: String(data.title || ''),
          discount,
          discount_type: String(data.discount_type || 'percent'),
          discount_value: parseFloat(data.discount_value) || 0,
          breakdown: (data && typeof data.breakdown === 'object') ? data.breakdown : null,
          promo_conditions: (data && data.promo_conditions_enabled && String(data.promo_conditions || '').trim() !== '') ? String(data.promo_conditions) : '',
        };
        if (promotionIdInput) promotionIdInput.value = String(pid);
      } else {
        appliedPromotion = null;
        if (promotionIdInput) promotionIdInput.value = '';
      }
      } catch (e) {
        // Fail-safe: no promotions applied on errors
        appliedPromotion = null;
        promotionPreviewKey = '';
        if (promotionIdInput) promotionIdInput.value = '';
      } finally {
        if (reqId === promotionPreviewReqId) {
          promotionPreviewLoading = false;
          promotionPreviewPromise = null;
          // re-render prices/summary
          updateSummary();
        }
      }
    })();

    return promotionPreviewPromise;
  }

function computeFidelityKey(){
    const svcIds = getOrderedSelectedServiceIds().join(',');
    const code = (appliedCoupon && appliedCoupon.code) ? String(appliedCoupon.code) : '';
    const date = selectedDate ? String(selectedDate) : '';
    const promoId = (promotionIdInput && promotionIdInput.value) ? String(promotionIdInput.value) : '';
    const time = selectedTime ? String(selectedTime) : '';
    const locationId = (locationIdInput?.value || document.getElementById('locationSelect')?.value || '');
    const c = getClientInfoForFidelity();
    const creditToggle = (recCreditUseToggle && recCreditUseToggle.checked) ? '1' : '0';
    const creditUse = creditUseInput ? String(normMoney(creditUseInput.value || 0).toFixed(2)) : '0.00';
    const giftcardUse = giftcardSelectedAmount().toFixed(2);
    const giftcardId = String(currentGiftcardId() || 0);
    return [svcIds, code, promoId, date, time, locationId, c.full_name, c.email, c.phone, creditToggle, creditUse, giftcardId, giftcardUse].join('|');
  }

  async function refreshFidelityPreviewIfNeeded(force = false){
    // Se la funzione non è attiva, azzera e basta
    if (!BENEFITS_PREVIEW_ENABLED) {
      fidelityPreview = emptyFidelityPreview(false);
      if (fidelityPointsUseInput) fidelityPointsUseInput.value = '0';
      return;
    }

    if (hasResidualSelected()) {
      fidelityPreview = emptyFidelityPreview(FIDELITY_ENABLED);
      if (fidelityPointsUseInput) fidelityPointsUseInput.value = '0';
      if (discountModeInput) discountModeInput.value = 'none';
      return;
    }

    const svcIds = getOrderedSelectedServiceIds().join(',');
    if (!svcIds) {
      fidelityPreview = emptyFidelityPreview(FIDELITY_ENABLED);
      if (fidelityPointsUseInput) fidelityPointsUseInput.value = '0';
      return;
    }

    const key = computeFidelityKey();
    if (!force && key === fidelityPreviewKey) return;
    fidelityPreviewKey = key;

    if (fidelityPreviewLoading) {
      return new Promise(resolve => {
        const started = Date.now();
        const tick = () => {
          if (!fidelityPreviewLoading || (Date.now() - started) > 2500) { resolve(); return; }
          window.setTimeout(tick, 50);
        };
        tick();
      });
    }
    fidelityPreviewLoading = true;

    try {
      const c = getClientInfoForFidelity();
      const url = new URL(BOOKING_API_BASE);
      url.searchParams.set('mode', 'fidelity_preview');
      url.searchParams.set('service_ids', svcIds);

      const code = (appliedCoupon && appliedCoupon.code) ? String(appliedCoupon.code) : '';
      if (code) url.searchParams.set('coupon_code', code);
      const pid = (promotionIdInput && promotionIdInput.value) ? String(promotionIdInput.value) : '';
      if (pid) url.searchParams.set('promotion_id', pid);
      if (selectedDate) url.searchParams.set('date', String(selectedDate));
      if (selectedTime) url.searchParams.set('time', String(selectedTime));
      const locId = (locationIdInput?.value || document.getElementById('locationSelect')?.value || '');
      if (locId) url.searchParams.set('location_id', locId);

      if (c.first_name) url.searchParams.set('first_name', c.first_name);
      if (c.last_name) url.searchParams.set('last_name', c.last_name);
      if (c.email) url.searchParams.set('email', c.email);
      if (c.phone) url.searchParams.set('phone', c.phone);

      try {
        const creditToggle = !!(recCreditUseToggle && recCreditUseToggle.checked);
        const creditUse = creditUseInput ? normMoney(creditUseInput.value || 0) : 0;
        if (creditToggle) url.searchParams.set('credit_use', creditUse.toFixed(2));
      } catch (e) {}
      try {
        const giftcardUse = giftcardSelectedAmount();
        if (giftcardUse > 0.00001) url.searchParams.set('giftcard_use', giftcardUse.toFixed(2));
      } catch (e) {}

      const res = await fetch(url.toString(), { headers: { 'Accept': 'application/json' } });
      const ct = (res.headers.get('content-type') || '');
      if (!ct.includes('application/json')) throw new Error('Non-JSON response');
      const data = await res.json();

      if (data && data.ok) {
        fidelityPreview = data;
        if (!fidelityPreview.label) fidelityPreview.label = FIDELITY_LABEL;
        if (!fidelityPreview.credit) fidelityPreview.credit = emptyFidelityPreview(FIDELITY_ENABLED).credit;
        if (!fidelityPreview.giftcards) fidelityPreview.giftcards = emptyFidelityPreview(FIDELITY_ENABLED).giftcards;
      } else {
        fidelityPreview = emptyFidelityPreview(FIDELITY_ENABLED);
      }
    } catch (e) {
      fidelityPreview = emptyFidelityPreview(FIDELITY_ENABLED);
    } finally {
      fidelityPreviewLoading = false;

      // Il valore fidelity_points_use viene sincronizzato da updateSummary/updateRecap
      // in base alla scelta esplicita dell'utente.

      // Forza re-render dei dettagli costi (quando arrivano i dati)
      updateSummary();
    }
  }


  // Build REC_MAP from rows
  const REC_MAP = new Map(); // service_id -> [{id, sort_order}]
  if (Array.isArray(REC_ROWS)) {
    REC_ROWS.forEach(r => {
      const sid = String(r.service_id || '');
      const rid = String(r.recommended_service_id || '');
      const so = parseInt(r.sort_order || '0', 10) || 0;
      if (!sid || !rid) return;
      if (!REC_MAP.has(sid)) REC_MAP.set(sid, []);
      REC_MAP.get(sid).push({ id: rid, sort_order: so });
    });
    // stable sort per service
    REC_MAP.forEach((arr, sid) => {
      arr.sort((a,b) => (a.sort_order - b.sort_order) || (a.id.localeCompare(b.id)));
    });
  }

  function serviceCardById(id){
    const key = String(id || '');
    return serviceCards.find(x => x.dataset.id === key) || null;
  }

  // Deterministic ordering for selected services.
  // IMPORTANT: segment-based availability depends on service order.
  // We use the catalog visual order (DOM order) rather than click order.
  function getOrderedSelectedServiceIds(){
    // Segment-based availability depends on service order.
    // We preserve the CUSTOMER selection order (click order) to keep the booking
    // sequence consistent with what the customer picked.
    const out = [];

    // 1) selection order
    (Array.isArray(selectedServiceOrder) ? selectedServiceOrder : []).forEach(id => {
      const key = String(id || '');
      if (!key) return;
      if (!selectedServices.has(key)) return;
      if (!out.includes(key)) out.push(key);
    });

    // 2) fallback: any remaining ids in the set
    selectedServices.forEach(id => {
      const key = String(id || '');
      if (key && !out.includes(key)) out.push(key);
    });

    return out;
  }

  function computeRecommendedIds(){
    const candidates = new Map(); // rid -> bestSort
    for (const sid of selectedServices) {
      const recs = REC_MAP.get(String(sid)) || [];
      recs.forEach(r => {
        const rid = String(r.id);
        if (!rid) return;
        if (selectedServices.has(rid)) return; // already chosen
        if (rid === String(sid)) return; // self
        const prev = candidates.get(rid);
        if (prev === undefined || r.sort_order < prev) candidates.set(rid, r.sort_order);
      });
    }
    const out = Array.from(candidates.entries()).map(([rid, so]) => ({ rid, so }));
    out.sort((a,b) => (a.so - b.so) || (getServiceName(a.rid).localeCompare(getServiceName(b.rid))));
    return out.map(x => x.rid);
  }

  function getServiceName(id){
    const el = serviceCardById(id);
    if (!el) return '';
    const n = el.querySelector('.fw-semibold');
    return n ? n.textContent.trim() : '';
  }

  function renderRecommended(){
    if (!recommendedBox || !recommendedList) return;
    const recIds = computeRecommendedIds();
    if (!recIds.length) {
      recommendedBox.classList.add('d-none');
      recommendedList.innerHTML = '';
      return;
    }

    recommendedList.innerHTML = '';
    recIds.slice(0, 12).forEach(rid => {
      const src = serviceCardById(rid);
      if (!src) return;
      const name = src.querySelector('.fw-semibold')?.textContent?.trim() || 'Servizio';
      const dur = parseInt(src.dataset.dur || '0', 10) || 0;
      const price = parseFloat(src.dataset.price || '0') || 0;

      const card = document.createElement('div');
      card.className = 'list-card recommended-card';
      card.dataset.id = String(rid);
      card.innerHTML = `
        <div class="service-line">
          <div class="service-meta">
            <span class="checkbox" aria-hidden="true"></span>
            <div class="service-copy">
              <div class="fw-semibold">${escapeHtml(name)}</div>
              <div class="small text-muted">${dur} min</div>
            </div>
          </div>
          <div class="d-flex align-items-center gap-3">
            <div class="service-price">${euro(price)}</div>
            <div class="service-card__action" aria-hidden="true">+</div>
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        toggleServiceSelection(String(rid));
      });

      recommendedList.appendChild(card);
    });

    // reflect active state
    recommendedList.querySelectorAll('.recommended-card').forEach(el => {
      el.classList.toggle('active', selectedServices.has(String(el.dataset.id)));
    });

    recommendedBox.classList.remove('d-none');
  }

  function toggleServiceSelection(id){
    if (unresolvedResidualRequested()) {
      showStep(1);
      return;
    }
    const key = String(id || '');
    if (!key) return;
    const lockedResidualId = residualServiceId();
    if (lockedResidualId && key !== lockedResidualId) {
      syncResidualInputs();
      return;
    }
    const card = serviceCardById(key);
    const isOn = selectedServices.has(key);
    if (isOn && residualLabelForService(key)) {
      if (card) card.classList.add('active');
      syncResidualInputs();
      return;
    }
    if (isOn) {
      selectedServices.delete(key);
      // keep the explicit selection order in sync
      if (Array.isArray(selectedServiceOrder)) {
        selectedServiceOrder = selectedServiceOrder.filter(x => String(x) !== String(key));
      }
      if (selectedStaffByService && selectedStaffByService[key]) {
        delete selectedStaffByService[key];
      }
      if (card) card.classList.remove('active');
    } else {
      selectedServices.add(key);
      if (Array.isArray(selectedServiceOrder) && !selectedServiceOrder.map(String).includes(String(key))) {
        selectedServiceOrder.push(String(key));
      }
      if (card) card.classList.add('active');
    }
    serviceIdsInput.value = getOrderedSelectedServiceIds().join(',');
    syncResidualInputs();
	    syncStaffMapInput();

    // Refresh eligible staff cache so the recap can show the correct operator(s)
    // for the selected service(s) even before the date/time step.
    scheduleStaffRefresh();

    // If the user already picked a date/time, changing services invalidates that selection.
    if (selectedDate || selectedTime) resetDateTimeSelection();

    if (appliedCoupon) { clearCouponState(true); setCouponMessage('Coupon da riapplicare (servizi modificati).','muted'); }
    validateStep();
    renderRecommended();
    updateSummary();
    // Aggiorna lo stato dei pulsanti "Applica" nelle promozioni
    try { renderPromotions(promotionsItems); } catch (e) {}
  }

  function euro(n){
    try { return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(n); }
    catch(e){ return '€ ' + (Math.round(n*100)/100).toFixed(2); }
  }

  // Formattazione "€" prima del numero (coerente con le card servizi)
  const _nfMoneyIt = (() => {
    try { return new Intl.NumberFormat('it-IT', {minimumFractionDigits:2, maximumFractionDigits:2}); }
    catch(e){ return null; }
  })();

  function euroCard(n){
    const v = (typeof n === 'string') ? parseFloat(n.replace(',', '.')) : (Number(n) || 0);
    if (_nfMoneyIt) return '€ ' + _nfMoneyIt.format(v);
    return '€ ' + (Math.round(v*100)/100).toFixed(2).replace('.', ',');
  }

  function wholePts(n){
    const v = (typeof n === 'string') ? parseFloat(n.replace(',', '.')) : (Number(n) || 0);
    if (!Number.isFinite(v)) return 0;
    if (v > 0) return Math.floor(v + 1e-9);
    if (v < 0) return Math.ceil(v - 1e-9);
    return 0;
  }

  function fmtPtsValue(n){
    return String(wholePts(n));
  }

  function toCents(n){
    const v = (typeof n === 'string') ? parseFloat(n.replace(',', '.')) : (Number(n) || 0);
    if (!Number.isFinite(v)) return 0;
    return Math.round(v * 100);
  }

  function fromCents(c){
    const v = Number(c) || 0;
    return v / 100;
  }

  function fmtPercentLabel(p){
    const v = Number(p) || 0;
    const rounded = Math.round(v * 100) / 100;
    const s = String(rounded).includes('.') ? String(rounded).replace(/\.0+$/, '').replace(/\.(\d*?)0+$/, '.$1') : String(rounded);
    return '-' + s + '%';
  }

  /**
   * Best-effort: calcola prezzo scontato per singolo servizio per visualizzazione.
   * Ritorna una mappa id-> { old, now, discount, badge }
   */
  function computeCouponBreakdown(svcs, coupon){
    const out = new Map();
    const items = Array.isArray(svcs) ? svcs : [];
    // default: no discount
    for(const s of items){
      const id = String(s.id || '');
      const pr = Number(s.price) || 0;
      out.set(id, { old: pr, now: pr, discount: 0, badge: '' });
    }
    const isPromo = !!coupon && (!!coupon.is_promotion || !!coupon.promotion_id);
    if(!coupon || (!coupon.code && !isPromo)) return out;

    // Se il backend fornisce un breakdown preciso, usalo e stop.
    if(coupon && coupon.breakdown && typeof coupon.breakdown === 'object'){
      try {
        for(const s of items){
          const id = String(s.id || '');
          const b = coupon.breakdown[id];
          if(!b) continue;
          const oldP = Number(b.old);
          const nowP = Number(b.now);
          if(!Number.isFinite(oldP) || !Number.isFinite(nowP)) continue;
          const discP = Number(b.discount);
          const badge = (b.badge != null) ? String(b.badge) : '';
          out.set(id, {
            old: oldP,
            now: nowP,
            discount: Number.isFinite(discP) ? discP : Math.max(0, oldP - nowP),
            badge: badge,
          });
        }
      } catch(_){ /* ignore */ }
      return out;
    }

    const subtotalCents = items.reduce((a,s)=> a + toCents(s.price || 0), 0);
    let discTotalCents = toCents(coupon.discount || 0);
    if(discTotalCents <= 0 || subtotalCents <= 0) return out;
    if(discTotalCents > subtotalCents) discTotalCents = subtotalCents;

    const dtype = String(coupon.discount_type || '').toLowerCase().trim();
    const dval = Number(coupon.discount_value || 0) || 0;
    // (fallback best-effort) per coupon classici / promo senza breakdown

    const priceCents = items.map(s => toCents(s.price || 0));
    const discCents = new Array(items.length).fill(0);

    const allocProportional = (idxs, total) => {
      const sub = idxs.reduce((a,i)=> a + priceCents[i], 0);
      if(sub <= 0 || total <= 0) return;

      // floor allocation
      const fracs = [];
      let used = 0;
      for(const i of idxs){
        const num = total * priceCents[i];
        const base = Math.floor(num / sub);
        discCents[i] = base;
        used += base;
        fracs.push({ i, frac: num % sub });
      }
      let rem = total - used;

      // distribute remaining cents by highest fractional remainder
      fracs.sort((a,b)=> b.frac - a.frac);
      let safety = 0;
      while(rem > 0 && safety < 10000){
        safety++;
        let progressed = false;
        for(const f of fracs){
          if(rem <= 0) break;
          const i = f.i;
          if(discCents[i] < priceCents[i]){
            discCents[i] += 1;
            rem -= 1;
            progressed = true;
          }
        }
        if(!progressed) break;
      }
    };

    if(dtype === 'percent' && dval > 0.000001){
      const percent = Math.min(100, Math.max(0, dval));
      // prova a dedurre su quante righe si applica lo sconto (es. promo con qty limitata)
      const baseTarget = Math.round((discTotalCents * 100) / percent);
      const sorted = priceCents.map((p,i)=>({i,p})).sort((a,b)=> b.p - a.p);
      let cum = 0;
      let bestN = sorted.length;
      let bestDiff = Infinity;
      for(let n=1; n<=sorted.length; n++){
        cum += sorted[n-1].p;
        const diff = Math.abs(cum - baseTarget);
        if(diff < bestDiff){ bestDiff = diff; bestN = n; }
      }
      const idxs = sorted.slice(0, bestN).map(x=>x.i);

      // percent allocation with rounding control
      let used = 0;
      const fracs = [];
      for(const i of idxs){
        const num = priceCents[i] * percent;
        const base = Math.floor(num / 100);
        discCents[i] = base;
        used += base;
        fracs.push({ i, frac: num % 100 });
      }
      let rem = discTotalCents - used;
      fracs.sort((a,b)=> b.frac - a.frac);
      let safety = 0;
      while(rem > 0 && safety < 10000){
        safety++;
        let progressed = false;
        for(const f of fracs){
          if(rem <= 0) break;
          const i = f.i;
          if(discCents[i] < priceCents[i]){
            discCents[i] += 1;
            rem -= 1;
            progressed = true;
          }
        }
        if(!progressed) break;
      }
    } else {
      // fixed (o percent senza valore):
      if(isPromo && dtype === 'fixed' && dval > 0.000001){
        const perUnit = toCents(dval);
        if(perUnit > 0){
          const n = Math.round(discTotalCents / perUnit);
          const isMultiple = (Math.abs(discTotalCents - (n * perUnit)) <= 0);
          if(isMultiple && n >= 1){
            const sorted = priceCents.map((p,i)=>({i,p})).sort((a,b)=> b.p - a.p);
            const idxs = sorted.slice(0, Math.min(n, sorted.length)).map(x=>x.i);
            let used = 0;
            for(const i of idxs){
              const amt = Math.min(perUnit, priceCents[i]);
              discCents[i] = amt;
              used += amt;
            }
            const rem = discTotalCents - used;
            if(rem > 0){
              // se rimane qualcosa (caso raro), ridistribuisci proporzionalmente sui discountati
              allocProportional(idxs, rem);
            }
          } else {
            // fallback
            allocProportional(items.map((_,i)=>i), discTotalCents);
          }
        } else {
          allocProportional(items.map((_,i)=>i), discTotalCents);
        }
      } else {
        allocProportional(items.map((_,i)=>i), discTotalCents);
      }
    }

    // write back
    for(let idx=0; idx<items.length; idx++){
      const s = items[idx];
      const id = String(s.id || '');
      const oldC = priceCents[idx];
      const dC = Math.max(0, Math.min(oldC, discCents[idx] || 0));
      const nowC = Math.max(0, oldC - dC);

      let badge = '';
      if(dC > 0){
        if(dtype === 'percent' && dval > 0.000001) badge = fmtPercentLabel(dval);
        else badge = '-' + euroCard(fromCents(dC));
      }

      out.set(id, {
        old: fromCents(oldC),
        now: fromCents(nowC),
        discount: fromCents(dC),
        badge: badge,
      });
    }

    return out;
  }

  function renderPriceHtml(oldPrice, newPrice, badgeText, fmtFn, detailText){
    const fmt = (typeof fmtFn === 'function') ? fmtFn : euro;
    const hasBadge = !!(badgeText && String(badgeText).trim() !== '');
    const detail = detailText ? String(detailText).trim() : '';
    const detailHtml = detail ? `<div class="service-promo-detail">${escapeHtml(detail)}</div>` : '';
    if (hasBadge) {
      const promoClass = detail ? ' discount-badge--promo' : '';
      return `<div class="price-row"><span class="price-old">${escapeHtml(fmt(oldPrice))}</span><span class="discount-badge${promoClass}">${escapeHtml(String(badgeText))}</span></div><div class="price-now">${escapeHtml(fmt(newPrice))}</div>${detailHtml}`;
    }
    return `<div class="price-now">${escapeHtml(fmt(newPrice))}</div>${detailHtml}`;
  }

  function catalogPromotionForService(id){
    const key = String(id || '');
    if (!key || !serviceCatalogPromotions || typeof serviceCatalogPromotions !== 'object') return null;
    const promo = serviceCatalogPromotions[key];
    return (promo && typeof promo === 'object') ? promo : null;
  }

  function catalogPromotionPriceBreakdown(id){
    const promo = catalogPromotionForService(id);
    if (!promo) return null;

    const mode = String(promo.display_mode || '').trim();
    const oldPrice = Number(promo.old_price);
    const newPrice = Number(promo.new_price);
    if (mode !== 'discounted_price' || !Number.isFinite(oldPrice) || !Number.isFinite(newPrice) || oldPrice <= newPrice) {
      return null;
    }

    const badge = String(promo.discount_label || '').trim();
    const title = String(promo.badge_title || 'Promo').trim();
    const detail = String(promo.badge_detail || '').trim();
    return {
      old: oldPrice,
      now: newPrice,
      discount: Math.max(0, oldPrice - newPrice),
      badge: title || 'Promo',
      detail: detail || badge || ''
    };
  }

  function renderCatalogPromotionNote(id){
    const promo = catalogPromotionForService(id);
    if (!promo) return '';

    const title = String(promo.badge_title || 'Promo').trim();
    const detail = String(promo.badge_detail || '').trim();
    if (!title && !detail) return '';

    return `<div class="service-promo-note">${title ? `<span class="service-promo-note__title">${escapeHtml(title)}</span>` : ''}${detail ? `<span class="service-promo-note__detail">${escapeHtml(detail)}</span>` : ''}</div>`;
  }

  function appliedPromotionCatalogMeta(id){
    if (appliedCoupon && appliedCoupon.code) return null;
    const activePromotionId = appliedPromotion && appliedPromotion.id ? (parseInt(String(appliedPromotion.id), 10) || 0) : 0;
    if (activePromotionId <= 0) return null;

    const promo = catalogPromotionForService(id);
    const catalogPromotionId = promo && promo.promotion_id ? (parseInt(String(promo.promotion_id), 10) || 0) : 0;
    if (!promo || catalogPromotionId !== activePromotionId) return null;

    const detail = String(promo.badge_detail || '').trim();
    if (!detail) return null;
    return promo;
  }

  function canUseCatalogPromotionFallback(){
    return !selectedDate && !selectedTime;
  }

  function updateServiceCardsPrices(breakdown){
    try {
      const bd = breakdown || new Map();
      // Lista servizi (step 3)
      serviceCards.forEach(card => {
        const id = String(card.dataset.id || '');
        const priceEl = card.querySelector('.service-price');
        if (!priceEl) return;
        const base = parseFloat(card.dataset.price || '0') || 0;
        const isSelected = selectedServices.has(id);
        const b = isSelected ? bd.get(id) : null;
        const residualLabel = isSelected ? residualLabelForService(id) : '';
        const hasDisc = !!(b && (Number(b.discount) || 0) > 0.00001);
        const catalogBreakdown = canUseCatalogPromotionFallback() ? catalogPromotionPriceBreakdown(id) : null;
        if (residualLabel) {
          priceEl.innerHTML = renderPriceHtml(base, 0, residualLabel, euroCard);
        }
        else if (hasDisc) {
          const appliedCatalog = appliedPromotionCatalogMeta(id);
          const appliedBadge = appliedCatalog ? String(appliedCatalog.badge_title || 'Promo').trim() : String(b.badge || '').trim();
          const appliedDetail = appliedCatalog ? String(appliedCatalog.badge_detail || '').trim() : '';
          priceEl.innerHTML = renderPriceHtml(b.old, b.now, appliedBadge || b.badge, euroCard, appliedDetail);
        }
        else if (catalogBreakdown) priceEl.innerHTML = renderPriceHtml(catalogBreakdown.old, catalogBreakdown.now, catalogBreakdown.badge, euroCard, catalogBreakdown.detail);
        else priceEl.innerHTML = renderPriceHtml(base, base, '', euroCard) + (canUseCatalogPromotionFallback() ? renderCatalogPromotionNote(id) : '');
      });

      // Lista consigliati - best effort
      if (recommendedList) {
        recommendedList.querySelectorAll('.recommended-card').forEach(card => {
          const id = String(card.dataset.id || '');
          const priceEl = card.querySelector('.service-price');
          if (!priceEl) return;
          const src = serviceCardById(id);
          const base = src ? (parseFloat(src.dataset.price || '0') || 0) : 0;
          const isSelected = selectedServices.has(id);
          const b = isSelected ? bd.get(id) : null;
          const residualLabel = isSelected ? residualLabelForService(id) : '';
          const hasDisc = !!(b && (Number(b.discount) || 0) > 0.00001);
          const catalogBreakdown = canUseCatalogPromotionFallback() ? catalogPromotionPriceBreakdown(id) : null;
          if (residualLabel) {
            priceEl.innerHTML = renderPriceHtml(base, 0, residualLabel, euroCard);
          }
          else if (hasDisc) {
            const appliedCatalog = appliedPromotionCatalogMeta(id);
            const appliedBadge = appliedCatalog ? String(appliedCatalog.badge_title || 'Promo').trim() : String(b.badge || '').trim();
            const appliedDetail = appliedCatalog ? String(appliedCatalog.badge_detail || '').trim() : '';
            priceEl.innerHTML = renderPriceHtml(b.old, b.now, appliedBadge || b.badge, euroCard, appliedDetail);
          }
          else if (catalogBreakdown) priceEl.innerHTML = renderPriceHtml(catalogBreakdown.old, catalogBreakdown.now, catalogBreakdown.badge, euroCard, catalogBreakdown.detail);
          else priceEl.innerHTML = renderPriceHtml(base, base, '', euroCard) + (canUseCatalogPromotionFallback() ? renderCatalogPromotionNote(id) : '');
        });
      }
    } catch(_){ }
  }

  function normalizeCouponCode(code){
    return String(code || '').toUpperCase().replace(/\s+/g,'');
  }

  function setCouponMessage(msg, kind){
    if (!couponMsg) return;
    couponMsg.textContent = msg || '';
    const cls = (kind==='success') ? 'text-success' : (kind==='danger') ? 'text-danger' : 'text-muted';
    couponMsg.className = 'small mt-1 ' + cls;
  }

  function clearCouponState(keepInput=false){
    appliedCoupon = null;
    if (couponCodeInput) couponCodeInput.value = '';
    if (promotionIdInput) promotionIdInput.value = '';
    if (couponInput) couponInput.readOnly = false;
    if (!keepInput && couponInput) couponInput.value = '';
  }

  async function applyCoupon(options){
    if (!couponInput) return;
    options = options || {};
    const silent = !!options.silent;

    let code = '';
    if (options.code) code = normalizeCouponCode(String(options.code));
    else code = normalizeCouponCode(couponInput.value);

    // Per applicazione manuale normalizza il valore visibile; per auto (silent) lascia l'input com'è.
    if (!options.code || !silent) {
      couponInput.value = code;
    }

    if (!code) {
      clearCouponState(true);
      if (!silent) setCouponMessage('Inserisci un codice coupon.', 'danger');
      updateSummary();
      return;
    }

    const currentAppliedCode = normalizeCouponCode((couponCodeInput && couponCodeInput.value) ? couponCodeInput.value : ((appliedCoupon && appliedCoupon.code) ? appliedCoupon.code : ''));
    if (currentAppliedCode && currentAppliedCode !== code) {
      if (couponInput) couponInput.value = currentAppliedCode;
      if (!silent) setCouponMessage('Puoi applicare un solo coupon per prenotazione. Rimuovi quello attuale prima di inserirne un altro.', 'danger');
      updateSummary();
      return;
    }
    if (!serviceIdsInput.value) {
      clearCouponState(true);
      if (!silent) setCouponMessage('Seleziona almeno un servizio.', 'danger');
      updateSummary();
      return;
    }
    if (!selectedDate) {
      clearCouponState(true);
      if (!silent) setCouponMessage('Seleziona prima una data per l\'appuntamento.', 'danger');
      updateSummary();
      return;
    }

    // Per promozioni con vincoli su giorni/orari è meglio validare con orario selezionato.
    if (!selectedTime) {
      clearCouponState(true);
      if (!silent) setCouponMessage('Seleziona prima un orario per l\'appuntamento.', 'danger');
      updateSummary();
      return;
    }

    if (!silent) setCouponMessage('Verifica coupon…', 'muted');

    try {
      const url = new URL(BOOKING_API_BASE);
      url.searchParams.set('mode','coupon');
      url.searchParams.set('code', code);
      url.searchParams.set('service_ids', serviceIdsInput.value || '');
      url.searchParams.set('date', selectedDate || '');
      if (selectedTime) url.searchParams.set('time', String(selectedTime));
      const locId = (locationIdInput?.value || document.getElementById('locationSelect')?.value || '');
      if (locId) url.searchParams.set('location_id', locId);

      // Mantieni il contesto completo del booking per una validazione coerente:
      // cliente, promo preferita e regole di cumulabilità.
      const ci = getClientInfoForFidelity();
      const fullName = `${ci.first_name || ''} ${ci.last_name || ''}`.trim();
      const preferredPromotionId = (promotionIdInput && promotionIdInput.value) ? String(promotionIdInput.value) : '';
      if (preferredPromotionId) url.searchParams.set('promotion_id', preferredPromotionId);
      if (fullName) url.searchParams.set('full_name', fullName);
      if (ci.email) url.searchParams.set('email', ci.email);
      if (ci.phone) url.searchParams.set('phone', ci.phone);

      const res = await fetch(url.toString(), {headers: {'Accept':'application/json'}});
      const ct = (res.headers.get('content-type') || '');
      if (!ct.includes('application/json')) throw new Error('Non-JSON response');
      const data = await res.json();

      if (data && data.ok) {
        const pid = (data.promotion_id != null && String(data.promotion_id).trim() !== '')
          ? (parseInt(String(data.promotion_id), 10) || null)
          : null;
        appliedCoupon = {
          code: data.code,
          discount: parseFloat(data.discount || 0) || 0,
          subtotal: parseFloat(data.subtotal || 0) || 0,
          total: parseFloat(data.total || 0) || 0,
          description: data.description || '',
          discount_type: String(data.discount_type || '').toLowerCase().trim(),
          discount_value: parseFloat(data.discount_value || 0) || 0,
          coupon_discount: parseFloat(data.coupon_discount || 0) || 0,
          promotion_discount: parseFloat(data.promotion_discount || 0) || 0,
          is_promotion: (data.is_promotion ? 1 : 0),
          promotion_id: pid,
          promotion_title: String(data.promotion_title || ''),
          promo_conditions: (data && data.promo_conditions_enabled && String(data.promo_conditions || '').trim() !== '') ? String(data.promo_conditions) : '',
          stacked_with_coupon: !!(parseInt(String(data.stacked_with_coupon || 0), 10) || 0),
          breakdown: (data && typeof data.breakdown === 'object') ? data.breakdown : null
        };
        if (pid && appliedCoupon.stacked_with_coupon) {
          appliedPromotion = {
            id: pid,
            title: String(data.promotion_title || ''),
            discount: parseFloat(data.promotion_discount || 0) || 0,
            breakdown: null,
            promo_conditions: appliedCoupon.promo_conditions || ''
          };
          if (promotionIdInput) promotionIdInput.value = String(pid);
        } else {
          appliedPromotion = null;
          if (promotionIdInput) promotionIdInput.value = (pid ? String(pid) : '');
        }
        if (couponCodeInput) couponCodeInput.value = data.code;
        if (couponInput) couponInput.readOnly = true;

        const extra = data.description ? (' • ' + data.description) : '';
        if (silent) {
          const msg = String(options.successMessage || 'Promozione applicata automaticamente.').trim();
          setCouponMessage(msg + extra, 'success');
        } else {
          setCouponMessage('Coupon applicato: ' + data.code + extra, 'success');
        }
      } else {
        clearCouponState(true);
        if (!silent) setCouponMessage((data && data.error) ? data.error : 'Coupon non valido.', 'danger');
      }
    } catch(e) {
      clearCouponState(true);
      if (!silent) setCouponMessage('Errore durante la verifica del coupon.', 'danger');
    }

    updateSummary();
    try { renderPromotions(promotionsItems); } catch (e) {}
  }

  function removeCoupon(){
    clearCouponState(false);
    setCouponMessage('Coupon rimosso.', 'muted');
    updateSummary();
    try { renderPromotions(promotionsItems); } catch (e) {}
  }

  // ------------------------------------------------------------
  // Promozioni (best-effort)
  // ------------------------------------------------------------

  function renderPromotions(items){
    promotionsItems = Array.isArray(items) ? items : [];
    if (!promotionsBox || !promotionsList) return;

    if (!promotionsItems.length) {
      promotionsBox.classList.add('d-none');
      promotionsList.innerHTML = '';
      return;
    }

    promotionsBox.classList.remove('d-none');

    const appliedCode = appliedCoupon && appliedCoupon.code ? normalizeCouponCode(appliedCoupon.code) : '';
    const html = promotionsItems.map(p => {
      const title = escapeHtml(String(p.title || '').trim());
      const desc = escapeHtml(String(p.description || '').trim());
      const code = normalizeCouponCode(String(p.coupon_code || '').trim());
      const couponLabel = escapeHtml(String(p.coupon_label || '').trim());
      const couponValid = !!(p.coupon_valid);
      const reason = escapeHtml(String(p.reason || '').trim());
      const autoApply = !!(p.auto_apply);

      const autoHtml = autoApply ? `<span class="badge bg-info ms-1">Auto</span>` : '';

      let btnHtml = '';
      if (!autoApply) {
        if (code && couponValid) {
          if (appliedCode && appliedCode === code) {
            btnHtml = `<button type="button" class="btn btn-sm btn-outline-success" disabled>Applicato</button>`;
          } else {
            btnHtml = `<button type="button" class="btn btn-sm btn-outline-success promoApplyBtn" data-code="${escapeHtml(code)}">Applica</button>`;
          }
        } else if (code && !couponValid) {
          btnHtml = `<button type="button" class="btn btn-sm btn-outline-secondary" disabled>Non disponibile</button>`;
        }
      } else {
        if (code && couponValid && appliedCode && appliedCode === code) {
          btnHtml = `<button type="button" class="btn btn-sm btn-outline-success" disabled>Applicato</button>`;
        } else if (couponValid) {
          btnHtml = `<span class="small text-muted">Si applica automaticamente</span>`;
        }
      }

      return `
        <div class="border rounded-3 p-2 bg-white">
          <div class="d-flex justify-content-between align-items-start gap-2">
            <div class="flex-grow-1">
              <div class="fw-semibold">${title || 'Promozione'}${autoHtml}</div>
              ${desc ? `<div class="small text-muted">${desc}</div>` : ''}
              ${couponLabel ? `<div class="small text-muted mt-1"><i class="bi bi-tag me-1"></i>${couponLabel}</div>` : ''}
              ${(!couponValid && reason) ? `<div class="small text-muted mt-1"><i class="bi bi-info-circle me-1"></i>${reason}</div>` : ''}
            </div>
            <div class="text-end">
              ${btnHtml ? `<div class="mt-2">${btnHtml}</div>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    promotionsList.innerHTML = html;
  }

  async function maybeAutoApplyPromotion(items){
    try {
      // Serve una data e un orario selezionati per validare correttamente (vincoli su giorni/orari).
      if (!selectedDate || !selectedTime) return;

      // Se c'è già un coupon applicato, non sovrascrivere.
      if (appliedCoupon && appliedCoupon.code) return;

      // Se l'utente sta digitando un codice, non auto-applicare.
      if (couponInput && String(couponInput.value || '').trim() !== '') return;

      const list = Array.isArray(items) ? items : [];
      // La lista è già ordinata dal backend per sconto migliore: scegliamo la prima promo auto valida.
      const p = list.find(x => x && x.auto_apply && x.coupon_valid && String(x.coupon_code || '').trim() !== '');
      if (!p) return;

      const code = normalizeCouponCode(String(p.coupon_code || '').trim());
      if (!code) return;

      await applyCoupon({ code: code, silent: true, successMessage: 'Promozione applicata automaticamente.' });
    } catch (e) {
      // ignore (best-effort)
    }
  }

  async function refreshPromotionsIfNeeded(){
    if (!promotionsBox || !promotionsList) return;

    // Serve almeno una data selezionata: le promozioni sono legate alla data appuntamento.
    if (!selectedDate) {
      renderPromotions([]);
      return;
    }

    const svcKey = (serviceIdsInput && serviceIdsInput.value) ? String(serviceIdsInput.value) : '';
    const timeKey = selectedTime ? String(selectedTime) : '';
    const locKey = (locationIdInput?.value || document.getElementById('locationSelect')?.value || '');
    const key = String(selectedDate) + '|' + timeKey + '|' + svcKey + '|' + String(locKey || '');
    if (key === promotionsKey) return;
    promotionsKey = key;

    if (promotionsLoading) return;
    promotionsLoading = true;

    try {
      const url = new URL(BOOKING_API_BASE);
      url.searchParams.set('mode', 'promotions');
      url.searchParams.set('date', String(selectedDate));
      if (selectedTime) url.searchParams.set('time', String(selectedTime));
      if (svcKey) url.searchParams.set('service_ids', svcKey);
      if (locKey) url.searchParams.set('location_id', locKey);

      const res = await fetch(url.toString(), { headers: { 'Accept': 'application/json' } });
      const data = await res.json();

      const items = (data && data.ok && Array.isArray(data.items)) ? data.items : [];
      renderPromotions(items);
      await maybeAutoApplyPromotion(items);
} catch (e) {
      // Best-effort: se qualcosa va storto, nascondi la sezione.
      renderPromotions([]);
    }

    promotionsLoading = false;
  }

  let promotionsTimer = null;
  function schedulePromotionsRefresh(){
    try { if (promotionsTimer) clearTimeout(promotionsTimer); } catch (_) {}
    promotionsTimer = setTimeout(() => {
      refreshPromotionsIfNeeded().catch(() => {});
    }, 250);
  }

  if (promotionsList) {
    promotionsList.addEventListener('click', (ev) => {
      const btn = ev.target && ev.target.closest ? ev.target.closest('.promoApplyBtn') : null;
      if (!btn) return;
      const code = normalizeCouponCode(btn.getAttribute('data-code') || '');
      if (!code) return;

      // Mostra box coupon e applica
      try {
        if (couponBox) couponBox.classList.remove('d-none');
        if (couponInput) couponInput.value = code;
        applyCoupon();
      } catch (e) {}
    });
  }

  function getStaffName(id){
    const key = String(id || '');
    return (STAFF_MAP && STAFF_MAP[key]) ? String(STAFF_MAP[key]).trim() : '—';
  }

  function syncStaffMapInput(){
    if (!staffMapInput) return;
    // Only persist staff_map when we have a complete selection for every selected service.
    // This prevents the slots API from receiving partial maps (which would trigger backend validation errors).
    if (!selectedServices || selectedServices.size === 0) { staffMapInput.value = ''; return; }

    const selIdsArr = getOrderedSelectedServiceIds().map(String);
    const selIds = new Set(selIdsArr);
    const byId = new Map();
    (Array.isArray(lastStaffServices) ? lastStaffServices : []).forEach(svc => {
      const sid = String(svc.service_id || svc.id || '');
      if (sid) byId.set(sid, svc);
    });

    // If we don't yet have staff lists, don't emit a map.
    if (!byId.size) { staffMapInput.value = ''; return; }

    let complete = true;
    const payload = {};

    selIdsArr.forEach(sid => {
      const svc = byId.get(String(sid));
      const staff = svc && Array.isArray(svc.staff) ? svc.staff : [];
      if (!staff.length) { complete = false; return; }
      if (staff.length === 1) {
        const autoId = String(staff[0].id || '');
        if (autoId) {
          selectedStaffByService[String(sid)] = autoId;
          payload[String(sid)] = autoId;
        } else {
          complete = false;
        }
        return;
      }
      const chosen = selectedStaffByService ? String(selectedStaffByService[String(sid)] || '') : '';
      if (!chosen) { complete = false; return; }
      payload[String(sid)] = chosen;
    });

    staffMapInput.value = complete ? JSON.stringify(payload) : '';
  }

  function hasCompleteStaffSelection(){
    if (!CHOOSE_STAFF_ENABLED) return true;
    if (!Array.isArray(lastStaffServices) || !lastStaffServices.length) return false;
    for (const svc of lastStaffServices) {
      const sid = String(svc.service_id || svc.id || '');
      const staff = Array.isArray(svc.staff) ? svc.staff : [];
      if (!staff.length) return false;
      if (staff.length >= 2) {
        if (!sid || !selectedStaffByService || !selectedStaffByService[sid]) return false;
      } else if (staff.length === 1) {
        // auto-assign if not already
        if (sid && (!selectedStaffByService || !selectedStaffByService[sid])) {
          selectedStaffByService[sid] = String(staff[0].id || '');
        }
      }
    }
    syncStaffMapInput();
    return true;
  }

  function getSelectedStaffLabel(){
    // When the "choose staff" step is disabled, we still want the recap to be meaningful:
    // - if a service has exactly one eligible staff -> show that name
    // - if multiple eligible staff -> show "Qualsiasi"
    if (!CHOOSE_STAFF_ENABLED) {
      if (!selectedServices || selectedServices.size === 0) return '—';
      const ids = getOrderedSelectedServiceIds().map(String);
      const byId = new Map();
      (Array.isArray(lastStaffServices) ? lastStaffServices : []).forEach(svc => {
        const sid = String(svc.service_id || svc.id || '');
        if (sid) byId.set(sid, svc);
      });

      // single-service
      if (ids.length === 1) {
        const svc = byId.get(ids[0]);
        const staff = svc && Array.isArray(svc.staff) ? svc.staff : [];
        const chosen = (selectedStaffByService && selectedStaffByService[ids[0]])
          ? String(selectedStaffByService[ids[0]])
          : (staffIdInput ? String(staffIdInput.value || '').trim() : '');
        if (chosen) return getStaffName(chosen);
        if (staff.length === 1) return getStaffName(staff[0].id || '');
        if (staff.length >= 2) return 'Qualsiasi';
        return '—';
      }

      // multi-service: list unique deterministic staff names when available, otherwise "Qualsiasi"
      const names = [];
      let hasUndetermined = false;
      ids.forEach(sid => {
        const svc = byId.get(String(sid));
        const staff = svc && Array.isArray(svc.staff) ? svc.staff : [];
        const chosen = (selectedStaffByService && selectedStaffByService[String(sid)]) ? selectedStaffByService[String(sid)] : '';
        if (chosen) {
          names.push(getStaffName(chosen));
        } else if (staff.length === 1) {
          names.push(getStaffName(staff[0].id || ''));
        } else {
          hasUndetermined = true;
        }
      });
      const uniq = Array.from(new Set(names)).filter(Boolean);
      if (uniq.length) return hasUndetermined ? (uniq.join(', ') + ' …') : uniq.join(', ');
      return 'Qualsiasi';
    }
    if (!selectedServices || selectedServices.size === 0) return '—';
    if (!hasCompleteStaffSelection()) return '—';
    const names = [];
    for (const svcId of getOrderedSelectedServiceIds()) {
      const stid = selectedStaffByService[String(svcId)] || '';
      if (stid) names.push(getStaffName(stid));
    }
    const uniq = Array.from(new Set(names)).filter(Boolean);
    return uniq.length ? uniq.join(', ') : '—';
  }

  function getSelectedStaffDetailsHtml(){
    if (!selectedServices || selectedServices.size <= 1) return '';
    const ids = getOrderedSelectedServiceIds().map(String);
    const byId = new Map();
    (Array.isArray(lastStaffServices) ? lastStaffServices : []).forEach(svc => {
      const sid = String(svc.service_id || svc.id || '');
      if (sid) byId.set(sid, svc);
    });
    if (!byId.size) return '';

    const lines = [];
    ids.forEach(sid => {
      const svc = byId.get(String(sid));
      const svcName = String((svc && (svc.name || '')) || getServiceName(sid) || 'Servizio').trim();
      const staff = svc && Array.isArray(svc.staff) ? svc.staff : [];
      const chosen = (selectedStaffByService && selectedStaffByService[String(sid)]) ? selectedStaffByService[String(sid)] : '';

      let staffLabel = '—';
      if (chosen) staffLabel = getStaffName(chosen);
      else if (staff.length === 1) staffLabel = getStaffName(staff[0].id || '');
      else if (staff.length >= 2) staffLabel = 'Qualsiasi';

      lines.push(`${escapeHtml(svcName)} &rarr; ${escapeHtml(staffLabel)}`);
    });

    return lines.join('<br>');
  }
  function getLocationName(id){
    if (!locationSelect) return (BUSINESS_NAME || '—');
    const opt = locationSelect.querySelector('option[value="'+id+'"]');
    return opt ? opt.textContent.trim() : (BUSINESS_NAME || '—');
  }
  function getLocationAddress(id){
    if (!locationSelect) return (BUSINESS_ADDRESS || '');
    const opt = locationSelect.querySelector('option[value="'+id+'"]');
    return opt ? (opt.dataset.address || '') : (BUSINESS_ADDRESS || '');
  }

  function servicesFromSelection(){
    const out = [];
    for (const id of getOrderedSelectedServiceIds()) {
      const el = serviceCards.find(x => x.dataset.id === String(id));
      if (!el) continue;
      const basePrice = parseFloat(el.dataset.price || '0') || 0;
      const residualLabel = residualLabelForService(id);
      out.push({
        id: id,
        name: el.querySelector('.fw-semibold').textContent.trim(),
        duration: parseInt(el.dataset.dur || '0',10) || 0,
        price: residualLabel ? 0 : basePrice,
        basePrice: basePrice,
        residualLabel: residualLabel
      });
    }
    return out;
  }

  function updateSummary(){
    const lid = locationIdInput.value || (locationSelect ? locationSelect.value : '');
    sumStaff.textContent = getSelectedStaffLabel();
    if (sumStaffDetails) {
      const html = getSelectedStaffDetailsHtml();
      sumStaffDetails.innerHTML = html;
      const row = sumStaffDetails.closest('.summary-row');
      if (row) row.classList.toggle('d-none', !html);
    }
    sumLocation.textContent = getLocationName(lid);

    const svcs = servicesFromSelection();
    const subtotal = svcs.reduce((a,s)=>a+s.price,0);
    if (summarySelectionText) {
      if (!svcs.length) {
        summarySelectionText.textContent = 'Nessun servizio selezionato';
      } else {
        const totalDurSel = svcs.reduce((a,s)=>a + (parseInt(s.duration || 0, 10) || 0), 0);
        const labelSel = svcs.length === 1 ? svcs[0].name : (svcs.length + ' servizi selezionati');
        const metaSel = totalDurSel > 0 ? (' • ' + totalDurSel + ' min') : '';
        summarySelectionText.innerHTML = '<strong>' + escapeHtml(labelSel) + '</strong>' + escapeHtml(metaSel);
      }
    }
    // Auto-promozioni (senza codice): aggiorna preview se cambiano servizi/data/orario/anagrafica
    refreshPromotionPreviewIfNeeded().catch(() => {});

    // Sconto pre-Fidelity: il coupon puo includere anche una promo cumulata.
    let couponDiscount = 0;
    let promoDiscount = 0;
    let activeDiscount = null;

    if (appliedCoupon && appliedCoupon.code) {
      couponDiscount = parseFloat(appliedCoupon.discount || 0) || 0;
      if (couponDiscount < 0) couponDiscount = 0;
      if (couponDiscount > subtotal) couponDiscount = subtotal;
      if (couponDiscount > 0.00001) {
        activeDiscount = Object.assign({}, appliedCoupon, { is_promotion: !!appliedCoupon.is_promotion });
      }
    } else if (appliedPromotion && appliedPromotion.id) {
      promoDiscount = parseFloat(appliedPromotion.discount || 0) || 0;
      if (promoDiscount < 0) promoDiscount = 0;
      if (promoDiscount > subtotal) promoDiscount = subtotal;
      if (promoDiscount > 0.00001) {
        activeDiscount = {
          code: '',
          promotion_id: appliedPromotion.id,
          promotion_title: appliedPromotion.title || '',
          discount: promoDiscount,
          discount_type: appliedPromotion.discount_type || 'percent',
          discount_value: appliedPromotion.discount_value || 0,
          is_promotion: true,
          breakdown: appliedPromotion.breakdown || null,
        };
      }
    }

    const baseAfterCoupon = Math.max(0, subtotal - couponDiscount - promoDiscount);

    // Fidelity (async): aggiorna preview se cambiano servizi/coupon/data/anagrafica
    refreshFidelityPreviewIfNeeded().catch(() => {});

    let fidDiscount = 0;
    let fidPoints = 0;
    let fidLabel = FIDELITY_LABEL;

    // Dati "possibili" (anche quando l'auto-sconto è disattivo)
    let fidAvail = 0;
    let fidPossibleDiscount = 0;
    let fidPossiblePoints = 0;
	    let fidEarnBase = 0;
	    let fidEarnAfter = 0;
    let fidCanRedeem = false;

    // Omaggi / conflitto (calcolati quando abbiamo una preview valida)
    let fidGiftEnabled = false;
    let fidGiftList = [];
    let fidBestGiftNoDiscount = null;
    let fidBestGiftAfterMaxDiscount = null;
    let fidConflict = false;
    const fidConflictPolicy = String(FIDELITY_CONFLICT_POLICY || 'discount');

    if (FIDELITY_ENABLED && fidelityPreview && fidelityPreview.enabled && fidelityPreview.client_found) {
      fidLabel = (fidelityPreview.label || FIDELITY_LABEL);

      fidAvail = wholePts(fidelityPreview.available_points || 0);

      fidPossibleDiscount = parseFloat(fidelityPreview.discount || 0) || 0;
      if (fidPossibleDiscount < 0) fidPossibleDiscount = 0;
      if (fidPossibleDiscount > baseAfterCoupon) fidPossibleDiscount = baseAfterCoupon;

      fidPossiblePoints = wholePts(fidelityPreview.points_used || 0);

      fidCanRedeem = (fidPossiblePoints > 0 && fidPossibleDiscount > 0.00001);

      // Omaggi (lista) + conflitto: esiste sia sconto che gift ma non sono utilizzabili contemporaneamente.
      fidGiftList = getFidelityGiftList(fidelityPreview);
      fidGiftEnabled = !!(parseInt(fidelityPreview.gift_enabled || 0, 10) || 0) && (fidGiftList.length > 0);
      fidBestGiftNoDiscount = fidGiftEnabled ? bestFidelityGiftForRemaining(fidAvail, fidGiftList) : null;
      fidBestGiftAfterMaxDiscount = (fidGiftEnabled && fidCanRedeem)
        ? bestFidelityGiftForRemaining(Math.max(0, (fidAvail || 0) - (fidPossiblePoints || 0)), fidGiftList)
        : null;
      fidConflict = !!(fidCanRedeem && fidBestGiftNoDiscount && !fidBestGiftAfterMaxDiscount);

      // --- Scelta cliente (policy "choice") in caso di conflitto sconto/gift ---
      const showChoiceBox = (fidConflict && fidConflictPolicy === 'choice' && fidCanRedeem && !!fidBestGiftNoDiscount);
      let selectedChoice = '';

      if (recFidelityChoiceBox) {
        recFidelityChoiceBox.classList.toggle('d-none', !showChoiceBox);
      }

      if (showChoiceBox) {
        // Aggiorna labels UI
        if (fidChoiceDiscountLabel) fidChoiceDiscountLabel.textContent = fidLabel || 'Punti';
        if (fidChoiceGiftLabel) fidChoiceGiftLabel.textContent = fidLabel || 'Punti';

        if (fidChoiceDiscountEuro) {
          const txt = euro(fidPossibleDiscount).replace(/€/g,'').trim();
          fidChoiceDiscountEuro.textContent = txt || '0';
        }
        if (fidChoiceDiscountPoints) fidChoiceDiscountPoints.textContent = fmtPtsValue(fidPossiblePoints || 0);

        if (fidChoiceGiftDesc) {
          const d = (fidBestGiftNoDiscount && fidBestGiftNoDiscount.description) ? String(fidBestGiftNoDiscount.description).trim() : '';
          fidChoiceGiftDesc.textContent = d || 'gift';
        }
        if (fidChoiceGiftPoints) fidChoiceGiftPoints.textContent = fmtPtsValue((fidBestGiftNoDiscount && fidBestGiftNoDiscount.min_points) ? fidBestGiftNoDiscount.min_points : 0);

        // Default e sync col hidden input
        selectedChoice = (fidelityChoiceInput ? String(fidelityChoiceInput.value || '').trim() : '');
        if (!['discount','gift','later'].includes(selectedChoice)) selectedChoice = 'later';
        if (fidelityChoiceInput) fidelityChoiceInput.value = selectedChoice;

        // Sync radio
        if (fidChoiceLater) fidChoiceLater.checked = (selectedChoice === 'later');
        if (fidChoiceDiscount) fidChoiceDiscount.checked = (selectedChoice === 'discount');
        if (fidChoiceGift) fidChoiceGift.checked = (selectedChoice === 'gift');

        // Gift idx (solo se scelto)
        if (fidelityGiftIdxInput) {
          if (selectedChoice === 'gift' && fidBestGiftNoDiscount && fidBestGiftNoDiscount.idx !== undefined && fidBestGiftNoDiscount.idx !== null) {
            fidelityGiftIdxInput.value = String(fidBestGiftNoDiscount.idx);
          } else {
            fidelityGiftIdxInput.value = '';
          }
        }
      } else {
        // Se non siamo in modalità scelta, ripulisci.
        if (fidelityChoiceInput) fidelityChoiceInput.value = '';
        if (fidelityGiftIdxInput) fidelityGiftIdxInput.value = '';
      }

      // Applica lo sconto:
      // - se la box "scelta" è visibile, solo se l'utente seleziona "sconto".
      // - altrimenti, segue il comportamento automatico + policy di conflitto.
      let applyDiscount = false;
      if (showChoiceBox) {
        applyDiscount = (selectedChoice === 'discount' && fidCanRedeem);
      } else {
        applyDiscount = (getDiscountMode() === 'fidelity' && fidCanRedeem);
        // In caso di conflitto, se la priorità è gift o Scelta cliente, NON applicare lo sconto in automatico.
        if (applyDiscount && fidConflict && (fidConflictPolicy === 'gift' || fidConflictPolicy === 'choice')) {
          applyDiscount = false;
        }
      }

      if (applyDiscount) {
        fidDiscount = fidPossibleDiscount;
        fidPoints = fidPossiblePoints;
      }
    }

    // Se non abbiamo una preview valida, assicurati che la box "scelta" sia nascosta
    // e che eventuali valori precedenti non vengano inviati.
    if (!(FIDELITY_ENABLED && fidelityPreview && fidelityPreview.enabled && fidelityPreview.client_found)) {
      if (recFidelityChoiceBox) recFidelityChoiceBox.classList.add('d-none');
      if (recFidelityBox) recFidelityBox.classList.add('d-none');
      if (recFidelityUseToggle) recFidelityUseToggle.checked = false;
      if (fidelityChoiceInput) fidelityChoiceInput.value = '';
      if (fidelityGiftIdxInput) fidelityGiftIdxInput.value = '';
    }
    // Credito cliente (da preview)
    const cr = (fidelityPreview && fidelityPreview.credit) ? fidelityPreview.credit : null;
    const crSchemaOk = !!(cr && (parseInt(String(cr.schema_ok || 0), 10) || 0));
    const crLoggedIn = !!(cr && cr.logged_in);
    const crBalance = cr ? (parseFloat(String(cr.balance ?? 0).replace(',', '.')) || 0) : 0;

    const showCrBox = (crSchemaOk && crLoggedIn && crBalance > 0.00001);
    if (recCreditUseBox) {
      recCreditUseBox.classList.toggle('d-none', !showCrBox);
      if (!showCrBox) {
        if (recCreditUseToggle) recCreditUseToggle.checked = false;
        if (creditUseInput) creditUseInput.value = '0';
      }
      if (recCreditAvail) recCreditAvail.textContent = showCrBox ? euro(crBalance) : '€ 0';
    }


    const showFidelityToggle = fidCanRedeem;
    if (recFidelityBox) recFidelityBox.classList.toggle('d-none', !showFidelityToggle);
    if (recFidelityToggleRow) recFidelityToggleRow.classList.toggle('d-none', !showFidelityToggle);
    if (recFidelityAvail) {
      recFidelityAvail.textContent = 'Disponibili: ' + String(fidAvail || 0) + ' ' + (fidLabel || 'Punti');
    }
    if (recFidelityHint) {
      recFidelityHint.textContent = showFidelityToggle
        ? ("Sconto applicabile con " + String(fidPossiblePoints || 0) + " " + (fidLabel || 'Punti') + ".")
        : '';
    }
    if (recFidelityDiscountAmount) {
      recFidelityDiscountAmount.textContent = showFidelityToggle ? ('- ' + euro(fidPossibleDiscount)) : '- ' + euro(0);
    }
    if (recFidelityUseToggle) {
      recFidelityUseToggle.disabled = !showFidelityToggle;
      recFidelityUseToggle.checked = showFidelityToggle && (getDiscountMode() === 'fidelity');
    }
    if (recFidelityToggleRow) {
      recFidelityToggleRow.classList.toggle('is-active', !!(showFidelityToggle && getDiscountMode() === 'fidelity'));
    }

    if (getDiscountMode() === 'none') {
      fidDiscount = 0;
      fidPoints = 0;
    }

    const totalBeforeCredit = Math.max(0, baseAfterCoupon - fidDiscount);

    // Credito cliente: se selezionato, scala dal totale dovuto
    let creditUse = 0;
    if (showCrBox && recCreditUseToggle && recCreditUseToggle.checked && crBalance > 0.00001) {
      creditUse = Math.min(crBalance, totalBeforeCredit);
      creditUse = Math.round(creditUse * 100) / 100;
    }
    if (creditUseInput) creditUseInput.value = String(creditUse);
    if (recCreditChoiceRow) {
      recCreditChoiceRow.classList.toggle('is-active', creditUse > 0.00001);
    }

    const residualAfterCredit = Math.max(0, totalBeforeCredit - creditUse);

    const giftcardItems = giftcardPreviewItems();
    const selectedGiftcardId = currentGiftcardId();
    let selectedGiftcard = giftcardItems.find(item => item.id === selectedGiftcardId) || null;
    let giftcardUse = 0;
    if (residualAfterCredit > 0.00001 && selectedGiftcard) {
      giftcardUse = Math.min(selectedGiftcard.balance || 0, residualAfterCredit);
      giftcardUse = Math.round(giftcardUse * 100) / 100;
      writeGiftcardRedeem(selectedGiftcard, giftcardUse);
    } else {
      selectedGiftcard = null;
      if (giftcardRedeemInput) giftcardRedeemInput.value = '';
    }
    renderGiftcardChoices(giftcardItems, selectedGiftcard ? selectedGiftcard.id : 0, residualAfterCredit);

    const total = Math.max(0, residualAfterCredit - giftcardUse);
    const benefitsAvailableNow = hasBenefitsAvailable();
    if (benefitsEmptyBox) {
      benefitsEmptyBox.classList.toggle('d-none', benefitsAvailableNow);
    }
    try { syncProgress(progressStageForStep(step)); } catch (e) {}
    if (step === 6 && !benefitsAvailableNow) {
      clearBenefitSelections();
      window.setTimeout(() => showStep(7), 0);
      return;
    }

    // Breakdown prezzi servizi (coupon/promo): usato per mostrare listino barrato + prezzo sconto
    const svcBreakdown = computeCouponBreakdown(svcs, activeDiscount);

    // --- IMPORTANT UX RULE (public booking) ---
    // Nel riepilogo laterale durante il wizard (es. step "Seleziona data e ora") NON
    // dobbiamo applicare/mostrare sconti di alcun tipo (promozioni/coupon/punti fidelity).
    // Gli sconti saranno mostrati SOLO nel riepilogo finale (step 7) e nella conferma.
    // Qui ci interessa solo la colonna destra (DETTAGLIO COSTI) -> mostriamo SEMPRE i prezzi di listino.
    const sideSummaryDisableDiscounts = (typeof step !== 'undefined' && step < 7);

    // Side summary content
    if (!svcs.length){
      sumServices.textContent = '—';
      sumDuration.textContent = '—';
      sumCostLines.innerHTML = '';
      sumTotal.textContent = euro(0);
      if (sumFidelityNote) { sumFidelityNote.classList.add('d-none'); sumFidelityNote.innerHTML = ''; }
      if (fidelityPointsUseInput) fidelityPointsUseInput.value = '0';
    } else {
      sumServices.textContent = svcs.map(s=>s.name).join(', ');
      const totalDur = svcs.reduce((a,s)=>a+s.duration,0);
      sumDuration.textContent = totalDur + ' min';

      let lines = svcs.map(s => {
        const id = String(s.id || '');
        // Nel riepilogo laterale (wizard) mostriamo SEMPRE prezzi di listino.
        // Quindi ignoriamo breakdown sconti fino al recap finale.
        const b = sideSummaryDisableDiscounts ? null : svcBreakdown.get(id);
        const hasDisc = !!(b && (Number(b.discount) || 0) > 0.00001);
        const isResidual = !!(s.residualLabel);
        const oldP = isResidual ? (s.basePrice || 0) : (hasDisc ? (b.old || 0) : (s.price || 0));
        const nowP = isResidual ? 0 : (hasDisc ? (b.now || 0) : (s.price || 0));
        const badge = isResidual ? s.residualLabel : (hasDisc ? (b.badge || '') : '');
        return `
          <div class="summary-row summary-row--no-border">
            <div class="label">${escapeHtml(s.name)}</div>
            <div class="fw-semibold text-end">${renderPriceHtml(oldP, nowP, badge, euro)}</div>
          </div>
        `;
      }).join('');

      sumCostLines.innerHTML = lines;
      const sidebarTotal = sideSummaryDisableDiscounts ? subtotal : total;
      sumTotal.textContent = euro(sidebarTotal);

      // Nel riepilogo laterale NON mostriamo notifiche/pillole relative a sconti Loyalty.
      if (sumFidelityNote) {
        sumFidelityNote.classList.add('d-none');
        sumFidelityNote.innerHTML = '';
      }

      // Usa i punti solo se lo sconto è effettivamente applicato (auto o scelta cliente)
      if (fidelityPointsUseInput) fidelityPointsUseInput.value = String((fidPoints > 0 && fidDiscount > 0.00001) ? wholePts(fidPoints || 0) : 0);
    }

    // Aggiorna la lista servizi (step 2) con prezzi scontati e badge (se applicabile)
    updateServiceCardsPrices(svcBreakdown);

    if (selectedDate && selectedTime) {
      sumDateTime.textContent = formatDateIT(selectedDate) + ', ' + selectedTime;
    } else if (selectedDate) {
      sumDateTime.textContent = formatDateIT(selectedDate);
    } else {
      sumDateTime.textContent = '—';
    }

    updateRecap();
    if (bookingRecapPopup && !bookingRecapPopup.classList.contains('d-none')) {
      renderBookingRecapPopup();
    }
  }

  function updateRecap(){
    if (!recServiceTitle) return;

    const svcs = servicesFromSelection();
    recServiceTitle.textContent = svcs.length ? (svcs.length===1 ? svcs[0].name : svcs.map(s=>s.name).join(', ')) : '—';

    if (selectedDate && selectedTime) {
      recDateTime.textContent = formatDateIT(selectedDate) + ', ' + selectedTime;
    } else if (selectedDate) {
      recDateTime.textContent = formatDateIT(selectedDate);
    } else {
      recDateTime.textContent = '—';
    }

    const lid = locationIdInput.value || (locationSelect ? locationSelect.value : '');
    recStaffName.textContent = getSelectedStaffLabel();
    if (recStaffDetails) {
      const html = getSelectedStaffDetailsHtml();
      recStaffDetails.innerHTML = html;
      recStaffDetails.classList.toggle('d-none', !html);
    }
    recLocationName.textContent = getLocationName(lid);
    recLocationAddress.textContent = getLocationAddress(lid);

    const fn = (document.getElementById('first_name')?.value || '').trim();
    const ln = (document.getElementById('last_name')?.value || '').trim();
    const email = (document.getElementById('email')?.value || '').trim();
    const full = (fn + ' ' + ln).trim();
    recClientName.textContent = full || '—';
    recClientEmail.textContent = email || '—';
    const initials = ((fn[0]||'') + (ln[0]||'')).toUpperCase();
    recClientInitials.textContent = initials || '...';

    const subtotal = svcs.reduce((a,s)=>a+s.price,0);
    // Auto-promozioni (senza codice): aggiorna preview se cambiano servizi/data/orario/anagrafica
    refreshPromotionPreviewIfNeeded().catch(() => {});

    // Sconto pre-Fidelity: il coupon puo includere anche una promo cumulata.
    let couponDiscount = 0;
    let promoDiscount = 0;
    let activeDiscount = null;

    if (appliedCoupon && appliedCoupon.code) {
      couponDiscount = parseFloat(appliedCoupon.discount || 0) || 0;
      if (couponDiscount < 0) couponDiscount = 0;
      if (couponDiscount > subtotal) couponDiscount = subtotal;
      if (couponDiscount > 0.00001) {
        activeDiscount = Object.assign({}, appliedCoupon, { is_promotion: !!appliedCoupon.is_promotion });
      }
    } else if (appliedPromotion && appliedPromotion.id) {
      promoDiscount = parseFloat(appliedPromotion.discount || 0) || 0;
      if (promoDiscount < 0) promoDiscount = 0;
      if (promoDiscount > subtotal) promoDiscount = subtotal;
      if (promoDiscount > 0.00001) {
        activeDiscount = {
          code: '',
          promotion_id: appliedPromotion.id,
          promotion_title: appliedPromotion.title || '',
          discount: promoDiscount,
          discount_type: appliedPromotion.discount_type || 'percent',
          discount_value: appliedPromotion.discount_value || 0,
          is_promotion: true,
          breakdown: appliedPromotion.breakdown || null,
        };
      }
    }

    const baseAfterCoupon = Math.max(0, subtotal - couponDiscount - promoDiscount);

    // Fidelity (usa ultimo preview)
    let fidDiscount = 0;
    let fidPoints = 0;
    let fidLabel = FIDELITY_LABEL;

    // Dati "possibili" (anche quando l'auto-sconto è disattivo)
    let fidAvail = 0;
    let fidPossibleDiscount = 0;
    let fidPossiblePoints = 0;
    let fidCanRedeem = false;

    // Omaggi / conflitto (calcolati quando abbiamo una preview valida)
    let fidGiftEnabled = false;
    let fidGiftList = [];
    let fidBestGiftNoDiscount = null;
    let fidBestGiftAfterMaxDiscount = null;
    let fidConflict = false;
    const fidConflictPolicy = String(FIDELITY_CONFLICT_POLICY || 'discount');

    if (FIDELITY_ENABLED && fidelityPreview && fidelityPreview.enabled && fidelityPreview.client_found) {
      fidLabel = (fidelityPreview.label || FIDELITY_LABEL);
      fidAvail = wholePts(fidelityPreview.available_points || 0);

      fidPossibleDiscount = parseFloat(fidelityPreview.discount || 0) || 0;
      if (fidPossibleDiscount < 0) fidPossibleDiscount = 0;
      if (fidPossibleDiscount > baseAfterCoupon) fidPossibleDiscount = baseAfterCoupon;

      fidPossiblePoints = wholePts(fidelityPreview.points_used || 0);
      fidCanRedeem = (fidPossiblePoints > 0 && fidPossibleDiscount > 0.00001);

	      // Preview punti guadagnati (accredito) — best-effort
	      fidEarnBase = wholePts(fidelityPreview.earn_points_base || 0);
	      fidEarnAfter = wholePts(fidelityPreview.earn_points_after_fidelity || 0);

      // Omaggi (lista) + conflitto: esiste sia sconto che gift ma non sono utilizzabili contemporaneamente.
      fidGiftList = getFidelityGiftList(fidelityPreview);
      fidGiftEnabled = !!(parseInt(fidelityPreview.gift_enabled || 0, 10) || 0) && (fidGiftList.length > 0);
      fidBestGiftNoDiscount = fidGiftEnabled ? bestFidelityGiftForRemaining(fidAvail, fidGiftList) : null;
      fidBestGiftAfterMaxDiscount = (fidGiftEnabled && fidCanRedeem)
        ? bestFidelityGiftForRemaining(Math.max(0, (fidAvail || 0) - (fidPossiblePoints || 0)), fidGiftList)
        : null;
      fidConflict = !!(fidCanRedeem && fidBestGiftNoDiscount && !fidBestGiftAfterMaxDiscount);

      // --- Scelta cliente (policy "choice") in caso di conflitto sconto/gift ---
      const showChoiceBox = (fidConflict && fidConflictPolicy === 'choice' && fidCanRedeem && !!fidBestGiftNoDiscount);
      let selectedChoice = '';

      if (recFidelityChoiceBox) {
        recFidelityChoiceBox.classList.toggle('d-none', !showChoiceBox);
      }

      if (showChoiceBox) {
        // Aggiorna labels UI
        if (fidChoiceDiscountLabel) fidChoiceDiscountLabel.textContent = fidLabel || 'Punti';
        if (fidChoiceGiftLabel) fidChoiceGiftLabel.textContent = fidLabel || 'Punti';

        if (fidChoiceDiscountEuro) {
          const txt = euro(fidPossibleDiscount).replace(/€/g,'').trim();
          fidChoiceDiscountEuro.textContent = txt || '0';
        }
        if (fidChoiceDiscountPoints) fidChoiceDiscountPoints.textContent = fmtPtsValue(fidPossiblePoints || 0);

        if (fidChoiceGiftDesc) {
          const d = (fidBestGiftNoDiscount && fidBestGiftNoDiscount.description) ? String(fidBestGiftNoDiscount.description).trim() : '';
          fidChoiceGiftDesc.textContent = d || 'gift';
        }
        if (fidChoiceGiftPoints) fidChoiceGiftPoints.textContent = fmtPtsValue((fidBestGiftNoDiscount && fidBestGiftNoDiscount.min_points) ? fidBestGiftNoDiscount.min_points : 0);

        // Default e sync col hidden input
        selectedChoice = (fidelityChoiceInput ? String(fidelityChoiceInput.value || '').trim() : '');
        if (!['discount','gift','later'].includes(selectedChoice)) selectedChoice = 'later';
        if (fidelityChoiceInput) fidelityChoiceInput.value = selectedChoice;

        // Sync radio
        if (fidChoiceLater) fidChoiceLater.checked = (selectedChoice === 'later');
        if (fidChoiceDiscount) fidChoiceDiscount.checked = (selectedChoice === 'discount');
        if (fidChoiceGift) fidChoiceGift.checked = (selectedChoice === 'gift');

        // Gift idx (solo se scelto)
        if (fidelityGiftIdxInput) {
          if (selectedChoice === 'gift' && fidBestGiftNoDiscount && fidBestGiftNoDiscount.idx !== undefined && fidBestGiftNoDiscount.idx !== null) {
            fidelityGiftIdxInput.value = String(fidBestGiftNoDiscount.idx);
          } else {
            fidelityGiftIdxInput.value = '';
          }
        }
      } else {
        // Se non siamo in modalità scelta, ripulisci.
        if (fidelityChoiceInput) fidelityChoiceInput.value = '';
        if (fidelityGiftIdxInput) fidelityGiftIdxInput.value = '';
      }

      // Applica lo sconto:
      // - se la box "scelta" è visibile, solo se l'utente seleziona "sconto".
      // - altrimenti, segue il comportamento automatico + policy di conflitto.
      let applyDiscount = false;
      if (showChoiceBox) {
        applyDiscount = (selectedChoice === 'discount' && fidCanRedeem);
      } else {
        applyDiscount = (getDiscountMode() === 'fidelity' && fidCanRedeem);
        // In caso di conflitto, se la priorità è gift o Scelta cliente, NON applicare lo sconto in automatico.
        if (applyDiscount && fidConflict && (fidConflictPolicy === 'gift' || fidConflictPolicy === 'choice')) {
          applyDiscount = false;
        }
      }

      if (applyDiscount) {
        fidDiscount = fidPossibleDiscount;
        fidPoints = fidPossiblePoints;
      }
    }
    // Credito cliente (da preview)
    const cr = (fidelityPreview && fidelityPreview.credit) ? fidelityPreview.credit : null;
    const crSchemaOk = !!(cr && (parseInt(String(cr.schema_ok || 0), 10) || 0));
    const crLoggedIn = !!(cr && cr.logged_in);
    const crBalance = cr ? (parseFloat(String(cr.balance ?? 0).replace(',', '.')) || 0) : 0;

    const showCrBox = (crSchemaOk && crLoggedIn && crBalance > 0.00001);
    if (recCreditUseBox) {
      recCreditUseBox.classList.toggle('d-none', !showCrBox);
      if (!showCrBox) {
        if (recCreditUseToggle) recCreditUseToggle.checked = false;
        if (creditUseInput) creditUseInput.value = '0';
      }
      if (recCreditAvail) recCreditAvail.textContent = showCrBox ? euro(crBalance) : '€ 0';
    }


    const showFidelityToggle = fidCanRedeem;
    if (recFidelityBox) recFidelityBox.classList.toggle('d-none', !showFidelityToggle);
    if (recFidelityToggleRow) recFidelityToggleRow.classList.toggle('d-none', !showFidelityToggle);
    if (recFidelityAvail) {
      recFidelityAvail.textContent = 'Disponibili: ' + String(fidAvail || 0) + ' ' + (fidLabel || 'Punti');
    }
    if (recFidelityHint) {
      recFidelityHint.textContent = showFidelityToggle
        ? ("Sconto applicabile con " + String(fidPossiblePoints || 0) + " " + (fidLabel || 'Punti') + ".")
        : '';
    }
    if (recFidelityDiscountAmount) {
      recFidelityDiscountAmount.textContent = showFidelityToggle ? ('- ' + euro(fidPossibleDiscount)) : '- ' + euro(0);
    }
    if (recFidelityUseToggle) {
      recFidelityUseToggle.disabled = !showFidelityToggle;
      recFidelityUseToggle.checked = showFidelityToggle && (getDiscountMode() === 'fidelity');
    }
    if (recFidelityToggleRow) {
      recFidelityToggleRow.classList.toggle('is-active', !!(showFidelityToggle && getDiscountMode() === 'fidelity'));
    }

    if (getDiscountMode() === 'none') {
      fidDiscount = 0;
      fidPoints = 0;
    }

    const totalBeforeCredit = Math.max(0, baseAfterCoupon - fidDiscount);

    // Credito cliente: se selezionato, scala dal totale dovuto
    let creditUse = 0;
    if (showCrBox && recCreditUseToggle && recCreditUseToggle.checked && crBalance > 0.00001) {
      creditUse = Math.min(crBalance, totalBeforeCredit);
      creditUse = Math.round(creditUse * 100) / 100;
    }
    if (creditUseInput) creditUseInput.value = String(creditUse);
    if (recCreditChoiceRow) {
      recCreditChoiceRow.classList.toggle('is-active', creditUse > 0.00001);
    }

    const residualAfterCredit = Math.max(0, totalBeforeCredit - creditUse);

    const giftcardItems = giftcardPreviewItems();
    const selectedGiftcardId = currentGiftcardId();
    let selectedGiftcard = giftcardItems.find(item => item.id === selectedGiftcardId) || null;
    let giftcardUse = 0;
    if (residualAfterCredit > 0.00001 && selectedGiftcard) {
      giftcardUse = Math.min(selectedGiftcard.balance || 0, residualAfterCredit);
      giftcardUse = Math.round(giftcardUse * 100) / 100;
      writeGiftcardRedeem(selectedGiftcard, giftcardUse);
    } else {
      selectedGiftcard = null;
      if (giftcardRedeemInput) giftcardRedeemInput.value = '';
    }
    renderGiftcardChoices(giftcardItems, selectedGiftcard ? selectedGiftcard.id : 0, residualAfterCredit);

    const total = Math.max(0, residualAfterCredit - giftcardUse);
    if (benefitsEmptyBox) {
      benefitsEmptyBox.classList.toggle('d-none', hasBenefitsAvailable());
    }

    if (recCostLines) {
      const svcBreakdown = computeCouponBreakdown(svcs, activeDiscount);
      let lines = svcs.map(s => {
        const id = String(s.id || '');
        const b = svcBreakdown.get(id);
        const hasDisc = !!(b && (Number(b.discount) || 0) > 0.00001);
        const isResidual = !!(s.residualLabel);
        const oldP = isResidual ? (s.basePrice || 0) : (hasDisc ? (b.old || 0) : (s.price || 0));
        const nowP = isResidual ? 0 : (hasDisc ? (b.now || 0) : (s.price || 0));
        const badge = isResidual ? s.residualLabel : (hasDisc ? (b.badge || '') : '');
        return `
          <div class="summary-row summary-row--no-border">
            <div class="label">${escapeHtml(s.name)}</div>
            <div class="fw-semibold text-end">${renderPriceHtml(oldP, nowP, badge, euro)}</div>
          </div>
        `;
      }).join('');

      if (fidDiscount > 0.00001) {
        const lbl = fidLabel ? escapeHtml(fidLabel) : 'Punti';
        const ptsTxt = fidPoints > 0 ? ` (${fidPoints} ${lbl})` : '';
        lines += `
          <div class="summary-row summary-row--no-border summary-row--success">
            <div class="label">Sconto Fidelity${ptsTxt}</div>
            <div class="fw-semibold">- ${euro(fidDiscount)}</div>
          </div>
        `;
      }


      if (creditUse > 0.00001) {
        lines += `
          <div class="summary-row summary-row--no-border summary-row--success">
            <div class="label">Credito</div>
            <div class="fw-semibold">- ${euro(creditUse)}</div>
          </div>
        `;
      }

      if (giftcardUse > 0.00001) {
        const giftcardLabel = selectedGiftcard && selectedGiftcard.code ? ('GiftCard ' + selectedGiftcard.code) : 'GiftCard';
        lines += `
          <div class="summary-row summary-row--no-border summary-row--success">
            <div class="label">${escapeHtml(giftcardLabel)}</div>
            <div class="fw-semibold">- ${euro(giftcardUse)}</div>
          </div>
        `;
      }

      recCostLines.innerHTML = lines;
    }

    if (recTotal) recTotal.textContent = euro(total);

    // Condizioni promozionali (se presenti)
    if (recPromoConditions && recPromoConditionsText) {
      let raw = '';
      try {
        if (appliedPromotion && appliedPromotion.id && appliedPromotion.promo_conditions) {
          raw = String(appliedPromotion.promo_conditions || '');
        } else if (appliedCoupon && appliedCoupon.promotion_id && appliedCoupon.promo_conditions) {
          raw = String(appliedCoupon.promo_conditions || '');
        } else if (appliedCoupon && appliedCoupon.is_promotion && appliedCoupon.promo_conditions) {
          raw = String(appliedCoupon.promo_conditions || '');
        }
      } catch (e) { raw = ''; }
      raw = String(raw || '').trim();
      if (raw) {
        recPromoConditions.classList.remove('d-none');
        recPromoConditionsText.innerHTML = escapeHtml(raw).replace(/\n/g, '<br>');
      } else {
        recPromoConditions.classList.add('d-none');
        recPromoConditionsText.innerHTML = '';
      }
    }

    // Nota Fidelity (recap) — sconto + gift
    if (recFidelityNote) {
      const noteParts = [];

      try {
        const ptsBal = wholePts((fidelityPreview && fidelityPreview.balance_points) ? fidelityPreview.balance_points : 0);
        if (ptsBal < -0.00001) {
          const debtPts = Math.round(Math.abs(ptsBal) * 100) / 100;
          const lbl = escapeHtml(fidLabel || 'Punti');
          noteParts.push(`Il tuo saldo ${lbl} è negativo di <strong>${debtPts}</strong>. I ${lbl} disponibili restano a 0 finché non vengono compensati da nuovi accrediti.`);
        }
      } catch (e) {}

      // Credito in sospeso su altre prenotazioni (credito già usato ma non ancora "finale")
      try {
        const crPrev = (fidelityPreview && fidelityPreview.credit) ? fidelityPreview.credit : null;
        const pendingCr = Math.round(((parseFloat(String((crPrev && crPrev.pending_reserved_amount) ? crPrev.pending_reserved_amount : 0).replace(',', '.')) || 0) * 100)) / 100;

        const apptCodes = (crPrev && Array.isArray(crPrev.pending_reserved_appt_codes)) ? crPrev.pending_reserved_appt_codes : [];

        function renderCodes(codes){
          const list = (Array.isArray(codes) ? codes : []).map(x => String(x || '').trim()).filter(Boolean);
          if (!list.length) return '';
          const shown = list.slice(0, 3);
          let html = shown.map(c => `<strong>#${escapeHtml(c)}</strong>`).join(', ');
          if (list.length > shown.length) {
            html += ` e altri ${list.length - shown.length}`;
          }
          return html;
        }

        if (pendingCr > 0.00001) {
          const apptHtml = renderCodes(apptCodes);
          const totalCount = (apptCodes.length || 0);
          let whereTxt = '';
          if (totalCount === 1) {
            whereTxt = apptHtml ? (` nella prenotazione ${apptHtml}`) : '';
          } else if (totalCount > 1 && apptHtml) {
            whereTxt = ` nelle prenotazioni ${apptHtml}`;
          }

          const doneVerb = (totalCount === 1) ? 'sarà eseguita' : 'saranno eseguite';
          noteParts.push(`Hai <strong>${euro(pendingCr)}</strong> di credito in sospeso${whereTxt}. Finché non ${doneVerb}, questo credito non sarà disponibile per nuove prenotazioni.`);
        }
      } catch (e) {}


      const discountApplied = (fidPoints > 0 && fidDiscount > 0.00001);


      // Se la policy è "choice" e c'è conflitto, può essere presente una scelta esplicita nel booking.
      const choiceUiActive = (fidConflict && fidConflictPolicy === 'choice' && fidCanRedeem && !!fidBestGiftNoDiscount);
      let choiceSel = '';
      if (choiceUiActive) {
        choiceSel = (fidelityChoiceInput ? String(fidelityChoiceInput.value || '').trim() : '');
        if (!['discount','gift','later'].includes(choiceSel)) choiceSel = 'later';
      }

      // 1) Avviso maturazione Punti
      // Deve essere mostrato indipendentemente dalla scelta delle opzioni sconto.
      // (Il valore punti può cambiare se viene applicato lo sconto Fidelity.)
      try {
        const lbl = escapeHtml(fidLabel || 'Punti');
        const earnPts = (discountApplied ? (fidEarnAfter > 0 ? fidEarnAfter : fidEarnBase) : fidEarnBase);
        if (earnPts > 0.00001) {

          noteParts.push(`Se questa prenotazione sarà eseguita, guadagnerai <strong>${earnPts}</strong> ${lbl}.`);
        }
      } catch (e) {}

      // 2) Omaggi a soglia (se configurati)
      if (FIDELITY_ENABLED && fidelityPreview && fidelityPreview.enabled && fidelityPreview.client_found) {
        // Se la priorità è sconto e c'è conflitto (cioè gift possibile ma non contemporaneamente allo sconto), non mostrare l'omaggio.
        const hideGift = (fidConflict && fidConflictPolicy === 'discount' && (discountApplied || getDiscountMode() === 'fidelity') && fidCanRedeem);
        if (!hideGift) {
          const reserved = discountApplied ? (fidPoints || 0) : 0;
          const rem = Math.max(0, (fidAvail || 0) - reserved);
          const bestGift = fidGiftEnabled ? bestFidelityGiftForRemaining(rem, fidGiftList) : null;

          if (bestGift) {
            const d = (bestGift.description || '').trim();
            const descTxt = d ? `: <strong>${escapeHtml(d)}</strong>` : '';
            const lbl = escapeHtml(fidLabel || 'Punti');
            const pts = wholePts(bestGift.min_points || 0);
            const ptsTxt = pts > 0 ? `<strong>${pts}</strong> ${lbl}` : lbl;
            if (choiceUiActive && choiceSel === 'gift') {
              noteParts.push(`Hai scelto l'omaggio${descTxt}. Verranno scalati ${ptsTxt} quando l'appuntamento sarà eseguito.`);
            } else if (choiceUiActive && choiceSel === 'later') {
              noteParts.push(`Puoi ottenere in gift${descTxt}. Se lo sceglierai in negozio, verranno scalati ${ptsTxt} quando l'appuntamento sarà eseguito.`);
            } else {
              noteParts.push(`Puoi ottenere in gift${descTxt}. Verranno scalati ${ptsTxt} quando l'appuntamento sarà eseguito.`);
            }
          }
        }
      }

      if (noteParts.length) {
        recFidelityNote.classList.remove('d-none');
        recFidelityNote.innerHTML = `<i class="bi bi-info-circle me-1"></i>${noteParts.join('<br>')}`;
      } else {
        recFidelityNote.classList.add('d-none');
        recFidelityNote.innerHTML = '';
      }
    }



  }

  function renderBookingRecapPopup(){
    if (!bookingRecapPopup) return;
    if (bookingRecapPopupTitle) bookingRecapPopupTitle.textContent = recServiceTitle ? (recServiceTitle.textContent || 'Prenotazione') : 'Prenotazione';
    if (bookingRecapPopupDateTime) bookingRecapPopupDateTime.textContent = recDateTime ? (recDateTime.textContent || '—') : '—';
    if (bookingRecapPopupStaff) bookingRecapPopupStaff.innerHTML = recStaffName ? escapeHtml(recStaffName.textContent || '—') : '—';
    if (bookingRecapPopupLocation) {
      const name = recLocationName ? (recLocationName.textContent || '—') : '—';
      const addr = recLocationAddress ? String(recLocationAddress.textContent || '').trim() : '';
      bookingRecapPopupLocation.innerHTML = escapeHtml(name) + (addr ? '<div class="small text-muted">' + escapeHtml(addr) + '</div>' : '');
    }
    if (bookingRecapPopupDuration) {
      const svcs = servicesFromSelection();
      const totalDur = svcs.reduce((a,s)=>a + (parseInt(s.duration || 0, 10) || 0), 0);
      bookingRecapPopupDuration.textContent = totalDur > 0 ? (totalDur + ' min') : '—';
    }
    if (bookingRecapPopupCostLines) {
      bookingRecapPopupCostLines.innerHTML = recCostLines ? (recCostLines.innerHTML || '') : '';
    }
    if (bookingRecapPopupTotal) bookingRecapPopupTotal.textContent = recTotal ? (recTotal.textContent || euro(0)) : euro(0);

    if (bookingRecapPopupFidelityNote) {
      const show = !!(recFidelityNote && !recFidelityNote.classList.contains('d-none') && String(recFidelityNote.innerHTML || '').trim());
      bookingRecapPopupFidelityNote.classList.toggle('d-none', !show);
      bookingRecapPopupFidelityNote.innerHTML = show ? recFidelityNote.innerHTML : '';
    }
    if (bookingRecapPopupPromoConditions) {
      const show = !!(recPromoConditions && !recPromoConditions.classList.contains('d-none') && recPromoConditionsText && String(recPromoConditionsText.innerHTML || '').trim());
      bookingRecapPopupPromoConditions.classList.toggle('d-none', !show);
      bookingRecapPopupPromoConditions.innerHTML = show
        ? ('<div class="fw-semibold mb-1">Condizioni promozionali</div><div class="small">' + recPromoConditionsText.innerHTML + '</div>')
        : '';
    }
  }

  function openBookingRecapPopup(){
    if (!bookingRecapPopup) return;
    updateSummary();
    renderBookingRecapPopup();
    bookingRecapPopup.classList.remove('d-none');
  }

  function closeBookingRecapPopup(){
    if (!bookingRecapPopup) return;
    bookingRecapPopup.classList.add('d-none');
  }

  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s]));
  }


  // UI message (Bootstrap 5 toast) used to inform the user when a staff change invalidates the chosen slot.
  function uiToast(message, variant='warning'){
    const v = String(variant || 'info');
    const allowed = ['primary','secondary','success','danger','warning','info','light','dark'];
    const bg = allowed.includes(v) ? v : 'info';

    let container = document.getElementById('bookingToastContainer');
    if(!container){
      container = document.createElement('div');
      container.id = 'bookingToastContainer';
      container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
      container.style.zIndex = '2000';
      document.body.appendChild(container);
    }

    const closeCls = (bg === 'warning' || bg === 'light') ? 'btn-close' : 'btn-close btn-close-white';

    const el = document.createElement('div');
    el.className = `toast align-items-center text-bg-${bg} border-0`;
    el.setAttribute('role','alert');
    el.setAttribute('aria-live','assertive');
    el.setAttribute('aria-atomic','true');
    el.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">${escapeHtml(message)}</div>
        <button type="button" class="${closeCls} me-2 m-auto" data-bs-dismiss="toast" aria-label="Chiudi"></button>
      </div>
    `;
    container.appendChild(el);

    try{
      if(window.bootstrap && bootstrap.Toast){
        const t = bootstrap.Toast.getOrCreateInstance(el, { delay: 4500 });
        el.addEventListener('hidden.bs.toast', () => el.remove());
        t.show();
      } else {
        throw new Error('bootstrap toast not available');
      }
    } catch(e){
      try{ el.remove(); }catch(_){ }
      try{ window.alert(String(message||'')); }catch(_){ }
    }
  }

  async function fetchStaffForSelection(){
    const svcIds = serviceIdsInput.value || '';
    const url = new URL(BOOKING_API_BASE);
    url.searchParams.set('mode','staff');
    url.searchParams.set('service_ids', svcIds);
    const locId = (locationIdInput?.value || document.getElementById('locationSelect')?.value || '');
    if (locId) url.searchParams.set('location_id', locId);
    try {
      const res = await fetch(url.toString(), {headers: {'Accept':'application/json'}});
	      const js = await res.json();
	      if (js && js.ok && Array.isArray(js.services)) return js.services;
    } catch (e) {}
    return [];
  }

	  function renderStaffList(services){
	    lastStaffServices = Array.isArray(services) ? services : [];
	    if (!staffList) return;
	    staffList.innerHTML = '';
	    if (staffEmpty) staffEmpty.classList.toggle('d-none', lastStaffServices.length > 0);

	    // auto-assign single-operator services
	    lastStaffServices.forEach(svc => {
	      const sid = String(svc.service_id || svc.id || '');
	      const staff = Array.isArray(svc.staff) ? svc.staff : [];
	      if (sid && staff.length === 1) {
	        selectedStaffByService[sid] = String(staff[0].id || '');
	      }
	    });
	    syncStaffMapInput();

	    lastStaffServices.forEach(svc => {
	      const sid = String(svc.service_id || svc.id || '');
	      const svcName = String(svc.name || getServiceName(sid) || 'Servizio').trim();
	      const staff = Array.isArray(svc.staff) ? svc.staff : [];

	      const section = document.createElement('div');
	      section.className = 'mb-3';
	      section.innerHTML = `<div class="fw-semibold mb-2">${escapeHtml(svcName)}</div>`;

	      if (!staff.length) {
	        const msg = document.createElement('div');
	        msg.className = 'text-muted small';
	        msg.textContent = 'Nessun operatore disponibile.';
	        section.appendChild(msg);
	        staffList.appendChild(section);
	        return;
	      }

	      staff.forEach(st => {
	        const id = String(st.id || '');
	        const name = String(st.full_name || st.name || '').trim();
	        const card = document.createElement('div');
	        card.className = 'list-card staff-card';
	        card.dataset.id = id;
	        card.dataset.service = sid;

	        const isAuto = staff.length === 1;
	        const isSelected = isAuto ? true : (selectedStaffByService[sid] === id);
	        card.classList.toggle('active', isSelected);

	        card.innerHTML = `
	          <div class="d-flex align-items-center justify-content-between">
	            <div>
	              <div class="fw-semibold">${escapeHtml(name || 'Operatore')}</div>
	              <div class="text-muted small">${isAuto ? 'Assegnato automaticamente' : 'Seleziona'}</div>
	            </div>
	            <i class="bi ${isSelected ? 'bi-check-circle-fill text-success' : 'bi-chevron-right text-muted'}" aria-hidden="true"></i>
	          </div>
	        `;

	        if (!isAuto) {
	          card.addEventListener('click', () => {
            const prev = String(selectedStaffByService[sid] || '');
            if (prev === String(id)) return;
            const hadSlot = !!(selectedTime || (timeInput && timeInput.value));
            // select within this service group
	            selectedStaffByService[sid] = id;
	            syncStaffMapInput();

	            // update UI for this service
			            Array.from(staffList.querySelectorAll('.staff-card'))
			              .filter(x => String(x.dataset.service || '') === String(sid))
			              .forEach(x => x.classList.remove('active'));
	            card.classList.add('active');

	            // Changing staff invalidates chosen slot
            releaseBookingHold();
            selectedTime = null;
            timeInput.value = '';
            if (hadSlot && String(prev || '').trim()) uiToast('Hai cambiato operatore: seleziona di nuovo una disponibilità', 'warning');
            if (selectedDate) fetchSlotsFor(selectedDate);

	            updateSummary();
	            validateStep();
	          });
	        }

	        section.appendChild(card);
	      });

	      staffList.appendChild(section);
	    });

	    updateSummary();
	    validateStep();
	  }

  // Keep a fresh cache of eligible staff per selected service.
  // This is used for the operator recap even when the dedicated "choose staff" step is disabled.
  let staffRefreshTimer = null;
  function scheduleStaffRefresh(){
    if (staffRefreshTimer) window.clearTimeout(staffRefreshTimer);
    staffRefreshTimer = window.setTimeout(async () => {
      staffRefreshTimer = null;
      if (!serviceIdsInput || !serviceIdsInput.value) {
        lastStaffServices = [];
        selectedStaffByService = {};
        syncStaffMapInput();
        updateSummary();
        return;
      }

      const services = await fetchStaffForSelection();
      lastStaffServices = Array.isArray(services) ? services : [];

      // Remove stale selections for services no longer chosen
      const selectedSet = new Set(Array.from(selectedServices).map(String));
      Object.keys(selectedStaffByService || {}).forEach(k => {
        if (!selectedSet.has(String(k))) delete selectedStaffByService[k];
      });

      // Auto-assign when only one eligible staff exists for a service
      lastStaffServices.forEach(svc => {
        const sid = String(svc.service_id || svc.id || '');
        const staff = Array.isArray(svc.staff) ? svc.staff : [];
        if (sid && staff.length === 1) selectedStaffByService[sid] = String(staff[0].id || '');
      });
      syncStaffMapInput();

      // When staff choice step is disabled, keep staff_id empty unless there is a single, deterministic staff.
      if (!CHOOSE_STAFF_ENABLED && staffIdInput) {
        if (selectedServices.size === 1) {
          const only = Array.from(selectedServices)[0];
          const svc = lastStaffServices.find(x => String(x.service_id || x.id || '') === String(only));
          const staff = svc && Array.isArray(svc.staff) ? svc.staff : [];
          staffIdInput.value = (staff.length === 1) ? String(staff[0].id || '') : '';
        } else {
          staffIdInput.value = '';
        }
      }

      updateSummary();
      validateStep();
    }, 250);
  }


  function bookingVisibleProgressOrder(){
    const order = ['location', 'category', 'services', 'staff', 'time', 'benefits', 'confirm'];
    let visible = shouldSkipLocationStep() ? order.filter(stage => stage !== 'location') : order;
    return hasBenefitsAvailable() ? visible : visible.filter(stage => stage !== 'benefits');
  }

  function progressStageForStep(n){
    const stageByStep = {
      1: 'location',
      2: 'category',
      3: 'services',
      4: 'staff',
      5: 'time',
      6: 'benefits',
      7: 'confirm'
    };
    const stage = stageByStep[Math.max(1, Math.min(7, parseInt(n, 10) || 1))] || 'location';
    return (stage === 'benefits' && !hasBenefitsAvailable()) ? 'confirm' : stage;
  }

  function syncProgress(stage){
    const order = bookingVisibleProgressOrder();
    const normalizedStage = (stage === 'benefits' && !hasBenefitsAvailable()) ? 'confirm' : stage;
    let idx = order.indexOf(normalizedStage);
    if (idx < 0) idx = 0;
    if (bookingProgress) bookingProgress.style.setProperty('--booking-progress-count', String(Math.max(1, order.length)));
    progressItems.forEach((item) => {
      const key = String(item.dataset.progress || '');
      const itemIdx = order.indexOf(key);
      const visible = itemIdx > -1;
      item.classList.toggle('d-none', !visible);
      item.setAttribute('aria-hidden', visible ? 'false' : 'true');
      item.classList.toggle('is-active', visible && itemIdx === idx);
      item.classList.toggle('is-done', visible && itemIdx < idx);
    });
    if (bookingStepCounter) bookingStepCounter.textContent = 'Step ' + (idx + 1) + ' di ' + order.length;
  }

  function getCategoryLabel(catId){
    const el = catCards.find(x => String(x.dataset.id || '') === String(catId));
    if (!el) return '';
    const lbl = el.querySelector('.cat-name');
    return lbl ? lbl.textContent.trim() : '';
  }

  function syncCategoryTabs(){
    if (!categoryTabs.length) return;
    categoryTabs.forEach((tab) => {
      tab.classList.toggle('is-active', String(tab.dataset.categoryTab || '') === String(selectedCategoryId || ''));
    });
  }

  function updateServiceSectionHeading(){
    if (!serviceSectionTitle) return;
    const label = getCategoryLabel(selectedCategoryId);
    serviceSectionTitle.textContent = label || 'Servizi disponibili';
  }

  function syncWizardButtons(){
    const isFirst = (step <= firstWizardStep());
    if (btnBack) btnBack.style.visibility = isFirst ? 'hidden' : 'visible';
    if (btnBackTop) btnBackTop.classList.toggle('is-hidden', isFirst);
    if (btnNextSummary) {
      btnNextSummary.innerHTML = (step >= 7) ? 'Invia' : 'Continua';
    }
    if (btnRecap) {
      btnRecap.classList.toggle('d-none', !(step >= 3 && step <= 6));
    }
    if (bookingModalShell) bookingModalShell.classList.toggle('is-final-step', step >= 6);
  }

  function showStep(n){
    n = normalizeWizardStepForResidual(n);
    n = normalizeWizardStepForLocation(n);
    if (n === 6 && !hasBenefitsAvailable()) {
      clearBenefitSelections();
      n = 7;
    }
    step = n;
    wizardSteps.forEach(s => s.classList.toggle('d-none', s.dataset.step !== String(n)));

    if (summaryAside) summaryAside.classList.toggle('d-none', n >= 6);
    syncWizardButtons();
    syncProgress(progressStageForStep(n));

    if (n === 1){
      stepTitle.textContent = 'Scegli la sede';
      if (bookingStepDescription) bookingStepDescription.textContent = 'Seleziona il centro in cui vuoi prenotare.';
      leftTitle.textContent = 'Sede';
      leftText.textContent = 'Scegli il centro piu comodo per proseguire.';
      btnNext.innerHTML = 'Continua <i class="bi bi-arrow-right ms-1"></i>';
    } else if (n === 2){
      stepTitle.textContent = 'Scegli una categoria';
      if (bookingStepDescription) bookingStepDescription.textContent = 'Scegli da dove iniziare il percorso.';
      leftTitle.textContent = 'Categoria';
      leftText.textContent = 'Seleziona una categoria per vedere i servizi disponibili.';
      btnNext.innerHTML = 'Continua <i class="bi bi-arrow-right ms-1"></i>';
      syncCategoryTabs();
      updateServiceSectionHeading();
    } else if (n === 3){
      stepTitle.textContent = 'Servizi';
      if (bookingStepDescription) bookingStepDescription.textContent = 'Seleziona uno o piu trattamenti e continua quando sei pronto.';
      leftTitle.textContent = 'Servizi';
      leftText.textContent = 'Puoi aggiungere piu servizi alla stessa prenotazione.';
      btnNext.innerHTML = 'Avanti <i class="bi bi-arrow-right ms-1"></i>';
      syncCategoryTabs();
      updateServiceSectionHeading();
      renderRecommended();
    } else if (n === 4){
      stepTitle.textContent = 'Professionista';
      if (bookingStepDescription) bookingStepDescription.textContent = 'Scegli il professionista per ogni servizio selezionato.';
      leftTitle.textContent = 'Professionista';
      leftText.textContent = 'Seleziona un operatore per ogni servizio scelto, quando previsto.';
      btnNext.innerHTML = 'Avanti <i class="bi bi-arrow-right ms-1"></i>';
    } else if (n === 5){
      stepTitle.textContent = 'Data e ora';
      if (bookingStepDescription) bookingStepDescription.textContent = 'Scegli la data e poi l\'orario che preferisci.';
      leftTitle.textContent = 'Data e ora';
      leftText.textContent = 'Scorri i giorni oppure apri il calendario per saltare a una data piu lontana.';
      btnNext.innerHTML = 'Avanti <i class="bi bi-arrow-right ms-1"></i>';
      Promise.resolve().then(() => ensureDateSelectionReady()).catch(() => {});
    } else if (n === 6){
      stepTitle.textContent = 'Vantaggi';
      if (bookingStepDescription) bookingStepDescription.textContent = 'Applica Punti Fidelity, credito o GiftCard disponibili prima della conferma.';
      leftTitle.textContent = 'Vantaggi';
      leftText.textContent = 'Scegli se usare Punti Fidelity, credito o GiftCard su questa prenotazione.';
      btnNext.innerHTML = 'Avanti <i class="bi bi-arrow-right ms-1"></i>';
      try { refreshFidelityPreviewIfNeeded(true); } catch (e) {}
    } else if (n === 7){
      stepTitle.textContent = 'Conferma';
      if (bookingStepDescription) bookingStepDescription.textContent = 'Controlla tutti i dettagli e invia la prenotazione.';
      leftTitle.textContent = 'Conferma';
      leftText.textContent = 'Verifica i dettagli del tuo appuntamento e invia per confermare.';
      btnNext.innerHTML = 'Invia <i class="bi bi-send ms-1"></i>';
      try { schedulePromotionsRefresh(); } catch (e) {}
    }
    if (unresolvedResidualRequested()) bookingShowHoldError(residualUnavailableMessage());
    validateStep();
    updateSummary();
    syncProgress(progressStageForStep(step));
    if (n === 5) scheduleBookingSlotAutoRefresh();
    else stopBookingSlotAutoRefresh();
  }

  function validateStep(){
    let ok = true;
    if (step === 1) ok = !!(locationIdInput && String(locationIdInput.value || '').trim());
    if (step === 2) ok = !!selectedCategoryId;
    if (step === 3) ok = (selectedServices.size > 0);
    if (step === 4) {
      ok = CHOOSE_STAFF_ENABLED ? hasCompleteStaffSelection() : !!(staffIdInput && String(staffIdInput.value||'').trim().length>0);
    }
    if (step === 5) ok = !!(selectedDate && selectedTime && bookingCurrentHoldToken() && !bookingHoldIsExpired());
    if (step === 6) ok = !!(selectedDate && selectedTime && bookingCurrentHoldToken() && !bookingHoldIsExpired());
    if (step === 7) ok = !!(selectedDate && selectedTime && bookingCurrentHoldToken() && !bookingHoldIsExpired());
    if (unresolvedResidualRequested()) ok = false;
    btnNext.disabled = !ok;
    if (btnNextSummary) btnNextSummary.disabled = !ok;
  }

  function filterServicesByCategory(catId){
    serviceCards.forEach(el => {
      const c = el.dataset.cat || '0';
      el.style.display = (String(c) === String(catId) ? '' : 'none');
    });
  }

  // When the selected service(s) change, any previously chosen date/time is no longer reliable
  // (duration, eligible staff and availability constraints can differ). Reset the selection.
  function resetDateTimeSelection(){
    releaseBookingHold();
    selectedDate = null;
    selectedTime = null;
    dateStripStart = null;
    if (dateInput) dateInput.value = '';
    if (timeInput) timeInput.value = '';
    if (slotDateLabel) slotDateLabel.textContent = '';
    if (slotGrid) slotGrid.innerHTML = '';
    if (slotEmpty) {
      // restore default empty state text
      slotEmpty.textContent = 'Nessuna disponibilità per questo giorno.';
      slotEmpty.classList.add('d-none');
    }
    if (dateStripDays) dateStripDays.innerHTML = '';
    if (dateStripMonthLabel) dateStripMonthLabel.textContent = '—';
    if (calendarPopover) calendarPopover.classList.add('d-none');
    // Clear calendar highlight if already initialized
    if (fp && typeof fp.clear === 'function') {
      try { fp.clear(); } catch (e) {}
    }
  }

  function syncLocationCards(){
    const current = String((locationIdInput && locationIdInput.value) || (locationSelect && locationSelect.value) || '');
    locationCards.forEach(card => {
      card.classList.toggle('active', String(card.dataset.id || '') === current);
    });
  }

  function resetBookingSelectionForLocation(){
    selectedCategoryId = null;
    catCards.forEach(x => x.classList.remove('active'));
    categoryTabs.forEach(x => x.classList.remove('is-active'));

    selectedServices.clear();
    selectedServiceOrder = [];
    selectedStaffByService = {};
    serviceCards.forEach(x => x.classList.remove('active'));
    if (serviceIdsInput) serviceIdsInput.value = '';
    syncResidualInputs();
    if (staffIdInput) staffIdInput.value = '';
    if (staffMapInput) staffMapInput.value = '';
    lastStaffServices = [];
    skippedStaffStep = !CHOOSE_STAFF_ENABLED;

    resetDateTimeSelection();
    syncStaffMapInput();
    renderRecommended();

    if (appliedCoupon) {
      clearCouponState(true);
      setCouponMessage('Coupon da riapplicare (sede modificata).', 'muted');
    }
    appliedPromotion = null;
    if (promotionIdInput) promotionIdInput.value = '';
    promotionPreviewKey = '';
    fidelityPreviewKey = '';
    promotionsKey = '';

    updateSummary();
  }

  async function applyLocationSelection(locationId, resetSelection){
    const nextId = String(locationId || '');
    if (!nextId) return;

    if (locationSelect) locationSelect.value = nextId;
    if (locationIdInput) locationIdInput.value = nextId;
    syncLocationCards();

    if (resetSelection) resetBookingSelectionForLocation();

    closedDateSet = new Set();
    openDateSet = new Set();
    closedDows = [];
    closureRanges = [];
    await loadClosuresConfig();
    if (fp && typeof fp.redraw === 'function') {
      try { fp.redraw(); } catch (e) {}
    }
    updateSummary();
    validateStep();
  }

  function bookingUrlForLocation(locationId){
    const url = new URL(window.location.href);
    url.searchParams.set('page', 'booking');
    url.searchParams.set('public', '1');
    url.searchParams.set('start', '1');
    url.searchParams.set('location_id', String(locationId || ''));
    url.searchParams.set('wizard_step', RESIDUAL_REQUESTED ? '1' : '2');
    url.searchParams.delete('auth');
    url.searchParams.delete('showcase');
    url.searchParams.delete('hub');
    url.searchParams.delete('my');
    url.searchParams.delete('quotes');
    url.searchParams.delete('packs');
    url.searchParams.delete('giftcards');
    url.searchParams.delete('giftcard_view');
    url.searchParams.delete('giftboxes');
    url.searchParams.delete('giftbox_view');
    url.searchParams.delete('fidelity');
    url.searchParams.delete('products');
    return url.toString();
  }

  function applyCategorySelection(catId, goToServices){
    if (unresolvedResidualRequested()) {
      showStep(1);
      return;
    }
    if (residualFlowActive()) {
      if (goToServices) {
        Promise.resolve()
          .then(() => advanceResidualBookingFlow(3))
          .catch(() => {});
      } else {
        applyInitialServiceIdsFromUrl();
        updateSummary();
        validateStep();
      }
      return;
    }

    const nextCatId = String(catId || '');
    if (!nextCatId) return;

    catCards.forEach(x => x.classList.toggle('active', String(x.dataset.id || '') === nextCatId));
    selectedCategoryId = nextCatId;
    filterServicesByCategory(selectedCategoryId);
    syncCategoryTabs();
    updateServiceSectionHeading();

    selectedServices.clear();
    selectedServiceOrder = [];
    selectedStaffByService = {};
    serviceCards.forEach(x => x.classList.remove('active'));
    serviceIdsInput.value = '';
    syncResidualInputs();
    syncStaffMapInput();
    resetDateTimeSelection();
    renderRecommended();
    if (appliedCoupon) { clearCouponState(true); setCouponMessage('Coupon da riapplicare (servizi modificati).','muted'); }
    updateSummary();
    validateStep();
    if (goToServices) showStep(3);
  }

  // category click
  catCards.forEach(el => {
    el.addEventListener('click', () => {
      applyCategorySelection(el.dataset.id, true);
    });
  });

  categoryTabs.forEach(el => {
    el.addEventListener('click', () => {
      applyCategorySelection(el.dataset.categoryTab, false);
    });
  });

  // service click (multi-select)
  serviceCards.forEach(el => {
    el.addEventListener('click', () => {
      toggleServiceSelection(el.dataset.id);
    });
  });

  // staff/location
  if (staffSelect) {
    staffSelect.addEventListener('change', () => {
      const prevStaff = String(staffIdInput && staffIdInput.value || '').trim();
      const nextStaff = String(staffSelect.value || '').trim();
      const hadSlot = !!(selectedTime || (timeInput && timeInput.value));
      staffIdInput.value = staffSelect.value;
      // changing operator resets date/time choice
      releaseBookingHold();
      selectedTime = null; timeInput.value = '';
      if (hadSlot && prevStaff && nextStaff && prevStaff !== nextStaff) uiToast('Hai cambiato operatore: seleziona di nuovo una disponibilità', 'warning');
      updateSummary();
      if (step === 4 && selectedDate) fetchSlotsFor(selectedDate);
      validateStep();
    });
    staffIdInput.value = staffSelect.value;
  }
  if (locationSelect) {
    locationSelect.addEventListener('change', async () => {
      await applyLocationSelection(locationSelect.value, true);
    });
    locationIdInput.value = locationSelect.value;
    syncLocationCards();
  }
  locationCards.forEach(card => {
    card.addEventListener('click', () => {
      const nextLocationId = String(card.dataset.id || '');
      if (!nextLocationId) return;
      if (String(currentPageLocationId || '') !== nextLocationId) {
        if (locationIdInput) locationIdInput.value = nextLocationId;
        if (locationSelect) locationSelect.value = nextLocationId;
        syncLocationCards();
        window.location.href = bookingUrlForLocation(nextLocationId);
        return;
      }
      applyLocationSelection(nextLocationId, false)
        .then(() => advanceResidualBookingFlow(2))
        .then(handled => { if (!handled) showStep(2); })
        .catch(() => { if (residualFlowActive()) showStep(1); else showStep(2); });
    });
  });

  // calendar
  let fp = null;
  let closedDateSet = new Set();
  let openDateSet = new Set();
  let closedDows = [];
  let closureRanges = [];
  let slotsRequestId = 0;

  function parseYmdToDate(ymd){
    try {
      const [y,m,d] = String(ymd || '').split('-').map(x => parseInt(x, 10));
      if (!y || !m || !d) return null;
      return new Date(y, m - 1, d, 12, 0, 0, 0);
    } catch (e) {
      return null;
    }
  }

  function asDayDate(date){
    const base = (date instanceof Date) ? new Date(date.getTime()) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0, 0);
  }

  function toYmd(date){
    const d = asDayDate(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function addDays(date, amount){
    const d = asDayDate(date);
    d.setDate(d.getDate() + amount);
    return d;
  }

  function isDateDisabled(date){
    const ymd = toYmd(date);
    if (openDateSet.has(ymd)) return false;
    if (closedDateSet.has(ymd)) return true;
    return closedDows.includes(asDayDate(date).getDay());
  }

  function formatDateIT(ymd){
    try{
      const dt = parseYmdToDate(ymd);
      return dt ? dt.toLocaleDateString('it-IT',{day:'2-digit',month:'long',year:'numeric'}) : ymd;
    }catch(e){ return ymd; }
  }

  function formatMonthYearIT(date){
    try {
      return asDayDate(date).toLocaleDateString('it-IT', {month:'long', year:'numeric'});
    } catch (e) {
      return '';
    }
  }

  function formatWeekdayShort(date){
    try {
      return asDayDate(date).toLocaleDateString('it-IT', {weekday:'short'}).replace('.', '').toLowerCase();
    } catch (e) {
      return '';
    }
  }

  function findFirstSelectableDate(startDate, maxDays = 180){
    let candidate = asDayDate(startDate || new Date());
    const today = asDayDate(new Date());
    if (candidate < today) candidate = today;
    for (let i = 0; i <= maxDays; i++) {
      const probe = addDays(candidate, i);
      if (!isDateDisabled(probe)) return probe;
    }
    return candidate;
  }

  function findFirstSelectableDateInWindow(startDate, windowDays = 7){
    const candidate = asDayDate(startDate || new Date());
    for (let i = 0; i < windowDays; i++) {
      const probe = addDays(candidate, i);
      if (!isDateDisabled(probe)) return probe;
    }
    return findFirstSelectableDate(candidate);
  }

  function closeCalendarPopover(){
    if (calendarPopover) calendarPopover.classList.add('d-none');
  }

  function renderDateStrip(){
    if (!dateStripDays || !dateStripMonthLabel) return;
    const base = selectedDate ? (parseYmdToDate(selectedDate) || findFirstSelectableDate(new Date())) : (dateStripStart ? asDayDate(dateStripStart) : findFirstSelectableDate(new Date()));
    dateStripStart = base;
    dateStripMonthLabel.textContent = formatMonthYearIT(selectedDate ? (parseYmdToDate(selectedDate) || base) : base);
    dateStripDays.innerHTML = '';

    for (let i = 0; i < 7; i++) {
      const day = addDays(base, i);
      const ymd = toYmd(day);
      const disabled = isDateDisabled(day);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'booking-day-pill';
      if (selectedDate && selectedDate === ymd) btn.classList.add('is-selected');
      if (disabled) {
        btn.classList.add('is-disabled');
        btn.disabled = true;
      }
      btn.dataset.date = ymd;
      btn.innerHTML = `
        <span class="booking-day-pill__num">${day.getDate()}</span>
        <span class="booking-day-pill__weekday">${formatWeekdayShort(day)}</span>
      `;
      if (!disabled) {
        btn.addEventListener('click', () => {
          selectBookingDate(ymd).catch(() => {});
        });
      }
      dateStripDays.appendChild(btn);
    }

    if (dateStripPrev) {
      const today = asDayDate(new Date());
      const activeStart = selectedDate ? (parseYmdToDate(selectedDate) || dateStripStart) : dateStripStart;
      dateStripPrev.disabled = asDayDate(activeStart || today) <= today;
    }
  }

  async function selectBookingDate(ymd, options = {}){
    const opts = Object.assign({ preserveStripStart: false, fromCalendar: false }, options || {});
    const nextDate = parseYmdToDate(ymd);
    if (!nextDate) return;
    const normalized = toYmd(nextDate);
    if (isDateDisabled(nextDate)) return;

    selectedDate = normalized;
    if (!opts.preserveStripStart || !dateStripStart) {
      dateStripStart = asDayDate(nextDate);
    }
    if (dateInput) dateInput.value = normalized;
    releaseBookingHold();
    selectedTime = null;
    if (timeInput) timeInput.value = '';
    if (slotDateLabel) slotDateLabel.textContent = formatDateIT(normalized);
    if (slotGrid) slotGrid.innerHTML = '';
    if (slotEmpty) slotEmpty.classList.add('d-none');

    if (fp && typeof fp.setDate === 'function') {
      try { fp.setDate(normalized, false); } catch (e) {}
    }
    renderDateStrip();
    await fetchSlotsFor(normalized);
    updateSummary();
    validateStep();
    if (opts.fromCalendar) closeCalendarPopover();
  }

  async function ensureDateSelectionReady(force = false){
    if (!dateStripStart || force) {
      dateStripStart = findFirstSelectableDate(selectedDate ? (parseYmdToDate(selectedDate) || new Date()) : new Date());
    }
    if (!selectedDate || force) {
      const first = findFirstSelectableDateInWindow(dateStripStart, 7);
      await selectBookingDate(toYmd(first));
      return;
    }

    const current = parseYmdToDate(selectedDate);
    if (!current || isDateDisabled(current)) {
      const first = findFirstSelectableDateInWindow(dateStripStart, 7);
      await selectBookingDate(toYmd(first));
      return;
    }

    if (slotDateLabel) slotDateLabel.textContent = formatDateIT(selectedDate);
    if (fp && typeof fp.setDate === 'function') {
      try { fp.setDate(selectedDate, false); } catch (e) {}
    }
    dateStripStart = selectedDate ? (parseYmdToDate(selectedDate) || dateStripStart) : dateStripStart;
    renderDateStrip();
  }

  async function shiftDateStrip(offsetDays){
    const base = selectedDate ? (parseYmdToDate(selectedDate) || dateStripStart || new Date()) : (dateStripStart ? asDayDate(dateStripStart) : findFirstSelectableDate(new Date()));
    let nextStart = addDays(base, offsetDays);
    const today = asDayDate(new Date());
    if (nextStart < today) nextStart = today;
    dateStripStart = nextStart;
    const nextDate = findFirstSelectableDate(nextStart, 7);
    await selectBookingDate(toYmd(nextDate));
  }

  async function loadClosuresConfig(){
    try{
      const url = new URL(BOOKING_API_BASE);
      url.searchParams.set('mode','closures');
      // sede selezionata (per orari/chiusure specifiche)
      const locId = (document.getElementById('location_id')?.value || document.getElementById('locationSelect')?.value || '');
      if (locId) url.searchParams.set('location_id', locId);
      const res = await fetch(url.toString(), {headers: {'Accept':'application/json'}});
      const data = await res.json();
      if (data && data.ok) {
        closedDateSet = new Set();
        openDateSet = new Set();
        closedDows = (data.closed_dows || []).map(x=>parseInt(x,10)).filter(x=>!isNaN(x));
        (data.closed_dates || []).forEach(d=>closedDateSet.add(String(d)));
        (data.open_dates || []).forEach(d=>openDateSet.add(String(d)));
        closureRanges = data.closure_ranges || [];
        renderClosureNotice();
        if (fp && typeof fp.redraw === 'function') {
          try { fp.redraw(); } catch (e) {}
        }
        if (step === 5) {
          await ensureDateSelectionReady(true);
        } else {
          renderDateStrip();
        }
      }
    } catch(e) {}
  }

  // carica subito (di solito prima che l'utente arrivi al calendario)
  loadClosuresConfig();

  function renderClosureNotice(){
    const box = document.getElementById('closureNotice');
    const txt = document.getElementById('closureNoticeText');
    if (!box || !txt) return;
    if (!Array.isArray(closureRanges) || closureRanges.length===0) {
      box.classList.add('d-none');
      return;
    }
    const lines = closureRanges.slice(0,3).map(r=>{
      const s = formatDateIT(r.start);
      const e = formatDateIT(r.end);
      if (r.start === r.end) return `Il negozio sarà chiuso il <strong>${s}</strong>.`;
      return `Il negozio sarà chiuso dal <strong>${s}</strong> al <strong>${e}</strong>.`;
    });
    txt.innerHTML = lines.join('<br>');
    box.classList.remove('d-none');
  }

  function initCalendar(){
    if (fp) return;
    fp = flatpickr('#calendarInput', {
      appendTo: document.getElementById('inlineCalendar'),
      inline: true,
      locale: 'it',
      dateFormat: 'Y-m-d',
      minDate: 'today',
      disable: [function(date){
        return isDateDisabled(date);
      }],
      onChange: function(sel, str){
        if (!str) return;
        selectBookingDate(str, { fromCalendar: true }).catch(() => {});
      }
    });
    if (selectedDate) {
      try { fp.setDate(selectedDate, false); } catch (e) {}
    }
  }

  const SLOT_GROUP_THRESHOLD = 12;
  const SLOT_RECOMMENDED_INTERVAL = 15;

  function slotMinutes(time){
    const parts = String(time || '').split(':');
    const h = parseInt(parts[0] || '0', 10);
    const m = parseInt(parts[1] || '0', 10);
    if (Number.isNaN(h) || Number.isNaN(m)) return 0;
    return (h * 60) + m;
  }

  function slotHour(time){
    const h = parseInt(String(time || '').split(':')[0] || '0', 10);
    return Number.isNaN(h) ? 0 : h;
  }

  function slotPeriodLabel(time){
    const h = slotHour(time);
    if (h < 12) return 'Mattina';
    if (h < 18) return 'Pomeriggio';
    return 'Sera';
  }

  function isRecommendedSlot(time){
    return (slotMinutes(time) % SLOT_RECOMMENDED_INTERVAL) === 0;
  }

  function createSlotButton(time){
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'slot-btn available';
    b.textContent = time;
    b.dataset.time = time;
    if (selectedTime === time) b.classList.add('selected');
    b.addEventListener('click', async () => {
      if (b.disabled) return;
      b.disabled = true;
      b.classList.add('is-loading');
      try {
        const hold = await createBookingHold(selectedDate, time);
        applyBookingHoldAllocation(hold);
        selectedTime = time;
        timeInput.value = time;
        Array.from(slotGrid.querySelectorAll('.slot-btn')).forEach(x => x.classList.remove('selected'));
        b.classList.add('selected');
        updateSummary();
        validateStep();
      } catch (err) {
        uiToast((err && err.message) ? err.message : 'Orario non piu disponibile. Scegli un altro slot.', 'warning');
        if (selectedDate) fetchSlotsFor(selectedDate).catch(() => {});
      } finally {
        b.disabled = false;
        b.classList.remove('is-loading');
      }
    });
    return b;
  }

  function renderFlatSlots(slots){
    slotGrid.classList.remove('has-groups');
    slots.forEach(t => slotGrid.appendChild(createSlotButton(t)));
  }

  function getInitialHourSlots(hourSlots){
    const recommended = hourSlots.filter(isRecommendedSlot);
    if (recommended.length) return recommended;
    return hourSlots.slice(0, Math.min(3, hourSlots.length));
  }

  function renderHourSlots(container, hourSlots, expanded){
    container.innerHTML = '';
    let visible = expanded ? hourSlots : getInitialHourSlots(hourSlots);
    if (!expanded && selectedTime && hourSlots.includes(selectedTime) && !visible.includes(selectedTime)) {
      visible = visible.concat([selectedTime]).sort((a, b) => slotMinutes(a) - slotMinutes(b));
    }
    visible.forEach(t => container.appendChild(createSlotButton(t)));
  }

  function renderGroupedSlots(slots){
    slotGrid.classList.add('has-groups');
    const sorted = slots.slice().sort((a, b) => slotMinutes(a) - slotMinutes(b));
    const periods = [];
    const periodMap = new Map();

    sorted.forEach(time => {
      const periodLabel = slotPeriodLabel(time);
      if (!periodMap.has(periodLabel)) {
        const period = { label: periodLabel, slots: [], hours: new Map() };
        periodMap.set(periodLabel, period);
        periods.push(period);
      }
      const period = periodMap.get(periodLabel);
      const hour = String(time).slice(0, 2);
      period.slots.push(time);
      if (!period.hours.has(hour)) period.hours.set(hour, []);
      period.hours.get(hour).push(time);
    });

    periods.forEach(period => {
      const section = document.createElement('section');
      section.className = 'slot-period';

      const head = document.createElement('div');
      head.className = 'slot-period__head';

      const title = document.createElement('div');
      title.className = 'slot-period__title';
      title.textContent = period.label;

      const count = document.createElement('div');
      count.className = 'slot-period__count';
      count.textContent = period.slots.length === 1 ? '1 orario' : period.slots.length + ' orari';

      head.appendChild(title);
      head.appendChild(count);
      section.appendChild(head);

      period.hours.forEach((hourSlots, hour) => {
        const card = document.createElement('div');
        card.className = 'slot-hour-card';

        const cardHead = document.createElement('div');
        cardHead.className = 'slot-hour-card__head';

        const hourInfo = document.createElement('div');
        const hourTitle = document.createElement('div');
        hourTitle.className = 'slot-hour-card__title';
        hourTitle.textContent = hour + ':00';
        const hourMeta = document.createElement('div');
        hourMeta.className = 'slot-hour-card__meta';
        hourMeta.textContent = hourSlots.length === 1 ? '1 disponibilita' : hourSlots.length + ' disponibilita';
        hourInfo.appendChild(hourTitle);
        hourInfo.appendChild(hourMeta);

        const timesWrap = document.createElement('div');
        timesWrap.className = 'slot-hour-card__times';

        let expanded = false;
        const initialSlots = getInitialHourSlots(hourSlots);
        const hasHiddenSlots = initialSlots.length < hourSlots.length;
        let toggle = null;
        if (hasHiddenSlots) {
          toggle = document.createElement('button');
          toggle.type = 'button';
          toggle.className = 'slot-hour-toggle';
          toggle.textContent = 'Mostra tutti';
          toggle.addEventListener('click', () => {
            expanded = !expanded;
            renderHourSlots(timesWrap, hourSlots, expanded);
            toggle.textContent = expanded ? 'Nascondi' : 'Mostra tutti';
          });
        }

        cardHead.appendChild(hourInfo);
        if (toggle) cardHead.appendChild(toggle);
        card.appendChild(cardHead);
        card.appendChild(timesWrap);
        section.appendChild(card);

        renderHourSlots(timesWrap, hourSlots, expanded);
      });

      slotGrid.appendChild(section);
    });
  }

  function renderSlots(slots){
    slotGrid.innerHTML = '';
    if (!Array.isArray(slots) || !slots.length) return;
    if (slots.length <= SLOT_GROUP_THRESHOLD) {
      renderFlatSlots(slots);
      return;
    }
    renderGroupedSlots(slots);
  }

  async function fetchSlotsFor(dateStr, options = {}){
    const opts = Object.assign({ silent: false, auto: false }, options || {});
    if (opts.auto && bookingSlotsLoading) return;
    bookingSlotsLoading = true;
    if (!opts.silent) {
      slotGrid.innerHTML = '';
      slotGrid.classList.remove('has-groups');
      slotEmpty.classList.add('d-none');
    }
    try { slotGrid.setAttribute('aria-busy', 'true'); } catch (e) {}
    const requestId = ++slotsRequestId;

    const sid = staffIdInput.value || '';
    const staffMap = (staffMapInput && staffMapInput.value) ? staffMapInput.value : '';
    const svcIds = serviceIdsInput.value || '';
    const url = new URL(BOOKING_API_BASE);
    url.searchParams.set('mode','slots');
    url.searchParams.set('date', dateStr);
    // If we already have a per-service staff map, always prefer it (works also when
    // the dedicated staff selection step is disabled).
    if (staffMap) {
      url.searchParams.set('staff_map', staffMap);
      url.searchParams.set('staff_id', '');
    } else {
      url.searchParams.set('staff_id', sid);
    }
    url.searchParams.set('service_ids', svcIds);
    const locId = (locationIdInput?.value || document.getElementById('locationSelect')?.value || '');
    if (locId) url.searchParams.set('location_id', locId);
    const holdToken = bookingCurrentHoldToken();
    if (holdToken) url.searchParams.set('appointment_hold_token', holdToken);

    let slots = [];
    try {
      const res = await fetch(url.toString(), {headers: {'Accept':'application/json'}});
      const ct = (res.headers.get('content-type') || '');
      if (!ct.includes('application/json')) throw new Error('Non-JSON response');
      const data = await res.json();
      if (requestId !== slotsRequestId || dateStr !== selectedDate) { finishBookingSlotsRequest(requestId); return; }
      if (data && data.ok) {
        slots = data.slots || [];
      } else {
        // Surface backend errors (useful to diagnose misconfigurations).
        if (data && data.error) {
          slotEmpty.textContent = String(data.error);
          slotEmpty.classList.remove('d-none');
          validateStep();
          finishBookingSlotsRequest(requestId);
          return;
        }
        slots = [];
      }
    } catch (e) {
      if (requestId !== slotsRequestId || dateStr !== selectedDate) { finishBookingSlotsRequest(requestId); return; }
      // Fail safe: show empty state instead of breaking the wizard.
      if (opts.silent) {
        validateStep();
        finishBookingSlotsRequest(requestId);
        return;
      }
      finishBookingSlotsRequest(requestId);
      slotEmpty.textContent = 'Errore nel caricamento delle disponibilità. Ricarica la pagina.';
      slotEmpty.classList.remove('d-none');
      validateStep();
      return;
    }

    if (!slots.length){
      slotGrid.innerHTML = '';
      slotGrid.classList.remove('has-groups');
      slotEmpty.classList.remove('d-none');
      validateStep();
      finishBookingSlotsRequest(requestId);
      return;
    }

    slotEmpty.classList.add('d-none');
    renderSlots(slots);
    finishBookingSlotsRequest(requestId);
  }

  if (dateStripPrev) {
    dateStripPrev.addEventListener('click', () => {
      shiftDateStrip(-1).catch(() => {});
    });
  }
  if (dateStripNext) {
    dateStripNext.addEventListener('click', () => {
      shiftDateStrip(1).catch(() => {});
    });
  }
  if (dateStripCalendarBtn) {
    dateStripCalendarBtn.addEventListener('click', (e) => {
      e.preventDefault();
      initCalendar();
      if (calendarPopover) {
        const shouldOpen = calendarPopover.classList.contains('d-none');
        calendarPopover.classList.toggle('d-none', !shouldOpen);
        if (shouldOpen && fp) {
          try {
            const jumpTarget = selectedDate || toYmd(dateStripStart || new Date());
            fp.jumpToDate(jumpTarget);
            fp.setDate(jumpTarget, false);
          } catch (err) {}
        }
      }
    });
  }
  document.addEventListener('click', (e) => {
    if (!calendarPopover || calendarPopover.classList.contains('d-none')) return;
    if (calendarPopover.contains(e.target)) return;
    if (dateStripCalendarBtn && dateStripCalendarBtn.contains(e.target)) return;
    closeCalendarPopover();
  });

  // navigation
  btnClose.addEventListener('click', () => {
    releaseBookingHold();
    // Close should bring the user back to the public booking "home" (gate/hub),
    // not to the website homepage.
    window.location.href = String(wizardConfig.closeUrl || PUBLIC_HOME_URL || '');
  });

  window.addEventListener('pagehide', () => {
    releaseBookingHold();
  });

  btnBack.addEventListener('click', (e) => {
    e.preventDefault();
    if (step <= firstWizardStep()) return;

    if (residualFlowActive()) {
      if (step === 5 && skippedStaffStep) { showStep(1); return; }
      if (step === 4) { showStep(1); return; }
      if (step === 3) { showStep(1); return; }
    }

    // Se lo step operatore è stato saltato, da Data/Ora si torna direttamente ai Servizi
    if (step === 7 && !hasBenefitsAvailable()) { showStep(5); return; }

    if (step === 5 && skippedStaffStep) { showStep(3); return; }

    showStep(Math.max(firstWizardStep(), step - 1));
  });


  if (btnBackTop) {
    btnBackTop.addEventListener('click', (e) => {
      e.preventDefault();
      if (btnBack && typeof btnBack.click === 'function') btnBack.click();
    });
  }

  if (btnNextSummary) {
    btnNextSummary.addEventListener('click', () => {
      if (btnNext && !btnNext.disabled) btnNext.click();
    });
  }

  if (btnRecap) {
    btnRecap.addEventListener('click', (e) => {
      e.preventDefault();
      openBookingRecapPopup();
    });
  }
  if (bookingRecapClose) {
    bookingRecapClose.addEventListener('click', (e) => {
      e.preventDefault();
      closeBookingRecapPopup();
    });
  }
  if (bookingRecapPopup) {
    bookingRecapPopup.addEventListener('click', (e) => {
      const target = e.target;
      if (target && target.getAttribute && target.getAttribute('data-recap-close') === '1') {
        closeBookingRecapPopup();
      }
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && bookingRecapPopup && !bookingRecapPopup.classList.contains('d-none')) {
      closeBookingRecapPopup();
    }
  });

  if (wizardForm) {
    wizardForm.addEventListener('submit', (e) => {
      if (!bookingCurrentHoldToken() || bookingHoldIsExpired()) {
        e.preventDefault();
        bookingHandleHoldExpired();
      }
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopBookingSlotAutoRefresh();
    else scheduleBookingSlotAutoRefresh();
  });

  async function advanceAfterServicesSelection(){
    if (!selectedServices || selectedServices.size <= 0) return;

    if (!CHOOSE_STAFF_ENABLED) {
      skippedStaffStep = true;
      const services = await fetchStaffForSelection();
      lastStaffServices = Array.isArray(services) ? services : [];

      const selIds = getOrderedSelectedServiceIds().map(String);
      let allDeterministic = selIds.length > 0;
      selectedStaffByService = selectedStaffByService || {};
      selIds.forEach(sid => {
        const svc = lastStaffServices.find(x => String(x.service_id || x.id || '') === String(sid));
        const staff = svc && Array.isArray(svc.staff) ? svc.staff : [];
        if (staff.length === 1) {
          selectedStaffByService[String(sid)] = String(staff[0].id || '');
        } else {
          allDeterministic = false;
        }
      });
      syncStaffMapInput();

      if (staffIdInput) {
        staffIdInput.value = (selIds.length === 1 && allDeterministic) ? String(selectedStaffByService[selIds[0]] || '') : '';
      }
      if (staffMapInput && !(allDeterministic && selIds.length > 1)) staffMapInput.value = '';
      updateSummary();
      initCalendar();
      showStep(5);
      return;
    }

    const services = await fetchStaffForSelection();
    const selectedSet = new Set(Array.from(selectedServices).map(String));
    Object.keys(selectedStaffByService || {}).forEach(k => {
      if (!selectedSet.has(String(k))) delete selectedStaffByService[k];
    });

    if (Array.isArray(services)) {
      services.forEach(svc => {
        const sid = String(svc.service_id || svc.id || '');
        const staff = Array.isArray(svc.staff) ? svc.staff : [];
        if (sid && staff.length === 1) selectedStaffByService[sid] = String(staff[0].id || '');
      });
    }
    syncStaffMapInput();

    const needsStaffStep = Array.isArray(services) && services.some(svc => Array.isArray(svc.staff) && svc.staff.length >= 2);
    if (needsStaffStep) {
      skippedStaffStep = false;
      staffIdInput.value = '';
      renderStaffList(services);
      showStep(4);
      return;
    }

    skippedStaffStep = true;
    staffIdInput.value = '';
    initCalendar();
    showStep(5);
  }

  async function advanceResidualBookingFlow(fallbackStep){
    if (!residualFlowActive()) return false;

    const hasLocation = !!String((locationIdInput && locationIdInput.value) || '').trim();
    const applied = applyInitialServiceIdsFromUrl();
    updateSummary();
    validateStep();

    if (!hasLocation) {
      showStep(1);
      return true;
    }

    if (!applied || !hasResidualSelected()) {
      if (typeof uiToast === 'function') {
        uiToast('Il servizio del residuo selezionato non risulta prenotabile nella sede scelta.', 'warning');
      }
      showStep(1);
      return true;
    }

    await advanceAfterServicesSelection();
    return true;
  }

  btnNext.addEventListener('click', async () => {
    if (unresolvedResidualRequested()) {
      showStep(1);
      return;
    }

    if (step === 1) {
      if (await advanceResidualBookingFlow(2)) return;
      showStep(2);
      return;
    }

    if (step === 2) {
      if (await advanceResidualBookingFlow(3)) return;
      showStep(3);
      return;
    }

    if (step === 3) {
      await advanceAfterServicesSelection();
      return;
	      // Dopo i servizi: eventuale scelta operatore
	      if (!CHOOSE_STAFF_ENABLED) {
	        // Non si sceglie l'operatore: mostra disponibilità su qualunque operatore idoneo.
	        skippedStaffStep = true;
	        // Refresh staff cache once so we can keep deterministic assignments (e.g. services
	        // with a single operator) and show a meaningful recap.
	        const services = await fetchStaffForSelection();
	        lastStaffServices = Array.isArray(services) ? services : [];

	        // Build a deterministic staff map only when every selected service has exactly one eligible staff.
	        const selIds = getOrderedSelectedServiceIds().map(String);
	        let allDeterministic = selIds.length > 0;
	        selectedStaffByService = selectedStaffByService || {};
	        selIds.forEach(sid => {
	          const svc = lastStaffServices.find(x => String(x.service_id || x.id || '') === String(sid));
	          const staff = svc && Array.isArray(svc.staff) ? svc.staff : [];
	          if (staff.length === 1) {
	            selectedStaffByService[String(sid)] = String(staff[0].id || '');
	          } else {
	            allDeterministic = false;
	          }
	        });
	        syncStaffMapInput();

	        // staff_id is kept empty unless single-service with single operator
	        if (staffIdInput) {
	          if (selIds.length === 1 && allDeterministic) {
	            staffIdInput.value = String(selectedStaffByService[selIds[0]] || '');
	          } else {
	            staffIdInput.value = '';
	          }
	        }
	        // keep staff_map only if fully deterministic (multi-service). Otherwise backend will auto-assign.
	        if (staffMapInput) {
	          if (!(allDeterministic && selIds.length > 1)) staffMapInput.value = '';
	        }
	        updateSummary();
	        initCalendar();
	        showStep(5);
	        return;
	      }

	      const services = await fetchStaffForSelection();
	      // remove staff selections for services no longer selected
	      const selectedSet = new Set(Array.from(selectedServices).map(String));
	      Object.keys(selectedStaffByService || {}).forEach(k => {
	        if (!selectedSet.has(String(k))) delete selectedStaffByService[k];
	      });

	      // auto-assign single-operator services
	      if (Array.isArray(services)) {
	        services.forEach(svc => {
	          const sid = String(svc.service_id || svc.id || '');
	          const staff = Array.isArray(svc.staff) ? svc.staff : [];
	          if (sid && staff.length === 1) selectedStaffByService[sid] = String(staff[0].id || '');
	        });
	      }
	      syncStaffMapInput();

	      const needsStaffStep = Array.isArray(services) && services.some(svc => Array.isArray(svc.staff) && svc.staff.length >= 2);
	      if (needsStaffStep) {
	        skippedStaffStep = false;
	        staffIdInput.value = '';
	        renderStaffList(services);
	        showStep(4);
	        return;
	      }

	      // Tutti i servizi hanno 0/1 operatore: imposta automaticamente e salta.
	      skippedStaffStep = true;
	      staffIdInput.value = '';
	      initCalendar();
	      showStep(5);
	      return;
    }

	    if (step === 4) {
	      // ensure staff_map is in sync before calendar
	      hasCompleteStaffSelection();
	      syncStaffMapInput();
	      initCalendar();
	      showStep(5);
	      return;
    }

    if (step === 5) {
      if (!bookingCurrentHoldToken() || bookingHoldIsExpired()) {
        bookingHandleHoldExpired();
        return;
      }
      await refreshPromotionPreviewIfNeeded();
      await refreshFidelityPreviewIfNeeded(true);
      updateSummary();
      updateRecap();
      const benefitsAvailable = hasBenefitsAvailable();
      if (!benefitsAvailable) clearBenefitSelections();
      showStep(benefitsAvailable ? 6 : 7);
      return;
    }

    if (step === 6) {
      if (!bookingCurrentHoldToken() || bookingHoldIsExpired()) {
        bookingHandleHoldExpired();
        return;
      }
      updateSummary();
      updateRecap();
      showStep(7);
      return;
    }

    if (step === 7) {
      if (!bookingCurrentHoldToken() || bookingHoldIsExpired()) {
        bookingHandleHoldExpired();
        return;
      }
      await refreshPromotionPreviewIfNeeded();
      await refreshFidelityPreviewIfNeeded(true);
      updateSummary();
      updateRecap();
      syncResidualInputs();
      if (wizardForm) wizardForm.submit();
      return;
    }
  });

  // validate client fields
  ['first_name','last_name','email','phone','notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => { validateStep(); updateSummary(); });
  });

  // coupon (conferma)
  if (couponToggle) {
    couponToggle.addEventListener('click', (e) => {
      e.preventDefault();
      if (!couponBox) return;
      couponBox.classList.toggle('d-none');
      if (!couponBox.classList.contains('d-none') && couponInput) couponInput.focus();
    });
  }
  if (couponApplyBtn) couponApplyBtn.addEventListener('click', applyCoupon);
  if (couponInput) {
    couponInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); }
    });
  }
  if (couponRemoveBtn) {
    couponRemoveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      removeCoupon();
    });
  }

  // Fidelity: scelta cliente in caso di conflitto sconto/gift (policy "choice")
  function setFidelityChoice(choice) {
    if (fidelityChoiceInput) fidelityChoiceInput.value = String(choice || '').trim();
    updateSummary();
  }
  if (fidChoiceLater) {
    fidChoiceLater.addEventListener('change', () => {
      if (fidChoiceLater.checked) setFidelityChoice('later');
    });
  }
  if (fidChoiceDiscount) {
    fidChoiceDiscount.addEventListener('change', () => {
      if (fidChoiceDiscount.checked) setFidelityChoice('discount');
    });
  }
  if (fidChoiceGift) {
    fidChoiceGift.addEventListener('change', () => {
      if (fidChoiceGift.checked) setFidelityChoice('gift');
    });
  }


  // === Area clienti (login/registrazione) ===
  const customerAreaBtn = document.getElementById('customerAreaBtn');
  const customerAreaBtnLabel = document.getElementById('customerAreaBtnLabel');
  const customerModalEl = document.getElementById('customerModal');
  const custLoggedOut = document.getElementById('custLoggedOut');
  const custLoggedIn = document.getElementById('custLoggedIn');
  const custHello = document.getElementById('custHello');
  const custEmail = document.getElementById('custEmail');
  const custApptList = document.getElementById('custApptList');
  const custApptEmpty = document.getElementById('custApptEmpty');
  const custLogoutBtn = document.getElementById('custLogoutBtn');
  const custAuthAlert = document.getElementById('custAuthAlert');
  const custLoginForm = document.getElementById('custLoginForm');
  const custRegisterForm = document.getElementById('custRegisterForm');
  const custVerifyBox = document.getElementById('custVerifyBox');
  const custVerifyEmail = document.getElementById('custVerifyEmail');
  const custVerifyForm = document.getElementById('custVerifyForm');
  const custResendCodeBtn = document.getElementById('custResendCodeBtn');
  const custBackToAuthBtn = document.getElementById('custBackToAuthBtn');

  const custForgotBox = document.getElementById('custForgotBox');
  const custForgotForm = document.getElementById('custForgotForm');
  const custForgotBtn = document.getElementById('custForgotBtn');
  const custBackFromForgotBtn = document.getElementById('custBackFromForgotBtn');

  const custTabsEl = customerModalEl ? customerModalEl.querySelector('#custTabs') : null;
  const custTabContentEl = customerModalEl ? customerModalEl.querySelector('.tab-content') : null;
  // CSRF token: prefer hidden field already present in the booking form, fallback to meta tag.
  const csrf = (document.querySelector('input[name="_csrf"]')?.value || document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '');

  let bookingUser = null;
  let customerModal = null;
  const hasBootstrapModal = !!(customerModalEl && window.bootstrap && window.bootstrap.Modal);
  if (hasBootstrapModal) {
    customerModal = new bootstrap.Modal(customerModalEl);
  }

  // Fallback modal handling when Bootstrap JS isn't present.
  function ensureBackdrop(){
    let bd = document.getElementById('custModalBackdrop');
    if (!bd) {
      bd = document.createElement('div');
      bd.id = 'custModalBackdrop';
      bd.className = 'modal-backdrop fade show';
      bd.addEventListener('click', closeCustomerModal);
      document.body.appendChild(bd);
    }
    return bd;
  }

  function openCustomerModal(){
    if (customerModal && hasBootstrapModal) { customerModal.show(); return; }
    if (!customerModalEl) return;
    ensureBackdrop();
    customerModalEl.style.display = 'block';
    customerModalEl.classList.add('show');
    customerModalEl.removeAttribute('aria-hidden');
    document.body.classList.add('modal-open');
    // Prevent background scroll on iOS
    document.body.style.overflow = 'hidden';
  }

  function closeCustomerModal(){
    if (customerModal && hasBootstrapModal) { customerModal.hide(); return; }
    if (!customerModalEl) return;
    customerModalEl.classList.remove('show');
    customerModalEl.style.display = 'none';
    customerModalEl.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    const bd = document.getElementById('custModalBackdrop');
    if (bd) bd.remove();
  }

  // Close button support for the fallback modal.
  if (customerModalEl && !hasBootstrapModal) {
    customerModalEl.querySelectorAll('[data-bs-dismiss="modal"], .btn-close').forEach(el => {
      el.addEventListener('click', (e) => { e.preventDefault(); closeCustomerModal(); });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && customerModalEl.classList.contains('show')) closeCustomerModal();
    });
  }

  // Tabs fallback (Bootstrap pills require JS). If Bootstrap JS is missing, toggle panes manually.
  function setupCustomerTabsFallback(){
    if (hasBootstrapModal) return;
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const paneLogin = document.getElementById('pane-login');
    const paneRegister = document.getElementById('pane-register');
    if (!tabLogin || !tabRegister || !paneLogin || !paneRegister) return;

    function activate(which){
      const isLogin = which === 'login';
      tabLogin.classList.toggle('active', isLogin);
      tabRegister.classList.toggle('active', !isLogin);
      paneLogin.classList.toggle('show', isLogin);
      paneLogin.classList.toggle('active', isLogin);
      paneRegister.classList.toggle('show', !isLogin);
      paneRegister.classList.toggle('active', !isLogin);
      // Keep fades consistent
      paneLogin.classList.toggle('fade', true);
      paneRegister.classList.toggle('fade', true);
    }

    tabLogin.addEventListener('click', (e) => { e.preventDefault(); activate('login'); });
    tabRegister.addEventListener('click', (e) => { e.preventDefault(); activate('register'); });
    activate('login');
  }
  setupCustomerTabsFallback();

  function showCustAlert(msg, type='danger'){
    if (!custAuthAlert) return;
    custAuthAlert.textContent = msg || 'Errore';
    custAuthAlert.classList.remove('d-none');
    custAuthAlert.classList.remove('alert-danger','alert-success','alert-info','alert-warning');
    custAuthAlert.classList.add('alert-' + type);
  }
  function showCustError(msg){ showCustAlert(msg, 'danger'); }
  function clearCustError(){
    if (!custAuthAlert) return;
    custAuthAlert.classList.add('d-none');
    custAuthAlert.textContent = '';
    custAuthAlert.classList.remove('alert-danger','alert-success','alert-info','alert-warning');
    custAuthAlert.classList.add('alert-danger');
  }

  function showCustVerify(email){
    clearCustError();
    if (custForgotBox) custForgotBox.classList.add('d-none');
    if (custVerifyEmail) custVerifyEmail.textContent = email || '';
    // Avoid duplicated alerts: show the "code sent" message inside the verify box.
    try {
      if (custVerifyBox) {
        const a = custVerifyBox.querySelector('.alert');
        if (a) {
          let note = document.getElementById('custVerifySentMsg');
          if (!note) {
            note = document.createElement('div');
            note.id = 'custVerifySentMsg';
            note.className = 'text-muted small mt-2';
            a.appendChild(note);
          }
          note.textContent = 'Codice inviato. Controlla la tua email (anche spam).';
        }
      }
    } catch(e) {}
    if (custVerifyBox) custVerifyBox.classList.remove('d-none');
    if (custTabsEl) custTabsEl.classList.add('d-none');
    if (custTabContentEl) custTabContentEl.classList.add('d-none');
  }
  function hideCustVerify(){
    clearCustError();
    if (custVerifyBox) custVerifyBox.classList.add('d-none');
    if (custForgotBox) custForgotBox.classList.add('d-none');
    if (custTabsEl) custTabsEl.classList.remove('d-none');
    if (custTabContentEl) custTabContentEl.classList.remove('d-none');
  }

  function showCustForgot(prefillEmail){
    clearCustError();
    if (custVerifyBox) custVerifyBox.classList.add('d-none');
    if (custForgotBox) custForgotBox.classList.remove('d-none');
    if (custTabsEl) custTabsEl.classList.add('d-none');
    if (custTabContentEl) custTabContentEl.classList.add('d-none');
    try {
      const em = custForgotForm ? custForgotForm.querySelector('input[name="email"]') : null;
      if (em && prefillEmail) em.value = String(prefillEmail || '').trim();
    } catch (e) {}
  }

  function hideCustForgot(){
    clearCustError();
    if (custForgotBox) custForgotBox.classList.add('d-none');
    if (custVerifyBox) custVerifyBox.classList.add('d-none');
    if (custTabsEl) custTabsEl.classList.remove('d-none');
    if (custTabContentEl) custTabContentEl.classList.remove('d-none');
  }

  function statusBadgeClass(st){
    const s = String(st || '').toLowerCase().trim();
    if (s === 'pending') return 'bg-warning text-dark';
    if (s === 'scheduled') return 'bg-success';
    if (s === 'done') return 'bg-secondary';
    if (s === 'canceled' || s === 'rejected') return 'bg-danger';
    return 'bg-light text-dark';
  }

  function fillClientStepFromUser(u){
    if (!u) return;
    const full = String(u.full_name || '').trim();
    const savedFirst = String(u.first_name || '').trim();
    const savedLast = String(u.last_name || '').trim();
    const email = String(u.email || '').trim();
    const phone = String(u.phone || '').trim();

    const firstEl = document.getElementById('first_name');
    const lastEl = document.getElementById('last_name');
    const emailEl = document.getElementById('email');
    const phoneEl = document.getElementById('phone');

    if (firstEl && lastEl && (savedFirst || savedLast || full)) {
      let first = savedFirst;
      let last = savedLast;
      if ((!first || !last) && full) {
        const parts = full.split(/\s+/).filter(Boolean);
        if (!first) first = parts.shift() || '';
        if (!last) last = parts.join(' ');
      }
      if (!firstEl.value) firstEl.value = first;
      if (!lastEl.value) lastEl.value = last;
    }
    if (emailEl && email) {
      if (!emailEl.value) emailEl.value = email;
      emailEl.readOnly = true;
    }
    if (phoneEl && phone) {
      if (!phoneEl.value) phoneEl.value = phone;
    }
    updateSummary();
    validateStep();
  }

  async function custFetch(mode, method='GET', dataObj=null){
    const url = new URL(BOOKING_API_BASE);
    url.searchParams.set('mode', mode);

	    const opt = { method, headers: {'Accept':'application/json'}, credentials:'same-origin', cache:'no-store' };
    if (method === 'POST') {
      const fd = new FormData();
      if (csrf) fd.set('_csrf', csrf);
      if (dataObj) Object.keys(dataObj).forEach(k => fd.set(k, dataObj[k]));
      opt.body = fd;
    }

	    // Timeout safety (evita blocchi del login in caso di server lento / cookie bloccati in iframe).
	    const timeoutMs = 15000;
	    const controller = (window.AbortController ? new AbortController() : null);
	    let timer = null;
	    if (controller) {
	      opt.signal = controller.signal;
	      timer = window.setTimeout(function(){
	        try { controller.abort(); } catch (e) {}
	      }, timeoutMs);
	    }

	    try {
	      const res = await fetch(url.toString(), opt);
	      const ct = String(res.headers.get('content-type') || '').toLowerCase();
	      if (ct.includes('application/json')) {
	        return await res.json();
	      }
	      const text = await res.text().catch(() => '');
	      try { return JSON.parse(text); } catch (e) {}
	      return { ok:false, error: 'Risposta non valida dal server', status: res.status };
	    } finally {
	      if (timer) window.clearTimeout(timer);
	    }
  }

  function renderAppointments(list){
    if (!custApptList) return;
    custApptList.innerHTML = '';
    const appts = Array.isArray(list) ? list : [];
    if (!appts.length) {
      if (custApptEmpty) custApptEmpty.classList.remove('d-none');
      return;
    }
    if (custApptEmpty) custApptEmpty.classList.add('d-none');

    appts.forEach(a => {
      const start = a.starts_at ? new Date(String(a.starts_at).replace(' ', 'T')) : null;
      const dateLbl = start ? start.toLocaleString('it-IT', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : (a.starts_at || '');
      const svc = Array.isArray(a.services) ? a.services.filter(Boolean).join(', ') : '';
      const ops = Array.isArray(a.operators) ? a.operators.filter(Boolean).join(', ') : '';
      const code = String(a.public_code || '');
      const pkg = String(a.package_summary || '').trim();
      const prepaid = String(a.prepaid_summary || '').trim();
      const gift = String(a.gift_summary || '').trim();
      const badgeCls = statusBadgeClass(a.status);
      const statusKey = String((a && a.status) ? a.status : '').toLowerCase().trim();
      const canShowCalendar = !!(code && ['pending','scheduled'].includes(statusKey));
      const canCancel = !!(a && a.can_cancel && ['pending','scheduled'].includes(statusKey));
      const cancelButton = canCancel
        ? `<button type="button" class="btn btn-sm btn-outline-danger btn-pill js-cust-cancel-appt" data-id="${escapeHtml(String(a.id || ''))}"><i class="bi bi-x-circle me-1"></i>Annulla</button>`
        : '';
      const badgeLbl = String(a.status_label || a.status || '—');

      const el = document.createElement('div');
      el.className = 'border rounded-3 p-3 bg-white';
      el.innerHTML = `
        <div class="d-flex justify-content-between align-items-start gap-2">
          <div class="booking-min-w-0">
            <div class="fw-semibold text-truncate">${escapeHtml(svc || 'Appuntamento')}</div>
            <div class="text-muted small">${escapeHtml(dateLbl)}</div>
            ${ops ? `<div class="text-muted small">Operatore: ${escapeHtml(ops)}</div>` : ``}
            ${pkg ? `<div class="small fw-semibold mt-1 text-primary"><i class="bi bi-box-seam me-1"></i>${escapeHtml(pkg)}</div>` : ``}
            ${prepaid ? `<div class="small fw-semibold mt-1 text-primary"><i class="bi bi-credit-card-2-front me-1"></i>${escapeHtml(prepaid)}</div>` : ``}
            ${gift ? `<div class="small fw-semibold mt-1 text-primary"><i class="bi bi-gift me-1"></i>${escapeHtml(gift)}</div>` : ``}
            ${code ? `<div class="small mt-2"><span class="badge text-bg-light">Codice</span> <span class="fw-semibold">${escapeHtml(code)}</span></div>` : ``}
          </div>
          <div class="text-end">
            <span class="badge ${badgeCls}">${escapeHtml(badgeLbl)}</span>
            ${canShowCalendar ? `<div class="mt-2"><a class="btn btn-sm btn-outline-secondary btn-pill" href="index.php?page=booking&public=1&mode=ics&code=${encodeURIComponent(code)}"><i class="bi bi-calendar2-plus me-1"></i>ICS</a></div>` : ``}
            ${cancelButton ? `<div class="mt-2">${cancelButton}</div>` : ``}
          </div>
        </div>
      `;
      custApptList.appendChild(el);
    });
  }

  if (custApptList) {
    custApptList.addEventListener('click', async (e) => {
      const btn = e.target && e.target.closest ? e.target.closest('.js-cust-cancel-appt') : null;
      if (!btn) return;
      e.preventDefault();
      const id = parseInt(btn.getAttribute('data-id') || '0', 10);
      if (!id) return;
      if (!confirm('Vuoi annullare questo appuntamento?')) return;

      clearCustError();
      btn.disabled = true;
      try {
        const js = await custFetch('cancel_appointment', 'POST', {appointment_id: String(id)});
        if (!js || !js.ok) {
          showCustError(js && js.error ? js.error : 'Errore annullamento');
          return;
        }
        showCustAlert('Appuntamento annullato.', 'success');
        await refreshCustomerUI();
      } catch (err) {
        showCustError('Errore di rete');
      } finally {
        btn.disabled = false;
      }
    });
  }

  async function refreshCustomerUI(){
    if (!customerAreaBtn || !customerAreaBtnLabel) return;
    hideCustVerify();
    let me = null;
    try {
      me = await custFetch('customer_me', 'GET');
      bookingUser = (me && me.ok) ? (me.user || null) : null;
      if (!bookingUser && me && me.ok === false && me.error) {
        showCustAlert(me.error, 'warning');
      }
    } catch (e) { bookingUser = null; }

    if (bookingUser && bookingUser.email) {
      customerAreaBtnLabel.textContent = 'I miei appuntamenti';
      if (custLoggedOut) custLoggedOut.classList.add('d-none');
      if (custLoggedIn) custLoggedIn.classList.remove('d-none');
      if (custHello) custHello.textContent = bookingUser.full_name ? ('Ciao, ' + bookingUser.full_name) : 'Ciao!';
      if (custEmail) custEmail.textContent = bookingUser.email || '';
      fillClientStepFromUser(bookingUser);

      try {
        const js = await custFetch('my_appointments', 'GET');
        if (js && js.ok) renderAppointments(js.appointments || []);
        else renderAppointments([]);
      } catch (e) {
        renderAppointments([]);
      }
    } else {
      customerAreaBtnLabel.textContent = 'Accedi';
      if (custLoggedOut) custLoggedOut.classList.remove('d-none');
      if (custLoggedIn) custLoggedIn.classList.add('d-none');

      const emailEl = document.getElementById('email');
      if (emailEl) emailEl.readOnly = false;
    }
  }

  if (customerAreaBtn) {
    customerAreaBtn.addEventListener('click', async () => {
      clearCustError();
      await refreshCustomerUI();
      openCustomerModal();
    });
  }

  if (custLogoutBtn) {
    custLogoutBtn.addEventListener('click', async () => {
      clearCustError();
      try {
        const js = await custFetch('customer_logout', 'POST', {});
        if (js && js.ok) {
          // After logout, go back to the public booking home (gate/hub).
          window.location.href = PUBLIC_HOME_URL;
          return;
        }
      } catch (e) {}
    });
  }

  if (custLoginForm) {
    custLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearCustError();
      const fd = new FormData(custLoginForm);
      const email = String(fd.get('email') || '').trim();
      const password = String(fd.get('password') || '');
      try {
        const js = await custFetch('customer_login', 'POST', {email, password});
        if (!js || !js.ok) { showCustError(js && js.error ? js.error : 'Accesso non riuscito'); return; }
        if (js.requires_verification) {
          showCustVerify(js.email || email);
          return;
        }
        await refreshCustomerUI();
      } catch (err) { showCustError('Errore di rete'); }
    });
  }

  if (custRegisterForm) {
    custRegisterForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearCustError();
      const fd = new FormData(custRegisterForm);
      const first_name = String(fd.get('first_name') || '').trim();
      const last_name = String(fd.get('last_name') || '').trim();
      const full_name = (first_name + ' ' + last_name).trim();
      const phone = String(fd.get('phone') || '').trim();
      const email = String(fd.get('email') || '').trim();
      const password = String(fd.get('password') || '');
      const password2 = String(fd.get('password2') || '');
      const location_id = String(fd.get('location_id') || document.getElementById('location_id')?.value || document.getElementById('locationSelect')?.value || '').trim();

      if (!first_name || !last_name) { showCustError('Compila nome e cognome.'); return; }
      if (custRegisterForm.querySelector('[name="location_id"]') && !location_id) { showCustError('Seleziona la sede di riferimento.'); return; }
      if (password !== password2) { showCustError('Le password non coincidono.'); return; }

      try {
        const js = await custFetch('customer_register', 'POST', {first_name, last_name, full_name, phone, email, password, location_id});
        if (!js || !js.ok) { showCustError(js && js.error ? js.error : 'Registrazione non riuscita'); return; }
        if (js.requires_verification) {
          showCustVerify(js.email || email);
          return;
        }
        await refreshCustomerUI();
      } catch (err) { showCustError('Errore di rete'); }
    });
  }

  // Hai dimenticato la password?
  if (custForgotBtn) {
    custForgotBtn.addEventListener('click', (e) => {
      e.preventDefault();
      clearCustError();
      let em = '';
      try {
        em = String(custLoginForm ? new FormData(custLoginForm).get('email') : '').trim();
      } catch (e2) { em = ''; }
      showCustForgot(em);
    });
  }
  if (custBackFromForgotBtn) {
    custBackFromForgotBtn.addEventListener('click', (e) => {
      e.preventDefault();
      hideCustForgot();
    });
  }
  if (custForgotForm) {
    custForgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearCustError();
      const email = String(new FormData(custForgotForm).get('email') || '').trim();
      try {
        const js = await custFetch('customer_forgot_password', 'POST', {email});
        if (!js || !js.ok) { showCustError(js && js.error ? js.error : 'Impossibile inviare il link'); return; }
        showCustAlert(js.message || 'Se l’email esiste, riceverai un link per reimpostare la password.', 'success');
        hideCustForgot();
        // Torna alla tab login
        try { document.getElementById('tab-login')?.click(); } catch (e2) {}
      } catch (err) {
        showCustError('Errore di rete');
      }
    });
  }

  // Verifica email
  if (custBackToAuthBtn) {
    custBackToAuthBtn.addEventListener('click', (e) => {
      e.preventDefault();
      hideCustVerify();
    });
  }
  if (custResendCodeBtn) {
    custResendCodeBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      clearCustError();
      try {
        const js = await custFetch('customer_resend_code', 'POST', {});
        if (!js || !js.ok) { showCustError(js && js.error ? js.error : 'Impossibile reinviare il codice'); return; }
        // Update the inline note inside the verify box
        try {
          const note = document.getElementById('custVerifySentMsg');
          if (note) note.textContent = 'Codice reinviato. Controlla la tua email (anche spam).';
        } catch(e) {}
        if (js.email && custVerifyEmail) custVerifyEmail.textContent = js.email;
      } catch (e2) {
        showCustError('Errore di rete');
      }
    });
  }
  if (custVerifyForm) {
    custVerifyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearCustError();
      const code = String(new FormData(custVerifyForm).get('code') || '').trim();
      try {
        const js = await custFetch('customer_verify_code', 'POST', {code});
        if (!js || !js.ok) { showCustError(js && js.error ? js.error : 'Verifica non riuscita'); return; }
        hideCustVerify();
        await refreshCustomerUI();
      } catch (e2) {
        showCustError('Errore di rete');
      }
    });
  }

  // Aggiorna UI al caricamento pagina: label bottone e precompilazione (se già loggato)
  refreshCustomerUI();


  function applyInitialServiceIdsFromUrl(){
    const raw = String(initialServiceIds || '').trim();
    if (!raw || !serviceIdsInput || !serviceCards.length) return false;

    const cardsById = new Map();
    serviceCards.forEach(card => {
      const id = String(card.dataset.id || '').trim();
      if (id) cardsById.set(id, card);
    });

    const ids = [];
    raw.split(',').map(v => String(v || '').trim()).forEach(id => {
      if (!id || !cardsById.has(id) || ids.includes(id)) return;
      ids.push(id);
    });
    if (!ids.length) return false;

    const firstCard = cardsById.get(ids[0]);
    const firstCategory = firstCard ? String(firstCard.dataset.cat || '').trim() : '';
    if (firstCategory) {
      selectedCategoryId = firstCategory;
      catCards.forEach(card => card.classList.toggle('active', String(card.dataset.id || '') === firstCategory));
      filterServicesByCategory(firstCategory);
      syncCategoryTabs();
      updateServiceSectionHeading();
    }

    selectedServices.clear();
    selectedServiceOrder = [];
    selectedStaffByService = {};
    serviceCards.forEach(card => card.classList.remove('active'));
    ids.forEach(id => {
      selectedServices.add(id);
      selectedServiceOrder.push(id);
      const card = cardsById.get(id);
      if (card) card.classList.add('active');
    });

    serviceIdsInput.value = getOrderedSelectedServiceIds().join(',');
    syncResidualInputs();
    syncStaffMapInput();
    renderRecommended();
    scheduleStaffRefresh();
    return true;
  }

  // initial state
  if (locationSelect && locationIdInput && !locationIdInput.value) {
    locationIdInput.value = locationSelect.value;
  }
  syncLocationCards();
  applyInitialServiceIdsFromUrl();
  if (RESIDUAL_REQUESTED && !residualFlowActive()) {
    showStep(1);
    if (btnNext) btnNext.disabled = true;
    if (btnNextSummary) btnNextSummary.disabled = true;
    updateSummary();
    return;
  }
  if (residualFlowActive()) {
    showStep(1);
    Promise.resolve()
      .then(() => advanceResidualBookingFlow(initialBookingStep))
      .catch(() => {});
  } else {
    showStep(initialBookingStep);
  }
  updateSummary();
})();
