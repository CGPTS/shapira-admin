// ============================================
// Admin Panel - אולם מרכז שפירא
// ============================================

const ADMIN_PASSWORD = '2026'; // 🔴 שנה לסיסמה שלך!

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
                slotsHTML = isPast ? '' : '<span class="cal-slot green">פנוי</span>';
            }
        } else {
            const morningBooking = bookingsForDay.find(b => b.slot === 'morning');
            const eveningBooking = bookingsForDay.find(b => b.slot === 'evening');

            if (morningBooking) {
                const slotClass = isPast ? 'completed-slot' : 'red';
                slotsHTML += `<span class="cal-slot ${slotClass}" onclick="openBookingModal('${morningBooking.id}')">בוקר: ${morningBooking.fullName || ''}</span>`;
            } else if (!isPast) {
                slotsHTML += '<span class="cal-slot green">בוקר: פנוי</span>';
            }

            if (eveningBooking) {
                const slotClass = isPast ? 'completed-slot' : 'red';
                slotsHTML += `<span class="cal-slot ${slotClass}" onclick="openBookingModal('${eveningBooking.id}')">ערב: ${eveningBooking.fullName || ''}</span>`;
            } else if (!isPast) {
                slotsHTML += '<span class="cal-slot green">ערב: פנוי</span>';
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
        <div class="modal-detail"><strong>🎥 מקרן:</strong> ${booking.projector ? 'כן (+₪50)' : 'לא'}</div>
        <div class="modal-detail"><strong>📝 הערות:</strong> ${booking.notes || 'אין'}</div>
        <div class="modal-detail"><strong>💰 מחיר:</strong> ₪${(booking.price || 0).toLocaleString()}</div>
        <div class="modal-detail"><strong>📊 סטטוס:</strong> <span class="status-badge ${booking.effectiveStatus}">${statusText}</span></div>
    `;

    let actionsHTML = '';

    if (booking.effectiveStatus === 'approved') {
        actionsHTML = `
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
// Init on load
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    if (sessionStorage.getItem('adminLoggedIn') === 'true') {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        initAdmin();
    }
});