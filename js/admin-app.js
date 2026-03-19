// ============================================
// Admin Panel — Enterprise Edition
// מערכת ניהול אולם מרכז שפירא
// ============================================

'use strict';

// ============================================
// Constants
// ============================================
const ADMIN_CONFIG = Object.freeze({
  PASSWORD:          '2026',
  SESSION_KEY:       'adminLoggedIn',
  NOTIF_DAYS_START:  14,   // reminders window: 14 days ahead
  NOTIF_DAYS_END:    21,
});

const PRICING_TABLE = Object.freeze({
  'תושב המושב': { morning: 1000, evening: 1000, weekend: 1800 },
  'תושב חוץ':   { morning: 1500, evening: 1500, weekend: 2500 },
});

const PROJECTOR_PRICE = 200;

const SLOT_META = Object.freeze({
  morning: { text: 'בוקר',   hours: '08:00-16:00' },
  evening: { text: 'ערב',    hours: '17:00-01:00' },
  weekend: { text: 'סופ"ש', hours: 'שישי 14:00 - שבת 23:00' },
});

const MONTH_NAMES = Object.freeze([
  'ינואר','פברואר','מרץ','אפריל','מאי','יוני',
  'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר',
]);

const DAY_NAMES = Object.freeze(['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת']);

const STATUS_LABELS = Object.freeze({
  approved:  'פעיל',
  completed: 'הסתיים',
  cancelled: 'מבוטל',
});


// ============================================
// Logger
// ============================================
const Logger = Object.freeze({
  info:    (m,d) => console.log   (`📘 [INFO] ${m}`, ...(d !== undefined ? [d] : [])),
  warn:    (m,d) => console.warn  (`⚠️ [WARN] ${m}`, ...(d !== undefined ? [d] : [])),
  error:   (m,d) => console.error (`❌ [ERR]  ${m}`, ...(d !== undefined ? [d] : [])),
  success: (m,d) => console.log   (`✅ [OK]   ${m}`, ...(d !== undefined ? [d] : [])),
});


// ============================================
// Toast (no alert/confirm anywhere)
// ============================================
const Toast = (() => {
  let _c = null;

  function _container() {
    if (_c) return _c;
    _c = Object.assign(document.createElement('div'), { id: 'toast-container' });
    _c.setAttribute('role', 'region');
    _c.setAttribute('aria-live', 'polite');
    document.body.appendChild(_c);
    return _c;
  }

  function show(message, type = 'info', ms = 4500) {
    const icons  = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
    const colors = {
      success: { bg:'rgba(78,200,122,.12)',  border:'rgba(78,200,122,.4)',  text:'#4ec87a' },
      error:   { bg:'rgba(224,92,92,.12)',   border:'rgba(224,92,92,.45)',  text:'#e05c5c' },
      warning: { bg:'rgba(201,165,76,.12)',  border:'rgba(201,165,76,.4)',  text:'#c9a84c' },
      info:    { bg:'rgba(62,184,194,.12)',  border:'rgba(62,184,194,.4)',  text:'#3eb8c2' },
    };
    const c = colors[type] ?? colors.info;

    const t = document.createElement('div');
    t.setAttribute('role', 'alert');
    Object.assign(t.style, {
      pointerEvents:'auto', background:c.bg, border:`1px solid ${c.border}`,
      borderRadius:'12px', padding:'14px 18px', display:'flex',
      alignItems:'flex-start', gap:'10px', backdropFilter:'blur(20px)',
      width:'100%', boxShadow:'0 8px 32px rgba(0,0,0,.45)',
      animation:'toastIn .3s cubic-bezier(.4,0,.2,1)', direction:'rtl',
    });
    t.innerHTML = `
      <span style="font-size:18px;flex-shrink:0;margin-top:1px">${icons[type]}</span>
      <span style="flex:1;font-family:Heebo,sans-serif;font-size:14px;line-height:1.6;color:${c.text};font-weight:500">${message}</span>
      <button onclick="this.parentElement.remove()" style="background:none;border:none;color:${c.text};cursor:pointer;font-size:16px;opacity:.6;padding:0;flex-shrink:0;margin-top:1px" aria-label="סגור">✕</button>`;
    _container().appendChild(t);
    if (ms > 0) setTimeout(() => {
      t.style.animation = 'toastOut .25s ease forwards';
      setTimeout(() => t.remove(), 260);
    }, ms);
  }

  return Object.freeze({
    success: (m, ms)  => show(m, 'success', ms),
    error:   (m, ms)  => show(m, 'error',   ms ?? 6000),
    warning: (m, ms)  => show(m, 'warning', ms),
    info:    (m, ms)  => show(m, 'info',    ms),
  });
})();


// ============================================
// Confirm Dialog (replaces confirm())
// ============================================
/**
 * @param {string}   message
 * @param {string}   [title='אישור פעולה']
 * @param {string}   [confirmLabel='אישור']
 * @returns {Promise<boolean>}
 */
function showConfirm(message, title = 'אישור פעולה', confirmLabel = 'אישור') {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-card">
        <h3>${title}</h3>
        <p>${message}</p>
        <div class="confirm-actions">
          <button class="btn btn-cancel"    id="_confirmNo">ביטול</button>
          <button class="btn btn-approve"   id="_confirmYes">${confirmLabel}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const cleanup = (val) => { overlay.remove(); resolve(val); };
    overlay.querySelector('#_confirmYes').addEventListener('click', () => cleanup(true));
    overlay.querySelector('#_confirmNo') .addEventListener('click', () => cleanup(false));
    overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(false); });
  });
}


// ============================================
// Retry helper
// ============================================
async function withRetry(fn, retries = 3, baseDelay = 800) {
  let last;
  for (let i = 1; i <= retries; i++) {
    try { return await fn(); }
    catch (e) {
      last = e;
      if (i < retries) await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, i - 1)));
    }
  }
  throw last;
}


// ============================================
// State
// ============================================
let allBookings   = [];
let currentMonth  = new Date().getMonth();
let currentYear   = new Date().getFullYear();
let _unsubscribe  = null;   // Firestore real-time listener teardown


// ============================================
// Auth
// ============================================
function adminLogin() {
  const pw = document.getElementById('adminPassword')?.value ?? '';
  if (pw === ADMIN_CONFIG.PASSWORD) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminPanel').style.display  = 'block';
    sessionStorage.setItem(ADMIN_CONFIG.SESSION_KEY, 'true');
    initAdmin();
  } else {
    const err = document.getElementById('loginError');
    if (err) { err.style.display = 'block'; setTimeout(() => (err.style.display = 'none'), 3000); }
    document.getElementById('adminPassword')?.classList.add('shake');
    setTimeout(() => document.getElementById('adminPassword')?.classList.remove('shake'), 500);
  }
}

function adminLogout() {
  _teardown();
  sessionStorage.removeItem(ADMIN_CONFIG.SESSION_KEY);
  document.getElementById('adminPanel').style.display  = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('adminPassword').value = '';
  allBookings = [];
}

function _teardown() {
  if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
}


// ============================================
// Init
// ============================================
function initAdmin() {
  document.getElementById('adminPrevMonth')?.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
  });
  document.getElementById('adminNextMonth')?.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
  });

  _startRealtimeListener();
}


// ============================================
// Real-time Firestore Listener
// Replaces one-shot loadAllBookings()
// UI updates live whenever Firestore changes.
// ============================================
function _startRealtimeListener() {
  _teardown();

  _unsubscribe = db.collection('bookings')
    .orderBy('createdAt', 'desc')
    .onSnapshot(
      snapshot => {
        allBookings = [];
        snapshot.forEach(doc => {
          const data = { id: doc.id, ...doc.data() };
          data.effectiveStatus = getEffectiveStatus(data);
          allBookings.push(data);
        });

        // Sort: upcoming first, then by dateKey
        allBookings.sort((a, b) => {
          const dA = a.dateKey ?? '9999-99-99';
          const dB = b.dateKey ?? '9999-99-99';
          return dA.localeCompare(dB);
        });

        updateStats();
        renderCalendar();
        renderBookingsList();
        renderNotifications();
      },
      err => {
        Logger.error('Firestore listener error', err);
        Toast.error('שגיאה בטעינת ההזמנות — נסו לרענן את הדף');
      }
    );
}

// One-shot fallback (used after manual add)
async function loadAllBookings() {
  // No-op: real-time listener handles updates automatically
}


// ============================================
// Status helpers
// ============================================
function isBookingPast(booking) {
  if (!booking.dateKey) return false;
  const [y, m, d] = booking.dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (booking.slot === 'weekend') date.setDate(date.getDate() + 1);
  const today = new Date(); today.setHours(0,0,0,0);
  return date < today;
}

function getEffectiveStatus(booking) {
  if (booking.status === 'cancelled') return 'cancelled';
  if (isBookingPast(booking)) return 'completed';
  return 'approved';
}


// ============================================
// Stats
// ============================================
function updateStats() {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('statTotal',     allBookings.length);
  set('statApproved',  allBookings.filter(b => b.effectiveStatus === 'approved').length);
  set('statCompleted', allBookings.filter(b => b.effectiveStatus === 'completed').length);
  set('statCancelled', allBookings.filter(b => b.effectiveStatus === 'cancelled').length);
}


// ============================================
// Tabs
// ============================================
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach((t, i) =>
    t.classList.toggle('active', (tab === 'calendar' ? i === 0 : i === 1))
  );
  document.getElementById('calendarTab') .classList.toggle('active', tab === 'calendar');
  document.getElementById('bookingsTab') .classList.toggle('active', tab === 'bookings');
}


// ============================================
// Calendar Render — DocumentFragment
// ============================================
function renderCalendar() {
  const grid  = document.getElementById('adminCalendarGrid');
  const title = document.getElementById('adminCurrentMonth');
  if (!grid || !title) return;

  title.textContent = `${MONTH_NAMES[currentMonth]} ${currentYear}`;

  const headers = [...grid.querySelectorAll('.cal-header')];
  grid.innerHTML = '';
  const frag = document.createDocumentFragment();
  headers.forEach(h => frag.appendChild(h));

  const firstDow    = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today       = new Date(); today.setHours(0,0,0,0);

  // Build date→bookings map (non-cancelled)
  const bookedMap = {};
  allBookings.forEach(b => {
    if (b.status === 'cancelled' || !b.dateKey) return;
    (bookedMap[b.dateKey] ??= []).push(b);
  });

  // Empty leading cells
  for (let i = 0; i < firstDow; i++) {
    const e = document.createElement('div');
    e.className = 'cal-day empty';
    frag.appendChild(e);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date    = new Date(currentYear, currentMonth, day);
    const dateKey = formatDateKey(date);
    const dow     = date.getDay();
    const isPast  = date < today;
    const isToday = date.getTime() === today.getTime();
    const dayBkgs = bookedMap[dateKey] ?? [];

    const cell = document.createElement('div');
    let cls = 'cal-day';
    if (isPast)  cls += ' past';
    if (isToday) cls += ' today';
    cell.className = cls;

    const slotsHTML = _buildAdminSlotsHTML(dow, dayBkgs, dateKey, isPast);

    cell.innerHTML = `
      <div class="cal-day-number">${day}</div>
      <div class="cal-day-slots">${slotsHTML}</div>`;

    frag.appendChild(cell);
  }

  grid.appendChild(frag);
}

function _buildAdminSlotsHTML(dow, bookings, dateKey, isPast) {
  if (dow === 6) {
    return '<span class="cal-slot gray">שבת</span>';
  }

  if (dow === 5) {
    const wb = bookings.find(b => b.slot === 'weekend');
    if (wb) {
      const cls = isPast ? 'completed-slot' : 'red';
      return `<span class="cal-slot ${cls}" onclick="openBookingModal('${wb.id}')">${_esc(wb.fullName || 'תפוס')}</span>`;
    }
    return isPast ? '' : `<span class="cal-slot green" onclick="openAddEventWithDate('${dateKey}','weekend')">פנוי</span>`;
  }

  // Sun–Thu
  const mb = bookings.find(b => b.slot === 'morning');
  const eb = bookings.find(b => b.slot === 'evening');
  let html = '';

  if (mb) {
    const cls = isPast ? 'completed-slot' : 'red';
    html += `<span class="cal-slot ${cls}" onclick="openBookingModal('${mb.id}')">בוקר: ${_esc(mb.fullName || '')}</span>`;
  } else if (!isPast) {
    html += `<span class="cal-slot green" onclick="openAddEventWithDate('${dateKey}','morning')">בוקר: פנוי</span>`;
  }

  if (eb) {
    const cls = isPast ? 'completed-slot' : 'red';
    html += `<span class="cal-slot ${cls}" onclick="openBookingModal('${eb.id}')">ערב: ${_esc(eb.fullName || '')}</span>`;
  } else if (!isPast) {
    html += `<span class="cal-slot green" onclick="openAddEventWithDate('${dateKey}','evening')">ערב: פנוי</span>`;
  }

  return html;
}

/** Simple HTML-escape to prevent XSS in inline onclick content. */
function _esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}


// ============================================
// Bookings List
// ============================================
function renderBookingsList() { filterBookings(); }

function filterBookings() {
  const statusFilter = document.getElementById('statusFilter')?.value ?? 'active';
  const search       = document.getElementById('searchInput')?.value.trim().toLowerCase() ?? '';
  const list         = document.getElementById('bookingsList');
  if (!list) return;

  let filtered = allBookings;

  if (statusFilter === 'active')    filtered = filtered.filter(b => b.effectiveStatus === 'approved');
  else if (statusFilter === 'completed') filtered = filtered.filter(b => b.effectiveStatus === 'completed');
  else if (statusFilter === 'cancelled') filtered = filtered.filter(b => b.effectiveStatus === 'cancelled');

  if (search) {
    filtered = filtered.filter(b =>
      (b.fullName    ?? '').toLowerCase().includes(search) ||
      (b.phone       ?? '').includes(search) ||
      (b.orderNumber ?? '').toLowerCase().includes(search)
    );
  }

  filtered.sort((a, b) => {
    if (a.effectiveStatus === 'approved' && b.effectiveStatus !== 'approved') return -1;
    if (a.effectiveStatus !== 'approved' && b.effectiveStatus === 'approved') return  1;
    return a.effectiveStatus === 'approved'
      ? (a.dateKey ?? '').localeCompare(b.dateKey ?? '')
      : (b.dateKey ?? '').localeCompare(a.dateKey ?? '');
  });

  if (filtered.length === 0) {
    list.innerHTML = '<div class="no-results">אין הזמנות להצגה</div>';
    return;
  }

  const frag = document.createDocumentFragment();
  filtered.forEach(b => {
    const row = document.createElement('div');
    row.className = `booking-row${b.effectiveStatus !== 'approved' ? ' faded-row' : ''}`;
    row.onclick   = () => openBookingModal(b.id);
    row.innerHTML = `
      <div class="booking-info">
        <strong>${_esc(b.fullName ?? '')}</strong>
        <span>${_esc(b.eventType ?? '')}</span>
      </div>
      <div class="booking-date">
        <span>${b.gregDate ?? ''}</span>
        <span>${b.slotText ?? ''}</span>
      </div>
      <div class="booking-price">₪${(b.price ?? 0).toLocaleString('he-IL')}</div>
      <span class="status-badge ${b.effectiveStatus}">${STATUS_LABELS[b.effectiveStatus] ?? ''}</span>`;
    frag.appendChild(row);
  });

  list.innerHTML = '';
  list.appendChild(frag);
}


// ============================================
// Booking Detail Modal
// ============================================
function openBookingModal(bookingId) {
  const b = allBookings.find(x => x.id === bookingId);
  if (!b) return;

  document.getElementById('modalTitle').textContent = `הזמנה #${b.orderNumber ?? ''}`;

  document.getElementById('modalBody').innerHTML = `
    <div class="modal-detail"><strong>👤 שם:</strong> ${_esc(b.fullName ?? '')}</div>
    <div class="modal-detail"><strong>📱 טלפון:</strong> <a href="tel:${b.phone}">${_esc(b.phone ?? '')}</a></div>
    <div class="modal-detail"><strong>🎉 אירוע:</strong> ${_esc(b.eventType ?? '')}</div>
    <div class="modal-detail"><strong>🏠 סיווג:</strong> ${_esc(b.residentText ?? '')}</div>
    <div class="modal-detail"><strong>📅 תאריך:</strong> ${b.gregDate ?? ''} ${b.hebrewDate ? '| ' + b.hebrewDate : ''}</div>
    <div class="modal-detail"><strong>⏰ שעות:</strong> ${_esc(b.slotText ?? '')} (${_esc(b.hoursText ?? '')})</div>
    <div class="modal-detail"><strong>🎥 מקרן:</strong> ${b.projector ? 'כן (+₪200)' : 'לא'}</div>
    <div class="modal-detail"><strong>📝 הערות:</strong> ${_esc(b.notes || 'אין')}</div>
    <div class="modal-detail"><strong>💰 מחיר:</strong> ₪${(b.price ?? 0).toLocaleString('he-IL')}</div>
    <div class="modal-detail"><strong>📊 סטטוס:</strong> <span class="status-badge ${b.effectiveStatus}">${STATUS_LABELS[b.effectiveStatus] ?? ''}</span></div>
  `;

  let actions = '';
  if (b.effectiveStatus === 'approved') {
    actions = `
      <button class="btn btn-whatsapp" onclick="sendWhatsAppReminder('${bookingId}')">💬 תזכורת WhatsApp</button>
      <button class="btn btn-cancel"   onclick="confirmCancel('${bookingId}')">❌ בטל הזמנה</button>`;
  } else if (b.effectiveStatus === 'cancelled' && !isBookingPast(b)) {
    actions = `<button class="btn btn-approve" onclick="updateBookingStatus('${bookingId}','approved')">🔄 שחזר הזמנה</button>`;
  } else {
    actions = `<p style="text-align:center;color:var(--text-muted);font-size:14px">האירוע הסתיים</p>`;
  }

  document.getElementById('modalActions').innerHTML = actions;
  document.getElementById('bookingModal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('bookingModal').style.display = 'none';
}


// ============================================
// Cancel / Restore — async confirm dialog
// ============================================
async function confirmCancel(bookingId) {
  const b = allBookings.find(x => x.id === bookingId);
  if (!b) return;
  const ok = await showConfirm(
    `האם לבטל את ההזמנה של <strong>${_esc(b.fullName ?? '')}</strong>?`,
    'ביטול הזמנה', 'כן, בטל'
  );
  if (ok) await updateBookingStatus(bookingId, 'cancelled');
}

async function updateBookingStatus(bookingId, newStatus) {
  try {
    await withRetry(() =>
      db.collection('bookings').doc(bookingId).update({ status: newStatus })
    );

    // Optimistic local update (real-time listener will confirm)
    const b = allBookings.find(x => x.id === bookingId);
    if (b) { b.status = newStatus; b.effectiveStatus = getEffectiveStatus(b); }

    closeModal();
    updateStats();
    renderCalendar();
    renderBookingsList();

    newStatus === 'cancelled'
      ? Toast.warning('ההזמנה בוטלה בהצלחה')
      : Toast.success('ההזמנה שוחזרה בהצלחה');

  } catch (err) {
    Logger.error('updateBookingStatus', err);
    Toast.error('שגיאה בעדכון ההזמנה — נסו שוב');
  }
}


// ============================================
// Notifications & WhatsApp
// ============================================
function toggleNotifications() {
  document.getElementById('notificationsSidebar')?.classList.toggle('open');
}

function renderNotifications() {
  const today = new Date(); today.setHours(0,0,0,0);
  const start = new Date(today); start.setDate(today.getDate() + ADMIN_CONFIG.NOTIF_DAYS_START);
  const end   = new Date(today); end.setDate(today.getDate()   + ADMIN_CONFIG.NOTIF_DAYS_END);

  const upcoming = allBookings
    .filter(b => {
      if (b.effectiveStatus !== 'approved' || !b.dateKey) return false;
      const [y, m, d] = b.dateKey.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return date >= start && date <= end;
    })
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  const countEl = document.getElementById('notifCount');
  if (countEl) countEl.textContent = upcoming.length;

  const startStr = start.toLocaleDateString('he-IL');
  const endStr   = end.toLocaleDateString('he-IL');

  const headerEl = document.querySelector('.sidebar-header h2');
  if (headerEl) headerEl.textContent = `🔔 תזכורות פיקדון (${startStr} – ${endStr})`;

  const list = document.getElementById('notificationsList');
  if (!list) return;

  if (upcoming.length === 0) {
    list.innerHTML = `<p class="notif-empty">אין אירועים בין<br>${startStr} ל-${endStr}</p>`;
    return;
  }

  const frag = document.createDocumentFragment();
  upcoming.forEach(b => {
    const card = document.createElement('div');
    card.className = 'notif-card';
    card.onclick = () => {
      openBookingModal(b.id);
      document.getElementById('notificationsSidebar')?.classList.remove('open');
    };
    card.innerHTML = `
      <h3>${_esc(b.fullName ?? 'ללא שם')} — ${_esc(b.eventType ?? '')}</h3>
      <p>📅 ${b.gregDate ?? ''}</p>
      <p>⏰ ${b.slotText ?? ''}</p>
      <p>📱 ${_esc(b.phone ?? '')}</p>`;
    frag.appendChild(card);
  });

  list.innerHTML = '';
  list.appendChild(frag);
}

function formatPhoneForWhatsApp(phone) {
  let p = phone.replace(/\D/g, '');
  if (p.startsWith('0')) p = '972' + p.slice(1);
  return p;
}

function sendWhatsAppReminder(bookingId) {
  const b = allBookings.find(x => x.id === bookingId);
  if (!b) return;

  const msg =
    `שלום ${b.fullName},\n` +
    `זוהי תזכורת לגבי האירוע שלך (${b.eventType}) באולם מרכז שפירא ב-${b.gregDate}.\n` +
    `לשריון סופי נא דאג/י להעביר את תשלום הפיקדון בשבוע הקרוב, אי הסדרת תשלום עלולה להביא לביטול ההזמנה.\n` +
    `נשמח לראותך! 🎊`;

  window.open(
    `https://wa.me/${formatPhoneForWhatsApp(b.phone)}?text=${encodeURIComponent(msg)}`,
    '_blank', 'noopener,noreferrer'
  );
}


// ============================================
// Add Event Modal
// ============================================
function openAddEventModal() {
  _resetAddEventForm();
  document.getElementById('addEventModal').style.display = 'flex';
}

function openAddEventWithDate(dateKey, slot) {
  _resetAddEventForm();
  document.getElementById('eventDate').value = dateKey;
  document.getElementById('eventSlot').value = slot;
  setTimeout(calculatePrice, 50);
  checkSlotAvailability();
  document.getElementById('addEventModal').style.display = 'flex';
}

function closeAddEventModal() {
  document.getElementById('addEventModal').style.display = 'none';
  _resetAddEventForm();
}

function _resetAddEventForm() {
  document.getElementById('addEventForm')?.reset();
  const msg = document.getElementById('slotAvailabilityMsg');
  if (msg) msg.style.display = 'none';
  const priceEl = document.getElementById('eventPrice');
  if (priceEl) priceEl.value = '';
  const bd = document.getElementById('priceBreakdown');
  if (bd) bd.textContent = 'בחר סוג תושב ומשמרת';
}


// ============================================
// Price Calculation
// ============================================
function calculatePrice() {
  const resident    = document.getElementById('eventResident')?.value ?? '';
  const slot        = document.getElementById('eventSlot')?.value     ?? '';
  const hasProjector= document.getElementById('eventProjector')?.checked ?? false;

  if (!resident || !slot) {
    const priceEl = document.getElementById('eventPrice');
    if (priceEl) priceEl.value = '';
    const bd = document.getElementById('priceBreakdown');
    if (bd) bd.textContent = 'בחר סוג תושב ומשמרת';
    return;
  }

  const base  = PRICING_TABLE[resident]?.[slot] ?? 0;
  const total = base + (hasProjector ? PROJECTOR_PRICE : 0);

  const priceEl = document.getElementById('eventPrice');
  if (priceEl) priceEl.value = total;

  const bd = document.getElementById('priceBreakdown');
  if (bd) {
    bd.textContent = hasProjector
      ? `₪${base.toLocaleString()} + מקרן ₪${PROJECTOR_PRICE} = ₪${total.toLocaleString()}`
      : `₪${total.toLocaleString()}`;
  }
}


// ============================================
// Slot Availability Check
// ============================================
function checkSlotAvailability() {
  const dateKey = document.getElementById('eventDate')?.value ?? '';
  const slot    = document.getElementById('eventSlot')?.value ?? '';
  const msgEl   = document.getElementById('slotAvailabilityMsg');
  if (!msgEl) return;

  if (!dateKey || !slot) { msgEl.style.display = 'none'; return; }

  const date = new Date(dateKey + 'T00:00:00');
  const dow  = date.getDay();

  const rules = [
    [dow === 6,                               '❌ לא ניתן להזמין בשבת'],
    [dow === 5 && slot !== 'weekend',         '⚠️ ביום שישי ניתן להזמין רק משמרת סופ"ש'],
    [dow !== 5 && slot === 'weekend',         '⚠️ משמרת סופ"ש זמינה רק ביום שישי'],
  ];

  for (const [cond, msg] of rules) {
    if (cond) { _setAvailMsg(msgEl, msg, false); return; }
  }

  const taken = allBookings.find(b =>
    b.dateKey === dateKey && b.slot === slot && b.status !== 'cancelled'
  );
  taken
    ? _setAvailMsg(msgEl, `❌ המשמרת תפוסה על ידי: ${_esc(taken.fullName ?? 'לא ידוע')}`, false)
    : _setAvailMsg(msgEl, '✅ המשמרת פנויה!', true);
}

function _setAvailMsg(el, text, available) {
  el.style.display = 'block';
  el.className     = `availability-msg ${available ? 'available' : 'unavailable'}`;
  el.textContent   = text;
}


// ============================================
// Submit New Event — with retry + concurrency guard
// ============================================
let _isSubmitting = false;

async function submitNewEvent() {
  if (_isSubmitting) { Toast.warning('בתהליך שמירה, אנא המתינו...'); return; }

  const fullName  = document.getElementById('eventFullName')?.value.trim() ?? '';
  const phone     = document.getElementById('eventPhone')?.value.trim()    ?? '';
  const eventType = document.getElementById('eventType')?.value            ?? '';
  const resident  = document.getElementById('eventResident')?.value        ?? '';
  const dateKey   = document.getElementById('eventDate')?.value            ?? '';
  const slot      = document.getElementById('eventSlot')?.value            ?? '';
  const projector = document.getElementById('eventProjector')?.checked     ?? false;
  const price     = parseInt(document.getElementById('eventPrice')?.value ?? '0', 10) || 0;
  const notes     = document.getElementById('eventNotes')?.value.trim()    ?? '';

  // Validation
  const validations = [
    [!fullName,  'נא להזין שם מלא'],
    [!phone,     'נא להזין טלפון'],
    [!eventType, 'נא לבחור סוג אירוע'],
    [!dateKey,   'נא לבחור תאריך'],
    [!slot,      'נא לבחור משמרת'],
  ];
  for (const [cond, msg] of validations) {
    if (cond) { Toast.warning(msg); return; }
  }

  const date = new Date(dateKey + 'T00:00:00');
  const dow  = date.getDay();
  const dowRules = [
    [dow === 6,                      '❌ לא ניתן להזמין בשבת'],
    [dow === 5 && slot !== 'weekend','⚠️ ביום שישי ניתן להזמין רק משמרת סופ"ש'],
    [dow !== 5 && slot === 'weekend','⚠️ משמרת סופ"ש זמינה רק ביום שישי'],
  ];
  for (const [cond, msg] of dowRules) {
    if (cond) { Toast.warning(msg); return; }
  }

  const existing = allBookings.find(b =>
    b.dateKey === dateKey && b.slot === slot && b.status !== 'cancelled'
  );
  if (existing) {
    Toast.error(`המשמרת תפוסה על ידי: ${existing.fullName ?? 'לא ידוע'}`);
    return;
  }

  const orderNumber = _generateOrderNumber();
  const bookingData = {
    orderNumber,
    fullName, phone, eventType,
    residentText: resident,
    dateKey,
    gregDate:    formatGregDate(dateKey),
    hebrewDate:  '',
    slot,
    slotText:    SLOT_META[slot]?.text  ?? slot,
    hoursText:   SLOT_META[slot]?.hours ?? '',
    projector, price, notes,
    status:      'approved',
    source:      'admin-manual',
    createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
  };

  // UI: disable button
  _isSubmitting = true;
  const submitBtn = document.querySelector('#addEventModal .btn-approve');
  if (submitBtn) { submitBtn.textContent = '⏳ שומר...'; submitBtn.disabled = true; }

  try {
    await withRetry(() => db.collection('bookings').add(bookingData));
    closeAddEventModal();
    // Real-time listener will refresh the UI automatically
    Toast.success(`האירוע נוסף! מספר הזמנה: ${orderNumber}`);
  } catch (err) {
    Logger.error('submitNewEvent', err);
    Toast.error('שגיאה בהוספת האירוע — נסו שוב');
  } finally {
    _isSubmitting = false;
    if (submitBtn) { submitBtn.textContent = '✅ הוסף אירוע'; submitBtn.disabled = false; }
  }
}


// ============================================
// Helpers
// ============================================
function formatDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function formatGregDate(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `יום ${DAY_NAMES[date.getDay()]}, ${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}`;
}

function _generateOrderNumber() {
  const now  = new Date();
  const yy   = now.getFullYear().toString().slice(-2);
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const dd   = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `ORD-${yy}${mm}${dd}-${rand}`;
}


// ============================================
// DOMContentLoaded Bootstrap
// ============================================
document.addEventListener('DOMContentLoaded', () => {

  // Auto-login if session persists
  if (sessionStorage.getItem(ADMIN_CONFIG.SESSION_KEY) === 'true') {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminPanel') .style.display = 'block';
    initAdmin();
  }

  // Enter key on password field
  document.getElementById('adminPassword')
    ?.addEventListener('keydown', e => { if (e.key === 'Enter') adminLogin(); });

  // Escape closes modals
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    closeModal();
    closeAddEventModal();
    document.getElementById('notificationsSidebar')?.classList.remove('open');
  });

  // Close notifications sidebar when clicking outside
  document.addEventListener('click', e => {
    const sidebar = document.getElementById('notificationsSidebar');
    const btn     = document.querySelector('.btn-notifications');
    if (sidebar?.classList.contains('open') &&
        !sidebar.contains(e.target) && e.target !== btn) {
      sidebar.classList.remove('open');
    }
  });

  // Pricing auto-calc listeners
  ['eventDate','eventSlot'].forEach(id =>
    document.getElementById(id)?.addEventListener('change', () => {
      checkSlotAvailability(); calculatePrice();
    })
  );
  document.getElementById('eventResident') ?.addEventListener('change', calculatePrice);
  document.getElementById('eventProjector')?.addEventListener('change', calculatePrice);

  // Live search debounce
  document.getElementById('searchInput')?.addEventListener('input',
    _debounce(filterBookings, 200)
  );
});

function _debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}