(function(){
  function qs(sel){ return document.querySelector(sel); }
  function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }
  function on(el, ev, fn){ if(el) el.addEventListener(ev, fn); }

  function escHtml(s){
    return String(s||'').replace(/[&<>\"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]||m));
  }

  function appInlineLoadingHtml(message, classes){
    const text = String(message || 'Caricamento...').trim() || 'Caricamento...';
    const cls = String(classes || 'small p-2').trim() || 'small p-2';
    return `<div class="app-inline-loading text-muted ${escHtml(cls)}" role="status" aria-live="polite"><span class="spinner-border spinner-border-sm text-primary qb-inline-loader" aria-hidden="true"></span><span>${escHtml(text)}</span></div>`;
  }


  // Toast notifications (Bootstrap 5)
  function notify(message, variant='info'){
    const container = qs('#appToastContainer') || document.body;
    const v = String(variant || 'info');
    const bgClass = ['primary','secondary','success','danger','warning','info','light','dark'].includes(v) ? `text-bg-${v}` : 'text-bg-info';

    const el = document.createElement('div');
    el.className = `toast align-items-center ${bgClass} border-0 app-toast`;
    el.setAttribute('role','alert');
    el.setAttribute('aria-live','assertive');
    el.setAttribute('aria-atomic','true');
    el.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">${escHtml(message)}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Chiudi"></button>
      </div>
    `;
    container.appendChild(el);

    try{
      const t = bootstrap.Toast.getOrCreateInstance(el, { delay: 4500 });
      el.addEventListener('hidden.bs.toast', () => el.remove());
      t.show();
    } catch(e){
      // Fallback (no bootstrap)
      el.style.display = 'block';
      setTimeout(()=>{ el.remove(); }, 4500);
    }
  }


  // Sidebar toggle (mobile + desktop collapse + submenus)
  const openBtn = qs('#sidebarOpen');
  const closeBtn = qs('#sidebarClose');
  const backdrop = qs('#sidebarBackdrop');
  const desktopToggle = qs('#sidebarDesktopToggle');
  const sidebarEl = qs('#sidebar');
  const SIDEBAR_COLLAPSE_KEY = 'beautysuite_sidebar_collapsed';
  let sidebarFlyout = null;
  let sidebarFlyoutParent = null;

  function openSidebar(){ document.body.classList.add('sidebar-open'); }
  function closeSidebar(){ document.body.classList.remove('sidebar-open'); }
  function isSidebarCollapsed(){ return window.innerWidth > 992 && document.body.classList.contains('sidebar-collapsed'); }

  function sidebarLabelFor(item){
    if(!item) return '';
    const existing = String(item.getAttribute('data-label') || item.getAttribute('title') || '').trim();
    if(existing) return existing;
    const clone = item.cloneNode(true);
    clone.querySelectorAll('i,.sidebar-chevron').forEach(el => el.remove());
    return String(clone.textContent || '').trim();
  }

  function escAttr(s){ return escHtml(s).replace(/'/g, '&#039;'); }

  function hydrateSidebarLabels(){
    if(!sidebarEl) return;
    sidebarEl.querySelectorAll('.nav-item').forEach(function(item){
      const label = sidebarLabelFor(item);
      if(label){
        item.setAttribute('data-label', label);
        item.setAttribute('title', label);
      }
    });
  }

  function closeSidebarFlyout(){
    if(sidebarFlyout){
      sidebarFlyout.remove();
      sidebarFlyout = null;
    }
    if(sidebarFlyoutParent) sidebarFlyoutParent.classList.remove('is-flyout-open');
    sidebarFlyoutParent = null;
  }

  function setExpandedSubmenu(parent, open){
    if(!parent || !parent.__submenuWrapper) return;
    parent.classList.toggle('is-submenu-open', !!open);
    parent.setAttribute('aria-expanded', open ? 'true' : 'false');
    parent.__submenuWrapper.hidden = !open;
    parent.__submenuWrapper.classList.toggle('is-open', !!open);
    const icon = parent.querySelector('.sidebar-chevron i');
    if(icon) icon.className = open ? 'bi bi-chevron-up' : 'bi bi-chevron-down';
  }

  function buildSidebarSubmenus(){
    if(!sidebarEl || sidebarEl.dataset.submenusReady === '1') return;
    sidebarEl.dataset.submenusReady = '1';

    sidebarEl.querySelectorAll('.nav-section').forEach(function(section){
      let el = section.firstElementChild;
      while(el){
        if(el.classList && el.classList.contains('nav-item') && !el.classList.contains('nav-subitem')){
          const parent = el;
          const children = [];
          let next = parent.nextElementSibling;
          while(next && next.classList && next.classList.contains('nav-item') && next.classList.contains('nav-subitem')){
            children.push(next);
            next = next.nextElementSibling;
          }

          if(children.length){
            parent.classList.add('has-submenu');
            parent.setAttribute('aria-haspopup', 'true');
            parent.setAttribute('aria-expanded', 'false');

            if(!parent.querySelector('.sidebar-chevron')){
              const chev = document.createElement('span');
              chev.className = 'sidebar-chevron';
              chev.setAttribute('aria-hidden', 'true');
              chev.innerHTML = '<i class="bi bi-chevron-down"></i>';
              parent.appendChild(chev);
            }

            const wrapper = document.createElement('div');
            wrapper.className = 'sidebar-submenu';
            wrapper.hidden = true;
            parent.after(wrapper);
            children.forEach(function(child){
              child.classList.add('submenu-child');
              wrapper.appendChild(child);
            });
            parent.__submenuWrapper = wrapper;

            const activeChild = children.some(child => child.classList.contains('active'));
            if(activeChild) parent.classList.add('has-active-child');
            setExpandedSubmenu(parent, activeChild);
          }
          el = next;
        } else {
          el = el.nextElementSibling;
        }
      }
    });
  }

  function renderCollapsedFlyout(parent){
    if(!parent || !parent.__submenuWrapper) return;
    const isSameOpen = sidebarFlyout && sidebarFlyoutParent === parent;
    closeSidebarFlyout();
    if(isSameOpen) return;

    const label = sidebarLabelFor(parent) || 'Menu';
    const parentHref = parent.getAttribute('href') || '#';
    const parentIcon = parent.querySelector('i');
    const iconClass = parentIcon ? parentIcon.className : 'bi bi-circle';
    const childLinks = Array.from(parent.__submenuWrapper.querySelectorAll('.nav-subitem')).map(function(child){
      const href = child.getAttribute('href') || '#';
      const childLabel = sidebarLabelFor(child);
      const childIcon = child.querySelector('i');
      const childIconClass = childIcon ? childIcon.className : 'bi bi-dot';
      const active = child.classList.contains('active') ? ' is-active' : '';
      return '<a class="sidebar-flyout__item'+active+'" href="'+escAttr(href)+'"><i class="'+escAttr(childIconClass)+'"></i><span>'+escHtml(childLabel)+'</span></a>';
    }).join('');

    sidebarFlyout = document.createElement('div');
    sidebarFlyout.className = 'sidebar-flyout';
    sidebarFlyout.innerHTML = ''+
      '<a class="sidebar-flyout__main" href="'+escAttr(parentHref)+'"><i class="'+escAttr(iconClass)+'"></i><span>'+escHtml(label)+'</span></a>'+
      '<div class="sidebar-flyout__items">'+childLinks+'</div>';
    document.body.appendChild(sidebarFlyout);
    sidebarFlyoutParent = parent;
    parent.classList.add('is-flyout-open');

    const pr = parent.getBoundingClientRect();
    const sr = sidebarEl ? sidebarEl.getBoundingClientRect() : { right: 72 };
    sidebarFlyout.style.left = Math.round(sr.right + 12) + 'px';
    sidebarFlyout.style.top = '0px';
    const top = Math.max(12, Math.min(Math.round(pr.top - 8), window.innerHeight - sidebarFlyout.offsetHeight - 12));
    sidebarFlyout.style.top = Math.round(top) + 'px';
  }

  function setSidebarCollapsed(collapsed){
    const enabled = !!collapsed && window.innerWidth > 992;
    document.documentElement.classList.remove('sidebar-collapsed-initial');
    document.body.classList.toggle('sidebar-collapsed', enabled);
    closeSidebarFlyout();
    if(desktopToggle){
      desktopToggle.setAttribute('aria-expanded', String(!enabled));
      desktopToggle.setAttribute('aria-label', enabled ? 'Espandi sidebar' : 'Comprimi sidebar');
      const icon = desktopToggle.querySelector('i');
      if(icon) icon.className = enabled ? 'bi bi-chevron-right' : 'bi bi-chevron-left';
    }
  }

  function syncSidebarPreference(){
    let collapsed = false;
    try { collapsed = localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === '1'; } catch(e) {}
    setSidebarCollapsed(collapsed);
  }

  hydrateSidebarLabels();
  buildSidebarSubmenus();
  syncSidebarPreference();
  document.documentElement.classList.remove('sidebar-js-pending');

  on(openBtn, 'click', openSidebar);
  on(closeBtn, 'click', closeSidebar);
  on(backdrop, 'click', closeSidebar);
  on(desktopToggle, 'click', function(){
    const next = !document.body.classList.contains('sidebar-collapsed');
    setSidebarCollapsed(next);
    try { localStorage.setItem(SIDEBAR_COLLAPSE_KEY, next ? '1' : '0'); } catch(e) {}
  });

  if(sidebarEl){
    sidebarEl.addEventListener('click', function(ev){
      const parent = ev.target.closest('.nav-item.has-submenu');
      if(!parent || !sidebarEl.contains(parent)) return;

      if(isSidebarCollapsed()){
        ev.preventDefault();
        ev.stopPropagation();
        renderCollapsedFlyout(parent);
        return;
      }

      if(ev.target.closest('.sidebar-chevron')){
        ev.preventDefault();
        ev.stopPropagation();
        setExpandedSubmenu(parent, !parent.classList.contains('is-submenu-open'));
      }
    });
  }

  on(window, 'resize', function(){
    if(window.innerWidth <= 992) document.body.classList.remove('sidebar-collapsed');
    else syncSidebarPreference();
    closeSidebarFlyout();
  });

  document.addEventListener('click', function(ev){
    if(!sidebarFlyout) return;
    if(sidebarFlyout.contains(ev.target)) return;
    if(sidebarEl && sidebarEl.contains(ev.target)) return;
    closeSidebarFlyout();
  });

  // Quick booking offcanvas (uses api_appointments)
  document.addEventListener('DOMContentLoaded', function(){
    const form = qs('#quickBookingForm');
    if(!form) return;
    // Prevent double-initialization when app.js is included more than once.
    if(window.__qb_initialized) return;
    window.__qb_initialized = true;

    const csrf = (qs('meta[name="csrf-token"]')||{}).content || '';
    const msRoot = qs('#qb_services_ms');
    const msControl = qs('#qb_ms_control');
    const msDropdown = qs('#qb_ms_dropdown');
    const msList = qs('#qb_ms_list');
    const pillsEl = qs('#qb_ms_pills');
    const placeholderEl = qs('#qb_ms_placeholder');
    const hiddenIdsContainer = qs('#qb_service_ids_container');
    const serviceSearch = qs('#qb_service_search');

    function getAllServiceChecks(){
      return msRoot ? Array.from(msRoot.querySelectorAll('.qb-ms-check')) : [];
    }

    // Avoid relying on CSS.escape (missing in some browsers / embedded webviews).
    // Service IDs are numeric here, so a simple linear scan is safe and robust.
    function findServiceCheckById(serviceId){
      const sid = String(serviceId || '');
      if(!sid) return null;
      const checks = getAllServiceChecks();
      for(const ch of checks){
        if(String(ch.value) === sid) return ch;
      }
      return null;
    }
    // Visible date/time fields
    const qbDate = qs('#qb_date');
    const qbStartTime = qs('#qb_start_time');
    const qbEndTime = qs('#qb_end_time');
    // Hidden datetime-local fields (names used by backend/API)
    const starts = qs('#qb_starts');
    const ends = qs('#qb_ends');
    const cabinSel = form.querySelector('select[name="cabin_id"]') || qs('#qb_cabin_id');
    const cabinHintEl = qs('#qb_cabin_hint');
    const staffSel = form.querySelector('select[name="staff_id"]');
    const staffHintEl = qs('#qb_staff_hint');
    const staffInitialHtml = staffSel ? staffSel.innerHTML : '';
    const staffSummaryBox = qs('#qbStaffSummaryBox');
    const staffSummaryHint = qs('#qbStaffSummaryHint');
    const staffMapInput = qs('#qb_staff_map');
    const cabinMapInput = qs('#qb_cabin_map');
    const holdTokenInput = qs('#qb_appointment_hold_token');
    const qbHoldCountdownEl = qs('#qbHoldCountdown');
    const multiStaffPicker = qs('#qbMultiStaffPicker');
    const locationSel = form.querySelector('select[name="location_id"]');
    const statusSel = form.querySelector('select[name="status"]');
    const statusSelInitialHtml = statusSel ? statusSel.innerHTML : '';
    const staffNotesEl = form.querySelector('input[name="staff_notes"], textarea[name="staff_notes"]');
    const customerNotesEl = form.querySelector('input[name="customer_notes"], textarea[name="customer_notes"]');

    const offcanvasEl = qs('#quickBooking');
    const titleEl = qs('#quickBookingLabel');
    const qbBookingCodeRow = qs('#qbBookingCodeRow');
    const qbBookingCode = qs('#qbBookingCode');
    const qbExpiredLinkedAlertEl = qs('#qbExpiredLinkedAlert');
    const submitTextEl = qs('#qbSubmitText');
    const submitBtn = qs('#qbSubmitBtn');
    const deleteBtn = qs('#qbDeleteBtn');
    const apptIdEl = qs('#qb_appt_id');
    const segmentIdEl = qs('#qb_segment_id');
    const segmentOldStartsEl = qs('#qb_segment_old_starts');
    const segmentOldEndsEl = qs('#qb_segment_old_ends');
    const segmentAlertEl = qs('#qbSegmentViewAlert');
    const qbCancellationAlertEl = qs('#qbCancellationAlert');
    const qbLoadingState = qs('#qbLoadingState');
    const qbLoadingText = qs('#qbLoadingText');
    const qbLoadErrorState = qs('#qbLoadErrorState');
    const qbLoadErrorText = qs('#qbLoadErrorText');
    const qbLoadRetryBtn = qs('#qbLoadRetryBtn');

    // Quick booking: Trova cliente (seleziona cliente esistente)
    const qbClientId = qs('#qb_client_id');
    const qbNewBox = qs('#qbNewClientBox');
    const qbSelBox = qs('#qbSelectedClientBox');
    const qbSelName = qs('#qbSelName');
    const qbSelEmail = qs('#qbSelEmail');
    const qbSelPhone = qs('#qbSelPhone');
    const qbClearSel = qs('#qbClearSelectedClient');
    const qbLinkNew = qs('#qbLinkNewClient');
    const qbLinkFind = qs('#qbLinkFindClient');

    // Storico cliente (quick booking)
    const qbHistoryBox = qs('#qbClientHistoryBox');
    const qbHistorySummary = qs('#qbClientHistorySummary');
    const qbHistoryList = qs('#qbClientHistoryList');
    const qbHistoryOpen = qs('#qbClientHistoryOpen');

    // Residui cliente (quick booking)
    const qbResidualsBox = qs('#qbClientResidualsBox');
    const qbResidualsList = qs('#qbClientResidualsList');
    const qbResidualsOpen = qs('#qbClientResidualsOpen');

    // Modal scheda cliente (popup dedicato)
    const qbClientCardModalEl = qs('#qbClientCardModal');
    const qbClientCardBody = qs('#qbClientCardBody');
    const qbClientCardOpenNew = qs('#qbClientCardOpenNew');

    // Modal residui cliente (popup dedicato)
    const qbClientResidualsModalEl = qs('#qbClientResidualsModal');
    const qbClientResidualsBody = qs('#qbClientResidualsBody');
    const qbClientResidualsOpenNew = qs('#qbClientResidualsOpenNew');
    const qbClientResidualsClientLabel = qs('#qbClientResidualsClientLabel');
    const qbClientResidualsEmptyState = qs('#qbClientResidualsEmptyState');
    const qbResidualCreditCard = qs('#qbResidualCreditCard');
    const qbResidualCreditToggle = qs('#qbResidualCreditToggle');
    const qbResidualCreditAvail = qs('#qbResidualCreditAvail');
    const qbResidualCreditAmount = qs('#qbResidualCreditAmount');
    const qbResidualCreditMaxBtn = qs('#qbResidualCreditMaxBtn');
    const qbResidualCreditHint = qs('#qbResidualCreditHint');

    // Modal: dettagli GiftBox collegata ad un servizio (Quick booking)
    const qbGiftboxInfoModalEl = qs('#qbGiftboxInfoModal');
    const qbGiftboxInfoBody = qs('#qbGiftboxInfoBody');
    const qbGiftboxInfoTitle = qs('#qbGiftboxInfoTitle');
    const qbGiftboxInfoOpenNew = qs('#qbGiftboxInfoOpenNew');

    // Modal: dettagli Pacchetto collegato ad un servizio (Quick booking)
    const qbPackageInfoModalEl = qs('#qbPackageInfoModal');
    const qbPackageInfoBody = qs('#qbPackageInfoBody');
    const qbPackageInfoTitle = qs('#qbPackageInfoTitle');
    const qbPackageInfoOpenNew = qs('#qbPackageInfoOpenNew');

    // Modal: dettagli omaggio collegato ad un servizio (Quick booking)
    const qbGiftInfoModalEl = qs('#qbGiftInfoModal');
    const qbGiftInfoBody = qs('#qbGiftInfoBody');
    const qbGiftInfoTitle = qs('#qbGiftInfoTitle');
    const qbGiftInfoOpenNew = qs('#qbGiftInfoOpenNew');

    // Modal: dettagli Servizio prepagato collegato ad un servizio (Quick booking)
    const qbPrepaidServiceInfoModalEl = qs('#qbPrepaidServiceInfoModal');
    const qbPrepaidServiceInfoBody = qs('#qbPrepaidServiceInfoBody');
    const qbPrepaidServiceInfoTitle = qs('#qbPrepaidServiceInfoTitle');
    const qbPrepaidServiceInfoOpenNew = qs('#qbPrepaidServiceInfoOpenNew');

    // Modal: dettagli GiftCard applicata alla prenotazione (Quick booking)
    const qbGiftcardInfoModalEl = qs('#qbGiftcardInfoModal');
    const qbGiftcardInfoBody = qs('#qbGiftcardInfoBody');
    const qbGiftcardInfoTitle = qs('#qbGiftcardInfoTitle');
    const qbGiftcardInfoOpenNew = qs('#qbGiftcardInfoOpenNew');

    // Modal: annulla prenotazione eseguita (quick booking)
    const qbDoneCancelModalEl = qs('#qbDoneCancelModal');
    const qbDoneCancelModalTitle = qs('#qbDoneCancelModalTitle');
    const qbDoneCancelBody = qs('#qbDoneCancelBody');
    const qbDoneCancelConfirmBtn = qs('#qbDoneCancelConfirmBtn');

    // GiftBox: servizi selezionati da riscattare (quick booking)
    const qbGiftboxRedeemInput = qs('#qb_giftbox_redeem');

    // Omaggi: servizi omaggio selezionati/associati all'appuntamento (quick booking)
    const qbGiftRedeemInput = qs('#qb_gift_redeem');

    // Pacchetti: sedute selezionate/associate all'appuntamento (quick booking)
    const qbPackageRedeemInput = qs('#qb_package_redeem');

    // Servizi prepagati: servizi venduti dal POS e collegati all'appuntamento (quick booking)
    const qbPrepaidServiceRedeemInput = qs('#qb_prepaid_service_redeem');

    // GiftCard: credito monetario selezionato da applicare alla prenotazione (quick booking)
    const qbGiftcardRedeemInput = qs('#qb_giftcard_redeem');

    const qbFindModalEl = qs('#qbClientFindModal');
    const qbFindQuery = qs('#qbClientFindQuery');
    const qbFindClear = qs('#qbClientFindClear');
    const qbFindResults = qs('#qbClientFindResults');
    const qbCreateModalEl = qs('#qbClientCreateModal');
    const qbCreateForm = qs('#qbClientCreateForm');
    const qbCreateAlert = qs('#qbClientCreateAlert');
    const qbCreateSubmit = qs('#qbClientCreateSubmit');
    const qbCreateSubmitText = qs('#qbClientCreateSubmitText');
    const qbCreateSpinner = qs('#qbClientCreateSpinner');

    let qbFindModal = null;
    if(qbFindModalEl && window.bootstrap) qbFindModal = new bootstrap.Modal(qbFindModalEl);

    let qbCreateModal = null;
    if(qbCreateModalEl && window.bootstrap) qbCreateModal = new bootstrap.Modal(qbCreateModalEl);

    let qbClientCardModal = null;
    if(qbClientCardModalEl && window.bootstrap) qbClientCardModal = new bootstrap.Modal(qbClientCardModalEl);

    let qbClientResidualsModal = null;
    if(qbClientResidualsModalEl && window.bootstrap) qbClientResidualsModal = new bootstrap.Modal(qbClientResidualsModalEl);

    let qbGiftboxInfoModal = null;
    if(qbGiftboxInfoModalEl && window.bootstrap) qbGiftboxInfoModal = new bootstrap.Modal(qbGiftboxInfoModalEl);

    let qbPackageInfoModal = null;
    if(qbPackageInfoModalEl && window.bootstrap) qbPackageInfoModal = new bootstrap.Modal(qbPackageInfoModalEl);

    let qbGiftInfoModal = null;
    if(qbGiftInfoModalEl && window.bootstrap) qbGiftInfoModal = new bootstrap.Modal(qbGiftInfoModalEl);

    let qbPrepaidServiceInfoModal = null;
    if(qbPrepaidServiceInfoModalEl && window.bootstrap) qbPrepaidServiceInfoModal = new bootstrap.Modal(qbPrepaidServiceInfoModalEl);

    let qbGiftcardInfoModal = null;
    if(qbGiftcardInfoModalEl && window.bootstrap) qbGiftcardInfoModal = new bootstrap.Modal(qbGiftcardInfoModalEl);

    let qbDoneCancelModal = null;
    if(qbDoneCancelModalEl && window.bootstrap) qbDoneCancelModal = new bootstrap.Modal(qbDoneCancelModalEl);

    let qbClientCardReqId = 0;

    let qbClientResidualsReqId = 0;

    let qbGiftboxInfoReqId = 0;

    let qbPackageInfoReqId = 0;

    let qbGiftInfoReqId = 0;

    let qbPrepaidServiceInfoReqId = 0;

    let qbGiftcardInfoReqId = 0;

    function qbReadGiftboxRedeem(){
      if(!qbGiftboxRedeemInput) return [];
      const raw = String(qbGiftboxRedeemInput.value || '').trim();
      if(!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        if(!Array.isArray(parsed)) return [];
        const out = [];
        const seen = new Set();
        for(const it of parsed){
          if(!it || typeof it !== 'object') continue;
          const service_id = parseInt(it.service_id, 10);
          const instance_id = parseInt(it.instance_id, 10);
          const giftbox_item_id = parseInt(it.giftbox_item_id, 10);
          const qty = it.qty !== undefined ? parseInt(it.qty, 10) : 1;
          const redeemed_at = it.redeemed_at || null;
          if(!service_id || !instance_id || !giftbox_item_id) continue;
          const key = service_id + ':' + instance_id + ':' + giftbox_item_id;
          if(seen.has(key)) continue;
          seen.add(key);
          const obj = {
            service_id,
            instance_id,
            giftbox_item_id,
            qty: (qty && qty > 0) ? qty : 1,
            redeemed_at
          };

          // Optional UI enrichment (traceability + sedute)
          const code = (it.giftbox_code !== undefined && it.giftbox_code !== null) ? String(it.giftbox_code) : ((it.gb_code !== undefined && it.gb_code !== null) ? String(it.gb_code) : ((it.code !== undefined && it.code !== null) ? String(it.code) : ''));
          const name = (it.giftbox_name !== undefined && it.giftbox_name !== null) ? String(it.giftbox_name) : ((it.gb_name !== undefined && it.gb_name !== null) ? String(it.gb_name) : '');
          if(code.trim()) obj.giftbox_code = code.trim();
          if(name.trim()) obj.giftbox_name = name.trim();

          const qt = (it.qty_total !== undefined && it.qty_total !== null) ? parseInt(it.qty_total, 10) : ((it.total_qty !== undefined && it.total_qty !== null) ? parseInt(it.total_qty, 10) : NaN);
          const qr = (it.qty_remaining !== undefined && it.qty_remaining !== null) ? parseInt(it.qty_remaining, 10) : ((it.remaining_qty !== undefined && it.remaining_qty !== null) ? parseInt(it.remaining_qty, 10) : NaN);
          const qred = (it.qty_redeemed !== undefined && it.qty_redeemed !== null) ? parseInt(it.qty_redeemed, 10) : ((it.redeemed_qty !== undefined && it.redeemed_qty !== null) ? parseInt(it.redeemed_qty, 10) : NaN);
          if(Number.isFinite(qt) && qt >= 0) obj.qty_total = qt;
          if(Number.isFinite(qr) && qr >= 0) obj.qty_remaining = qr;
          if(Number.isFinite(qred) && qred >= 0) obj.qty_redeemed = qred;

          out.push(obj);
        }
        return out;
      } catch(e){
        return [];
      }
    }


    function qbReadGiftRedeem(){
      if(!qbGiftRedeemInput) return [];
      const raw = String(qbGiftRedeemInput.value || '').trim();
      if(!raw) return [];
      try{
        const parsed = JSON.parse(raw);
        if(!Array.isArray(parsed)) return [];
        const out = [];
        const seen = new Set();
        for(const it of parsed){
          if(!it || typeof it !== 'object') continue;
          const service_id = parseInt(it.service_id, 10);
          const instance_id = parseInt(it.instance_id, 10);
          const gift_id = parseInt(it.gift_id, 10);
          const reward_item_index = parseInt(it.reward_item_index, 10);
          const qty = it.qty !== undefined ? parseInt(it.qty, 10) : 1;
          const redeemed_at = it.redeemed_at || null;
          if(!service_id || !instance_id) continue;
          const key = service_id + ':' + instance_id + ':' + reward_item_index;
          if(seen.has(key)) continue;
          seen.add(key);
          const obj = {
            service_id,
            instance_id,
            reward_item_index: Number.isFinite(reward_item_index) ? reward_item_index : 0,
            qty: (qty && qty > 0) ? qty : 1,
            redeemed_at
          };
          if(Number.isFinite(gift_id) && gift_id > 0) obj.gift_id = gift_id;
          const serviceName = (it.service_name !== undefined && it.service_name !== null) ? String(it.service_name) : '';
          if(serviceName.trim()) obj.service_name = serviceName.trim();
          const giftName = (it.gift_name !== undefined && it.gift_name !== null) ? String(it.gift_name) : '';
          if(giftName.trim()) obj.gift_name = giftName.trim();
          const dur = (it.service_duration_min !== undefined && it.service_duration_min !== null) ? parseInt(it.service_duration_min, 10) : NaN;
          if(Number.isFinite(dur) && dur > 0) obj.service_duration_min = dur;
          const price = (it.service_price_locked !== undefined && it.service_price_locked !== null) ? parseFloat(String(it.service_price_locked).replace(',', '.')) : NaN;
          if(Number.isFinite(price)) obj.service_price_locked = price;
          const snapActive = (it.snapshot_is_active !== undefined && it.snapshot_is_active !== null) ? parseInt(it.snapshot_is_active, 10) : NaN;
          if(Number.isFinite(snapActive)) obj.snapshot_is_active = snapActive > 0 ? 1 : 0;
          const currActive = (it.current_is_active !== undefined && it.current_is_active !== null) ? parseInt(it.current_is_active, 10) : NaN;
          if(Number.isFinite(currActive)) obj.current_is_active = currActive > 0 ? 1 : 0;
          const noOp = (it.no_operator !== undefined && it.no_operator !== null) ? parseInt(it.no_operator, 10) : NaN;
          if(Number.isFinite(noOp)) obj.no_operator = noOp > 0 ? 1 : 0;
          const qtyTot = (it.qty_total !== undefined && it.qty_total !== null) ? parseInt(it.qty_total, 10) : NaN;
          if(Number.isFinite(qtyTot) && qtyTot > 0) obj.qty_total = qtyTot;
          const qtyRem = (it.qty_remaining !== undefined && it.qty_remaining !== null) ? parseInt(it.qty_remaining, 10) : NaN;
          if(Number.isFinite(qtyRem) && qtyRem >= 0) obj.qty_remaining = qtyRem;
          out.push(obj);
        }
        return out;
      }catch(_){
        return [];
      }
    }

    function qbReadPackageRedeem(){
      if(!qbPackageRedeemInput) return [];
      const raw = String(qbPackageRedeemInput.value || '').trim();
      if(!raw) return [];
      try{
        const parsed = JSON.parse(raw);
        if(!Array.isArray(parsed)) return [];
        const out = [];
        const seen = new Set();
        for(const it of parsed){
          if(!it || typeof it !== 'object') continue;
          const service_id = parseInt(it.service_id, 10);
          const client_package_id = parseInt(it.client_package_id, 10);
          const qty = it.qty !== undefined ? parseInt(it.qty, 10) : 1;
          const redeemed_at = it.redeemed_at || null;
          if(!service_id || !client_package_id) continue;
          const key = service_id + ':' + client_package_id;
          if(seen.has(key)) continue;
          seen.add(key);

          const obj = {
            service_id,
            client_package_id,
            qty: (qty && qty > 0) ? qty : 1,
            redeemed_at
          };

          // Optional UI enrichment
          const nm = (it.package_name !== undefined && it.package_name !== null) ? String(it.package_name) : ((it.client_package_name !== undefined && it.client_package_name !== null) ? String(it.client_package_name) : '');
          if(nm.trim()) obj.package_name = nm.trim();

          const exp = (it.expires_at !== undefined && it.expires_at !== null) ? String(it.expires_at) : '';
          if(exp.trim()) obj.expires_at = exp.trim();

          const st = (it.status !== undefined && it.status !== null) ? String(it.status) : '';
          if(st.trim()) obj.status = st.trim();

          const qt = (it.sessions_total !== undefined && it.sessions_total !== null) ? parseInt(it.sessions_total, 10) : NaN;
          const qr = (it.sessions_remaining !== undefined && it.sessions_remaining !== null) ? parseInt(it.sessions_remaining, 10) : NaN;
          if(Number.isFinite(qt) && qt >= 0) obj.sessions_total = qt;
          if(Number.isFinite(qr) && qr >= 0) obj.sessions_remaining = qr;

          const pid = (it.client_package_service_id !== undefined && it.client_package_service_id !== null) ? parseInt(it.client_package_service_id, 10) : NaN;
          if(Number.isFinite(pid) && pid > 0) obj.client_package_service_id = pid;

          out.push(obj);
        }
        return out;
      }catch(_){
        return [];
      }
    }

    function qbReadPrepaidServiceRedeem(){
      if(!qbPrepaidServiceRedeemInput) return [];
      const raw = String(qbPrepaidServiceRedeemInput.value || '').trim();
      if(!raw) return [];
      try{
        const parsed = JSON.parse(raw);
        if(!Array.isArray(parsed)) return [];
        const out = [];
        const seen = new Set();
        for(const it of parsed){
          if(!it || typeof it !== 'object') continue;
          const service_id = parseInt(it.service_id, 10);
          const prepaid_service_id = parseInt((it.client_prepaid_service_id !== undefined ? it.client_prepaid_service_id : it.prepaid_service_id), 10);
          const qty = it.qty !== undefined ? parseInt(it.qty, 10) : 1;
          const redeemed_at = it.redeemed_at || null;
          if(!service_id || !prepaid_service_id) continue;
          const key = service_id + ':' + prepaid_service_id;
          if(seen.has(key)) continue;
          seen.add(key);
          const obj = {
            service_id,
            client_prepaid_service_id: prepaid_service_id,
            prepaid_service_id,
            qty: (qty && qty > 0) ? qty : 1,
            redeemed_at
          };
          const name = (it.service_name !== undefined && it.service_name !== null) ? String(it.service_name) : '';
          if(name.trim()) obj.service_name = name.trim();
          const qt = (it.purchased_qty !== undefined && it.purchased_qty !== null) ? parseInt(it.purchased_qty, 10) : NaN;
          const qr = (it.remaining_qty !== undefined && it.remaining_qty !== null) ? parseInt(it.remaining_qty, 10) : NaN;
          if(Number.isFinite(qt) && qt >= 0) obj.purchased_qty = qt;
          if(Number.isFinite(qr) && qr >= 0) obj.remaining_qty = qr;
          const up = (it.unit_price !== undefined && it.unit_price !== null) ? parseFloat(String(it.unit_price).replace(',', '.')) : NaN;
          if(Number.isFinite(up)) obj.unit_price = up;
          const saleId = (it.sale_id !== undefined && it.sale_id !== null) ? parseInt(it.sale_id, 10) : NaN;
          if(Number.isFinite(saleId) && saleId > 0) obj.sale_id = saleId;
          out.push(obj);
        }
        return out;
      }catch(_){
        return [];
      }
    }

    function qbReadGiftcardRedeem(){
      if(!qbGiftcardRedeemInput) return [];
      const raw = String(qbGiftcardRedeemInput.value || '').trim();
      if(!raw) return [];
      try{
        const parsed = JSON.parse(raw);
        if(!Array.isArray(parsed)) return [];
        const out = [];
        const seen = new Set();
        for(const it of parsed){
          if(!it || typeof it !== 'object') continue;
          const giftcard_id = parseInt((it.giftcard_id !== undefined ? it.giftcard_id : it.id), 10);
          let amountRaw = (it.amount !== undefined && it.amount !== null) ? String(it.amount) : ((it.use !== undefined && it.use !== null) ? String(it.use) : '0');
          amountRaw = amountRaw.replace(',', '.');
          const amountNum = parseFloat(amountRaw);
          if(!giftcard_id || !(amountNum > 0)) continue;
          if(seen.has(giftcard_id)) continue;
          seen.add(giftcard_id);
          const obj = { giftcard_id, amount: Math.round(amountNum * 100) / 100 };
          const code = (it.code !== undefined && it.code !== null) ? String(it.code) : ((it.giftcard_code !== undefined && it.giftcard_code !== null) ? String(it.giftcard_code) : '');
          if(code.trim()) obj.code = code.trim();
          out.push(obj);
        }
        return out;
      }catch(_){
        return [];
      }
    }

    function qbWritePrepaidServiceRedeem(list){
      if(!qbPrepaidServiceRedeemInput) return;
      if(!Array.isArray(list) || !list.length){
        qbPrepaidServiceRedeemInput.value = '';
        return;
      }
      qbPrepaidServiceRedeemInput.value = JSON.stringify(list);
    }

    function qbWriteGiftcardRedeem(list){
      if(!qbGiftcardRedeemInput) return;
      if(!Array.isArray(list) || !list.length){
        qbGiftcardRedeemInput.value = '';
        return;
      }
      qbGiftcardRedeemInput.value = JSON.stringify(list);
    }

    function qbWriteGiftboxRedeem(list){
      if(!qbGiftboxRedeemInput) return;
      if(!Array.isArray(list) || !list.length){
        qbGiftboxRedeemInput.value = '';
        return;
      }
      qbGiftboxRedeemInput.value = JSON.stringify(list);
    }


    function qbWriteGiftRedeem(list){
      if(!qbGiftRedeemInput) return;
      if(!Array.isArray(list) || !list.length){
        qbGiftRedeemInput.value = '';
        return;
      }
      qbGiftRedeemInput.value = JSON.stringify(list);
    }

        function qbWritePackageRedeem(list){
      if(!qbPackageRedeemInput) return;
      if(!Array.isArray(list) || !list.length){
        qbPackageRedeemInput.value = '';
        return;
      }
      qbPackageRedeemInput.value = JSON.stringify(list);
    }

    function qbResetResidualRedeemState(){
      qbWriteGiftboxRedeem([]);
      qbWriteGiftRedeem([]);
      qbWritePackageRedeem([]);
      qbWritePrepaidServiceRedeem([]);
      qbWriteGiftcardRedeem([]);
      if(qbCreditUseInput) qbCreditUseInput.value = '0';
      if(qbCreditFromBookingInput) qbCreditFromBookingInput.value = '0';
      try{ qbSyncResidualCreditUi(); }catch(_){ }
    }

    // Verifica backend: residui già associati ad altre prenotazioni (pending/scheduled)
    // Usato dalla modale "Residui" prima di applicare GiftBox/Pacchetti/Servizi alla prenotazione.
    async function qbCheckResidualsConflicts(kind, items){
    const body = new URLSearchParams();
    // CSRF (best-effort): l'API in POST verifica il token.
    if(csrf) body.append('_csrf', csrf);

    // In modifica appuntamento, escludiamo l'id corrente dal controllo
    try{
    const ex = (typeof qbGetExcludeId === 'function') ? String(qbGetExcludeId() || '').trim() : '';
    if(ex) body.append('appointment_id', ex);
    }catch(_){ }

    try{
    if(kind === 'giftbox'){
    body.append('giftbox_redeem', JSON.stringify(Array.isArray(items) ? items : []));
    }else if(kind === 'package'){
    body.append('package_redeem', JSON.stringify(Array.isArray(items) ? items : []));
    }else if(kind === 'service'){
    body.append('prepaid_service_redeem', JSON.stringify(Array.isArray(items) ? items : []));
    }else if(kind === 'gift'){
    body.append('gift_redeem', JSON.stringify(Array.isArray(items) ? items : []));
    }else{
    // mixed payload
    const gb = (items && items.giftbox) ? items.giftbox : [];
    const pk = (items && items.package) ? items.package : [];
    const ps = (items && items.service) ? items.service : [];
    const og = (items && items.gift) ? items.gift : [];
    body.append('giftbox_redeem', JSON.stringify(Array.isArray(gb) ? gb : []));
    body.append('package_redeem', JSON.stringify(Array.isArray(pk) ? pk : []));
    body.append('prepaid_service_redeem', JSON.stringify(Array.isArray(ps) ? ps : []));
    body.append('gift_redeem', JSON.stringify(Array.isArray(og) ? og : []));
    }

    const res = await fetch('index.php?page=api_appointments&action=qb_residui_check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    credentials: 'same-origin',
    body: body.toString()
    });
    const j = await res.json().catch(()=>null);
    if(!j || !j.ok){
    const msg = (j && j.error) ? String(j.error) : 'Errore durante la verifica dei residui.';
    return { ok:false, error: msg };
    }
    return j;
    }catch(_){
    return { ok:false, error: 'Errore di rete durante la verifica dei residui.' };
    }
    }




    function qbSelectedServiceIdsSet(){
      const set = new Set();
      const checks = getAllServiceChecks();
      for(const ch of checks){
        if(ch.checked){
          const id = parseInt(ch.value, 10);
          if(id) set.add(id);
        }
      }
      return set;
    }

    function qbPruneGiftboxRedeemBySelectedServices(){
      if(!qbGiftboxRedeemInput) return;
      const list = qbReadGiftboxRedeem();
      if(!list.length){
        qbWriteGiftboxRedeem([]);
        return;
      }
      const selected = qbSelectedServiceIdsSet();
      const pruned = list.filter(it => selected.has(it.service_id));
      // Dedup by service_id: keep last occurrence
      const bySvc = new Map();
      for(const it of pruned){
        bySvc.set(it.service_id, it);
      }
      qbWriteGiftboxRedeem(Array.from(bySvc.values()));
    }


    function qbPruneGiftRedeemBySelectedServices(){
      if(!qbGiftRedeemInput) return;
      const list = qbReadGiftRedeem();
      if(!list.length){
        qbWriteGiftRedeem([]);
        return;
      }
      const selected = qbSelectedServiceIdsSet();
      const pruned = list.filter(it => selected.has(it.service_id));
      const bySvc = new Map();
      for(const it of pruned){
        bySvc.set(it.service_id, it);
      }
      qbWriteGiftRedeem(Array.from(bySvc.values()));
    }

    function qbPrunePackageRedeemBySelectedServices(){
      if(!qbPackageRedeemInput) return;
      const list = qbReadPackageRedeem();
      if(!list.length){
        qbWritePackageRedeem([]);
        return;
      }
      const selected = qbSelectedServiceIdsSet();
      const pruned = list.filter(it => selected.has(it.service_id));
      // Dedup by service_id (a service can belong to a single package for traceability)
      const bySvc = new Map();
      for(const it of pruned){
        bySvc.set(it.service_id, it);
      }
      qbWritePackageRedeem(Array.from(bySvc.values()));
    }

    function qbPrunePrepaidServiceRedeemBySelectedServices(){
      if(!qbPrepaidServiceRedeemInput) return;
      const list = qbReadPrepaidServiceRedeem();
      if(!list.length){
        qbWritePrepaidServiceRedeem([]);
        return;
      }
      const selected = qbSelectedServiceIdsSet();
      const pruned = list.filter(it => selected.has(it.service_id));
      const bySvc = new Map();
      for(const it of pruned){
        bySvc.set(it.service_id, it);
      }
      qbWritePrepaidServiceRedeem(Array.from(bySvc.values()));
    }

    function qbEnsureServiceSelected(serviceId, selected=true){
      const ch = findServiceCheckById(serviceId);
      if(!ch) return false;
      ch.checked = !!selected;
      return true;
    }

    function qbResidualServiceLineFromCheckbox(ch){
      if(!ch) return null;
      const serviceId = parseInt(ch.dataset.serviceId || ch.dataset.id || ch.value || '', 10) || 0;
      if(!serviceId) return null;

      const name = String(ch.dataset.serviceName || '').trim();
      const durationMin = parseInt(ch.dataset.serviceDuration || ch.dataset.durationMin || '', 10);
      const lockedPrice = parseFloat(String(ch.dataset.servicePriceLocked || '').replace(',', '.'));
      const snapshotIsActive = (ch.dataset.snapshotIsActive !== undefined && ch.dataset.snapshotIsActive !== '')
        ? Number(ch.dataset.snapshotIsActive)
        : NaN;
      const currentIsActive = (ch.dataset.currentIsActive !== undefined && ch.dataset.currentIsActive !== '')
        ? Number(ch.dataset.currentIsActive)
        : NaN;
      const noOperator = (ch.dataset.noOperator !== undefined && ch.dataset.noOperator !== '')
        ? Number(ch.dataset.noOperator)
        : NaN;

      const line = { service_id: serviceId, name: name || ('Servizio #' + String(serviceId)) };
      if(Number.isFinite(durationMin) && durationMin > 0) line.duration_min = durationMin;
      if(Number.isFinite(lockedPrice)){
        line.price = lockedPrice;
        line.list_price = lockedPrice;
      }
      if(Number.isFinite(snapshotIsActive)) line.snapshot_is_active = (snapshotIsActive > 0 ? 1 : 0);
      if(Number.isFinite(currentIsActive)) line.current_is_active = (currentIsActive > 0 ? 1 : 0);
      if(Number.isFinite(noOperator)) line.no_operator = (noOperator > 0 ? 1 : 0);
      return line;
    }

    function qbEnsureServiceSelectedFromResidualCheckbox(ch, selected=true){
      const line = qbResidualServiceLineFromCheckbox(ch);
      if(!line || !line.service_id) return false;

      let svcCheck = findServiceCheckById(line.service_id);
      if(!svcCheck && selected){
        svcCheck = qbEnsureServiceCheckForSnapshotLine(line);
      }
      if(!svcCheck) return false;

      if(selected){
        try{ qbApplyServiceSnapshotLine(svcCheck, line); }catch(_){ }
        svcCheck.checked = true;
      } else {
        svcCheck.checked = false;
        try{ qbRestoreServiceMasterData(svcCheck); }catch(_){ }
      }
      return true;
    }

    function qbSyncServicesUI(){
      // Keep hidden inputs + pills + end time + loyalty previews aligned
      syncHiddenServiceInputs();
      renderPills();
      if(serviceSearch) applyServiceSearchFilter(serviceSearch.value);
      qbRefreshFidelityThenRender();
      qbRefreshPromotionPreview();
      syncEnd();
      qbPruneGiftboxRedeemBySelectedServices();
      qbPruneGiftRedeemBySelectedServices();
      qbPrunePackageRedeemBySelectedServices();
      qbPrunePrepaidServiceRedeemBySelectedServices();

      // Refresh operator UI for single/multi-service selection
      const ids = getSelectedServiceIds();
      if(ids.length > 1 && !(form && form.dataset.segmentView === '1')){
        renderMultiStaffPicker(ids);
      } else {
        setMultiStaffMode(false);
        refreshStaffForService(ids[0] || '');
      }

      qbUpdateDateAvailabilityGate();
    }

    function qbRenderClientResiduals(data){

      const services = Array.isArray(data?.services) ? data.services : [];
      const giftsList = Array.isArray(data?.gifts) ? data.gifts : [];
      const giftboxes = Array.isArray(data?.giftboxes) ? data.giftboxes : [];
      const giftcards = Array.isArray(data?.giftcards) ? data.giftcards : [];
      const packages = Array.isArray(data?.packages) ? data.packages : [];

      const fmtYMD = (ymd)=>{
        const s = String(ymd || '').trim();
        if(!s) return '—';
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        return m ? (m[3] + '/' + m[2] + '/' + m[1]) : s;
      };

      if(!services.length && !giftsList.length && !giftboxes.length && !giftcards.length && !packages.length){
        return '';
      }

      const out = [];

      if(services.length){
        out.push('<div class="card p-3 mb-3">');
        out.push('<div class="fw-bold mb-2">Servizi</div>');
        out.push('<div class="text-muted small mb-2">Seleziona o deseleziona i servizi acquistati: verranno aggiunti o rimossi automaticamente dalla prenotazione.</div>');

        const linkedPs = qbReadPrepaidServiceRedeem();
        const psBySvc = new Map();
        for(const it of linkedPs){
          if(!it) continue;
          const sid = String(it.service_id || '').trim();
          if(!sid) continue;
          psBySvc.set(sid, it);
        }

        out.push(services.map(s=>{
          const prepaidId = Number(s.client_prepaid_service_id || s.prepaid_service_id || s.id || 0);
          const svcId = Number(s.service_id || 0);
          const qtyRem = Number(s.remaining_qty ?? 0);
          const qtyTot = Number(s.purchased_qty ?? 0);
          const saleId = Number(s.sale_id || 0);
          const exp = s.expires_at ? escHtml(fmtDateTimeFromSql(s.expires_at)) : '—';
          const cbId = 'qb_ps_' + String(prepaidId) + '_' + String(svcId);
          const linked = psBySvc.get(String(svcId));
          const isChecked = !!(linked && Number(linked.client_prepaid_service_id || linked.prepaid_service_id || 0) === prepaidId);
          const linkedNameRaw = isChecked ? String(linked.service_name || '').trim() : '';
          const displayNameRaw = linkedNameRaw || String(s.service_name || ('Servizio #' + String(svcId))).trim();
          const svcName = escHtml(displayNameRaw || ('Servizio #' + String(svcId)));
          const badge = (qtyRem && qtyRem > 0) ? `<span class="badge text-bg-secondary ms-2">${escHtml(String(qtyRem))}</span>` : '';
          const meta = (qtyTot ? `<span class="text-muted small ms-1">/${escHtml(String(qtyTot))}</span>` : '');
          return `
            <div class="border-top pt-2 mt-2 qb-ps-service" data-prepaid-service-id="${escHtml(String(prepaidId))}" data-service-id="${escHtml(String(svcId))}" data-sale-id="${escHtml(String(saleId))}">
              <div class="d-flex justify-content-between align-items-start">
                <div class="me-3">
                  <div class="form-check">
                    <input class="form-check-input qb-ps-svc-check" type="checkbox"
                           id="${cbId}"
                           data-prepaid-service-id="${escHtml(String(prepaidId))}"
                           data-service-id="${escHtml(String(svcId))}"
                           data-service-name="${escHtml(displayNameRaw || ('Servizio #' + String(svcId)))}"
                           data-service-duration="${escHtml(String(s.service_duration_min ?? ''))}"
                           data-service-price-locked="${escHtml(String(s.service_price_locked ?? s.unit_price ?? ''))}"
                           data-snapshot-is-active="${escHtml(String(s.snapshot_is_active ?? ''))}"
                           data-current-is-active="${escHtml(String(s.current_is_active ?? ''))}"
                           data-no-operator="${escHtml(String(s.no_operator ?? ''))}"
                           data-qty-remaining="${escHtml(String(qtyRem))}"
                           data-qty-total="${escHtml(String(qtyTot))}"
                           data-sale-id="${escHtml(String(saleId))}"
                           ${isChecked ? 'checked' : ''}>
                    <label class="form-check-label" for="${cbId}">${svcName}${badge}${meta}</label>
                  </div>
                  <div class="text-muted small">Acquistato${saleId > 0 ? (' con vendita #' + escHtml(String(saleId))) : ''} • Scade: ${exp}</div>
                </div>
                <div class="text-end">
                  <div class="fw-semibold">${fmtEUR(Number(s.unit_price || s.service_price_locked || 0))}</div>
                </div>
              </div>
            </div>`;
        }).join(''));
        out.push('</div>');
      }


      if(giftsList.length){
        out.push('<div class="card p-3 mb-3">');
        out.push('<div class="fw-bold mb-2">Omaggi</div>');
        out.push('<div class="text-muted small mb-2">Seleziona o deseleziona i servizi omaggio: verranno aggiunti o rimossi automaticamente dalla prenotazione.</div>');

        const linkedOg = qbReadGiftRedeem();
        const ogByKey = new Map();
        for(const it of linkedOg){
          if(!it) continue;
          const key = String(it.instance_id || '') + ':' + String(it.reward_item_index || 0) + ':' + String(it.service_id || '');
          if(key !== '::' && key !== '0:0:0') ogByKey.set(key, it);
        }

        out.push(giftsList.map(g=>{
          const instanceId = Number(g.instance_id || 0);
          const giftId = Number(g.gift_id || 0);
          const rewardItemIndex = Number(g.reward_item_index || 0);
          const svcId = Number(g.service_id || 0);
          const key = String(instanceId) + ':' + String(rewardItemIndex) + ':' + String(svcId);
          const linked = ogByKey.get(key);
          const isChecked = !!linked;
          const linkedOther = !isChecked && Number(g.linked_other_appointment || 0) > 0;
          const cbId = 'qb_og_' + String(instanceId) + '_' + String(rewardItemIndex) + '_' + String(svcId);
          const giftName = escHtml(String(g.gift_name || 'gift'));
          const svcNameRaw = String((isChecked ? (linked.service_name || '') : '') || g.service_name || g.gift_service_name || ('Servizio #' + String(svcId))).trim();
          const svcName = escHtml(svcNameRaw || ('Servizio #' + String(svcId)));
          const exp = g.expires_at ? escHtml(fmtDateTimeFromSql(g.expires_at)) : '—';
          const qtyRem = Number(g.qty_remaining ?? 0);
          const qtyTot = Number(g.qty_total ?? 0);
          const qtySelectedDefault = Number(g.qty_selected_default ?? 1);
          const qtyBadge = (qtyRem > 0) ? `<span class="badge text-bg-secondary ms-2">${escHtml(String(qtyRem))}</span>` : '';
          const qtyMeta = (qtyTot > 0) ? `<span class="text-muted small ms-1">/${escHtml(String(qtyTot))}</span>` : '';
          const linkedMsg = linkedOther ? '<div class="text-warning small">Già collegato a un\'altra prenotazione in corso.</div>' : '';
          return `
            <div class="border-top pt-2 mt-2 qb-og-gift" data-instance-id="${escHtml(String(instanceId))}" data-gift-id="${escHtml(String(giftId))}" data-service-id="${escHtml(String(svcId))}">
              <div class="d-flex justify-content-between align-items-start">
                <div class="me-3">
                  <div class="small text-muted mb-1">${giftName}</div>
                  <div class="form-check">
                    <input class="form-check-input qb-og-svc-check" type="checkbox"
                           id="${cbId}"
                           data-instance-id="${escHtml(String(instanceId))}"
                           data-gift-id="${escHtml(String(giftId))}"
                           data-reward-item-index="${escHtml(String(rewardItemIndex))}"
                           data-service-id="${escHtml(String(svcId))}"
                           data-service-name="${escHtml(svcNameRaw || ('Servizio #' + String(svcId)))}"
                           data-gift-name="${escHtml(String(g.gift_name || 'gift'))}"
                           data-service-duration="${escHtml(String(g.service_duration_min ?? ''))}"
                           data-service-price-locked="${escHtml(String(g.service_price_locked ?? ''))}"
                           data-snapshot-is-active="${escHtml(String(g.snapshot_is_active ?? ''))}"
                           data-current-is-active="${escHtml(String(g.current_is_active ?? ''))}"
                           data-no-operator="${escHtml(String(g.no_operator ?? ''))}"
                           data-qty-remaining="${escHtml(String(qtyRem))}"
                           data-qty-total="${escHtml(String(qtyTot))}"
                           data-qty-selected-default="${escHtml(String(qtySelectedDefault > 0 ? qtySelectedDefault : 1))}"
                           ${isChecked ? 'checked' : ''}
                           ${linkedOther ? 'disabled' : ''}>
                    <label class="form-check-label" for="${cbId}">${svcName}${qtyBadge}${qtyMeta}</label>
                  </div>
                  <div class="text-muted small">Scade: ${exp}</div>
                  ${linkedMsg}
                </div>
                <div class="text-end">
                  <div class="fw-semibold">${fmtEUR(Number(g.service_price_locked || 0))}</div>
                </div>
              </div>
            </div>`;
        }).join(''));
        out.push('</div>');
      }

      if(giftboxes.length){
        out.push('<div class="card p-3 mb-3">');
        out.push('<div class="fw-bold mb-2">GiftBox</div>');
        out.push('<div class="text-muted small mb-2">Seleziona o deseleziona i servizi: verranno aggiunti o rimossi automaticamente dalla prenotazione.</div>');

        const linked = qbReadGiftboxRedeem();
        const linkedKey = new Set(linked.map(it => String(it.instance_id) + ':' + String(it.giftbox_item_id)));

        out.push(giftboxes.map(g=>{
          const name = escHtml(g.giftbox_name || 'GiftBox');
          const code = escHtml(g.code || '');
          const rem = Number(g.remaining_qty ?? 0);
          const tot = Number(g.total_qty ?? 0);
          const exp = g.expires_at ? escHtml(fmtDateTimeFromSql(g.expires_at)) : '—';

          const items = Array.isArray(g.items) ? g.items : [];
          const svcItems = items.filter(it =>
            String(it.item_type || '') === 'service' &&
            it.service_id &&
            Number(it.qty_remaining ?? 0) > 0
          );

          let itemsHtml = '';
          if(svcItems.length){
            itemsHtml = svcItems.map(it=>{
              const itId = Number(it.id || 0);
              const svcId = Number(it.service_id || 0);
              const svcName = escHtml(it.service_name || ('Servizio #' + String(svcId)));
              const qtyRem = Number(it.qty_remaining ?? 0);
              const qtyTot = Number(it.qty_total ?? 0);
              const key = String(g.id) + ':' + String(itId);
              const isChecked = linkedKey.has(key);
              const cbId = 'qb_gb_' + String(g.id) + '_' + String(itId);
              // Mostra sempre le sedute residue (anche quando è 1), utile soprattutto
              // quando i servizi derivano da un pacchetto incluso nella GiftBox.
              const badge = (qtyRem && qtyRem > 0) ? `<span class="badge text-bg-secondary ms-2">${escHtml(String(qtyRem))}</span>` : '';
              const meta = (qtyTot ? `<span class="text-muted small ms-1">/${escHtml(String(qtyTot))}</span>` : '');
              return `
                <div class="form-check">
                  <input class="form-check-input qb-gb-svc-check" type="checkbox"
                         id="${cbId}"
                         data-instance-id="${escHtml(String(g.id))}"
                         data-item-id="${escHtml(String(itId))}"
                         data-service-id="${escHtml(String(svcId))}"
                         data-service-name="${escHtml(String(it.service_name || ('Servizio #' + String(svcId))))}"
                         data-service-duration="${escHtml(String(it.service_duration_min ?? ''))}"
                         data-service-price-locked="${escHtml(String(it.service_price_locked ?? ''))}"
                         data-snapshot-is-active="${escHtml(String(it.snapshot_is_active ?? ''))}"
                         data-current-is-active="${escHtml(String(it.current_is_active ?? ''))}"
                         data-no-operator="${escHtml(String(it.no_operator ?? ''))}"
                         data-qty-remaining="${escHtml(String(qtyRem))}"
                         data-qty-total="${escHtml(String(qtyTot))}"
                         ${isChecked ? 'checked' : ''}>
                  <label class="form-check-label" for="${cbId}">${svcName}${badge}${meta}</label>
                </div>`;
            }).join('');
          }else{
            itemsHtml = '<div class="text-muted small">Nessun servizio residuo selezionabile.</div>';
          }

          return `
            <div class="border-top pt-2 mt-2 qb-gb-instance" data-instance-id="${escHtml(String(g.id))}" data-gb-code="${code}" data-gb-name="${name}">
              <div class="fw-semibold">${name} <span class="text-muted small"><code>${code}</code></span></div>
              <div class="text-muted small">Residuo: ${escHtml(String(rem))}${tot ? ' / ' + escHtml(String(tot)) : ''} • Scade: ${exp}</div>
              <div class="mt-2">
                <div class="small text-muted mb-1">Servizi residui:</div>
                ${itemsHtml}
              </div>
            </div>`;
        }).join(''));
        out.push('</div>');
      }
      if(giftcards.length){
        const linkedGc = qbReadGiftcardRedeem();
        const linkedGcId = (linkedGc && linkedGc[0] && linkedGc[0].giftcard_id) ? Number(linkedGc[0].giftcard_id) : 0;
        const linkedGcAmt = (linkedGc && linkedGc[0] && linkedGc[0].amount) ? Number(linkedGc[0].amount) : 0;

        out.push('<div class="card p-3 mb-3">');
        out.push('<div class="fw-bold mb-2">GiftCard</div>');
        out.push(`<div class="text-muted small mb-2">Seleziona una GiftCard, scegli l'importo e premi <span class="fw-semibold">Applica</span>.</div>`);

        out.push(giftcards.map(gc=>{
          const id = Number(gc.id || 0);
          const code = escHtml(gc.code || '');
          const balNum = Number(gc.balance || 0);
          const bal = fmtEUR(balNum);
          const exp = gc.expires_at ? escHtml(fmtYMD(gc.expires_at)) : '—';
          const isDisabled = !(balNum > 0.0000001);
          const isChecked = !!(linkedGcId && id === linkedGcId);
          const amountVal = (isChecked && linkedGcAmt > 0) ? String(linkedGcAmt) : '';
          const radioId = 'qb_gc_' + String(id);

          return `
            <div class="border-top pt-2 mt-2 qb-gc-item" data-id="${escHtml(String(id))}" data-code="${code}" data-balance="${escHtml(String(balNum))}">
              <div class="d-flex justify-content-between align-items-start">
                <div class="me-3">
                  <div class="form-check">
                    <input class="form-check-input qb-gc-radio" type="radio" name="qb_gc_sel" id="${radioId}" ${isChecked ? 'checked' : ''} ${isDisabled ? 'disabled' : ''}>
                    <label class="form-check-label" for="${radioId}">
                      <span class="fw-semibold"><code>${code}</code></span>
                    </label>
                  </div>
                  <div class="text-muted small">Scade: ${exp}</div>
                </div>
                <div class="text-end">
                  <div class="fw-semibold">${bal}</div>
                  ${isDisabled ? `<div class="text-muted small">Saldo non disponibile</div>` : ''}
                </div>
              </div>

              <div class="mt-2 qb-gc-controls ${isChecked ? '' : 'd-none'}">
                <div class="d-flex gap-2 align-items-end">
                  <div class="flex-grow-1">
                    <label class="form-label small mb-1">Importo da usare</label>
                    <input type="number" class="form-control form-control-sm qb-gc-amount" min="0" step="0.01" max="${escHtml(String(balNum))}" value="${escHtml(amountVal)}" placeholder="0,00">
                    <div class="form-text">Max: ${bal}</div>
                  </div>
                  <button type="button" class="btn btn-sm btn-outline-secondary qb-gc-max" ${isDisabled ? 'disabled' : ''}>Usa max</button>
                  <button type="button" class="btn btn-sm btn-primary qb-gc-apply" ${isDisabled ? 'disabled' : ''}>Applica</button>
                </div>
              </div>
            </div>`;
        }).join(''));

        if(linkedGcId && linkedGcAmt > 0){
          out.push(`
            <div class="border-top pt-3 mt-2">
              <button type="button" class="btn btn-sm btn-outline-danger qb-gc-remove">Rimuovi GiftCard applicata</button>
            </div>`);
        }

        out.push('</div>');
      }

      if(packages.length){
        out.push('<div class="card p-3 mb-3">');
        out.push('<div class="fw-bold mb-2">Pacchetti</div>');
        out.push('<div class="text-muted small mb-2">Seleziona o deseleziona le sedute: verranno aggiunte o rimosse automaticamente dalla prenotazione.</div>');

        const linkedPk = qbReadPackageRedeem();
        const pkBySvc = new Map();
        for(const it of linkedPk){
          if(!it) continue;
          const sid = String(it.service_id || '').trim();
          if(!sid) continue;
          pkBySvc.set(sid, it);
        }

        out.push(packages.map(p=>{
          const pid = Number(p.id || 0);
          const name = escHtml(p.package_name || 'Pacchetto');
          const rem = escHtml(String(p.sessions_remaining ?? ''));
          const tot = escHtml(String(p.sessions_total ?? ''));
          const exp = p.expires_at ? escHtml(fmtYMD(p.expires_at)) : '—';

          const items = Array.isArray(p.items) ? p.items : [];
          const svcItems = items.filter(it =>
            it && Number(it.service_id || 0) > 0 && Number(it.sessions_remaining ?? 0) > 0
          );

          let itemsHtml = '';
          if(svcItems.length){
            itemsHtml = svcItems.map(it=>{
              const svcId = Number(it.service_id || 0);
              const svcName = escHtml(it.service_name || ('Servizio #' + String(svcId)));
              const qtyRem = Number(it.sessions_remaining ?? 0);
              const qtyTot = Number(it.sessions_total ?? 0);
              const cbId = 'qb_cp_' + String(pid) + '_' + String(svcId);
              const pkLinked = pkBySvc.get(String(svcId));
              const isChecked = !!(pkLinked && Number(pkLinked.client_package_id || 0) === pid);
              const badge = (qtyRem && qtyRem > 0) ? `<span class="badge text-bg-secondary ms-2">${escHtml(String(qtyRem))}</span>` : '';
              const meta = (qtyTot ? `<span class="text-muted small ms-1">/${escHtml(String(qtyTot))}</span>` : '');
              return `
                <div class="form-check">
                  <input class="form-check-input qb-cp-svc-check" type="checkbox"
                         id="${cbId}"
                         data-package-id="${escHtml(String(pid))}"
                         data-package-service-id="${escHtml(String(it.id || 0))}"
                         data-service-id="${escHtml(String(svcId))}"
                         data-service-name="${escHtml(String(it.service_name || ('Servizio #' + String(svcId))))}"
                         data-service-duration="${escHtml(String(it.service_duration_min ?? ''))}"
                         data-service-price-locked="${escHtml(String(it.service_price_locked ?? ''))}"
                         data-snapshot-is-active="${escHtml(String(it.snapshot_is_active ?? ''))}"
                         data-current-is-active="${escHtml(String(it.current_is_active ?? ''))}"
                         data-no-operator="${escHtml(String(it.no_operator ?? ''))}"
                         data-sessions-remaining="${escHtml(String(qtyRem))}"
                         data-sessions-total="${escHtml(String(qtyTot))}"
                         ${isChecked ? 'checked' : ''}>
                  <label class="form-check-label" for="${cbId}">${svcName}${badge}${meta}</label>
                </div>`;
            }).join('');
          } else {
            const br = String(p.breakdown || '').trim();
            itemsHtml = br
              ? `<div class="text-muted small">${escHtml(br)}</div>`
              : '<div class="text-muted small">Nessuna seduta residua selezionabile.</div>';
          }

          return `
            <div class="border-top pt-2 mt-2 qb-cp-package" data-package-id="${escHtml(String(pid))}" data-package-name="${name}">
              <div class="fw-semibold">${name}</div>
              <div class="text-muted small">Residuo: ${rem}${tot ? ' / ' + tot : ''} • Scade: ${exp}</div>
              <div class="mt-2">
                <div class="small text-muted mb-1">Sedute residue:</div>
                ${itemsHtml}
              </div>
            </div>`;
        }).join(''));
        out.push('</div>');
      }


      return out.join('');
    }

    function qbOpenClientResiduals(clientId){
      if(!clientId || !qbClientResidualsModal) return;
      const cid = String(clientId);
      const fullUrl = 'index.php?page=clients&action=view&id=' + encodeURIComponent(cid);
      if(qbClientResidualsOpenNew) qbClientResidualsOpenNew.href = fullUrl;
      if(qbClientResidualsClientLabel){
        const lbl = qbSelName ? String(qbSelName.textContent || '').trim() : '';
        qbClientResidualsClientLabel.textContent = lbl || '—';
      }
      if(qbClientResidualsEmptyState) qbClientResidualsEmptyState.classList.add('d-none');
      if(qbClientResidualsBody) qbClientResidualsBody.innerHTML = appInlineLoadingHtml();
      try{ qbSyncResidualCreditUi(); }catch(_){ }
      qbClientResidualsModal.show();

      const myReq = ++qbClientResidualsReqId;
      const apptId = apptIdEl ? String(apptIdEl.value || '').trim() : '';
      const locId = locationSel ? String(locationSel.value || '').trim() : '';
      let residualsUrl = 'index.php?page=api_clients&action=residuals&client_id=' + encodeURIComponent(cid);
      if(apptId) residualsUrl += '&appointment_id=' + encodeURIComponent(apptId);
      if(locId) residualsUrl += '&location_id=' + encodeURIComponent(locId);
      fetch(residualsUrl, {credentials:'same-origin'})
        .then(r => r.json())
        .then(j => {
          if(myReq !== qbClientResidualsReqId) return;
          if(!j || !j.ok){
            if(qbClientResidualsBody) qbClientResidualsBody.innerHTML = '<div class="text-danger small p-2">Impossibile caricare i residui.</div>';
            if(qbClientResidualsEmptyState) qbClientResidualsEmptyState.classList.add('d-none');
            return;
          }

          try{
            const cr = j.credit || null;
            if(cr){
              const schemaOk = !!(parseInt(String(cr.schema_ok || 0), 10) || 0);
              const bal = parseFloat(String((cr.available != null ? cr.available : cr.balance) || 0).replace(',', '.')) || 0;
              qbCreditPrev = { enabled:(schemaOk && bal > 0.00001), available: Math.max(0, qbNormMoney(bal)) };
            } else {
              qbCreditPrev = { enabled:false, available:0 };
            }
          } catch(_){
            qbCreditPrev = { enabled:false, available:0 };
          }

          const services = Array.isArray(j.services) ? j.services : [];
          const giftsList = Array.isArray(j.gifts) ? j.gifts : [];
          const giftboxes = Array.isArray(j.giftboxes) ? j.giftboxes : [];
          const giftcards = Array.isArray(j.giftcards) ? j.giftcards : [];
          const packages = Array.isArray(j.packages) ? j.packages : [];
          const hasCredit = qbCreditAvailableAmount() > 0.00001 || qbCreditSelectedAmount() > 0.00001;
          const hasOtherResiduals = !!(services.length || giftsList.length || giftboxes.length || giftcards.length || packages.length);

          try{ qbSyncResidualCreditUi(); }catch(_){ }
          if(qbClientResidualsEmptyState) qbClientResidualsEmptyState.classList.toggle('d-none', hasCredit || hasOtherResiduals);
          if(qbClientResidualsBody){
            qbClientResidualsBody.innerHTML = hasOtherResiduals ? qbRenderClientResiduals(j) : '';
          }
        })
        .catch(()=>{
          if(myReq !== qbClientResidualsReqId) return;
          if(qbClientResidualsBody) qbClientResidualsBody.innerHTML = '<div class="text-danger small p-2">Errore di rete durante il caricamento.</div>';
          if(qbClientResidualsEmptyState) qbClientResidualsEmptyState.classList.add('d-none');
        });
    }

    // ------------------------------------------------------------
    // Quick booking: popup dettagli GiftBox collegata ad un servizio
    // ------------------------------------------------------------

    function qbStatusBadgeHtml(label, badgeClass, extraClass){
      const lbl = String(label || '').trim();
      if(!lbl) return '';
      const baseCls = String(badgeClass || 'secondary').trim() || 'secondary';
      const cls = baseCls.startsWith('text-bg-') ? baseCls : ('text-bg-' + baseCls.replace(/[^A-Za-z0-9_-]/g, ''));
      const extra = String(extraClass || '').trim();
      return `<span class="badge ${escHtml(cls)}${extra ? (' ' + escHtml(extra)) : ''}">${escHtml(lbl)}</span>`;
    }

    function qbPackageStatusMeta(st){
      const s = String(st || '').trim().toLowerCase();
      if(s === 'active') return { label: 'Attivo', badge: 'success', extraClass: '' };
      if(s === 'completed') return { label: 'Completato', badge: 'secondary', extraClass: '' };
      if(s === 'expired') return { label: 'Scaduto', badge: 'warning', extraClass: 'text-dark' };
      if(s === 'canceled' || s === 'cancelled') return { label: 'Annullato', badge: 'danger', extraClass: '' };
      return { label: (s ? s : '—'), badge: 'secondary', extraClass: '' };
    }

    function qbGiftboxStatusMeta(st){
      const s = String(st || '').trim().toLowerCase();
      if(s === 'issued' || s === 'active') return { label: 'Attiva', badge: 'success', extraClass: '' };
      if(s === 'redeemed') return { label: 'Riscattata', badge: 'info', extraClass: '' };
      if(s === 'expired') return { label: 'Scaduta', badge: 'warning', extraClass: 'text-dark' };
      if(s === 'cancelled' || s === 'canceled' || s === 'void') return { label: 'Annullata', badge: 'danger', extraClass: '' };
      return { label: (statusLabel(st) || (s ? s : '—')), badge: 'secondary', extraClass: '' };
    }

    function qbGiftStateMeta(st){
      const s = String(st || '').trim().toLowerCase();
      if(s === 'accumulo') return { label: 'In accumulo', badge: 'secondary', extraClass: '' };
      if(s === 'disponibile') return { label: 'Disponibile', badge: 'success', extraClass: '' };
      if(s === 'riscattato') return { label: 'Riscattato', badge: 'dark', extraClass: '' };
      if(s === 'scaduto') return { label: 'Scaduto', badge: 'warning', extraClass: 'text-dark' };
      if(s === 'annullato') return { label: 'Annullato', badge: 'danger', extraClass: '' };
      return { label: (s ? s : '—'), badge: 'secondary', extraClass: '' };
    }

    function qbGiftcardStatusMeta(st){
      const s = String(st || '').trim().toLowerCase();
      if(s === 'active') return { label: 'Attiva', badge: 'success', extraClass: '' };
      if(s === 'redeemed') return { label: 'Esaurita', badge: 'info', extraClass: '' };
      if(s === 'expired') return { label: 'Scaduta', badge: 'warning', extraClass: 'text-dark' };
      if(s === 'cancelled' || s === 'canceled') return { label: 'Annullata', badge: 'danger', extraClass: '' };
      return { label: (s ? s : '—'), badge: 'secondary', extraClass: '' };
    }

    function qbSetExpiredLinkedAlert(message){
      if(!qbExpiredLinkedAlertEl) return;
      const msg = String(message || '').trim();
      if(msg){
        qbExpiredLinkedAlertEl.textContent = msg;
        qbExpiredLinkedAlertEl.style.display = 'block';
      } else {
        qbExpiredLinkedAlertEl.textContent = '';
        qbExpiredLinkedAlertEl.style.display = 'none';
      }
    }

    function qbRenderGiftboxInfo(instance, selectedGiftboxItemId, selectedServiceId){
      if(!instance) return '<div class="text-muted small p-2">Nessun dettaglio disponibile.</div>';

      const name = escHtml(instance.giftbox_name || 'GiftBox');
      const code = escHtml(instance.code || '');
      const statusMeta = qbGiftboxStatusMeta(instance.status || '');
      const statusBadge = qbStatusBadgeHtml(statusMeta.label, statusMeta.badge, statusMeta.extraClass);
      const issued = instance.issued_at ? escHtml(fmtDateTimeFromSql(instance.issued_at)) : '—';
      const exp = instance.expires_at ? escHtml(fmtDateTimeFromSql(instance.expires_at)) : '—';

      const tot = (instance.total_qty !== undefined && instance.total_qty !== null) ? Number(instance.total_qty) : null;
      const rem = (instance.remaining_qty !== undefined && instance.remaining_qty !== null) ? Number(instance.remaining_qty) : null;
      const red = (instance.redeemed_qty !== undefined && instance.redeemed_qty !== null) ? Number(instance.redeemed_qty) : null;

      const descRaw = String(instance.giftbox_description || '').trim();
      const desc = descRaw ? escHtml(descRaw) : '';

      // Resolve selected service name from the local list
      let selName = '';
      try{
        const ch = findServiceCheckById(String(selectedServiceId || ''));
        if(ch){
          selName = String(ch.dataset.name || ch.getAttribute('data-name') || '').trim();
        }
      }catch(_){ }

      const items = Array.isArray(instance.items) ? instance.items : [];
      const rows = items.map(it => {
        if(!it) return '';
        const itId = Number(it.id || 0);
        const itType = String(it.item_type || '').toLowerCase();
        const svcId = (it.service_id !== undefined && it.service_id !== null) ? Number(it.service_id) : 0;
        const prdId = (it.product_id !== undefined && it.product_id !== null) ? Number(it.product_id) : 0;
        const nm = escHtml(
          (itType === 'service')
            ? (it.service_name || (svcId ? ('Servizio #' + String(svcId)) : 'Servizio'))
            : (itType === 'product')
              ? (it.product_name || (prdId ? ('Prodotto #' + String(prdId)) : 'Prodotto'))
              : (it.custom_label || 'Voce')
        );

        const qtyTot = (it.qty_total !== undefined && it.qty_total !== null) ? Number(it.qty_total) : Number(it.qty || 0);
        const qtyRem = (it.qty_remaining !== undefined && it.qty_remaining !== null) ? Number(it.qty_remaining) : null;
        const qtyRed = (it.qty_redeemed !== undefined && it.qty_redeemed !== null) ? Number(it.qty_redeemed) : null;

        const isSel = (
          (selectedGiftboxItemId && itId && String(itId) === String(selectedGiftboxItemId))
          || (!selectedGiftboxItemId && selectedServiceId && svcId && String(svcId) === String(selectedServiceId))
        );

        const cls = 'list-group-item d-flex justify-content-between align-items-start' + (isSel ? ' list-group-item-warning' : '');
        const right = (qtyTot && qtyTot > 0)
          ? (`<span class="badge text-bg-secondary">${escHtml(String(qtyRem !== null ? qtyRem : Math.max(0, qtyTot - (qtyRed || 0))))}</span><span class="text-muted small ms-1">/${escHtml(String(qtyTot))}</span>`)
          : (`<span class="text-muted small">—</span>`);

        const tip = [];
        if(itType) tip.push(itType);
        if(qtyTot && qtyTot > 0){
          if(qtyRed !== null) tip.push('Riscattate ' + String(qtyRed));
          if(qtyRem !== null) tip.push('Residue ' + String(qtyRem));
        }

        return `
          <div class="${cls}" ${tip.length ? `title="${escHtml(tip.join(' • '))}"` : ''}>
            <div class="me-2">
              <div class="fw-semibold">${nm}</div>
              ${isSel ? '<div class="small text-muted">Selezionato in questa prenotazione</div>' : ''}
            </div>
            <div class="text-end ms-auto" style="white-space:nowrap">${right}</div>
          </div>
        `;
      }).filter(Boolean).join('');

      const headParts = [];
      headParts.push(`<div class="fw-bold">${name}${code ? ' <span class="text-muted"><code>' + code + '</code></span>' : ''}</div>`);
      const metaLine = [];
      if(statusBadge) metaLine.push('Stato: ' + statusBadge);
      metaLine.push('Emessa: ' + issued);
      metaLine.push('Scade: ' + exp);
      headParts.push(`<div class="text-muted small">${metaLine.join(' • ')}</div>`);
      if(rem !== null || tot !== null){
        const a = [];
        if(rem !== null) a.push(String(Math.max(0, rem)));
        if(tot !== null && tot > 0) a.push(String(tot));
        headParts.push(`<div class="text-muted small">Residuo complessivo: ${escHtml(a.join(' / '))}</div>`);
      }

      const selLine = selName ? `<div class="alert alert-light border small py-2 px-2 mb-3">Servizio selezionato: <span class="fw-semibold">${escHtml(selName)}</span></div>` : '';

      return `
        <div class="mb-2">
          ${headParts.join('')}
        </div>
        ${selLine}
        ${desc ? `<div class="small mb-3">${desc}</div>` : ''}
        <div class="card">
          <div class="card-header py-2">
            <div class="small text-muted">Dettaglio sedute/elementi</div>
          </div>
          <div class="list-group list-group-flush">
            ${rows || '<div class="text-muted small p-2">Nessun elemento disponibile.</div>'}
          </div>
        </div>
      `;
    }

    function qbOpenGiftboxInfo(instanceId, giftboxItemId, serviceId){
      if(!qbGiftboxInfoModal || !qbGiftboxInfoBody) return;

      const iid = String(instanceId || '').trim();
      if(!iid) return;

      // Update header title/link (best-effort)
      if(qbGiftboxInfoTitle) qbGiftboxInfoTitle.textContent = 'Dettagli GiftBox';
      if(qbGiftboxInfoOpenNew){
        qbGiftboxInfoOpenNew.href = 'index.php?page=giftbox&tab=instances&action=edit_instance&id=' + encodeURIComponent(iid);
      }

      qbGiftboxInfoBody.innerHTML = appInlineLoadingHtml();
      qbGiftboxInfoModal.show();

      const myReq = ++qbGiftboxInfoReqId;
      const cid = qbClientId ? String(qbClientId.value || '').trim() : '';

      const params = new URLSearchParams();
      params.set('page', 'api_clients');
      params.set('action', 'giftbox_instance');
      params.set('instance_id', iid);
      if(cid) params.set('client_id', cid);

      // When editing an existing appointment, pass appointment_id so the backend
      // can show the residual snapshot (before this appointment redeemed).
      const apptId = apptIdEl ? String(apptIdEl.value || '').trim() : '';
      if(apptId) params.set('appointment_id', apptId);

      fetch('index.php?' + params.toString(), {credentials:'same-origin'})
        .then(r => r.json())
        .then(j => {
          if(myReq !== qbGiftboxInfoReqId) return;
          if(!j || !j.ok || !j.instance){
            const msg = (j && j.error) ? String(j.error) : 'Impossibile caricare i dettagli della GiftBox.';
            qbGiftboxInfoBody.innerHTML = '<div class="text-danger small p-2">' + escHtml(msg) + '</div>';
            return;
          }
          const inst = j.instance;
          if(qbGiftboxInfoTitle){
            const nm = String(inst.giftbox_name || 'GiftBox').trim();
            const cd = String(inst.code || '').trim();
            qbGiftboxInfoTitle.textContent = nm + (cd ? (' • ' + cd) : '');
          }
          qbGiftboxInfoBody.innerHTML = qbRenderGiftboxInfo(inst, giftboxItemId, serviceId);
        })
        .catch(()=>{
          if(myReq !== qbGiftboxInfoReqId) return;
          qbGiftboxInfoBody.innerHTML = '<div class="text-danger small p-2">Errore di rete durante il caricamento.</div>';
        });
    }

    // ------------------------------------------------------------
    // Quick booking: popup dettagli Pacchetto collegato ad un servizio
    // ------------------------------------------------------------

    function qbRenderPackageInfo(pkg, selectedServiceId){
      if(!pkg) return '<div class="text-muted small p-2">Nessun dettaglio disponibile.</div>';

      const name = escHtml(pkg.package_name || pkg.name || 'Pacchetto');
      const statusMeta = qbPackageStatusMeta(pkg.status || '');
      const statusBadge = qbStatusBadgeHtml(statusMeta.label, statusMeta.badge, statusMeta.extraClass);
      const exp = pkg.expires_at ? escHtml(fmtDateTimeFromSql(pkg.expires_at, { endOfDay: true })) : '—';

      const tot = (pkg.sessions_total !== undefined && pkg.sessions_total !== null) ? Number(pkg.sessions_total) : null;
      const rem = (pkg.sessions_remaining !== undefined && pkg.sessions_remaining !== null) ? Number(pkg.sessions_remaining) : null;

      // Resolve selected service name from local list
      let selName = '';
      try{
        const ch = findServiceCheckById(String(selectedServiceId || ''));
        if(ch){
          selName = String(ch.dataset.name || ch.getAttribute('data-name') || '').trim();
        }
      }catch(_){ }

      const items = Array.isArray(pkg.items) ? pkg.items : [];
      const rows = items.map(it => {
        if(!it) return '';
        const svcId = (it.service_id !== undefined && it.service_id !== null) ? Number(it.service_id) : 0;
        const nm = escHtml(it.service_name || (svcId ? ('Servizio #' + String(svcId)) : 'Servizio'));
        const qtyTot = (it.sessions_total !== undefined && it.sessions_total !== null) ? Number(it.sessions_total) : null;
        const qtyRem = (it.sessions_remaining !== undefined && it.sessions_remaining !== null) ? Number(it.sessions_remaining) : null;

        const isSel = (selectedServiceId && svcId && String(svcId) === String(selectedServiceId));
        const cls = 'list-group-item d-flex justify-content-between align-items-start' + (isSel ? ' list-group-item-warning' : '');
        const right = (qtyTot !== null && qtyTot > 0)
          ? (`<span class="badge text-bg-secondary">${escHtml(String(qtyRem !== null ? qtyRem : qtyTot))}</span><span class="text-muted small ms-1">/${escHtml(String(qtyTot))}</span>`)
          : (`<span class="text-muted small">—</span>`);

        const tip = [];
        if(qtyTot !== null && qtyTot > 0 && qtyRem !== null) tip.push('Residuo ' + String(qtyRem) + '/' + String(qtyTot));
        return `
          <div class="${cls}" ${tip.length ? `title="${escHtml(tip.join(' • '))}"` : ''}>
            <div class="me-2">
              <div class="fw-semibold">${nm}</div>
              ${isSel ? '<div class="small text-muted">Selezionato in questa prenotazione</div>' : ''}
            </div>
            <div class="text-end ms-auto" style="white-space:nowrap">${right}</div>
          </div>
        `;
      }).filter(Boolean).join('');

      const headParts = [];
      headParts.push(`<div class="fw-bold">${name}</div>`);
      const metaLine = [];
      metaLine.push('Stato: ' + statusBadge);
      metaLine.push('Scade: ' + exp);
      headParts.push(`<div class="text-muted small">${metaLine.join(' • ')}</div>`);
      if(rem !== null || tot !== null){
        const a = [];
        if(rem !== null) a.push(String(Math.max(0, rem)));
        if(tot !== null && tot > 0) a.push(String(tot));
        headParts.push(`<div class="text-muted small">Residuo complessivo: ${escHtml(a.join(' / '))}</div>`);
      }

      const selLine = selName ? `<div class="alert alert-light border small py-2 px-2 mb-3">Servizio selezionato: <span class="fw-semibold">${escHtml(selName)}</span></div>` : '';

      return `
        <div class="mb-2">
          ${headParts.join('')}
        </div>
        ${selLine}
        <div class="card">
          <div class="card-header py-2">
            <div class="small text-muted">Dettaglio sedute</div>
          </div>
          <div class="list-group list-group-flush">
            ${rows || '<div class="text-muted small p-2">Nessuna seduta disponibile.</div>'}
          </div>
        </div>
      `;
    }

    function qbOpenPackageInfo(clientPackageId, serviceId){
      if(!qbPackageInfoModal || !qbPackageInfoBody) return;

      const pid = String(clientPackageId || '').trim();
      if(!pid) return;

      // Update header title/link (best-effort)
      if(qbPackageInfoTitle) qbPackageInfoTitle.textContent = 'Dettagli Pacchetto';
      if(qbPackageInfoOpenNew){
        qbPackageInfoOpenNew.href = 'index.php?page=packages&action=client_view&id=' + encodeURIComponent(pid);
      }

      qbPackageInfoBody.innerHTML = appInlineLoadingHtml();
      qbPackageInfoModal.show();

      const myReq = ++qbPackageInfoReqId;
      const cid = qbClientId ? String(qbClientId.value || '').trim() : '';

      const params = new URLSearchParams();
      params.set('page', 'api_clients');
      params.set('action', 'client_package');
      params.set('id', pid);
      if(cid) params.set('client_id', cid);

      // When editing an existing appointment, pass appointment_id so the backend
      // can show the residual snapshot (before this appointment redeemed).
      const apptId = apptIdEl ? String(apptIdEl.value || '').trim() : '';
      if(apptId){
        params.set('appointment_id', apptId);
        if(serviceId) params.set('selected_service_id', String(serviceId));
      }

      fetch('index.php?' + params.toString(), {credentials:'same-origin'})
        .then(r => r.json())
        .then(j => {
          if(myReq !== qbPackageInfoReqId) return;
          if(!j || !j.ok || !j.package){
            const msg = (j && j.error) ? String(j.error) : 'Impossibile caricare i dettagli del pacchetto.';
            qbPackageInfoBody.innerHTML = '<div class="text-danger small p-2">' + escHtml(msg) + '</div>';
            return;
          }
          const pkg = j.package;
          if(qbPackageInfoTitle){
            const nm = String(pkg.package_name || pkg.name || 'Pacchetto').trim();
            qbPackageInfoTitle.textContent = nm || 'Dettagli Pacchetto';
          }
          qbPackageInfoBody.innerHTML = qbRenderPackageInfo(pkg, serviceId);
        })
        .catch(()=>{
          if(myReq !== qbPackageInfoReqId) return;
          qbPackageInfoBody.innerHTML = '<div class="text-danger small p-2">Errore di rete durante il caricamento.</div>';
        });
    }


    // ------------------------------------------------------------
    // Quick booking: popup dettagli omaggio collegato ad un servizio
    // ------------------------------------------------------------

    function qbGiftStateLabel(st){
      const s = String(st || '').trim().toLowerCase();
      if(s === 'accumulo') return 'In accumulo';
      if(s === 'disponibile') return 'Disponibile';
      if(s === 'riscattato') return 'Riscattato';
      if(s === 'scaduto') return 'Scaduto';
      if(s === 'annullato') return 'Annullato';
      return s ? s : '—';
    }

    function qbGiftTxLabel(tp){
      const t = String(tp || '').trim().toLowerCase();
      if(t === 'issue') return 'Emissione';
      if(t === 'pending') return 'In sospeso';
      if(t === 'unlink') return 'Scollegato';
      if(t === 'redeem') return 'Riscatto';
      if(t === 'cancel') return 'Annullamento';
      if(t === 'adjust') return 'Modifica';
      return t ? t : '—';
    }

    function qbRenderGiftInfo(info, selectedServiceId, selectedRewardItemIndex){
      if(!info) return '<div class="text-muted small p-2">Nessun dettaglio disponibile.</div>';

      const giftNameRaw = String(info.gift_name || '').trim();
      const giftName = escHtml(giftNameRaw || 'gift');
      const stateMeta = qbGiftStateMeta(info.state);
      const stateLabel = escHtml(stateMeta.label);
      const stateBadge = qbStatusBadgeHtml(stateMeta.label, stateMeta.badge, stateMeta.extraClass);
      const created = info.created_at ? escHtml(fmtDateTimeFromSql(info.created_at)) : '—';
      const unlocked = info.unlocked_at ? escHtml(fmtDateTimeFromSql(info.unlocked_at)) : '—';
      const exp = info.expires_at ? escHtml(fmtDateTimeFromSql(info.expires_at)) : '—';
      const redeemed = info.redeemed_at ? escHtml(fmtDateTimeFromSql(info.redeemed_at)) : '—';
      const cancelled = info.cancelled_at ? escHtml(fmtDateTimeFromSql(info.cancelled_at)) : '—';
      const cancelReason = String(info.cancel_reason || '').trim();
      const rewardLabels = Array.isArray(info.reward_labels) ? info.reward_labels.filter(Boolean).map(v=>String(v)) : [];
      const rewardSummary = rewardLabels.length ? rewardLabels.join(' • ') : String(info.reward_summary || '').trim();
      const description = String(info.gift_description || '').trim();
      const items = Array.isArray(info.items) ? info.items : [];
      const movements = Array.isArray(info.movements) ? info.movements : [];

      const selSvcId = parseInt(String(selectedServiceId || '0'), 10) || 0;
      const selIdx = parseInt(String(selectedRewardItemIndex || '0'), 10) || 0;

      let selName = '';
      try{
        const ch = findServiceCheckById(String(selectedServiceId || ''));
        if(ch){
          selName = String(ch.dataset.name || ch.getAttribute('data-name') || '').trim();
        }
      }catch(_){ }

      const qtyTotAll = (info.qty_total !== undefined && info.qty_total !== null) ? Number(info.qty_total) : items.reduce((sum, it)=>sum + (Number(it && it.qty_total != null ? it.qty_total : 0) || 0), 0);
      const qtyRemAll = (info.qty_remaining !== undefined && info.qty_remaining !== null) ? Number(info.qty_remaining) : items.reduce((sum, it)=>sum + (Number(it && it.qty_remaining != null ? it.qty_remaining : 0) || 0), 0);

      const headParts = [];
      headParts.push(`<div class="fw-bold">${giftName}</div>`);
      const metaLine = [];
      metaLine.push('Stato: ' + stateBadge);
      if(unlocked !== '—') metaLine.push('Sbloccato: ' + unlocked);
      else metaLine.push('Creato: ' + created);
      if(exp !== '—') metaLine.push('Scade: ' + exp);
      if(redeemed !== '—') metaLine.push('Riscattato: ' + redeemed);
      else if(cancelled !== '—') metaLine.push('Annullato: ' + cancelled);
      headParts.push(`<div class="text-muted small">${metaLine.join(' • ')}</div>`);
      if(Number.isFinite(qtyTotAll) && qtyTotAll > 0){
        headParts.push(`<div class="text-muted small">Residuo complessivo: ${escHtml(String(Math.max(0, qtyRemAll)))}/${escHtml(String(qtyTotAll))}</div>`);
      }

      const rewardHtml = rewardSummary
        ? (`<div class="small mb-3">Premio: <span class="fw-semibold">${escHtml(rewardSummary)}</span></div>` + (rewardLabels.length > 1 ? (`<ul class="small text-muted mb-3 ps-3">` + rewardLabels.map(label=>`<li>${escHtml(label)}</li>`).join('') + `</ul>`) : ''))
        : '';

      const selLine = selName ? `<div class="alert alert-light border small py-2 px-2 mb-3">Servizio selezionato: <span class="fw-semibold">${escHtml(selName)}</span></div>` : '';

      const rows = items.map(it => {
        if(!it || typeof it !== 'object') return '';
        const type = String(it.type || 'custom').trim().toLowerCase();
        const svcId = parseInt(String(it.service_id || '0'), 10) || 0;
        const idx = parseInt(String(it.reward_item_index || '0'), 10) || 0;
        const labelRaw = String(it.reward_label || it.service_name || 'gift').trim();
        const label = escHtml(labelRaw || 'gift');
        const qtyTot = Number(it.qty_total != null ? it.qty_total : (it.qty != null ? it.qty : 0)) || 0;
        const qtyRem = Number(it.qty_remaining != null ? it.qty_remaining : qtyTot) || 0;
        const qtyRedeemed = Number(it.qty_redeemed != null ? it.qty_redeemed : Math.max(0, qtyTot - qtyRem)) || 0;
        const durationMin = Number(it.service_duration_min || 0) || 0;
        const priceNum = (it.service_price_locked !== undefined && it.service_price_locked !== null && String(it.service_price_locked) !== '')
          ? Number(it.service_price_locked)
          : NaN;
        const isSel = (selSvcId > 0 && svcId > 0 && svcId === selSvcId && (selIdx === 0 || idx === selIdx));
        const linkedNow = !!Number(it.linked_current_appointment || it.linked_to_appointment || 0);
        const stateBits = [];
        if(type === 'service' && durationMin > 0) stateBits.push('Durata: ' + String(durationMin) + ' min');
        if(type === 'service' && Number.isFinite(priceNum)) stateBits.push('Prezzo di listino: ' + fmtEUR(priceNum));
        if(type === 'service' && Number(it.current_is_active) === 0) stateBits.push('Servizio ora disattivato');
        if(type === 'service' && Number(it.no_operator) > 0) stateBits.push('Servizio senza operatore');
        if(linkedNow) stateBits.push('Collegato a questa prenotazione');
        if(qtyRedeemed > 0 && qtyTot > 0) stateBits.push('Già riscattato: ' + String(qtyRedeemed) + '/' + String(qtyTot));
        const right = (qtyTot > 0)
          ? (`<span class="badge text-bg-secondary">${escHtml(String(Math.max(0, qtyRem)))}</span><span class="text-muted small ms-1">/${escHtml(String(qtyTot))}</span>`)
          : (`<span class="text-muted small">—</span>`);
        const rowCls = 'list-group-item d-flex justify-content-between align-items-start' + (isSel ? ' list-group-item-warning' : '');
        return `
          <div class="${rowCls}">
            <div class="me-2">
              <div class="fw-semibold">${label}</div>
              ${stateBits.map(bit=>`<div class="small text-muted">${escHtml(bit)}</div>`).join('')}
            </div>
            <div class="text-end ms-auto" style="white-space:nowrap">${right}</div>
          </div>
        `;
      }).filter(Boolean).join('');

      const movementRows = movements.map(m => {
        if(!m || typeof m !== 'object') return '';
        const qty = Number(m.qty_display != null ? m.qty_display : m.qty || 0) || 0;
        const qtyCls = qty > 0 ? 'text-success' : (qty < 0 ? 'text-danger' : '');
        const dt = m.created_at ? escHtml(fmtDateTimeFromSql(m.created_at)) : '—';
        const tp = escHtml(String(m.type_display || '').trim() || qbGiftTxLabel(m.type));
        const svcProd = escHtml(String(m.service_product_display || m.service_product || '—'));
        const note = escHtml(String(m.note_display || m.note || '—'));
        const uname = escHtml(String(m.user_name || '—'));
        return `
          <tr>
            <td class="text-muted">${dt}</td>
            <td class="fw-semibold">${tp}</td>
            <td class="text-end"><span class="fw-semibold ${qtyCls}">${escHtml(String(qty))}</span></td>
            <td class="text-muted">${svcProd}</td>
            <td class="text-muted">${note}</td>
            <td class="text-muted">${uname}</td>
          </tr>
        `;
      }).filter(Boolean).join('');

      const movementsHtml = `
        <div class="card mt-3">
          <div class="card-header py-2">
            <div class="small text-muted">Movimenti</div>
          </div>
          <div class="table-responsive">
            <table class="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th class="text-end">Qtà</th>
                  <th>Servizio / premio</th>
                  <th>Nota</th>
                  <th>Operatore</th>
                </tr>
              </thead>
              <tbody>
                ${movementRows || '<tr><td colspan="6" class="text-muted p-3">Nessun movimento.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      `;

      return `
        <div class="mb-2">
          ${headParts.join('')}
        </div>
        ${rewardHtml}
        ${description ? `<div class="small mb-3">${escHtml(description)}</div>` : ''}
        ${cancelReason ? `<div class="small text-danger mb-3">Motivo annullamento: ${escHtml(cancelReason)}</div>` : ''}
        ${selLine}
        <div class="card">
          <div class="card-header py-2">
            <div class="small text-muted">Dettaglio premio</div>
          </div>
          <div class="list-group list-group-flush">
            ${rows || '<div class="text-muted small p-2">Nessun dettaglio disponibile.</div>'}
          </div>
        </div>
        ${movementsHtml}
      `;
    }

    function qbOpenGiftInfo(instanceId, rewardItemIndex, serviceId){
      if(!qbGiftInfoModal || !qbGiftInfoBody) return;

      const iid = String(instanceId || '').trim();
      if(!iid) return;

      if(qbGiftInfoTitle) qbGiftInfoTitle.textContent = 'Dettagli omaggio';
      if(qbGiftInfoOpenNew){
        qbGiftInfoOpenNew.href = 'index.php?page=gift_instance&id=' + encodeURIComponent(iid);
      }

      qbGiftInfoBody.innerHTML = appInlineLoadingHtml();
      qbGiftInfoModal.show();

      const myReq = ++qbGiftInfoReqId;
      const cid = qbClientId ? String(qbClientId.value || '').trim() : '';

      const params = new URLSearchParams();
      params.set('page', 'api_clients');
      params.set('action', 'gift_instance');
      params.set('instance_id', iid);
      if(cid) params.set('client_id', cid);

      const apptId = apptIdEl ? String(apptIdEl.value || '').trim() : '';
      if(apptId) params.set('appointment_id', apptId);
      if(serviceId) params.set('selected_service_id', String(serviceId));
      if(rewardItemIndex !== undefined && rewardItemIndex !== null && String(rewardItemIndex).trim() !== '') {
        params.set('selected_reward_item_index', String(rewardItemIndex));
      }

      fetch('index.php?' + params.toString(), {credentials:'same-origin'})
        .then(r => r.json())
        .then(j => {
          if(myReq !== qbGiftInfoReqId) return;
          if(!j || !j.ok || !j.gift){
            const msg = (j && j.error) ? String(j.error) : 'Impossibile caricare i dettagli dell\'gift.';
            qbGiftInfoBody.innerHTML = '<div class="text-danger small p-2">' + escHtml(msg) + '</div>';
            return;
          }
          const info = j.gift;
          if(qbGiftInfoTitle){
            const items = Array.isArray(info.items) ? info.items : [];
            const selSvcId = parseInt(String(serviceId || '0'), 10) || 0;
            const selIdx = parseInt(String(rewardItemIndex || '0'), 10) || 0;
            const selItem = items.find(it => {
              if(!it || typeof it !== 'object') return false;
              const itemSvcId = parseInt(String(it.service_id || '0'), 10) || 0;
              const itemIdx = parseInt(String(it.reward_item_index || '0'), 10) || 0;
              if(selSvcId > 0 && itemSvcId !== selSvcId) return false;
              if(selIdx > 0 && itemIdx !== selIdx) return false;
              return selSvcId > 0 || selIdx > 0;
            }) || null;
            const selTitle = selItem ? String(selItem.service_name || selItem.reward_label || '').trim() : '';
            const giftName = String(info.gift_name || 'gift').trim();
            qbGiftInfoTitle.textContent = selTitle ? (selTitle + ' • ' + giftName) : (giftName || 'Dettagli omaggio');
          }
          qbGiftInfoBody.innerHTML = qbRenderGiftInfo(info, serviceId, rewardItemIndex);
        })
        .catch(()=>{
          if(myReq !== qbGiftInfoReqId) return;
          qbGiftInfoBody.innerHTML = '<div class="text-danger small p-2">Errore di rete durante il caricamento.</div>';
        });
    }


    // ------------------------------------------------------------
    // Quick booking: popup dettagli Servizio prepagato collegato ad un servizio
    // ------------------------------------------------------------

    function qbRenderPrepaidServiceInfo(info, selectedServiceId){
      if(!info) return '<div class="text-muted small p-2">Nessun dettaglio disponibile.</div>';

      const svcId = (info.service_id !== undefined && info.service_id !== null) ? Number(info.service_id) : 0;
      const nameRaw = String(info.service_name || '').trim();
      const name = escHtml(nameRaw || (svcId ? ('Servizio #' + String(svcId)) : 'Servizio'));
      const currentNameRaw = String(info.current_service_name || '').trim();
      const currentName = escHtml(currentNameRaw);
      const prepaidNameRaw = String(info.prepaid_service_name || '').trim();
      const prepaidName = escHtml(prepaidNameRaw);
      const status = escHtml(String(info.status || '').trim() || '—');
      const purchase = info.purchase_date ? escHtml(fmtDateTimeFromSql(info.purchase_date)) : '—';
      const exp = info.expires_at ? escHtml(fmtDateTimeFromSql(info.expires_at)) : '—';
      const unitPrice = fmtEUR(Number(info.unit_price != null ? info.unit_price : (info.service_price_locked != null ? info.service_price_locked : 0)));
      const totalPaid = fmtEUR(Number(info.total_paid != null ? info.total_paid : (info.unit_price != null ? info.unit_price : 0)));
      const tot = (info.purchased_qty !== undefined && info.purchased_qty !== null) ? Number(info.purchased_qty) : null;
      const rem = (info.remaining_qty !== undefined && info.remaining_qty !== null) ? Number(info.remaining_qty) : null;
      const remCurrent = (info.remaining_qty_current !== undefined && info.remaining_qty_current !== null) ? Number(info.remaining_qty_current) : null;
      const saleId = (info.sale_id !== undefined && info.sale_id !== null) ? Number(info.sale_id) : 0;
      const durationMin = (info.service_duration_min !== undefined && info.service_duration_min !== null) ? Number(info.service_duration_min) : 0;
      const notes = String(info.notes || '').trim();

      let selName = '';
      try{
        const ch = findServiceCheckById(String(selectedServiceId || svcId || ''));
        if(ch){
          selName = String(ch.dataset.name || ch.getAttribute('data-name') || '').trim();
        }
      }catch(_){ }

      const isSel = (selectedServiceId && svcId && String(svcId) === String(selectedServiceId));
      const right = (tot !== null && tot > 0 && rem !== null)
        ? (`<span class="badge text-bg-secondary">${escHtml(String(Math.max(0, rem)))}</span><span class="text-muted small ms-1">/${escHtml(String(tot))}</span>`)
        : (`<span class="text-muted small">—</span>`);

      const headParts = [];
      headParts.push(`<div class="fw-bold">${name}</div>`);
      const metaLine = [];
      metaLine.push('Stato: ' + status);
      metaLine.push('Acquistato: ' + purchase);
      metaLine.push('Scade: ' + exp);
      if(saleId > 0) metaLine.push('Vendita #' + String(saleId));
      headParts.push(`<div class="text-muted small">${escHtml(metaLine.join(' • '))}</div>`);
      if(rem !== null || tot !== null){
        const a = [];
        if(rem !== null) a.push(String(Math.max(0, rem)));
        if(tot !== null && tot > 0) a.push(String(tot));
        headParts.push(`<div class="text-muted small">Residuo complessivo: ${escHtml(a.join(' / '))}</div>`);
      }
      if(remCurrent !== null && rem !== null && remCurrent !== rem){
        const a = [];
        a.push(String(Math.max(0, remCurrent)));
        if(tot !== null && tot > 0) a.push(String(tot));
        headParts.push(`<div class="text-muted small">Residuo attuale: ${escHtml(a.join(' / '))}</div>`);
      }

      const selLine = selName ? `<div class="alert alert-light border small py-2 px-2 mb-3">Servizio selezionato: <span class="fw-semibold">${escHtml(selName)}</span></div>` : '';

      const detailBits = [];
      if(prepaidNameRaw && prepaidNameRaw !== nameRaw){
        detailBits.push(`<div class="small text-muted">Nome residuo/vendita: <span class="fw-semibold">${prepaidName}</span></div>`);
      }
      if(currentNameRaw && currentNameRaw !== nameRaw && currentNameRaw !== prepaidNameRaw){
        detailBits.push(`<div class="small text-muted">Servizio attuale in listino: <span class="fw-semibold">${currentName}</span></div>`);
      }
      if(Number.isFinite(durationMin) && durationMin > 0){
        detailBits.push(`<div class="small text-muted">Durata: ${escHtml(String(durationMin))} min</div>`);
      }
      detailBits.push(`<div class="small text-muted">Prezzo bloccato: ${escHtml(unitPrice)}</div>`);
      if(totalPaid !== unitPrice || (tot !== null && tot > 1)){
        detailBits.push(`<div class="small text-muted">Totale pagato: ${escHtml(totalPaid)}</div>`);
      }
      const stateBits = [];
      if(info.snapshot_is_active !== undefined && info.snapshot_is_active !== null && info.snapshot_is_active !== ''){
        stateBits.push('Venduto come ' + (Number(info.snapshot_is_active) > 0 ? 'attivo' : 'non attivo'));
      }
      if(info.current_is_active !== undefined && info.current_is_active !== null && Number(info.current_is_active) === 0){
        stateBits.push('ora disattivato');
      }
      if(stateBits.length){
        detailBits.push(`<div class="small text-muted">${escHtml(stateBits.join(' • '))}</div>`);
      }

      return `
        <div class="mb-2">
          ${headParts.join('')}
        </div>
        ${selLine}
        ${notes ? `<div class="small mb-3">${escHtml(notes)}</div>` : ''}
        <div class="card">
          <div class="card-header py-2">
            <div class="small text-muted">Dettaglio servizio acquistato</div>
          </div>
          <div class="list-group list-group-flush">
            <div class="list-group-item d-flex justify-content-between align-items-start${isSel ? ' list-group-item-warning' : ''}">
              <div class="me-2">
                <div class="fw-semibold">${name}</div>
                ${detailBits.join('')}
                ${isSel ? '<div class="small text-muted">Collegato a questa prenotazione</div>' : ''}
              </div>
              <div class="text-end ms-auto" style="white-space:nowrap">${right}</div>
            </div>
          </div>
        </div>
      `;
    }

    function qbOpenPrepaidServiceInfo(prepaidServiceId, serviceId){
      if(!qbPrepaidServiceInfoModal || !qbPrepaidServiceInfoBody) return;

      const pid = String(prepaidServiceId || '').trim();
      if(!pid) return;

      if(qbPrepaidServiceInfoTitle) qbPrepaidServiceInfoTitle.textContent = 'Dettagli Servizio prepagato';
      if(qbPrepaidServiceInfoOpenNew){
        qbPrepaidServiceInfoOpenNew.href = '#';
      }

      qbPrepaidServiceInfoBody.innerHTML = appInlineLoadingHtml();
      qbPrepaidServiceInfoModal.show();

      const myReq = ++qbPrepaidServiceInfoReqId;
      const cid = qbClientId ? String(qbClientId.value || '').trim() : '';

      const params = new URLSearchParams();
      params.set('page', 'api_clients');
      params.set('action', 'prepaid_service');
      params.set('id', pid);
      if(cid) params.set('client_id', cid);

      const apptId = apptIdEl ? String(apptIdEl.value || '').trim() : '';
      if(apptId){
        params.set('appointment_id', apptId);
        if(serviceId) params.set('selected_service_id', String(serviceId));
      }

      fetch('index.php?' + params.toString(), {credentials:'same-origin'})
        .then(r => r.json())
        .then(j => {
          if(myReq !== qbPrepaidServiceInfoReqId) return;
          if(!j || !j.ok || !j.prepaid_service){
            const msg = (j && j.error) ? String(j.error) : 'Impossibile caricare i dettagli del servizio prepagato.';
            qbPrepaidServiceInfoBody.innerHTML = '<div class="text-danger small p-2">' + escHtml(msg) + '</div>';
            return;
          }
          const info = j.prepaid_service;
          if(qbPrepaidServiceInfoTitle){
            const nm = String(info.service_name || 'Servizio prepagato').trim();
            const saleLabel = (Number(info.sale_id || 0) > 0) ? (' • Vendita #' + String(parseInt(String(info.sale_id || 0), 10))) : '';
            qbPrepaidServiceInfoTitle.textContent = (nm || 'Dettagli Servizio prepagato') + saleLabel;
          }
          if(qbPrepaidServiceInfoOpenNew){
            const saleId = parseInt(String(info.sale_id || 0), 10) || 0;
            const clientId = parseInt(String(info.client_id || 0), 10) || 0;
            qbPrepaidServiceInfoOpenNew.href = saleId > 0
              ? ('index.php?page=pos_sale_detail&id=' + encodeURIComponent(String(saleId)))
              : (clientId > 0 ? ('index.php?page=clients&action=view&id=' + encodeURIComponent(String(clientId))) : '#');
          }
          qbPrepaidServiceInfoBody.innerHTML = qbRenderPrepaidServiceInfo(info, serviceId);
        })
        .catch(()=>{
          if(myReq !== qbPrepaidServiceInfoReqId) return;
          qbPrepaidServiceInfoBody.innerHTML = '<div class="text-danger small p-2">Errore di rete durante il caricamento.</div>';
        });
    }

    // ------------------------------------------------------------
    // Quick booking: popup dettagli GiftCard applicata alla prenotazione
    // ------------------------------------------------------------

    function qbGiftcardStatusLabel(st){
      const s = String(st || '').trim().toLowerCase();
      if(s === 'active') return 'Attiva';
      if(s === 'redeemed') return 'Esaurita';
      if(s === 'expired') return 'Scaduta';
      if(s === 'cancelled') return 'Annullata';
      return s ? s : '—';
    }

    function qbGiftcardTxLabel(tp){
      const t = String(tp || '').trim().toLowerCase();
      if(t === 'issue') return 'Emissione';
      if(t === 'topup') return 'Ricarica';
      if(t === 'redeem') return 'Utilizzo';
      if(t === 'refund') return 'Rimborso';
      if(t === 'cancel') return 'Annullamento';
      if(t === 'expire') return 'Scadenza';
      if(t === 'adjust') return 'Rettifica';
      return t ? t : '—';
    }

    function qbRenderGiftcardInfo(gc, usedAmount){
      if(!gc) return '<div class="text-muted small p-2">Nessun dettaglio disponibile.</div>';

      const code = escHtml(String(gc.code || '').trim());
      const statusMeta = qbGiftcardStatusMeta(gc.status || '');
      const statusBadge = qbStatusBadgeHtml(statusMeta.label, statusMeta.badge, statusMeta.extraClass);
      const bal = (gc.balance !== undefined && gc.balance !== null) ? Number(gc.balance) : 0;
      const issued = gc.issued_at ? escHtml(fmtDateTimeFromSql(gc.issued_at)) : '—';
      const exp = gc.expires_at ? escHtml(fmtDateTimeFromSql(gc.expires_at, { endOfDay: true })) : '—';
      const clientName = escHtml(String(gc.client_name || '').trim());
      const recName = escHtml(String(gc.recipient_name || '').trim());
      const recEmail = escHtml(String(gc.recipient_email || '').trim());

      const useAmt = (usedAmount !== undefined && usedAmount !== null) ? (parseFloat(String(usedAmount).replace(',', '.')) || 0) : 0;

      const head = [];
      head.push(`<div class="fw-bold">${code ? ('<code>' + code + '</code>') : 'GiftCard'}</div>`);
      const meta = [];
      meta.push('Stato: ' + statusBadge);
      meta.push('Saldo: <strong>' + escHtml(fmtEUR(bal)) + '</strong>');
      meta.push('Emessa: ' + issued);
      meta.push('Scade: ' + exp);
      head.push(`<div class="text-muted small">${meta.join(' • ')}</div>`);
      if(clientName) head.push(`<div class="text-muted small">Cliente: <span class="fw-semibold">${clientName}</span></div>`);
      if(recName || recEmail){
        const rr = [];
        if(recName) rr.push(recName);
        if(recEmail) rr.push('&lt;' + recEmail + '&gt;');
        head.push(`<div class="text-muted small">Destinatario: ${rr.join(' ')}</div>`);
      }

      const usedBox = (useAmt > 0.000001)
        ? `<div class="alert alert-success border small py-2 px-2 mt-3 mb-3">Applicata a questa prenotazione: <span class="fw-semibold">- ${escHtml(fmtEUR(useAmt))}</span></div>`
        : '';

      const txs = Array.isArray(gc.transactions) ? gc.transactions : [];
      const rows = txs.slice(0, 50).map(t => {
        if(!t) return '';
        const dt = t.created_at ? escHtml(fmtDateTimeFromSql(t.created_at)) : '—';
        const tp = escHtml(qbGiftcardTxLabel(t.type || t.tx_type || ''));
        const note = escHtml(String(t.note || '').trim());
        const amt = (t.amount !== undefined && t.amount !== null) ? Number(t.amount) : 0;
        const sign = (amt >= 0) ? '+ ' : '- ';
        const v = escHtml(fmtEUR(Math.abs(amt)));
        return `
          <tr>
            <td class="text-nowrap">${dt}</td>
            <td class="text-nowrap">${tp}</td>
            <td class="text-end text-nowrap fw-semibold">${sign}${v}</td>
            <td class="small">${note}</td>
          </tr>
        `;
      }).filter(Boolean).join('');

      const txTable = `
        <div class="card mt-2">
          <div class="card-header py-2">
            <div class="small text-muted">Movimenti recenti</div>
          </div>
          <div class="table-responsive">
            <table class="table table-sm mb-0">
              <thead>
                <tr>
                  <th class="small text-muted">Data</th>
                  <th class="small text-muted">Tipo</th>
                  <th class="small text-muted text-end">Importo</th>
                  <th class="small text-muted">Note</th>
                </tr>
              </thead>
              <tbody>
                ${rows || '<tr><td colspan="4" class="text-muted small p-2">Nessun movimento disponibile.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      `;

      return `
        <div class="mb-2">
          ${head.join('')}
        </div>
        ${usedBox}
        ${txTable}
      `;
    }

    function qbOpenGiftcardInfo(giftcardId, usedAmount){
      if(!qbGiftcardInfoModal || !qbGiftcardInfoBody) return;

      const gid = parseInt(String(giftcardId || '0'), 10) || 0;
      if(!(gid > 0)) return;

      if(qbGiftcardInfoTitle) qbGiftcardInfoTitle.textContent = 'Dettagli GiftCard';
      if(qbGiftcardInfoOpenNew){
        qbGiftcardInfoOpenNew.href = 'index.php?page=giftcard&action=edit&id=' + encodeURIComponent(String(gid));
      }

      qbGiftcardInfoBody.innerHTML = appInlineLoadingHtml();
      qbGiftcardInfoModal.show();

      const myReq = ++qbGiftcardInfoReqId;
      const cid = qbClientId ? String(qbClientId.value || '').trim() : '';

      const params = new URLSearchParams();
      params.set('page', 'api_clients');
      params.set('action', 'giftcard');
      params.set('giftcard_id', String(gid));
      if(cid) params.set('client_id', cid);

      fetch('index.php?' + params.toString(), {credentials:'same-origin'})
        .then(r => r.json())
        .then(j => {
          if(myReq !== qbGiftcardInfoReqId) return;
          if(!j || !j.ok || !j.giftcard){
            const msg = (j && j.error) ? String(j.error) : 'Impossibile caricare i dettagli della GiftCard.';
            qbGiftcardInfoBody.innerHTML = '<div class="text-danger small p-2">' + escHtml(msg) + '</div>';
            return;
          }
          const gc = j.giftcard;
          if(qbGiftcardInfoTitle){
            const cd = String(gc.code || '').trim();
            qbGiftcardInfoTitle.textContent = cd ? ('GiftCard • ' + cd) : 'Dettagli GiftCard';
          }
          qbGiftcardInfoBody.innerHTML = qbRenderGiftcardInfo(gc, usedAmount);
        })
        .catch(()=>{
          if(myReq !== qbGiftcardInfoReqId) return;
          qbGiftcardInfoBody.innerHTML = '<div class="text-danger small p-2">Errore di rete durante il caricamento.</div>';
        });
    }

    // GiftBox / Pacchetti -> Quick Booking: aggiunta servizi dalla modale "Residui"
    if(qbClientResidualsBody){
      qbClientResidualsBody.addEventListener('click', async (e)=>{
        // 0) GiftCard (credito monetario)
        const gcRemoveBtn = e.target.closest('.qb-gc-remove');
        if(gcRemoveBtn){
          e.preventDefault();
          qbWriteGiftcardRedeem([]);
          renderPriceDetails();
          notify('GiftCard rimossa dalla prenotazione.', 'info');

          // Best-effort UI cleanup inside modal
          try{
            qbClientResidualsBody.querySelectorAll('.qb-gc-radio').forEach(r => { r.checked = false; });
            qbClientResidualsBody.querySelectorAll('.qb-gc-controls').forEach(el => el.classList.add('d-none'));
            qbClientResidualsBody.querySelectorAll('.qb-gc-amount').forEach(inp => { inp.value = ''; });
          }catch(_){ }
          return;
        }

        const gcMaxBtn = e.target.closest('.qb-gc-max');
        if(gcMaxBtn){
          e.preventDefault();
          const item = gcMaxBtn.closest('.qb-gc-item');
          if(!item) return;
          const bal = parseFloat(String(item.dataset.balance || '0').replace(',', '.')) || 0;
          // "Usa max" should never throw warnings: it just fills the input.
          // If the booking total is not yet available (0), default to the GiftCard balance.
          const dueNow = qbNormMoney(Math.max(0, qbLastDueBeforePayments || 0));
          const maxUse = qbNormMoney(Math.max(0, (dueNow > 0.000001) ? Math.min(bal, dueNow) : bal));
          const inp = item.querySelector('.qb-gc-amount');
          if(inp){
            inp.value = maxUse > 0 ? String(maxUse.toFixed(2)) : '';
          }
          return;
        }

        const gcApplyBtn = e.target.closest('.qb-gc-apply');
        if(gcApplyBtn){
          e.preventDefault();
          const item = gcApplyBtn.closest('.qb-gc-item');
          if(!item) return;

          const id = parseInt(String(item.dataset.id || '0'), 10) || 0;
          const code = String(item.dataset.code || '').trim();
          const bal = parseFloat(String(item.dataset.balance || '0').replace(',', '.')) || 0;
          const dueNow = qbNormMoney(Math.max(0, qbLastDueBeforePayments || 0));
          const maxUse = qbNormMoney(Math.max(0, Math.min(bal, dueNow)));

          const inp = item.querySelector('.qb-gc-amount');
          let amtRaw = inp ? String(inp.value || '').trim() : '';
          let amt = amtRaw ? (parseFloat(amtRaw.replace(',', '.')) || 0) : maxUse;
          amt = qbNormMoney(Math.max(0, amt));
          amt = qbNormMoney(Math.min(amt, maxUse));

          if(!id){
            notify('Seleziona una GiftCard.', 'warning');
            return;
          }

          // If there is no total yet, we cannot apply a monetary payment.
          if(!(dueNow > 0.000001)){
            notify("Non c'è importo da applicare: il totale prenotazione è 0. Aggiungi prima i servizi.", 'warning');
            return;
          }

          if(!(amt > 0)) {
            notify('Inserisci un importo valido.', 'warning');
            return;
          }

          qbWriteGiftcardRedeem([{ giftcard_id: id, code, amount: amt }]);
          renderPriceDetails();
          notify('GiftCard applicata alla prenotazione.', 'success');
          return;
        }

        // 1) GiftBox
        const gbBtn = e.target.closest('.qb-gb-apply');
        if(gbBtn){
          e.preventDefault();
          const wrap = gbBtn.closest('.qb-gb-instance');
          if(!wrap) return;

          const checks = Array.from(wrap.querySelectorAll('.qb-gb-svc-check'));
          if(!checks.length){
            notify('Nessun servizio selezionabile in questa GiftBox.', 'warning');
            return;
          }


          // Backend check: se una voce GiftBox è già associata ad un'altra prenotazione (in sospeso / prenotato),
          // non permettere l'aggiunta e indica la prenotazione in conflitto.
          const gbToCheck = [];
          for(const ch of checks){
            if(!ch.checked) continue;
            const serviceId = parseInt(ch.dataset.serviceId || '', 10);
            const instanceId = parseInt(ch.dataset.instanceId || '', 10);
            const itemId = parseInt(ch.dataset.itemId || '', 10);
            if(!serviceId || !instanceId || !itemId) continue;
            gbToCheck.push({service_id: serviceId, instance_id: instanceId, giftbox_item_id: itemId, qty: 1});
          }

          if(gbToCheck.length){
            const chk = await qbCheckResidualsConflicts('giftbox', gbToCheck);
            if(!chk || chk.ok === false){
              notify((chk && chk.error) ? String(chk.error) : 'Errore durante la verifica dei residui GiftBox.', 'danger');
              return;
            }
            const conflicts = Array.isArray(chk.giftboxes) ? chk.giftboxes : [];
            if(conflicts.length){
              const msg = Array.isArray(chk.messages) && chk.messages.length ? chk.messages.join(' | ') : "Alcuni residui GiftBox sono già presenti in un'altra prenotazione.";
              notify(msg, 'warning');

              const keySet = new Set(conflicts.map(c => String(c.instance_id) + ':' + String(c.giftbox_item_id)));
              for(const ch of checks){
                if(!ch.checked) continue;
                const k = String(parseInt(ch.dataset.instanceId || '', 10)) + ':' + String(parseInt(ch.dataset.itemId || '', 10));
                if(keySet.has(k)) ch.checked = false;
              }
            }
          }

          // Build current map by service_id
          const current = qbReadGiftboxRedeem();
          const bySvc = new Map();
          for(const it of current){
            bySvc.set(it.service_id, it);
          }

          let changed = 0;
          let addedServices = 0;
          let missingServices = 0;
          const addedNames = [];
          const missingNames = [];
          const linkedSvcIds = new Set();
          const selectedBefore = qbSelectedServiceIdsSet();

          for(const ch of checks){
            const serviceId = parseInt(ch.dataset.serviceId || '', 10);
            const instanceId = parseInt(ch.dataset.instanceId || '', 10);
            const itemId = parseInt(ch.dataset.itemId || '', 10);
            if(!serviceId || !instanceId || !itemId) continue;

            if(ch.checked){
              // Ensure the service is part of the appointment
              const okSel = qbEnsureServiceSelectedFromResidualCheckbox(ch, true);
              if(okSel){
                linkedSvcIds.add(serviceId);
                if(!selectedBefore.has(serviceId)) {
                  addedServices++;
                  const lbl = wrap.querySelector('label[for="' + ch.id + '"]');
                  const nm = (lbl ? lbl.textContent : '').trim().replace(/\s+/g,' ');
                  addedNames.push(nm || ('Servizio #' + String(serviceId)));
                }
              } else {
                missingServices++;
                const lbl = wrap.querySelector('label[for="' + ch.id + '"]');
                const nm = (lbl ? lbl.textContent : '').trim().replace(/\s+/g,' ');
                missingNames.push(nm || ('Servizio #' + String(serviceId)));
              }

              const prev = bySvc.get(serviceId);
              if(!prev || prev.instance_id !== instanceId || prev.giftbox_item_id !== itemId || (prev && (prev.qty_total == null || prev.qty_remaining == null || (!prev.giftbox_code && !prev.giftbox_name)))){
                // Enrich mapping with GiftBox meta (code + qty info) for UI traceability
                const qtyRem = parseInt(ch.dataset.qtyRemaining || '', 10);
                const qtyTot = parseInt(ch.dataset.qtyTotal || '', 10);
                const gbCode = (wrap && wrap.dataset && wrap.dataset.gbCode) ? String(wrap.dataset.gbCode || '').trim() : '';
                const gbName = (wrap && wrap.dataset && wrap.dataset.gbName) ? String(wrap.dataset.gbName || '').trim() : '';

                const gbObj = {service_id: serviceId, instance_id: instanceId, giftbox_item_id: itemId, qty: 1, redeemed_at: null};
                if(Number.isFinite(qtyTot) && qtyTot > 0) gbObj.qty_total = qtyTot;
                if(Number.isFinite(qtyRem) && qtyRem >= 0) gbObj.qty_remaining = qtyRem;
                if(gbCode) gbObj.giftbox_code = gbCode;
                if(gbName) gbObj.giftbox_name = gbName;

                bySvc.set(serviceId, gbObj);
                changed++;
              }
            }else{
              const prev = bySvc.get(serviceId);
              if(prev && prev.instance_id === instanceId && prev.giftbox_item_id === itemId){
                bySvc.delete(serviceId);
                changed++;
              }
            }
          }

          // If a service is explicitly linked to GiftBox, detach it from any other prepaid association
          if(linkedSvcIds.size && qbPackageRedeemInput){
            try{
              const pk = qbReadPackageRedeem();
              const pkPruned = pk.filter(it => !linkedSvcIds.has(it.service_id));
              qbWritePackageRedeem(pkPruned);
            }catch(_){ }
          }
          if(linkedSvcIds.size && qbPrepaidServiceRedeemInput){
            try{
              const ps = qbReadPrepaidServiceRedeem();
              const psPruned = ps.filter(it => !linkedSvcIds.has(it.service_id));
              qbWritePrepaidServiceRedeem(psPruned);
            }catch(_){ }
          }

          qbWriteGiftboxRedeem(Array.from(bySvc.values()));
          qbSyncServicesUI();

          // Feedback to the operator
          if(missingServices){
            notify('Alcuni servizi non sono disponibili nel listino e non sono stati aggiunti: ' + missingNames.join(', '), 'warning');
          }

          if(addedServices){
            notify('Servizi aggiunti alla prenotazione: ' + addedNames.join(', '), 'success');
          } else if(changed) {
            notify('Associazione GiftBox aggiornata per la prenotazione.', 'success');
          } else {
            notify('Nessuna modifica applicata.', 'info');
          }
          return;
        }

        // 2) Pacchetti
        const cpBtn = e.target.closest('.qb-cp-apply');
        if(cpBtn){
          e.preventDefault();
          const wrap = cpBtn.closest('.qb-cp-package');
          if(!wrap) return;

          const checks = Array.from(wrap.querySelectorAll('.qb-cp-svc-check'));
          if(!checks.length){
            notify('Nessuna seduta selezionabile in questo pacchetto.', 'warning');
            return;
          }


          // Backend check: se una seduta del pacchetto è già associata ad un'altra prenotazione (in sospeso / prenotato),
          // non permettere l'aggiunta e indica la prenotazione in conflitto.
          const pkToCheck = [];
          for(const ch of checks){
            if(!ch.checked) continue;
            const serviceId = parseInt(ch.dataset.serviceId || '', 10);
            const cpId = parseInt(ch.dataset.packageId || '', 10) || parseInt(wrap.dataset.packageId || '', 10);
            const cpSvcId = parseInt(ch.dataset.packageServiceId || '', 10);
            if(!serviceId || !cpId) continue;
            const obj = {service_id: serviceId, client_package_id: cpId, qty: 1};
            if(cpSvcId && cpSvcId > 0) obj.client_package_service_id = cpSvcId;
            pkToCheck.push(obj);
          }

          if(pkToCheck.length){
            const chk = await qbCheckResidualsConflicts('package', pkToCheck);
            if(!chk || chk.ok === false){
              notify((chk && chk.error) ? String(chk.error) : 'Errore durante la verifica dei residui del pacchetto.', 'danger');
              return;
            }
            const conflicts = Array.isArray(chk.packages) ? chk.packages : [];
            if(conflicts.length){
              const msg = Array.isArray(chk.messages) && chk.messages.length ? chk.messages.join(' | ') : "Alcune sedute del pacchetto sono già presenti in un'altra prenotazione.";
              notify(msg, 'warning');

              const keySet = new Set(conflicts.map(c => String(c.client_package_id) + ':' + String(c.service_id)));
              for(const ch of checks){
                if(!ch.checked) continue;
                const serviceId = parseInt(ch.dataset.serviceId || '', 10);
                const cpId = parseInt(ch.dataset.packageId || '', 10) || parseInt(wrap.dataset.packageId || '', 10);
                const k = String(cpId) + ':' + String(serviceId);
                if(keySet.has(k)) ch.checked = false;
              }
            }
          }

          // Build current map by service_id
          const current = qbReadPackageRedeem();
          const bySvc = new Map();
          for(const it of current){
            bySvc.set(it.service_id, it);
          }

          const pkgId = parseInt(wrap.dataset.packageId || '', 10);
          const pkgName = (wrap && wrap.dataset && wrap.dataset.packageName) ? String(wrap.dataset.packageName || '').trim() : '';

          const selectedBefore = qbSelectedServiceIdsSet();
          let changed = 0;
          let addedServices = 0;
          let missingServices = 0;
          const addedNames = [];
          const missingNames = [];
          const linkedSvcIds = new Set();

          for(const ch of checks){
            const serviceId = parseInt(ch.dataset.serviceId || '', 10);
            const cpId = parseInt(ch.dataset.packageId || '', 10) || pkgId;
            const cpSvcId = parseInt(ch.dataset.packageServiceId || '', 10);
            if(!serviceId || !cpId) continue;

            if(ch.checked){
              // Ensure the service is part of the appointment
              const okSel = qbEnsureServiceSelectedFromResidualCheckbox(ch, true);
              if(okSel){
                linkedSvcIds.add(serviceId);
                if(!selectedBefore.has(serviceId)) {
                  addedServices++;
                  const lbl = wrap.querySelector('label[for="' + ch.id + '"]');
                  const nm = (lbl ? lbl.textContent : '').trim().replace(/\s+/g,' ');
                  addedNames.push(nm || ('Servizio #' + String(serviceId)));
                }
              } else {
                missingServices++;
                const lbl = wrap.querySelector('label[for="' + ch.id + '"]');
                const nm = (lbl ? lbl.textContent : '').trim().replace(/\s+/g,' ');
                missingNames.push(nm || ('Servizio #' + String(serviceId)));
                continue;
              }

              const prev = bySvc.get(serviceId);
              if(!prev || prev.client_package_id !== cpId || (cpSvcId && prev.client_package_service_id !== cpSvcId) || (!prev.package_name && pkgName) || (prev.sessions_total == null || prev.sessions_remaining == null)){
                const qtyRem = parseInt(ch.dataset.sessionsRemaining || '', 10);
                const qtyTot = parseInt(ch.dataset.sessionsTotal || '', 10);

                const obj = {
                  service_id: serviceId,
                  client_package_id: cpId,
                  qty: 1,
                  redeemed_at: null
                };
                if(cpSvcId && cpSvcId > 0) obj.client_package_service_id = cpSvcId;
                if(pkgName) obj.package_name = pkgName;
                if(Number.isFinite(qtyTot) && qtyTot > 0) obj.sessions_total = qtyTot;
                if(Number.isFinite(qtyRem) && qtyRem >= 0) obj.sessions_remaining = qtyRem;

                bySvc.set(serviceId, obj);
                changed++;
              }
            } else {
              // If the service was previously associated to THIS package, detach.
              const prev = bySvc.get(serviceId);
              if(prev && prev.client_package_id === cpId){
                bySvc.delete(serviceId);
                changed++;
              }
            }
          }

          // If a service is explicitly linked to a Package, detach it from any other prepaid association
          if(linkedSvcIds.size && qbGiftboxRedeemInput){
            try{
              const gb = qbReadGiftboxRedeem();
              const gbPruned = gb.filter(it => !linkedSvcIds.has(it.service_id));
              qbWriteGiftboxRedeem(gbPruned);
            }catch(_){ }
          }
          if(linkedSvcIds.size && qbPrepaidServiceRedeemInput){
            try{
              const ps = qbReadPrepaidServiceRedeem();
              const psPruned = ps.filter(it => !linkedSvcIds.has(it.service_id));
              qbWritePrepaidServiceRedeem(psPruned);
            }catch(_){ }
          }

          qbWritePackageRedeem(Array.from(bySvc.values()));
          qbSyncServicesUI();

          if(missingServices){
            notify('Alcuni servizi non sono disponibili nel listino e non sono stati aggiunti: ' + missingNames.join(', '), 'warning');
          }

          if(addedServices){
            notify('Servizi aggiunti alla prenotazione: ' + addedNames.join(', '), 'success');
          } else if(changed) {
            notify('Associazione pacchetto aggiornata per la prenotazione.', 'success');
          } else {
            notify('Nessuna modifica applicata.', 'info');
          }
          return;
        }
      });

      // GiftCard: mostra/nasconde i controlli importo in base alla selezione
      qbClientResidualsBody.addEventListener('change', (e)=>{
        const radio = e.target && e.target.closest ? e.target.closest('.qb-gc-radio') : null;
        if(!radio) return;
        const item = radio.closest('.qb-gc-item');
        if(!item) return;

        // Hide all controls, show only selected
        qbClientResidualsBody.querySelectorAll('.qb-gc-controls').forEach(el => el.classList.add('d-none'));
        const ctrls = item.querySelector('.qb-gc-controls');
        if(ctrls) ctrls.classList.remove('d-none');

        // Pre-fill amount (max usable) if empty
        const inp = item.querySelector('.qb-gc-amount');
        if(inp && !String(inp.value || '').trim()){
          const bal = parseFloat(String(item.dataset.balance || '0').replace(',', '.')) || 0;
          const dueNow = qbNormMoney(Math.max(0, qbLastDueBeforePayments || 0));
          // If the booking total is not yet available (0), default to the GiftCard balance.
          const maxUse = qbNormMoney(Math.max(0, (dueNow > 0.000001) ? Math.min(bal, dueNow) : bal));
          inp.value = maxUse > 0 ? String(maxUse.toFixed(2)) : '';
        }
      });

      // GiftBox / Pacchetti: toggle checkbox = aggiungi/rimuovi servizio dalla prenotazione (senza pulsante)
      // - Evita duplicati: un servizio può essere collegato ad 1 solo residuo alla volta.
      // - Mantiene sincronizzati: servizi selezionati, mapping GiftBox/Pacchetti, pill UI.
      let qbResidualsAutoSync = false;

      const qbResidualsGetLabel = (ch)=>{
        try{
          const wrap = ch && ch.closest ? ch.closest('.qb-gb-instance, .qb-cp-package, .qb-ps-service, .qb-og-gift') : null;
          const lbl = wrap ? wrap.querySelector('label[for="' + ch.id + '"]') : null;
          const t = (lbl ? lbl.textContent : '').trim().replace(/\s+/g,' ');
          return t || '';
        }catch(_){
          return '';
        }
      };

      const qbResidualsUncheckOthersForService = (serviceId, keepEl)=>{
        if(!qbClientResidualsBody) return;
        const sid = String(serviceId || '').trim();
        if(!sid) return;
        const list = qbClientResidualsBody.querySelectorAll(
          '.qb-gb-svc-check[data-service-id="' + sid + '"], .qb-cp-svc-check[data-service-id="' + sid + '"], .qb-ps-svc-check[data-service-id="' + sid + '"], .qb-og-svc-check[data-service-id="' + sid + '"]'
        );
        qbResidualsAutoSync = true;
        try{
          for(const el of list){
            if(keepEl && el === keepEl) continue;
            if(el && el.checked) el.checked = false;
          }
        }catch(_){ }
        qbResidualsAutoSync = false;
      };

      const qbResidualsRemoveServiceFromMaps = (serviceId)=>{
        const sid = parseInt(String(serviceId || ''), 10) || 0;
        if(!sid) return;

        // GiftBox mapping
        if(qbGiftboxRedeemInput){
          try{
            const gb = qbReadGiftboxRedeem();
            const pr = gb.filter(it => Number(it?.service_id || 0) !== sid);
            qbWriteGiftboxRedeem(pr);
          }catch(_){ }
        }

        // Package mapping
        if(qbPackageRedeemInput){
          try{
            const pk = qbReadPackageRedeem();
            const pr = pk.filter(it => Number(it?.service_id || 0) !== sid);
            qbWritePackageRedeem(pr);
          }catch(_){ }
        }

        // Prepaid-service mapping
        if(qbPrepaidServiceRedeemInput){
          try{
            const ps = qbReadPrepaidServiceRedeem();
            const pr = ps.filter(it => Number(it?.service_id || 0) !== sid);
            qbWritePrepaidServiceRedeem(pr);
          }catch(_){ }
        }


        // gift mapping
        if(qbGiftRedeemInput){
          try{
            const og = qbReadGiftRedeem();
            const pr = og.filter(it => Number(it?.service_id || 0) !== sid);
            qbWriteGiftRedeem(pr);
          }catch(_){ }
        }

        // Multi-staff map: remove stale key
        if(staffMapInput){
          try{
            const cur = qbParseStaffMap();
            if(cur && typeof cur === 'object' && cur[String(sid)] !== undefined){
              delete cur[String(sid)];
              staffMapInput.value = Object.keys(cur).length ? JSON.stringify(cur) : '';
            }
          }catch(_){ }
        }

        // Cabin map: remove stale key
        if(cabinMapInput){
          try{
            const cur = qbParseCabinMap();
            if(cur && typeof cur === 'object' && cur[String(sid)] !== undefined){
              delete cur[String(sid)];
              cabinMapInput.value = Object.keys(cur).length ? JSON.stringify(cur) : '';
            }
          }catch(_){ }
        }
      };

      qbClientResidualsBody.addEventListener('change', async (e)=>{
        if(qbResidualsAutoSync) return;

        const gbCh = e.target && e.target.closest ? e.target.closest('.qb-gb-svc-check') : null;
        const cpCh = !gbCh && e.target && e.target.closest ? e.target.closest('.qb-cp-svc-check') : null;
        const ogCh = !gbCh && !cpCh && e.target && e.target.closest ? e.target.closest('.qb-og-svc-check') : null;
        const psCh = !gbCh && !cpCh && !ogCh && e.target && e.target.closest ? e.target.closest('.qb-ps-svc-check') : null;
        if(!gbCh && !cpCh && !ogCh && !psCh) return;

        const ch = gbCh || cpCh || ogCh || psCh;
        if(!ch) return;

        const serviceId = parseInt(ch.dataset.serviceId || '', 10) || 0;
        if(!serviceId) return;

        const wasSelected = qbSelectedServiceIdsSet().has(serviceId);
        const label = qbResidualsGetLabel(ch) || ('Servizio #' + String(serviceId));

        // Optimistic lock to avoid double toggles during async checks
        const prevDisabled = !!ch.disabled;
        ch.disabled = true;

        try{
          // --- CHECKED: add service + link residual ---
          if(ch.checked){

            if(gbCh){
              const instanceId = parseInt(ch.dataset.instanceId || '', 10) || 0;
              const itemId = parseInt(ch.dataset.itemId || '', 10) || 0;
              if(!instanceId || !itemId){
                notify('Residuo GiftBox non valido.', 'warning');
                qbResidualsAutoSync = true; ch.checked = false; qbResidualsAutoSync = false;
                return;
              }

              // Backend check: already used in other appointments
              const chk = await qbCheckResidualsConflicts('giftbox', [{service_id: serviceId, instance_id: instanceId, giftbox_item_id: itemId, qty: 1}]);
              if(!chk || chk.ok === false){
                notify((chk && chk.error) ? String(chk.error) : 'Errore durante la verifica dei residui GiftBox.', 'danger');
                qbResidualsAutoSync = true; ch.checked = false; qbResidualsAutoSync = false;
                return;
              }
              const conflicts = Array.isArray(chk.giftboxes) ? chk.giftboxes : [];
              if(conflicts.length){
                const msg = Array.isArray(chk.messages) && chk.messages.length ? chk.messages.join(' | ') : "Questo residuo GiftBox è già presente in un'altra prenotazione.";
                notify(msg, 'warning');
                qbResidualsAutoSync = true; ch.checked = false; qbResidualsAutoSync = false;
                return;
              }

              // Ensure the service is part of the appointment
              const okSel = qbEnsureServiceSelectedFromResidualCheckbox(ch, true);
              if(!okSel){
                notify('Il servizio non è disponibile nel listino e non può essere aggiunto: ' + label, 'warning');
                qbResidualsAutoSync = true; ch.checked = false; qbResidualsAutoSync = false;
                return;
              }

              // Link this service to the selected GiftBox item (unique by service_id)
              const current = qbReadGiftboxRedeem();
              const bySvc = new Map();
              for(const it of current){
                if(!it) continue;
                bySvc.set(Number(it.service_id || 0), it);
              }

              const wrap = ch.closest('.qb-gb-instance');
              const qtyRem = parseInt(ch.dataset.qtyRemaining || '', 10);
              const qtyTot = parseInt(ch.dataset.qtyTotal || '', 10);
              const gbCode = (wrap && wrap.dataset && wrap.dataset.gbCode) ? String(wrap.dataset.gbCode || '').trim() : '';
              const gbName = (wrap && wrap.dataset && wrap.dataset.gbName) ? String(wrap.dataset.gbName || '').trim() : '';

              const gbObj = {service_id: serviceId, instance_id: instanceId, giftbox_item_id: itemId, qty: 1, redeemed_at: null};
              if(Number.isFinite(qtyTot) && qtyTot > 0) gbObj.qty_total = qtyTot;
              if(Number.isFinite(qtyRem) && qtyRem >= 0) gbObj.qty_remaining = qtyRem;
              if(gbCode) gbObj.giftbox_code = gbCode;
              if(gbName) gbObj.giftbox_name = gbName;

              bySvc.set(serviceId, gbObj);
              qbWriteGiftboxRedeem(Array.from(bySvc.values()));

              // Detach from any other prepaid association for the same service
              if(qbPackageRedeemInput){
                try{
                  const pk = qbReadPackageRedeem();
                  const pkPruned = pk.filter(it => Number(it?.service_id || 0) !== serviceId);
                  qbWritePackageRedeem(pkPruned);
                }catch(_){ }
              }
              if(qbGiftRedeemInput){
                try{
                  const og = qbReadGiftRedeem();
                  const ogPruned = og.filter(it => Number(it?.service_id || 0) !== serviceId);
                  qbWriteGiftRedeem(ogPruned);
                }catch(_){ }
              }
              if(qbPrepaidServiceRedeemInput){
                try{
                  const ps = qbReadPrepaidServiceRedeem();
                  const psPruned = ps.filter(it => Number(it?.service_id || 0) !== serviceId);
                  qbWritePrepaidServiceRedeem(psPruned);
                }catch(_){ }
              }

              // Keep UI consistent: only one residual checkbox per service
              qbResidualsUncheckOthersForService(serviceId, ch);
              qbSyncServicesUI();

              notify(wasSelected ? ('Residuo GiftBox collegato: ' + label) : ('Servizio aggiunto dalla GiftBox: ' + label), 'success');
              return;
            }


            if(ogCh){
              const wrap = ch.closest('.qb-og-gift');
              const instanceId = parseInt(ch.dataset.instanceId || '', 10) || parseInt(wrap?.dataset?.instanceId || '', 10) || 0;
              const giftId = parseInt(ch.dataset.giftId || '', 10) || parseInt(wrap?.dataset?.giftId || '', 10) || 0;
              const rewardItemIndex = parseInt(ch.dataset.rewardItemIndex || '', 10) || 0;
              if(!instanceId){
                notify('omaggio non valido.', 'warning');
                qbResidualsAutoSync = true; ch.checked = false; qbResidualsAutoSync = false;
                return;
              }

              const qtySelectedDefault = parseInt(ch.dataset.qtySelectedDefault || '', 10);
              const selectedQty = (Number.isFinite(qtySelectedDefault) && qtySelectedDefault > 0) ? qtySelectedDefault : 1;
              const obj = {service_id: serviceId, instance_id: instanceId, gift_id: giftId, reward_item_index: rewardItemIndex, qty: selectedQty};
              const chk = await qbCheckResidualsConflicts('gift', [obj]);
              if(!chk || chk.ok === false){
                notify((chk && chk.error) ? String(chk.error) : 'Errore durante la verifica degli omaggi.', 'danger');
                qbResidualsAutoSync = true; ch.checked = false; qbResidualsAutoSync = false;
                return;
              }
              const conflicts = Array.isArray(chk.gifts) ? chk.gifts : [];
              if(conflicts.length){
                const msg = Array.isArray(chk.messages) && chk.messages.length ? chk.messages.join(' | ') : "Questo servizio omaggio è già presente in un'altra prenotazione.";
                notify(msg, 'warning');
                qbResidualsAutoSync = true; ch.checked = false; qbResidualsAutoSync = false;
                return;
              }

              const okSel = qbEnsureServiceSelectedFromResidualCheckbox(ch, true);
              if(!okSel){
                notify('Il servizio non è disponibile nel listino e non può essere aggiunto: ' + label, 'warning');
                qbResidualsAutoSync = true; ch.checked = false; qbResidualsAutoSync = false;
                return;
              }

              const current = qbReadGiftRedeem();
              const bySvc = new Map();
              for(const it of current){
                if(!it) continue;
                bySvc.set(Number(it.service_id || 0), it);
              }

              const serviceName = String(ch.dataset.serviceName || '').trim();
              const giftName = String(ch.dataset.giftName || '').trim();
              const durationMin = parseInt(ch.dataset.serviceDuration || '', 10);
              const servicePriceLocked = parseFloat(String(ch.dataset.servicePriceLocked || '').replace(',', '.'));
              const snapshotIsActive = parseInt(String(ch.dataset.snapshotIsActive || ''), 10);
              const currentIsActive = parseInt(String(ch.dataset.currentIsActive || ''), 10);
              const noOperator = parseInt(String(ch.dataset.noOperator || ''), 10);
              const qtyRemaining = parseInt(String(ch.dataset.qtyRemaining || ''), 10);
              const qtyTotal = parseInt(String(ch.dataset.qtyTotal || ''), 10);

              const ogObj = {service_id: serviceId, instance_id: instanceId, reward_item_index: rewardItemIndex, qty: selectedQty, redeemed_at: null};
              if(giftId > 0) ogObj.gift_id = giftId;
              if(serviceName) ogObj.service_name = serviceName;
              if(giftName) ogObj.gift_name = giftName;
              if(Number.isFinite(durationMin) && durationMin > 0) ogObj.service_duration_min = durationMin;
              if(Number.isFinite(servicePriceLocked)) ogObj.service_price_locked = servicePriceLocked;
              if(Number.isFinite(snapshotIsActive)) ogObj.snapshot_is_active = snapshotIsActive > 0 ? 1 : 0;
              if(Number.isFinite(currentIsActive)) ogObj.current_is_active = currentIsActive > 0 ? 1 : 0;
              if(Number.isFinite(noOperator)) ogObj.no_operator = noOperator > 0 ? 1 : 0;
              if(Number.isFinite(qtyRemaining) && qtyRemaining >= 0) ogObj.qty_remaining = qtyRemaining;
              if(Number.isFinite(qtyTotal) && qtyTotal > 0) ogObj.qty_total = qtyTotal;

              bySvc.set(serviceId, ogObj);
              qbWriteGiftRedeem(Array.from(bySvc.values()));

              // Detach only alternative residual mappings for the same service.
              // Do not prune qb_gift_redeem here, otherwise the just-selected gift is lost.
              if(qbGiftboxRedeemInput){
                try{
                  const gb = qbReadGiftboxRedeem();
                  const gbPruned = gb.filter(it => Number(it?.service_id || 0) !== serviceId);
                  qbWriteGiftboxRedeem(gbPruned);
                }catch(_){ }
              }
              if(qbPackageRedeemInput){
                try{
                  const pk = qbReadPackageRedeem();
                  const pkPruned = pk.filter(it => Number(it?.service_id || 0) !== serviceId);
                  qbWritePackageRedeem(pkPruned);
                }catch(_){ }
              }
              if(qbPrepaidServiceRedeemInput){
                try{
                  const ps = qbReadPrepaidServiceRedeem();
                  const psPruned = ps.filter(it => Number(it?.service_id || 0) !== serviceId);
                  qbWritePrepaidServiceRedeem(psPruned);
                }catch(_){ }
              }

              qbResidualsUncheckOthersForService(serviceId, ch);
              qbSyncServicesUI();
              notify(wasSelected ? ('omaggio collegato: ' + label) : ('Servizio aggiunto da omaggio: ' + label), 'success');
              return;
            }

            if(psCh){
              const wrap = ch.closest('.qb-ps-service');
              const prepaidId = parseInt(ch.dataset.prepaidServiceId || '', 10) || parseInt(wrap?.dataset?.prepaidServiceId || '', 10) || 0;
              if(!prepaidId){
                notify('Residuo servizio non valido.', 'warning');
                qbResidualsAutoSync = true; ch.checked = false; qbResidualsAutoSync = false;
                return;
              }

              const obj = {service_id: serviceId, client_prepaid_service_id: prepaidId, qty: 1};
              const chk = await qbCheckResidualsConflicts('service', [obj]);
              if(!chk || chk.ok === false){
                notify((chk && chk.error) ? String(chk.error) : 'Errore durante la verifica dei servizi prepagati.', 'danger');
                qbResidualsAutoSync = true; ch.checked = false; qbResidualsAutoSync = false;
                return;
              }
              const conflicts = Array.isArray(chk.services) ? chk.services : [];
              if(conflicts.length){
                const msg = Array.isArray(chk.messages) && chk.messages.length ? chk.messages.join(' | ') : "Questo servizio prepagato è già presente in un'altra prenotazione.";
                notify(msg, 'warning');
                qbResidualsAutoSync = true; ch.checked = false; qbResidualsAutoSync = false;
                return;
              }

              const okSel = qbEnsureServiceSelectedFromResidualCheckbox(ch, true);
              if(!okSel){
                notify('Il servizio non è disponibile nel listino e non può essere aggiunto: ' + label, 'warning');
                qbResidualsAutoSync = true; ch.checked = false; qbResidualsAutoSync = false;
                return;
              }

              const current = qbReadPrepaidServiceRedeem();
              const bySvc = new Map();
              for(const it of current){
                if(!it) continue;
                bySvc.set(Number(it.service_id || 0), it);
              }

              const qtyRem = parseInt(ch.dataset.qtyRemaining || '', 10);
              const qtyTot = parseInt(ch.dataset.qtyTotal || '', 10);
              const unitPrice = parseFloat(String(ch.dataset.servicePriceLocked || '').replace(',', '.'));
              const saleId = parseInt(String(ch.dataset.saleId || wrap?.dataset?.saleId || ''), 10);
              const serviceName = String(ch.dataset.serviceName || '').trim();

              const psObj = {service_id: serviceId, client_prepaid_service_id: prepaidId, prepaid_service_id: prepaidId, qty: 1, redeemed_at: null};
              if(serviceName) psObj.service_name = serviceName;
              if(Number.isFinite(qtyTot) && qtyTot > 0) psObj.purchased_qty = qtyTot;
              if(Number.isFinite(qtyRem) && qtyRem >= 0) psObj.remaining_qty = qtyRem;
              if(Number.isFinite(unitPrice)) psObj.unit_price = unitPrice;
              if(Number.isFinite(saleId) && saleId > 0) psObj.sale_id = saleId;

              bySvc.set(serviceId, psObj);
              qbWritePrepaidServiceRedeem(Array.from(bySvc.values()));

              if(qbGiftboxRedeemInput){
                try{
                  const gb = qbReadGiftboxRedeem();
                  const gbPruned = gb.filter(it => Number(it?.service_id || 0) !== serviceId);
                  qbWriteGiftboxRedeem(gbPruned);
                }catch(_){ }
              }
              if(qbPackageRedeemInput){
                try{
                  const pk = qbReadPackageRedeem();
                  const pkPruned = pk.filter(it => Number(it?.service_id || 0) !== serviceId);
                  qbWritePackageRedeem(pkPruned);
                }catch(_){ }
              }
              if(qbGiftRedeemInput){
                try{
                  const og = qbReadGiftRedeem();
                  const ogPruned = og.filter(it => Number(it?.service_id || 0) !== serviceId);
                  qbWriteGiftRedeem(ogPruned);
                }catch(_){ }
              }

              qbResidualsUncheckOthersForService(serviceId, ch);
              qbSyncServicesUI();

              notify(wasSelected ? ('Servizio prepagato collegato: ' + label) : ('Servizio aggiunto dai residui: ' + label), 'success');
              return;
            }

            if(cpCh){
              const wrap = ch.closest('.qb-cp-package');
              const cpId = parseInt(ch.dataset.packageId || '', 10) || parseInt(wrap?.dataset?.packageId || '', 10) || 0;
              const cpSvcId = parseInt(ch.dataset.packageServiceId || '', 10) || 0;
              if(!cpId){
                notify('Residuo pacchetto non valido.', 'warning');
                qbResidualsAutoSync = true; ch.checked = false; qbResidualsAutoSync = false;
                return;
              }

              // Backend check: already used in other appointments
              const obj = {service_id: serviceId, client_package_id: cpId, qty: 1};
              if(cpSvcId && cpSvcId > 0) obj.client_package_service_id = cpSvcId;
              const chk = await qbCheckResidualsConflicts('package', [obj]);
              if(!chk || chk.ok === false){
                notify((chk && chk.error) ? String(chk.error) : 'Errore durante la verifica dei residui del pacchetto.', 'danger');
                qbResidualsAutoSync = true; ch.checked = false; qbResidualsAutoSync = false;
                return;
              }
              const conflicts = Array.isArray(chk.packages) ? chk.packages : [];
              if(conflicts.length){
                const msg = Array.isArray(chk.messages) && chk.messages.length ? chk.messages.join(' | ') : "Questa seduta del pacchetto è già presente in un'altra prenotazione.";
                notify(msg, 'warning');
                qbResidualsAutoSync = true; ch.checked = false; qbResidualsAutoSync = false;
                return;
              }

              // Ensure the service is part of the appointment
              const okSel = qbEnsureServiceSelectedFromResidualCheckbox(ch, true);
              if(!okSel){
                notify('Il servizio non è disponibile nel listino e non può essere aggiunto: ' + label, 'warning');
                qbResidualsAutoSync = true; ch.checked = false; qbResidualsAutoSync = false;
                return;
              }

              // Link this service to the selected Package session (unique by service_id)
              const current = qbReadPackageRedeem();
              const bySvc = new Map();
              for(const it of current){
                if(!it) continue;
                bySvc.set(Number(it.service_id || 0), it);
              }

              const pkgName = (wrap && wrap.dataset && wrap.dataset.packageName) ? String(wrap.dataset.packageName || '').trim() : '';
              const qtyRem = parseInt(ch.dataset.sessionsRemaining || '', 10);
              const qtyTot = parseInt(ch.dataset.sessionsTotal || '', 10);

              const pkObj = {service_id: serviceId, client_package_id: cpId, qty: 1, redeemed_at: null};
              if(cpSvcId && cpSvcId > 0) pkObj.client_package_service_id = cpSvcId;
              if(pkgName) pkObj.package_name = pkgName;
              if(Number.isFinite(qtyTot) && qtyTot > 0) pkObj.sessions_total = qtyTot;
              if(Number.isFinite(qtyRem) && qtyRem >= 0) pkObj.sessions_remaining = qtyRem;

              bySvc.set(serviceId, pkObj);
              qbWritePackageRedeem(Array.from(bySvc.values()));

              // Detach from any other prepaid association for the same service
              if(qbGiftboxRedeemInput){
                try{
                  const gb = qbReadGiftboxRedeem();
                  const gbPruned = gb.filter(it => Number(it?.service_id || 0) !== serviceId);
                  qbWriteGiftboxRedeem(gbPruned);
                }catch(_){ }
              }
              if(qbPrepaidServiceRedeemInput){
                try{
                  const ps = qbReadPrepaidServiceRedeem();
                  const psPruned = ps.filter(it => Number(it?.service_id || 0) !== serviceId);
                  qbWritePrepaidServiceRedeem(psPruned);
                }catch(_){ }
              }
              if(qbGiftRedeemInput){
                try{
                  const og = qbReadGiftRedeem();
                  const ogPruned = og.filter(it => Number(it?.service_id || 0) !== serviceId);
                  qbWriteGiftRedeem(ogPruned);
                }catch(_){ }
              }

              // Keep UI consistent: only one residual checkbox per service
              qbResidualsUncheckOthersForService(serviceId, ch);
              qbSyncServicesUI();

              notify(wasSelected ? ('Seduta pacchetto collegata: ' + label) : ('Servizio aggiunto dal pacchetto: ' + label), 'success');
              return;
            }

          }

          // --- UNCHECKED: remove service from appointment + detach mappings ---
          qbEnsureServiceSelectedFromResidualCheckbox(ch, false);
          qbResidualsRemoveServiceFromMaps(serviceId);
          qbResidualsUncheckOthersForService(serviceId, null);
          qbSyncServicesUI();
          notify('Servizio rimosso dalla prenotazione: ' + label, 'info');
        } finally {
          ch.disabled = prevDisabled;
        }
      });

    }

// Cabin selection must be unlocked only after the user confirms a slot from
// the Availability modal. This prevents choosing cabins before a real
// "available" day+time has been selected.
let qbAvailConfirmed = false;
let qbAvailApplying = false;
let qbPendingCalendarSlot = null;
let qbCalendarSlotApplyTimer = null;
let qbCalendarSlotApplySeq = 0;
let qbHoldExpiresAtMs = 0;
let qbHoldTimer = null;
let qbHoldRenewTimer = null;

function qbCurrentHoldToken(){
  return holdTokenInput ? String(holdTokenInput.value || '').trim() : '';
}

function qbSetHoldToken(token){
  const next = String(token || '').trim();
  if(holdTokenInput) holdTokenInput.value = next;
  if(!next){
    qbClearHoldCountdown();
    qbStopHoldRenew();
  }
}

function qbHoldExpiryMs(data){
  const ttl = Number(data && data.ttl_seconds);
  if(Number.isFinite(ttl) && ttl > 0) return Date.now() + (ttl * 1000);
  const raw = String((data && data.expires_at) || '').trim();
  if(raw){
    const parsed = Date.parse(raw.replace(' ', 'T'));
    if(Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function qbFormatHoldRemaining(ms){
  const seconds = Math.max(0, Math.ceil(Number(ms || 0) / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes + ':' + String(rest).padStart(2, '0');
}

function qbClearHoldCountdown(options){
  if(qbHoldTimer){
    clearInterval(qbHoldTimer);
    qbHoldTimer = null;
  }
  qbHoldExpiresAtMs = 0;
  const hide = !options || options.hide !== false;
  if(qbHoldCountdownEl && hide){
    qbHoldCountdownEl.classList.add('d-none');
    qbHoldCountdownEl.classList.remove('alert-warning', 'alert-danger');
    qbHoldCountdownEl.classList.add('alert-info');
    qbHoldCountdownEl.textContent = '';
  }
}

function qbStopHoldRenew(){
  if(qbHoldRenewTimer){
    clearTimeout(qbHoldRenewTimer);
    qbHoldRenewTimer = null;
  }
}

function qbHoldRenewDelayMs(data){
  const ttl = Number(data && data.ttl_seconds);
  const ttlMs = Number.isFinite(ttl) && ttl > 0 ? ttl * 1000 : 300000;
  return Math.max(30000, Math.min(60000, Math.floor(ttlMs * 0.5)));
}

function qbCanRenewHold(){
  return !!(qbCurrentHoldToken() && offcanvasEl && offcanvasEl.classList.contains('show') && !document.hidden);
}

function qbScheduleHoldRenew(data){
  qbStopHoldRenew();
  if(!qbCanRenewHold()) return;
  qbHoldRenewTimer = setTimeout(()=>{ qbRenewAvailabilityHold(); }, qbHoldRenewDelayMs(data));
}

async function qbRenewAvailabilityHold(){
  const token = qbCurrentHoldToken();
  qbStopHoldRenew();
  if(!token || !qbCanRenewHold()) return;
  try{
    const body = new URLSearchParams();
    body.set('action', 'renew_hold');
    body.set('appointment_hold_token', token);
    if(csrf) body.set('_csrf', csrf);
    const res = await fetch('index.php?page=api_appointments', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8', 'Accept':'application/json'},
      body: body.toString()
    });
    const data = await res.json().catch(()=>null);
    if(res.ok && data && data.ok && data.token){
      if(String(data.token || '').trim() === token) qbScheduleHoldRenew(data);
      return;
    }
  }catch(_){ }
  // If renew fails, keep the token/form intact and let the final server validation decide.
  if(qbCanRenewHold()) qbScheduleHoldRenew({ ttl_seconds: 60 });
}

function qbRenderHoldCountdown(){
  if(!qbHoldCountdownEl) return;
  const token = qbCurrentHoldToken();
  const remaining = qbHoldExpiresAtMs ? (qbHoldExpiresAtMs - Date.now()) : 0;
  if(!token || remaining <= 0){
    qbHoldCountdownEl.classList.add('d-none');
    return;
  }
  qbHoldCountdownEl.classList.remove('d-none', 'alert-info', 'alert-warning', 'alert-danger');
  qbHoldCountdownEl.classList.add(remaining <= 60000 ? 'alert-warning' : 'alert-info');
  qbHoldCountdownEl.textContent = 'Slot riservato per ' + qbFormatHoldRemaining(remaining) + '.';
}

function qbHoldIsExpired(){
  return !!(qbCurrentHoldToken() && qbHoldExpiresAtMs && Date.now() >= qbHoldExpiresAtMs);
}

function qbHoldExpiredDefaultMessage(){
  return 'La disponibilita selezionata e scaduta. Scegli di nuovo uno slot.';
}

function qbShowHoldExpiredMessage(message){
  if(!qbHoldCountdownEl) return;
  qbHoldCountdownEl.classList.remove('d-none', 'alert-info', 'alert-warning');
  qbHoldCountdownEl.classList.add('alert-danger');
  qbHoldCountdownEl.textContent = String(message || qbHoldExpiredDefaultMessage());
}

function qbHandleHoldExpired(message){
  const finalMessage = String(message || qbHoldExpiredDefaultMessage());
  qbClearHoldCountdown({ hide: false });
  qbSetHoldToken('');
  qbAvailConfirmed = false;
  if(qbStartTime) qbStartTime.value = '';
  if(qbEndTime) qbEndTime.value = '';
  if(starts) starts.value = '';
  if(ends) ends.value = '';
  if(cabinMapInput) cabinMapInput.value = '';
  if(cabinSel){
    setCabinSelectPlaceholder('Seleziona prima la disponibilita...');
    cabinSel.disabled = true;
    qbSetCabinFieldMuted(true);
    try{ cabinSel.setAttribute('data-current', ''); }catch(_){ }
  }
  try{ refreshCabinsForServices(); }catch(_){ }
  qbShowHoldExpiredMessage(finalMessage);
  notify(finalMessage, 'warning');
}

function qbStartHoldCountdown(data){
  // Backend quick booking uses a short technical hold only to exclude the
  // freshly selected slot while resolving staff/cabins/resources. It must not
  // become a user-facing timer or a hidden auto-renewed reservation.
  qbClearHoldCountdown();
  qbHoldExpiresAtMs = 0;
  qbStopHoldRenew();
}

async function qbReleaseAvailabilityHold(){
  const token = qbCurrentHoldToken();
  if(!token) return;
  qbSetHoldToken('');
  try{
    const body = new URLSearchParams();
    body.set('action', 'release_hold');
    body.set('appointment_hold_token', token);
    if(csrf) body.set('_csrf', csrf);
    await fetch('index.php?page=api_appointments', {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
      headers: {'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8', 'Accept':'application/json'},
      body: body.toString()
    });
  }catch(_){ }
}

async function qbCreateAvailabilityHold(date, time){
  const ids = getSelectedServiceIds();
  if(!date || !time || !ids.length) throw new Error('Seleziona prima servizio, data e ora.');
  const body = new URLSearchParams();
  body.set('action', 'hold_availability');
  body.set('date', String(date));
  body.set('time', String(time).slice(0,5));
  body.set('service_ids', ids.join(','));
  body.set('exclude_id', qbGetExcludeId() || '0');
  if(staffSel && staffSel.value) body.set('staff_id', staffSel.value);
  if(locationSel && locationSel.value) body.set('location_id', locationSel.value);
  if(staffMapInput && staffMapInput.value) body.set('staff_map', staffMapInput.value);
  if(cabinMapInput && cabinMapInput.value) body.set('cabin_map', cabinMapInput.value);
  if(cabinSel && cabinSel.value) body.set('cabin_id', cabinSel.value);
  const previous = qbCurrentHoldToken();
  if(previous) body.set('appointment_hold_token', previous);
  if(csrf) body.set('_csrf', csrf);

  const res = await fetch('index.php?page=api_appointments', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8', 'Accept':'application/json'},
    body: body.toString()
  });
  const data = await res.json().catch(()=>null);
  if(!res.ok || !data || !data.ok || !data.token){
    throw new Error((data && data.error) ? String(data.error) : 'Orario non piu disponibile. Ricarica e scegli un altro slot.');
  }
  qbSetHoldToken(data.token);
  qbStartHoldCountdown(data);
  return data;
}

function qbApplyAvailabilityHoldAllocation(data){
  if(!data || typeof data !== 'object') return;

  const staffIds = Array.isArray(data.staff_ids)
    ? data.staff_ids.map(v => String(v || '').trim()).filter(Boolean)
    : [];
  const cabinIds = Array.isArray(data.cabin_ids)
    ? data.cabin_ids.map(v => String(v || '').trim()).filter(Boolean)
    : [];
  const segments = Array.isArray(data.segments) ? data.segments : [];

  if(staffIds.length === 1 && staffSel){
    const sid = staffIds[0];
    const opt = Array.from(staffSel.options || []).find(o => String(o.value) === sid);
    if(opt){
      opt.disabled = false;
      const label = String(opt.textContent || '');
      if(/\bOccupato\s*$/i.test(label)){
        opt.textContent = label
          .replace(/\s*Occupato\s*$/i, '')
          .replace(/\s*[-\u2013\u2014]+\s*$/u, '')
          .trim();
      }
      staffSel.value = sid;
    }
  }

  if(segments.length && staffMapInput){
    const staffMap = {};
    for(const seg of segments){
      const serviceId = String(seg && seg.service_id != null ? seg.service_id : '').trim();
      const staffId = String(seg && seg.staff_id != null ? seg.staff_id : '').trim();
      if(serviceId && staffId) staffMap[serviceId] = staffId;
    }
    if(Object.keys(staffMap).length){
      staffMapInput.value = JSON.stringify(staffMap);
      try{
        const selects = Array.from(document.querySelectorAll('.qb-staff-for-service[data-service-id]'));
        for(const sel of selects){
          const sid = String(sel.getAttribute('data-service-id') || '').trim();
          if(staffMap[sid] != null) sel.value = String(staffMap[sid]);
        }
        if(typeof syncStaffMapFromPicker === 'function') syncStaffMapFromPicker();
      }catch(_){ }
    }
  }

  if(segments.length && cabinMapInput){
    const cabinMap = {};
    for(const seg of segments){
      const serviceId = String(seg && seg.service_id != null ? seg.service_id : '').trim();
      const cabinId = String(seg && seg.cabin_id != null ? seg.cabin_id : '').trim();
      if(serviceId && cabinId && cabinId !== '0') cabinMap[serviceId] = cabinId;
    }
    if(Object.keys(cabinMap).length){
      cabinMapInput.value = JSON.stringify(cabinMap);
      try{
        const selects = Array.from(document.querySelectorAll('.qb-cabin-for-service[data-service-id]'));
        for(const sel of selects){
          const sid = String(sel.getAttribute('data-service-id') || '').trim();
          const cid = cabinMap[sid] ? String(cabinMap[sid]) : '';
          if(!cid) continue;
          sel.setAttribute('data-current', cid);
          const hasOption = Array.from(sel.options || []).some(o => String(o.value) === cid);
          if(hasOption) sel.value = cid;
        }
        if(typeof syncCabinMapFromPicker === 'function') syncCabinMapFromPicker();
      }catch(_){ }
    }
  }

  if(cabinIds.length === 1 && cabinSel){
    const cid = cabinIds[0];
    try{ cabinSel.setAttribute('data-current', cid); }catch(_){ }
    const hasOption = Array.from(cabinSel.options || []).some(o => String(o.value) === cid);
    if(hasOption) cabinSel.value = cid;
  }
}

function qbPreferredCabinIdFromHold(data){
  if(!data || typeof data !== 'object') return '';
  const ids = [];
  const pushId = (value)=>{
    const id = String(value == null ? '' : value).trim();
    if(id && id !== '0') ids.push(id);
  };
  if(Array.isArray(data.cabin_ids)){
    for(const id of data.cabin_ids) pushId(id);
  }
  pushId(data.cabin_id);
  if(Array.isArray(data.segments)){
    for(const seg of data.segments){
      if(seg && typeof seg === 'object') pushId(seg.cabin_id);
    }
  }
  const unique = Array.from(new Set(ids));
  return unique.length === 1 ? unique[0] : '';
}

let qbOpenReqId = 0; // guards async openEdit loads
let qbEditingId = ''; // stable exclude_id even if form resets mid-load
let qbOriginalStatus = '';
let qbReloadPageOnSave = false;
let qbDoneCancelPreviewData = null;
let qbDoneCancelPreviewForId = '';
let qbDoneCancelPreviewLoading = false;
let qbDoneCancelCommitted = false;
let qbDoneCancelTargetStatus = 'canceled';
let qbExternalCancelContext = null;
let qbLastOpenEditArgs = null;
let qbIsHydrating = false;

function qbSetFormHydrationBlocked(blocked){
  if(!form) return;
  form.classList.toggle('qb-form-hidden', !!blocked);
  try{ form.setAttribute('aria-busy', blocked ? 'true' : 'false'); }catch(_){ }
  try{
    if('inert' in form) form.inert = !!blocked;
  }catch(_){ }
}

function qbSetLoading(on, message){
  qbIsHydrating = !!on;
  if(qbLoadingText && message) qbLoadingText.textContent = String(message);
  if(qbLoadingState) qbLoadingState.hidden = !on;
  if(qbLoadErrorState) qbLoadErrorState.hidden = true;
  if(offcanvasEl){
    offcanvasEl.classList.toggle('is-qb-loading', !!on);
    offcanvasEl.classList.remove('is-qb-load-error');
  }
  qbSetFormHydrationBlocked(!!on);
}

function qbSetLoadReady(){
  qbIsHydrating = false;
  if(qbLoadingState) qbLoadingState.hidden = true;
  if(qbLoadErrorState) qbLoadErrorState.hidden = true;
  if(offcanvasEl){
    offcanvasEl.classList.remove('is-qb-loading');
    offcanvasEl.classList.remove('is-qb-load-error');
  }
  qbSetFormHydrationBlocked(false);
}

function qbSetLoadError(message){
  qbIsHydrating = false;
  if(qbLoadingState) qbLoadingState.hidden = true;
  if(qbLoadErrorText) qbLoadErrorText.textContent = String(message || 'Impossibile caricare la prenotazione.');
  if(qbLoadErrorState) qbLoadErrorState.hidden = false;
  if(qbLoadRetryBtn) qbLoadRetryBtn.style.display = qbLastOpenEditArgs ? '' : 'none';
  if(offcanvasEl){
    offcanvasEl.classList.remove('is-qb-loading');
    offcanvasEl.classList.add('is-qb-load-error');
  }
  qbSetFormHydrationBlocked(true);
}

window.addEventListener('pagehide', () => {
  qbReleaseAvailabilityHold();
});

let qbCabinsReqId = 0;
let qbMultiCabinsReqId = 0;
let qbStaffReqId = 0;
function qbGetExcludeId(){
  try{
    const v = (form && form.dataset && form.dataset.editingId) ? String(form.dataset.editingId).trim() : '';
    if(v) return v;
  }catch(_){ }
  const e = String(qbEditingId || '').trim();
  if(e) return e;
  const a = (apptIdEl && apptIdEl.value) ? String(apptIdEl.value).trim() : '';
  return a;
}
function qbEsc(s){
      return String(s ?? '').replace(/[&<>"']/g, (c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
    }

    function qbNormalizeAppointmentStatus(st){
      const s = String(st || '').toLowerCase().trim();
      if(s === 'rejected' || s === 'rifiutato' || s === 'rifiutata') return 'canceled';
      if(s === 'no show' || s === 'no-show' || s === 'noshow' || s === 'non presentato' || s === 'non presentata') return 'no_show';
      return s;
    }

    function qbBadgeForStatus(st){
      switch(qbNormalizeAppointmentStatus(st)){
        case 'pending': return {cls:'warning', label:'In attesa'};
        case 'scheduled': return {cls:'primary', label:'Prenotato'};
        case 'done': return {cls:'success', label:'Eseguito'};
        case 'canceled': return {cls:'secondary', label:'Annullato'};
        case 'no_show': return {cls:'dark', label:'No show'};
        case 'rejected': return {cls:'secondary', label:'Annullato'};
        default: return {cls:'secondary', label: st || '—'};
      }
    }

    function qbFmtMoney(n){
      const x = Number(n||0);
      return x.toFixed(2).replace('.', ',');
    }

    function qbFmtDateTime(iso){
      if(!iso) return '—';
      const d = new Date(iso.replace(' ', 'T'));
      if(isNaN(d.getTime())) return String(iso);
      const pad = (v)=>String(v).padStart(2,'0');
      return pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear()+' '+pad(d.getHours())+':'+pad(d.getMinutes());
    }

    function qbRenderClientCard(data){
      const c = data.client || {};
      const tags = Array.isArray(data.tags) ? data.tags : [];
      const docs = Array.isArray(data.docs) ? data.docs : [];
      const appts = Array.isArray(data.appointments) ? data.appointments : [];
      const sales = Array.isArray(data.sales) ? data.sales : [];
      const summary = data.summary || {};

      const lastV = summary.last_visit ? qbFmtDateTime(summary.last_visit) : '—';
      const nextV = summary.next_visit ? qbFmtDateTime(summary.next_visit) : '—';

      const tagHtml = tags.length
        ? tags.map(t=>`<span class="badge badge-soft me-1 mb-1">${qbEsc(t.name)}</span>`).join('')
        : `<span class="text-muted small">Nessun tag.</span>`;

      const docsHtml = docs.length ? docs.map(d=>{
        const href = String(d.url||'');
        const created = d.created_at ? qbFmtDateTime(d.created_at) : '—';
        return `
          <div class="d-flex justify-content-between align-items-center border rounded-3 p-2 mb-2">
            <div>
              <div class="fw-semibold">${qbEsc(d.title||'Documento')}</div>
              <div class="text-muted small">${qbEsc(created)}</div>
            </div>
            <div class="d-flex gap-2">
              ${href ? `<a class="btn btn-sm btn-outline-secondary" target="_blank" rel="noopener" href="${qbEsc(href)}">Apri</a>` : `<span class="text-muted small">Non disponibile</span>`}
            </div>
          </div>`;
      }).join('') : `<div class="text-muted small">Nessun documento.</div>`;

      const apptRows = appts.length ? appts.map(a=>{
        const b = qbBadgeForStatus(a.status);
        return `
          <tr>
            <td>${qbEsc(qbFmtDateTime(a.starts_at))}</td>
            <td class="text-muted">${qbEsc(a.services||'—')}</td>
            <td class="text-muted">${qbEsc(a.staff||'—')}</td>
            <td class="text-end fw-semibold">€ ${qbFmtMoney(a.total)}</td>
            <td><span class="badge text-bg-${qbEsc(b.cls)}">${qbEsc(b.label)}</span></td>
          </tr>`;
      }).join('') : `<tr><td colspan="5" class="text-muted p-3">Nessun appuntamento.</td></tr>`;

      const salesRows = sales.length ? sales.map(s=>{
        return `
          <tr>
            <td>${qbEsc(qbFmtDateTime(s.sale_date))}</td>
            <td class="fw-semibold">€ ${qbFmtMoney(s.total)}</td>
            <td class="text-muted">${qbEsc(s.notes||'—')}</td>
          </tr>`;
      }).join('') : `<tr><td colspan="3" class="text-muted p-3">Nessuna vendita.</td></tr>`;

      const salesTotal = Number(summary.sales_total||0);
      const salesTotalHtml = salesTotal>0 ? ` • Vendite: <span class="fw-semibold">€ ${qbFmtMoney(salesTotal)}</span>` : '';

      return `
        <div class="px-2 pb-2">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <div>
              <div class="text-muted small">Scheda cliente</div>
              <div class="h5 fw-bold m-0">${qbEsc(c.full_name||'Cliente')}</div>
              <div class="text-muted small">${qbEsc(c.phone||'—')} • ${qbEsc(c.email||'—')}</div>
            </div>
          </div>

          <div class="row g-3">
            <div class="col-lg-4">
              <div class="card p-3">
                <div class="fw-semibold mb-2"><i class="bi bi-award me-1"></i>Fidelity</div>
                <div class="display-6 fw-bold">${qbEsc(c.points ?? 0)}</div>
                <div class="text-muted small">Punti accumulati</div>
              </div>

              <div class="card p-3 mt-3">
                <div class="fw-semibold mb-2"><i class="bi bi-tags me-1"></i>Tag</div>
                <div class="d-flex flex-wrap gap-2">${tagHtml}</div>
              </div>

              <div class="card p-3 mt-3">
                <div class="fw-semibold mb-2"><i class="bi bi-file-earmark-arrow-up me-1"></i>Documenti</div>
                <div>${docsHtml}</div>
              </div>
            </div>

            <div class="col-lg-8">
              <div class="card">
                <div class="card-header">
                  <div class="fw-semibold"><i class="bi bi-calendar-week me-2"></i>Storico appuntamenti</div>
                  <div class="small text-muted mt-1">
                    Appuntamenti: ${qbEsc(summary.total ?? 0)} • Ultimo: ${qbEsc(lastV)} • Prossimo: ${qbEsc(nextV)}${salesTotalHtml}
                  </div>
                </div>
                <div class="table-responsive">
                  <table class="table mb-0">
                    <thead><tr><th>Data</th><th>Servizi</th><th>Operatore</th><th class="text-end">Totale</th><th>Stato</th></tr></thead>
                    <tbody>${apptRows}</tbody>
                  </table>
                </div>
              </div>

              <div class="card mt-3">
                <div class="card-header fw-semibold"><i class="bi bi-receipt me-2"></i>Storico vendite</div>
                <div class="table-responsive">
                  <table class="table mb-0">
                    <thead><tr><th>Data</th><th>Totale</th><th>Note</th></tr></thead>
                    <tbody>${salesRows}</tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>`;
    }

    function qbOpenClientCard(clientId){
      if(!clientId || !qbClientCardModal) return;
      const cid = String(clientId);
      const fullUrl = 'index.php?page=clients&action=view&id=' + encodeURIComponent(cid);
      if(qbClientCardOpenNew) qbClientCardOpenNew.href = fullUrl;
      if(qbClientCardBody) qbClientCardBody.innerHTML = appInlineLoadingHtml();
      qbClientCardModal.show();

      const myReq = ++qbClientCardReqId;
      fetch('index.php?page=api_clients&action=card&client_id=' + encodeURIComponent(cid), {credentials:'same-origin'})
        .then(r => r.json())
        .then(j => {
          if(myReq !== qbClientCardReqId) return;
          if(!j || !j.ok){
            if(qbClientCardBody) qbClientCardBody.innerHTML = '<div class="text-danger small p-2">Impossibile caricare la scheda cliente.</div>';
            return;
          }
          if(qbClientCardBody) qbClientCardBody.innerHTML = qbRenderClientCard(j);
        })
        .catch(()=>{
          if(myReq !== qbClientCardReqId) return;
          if(qbClientCardBody) qbClientCardBody.innerHTML = '<div class="text-danger small p-2">Errore di rete durante il caricamento.</div>';
        });
    }

    if(qbClientCardModalEl){
      qbClientCardModalEl.addEventListener('hidden.bs.modal', ()=>{
        if(qbClientCardBody) qbClientCardBody.innerHTML = appInlineLoadingHtml();
      });
    }

    if(qbClientResidualsModalEl){
      qbClientResidualsModalEl.addEventListener('hidden.bs.modal', ()=>{
        if(qbClientResidualsBody) qbClientResidualsBody.innerHTML = appInlineLoadingHtml();
        if(qbClientResidualsClientLabel) qbClientResidualsClientLabel.textContent = '—';
        if(qbClientResidualsEmptyState) qbClientResidualsEmptyState.classList.add('d-none');
        try{ qbSyncResidualCreditUi(); }catch(_){ }
      });
    }

    function qbShowNew(){
      if(qbClientId) qbClientId.value = '';
      if(qbSelBox) qbSelBox.style.display = 'none';
      if(qbNewBox) qbNewBox.style.display = 'block';
      if(qbHistoryBox) qbHistoryBox.style.display = 'none';
      if(qbHistorySummary) qbHistorySummary.textContent = '';
      if(qbHistoryList) qbHistoryList.innerHTML = '';
      if(qbResidualsBox) qbResidualsBox.style.display = 'none';
      if(qbResidualsList) qbResidualsList.innerHTML = '';
      qbResetResidualRedeemState();
    }

    // Prezzi (Dettaglio prezzi)
    const qbPriceDetailsBox = qs('#qbPriceDetailsBox');
    const qbPriceDetailsList = qs('#qbPriceDetailsList');
    const qbPriceTotal = qs('#qbPriceTotal');
    const qbPriceSubtotal = qs('#qbPriceSubtotal');
    const qbPriceDiscountAmount = qs('#qbPriceDiscountAmount');
    const qbDiscountType = qs('#qb_discount_type');
    const qbDiscountValue = qs('#qb_discount_value');
    const qbCouponToggle = qs('#qbCouponToggle');
    const qbCouponBox = qs('#qbCouponBox');
    const qbCouponInput = qs('#qbCouponInput');
    const qbCouponApplyBtn = qs('#qbCouponApplyBtn');
    const qbCouponRemoveBtn = qs('#qbCouponRemoveBtn');
    const qbCouponMsg = qs('#qbCouponMsg');
    const qbCouponCode = qs('#qb_coupon_code');
    const qbCouponDiscount = qs('#qb_coupon_discount');
    const qbCouponRow = qs('#qbCouponRow');
    const qbCouponLabel = qs('#qbCouponLabel');
    const qbCouponAmount = qs('#qbCouponAmount');

    // Fidelity (auto): mostra lo sconto e quanti punti verranno scalati quando l'appuntamento passa a "Eseguito"
    const qbFidelityRow = qs('#qbFidelityRow');
    const qbFidelityLabel = qs('#qbFidelityLabel');
    const qbFidelityAmount = qs('#qbFidelityAmount');
    const qbFidelityNote = qs('#qbFidelityNote');
    const qbFidelityPointsUse = qs('#qb_fidelity_points_use');
    const qbFidelityBox = qs('#qbFidelityBox');
    const qbFidelityAvail = qs('#qbFidelityAvail');
    const qbFidelityToggleRow = qs('#qbFidelityToggleRow');
    const qbFidelityToggle = qs('#qbFidelityToggle');
    const qbFidelityMaxBtn = qs('#qbFidelityMaxBtn');
    const qbFidelityAmountWrap = qs('#qbFidelityAmountWrap');
    const qbFidelityAmountInput = qs('#qbFidelityAmountInput');
    const qbFidelityAmountSuffix = qs('#qbFidelityAmountSuffix');
    const qbFidelityHint = qs('#qbFidelityHint');
    const qbFidelityActions = qs('#qbFidelityActions');
    const qbFidelityApplyBtn = qs('#qbFidelityApplyBtn');
    const qbFidelityRemoveBtn = qs('#qbFidelityRemoveBtn');

    // Cb (prenotato su appuntamento): mostra lo sconto cb che verrà scalato quando l'appuntamento passa a "Eseguito"
    const qbCbRow = qs('#qbCbRow');
    const qbCbLabel = qs('#qbCbLabel');
    const qbCbAmount = qs('#qbCbAmount');
    const qbCbNote = qs('#qbCbNote');
    const qbCbEarnNote = qs('#qbCbEarnNote');

    // GiftCard (credito monetario): applicazione importo selezionato da Residui > GiftCard
    const qbGiftcardRow = qs('#qbGiftcardRow');
    const qbGiftcardLabel = qs('#qbGiftcardLabel');
    const qbGiftcardAmount = qs('#qbGiftcardAmount');
    const qbGiftcardRemoveBtn = qs('#qbGiftcardRemoveBtn');

  // Credito cliente (ricariche)
  const qbCreditUseBox = qs('#qbCreditUseBox');
  const qbCreditUseToggle = qs('#qbCreditUseToggle');
  const qbCreditAvail = qs('#qbCreditAvail');
  const qbCreditWillUse = qs('#qbCreditWillUse');
  const qbCreditLabelPrefix = qs('#qbCreditLabelPrefix');
  const qbCreditLabelMid = qs('#qbCreditLabelMid');
  const qbCreditLabelSuffix = qs('#qbCreditLabelSuffix');
  const qbCreditUseInput = qs('#qb_credit_use');
  const qbCreditFromBookingInput = qs('#qb_credit_use_from_booking');
  const qbCreditRow = qs('#qbCreditRow');
  const qbCreditAmount = qs('#qbCreditAmount');
  const qbCreditNote = qs('#qbCreditNote');


    // Cb: uso come sconto (backend)
    const qbCbBox = qs('#qbCbBox');
    const qbDiscountChoiceBox = qs('#qbDiscountChoiceBox');
    const qbDiscountChoiceFidelity = qs('#qbDiscountChoiceFidelity');
    const qbDiscountChoiceCb = qs('#qbDiscountChoiceCb');
    const qbDiscountChoiceNone = qs('#qbDiscountChoiceNone');
    const qbCbToggleRow = qs('#qbCbToggleRow');
    const qbCbToggle = qs('#qbCbToggle');
    const qbCbMaxBtn = qs('#qbCbMaxBtn');
    const qbCbAmountWrap = qs('#qbCbAmountWrap');
    const qbCbAmountInput = qs('#qbCbAmountInput');
    const qbCbHint = qs('#qbCbHint');
    const qbCbUseInput = qs('#qb_cb_use');

    // Fidelity: scelta cliente (Conflitto Sconto/gift = "Scelta cliente in negozio")
    const qbFidelityChoiceBox = qs('#qbFidelityChoiceBox');
    const qbFidChoiceDiscount = qs('#qbFidChoiceDiscount');
    const qbFidChoiceGift = qs('#qbFidChoiceGift');
    const qbFidChoiceLater = qs('#qbFidChoiceLater');
    const qbFidelityChoiceHint = qs('#qbFidelityChoiceHint');

    // Fidelity: omaggio prenotato su appuntamento (non cambia il totale, ma prenota/scalerà punti)
    const qbFidelityGiftRow = qs('#qbFidelityGiftRow');
    const qbFidelityGiftLabel = qs('#qbFidelityGiftLabel');
    const qbFidelityGiftAmount = qs('#qbFidelityGiftAmount');
    const qbFidelityGiftIdx = qs('#qb_fidelity_gift_idx');
    const qbFidelityGiftPointsUse = qs('#qb_fidelity_gift_points_used');


    function wholePts(n){
      const v = parseFloat(String(n || 0).replace(',', '.')) || 0;
      if(!Number.isFinite(v)) return 0;
      if(v > 0) return Math.floor(v + 1e-9);
      if(v < 0) return Math.ceil(v - 1e-9);
      return 0;
    }

    function fmtPts(n){ return String(wholePts(n)); }

    function qbFmtPointInputNumber(n){ return String(wholePts(n)); }

    function qbFmtInputNumber(n){
      const v = Math.round(((parseFloat(String(n || 0).replace(',', '.')) || 0) * 100)) / 100;
      let s = v.toFixed(2);
      s = s.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
      return s;
    }

    function qbFidelityMaxPointsUsable(){
      try{
        const avail = wholePts(qbFid?.available_points || 0);
        const base = Math.max(0, Math.round(((parseFloat(String(qbFid?.base_amount || 0).replace(',', '.')) || 0) * 100)) / 100);
        const epp = parseFloat(String(qbFid?.euro_per_point || 0).replace(',', '.')) || 0;
        const min = wholePts(qbFid?.min_points || 0);
        if(!(avail > 0) || !(base > 0.000001) || !(epp > 0.000001)) return 0;
        const capAmount = base;
        if(!(capAmount > 0.000001)) return 0;
        let maxPtsByAmount = Math.floor((capAmount / epp) + 1e-9);
        if(maxPtsByAmount < 0) maxPtsByAmount = 0;
        let maxPts = wholePts(Math.min(avail, maxPtsByAmount));
        if(maxPts < min) return 0;
        return maxPts;
      } catch(_){ return 0; }
    }

    function qbFidelityDiscountForPoints(points, baseOverride){
      try{
        const pts = wholePts(points || 0);
        const epp = parseFloat(String(qbFid?.euro_per_point || 0).replace(',', '.')) || 0;
        if(!(pts > 0.000001) || !(epp > 0.000001)) return 0;
        let disc = Math.round((pts * epp) * 100) / 100;
        let cap = null;
        if(baseOverride !== undefined && baseOverride !== null){
          cap = parseFloat(String(baseOverride || 0).replace(',', '.')) || 0;
        } else {
          cap = parseFloat(String(qbFid?.base_amount || 0).replace(',', '.')) || 0;
        }
        if(cap !== null && Number.isFinite(cap) && cap > 0.000001){
          disc = Math.min(disc, Math.round(cap * 100) / 100);
        }
        return Math.max(0, Math.round(disc * 100) / 100);
      } catch(_){ return 0; }
    }

    function qbCurrentFidelityRequestedPoints(){
      let hiddenPts = 0;
      try{ hiddenPts = qbFidelityPointsUse ? wholePts(qbFidelityPointsUse.value || '0') : 0; }catch(_){ hiddenPts = 0; }

      let canUseVisible = false;
      try{
        const isEditingVisible = (document.activeElement === qbFidelityAmountInput);
        const toggleOn = !!(qbFidelityToggle && qbFidelityToggle.checked);
        const choiceVisible = !!(qbDiscountChoiceBox && !qbDiscountChoiceBox.classList.contains('d-none'));
        const choiceOn = !!(choiceVisible && qbDiscountChoiceFidelity && qbDiscountChoiceFidelity.checked);
        canUseVisible = !!(isEditingVisible || toggleOn || choiceOn || hiddenPts > 0.000001);
      } catch(_){ canUseVisible = hiddenPts > 0.000001; }

      if(canUseVisible){
        try{
          const rawVisible = qbFidelityAmountInput ? String(qbFidelityAmountInput.value || '').trim() : '';
          if(rawVisible !== '') return wholePts(rawVisible);
        } catch(_){ }
      }
      return hiddenPts;
    }

    function qbClearFidelityDiscountSelection(){
      if(qbFidelityPointsUse) qbFidelityPointsUse.value = '0';
      if(qbFidelityAmountInput) qbFidelityAmountInput.value = '';
      if(qbFidelityToggle) qbFidelityToggle.checked = false;
      try{
        if(qbFid){
          qbFid.points_used = 0;
          qbFid.discount = 0;
          qbFid.requested_points = 0;
        }
      } catch(_){ }
    }

    function qbScheduleFidelityRefresh(delay){
      const wait = (delay == null ? 180 : delay);
      try{ if(qbFidInputTimer) clearTimeout(qbFidInputTimer); }catch(_){ }
      qbFidInputTimer = setTimeout(()=>{
        qbRefreshFidelityThenRender().catch(()=>{ try{ renderPriceDetails(); }catch(__){} });
      }, wait);
    }

    let qbFidReqId = 0;
    let qbFid = { enabled:false, readonly_existing:false, label:'Punti', redeem_enabled:false, auto_discount_enabled:false, min_points:0, available_points:0, base_amount:0, euro_per_point:0, requested_points:0, points_used:0, discount:0, error:null, conflict_policy:'', conflict:false, gift_enabled:false, gift_min_points:0, gift_description:null, gifts:[], gift_can_redeem:false, gift_redeemed:false, gift_redeemed_note:null, gift_redeemed_points:0, pending_reserved_points:0, pending_reserved_booking_code:'', pending_reserved_appointment_id:0 };

    // Cb (backend): stato + preview max/available
    let qbCb = { amount:0, state:'' }; // prenotato su appuntamento
    let qbCbPrev = { enabled:false, redeem_enabled:false, apply_in_booking:false, available:0, max_usable:0, reason:null };
  let qbCreditPrev = { enabled: false, available: 0 };

    let qbCbTouched = false;
    let qbFidInputTimer = null;

    // Cb earn preview (backend): quanto cb verrà accreditato se l'appuntamento viene eseguito
    let qbCbEarnReqId = 0;
    let qbCbEarnKey = '';
    // Preview accredito loyalty (Cb + Punti)
    let qbCbEarn = { enabled:false, amount:0, eligible_net:0, campaign_name:null, error:null, points:0, points_label:'Punti', points_enabled:false };
    let qbCbEarnLoading = false;
    let qbCbEarnTimer = null;

    // Promozioni (backend quick booking): preview per-linea (listino + badge + prezzo scontato)
    let qbPromoReqId = 0;
    let qbPromoKey = '';
    let qbPromoLoading = false;
    let qbPromoPromise = null;
    let qbPromo = { applied:false, promotion:null, services:{} };
    let qbCouponReqId = 0;
    let qbCouponFrozen = false; // storico appuntamento: non rivalidare automaticamente

    function qbNormalizeCouponCode(v){
      return String(v || '').trim().toUpperCase();
    }

    function qbSetCouponMessage(msg, ok){
      if(!qbCouponMsg) return;
      qbCouponMsg.textContent = String(msg || '');
      qbCouponMsg.classList.remove('text-danger', 'text-success', 'text-muted');
      if(!msg) qbCouponMsg.classList.add('text-muted');
      else qbCouponMsg.classList.add(ok ? 'text-success' : 'text-danger');
    }

    function qbClearCouponState(opts){
      const o = opts || {};
      qbCouponFrozen = false;
      if(qbCouponCode) qbCouponCode.value = '';
      if(qbCouponDiscount) qbCouponDiscount.value = '0';
      if(qbCouponInput) qbCouponInput.readOnly = false;
      if(!o.keepInput && qbCouponInput) qbCouponInput.value = '';
      if(!o.keepMessage) qbSetCouponMessage('', false);
      if(qbCouponRow) qbCouponRow.classList.add('d-none');
      if(qbCouponLabel) qbCouponLabel.textContent = 'Coupon';
      if(qbCouponAmount) qbCouponAmount.textContent = '- ' + fmtEUR(0);
      if(qbCouponRemoveBtn) qbCouponRemoveBtn.disabled = false;
      if(qbCouponApplyBtn) qbCouponApplyBtn.disabled = false;
    }

    async function qbApplyCouponPreview(opts){
      const o = opts || {};
      const preserveInput = !!o.preserveInput;
      const skipRefresh = !!o.skipRefresh;
      qbCouponFrozen = false;
      const codeRaw = (o.codeOverride !== undefined && o.codeOverride !== null)
        ? String(o.codeOverride)
        : (qbCouponInput ? String(qbCouponInput.value || '') : (qbCouponCode ? String(qbCouponCode.value || '') : ''));
      const code = qbNormalizeCouponCode(codeRaw);
      if(qbCouponInput && code) qbCouponInput.value = code;
      if(qbCouponBox) qbCouponBox.classList.remove('d-none');

      const svcIds = getSelectedPayableServiceIds();
      if(!code){
        qbClearCouponState({ keepInput: preserveInput });
        if(!preserveInput && qbCouponInput) qbCouponInput.value = '';
        qbSetCouponMessage('Inserisci un codice coupon.', false);
        renderPriceDetails();
        return false;
      }

      const currentAppliedCode = qbCouponCode ? qbNormalizeCouponCode(qbCouponCode.value || '') : '';
      if(currentAppliedCode && currentAppliedCode !== code){
        if(qbCouponInput) qbCouponInput.value = currentAppliedCode;
        qbSetCouponMessage('Puoi applicare un solo coupon per prenotazione. Rimuovi quello attuale prima di inserirne un altro.', false);
        renderPriceDetails();
        return false;
      }
      if(!svcIds.length){
        qbClearCouponState({ keepInput: true, keepMessage: true });
        qbSetCouponMessage('Seleziona almeno un servizio.', false);
        renderPriceDetails();
        return false;
      }

      const params = new URLSearchParams();
      params.set('page', 'api_appointments');
      params.set('action', 'coupon_preview');
      params.set('coupon_code', code);
      params.set('service_ids', svcIds.join(','));
      try{
        const locId = (typeof qbCurrentLocationId === 'function') ? qbCurrentLocationId() : '';
        if(locId) params.set('location_id', locId);
      } catch(_){ }
      try{
        const d = qbDate ? String(qbDate.value || '').trim() : '';
        if(d) params.set('appt_date', d);
      } catch(_){ }
      try{
        const t0 = qbStartTime ? String(qbStartTime.value || '').trim() : '';
        if(t0 && /^\d{2}:\d{2}/.test(t0)) params.set('appt_time', t0.substring(0, 5));
      } catch(_){ }
      try{
        const exId = qbGetExcludeId ? String(qbGetExcludeId() || '').trim() : '';
        if(exId) params.set('appointment_id', exId);
      } catch(_){ }
      try{
        const cid = qbClientId ? String(qbClientId.value || '').trim() : '';
        if(cid) params.set('client_id', cid);
      } catch(_){ }

      const reqId = ++qbCouponReqId;
      if(qbCouponApplyBtn) qbCouponApplyBtn.disabled = true;
      if(qbCouponRemoveBtn) qbCouponRemoveBtn.disabled = true;

      let applied = false;
      try{
        const res = await fetch('index.php?' + params.toString(), { headers: { 'Accept': 'application/json' } });
        const data = await res.json();
        if(reqId !== qbCouponReqId) return false;

        if(data && data.ok && data.applicable){
          const disc = qbNormMoney(data.discount || 0);
          if(qbCouponCode) qbCouponCode.value = code;
          if(qbCouponDiscount) qbCouponDiscount.value = String(disc);
          if(qbCouponInput){ qbCouponInput.value = code; qbCouponInput.readOnly = true; }
          qbSetCouponMessage('Coupon applicato.', true);
          applied = true;
        } else {
          qbClearCouponState({ keepInput: true, keepMessage: true });
          if(qbCouponInput) qbCouponInput.value = code;
          qbSetCouponMessage((data && data.reason) ? String(data.reason) : 'Coupon non applicabile.', false);
        }
      } catch(_){
        if(reqId !== qbCouponReqId) return false;
        qbClearCouponState({ keepInput: true, keepMessage: true });
        if(qbCouponInput) qbCouponInput.value = code;
        qbSetCouponMessage('Errore durante la verifica del coupon.', false);
      } finally {
        if(reqId === qbCouponReqId){
          if(qbCouponApplyBtn) qbCouponApplyBtn.disabled = false;
          if(qbCouponRemoveBtn) qbCouponRemoveBtn.disabled = false;
        }
      }

      if(!skipRefresh){
        try{ await qbRefreshFidelityPreview(); } catch(_){ }
      }
      renderPriceDetails();
      return applied;
    }

    async function qbRevalidateCouponIfNeeded(){
      if(qbCouponFrozen) return;
      const code = qbCouponCode ? qbNormalizeCouponCode(qbCouponCode.value || '') : '';
      if(!code) return;
      await qbApplyCouponPreview({ preserveInput:true, skipRefresh:true, codeOverride:code });
    }

    function qbResetCbState(){
      qbCb = { amount:0, state:'' };
      qbCbPrev = { enabled:false, redeem_enabled:false, apply_in_booking:false, available:0, max_usable:0, reason:null };
      qbCbTouched = false;
      // Reset earn preview
	      qbCbEarn = { enabled:false, amount:0, eligible_net:0, campaign_name:null, error:null, points:0, points_label:'Punti', points_enabled:false };
      qbCbEarnKey = '';
      qbCbEarnLoading = false;
      try{ if(qbCbEarnTimer) clearTimeout(qbCbEarnTimer); } catch(_){ }
      qbCbEarnTimer = null;
      if(qbCbUseInput) qbCbUseInput.value = '0';
      if(qbCbToggle){ qbCbToggle.checked = false; qbCbToggle.disabled = true; }
      if(qbCbAmountInput) qbCbAmountInput.value = '';
      if(qbCbAmountWrap) qbCbAmountWrap.classList.add('d-none');
      if(qbCbMaxBtn) qbCbMaxBtn.classList.add('d-none');
      if(qbCbBox) qbCbBox.classList.add('d-none');
      if(qbDiscountChoiceBox) qbDiscountChoiceBox.classList.add('d-none');
      if(qbDiscountChoiceFidelity) qbDiscountChoiceFidelity.checked = true;
      if(qbDiscountChoiceCb) qbDiscountChoiceCb.checked = false;
      if(qbDiscountChoiceNone) qbDiscountChoiceNone.checked = false;
      if(qbCbHint) qbCbHint.textContent = '';
      if(qbCbRow) qbCbRow.classList.add('d-none');
      if(qbCbLabel) qbCbLabel.textContent = 'Cb';
      if(qbCbAmount) qbCbAmount.textContent = '- ' + fmtEUR(0);
      if(qbCbNote){
        qbCbNote.classList.add('d-none');
        qbCbNote.classList.remove('alert-warning');
        qbCbNote.classList.add('alert-info');
        qbCbNote.textContent = '';
        qbCbNote.innerHTML = '';
      }
      if(qbCbEarnNote){
        qbCbEarnNote.classList.add('d-none');
        qbCbEarnNote.classList.remove('alert-warning');
        qbCbEarnNote.classList.add('alert-success');
        qbCbEarnNote.textContent = '';
        qbCbEarnNote.innerHTML = '';
      }
    }


    function qbResetFidelityState(){
      qbFid = { enabled:false, readonly_existing:false, label:'Punti', redeem_enabled:false, auto_discount_enabled:false, min_points:0, available_points:0, base_amount:0, euro_per_point:0, requested_points:0, points_used:0, discount:0, error:null, conflict_policy:'', conflict:false, gift_enabled:false, gift_min_points:0, gift_description:null, gifts:[], gift_can_redeem:false, gift_redeemed:false, gift_redeemed_note:null, gift_redeemed_points:0, pending_reserved_points:0, pending_reserved_booking_code:'', pending_reserved_appointment_id:0 };
      if(qbFidelityPointsUse) qbFidelityPointsUse.value = '0';
  if(qbFidelityToggle) qbFidelityToggle.checked = false;
      try{ if(qbFidInputTimer) clearTimeout(qbFidInputTimer); }catch(_){ }
      if(qbFidelityAmountInput) qbFidelityAmountInput.value = '';
      if(qbFidelityGiftIdx) qbFidelityGiftIdx.value = '';
      if(qbFidelityGiftPointsUse) qbFidelityGiftPointsUse.value = '0';

      if(qbFidelityRow) qbFidelityRow.classList.add('d-none');
      if(qbFidelityGiftRow) qbFidelityGiftRow.classList.add('d-none');

      if(qbFidelityNote){ qbFidelityNote.classList.add('d-none'); qbFidelityNote.classList.remove('alert-warning'); qbFidelityNote.classList.add('alert-info'); qbFidelityNote.textContent = ''; }
      if(qbFidelityBox) qbFidelityBox.classList.add('d-none');
      if(qbFidelityToggleRow) qbFidelityToggleRow.classList.add('d-none');
      if(qbFidelityToggle) qbFidelityToggle.checked = false;
      if(qbFidelityAmountWrap) qbFidelityAmountWrap.classList.add('d-none');
      if(qbFidelityMaxBtn) qbFidelityMaxBtn.classList.add('d-none');
      if(qbFidelityAmountSuffix) qbFidelityAmountSuffix.textContent = 'Punti';
      if(qbFidelityAvail) qbFidelityAvail.textContent = 'Disponibili: 0 Punti';
      if(qbFidelityHint) qbFidelityHint.textContent = '';
      if(qbFidelityActions) qbFidelityActions.classList.add('d-none');

      if(qbFidelityChoiceBox) qbFidelityChoiceBox.classList.add('d-none');
      if(qbFidelityChoiceHint) qbFidelityChoiceHint.textContent = '';
      try{
        const rds = document.querySelectorAll('input[name="fidelity_conflict_choice"]');
        for(const r of rds){ r.checked = false; r.disabled = true; }
      } catch(_){}
    

      // reset credito (ricariche)
      qbCreditPrev = { enabled:false, available:0 };
      if(qbCreditUseBox) qbCreditUseBox.classList.add('d-none');
      if(qbCreditUseToggle) qbCreditUseToggle.checked = false;
      if(qbCreditUseInput) qbCreditUseInput.value = '0';
      if(qbCreditFromBookingInput) qbCreditFromBookingInput.value = '0';
      if(qbCreditRow) qbCreditRow.classList.add('d-none');
      if(qbCreditAvail) qbCreditAvail.textContent = '€ 0,00';
      if(qbCreditWillUse) qbCreditWillUse.textContent = '€ 0,00';
      if(qbCreditLabelPrefix) qbCreditLabelPrefix.textContent = 'Il cliente ha disponibile un credito di ';
      if(qbCreditLabelMid) qbCreditLabelMid.textContent = ' e saranno scalati ';
      if(qbCreditLabelSuffix) qbCreditLabelSuffix.textContent = ' per questa prenotazione.';
      if(qbCreditUseToggle) qbCreditUseToggle.disabled = false;
      if(qbCreditAmount) qbCreditAmount.textContent = '- ' + fmtEUR(0);
      if(qbCreditNote){
        qbCreditNote.classList.add('d-none');
        qbCreditNote.classList.remove('alert-warning');
        qbCreditNote.classList.add('alert-info');
        qbCreditNote.textContent = '';
        qbCreditNote.innerHTML = '';
      }
      try{ qbSyncResidualCreditUi(); }catch(_){ }
}

    function qbNormMoney(v){
      const n = parseFloat(String(v ?? '').replace(',', '.'));
      if(!Number.isFinite(n)) return 0;
      return Math.round(n * 100) / 100;
    }

    function qbCreditSelectedAmount(){
      return qbNormMoney(qbCreditUseInput ? (parseFloat(String(qbCreditUseInput.value || '0').replace(',', '.')) || 0) : 0);
    }

    function qbCreditAvailableAmount(){
      if(!qbCreditPrev) return 0;
      const available = qbNormMoney(qbCreditPrev.available || 0);
      return available > 0.00001 ? available : 0;
    }

    function qbCreditMaxUsable(dueAmount){
      const due = qbNormMoney(dueAmount != null ? dueAmount : (qbLastDueBeforePayments || 0));
      const available = qbCreditAvailableAmount();
      return qbNormMoney(Math.max(0, Math.min(available, Math.max(0, due))));
    }

    function qbSyncResidualCreditUi(opts){
      const options = (opts && typeof opts === 'object') ? opts : {};
      if(!qbResidualCreditCard) return;

      const available = qbCreditAvailableAmount();
      const requested = qbCreditSelectedAmount();
      const maxUsable = qbCreditMaxUsable(qbLastDueBeforePayments || 0);
      const disabled = !!options.disabled;
      const show = (!!options.forceShow) || available > 0.00001 || requested > 0.00001;

      qbResidualCreditCard.classList.toggle('d-none', !show);

      if(!show){
        if(qbResidualCreditToggle) qbResidualCreditToggle.checked = false;
        if(qbResidualCreditAvail) qbResidualCreditAvail.textContent = fmtEUR(0);
        if(qbResidualCreditAmount) qbResidualCreditAmount.value = '0';
        if(qbResidualCreditHint) qbResidualCreditHint.textContent = '';
        return;
      }

      if(qbResidualCreditAvail) qbResidualCreditAvail.textContent = fmtEUR(available);
      if(qbResidualCreditToggle){
        qbResidualCreditToggle.checked = requested > 0.00001;
        qbResidualCreditToggle.disabled = disabled || !(available > 0.00001);
      }
      if(qbResidualCreditAmount){
        const displayAmount = requested > 0.00001 ? requested : maxUsable;
        qbResidualCreditAmount.disabled = disabled || !(requested > 0.00001);
        qbResidualCreditAmount.value = displayAmount > 0.00001 ? qbFmtInputNumber(displayAmount) : '0';
      }
      if(qbResidualCreditMaxBtn){
        qbResidualCreditMaxBtn.disabled = disabled || !(available > 0.00001) || !(maxUsable > 0.00001);
      }
      if(qbResidualCreditHint){
        if(available > 0.00001){
          const parts = ['Saldo tessera: ' + fmtEUR(available), 'Max utilizzabile: ' + fmtEUR(maxUsable)];
          if(!(maxUsable > 0.00001)) parts.push('Aggiungi prima i servizi per usare il credito.');
          qbResidualCreditHint.textContent = parts.join(' • ');
        } else {
          qbResidualCreditHint.textContent = 'Credito non disponibile.';
        }
      }
    }

	    function qbRenderCbEarnNote(statusVal){
	      if(!qbCbEarnNote) return;
	      const st = qbNormStatus(statusVal || '');
	      const cancelMode = qbIsDoneCancelMode(st);
	      const cbAmt = qbNormMoney(qbCbEarn ? qbCbEarn.amount : 0);
	      const ptsAmt = qbNormMoney(qbCbEarn ? qbCbEarn.points : 0);

	      if(cancelMode){
	        qbCbEarnNote.classList.add('d-none');
	        qbCbEarnNote.classList.remove('alert-warning');
	        qbCbEarnNote.classList.add('alert-success');
	        qbCbEarnNote.textContent = '';
	        qbCbEarnNote.innerHTML = '';
	        return;
	      }

	      if(st === 'done' || st === 'canceled' || st === 'no_show' || (!(cbAmt > 0.00001) && !(ptsAmt > 0.00001))){
	        qbCbEarnNote.classList.add('d-none');
	        qbCbEarnNote.classList.remove('alert-warning');
	        qbCbEarnNote.classList.add('alert-success');
	        qbCbEarnNote.textContent = '';
	        qbCbEarnNote.innerHTML = '';
	        return;
	      }

	      let lbl = '';
	      try{ lbl = qbCbEarn && qbCbEarn.points_label ? String(qbCbEarn.points_label || '').trim() : ''; }catch(_){ lbl = ''; }
	      if(!lbl) lbl = 'Punti';
	      try{ lbl = lbl.charAt(0).toLowerCase() + lbl.slice(1); }catch(_){ }

	      const parts = [];
	      if(ptsAmt > 0.00001){
	        parts.push(`${escHtml(fmtPts(ptsAmt))} ${escHtml(lbl)}`);
	      }
	      if(cbAmt > 0.00001){
	        parts.push(`${escHtml(fmtEUR(cbAmt))} cb`);
	      }
	      const what = parts.join(' e ');

	      qbCbEarnNote.classList.remove('d-none');
	      qbCbEarnNote.classList.remove('alert-warning');
	      qbCbEarnNote.classList.add('alert-success');
	      qbCbEarnNote.textContent = '';
	      qbCbEarnNote.innerHTML = `Se questa prenotazione sarà eseguita, il cliente guadagnerà <strong>${what}</strong> (in base alle impostazioni).`;
	    }

	    function qbResetCbEarnPreview(){
	      qbCbEarn = { enabled:false, amount:0, eligible_net:0, campaign_name:null, error:null, points:0, points_label:'Punti', points_enabled:false };
      qbCbEarnKey = '';
      qbCbEarnLoading = false;
      try{ if(qbCbEarnTimer) clearTimeout(qbCbEarnTimer); } catch(_){ }
      qbCbEarnTimer = null;
      qbRenderCbEarnNote('');
    }

    function qbScheduleCbEarnPreview(params){
      try{ if(qbCbEarnTimer) clearTimeout(qbCbEarnTimer); } catch(_){ }
      qbCbEarnTimer = setTimeout(() => {
        qbRefreshCbEarnPreviewIfNeeded(params).catch(() => {});
      }, 250);
    }

    async function qbRefreshCbEarnPreviewIfNeeded(){ qbResetCbEarnPreview(); return null; }

    function qbClearPromotionPreviewOnChecks(){
      try{
        const checks = getAllServiceChecks();
        for(const ch of checks){
          try{ delete ch.dataset.bookedPrice; delete ch.dataset.listPrice; delete ch.dataset.discountBadge; } catch(_){ }
        }
      } catch(_){ }
      qbPromo = { applied:false, promotion:null, services:{} };
    }

    async function qbRefreshPromotionPreview(){
      // In modifica appuntamento manteniamo lo snapshot prezzi già salvato (non ricalcoliamo promo)
      const apptId = (apptIdEl && String(apptIdEl.value || '').trim()) ? String(apptIdEl.value || '').trim() : '';
      if (apptId) return;

      // Promo: escludi i servizi già pagati (Residui GiftBox/Pacchetti)
      const serviceIds = getSelectedPayableServiceIds();
      if (!serviceIds.length) {
        qbPromoReqId++;
        qbPromoKey = '';
        qbPromoLoading = false;
        qbPromoPromise = null;
        qbClearPromotionPreviewOnChecks();
        try{ renderPriceDetails(); }catch(_){ }
        return;
      }

      const date = (qbDate && String(qbDate.value || '').trim()) ? String(qbDate.value || '').trim() : '';
      const timeRaw = (qbStartTime && String(qbStartTime.value || '').trim()) ? String(qbStartTime.value || '').trim() : '';
      const time = (timeRaw && /^\d{2}:\d{2}/.test(timeRaw)) ? timeRaw.substring(0, 5) : '';
      const cid = (qbClientId && String(qbClientId.value || '').trim()) ? String(qbClientId.value || '').trim() : '0';
      let locId = '';
      try{ locId = (typeof qbCurrentLocationId === 'function') ? qbCurrentLocationId() : ''; } catch(_){ locId = ''; }

      const key = [cid, serviceIds.join(','), date || '', time || '', locId || ''].join('|');
      if (key === qbPromoKey) {
        if (qbPromoLoading && qbPromoPromise) return qbPromoPromise;
        try{ renderPriceDetails(); }catch(_){ }
        return;
      }

      qbPromoKey = key;
      const reqId = ++qbPromoReqId;
      qbPromoLoading = true;

      qbPromoPromise = (async () => {
      try{
        const q = new URLSearchParams();
        q.set('page', 'api_appointments');
        q.set('action', 'promotion_preview');
        q.set('client_id', cid || '0');
        q.set('service_ids', serviceIds.join(','));
        if (locId) q.set('location_id', locId);
        if (date) q.set('appt_date', date);
        if (time) q.set('appt_time', time);

        const url = 'index.php?' + q.toString();
        const res = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
        const js = await res.json().catch(() => null);

        if (reqId !== qbPromoReqId) return;

        // Clear previous promo info
        try{
          const checks = getAllServiceChecks();
          for(const ch of checks){
            try{ delete ch.dataset.bookedPrice; delete ch.dataset.listPrice; delete ch.dataset.discountBadge; } catch(_){ }
          }
        } catch(_){ }

        if (!js || !js.ok || !js.applied || !Array.isArray(js.services)) {
          qbPromo = {
            applied:false,
            promotion:null,
            services:{},
            reason: js && js.reason ? String(js.reason) : ''
          };
          return;
        }

        const map = {};
        for(const line of js.services){
          if(!line) continue;
          const sid = String(line.service_id || '').trim();
          if(!sid) continue;
          map[sid] = line;
        }

        try{
          const checks = getAllServiceChecks();
          for(const ch of checks){
            const sid = String(ch.value || '').trim();
            if(!sid || !map[sid]) continue;
            const ln = map[sid];

            const lp = parseFloat(String(ln.list_price || '').replace(',', '.'));
            const bp = parseFloat(String(ln.booked_price || '').replace(',', '.'));
            const badge = (ln.discount_badge !== null && ln.discount_badge !== undefined) ? String(ln.discount_badge) : '';

            if (isFinite(lp) && isFinite(bp) && lp > 0 && bp >= 0 && lp > bp) {
              ch.dataset.listPrice = String(lp);
              ch.dataset.bookedPrice = String(bp);
              if (badge) ch.dataset.discountBadge = badge;
              else delete ch.dataset.discountBadge;
            }
          }
        } catch(_){ }

        qbPromo = { applied:true, promotion:(js.promotion || null), services:map, reason:'' };
      } catch(e){
        if (reqId !== qbPromoReqId) return;
        qbPromo = { applied:false, promotion:null, services:{}, reason:'Impossibile aggiornare la preview promozione.' };
        qbPromoKey = '';
      } finally {
        if (reqId === qbPromoReqId) {
          qbPromoLoading = false;
          qbPromoPromise = null;
          try{ renderPriceDetails(); }catch(_){ }
        }
      }

      })();

      return qbPromoPromise;
    }

    async function qbRefreshFidelityPreview(){
      // Requisiti minimi: cliente selezionato + almeno 1 servizio
      const cid = qbClientId ? String(qbClientId.value || '').trim() : '';
      // Fidelity/Cb preview: escludi i servizi già pagati (Residui GiftBox/Pacchetti)
      const svcIds = getSelectedPayableServiceIds();
      if(!cid || !svcIds.length){
        qbResetFidelityState();
        qbResetCbState();
        return;
      }

      const myReq = ++qbFidReqId;
      const params = new URLSearchParams();
      params.set('page','api_appointments');
      params.set('action','fidelity_preview');
      params.set('client_id', cid);
      params.set('service_ids', svcIds.join(','));
      try{
        const locId = (typeof qbCurrentLocationId === 'function') ? qbCurrentLocationId() : '';
        if(locId) params.set('location_id', locId);
      } catch(_){ }
      // Se esiste già uno sconto fidelity applicato (fidelity_points_use > 0),
      // manteniamo quei punti; altrimenti chiediamo il massimo (999...) per mostrare il potenziale sconto.
      let exId = '';
      try{ exId = qbGetExcludeId ? String(qbGetExcludeId() || '').trim() : ''; }catch(_){ exId = ''; }

      let reqPts = 0;
      try{ reqPts = qbCurrentFidelityRequestedPoints(); }catch(_){ reqPts = 0; }
      reqPts = wholePts(reqPts);
      if(qbFidelityPointsUse) qbFidelityPointsUse.value = reqPts > 0.000001 ? String(reqPts) : '0';

      const hasApplied = reqPts > 0.000001;
      params.set('requested_points', hasApplied ? String(reqPts) : '999999999');
      // In modalità "scelta cliente" calcoliamo gli omaggi senza sottrarre lo sconto già applicato,
      // così l'operatore può sempre cambiare scelta fino a quando l'appuntamento non è "Eseguito".
      let _choice = '';
      try{ _choice = (typeof qbGetFidelityChoice === 'function') ? qbGetFidelityChoice() : ''; }catch(_){ _choice = ''; }
      const _hasChoice = (_choice === 'discount' || _choice === 'gift' || _choice === 'later');
      params.set('apply_discount', (hasApplied && !_hasChoice) ? '1' : '0');
      if(exId) params.set('appointment_id', exId);

      // appointment date (for campaign-based rules)
      try{
        const d = qbDate ? String(qbDate.value || '').trim() : '';
        if(d) params.set('appt_date', d);
      } catch(_){ }
      try{
        const t0 = qbStartTime ? String(qbStartTime.value || '').trim() : '';
        if(t0 && /^\d{2}:\d{2}/.test(t0)) params.set('appt_time', t0.substring(0, 5));
      } catch(_){ }

      // include sconto manuale (se presente) per calcolare correttamente la base
      try{
        const dtype = qbDiscountType ? String(qbDiscountType.value || '').trim() : '';
        const dval = qbDiscountValue ? String(qbDiscountValue.value || '').trim() : '';
        if(dtype) params.set('discount_type', dtype);
        if(dval) params.set('discount_value', dval);
      } catch(_){ }

      try{
        const ccode = qbCouponCode ? qbNormalizeCouponCode(qbCouponCode.value || '') : '';
        if(ccode) params.set('coupon_code', ccode);
      } catch(_){ }

      // appointment_id already set above (edit only)

      try{
        const res = await fetch('index.php?' + params.toString(), {credentials:'same-origin'});
        const js = await res.json();
        if(myReq !== qbFidReqId) return;
        if(js && js.ok){
          qbFid.enabled = !!js.enabled;
          qbFid.readonly_existing = !!js.readonly_existing;
          qbFid.label = String(js.label || 'Punti');

          qbFid.redeem_enabled = !!js.redeem_enabled;
          qbFid.auto_discount_enabled = !!js.auto_discount_enabled;
          qbFid.min_points = parseFloat(String(js.min_points || 0).replace(',', '.')) || 0;
          qbFid.base_amount = parseFloat(String(js.base_amount || 0).replace(',', '.')) || 0;
          qbFid.euro_per_point = parseFloat(String(js.euro_per_point || 0).replace(',', '.')) || 0;
          qbFid.requested_points = parseFloat(String(js.requested_points || 0).replace(',', '.')) || 0;

          qbFid.available_points = parseFloat(String(js.available_points || 0).replace(',', '.')) || 0;
          qbFid.points_used = parseFloat(String(js.points_used || 0).replace(',', '.')) || 0;
          qbFid.discount = parseFloat(String(js.discount || 0).replace(',', '.')) || 0;
          qbFid.error = js.error || null;

          // Punti Fidelity in sospeso su altre prenotazioni (non ancora eseguite)
          qbFid.pending_reserved_points = parseFloat(String(js.pending_reserved_points || 0).replace(',', '.')) || 0;
          qbFid.pending_reserved_booking_code = (js.pending_reserved_booking_code !== undefined && js.pending_reserved_booking_code !== null)
            ? String(js.pending_reserved_booking_code)
            : '';
          qbFid.pending_reserved_appointment_id = (js.pending_reserved_appointment_id !== undefined && js.pending_reserved_appointment_id !== null)
            ? (parseInt(js.pending_reserved_appointment_id, 10) || 0)
            : 0;

          // Conflitto Sconto / gift
          qbFid.conflict_policy = (js.conflict_policy !== undefined && js.conflict_policy !== null) ? String(js.conflict_policy) : '';
          qbFid.conflict = !!js.conflict;

          // Omaggi (indipendenti dallo sconto)
          qbFid.gift_enabled = !!js.gift_enabled;
          qbFid.gift_min_points = parseFloat(String(js.gift_min_points || 0).replace(',', '.')) || 0;
          qbFid.gift_description = (js.gift_description !== undefined && js.gift_description !== null) ? String(js.gift_description) : null;
          qbFid.gifts = Array.isArray(js.gifts) ? js.gifts : [];
          qbFid.gift_can_redeem = !!js.gift_can_redeem;
          qbFid.gift_redeemed = !!js.gift_redeemed;
          qbFid.gift_redeemed_note = (js.gift_redeemed_note !== undefined && js.gift_redeemed_note !== null) ? String(js.gift_redeemed_note) : null;
          qbFid.gift_redeemed_points = parseFloat(String(js.gift_redeemed_points || 0).replace(',', '.')) || 0;

          qbCbPrev = { enabled:false, redeem_enabled:false, apply_in_booking:false, available:0, max_usable:0, reason:null };
        

          // Credito cliente (ricariche) preview
          try{
            const cr = js.credit || null;
            if(cr){
              const schemaOk = !!(parseInt(String(cr.schema_ok || 0), 10) || 0);
              const bal = parseFloat(String(cr.balance || 0).replace(',', '.')) || 0;
              qbCreditPrev = { enabled: (schemaOk && bal > 0.00001), available: bal };
            } else {
              qbCreditPrev = { enabled:false, available:0 };
            }
          } catch(_){
            qbCreditPrev = { enabled:false, available:0 };
          }

          try{ qbSyncResidualCreditUi(); }catch(_){ }

} else {
          qbResetFidelityState();
          qbResetCbState();
        }
      } catch(_){
        if(myReq !== qbFidReqId) return;
        qbResetFidelityState();
        qbResetCbState();
      }
    }

    async function qbRefreshFidelityThenRender(){
      await qbRevalidateCouponIfNeeded();
      await qbRefreshPromotionPreview();
      await qbRefreshFidelityPreview();

      // Aggiorna visibilità/radio della "Scelta cliente" (discount|gift|later)
      try{ if(typeof qbUpdateFidelityChoiceVisibility === 'function') qbUpdateFidelityChoiceVisibility(); }catch(_){}

      // In modalità "choice" assicura una scelta di default e normalizza i campi hidden
      try{
        const policy = (qbFid && qbFid.conflict_policy) ? String(qbFid.conflict_policy || '').toLowerCase() : '';
        if(policy === 'choice'){
          let c = '';
          try{ c = (typeof qbGetFidelityChoice === 'function') ? qbGetFidelityChoice() : ''; }catch(_){ c = ''; }

          if(!c){
            let pu = 0;
            let gpu = 0;
            try{ pu = qbFidelityPointsUse ? (parseFloat(String(qbFidelityPointsUse.value || '0').replace(',', '.')) || 0) : 0; }catch(_){ pu = 0; }
            try{ gpu = qbFidelityGiftPointsUse ? (parseFloat(String(qbFidelityGiftPointsUse.value || '0').replace(',', '.')) || 0) : 0; }catch(_){ gpu = 0; }
            pu = Math.round(pu * 100) / 100;
            gpu = Math.round(gpu * 100) / 100;

            if(gpu > 0.000001) c = 'gift';
            else if(pu > 0.000001) c = 'discount';
            else c = 'later';

            if(typeof qbSetFidelityChoice === 'function') qbSetFidelityChoice(c);
          }

          try{ if(typeof qbApplyFidelityChoice === 'function') qbApplyFidelityChoice(c); }catch(_){}
          try{ if(typeof qbUpdateFidelityChoiceVisibility === 'function') qbUpdateFidelityChoiceVisibility(); }catch(_){}
        }
      } catch(_){}

      renderPriceDetails();
    }

    function qbGetFidelityChoice(){
      try{
        const el = document.querySelector('input[name="fidelity_conflict_choice"]:checked');
        const v = el ? String(el.value || '').toLowerCase() : '';
        if(v === 'discount' || v === 'gift' || v === 'later') return v;
      } catch(_){ }
      return '';
    }

    function qbSetFidelityChoice(choice){
      const v = String(choice || '').toLowerCase();
      if(qbFidChoiceDiscount) qbFidChoiceDiscount.checked = (v === 'discount');
      if(qbFidChoiceGift) qbFidChoiceGift.checked = (v === 'gift');
      if(qbFidChoiceLater) qbFidChoiceLater.checked = (v === 'later');
    }

    function qbPickBestGift(){
      const giftsArr = Array.isArray(qbFid?.gifts) ? qbFid.gifts : [];
      let avail = 0;
      try{ avail = wholePts(qbFid?.available_points || 0); }catch(_){ avail = 0; }

      let best = null;
      for(const g of giftsArr){
        if(!g) continue;
        const idx = (g.idx !== undefined && g.idx !== null) ? parseInt(g.idx, 10) : null;
        const min = wholePts(g.min_points || 0);
        if(idx === null || Number.isNaN(idx) || !(min > 0)) continue;
        if(min > avail + 0.000001) continue;

        if(!best || min > best.min_points){
          best = { idx, min_points: min, description: (g.description != null ? String(g.description) : '') };
        }
      }
      return best;
    }

    function qbApplyFidelityChoice(choice){
      const v = String(choice || '').toLowerCase();
      if(v === 'discount'){
        // Cb e sconto Punti Fidelity non sono cumulabili: scegliendo lo sconto,
        // azzera un eventuale utilizzo Cb.
        if(qbCbToggle) qbCbToggle.checked = false;
        if(qbCbAmountInput) qbCbAmountInput.value = '';
        try{
          if(qbCb){
            qbCb.amount = 0;
            if(qbCb.state && qbCb.state !== 'canceled' && qbCb.state !== 'cancelled' && qbCb.state !== 'consumed') qbCb.state = 'canceled';
            else if(!qbCb.state) qbCb.state = '';
          }
        } catch(_){ }

        // sconto => azzera omaggio prenotato
        if(qbFidelityGiftIdx) qbFidelityGiftIdx.value = '';
        if(qbFidelityGiftPointsUse) qbFidelityGiftPointsUse.value = '0';

        // Se non c'è uno sconto applicato, auto-applica il massimo suggerito (comportamento booking)
        try{
          const curPts = qbFidelityPointsUse ? (parseFloat(String(qbFidelityPointsUse.value || '0').replace(',', '.')) || 0) : 0;
          if(curPts <= 0.000001 && qbFid && !qbFid.error && qbFid.redeem_enabled){
            const sugPts = wholePts(qbFid.points_used || 0);
            const sugDisc = parseFloat(String(qbFid.discount || 0).replace(',', '.')) || 0;
            if(sugPts > 0.000001 && sugDisc > 0.000001){
              if(qbFidelityPointsUse) qbFidelityPointsUse.value = String(sugPts);
            }
          }
        } catch(_){ }
      } else if(v === 'gift'){
        // gift => azzera sconto
        if(qbFidelityPointsUse) qbFidelityPointsUse.value = '0';

        // Se non c'è omaggio già prenotato, scegli il migliore riscattabile
        let curGiftPts = 0;
        try{ curGiftPts = qbFidelityGiftPointsUse ? (parseFloat(String(qbFidelityGiftPointsUse.value || '0').replace(',', '.')) || 0) : 0; }catch(_){ curGiftPts = 0; }
        if(curGiftPts <= 0.000001){
          const best = qbPickBestGift();
          if(best){
            if(qbFidelityGiftIdx) qbFidelityGiftIdx.value = String(best.idx);
            if(qbFidelityGiftPointsUse) qbFidelityGiftPointsUse.value = String(best.min_points);
          } else {
            if(qbFidelityGiftIdx) qbFidelityGiftIdx.value = '';
            if(qbFidelityGiftPointsUse) qbFidelityGiftPointsUse.value = '0';
          }
        }
      } else if(v === 'later'){
        // in negozio => azzera entrambi
        if(qbFidelityPointsUse) qbFidelityPointsUse.value = '0';
        if(qbFidelityGiftIdx) qbFidelityGiftIdx.value = '';
        if(qbFidelityGiftPointsUse) qbFidelityGiftPointsUse.value = '0';
      }
    }

    function qbUpdateFidelityChoiceVisibility(){
      const policy = (qbFid && qbFid.conflict_policy) ? String(qbFid.conflict_policy || '').toLowerCase() : '';
      const isChoice = (policy === 'choice');
      const show = isChoice && (qbFid && qbFid.enabled) && (qbFid.redeem_enabled || qbFid.gift_enabled);

      // Mostra/nascondi box
      if(qbFidelityChoiceBox){
        if(show) qbFidelityChoiceBox.classList.remove('d-none');
        else qbFidelityChoiceBox.classList.add('d-none');
      }

      const statusNow = qbNormStatus(String(statusSel?.value || ''));
      const isLocked = (statusNow === 'done' || statusNow === 'canceled' || statusNow === 'no_show' || qbIsDoneCancelMode(statusNow));

      // Enable/disable radios when not applicable or when appointment is in a final state
      const rds = [qbFidChoiceDiscount, qbFidChoiceGift, qbFidChoiceLater];
      for(const r of rds){
        if(!r) continue;
        r.disabled = (!show) || isLocked;
      }

      // Disabilita opzioni non disponibili
      if(show && !isLocked){
        if(qbFidChoiceGift){
          const canGift = !!(qbFid && qbFid.gift_enabled) && (Array.isArray(qbFid.gifts) ? qbFid.gifts.some(g => g && g.can_redeem) : false);
          qbFidChoiceGift.disabled = !canGift;
        }
        if(qbFidChoiceDiscount){
          const canDisc = !!(qbFid && qbFid.redeem_enabled) && !qbFid.error && (parseFloat(String(qbFid.discount || 0).replace(',', '.')) || 0) > 0;
          qbFidChoiceDiscount.disabled = !canDisc;
        }
      }
    }

    function qbOnFidelityChoiceChange(){
      const c = qbGetFidelityChoice();
      qbApplyFidelityChoice(c);
      qbRefreshFidelityThenRender();
    }

    if(qbFidChoiceDiscount) qbFidChoiceDiscount.addEventListener('change', qbOnFidelityChoiceChange);
    if(qbFidChoiceGift) qbFidChoiceGift.addEventListener('change', qbOnFidelityChoiceChange);
    if(qbFidChoiceLater) qbFidChoiceLater.addEventListener('change', qbOnFidelityChoiceChange);

    // Se cambia lo stato dell'appuntamento, aggiorna abilitazione radio (blocco su "done")
    if(statusSel) statusSel.addEventListener('change', ()=>{
      try{ if(typeof qbUpdateFidelityChoiceVisibility === 'function') qbUpdateFidelityChoiceVisibility(); }catch(_){}
      if(qbIsDoneCancelMode()){
        try{ qbEnsureDoneCancelPreview().catch(()=>{}); }catch(_){ }
      }
      try{ renderPriceDetails(); }catch(_){}
    });


    // Fidelity manual apply/remove (when auto-discount is disabled)
    if(qbFidelityApplyBtn){
      qbFidelityApplyBtn.addEventListener('click', (e)=>{
        e.preventDefault();
        try{
          if(!qbFid || qbFid.error) return;
          const pts = wholePts(qbFid.points_used || 0);
          if(!(pts > 0.000001)) return;
          // Cb e sconto Punti Fidelity non sono cumulabili: applicando lo sconto,
          // azzera un eventuale utilizzo Cb.
          try{
            if(qbCbToggle) qbCbToggle.checked = false;
            if(qbCbAmountInput) qbCbAmountInput.value = '';
            if(qbCb){
              qbCb.amount = 0;
              if(qbCb.state && qbCb.state !== 'canceled' && qbCb.state !== 'cancelled' && qbCb.state !== 'consumed'){
                qbCb.state = 'canceled';
              } else if(!qbCb.state){
                qbCb.state = '';
              }
            }
          }catch(_){ }
          if(qbFidelityPointsUse) qbFidelityPointsUse.value = String(pts);
          qbRefreshFidelityThenRender();
        } catch(_){ }
      });
    }
    if(qbFidelityRemoveBtn){
      qbFidelityRemoveBtn.addEventListener('click', (e)=>{
        e.preventDefault();
        qbClearFidelityDiscountSelection();
        qbRefreshFidelityThenRender();
      });
    }


    if(qbFidelityToggle){
      qbFidelityToggle.addEventListener('change', ()=>{
        try{
          if(qbFidelityToggle.checked){
            qbCbTouched = true;
            try{
              qbCb.amount = 0;
              qbCb.state = 'canceled';
            } catch(_){ }
            if(qbCbToggle) qbCbToggle.checked = false;
            if(qbCbAmountInput) qbCbAmountInput.value = '';
            if(qbCbUseInput) qbCbUseInput.value = '0';

            let pts = 0;
            try{ pts = qbFidelityAmountInput ? wholePts(qbFidelityAmountInput.value || '') : 0; }catch(_){ pts = 0; }
            if(!(pts > 0.000001)){
              try{ pts = qbFidelityPointsUse ? (parseFloat(String(qbFidelityPointsUse.value || '0').replace(',', '.')) || 0) : 0; }catch(_){ pts = 0; }
            }
            const maxPts = qbFidelityMaxPointsUsable();
            if(!(pts > 0.000001)) pts = maxPts;
            if(maxPts > 0.000001 && pts > maxPts) pts = maxPts;
            pts = Math.round(Math.max(0, pts) * 100) / 100;
            if(qbFidelityPointsUse) qbFidelityPointsUse.value = pts > 0.000001 ? String(pts) : '0';
            if(qbFidelityAmountInput) qbFidelityAmountInput.value = pts > 0.000001 ? qbFmtPointInputNumber(pts) : '';
          } else {
            qbClearFidelityDiscountSelection();
          }
        } catch(_){ }
        renderPriceDetails();
        qbScheduleFidelityRefresh(0);
      });
    }

    function qbNormStatus(v){
      const s = String(v || '').trim().toLowerCase();
      if(s === 'cancelled') return 'canceled';
      if(s === 'annullato' || s === 'annullata') return 'canceled';
      if(s === 'rifiutato' || s === 'rifiutata' || s === 'rejected') return 'canceled';
      if(s === 'no show' || s === 'no-show' || s === 'noshow' || s === 'non presentato' || s === 'non presentata') return 'no_show';
      if(s === 'eseguito' || s === 'executed') return 'done';
      if(s === 'prenotato') return 'scheduled';
      if(s === 'in attesa') return 'pending';
      return s;
    }

    function qbGetCurrentEditingAppointmentId(){
      const externalId = parseInt(String((qbExternalCancelContext && qbExternalCancelContext.appointmentId) || '').trim(), 10) || 0;
      if(externalId > 0) return externalId;
      return parseInt(String((apptIdEl && apptIdEl.value) || qbEditingId || '').trim(), 10) || 0;
    }

    function qbIsDoneCancelMode(statusValue){
      const apptId = qbGetCurrentEditingAppointmentId();
      if(!(apptId > 0)) return false;
      const orig = qbNormStatus((qbExternalCancelContext && qbExternalCancelContext.originalStatus) || ((form && form.dataset && form.dataset.originalStatus) ? form.dataset.originalStatus : qbOriginalStatus));
      const cur = qbNormStatus(statusValue || (statusSel && statusSel.value) || '');
      return ['pending', 'scheduled', 'done'].includes(orig) && ['canceled', 'no_show'].includes(cur);
    }

    function qbIsCanceledLockedMode(){
      const apptId = qbGetCurrentEditingAppointmentId();
      if(!(apptId > 0)) return false;
      const orig = qbNormStatus((qbExternalCancelContext && qbExternalCancelContext.originalStatus) || ((form && form.dataset && form.dataset.originalStatus) ? form.dataset.originalStatus : qbOriginalStatus));
      return ['canceled', 'no_show'].includes(orig);
    }

    function qbRememberDisabled(el){
      if(!el || !el.dataset) return;
      if(!Object.prototype.hasOwnProperty.call(el.dataset, 'qbLockDisabled')){
        el.dataset.qbLockDisabled = el.disabled ? '1' : '0';
      }
    }

    function qbRememberReadOnly(el){
      if(!el || !el.dataset) return;
      if(!Object.prototype.hasOwnProperty.call(el.dataset, 'qbLockReadonly')){
        el.dataset.qbLockReadonly = el.readOnly ? '1' : '0';
      }
    }

    function qbRestoreDisabled(el){
      if(!el || !el.dataset) return;
      if(Object.prototype.hasOwnProperty.call(el.dataset, 'qbLockDisabled')){
        el.disabled = (el.dataset.qbLockDisabled === '1');
      }
    }

    function qbRestoreReadOnly(el){
      if(!el || !el.dataset) return;
      if(Object.prototype.hasOwnProperty.call(el.dataset, 'qbLockReadonly')){
        el.readOnly = (el.dataset.qbLockReadonly === '1');
      }
    }

    function qbSetClickableLocked(el, locked){
      if(!el) return;
      if(el.dataset){
        if(!Object.prototype.hasOwnProperty.call(el.dataset, 'qbLockPointerEvents')){
          el.dataset.qbLockPointerEvents = el.style.pointerEvents || '';
        }
        if(!Object.prototype.hasOwnProperty.call(el.dataset, 'qbLockOpacity')){
          el.dataset.qbLockOpacity = el.style.opacity || '';
        }
        if(!Object.prototype.hasOwnProperty.call(el.dataset, 'qbLockTabindex')){
          el.dataset.qbLockTabindex = el.getAttribute('tabindex') || '';
        }
      }
      if(locked){
        el.style.pointerEvents = 'none';
        el.style.opacity = '0.65';
        el.setAttribute('aria-disabled', 'true');
        el.setAttribute('tabindex', '-1');
      } else {
        if(el.dataset){
          el.style.pointerEvents = el.dataset.qbLockPointerEvents || '';
          el.style.opacity = el.dataset.qbLockOpacity || '';
          const tb = el.dataset.qbLockTabindex || '';
          if(tb === '') el.removeAttribute('tabindex');
          else el.setAttribute('tabindex', tb);
        }
        el.removeAttribute('aria-disabled');
      }
    }

    function qbRenderCancellationAlert(appt){
      if(!qbCancellationAlertEl) return;
      const status = qbNormStatus(appt && appt.status ? appt.status : '');
      if(!['canceled', 'no_show'].includes(status)){
        qbCancellationAlertEl.style.display = 'none';
        qbCancellationAlertEl.innerHTML = '';
        return;
      }
      const reason = appt && appt.cancelled_reason != null ? String(appt.cancelled_reason || '').trim() : '';
      const canceledAt = appt && appt.cancelled_at != null ? String(appt.cancelled_at || '').trim() : '';
      const isNoShow = status === 'no_show';
      let html = '<div class="fw-semibold mb-1">' + (isNoShow ? 'Prenotazione No show' : 'Prenotazione annullata') + '</div>';
      if(reason){
        html += '<div>' + escHtml(reason) + '</div>';
      } else {
        html += '<div>Questa prenotazione è in stato finale e non può più essere modificata.</div>';
      }
      if(canceledAt){
        html += '<div class="small text-muted mt-1">' + (isNoShow ? 'Segnata il ' : 'Annullata il ') + escHtml(fmtDateTimeFromSql(canceledAt)) + '</div>';
      }
      qbCancellationAlertEl.innerHTML = html;
      qbCancellationAlertEl.style.display = '';
    }

    function qbSetLockedAppointmentMode(locked){
      const controls = Array.from(form.querySelectorAll('input, select, textarea, button'));
      for(const el of controls){
        if(!el) continue;
        const type = String((el.getAttribute('type') || '')).toLowerCase();
        if(type === 'hidden') continue;
        if(el === statusSel) continue;

        if(locked){
          if(el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['checkbox','radio','button','submit','reset','date','time'].includes(type))){
            qbRememberReadOnly(el);
            el.readOnly = true;
          } else {
            qbRememberDisabled(el);
            el.disabled = true;
          }
        } else {
          qbRestoreReadOnly(el);
          qbRestoreDisabled(el);
        }
      }

      if(statusSel){
        statusSel.disabled = !!locked || !!statusSel.disabled;
      }

      if(msControl){
        if(locked && msDropdown && !msDropdown.hidden){
          try{ msDropdown.hidden = true; msControl.setAttribute('aria-expanded', 'false'); }catch(_){ }
        }
        qbSetClickableLocked(msControl, locked);
      }

      [qbLinkNew, qbLinkFind, qbClearSel, qbHistoryOpen, qbResidualsOpen].forEach((el)=>qbSetClickableLocked(el, locked));

      if(deleteBtn){
        qbRememberDisabled(deleteBtn);
        const keepDeleteEnabled = locked && qbNormStatus((form && form.dataset && form.dataset.originalStatus) ? form.dataset.originalStatus : qbOriginalStatus) === 'canceled';
        deleteBtn.disabled = keepDeleteEnabled ? false : (locked ? true : (deleteBtn.dataset.qbLockDisabled === '1'));
      }
      if(submitBtn){
        qbRememberDisabled(submitBtn);
        submitBtn.disabled = locked ? true : (submitBtn.dataset.qbLockDisabled === '1');
      }
      if(submitTextEl){
        if(!Object.prototype.hasOwnProperty.call(submitTextEl.dataset, 'qbLockText')){
          submitTextEl.dataset.qbLockText = submitTextEl.textContent || '';
        }
        const lockedStatus = qbNormStatus((form && form.dataset && form.dataset.originalStatus) ? form.dataset.originalStatus : qbOriginalStatus);
        submitTextEl.textContent = locked ? (lockedStatus === 'no_show' ? 'Prenotazione No show' : 'Prenotazione annullata') : (submitTextEl.dataset.qbLockText || submitTextEl.textContent || '');
      }
    }

    function qbApplyCancellationState(appt){
      const locked = ['canceled', 'no_show'].includes(qbNormStatus(appt && appt.status ? appt.status : ''));
      qbRenderCancellationAlert(appt || null);
      qbSetLockedAppointmentMode(locked);
    }

    function qbNormalizeDoneCancelTarget(value){
      const target = qbNormStatus(value || '');
      return ['canceled', 'no_show'].includes(target) ? target : 'canceled';
    }

    function qbDoneCancelTargetLabel(value){
      return qbNormalizeDoneCancelTarget(value) === 'no_show' ? 'No show' : 'Annullato';
    }

    function qbGetCachedDoneCancelPreview(apptId){
      const id = String(apptId || qbGetCurrentEditingAppointmentId() || '').trim();
      if(!id) return null;
      const cached = qbDoneCancelPreviewData;
      const target = qbNormalizeDoneCancelTarget(qbDoneCancelTargetStatus);
      const cachedTarget = qbNormalizeDoneCancelTarget(cached && (cached.target_status || cached.targetStatus || ''));
      if(cached && cachedTarget === target && String(cached.appointment_id || '') === id) return cached;
      if(cached && cachedTarget === target && qbDoneCancelPreviewForId && String(qbDoneCancelPreviewForId) === id) return cached;
      return null;
    }

    async function qbEnsureDoneCancelPreview(force=false){
      const apptId = qbGetCurrentEditingAppointmentId();
      if(!(apptId > 0)) return qbGetCachedDoneCancelPreview(apptId);
      if(!qbExternalCancelContext && !qbIsDoneCancelMode()) return qbGetCachedDoneCancelPreview(apptId);
      if(!force){
        const cached = qbGetCachedDoneCancelPreview(apptId);
        if(cached) return cached;
      }
      if(qbDoneCancelPreviewLoading) return qbGetCachedDoneCancelPreview(apptId);
      qbDoneCancelPreviewLoading = true;
      try{
        const body = new URLSearchParams({ action:'cancel_done_preview', id:String(apptId), _csrf: csrf, target_status: qbNormalizeDoneCancelTarget(qbDoneCancelTargetStatus) });
        if(qbExternalCancelContext && qbExternalCancelContext.pendingOnly) body.set('pending_only', '1');
        const res = await fetch('index.php?page=api_appointments', {
          method:'POST',
          headers:{'Content-Type':'application/x-www-form-urlencoded'},
          body
        });
        const data = await res.json();
        if(data && data.ok){
          qbDoneCancelPreviewData = data.preview || null;
          qbDoneCancelPreviewForId = String(apptId);
        } else {
          qbDoneCancelPreviewData = null;
          qbDoneCancelPreviewForId = '';
          throw new Error((data && data.error) ? data.error : 'Errore caricamento annullamento');
        }
      } finally {
        qbDoneCancelPreviewLoading = false;
        try{ renderPriceDetails(); }catch(_){ }
      }
      return qbDoneCancelPreviewData;
    }

    function qbDoneCancelPointSummaryHtml(preview, fidLabel){
      const label = String(fidLabel || 'Punti').trim() || 'Punti';
      const targetStatus = qbNormalizeDoneCancelTarget(preview && (preview.target_status || preview.targetStatus || qbDoneCancelTargetStatus));
      const actionText = targetStatus === 'no_show' ? 'Marcando No show questa prenotazione' : 'Annullando questa prenotazione';
      const ptsUsed = qbNormMoney(preview && preview.points ? preview.points.used : 0);
      const ptsLocked = qbNormMoney(preview && preview.points ? ((preview.points.locked != null) ? preview.points.locked : preview.points.reserved) : 0);
      const ptsEarn = qbNormMoney(preview && preview.points ? preview.points.earned : 0);
      const cancelMode = String(preview && preview.cancel_mode ? preview.cancel_mode : '').toLowerCase();
      const isReservedCancel = cancelMode && cancelMode !== 'executed';
      const giftsUsed = parseInt(String(preview && preview.gifts ? (preview.gifts.used_instances ?? 0) : 0), 10) || 0;
      const eventCnt = parseInt(String(preview && preview.gifts ? (preview.gifts.event_count ?? 0) : 0), 10) || 0;
      const parts = [];

      if(isReservedCancel && ptsLocked > 0.00001){
        parts.push(`${actionText} verranno sbloccati <strong>${escHtml(fmtPts(ptsLocked))}</strong> ${escHtml(label)} prenotati.`);
      } else if(ptsUsed > 0.00001 && ptsEarn > 0.00001){
        parts.push(`${actionText} verranno ripristinati <strong>${escHtml(fmtPts(ptsUsed))}</strong> ${escHtml(label)} usati e stornati <strong>${escHtml(fmtPts(ptsEarn))}</strong> ${escHtml(label)} guadagnati.`);
      } else if(ptsUsed > 0.00001){
        parts.push(`${actionText} verranno ripristinati <strong>${escHtml(fmtPts(ptsUsed))}</strong> ${escHtml(label)} usati.`);
      } else if(ptsEarn > 0.00001){
        parts.push(`${actionText} verranno stornati <strong>${escHtml(fmtPts(ptsEarn))}</strong> ${escHtml(label)} guadagnati.`);
      }

      if(giftsUsed > 0){
        parts.push(`Verranno sbloccati <strong>${escHtml(String(giftsUsed))}</strong> omaggio/i Fidelity usati su questa prenotazione.`);
      }
      if(eventCnt > 0){
        parts.push('Gli eventuali progressi o omaggi Fidelity generati da questa prenotazione verranno ricalcolati.');
      }

      if(!parts.length && qbDoneCancelPreviewLoading){
        parts.push(appInlineLoadingHtml('Caricamento del dettaglio storno Fidelity...', 'small p-0'));
      }

      return parts.join('<br>');
    }

    function qbDoneCancelCbSummaryHtml(){ return ""; }

    function qbDoneCancelExtraSummaryHtml(preview){
      const lines = [];
      const summary = Array.isArray(preview && preview.summary) ? preview.summary.filter(Boolean) : [];
      const warnings = Array.isArray(preview && preview.warnings) ? preview.warnings.filter(Boolean) : [];
      // Le informazioni di storno Fidelity/Cb hanno già un box dedicato nel
      // quick booking: evitiamo di ripeterle nel riepilogo extra per non creare
      // avvisi doppi o incoerenti nella stessa sidebar.
      const skipSummary = (txt)=>/punti fidelity|cb|credito cliente|giftcard|progressi fidelity|omaggi? fidelity|gift\/i usati|omaggi usati|gift usato|verranno sbloccati\s+\d+\s+omaggio/i.test(String(txt || ''));
      const seen = new Set();
      const pushUnique = (txt)=>{
        const clean = String(txt || '').trim();
        if(!clean) return;
        const key = clean.toLowerCase().replace(/\s+/g, ' ');
        if(!key || seen.has(key)) return;
        seen.add(key);
        lines.push(clean);
      };

      for(const line of summary){
        if(skipSummary(line)) continue;
        pushUnique(line);
      }
      for(const line of warnings){
        if(skipSummary(line)) continue;
        pushUnique(line);
      }
      if(preview && preview.extra && preview.extra.points_storno){
        pushUnique('Nel popup finale potrai scegliere se stornare con saldo negativo oppure annullare senza scalare i guadagni maturati.');
      }

      const targetStatus = qbNormalizeDoneCancelTarget(preview && (preview.target_status || preview.targetStatus || qbDoneCancelTargetStatus));
      const isNoShowTarget = targetStatus === 'no_show';
      const title = isNoShowTarget ? 'No show prenotazione' : 'Annullamento prenotazione';
      const loadingText = isNoShowTarget ? 'Caricamento del riepilogo No show...' : 'Caricamento del riepilogo annullamento...';
      const emptyText = isNoShowTarget
        ? 'Marcando No show questa prenotazione verranno riallineate eventuali risorse collegate.'
        : 'Annullando questa prenotazione verranno riallineate eventuali risorse collegate.';

      if(!lines.length){
        if(qbDoneCancelPreviewLoading){
          return '<div class="fw-semibold mb-1">' + escHtml(title) + '</div>' + appInlineLoadingHtml(loadingText, 'small p-0');
        }
        return '<div class="fw-semibold mb-1">' + escHtml(title) + '</div><div class="small">' + escHtml(emptyText) + '</div>';
      }

      let html = '<div class="fw-semibold mb-1">' + escHtml(title) + '</div><ul class="mb-0 ps-3">';
      for(const line of lines){
        html += '<li>' + escHtml(String(line)) + '</li>';
      }
      html += '</ul>';
      return html;
    }

    function qbApplyStatusSelectConstraints(originalStatus, currentValue){
      if(!statusSel) return;
      const orig = qbNormStatus(originalStatus || qbOriginalStatus || '');
      const cur = qbNormStatus(currentValue || statusSel.value || '');
      statusSel.disabled = false;
      if(orig === 'canceled' || orig === 'no_show'){
        statusSel.innerHTML = orig === 'no_show'
          ? '<option value="no_show">No show</option>'
          : '<option value="canceled">Annullato</option>';
        statusSel.value = orig;
        statusSel.disabled = true;
      } else if(orig === 'done'){
        statusSel.innerHTML = '<option value="done">Eseguito</option><option value="canceled">Annulla</option><option value="no_show">No show</option>';
        statusSel.value = ['canceled', 'no_show'].includes(cur) ? cur : 'done';
      } else {
        if(statusSelInitialHtml) statusSel.innerHTML = statusSelInitialHtml;
        const desired = cur || 'scheduled';
        try{ statusSel.value = desired; }catch(_){ }
        if(String(statusSel.value || '') !== String(desired || '')){
          try{ statusSel.value = 'scheduled'; }catch(_){ }
        }
      }
      try{
        if(form && form.dataset){
          if(orig) form.dataset.originalStatus = orig;
          else delete form.dataset.originalStatus;
        }
      }catch(_){ }
    }

    function qbBuildDoneCancelPreviewHtml(preview){
      const code = escHtml(String(preview?.public_code || ''));
      const targetStatus = qbNormalizeDoneCancelTarget(preview?.target_status || preview?.targetStatus || qbDoneCancelTargetStatus);
      const isNoShowTarget = targetStatus === 'no_show';
      const confirmTitle = isNoShowTarget ? 'Conferma No show' : 'Conferma annullamento';
      const confirmText = isNoShowTarget
        ? 'Questa operazione marcherà come No show la prenotazione <strong>' + code + '</strong>.'
        : 'Questa operazione annullerà la prenotazione <strong>' + code + '</strong>.';
      const finalText = isNoShowTarget
        ? 'Dopo il No show la prenotazione non sarà più modificabile.'
        : 'Dopo l\'annullamento la prenotazione non sarà più modificabile.';
      const unavailableTitle = isNoShowTarget ? 'No show non disponibile' : 'Annullamento non disponibile';
      const summary = Array.isArray(preview?.summary) ? preview.summary.filter(Boolean) : [];
      const warningsRaw = Array.isArray(preview?.warnings) ? preview.warnings.filter(Boolean) : [];
      const blockersRaw = Array.isArray(preview?.blockers) ? preview.blockers.filter(Boolean) : [];
      const seenSummary = new Set(summary.map((ln)=>String(ln || '').trim().toLowerCase().replace(/\s+/g, ' ')).filter(Boolean));
      const warnings = [];
      const seenWarnings = new Set();
      for(const warn of warningsRaw){
        const clean = String(warn || '').trim();
        const key = clean.toLowerCase().replace(/\s+/g, ' ');
        if(!key || seenSummary.has(key) || seenWarnings.has(key)) continue;
        seenWarnings.add(key);
        warnings.push(clean);
      }
      const blockers = [];
      const seenBlockers = new Set();
      for(const blocker of blockersRaw){
        const clean = String(blocker || '').trim();
        const key = clean.toLowerCase().replace(/\s+/g, ' ');
        if(!key || seenSummary.has(key) || seenWarnings.has(key) || seenBlockers.has(key)) continue;
        seenBlockers.add(key);
        blockers.push(clean);
      }
      const ptsExtra = preview?.extra?.points_storno || null;
      const cbExtra = null;

      let html = '';
      html += '<div class="alert alert-warning mb-3">';
      html += '  <div class="fw-semibold mb-1">' + escHtml(confirmTitle) + '</div>';
      html += '  <div class="small">' + confirmText + '</div>';
      html += '  <div class="small mt-2 fw-semibold">' + escHtml(finalText) + '</div>';
      html += '</div>';

      if(summary.length){
        html += '<div class="small text-muted mb-1">Riepilogo:</div><ul class="small mb-3">';
        for(const ln of summary){ html += '<li>' + escHtml(String(ln)) + '</li>'; }
        html += '</ul>';
      }

      if(blockers.length){
        html += '<div class="alert alert-danger mb-3"><div class="fw-semibold mb-1">' + escHtml(unavailableTitle) + '</div><ul class="mb-0">';
        for(const b of blockers){ html += '<li>' + escHtml(String(b)) + '</li>'; }
        html += '</ul></div>';
      }

      if(warnings.length){
        html += '<div class="alert alert-info mb-3"><div class="fw-semibold mb-1">Attenzione</div><ul class="mb-0">';
        for(const w of warnings){ html += '<li>' + escHtml(String(w)) + '</li>'; }
        html += '</ul></div>';
      }

      if(ptsExtra){
        const shortageTitle = 'Disponibilità insufficiente per lo storno dei punti Fidelity';
        let shortageText = 'Il cliente non ha più disponibilità libera sufficiente per stornare i punti Fidelity guadagnati con questa prenotazione. ';
        shortageText += 'I punti già prenotati (lock) su altri appuntamenti non vengono considerati disponibili. ';
        shortageText += 'Puoi compensare lo storno con eventuali punti usati come sconto e, se non basta, portare il disponibile in negativo. ';
        shortageText += 'In alternativa puoi annullare senza scalare i punti guadagnati.';
        html += '<div class="alert alert-warning mb-3">';
        html += '  <div class="fw-semibold mb-1">' + escHtml(shortageTitle) + '</div>';
        html += '  <div class="small">' + escHtml(shortageText) + '</div>';
        html += '</div>';
      }

      if(ptsExtra){
        const cur = Number(ptsExtra.current || 0);
        const curAvail = Number((ptsExtra.current_available != null) ? ptsExtra.current_available : cur);
        const reserved = Number(ptsExtra.reserved || 0);
        const usedRestore = Number(ptsExtra.used_restore || 0);
        const earnedStorno = Number(ptsExtra.earned_storno || 0);
        const wouldBe = Number(ptsExtra.would_be || 0);
        const wouldBeAvail = Number((ptsExtra.would_be_available != null) ? ptsExtra.would_be_available : wouldBe);
        html += '<div class="mb-3">';
        html += '  <div class="fw-semibold">Punti Fidelity</div>';
        html += '  <div class="small text-muted mb-2">Disponibile attuale: <strong>' + escHtml(fmtPts(curAvail)) + ' pt</strong>';
        if(reserved > 0.00001) html += ' • Prenotato (lock): <strong>' + escHtml(fmtPts(reserved)) + ' pt</strong>';
        html += ' • Saldo totale: <strong>' + escHtml(fmtPts(cur)) + ' pt</strong>';
        if(usedRestore > 0.00001) html += ' • Ripristino: <strong>+' + escHtml(fmtPts(usedRestore)) + ' pt</strong>';
        html += ' • Storno: <strong>-' + escHtml(fmtPts(earnedStorno)) + ' pt</strong>';
        html += ' • Disponibile finale: <strong>' + escHtml(fmtPts(wouldBeAvail)) + ' pt</strong>';
        html += ' • Saldo finale: <strong>' + escHtml(fmtPts(wouldBe)) + ' pt</strong></div>';
        html += '  <div class="form-check">';
        html += '    <input class="form-check-input" type="radio" name="points_storno_mode" id="qbPtsStornoNeg" value="negative" checked>';
        html += '    <label class="form-check-label" for="qbPtsStornoNeg">';
        html += usedRestore > 0.00001
          ? 'Compensa lo storno con i punti usati come sconto (disponibile negativo se necessario)'
          : 'Porta il disponibile punti in negativo (storna comunque)';
        html += '    </label>';
        html += '  </div>';
        html += '  <div class="form-check">';
        html += '    <input class="form-check-input" type="radio" name="points_storno_mode" id="qbPtsStornoSkip" value="skip">';
        html += '    <label class="form-check-label" for="qbPtsStornoSkip">Procedi con l\'annullamento senza scalare i punti guadagnati</label>';
        html += '  </div>';
        html += '</div>';
      } else {
        html += '<input type="hidden" name="points_storno_mode" value="normal">';
      }

      html += '<div class="mb-2">';
      html += '  <label class="form-label">Motivazione (opzionale)</label>';
      html += '  <textarea class="form-control" id="qbDoneCancelReason" rows="3" maxlength="255" placeholder="Es. errore operatore / cliente ha cambiato idea..."></textarea>';
      html += '  <div class="form-text">Massimo 255 caratteri.</div>';
      html += '</div>';

      return html;
    }

    async function qbOpenDoneCancelPreview(id, options){
      const apptId = parseInt(String(id || (apptIdEl && apptIdEl.value) || '').trim(), 10) || 0;
      if(!(apptId > 0)) return;
      if(!qbDoneCancelModal || !qbDoneCancelBody){
        notify('Popup di annullamento non disponibile', 'danger');
        return;
      }
      const opts = options && typeof options === 'object' ? options : {};
      qbDoneCancelTargetStatus = qbNormalizeDoneCancelTarget(opts.targetStatus || (statusSel && statusSel.value) || qbDoneCancelTargetStatus);
      if(opts.external){
        qbExternalCancelContext = {
          appointmentId: apptId,
          onSuccess: (typeof opts.onSuccess === 'function') ? opts.onSuccess : null,
          originalStatus: String(opts.originalStatus || '').trim(),
          pendingOnly: !!opts.pendingOnly,
          targetStatus: qbDoneCancelTargetStatus
        };
      } else if(!opts.preserveExternal) {
        qbExternalCancelContext = null;
      }
      try{
        qbDoneCancelCommitted = false;
        if(qbDoneCancelModalTitle) qbDoneCancelModalTitle.textContent = qbDoneCancelTargetStatus === 'no_show' ? 'Marca No show' : 'Annulla prenotazione';
        let preview = qbGetCachedDoneCancelPreview(apptId);
        if(!preview){
          qbDoneCancelBody.innerHTML = appInlineLoadingHtml();
          preview = await qbEnsureDoneCancelPreview(true);
        }
        if(!preview){
          throw new Error('Errore caricamento annullamento');
        }
        if(qbExternalCancelContext && qbExternalCancelContext.pendingOnly && qbNormStatus(String(preview?.status || '')) !== 'pending'){
          throw new Error('La richiesta non e piu in attesa: aggiorna la pagina Notifiche.');
        }
        qbDoneCancelPreviewData = preview || {};
        qbDoneCancelPreviewForId = String(apptId);
        if(qbExternalCancelContext && (!qbExternalCancelContext.originalStatus || !String(qbExternalCancelContext.originalStatus).trim())){
          qbExternalCancelContext.originalStatus = String(preview?.status || '').trim();
        }
        qbDoneCancelBody.innerHTML = qbBuildDoneCancelPreviewHtml(qbDoneCancelPreviewData);
        const blockers = Array.isArray(qbDoneCancelPreviewData?.blockers) ? qbDoneCancelPreviewData.blockers.filter(Boolean) : [];
        if(qbDoneCancelConfirmBtn) qbDoneCancelConfirmBtn.disabled = blockers.length > 0;
        qbDoneCancelModal.show();
      }catch(err){
        notify((err && err.message) ? err.message : 'Errore caricamento annullamento', 'danger');
        if(!qbExternalCancelContext){
          try{
            const fallbackStatus = qbNormStatus((form && form.dataset && form.dataset.originalStatus) ? form.dataset.originalStatus : qbOriginalStatus) || 'scheduled';
            if(statusSel) statusSel.value = fallbackStatus;
          }catch(_){ }
          try{ renderPriceDetails(); }catch(_){ }
        } else {
          qbExternalCancelContext = null;
        }
      }
    }

    async function qbSubmitDoneCancel(){
      const apptId = qbGetCurrentEditingAppointmentId();
      if(!(apptId > 0)) return;
      if(!qbDoneCancelModalEl) return;
      const blockers = Array.isArray(qbDoneCancelPreviewData?.blockers) ? qbDoneCancelPreviewData.blockers.filter(Boolean) : [];
      if(blockers.length){
        notify(String(blockers[0] || 'Annullamento non disponibile'), 'danger');
        if(qbDoneCancelConfirmBtn) qbDoneCancelConfirmBtn.disabled = true;
        return;
      }
      const getMode = (name)=>{
        const checked = qbDoneCancelModalEl.querySelector('input[name="' + name + '"]:checked');
        if(checked) return String(checked.value || '').trim() || 'normal';
        const hidden = qbDoneCancelModalEl.querySelector('input[type="hidden"][name="' + name + '"]');
        return hidden ? (String(hidden.value || '').trim() || 'normal') : 'normal';
      };
      const reasonEl = qbDoneCancelModalEl.querySelector('#qbDoneCancelReason');
      const reason = reasonEl ? String(reasonEl.value || '').trim() : '';

      const body = new URLSearchParams();
      body.set('action', 'cancel_done_apply');
      body.set('id', String(apptId));
      body.set('_csrf', csrf);
      body.set('target_status', qbNormalizeDoneCancelTarget((qbExternalCancelContext && qbExternalCancelContext.targetStatus) || qbDoneCancelTargetStatus));
      body.set('points_storno_mode', getMode('points_storno_mode'));
      if(qbExternalCancelContext && qbExternalCancelContext.pendingOnly) body.set('pending_only', '1');
      if(reason) body.set('reason', reason);
      try{ if(staffNotesEl) body.set('staff_notes', String(staffNotesEl.value || '')); }catch(_){ }
      try{ if(customerNotesEl) body.set('customer_notes', String(customerNotesEl.value || '')); }catch(_){ }

      const prevDisabled = !!(qbDoneCancelConfirmBtn && qbDoneCancelConfirmBtn.disabled);
      if(qbDoneCancelConfirmBtn) qbDoneCancelConfirmBtn.disabled = true;
      try{
        const res = await fetch('index.php?page=api_appointments', {
          method:'POST',
          headers:{'Content-Type':'application/x-www-form-urlencoded'},
          body
        });
        const data = await res.json();
        if(!data || !data.ok){
          notify((data && data.error) ? data.error : 'Errore annullamento', 'danger');
          return;
        }
        qbDoneCancelCommitted = true;
        try{ qbDoneCancelModal.hide(); }catch(_){ }
        if(!qbExternalCancelContext){
          try{
            const inst = bootstrap.Offcanvas.getOrCreateInstance(offcanvasEl);
            inst.hide();
          } catch(_){ }
        }
        const appliedTarget = qbNormalizeDoneCancelTarget((data && data.target_status) || (qbExternalCancelContext && qbExternalCancelContext.targetStatus) || qbDoneCancelTargetStatus);
        notify(appliedTarget === 'no_show' ? 'Prenotazione marcata No show' : 'Prenotazione annullata', 'success');
        try{
          if(Array.isArray(data.warnings) && data.warnings.length){
            for(const w of data.warnings){ if(w) notify(String(w), 'warning'); }
          }
        }catch(_){ }
        if(window.calendar && typeof window.calendar.refetchEvents === 'function'){
          window.calendar.refetchEvents();
        }
        if(qbExternalCancelContext && typeof qbExternalCancelContext.onSuccess === 'function'){
          try{ qbExternalCancelContext.onSuccess(data); }catch(_){ }
        }
      }catch(err){
        notify((err && err.message) ? err.message : 'Errore annullamento', 'danger');
      }finally{
        if(qbDoneCancelConfirmBtn) qbDoneCancelConfirmBtn.disabled = prevDisabled;
      }
    }

    function qbSetModeNew(){
      qbReloadPageOnSave = false;
      qbOriginalStatus = '';
      qbDoneCancelPreviewData = null;
      qbDoneCancelPreviewForId = '';
      qbDoneCancelPreviewLoading = false;
      qbDoneCancelTargetStatus = 'canceled';
      try{ if(form && form.dataset){ delete form.dataset.originalStatus; } }catch(_){ }
      try{ qbApplyStatusSelectConstraints('', 'scheduled'); }catch(_){ }
      try{ qbApplyCancellationState(null); }catch(_){ }
      if(titleEl) titleEl.textContent = 'Nuova prenotazione';
      if(qbBookingCodeRow){ qbBookingCodeRow.style.display = 'none'; }
      if(qbBookingCode){ qbBookingCode.textContent = ''; }
      qbSetExpiredLinkedAlert('');
      if(submitTextEl){
        submitTextEl.textContent = 'Crea prenotazione';
        submitTextEl.dataset.qbLockText = 'Crea prenotazione';
      }
      if(submitBtn) submitBtn.disabled = false;
      if(deleteBtn) deleteBtn.style.display = 'none';
      if(apptIdEl) apptIdEl.value = '';
      qbResetResidualRedeemState();
      qbEditingId = '';
      try{ if(form) delete form.dataset.editingId; }catch(_){ }
      // IMPORTANT: never carry over multi-service maps when starting a new booking.
      // Stale values here can force an explicit cabin for a segment and cause
      // false "Cabina selezionata occupata" errors even when Auto is selected.
      if(staffMapInput) staffMapInput.value = '';
      if(cabinMapInput) cabinMapInput.value = '';
      if(form) delete form.dataset.segmentView;
      if(segmentAlertEl){ segmentAlertEl.style.display = 'none'; segmentAlertEl.textContent = ''; }
    }

    function qbSetModeEdit(id){
      qbOriginalStatus = '';
      qbDoneCancelPreviewData = null;
      qbDoneCancelPreviewForId = '';
      qbDoneCancelPreviewLoading = false;
      qbDoneCancelTargetStatus = 'canceled';
      try{ if(form && form.dataset){ delete form.dataset.originalStatus; } }catch(_){ }
      try{ qbApplyStatusSelectConstraints('', 'scheduled'); }catch(_){ }
      try{ qbApplyCancellationState(null); }catch(_){ }
      if(titleEl) titleEl.textContent = 'Modifica prenotazione';
      // Will be populated after loading the appointment
      if(qbBookingCodeRow){ qbBookingCodeRow.style.display = 'none'; }
      if(qbBookingCode){ qbBookingCode.textContent = ''; }
      qbSetExpiredLinkedAlert('');
      if(submitTextEl){
        submitTextEl.textContent = 'Modifica prenotazione';
        submitTextEl.dataset.qbLockText = 'Modifica prenotazione';
      }
      if(submitBtn) submitBtn.disabled = false;
      if(deleteBtn) deleteBtn.style.display = 'block';
      if(apptIdEl) apptIdEl.value = String(id||'');
      qbEditingId = String(id||'');
      try{ if(form) form.dataset.editingId = qbEditingId; }catch(_){ }
      if(form) delete form.dataset.segmentView;
      if(segmentAlertEl){ segmentAlertEl.style.display = 'none'; segmentAlertEl.textContent = ''; }
    }

    function qbResetForm(){
      // Reset native form fields first (prevents stale values from sticking)
      try{ form.reset(); }catch(_){ }
      try{ if(form) delete form.dataset.segmentView; }catch(_){ }
      try{ qbRemoveVirtualSnapshotServices(); }catch(_){ }

      // Reset services
      {
        const checks = getAllServiceChecks();
        for(const ch of checks) {
          try { qbRestoreServiceMasterData(ch); } catch (_) {}
          ch.checked = false;
        }
        syncHiddenServiceInputs();
        renderPills();
        if(qbDiscountType) qbDiscountType.value = '';
        if(qbDiscountValue) qbDiscountValue.value = '';
        qbClearCouponState({ keepInput:false });
        if(qbCouponBox) qbCouponBox.classList.add('d-none');
        qbResetFidelityState();
        qbResetCbState && qbResetCbState();
        qbResetResidualRedeemState();
        renderPriceDetails();
        applyServiceSearchFilter('');
      }
      if(serviceSearch) serviceSearch.value = '';

      // Always default to today (never blank)
      try{
        const now = new Date();
        const pad = n => String(n).padStart(2,'0');
        const d = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
        if(qbDate) qbDate.value = d;
      } catch(_){ if(qbDate) qbDate.value = ''; }

      // Clear times (user can pick from calendar / availability)
      if(qbStartTime) qbStartTime.value = '';
      if(qbEndTime) qbEndTime.value = '';
      if(starts) starts.value = '';
      if(ends) ends.value = '';
      qbReleaseAvailabilityHold();

      qbAvailConfirmed = false;
      qbAvailApplying = false;

      // Reset cabins
      if(cabinSel){
        setCabinSelectPlaceholder('Seleziona prima la disponibilità…');
        cabinSel.disabled = true;
        qbSetCabinFieldMuted(true);
      }
      if(cabinHintEl){
        cabinHintEl.textContent = 'Se sono libere più cabine potrai scegliere; se è libera solo una verrà selezionata automaticamente.';
      }

      // Clear staff selection so it doesn't carry over from previous appointment
      try{
        if(staffSel) staffSel.value = '';
        setMultiStaffMode(false);
        // rebuild list without preserving the previous selection
        refreshStaffForService('', '');
        qbUpdateDateAvailabilityGate();
      } catch(_){ }


      // reset cliente
      qbShowNew();
      qbSetModeNew();
      if(qbBookingCodeRow){ qbBookingCodeRow.style.display = 'none'; }
      if(qbBookingCode){ qbBookingCode.textContent = ''; }
      qbSetExpiredLinkedAlert('');
      qbResetFidelityState();
      qbResetCbState && qbResetCbState();
      qbOriginalStatus = '';
      qbDoneCancelPreviewData = null;
      qbDoneCancelPreviewForId = '';
      qbDoneCancelPreviewLoading = false;
      qbDoneCancelCommitted = false;
      qbDoneCancelTargetStatus = 'canceled';
      qbExternalCancelContext = null;
      try{ qbApplyStatusSelectConstraints('', 'scheduled'); }catch(_){ if(statusSel) statusSel.value = 'scheduled'; }
    }

    // Important: when the drawer is closed, always clear edit state.
    // This prevents the next "+prenotazione" from re-opening the last edited appointment.
    if(offcanvasEl){
      offcanvasEl.addEventListener('hidden.bs.offcanvas', function(){
        ++qbOpenReqId;
        qbStopHoldRenew();
        qbSetLoadReady();
        try{ qbClearPendingCalendarSlot(); }catch(_){ }
        try{ qbResetForm(); }catch(_){ }
      });
    }

    document.addEventListener('visibilitychange', ()=>{
      if(document.hidden) qbStopHoldRenew();
    });

    if(qbDoneCancelModalEl){
      qbDoneCancelModalEl.addEventListener('hidden.bs.modal', function(){
        const externalCtx = qbExternalCancelContext;
        if(!qbDoneCancelCommitted && !externalCtx){
          try{
            const fallbackStatus = qbNormStatus((form && form.dataset && form.dataset.originalStatus) ? form.dataset.originalStatus : qbOriginalStatus) || 'scheduled';
            if(statusSel) statusSel.value = fallbackStatus;
          }catch(_){ }
          try{ renderPriceDetails(); }catch(_){ }
        }
        qbExternalCancelContext = null;
      });
    }
    if(qbDoneCancelConfirmBtn){
      qbDoneCancelConfirmBtn.addEventListener('click', function(){
        qbSubmitDoneCancel();
      });
    }

    function openOffcanvas(){
      if(!offcanvasEl || !window.bootstrap) return;
      const inst = bootstrap.Offcanvas.getOrCreateInstance(offcanvasEl);
      inst.show();
    }

    if(qbLoadRetryBtn){
      qbLoadRetryBtn.addEventListener('click', function(){
        if(!qbLastOpenEditArgs) return;
        const args = qbLastOpenEditArgs;
        openEditAppointment(args.id, args.segmentId || null, args.opts || {});
      });
    }

    function qbSetSelected(c){
      // If we are creating a NEW booking (no qb_id yet), changing the client should
      // reset any previously applied Cb/Fidelity selections.
      try{
        const isNew = !qbId || !String(qbId.value || '').trim();
        if(isNew){
          qbResetCbState();
          qbCbTouched = false;
          // Best-effort reset for Fidelity (keeps UX consistent)
          if(qbFidelityPointsUse) qbFidelityPointsUse.value = '0';
          try{ qbFidelityClearChoice(); }catch(_){ }

          // Reset residual selections when switching client on a NEW booking.
          // This avoids carrying over omaggi / giftbox / pacchetti / prepagati
          // from a previously opened appointment into the new booking drawer.
          qbResetResidualRedeemState();
          try{ renderPills(); }catch(_){ }
          try{ renderPriceDetails(); }catch(_){ }
        }
      }catch(_){ }

      if(qbClientId) qbClientId.value = String(c.id || '');
      if(qbSelName) qbSelName.textContent = c.full_name || '';
      if(qbSelEmail) qbSelEmail.textContent = c.email ? c.email : '—';
      if(qbSelPhone) qbSelPhone.textContent = c.phone ? c.phone : '—';
      if(qbNewBox) qbNewBox.style.display = 'none';
      if(qbSelBox) qbSelBox.style.display = 'block';

      // Storico
      const cid = String(c.id || '').trim();
      if(cid) qbLoadClientHistory(cid);
      if(cid) qbLoadClientResiduals(cid);

      // Fidelity preview (auto)
      if(!qbIsHydrating){
        try{ qbRefreshFidelityThenRender(); }catch(_){ }
      }
    }

    function fmtDateTimeFromSql(dt, opts){
      const s = String(dt || '').trim();
      if(!s) return '';

      const options = (opts && typeof opts === 'object') ? opts : {};
      const endOfDay = !!options.endOfDay;

      // Parse SQL date/datetime in local time to avoid timezone shifts on date-only
      // strings (e.g. "YYYY-MM-DD" -> browser UTC parse -> 02:00 in Europe/Rome).
      // For expirations stored as pure dates, when requested we render the end of the
      // day (23:59) because the business rule treats them as valid for the whole date.
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
      let d = null;
      if(m){
        const y = parseInt(m[1], 10);
        const mo = parseInt(m[2], 10);
        const da = parseInt(m[3], 10);
        let hh = (m[4] !== undefined) ? parseInt(m[4], 10) : 0;
        let mm = (m[5] !== undefined) ? parseInt(m[5], 10) : 0;
        let ss = (m[6] !== undefined) ? parseInt(m[6], 10) : 0;

        const hasExplicitTime = (m[4] !== undefined && m[5] !== undefined);
        const isMidnight = hh === 0 && mm === 0 && ss === 0;
        if(endOfDay && (!hasExplicitTime || isMidnight)){
          hh = 23;
          mm = 59;
          ss = 0;
        }

        d = new Date(y, Math.max(0, mo - 1), da, hh, mm, ss);
      } else {
        const iso = s.includes('T') ? s : s.replace(' ', 'T');
        d = new Date(iso);
      }

      if(!(d instanceof Date) || String(d) === 'Invalid Date') return s;
      try{
        return d.toLocaleString('it-IT', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
      } catch(_){
        return s;
      }
    }

    function statusLabel(st){
      const s = qbNormalizeAppointmentStatus(st);
      switch(s){
        case 'pending': return 'In attesa';
        case 'scheduled': return 'Prenotato';
        case 'done': return 'Eseguito';
        case 'canceled': return 'Annullato';
        case 'no_show': return 'No show';
        case 'rejected': return 'Annullato';
        // GiftBox / GiftCard statuses (best-effort)
        case 'issued': return 'Emessa';
        case 'active': return 'Attiva';
        case 'redeemed': return 'Riscattata';
        case 'expired': return 'Scaduta';
        case 'void': return 'Annullata';
        default: return st || '';
      }
    }

    function statusBadgeClass(st){
      const s = qbNormalizeAppointmentStatus(st);
      if(s==='done') return 'text-bg-success';
      if(s==='pending') return 'text-bg-warning';
      if(s==='scheduled') return 'text-bg-primary';
      if(s==='canceled') return 'text-bg-secondary';
      if(s==='no_show') return 'text-bg-dark';
      return 'text-bg-secondary';
    }

    let qbHistoryReqId = 0;
    async function qbLoadClientHistory(clientId){
      if(!qbHistoryBox) return;
      const myReq = ++qbHistoryReqId;

      qbHistoryBox.style.display = 'block';
      if(qbHistorySummary) qbHistorySummary.innerHTML = appInlineLoadingHtml('Caricamento...', 'small p-0');
      if(qbHistoryList) qbHistoryList.innerHTML = '';

      // Link "Apri scheda" (apre popup)
      if(qbHistoryOpen){
        qbHistoryOpen.dataset.clientId = String(clientId);
        qbHistoryOpen.href = 'index.php?page=clients&action=view&id=' + encodeURIComponent(String(clientId));
      }

      try{
        // Backend quick booking: carica solo il riepilogo (nessuna lista appuntamenti nel drawer)
        const res = await fetch('index.php?page=api_clients&action=history&client_id=' + encodeURIComponent(String(clientId)) + '&limit=0');
        const data = await res.json();
        if(myReq !== qbHistoryReqId) return; // stale
        if(!data || !data.ok){
          if(qbHistorySummary) qbHistorySummary.textContent = 'Storico non disponibile.';
          return;
        }

        const sum = data.summary || {};
        const total = Number(sum.total || 0);
        const last = sum.last_visit ? fmtDateTimeFromSql(sum.last_visit) : '—';
        const next = sum.next_visit ? fmtDateTimeFromSql(sum.next_visit) : '—';

        const salesTot = Number(sum.sales_total || 0);
        const parts = [
          `Appuntamenti: ${total}`,
          `Ultimo: ${last}`,
          `Prossimo: ${next}`,
        ];
        if(Number.isFinite(salesTot) && salesTot > 0){
          parts.push(`Vendite: ${fmtEUR(salesTot)}`);
        }
        if(qbHistorySummary) qbHistorySummary.textContent = parts.join(' • ');

        // La lista appuntamenti non viene mostrata nel drawer (solo riepilogo).
        if(qbHistoryList) qbHistoryList.innerHTML = '';
      } catch(err){
        if(myReq !== qbHistoryReqId) return;
        if(qbHistorySummary) qbHistorySummary.textContent = 'Errore nel caricamento storico.';
      }
    }
    let qbResidualsReqId = 0;
    async function qbLoadClientResiduals(clientId){
      if(!qbResidualsBox) return;
      const myReq = ++qbResidualsReqId;

      qbResidualsBox.style.display = 'block';
      if(qbResidualsList) qbResidualsList.innerHTML = appInlineLoadingHtml('Caricamento...', 'small p-0');

      // Link "Apri scheda" (apre popup dettagli residui)
      if(qbResidualsOpen){
        qbResidualsOpen.dataset.clientId = String(clientId);
        qbResidualsOpen.href = '#';
        qbResidualsOpen.style.display = '';
      }

      try{
        // Per evitare liste molto lunghe nel drawer, qui carichiamo SOLO un riepilogo
        // (tipi e conteggio). I dettagli sono disponibili cliccando "Apri scheda".
        const locId = locationSel ? String(locationSel.value || '').trim() : '';
        let residualsUrl = 'index.php?page=api_clients&action=residuals&client_id=' + encodeURIComponent(String(clientId)) + '&summary=1';
        if(locId) residualsUrl += '&location_id=' + encodeURIComponent(locId);
        const res = await fetch(residualsUrl, {credentials:'same-origin'});
        const data = await res.json();
        if(myReq !== qbResidualsReqId) return; // stale

        if(!data || !data.ok){
          if(qbResidualsList) qbResidualsList.innerHTML = '<div class="text-danger small">Residui non disponibili.</div>';
          return;
        }

        const ps = Number(data.services_count ?? data.services ?? 0);
        const og = Number(data.gifts_count ?? data.gifts ?? 0);
        const gb = Number(data.giftboxes_count ?? data.giftboxes ?? 0);
        const gc = Number(data.giftcards_count ?? data.giftcards ?? 0);
        const pk = Number(data.packages_count ?? data.packages ?? 0);
        const cr = Number(data.credit_count ?? 0);
        const crAvail = Number(data.credit_available ?? 0);
        const total = (Number.isFinite(ps)?ps:0) + (Number.isFinite(og)?og:0) + (Number.isFinite(gb)?gb:0) + (Number.isFinite(gc)?gc:0) + (Number.isFinite(pk)?pk:0) + (Number.isFinite(cr)?cr:0);

        if(!qbResidualsList) return;

        if(!total){
          qbResidualsList.innerHTML = '<div class="text-muted">Nessun residuo disponibile.</div>';
          if(qbResidualsOpen) qbResidualsOpen.style.display = 'none';
          return;
        }

        const badges = [];
        if(ps > 0) badges.push(`<span class="badge badge-soft">Servizi (${escHtml(String(ps))})</span>`);
        if(og > 0) badges.push(`<span class="badge badge-soft">Omaggi (${escHtml(String(og))})</span>`);
        if(gb > 0) badges.push(`<span class="badge badge-soft">GiftBox (${escHtml(String(gb))})</span>`);
        if(gc > 0) badges.push(`<span class="badge badge-soft">GiftCard (${escHtml(String(gc))})</span>`);
        if(pk > 0) badges.push(`<span class="badge badge-soft">Pacchetti (${escHtml(String(pk))})</span>`);
        if(cr > 0) badges.push(`<span class="badge badge-soft">Credito (${escHtml(fmtEUR(crAvail))})</span>`);

        qbResidualsList.innerHTML = `
          <div class="text-muted small">Questo cliente ha residui:</div>
          <div class="d-flex flex-wrap gap-2 mt-1">${badges.join('')}</div>
          <div class="text-muted small mt-2">Apri la scheda per vedere i dettagli.</div>
        `;
        if(qbResidualsOpen) qbResidualsOpen.style.display = '';
      } catch(err){
        if(myReq !== qbResidualsReqId) return;
        if(qbResidualsList) qbResidualsList.innerHTML = '<div class="text-danger small">Errore nel caricamento residui.</div>';
        if(qbResidualsOpen) qbResidualsOpen.style.display = 'none';
      }
    }

    function qbClientCreateSetError(message){
      if(!qbCreateAlert) return;
      const msg = String(message || '').trim();
      qbCreateAlert.textContent = msg;
      qbCreateAlert.classList.toggle('d-none', !msg);
    }

    function qbClientCreateSetSaving(saving){
      if(qbCreateSubmit) qbCreateSubmit.disabled = !!saving;
      if(qbCreateSpinner) qbCreateSpinner.classList.toggle('d-none', !saving);
      if(qbCreateSubmitText) qbCreateSubmitText.textContent = saving ? 'Salvataggio...' : 'Salva cliente';
    }

    function qbOpenClientCreate(){
      if(!qbCreateModal || !qbCreateForm) return;
      try{ qbCreateForm.reset(); }catch(_){ }
      qbClientCreateSetError('');
      qbClientCreateSetSaving(false);
      qbCreateModal.show();
      setTimeout(()=>{
        try{
          const first = qbCreateForm.querySelector('[name="first_name"]');
          first && first.focus();
        }catch(_){}
      }, 150);
    }

    async function qbSubmitClientCreate(e){
      if(e) e.preventDefault();
      if(!qbCreateForm) return;
      qbClientCreateSetError('');
      const body = new URLSearchParams();
      try{
        const fd = new FormData(qbCreateForm);
        for(const [k,v] of fd.entries()) body.append(k, v);
      }catch(_){ }
      body.set('action', 'create_quick');
      if(csrf) body.set('_csrf', csrf);

      qbClientCreateSetSaving(true);
      try{
        const res = await fetch('index.php?page=api_clients', {
          method:'POST',
          headers:{'Content-Type':'application/x-www-form-urlencoded', 'Accept':'application/json'},
          credentials:'same-origin',
          body
        });
        const data = await res.json();
        if(!data || !data.ok){
          qbClientCreateSetError((data && data.error) ? data.error : 'Errore creazione cliente.');
          return;
        }
        qbSetSelected(data.client || {});
        try{ qbCreateModal && qbCreateModal.hide(); }catch(_){ }
        notify('Cliente creato', 'success');
      }catch(err){
        qbClientCreateSetError((err && err.message) ? err.message : 'Errore creazione cliente.');
      }finally{
        qbClientCreateSetSaving(false);
      }
    }

    on(qbLinkNew, 'click', (e)=>{ e.preventDefault(); qbOpenClientCreate(); });
    on(qbCreateForm, 'submit', qbSubmitClientCreate);
    on(qbClearSel, 'click', (e)=>{ e.preventDefault(); qbShowNew(); });

    // Apri scheda cliente in popup (iframe)
    on(qbHistoryOpen, 'click', (e)=>{
      e.preventDefault();
      const cid = (qbHistoryOpen && qbHistoryOpen.dataset ? qbHistoryOpen.dataset.clientId : '') || (qbClientId ? qbClientId.value : '');
      if(cid){
        qbOpenClientCard(cid);
        return;
      }
      // fallback: apri link normale
      try{ if(qbHistoryOpen && qbHistoryOpen.href) window.open(qbHistoryOpen.href, '_blank', 'noopener'); }catch(_){ }
    });

    
    // Apri scheda cliente (Residui) in popup (iframe)
    on(qbResidualsOpen, 'click', (e)=>{
      e.preventDefault();
      const cid = (qbResidualsOpen && qbResidualsOpen.dataset ? qbResidualsOpen.dataset.clientId : '') || (qbClientId ? qbClientId.value : '');
      if(cid){
        qbOpenClientResiduals(cid);
        return;
      }
      // fallback: apri link normale
      try{ if(qbResidualsOpen && qbResidualsOpen.href) window.open(qbResidualsOpen.href, '_blank', 'noopener'); }catch(_){ }
    });

on(qbLinkFind, 'click', (e)=>{
      e.preventDefault();
      if(!qbFindModal) return;
      // reset
      if(qbFindResults) qbFindResults.innerHTML = '';
      if(qbFindQuery) qbFindQuery.value = '';
      qbFindModal.show();
      setTimeout(()=>{ try{ qbFindQuery && qbFindQuery.focus(); }catch(_){} }, 150);
    });

    function renderClients(list){
      if(!qbFindResults) return;
      if(!list || !list.length){
        qbFindResults.innerHTML = '<div class="text-muted small p-2">Nessun risultato.</div>';
        return;
      }
      qbFindResults.innerHTML = list.map(c => {
        const esc = s => String(s||'').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m]||m));
        return `
          <button type="button" class="list-group-item list-group-item-action" data-id="${esc(c.id)}" data-name="${esc(c.full_name)}" data-email="${esc(c.email)}" data-phone="${esc(c.phone)}">
            <div class="fw-semibold text-primary">${esc(c.full_name)}</div>
            <div class="small text-muted">Email: ${esc(c.email)||'—'}</div>
            <div class="small text-muted">Telefono: ${esc(c.phone)||'—'}</div>
          </button>`;
      }).join('');
    }

    let qbTimer = null;
    on(qbFindQuery, 'input', ()=>{
      const q = (qbFindQuery.value||'').trim();
      if(qbTimer) clearTimeout(qbTimer);
      qbTimer = setTimeout(async ()=>{
        if(!q){ renderClients([]); return; }
        try{
          const res = await fetch('index.php?page=api_clients&action=search&exclude_blocked=1&q=' + encodeURIComponent(q));
          const data = await res.json();
          if(!data.ok){ renderClients([]); return; }
          renderClients(data.clients || []);
        } catch(err){ renderClients([]); }
      }, 200);
    });

    on(qbFindClear, 'click', ()=>{
      if(qbFindQuery) qbFindQuery.value = '';
      if(qbFindResults) qbFindResults.innerHTML = '';
      try{ qbFindQuery && qbFindQuery.focus(); }catch(_){}
    });

    on(qbFindResults, 'click', (e)=>{
      const btn = e.target.closest('[data-id]');
      if(!btn) return;
      const c = {
        id: btn.dataset.id,
        full_name: btn.dataset.name,
        email: btn.dataset.email,
        phone: btn.dataset.phone
      };
      qbSetSelected(c);
      try{ qbFindModal && qbFindModal.hide(); }catch(_){}
    });


    function addMinutes(dtLocal, minutes){
      // dtLocal: YYYY-MM-DDTHH:MM
      if(!dtLocal) return '';
      const d = new Date(dtLocal);
      if(String(d) === 'Invalid Date') return '';
      d.setMinutes(d.getMinutes() + minutes);
      const pad = n => String(n).padStart(2,'0');
      const y = d.getFullYear();
      const m = pad(d.getMonth()+1);
      const da = pad(d.getDate());
      const h = pad(d.getHours());
      const mi = pad(d.getMinutes());
      return `${y}-${m}-${da}T${h}:${mi}`;
    }

    function makeDtLocal(dateStr, timeStr){
      const d = String(dateStr||'').trim();
      const t = String(timeStr||'').trim();
      if(!d || !t) return '';
      return `${d}T${t}`;
    }

    function splitDtLocal(dtLocal){
      const s = String(dtLocal||'');
      if(!s || !s.includes('T')) return { date:'', time:'' };
      const [d,t] = s.split('T');
      return { date:d||'', time:(t||'').slice(0,5) };
    }

    // (helpers above are enough: makeDtLocal + splitDtLocal)

    function getSelectedServiceIds(){
  const checks = getAllServiceChecks();
  const fromChecks = checks.filter(ch => ch.checked).map(ch => String(ch.value)).filter(Boolean);
  if(fromChecks.length) return fromChecks;

  // Fallback: some views pre-fill the selected services via hidden inputs (e.g. calendar quick-create / segment view)
  try{
    if(form){
      const hidden = Array.from(form.querySelectorAll('input[name="service_ids[]"]'))
        .map(el => String(el.value || '').trim()).filter(Boolean);
      if(hidden.length) return hidden;

      const single = form.querySelector('input[name="service_id"]') || form.querySelector('select[name="service_id"]');
      if(single && single.value) return [String(single.value)];
    }
  } catch(_){}

  return [];
}

    // --- Residui (GiftBox / Pacchetti): servizi già pagati ---
    // Quando un servizio viene aggiunto dalla sezione "Residui" (GiftBox/Pacchetti),
    // in prenotazione deve risultare a costo 0 (nessun importo da pagare).
    // Usiamo queste utility sia per il calcolo dei prezzi (Dettaglio prezzi) sia
    // per escludere tali servizi da promo/fidelity/cb preview.
    function qbGetPrepaidServiceBadgeMap(){
      const map = new Map();
      try{
        const og = qbReadGiftRedeem();
        for(const it of (Array.isArray(og) ? og : [])){
          const sid = parseInt(String(it?.service_id ?? it?.serviceId ?? ''), 10);
          if(!Number.isFinite(sid) || sid <= 0) continue;
          const key = String(sid);
          if(!map.has(key)) map.set(key, 'gift');
        }
      }catch(_){ }
      try{
        const ps = qbReadPrepaidServiceRedeem();
        for(const it of (Array.isArray(ps) ? ps : [])){
          const sid = parseInt(String(it?.service_id ?? it?.serviceId ?? ''), 10);
          if(!Number.isFinite(sid) || sid <= 0) continue;
          const key = String(sid);
          if(!map.has(key)) map.set(key, 'Servizio');
        }
      }catch(_){ }
      try{
        const gb = qbReadGiftboxRedeem();
        for(const it of (Array.isArray(gb) ? gb : [])){
          const sid = parseInt(String(it?.service_id ?? it?.serviceId ?? ''), 10);
          if(!Number.isFinite(sid) || sid <= 0) continue;
          const key = String(sid);
          if(!map.has(key)) map.set(key, 'GiftBox');
        }
      }catch(_){ }
      try{
        const pk = qbReadPackageRedeem();
        for(const it of (Array.isArray(pk) ? pk : [])){
          const sid = parseInt(String(it?.service_id ?? it?.serviceId ?? ''), 10);
          if(!Number.isFinite(sid) || sid <= 0) continue;
          const key = String(sid);
          if(!map.has(key)) map.set(key, 'Pacchetto');
        }
      }catch(_){ }
      return map;
    }

    function getSelectedPayableServiceIds(){
      const ids = getSelectedServiceIds();
      if(!ids.length) return [];
      const prepaid = qbGetPrepaidServiceBadgeMap();
      if(!prepaid.size) return ids;
      return ids.filter(id => !prepaid.has(String(id)));
    }

    // --- Gate: l'operatore deve essere selezionato prima di scegliere la data / vedere la disponibilità ---
    function qbParseStaffMap(){
      if(!staffMapInput) return {};
      const v = String(staffMapInput.value || '').trim();
      if(!v) return {};
      try{
        const obj = JSON.parse(v);
        return (obj && typeof obj === 'object') ? obj : {};
      } catch(_){
        return {};
      }
    }

function qbParseCabinMap(){
  if(!cabinMapInput) return {};
  const v = String(cabinMapInput.value || '').trim();
  if(!v) return {};
  try{
    const obj = JSON.parse(v);
    return (obj && typeof obj === 'object') ? obj : {};
  } catch(_){
    return {};
  }
}

// Backward-compat alias (segment cabins): older code used readCabinMapValue()
function readCabinMapValue(){
  return qbParseCabinMap();
}


function syncCabinMapFromPicker(){
  if(!cabinMapInput) return;
  const isSegmentView = !!(form && form.dataset.segmentView === '1');
  if(isSegmentView) { cabinMapInput.value = ''; return; }

  const map = {};
  const sels = Array.from(document.querySelectorAll('.qb-cabin-for-service'));
  for(const sel of sels){
    const sid = sel.getAttribute('data-service-id');
    if(!sid) continue;
    const v = String(sel.value || '').trim();
    const n = Number(v);
    if(n && n > 0) map[sid] = String(n);
  }
  cabinMapInput.value = Object.keys(map).length ? JSON.stringify(map) : '';
}

function getServiceDurationMinutes(serviceId){
  const sid = String(serviceId || '').trim();
  if(!sid) return 0;
  const ch = document.querySelector('.qb_service_check[value="' + sid + '"]');
  if(!ch) return 0;
  const d = Number(ch.getAttribute('data-dur') || ch.getAttribute('data-duration') || ch.dataset.dur || ch.dataset.duration || 0);
  return isFinite(d) ? d : 0;
}

function computeSelectedServiceSegments(){
  const ids = getSelectedServiceIds();
  const s = (starts && starts.value) ? String(starts.value).trim() : '';
  if(!ids.length || !s) return [];
  let cursor = s;
  const segs = [];
  for(const sid of ids){
    const dur = Math.max(5, Number(getServiceDurationMinutes(sid) || 0));
    const segStart = cursor;
    const segEnd = addMinutes(cursor, dur);
    segs.push({ service_id: String(sid), starts_at: segStart, ends_at: segEnd, duration_min: dur });
    cursor = segEnd;
  }
  return segs;
}

    function qbIsOperatorSelectionComplete(){
      const ids = getSelectedServiceIds();
      if(!ids.length) return false;

      const isSegmentView = !!(form && form.dataset.segmentView === '1');
      // Multi-servizio: non basiamoci sulla visibilità del picker (può essere in race con renderMultiStaffPicker)
      // ma sul numero di servizi selezionati.
      const isMulti = (!isSegmentView && getSelectedServiceIds().length > 1);

      if(isMulti){
        const map = qbParseStaffMap();
        for(const sid of ids){
          const v = map[sid];
          if(!v || String(v).trim() === '') return false;
        }
        return true;
      }

      const v = staffSel ? String(staffSel.value || '').trim() : '';
      if(v) return true;

      // Single-service bookings can intentionally use "(qualsiasi)": the
      // backend will assign the first compatible free operator for the slot.
      if(!staffSel || staffSel.disabled) return false;
      const hasSelectableStaff = Array.from(staffSel.options || []).some(o => {
        return String(o.value || '').trim() !== '' && !o.disabled;
      });
      return hasSelectableStaff;
    }

    function qbUpdateDateAvailabilityGate(options){
      const opts = Object.assign({ schedulePendingCalendarSlot: true }, options || {});
      if(!qbDate) return;
      const btn = qs('#qbAvailabilityBtn');
      if(!btn) return;

      const ids = getSelectedServiceIds();
      const hasServices = ids.length > 0;
      const ok = hasServices && qbIsOperatorSelectionComplete();
      const busy = !!qbAvailApplying;

      qbDate.disabled = !ok;
      btn.disabled = !ok || busy;

      const msg = !hasServices ? 'Seleziona prima un servizio' : 'Nessun operatore disponibile per il servizio selezionato';
      if(!ok){
        qbDate.setAttribute('title', msg);
        btn.setAttribute('title', msg);
      } else {
        qbDate.removeAttribute('title');
        if(busy){
          btn.setAttribute('title', 'Verifica disponibilita in corso');
        } else {
          btn.removeAttribute('title');
        }
      }
      try{ btn.setAttribute('aria-busy', busy ? 'true' : 'false'); }catch(_){ }
      try{ if(opts.schedulePendingCalendarSlot && !busy) qbSchedulePendingCalendarSlotApply(90); }catch(_){ }
    }


function getTotalDuration(){
  const checks = getAllServiceChecks();
  let tot = 0;
  for(const ch of checks){
    if(!ch.checked) continue;
    const d = parseInt(ch?.dataset?.dur || ch?.dataset?.duration || ch?.getAttribute?.('data-dur') || ch?.getAttribute?.('data-duration') || '0', 10);
    if(!Number.isNaN(d)) tot += d;
  }
  return tot;
}


function qbRememberServiceMasterData(ch){
  if(!ch) return;
  try{
    if(ch.dataset.masterName === undefined){
      ch.dataset.masterName = String(ch.dataset.name || ch.getAttribute('data-name') || '');
    }
    if(ch.dataset.masterDur === undefined){
      const dur0 = ch.getAttribute('data-dur') || ch.getAttribute('data-duration') || ch.dataset.dur || ch.dataset.duration || '';
      ch.dataset.masterDur = String(dur0 || '');
    }
    if(ch.dataset.masterPrice === undefined){
      ch.dataset.masterPrice = String(ch.dataset.price || ch.getAttribute('data-price') || '');
    }

    const item = ch.closest('.qb-ms-item');
    if(item){
      const nameEl = item.querySelector('.qb-ms-item-name');
      const metaEl = item.querySelector('.qb-ms-item-meta');
      if(item.dataset.masterFilterName === undefined){
        item.dataset.masterFilterName = String(item.getAttribute('data-name') || '');
      }
      if(item.dataset.masterLabelName === undefined){
        item.dataset.masterLabelName = nameEl ? String(nameEl.textContent || '').trim() : '';
      }
      if(item.dataset.masterLabelMeta === undefined){
        item.dataset.masterLabelMeta = metaEl ? String(metaEl.textContent || '').trim() : '';
      }
    }
  }catch(_){ }
}

function qbUpdateServiceCheckboxUi(ch, name, durationMin){
  if(!ch) return;
  try{
    const item = ch.closest('.qb-ms-item');
    if(!item) return;

    const nameEl = item.querySelector('.qb-ms-item-name');
    const metaEl = item.querySelector('.qb-ms-item-meta');
    const snapName = String(name || '').trim();
    if(snapName){
      if(nameEl) nameEl.textContent = snapName;
      item.setAttribute('data-name', snapName.toLowerCase());
    }

    const dur = parseInt(String(durationMin ?? ''), 10);
    if(metaEl){
      if(Number.isFinite(dur) && dur > 0){
        metaEl.textContent = '• ' + String(dur) + ' min';
      } else if(item.dataset.masterLabelMeta !== undefined) {
        metaEl.textContent = String(item.dataset.masterLabelMeta || '');
      }
    }
  }catch(_){ }
}

function qbRestoreServiceMasterData(ch){
  if(!ch) return;
  qbRememberServiceMasterData(ch);
  try{
    const masterName = String(ch.dataset.masterName || '');
    if(masterName){
      ch.dataset.name = masterName;
      ch.setAttribute('data-name', masterName);
    } else {
      delete ch.dataset.name;
      ch.removeAttribute('data-name');
    }

    const masterDur = String(ch.dataset.masterDur || '');
    ch.dataset.dur = masterDur;
    ch.dataset.duration = masterDur;
    if(masterDur){
      ch.setAttribute('data-dur', masterDur);
      ch.setAttribute('data-duration', masterDur);
    } else {
      ch.removeAttribute('data-dur');
      ch.removeAttribute('data-duration');
    }

    const masterPrice = String(ch.dataset.masterPrice || '');
    if(masterPrice){
      ch.dataset.price = masterPrice;
      ch.setAttribute('data-price', masterPrice);
    } else {
      delete ch.dataset.price;
      ch.removeAttribute('data-price');
    }

    delete ch.dataset.bookedPrice;
    delete ch.dataset.listPrice;
    delete ch.dataset.discountBadge;

    const item = ch.closest('.qb-ms-item');
    if(item){
      const masterFilterName = String(item.dataset.masterFilterName || '');
      if(masterFilterName){
        item.setAttribute('data-name', masterFilterName);
      } else {
        item.removeAttribute('data-name');
      }

      const nameEl = item.querySelector('.qb-ms-item-name');
      if(nameEl && item.dataset.masterLabelName !== undefined){
        nameEl.textContent = String(item.dataset.masterLabelName || '');
      }

      const metaEl = item.querySelector('.qb-ms-item-meta');
      if(metaEl && item.dataset.masterLabelMeta !== undefined){
        metaEl.textContent = String(item.dataset.masterLabelMeta || '');
      }
    }
  }catch(_){ }
}

function qbApplyServiceSnapshotLine(ch, line){
  if(!ch || !line) return;
  qbRememberServiceMasterData(ch);
  try{
    const snapName = String(line.name ?? line.service_name ?? '').trim();
    if(snapName){
      ch.dataset.name = snapName;
      ch.setAttribute('data-name', snapName);
    }

    const snapDur = parseInt(String(line.duration_min ?? line.duration ?? line.duration_minutes ?? ''), 10);
    if(Number.isFinite(snapDur) && snapDur > 0){
      ch.dataset.dur = String(snapDur);
      ch.dataset.duration = String(snapDur);
      ch.setAttribute('data-dur', String(snapDur));
      ch.setAttribute('data-duration', String(snapDur));
    }

    const bp = parseFloat(String(line.price != null ? line.price : (line.booked_price != null ? line.booked_price : '')));
    const lp = parseFloat(String(line.list_price != null ? line.list_price : ''));
    const badge = (line.discount_badge != null ? String(line.discount_badge) : (line.badge != null ? String(line.badge) : '')).trim();
    const snapActive = (line.snapshot_is_active != null ? Number(line.snapshot_is_active) : (line.is_active != null ? Number(line.is_active) : NaN));
    const currentActive = (line.current_is_active != null ? Number(line.current_is_active) : NaN);
    const isNoOp = !!(line.no_operator === true || Number(line.no_operator || 0) === 1);

    if(Number.isFinite(bp)) ch.dataset.bookedPrice = String(bp);
    else delete ch.dataset.bookedPrice;

    if(Number.isFinite(lp)) ch.dataset.listPrice = String(lp);
    else delete ch.dataset.listPrice;

    if(badge) ch.dataset.discountBadge = badge;
    else delete ch.dataset.discountBadge;

    ch.dataset.noop = isNoOp ? '1' : '0';
    if(Number.isFinite(snapActive)) ch.dataset.snapshotIsActive = String(snapActive > 0 ? 1 : 0);
    else delete ch.dataset.snapshotIsActive;
    if(Number.isFinite(currentActive)) ch.dataset.currentActive = String(currentActive > 0 ? 1 : 0);
    else delete ch.dataset.currentActive;

    qbUpdateServiceCheckboxUi(ch, snapName, snapDur);

    const item = ch.closest('.qb-ms-item');
    const metaEl = item ? item.querySelector('.qb-ms-item-meta') : null;
    if(metaEl){
      const metaParts = [];
      if(Number.isFinite(snapDur) && snapDur > 0) metaParts.push(String(snapDur) + ' min');
      const showStateMeta = !!(item && item.dataset.snapshotOnly === '1')
        || (Number.isFinite(currentActive) && currentActive === 0)
        || (Number.isFinite(snapActive) && snapActive === 0);
      if(showStateMeta){
        if(Number.isFinite(snapActive)) metaParts.push((snapActive > 0 ? 'attivo' : 'non attivo') + ' in prenotazione');
        if(Number.isFinite(currentActive) && currentActive === 0 && (!Number.isFinite(snapActive) || snapActive > 0)) {
          metaParts.push('ora disattivato');
        }
      }
      if(metaParts.length) metaEl.textContent = '• ' + metaParts.join(' • ');
    }
  }catch(_){ }
}

function qbRemoveVirtualSnapshotServices(){
  if(!msRoot) return;
  try{
    const items = Array.from(msRoot.querySelectorAll('.qb-ms-item[data-snapshot-only="1"]'));
    for(const it of items){
      try{ it.remove(); }catch(_){ }
    }
    const groups = Array.from(msRoot.querySelectorAll('.qb-ms-group[data-snapshot-group="1"]'));
    for(const g of groups){
      const hasItems = g.querySelector('.qb-ms-item');
      if(!hasItems){
        try{ g.remove(); }catch(_){ }
      }
    }
  }catch(_){ }
}

function qbEnsureServiceCheckForSnapshotLine(line){
  if(!msList || !line) return null;
  const sid = String(line.service_id != null ? line.service_id : (line.id != null ? line.id : '')).trim();
  if(!sid) return null;

  const existing = findServiceCheckById(sid);
  if(existing) return existing;

  const groupKey = 'snapshot-history';
  let group = msList.querySelector('.qb-ms-group[data-group="' + groupKey + '"]');
  if(!group){
    group = document.createElement('div');
    group.className = 'qb-ms-group';
    group.dataset.group = groupKey;
    group.dataset.snapshotGroup = '1';

    const title = document.createElement('div');
    title.className = 'qb-ms-group-title';
    title.textContent = 'Servizi storici';
    group.appendChild(title);
    msList.appendChild(group);
  }

  const label = document.createElement('label');
  label.className = 'qb-ms-item';
  label.dataset.snapshotOnly = '1';

  const snapName = String(line.name ?? line.service_name ?? ('Servizio #' + sid)).trim() || ('Servizio #' + sid);
  label.dataset.name = snapName.toLowerCase();
  label.setAttribute('data-name', snapName.toLowerCase());

  const ch = document.createElement('input');
  ch.className = 'form-check-input qb-ms-check me-2 qb_service_check';
  ch.type = 'checkbox';
  ch.value = sid;
  ch.dataset.id = sid;

  const snapDur = parseInt(String(line.duration_min ?? line.duration ?? line.duration_minutes ?? ''), 10);
  if(Number.isFinite(snapDur) && snapDur > 0){
    ch.dataset.dur = String(snapDur);
    ch.dataset.duration = String(snapDur);
    ch.setAttribute('data-dur', String(snapDur));
    ch.setAttribute('data-duration', String(snapDur));
  }

  const snapPrice = parseFloat(String(
    line.list_price != null ? line.list_price :
    (line.snapshot_price != null ? line.snapshot_price :
      (line.price != null ? line.price : ''))
  ));
  if(Number.isFinite(snapPrice)){
    ch.dataset.price = String(snapPrice);
    ch.setAttribute('data-price', String(snapPrice));
  }

  const isNoOp = !!(line.no_operator === true || Number(line.no_operator || 0) === 1);
  ch.dataset.noop = isNoOp ? '1' : '0';
  ch.dataset.name = snapName;
  ch.setAttribute('data-name', snapName);

  const snapActive = (line.snapshot_is_active != null ? Number(line.snapshot_is_active) : (line.is_active != null ? Number(line.is_active) : NaN));
  const currentActive = (line.current_is_active != null ? Number(line.current_is_active) : NaN);
  if(Number.isFinite(snapActive)) ch.dataset.snapshotIsActive = String(snapActive > 0 ? 1 : 0);
  if(Number.isFinite(currentActive)) ch.dataset.currentActive = String(currentActive > 0 ? 1 : 0);

  const nameEl = document.createElement('span');
  nameEl.className = 'qb-ms-item-name';
  nameEl.textContent = snapName;

  const metaEl = document.createElement('span');
  metaEl.className = 'qb-ms-item-meta text-muted small ms-1';
  const metaParts = [];
  if(Number.isFinite(snapDur) && snapDur > 0) metaParts.push(String(snapDur) + ' min');
  if(Number.isFinite(snapActive)) metaParts.push((snapActive > 0 ? 'attivo' : 'non attivo') + ' in prenotazione');
  if(Number.isFinite(currentActive) && currentActive === 0 && (!Number.isFinite(snapActive) || snapActive > 0)) {
    metaParts.push('ora disattivato');
  }
  metaEl.textContent = metaParts.length ? ('• ' + metaParts.join(' • ')) : '• storico';

  label.appendChild(ch);
  label.appendChild(nameEl);
  label.appendChild(metaEl);
  group.appendChild(label);

  try{ qbRememberServiceMasterData(ch); }catch(_){ }
  return ch;
}


function syncHiddenServiceInputs(){
  if(!hiddenIdsContainer) return;
  hiddenIdsContainer.innerHTML = '';
  const ids = getSelectedServiceIds();
  for(const id of ids){
    const i = document.createElement('input');
    i.type = 'hidden';
    i.name = 'service_ids[]';
    i.value = String(id);
    hiddenIdsContainer.appendChild(i);
  }
}

function renderPills(){
  if(!pillsEl || !placeholderEl) return;
  pillsEl.innerHTML = '';
  const checks = getAllServiceChecks().filter(ch => ch.checked);
  placeholderEl.hidden = checks.length > 0;

  // Servizi prepagati mapping => used to show traceability inside the "Servizi" field.
  const psBySvc = new Map();
  try{
    const ps = qbReadPrepaidServiceRedeem ? qbReadPrepaidServiceRedeem() : [];
    if(Array.isArray(ps)){
      for(const it of ps){
        if(!it) continue;
        const sid = String(it.service_id ?? '').trim();
        if(!sid) continue;
        psBySvc.set(sid, it);
      }
    }
  }catch(_){ }

  // Omaggi mapping => used to show traceability inside the "Servizi" field.
  const ogBySvc = new Map();
  try{
    const og = qbReadGiftRedeem ? qbReadGiftRedeem() : [];
    if(Array.isArray(og)){
      for(const it of og){
        if(!it) continue;
        const sid = String(it.service_id ?? '').trim();
        if(!sid) continue;
        ogBySvc.set(sid, it);
      }
    }
  }catch(_){ }

  // GiftBox mapping => used to show traceability inside the "Servizi" field
  // (services added from Residui/GiftBox are visually differentiated).
  const gbBySvc = new Map();
  try{
    const gb = qbReadGiftboxRedeem ? qbReadGiftboxRedeem() : [];
    if(Array.isArray(gb)){
      for(const it of gb){
        if(!it) continue;
        const sid = String(it.service_id ?? '').trim();
        if(!sid) continue;
        gbBySvc.set(sid, it);
      }
    }
  }catch(_){ }

  // Pacchetti mapping => used to show traceability inside the "Servizi" field
  // (services added from Residui/Pacchetti are visually differentiated).
  const pkBySvc = new Map();
  try{
    const pk = qbReadPackageRedeem ? qbReadPackageRedeem() : [];
    if(Array.isArray(pk)){
      for(const it of pk){
        if(!it) continue;
        const sid = String(it.service_id ?? '').trim();
        if(!sid) continue;
        pkBySvc.set(sid, it);
      }
    }
  }catch(_){ }

  for(const ch of checks){
    const sid = String(ch.value || '').trim();
    const name = ch.dataset.name || ch.getAttribute('data-name') || ch.value;

    const ps = sid ? psBySvc.get(sid) : null;
    const og = sid ? ogBySvc.get(sid) : null;
    const gb = sid ? gbBySvc.get(sid) : null;
    const pk = sid ? pkBySvc.get(sid) : null;
    const displayName = (ps && String(ps.service_name || '').trim()) ? String(ps.service_name || '').trim() : ((og && String(og.service_name || '').trim()) ? String(og.service_name || '').trim() : name);

    const pill = document.createElement('span');
    pill.className = 'badge bg-primary d-inline-flex align-items-center me-1 mb-1 qb-ms-pill';
    pill.dataset.serviceId = sid;
    pill.append(document.createTextNode(displayName));


    if(ps){
      // Mark pill as coming from a prepaid service so we can open the details popup on click.
      try{
        pill.dataset.prepaidServiceId = String(ps.client_prepaid_service_id ?? ps.prepaid_service_id ?? '').trim();
        pill.dataset.saleId = String(ps.sale_id ?? '').trim();
        pill.style.cursor = 'pointer';
        pill.setAttribute('role', 'button');
      }catch(_){ }

      const meta = document.createElement('span');
      meta.className = 'badge text-bg-light text-dark ms-2 qb-ms-pill-meta';

      const remRaw = (ps.remaining_qty !== undefined && ps.remaining_qty !== null) ? ps.remaining_qty : null;
      const totRaw = (ps.purchased_qty !== undefined && ps.purchased_qty !== null) ? ps.purchased_qty : null;
      const rem = (remRaw !== null && remRaw !== '' && !isNaN(parseInt(remRaw, 10))) ? parseInt(remRaw, 10) : null;
      const tot = (totRaw !== null && totRaw !== '' && !isNaN(parseInt(totRaw, 10))) ? parseInt(totRaw, 10) : null;
      const parts = ['Servizio'];
      if(tot !== null && tot > 0 && rem !== null && rem >= 0){
        parts.push(String(rem) + '/' + String(tot));
      }
      meta.textContent = parts.join(' ');

      const tipParts = ['Aggiunto da Servizio prepagato'];
      if(Number.isFinite(parseInt(String(ps.sale_id ?? ''), 10)) && parseInt(String(ps.sale_id ?? ''), 10) > 0) tipParts.push('Vendita #' + String(parseInt(String(ps.sale_id ?? ''), 10)));
      if(tot !== null && tot > 0 && rem !== null && rem >= 0) tipParts.push('Residuo ' + String(rem) + '/' + String(tot));
      meta.title = tipParts.join(' • ');

      pill.appendChild(meta);
    } else if(og){
      try{
        pill.dataset.ogInstanceId = String(og.instance_id ?? '').trim();
        pill.dataset.ogRewardItemIndex = String(og.reward_item_index ?? '').trim();
        pill.style.cursor = 'pointer';
        pill.setAttribute('role', 'button');
      }catch(_){ }

      const meta = document.createElement('span');
      meta.className = 'badge text-bg-light text-dark ms-2 qb-ms-pill-meta';
      const gname = String(og.gift_name ?? '').trim();
      const remRaw = (og.qty_remaining !== undefined && og.qty_remaining !== null) ? og.qty_remaining : null;
      const totRaw = (og.qty_total !== undefined && og.qty_total !== null) ? og.qty_total : null;
      const rem = (remRaw !== null && remRaw !== '' && !isNaN(parseInt(remRaw, 10))) ? parseInt(remRaw, 10) : null;
      const tot = (totRaw !== null && totRaw !== '' && !isNaN(parseInt(totRaw, 10))) ? parseInt(totRaw, 10) : null;
      const parts = ['gift'];
      if(tot !== null && tot > 0 && rem !== null && rem >= 0){
        parts.push(String(rem) + '/' + String(tot));
      } else {
        const q = (og.qty !== undefined && og.qty !== null && !isNaN(parseInt(og.qty, 10))) ? parseInt(og.qty, 10) : 1;
        if(q && q > 1) parts.push('x' + String(q));
      }
      meta.textContent = parts.join(' ');
      const tipParts = ['Aggiunto da gift'];
      if(gname) tipParts.push(gname);
      if(tot !== null && tot > 0 && rem !== null && rem >= 0) tipParts.push('Residuo ' + String(rem) + '/' + String(tot));
      meta.title = tipParts.join(' • ');
      pill.appendChild(meta);
    } else if(gb){
      // Mark pill as coming from GiftBox so we can open the details popup on click.
      try{
        pill.dataset.gbInstanceId = String(gb.instance_id ?? '').trim();
        pill.dataset.gbItemId = String(gb.giftbox_item_id ?? '').trim();
        pill.style.cursor = 'pointer';
        pill.setAttribute('role', 'button');
      }catch(_){ }

      const meta = document.createElement('span');
      meta.className = 'badge text-bg-light text-dark ms-2 qb-ms-pill-meta';

      const code = String(gb.giftbox_code ?? gb.gb_code ?? gb.code ?? '').trim();
      const gname = String(gb.giftbox_name ?? gb.gb_name ?? '').trim();

      const remRaw = (gb.qty_remaining !== undefined && gb.qty_remaining !== null) ? gb.qty_remaining : (gb.remaining_qty !== undefined && gb.remaining_qty !== null ? gb.remaining_qty : null);
      const totRaw = (gb.qty_total !== undefined && gb.qty_total !== null) ? gb.qty_total : (gb.total_qty !== undefined && gb.total_qty !== null ? gb.total_qty : null);

      const rem = (remRaw !== null && remRaw !== '' && !isNaN(parseInt(remRaw, 10))) ? parseInt(remRaw, 10) : null;
      const tot = (totRaw !== null && totRaw !== '' && !isNaN(parseInt(totRaw, 10))) ? parseInt(totRaw, 10) : null;

      const parts = [];
      if(code) parts.push(code);
      else parts.push('GiftBox');

      if(tot !== null && tot > 0 && rem !== null && rem >= 0){
        parts.push(String(rem) + '/' + String(tot));
      } else {
        const q = (gb.qty !== undefined && gb.qty !== null && !isNaN(parseInt(gb.qty, 10))) ? parseInt(gb.qty, 10) : 1;
        if(q && q > 1) parts.push('x' + String(q));
      }

      meta.textContent = parts.join(' ');

      // Tooltip (native title) with more context
      const tipParts = ['Aggiunto da GiftBox'];
      if(gname) tipParts.push(gname);
      if(code) tipParts.push(code);
      if(tot !== null && tot > 0 && rem !== null && rem >= 0) tipParts.push('Residuo ' + String(rem) + '/' + String(tot));
      meta.title = tipParts.join(' • ');

      pill.appendChild(meta);
    } else if(pk) {
      // Mark pill as coming from a Client Package so we can open the details popup on click.
      try{
        pill.dataset.cpId = String(pk.client_package_id ?? '').trim();
        pill.style.cursor = 'pointer';
        pill.setAttribute('role', 'button');
      }catch(_){ }

      const meta = document.createElement('span');
      meta.className = 'badge text-bg-light text-dark ms-2 qb-ms-pill-meta';

      const nm = String(pk.package_name ?? '').trim();
      const remRaw = (pk.sessions_remaining !== undefined && pk.sessions_remaining !== null) ? pk.sessions_remaining : null;
      const totRaw = (pk.sessions_total !== undefined && pk.sessions_total !== null) ? pk.sessions_total : null;
      const rem = (remRaw !== null && remRaw !== '' && !isNaN(parseInt(remRaw, 10))) ? parseInt(remRaw, 10) : null;
      const tot = (totRaw !== null && totRaw !== '' && !isNaN(parseInt(totRaw, 10))) ? parseInt(totRaw, 10) : null;

      const parts = ['Pacchetto'];
      if(tot !== null && tot > 0 && rem !== null && rem >= 0){
        parts.push(String(rem) + '/' + String(tot));
      } else {
        const q = (pk.qty !== undefined && pk.qty !== null && !isNaN(parseInt(pk.qty, 10))) ? parseInt(pk.qty, 10) : 1;
        if(q && q > 1) parts.push('x' + String(q));
      }
      meta.textContent = parts.join(' ');

      const tipParts = ['Aggiunto da Pacchetto'];
      if(nm) tipParts.push(nm);
      if(tot !== null && tot > 0 && rem !== null && rem >= 0) tipParts.push('Residuo ' + String(rem) + '/' + String(tot));
      meta.title = tipParts.join(' • ');

      pill.appendChild(meta);
    }

    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'btn-close btn-close-white ms-2';
    x.setAttribute('aria-label', 'Rimuovi');
    x.dataset.removeId = String(ch.value);

    pill.appendChild(x);
    pillsEl.appendChild(pill);
  }
}

function fmtEUR(value){
  const num = Number(value || 0);
  // Prefer locale formatting when available (Italian comma decimals)
  try{
    return '€ ' + num.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch(_){
    return '€ ' + (Math.round(num * 100) / 100).toFixed(2).replace('.', ',');
  }
}

function getSelectedServices(){
	  const checks = getAllServiceChecks().filter(ch => ch.checked);

	  // Map service_id -> badge (GiftBox/Pacchetto) for prepaid services.
	  // NOTE: These services must contribute 0€ to the amount due.
	  const prepaid = qbGetPrepaidServiceBadgeMap();

	  return checks.map(ch => {
	    const base = parseFloat(ch?.dataset?.price || '0');
	    const listP = parseFloat(ch?.dataset?.listPrice || ch.getAttribute('data-list-price') || (Number.isFinite(base) ? String(base) : '0'));
	    const bookedP = parseFloat(ch?.dataset?.bookedPrice || ch.getAttribute('data-booked-price') || (Number.isFinite(listP) ? String(listP) : '0'));
	    const lp = Number.isFinite(listP) ? listP : (Number.isFinite(base) ? base : 0);
	    const bp = Number.isFinite(bookedP) ? bookedP : lp;
	    const badge = (ch?.dataset?.discountBadge || ch.getAttribute('data-discount-badge') || '').trim();
	    const sid = String(ch.value || '');

	    // Prepaid (Residui): force price to 0
	    const prepaidBadge = prepaid.has(sid) ? prepaid.get(sid) : null;
	    if(prepaidBadge){
	      // list_price shows what the service would cost (effective booked price),
	      // while the payable price becomes 0.
	      return {
	        id: sid,
	        name: String(ch?.dataset?.name || ch.getAttribute('data-name') || sid || ''),
	        price: 0,
	        booked_price: 0,
	        list_price: bp,
	        discount_badge: String(prepaidBadge)
	      };
	    }

	    return {
	      id: sid,
	      name: String(ch?.dataset?.name || ch.getAttribute('data-name') || sid || ''),
	      // price is the effective unit price used for totals
	      price: bp,
	      booked_price: bp,
	      list_price: lp,
	      discount_badge: badge ? badge : null
	    };
	  }).filter(s => s.id);
}

// Last computed amount due after discounts (manual + fidelity + cb) and before payments (GiftCard / Credit)
let qbLastDueBeforePayments = 0;

function renderPriceDetails(){
  if(!qbPriceDetailsBox || !qbPriceDetailsList || !qbPriceTotal) return;
  const items = getSelectedServices();
  if(!items.length){
    qbPriceDetailsBox.style.display = 'none';
    qbPriceDetailsList.innerHTML = '';
    if(qbPriceSubtotal) qbPriceSubtotal.textContent = fmtEUR(0);
    if(qbPriceDiscountAmount) qbPriceDiscountAmount.textContent = '- ' + fmtEUR(0);
    if(qbCouponRow) qbCouponRow.classList.add('d-none');
    if(qbCouponAmount) qbCouponAmount.textContent = '- ' + fmtEUR(0);
    qbPriceTotal.textContent = fmtEUR(0);

    // Keep in sync for GiftCard "Usa max" and other payment helpers.
    // When no services are selected, the due must be zero.
    qbLastDueBeforePayments = 0;

    // reset Fidelity UI
    qbResetFidelityState && qbResetFidelityState();
    qbResetCbState && qbResetCbState();
    return;
  }

  let subtotal = 0;
  qbPriceDetailsList.innerHTML = items.map(it => {
    const p = Number(it.price || 0);
    const lp0 = Number(it.list_price || 0);
    const listP = (Number.isFinite(lp0) && lp0 > 0) ? lp0 : p;
    const safeList = listP >= p ? listP : p;
    subtotal += (Number.isFinite(p) ? p : 0);

    const hasItemDiscount = safeList > p + 0.0000001;
    if(hasItemDiscount){
      let badge = (it.discount_badge != null) ? String(it.discount_badge).trim() : '';
      if(!badge){
        const diff = Math.max(0, safeList - p);
        const pct = safeList > 0 ? Math.round((diff / safeList) * 100) : 0;
        if(pct > 0) badge = `-${pct}%`;
        else if(diff > 0) badge = '-' + fmtEUR(diff);
      }
      return `
        <div class="d-flex justify-content-between align-items-center mb-1">
          <div class="text-truncate" style="max-width:70%">${escHtml(it.name)}</div>
          <div class="text-end">
            <div class="small text-muted text-decoration-line-through">${fmtEUR(safeList)}</div>
            <div class="fw-semibold">${fmtEUR(p)}${badge ? ` <span class="badge bg-success ms-1">${escHtml(badge)}</span>` : ''}</div>
          </div>
        </div>`;
    }

    return `
      <div class="d-flex justify-content-between align-items-center mb-1">
        <div class="text-truncate" style="max-width:70%">${escHtml(it.name)}</div>
        <div class="fw-semibold">${fmtEUR(p)}</div>
      </div>`;
  }).join('');

  // Discount
  let dtype = qbDiscountType ? String(qbDiscountType.value || '').trim() : '';
  let dvalRaw = qbDiscountValue ? String(qbDiscountValue.value || '').trim() : '';
  dvalRaw = dvalRaw.replace(',', '.');
  let dval = parseFloat(dvalRaw);
  if(!Number.isFinite(dval) || dval < 0) dval = 0;
  if(dtype !== 'percent' && dtype !== 'fixed') dtype = '';

  let discount = 0;
  if(dtype && dval > 0){
    if(dtype === 'percent'){
      if(dval > 100) dval = 100;
      discount = subtotal * (dval / 100);
    } else {
      discount = Math.min(dval, subtotal);
    }
  }

  // Clamp + format
  if(!Number.isFinite(discount) || discount < 0) discount = 0;
  if(discount > subtotal) discount = subtotal;

  let couponDiscountApplied = 0;
  let couponCodeApplied = '';
  try{
    couponCodeApplied = qbCouponCode ? qbNormalizeCouponCode(qbCouponCode.value || '') : '';
    couponDiscountApplied = qbCouponDiscount ? (parseFloat(String(qbCouponDiscount.value || '0').replace(',', '.')) || 0) : 0;
  } catch(_){
    couponDiscountApplied = 0;
    couponCodeApplied = '';
  }
  couponDiscountApplied = qbNormMoney(couponDiscountApplied);
  if(couponDiscountApplied > subtotal) couponDiscountApplied = subtotal;
  if(qbCouponDiscount) qbCouponDiscount.value = String(couponDiscountApplied);

  // Dettaglio prezzi: mostra anche prezzo di listino barrato + prezzo scontato + badge
  try{
    const subtotalCents = Math.round((Number(subtotal || 0)) * 100);
    const discTotalCents = Math.min(subtotalCents, Math.max(0, Math.round((Number(discount || 0)) * 100)));
    if(dtype && discTotalCents > 0 && subtotalCents > 0){
      const pricesCents = items.map(it => Math.max(0, Math.round((Number(it.price || 0)) * 100)));
      const discCents = new Array(pricesCents.length).fill(0);

      if(dtype === 'percent' && dval > 0){
        // Applica percentuale a tutte le righe, mantenendo il totale sconto coerente (distribuzione centesimi)
        let used = 0;
        const fracs = [];
        for(let i=0;i<pricesCents.length;i++){
          const num = pricesCents[i] * dval;
          const base = Math.floor(num / 100);
          const frac = num % 100;
          discCents[i] = Math.min(base, pricesCents[i]);
          used += discCents[i];
          fracs.push({i, frac});
        }
        let rem = discTotalCents - used;
        fracs.sort((a,b)=>b.frac - a.frac);
        for(let k=0; k<fracs.length && rem>0; k++){
          const i = fracs[k].i;
          if(discCents[i] < pricesCents[i]){ discCents[i]++; rem--; }
        }
        // Se resta ancora 1-2 cent per arrotondamenti strani, aggiungili alle righe più capienti
        if(rem>0){
          const idx = pricesCents.map((p,i)=>({i,p,cap:p-discCents[i]})).sort((a,b)=>b.cap-a.cap);
          for(let k=0;k<idx.length && rem>0;k++){
            const i = idx[k].i;
            if(discCents[i] < pricesCents[i]){ discCents[i]++; rem--; }
          }
        }
      } else {
        // fixed: distribuisci proporzionalmente sul totale
        let used = 0;
        const fracs = [];
        for(let i=0;i<pricesCents.length;i++){
          const num = discTotalCents * pricesCents[i];
          const base = Math.floor(num / subtotalCents);
          const frac = num % subtotalCents;
          discCents[i] = Math.min(base, pricesCents[i]);
          used += discCents[i];
          fracs.push({i, frac});
        }
        let rem = discTotalCents - used;
        fracs.sort((a,b)=>b.frac - a.frac);
        for(let k=0; k<fracs.length && rem>0; k++){
          const i = fracs[k].i;
          if(discCents[i] < pricesCents[i]){ discCents[i]++; rem--; }
        }
        if(rem>0){
          const idx = pricesCents.map((p,i)=>({i,p,cap:p-discCents[i]})).sort((a,b)=>b.cap-a.cap);
          for(let k=0;k<idx.length && rem>0;k++){
            const i = idx[k].i;
            if(discCents[i] < pricesCents[i]){ discCents[i]++; rem--; }
          }
        }
      }

      const pctBadge = (dtype === 'percent' && dval > 0) ? ('-' + String(dval).replace(/\.0+$/,'') + '%') : '';

      qbPriceDetailsList.innerHTML = items.map((it, idx) => {
        const pC = pricesCents[idx] || 0;
        const dC = discCents[idx] || 0;
        if(dC > 0){
          const newP = (pC - dC) / 100;
          const badge = (dtype === 'percent') ? pctBadge : ('-' + fmtEUR(dC / 100));
          return `
            <div class="d-flex justify-content-between align-items-center mb-1">
              <div class="text-truncate" style="max-width:70%">${escHtml(it.name)}</div>
              <div class="text-end">
                <div class="small text-muted text-decoration-line-through">${fmtEUR(it.price)}</div>
                <div class="fw-semibold">${fmtEUR(newP)} <span class="badge bg-success ms-1">${escHtml(badge)}</span></div>
              </div>
            </div>`;
        }
        return `
          <div class="d-flex justify-content-between align-items-center mb-1">
            <div class="text-truncate" style="max-width:70%">${escHtml(it.name)}</div>
            <div class="fw-semibold">${fmtEUR(it.price)}</div>
          </div>`;
      }).join('');
    }
  } catch(_){ /* ignore */ }

  // Backward-compat: some pages/tenants don't inject this flag.
  // Supported globals:
  // - window.allowDiscountChoice (legacy)
  // - window.qbAllowDiscountChoice (new)
  // Default: true (still gated by server-side fidelity flags like redeemEnabled).
  let allowDiscountChoice = true;
  try{
    if(typeof window !== 'undefined'){
      if(window.allowDiscountChoice !== undefined) allowDiscountChoice = !!window.allowDiscountChoice;
      else if(window.qbAllowDiscountChoice !== undefined) allowDiscountChoice = !!window.qbAllowDiscountChoice;
    }
  } catch(_){ allowDiscountChoice = true; }

  // Fidelity: suggerimento / applicazione sconto
  let fidLabel = 'Punti';
  let fidErr = null;
  let fidAuto = false;
  let fidReadOnlyExisting = false;
  let sugPts = 0;
  let sugDiscount = 0;
  let availPts = 0;
  let minPts = 0;

  let redeemEnabled = false;
  let giftEnabled = false;
  let giftMinPts = 0;
  let giftDesc = null;
  let gifts = [];
  let giftRedeemed = false;
  let giftRedeemedNote = null;
  let giftRedeemedPoints = 0;

  try{
    fidErr = (qbFid && qbFid.error !== undefined && qbFid.error !== null) ? String(qbFid.error) : null;
    if (fidErr !== null) {
      // Evita alert "vuoti" (es. stringhe di soli spazi)
      const t = String(fidErr).trim();
      fidErr = t ? t : null;
    }
    fidLabel = (qbFid && qbFid.label) ? String(qbFid.label) : 'Punti';

    redeemEnabled = !!(qbFid && qbFid.redeem_enabled);
    fidReadOnlyExisting = !!(qbFid && qbFid.readonly_existing);
    fidAuto = false;

    sugPts = (redeemEnabled && qbFid && qbFid.points_used != null) ? wholePts(qbFid.points_used) : 0;
    sugDiscount = (redeemEnabled && qbFid && (qbFid.enabled || fidReadOnlyExisting) && !fidErr) ? (parseFloat(String(qbFid.discount).replace(',', '.')) || 0) : 0;

    availPts = (qbFid && qbFid.available_points != null) ? wholePts(qbFid.available_points) : 0;
    minPts = (redeemEnabled && qbFid && qbFid.min_points != null) ? wholePts(qbFid.min_points) : 0;

    // Omaggi (indipendenti dallo sconto)
    giftEnabled = !!(qbFid && qbFid.gift_enabled);
    giftMinPts = (qbFid && qbFid.gift_min_points != null) ? wholePts(qbFid.gift_min_points) : 0;
    giftDesc = (qbFid && qbFid.gift_description != null) ? String(qbFid.gift_description) : null;
    gifts = (qbFid && Array.isArray(qbFid.gifts)) ? qbFid.gifts : [];
    giftRedeemed = !!(qbFid && qbFid.gift_redeemed);
    giftRedeemedNote = (qbFid && qbFid.gift_redeemed_note != null) ? String(qbFid.gift_redeemed_note) : null;
    giftRedeemedPoints = (qbFid && qbFid.gift_redeemed_points != null) ? wholePts(qbFid.gift_redeemed_points) : 0;
  } catch(_){
    fidLabel = 'Punti';
    fidErr = null;
    redeemEnabled = false;
    fidAuto = false;
    fidReadOnlyExisting = false;
    sugPts = 0;
    sugDiscount = 0;
    availPts = 0;
    minPts = 0;

    giftEnabled = false;
    giftMinPts = 0;
    giftDesc = null;
    gifts = [];
    giftRedeemed = false;
    giftRedeemedNote = null;
    giftRedeemedPoints = 0;
  }

  if(!Number.isFinite(sugDiscount) || sugDiscount < 0) sugDiscount = 0;
  if(!Number.isFinite(sugPts) || sugPts < 0) sugPts = 0;
  if(!Number.isFinite(availPts) || availPts < 0) availPts = 0;
  if(!Number.isFinite(minPts) || minPts < 0) minPts = 0;

  if(!Number.isFinite(giftMinPts) || giftMinPts < 0) giftMinPts = 0;
  if(!Number.isFinite(giftRedeemedPoints) || giftRedeemedPoints < 0) giftRedeemedPoints = 0;

  // Quick Booking: non mostrare avvisi informativi/bloccanti che il pannello prezzi deve solo applicare in automatico.
  // La logica Fidelity/Cb resta invariata: sopprimiamo solo il messaggio nel pannello UI.
  const fidErrText = (fidErr !== undefined && fidErr !== null) ? String(fidErr).trim() : '';
  const fidErrTextNorm = fidErrText.toLowerCase().replace(/[.!?]+$/,'').trim();
  const fidErrSuppressed = (
    fidErrTextNorm === 'cliente non aderisce alla fidelity'
    || fidErrTextNorm.includes('non cumulabile con la promozione')
  );
  const fidErrVisible = fidErrSuppressed ? null : (fidErrText || null);

  // Punti applicati (hidden input)
  let appliedPts = 0;
  try{ appliedPts = qbFidelityPointsUse ? wholePts(qbFidelityPointsUse.value || '0') : 0; }catch(_){ appliedPts = 0; }

  // Modalità "Scelta cliente" (discount|gift|later): impedisce auto-applicazione quando il cliente ha scelto "later" o "gift".
  let fidChoiceMode = false;
  let fidChoice = '';
  try{
    const _policy = (qbFid && qbFid.conflict_policy) ? String(qbFid.conflict_policy || '').toLowerCase() : '';
    fidChoiceMode = (_policy === 'choice');
  }catch(_){ fidChoiceMode = false; }

  if(fidChoiceMode){
    try{ fidChoice = (typeof qbGetFidelityChoice === 'function') ? qbGetFidelityChoice() : ''; }catch(_){ fidChoice = ''; }

    // Default: se non c'è scelta salvata/seleziata, deduci dai campi oppure usa "later"
    if(!fidChoice){
      let gptsTmp = 0;
      try{ gptsTmp = qbFidelityGiftPointsUse ? wholePts(qbFidelityGiftPointsUse.value || '0') : 0; }catch(_){ gptsTmp = 0; }
      if(gptsTmp > 0.000001) fidChoice = 'gift';
      else if(appliedPts > 0.000001) fidChoice = 'discount';
      else fidChoice = 'later';
      try{ if(typeof qbSetFidelityChoice === 'function') qbSetFidelityChoice(fidChoice); }catch(_){}
    }

    // Normalizza i campi hidden coerentemente con la scelta
    try{ if(typeof qbApplyFidelityChoice === 'function') qbApplyFidelityChoice(fidChoice); }catch(_){}

    // Rileggi i punti applicati dopo la normalizzazione
    try{ appliedPts = qbFidelityPointsUse ? wholePts(qbFidelityPointsUse.value || '0') : 0; }catch(_){ appliedPts = 0; }
  }


  // Auto-applica solo se abilitato e non è già applicato
  const currentStatusNorm = qbNormStatus(String(statusSel?.value || ''));
  const isDoneStatus = (currentStatusNorm === 'done');
  const isTerminalStatus = (currentStatusNorm === 'done' || currentStatusNorm === 'canceled' || currentStatusNorm === 'no_show');
  const isDoneCancelMode = qbIsDoneCancelMode(currentStatusNorm);
  const isFinalizedEconomicState = isTerminalStatus || isDoneCancelMode;
  const doneCancelPreview = isDoneCancelMode ? qbGetCachedDoneCancelPreview() : null;
  try{
    if(qbDiscountType) qbDiscountType.disabled = !!isDoneCancelMode;
    if(qbDiscountValue) qbDiscountValue.disabled = !!isDoneCancelMode;
  }catch(_){ }

  const cbChoiceEnabledPreview = false;
  const cbChoiceSelected = false;
  const cbSelected = false;

  const fidMaxPts = qbFidelityMaxPointsUsable();
  const fidMaxDiscount = qbFidelityDiscountForPoints(fidMaxPts);
  const fidCanUseNow = (!!allowDiscountChoice && !!redeemEnabled && !isFinalizedEconomicState && !fidReadOnlyExisting && !fidChoiceMode && fidMaxPts > 0.000001 && fidMaxDiscount > 0.000001);
  const bothEligiblePreview = (!!fidCanUseNow && !!cbChoiceEnabledPreview);
  const fidOnlyAvailable = (!!allowDiscountChoice && !!redeemEnabled && !isFinalizedEconomicState && !fidReadOnlyExisting && !fidChoiceMode && !bothEligiblePreview && (fidMaxPts > 0.000001 || appliedPts > 0.000001));
  const preserveExistingFidelity = ((appliedPts > 0.000001) && (!!fidReadOnlyExisting || !!isFinalizedEconomicState));

  if(!preserveExistingFidelity){
    if(cbSelected || cbChoiceSelected){
      appliedPts = 0;
      if(qbFidelityPointsUse) qbFidelityPointsUse.value = '0';
    } else if(bothEligiblePreview){
      let selected = '';
      if(qbDiscountChoiceNone && qbDiscountChoiceNone.checked) selected = 'none';
      else if(qbDiscountChoiceCb && qbDiscountChoiceCb.checked) selected = 'cb';
      else if(qbDiscountChoiceFidelity && qbDiscountChoiceFidelity.checked) selected = 'fidelity';
      else selected = 'fidelity';

      if(selected === 'fidelity'){
        let desiredPts = appliedPts > 0.000001 ? appliedPts : fidMaxPts;
        if(fidMaxPts > 0.000001 && desiredPts > fidMaxPts) desiredPts = fidMaxPts;
        appliedPts = wholePts(Math.max(0, desiredPts));
        if(qbFidelityPointsUse) qbFidelityPointsUse.value = String(appliedPts);
      } else {
        appliedPts = 0;
        if(qbFidelityPointsUse) qbFidelityPointsUse.value = '0';
      }
    } else if(fidOnlyAvailable){
      const useFidelityToggle = !!(qbFidelityToggle && qbFidelityToggle.checked);
      if(useFidelityToggle){
        let desiredPts = 0;
        try{ desiredPts = qbFidelityPointsUse ? (parseFloat(String(qbFidelityPointsUse.value || '0').replace(',', '.')) || 0) : 0; }catch(_){ desiredPts = 0; }
        if(!(desiredPts > 0.000001)){
          try{ desiredPts = qbFidelityAmountInput ? (parseFloat(String(qbFidelityAmountInput.value || '').replace(',', '.')) || 0) : 0; }catch(_){ desiredPts = 0; }
        }
        if(!(desiredPts > 0.000001)) desiredPts = fidMaxPts;
        if(fidMaxPts > 0.000001 && desiredPts > fidMaxPts) desiredPts = fidMaxPts;
        appliedPts = wholePts(Math.max(0, desiredPts));
        if(qbFidelityPointsUse) qbFidelityPointsUse.value = String(appliedPts);
      } else {
        appliedPts = 0;
        if(qbFidelityPointsUse) qbFidelityPointsUse.value = '0';
      }
    } else {
      appliedPts = 0;
      if(qbFidelityPointsUse) qbFidelityPointsUse.value = '0';
    }
  }

  const isApplied = allowDiscountChoice && redeemEnabled && (appliedPts > 0.000001);

  // Se è applicato, accetta una normalizzazione backend solo quando la preview
  // è stata richiesta proprio per quei punti. La preview iniziale usa 999999999
  // per suggerire il massimo: non deve sovrascrivere un importo digitato a mano.
  let fidPreviewRequestedForApplied = false;
  try{
    const reqNorm = wholePts(qbFid?.requested_points || 0);
    fidPreviewRequestedForApplied = (reqNorm > 0.000001 && Math.abs(reqNorm - appliedPts) <= 0.001);
  }catch(_){ fidPreviewRequestedForApplied = false; }

  if(redeemEnabled && isApplied && !fidErr && qbFid && (qbFid.enabled || fidReadOnlyExisting) && fidPreviewRequestedForApplied){
    const normPts = wholePts(qbFid.points_used || appliedPts);
    if(normPts > 0.000001 && Math.abs(normPts - appliedPts) > 0.001){
      appliedPts = normPts;
      if(qbFidelityPointsUse) qbFidelityPointsUse.value = String(appliedPts);
    }
  }

  let fidDiscountApplied = 0;
  if(redeemEnabled && isApplied && !fidErr){
    const fidLocalBase = Math.max(0, subtotal - discount - couponDiscountApplied);
    const previewPts = wholePts(qbFid?.points_used || 0);
    if(fidPreviewRequestedForApplied && previewPts === wholePts(appliedPts) && sugDiscount > 0.000001){
      fidDiscountApplied = Math.min(sugDiscount, fidLocalBase);
    } else {
      fidDiscountApplied = qbFidelityDiscountForPoints(appliedPts, fidLocalBase);
    }
    fidDiscountApplied = Math.max(0, Math.round(fidDiscountApplied * 100) / 100);
  }
  const totalBeforeCbIfNoFidelity = Math.max(0, subtotal - discount - couponDiscountApplied);
  const totalBeforeCb = Math.max(0, totalBeforeCbIfNoFidelity - fidDiscountApplied);
  try{
    qbCb = { amount:0, state:'' };
    qbCbPrev = { enabled:false, redeem_enabled:false, apply_in_booking:false, available:0, max_usable:0, reason:null };
    qbCbTouched = false;
  }catch(_){ }

  // Cb: utilizzo saldo cliente come sconto (prenotato e scalato quando l'appuntamento diventa "Eseguito").
  let cbEnabled = false;
  let cbRedeemEnabled = false;
  let cbApplyInBooking = false;
  let cbAvail = 0;
  let cbMax = 0;
  let cbReason = null;
  try{
    cbEnabled = !!(qbCbPrev && qbCbPrev.enabled);
    cbRedeemEnabled = !!(qbCbPrev && qbCbPrev.redeem_enabled);
    cbApplyInBooking = !!(qbCbPrev && qbCbPrev.apply_in_booking);
    cbAvail = (qbCbPrev && qbCbPrev.available != null) ? (parseFloat(String(qbCbPrev.available).replace(',', '.')) || 0) : 0;
    cbMax = (qbCbPrev && qbCbPrev.max_usable != null) ? (parseFloat(String(qbCbPrev.max_usable).replace(',', '.')) || 0) : 0;
    cbReason = (qbCbPrev && qbCbPrev.reason != null) ? String(qbCbPrev.reason) : null;
  } catch(_){
    cbEnabled = false;
    cbRedeemEnabled = false;
    cbApplyInBooking = false;
    cbAvail = 0;
    cbMax = 0;
    cbReason = null;
  }
  if(!Number.isFinite(cbAvail) || cbAvail < 0) cbAvail = Math.abs(cbAvail) || 0;
  if(!Number.isFinite(cbMax) || cbMax < 0) cbMax = Math.abs(cbMax) || 0;
  cbAvail = Math.round(cbAvail * 100) / 100;
  cbMax = Math.round(cbMax * 100) / 100;

  let cbReserved = 0;
  let cbState = '';
  try{
    cbReserved = qbCb ? (parseFloat(String(qbCb.amount || 0).replace(',', '.')) || 0) : 0;
    cbState = qbCb ? String(qbCb.state || '').trim().toLowerCase() : '';
  } catch(_){ cbReserved = 0; cbState = ''; }
  if(!Number.isFinite(cbReserved) || cbReserved < 0) cbReserved = Math.abs(cbReserved) || 0;
  cbReserved = Math.round(cbReserved * 100) / 100;
  if(cbState === 'canceled' || cbState === 'cancelled') cbReserved = 0;

  const cbLocked = isFinalizedEconomicState || (cbState === 'consumed' || cbState === 'refunded');

  // Per mostrare correttamente la scelta Cb vs Punti Fidelity, il massimo Cb
  // deve essere valutato sulla base senza sconto punti. Se lasciassimo la base dopo
  // l'auto-applicazione dei punti, una prenotazione azzerata dai punti nasconderebbe
  // il Cb anche quando sarebbe utilizzabile come alternativa.
  const cbMaxEffForChoice = Math.max(0, Math.min(cbMax, totalBeforeCbIfNoFidelity));
  const cbMaxEff = Math.max(0, Math.min(cbMax, totalBeforeCb));

  // Normalizza l'importo richiesto rispetto ai vincoli (max utilizzabile + totale)
  let cbApplied = 0;
  if(cbLocked){
    // Storico (consumato/refunded/done): mostriamo l'importo associato all'app.
    cbApplied = Math.min(cbReserved, totalBeforeCb);
  } else if(cbEnabled && cbRedeemEnabled){
    cbApplied = Math.min(cbReserved, cbMaxEff, totalBeforeCb);
  } else if(cbReason){
    // Preview disponibile ma Cb non utilizzabile nel contesto corrente
    // (es. promozione non cumulabile): non mantenere un importo stale.
    cbApplied = 0;
  } else {
    // Fallback: se il preview Cb non e' disponibile (es. modulo non
    // attivo nel contesto) manteniamo l'importo gia' prenotato sull'app.
    cbApplied = Math.min(cbReserved, totalBeforeCb);
  }
  if(!Number.isFinite(cbApplied) || cbApplied < 0) cbApplied = 0;
  cbApplied = Math.round(cbApplied * 100) / 100;

  // Sincronizza hidden input (il backend ri-normalizza comunque)
  if(qbCbUseInput) qbCbUseInput.value = String(cbApplied);

  // UI controls
  try{

    // L'opzione di utilizzo Cb va mostrata solo quando è realmente utilizzabile
    // in base alle impostazioni/regole correnti (apply_in_booking, min/max, totale).
    // Se su questo appuntamento è già presente un cb prenotato, lo manteniamo
    // nei dati/righe di riepilogo, ma non mostriamo nuovi controlli se non è più applicabile.
    const cbUiAllowed = (cbEnabled && cbRedeemEnabled && cbApplyInBooking);
    const cbCanUseNow = (cbUiAllowed && cbMaxEffForChoice > 0.000001);
    const showCbBox = (cbEnabled && !cbLocked && cbCanUseNow);

    if(qbCbBox){
      if(showCbBox){ qbCbBox.classList.remove('d-none'); } else { qbCbBox.classList.add('d-none'); }
    }
    if(!showCbBox && cbApplied <= 0.000001){
      if(qbCbToggle) qbCbToggle.checked = false;
      if(qbCbUseInput) qbCbUseInput.value = '0';
      if(qbCbAmountInput) qbCbAmountInput.value = '';
    }

    // Cb deve essere indipendente dagli errori Fidelity.
    // In particolare, quando i punti non sono disponibili (fidErr) non dobbiamo
    // disabilitare l'uso del Cb.
    const canEditCb = (showCbBox && !cbLocked);
    const canUseCb = (canEditCb && cbCanUseNow);

    if(qbCbToggle){
      qbCbToggle.disabled = !canUseCb;
      qbCbToggle.checked = (cbApplied > 0.000001);
    }

    if(qbCbAmountWrap){
      if(canUseCb && cbApplied > 0.000001){
        qbCbAmountWrap.classList.remove('d-none');
      } else {
        qbCbAmountWrap.classList.add('d-none');
      }
    }

    if(qbCbAmountInput){
      qbCbAmountInput.disabled = !canUseCb;
      // evita di sovrascrivere mentre l'utente sta digitando: aggiorna solo se non toccato
      if(!qbCbTouched){
        qbCbAmountInput.value = (cbApplied > 0.000001) ? String(cbApplied.toFixed(2)) : '';
      }
    }

    if(qbCbMaxBtn){
      if(canUseCb){ qbCbMaxBtn.classList.remove('d-none'); }
      else { qbCbMaxBtn.classList.add('d-none'); }
      qbCbMaxBtn.disabled = !canUseCb;
    }

    if(qbCbHint){
      let msg = '';
      if(!cbUiAllowed){
        msg = '';
      } else if(cbLocked){
        msg = 'Cb già contabilizzato su questo appuntamento.';
      } else if(cbReason){
        msg = String(cbReason);
      } else if(cbMaxEffForChoice <= 0.000001){
        msg = 'Nessun Cb utilizzabile per questa prenotazione.';
      } else {
        msg = 'Max utilizzabile: ' + fmtEUR(cbMaxEffForChoice);
      }
      qbCbHint.textContent = msg;
    }

    // Scelta sconto (Cb vs Punti Fidelity) quando entrambi sono disponibili.
    // Quando attiva, nascondiamo lo switch Cb e mostriamo due opzioni radio.
    try{
      const fidCanUseNow = (!!redeemEnabled && !isFinalizedEconomicState && !fidReadOnlyExisting && !fidChoiceMode && fidMaxPts > 0.000001 && fidMaxDiscount > 0.000001);
      const bothEligible = (!!fidCanUseNow && !!cbCanUseNow);
      const fidOnlyAvailable = (!!redeemEnabled && !isFinalizedEconomicState && !fidReadOnlyExisting && !fidChoiceMode && !bothEligible && (fidMaxPts > 0.000001 || appliedPts > 0.000001));

      if(qbDiscountChoiceBox) qbDiscountChoiceBox.classList.toggle('d-none', !bothEligible);
      const hideCbToggle = (bothEligible || !canUseCb);
      if(qbCbToggleRow) qbCbToggleRow.classList.toggle('d-none', hideCbToggle);

      let selected = '';
      if(bothEligible){
        if(qbDiscountChoiceNone && qbDiscountChoiceNone.checked) selected = 'none';
        else if(qbDiscountChoiceCb && qbDiscountChoiceCb.checked) selected = 'cb';
        else if(qbDiscountChoiceFidelity && qbDiscountChoiceFidelity.checked) selected = 'fidelity';
        else selected = (cbApplied > 0.000001) ? 'cb' : 'fidelity';

        if(qbDiscountChoiceFidelity) qbDiscountChoiceFidelity.checked = (selected === 'fidelity');
        if(qbDiscountChoiceCb) qbDiscountChoiceCb.checked = (selected === 'cb');
        if(qbDiscountChoiceNone) qbDiscountChoiceNone.checked = (selected === 'none');

        const disable = (!!isFinalizedEconomicState || !!cbLocked);
        if(qbDiscountChoiceFidelity) qbDiscountChoiceFidelity.disabled = disable;
        if(qbDiscountChoiceCb) qbDiscountChoiceCb.disabled = disable;
        if(qbDiscountChoiceNone) qbDiscountChoiceNone.disabled = disable;
      } else {
        if(qbDiscountChoiceFidelity) qbDiscountChoiceFidelity.disabled = true;
        if(qbDiscountChoiceCb) qbDiscountChoiceCb.disabled = true;
        if(qbDiscountChoiceNone) qbDiscountChoiceNone.disabled = true;
      }

      const fidelitySelectedByChoice = (bothEligible && selected === 'fidelity');
      const showFidelityControls = (fidOnlyAvailable || fidelitySelectedByChoice);

      if(qbFidelityBox) qbFidelityBox.classList.toggle('d-none', !showFidelityControls);
      if(qbFidelityToggleRow) qbFidelityToggleRow.classList.toggle('d-none', !fidOnlyAvailable);
      if(qbFidelityAvail) qbFidelityAvail.textContent = 'Disponibili: ' + fmtPts(availPts) + ' ' + fidLabel;
      if(qbFidelityAmountSuffix) qbFidelityAmountSuffix.textContent = fidLabel;
      if(qbFidelityHint){
        let msg = '';
        if(showFidelityControls){
          if(fidMaxPts > 0.000001 && fidMaxDiscount > 0.000001){
            msg = 'Max utilizzabili: ' + fmtPts(fidMaxPts) + ' ' + fidLabel + ' (- ' + fmtEUR(fidMaxDiscount) + ')';
            if(minPts > 0.000001) msg += '. Minimo: ' + fmtPts(minPts) + ' ' + fidLabel + '.';
          } else if(minPts > 0.000001) {
            msg = 'Minimo: ' + fmtPts(minPts) + ' ' + fidLabel + '.';
          }
        }
        qbFidelityHint.textContent = msg;
      }
      if(qbFidelityToggle){
        const canToggle = fidOnlyAvailable && !cbLocked;
        qbFidelityToggle.disabled = !canToggle;
        qbFidelityToggle.checked = canToggle && (appliedPts > 0.000001);
      }
      if(qbFidelityAmountWrap){
        const showAmount = showFidelityControls && !cbLocked && (fidelitySelectedByChoice || appliedPts > 0.000001);
        qbFidelityAmountWrap.classList.toggle('d-none', !showAmount);
      }
      if(qbFidelityAmountInput){
        const canEditFidelityAmount = showFidelityControls && !cbLocked;
        qbFidelityAmountInput.disabled = !canEditFidelityAmount;
        if(document.activeElement !== qbFidelityAmountInput){
          qbFidelityAmountInput.value = (appliedPts > 0.000001) ? qbFmtPointInputNumber(appliedPts) : '';
        }
      }
      if(qbFidelityMaxBtn){
        const canUseFidelityMax = showFidelityControls && !cbLocked && fidMaxPts > 0.000001;
        qbFidelityMaxBtn.classList.toggle('d-none', !canUseFidelityMax);
        qbFidelityMaxBtn.disabled = !canUseFidelityMax;
      }
    } catch(_){ }
  } catch(_){ }

  const totalBeforePayments = Math.max(0, totalBeforeCb - cbApplied);
  qbLastDueBeforePayments = totalBeforePayments;

  // GiftCard (credito monetario)
  let giftcardUse = 0;
  let giftcardCode = '';
  let giftcardId = 0;
  try{
    const gcs = qbReadGiftcardRedeem();
    if(gcs && gcs[0]){
      const amt = parseFloat(String(gcs[0].amount || '0').replace(',', '.')) || 0;
      giftcardUse = qbNormMoney(Math.max(0, amt));
      giftcardCode = (gcs[0].code !== undefined && gcs[0].code !== null) ? String(gcs[0].code).trim() : '';
      giftcardId = parseInt(String(gcs[0].giftcard_id || gcs[0].id || '0'), 10) || 0;
    }
  }catch(_){
    giftcardUse = 0;
    giftcardCode = '';
    giftcardId = 0;
  }

  // Clamp within booking total (after discounts, before payments)
  giftcardUse = Math.min(giftcardUse, totalBeforePayments);

  const totalBeforeCredit = Math.max(0, totalBeforePayments - giftcardUse);

  // Credito cliente (ricariche) - selezionato dal popup "Residui"
  let creditUse = 0;
  const existingCreditRaw = qbCreditSelectedAmount();
  if(existingCreditRaw > 0.00001){
    const availableCredit = qbCreditAvailableAmount();
    const maxByAvailability = (availableCredit > 0.00001) ? availableCredit : existingCreditRaw;
    creditUse = Math.min(existingCreditRaw, maxByAvailability, totalBeforeCredit);
    creditUse = qbNormMoney(creditUse);
  } else {
    creditUse = 0;
  }

  if(qbCreditUseInput) qbCreditUseInput.value = String(creditUse);

  if(qbCreditRow) qbCreditRow.classList.toggle('d-none', !(creditUse > 0.00001));
  if(qbCreditAmount) qbCreditAmount.textContent = '- ' + fmtEUR(creditUse);

  try{
    if(qbCreditNote){
      qbCreditNote.classList.add('d-none');
      qbCreditNote.textContent = '';
      qbCreditNote.innerHTML = '';
    }
    qbSyncResidualCreditUi({ disabled: !!isFinalizedEconomicState });
  } catch(_){ }
const total = Math.max(0, totalBeforeCredit - creditUse);

  if(qbPriceSubtotal) qbPriceSubtotal.textContent = fmtEUR(subtotal);
  if(qbPriceDiscountAmount) qbPriceDiscountAmount.textContent = '- ' + fmtEUR(discount);
  if(qbCouponRow && qbCouponLabel && qbCouponAmount){
    if(couponCodeApplied && couponDiscountApplied > 0.000001){
      qbCouponRow.classList.remove('d-none');
      qbCouponLabel.textContent = 'Coupon (' + couponCodeApplied + ')';
      qbCouponAmount.textContent = '- ' + fmtEUR(couponDiscountApplied);
    } else {
      qbCouponRow.classList.add('d-none');
      qbCouponLabel.textContent = 'Coupon';
      qbCouponAmount.textContent = '- ' + fmtEUR(0);
    }
  }
  qbPriceTotal.textContent = fmtEUR(total);

  // Fidelity row + note + actions
  try{
    // Row
    if(qbFidelityRow && qbFidelityLabel && qbFidelityAmount){
      if(!redeemEnabled || fidErr || !isApplied || fidDiscountApplied <= 0.000001){
        qbFidelityRow.classList.add('d-none');
      } else {
        qbFidelityRow.classList.remove('d-none');
        qbFidelityLabel.textContent = `Sconto Fidelity (${fmtPts(appliedPts)} ${fidLabel})`;
        qbFidelityAmount.textContent = '- ' + fmtEUR(fidDiscountApplied);
      }
    }

    // Cb row (prenotato su appuntamento)
    if(qbCbRow && qbCbLabel && qbCbAmount){
      if(cbApplied <= 0.000001){
        qbCbRow.classList.add('d-none');
      } else {
        qbCbRow.classList.remove('d-none');
        qbCbLabel.textContent = 'Cb';
        qbCbAmount.textContent = '- ' + fmtEUR(cbApplied);
      }
    }

    // GiftCard row (credito monetario)
    if(qbGiftcardRow && qbGiftcardLabel && qbGiftcardAmount){
      if(giftcardUse <= 0.000001){
        qbGiftcardRow.classList.add('d-none');
        if(qbGiftcardRemoveBtn){ qbGiftcardRemoveBtn.classList.add('d-none'); qbGiftcardRemoveBtn.disabled = false; }
        try{
          qbGiftcardLabel.dataset.giftcardId = '';
          qbGiftcardLabel.dataset.giftcardAmount = '';
        }catch(_){ }
      } else {
        qbGiftcardRow.classList.remove('d-none');
        qbGiftcardLabel.textContent = giftcardCode ? `GiftCard (${giftcardCode})` : 'GiftCard';
        qbGiftcardAmount.textContent = '- ' + fmtEUR(giftcardUse);
        if(qbGiftcardRemoveBtn){
          qbGiftcardRemoveBtn.classList.toggle('d-none', !!isDoneCancelMode);
          qbGiftcardRemoveBtn.disabled = !!isDoneCancelMode;
        }
        try{
          qbGiftcardLabel.dataset.giftcardId = giftcardId ? String(giftcardId) : '';
          qbGiftcardLabel.dataset.giftcardAmount = String(giftcardUse);
        }catch(_){ }
      }
    }

    // omaggio prenotato (scelta cliente)
    if(qbFidelityGiftRow && qbFidelityGiftLabel && qbFidelityGiftAmount){
      let gpts = 0;
      let gidx = null;
      try{ gpts = qbFidelityGiftPointsUse ? (parseFloat(String(qbFidelityGiftPointsUse.value || '0').replace(',', '.')) || 0) : 0; }catch(_){ gpts = 0; }
      gpts = Math.round(gpts * 100) / 100;
      try{
        const gi = qbFidelityGiftIdx ? String(qbFidelityGiftIdx.value || '').trim() : '';
        gidx = gi !== '' ? (parseInt(gi, 10)) : null;
        if(gidx != null && Number.isNaN(gidx)) gidx = null;
      } catch(_){ gidx = null; }

      if(!fidChoiceMode || fidChoice !== 'gift' || gpts <= 0.000001){
        qbFidelityGiftRow.classList.add('d-none');
      } else {
        qbFidelityGiftRow.classList.remove('d-none');
        let desc = '';
        try{
          const giftsArr = Array.isArray(gifts) ? gifts : [];
          for(const g of giftsArr){
            if(!g) continue;
            const idx = (g.idx !== undefined && g.idx !== null) ? parseInt(g.idx, 10) : null;
            if(idx !== null && !Number.isNaN(idx) && gidx !== null && idx === gidx){
              desc = (g.description !== undefined && g.description !== null) ? String(g.description) : '';
              break;
            }
          }
        } catch(_){ desc = ''; }
        desc = (desc || '').trim();
        qbFidelityGiftLabel.textContent = desc ? `omaggio Fidelity (${desc})` : 'omaggio Fidelity';
        qbFidelityGiftAmount.textContent = `${fmtPts(gpts)} ${fidLabel}`;
      }
    }

    // Note
    if(qbFidelityNote){
      if(isDoneCancelMode){
        qbFidelityNote.classList.add('d-none');
        qbFidelityNote.classList.remove('alert-warning');
        qbFidelityNote.classList.add('alert-info');
        qbFidelityNote.textContent = '';
        qbFidelityNote.innerHTML = '';
      } else if(fidErrVisible){
        qbFidelityNote.classList.remove('d-none');
        qbFidelityNote.classList.remove('alert-info');
        qbFidelityNote.classList.add('alert-warning');
        qbFidelityNote.textContent = '';
        qbFidelityNote.innerHTML = escHtml(fidErrVisible);

      } else {
        
        const noteParts = [];

        if(fidReadOnlyExisting){
          noteParts.push('La Fidelity generale è disattivata, ma questa prenotazione mantiene il beneficio già associato.');
        }

        // Nota rimossa su richiesta: non mostrare l'avviso "Hai scelto di utilizzare il Cb..." nel quick booking.

        if(fidChoiceMode){
          // Aggiorna hint sotto la scelta (mostra sempre cosa è selezionato)
          try{
            if(qbFidelityChoiceHint){
              let t = '';
              if(fidChoice === 'discount') t = 'Selezionato: Sconto';
              else if(fidChoice === 'gift') t = 'Selezionato: gift';
              else if(fidChoice === 'later') t = 'Selezionato: scelta in negozio';
              qbFidelityChoiceHint.textContent = t;
            }
          }catch(_){
            // ignore
          }

          if(fidChoice === 'discount'){
            if(!redeemEnabled){
              noteParts.push('Sconto Fidelity non disponibile.');
            } else if(isApplied && fidDiscountApplied > 0.000001 && !isFinalizedEconomicState){
              // Nota rimossa su richiesta: non mostrare i punti scalati all'esecuzione.
            } else if(!isFinalizedEconomicState && sugDiscount > 0.000001 && sugPts > 0.000001){
              noteParts.push(`Sconto selezionato: puoi applicare fino a <strong>${escHtml(fmtEUR(sugDiscount))}</strong> (<strong>${escHtml(fmtPts(sugPts))}</strong> ${escHtml(fidLabel)}).`);
            } else if(!isFinalizedEconomicState){
              let extra = '';
              if(minPts > 0.000001) extra = ` Minimo: <strong>${escHtml(fmtPts(minPts))}</strong> ${escHtml(fidLabel)}.`;
              if(availPts > 0.000001) {
                noteParts.push(`Sconto selezionato. Il cliente ha <strong>${escHtml(fmtPts(availPts))}</strong> ${escHtml(fidLabel)} disponibili.${extra}`);
              } else {
                noteParts.push(`Sconto selezionato, ma non ci sono ${escHtml(fidLabel)} disponibili.${extra}`);
              }
            }
          } else if(fidChoice === 'gift'){
            if(!giftEnabled){
              noteParts.push('omaggio Fidelity non disponibile.');
            } else if(giftRedeemed){
              const note = (giftRedeemedNote || '').trim();
              const pts = Math.round(((parseFloat(String(giftRedeemedPoints || 0).replace(',', '.')) || 0) * 100)) / 100;
              let msg = 'omaggio Fidelity già registrato per questo appuntamento.';
              if(note) msg = `omaggio Fidelity già registrato: <strong>${escHtml(note)}</strong>.`;
              if(pts > 0.000001) msg += ` (${escHtml(fmtPts(pts))} ${escHtml(fidLabel)} scalati)`;
              noteParts.push(msg);
            } else {
              // Leggi omaggio prenotato (input hidden)
              let gpts = 0;
              let gidx = null;
              try{ gpts = qbFidelityGiftPointsUse ? (parseFloat(String(qbFidelityGiftPointsUse.value || '0').replace(',', '.')) || 0) : 0; }catch(_){ gpts = 0; }
              gpts = Math.round(gpts * 100) / 100;
              try{
                const gi = qbFidelityGiftIdx ? String(qbFidelityGiftIdx.value || '').trim() : '';
                gidx = gi !== '' ? (parseInt(gi, 10)) : null;
                if(gidx != null && Number.isNaN(gidx)) gidx = null;
              }catch(_){ gidx = null; }

              // Trova descrizione gift
              let desc = '';
              try{
                const giftsArr = Array.isArray(gifts) ? gifts : [];
                for(const g of giftsArr){
                  if(!g) continue;
                  const idx = (g.idx !== undefined && g.idx !== null) ? parseInt(g.idx, 10) : null;
                  if(idx !== null && !Number.isNaN(idx) && gidx !== null && idx === gidx){
                    desc = (g.description !== undefined && g.description !== null) ? String(g.description) : '';
                    break;
                  }
                }
              }catch(_){ desc = ''; }
              desc = (desc || '').trim();
              const descTxt = desc ? `: <strong>${escHtml(desc)}</strong>` : '';

              if(gpts > 0.000001){
                noteParts.push(`omaggio selezionato${descTxt}.`);
              } else {
                // fallback: scegli il migliore riscattabile
                let best = null;
                try{
                  const giftsArr = Array.isArray(gifts) ? gifts : [];
                  for(const g of giftsArr){
                    if(!g || !g.can_redeem) continue;
                    const min = wholePts(g.min_points || 0);
                    const idx = (g.idx !== undefined && g.idx !== null) ? parseInt(g.idx, 10) : null;
                    if(!(min > 0) || idx === null || Number.isNaN(idx)) continue;
                    if(!best || min > best.min) best = { idx, min, desc: (g.description != null ? String(g.description) : '') };
                  }
                }catch(_){ best = null; }
                if(best){
                  const d = (best.desc || '').trim();
                  const dTxt = d ? `: <strong>${escHtml(d)}</strong>` : '';
                  noteParts.push(`omaggio selezionato${dTxt}.`);
                } else {
                  noteParts.push(`Nessun omaggio riscattabile con i punti disponibili (<strong>${escHtml(fmtPts(availPts))}</strong> ${escHtml(fidLabel)}).`);
                }
              }
            }
          } else if(fidChoice === 'later'){
            noteParts.push("Il cliente deciderà in negozio se utilizzare lo sconto o l'omaggio. Puoi modificare la scelta fino a quando l'appuntamento non è eseguito.");

            if(availPts > 0.000001){
              noteParts.push(`Punti disponibili: <strong>${escHtml(fmtPts(availPts))}</strong> ${escHtml(fidLabel)}.`);
            }

            if(redeemEnabled && sugDiscount > 0.000001 && sugPts > 0.000001){
              noteParts.push(`Sconto potenziale: fino a <strong>${escHtml(fmtEUR(sugDiscount))}</strong> (<strong>${escHtml(fmtPts(sugPts))}</strong> ${escHtml(fidLabel)}).`);
            }

            if(giftEnabled && !giftRedeemed){
              let best = null;
              try{
                const giftsArr = Array.isArray(gifts) ? gifts : [];
                for(const g of giftsArr){
                  if(!g || !g.can_redeem) continue;
                  const min = wholePts(g.min_points || 0);
                  const idx = (g.idx !== undefined && g.idx !== null) ? parseInt(g.idx, 10) : null;
                  if(!(min > 0) || idx === null || Number.isNaN(idx)) continue;
                  if(!best || min > best.min) best = { idx, min, desc: (g.description != null ? String(g.description) : '') };
                }
              }catch(_){ best = null; }
              if(best){
                const d = (best.desc || '').trim();
                const dTxt = d ? `: <strong>${escHtml(d)}</strong>` : '';
                noteParts.push(`omaggio potenziale${dTxt} (costo <strong>${escHtml(fmtPts(best.min))}</strong> ${escHtml(fidLabel)}).`);
              }
            }

            if(giftRedeemed){
              const note = (giftRedeemedNote || '').trim();
              const pts = Math.round(((parseFloat(String(giftRedeemedPoints || 0).replace(',', '.')) || 0) * 100)) / 100;
              let msg = 'omaggio Fidelity già registrato per questo appuntamento.';
              if(note) msg = `omaggio Fidelity già registrato: <strong>${escHtml(note)}</strong>.`;
              if(pts > 0.000001) msg += ` (${escHtml(fmtPts(pts))} ${escHtml(fidLabel)} scalati)`;
              noteParts.push(msg);
            }
          }
        } else {


        // Sconto tramite punti (solo se attivo)
        if(redeemEnabled){
          if(isApplied && fidDiscountApplied > 0.000001 && !isFinalizedEconomicState){
            // Nota rimossa su richiesta: non mostrare i punti scalati all'esecuzione.
          } else if(!fidAuto && !isApplied && !isFinalizedEconomicState && availPts > 0.000001){
            if(sugDiscount > 0.000001 && sugPts > 0.000001){
              // Nota rimossa su richiesta: non mostrare il suggerimento sconto punti nel quick booking.
            } else {
              // Nota rimossa su richiesta: con "Non applicare" nel quick booking
              // non mostrare l'avviso sui punti disponibili e lo sconto in cassa.
            }
          }
        }

        // Omaggi tramite punti (indipendenti dallo sconto)
        if(giftEnabled){
          const reserved = (redeemEnabled && isApplied) ? appliedPts : 0;
          const rem = Math.max(0, wholePts(availPts - reserved));

          // Costruisci lista omaggi (supporto sia multipli che legacy)
          let giftList = [];
          if(Array.isArray(gifts) && gifts.length){
            giftList = gifts.map((g)=>{
              const rawMin = (g && (g.min_points ?? g.min)) != null ? (g.min_points ?? g.min) : 0;
              const min = Math.round(((parseFloat(String(rawMin).replace(',', '.')) || 0) * 100)) / 100;
              const desc = (g && g.description != null) ? String(g.description) : '';
              return { min_points: min, description: desc };
            });
          } else if(giftMinPts > 0.000001){
            giftList = [{ min_points: giftMinPts, description: giftDesc ? String(giftDesc) : '' }];
          }
          giftList = giftList.filter(g => (g.min_points || 0) > 0);
          giftList.sort((a,b) => (a.min_points || 0) - (b.min_points || 0));

          let bestGift = null;
          if(giftList.length){
            for(const g of giftList){
              if((rem + 0.00001) >= (g.min_points || 0)) bestGift = g;
            }
          }

          if(giftRedeemed){
            const note = (giftRedeemedNote || '').trim();
            const pts = Math.round(((parseFloat(String(giftRedeemedPoints || 0).replace(',', '.')) || 0) * 100)) / 100;

            let msg = 'omaggio Fidelity già registrato per questo appuntamento.';
            if(note) msg = `omaggio Fidelity già registrato: <strong>${escHtml(note)}</strong>.`;
            if(pts > 0.000001) msg += ` (${escHtml(fmtPts(pts))} ${escHtml(fidLabel)} scalati)`;
            noteParts.push(msg);
          } else if(!isFinalizedEconomicState && bestGift){
            const d = (bestGift.description || '').trim();
            const descTxt = d ? `: <strong>${escHtml(d)}</strong>` : '';
            const pts = Math.round(((parseFloat(String(bestGift.min_points || 0).replace(',', '.')) || 0) * 100)) / 100;
            const ptsTxt = pts > 0.000001 ? `<strong>${escHtml(fmtPts(pts))}</strong> ${escHtml(fidLabel)}` : escHtml(fidLabel);

            noteParts.push(`Se l'appuntamento sarà eseguito, ci sarà in gift${descTxt}.`);
          }
        }
        }


        if(noteParts.length){
          qbFidelityNote.classList.remove('d-none');
          qbFidelityNote.classList.remove('alert-warning');
          qbFidelityNote.classList.add('alert-info');
          qbFidelityNote.textContent = '';
          qbFidelityNote.innerHTML = noteParts.join('<br>');
        } else {
          qbFidelityNote.classList.add('d-none');
          qbFidelityNote.textContent = '';
          qbFidelityNote.innerHTML = '';
        }
      }
    }
    // Nota Cb duplicata rimossa: il valore e' gia' mostrato nella riga Cb.
    if(qbCbNote){
      qbCbNote.classList.add('d-none');
      qbCbNote.classList.remove('alert-warning');
      qbCbNote.classList.add('alert-info');
      qbCbNote.textContent = '';
      qbCbNote.innerHTML = '';
    }

    // Cb earn preview (avviso accredito): quanto cb verrà accreditato se l'appuntamento viene eseguito
    try{
      if(isDoneCancelMode){
        qbRenderCbEarnNote('canceled');
      } else {
        const cid = qbClientId ? String(qbClientId.value || '').trim() : '';
        const svcIds = getSelectedPayableServiceIds();
        const dt = qbDate ? String(qbDate.value || '').trim() : '';
        const dtype = qbDiscountType ? String(qbDiscountType.value || '').trim() : '';
        const dval = qbDiscountValue ? String(qbDiscountValue.value || '').trim() : '';
        let apptId = '';
        try{ apptId = qbGetExcludeId ? String(qbGetExcludeId() || '').trim() : ''; }catch(_){ apptId = ''; }
        qbScheduleCbEarnPreview({
          clientId: cid,
          serviceIds: svcIds,
          apptDate: dt,
          discountType: dtype,
          discountValue: dval,
          fidelityDiscount: fidDiscountApplied,
          cbUse: cbApplied,
          creditUse: creditUse,
          giftcardUse: giftcardUse,
          cbEnabled: cbEnabled,
          statusVal: String(statusSel?.value || ''),
          appointmentId: apptId,
        });
      }
    } catch(_){ qbResetCbEarnPreview(); }

    // Actions
    if(qbFidelityActions){
      qbFidelityActions.classList.add('d-none');
      if(qbFidelityApplyBtn) qbFidelityApplyBtn.classList.add('d-none');
      if(qbFidelityRemoveBtn) qbFidelityRemoveBtn.classList.add('d-none');

      // In modalità "Scelta cliente" (discount|gift|later) i pulsanti Applica/Rimuovi non sono pertinenti:
      // la scelta viene gestita dai radio e i campi hidden vengono normalizzati automaticamente.
      // Inoltre, lasciandoli visibili si crea l'effetto "non funziona" (es. scelta=later => al click
      // i punti vengono subito azzerati dalla normalizzazione).
      if(!fidChoiceMode && allowDiscountChoice && redeemEnabled && !fidErr && !fidAuto && !isFinalizedEconomicState && !fidReadOnlyExisting){
        if(!isApplied && sugDiscount > 0.000001 && sugPts > 0.000001){
          qbFidelityActions.classList.remove('d-none');
          if(qbFidelityApplyBtn) qbFidelityApplyBtn.classList.remove('d-none');
        } else if(isApplied && fidDiscountApplied > 0.000001 && appliedPts > 0.000001){
          qbFidelityActions.classList.remove('d-none');
          if(qbFidelityRemoveBtn) qbFidelityRemoveBtn.classList.remove('d-none');
        }
      }
    }
  } catch(_){ }

  qbPriceDetailsBox.style.display = 'block';
  try{
    if(qbIsCanceledLockedMode()){
      qbSetLockedAppointmentMode(true);
    }
  } catch(_){ }
}

    function syncEnd(){
      if(!starts || !ends) return;
      const dur = getTotalDuration();
      const dtStart = makeDtLocal(qbDate ? qbDate.value : '', qbStartTime ? qbStartTime.value : '');

      // Always keep hidden start updated when possible
      if(dtStart) starts.value = dtStart;

      if(dtStart && dur > 0){
        const dtEnd = addMinutes(dtStart, dur);
        ends.value = dtEnd;
        const sp = splitDtLocal(dtEnd);
        if(qbEndTime) qbEndTime.value = sp.time;
      } else {
        // If start date/time is incomplete, clear hidden values to avoid stale
        // datetimes being submitted or used for cabin availability lookups.
        starts.value = '';
        // Clear hidden end / visible end time if we can't compute
        if(qbEndTime) qbEndTime.value = '';
        ends.value = '';
      }

      // Refresh cabins whenever the time window changes
      refreshCabinsForServices();

      // When editing an existing appointment, refresh staff availability for the
      // currently selected time window so busy operators are not selectable.
      try{ scheduleStaffAvailabilityRefresh(); }catch(_){ }
    }

    // Debounced refresh of staff dropdown availability (edit mode only)
    let qbStaffAvailTimer = null;
    function scheduleStaffAvailabilityRefresh(){
      // Only relevant for edit mode (avoid disabling operators on new appointments
      // where the user still has to choose the time slot).
      const excludeId = (typeof qbGetExcludeId === 'function') ? String(qbGetExcludeId() || '').trim() : '';
      if(!excludeId) return;

      // Skip when operator dropdown is hidden (multi-staff picker / legacy multi-staff)
      if(!staffSel || staffSel.style.display === 'none') return;

      const ids = getSelectedServiceIds();
      const isSegmentView = !!(form && form.dataset.segmentView === '1');
      const isMulti = (!isSegmentView && ids.length > 1);
      if(isMulti) return;

      const sid = ids[0] ? String(ids[0]) : '';
      if(!sid) return;

      // Need a valid start datetime to compute availability
      const stLocal = (starts && starts.value) ? String(starts.value || '').trim() : '';
      if(!stLocal) return;

      if(qbStaffAvailTimer) clearTimeout(qbStaffAvailTimer);
      qbStaffAvailTimer = setTimeout(()=>{
        qbStaffAvailTimer = null;
        try{
          const keep = staffSel ? String(staffSel.value || '') : '';
          refreshStaffForService(sid, keep);
        }catch(_){ }
      }, 180);
    }

    function setCabinSelectPlaceholder(text){
      if(!cabinSel) return;
      cabinSel.innerHTML = `<option value="">${escHtml(text || '')}</option>`;
    }

    function setStaffSelectPlaceholder(text){
      if(!staffSel) return;
      staffSel.innerHTML = `<option value="">${escHtml(text || '')}</option>`;
    }

    function qbSetCabinFieldLoading(loading){
      if(!cabinSel) return;
      cabinSel.classList.toggle('qb-field-loading', !!loading);
      if(loading) cabinSel.classList.remove('qb-field-muted');
      try{ cabinSel.setAttribute('aria-busy', loading ? 'true' : 'false'); }catch(_){ }
    }

    function qbSetCabinFieldMuted(muted){
      if(!cabinSel) return;
      cabinSel.classList.toggle('qb-field-muted', !!muted);
    }

    function qbClearCabinFieldLoading(){
      qbSetCabinFieldLoading(false);
      qbSetCabinFieldMuted(false);
      if(cabinHintEl) cabinHintEl.classList.remove('qb-hint-loading');
    }

    function qbSetStaffFieldLoading(loading){
      if(!staffSel) return;
      staffSel.classList.toggle('qb-field-loading', !!loading);
      if(loading) staffSel.classList.remove('qb-field-muted');
      try{ staffSel.setAttribute('aria-busy', loading ? 'true' : 'false'); }catch(_){ }
    }

    function qbSetStaffFieldMuted(muted){
      if(!staffSel) return;
      staffSel.classList.toggle('qb-field-muted', !!muted);
    }

    function qbSetStaffHintText(message, loading){
      if(!staffHintEl) return;
      const text = String(message || '').trim();
      if(!text && !loading){
        staffHintEl.style.display = 'none';
        staffHintEl.classList.remove('qb-hint-loading');
        while(staffHintEl.firstChild) staffHintEl.removeChild(staffHintEl.firstChild);
        return;
      }

      staffHintEl.style.display = '';
      staffHintEl.classList.toggle('qb-hint-loading', !!loading);
      try{ staffHintEl.setAttribute('aria-live', loading ? 'polite' : 'off'); }catch(_){ }

      while(staffHintEl.firstChild) staffHintEl.removeChild(staffHintEl.firstChild);

      if(loading){
        const spinner = document.createElement('span');
        spinner.className = 'spinner-border spinner-border-sm text-primary qb-inline-loader';
        spinner.setAttribute('aria-hidden', 'true');
        staffHintEl.appendChild(spinner);
      }

      const label = document.createElement('span');
      label.textContent = text;
      staffHintEl.appendChild(label);
    }

    function qbClearStaffFieldState(){
      qbSetStaffFieldLoading(false);
      qbSetStaffFieldMuted(false);
      qbSetStaffHintText('', false);
    }

async function refreshCabinsForMultiSegments(){
  const isSegmentView = !!(form && form.dataset.segmentView === '1');
  if(isSegmentView) return;

  const _reqIdMulti = ++qbMultiCabinsReqId;

  // Until the user confirms a slot from Availability, keep cabin pickers locked.
  if(!qbAvailConfirmed){
    const sels = Array.from(document.querySelectorAll('.qb-cabin-for-service'));
    for(const sel of sels){
	      // No "(Auto)" option: cabin must be explicit (or disabled until availability is known).
	      sel.innerHTML = '<option value="">(seleziona)</option>';
      sel.disabled = true;
      const sid = sel.getAttribute('data-service-id') || '';
      const hint = multiStaffPicker ? multiStaffPicker.querySelector('.qb-cabin-hint[data-service-id="' + sid + '"]') : null;
      if(hint) hint.textContent = 'Seleziona prima la disponibilità (giorno e ora) per vedere le cabine disponibili.';
    }
    syncCabinMapFromPicker();
    return;
  }

  const segs = computeSelectedServiceSegments();
    const excludeId = qbGetExcludeId();
  const locId = qbCurrentLocationId();
  const holdToken = qbCurrentHoldToken();

  if(!segs.length){
    const sels = Array.from(document.querySelectorAll('.qb-cabin-for-service'));
    for(const sel of sels){
	      sel.innerHTML = '<option value="">(seleziona)</option>';
      sel.disabled = true;
      const sid = sel.getAttribute('data-service-id') || '';
      const hint = multiStaffPicker ? multiStaffPicker.querySelector('.qb-cabin-hint[data-service-id="' + sid + '"]') : null;
      if(hint) hint.textContent = 'Seleziona data e orario per vedere le cabine disponibili.';
    }
    syncCabinMapFromPicker();
    return;
  }

  for(const seg of segs){
    if(_reqIdMulti !== qbMultiCabinsReqId) return;
    const sid = String(seg.service_id);
    const sel = document.querySelector('.qb-cabin-for-service[data-service-id="' + sid + '"]');
    if(!sel) continue;

	    const curVal = String(sel.value || sel.getAttribute('data-current') || '');

    try{
      const url = 'index.php?page=api_appointments&action=cabins_for_services'
        + '&service_id=' + encodeURIComponent(sid)
        + '&starts_at=' + encodeURIComponent(String(seg.starts_at))
        + '&ends_at=' + encodeURIComponent(String(seg.ends_at))
        + (locId ? ('&location_id=' + encodeURIComponent(locId)) : '')
        + (excludeId ? ('&exclude_id=' + encodeURIComponent(excludeId)) : '')
        + (holdToken ? ('&appointment_hold_token=' + encodeURIComponent(holdToken)) : '');

      const res = await fetch(url);
      const data = await res.json();

      if(_reqIdMulti !== qbMultiCabinsReqId) return;

	        if(!data || !data.ok){
	        sel.innerHTML = '<option value="">(seleziona)</option>';
        sel.disabled = true;
        const hint = multiStaffPicker ? multiStaffPicker.querySelector('.qb-cabin-hint[data-service-id="' + sid + '"]') : null;
        if(hint) hint.textContent = 'Impossibile caricare cabine.';
        continue;
      }

      const cabins = Array.isArray(data.cabins) ? data.cabins : [];
      const freeIds = Array.isArray(data.free_ids) ? data.free_ids.map(Number) : [];
      const auto = data.auto_select ? Number(data.auto_select) : 0;

	      sel.innerHTML = '';
	      const optPick = document.createElement('option');
	      optPick.value = '';
	      optPick.textContent = '(seleziona)';
	      sel.appendChild(optPick);

      if(!cabins.length){
        sel.disabled = true;
        const hint = multiStaffPicker ? multiStaffPicker.querySelector('.qb-cabin-hint[data-service-id="' + sid + '"]') : null;
        if(hint) hint.textContent = 'Nessuna cabina configurata.';
        continue;
      }

      for(const c of cabins){
        const id = Number(c.id);
        const name = String(c.name || '').trim() || ('Cabina #' + id);
        const occupied = !!c.occupied;
        const opt = document.createElement('option');
        opt.value = String(id);
        opt.textContent = name + (occupied ? ' (occupata)' : '');
        if(occupied) opt.disabled = true;
        sel.appendChild(opt);
      }

	      // Keep a previously selected cabin where possible; otherwise preselect a free cabin.
	      const userSelected = (sel.getAttribute('data-user-selected') === '1');
	      const curN = Number((sel.value && sel.value !== '') ? sel.value : (sel.getAttribute('data-current') || '0'));
	      let chosen = '';
      const allIds = cabins.map(x => Number(x.id)).filter(n => Number.isFinite(n) && n > 0);
      // Show current cabin even if it results occupied (e.g. when exclude_id isn't available yet),
      // so the UI never appears blank.
	      if(curN && allIds.includes(curN)) chosen = String(curN);
	      else if(!userSelected){
	        const autoPick = auto && freeIds.includes(auto) ? auto : 0;
	        if(autoPick) chosen = String(autoPick);
	        else if(freeIds.length) chosen = String(freeIds[0]);
	      }

	      sel.value = chosen;
      try{
	        if(chosen !== '') sel.setAttribute('data-current', chosen);
	        else if(!userSelected) sel.setAttribute('data-current', '');
      }catch(_){ }
      sel.disabled = (freeIds.length < 1);

      const hint = multiStaffPicker ? multiStaffPicker.querySelector('.qb-cabin-hint[data-service-id="' + sid + '"]') : null;
      if(hint){
        if(!freeIds.length){
          hint.textContent = 'Nessuna cabina disponibile per l\'orario selezionato.';
        } else if(freeIds.length === 1){
          hint.textContent = 'È libera una sola cabina: verrà usata automaticamente.';
        } else {
	          hint.textContent = 'Puoi scegliere la cabina per questo operatore/servizio; le cabine occupate sono indicate.';
        }
      }


	    } catch(_){
	      sel.innerHTML = '<option value="">(seleziona)</option>';
      sel.disabled = true;
      const hint = multiStaffPicker ? multiStaffPicker.querySelector('.qb-cabin-hint[data-service-id="' + sid + '"]') : null;
      if(hint) hint.textContent = 'Impossibile caricare cabine.';
    }
  }

  syncCabinMapFromPicker();
}

    async function refreshCabinsForServices(preferredCabinId){
      if(!cabinSel) return;
      const _reqId = ++qbCabinsReqId;
      qbSetCabinFieldLoading(false);
      if(cabinHintEl) cabinHintEl.classList.remove('qb-hint-loading');


const isSegmentView = !!(form && form.dataset.segmentView === '1');
const idsNow = getSelectedServiceIds();
// Multi-servizio: il flag deve dipendere dai servizi selezionati, non dalla visibilità del picker
// (che può essere aggiornata in async e causare stati inconsistenti).
const isMulti = (!isSegmentView && idsNow.length > 1);

// Toggle global cabin selector: in multi-servizio si sceglie la cabina per segmento (operatore)
try{
  const wrap = cabinSel.closest('.row') || cabinSel.closest('.col-12') || cabinSel.parentElement;
  if(wrap){
    if(isMulti) wrap.classList.add('d-none');
    else wrap.classList.remove('d-none');
  }
} catch(_){}

if(isMulti){
  // Nella modalità multi-servizio non usiamo la cabina globale
  setCabinSelectPlaceholder('Cabine per operatore…');
  cabinSel.disabled = true;
  qbSetCabinFieldMuted(true);

  // Non permettere la scelta cabine finché non viene confermata la disponibilità
  if(!qbAvailConfirmed){
    try{
      const sels = Array.from(document.querySelectorAll('.qb-cabin-for-service'));
      for(const sel of sels){
	        sel.innerHTML = '<option value="">(seleziona)</option>';
        sel.disabled = true;
        const sid = sel.getAttribute('data-service-id') || '';
        const hint = multiStaffPicker ? multiStaffPicker.querySelector('.qb-cabin-hint[data-service-id="' + sid + '"]') : null;
        if(hint) hint.textContent = 'Seleziona prima la disponibilità (giorno e ora) per vedere le cabine disponibili.';
      }
      syncCabinMapFromPicker();
    } catch(_){ }
    return;
  }

  await refreshCabinsForMultiSegments();
  return;
} else {
  // Se torniamo alla modalità singolo servizio, azzera la mappa cabine
  if(cabinMapInput) cabinMapInput.value = '';
}
// Gate: cabins can be chosen only after a confirmed availability slot.
if(!qbAvailConfirmed){
  setCabinSelectPlaceholder('Seleziona prima la disponibilità…');
  cabinSel.disabled = true;
  qbSetCabinFieldMuted(true);
  if(cabinHintEl) cabinHintEl.textContent = 'Seleziona prima la disponibilità (giorno e ora) per vedere le cabine disponibili.';
  // Also lock per-service cabin dropdowns (multi-servizio) if they are visible.
  try{
    const sels = Array.from(document.querySelectorAll('.qb-cabin-for-service'));
    for(const sel of sels){
	      sel.innerHTML = '<option value="">(seleziona)</option>';
      sel.disabled = true;
      const sid = sel.getAttribute('data-service-id') || '';
      const hint = multiStaffPicker ? multiStaffPicker.querySelector('.qb-cabin-hint[data-service-id="' + sid + '"]') : null;
      if(hint) hint.textContent = 'Seleziona prima la disponibilità (giorno e ora) per vedere le cabine disponibili.';
    }
    syncCabinMapFromPicker();
  } catch(_){ }
  return;
}




      const serviceIds = getSelectedServiceIds();
      const s = (starts && starts.value) ? String(starts.value).trim() : '';
      const e = (ends && ends.value) ? String(ends.value).trim() : '';
        const excludeId = qbGetExcludeId();
      const locId = qbCurrentLocationId();
      const holdToken = qbCurrentHoldToken();

      if(!serviceIds.length || !s || !e){
        setCabinSelectPlaceholder('Seleziona servizio e orario…');
        cabinSel.disabled = true;
        qbSetCabinFieldMuted(true);
        qbSetCabinHintText('Seleziona servizio e orario per vedere le cabine disponibili.', false);
        return;
      }

      setCabinSelectPlaceholder('Verifico cabina disponibile...');
      cabinSel.value = '';
      cabinSel.disabled = true;
      qbSetCabinFieldMuted(false);
      qbSetCabinFieldLoading(true);
      qbSetCabinHintText('Verifico la cabina disponibile per lo slot selezionato.', true);

      try{
        const url = 'index.php?page=api_appointments&action=cabins_for_services'
          + '&service_ids=' + encodeURIComponent(serviceIds.join(','))
          + '&starts_at=' + encodeURIComponent(s)
          + '&ends_at=' + encodeURIComponent(e)
          + (locId ? ('&location_id=' + encodeURIComponent(locId)) : '')
          + (excludeId ? ('&exclude_id=' + encodeURIComponent(excludeId)) : '')
          + (holdToken ? ('&appointment_hold_token=' + encodeURIComponent(holdToken)) : '');

        const res = await fetch(url);
        const data = await res.json();

        if(_reqId !== qbCabinsReqId) return;

        if(!data || !data.ok){
          setCabinSelectPlaceholder('Impossibile caricare cabine');
          cabinSel.disabled = true;
          qbSetCabinFieldLoading(false);
          qbSetCabinFieldMuted(true);
          qbSetCabinHintText('Impossibile caricare cabine.', false);
          return;
        }

        const cabins = Array.isArray(data.cabins) ? data.cabins : [];
        const freeIds = Array.isArray(data.free_ids) ? data.free_ids.map(Number) : [];
        const auto = data.auto_select ? Number(data.auto_select) : 0;

        cabinSel.innerHTML = '';
        if(!cabins.length){
          setCabinSelectPlaceholder('Nessuna cabina configurata');
          cabinSel.disabled = true;
          qbSetCabinFieldLoading(false);
          qbSetCabinFieldMuted(true);
          if(cabinHintEl){
            cabinHintEl.classList.remove('qb-hint-loading');
            cabinHintEl.textContent = 'Nessuna cabina configurata per i servizi selezionati.';
          }
          return;
        }

        for(const c of cabins){
          const id = Number(c.id);
          const name = String(c.name || '').trim() || ('Cabina #' + id);
          const occupied = !!c.occupied;
          const opt = document.createElement('option');
          opt.value = String(id);
          opt.textContent = name + (occupied ? ' (occupata)' : '');
          if(occupied) opt.disabled = true;
          cabinSel.appendChild(opt);
        }

        // Choose value preference order:
        // 1) preferredCabinId (even if occupied, so the user always sees the current cabin)
        // 2) current value (even if occupied)
        // 3) auto_select (if free)
        // 4) first free
        // 5) fallback: first configured cabin
        let chosen = '';
        const allIds = cabins.map(x => Number(x.id)).filter(n => Number.isFinite(n) && n > 0);
        const pref = (preferredCabinId != null && String(preferredCabinId).trim() !== '') ? Number(preferredCabinId) : 0;
        const cur = cabinSel.value ? Number(cabinSel.value) : 0;

        if(pref && allIds.includes(pref)) chosen = String(pref);
        else if(cur && allIds.includes(cur)) chosen = String(cur);
        else if(auto && freeIds.includes(auto)) chosen = String(auto);
        else if(freeIds.length) chosen = String(freeIds[0]);
        else if(allIds.length) chosen = String(allIds[0]);

        if(chosen) cabinSel.value = chosen;

        // Keep the field usable after the automatic cabin resolution.
        cabinSel.disabled = (freeIds.length < 1);
        qbClearCabinFieldLoading();
        qbSetCabinFieldMuted(freeIds.length < 1);

        if(cabinHintEl){
          if(!freeIds.length){
            cabinHintEl.textContent = 'Nessuna cabina disponibile per l\'orario selezionato.';
          } else if(freeIds.length === 1){
            cabinHintEl.textContent = 'È libera una sola cabina: selezionata automaticamente.';
          } else {
            cabinHintEl.textContent = 'Se sono libere più cabine puoi scegliere; le cabine occupate sono indicate.';
          }
        }
      } catch(err){
        setCabinSelectPlaceholder('Impossibile caricare cabine');
        cabinSel.disabled = true;
        qbSetCabinFieldLoading(false);
        qbSetCabinFieldMuted(true);
        if(cabinHintEl){
          cabinHintEl.classList.remove('qb-hint-loading');
          cabinHintEl.textContent = 'Impossibile caricare cabine.';
        }
      }
    }

    function qbCurrentLocationId(){
  if(locationSel) return String(locationSel.value || '').trim();
  const hiddenLoc = form ? form.querySelector('input[name="location_id"]') : null;
  return hiddenLoc ? String(hiddenLoc.value || '').trim() : '';
}

function qbServiceItemAllowedForLocation(item){
  const locId = qbCurrentLocationId();
  if(!locId || !item) return true;
  const raw = String(item.getAttribute('data-location-ids') || '').trim();
  if(!raw) return true;
  return raw.split(',').map(v => v.trim()).filter(Boolean).includes(locId);
}

function qbPruneServicesForCurrentLocation(){
  if(!msRoot) return false;
  let changed = false;
  const items = Array.from(msRoot.querySelectorAll('.qb-ms-item'));
  for(const it of items){
    if(qbServiceItemAllowedForLocation(it)) continue;
    const ch = it.querySelector('.qb-ms-check');
    if(ch && ch.checked){
      ch.checked = false;
      changed = true;
      try{ qbRestoreServiceMasterData(ch); }catch(_){ }
    }
  }
  return changed;
}

    function applyServiceSearchFilter(q){
  if(!msRoot) return;
  const needle = String(q||'').trim().toLowerCase();

  const items = Array.from(msRoot.querySelectorAll('.qb-ms-item'));
  for(const it of items){
    const hay = (it.getAttribute('data-name') || it.textContent || '').toLowerCase();
    const ch = it.querySelector('.qb-ms-check');
    const checked = !!(ch && ch.checked);
    const locationOk = qbServiceItemAllowedForLocation(it);
    it.hidden = (!locationOk && !checked) || (needle ? !hay.includes(needle) : false);
  }

  const groups = Array.from(msRoot.querySelectorAll('.qb-ms-group'));
  for(const g of groups){
    const anyVisible = Array.from(g.querySelectorAll('.qb-ms-item')).some(it => !it.hidden);
    g.hidden = !anyVisible;
  }
}


    async function refreshStaffForService(serviceId, preferredStaffId){
      if(!staffSel) return;
      const sid = String(serviceId || '').trim();

      // Before a service is selected the eligible staff list is not known yet.
      // Calendar slot staff is re-applied after the selected service refreshes the list.
      if(!sid){
        qbStaffReqId += 1;
        setStaffSelectPlaceholder('Seleziona prima un servizio');
        staffSel.value = '';
        staffSel.disabled = true;
        qbSetStaffFieldLoading(false);
        qbSetStaffFieldMuted(true);
        qbSetStaffHintText('', false);
        qbUpdateDateAvailabilityGate();
        return;
      }

      // Preserve selection where possible
      const keep = (preferredStaffId !== undefined) ? String(preferredStaffId || '') : String(staffSel.value || '');

      const _staffReqId = ++qbStaffReqId;
      setStaffSelectPlaceholder('Verifico operatori disponibili...');
      staffSel.value = '';
      staffSel.disabled = true;
      qbSetStaffFieldMuted(false);
      qbSetStaffFieldLoading(true);
      qbSetStaffHintText('Verifico operatori disponibili...', true);
      qbUpdateDateAvailabilityGate();
      let url = 'index.php?page=api_appointments&action=staff_for_service';
      if(sid) url += '&service_id=' + encodeURIComponent(sid);
      const locId = qbCurrentLocationId();
      if(locId) url += '&location_id=' + encodeURIComponent(locId);

      // When editing an existing appointment, disable busy operators for the
      // current time window (prevents selecting an operator that will surely
      // fail on save with a conflict error).
      const excludeId = (typeof qbGetExcludeId === 'function') ? String(qbGetExcludeId() || '').trim() : '';
      const inEdit = !!excludeId;
      const stLocal = (inEdit && starts && starts.value) ? String(starts.value || '').trim() : '';
      const enLocal = (inEdit && ends && ends.value) ? String(ends.value || '').trim() : '';
      if(inEdit && stLocal){
        url += '&starts_at=' + encodeURIComponent(stLocal);
        if(enLocal) url += '&ends_at=' + encodeURIComponent(enLocal);
        url += '&exclude_id=' + encodeURIComponent(excludeId);
      }
      const holdToken = (typeof qbCurrentHoldToken === 'function') ? String(qbCurrentHoldToken() || '').trim() : '';
      if(holdToken) url += '&appointment_hold_token=' + encodeURIComponent(holdToken);

      let list = [];
      let loadError = false;
      try{
        const res = await fetch(url);
        const data = await res.json();
        if(data && data.ok && Array.isArray(data.staff)) list = data.staff;
        else loadError = true;
      } catch(_){ list = []; loadError = true; }

      if(_staffReqId !== qbStaffReqId) return;
      qbSetStaffFieldLoading(false);

      const hasService = !!sid;
      const foundKeep = keep && list.some(s => String(s.id) === keep);

      // Availability fields are optional (only returned when a time window is provided)
      const hasAvail = !!(list && list.length && (list[0] && (list[0].available !== undefined || list[0].unavailable_reason !== undefined)));

      const staffLabel = (s)=>{
        const base = (s && s.full_name != null) ? String(s.full_name) : '';
        if(!hasAvail) return base;
        const ok = (s && s.available !== undefined) ? !!s.available : true;
        if(ok) return base;
        const r = (s && s.unavailable_reason != null) ? String(s.unavailable_reason).trim() : '';
        return r ? `${base} — ${r}` : `${base} — Occupato`;
      };

      const staffDisabled = (s)=>{
        if(!hasAvail) return false;
        return (s && s.available !== undefined) ? (!s.available) : false;
      };

      // Build options
      if(hasService && list.length === 1){
        const s = list[0];
        const dis = staffDisabled(s);
        staffSel.innerHTML = `<option value="${escHtml(s.id)}"${dis ? ' disabled' : ''}>${escHtml(staffLabel(s))}</option>`;
        staffSel.value = String(s.id);
        staffSel.disabled = true;
        qbSetStaffFieldMuted(!!dis);
        qbSetStaffHintText('', false);
        qbUpdateDateAvailabilityGate();
        return;
      }

      if(hasService && list.length === 0){
        setStaffSelectPlaceholder(loadError ? 'Impossibile caricare operatori' : 'Nessun operatore disponibile');
        staffSel.value = '';
        staffSel.disabled = true;
        qbSetStaffFieldMuted(true);
        qbSetStaffHintText(loadError ? 'Impossibile caricare gli operatori disponibili.' : 'Nessun operatore disponibile per il servizio selezionato.', false);
        qbUpdateDateAvailabilityGate();
        return;
      }

      const placeholder = hasService ? '(qualsiasi)' : 'Seleziona prima un servizio';
      let html = `<option value="">${placeholder}</option>`;

      // If editing and the stored staff is not in the current list, keep it visible.
      // (Only in edit mode: in create mode it would show stale IDs like SSO.)
      if(inEdit && hasService && keep && !foundKeep){
        html += `<option value="${escHtml(keep)}">Operatore assegnato (ID ${escHtml(keep)})</option>`;
      }

      for(const s of list){
        const dis = staffDisabled(s);
        html += `<option value="${escHtml(s.id)}"${dis ? ' disabled' : ''}>${escHtml(staffLabel(s))}</option>`;
      }
      staffSel.innerHTML = html;
      staffSel.disabled = false;
      qbSetStaffFieldMuted(false);
      qbSetStaffHintText('', false);

      if(hasService && list.length === 1){
        staffSel.value = String(list[0].id);
      } else if(foundKeep){
        staffSel.value = keep;
      } else if(inEdit && keep && !foundKeep){
        // The fallback option above keeps the stored value visible in edit mode.
        staffSel.value = keep;
      } else {
        staffSel.value = '';
      }
      qbUpdateDateAvailabilityGate();
    }



// --- Multi-servizio: selezione operatore per ogni servizio ---
let multiStaffReqToken = 0;

function getServiceNameById(serviceId){
  const sid = String(serviceId || '');
  const ch = findServiceCheckById(sid);
  const nm = ch ? String(ch.getAttribute('data-name') || '').trim() : '';
  return nm || (`Servizio #${sid}`);
}

function readStaffMapValue(){
  if(!staffMapInput) return {};
  const v = String(staffMapInput.value || '').trim();
  if(!v) return {};
  try{
    const obj = JSON.parse(v);
    if(obj && typeof obj === 'object') return obj;
  }catch(_){}
  return {};
}

function setMultiStaffMode(on){
  if(on){
    if(staffSel){
      staffSel.value = '';
      staffSel.disabled = true;
      staffSel.style.display = 'none';
    }
    if(staffSummaryHint) staffSummaryHint.style.display = 'block';
    if(staffSummaryBox) staffSummaryBox.style.display = 'block';
    if(multiStaffPicker) multiStaffPicker.style.display = 'block';
  } else {
    if(multiStaffPicker){ multiStaffPicker.style.display = 'none'; multiStaffPicker.innerHTML = ''; }
    if(staffMapInput) staffMapInput.value = '';
    if(staffSummaryBox){ staffSummaryBox.style.display = 'none'; staffSummaryBox.textContent = ''; }
    if(staffSummaryHint) staffSummaryHint.style.display = 'none';
    if(staffSel){
      staffSel.style.display = '';
      staffSel.disabled = false;
    }
  }
  qbUpdateDateAvailabilityGate();
}

function syncStaffMapFromPicker(){
  if(!multiStaffPicker || !staffMapInput) return;
  const map = {};
  const names = [];
  const seen = new Set();

  const selects = Array.from(multiStaffPicker.querySelectorAll('select.qb-staff-for-service[data-service-id]'));
  for(const sel of selects){
    const svcId = String(sel.dataset.serviceId || '');
    const val = String(sel.value || '').trim();
    if(val){
      map[svcId] = parseInt(val,10) || val;
      const nm = (sel.options && sel.selectedIndex >= 0) ? String(sel.options[sel.selectedIndex].textContent || '').trim() : '';
      if(nm && !seen.has(nm)){ seen.add(nm); names.push(nm); }
    }
  }

  staffMapInput.value = JSON.stringify(map);
  if(staffSummaryBox){
    staffSummaryBox.textContent = names.length ? names.join(', ') : '(seleziona operatori)';
    staffSummaryBox.style.display = 'block';
  }
  qbUpdateDateAvailabilityGate();
}

async function renderMultiStaffPicker(serviceIds, prefill){
  if(!multiStaffPicker) return;
  const ids = (Array.isArray(serviceIds) ? serviceIds : []).map(String).filter(Boolean);

  if(ids.length <= 1){
    setMultiStaffMode(false);
    return;
  }

  setMultiStaffMode(true);

  // Merge: keep current choices when the selection changes
  const cur = readStaffMapValue();
  const base = Object.assign({}, cur, (prefill && typeof prefill === 'object') ? prefill : {});

  // Preserve cabin choices already made in the UI
  const curCab = readCabinMapValue();

  const tok = ++multiStaffReqToken;
  let staffMap = {};
  try{
    const locId = qbCurrentLocationId();
    let url = 'index.php?page=api_appointments&action=staff_for_services&service_ids=' + encodeURIComponent(ids.join(','));
    if(locId) url += '&location_id=' + encodeURIComponent(locId);
    const res = await fetch(url);
    const data = await res.json();
    if(data && data.ok && data.staff_map) staffMap = data.staff_map;
  }catch(_){ staffMap = {}; }

  if(tok !== multiStaffReqToken) return;

  let html = '';
  for(const sid of ids){
    const svcName = getServiceNameById(sid);
    const list = Array.isArray(staffMap[sid]) ? staffMap[sid] : [];
    const onlyOne = (list.length === 1);

    let options = '';
    if(onlyOne){
      options = `<option value="${escHtml(list[0].id)}">${escHtml(list[0].full_name)}</option>`;
    } else {
      options = `<option value="">(seleziona)</option>`;
      for(const st of list){
        options += `<option value="${escHtml(st.id)}">${escHtml(st.full_name)}</option>`;
      }
    }

    const prefCab = (curCab && curCab[sid]) ? String(curCab[sid]) : '';
    const dataCurAttr = prefCab ? ` data-current="${escHtml(prefCab)}"` : '';

    html += `
      <div class="mb-3">
        <label class="form-label small mb-1">${escHtml(svcName)}</label>
        <select class="form-select qb-staff-for-service" data-service-id="${escHtml(sid)}"${onlyOne ? ' disabled' : ''}>${options}</select>

        <div class="mt-2">
          <label class="form-label small mb-1">Cabina</label>
	          <select class="form-select qb-cabin-for-service" data-service-id="${escHtml(sid)}"${dataCurAttr} disabled>
	            <option value="">(seleziona)</option>
	          </select>
          <div class="form-text qb-cabin-hint" data-service-id="${escHtml(sid)}">Seleziona data e orario per vedere le cabine disponibili.</div>
        </div>
      </div>`;
  }

  multiStaffPicker.innerHTML = html;

  // Apply selections + handlers (staff)
  const selects = Array.from(multiStaffPicker.querySelectorAll('select.qb-staff-for-service[data-service-id]'));
  for(const sel of selects){
    const sid = String(sel.dataset.serviceId || '');
    const list = Array.isArray(staffMap[sid]) ? staffMap[sid] : [];
    if(list.length === 1){
      sel.value = String(list[0].id);
    } else if(base[sid]){
      sel.value = String(base[sid]);
    } else {
      sel.value = '';
    }
      sel.dataset.prevValue = String(sel.value || '');
    sel.addEventListener('change', ()=>{
      const prevStaff = String(sel.dataset.prevValue || '');
      const nextStaff = String(sel.value || '');
      sel.dataset.prevValue = nextStaff;
      syncStaffMapFromPicker();

      // BUGFIX: changing any operator invalidates the previously chosen slot.
      // In create mode we force the user to pick a new time (availability is
      // calculated per operator/combination).
      if(!qbAvailApplying){
        const excludeId = (typeof qbGetExcludeId === 'function') ? String(qbGetExcludeId() || '').trim() : '';
        const inEdit = !!excludeId;
        if(!inEdit){
          const hadSlot = !!((qbStartTime && qbStartTime.value) || (starts && starts.value) || qbAvailConfirmed);
          qbAvailConfirmed = false;
          if(qbStartTime) qbStartTime.value = '';
          if(qbEndTime) qbEndTime.value = '';
          if(starts) starts.value = '';
          if(ends) ends.value = '';
          qbReleaseAvailabilityHold();
          if(hadSlot && prevStaff.trim() && nextStaff.trim() && prevStaff !== nextStaff){
            notify('Hai cambiato operatore: seleziona di nuovo una disponibilità', 'warning');
          }
        }
      }

      // Recompute end time / refresh cabins.
      syncEnd();
    });
  }

  // Cabin change -> sync cabin_map
  const cabinSels = Array.from(multiStaffPicker.querySelectorAll('select.qb-cabin-for-service[data-service-id]'));
  for(const sel of cabinSels){
    sel.addEventListener('change', ()=>{
	      try{ sel.setAttribute('data-user-selected','1'); sel.setAttribute('data-current', String(sel.value || '')); }catch(_){ }
      syncCabinMapFromPicker();
    });
  }

  syncStaffMapFromPicker();
  // Populate per-service cabin dropdowns (if date/time is set)
  refreshCabinsForServices();
}

        // init multiselect UI
    syncHiddenServiceInputs();
    renderPills();
    applyServiceSearchFilter(serviceSearch ? serviceSearch.value : '');
    // Initial state: operator must stay disabled until at least one service is selected.
    // (If a service is already pre-selected server-side, the change handler below will enable it.)
    refreshStaffForService('');
    qbUpdateDateAvailabilityGate();
if(serviceSearch) serviceSearch.addEventListener('input', ()=>{
      applyServiceSearchFilter(serviceSearch.value);
    });

if(locationSel){
  locationSel.addEventListener('change', ()=>{
    qbPruneServicesForCurrentLocation();
    if(!qbAvailApplying) qbAvailConfirmed = false;
    if(qbStartTime) qbStartTime.value = '';
    if(qbEndTime) qbEndTime.value = '';
    if(starts) starts.value = '';
    if(ends) ends.value = '';
    qbReleaseAvailabilityHold();
    qbSyncServicesUI();
    qbUpdateDateAvailabilityGate();
  });
}

    function closeMs(){
  if(!msDropdown || !msControl) return;
  msDropdown.hidden = true;
  msControl.setAttribute('aria-expanded','false');
}
function openMs(){
  if(!msDropdown || !msControl) return;
  msDropdown.hidden = false;
  msControl.setAttribute('aria-expanded','true');
  try{ serviceSearch && serviceSearch.focus(); }catch(_){}
}
function toggleMs(){
  if(!msDropdown || !msControl) return;
  const isOpen = !msDropdown.hidden;
  if(isOpen) closeMs(); else openMs();
}

if(msControl){
  msControl.addEventListener('click', (e)=>{ e.preventDefault(); toggleMs(); });
  msControl.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); toggleMs(); }
    if(e.key === 'Escape'){ closeMs(); }
  });
}

document.addEventListener('click', (e)=>{
  if(!msRoot || !msDropdown) return;
  if(!msRoot.contains(e.target)) closeMs();
});

if(pillsEl){
  pillsEl.addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-remove-id]');
    if(btn){
      // Prevent the click from toggling the services dropdown.
      e.preventDefault();
      e.stopPropagation();

      const id = String(btn.dataset.removeId || '');
      const ch = findServiceCheckById(id);
      if(ch) ch.checked = false;
      syncHiddenServiceInputs();
      renderPills();
      qbRefreshFidelityThenRender();
      syncEnd();
      qbReleaseAvailabilityHold();
      qbPruneGiftboxRedeemBySelectedServices();
      qbPruneGiftRedeemBySelectedServices();
      qbPrunePackageRedeemBySelectedServices();
      qbPrunePrepaidServiceRedeemBySelectedServices();
      const ids = getSelectedServiceIds();
      if(ids.length > 1 && !(form && form.dataset.segmentView === '1')){
        renderMultiStaffPicker(ids);
      } else {
        setMultiStaffMode(false);
        refreshStaffForService(ids[0] || '');
      }
      return;
    }

    // GiftBox details popup: clicking a service pill that has GiftBox traceability
    // should open a modal with GiftBox + residuals details.
    const pill = e.target.closest('.qb-ms-pill');
    if(!pill) return;
    const iid = String(pill.dataset.gbInstanceId || '').trim();
    const ogIid = String(pill.dataset.ogInstanceId || '').trim();
    const cpId = String(pill.dataset.cpId || '').trim();
    const psId = String(pill.dataset.prepaidServiceId || '').trim();
    const svcId = String(pill.dataset.serviceId || '').trim();
    if(iid){
      // GiftBox-linked pill
      const itId = String(pill.dataset.gbItemId || '').trim();
      e.preventDefault();
      e.stopPropagation();
      qbOpenGiftboxInfo(iid, itId, svcId);
      return;
    }
    if(ogIid){
      // gift-linked pill
      const ogIdx = String(pill.dataset.ogRewardItemIndex || '').trim();
      e.preventDefault();
      e.stopPropagation();
      qbOpenGiftInfo(ogIid, ogIdx, svcId);
      return;
    }
    if(cpId){
      // Package-linked pill
      e.preventDefault();
      e.stopPropagation();
      qbOpenPackageInfo(cpId, svcId);
      return;
    }
    if(psId){
      // Prepaid-service-linked pill
      e.preventDefault();
      e.stopPropagation();
      qbOpenPrepaidServiceInfo(psId, svcId);
      return;
    }
  });
}

if(msRoot){
  msRoot.addEventListener('change', (e)=>{
    if(!e.target || !e.target.classList || !e.target.classList.contains('qb-ms-check')) return;
    syncHiddenServiceInputs();
    renderPills();
    qbRefreshFidelityThenRender();
    syncEnd();
    qbReleaseAvailabilityHold();
    qbPruneGiftboxRedeemBySelectedServices();
    qbPrunePackageRedeemBySelectedServices();
    const ids = getSelectedServiceIds();
    if(ids.length > 1 && !(form && form.dataset.segmentView === '1')){
      renderMultiStaffPicker(ids);
    } else {
      setMultiStaffMode(false);
      refreshStaffForService(ids[0] || '');
    }
  });
}

if(qbDate) qbDate.addEventListener('change', ()=>{
  if(!qbAvailApplying) qbAvailConfirmed = false;
  if(!qbAvailApplying) qbReleaseAvailabilityHold();
  syncEnd();
  qbRefreshFidelityThenRender();
});

if(staffSel){
  staffSel.dataset.prevValue = String(staffSel.value || '');
  staffSel.addEventListener('change', ()=>{
    const prevStaff = String(staffSel.dataset.prevValue || '');
    const nextStaff = String(staffSel.value || '');
    staffSel.dataset.prevValue = nextStaff;
    qbUpdateDateAvailabilityGate();

    // BUGFIX: the selected availability slot is tied to the selected operator.
    // In create mode, if the user changes the operator after picking a slot,
    // reset the chosen time so they must re-confirm availability for the new operator.
    if(!qbAvailApplying){
      const excludeId = (typeof qbGetExcludeId === 'function') ? String(qbGetExcludeId() || '').trim() : '';
      const inEdit = !!excludeId;
      if(!inEdit){
        const hadSlot = !!((qbStartTime && qbStartTime.value) || (starts && starts.value) || qbAvailConfirmed);
        qbAvailConfirmed = false;
        if(qbStartTime) qbStartTime.value = '';
        if(qbEndTime) qbEndTime.value = '';
        if(starts) starts.value = '';
        if(ends) ends.value = '';
        qbReleaseAvailabilityHold();
        // NOTE: placeholders like '(qualsiasi)' are not real operators.
        // Show the warning only when switching between two real operators.
        if(hadSlot && prevStaff.trim() && nextStaff.trim() && prevStaff !== nextStaff){
          notify('Hai cambiato operatore: seleziona di nuovo una disponibilità', 'warning');
        }
      }
    }

    // Recompute end time / refresh cabins.
    syncEnd();
  });
}
if(qbStartTime) qbStartTime.addEventListener('change', ()=>{
  if(!qbAvailApplying) qbAvailConfirmed = false;
  if(!qbAvailApplying) qbReleaseAvailabilityHold();
  syncEnd();
  qbRefreshFidelityThenRender();
});
// Recompute totals when discount changes
if(qbDiscountType) qbDiscountType.addEventListener('change', qbRefreshFidelityThenRender);
if(qbDiscountValue) qbDiscountValue.addEventListener('input', qbRefreshFidelityThenRender);
if(qbCouponToggle) qbCouponToggle.addEventListener('click', (e)=>{
  e.preventDefault();
  if(qbCouponBox) qbCouponBox.classList.toggle('d-none');
  if(qbCouponBox && !qbCouponBox.classList.contains('d-none') && qbCouponInput){
    try{ qbCouponInput.focus(); } catch(_){ }
  }
});
if(qbCouponApplyBtn) qbCouponApplyBtn.addEventListener('click', async (e)=>{
  e.preventDefault();
  await qbApplyCouponPreview({ preserveInput:true });
});
if(qbCouponRemoveBtn) qbCouponRemoveBtn.addEventListener('click', async (e)=>{
  e.preventDefault();
  qbClearCouponState({ keepInput:false });
  if(qbCouponBox) qbCouponBox.classList.add('d-none');
  try{ await qbRefreshFidelityPreview(); } catch(_){ }
  renderPriceDetails();
});
if(qbCouponInput) qbCouponInput.addEventListener('input', ()=>{
  const typed = qbNormalizeCouponCode(qbCouponInput.value || '');
  const current = qbCouponCode ? qbNormalizeCouponCode(qbCouponCode.value || '') : '';
  if(typed !== current) qbCouponFrozen = false;
});
if(qbCouponInput) qbCouponInput.addEventListener('keydown', async (e)=>{
  if(e.key === 'Enter'){
    e.preventDefault();
    await qbApplyCouponPreview({ preserveInput:true });
  }
});

// Credito cliente (ricariche) - popup Residui
if(qbResidualCreditToggle) qbResidualCreditToggle.addEventListener('change', ()=>{
  if(qbCreditFromBookingInput) qbCreditFromBookingInput.value = '0';
  if(!qbResidualCreditToggle.checked){
    if(qbCreditUseInput) qbCreditUseInput.value = '0';
  } else {
    const current = qbCreditSelectedAmount();
    const maxUse = qbCreditMaxUsable(qbLastDueBeforePayments || 0);
    const next = current > 0.00001 ? Math.min(current, maxUse) : maxUse;
    if(qbCreditUseInput) qbCreditUseInput.value = String(next > 0.00001 ? next : 0);
  }
  renderPriceDetails();
});
if(qbResidualCreditMaxBtn) qbResidualCreditMaxBtn.addEventListener('click', (e)=>{
  e.preventDefault();
  if(qbCreditFromBookingInput) qbCreditFromBookingInput.value = '0';
  const maxUse = qbCreditMaxUsable(qbLastDueBeforePayments || 0);
  if(qbCreditUseInput) qbCreditUseInput.value = String(maxUse > 0.00001 ? maxUse : 0);
  if(qbResidualCreditToggle) qbResidualCreditToggle.checked = maxUse > 0.00001;
  renderPriceDetails();
});
const qbResidualCreditAmountHandler = ()=>{
  if(qbCreditFromBookingInput) qbCreditFromBookingInput.value = '0';
  const raw = qbResidualCreditAmount ? String(qbResidualCreditAmount.value || '').trim() : '';
  let val = raw ? (parseFloat(raw.replace(',', '.')) || 0) : 0;
  val = qbNormMoney(Math.max(0, val));
  const maxUse = qbCreditMaxUsable(qbLastDueBeforePayments || 0);
  if(val > maxUse) val = maxUse;
  if(qbCreditUseInput) qbCreditUseInput.value = String(val > 0.00001 ? val : 0);
  if(qbResidualCreditToggle) qbResidualCreditToggle.checked = val > 0.00001;
  renderPriceDetails();
};
if(qbResidualCreditAmount) qbResidualCreditAmount.addEventListener('change', qbResidualCreditAmountHandler);
if(qbResidualCreditAmount) qbResidualCreditAmount.addEventListener('input', qbResidualCreditAmountHandler);

// GiftCard (credito monetario)
if(qbGiftcardRemoveBtn) qbGiftcardRemoveBtn.addEventListener('click', (e)=>{
  e.preventDefault();
  qbWriteGiftcardRedeem([]);
  renderPriceDetails();
});

// Apri dettagli GiftCard (clic su riga totale)
if(qbGiftcardLabel) qbGiftcardLabel.addEventListener('click', (e)=>{
  e.preventDefault();
  try{
    const gid = parseInt(String(qbGiftcardLabel.dataset.giftcardId || '0'), 10) || 0;
    const amt = parseFloat(String(qbGiftcardLabel.dataset.giftcardAmount || '0').replace(',', '.')) || 0;
    if(gid > 0){
      qbOpenGiftcardInfo(gid, amt);
    }
  }catch(_){ }
});

// Cb controls (backend quick booking)
if(qbCbToggle) qbCbToggle.addEventListener('change', ()=>{
  qbCbTouched = true;
  const checked = !!qbCbToggle.checked;
  if(!checked){
    qbCb.amount = 0;
    qbCb.state = 'canceled';
    if(qbCbUseInput) qbCbUseInput.value = '0';
    renderPriceDetails();
    return;
  }

  // Cb e sconto Punti Fidelity non sono cumulabili: attivando il Cb
  // azzera eventuale sconto punti.
  qbClearFidelityDiscountSelection();

  const max = Math.max(0, parseFloat(String(qbCbPrev.max_usable || 0).replace(',', '.')) || 0);
  let val = 0;
  try{
    val = parseFloat(String((qbCbAmountInput && qbCbAmountInput.value) ? qbCbAmountInput.value : '').replace(',', '.')) || 0;
  } catch(_){ val = 0; }

  if(val <= 0.000001) val = max;
  if(val > max) val = max;
  if(val < 0) val = -val;
  val = Math.round(val * 100) / 100;

  qbCb.amount = val;
  qbCb.state = val > 0.000001 ? 'reserved' : 'canceled';
  if(qbCbAmountInput) qbCbAmountInput.value = val > 0.000001 ? val.toFixed(2) : '';
  renderPriceDetails();
});

if(qbCbAmountInput) qbCbAmountInput.addEventListener('input', ()=>{
  qbCbTouched = true;
  const max = Math.max(0, parseFloat(String(qbCbPrev.max_usable || 0).replace(',', '.')) || 0);
  let val = parseFloat(String(qbCbAmountInput.value || '').replace(',', '.')) || 0;
  if(val < 0) val = -val;
  if(val > max) val = max;
  val = Math.round(val * 100) / 100;

  qbCb.amount = val;
  qbCb.state = val > 0.000001 ? 'reserved' : 'canceled';
  if(qbCbToggle) qbCbToggle.checked = val > 0.000001;
  if(val > 0.000001) qbClearFidelityDiscountSelection();
  renderPriceDetails();
});

if(qbCbMaxBtn) qbCbMaxBtn.addEventListener('click', (e)=>{
  e.preventDefault();
  qbCbTouched = true;
  const max = Math.max(0, parseFloat(String(qbCbPrev.max_usable || 0).replace(',', '.')) || 0);
  const val = Math.round(max * 100) / 100;
  qbCb.amount = val;
  qbCb.state = val > 0.000001 ? 'reserved' : 'canceled';
  if(qbCbToggle) qbCbToggle.checked = val > 0.000001;
  if(qbCbAmountInput) qbCbAmountInput.value = val > 0.000001 ? val.toFixed(2) : '';
  if(val > 0.000001) qbClearFidelityDiscountSelection();
  renderPriceDetails();
});

if(qbFidelityAmountInput) qbFidelityAmountInput.addEventListener('input', ()=>{
  let val = wholePts(qbFidelityAmountInput.value || '');
  if(val < 0) val = -val;
  const maxPts = qbFidelityMaxPointsUsable();
  if(maxPts > 0.000001 && val > maxPts) val = maxPts;
  val = wholePts(val);

  if(val > 0.000001){
    qbCbTouched = true;
    try{
      qbCb.amount = 0;
      qbCb.state = 'canceled';
    } catch(_){ }
    if(qbCbToggle) qbCbToggle.checked = false;
    if(qbCbAmountInput) qbCbAmountInput.value = '';
    if(qbCbUseInput) qbCbUseInput.value = '0';
  }

  if(qbFidelityPointsUse) qbFidelityPointsUse.value = val > 0.000001 ? String(val) : '0';
  try{
    if(qbFid){
      qbFid.points_used = val > 0.000001 ? val : 0;
      qbFid.discount = val > 0.000001 ? qbFidelityDiscountForPoints(val) : 0;
      qbFid.requested_points = val > 0.000001 ? val : 0;
    }
  } catch(_){ }
  if(qbFidelityToggle) qbFidelityToggle.checked = val > 0.000001;
  renderPriceDetails();
  qbScheduleFidelityRefresh();
});

if(qbFidelityMaxBtn) qbFidelityMaxBtn.addEventListener('click', (e)=>{
  e.preventDefault();
  const maxPts = qbFidelityMaxPointsUsable();
  const val = wholePts(maxPts);

  qbCbTouched = true;
  try{
    qbCb.amount = 0;
    qbCb.state = 'canceled';
  } catch(_){ }
  if(qbCbToggle) qbCbToggle.checked = false;
  if(qbCbAmountInput) qbCbAmountInput.value = '';
  if(qbCbUseInput) qbCbUseInput.value = '0';

  if(qbFidelityToggle) qbFidelityToggle.checked = val > 0.000001;
  if(qbFidelityPointsUse) qbFidelityPointsUse.value = val > 0.000001 ? String(val) : '0';
  if(qbFidelityAmountInput) qbFidelityAmountInput.value = val > 0.000001 ? qbFmtPointInputNumber(val) : '';
  try{
    if(qbFid){
      qbFid.points_used = val > 0.000001 ? val : 0;
      qbFid.discount = val > 0.000001 ? qbFidelityDiscountForPoints(val) : 0;
      qbFid.requested_points = val > 0.000001 ? val : 0;
    }
  } catch(_){ }
  renderPriceDetails();
  qbScheduleFidelityRefresh(0);
});

// Scelta sconto (Cb vs Punti Fidelity) quando entrambi sono disponibili
if(qbDiscountChoiceFidelity) qbDiscountChoiceFidelity.addEventListener('change', ()=>{
  if(!qbDiscountChoiceFidelity.checked) return;
  qbCbTouched = true;
  qbCb.amount = 0;
  qbCb.state = 'canceled';
  if(qbCbToggle) qbCbToggle.checked = false;
  if(qbCbAmountInput) qbCbAmountInput.value = '';
  if(qbCbUseInput) qbCbUseInput.value = '0';
  renderPriceDetails();
});

if(qbDiscountChoiceCb) qbDiscountChoiceCb.addEventListener('change', ()=>{
  if(!qbDiscountChoiceCb.checked) return;
  qbCbTouched = true;
  // Cb selezionato: non è cumulabile con lo sconto Punti Fidelity.
  qbClearFidelityDiscountSelection();

  if(qbCbToggle) qbCbToggle.checked = true;
  // Applica un importo di default (max) se possibile
  if(qbCbMaxBtn) qbCbMaxBtn.click();
  else renderPriceDetails();
});

if(qbDiscountChoiceNone) qbDiscountChoiceNone.addEventListener('change', ()=>{
  if(!qbDiscountChoiceNone.checked) return;
  qbCbTouched = true;
  // Non applicare: azzera sia Cb che sconto Punti Fidelity
  try{
    qbCb.amount = 0;
    qbCb.state = 'canceled';
  }catch(_){ }
  if(qbCbToggle) qbCbToggle.checked = false;
  if(qbCbAmountInput) qbCbAmountInput.value = '';
  if(qbCbUseInput) qbCbUseInput.value = '0';
  qbClearFidelityDiscountSelection();
  renderPriceDetails();
});

    async function loadAppointment(id, segmentId){
      const params = new URLSearchParams();
      params.set('page', 'api_appointments');
      params.set('action', 'get');
      params.set('id', String(id||''));
      if(segmentId) params.set('segment_id', String(segmentId));
      const res = await fetch('index.php?' + params.toString());
      const data = await res.json();
      if(!data || !data.ok) throw new Error((data && data.error) ? data.error : 'Errore caricamento');
      return data.appointment;
    }

    async function openEditAppointment(id, segmentId, opts){
      qbReloadPageOnSave = !!(opts && opts.reloadOnSave);
      // Ignore invalid ids (e.g., background/unavailability blocks in calendar)
      const _idStr = String(id || '').trim();
      const _iid = parseInt(_idStr, 10);
      if(!_iid || _iid <= 0){
        return;
      }
      id = String(_iid);

      qbClearPendingCalendarSlot();
      qbLastOpenEditArgs = { id, segmentId: segmentId || null, opts: Object.assign({}, opts || {}) };
      const myOpen = ++qbOpenReqId;
      qbSetLoading(true, 'Caricamento prenotazione...');
      openOffcanvas();
      qbResetForm();
      qbSetModeEdit(id);
      qbAvailConfirmed = true;
      qbAvailApplying = true;
      try{
        const a = await loadAppointment(id, segmentId);
        if(myOpen !== qbOpenReqId) return;

        // Booking code (public_code)
        try{
          const code = (a && a.public_code != null) ? String(a.public_code).trim() : '';
          if(qbBookingCodeRow && qbBookingCode){
            if(code){
              qbBookingCode.textContent = '#' + code;
              qbBookingCodeRow.style.display = 'block';
            } else {
              qbBookingCode.textContent = '';
              qbBookingCodeRow.style.display = 'none';
            }
          }
        } catch(_){ }

        try{
          qbSetExpiredLinkedAlert((a && a.expired_link_warning != null) ? String(a.expired_link_warning) : '');
        } catch(_){ }

        // Segment view (multi-servizio): show warning and keep context for safe saving
        if(a && a.segment_view){
          if(form) form.dataset.segmentView = '1';
          if(segmentIdEl) segmentIdEl.value = String(a.segment_id || '');
          if(segmentOldStartsEl) segmentOldStartsEl.value = String(a.starts_at_local || '');
          if(segmentOldEndsEl) segmentOldEndsEl.value = String(a.ends_at_local || '');
          if(segmentAlertEl){
            segmentAlertEl.textContent = "Prenotazione multi-servizio: stai modificando il servizio dell'operatore selezionato. Le modifiche a servizio/orario/operatore saranno applicate a questo segmento (gli altri servizi restano invariati).";
            segmentAlertEl.style.display = 'block';
          }
        } else {
          if(form) delete form.dataset.segmentView;
          if(segmentIdEl) segmentIdEl.value = '';
          if(segmentOldStartsEl) segmentOldStartsEl.value = '';
          if(segmentOldEndsEl) segmentOldEndsEl.value = '';
          if(segmentAlertEl){ segmentAlertEl.style.display = 'none'; segmentAlertEl.textContent = ''; }
        }
        {
      try{
        qbRemoveVirtualSnapshotServices();
        const lines = Array.isArray(a.service_lines) ? a.service_lines : [];
        for(const ln of lines){
          try{ qbEnsureServiceCheckForSnapshotLine(ln); }catch(_){ }
        }
      }catch(_){ }

      const checks = getAllServiceChecks();
      for(const ch of checks){
        try { qbRestoreServiceMasterData(ch); } catch (_){ }
        ch.checked = false;
      }

      const ids = Array.isArray(a.service_ids) ? a.service_ids.map(String) : (a.service_id != null ? [String(a.service_id)] : []);
      for(const ch of checks){
        if(ids.includes(String(ch.value))) ch.checked = true;
      }

      // Apply stored service snapshot (name + duration + booked prices/item discounts) when available
      try {
        const lines = Array.isArray(a.service_lines) ? a.service_lines : null;
        if(lines){
          const map = {};
          for(const ln of lines){
            if(!ln) continue;
            const sid = String(ln.service_id != null ? ln.service_id : (ln.id != null ? ln.id : '')).trim();
            if(!sid) continue;
            map[sid] = ln;
          }
          for(const ch of checks){
            const sid = String(ch.value || '').trim();
            const ln = map[sid];
            if(!ln) continue;
            qbApplyServiceSnapshotLine(ch, ln);
          }
        }
      } catch (_){ }

      syncHiddenServiceInputs();
      renderPills();
      if(locationSel) {
        locationSel.value = (a.location_id == null) ? '' : String(a.location_id);
      }
      // apply current search filter (if any)
      applyServiceSearchFilter(serviceSearch ? serviceSearch.value : '');
    }


    // Prefill GiftBox selections (if any)
    try{
      const gb = (a && Array.isArray(a.giftbox_redeem)) ? a.giftbox_redeem : [];
      if(qbGiftboxRedeemInput){
        qbGiftboxRedeemInput.value = gb.length ? JSON.stringify(gb) : '';
        qbPruneGiftboxRedeemBySelectedServices();
        // Refresh pills so GiftBox services are visually marked in the "Servizi" field
        try{ renderPills && renderPills(); }catch(_){ }
      }
    }catch(_){
      if(qbGiftboxRedeemInput) qbGiftboxRedeemInput.value = '';
    }


    // Prefill Omaggi selections (if any)
    try{
      const og = (a && Array.isArray(a.gift_redeem)) ? a.gift_redeem : [];
      if(qbGiftRedeemInput){
        qbGiftRedeemInput.value = og.length ? JSON.stringify(og) : '';
        qbPruneGiftRedeemBySelectedServices();
        try{ renderPills && renderPills(); }catch(_){ }
      }
    }catch(_){
      if(qbGiftRedeemInput) qbGiftRedeemInput.value = '';
    }

    // Prefill Pacchetti selections (if any)
    try{
      const pk = (a && Array.isArray(a.package_redeem)) ? a.package_redeem : [];
      if(qbPackageRedeemInput){
        qbPackageRedeemInput.value = pk.length ? JSON.stringify(pk) : '';
        qbPrunePackageRedeemBySelectedServices();
        try{ renderPills && renderPills(); }catch(_){ }
      }
    }catch(_){
      if(qbPackageRedeemInput) qbPackageRedeemInput.value = '';
    }

    // Prefill prepaid services selections (if any)
    try{
      const ps = (a && Array.isArray(a.prepaid_service_redeem)) ? a.prepaid_service_redeem : [];
      if(qbPrepaidServiceRedeemInput){
        qbPrepaidServiceRedeemInput.value = ps.length ? JSON.stringify(ps) : '';
        qbPrunePrepaidServiceRedeemBySelectedServices();
        try{ renderPills && renderPills(); }catch(_){ }
      }
    }catch(_){
      if(qbPrepaidServiceRedeemInput) qbPrepaidServiceRedeemInput.value = '';
    }

    // Prefill GiftCard selection (if any)
    try{
      const gc = (a && Array.isArray(a.giftcard_redeem)) ? a.giftcard_redeem : [];
      qbWriteGiftcardRedeem(gc);
    }catch(_){
      qbWriteGiftcardRedeem([]);
    }


        // Prefill discount (if any) and refresh totals
        if(qbDiscountType){
          const dt = String(a.discount_type || '').trim();
          qbDiscountType.value = (dt === 'percent' || dt === 'fixed') ? dt : '';
        }
        if(qbDiscountValue){
          const dv = a.discount_value;
          const num = (dv == null) ? 0 : Number(dv);
          qbDiscountValue.value = (Number.isFinite(num) && num > 0) ? String(num) : '';
        }

        try{
          const ccode = qbNormalizeCouponCode(a.coupon_code || '');
          const cdisc = qbNormMoney(a.coupon_discount || 0);
          qbCouponFrozen = !!ccode;
          if(qbCouponCode) qbCouponCode.value = ccode;
          if(qbCouponDiscount) qbCouponDiscount.value = String(cdisc);
          if(qbCouponInput){ qbCouponInput.value = ccode; qbCouponInput.readOnly = !!ccode; }
          if(qbCouponBox) qbCouponBox.classList.toggle('d-none', !ccode);
          if(ccode && cdisc > 0.000001) qbSetCouponMessage('Coupon applicato.', true);
          else if(ccode) qbSetCouponMessage('Coupon storico preservato.', true);
          else qbSetCouponMessage('', false);
        } catch(_){ qbClearCouponState({ keepInput:false }); }
        // Prefill Fidelity (se già prenotato su questo appuntamento)
        try{
          const pu = parseFloat(String(a.fidelity_points_used || 0).replace(',', '.')) || 0;
          const fd = parseFloat(String(a.fidelity_discount || 0).replace(',', '.')) || 0;

          const gpu = parseFloat(String(a.fidelity_gift_points_used || 0).replace(',', '.')) || 0;
          const gidxRaw = (a.fidelity_gift_idx !== undefined && a.fidelity_gift_idx !== null) ? String(a.fidelity_gift_idx).trim() : '';
          const gidx = gidxRaw !== '' ? (parseInt(gidxRaw, 10)) : null;

          const choiceRaw = String(a.fidelity_conflict_choice || '').trim().toLowerCase();

          if(qbFidelityPointsUse) qbFidelityPointsUse.value = String(pu > 0 ? pu : 0);
          if(qbFidelityGiftPointsUse) qbFidelityGiftPointsUse.value = String(gpu > 0 ? gpu : 0);
          if(qbFidelityGiftIdx) qbFidelityGiftIdx.value = (gidx !== null && !Number.isNaN(gidx)) ? String(gidx) : '';

          // Se il booking/area clienti ha già salvato una scelta, la mostriamo.
          // In alcuni casi legacy può succedere un'incoerenza (es. choice='later' ma omaggio già prenotato):
          // in quel caso diamo precedenza al dato "reale" salvato sull'appuntamento.
          let c = '';
          if(choiceRaw === 'discount' || choiceRaw === 'gift' || choiceRaw === 'later') c = choiceRaw;

          const hasGiftBooked = (gpu > 0.000001) || (gidx !== null && !Number.isNaN(gidx));
          const hasDiscountBooked = (fd > 0.000001) && (pu > 0.000001);
          const hasAnyFidelityBooked = hasGiftBooked || hasDiscountBooked;

          // Se è stato prenotato un omaggio/sconto, la scelta non può essere "later".
          if(c === 'later'){
            if(hasGiftBooked) c = 'gift';
            else if(hasDiscountBooked) c = 'discount';
          }

          // Se non c'è una scelta valida salvata, inferisci solo quando abbiamo evidenza di prenotazione.
          if(!c){
            if(hasGiftBooked) c = 'gift';
            else if(hasDiscountBooked) c = 'discount';
          }

          if(typeof qbSetFidelityChoice === 'function'){
            if(c) qbSetFidelityChoice(c);
            else qbSetFidelityChoice('');
          }

          // Normalizza i campi hidden in base alla scelta (importante per "later")
          try{ if(typeof qbApplyFidelityChoice === 'function' && c) qbApplyFidelityChoice(c); }catch(_){ }

          // BUGFIX quick booking edit: quando una prenotazione ha già uno sconto punti
          // associato, il primo render del drawer non deve azzerarlo prima che arrivi
          // la preview completa dal backend. Per questo precompiliamo anche lo stato
          // minimo della Fidelity e sincronizziamo subito toggle/input.
          let fidAvail = 0;
          try{ fidAvail = parseFloat(String(a.fidelity_available_points ?? 0).replace(',', '.')) || 0; }catch(_){ fidAvail = 0; }
          if(hasAnyFidelityBooked && fidAvail < (pu + gpu)) fidAvail = Math.round((pu + gpu) * 100) / 100;

          let fidEuroPerPoint = 0;
          try{ fidEuroPerPoint = parseFloat(String(a.fidelity_redeem_euro_per_point ?? 0).replace(',', '.')) || 0; }catch(_){ fidEuroPerPoint = 0; }
          if(!(fidEuroPerPoint > 0.000001) && pu > 0.000001 && fd > 0.000001){
            fidEuroPerPoint = Math.round((fd / pu) * 10000) / 10000;
          }

          qbFid.enabled = !!(a && a.fidelity_enabled) || hasAnyFidelityBooked;
          qbFid.readonly_existing = (!!hasAnyFidelityBooked && !(a && a.fidelity_enabled));
          qbFid.label = (a && a.fidelity_label) ? String(a.fidelity_label) : 'Punti';
          qbFid.redeem_enabled = !!(a && a.fidelity_redeem_enabled) || hasAnyFidelityBooked;
          qbFid.available_points = Math.max(0, Math.round(fidAvail * 100) / 100);
          qbFid.euro_per_point = fidEuroPerPoint > 0.000001 ? fidEuroPerPoint : 0;
          qbFid.points_used = pu;
          qbFid.discount = fd;
          qbFid.error = null;

          if(qbFidelityToggle) qbFidelityToggle.checked = hasDiscountBooked;
          if(qbFidelityAmountInput && hasDiscountBooked) qbFidelityAmountInput.value = qbFmtPointInputNumber(pu);
        } catch(_){ }
        qbCb.amount = 0;
        qbCb.state = '';

        // Se l'appuntamento è stato creato dal booking/area clienti con una scelta sconto,
        // pre-selezioniamo la stessa opzione nel backend.
        // (Default HTML = "Punti Fidelity", quindi senza questa logica i record con Cb
        // prenotato verrebbero mostrati come "Punti" anche se in realtà è stato scelto Cb.)
        try{
          const pu2 = (parseFloat(String(a.fidelity_points_used || 0).replace(',', '.')) || 0);
          const fd2 = (parseFloat(String(a.fidelity_discount || 0).replace(',', '.')) || 0);
          const gpu2 = (parseFloat(String(a.fidelity_gift_points_used || 0).replace(',', '.')) || 0);
          const hasFid2 = (pu2 > 0.000001) || (fd2 > 0.000001) || (gpu2 > 0.000001);

          let sel2 = '';
          if(hasFid2) sel2 = 'fidelity';
          else sel2 = 'none';

          if(qbDiscountChoiceCb) qbDiscountChoiceCb.checked = false;
          if(qbDiscountChoiceFidelity) qbDiscountChoiceFidelity.checked = (sel2 === 'fidelity');
          if(qbDiscountChoiceNone) qbDiscountChoiceNone.checked = (sel2 === 'none');
        } catch(_){ }

        // Prefill Credito (se già prenotato su questo appuntamento)
        try{
          const cu = parseFloat(String(a.credit_used || 0).replace(',', '.')) || 0;
          const fromBk = (a.credit_use_from_booking !== undefined && a.credit_use_from_booking !== null) ? (parseInt(String(a.credit_use_from_booking), 10) || 0) : 0;

          if(qbCreditFromBookingInput) qbCreditFromBookingInput.value = fromBk ? '1' : '0';

          if(cu > 0.000001){
            qbCreditPrev = { enabled:true, available: Math.round(cu * 100) / 100 };
            if(qbCreditUseInput) qbCreditUseInput.value = String(Math.round(cu * 100) / 100);
          } else {
            if(qbCreditUseInput) qbCreditUseInput.value = '0';
          }
          try{ qbSyncResidualCreditUi(); }catch(_){ }
        } catch(_){ }

        renderPriceDetails();
        const selIds = (Array.isArray(a.service_ids) ? a.service_ids.map(String) : []);
        const first = selIds[0] || (a.service_id != null ? String(a.service_id) : '');

// Multi-servizio: selezione operatore per ogni servizio (view completa)
const isMultiService = !!(a && !a.segment_view && selIds.length > 1);
if(isMultiService){
  const prefill = {};
  if(Array.isArray(a?.segment_staff)){
    for(const sg of a.segment_staff){
      const svc = String(sg?.service_id ?? '').trim();
      const stid = String(sg?.staff_id ?? '').trim();
      if(svc && stid && stid !== '0') prefill[svc] = stid;
    }
  }
  await renderMultiStaffPicker(selIds, prefill);
  if(myOpen !== qbOpenReqId) return;
} else {
  setMultiStaffMode(false);

  // Fallback: multi-staff detection (legacy)
  let multiNames = Array.isArray(a?.staff_names) ? a.staff_names.filter(Boolean) : [];
  if(multiNames.length <= 1 && Array.isArray(a?.segment_staff)){
    const seen = new Set();
    const names = [];
    for(const sg of a.segment_staff){
      const sid = String(sg?.staff_id ?? '');
      if(!sid || sid==='0' || seen.has(sid)) continue;
      seen.add(sid);
      const nm = String(sg?.staff_name ?? '').trim() || (sid ? `Operatore #${sid}` : '');
      if(nm) names.push(nm);
    }
    multiNames = names;
  }

  const isMultiStaff = !!(a && !a.segment_view && multiNames.length > 1);
  if(isMultiStaff){
    if(staffSummaryBox){
      staffSummaryBox.textContent = (a?.staff_summary && String(a.staff_summary).trim() !== '') ? String(a.staff_summary) : multiNames.join(', ');
      staffSummaryBox.style.display = 'block';
    }
    if(staffSummaryHint) staffSummaryHint.style.display = 'block';
    if(staffSel){
      staffSel.innerHTML = '<option value="">(operatori multipli)</option>';
      staffSel.value = '';
      staffSel.disabled = true;
      staffSel.style.display = 'none';
    }
  } else {
    if(staffSummaryBox){ staffSummaryBox.style.display = 'none'; staffSummaryBox.textContent = ''; }
    if(staffSummaryHint) staffSummaryHint.style.display = 'none';
    if(staffSel){ staffSel.style.display = ''; staffSel.disabled = false; }
    await refreshStaffForService(first, a.staff_id == null ? '' : String(a.staff_id));
    if(myOpen !== qbOpenReqId) return;
  }
}

        qbOriginalStatus = a.status || 'scheduled';
        try{ qbApplyStatusSelectConstraints(qbOriginalStatus, a.status || 'scheduled'); }catch(_){ if(statusSel) statusSel.value = a.status || 'scheduled'; }
        try{ qbApplyCancellationState(a); }catch(_){ }
        if(staffNotesEl) staffNotesEl.value = (a.staff_notes ?? '') || '';
        if(customerNotesEl) customerNotesEl.value = (a.customer_notes ?? '') || '';
        // Populate visible date/time fields
        {
          const sp = splitDtLocal(a.starts_at_local || '');
          if(qbDate) qbDate.value = sp.date;
          if(qbStartTime) qbStartTime.value = sp.time;
        }
        // Keep hidden values + computed end time in sync
        if(starts) starts.value = a.starts_at_local || '';
        if(ends) ends.value = a.ends_at_local || '';
        {
          const ep = splitDtLocal(a.ends_at_local || '');
          if(qbEndTime) qbEndTime.value = ep.time;
        }
        if(myOpen !== qbOpenReqId) return;
        // Re-apply edit state (protects from rare mid-load resets)
        try{ if(apptIdEl) apptIdEl.value = String(id||''); }catch(_){ }
        qbEditingId = String(id||'');
        try{ if(form) form.dataset.editingId = qbEditingId; }catch(_){ }
        qbAvailApplying = false;
        qbAvailConfirmed = true;

        // If services selected changed duration, recompute end
        syncEnd();

        // Prefill cabin (if any)
        try{
          if(myOpen !== qbOpenReqId) return;
          qbAvailConfirmed = true;
          await refreshCabinsForServices(a.cabin_id == null ? '' : String(a.cabin_id));
        } catch(_){ }

        qbSetSelected({
          id: a.client_id,
          full_name: a.client_full_name,
          email: a.client_email,
          phone: a.client_phone
        });
        try{ qbApplyCancellationState(a); }catch(_){ }
        try{ await qbRefreshFidelityThenRender(); }catch(_){ try{ renderPriceDetails(); }catch(__){} }
        if(myOpen !== qbOpenReqId) return;
        qbSetLoadReady();
      } catch(err){
        if(myOpen !== qbOpenReqId) return;
        qbAvailApplying = false;
        qbAvailConfirmed = false;
        const msg = err?.message || 'Errore caricamento appuntamento';
        qbSetLoadError(msg);
        notify(msg, 'danger');
      }
    }

    function qbNormalizeCalendarSlot(slot){
      if(!slot || typeof slot !== 'object') return null;
      const date = String(slot.date || slot.day || '').trim().slice(0, 10);
      const rawTime = String(slot.time || slot.startTime || '').trim();
      const time = rawTime ? rawTime.slice(0, 5) : '';
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
      return {
        date,
        time,
        staffId: String(slot.staffId || slot.staff_id || '').trim()
      };
    }

    function qbClearPendingCalendarSlot(){
      qbPendingCalendarSlot = null;
      if(qbCalendarSlotApplyTimer){
        clearTimeout(qbCalendarSlotApplyTimer);
        qbCalendarSlotApplyTimer = null;
      }
      qbCalendarSlotApplySeq += 1;
      qbSetCabinFieldLoading(false);
    }

    function qbSetCabinHintText(message, loading){
      if(!cabinHintEl) return;
      const text = String(message || '').trim() || 'Seleziona prima la disponibilita (giorno e ora) per vedere le cabine disponibili.';
      cabinHintEl.classList.toggle('qb-hint-loading', !!loading);
      try{ cabinHintEl.setAttribute('aria-live', loading ? 'polite' : 'off'); }catch(_){ }

      while(cabinHintEl.firstChild){
        cabinHintEl.removeChild(cabinHintEl.firstChild);
      }

      if(loading){
        const spinner = document.createElement('span');
        spinner.className = 'spinner-border spinner-border-sm text-primary qb-inline-loader';
        spinner.setAttribute('aria-hidden', 'true');
        cabinHintEl.appendChild(spinner);
      }

      const label = document.createElement('span');
      label.textContent = text;
      cabinHintEl.appendChild(label);
    }

    function qbCalendarSlotSetCabinWaiting(message, checking){
      const text = String(message || '').trim();
      if(cabinSel){
        qbSetCabinFieldLoading(!!checking);
        qbSetCabinFieldMuted(!checking);
        setCabinSelectPlaceholder(checking ? 'Verifico disponibilita...' : 'Slot calendario in attesa...');
        cabinSel.disabled = true;
      }
      qbSetCabinHintText(text, checking);
    }

    function qbIsCabinAvailabilityError(message){
      const text = String(message || '').toLowerCase();
      return text.indexOf('cabin') !== -1
        && (
          text.indexOf('nessuna') !== -1
          || text.indexOf('occupata') !== -1
          || text.indexOf('disponibile') !== -1
          || text.indexOf('configurata') !== -1
        );
    }

    function qbCalendarSlotSetCabinUnavailable(message){
      qbClearPendingCalendarSlot();
      qbAvailConfirmed = false;
      if(cabinSel){
        setCabinSelectPlaceholder('Nessuna cabina disponibile');
        cabinSel.disabled = true;
        qbSetCabinFieldMuted(true);
      }
      qbSetCabinHintText(
        String(message || '').trim() || 'Nessuna cabina disponibile per l\'orario selezionato.',
        false
      );
    }

    function qbCalendarSlotPrefillFields(slot){
      const prevApplying = qbAvailApplying;
      qbAvailApplying = true;
      try{
        if(qbDate) qbDate.value = slot.date;
        if(qbStartTime) qbStartTime.value = slot.time;
        try{ qbCalendarSlotApplyStaff(slot); }catch(_){ }
        try{ syncEnd(); }catch(_){ }
      } finally {
        qbAvailApplying = prevApplying;
      }
    }

    function qbCalendarSlotApplyStaff(slot){
      const wantedStaff = String(slot && slot.staffId || '').trim();
      if(!wantedStaff) return true;
      if(!staffSel || staffSel.style.display === 'none') return true;
      const opt = Array.from(staffSel.options || []).find(o => String(o.value || '') === wantedStaff && !o.disabled);
      if(opt){
        staffSel.value = wantedStaff;
        try{ staffSel.dataset.prevValue = wantedStaff; }catch(_){ }
        return true;
      }
      return getSelectedServiceIds().length === 0;
    }

    function qbPendingCalendarSlotReason(slot){
      const ids = getSelectedServiceIds();
      if(!ids.length) return 'Seleziona un servizio per verificare lo slot scelto dal calendario.';
      if(!qbCalendarSlotApplyStaff(slot)) return 'L\'operatore dello slot selezionato non e disponibile per il servizio scelto.';
      if(!qbIsOperatorSelectionComplete()) return 'Seleziona gli operatori per verificare lo slot scelto dal calendario.';
      return '';
    }

    function qbSchedulePendingCalendarSlotApply(delayMs){
      if(!qbPendingCalendarSlot) return;
      if(qbCalendarSlotApplyTimer) clearTimeout(qbCalendarSlotApplyTimer);
      qbCalendarSlotApplyTimer = setTimeout(()=>{
        qbCalendarSlotApplyTimer = null;
        qbApplyPendingCalendarSlot();
      }, Math.max(0, Number(delayMs || 0)));
    }

    async function qbApplyPendingCalendarSlot(){
      const slot = qbNormalizeCalendarSlot(qbPendingCalendarSlot);
      if(!slot){ qbClearPendingCalendarSlot(); return false; }
      qbPendingCalendarSlot = slot;

      if(qbIsHydrating){
        qbSchedulePendingCalendarSlotApply(120);
        return false;
      }
      if(qbAvailApplying){
        qbSchedulePendingCalendarSlotApply(120);
        return false;
      }

      qbCalendarSlotPrefillFields(slot);
      const reason = qbPendingCalendarSlotReason(slot);
      if(reason){
        qbAvailConfirmed = false;
        qbCalendarSlotSetCabinWaiting(reason, false);
        return false;
      }

      const seq = ++qbCalendarSlotApplySeq;
      qbAvailApplying = true;
      qbUpdateDateAvailabilityGate({ schedulePendingCalendarSlot: false });
      qbCalendarSlotSetCabinWaiting('Verifico lo slot selezionato dal calendario.', true);
      try{
        const hold = await qbCreateAvailabilityHold(slot.date, slot.time);
        if(seq !== qbCalendarSlotApplySeq) return false;

        qbAvailConfirmed = true;
        if(qbDate) qbDate.value = slot.date;
        if(qbStartTime) qbStartTime.value = slot.time;
        syncEnd();
        qbApplyAvailabilityHoldAllocation(hold);

        const preferredCabin = qbPreferredCabinIdFromHold(hold) || (cabinSel && cabinSel.getAttribute ? cabinSel.getAttribute('data-current') : undefined);
        try{ await refreshCabinsForServices(preferredCabin); }catch(_){ }

        qbPendingCalendarSlot = null;
        if(qbCalendarSlotApplyTimer){
          clearTimeout(qbCalendarSlotApplyTimer);
          qbCalendarSlotApplyTimer = null;
        }
        try{ qbRefreshFidelityThenRender(); }catch(_){ }
        return true;
      } catch(err){
        if(seq === qbCalendarSlotApplySeq){
          qbAvailConfirmed = false;
          const msg = (err && err.message) ? String(err.message) : 'Lo slot selezionato non e piu disponibile. Scegli una disponibilita.';
          if(qbIsCabinAvailabilityError(msg)){
            qbCalendarSlotSetCabinUnavailable(msg);
          } else {
            qbCalendarSlotSetCabinWaiting(msg, false);
          }
          notify(msg, 'warning');
        }
        return false;
      } finally {
        qbAvailApplying = false;
        qbSetCabinFieldLoading(!!qbPendingCalendarSlot && !qbAvailConfirmed);
        qbUpdateDateAvailabilityGate({ schedulePendingCalendarSlot: false });
      }
    }

    async function openNewAppointmentFromCalendarSlot(slot){
      const normalized = qbNormalizeCalendarSlot(slot);
      if(!normalized) return openNewAppointment();
      qbPendingCalendarSlot = normalized;
      const expectedOpenReq = qbOpenReqId + 1;
      await openNewAppointment({ keepCalendarSlot: true });
      if(qbOpenReqId !== expectedOpenReq) return;
      qbPendingCalendarSlot = normalized;
      qbCalendarSlotPrefillFields(normalized);
      qbSchedulePendingCalendarSlotApply(80);
    }

    async function openNewAppointment(options){
      const opts = Object.assign({ keepCalendarSlot: false }, options || {});
      if(!opts.keepCalendarSlot) qbClearPendingCalendarSlot();
      qbLastOpenEditArgs = null;
      const myOpen = ++qbOpenReqId;
      qbSetLoading(true, 'Preparo nuova prenotazione...');
      openOffcanvas();

      try{
        qbResetForm();

        // default start now rounded (for each new open)
        try{
          const now = new Date();
          now.setMinutes(Math.ceil(now.getMinutes()/15)*15);
          const pad = n => String(n).padStart(2,'0');
          const d = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
          const t = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
          if(qbDate) qbDate.value = d;
          if(qbStartTime) qbStartTime.value = t;
          syncEnd();
        } catch(_){ }
        // reset staff list
        applyServiceSearchFilter('');
        setMultiStaffMode(false);
        await refreshStaffForService('');
        if(myOpen !== qbOpenReqId) return;
        qbUpdateDateAvailabilityGate();
        qbSetLoadReady();
      } catch(err){
        if(myOpen !== qbOpenReqId) return;
        const msg = err?.message || 'Errore preparazione prenotazione';
        qbSetLoadError(msg);
        notify(msg, 'danger');
      }
    }

    // Delegated triggers (appointments list / calendar / ...)
    document.addEventListener('click', (e)=>{
      const editBtn = e.target.closest('[data-qb-edit]');
      if(editBtn){
        e.preventDefault();
        const id = editBtn.getAttribute('data-qb-edit');
        const seg = editBtn.getAttribute('data-qb-segment');
        const reloadOnSave = editBtn.getAttribute('data-qb-reload-on-save') === '1';
        openEditAppointment(id, seg || null, { reloadOnSave });
        return;
      }
      const newBtn = e.target.closest('[data-qb-new]');
      if(newBtn){
        e.preventDefault();
        openNewAppointment();
      }
    });

    // Expose helper for pages that prefer calling directly
    window.qbOpenEditAppointment = openEditAppointment;
    window.qbOpenNewAppointment = openNewAppointment;
    window.qbOpenNewAppointmentFromCalendarSlot = openNewAppointmentFromCalendarSlot;

    // Availability modal
    const availBtn = qs('#qbAvailabilityBtn');
    const availModalEl = qs('#qbAvailabilityModal');
    const availWrap = qs('#qbAvailWrap');
    const availRangeEl = qs('#qbAvailRange');
    const availPrevPeriodBtn = qs('#qbAvailPrevPeriod');
    const availTodayBtn = qs('#qbAvailToday');
    const availNextPeriodBtn = qs('#qbAvailNextPeriod');
    const availModeBtns = qsa('[data-qb-avail-mode]');
    const availPickerBtn = qs('#qbAvailPickerBtn');
    const availPickerHost = availPickerBtn ? availPickerBtn.closest('.qb-avail-picker-host') : null;
    let availModal = null;
    // Tooltip perf note:
    // There can be thousands of slots. Creating/disposing Bootstrap tooltips for
    // every slot on each append causes UI freezes. We'll init tooltips lazily on
    // first hover and dispose them only when the modal closes.
    let availTooltips = new WeakMap();
    let availTooltipEls = new Set();

    // Infinite scroll: use IntersectionObserver on a sentinel for smoother loading
    let availObserver = null;

    // Infinite scroll state for availability
    let qbAvailLoadingMore = false;
    let qbAvailNextDate = null; // YYYY-MM-DD (day after the last day currently rendered)
    let qbAvailDayStart = null;
    let qbAvailDayEnd = null;
    let qbAvailMode = 'week';
    let qbAvailAnchorDate = null;
    let qbAvailRequestSeq = 0;
    let qbAvailPeriodLoading = false;
    let qbAvailAutoRefreshTimer = null;
    let qbAvailPickerEl = null;
    let qbAvailPickerCursor = null;
    let qbAvailPickerOutsideBound = false;

    if(availModalEl && window.bootstrap) availModal = new bootstrap.Modal(availModalEl);

    function isAvailModalOpen(){
      return !!(availModalEl && availModalEl.classList.contains('show'));
    }

    function qbAvailRefreshIntervalMs(mode){
      if(mode === 'day') return 10000;
      if(mode === 'month') return 30000;
      return 20000;
    }

    function stopAvailAutoRefresh(){
      if(qbAvailAutoRefreshTimer){
        clearTimeout(qbAvailAutoRefreshTimer);
        qbAvailAutoRefreshTimer = null;
      }
    }

    function scheduleAvailAutoRefresh(){
      stopAvailAutoRefresh();
      if(!isAvailModalOpen()) return;
      if(document.hidden) return;
      if(!qbAvailAnchorDate) return;

      qbAvailAutoRefreshTimer = setTimeout(()=>{
        qbAvailAutoRefreshTimer = null;
        if(!isAvailModalOpen() || document.hidden){
          scheduleAvailAutoRefresh();
          return;
        }
        if(qbAvailPeriodLoading || qbAvailLoadingMore){
          scheduleAvailAutoRefresh();
          return;
        }
        loadAvailabilityPeriod(qbAvailAnchorDate, qbAvailMode, { silent: true, auto: true });
      }, qbAvailRefreshIntervalMs(qbAvailMode));
    }

    function pad2(n){ return String(n).padStart(2,'0'); }
    function minutesBetween(a,b){ return Math.max(0, Math.round((b-a)/60000)); }

    // Platform date display format: GG/MM/AAAA
    // Internal values remain YYYY-MM-DD for API + HTML date inputs, but every
    // date shown to the user should be DD/MM/YYYY.
    function formatDMY(ymd){
      try{
        const s = String(ymd || '').trim();
        const m = s.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);
        if(!m) return s;
        return `${m[3]}/${m[2]}/${m[1]}`;
      } catch(_){
        return String(ymd || '');
      }
    }

    function formatItDayMonth(dateStr){
      // dateStr: YYYY-MM-DD
      try{
        const d = new Date(dateStr + 'T00:00:00');
        if(Number.isNaN(d.getTime())) return dateStr;
        const fmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long' });
        const s = fmt.format(d); // e.g. "31 dicembre"
        // Capitalize month ("Dicembre") to match UI screenshot
        return s.replace(/\b([a-zàèéìòù])/, (m)=>m.toUpperCase());
      } catch(_){
        return dateStr;
      }
    }

    function localYMD(d){
      try{
        const y = d.getFullYear();
        const m = pad2(d.getMonth()+1);
        const da = pad2(d.getDate());
        return `${y}-${m}-${da}`;
      } catch(_){
        return '';
      }
    }

    function dateFromYMD(ymd){
      const d = new Date(String(ymd || '') + 'T00:00:00');
      return Number.isNaN(d.getTime()) ? null : d;
    }

    function addDaysYMD(ymd, delta){
      const d = dateFromYMD(ymd);
      if(!d) return ymd;
      d.setDate(d.getDate() + delta);
      return localYMD(d);
    }

    function firstOfMonthYMD(ymd){
      const d = dateFromYMD(ymd);
      if(!d) return ymd;
      d.setDate(1);
      return localYMD(d);
    }

    function addMonthsYMD(ymd, delta){
      const d = dateFromYMD(ymd);
      if(!d) return ymd;
      d.setDate(1);
      d.setMonth(d.getMonth() + delta);
      return localYMD(d);
    }

    function startOfWeekYMD(ymd){
      const d = dateFromYMD(ymd);
      if(!d) return ymd;
      const dow = (d.getDay() + 6) % 7; // Monday = 0
      d.setDate(d.getDate() - dow);
      return localYMD(d);
    }

    function startOfMonthDate(d){
      return new Date(d.getFullYear(), d.getMonth(), 1);
    }

    function startOfYearDate(d){
      return new Date(d.getFullYear(), 0, 1);
    }

    function endOfMonthDate(d){
      return new Date(d.getFullYear(), d.getMonth() + 1, 0);
    }

    function addDaysDate(d, days){
      const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      out.setDate(out.getDate() + days);
      return out;
    }

    function startOfWeekDate(d){
      const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dow = (out.getDay() + 6) % 7;
      out.setDate(out.getDate() - dow);
      return out;
    }

    function diffDaysDate(a,b){
      const aa = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
      const bb = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
      return Math.round((aa - bb) / 86400000);
    }

    function sameAvailDate(a,b){
      return !!(a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate());
    }

    function sameAvailMonth(a,b){
      return !!(a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth());
    }

    function availDateInRange(start,end,d){
      return diffDaysDate(d, start) >= 0 && diffDaysDate(d, end) <= 0;
    }

    function availCap(str){
      str = String(str || '');
      return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
    }

    function availLongMonthYear(d){
      try{ return new Intl.DateTimeFormat('it-IT', { month:'long', year:'numeric' }).format(d); }catch(_){ return ''; }
    }

    function availLongYear(d){
      try{ return new Intl.DateTimeFormat('it-IT', { year:'numeric' }).format(d); }catch(_){ return String(d && d.getFullYear ? d.getFullYear() : ''); }
    }

    function availLongMonth(d){
      try{ return new Intl.DateTimeFormat('it-IT', { month:'long' }).format(d); }catch(_){ return ''; }
    }

    function availShortMonth(d){
      try{ return new Intl.DateTimeFormat('it-IT', { month:'short' }).format(d).replace('.', ''); }catch(_){ return ''; }
    }

    function availLongDate(d){
      try{ return new Intl.DateTimeFormat('it-IT', { weekday:'long', day:'numeric', month:'long', year:'numeric' }).format(d); }catch(_){ return ''; }
    }

    function availWeekRangeShort(start,end){
      return `${start.getDate()}-${end.getDate()}`;
    }

    function availWeekRangeSub(start,end){
      if(sameAvailMonth(start,end)) return availCap(availLongMonth(start));
      if(start.getFullYear() === end.getFullYear()) return `${availCap(availShortMonth(start))} - ${availCap(availShortMonth(end))}`;
      return `${availCap(availShortMonth(start))} ${start.getFullYear()} - ${availCap(availShortMonth(end))} ${end.getFullYear()}`;
    }

    function availWeekRangeLong(start,end){
      if(sameAvailMonth(start,end)) return `${start.getDate()} - ${end.getDate()} ${availLongMonth(end)} ${end.getFullYear()}`;
      if(start.getFullYear() === end.getFullYear()) return `${start.getDate()} ${availLongMonth(start)} - ${end.getDate()} ${availLongMonth(end)} ${end.getFullYear()}`;
      return `${start.getDate()} ${availLongMonth(start)} ${start.getFullYear()} - ${end.getDate()} ${availLongMonth(end)} ${end.getFullYear()}`;
    }

    function availPickerConfig(mode){
      const map = {
        day: { dialog:'Seleziona una data', navPrev:'Mese precedente', navNext:'Mese successivo', today:'Oggi' },
        week: { dialog:'Seleziona una settimana', navPrev:'Mese precedente', navNext:'Mese successivo', today:'Questa settimana' },
        month: { dialog:'Seleziona un mese', navPrev:'Anno precedente', navNext:'Anno successivo', today:'Questo mese' }
      };
      return map[mode] || map.day;
    }

    function availPickerFocusDate(){
      return dateFromYMD(qbAvailAnchorDate) || (qbDate && dateFromYMD(qbDate.value)) || new Date();
    }

    function normalizeAvailPickerCursor(mode, dt){
      const base = (dt instanceof Date && !Number.isNaN(dt.getTime())) ? dt : availPickerFocusDate();
      return mode === 'month' ? startOfYearDate(base) : startOfMonthDate(base);
    }

    function getAvailPickerCursor(){
      return normalizeAvailPickerCursor(qbAvailMode, qbAvailPickerCursor || availPickerFocusDate());
    }

    function setAvailPickerCursor(dt){
      qbAvailPickerCursor = normalizeAvailPickerCursor(qbAvailMode, dt);
    }

    function shiftAvailPickerCursor(dir){
      const base = getAvailPickerCursor();
      if(qbAvailMode === 'month'){
        qbAvailPickerCursor = new Date(base.getFullYear() + (dir === 'prev' ? -1 : 1), 0, 1);
      } else {
        qbAvailPickerCursor = new Date(base.getFullYear(), base.getMonth() + (dir === 'prev' ? -1 : 1), 1);
      }
    }

    function closeAvailDatePicker(){
      if(qbAvailPickerEl) qbAvailPickerEl.hidden = true;
      if(availPickerBtn) availPickerBtn.classList.remove('active');
    }

    function positionAvailDatePicker(){
      if(!qbAvailPickerEl || qbAvailPickerEl.hidden || !availPickerBtn) return;
      const rect = availPickerBtn.getBoundingClientRect();
      const margin = 12;
      const gap = 8;
      const viewportW = window.innerWidth || document.documentElement.clientWidth || 0;
      const viewportH = window.innerHeight || document.documentElement.clientHeight || 0;
      const width = Math.min(qbAvailPickerEl.offsetWidth || 336, Math.max(0, viewportW - (margin * 2)));
      const height = qbAvailPickerEl.offsetHeight || 0;
      let left = rect.right - width;
      left = Math.max(margin, Math.min(left, viewportW - margin - width));
      let top = rect.bottom + gap;
      if(top + height > viewportH - margin){
        const above = rect.top - height - gap;
        top = above >= margin ? above : Math.max(margin, viewportH - margin - height);
      }
      qbAvailPickerEl.style.left = `${Math.round(left)}px`;
      qbAvailPickerEl.style.top = `${Math.round(top)}px`;
    }

    function makeAvailPickerButton(className, targetDate, ariaLabel){
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = className;
      btn.setAttribute('role', 'gridcell');
      btn.setAttribute('data-qb-avail-picker-date', localYMD(targetDate));
      if(ariaLabel) btn.setAttribute('aria-label', ariaLabel);
      return btn;
    }

    function renderAvailPickerDays(grid, cursor, focus, today){
      const first = startOfMonthDate(cursor);
      const firstWeekday = (first.getDay() + 6) % 7;
      const gridStart = addDaysDate(first, -firstWeekday);
      for(let i=0; i<42; i++){
        const cellDate = addDaysDate(gridStart, i);
        const btn = makeAvailPickerButton('calendar-mini-picker__day', cellDate, availLongDate(cellDate));
        btn.textContent = String(cellDate.getDate());
        if(cellDate.getMonth() !== cursor.getMonth()) btn.classList.add('is-outside');
        if(sameAvailDate(cellDate, today)) btn.classList.add('is-today');
        if(sameAvailDate(cellDate, focus)) btn.classList.add('is-selected');
        grid.appendChild(btn);
      }
    }

    function renderAvailPickerWeeks(grid, cursor, focus, today){
      const first = startOfMonthDate(cursor);
      const last = endOfMonthDate(cursor);
      let weekStart = startOfWeekDate(first);
      const focusWeek = startOfWeekDate(focus);
      while(diffDaysDate(weekStart, last) <= 0){
        const weekEnd = addDaysDate(weekStart, 6);
        const btn = makeAvailPickerButton('calendar-mini-picker__week', weekStart, `Settimana ${availWeekRangeLong(weekStart, weekEnd)}`);
        const main = document.createElement('span');
        main.className = 'calendar-mini-picker__item-main';
        main.textContent = availWeekRangeShort(weekStart, weekEnd);
        const sub = document.createElement('span');
        sub.className = 'calendar-mini-picker__item-sub';
        sub.textContent = availWeekRangeSub(weekStart, weekEnd);
        btn.appendChild(main);
        btn.appendChild(sub);
        if(availDateInRange(weekStart, weekEnd, today)) btn.classList.add('is-today');
        if(sameAvailDate(weekStart, focusWeek)) btn.classList.add('is-selected');
        grid.appendChild(btn);
        weekStart = addDaysDate(weekStart, 7);
      }
    }

    function renderAvailPickerMonths(grid, cursor, focus, today){
      for(let i=0; i<12; i++){
        const monthDate = new Date(cursor.getFullYear(), i, 1);
        const btn = makeAvailPickerButton('calendar-mini-picker__month', monthDate, availCap(availLongMonthYear(monthDate)));
        btn.textContent = availCap(availShortMonth(monthDate));
        if(sameAvailMonth(monthDate, today)) btn.classList.add('is-today');
        if(sameAvailMonth(monthDate, focus)) btn.classList.add('is-selected');
        grid.appendChild(btn);
      }
    }

    function ensureAvailDatePicker(){
      if(qbAvailPickerEl) return qbAvailPickerEl;
      if(!availPickerBtn) return null;

      const pop = document.createElement('div');
      pop.id = 'qbAvailDatePickerPopover';
      pop.className = 'qb-avail-picker';
      pop.hidden = true;
      pop.setAttribute('role', 'dialog');
      pop.setAttribute('aria-modal', 'false');
      pop.innerHTML = `
        <div class="calendar-mini-picker__header">
          <button type="button" class="calendar-mini-picker__nav-btn" data-qb-avail-picker-nav="prev" aria-label="Periodo precedente">
            <i class="bi bi-chevron-left"></i>
          </button>
          <div class="calendar-mini-picker__current-label" data-qb-avail-picker-current aria-live="polite"></div>
          <button type="button" class="calendar-mini-picker__nav-btn" data-qb-avail-picker-nav="next" aria-label="Periodo successivo">
            <i class="bi bi-chevron-right"></i>
          </button>
        </div>
        <div class="calendar-mini-picker__weekdays" data-qb-avail-picker-weekdays aria-hidden="true">
          <span>Lun</span><span>Mar</span><span>Mer</span><span>Gio</span><span>Ven</span><span>Sab</span><span>Dom</span>
        </div>
        <div class="calendar-mini-picker__grid" data-qb-avail-picker-grid role="grid"></div>
        <div class="calendar-mini-picker__footer">
          <div class="calendar-mini-picker__selected" data-qb-avail-picker-selected>Periodo selezionato</div>
          <button type="button" class="calendar-mini-picker__today-btn" data-qb-avail-picker-action="today">Oggi</button>
        </div>
      `;

      pop.addEventListener('click', (ev)=>{
        const navBtn = ev.target && ev.target.closest ? ev.target.closest('[data-qb-avail-picker-nav]') : null;
        if(navBtn){
          ev.preventDefault();
          shiftAvailPickerCursor(String(navBtn.getAttribute('data-qb-avail-picker-nav') || 'next'));
          renderAvailDatePicker();
          return;
        }

        const actionBtn = ev.target && ev.target.closest ? ev.target.closest('[data-qb-avail-picker-action]') : null;
        if(actionBtn){
          ev.preventDefault();
          let anchor = localYMD(new Date());
          if(qbAvailMode === 'week') anchor = startOfWeekYMD(anchor);
          if(qbAvailMode === 'month') anchor = firstOfMonthYMD(anchor);
          closeAvailDatePicker();
          loadAvailabilityPeriod(anchor, qbAvailMode);
          return;
        }

        const targetBtn = ev.target && ev.target.closest ? ev.target.closest('[data-qb-avail-picker-date]') : null;
        if(targetBtn){
          ev.preventDefault();
          let anchor = String(targetBtn.getAttribute('data-qb-avail-picker-date') || '');
          if(!anchor) return;
          if(qbAvailMode === 'week') anchor = startOfWeekYMD(anchor);
          if(qbAvailMode === 'month') anchor = firstOfMonthYMD(anchor);
          closeAvailDatePicker();
          loadAvailabilityPeriod(anchor, qbAvailMode);
        }
      });

      document.body.appendChild(pop);
      qbAvailPickerEl = pop;
      if(!qbAvailPickerOutsideBound){
        document.addEventListener('click', (ev)=>{
          if(!qbAvailPickerEl || qbAvailPickerEl.hidden) return;
          const target = ev.target;
          if(qbAvailPickerEl.contains(target)) return;
          if((availPickerHost && availPickerHost.contains(target)) || (availPickerBtn && availPickerBtn.contains(target))) return;
          closeAvailDatePicker();
        });
        document.addEventListener('keydown', (ev)=>{
          if(ev.key === 'Escape') closeAvailDatePicker();
        });
        window.addEventListener('resize', positionAvailDatePicker);
        window.addEventListener('scroll', positionAvailDatePicker, true);
        qbAvailPickerOutsideBound = true;
      }
      return pop;
    }

    function renderAvailDatePicker(){
      const pop = ensureAvailDatePicker();
      if(!pop) return;
      const mode = qbAvailMode || 'week';
      const cfg = availPickerConfig(mode);
      const cursor = getAvailPickerCursor();
      const focus = availPickerFocusDate();
      const today = new Date();
      const current = pop.querySelector('[data-qb-avail-picker-current]');
      const selected = pop.querySelector('[data-qb-avail-picker-selected]');
      const todayBtn = pop.querySelector('[data-qb-avail-picker-action="today"]');
      const weekdays = pop.querySelector('[data-qb-avail-picker-weekdays]');
      const grid = pop.querySelector('[data-qb-avail-picker-grid]');
      const prevBtn = pop.querySelector('[data-qb-avail-picker-nav="prev"]');
      const nextBtn = pop.querySelector('[data-qb-avail-picker-nav="next"]');

      pop.classList.remove('is-mode-day', 'is-mode-week', 'is-mode-month');
      pop.classList.add(`is-mode-${mode}`);
      pop.setAttribute('aria-label', cfg.dialog);
      if(prevBtn) prevBtn.setAttribute('aria-label', cfg.navPrev);
      if(nextBtn) nextBtn.setAttribute('aria-label', cfg.navNext);
      if(todayBtn) todayBtn.textContent = cfg.today;
      if(current) current.textContent = mode === 'month' ? availLongYear(cursor) : availLongMonthYear(cursor);
      if(weekdays) weekdays.hidden = mode !== 'day';

      if(selected){
        if(mode === 'week'){
          const ws = startOfWeekDate(focus);
          selected.textContent = `Settimana ${availWeekRangeLong(ws, addDaysDate(ws, 6))}`;
        } else if(mode === 'month') {
          selected.textContent = `Mese selezionato: ${availLongMonthYear(focus)}`;
        } else {
          selected.textContent = availLongDate(focus);
        }
      }

      if(!grid) return;
      grid.innerHTML = '';
      grid.className = 'calendar-mini-picker__grid';
      grid.classList.add(`calendar-mini-picker__grid--${mode}`);
      if(mode === 'week') renderAvailPickerWeeks(grid, cursor, focus, today);
      else if(mode === 'month') renderAvailPickerMonths(grid, cursor, focus, today);
      else renderAvailPickerDays(grid, cursor, focus, today);
      positionAvailDatePicker();
    }

    function openAvailDatePicker(){
      const pop = ensureAvailDatePicker();
      if(!pop) return;
      setAvailPickerCursor(availPickerFocusDate());
      renderAvailDatePicker();
      pop.hidden = false;
      positionAvailDatePicker();
      if(availPickerBtn) availPickerBtn.classList.add('active');
    }

    function toggleAvailDatePicker(){
      const pop = ensureAvailDatePicker();
      if(!pop) return;
      if(!pop.hidden) closeAvailDatePicker();
      else openAvailDatePicker();
    }

    function updateAvailTodayButton(){
      if(!availTodayBtn) return;
      const cfg = availPickerConfig(qbAvailMode);
      availTodayBtn.textContent = cfg.today;
      availTodayBtn.setAttribute('title', cfg.today);
      availTodayBtn.setAttribute('aria-label', cfg.today);
    }

    function updateAvailPickerButton(){
      if(!availPickerBtn) return;
      const cfg = availPickerConfig(qbAvailMode);
      availPickerBtn.setAttribute('title', cfg.dialog);
      availPickerBtn.setAttribute('aria-label', cfg.dialog);
    }

    function setAvailMode(mode){
      qbAvailMode = ['day','week','month'].includes(mode) ? mode : 'week';
      if(availModeBtns && availModeBtns.length){
        availModeBtns.forEach(btn => {
          const isActive = btn.getAttribute('data-qb-avail-mode') === qbAvailMode;
          btn.classList.toggle('active', isActive);
        });
      }
      updateAvailTodayButton();
      updateAvailPickerButton();
    }

    function formatAvailRangeLabel(data, fallbackDate){
      const start = (data && data.range_start) ? String(data.range_start) : String(fallbackDate || '');
      const end = (data && data.range_end) ? String(data.range_end) : start;
      if(!start) return '';
      if(qbAvailMode === 'month'){
        const months = data && Array.isArray(data.months) ? data.months : [];
        if(months.length === 1 && months[0] && months[0].label) return months[0].label;
      }
      if(!end || end === start) return formatDMY(start);
      return `${formatDMY(start)} - ${formatDMY(end)}`;
    }

    function formatItDayLabel(dateStr){
      // Output like "19 VEN" / "1 GIO"
      try{
        const d = new Date(dateStr + 'T00:00:00');
        if(Number.isNaN(d.getTime())) return dateStr;
        const day = d.getDate();
        let wd = new Intl.DateTimeFormat('it-IT', { weekday: 'short' }).format(d);
        wd = String(wd||'').replace('.', '').trim().toUpperCase();
        return `${day} ${wd}`;
      } catch(_){
        return dateStr;
      }
    }

    function ensureTodayVisible(avData){
      // Guarantee that today's row exists even if the API returns no slots for today.
      if(!avData || !avData.ok) return avData;
      const todayStr = localYMD(new Date());
      if(!todayStr) return avData;

      const months = Array.isArray(avData.months) ? avData.months : [];
      let found = false;
      for(const m of months){
        const days = Array.isArray(m.days) ? m.days : [];
        for(const d of days){
          if(d && d.date === todayStr){ found = true; break; }
        }
        if(found) break;
      }
      if(found) return avData;

      // Determine month label like "Dicembre 2025"
      let monthLabel = '';
      try{
        const td = new Date(todayStr + 'T00:00:00');
        const fmt = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' });
        monthLabel = fmt.format(td).replace(/\b([a-zàèéìòù])/, (m)=>m.toUpperCase());
      } catch(_){ monthLabel = todayStr; }

      // Find matching month section; if missing, prepend a new one
      let targetMonth = null;
      for(const m of months){
        if((m.label||'') === monthLabel){ targetMonth = m; break; }
      }
      if(!targetMonth){
        targetMonth = { label: monthLabel, days: [] };
        months.unshift(targetMonth);
        avData.months = months;
      }
      if(!Array.isArray(targetMonth.days)) targetMonth.days = [];
      targetMonth.days.unshift({ date: todayStr, label: formatItDayLabel(todayStr), slots: [] });
      return avData;
    }

    function ensureAvailTooltip(el){
      if(!el || !window.bootstrap || !bootstrap.Tooltip) return;
      if(availTooltips.has(el)) return;
      try{
        const t = new bootstrap.Tooltip(el, { trigger: 'hover', placement: 'top', html: true });
        availTooltips.set(el, t);
        availTooltipEls.add(el);
      } catch(_){ }
    }

    function disposeAvailTooltips(){
      try{
        for(const el of availTooltipEls){
          const t = availTooltips.get(el);
          try{ t && t.dispose && t.dispose(); } catch(_){ }
        }
      } catch(_){ }
      availTooltips = new WeakMap();
      availTooltipEls = new Set();
    }

    function buildTicks(startHHMM, endHHMM){
      const [sh, sm] = String(startHHMM||'').split(':').map(x=>parseInt(x,10));
      const [eh, em] = String(endHHMM||'').split(':').map(x=>parseInt(x,10));
      if([sh,sm,eh,em].some(Number.isNaN)) return [];
      const startMin = sh*60+sm;
      const endMin = eh*60+em;
      const out = [];
      for(let m=startMin; m<endMin; m+=5){
        const h = Math.floor(m/60);
        const mi = m%60;
        out.push(`${pad2(h)}:${pad2(mi)}`);
      }
      return out;
    }

    function buildHourLabels(startHHMM, endHHMM){
      const [sh, sm] = String(startHHMM||'').split(':').map(x=>parseInt(x,10));
      const [eh, em] = String(endHHMM||'').split(':').map(x=>parseInt(x,10));
      if([sh,sm,eh,em].some(Number.isNaN)) return [];
      // If end is exactly 24:00, the last displayed hour should be 23
      const lastHour = (eh === 24 && em === 0) ? 23 : eh;
      const out = [];
      for(let h=sh; h<=lastHour; h++) out.push(pad2(h));
      return out;
    }

    function timeToMin(hhmm){
      const [h,m] = String(hhmm||'').split(':').map(x=>parseInt(x,10));
      if(Number.isNaN(h) || Number.isNaN(m)) return null;
      return h*60+m;
    }

    // Shop hours helpers (support split hours)
    function dayIntervalsFromData(day){
      const out = [];
      const isClosed = Number(day && day.is_closed || 0) === 1;

      const add = (o,c) => {
        if(!o || !c) return;
        const os = String(o).slice(0,5);
        const cs = String(c).slice(0,5);
        const om = timeToMin(os);
        const cm = timeToMin(cs);
        if(om==null || cm==null) return;
        if(cm <= om) return;
        out.push([om, cm]);
      };

      if(!isClosed){
        add(day.opens, day.closes);
        add(day.opens2, day.closes2);
      }

      out.sort((a,b)=>a[0]-b[0]);
      return out;
    }

    function isInsideIntervals(min, intervals){
      if(min==null) return false;
      for(const it of intervals){
        if(min >= it[0] && min < it[1]) return true;
      }
      return false;
    }

    function isBoundaryStart(min, intervals){
      if(min==null) return false;
      for(const it of intervals){
        if(min === it[0]) return true;
      }
      return false;
    }

    function isBoundaryEnd(min, intervals){
      if(min==null) return false;
      for(const it of intervals){
        if(min === it[1]) return true;
      }
      return false;
    }

    function dayHoursSummaryLabel(day){
      const intervals = dayIntervalsFromData(day);
      if(!intervals.length) return 'Chiuso';
      const fmt = (min) => `${pad2(Math.floor(min/60))}:${pad2(min%60)}`;
      return 'Orari: ' + intervals.map(it => `${fmt(it[0])}-${fmt(it[1])}`).join(' / ');
    }

    function renderAvailabilityMonthSummary(data){
      if(!availWrap) return;
      if(!data || !data.ok){
        availWrap.innerHTML = '<div class="text-muted small p-2">Nessun dato.</div>';
        return;
      }
      const months = Array.isArray(data.months) ? data.months : [];
      let html = '';
      for(const m of months){
        html += `<div class="qb-avail-month">${escHtml(m.label || '')}</div>`;
        html += '<div class="list-group list-group-flush">';
        const days = Array.isArray(m.days) ? m.days : [];
        for(const d of days){
          const date = d.date || '';
          const label = d.label_full || d.label || date;
          const slots = Array.isArray(d.slots) ? d.slots : [];
          const countRaw = parseInt(String(d.regular_slot_count ?? ''), 10);
          const total = Number.isFinite(countRaw) ? Math.max(0, countRaw) : slots.length;
          const first = d.first_regular_slot || slots[0] || '';
          const badge = total > 0
            ? `<span class="badge text-bg-light border">${total} slot</span>`
            : '<span class="badge text-bg-light border text-muted">Nessuno slot</span>';
          const meta = first ? `Primo orario: ${escHtml(first)}` : 'Nessun orario disponibile';
          html += `<button type="button" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center gap-3" data-qb-avail-day="${escHtml(date)}">
            <span>
              <span class="fw-semibold d-block">${escHtml(label)}</span>
              <span class="small text-muted d-block">${meta}</span>
              <span class="small text-muted d-block">${escHtml(dayHoursSummaryLabel(d))}</span>
            </span>
            <span class="d-flex align-items-center gap-2">
              ${badge}
              <i class="bi bi-chevron-right text-muted"></i>
            </span>
          </button>`;
        }
        html += '</div>';
      }
      availWrap.innerHTML = html || '<div class="text-muted small p-2">Nessun dato.</div>';
    }

    function renderAvailabilityWeekSummary(data){
      renderAvailabilityMonthSummary(data);
    }

    function qbAvailabilityLoadingHtml(message, extraClasses, id){
      const attrs = id ? ` id="${escHtml(id)}"` : '';
      const classes = extraClasses || 'p-3';
      return `<div${attrs} class="qb-avail-loading-state text-muted small ${classes}" role="status" aria-live="polite"><span class="spinner-border spinner-border-sm text-primary qb-inline-loader" aria-hidden="true"></span><span>${escHtml(message || 'Caricamento...')}</span></div>`;
    }

    function renderAvailability(data){
      if(!availWrap) return;
      if(!data || !data.ok){
        availWrap.innerHTML = '<div class="text-muted small p-2">Nessun dato.</div>';
        return;
      }

      if(qbAvailMode === 'month'){
        renderAvailabilityMonthSummary(data);
        return;
      }
      if(qbAvailMode === 'week'){
        renderAvailabilityWeekSummary(data);
        return;
      }

      // Timeline range:
      // Backend quick booking ("Orari disponibili") must always render the FULL day
      // so admins can pick a time even outside the blue (available) range.
      // Blue = available within business hours; Orange = selectable override slots
      // outside business hours/chiusure (already computed by the backend).
      //
      // NOTE: use 24:00 as end boundary so the last hour label is 23 and the last
      // 5-min tick is 23:55.
      const dayStart = '00:00';
      const dayEnd = '24:00';
      qbAvailDayStart = dayStart;
      qbAvailDayEnd = dayEnd;
      const ticks = buildTicks(dayStart, dayEnd);

      let html = '';
      // sticky header with hour labels
      html += `<div class="qb-avail-head">
        <div class="qb-avail-day">&nbsp;</div>
        <div class="qb-avail-hours">${buildHourLabels(dayStart, dayEnd).map(h=>`<div class="qb-avail-hour">${h}</div>`).join('')}</div>
      </div>`;

      const months = Array.isArray(data.months) ? data.months : [];
      for(const m of months){
        html += `<div class="qb-avail-month">${escHtml(m.label || '')}</div>`;
        const days = Array.isArray(m.days) ? m.days : [];
        for(const d of days){
          const date = d.date || '';
          const label = d.label || date;
          const intervals = dayIntervalsFromData(d);
          const slots = new Set(Array.isArray(d.slots) ? d.slots : []);
          const overrideSlots = new Set(Array.isArray(d.override_slots) ? d.override_slots : []);
          const booked = new Set(Array.isArray(d.booked) ? d.booked : []);
          const bookedOutside = new Set(Array.isArray(d.booked_outside) ? d.booked_outside : []);
          const dstGap = new Set(Array.isArray(d.dst_gap) ? d.dst_gap : []);
          const dstFold = new Set(Array.isArray(d.dst_fold) ? d.dst_fold : []);
          const dayMonthLabel = date ? formatItDayMonth(date) : '';

          html += `<div class="qb-avail-row" data-date="${escHtml(date)}">
            <div class="qb-avail-day"><div class="fw-semibold">${escHtml(label)}</div></div>
            <div class="qb-avail-bars">`;

          for(const t of ticks){
            let on = slots.has(t);
            let alt = !on && overrideSlots.has(t);
            const isBookedOutside = bookedOutside.has(t);
            const isBooked = booked.has(t);
            const tMin = timeToMin(t);
            const inside = isInsideIntervals(tMin, intervals);
            const isOutside = intervals.length ? !inside : true;
            const boundaryStart = isBoundaryStart(tMin, intervals);
            const boundaryEnd = isBoundaryEnd(tMin, intervals);

            // If the backend (wrongly) marks a slot as available inside a closed range (split hours),
            // force it to render as "Fuori orario / Chiusura" (orange) so the operator sees the closure.
            if(on && isOutside){
              on = false;
              alt = true;
            }
            const extraCls = `${isOutside ? ' is-outside-hours' : ''}${boundaryStart ? ' bh-start' : ''}${boundaryEnd ? ' bh-end' : ''}`;
            const tip = `${escHtml(dayMonthLabel)}<br><div class='fw-semibold'>${escHtml(t)}</div>`;
            if(isBookedOutside){
              const tip2 = `${tip}<div class='small text-muted mt-1'>Prenotazione fuori orario / in chiusura</div>`;
              html += `<div class="qb-avail-bar is-booked-outside${extraCls}" data-time="${escHtml(t)}" data-bs-toggle="tooltip" data-bs-html="true" data-bs-title="${tip2}"></div>`;
            } else if(isBooked){
              const tip2 = `${tip}<div class='small text-white mt-1'>Slot occupato</div>`;
              html += `<div class="qb-avail-bar is-booked${extraCls}" data-time="${escHtml(t)}" data-bs-toggle="tooltip" data-bs-html="true" data-bs-title="${tip2}"></div>`;
            } else {
              // NOTE: In this view ALL non-booked slots must be selectable.
              // DST (ora legale) edge-cases are indicated in the tooltip but remain selectable.
              let tip3 = tip;
              if(dstGap.has(t)){
                tip3 = `${tip}<div class='small text-white mt-1'>Ora non esistente (cambio ora legale)</div>`;
              } else if(dstFold.has(t)){
                tip3 = `${tip}<div class='small text-white mt-1'>Ora ripetuta (cambio ora legale)</div>`;
              }

              if(on){
                html += `<div class="qb-avail-bar is-on${extraCls}" data-time="${escHtml(t)}" data-bs-toggle="tooltip" data-bs-html="true" data-bs-title="${tip3}"></div>`;
              } else if(alt){
                const tip4 = `${tip3}<div class='small text-white mt-1'>Fuori orario / Chiusura (selezionabile)</div>`;
                html += `<div class="qb-avail-bar is-alt${extraCls}" data-time="${escHtml(t)}" data-bs-toggle="tooltip" data-bs-html="true" data-bs-title="${tip4}"></div>`;
              } else {
                const tip4 = `${tip3}<div class='small text-white mt-1'>Non disponibile</div>`;
                html += `<div class="qb-avail-bar is-off${extraCls}" data-time="${escHtml(t)}" data-bs-toggle="tooltip" data-bs-html="true" data-bs-title="${tip4}"></div>`;
              }
            }
          }
          html += `</div></div>`;
        }
      }

      // Loading indicator + sentinel (used by IntersectionObserver for infinite scroll)
      html += qbAvailabilityLoadingHtml('Caricamento...', 'p-2 d-none', 'qbAvailLoading');
      html += `<div id="qbAvailSentinel" style="height: 1px;"></div>`;

      availWrap.innerHTML = html;
    }

    function appendAvailabilityMonths(data){
      if(!availWrap || !data || !data.ok) return;
      // Keep the same timeline range of the initial render (header must match).
      // For quick booking availability we always use the full-day timeline.
      const dayStart = qbAvailDayStart || '00:00';
      const dayEnd = qbAvailDayEnd || '24:00';
      qbAvailDayStart = dayStart;
      qbAvailDayEnd = dayEnd;
      const ticks = buildTicks(dayStart, dayEnd);

      const months = Array.isArray(data.months) ? data.months : [];
      let html = '';
      for(const m of months){
        html += `<div class=\"qb-avail-month\">${escHtml(m.label || '')}</div>`;
        const days = Array.isArray(m.days) ? m.days : [];
        for(const d of days){
          const date = d.date || '';
          const label = d.label || date;
          const intervals = dayIntervalsFromData(d);
          const slots = new Set(Array.isArray(d.slots) ? d.slots : []);
          const overrideSlots = new Set(Array.isArray(d.override_slots) ? d.override_slots : []);
          const booked = new Set(Array.isArray(d.booked) ? d.booked : []);
          const bookedOutside = new Set(Array.isArray(d.booked_outside) ? d.booked_outside : []);
          const dstGap = new Set(Array.isArray(d.dst_gap) ? d.dst_gap : []);
          const dstFold = new Set(Array.isArray(d.dst_fold) ? d.dst_fold : []);
          const dayMonthLabel = date ? formatItDayMonth(date) : '';

          html += `<div class=\"qb-avail-row\" data-date=\"${escHtml(date)}\">\
            <div class=\"qb-avail-day\"><div class=\"fw-semibold\">${escHtml(label)}</div></div>\
            <div class=\"qb-avail-bars\">`;

          for(const t of ticks){
            let on = slots.has(t);
            let alt = !on && overrideSlots.has(t);
            const isBookedOutside = bookedOutside.has(t);
            const isBooked = booked.has(t);
            const tMin = timeToMin(t);
            const inside = isInsideIntervals(tMin, intervals);
            const isOutside = intervals.length ? !inside : true;
            const boundaryStart = isBoundaryStart(tMin, intervals);
            const boundaryEnd = isBoundaryEnd(tMin, intervals);

            if(on && isOutside){
              on = false;
              alt = true;
            }
            const extraCls = `${isOutside ? ' is-outside-hours' : ''}${boundaryStart ? ' bh-start' : ''}${boundaryEnd ? ' bh-end' : ''}`;
            const tip = `${escHtml(dayMonthLabel)}<br><div class='fw-semibold'>${escHtml(t)}</div>`;
            if(isBookedOutside){
              const tip2 = `${tip}<div class='small text-muted mt-1'>Prenotazione fuori orario / in chiusura</div>`;
              html += `<div class=\"qb-avail-bar is-booked-outside${extraCls}\" data-time=\"${escHtml(t)}\" data-bs-toggle=\"tooltip\" data-bs-html=\"true\" data-bs-title=\"${tip2}\"></div>`;
            } else if(isBooked){
              const tip2 = `${tip}<div class='small text-white mt-1'>Slot occupato</div>`;
              html += `<div class=\"qb-avail-bar is-booked${extraCls}\" data-time=\"${escHtml(t)}\" data-bs-toggle=\"tooltip\" data-bs-html=\"true\" data-bs-title=\"${tip2}\"></div>`;
            } else {
              // NOTE: In this view ALL non-booked slots must be selectable.
              // DST (ora legale) edge-cases are indicated in the tooltip but remain selectable.
              let tip3 = tip;
              if(dstGap.has(t)){
                tip3 = `${tip}<div class='small text-white mt-1'>Ora non esistente (cambio ora legale)</div>`;
              } else if(dstFold.has(t)){
                tip3 = `${tip}<div class='small text-white mt-1'>Ora ripetuta (cambio ora legale)</div>`;
              }

              if(on){
                html += `<div class="qb-avail-bar is-on${extraCls}" data-time="${escHtml(t)}" data-bs-toggle="tooltip" data-bs-html="true" data-bs-title="${tip3}"></div>`;
              } else if(alt){
                const tip4 = `${tip3}<div class='small text-white mt-1'>Fuori orario / Chiusura (selezionabile)</div>`;
                html += `<div class="qb-avail-bar is-alt${extraCls}" data-time="${escHtml(t)}" data-bs-toggle="tooltip" data-bs-html="true" data-bs-title="${tip4}"></div>`;
              } else {
                const tip4 = `${tip3}<div class='small text-white mt-1'>Non disponibile</div>`;
                html += `<div class="qb-avail-bar is-off${extraCls}" data-time="${escHtml(t)}" data-bs-toggle="tooltip" data-bs-html="true" data-bs-title="${tip4}"></div>`;
              }
            }
          }
          html += `</div></div>`;
        }
      }

      // Append BEFORE the sentinel so it always stays at the bottom
      const sentinel = qs('#qbAvailSentinel');
      if(sentinel){
        sentinel.insertAdjacentHTML('beforebegin', html);
      } else {
        availWrap.insertAdjacentHTML('beforeend', html);
      }
    }

    function setAvailLoading(isOn){
      const el = availWrap ? availWrap.querySelector('#qbAvailLoading') : null;
      if(!el) return;
      if(isOn) el.classList.remove('d-none');
      else el.classList.add('d-none');
    }

    function disconnectAvailObserver(){
      try{ availObserver && availObserver.disconnect(); } catch(_){ }
      availObserver = null;
    }

    async function loadMoreAvailability(){
      if(qbAvailLoadingMore) return;
      if(!qbAvailNextDate) return;
      if(!availWrap) return;

      qbAvailLoadingMore = true;
      setAvailLoading(true);

      try{
        const ids = getSelectedServiceIds();
        const params = new URLSearchParams();
        params.set('action','availability');
        params.set('date', qbAvailNextDate);
        params.set('months','1');
        params.set('exclude_id', qbGetExcludeId());
        for(const id of ids) params.append('service_ids[]', id);
        if(staffSel && staffSel.value) params.set('staff_id', staffSel.value);
        {
          const locId = qbCurrentLocationId();
          if(locId) params.set('location_id', locId);
        }
        {
          const token = qbCurrentHoldToken();
          if(token) params.set('appointment_hold_token', token);
        }

        if(staffMapInput && staffMapInput.value){
          params.set('staff_map', staffMapInput.value);
        }
        if(cabinMapInput && cabinMapInput.value){
          params.set('cabin_map', cabinMapInput.value);
        }
        if(qbGiftRedeemInput && String(qbGiftRedeemInput.value || '').trim()){
          params.set('gift_redeem', String(qbGiftRedeemInput.value || '').trim());
        }

        // Fetch asynchronously; append on next frame to keep scrolling smooth
        const res = await fetch('index.php?page=api_appointments&' + params.toString());
        const data = await res.json();

        await new Promise((resolve)=>requestAnimationFrame(resolve));
        appendAvailabilityMonths(data);

        // update next date (day after the last received)
        let last = null;
        const months = Array.isArray(data.months) ? data.months : [];
        for(const m of months){
          const days = Array.isArray(m.days) ? m.days : [];
          for(const d of days) last = d.date || last;
        }
        if(last){
          const nd = new Date(last + 'T00:00:00');
          nd.setDate(nd.getDate() + 1);
          const pad = n => String(n).padStart(2,'0');
          qbAvailNextDate = `${nd.getFullYear()}-${pad(nd.getMonth()+1)}-${pad(nd.getDate())}`;
        } else {
          qbAvailNextDate = null;
        }
      } catch(_){
        // ignore
      } finally {
        setAvailLoading(false);
        qbAvailLoadingMore = false;
      }
    }

    function setupAvailObserver(){
      if(!availWrap) return;
      disconnectAvailObserver();
      const sentinel = availWrap.querySelector('#qbAvailSentinel');
      if(!sentinel) return;

      // Root is the scroll container (#qbAvailWrap). Trigger a bit early for smoother UX.
      availObserver = new IntersectionObserver((entries)=>{
        for(const e of entries){
          if(e.isIntersecting){
            // Fire and forget; guard inside loadMoreAvailability
            loadMoreAvailability();
          }
        }
      }, { root: availWrap, rootMargin: '600px 0px 600px 0px', threshold: 0.01 });

      try{ availObserver.observe(sentinel); } catch(_){ }
    }
    function buildAvailabilityParams(anchorDate, mode){
      const ids = getSelectedServiceIds();
      const params = new URLSearchParams();
      params.set('action','availability');
      params.set('date', anchorDate);
      params.set('range', mode === 'day' ? 'day' : (mode === 'month' ? 'month' : 'week'));
      if(mode === 'month') params.set('months', '1');
      if(mode !== 'day') params.set('summary', '1');
      params.set('exclude_id', qbGetExcludeId());
      for(const id of ids) params.append('service_ids[]', id);
      if(staffSel && staffSel.value) params.set('staff_id', staffSel.value);
      {
        const locId = qbCurrentLocationId();
        if(locId) params.set('location_id', locId);
      }
      {
        const token = qbCurrentHoldToken();
        if(token) params.set('appointment_hold_token', token);
      }
      if(staffMapInput && staffMapInput.value){
        params.set('staff_map', staffMapInput.value);
      }
      if(cabinMapInput && cabinMapInput.value){
        params.set('cabin_map', cabinMapInput.value);
      }
      if(qbGiftRedeemInput && String(qbGiftRedeemInput.value || '').trim()){
        params.set('gift_redeem', String(qbGiftRedeemInput.value || '').trim());
      }
      return params;
    }

    async function loadAvailabilityPeriod(anchorDate, mode, options){
      if(!availWrap) return;
      const opts = Object.assign({ silent: false, auto: false }, options || {});
      if(opts.auto && qbAvailPeriodLoading) return;
      stopAvailAutoRefresh();
      const safeMode = ['day','week','month'].includes(mode) ? mode : 'week';
      const safeDate = safeMode === 'month'
        ? firstOfMonthYMD(anchorDate)
        : (safeMode === 'week' ? startOfWeekYMD(anchorDate) : anchorDate);
      qbAvailAnchorDate = safeDate;
      setAvailMode(safeMode);
      qbAvailPeriodLoading = true;
      disconnectAvailObserver();
      disposeAvailTooltips();
      setAvailLoading(false);
      qbAvailLoadingMore = false;
      qbAvailNextDate = null;
      qbAvailRequestSeq += 1;
      const seq = qbAvailRequestSeq;

      if(availRangeEl) availRangeEl.textContent = safeMode === 'month' ? formatItDayMonth(safeDate).replace(/^\d+\s+/, '') : formatDMY(safeDate);
      try{ availWrap.setAttribute('aria-busy', 'true'); }catch(_){ }
      if(!opts.silent) availWrap.innerHTML = qbAvailabilityLoadingHtml('Caricamento...');

      try{
        const params = buildAvailabilityParams(safeDate, safeMode);
        const res = await fetch('index.php?page=api_appointments&' + params.toString());
        const data = await res.json();
        if(seq !== qbAvailRequestSeq) return;
        renderAvailability(data);
        if(availRangeEl) availRangeEl.textContent = formatAvailRangeLabel(data, safeDate);
      } catch(err){
        if(seq !== qbAvailRequestSeq) return;
        if(!opts.silent) availWrap.innerHTML = '<div class="text-muted small p-2">Errore caricamento disponibilita.</div>';
      } finally {
        if(seq === qbAvailRequestSeq){
          qbAvailPeriodLoading = false;
          try{ availWrap.removeAttribute('aria-busy'); }catch(_){ }
          scheduleAvailAutoRefresh();
        }
      }
    }

    async function openAvailability(){
      if(!availModal) return;
      if(!qbDate || !qbDate.value){ notify('Seleziona una data di inizio', 'warning'); return; }
      const ids = getSelectedServiceIds();
      if(!ids.length){ notify('Seleziona almeno un servizio', 'warning'); return; }
      if(!qbIsOperatorSelectionComplete()){
        const msg = (multiStaffPicker && multiStaffPicker.style.display !== 'none' && !(form && form.dataset.segmentView === '1')) ? 'Seleziona gli operatori per i servizi' : 'Nessun operatore disponibile per il servizio selezionato';
        notify(msg, 'warning');
        return;
      }

      setAvailMode('week');
      qbAvailAnchorDate = qbDate.value;
      availModal.show();
      loadAvailabilityPeriod(qbAvailAnchorDate, qbAvailMode);
      return;

      const params = new URLSearchParams();
      params.set('action','availability');
      params.set('date', qbDate.value);
      params.set('months','1');
      params.set('exclude_id', qbGetExcludeId());
      for(const id of ids) params.append('service_ids[]', id);
      if(staffSel && staffSel.value) params.set('staff_id', staffSel.value);
      {
        const locId = qbCurrentLocationId();
        if(locId) params.set('location_id', locId);
      }

      // If multi-service has per-service staff assignment, pass the map so the backend
      // can compute availability per segmento (duration per service + staff blocks).
      // This avoids wrongly requiring the selected staff to be free for the *total* duration.
      if(staffMapInput && staffMapInput.value){
        params.set('staff_map', staffMapInput.value);
      }

      if(cabinMapInput && cabinMapInput.value){
        params.set('cabin_map', cabinMapInput.value);
      }
      if(qbGiftRedeemInput && String(qbGiftRedeemInput.value || '').trim()){
        params.set('gift_redeem', String(qbGiftRedeemInput.value || '').trim());
      }

      if(availWrap) availWrap.innerHTML = qbAvailabilityLoadingHtml('Caricamento...');
      // Top-right date in availability modal must be in GG/MM/AAAA
      if(availRangeEl) availRangeEl.textContent = formatDMY(qbDate.value);
      availModal.show();

      try{
        const res = await fetch('index.php?page=api_appointments&' + params.toString());
        const data = await res.json();
        renderAvailability(data);
      

        // Prepare infinite scroll state (next date to fetch = day after the last rendered)
        try{
          const months = Array.isArray(data.months) ? data.months : [];
          let last = null;
          for(const m of months){
            const days = Array.isArray(m.days) ? m.days : [];
            for(const d of days) last = d.date || last;
          }
          // Keep consistent timeline for infinite scroll.
          // Quick booking availability always uses the full-day timeline.
          qbAvailDayStart = '00:00';
          qbAvailDayEnd = '24:00';
          if(last){
            const nd = new Date(last + 'T00:00:00');
            nd.setDate(nd.getDate() + 1);
            const pad = n => String(n).padStart(2,'0');
            qbAvailNextDate = `${nd.getFullYear()}-${pad(nd.getMonth()+1)}-${pad(nd.getDate())}`;
          } else {
            qbAvailNextDate = null;
          }
          qbAvailLoadingMore = false;
        } catch(_){ qbAvailNextDate = null; qbAvailLoadingMore = false; }

        // Activate smooth infinite scroll
        setupAvailObserver();
} catch(err){
        if(availWrap) availWrap.innerHTML = '<div class="text-muted small p-2">Errore caricamento disponibilità.</div>';
      }
    }

    on(availBtn, 'click', (e)=>{ e.preventDefault(); openAvailability(); });

    function shiftAvailabilityPeriod(delta){
      const base = qbAvailAnchorDate || (qbDate && qbDate.value) || localYMD(new Date());
      let next = base;
      if(qbAvailMode === 'day') next = addDaysYMD(base, delta);
      else if(qbAvailMode === 'month') next = addMonthsYMD(base, delta);
      else next = addDaysYMD(base, delta * 7);
      loadAvailabilityPeriod(next, qbAvailMode);
    }

    on(availPrevPeriodBtn, 'click', (e)=>{
      e.preventDefault();
      shiftAvailabilityPeriod(-1);
    });

    on(availNextPeriodBtn, 'click', (e)=>{
      e.preventDefault();
      shiftAvailabilityPeriod(1);
    });

    on(availTodayBtn, 'click', (e)=>{
      e.preventDefault();
      loadAvailabilityPeriod(localYMD(new Date()), qbAvailMode);
    });

    if(availModeBtns && availModeBtns.length){
      availModeBtns.forEach(btn => {
        on(btn, 'click', (e)=>{
          e.preventDefault();
          const mode = btn.getAttribute('data-qb-avail-mode') || 'week';
          let anchor = qbAvailAnchorDate || (qbDate && qbDate.value) || localYMD(new Date());
          if(mode === 'month') anchor = firstOfMonthYMD(anchor);
          else if(mode === 'week') anchor = startOfWeekYMD(anchor);
          loadAvailabilityPeriod(anchor, mode);
        });
      });
    }

    on(availPickerBtn, 'click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      toggleAvailDatePicker();
    });

    on(availModalEl, 'shown.bs.modal', ()=>{
      disconnectAvailObserver();
      scheduleAvailAutoRefresh();
    });

    on(availModalEl, 'hidden.bs.modal', ()=>{
      stopAvailAutoRefresh();
      closeAvailDatePicker();
      disconnectAvailObserver();
      disposeAvailTooltips();
      setAvailLoading(false);
      qbAvailLoadingMore = false;
    });

    document.addEventListener('visibilitychange', ()=>{
      if(document.hidden) stopAvailAutoRefresh();
      else scheduleAvailAutoRefresh();
    });

    async function applyAvailabilitySlot(date, time){
      if(qbAvailApplying) return;
      if(!date || !time) return;
      qbAvailApplying = true;
      qbUpdateDateAvailabilityGate({ schedulePendingCalendarSlot: false });
      try{
        const hold = await qbCreateAvailabilityHold(date, time);
        qbAvailConfirmed = true;
        if(date && qbDate) qbDate.value = date;
        if(time && qbStartTime) qbStartTime.value = time;
        syncEnd();
        qbApplyAvailabilityHoldAllocation(hold);
        const preferredCabin = qbPreferredCabinIdFromHold(hold) || (cabinSel && cabinSel.getAttribute ? cabinSel.getAttribute('data-current') : undefined);
        let cabinRefresh = Promise.resolve();
        try{
          cabinRefresh = refreshCabinsForServices(preferredCabin);
        }catch(_){
          cabinRefresh = Promise.resolve();
        }
        // Programmatic date/time updates do not trigger native change events.
        try{ qbRefreshFidelityThenRender(); }catch(_){ }
        try{ availModal && availModal.hide(); }catch(_){ }
        try{ await cabinRefresh; }catch(_){ }
      } catch(err){
        notify((err && err.message) ? err.message : 'Orario non piu disponibile. Scegli un altro slot.', 'warning');
        try{ loadAvailabilityPeriod(date || qbAvailAnchorDate, qbAvailMode); }catch(_){ }
      } finally {
        qbAvailApplying = false;
        qbUpdateDateAvailabilityGate({ schedulePendingCalendarSlot: false });
      }
    }

    // Click a slot => set start time/date + recompute end
    on(availWrap, 'click', (e)=>{
      const dayBtn = e.target.closest('[data-qb-avail-day]');
      if(dayBtn){
        const date = dayBtn.getAttribute('data-qb-avail-day') || '';
        if(date) loadAvailabilityPeriod(date, 'day');
        return;
      }
      const bar = e.target.closest('.qb-avail-bar[data-time]');
      if(bar && (bar.classList.contains('is-booked') || bar.classList.contains('is-booked-outside') || bar.classList.contains('is-off'))) return;
      if(!bar) return;
      const row = bar.closest('.qb-avail-row');
      const date = row ? row.getAttribute('data-date') : '';
      const time = bar.getAttribute('data-time') || '';
      applyAvailabilitySlot(date, time);
    });

    // Lazy tooltip init (and immediate show) when hovering an available slot.
// NOTE: use `mouseover/mouseout` because `mouseenter/mouseleave` do not bubble
// and we render slots dynamically (infinite scroll).
    if(availWrap){
      availWrap.addEventListener('mouseover', (e)=>{
        const bar = e.target && e.target.closest ? e.target.closest('.qb-avail-bar[data-bs-toggle="tooltip"]') : null;
        if(!bar) return;
        ensureAvailTooltip(bar);

        // Since we init on hover, force show the first time
        try{
          const inst = bootstrap.Tooltip.getInstance(bar);
          if(inst && inst.show) inst.show();
        }catch(_){ }
      }, { passive: true });

      availWrap.addEventListener('mouseout', (e)=>{
        const bar = e.target && e.target.closest ? e.target.closest('.qb-avail-bar[data-bs-toggle="tooltip"]') : null;
        if(!bar) return;
        try{
          const inst = bootstrap.Tooltip.getInstance(bar);
          if(inst && inst.hide) inst.hide();
        }catch(_){ }
      }, { passive: true });
    }

    window.qbAppointmentCancelDialog = {
      open: function(id, opts){
        return qbOpenDoneCancelPreview(id, Object.assign({ external:true }, opts || {}));
      },
      close: function(){
        try{ if(qbDoneCancelModal) qbDoneCancelModal.hide(); }catch(_){ }
      }
    };

    form.addEventListener('submit', async function(e){
      e.preventDefault();

      if(qbCurrentHoldToken() && qbHoldIsExpired()){
        qbHandleHoldExpired();
        return;
      }

      // Ensure hidden datetime fields are up-to-date
      try{ syncEnd(); }catch(_){ }

      const fd = new FormData(form);

      const originalStatusNow = qbNormStatus((form && form.dataset && form.dataset.originalStatus) ? form.dataset.originalStatus : qbOriginalStatus);
      const requestedStatusNow = qbNormStatus(((fd.get('status') || (statusSel && statusSel.value) || '') + '').trim());
      const editingIdNow = parseInt(String((apptIdEl && apptIdEl.value) || qbEditingId || '').trim(), 10) || 0;
      if(editingIdNow > 0 && qbIsCanceledLockedMode()) {
        notify('La prenotazione annullata non è modificabile.', 'warning');
        return;
      }
      if(editingIdNow > 0 && ['pending','scheduled','done'].includes(originalStatusNow) && ['canceled','no_show'].includes(requestedStatusNow)) {
        await qbOpenDoneCancelPreview(editingIdNow, { targetStatus: requestedStatusNow });
        return;
      }

      // Build URLSearchParams preserving multi-select values (service_ids[])
      const body = new URLSearchParams();
      for(const [k,v] of fd.entries()) body.append(k, v);
      body.append('_csrf', csrf);
      body.append('action', 'save');

      // IMPORTANT:
      // Disabled form fields are NOT included in FormData.
      // In the booking drawer we sometimes disable selects when there is only
      // one possible choice (e.g. staff/cabin). That should NOT prevent the
      // backend from receiving the chosen value.
      try{
        const staffSel2 = form.querySelector('select[name="staff_id"]');
        if(staffSel2 && staffSel2.disabled){
          const v = String(staffSel2.value || '').trim();
          if(v && !body.get('staff_id')) body.append('staff_id', v);
        }
      }catch(_){ }
      try{
        const cabinSel2 = form.querySelector('select[name="cabin_id"]');
        if(cabinSel2 && cabinSel2.disabled){
          const v = String(cabinSel2.value || '').trim();
          if(v && !body.get('cabin_id')) body.append('cabin_id', v);
        }
      }catch(_){ }

      const clientId = (fd.get('client_id') || '').toString();
      const startsAt = (fd.get('starts_at') || '').toString();
      const endsAt = (fd.get('ends_at') || '').toString();
      if(!clientId.trim()){
        notify('Seleziona o crea un cliente', 'warning');
        return;
      }
      if(!startsAt || !endsAt){ notify('Inserisci data e orario', 'warning'); return; }
      const res = await fetch('index.php?page=api_appointments', {
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body
      });
      const data = await res.json();
      if(!data.ok){
        const errMsg = String(data.error || 'Errore salvataggio');
        if(qbCurrentHoldToken() && /riserva|disponibilit|orario non piu disponibile|cabina/i.test(errMsg)){
          qbHandleHoldExpired(errMsg);
        } else {
          notify(errMsg, 'danger');
        }
        return;
      }

      // close offcanvas
      try{
        const el = qs('#quickBooking');
        const inst = bootstrap.Offcanvas.getOrCreateInstance(el);
        inst.hide();
      } catch(e){}

      // refresh UI: calendar only (no navigation)
      notify('Appuntamento salvato', 'success');
      try{
        if(Array.isArray(data.warnings) && data.warnings.length){
          for(const w of data.warnings){
            if(w) notify(String(w), 'warning');
          }
        }
      }catch(_){ }
      if(window.calendar && typeof window.calendar.refetchEvents === 'function'){
        window.calendar.refetchEvents();
      }
      if(qbReloadPageOnSave){
        qbReloadPageOnSave = false;
        window.location.reload();
      }
});

    on(deleteBtn, 'click', async function(){
      const id = apptIdEl ? apptIdEl.value : '';
      if(!id) return;
      const deleteStatus = qbNormStatus((form && form.dataset && form.dataset.originalStatus) ? form.dataset.originalStatus : qbOriginalStatus);
      if(deleteStatus !== 'canceled'){
        notify('La prenotazione deve essere in stato Annullato. Annullala prima per poterla eliminare.', 'warning');
        return;
      }
      if(!confirm('Eliminare questo appuntamento?')) return;
      try{
        const body = new URLSearchParams({ action:'delete', id:String(id), _csrf: csrf });
        const res = await fetch('index.php?page=api_appointments', {
          method:'POST',
          headers:{'Content-Type':'application/x-www-form-urlencoded'},
          body
        });
        const data = await res.json();
        if(!data.ok){ notify(data.error || 'Errore eliminazione', 'danger'); return; }

        try{
          const inst = bootstrap.Offcanvas.getOrCreateInstance(offcanvasEl);
          inst.hide();
        } catch(_){ }

        if(window.calendar && typeof window.calendar.refetchEvents === 'function'){
          window.calendar.refetchEvents();
        }
        notify('Appuntamento eliminato', 'success');
      } catch(err){
        notify(err?.message || 'Errore eliminazione', 'danger');
      }
    });

    // default start now rounded
    const now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes()/15)*15);
    const pad = n => String(n).padStart(2,'0');
    const d = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
    const t = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    if(qbDate && !qbDate.value) qbDate.value = d;
    if(qbStartTime && !qbStartTime.value) qbStartTime.value = t;
    syncEnd();
  });
})();



