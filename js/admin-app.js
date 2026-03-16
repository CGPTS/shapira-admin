// ============================================
// Admin Panel - אולם מרכז שפירא
// ============================================

const ADMIN_PASSWORD = '2026'; // 🔴 שנה לסיסמה שלך!

// ✅ טבלת תעריפים
const PRICING_TABLE = {
    'תושב המושב': {
        'morning': 1000,
        'evening': 1000,
        'weekend': 1800
    },
    'תושב חוץ': {
        'morning': 1500,
        'evening': 1500,
        'weekend': 2500
    }
};

const PROJECTOR_PRICE = 200;

let allBookings = [];
let currentMonth, currentYear;

// ============================================
// Login / Logout
// ============================================
function adminLogin() {
    const password = document.getElementById('adminPassword').value;
    if (password === ADMIN_PASSWORD) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        sessionStorage.setItem('adminLoggedIn', 'true');
        initAdmin();
    } else {
        document.getElementById('loginError').style.display = 'block';
        setTimeout(() => {
            document.getElementById('loginError').style.display = 'none';
        }, 3000);
    }
}

function adminLogout() {
    sessionStorage.removeItem('adminLoggedIn');
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('adminPassword').value = '';
}

// ============================================
// Initialize
// ============================================
function initAdmin() {
    const now = new Date();
    currentMonth = now.getMonth();
    currentYear = now.getFullYear();

    document.getElementById('adminPrevMonth').addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        renderCalendar();
    });

    document.getElementById('adminNextMonth').addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        renderCalendar();
    });

    loadAllBookings();
}

// ============================================
// Check if booking date has passed
// ============================================
function isBookingPast(booking) {
    if (!booking.dateKey) return false;
    const parts = booking.dateKey.split('-');
    const bookingDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));

    // For weekend events, check Saturday (day after Friday)
    if (booking.slot === 'weekend') {
        bookingDate.setDate(bookingDate.getDate() + 1);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return bookingDate < today;
}

// Get effective status (adds 'completed' logic)
function getEffectiveStatus(booking) {
    if (booking.status === 'cancelled') return 'cancelled';
    if (isBookingPast(booking)) return 'completed';
    return 'approved';
}

// ============================================
// Load All Bookings
// ============================================
async function loadAllBookings() {
    try {
        const snapshot = await db.collection('bookings')
            .orderBy('createdAt', 'desc')
            .get();

        allBookings = [];
        snapshot.forEach(doc => {
            const data = { id: doc.id, ...doc.data() };
            data.effectiveStatus = getEffectiveStatus(data);
            allBookings.push(data);
        });

        // Sort by dateKey (closest first)
        allBookings.sort((a, b) => {
            const dateA = a.dateKey || '9999-99-99';
            const dateB = b.dateKey || '9999-99-99';
            return dateA.localeCompare(dateB);
        });

        updateStats();
        renderCalendar();
        renderBookingsList();
		renderNotifications();

    } catch (error) {
        console.error('Error loading bookings:', error);
    }
}

// ============================================
// Stats
// ============================================
function updateStats() {
    const total = allBookings.length;
    const approved = allBookings.filter(b => b.effectiveStatus === 'approved').length;
    const completed = allBookings.filter(b => b.effectiveStatus === 'completed').length;
    const cancelled = allBookings.filter(b => b.effectiveStatus === 'cancelled').length;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statApproved').textContent = approved;
    document.getElementById('statCompleted').textContent = completed;
    document.getElementById('statCancelled').textContent = cancelled;
}

// ============================================
// Tabs
// ============================================
function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

    if (tab === 'calendar') {
        document.querySelector('.tab:nth-child(1)').classList.add('active');
        document.getElementById('calendarTab').classList.add('active');
    } else {
        document.querySelector('.tab:nth-child(2)').classList.add('active');
        document.getElementById('bookingsTab').classList.add('active');
    }
}

// ============================================
// Calendar Render
// ============================================
function renderCalendar() {
    const grid = document.getElementById('adminCalendarGrid');
    const monthTitle = document.getElementById('adminCurrentMonth');

    const months = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
    monthTitle.textContent = `${months[currentMonth]} ${currentYear}`;

    const headers = grid.querySelectorAll('.cal-header');
    grid.innerHTML = '';
    headers.forEach(h => grid.appendChild(h));

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const bookedMap = {};
    allBookings.forEach(b => {
        if (b.status === 'cancelled') return;
        if (!b.dateKey) return;
        if (!bookedMap[b.dateKey]) bookedMap[b.dateKey] = [];
        bookedMap[b.dateKey].push(b);
    });

    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'cal-day empty';
        grid.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentYear, currentMonth, day);
        const dateKey = formatDateKey(date);
        const dayOfWeek = date.getDay();
        const isPast = date < today;
        const bookingsForDay = bookedMap[dateKey] || [];

        const cell = document.createElement('div');
        cell.className = 'cal-day';
        if (isPast) cell.classList.add('past');

        let slotsHTML = '';

        if (dayOfWeek === 6) {
            slotsHTML = '<span class="cal-slot gray">שבת</span>';
        } else if (dayOfWeek === 5) {
            const weekendBooking = bookingsForDay.find(b => b.slot === 'weekend');
            if (weekendBooking) {
                const slotClass = isPast ? 'completed-slot' : 'red';
                slotsHTML = `<span class="cal-slot ${slotClass}" onclick="openBookingModal('${weekendBooking.id}')">${weekendBooking.fullName || 'תפוס'}</span>`;
            } else {
                slotsHTML = isPast ? '' : `<span class="cal-slot green" onclick="openAddEventWithDate('${dateKey}', 'weekend')">פנוי</span>`;
            }
        } else {
            const morningBooking = bookingsForDay.find(b => b.slot === 'morning');
            const eveningBooking = bookingsForDay.find(b => b.slot === 'evening');

            if (morningBooking) {
                const slotClass = isPast ? 'completed-slot' : 'red';
                slotsHTML += `<span class="cal-slot ${slotClass}" onclick="openBookingModal('${morningBooking.id}')">בוקר: ${morningBooking.fullName || ''}</span>`;
            } else if (!isPast) {
                slotsHTML += `<span class="cal-slot green" onclick="openAddEventWithDate('${dateKey}', 'morning')">בוקר: פנוי</span>`;
            }

            if (eveningBooking) {
                const slotClass = isPast ? 'completed-slot' : 'red';
                slotsHTML += `<span class="cal-slot ${slotClass}" onclick="openBookingModal('${eveningBooking.id}')">ערב: ${eveningBooking.fullName || ''}</span>`;
            } else if (!isPast) {
                slotsHTML += `<span class="cal-slot green" onclick="openAddEventWithDate('${dateKey}', 'evening')">ערב: פנוי</span>`;
            }
        }

        cell.innerHTML = `
            <div class="cal-day-number">${day}</div>
            <div class="cal-day-slots">${slotsHTML}</div>
        `;

        grid.appendChild(cell);
    }
}

// ============================================
// Bookings List
// ============================================
function renderBookingsList() {
    filterBookings();
}

function filterBookings() {
    const statusFilter = document.getElementById('statusFilter').value;
    const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
    const list = document.getElementById('bookingsList');

    let filtered = allBookings;

    switch (statusFilter) {
        case 'active':
            filtered = filtered.filter(b => b.effectiveStatus === 'approved');
            break;
        case 'completed':
            filtered = filtered.filter(b => b.effectiveStatus === 'completed');
            break;
        case 'cancelled':
            filtered = filtered.filter(b => b.effectiveStatus === 'cancelled');
            break;
        // 'all' - show everything
    }

    if (searchTerm) {
        filtered = filtered.filter(b =>
            (b.fullName || '').toLowerCase().includes(searchTerm) ||
            (b.phone || '').includes(searchTerm) ||
            (b.orderNumber || '').toLowerCase().includes(searchTerm)
        );
    }

    // Sort: active bookings by closest date first, completed/cancelled by most recent first
    filtered.sort((a, b) => {
        if (a.effectiveStatus === 'approved' && b.effectiveStatus !== 'approved') return -1;
        if (a.effectiveStatus !== 'approved' && b.effectiveStatus === 'approved') return 1;

        if (a.effectiveStatus === 'approved') {
            return (a.dateKey || '').localeCompare(b.dateKey || '');
        }
        return (b.dateKey || '').localeCompare(a.dateKey || '');
    });

    if (filtered.length === 0) {
        list.innerHTML = '<div class="no-results">אין הזמנות להצגה</div>';
        return;
    }

    list.innerHTML = filtered.map(b => {
        const statusTexts = {
            approved: 'פעיל',
            completed: 'הסתיים',
            cancelled: 'מבוטל'
        };
        const statusText = statusTexts[b.effectiveStatus] || 'פעיל';
        const statusClass = b.effectiveStatus;

        return `
            <div class="booking-row ${statusClass === 'cancelled' || statusClass === 'completed' ? 'faded-row' : ''}" onclick="openBookingModal('${b.id}')">
                <div class="booking-info">
                    <strong>${b.fullName || ''}</strong>
                    <span>${b.eventType || ''}</span>
                </div>
                <div class="booking-date">
                    <span>${b.gregDate || ''}</span>
                    <span>${b.slotText || ''}</span>
                </div>
                <div class="booking-price">₪${(b.price || 0).toLocaleString()}</div>
                <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
        `;
    }).join('');
}

// ============================================
// Booking Modal
// ============================================
function openBookingModal(bookingId) {
    const booking = allBookings.find(b => b.id === bookingId);
    if (!booking) return;

    document.getElementById('modalTitle').textContent = `הזמנה #${booking.orderNumber || ''}`;

    const statusTexts = {
        approved: 'פעיל',
        completed: 'הסתיים',
        cancelled: 'מבוטל'
    };
    const statusText = statusTexts[booking.effectiveStatus] || 'פעיל';

    document.getElementById('modalBody').innerHTML = `
        <div class="modal-detail"><strong>👤 שם:</strong> ${booking.fullName || ''}</div>
        <div class="modal-detail"><strong>📱 טלפון:</strong> <a href="tel:${booking.phone}">${booking.phone || ''}</a></div>
        <div class="modal-detail"><strong>🎉 אירוע:</strong> ${booking.eventType || ''}</div>
        <div class="modal-detail"><strong>🏠 סיווג:</strong> ${booking.residentText || ''}</div>
        <div class="modal-detail"><strong>📅 תאריך:</strong> ${booking.gregDate || ''} | ${booking.hebrewDate || ''}</div>
        <div class="modal-detail"><strong>⏰ שעות:</strong> ${booking.slotText || ''} (${booking.hoursText || ''})</div>
        <div class="modal-detail"><strong>🎥 מקרן:</strong> ${booking.projector ? 'כן (+₪200)' : 'לא'}</div>
        <div class="modal-detail"><strong>📝 הערות:</strong> ${booking.notes || 'אין'}</div>
        <div class="modal-detail"><strong>💰 מחיר:</strong> ₪${(booking.price || 0).toLocaleString()}</div>
        <div class="modal-detail"><strong>📊 סטטוס:</strong> <span class="status-badge ${booking.effectiveStatus}">${statusText}</span></div>
    `;

    let actionsHTML = '';

    if (booking.effectiveStatus === 'approved') {
        actionsHTML = `
            <button class="btn btn-whatsapp" onclick="sendWhatsAppReminder('${bookingId}')">💬 שליחת תזכורת (WhatsApp)</button>
            <button class="btn btn-cancel" onclick="confirmCancel('${bookingId}')">❌ בטל הזמנה</button>
        `;
    } else if (booking.effectiveStatus === 'cancelled' && !isBookingPast(booking)) {
        actionsHTML = `
            <button class="btn btn-approve" onclick="updateBookingStatus('${bookingId}', 'approved')">🔄 שחזר הזמנה</button>
        `;
    } else {
        actionsHTML = '<p style="text-align:center;color:#888;">האירוע הסתיים</p>';
    }

    document.getElementById('modalActions').innerHTML = actionsHTML;
    document.getElementById('bookingModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('bookingModal').style.display = 'none';
}

// ============================================
// ✅ AUTO-CALCULATE PRICING
// ============================================
function calculatePrice() {
    const residentType = document.getElementById('eventResident').value;
    const slot = document.getElementById('eventSlot').value;
    const hasProjector = document.getElementById('eventProjector').checked;

    // אם לא בחרו תושב או משמרת - לא מחשבים
    if (!residentType || !slot) {
        document.getElementById('eventPrice').value = '';
        return;
    }

    // קבלת המחיר הבסיסי
    let basePrice = PRICING_TABLE[residentType]?.[slot] || 0;
    let totalPrice = basePrice;

    // הוספת מחיר המקרן אם נבחר
    if (hasProjector) {
        totalPrice += PROJECTOR_PRICE;
    }

    // עדכון שדה המחיר
    document.getElementById('eventPrice').value = totalPrice;

    // עדכון הערה דינמית
    updatePriceBreakdown(basePrice, hasProjector);
}

// הצגת פירוט המחיר
function updatePriceBreakdown(basePrice, hasProjector) {
    let breakdown = `💰 מחיר בסיסי: ₪${basePrice}`;
    if (hasProjector) {
        breakdown += ` + מקרן: ₪${PROJECTOR_PRICE}`;
    }
    breakdown += ` = ₪${basePrice + (hasProjector ? PROJECTOR_PRICE : 0)}`;

    // אם קיים אלמנט להצגת הפירוט - עדכן אותו
    const breakdown_el = document.getElementById('priceBreakdown');
    if (breakdown_el) {
        breakdown_el.textContent = breakdown;
    }
}

// ============================================
// Add Event Modal
// ============================================
function openAddEventModal() {
    resetAddEventForm();
    document.getElementById('addEventModal').style.display = 'flex';
}

function openAddEventWithDate(dateKey, slot) {
    resetAddEventForm();
    document.getElementById('eventDate').value = dateKey;
    document.getElementById('eventSlot').value = slot;
    setTimeout(() => calculatePrice(), 100); // חשב מחיר לאחר טעינת הטופס
    checkSlotAvailability();
    document.getElementById('addEventModal').style.display = 'flex';
}

function closeAddEventModal() {
    document.getElementById('addEventModal').style.display = 'none';
    resetAddEventForm();
}

function resetAddEventForm() {
    document.getElementById('addEventForm').reset();
    document.getElementById('slotAvailabilityMsg').style.display = 'none';
    document.getElementById('eventPrice').value = '';
}

// Check if slot is available when date/slot changes
function checkSlotAvailability() {
    const dateKey = document.getElementById('eventDate').value;
    const slot = document.getElementById('eventSlot').value;
    const msgEl = document.getElementById('slotAvailabilityMsg');

    if (!dateKey || !slot) {
        msgEl.style.display = 'none';
        return;
    }

    // Check day of week constraints
    const date = new Date(dateKey + 'T00:00:00');
    const dayOfWeek = date.getDay();

    if (dayOfWeek === 6) {
        msgEl.style.display = 'block';
        msgEl.className = 'availability-msg unavailable';
        msgEl.textContent = '❌ לא ניתן להזמין בשבת';
        return;
    }

    if (dayOfWeek === 5 && slot !== 'weekend') {
        msgEl.style.display = 'block';
        msgEl.className = 'availability-msg unavailable';
        msgEl.textContent = '⚠️ ביום שישי ניתן להזמין רק משמרת סופ"ש';
        return;
    }

    if (dayOfWeek !== 5 && slot === 'weekend') {
        msgEl.style.display = 'block';
        msgEl.className = 'availability-msg unavailable';
        msgEl.textContent = '⚠️ משמרת סופ"ש זמינה רק ביום שישי';
        return;
    }

    // Check if slot is already taken
    const existing = allBookings.find(b =>
        b.dateKey === dateKey &&
        b.slot === slot &&
        b.status !== 'cancelled'
    );

    if (existing) {
        msgEl.style.display = 'block';
        msgEl.className = 'availability-msg unavailable';
        msgEl.textContent = `❌ המשמרת הזו תפוסה על ידי: ${existing.fullName || 'לא ידוע'}`;
    } else {
        msgEl.style.display = 'block';
        msgEl.className = 'availability-msg available';
        msgEl.textContent = '✅ המשמרת פנויה!';
    }
}

// Generate order number
function generateOrderNumber() {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 9000) + 1000;
    return `ORD-${year}${month}${day}-${random}`;
}

// Get slot text
function getSlotText(slot) {
    switch (slot) {
        case 'morning': return 'בוקר';
        case 'evening': return 'ערב';
        case 'weekend': return 'סופ"ש';
        default: return slot;
    }
}

// Get hours text
function getHoursText(slot) {
    switch (slot) {
        case 'morning': return '08:00-16:00';
        case 'evening': return '17:00-01:00';
        case 'weekend': return 'שישי 14:00 - שבת 23:00';
        default: return '';
    }
}

// Format gregorian date for display
function formatGregDate(dateKey) {
    const parts = dateKey.split('-');
    const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const dayName = days[date.getDay()];
    return `יום ${dayName}, ${parts[2]}/${parts[1]}/${parts[0]}`;
}

// Submit new event
async function submitNewEvent() {
    const fullName = document.getElementById('eventFullName').value.trim();
    const phone = document.getElementById('eventPhone').value.trim();
    const eventType = document.getElementById('eventType').value;
    const resident = document.getElementById('eventResident').value;
    const dateKey = document.getElementById('eventDate').value;
    const slot = document.getElementById('eventSlot').value;
    const projector = document.getElementById('eventProjector').checked;
    const price = parseInt(document.getElementById('eventPrice').value) || 0;
    const notes = document.getElementById('eventNotes').value.trim();

    // Validation
    if (!fullName) { alert('⚠️ נא להזין שם מלא'); return; }
    if (!phone) { alert('⚠️ נא להזין טלפון'); return; }
    if (!eventType) { alert('⚠️ נא לבחור סוג אירוע'); return; }
    if (!dateKey) { alert('⚠️ נא לבחור תאריך'); return; }
    if (!slot) { alert('⚠️ נא לבחור משמרת'); return; }

    // Validate day-of-week vs slot
    const date = new Date(dateKey + 'T00:00:00');
    const dayOfWeek = date.getDay();

    if (dayOfWeek === 6) {
        alert('❌ לא ניתן להזמין בשבת');
        return;
    }
    if (dayOfWeek === 5 && slot !== 'weekend') {
        alert('⚠️ ביום שישי ניתן להזמין רק משמרת סופ"ש');
        return;
    }
    if (dayOfWeek !== 5 && slot === 'weekend') {
        alert('⚠️ משמרת סופ"ש זמינה רק ביום שישי');
        return;
    }

    // Check availability
    const existing = allBookings.find(b =>
        b.dateKey === dateKey &&
        b.slot === slot &&
        b.status !== 'cancelled'
    );

    if (existing) {
        alert(`❌ המשמרת הזו כבר תפוסה על ידי: ${existing.fullName || 'לא ידוע'}`);
        return;
    }

    // Build booking data
    const orderNumber = generateOrderNumber();
    const bookingData = {
        orderNumber: orderNumber,
        fullName: fullName,
        phone: phone,
        eventType: eventType,
        residentText: resident,
        dateKey: dateKey,
        gregDate: formatGregDate(dateKey),
        hebrewDate: '',
        slot: slot,
        slotText: getSlotText(slot),
        hoursText: getHoursText(slot),
        projector: projector,
        price: price,
        notes: notes,
        status: 'approved',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        source: 'admin-manual'
    };

    try {
        // Show loading
        const submitBtn = document.querySelector('#addEventModal .btn-approve');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = '⏳ שומר...';
        submitBtn.disabled = true;

        await db.collection('bookings').add(bookingData);

        closeAddEventModal();
        await loadAllBookings();

        alert(`✅ האירוע נוסף בהצלחה!\nמספר הזמנה: ${orderNumber}`);

    } catch (error) {
        console.error('Error adding event:', error);
        alert('❌ שגיאה בהוספת האירוע. נסה שוב.');
    } finally {
        const submitBtn = document.querySelector('#addEventModal .btn-approve');
        if (submitBtn) {
            submitBtn.textContent = '✅ הוסף אירוע';
            submitBtn.disabled = false;
        }
    }
}

// ============================================
// Update Booking Status
// ============================================
function confirmCancel(bookingId) {
    const booking = allBookings.find(b => b.id === bookingId);
    if (confirm(`האם אתה בטוח שברצונך לבטל את ההזמנה של ${booking?.fullName || ''}?`)) {
        updateBookingStatus(bookingId, 'cancelled');
    }
}

async function updateBookingStatus(bookingId, newStatus) {
    try {
        await db.collection('bookings').doc(bookingId).update({
            status: newStatus
        });

        const booking = allBookings.find(b => b.id === bookingId);
        if (booking) {
            booking.status = newStatus;
            booking.effectiveStatus = getEffectiveStatus(booking);
        }

        closeModal();
        updateStats();
        renderCalendar();
        renderBookingsList();

        if (newStatus === 'cancelled') {
            alert('❌ ההזמנה בוטלה בהצלחה!');
        } else {
            alert('✅ ההזמנה שוחזרה בהצלחה!');
        }

    } catch (error) {
        console.error('Error updating booking:', error);
        alert('❌ שגיאה בעדכון ההזמנה');
    }
}

// ============================================
// Helpers
// ============================================
function formatDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// ============================================
// Notifications & WhatsApp Logic
// ============================================

function toggleNotifications() {
    document.getElementById('notificationsSidebar').classList.toggle('open');
}

function renderNotifications() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // תחילת הטווח - בעוד 14 ימים בדיוק מהיום
    const targetWeekStart = new Date(today);
    targetWeekStart.setDate(today.getDate() + 14);

    // סוף הטווח - בעוד 21 ימים מהיום (שבוע שלם מתחילת הטווח)
    const targetWeekEnd = new Date(today);
    targetWeekEnd.setDate(today.getDate() + 21);

    const upcoming = allBookings.filter(b => {
        if (b.effectiveStatus !== 'approved') return false;
        if (!b.dateKey) return false;
        
        const parts = b.dateKey.split('-');
        const bDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        
        // בודק אם תאריך האירוע נופל בדיוק בתוך הטווח של אותו שבוע
        return bDate >= targetWeekStart && bDate <= targetWeekEnd;
    });

    // מיון כך שהאירוע הקרוב ביותר באותו שבוע יופיע למעלה
    upcoming.sort((a, b) => a.dateKey.localeCompare(b.dateKey));

    // עדכון המונה בכפתור העליון
    document.getElementById('notifCount').textContent = upcoming.length;

    // פורמט יפה לתאריכים כדי להציג בכותרת (לדוגמה: 15.3.2026)
    const startStr = targetWeekStart.toLocaleDateString('he-IL');
    const endStr = targetWeekEnd.toLocaleDateString('he-IL');

    // עדכון דינמי של כותרת הפאנל הצדדי שתראה את התאריכים המדויקים
    const headerTitle = document.querySelector('.sidebar-header h2');
    if (headerTitle) {
        headerTitle.textContent = `🔔 תזכורות פיקדון (${startStr} - ${endStr})`;
    }

    const list = document.getElementById('notificationsList');
    
    if (upcoming.length === 0) {
        list.innerHTML = `<p style="text-align:center; color:#888; margin-top:20px;">אין אירועים בשבוע שבין ה-${startStr} ל-${endStr}.</p>`;
        return;
    }

    list.innerHTML = upcoming.map(b => `
        <div class="notif-card" onclick="openBookingModal('${b.id}'); document.getElementById('notificationsSidebar').classList.remove('open');">
            <h3>${b.fullName || 'ללא שם'} - ${b.eventType || ''}</h3>
            <p>📅 ${b.gregDate}</p>
            <p>⏰ ${b.slotText}</p>
            <p>📱 ${b.phone}</p>
        </div>
    `).join('');
}

// עזר לסידור מספר טלפון פורמט בינלאומי לוואטסאפ
function formatPhoneForWhatsApp(phone) {
    let p = phone.replace(/\D/g, ''); // מסיר תווים שאינם מספרים
    if (p.startsWith('0')) {
        p = '972' + p.substring(1);
    }
    return p;
}

function sendWhatsAppReminder(bookingId) {
    const b = allBookings.find(x => x.id === bookingId);
    if (!b) return;

    const phone = formatPhoneForWhatsApp(b.phone);
    
    // ניסוח ההודעה
    const msg = `שלום ${b.fullName},
זוהי תזכורת לגבי האירוע שלך (${b.eventType}) באולם מרכז שפירא ב-${b.gregDate}.
נא דאג/י להעביר את הפיקדון בהקדם לפי התקנון שעליו חתמת.
נשמח לראותך! 🎊`;

    // פותח חלון ווצאפ
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}

// ============================================
// Init on load
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    if (sessionStorage.getItem('adminLoggedIn') === 'true') {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        initAdmin();
    }

    // Add event listeners for slot availability check
    const eventDate = document.getElementById('eventDate');
    const eventSlot = document.getElementById('eventSlot');
    const eventResident = document.getElementById('eventResident');
    const eventProjector = document.getElementById('eventProjector');

    if (eventDate) eventDate.addEventListener('change', () => {
        checkSlotAvailability();
        calculatePrice();
    });
    if (eventSlot) eventSlot.addEventListener('change', () => {
        checkSlotAvailability();
        calculatePrice();
    });
    if (eventResident) eventResident.addEventListener('change', calculatePrice);
    if (eventProjector) eventProjector.addEventListener('change', calculatePrice);
});